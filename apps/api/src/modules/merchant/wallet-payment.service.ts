import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { InjectRepository } from '@nestjs/typeorm'
import { Buffer } from 'node:buffer'
import { createDecipheriv, createSign, createVerify, randomBytes, randomUUID } from 'crypto'
import { DataSource, Repository } from 'typeorm'
import { WalletTransactionType } from '@ai-auto/shared'
import { CommissionBudget, BudgetTransaction } from './entities/commission-budget.entity'
import { Merchant } from './entities/merchant.entity'
import { WalletPaymentOrder, WalletPaymentProvider } from './entities/wallet-payment-order.entity'
import { CreateWalletTopupDto } from './dto/wallet-payment.dto'

const WECHAT_NATIVE_PATH = '/v3/pay/transactions/native'
const WECHAT_API_BASE = 'https://api.mch.weixin.qq.com'
const ALIPAY_GATEWAY = 'https://openapi.alipay.com/gateway.do'
const ALIPAY_SANDBOX_GATEWAY = 'https://openapi-sandbox.dl.alipaydev.com/gateway.do'
const ORDER_TTL_MS = 15 * 60 * 1000

export interface WalletCheckout {
  orderNo: string
  expiresAt: Date
  provider: WalletPaymentProvider
  payUrl?: string
  codeUrl?: string
}

@Injectable()
export class WalletPaymentService {
  private readonly logger = new Logger(WalletPaymentService.name)
  private readonly wechatPlatformCertificates = new Map<
    string,
    { certificate: string; expiresAt: number }
  >()

  constructor(
    @InjectRepository(WalletPaymentOrder)
    private readonly orders: Repository<WalletPaymentOrder>,
    @InjectRepository(Merchant) private readonly merchants: Repository<Merchant>,
    @InjectRepository(CommissionBudget)
    private readonly budgets: Repository<CommissionBudget>,
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
  ) {}

