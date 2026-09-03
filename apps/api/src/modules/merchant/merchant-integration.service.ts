// ============================================================
// Merchant system integration service (STORY-AI-005)
// ============================================================

import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Inject } from '@nestjs/common'
import { Repository } from 'typeorm'
import * as crypto from 'crypto'
import { Buffer } from 'buffer'
import Redis from 'ioredis'

import { MerchantApiKey } from './entities/merchant-api-key.entity'
import { CouponProductMapping } from '../campaign/entities/coupon-product-mapping.entity'
import { Coupon } from '../campaign/entities/coupon.entity'
import { CustomerCoupon } from '../customer/entities/customer-coupon.entity'
import { Redemption } from '../commission/entities/redemption.entity'
import { CommissionService } from '../commission/commission.service'
import { REDIS_CLIENT } from '../redis/redis.module'
import {
  CreateCouponProductMappingDto,
  CreateMerchantApiKeyDto,
  UpdateCouponProductMappingDto,
  VerifyMerchantCallbackDto,
} from './dto/integration.dto'

const CALLBACK_WINDOW_SECONDS = 5 * 60

@Injectable()
export class MerchantIntegrationService {
  private readonly logger = new Logger(MerchantIntegrationService.name)

  constructor(
    @InjectRepository(MerchantApiKey)
    private readonly apiKeyRepo: Repository<MerchantApiKey>,
    @InjectRepository(CouponProductMapping)
    private readonly mappingRepo: Repository<CouponProductMapping>,
    @InjectRepository(Coupon)
    private readonly couponRepo: Repository<Coupon>,
    @InjectRepository(CustomerCoupon)
    private readonly customerCouponRepo: Repository<CustomerCoupon>,
    @InjectRepository(Redemption)
    private readonly redemptionRepo: Repository<Redemption>,
    @Inject(REDIS_CLIENT)
    private readonly redis: Redis,
    private readonly commissionService: CommissionService,
  ) {}

  /** Creates a key pair. The secret is returned once and never exposed again. */
  async createApiKey(merchantId: string, dto: CreateMerchantApiKeyDto) {
    const secret = crypto.randomBytes(32).toString('base64url')
    const apiKey = `app_${crypto.randomBytes(18).toString('base64url')}`
    const entity = this.apiKeyRepo.create({
      merchantId,
      apiKey,
      // Retained for audit and rotation checks. callbackSecret is the HMAC material.
      apiSecretHash: crypto.createHash('sha256').update(secret).digest('hex'),
      callbackSecret: secret,
      keyName: dto.keyName ?? null,
      ipWhitelist: dto.ipWhitelist?.join(',') ?? null,
      callbackUrl: dto.callbackUrl ?? null,
      rateLimitPerMinute: dto.rateLimitPerMinute ?? 100,
      status: true,
    })
    const saved = await this.apiKeyRepo.save(entity)

    return {
      id: saved.id,
      apiKey: saved.apiKey,
      apiSecret: secret,
      message: '请立即保存 API Secret；平台不会再次展示它。',
    }
  }

  async listApiKeys(merchantId: string) {
    const keys = await this.apiKeyRepo.find({
      where: { merchantId },
      order: { createdAt: 'DESC' },
    })
    return keys.map((key) => ({
      id: key.id,
      apiKey: key.apiKey,
      keyName: key.keyName,
      ipWhitelist: key.ipWhitelist?.split(',').filter(Boolean) ?? [],
      callbackUrl: key.callbackUrl,
      rateLimitPerMinute: key.rateLimitPerMinute,
      status: key.status,
      totalCalls: Number(key.totalCalls),
      lastCalledAt: key.lastCalledAt,
      createdAt: key.createdAt,
    }))
  }

  async revokeApiKey(merchantId: string, keyId: string) {
    const key = await this.apiKeyRepo.findOne({ where: { id: keyId, merchantId } })
    if (!key) {
      throw new NotFoundException({ code: 2005, message: 'API Key 不存在' })
    }
    await this.apiKeyRepo.update({ id: key.id }, { status: false })
  }

  async createProductMapping(merchantId: string, dto: CreateCouponProductMappingDto) {
    const coupon = await this.couponRepo.findOne({ where: { id: dto.couponId, merchantId } })
    if (!coupon) {
      throw new NotFoundException({ code: 4004, message: '优惠券不存在或无权操作' })
    }
    const duplicate = await this.mappingRepo.findOne({
      where: { merchantId, externalProductId: dto.externalProductId },
    })
    if (duplicate) {
      throw new BadRequestException({ code: 4005, message: '该商家商品已绑定其他优惠券' })
    }
    const mapping = await this.mappingRepo.save(
      this.mappingRepo.create({
        merchantId,
        couponId: dto.couponId,
        externalProductId: dto.externalProductId,
        externalProductName: dto.externalProductName ?? null,
        externalCategory: dto.externalCategory ?? null,
        status: dto.status ?? true,
      }),
    )
    return { mappingId: mapping.id }
  }

