// ============================================================
// SMS Service - SMS verification code handling
// ============================================================

import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Inject } from '@nestjs/common'
import { REDIS_CLIENT } from '../../redis/redis.module'
import { createHmac, randomUUID } from 'crypto'

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name)
  private readonly codeExpiry: number
  private readonly maxAttempts: number
  private readonly lockExpiry: number

  constructor(
    @Inject(REDIS_CLIENT) private redis: any,
    private configService: ConfigService,
  ) {
    this.codeExpiry = (this.configService.get('auth.smsCodeExpiryMinutes', 5) || 5) * 60
    this.maxAttempts = this.configService.get('auth.smsMaxAttempts', 5) || 5
    this.lockExpiry = 60 * 60 // 1 hour lock after too many failed attempts
  }

  /**
   * Generate and send a 6-digit SMS verification code
   * In dev mode, the code is returned in the response for testing
   */
  async sendCode(
    phone: string,
    purpose: 'login' | 'bind_phone' | 'reset_password' = 'login',
  ): Promise<{ success: boolean; devCode?: string }> {
    const env = this.configService.get('NODE_ENV', 'development')
    const isDev = env === 'development'

    // Check rate limit
    const rateLimitKey = `sms:rate:${phone}`
    const attempts = await this.redis.get(rateLimitKey)
    if (attempts && parseInt(attempts, 10) >= this.maxAttempts) {
      this.logger.warn(`SMS rate limit exceeded for ${phone}`)
      return { success: false }
    }

    // Generate 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString()
    const key = `sms:code:${purpose}:${phone}`

    if (isDev) {
      this.logger.log(`[DEV SMS] Phone: ${phone} | Purpose: ${purpose} | Code: ${code}`)
    } else {
      await this.sendViaAliyun(phone, code, purpose)
    }
    await this.redis.setex(key, this.codeExpiry, code)
    const current = await this.redis.incr(rateLimitKey)
    if (current === 1) await this.redis.expire(rateLimitKey, this.lockExpiry)
    return isDev ? { success: true, devCode: code } : { success: true }
  }

  /**
   * Verify a SMS code
   * Returns true if code matches and hasn't expired
   */
  async verifyCode(
    phone: string,
    code: string,
    purpose: 'login' | 'bind_phone' | 'reset_password' = 'login',
  ): Promise<boolean> {
    const key = `sms:code:${purpose}:${phone}`

    const storedCode = await this.redis.get(key)
    if (!storedCode) {
      return false
    }

    const isValid = storedCode === code

    // Delete code after verification (single use)
    if (isValid) {
      await this.redis.del(key)
    }

    return isValid
  }

  /**
   * Invalidate all codes for a phone number
   */
  async invalidateCodes(phone: string): Promise<void> {
    const pattern = `sms:code:*:${phone}`
    const keys = await this.redis.keys(pattern)
    if (keys.length > 0) {
      await this.redis.del(...keys)
    }
  }
  private async sendViaAliyun(phone: string, code: string, purpose: string): Promise<void> {
    const accessKeyId = process.env.ALIYUN_SMS_ACCESS_KEY
    const accessKeySecret = process.env.ALIYUN_SMS_ACCESS_SECRET
    const signName = process.env.ALIYUN_SMS_SIGN_NAME
    const templateCode = process.env.ALIYUN_SMS_TEMPLATE_CODE
    if (!accessKeyId || !accessKeySecret || !signName || !templateCode)
      throw new ServiceUnavailableException('短信服务未配置完成')
    const params: Record<string, string> = {
      AccessKeyId: accessKeyId,
      Action: 'SendSms',
      Format: 'JSON',
      PhoneNumbers: phone,
      RegionId: process.env.ALIYUN_SMS_REGION || 'cn-hangzhou',
      SignatureMethod: 'HMAC-SHA1',
      SignatureNonce: randomUUID(),
      SignatureVersion: '1.0',
      SignName: signName,
      TemplateCode: templateCode,
      TemplateParam: JSON.stringify({ code, purpose }),
      Timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
      Version: '2017-05-25',
    }
    const encode = (value: string) =>
      encodeURIComponent(value).replace(
        /[!'()*]/g,
        (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
      )
    const canonicalized = Object.keys(params)
      .sort()
      .map((name) => `${encode(name)}=${encode(params[name])}`)
      .join('&')
    const stringToSign = `GET&%2F&${encode(canonicalized)}`
    const signature = createHmac('sha1', `${accessKeySecret}&`)
      .update(stringToSign)
      .digest('base64')
    const response = await fetch(
      `https://dysmsapi.aliyuncs.com/?${canonicalized}&Signature=${encode(signature)}`,
    )
    const payload = (await response.json().catch(() => ({}))) as {
      Code?: string
      RequestId?: string
    }
    if (!response.ok || payload.Code !== 'OK') {
      this.logger.error({
        event: 'sms_delivery_failed',
        status: response.status,
        code: payload.Code,
        requestId: payload.RequestId,
      })
      throw new ServiceUnavailableException('短信发送失败，请稍后重试')
    }
    this.logger.log({
      event: 'sms_delivered',
      provider: 'aliyun',
      purpose,
      requestId: payload.RequestId,
    })
  }
}