  async createCheckout(merchantId: string, dto: CreateWalletTopupDto): Promise<WalletCheckout> {
    const merchant = await this.merchants.findOne({
      where: { id: merchantId },
      select: ['id', 'businessName'],
    })
    if (!merchant) throw new NotFoundException({ code: 2002, message: '商户不存在' })

    const order = await this.orders.save(
      this.orders.create({
        merchantId,
        outTradeNo: this.createOrderNo(),
        provider: dto.provider,
        amount: this.roundMoney(dto.amount),
        status: 'pending',
        expiresAt: new Date(Date.now() + ORDER_TTL_MS),
      }),
    )
    const subject = `${merchant.businessName} AI auto 佣金预算充值`

    try {
      const checkout =
        dto.provider === 'wechatpay'
          ? await this.createWechatNative(order, subject)
          : this.createAlipayPage(order, subject)
      return {
        ...checkout,
        orderNo: order.outTradeNo,
        expiresAt: order.expiresAt,
        provider: dto.provider,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '支付渠道暂不可用'
      await this.orders.update(order.id, { status: 'failed', failureReason: message })
      this.logger.error({
        event: 'wallet_checkout_failed',
        merchantId,
        provider: dto.provider,
        orderNo: order.outTradeNo,
        message,
      })
      throw new ServiceUnavailableException('支付渠道暂不可用，请配置支付参数后重试')
    }
  }

  async getOrder(merchantId: string, orderNo: string) {
    const order = await this.orders.findOne({ where: { merchantId, outTradeNo: orderNo } })
    if (!order) throw new NotFoundException({ code: 8003, message: '充值支付订单不存在' })
    if (order.status === 'pending' && order.expiresAt.getTime() <= Date.now()) {
      order.status = 'closed'
      await this.orders.save(order)
    }
    return {
      orderNo: order.outTradeNo,
      provider: order.provider,
      amount: Number(order.amount),
      status: order.status,
      expiresAt: order.expiresAt,
      paidAt: order.paidAt ?? null,
    }
  }

  async handleAlipayNotification(params: Record<string, string>) {
    if (!this.verifyAlipaySignature(params)) return false
    if (params.app_id !== this.required('payment.alipayAppId')) return false
    if (params.trade_status !== 'TRADE_SUCCESS') return true
    const order = await this.orders.findOne({
      where: { outTradeNo: params.out_trade_no, provider: 'alipay' },
    })
    if (!order || !this.amountMatches(order.amount, params.total_amount)) return false
    await this.fulfill(order.outTradeNo, 'alipay', params.trade_no ?? '')
    return true
  }

  async handleWechatNotification(
    headers: Record<string, string | string[] | undefined>,
    rawBody: Buffer,
  ) {
    const timestamp = this.header(headers, 'wechatpay-timestamp')
    const nonce = this.header(headers, 'wechatpay-nonce')
    const signature = this.header(headers, 'wechatpay-signature')
    const serial = this.header(headers, 'wechatpay-serial')
    if (
      !timestamp ||
      !nonce ||
      !signature ||
      !(await this.verifyWechatSignature(
        timestamp,
        nonce,
        rawBody.toString('utf8'),
        signature,
        serial,
      ))
    )
      return false
    let payload: any
    try {
      payload = JSON.parse(rawBody.toString('utf8'))
    } catch {
      return false
    }
    if (payload.event_type !== 'TRANSACTION.SUCCESS') return true
    let payment: any
    try {
      payment = this.decryptWechatResource(payload.resource)
    } catch {
      return false
    }
    const order = await this.orders.findOne({
      where: { outTradeNo: payment.out_trade_no, provider: 'wechatpay' },
    })
    if (
      !order ||
      payment.trade_state !== 'SUCCESS' ||
      Number(payment.amount?.total) !== this.toCents(order.amount) ||
      payment.mchid !== this.required('payment.wechatpayMchId')
    )
      return false
    await this.fulfill(order.outTradeNo, 'wechatpay', String(payment.transaction_id ?? ''))
    return true
  }

  private async fulfill(
    orderNo: string,
    provider: WalletPaymentProvider,
    providerTransactionId: string,
  ) {
    await this.dataSource.transaction(async (manager) => {
      const order = await manager.findOne(WalletPaymentOrder, {
        where: { outTradeNo: orderNo, provider },
        lock: { mode: 'pessimistic_write' },
      })
      if (!order) throw new NotFoundException('充值支付订单不存在')
      if (order.status === 'paid') return
      if (order.status !== 'pending' || order.expiresAt.getTime() <= Date.now())
        throw new BadRequestException('充值支付订单已失效')

      let budget = await manager.findOne(CommissionBudget, {
        where: { merchantId: order.merchantId },
        lock: { mode: 'pessimistic_write' },
      })
      if (!budget) {
        budget = await manager.save(
          CommissionBudget,
          manager.create(CommissionBudget, {
            merchantId: order.merchantId,
            totalBalance: 0,
            availableBalance: 0,
            frozenBalance: 0,
            totalSpent: 0,
            totalTopup: 0,
            status: true,
            lowBalanceThreshold: 100,
          }),
        )
      }
      const amount = Number(order.amount)
      const balanceBefore = Number(budget.totalBalance)
      const balanceAfter = this.roundMoney(balanceBefore + amount)
      await manager.update(CommissionBudget, budget.id, {
        totalBalance: balanceAfter,
        availableBalance: this.roundMoney(Number(budget.availableBalance) + amount),
        totalTopup: this.roundMoney(Number(budget.totalTopup) + amount),
      })
      await manager.save(
        BudgetTransaction,
        manager.create(BudgetTransaction, {
          budgetId: budget.id,
          type: WalletTransactionType.RECHARGE,
          amount,
          balanceBefore,
          balanceAfter,
          description: `支付订单 ${order.outTradeNo} 充值 ${amount.toFixed(2)} 元`,
        }),
      )
      order.status = 'paid'
      order.paidAt = new Date()
      order.providerTransactionId = providerTransactionId
      await manager.save(WalletPaymentOrder, order)
    })
    this.logger.log({ event: 'wallet_topup_paid', orderNo, provider })
  }

  private async createWechatNative(order: WalletPaymentOrder, subject: string) {
    const mchid = this.required('payment.wechatpayMchId')
    const appid = this.required('payment.wechatpayAppId')
    const notifyUrl = this.required('payment.wechatpayWalletNotifyUrl')
    const body = JSON.stringify({
      appid,
      mchid,
      description: subject.slice(0, 127),
      out_trade_no: order.outTradeNo,
      notify_url: notifyUrl,
      time_expire: order.expiresAt.toISOString(),
      amount: { total: this.toCents(order.amount), currency: 'CNY' },
    })
    const response = await globalThis.fetch(`${WECHAT_API_BASE}${WECHAT_NATIVE_PATH}`, {
      method: 'POST',
      headers: {
        Authorization: this.wechatAuthorization('POST', WECHAT_NATIVE_PATH, body),
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body,
    })
    const result = (await response.json().catch(() => ({}))) as {
      code_url?: string
      message?: string
    }
    if (!response.ok || !result.code_url)
      throw new Error(result.message ?? `微信支付下单失败 (${response.status})`)
    return { codeUrl: result.code_url }
  }

  private createAlipayPage(order: WalletPaymentOrder, subject: string) {
    const params: Record<string, string> = {
      app_id: this.required('payment.alipayAppId'),
      method: 'alipay.trade.page.pay',
      format: 'JSON',
      charset: 'utf-8',
      sign_type: 'RSA2',
      timestamp: this.alipayTimestamp(),
      version: '1.0',
      notify_url: this.required('payment.alipayWalletNotifyUrl'),
      biz_content: JSON.stringify({
        out_trade_no: order.outTradeNo,
        total_amount: Number(order.amount).toFixed(2),
        subject: subject.slice(0, 256),
        product_code: 'FAST_INSTANT_TRADE_PAY',
        timeout_express: '15m',
      }),
    }
    const returnUrl = this.config.get<string>('payment.alipayReturnUrl')
    if (returnUrl) params.return_url = returnUrl
    params.sign = this.alipaySign(params)
    const gateway = this.config.get<boolean>('payment.alipaySandbox')
      ? ALIPAY_SANDBOX_GATEWAY
      : ALIPAY_GATEWAY
    return { payUrl: `${gateway}?${new URLSearchParams(params).toString()}` }
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

  private async verifyWechatSignature(
    timestamp: string,
    nonce: string,
    body: string,
    signature: string,
    serial?: string,
  ) {
    let certificate = this.config.get<string>('payment.wechatpayPlatformCertificate')
    if (!certificate) certificate = await this.fetchWechatPlatformCertificate(serial)
    if (!certificate) return false
    const verifier = createVerify('RSA-SHA256')
    verifier.update(`${timestamp}\n${nonce}\n${body}\n`)
    return verifier.verify(certificate, signature, 'base64')
  }

  private async fetchWechatPlatformCertificate(serial?: string) {
    if (serial) {
      const cached = this.wechatPlatformCertificates.get(serial)
      if (cached && cached.expiresAt > Date.now()) return cached.certificate
    }

    try {
      const path = '/v3/certificates'
      const response = await globalThis.fetch(`${WECHAT_API_BASE}${path}`, {
        headers: {
          Authorization: this.wechatAuthorization('GET', path, ''),
          Accept: 'application/json',
        },
      })
      if (!response.ok) return ''
      const payload = (await response.json()) as {
        data?: {
          serial_no?: string
          expire_time?: string
          encrypt_certificate?: {
            nonce: string
            ciphertext: string
            associated_data?: string
          }
        }[]
      }
      for (const item of payload.data ?? []) {
        if (serial && item.serial_no !== serial) continue
        if (!item.serial_no || !item.encrypt_certificate) continue
        const decrypted = this.decryptWechatResource(item.encrypt_certificate)
        if (typeof decrypted?.certificate !== 'string') continue
        const expiresAt = Math.max(
          Date.now() + 5 * 60 * 1000,
          new Date(item.expire_time ?? '').getTime() - 5 * 60 * 1000,
        )
        this.wechatPlatformCertificates.set(item.serial_no, {
          certificate: decrypted.certificate,
          expiresAt,
        })
        return decrypted.certificate
      }
    } catch (error) {
      this.logger.warn({
        event: 'wechat_platform_certificate_fetch_failed',
        message: error instanceof Error ? error.message : 'unknown error',
      })
    }
    return ''
  }

  private decryptWechatResource(resource: {
    nonce: string
    ciphertext: string
    associated_data?: string
  }) {
    const key = Buffer.from(this.required('payment.wechatpayApiV3Key'), 'utf8')
    if (key.length !== 32) throw new Error('WECHATPAY_API_V3_KEY 必须为 32 字节')
    const encrypted = Buffer.from(resource.ciphertext, 'base64')
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(resource.nonce, 'utf8'))
    decipher.setAuthTag(encrypted.subarray(-16))
    decipher.setAAD(Buffer.from(resource.associated_data ?? '', 'utf8'))
    return JSON.parse(
      Buffer.concat([decipher.update(encrypted.subarray(0, -16)), decipher.final()]).toString(
        'utf8',
      ),
    )
  }

  private alipaySign(params: Record<string, string>) {
    const signer = createSign('RSA-SHA256')
    signer.update(this.alipayContent(params), 'utf8')
    return signer.sign(this.required('payment.alipayPrivateKey'), 'base64')
  }

  private verifyAlipaySignature(params: Record<string, string>) {
    if (!params.sign) return false
    const verifier = createVerify('RSA-SHA256')
    verifier.update(this.alipayContent(params, true), 'utf8')
    return verifier.verify(this.required('payment.alipayPublicKey'), params.sign, 'base64')
  }

  private alipayContent(params: Record<string, string>, notification = false) {
    return Object.keys(params)
      .filter(
        (key) =>
          key !== 'sign' &&
          (!notification || key !== 'sign_type') &&
          params[key] !== undefined &&
          params[key] !== '',
      )
      .sort()
      .map((key) => `${key}=${params[key]}`)
      .join('&')
  }

  private required(key: string) {
    const value = this.config.get<string>(key)
    if (!value) throw new Error(`${key} 未配置`)
    return value.replace(/\\n/g, '\n')
  }

  private createOrderNo() {
    return `WA${new Date().toISOString().replace(/\D/g, '').slice(0, 14)}${randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase()}`
  }

  private alipayTimestamp() {
    const date = new Date()
    const pad = (value: number) => String(value).padStart(2, '0')
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  }

  private amountMatches(expected: number, actual?: string) {
    return (
      actual !== undefined &&
      Math.round(Number(expected) * 100) === Math.round(Number(actual) * 100)
    )
  }

  private toCents(value: number) {
    return Math.round(Number(value) * 100)
  }

  private roundMoney(value: number) {
    return Math.round(value * 100) / 100
  }

  private header(headers: Record<string, string | string[] | undefined>, key: string) {
    const value = headers[key] ?? headers[key.toLowerCase()]
    return Array.isArray(value) ? value[0] : value
  }
}
