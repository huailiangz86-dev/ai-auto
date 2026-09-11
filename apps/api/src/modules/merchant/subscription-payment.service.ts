import { BadRequestException, Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { InjectRepository } from '@nestjs/typeorm'
import { createDecipheriv, createSign, createVerify, randomBytes, randomUUID } from 'crypto'
import { DataSource, Repository } from 'typeorm'
import { SubscriptionStatus } from '@ai-auto/shared'
import { Merchant } from './entities/merchant.entity'
import { Subscription } from './entities/subscription.entity'
import { SubscriptionPaymentOrder, SubscriptionPaymentProvider } from './entities/subscription-payment-order.entity'

const WECHAT_NATIVE_PATH = '/v3/pay/transactions/native'
const WECHAT_API_BASE = 'https://api.mch.weixin.qq.com'
const ALIPAY_GATEWAY = 'https://openapi.alipay.com/gateway.do'
const ORDER_TTL_MS = 15 * 60 * 1000

type Checkout = { orderNo: string; expiresAt: Date; provider: SubscriptionPaymentProvider; payUrl?: string; codeUrl?: string }

@Injectable()
export class SubscriptionPaymentService {
  private readonly logger = new Logger(SubscriptionPaymentService.name)

  constructor(
    @InjectRepository(SubscriptionPaymentOrder) private readonly orders: Repository<SubscriptionPaymentOrder>,
    @InjectRepository(Merchant) private readonly merchants: Repository<Merchant>,
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
  ) {}

  async createCheckout(merchantId: string, provider: SubscriptionPaymentProvider, planMonths: 1 | 12): Promise<Checkout> {
    const merchant = await this.merchants.findOne({ where: { id: merchantId }, select: ['id', 'businessName'] })
    if (!merchant) throw new NotFoundException({ code: 2002, message: '商户不存在' })

    const amount = planMonths === 12 ? 3600 : 300
    const order = await this.orders.save(this.orders.create({
      merchantId,
      outTradeNo: this.createOrderNo(),
      provider,
      planMonths,
      amount,
      status: 'pending',
      expiresAt: new Date(Date.now() + ORDER_TTL_MS),
    }))
    const subject = `${merchant.businessName} AI auto ${planMonths === 12 ? '年度' : '月度'}订阅`

    try {
      const checkout = provider === 'wechatpay'
        ? await this.createWechatNative(order, subject)
        : this.createAlipayPage(order, subject)
      return { ...checkout, orderNo: order.outTradeNo, expiresAt: order.expiresAt, provider }
    } catch (error) {
      const message = error instanceof Error ? error.message : '支付渠道暂不可用'
      await this.orders.update(order.id, { status: 'failed', failureReason: message })
      this.logger.error({ event: 'subscription_checkout_failed', provider, orderNo: order.outTradeNo, message })
      throw new ServiceUnavailableException('支付渠道暂不可用，请稍后重试')
    }
  }

  async getOrder(merchantId: string, orderNo: string) {
    const order = await this.orders.findOne({ where: { merchantId, outTradeNo: orderNo } })
    if (!order) throw new NotFoundException({ code: 2002, message: '支付订单不存在' })
    if (order.status === 'pending' && order.expiresAt.getTime() <= Date.now()) {
      order.status = 'closed'
      await this.orders.save(order)
    }
    return { orderNo: order.outTradeNo, provider: order.provider, amount: Number(order.amount), status: order.status, expiresAt: order.expiresAt, paidAt: order.paidAt ?? null }
  }

  async handleAlipayNotification(params: Record<string, string>) {
    if (!this.verifyAlipaySignature(params)) return false
    if (params.app_id !== this.required('payment.alipayAppId')) return false
    if (params.trade_status !== 'TRADE_SUCCESS') return true
    const order = await this.orders.findOne({ where: { outTradeNo: params.out_trade_no, provider: 'alipay' } })
    if (!order || !this.amountMatches(order.amount, params.total_amount)) return false
    await this.fulfill(order.outTradeNo, 'alipay', params.trade_no ?? '')
    return true
  }

  async handleWechatNotification(headers: Record<string, string | string[] | undefined>, rawBody: Buffer) {
    const timestamp = this.header(headers, 'wechatpay-timestamp')
    const nonce = this.header(headers, 'wechatpay-nonce')
    const signature = this.header(headers, 'wechatpay-signature')
    if (!timestamp || !nonce || !signature || !this.verifyWechatSignature(timestamp, nonce, rawBody.toString('utf8'), signature)) return false
    let payload: any
    try { payload = JSON.parse(rawBody.toString('utf8')) } catch { return false }
    if (payload.event_type !== 'TRANSACTION.SUCCESS') return true
    let payment: any
    try { payment = this.decryptWechatResource(payload.resource) } catch { return false }
    const order = await this.orders.findOne({ where: { outTradeNo: payment.out_trade_no, provider: 'wechatpay' } })
    if (!order || payment.trade_state !== 'SUCCESS' || Number(payment.amount?.total) !== this.toCents(order.amount) || payment.mchid !== this.required('payment.wechatpayMchId')) return false
    await this.fulfill(order.outTradeNo, 'wechatpay', String(payment.transaction_id ?? ''))
    return true
  }

  private async fulfill(orderNo: string, provider: SubscriptionPaymentProvider, providerTransactionId: string) {
    await this.dataSource.transaction(async (manager) => {
      const order = await manager.findOne(SubscriptionPaymentOrder, { where: { outTradeNo: orderNo, provider }, lock: { mode: 'pessimistic_write' } })
      if (!order) throw new NotFoundException('支付订单不存在')
      if (order.status === 'paid') return
      if (order.status !== 'pending' || order.expiresAt.getTime() <= Date.now()) throw new BadRequestException('支付订单已失效')
      const merchant = await manager.findOne(Merchant, { where: { id: order.merchantId }, lock: { mode: 'pessimistic_write' } })
      if (!merchant) throw new NotFoundException('商户不存在')
      const active = await manager.findOne(Subscription, { where: { merchantId: merchant.id, status: SubscriptionStatus.ACTIVE }, order: { expireAt: 'DESC' }, lock: { mode: 'pessimistic_write' } })
      const now = new Date()
      const startAt = active?.expireAt && active.expireAt > now ? active.expireAt : now
      const expireAt = new Date(startAt)
      expireAt.setMonth(expireAt.getMonth() + order.planMonths)
      merchant.subscriptionStatus = SubscriptionStatus.ACTIVE
      await manager.save(merchant)
      await manager.save(Subscription, manager.create(Subscription, { merchantId: merchant.id, planName: order.planMonths === 12 ? 'annual' : 'monthly', status: SubscriptionStatus.ACTIVE, startAt, expireAt, amountPaid: order.amount, paymentMethod: provider, paymentTransactionId: providerTransactionId }))
      order.status = 'paid'
      order.paidAt = now
      order.providerTransactionId = providerTransactionId
      await manager.save(order)
    })
  }

  private async createWechatNative(order: SubscriptionPaymentOrder, description: string): Promise<Pick<Checkout, 'codeUrl'>> {
    const mchid = this.required('payment.wechatpayMchId')
    const appid = this.required('payment.wechatpayAppId')
    const notifyUrl = this.required('payment.wechatpayNotifyUrl')
    const body = JSON.stringify({ appid, mchid, description: description.slice(0, 127), out_trade_no: order.outTradeNo, notify_url: notifyUrl, time_expire: order.expiresAt.toISOString(), amount: { total: this.toCents(order.amount), currency: 'CNY' } })
    const response = await fetch(`${WECHAT_API_BASE}${WECHAT_NATIVE_PATH}`, { method: 'POST', headers: { Authorization: this.wechatAuthorization('POST', WECHAT_NATIVE_PATH, body), Accept: 'application/json', 'Content-Type': 'application/json' }, body })
    const result = await response.json().catch(() => ({})) as { code_url?: string; message?: string }
    if (!response.ok || !result.code_url) throw new Error(result.message ?? `微信支付下单失败 (${response.status})`)
    return { codeUrl: result.code_url }
  }

  private createAlipayPage(order: SubscriptionPaymentOrder, subject: string): Pick<Checkout, 'payUrl'> {
    const params: Record<string, string> = {
      app_id: this.required('payment.alipayAppId'), method: 'alipay.trade.page.pay', format: 'JSON', charset: 'utf-8', sign_type: 'RSA2', timestamp: this.alipayTimestamp(), version: '1.0', notify_url: this.required('payment.alipayNotifyUrl'),
      biz_content: JSON.stringify({ out_trade_no: order.outTradeNo, total_amount: Number(order.amount).toFixed(2), subject: subject.slice(0, 256), product_code: 'FAST_INSTANT_TRADE_PAY', timeout_express: '15m' }),
    }
    const returnUrl = this.config.get<string>('payment.alipayReturnUrl')
    if (returnUrl) params.return_url = returnUrl
    params.sign = this.alipaySign(params)
    return { payUrl: `${ALIPAY_GATEWAY}?${new URLSearchParams(params).toString()}` }
  }

  private wechatAuthorization(method: string, path: string, body: string) {
    const timestamp = Math.floor(Date.now() / 1000).toString()
    const nonce = randomBytes(16).toString('hex')
    const message = `${method}\n${path}\n${timestamp}\n${nonce}\n${body}\n`
    const signer = createSign('RSA-SHA256')
    signer.update(message)
    const signature = signer.sign(this.required('payment.wechatpayPrivateKey'), 'base64')
    return `WECHATPAY2-SHA256-RSA2048 mchid="${this.required('payment.wechatpayMchId')}",nonce_str="${nonce}",signature="${signature}",timestamp="${timestamp}",serial_no="${this.required('payment.wechatpaySerialNo')}"`
  }

  private verifyWechatSignature(timestamp: string, nonce: string, body: string, signature: string) {
    const verifier = createVerify('RSA-SHA256')
    verifier.update(`${timestamp}\n${nonce}\n${body}\n`)
    return verifier.verify(this.required('payment.wechatpayPlatformCertificate'), signature, 'base64')
  }

  private decryptWechatResource(resource: { nonce: string; ciphertext: string; associated_data?: string }) {
    const key = Buffer.from(this.required('payment.wechatpayApiV3Key'), 'utf8')
    if (key.length !== 32) throw new Error('WECHATPAY_API_V3_KEY 必须为 32 字节')
    const encrypted = Buffer.from(resource.ciphertext, 'base64')
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(resource.nonce, 'utf8'))
    decipher.setAuthTag(encrypted.subarray(-16))
    decipher.setAAD(Buffer.from(resource.associated_data ?? '', 'utf8'))
    return JSON.parse(Buffer.concat([decipher.update(encrypted.subarray(0, -16)), decipher.final()]).toString('utf8'))
  }

  private alipaySign(params: Record<string, string>) {
    const signer = createSign('RSA-SHA256')
    signer.update(this.alipayContent(params, false), 'utf8')
    return signer.sign(this.required('payment.alipayPrivateKey'), 'base64')
  }

  private verifyAlipaySignature(params: Record<string, string>) {
    if (!params.sign) return false
    const verifier = createVerify('RSA-SHA256')
    verifier.update(this.alipayContent(params, true), 'utf8')
    return verifier.verify(this.required('payment.alipayPublicKey'), params.sign, 'base64')
  }

  private alipayContent(params: Record<string, string>, notification: boolean) {
    return Object.keys(params).filter((key) => key !== 'sign' && (!notification || key !== 'sign_type') && params[key] !== undefined && params[key] !== '').sort().map((key) => `${key}=${params[key]}`).join('&')
  }
  private required(key: string) { const value = this.config.get<string>(key); if (!value) throw new Error(`${key} 未配置`); return value.replace(/\\n/g, '\n') }
  private createOrderNo() { return `AA${new Date().toISOString().replace(/\D/g, '').slice(0, 14)}${randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase()}` }
  private alipayTimestamp() { const d = new Date(); const p = (value: number) => String(value).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}` }
  private amountMatches(expected: number, actual?: string) { return actual !== undefined && Math.round(Number(expected) * 100) === Math.round(Number(actual) * 100) }
  private toCents(value: number) { return Math.round(Number(value) * 100) }
  private header(headers: Record<string, string | string[] | undefined>, key: string) { const value = headers[key] ?? headers[key.toLowerCase()]; return Array.isArray(value) ? value[0] : value }
}
