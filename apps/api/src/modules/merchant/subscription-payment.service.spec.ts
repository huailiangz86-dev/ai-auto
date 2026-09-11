import { Test } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { ConfigService } from '@nestjs/config'
import { DataSource } from 'typeorm'
import { generateKeyPairSync } from 'crypto'
import { ServiceUnavailableException } from '@nestjs/common'
import { SubscriptionPaymentService } from './subscription-payment.service'
import { SubscriptionPaymentOrder } from './entities/subscription-payment-order.entity'
import { Merchant } from './entities/merchant.entity'

describe('SubscriptionPaymentService', () => {
  let service: SubscriptionPaymentService
  let orders: any
  let merchants: any
  let config: any

  beforeEach(async () => {
    orders = { create: jest.fn((value) => ({ id: 'order-id', ...value })), save: jest.fn(async (value) => value), update: jest.fn(), findOne: jest.fn() }
    merchants = { findOne: jest.fn().mockResolvedValue({ id: 'merchant-id', businessName: '测试商户' }) }
    config = { get: jest.fn() }
    const module = await Test.createTestingModule({
      providers: [
        SubscriptionPaymentService,
        { provide: getRepositoryToken(SubscriptionPaymentOrder), useValue: orders },
        { provide: getRepositoryToken(Merchant), useValue: merchants },
        { provide: DataSource, useValue: { transaction: jest.fn() } },
        { provide: ConfigService, useValue: config },
      ],
    }).compile()
    service = module.get(SubscriptionPaymentService)
  })

  it('creates a signed Alipay page-payment checkout without exposing private key material', async () => {
    const keys = generateKeyPairSync('rsa', { modulusLength: 2048 })
    const values: Record<string, string> = {
      'payment.alipayAppId': '2026000000000001',
      'payment.alipayPrivateKey': keys.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
      'payment.alipayPublicKey': keys.publicKey.export({ type: 'spki', format: 'pem' }).toString(),
      'payment.alipayNotifyUrl': 'https://pay.example.com/api/v1/merchant/subscription/payments/alipay/notify',
      'payment.alipayReturnUrl': 'https://app.example.com/payment/return',
    }
    config.get.mockImplementation((key: string) => values[key])

    const result = await service.createCheckout('merchant-id', 'alipay', 1)

    expect(result.payUrl).toContain('alipay.trade.page.pay')
    const paymentUrl = new URL(result.payUrl!)
    expect(JSON.parse(paymentUrl.searchParams.get('biz_content') ?? '{}').out_trade_no).toMatch(/^AA\d{14}[A-Z0-9]{8}$/)
    expect(result.payUrl).not.toContain('BEGIN+PRIVATE')
    expect(orders.save).toHaveBeenCalledWith(expect.objectContaining({ amount: 300, provider: 'alipay', status: 'pending' }))
  })

  it('marks an order failed and does not return a checkout when WeChat Pay credentials are absent', async () => {
    config.get.mockReturnValue('')

    await expect(service.createCheckout('merchant-id', 'wechatpay', 12)).rejects.toBeInstanceOf(ServiceUnavailableException)

    expect(orders.update).toHaveBeenCalledWith('order-id', expect.objectContaining({ status: 'failed' }))
  })

  it('rejects an unsigned Alipay notification before querying or fulfilling an order', async () => {
    config.get.mockReturnValue('unused')

    await expect(service.handleAlipayNotification({ out_trade_no: 'AA20260907000000ABCD', trade_status: 'TRADE_SUCCESS' })).resolves.toBe(false)
    expect(orders.findOne).not.toHaveBeenCalled()
  })
})
