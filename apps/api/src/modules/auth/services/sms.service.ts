// ============================================================
// SMS Service - SMS verification code handling
// ============================================================

import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Inject } from '@nestjs/common'
import { REDIS_CLIENT } from '../../redis/redis.module'

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

    // Store code with expiry
    await this.redis.setex(key, this.codeExpiry, code)

    // Increment rate limit counter
    const current = await this.redis.incr(rateLimitKey)
    if (current === 1) {
      await this.redis.expire(rateLimitKey, this.lockExpiry)
    }

    // TODO: Integrate real SMS provider (Aliyun SMS / Tencent Cloud SMS)
    // For now, just log in dev mode
    if (isDev) {
      this.logger.log(`[DEV SMS] Phone: ${phone} | Purpose: ${purpose} | Code: ${code}`)
      return { success: true, devCode: code }
    }

    // Production: send via Aliyun/腾讯云
    // await this.sendViaAliyun(phone, code, purpose);
    this.logger.log(`[SMS] Sending code to ${phone} for ${purpose}`)
    return { success: true }
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
}
