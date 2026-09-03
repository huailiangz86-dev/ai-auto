import { BadRequestException, ForbiddenException, UnauthorizedException } from '@nestjs/common'
import * as crypto from 'crypto'

import { MerchantIntegrationService } from './merchant-integration.service'

describe('MerchantIntegrationService', () => {
  let service: MerchantIntegrationService
  let apiKeyRepo: any
  let mappingRepo: any
  let couponRepo: any
  let customerCouponRepo: any
  let redemptionRepo: any
  let redis: any
  let commissionService: any

  const signedBody = {
    couponCode: 'COUPON-001',
    transactionAmount: 128,
    merchantTransactionId: 'POS-001',
  }
  const activeKey = {
    id: 'key-1',
    merchantId: 'merchant-1',
    apiKey: 'app_test',
    callbackSecret: 'merchant-secret',
    status: true,
    firstUsedAt: null,
  }

  const signatureFor = (body: unknown, timestamp: string, nonce: string) =>
    `sha256=${crypto
      .createHmac('sha256', activeKey.callbackSecret)
      .update(`${timestamp}.${nonce}.${JSON.stringify(body)}`)
      .digest('hex')}`

  beforeEach(() => {
    apiKeyRepo = {
      create: jest.fn((value) => value),
      save: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      increment: jest.fn(),
    }
    mappingRepo = {
      create: jest.fn((value) => value),
      save: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      softDelete: jest.fn(),
    }
    couponRepo = { findOne: jest.fn() }
    customerCouponRepo = { findOne: jest.fn() }
    redemptionRepo = { update: jest.fn() }
    redis = { set: jest.fn() }
    commissionService = { redeemCoupon: jest.fn() }
    service = new MerchantIntegrationService(
      apiKeyRepo,
      mappingRepo,
      couponRepo,
      customerCouponRepo,
      redemptionRepo,
      redis,
      commissionService,
    )
  })

  it('创建密钥时只返回一次明文 Secret，并保存摘要', async () => {
    apiKeyRepo.save.mockImplementation((value) => ({ ...value, id: 'key-1' }))

    const result = await service.createApiKey('merchant-1', { keyName: 'POS' })

    expect(result.apiKey).toMatch(/^app_/)
    expect(result.apiSecret).toBeTruthy()
    expect(apiKeyRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        merchantId: 'merchant-1',
        keyName: 'POS',
        apiSecretHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      }),
    )
    expect(apiKeyRepo.create.mock.calls[0][0].callbackSecret).toBe(result.apiSecret)
  })

  it('接受有效签名，写入 nonce 并触发幂等核销', async () => {
    const timestamp = String(Math.floor(Date.now() / 1000))
    const nonce = 'nonce-001'
    apiKeyRepo.findOne.mockResolvedValue(activeKey)
    redis.set.mockResolvedValue('OK')
    commissionService.redeemCoupon.mockResolvedValue({
      redemptionId: 'redemption-1',
      couponCode: signedBody.couponCode,
      discountValue: 20,
      success: true,
    })

    const result = await service.verifyCallback(
      activeKey.apiKey,
      signatureFor(signedBody, timestamp, nonce),
      timestamp,
      nonce,
      '127.0.0.1',
      signedBody,
    )

    expect(result.success).toBe(true)
    expect(redis.set).toHaveBeenCalledWith(
      'merchant-callback:nonce:key-1:nonce-001',
      '1',
      'EX',
      300,
      'NX',
    )
    expect(commissionService.redeemCoupon).toHaveBeenCalledWith('merchant-1', signedBody)
    expect(redemptionRepo.update).toHaveBeenCalledWith(
      { id: 'redemption-1' },
      expect.objectContaining({ callbackVerified: true }),
    )
    expect(apiKeyRepo.increment).toHaveBeenCalledWith({ id: 'key-1' }, 'totalCalls', 1)
  })

  it('拒绝过期时间戳，不访问数据库', async () => {
    const timestamp = String(Math.floor(Date.now() / 1000) - 301)

    await expect(
      service.verifyCallback(
        'app_test',
        'sha256=anything',
        timestamp,
        'nonce',
        '127.0.0.1',
        signedBody,
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException)
    expect(apiKeyRepo.findOne).not.toHaveBeenCalled()
  })

  it('拒绝重复 nonce', async () => {
    const timestamp = String(Math.floor(Date.now() / 1000))
    const nonce = 'nonce-duplicate'
    apiKeyRepo.findOne.mockResolvedValue(activeKey)
    redis.set.mockResolvedValue(null)

    await expect(
      service.verifyCallback(
        activeKey.apiKey,
        signatureFor(signedBody, timestamp, nonce),
        timestamp,
        nonce,
        '127.0.0.1',
        signedBody,
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException)
    expect(commissionService.redeemCoupon).not.toHaveBeenCalled()
  })

  it('在配置白名单时拒绝未授权 IP', async () => {
    const timestamp = String(Math.floor(Date.now() / 1000))
    const nonce = 'nonce-ip'
    apiKeyRepo.findOne.mockResolvedValue({ ...activeKey, ipWhitelist: '10.0.0.8' })

    await expect(
      service.verifyCallback(
        activeKey.apiKey,
        signatureFor(signedBody, timestamp, nonce),
        timestamp,
        nonce,
        '127.0.0.1',
        signedBody,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException)
  })

  it('拒绝与券码不匹配的商品映射', async () => {
    const timestamp = String(Math.floor(Date.now() / 1000))
    const nonce = 'nonce-mapping'
    const body = { ...signedBody, externalProductId: 'sku-1' }
    apiKeyRepo.findOne.mockResolvedValue(activeKey)
    redis.set.mockResolvedValue('OK')
    mappingRepo.findOne.mockResolvedValue({ couponId: 'coupon-2' })
    customerCouponRepo.findOne.mockResolvedValue({ couponId: 'coupon-1' })

    await expect(
      service.verifyCallback(
        activeKey.apiKey,
        signatureFor(body, timestamp, nonce),
        timestamp,
        nonce,
        '127.0.0.1',
        body,
      ),
    ).rejects.toBeInstanceOf(BadRequestException)
  })
})