  async listProductMappings(merchantId: string) {
    return this.mappingRepo.find({
      where: { merchantId },
      relations: ['coupon'],
      order: { createdAt: 'DESC' },
    })
  }

  async updateProductMapping(
    merchantId: string,
    mappingId: string,
    dto: UpdateCouponProductMappingDto,
  ) {
    const mapping = await this.mappingRepo.findOne({ where: { id: mappingId, merchantId } })
    if (!mapping) {
      throw new NotFoundException({ code: 4006, message: '商品映射不存在' })
    }
    await this.mappingRepo.update({ id: mapping.id }, dto)
  }

  async deleteProductMapping(merchantId: string, mappingId: string) {
    const mapping = await this.mappingRepo.findOne({ where: { id: mappingId, merchantId } })
    if (!mapping) {
      throw new NotFoundException({ code: 4006, message: '商品映射不存在' })
    }
    await this.mappingRepo.softDelete(mapping.id)
  }

  async verifyCallback(
    apiKeyValue: string | undefined,
    signature: string | undefined,
    timestamp: string | undefined,
    nonce: string | undefined,
    sourceIp: string | undefined,
    body: VerifyMerchantCallbackDto,
  ) {
    if (!apiKeyValue || !signature || !timestamp || !nonce) {
      throw this.invalidSignature('缺少签名认证请求头')
    }
    const timestampSeconds = Number(timestamp)
    if (
      !Number.isInteger(timestampSeconds) ||
      Math.abs(Date.now() / 1000 - timestampSeconds) > CALLBACK_WINDOW_SECONDS
    ) {
      throw this.invalidSignature('请求已过期或时间戳无效')
    }
    if (nonce.length > 128) {
      throw this.invalidSignature('nonce 无效')
    }

    const apiKey = await this.apiKeyRepo.findOne({
      where: { apiKey: apiKeyValue, status: true },
    })
    if (!apiKey || !apiKey.callbackSecret) {
      throw this.invalidSignature('API Key 无效或已撤销')
    }
    this.assertIpAllowed(apiKey.ipWhitelist, sourceIp)

    const expected = `sha256=${crypto
      .createHmac('sha256', apiKey.callbackSecret)
      .update(`${timestamp}.${nonce}.${JSON.stringify(body)}`)
      .digest('hex')}`
    const actualBuffer = Buffer.from(signature)
    const expectedBuffer = Buffer.from(expected)
    if (
      actualBuffer.length !== expectedBuffer.length ||
      !crypto.timingSafeEqual(actualBuffer, expectedBuffer)
    ) {
      throw this.invalidSignature('签名验证失败')
    }

    const nonceKey = `merchant-callback:nonce:${apiKey.id}:${nonce}`
    const nonceStored = await this.redis.set(nonceKey, '1', 'EX', CALLBACK_WINDOW_SECONDS, 'NX')
    if (nonceStored !== 'OK') {
      throw this.invalidSignature('重复请求')
    }

    if (body.externalProductId) {
      const mapping = await this.mappingRepo.findOne({
        where: {
          merchantId: apiKey.merchantId,
          externalProductId: body.externalProductId,
          status: true,
        },
      })
      if (!mapping) {
        throw new BadRequestException({ code: 4007, message: '商品映射不存在或未启用' })
      }
      const customerCoupon = await this.customerCouponRepo.findOne({
        where: { couponCode: body.couponCode },
      })
      if (customerCoupon && customerCoupon.couponId !== mapping.couponId) {
        throw new BadRequestException({ code: 4008, message: '券码与商家商品映射不匹配' })
      }
    }

    const result = await this.commissionService.redeemCoupon(apiKey.merchantId, body)
    const now = new Date()
    if (result.redemptionId) {
      const presentedAt = body.presentedAt ? new Date(body.presentedAt) : now
      const within72Hours = now.getTime() - presentedAt.getTime() <= 72 * 60 * 60 * 1000
      await this.redemptionRepo.update(
        { id: result.redemptionId },
        {
          callbackReceivedAt: now,
          callbackWithin72h: within72Hours,
          callbackVerified: result.success,
          callbackError: result.failureReason ?? null,
        },
      )
    }
    await this.apiKeyRepo.increment({ id: apiKey.id }, 'totalCalls', 1)
    await this.apiKeyRepo.update(
      { id: apiKey.id },
      { lastCalledAt: now, firstUsedAt: apiKey.firstUsedAt ?? now },
    )
    return result
  }

  private invalidSignature(message: string) {
    return new UnauthorizedException({ code: 9004, message })
  }

  private assertIpAllowed(ipWhitelist: string | null | undefined, sourceIp: string | undefined) {
    const allowed =
      ipWhitelist
        ?.split(',')
        .map((ip) => ip.trim())
        .filter(Boolean) ?? []
    if (allowed.length === 0) return
    const normalizedIp = sourceIp?.replace(/^::ffff:/, '')
    if (!normalizedIp || !allowed.includes(normalizedIp)) {
      throw new ForbiddenException({ code: 9004, message: '调用 IP 不在白名单中' })
    }
  }
}
