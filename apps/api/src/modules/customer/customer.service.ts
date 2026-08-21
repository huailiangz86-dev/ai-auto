// ============================================================
// AI auto - Customer Service
// Attribution (365-day lock) + Coupon claiming + Customer management
// Core economic mechanism for agent commission attribution
// ============================================================

import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository, DataSource } from 'typeorm'

import { Customer } from './entities/customer.entity'
import { CustomerAttribution } from './entities/customer-attribution.entity'
import { CustomerCoupon } from './entities/customer-coupon.entity'
import { Coupon } from '../campaign/entities/coupon.entity'
import { SharingAgent } from '../agent/entities/sharing-agent.entity'
import { Store } from '../merchant/entities/store.entity'
import { CouponStatus } from '@ai-auto/shared'

import {
  CreateAttributionDto,
  ClaimCouponDto,
  RegisterCustomerDto,
  GetAttributionDto,
  ListCustomerCouponsDto,
  DiscoverNearbyDto,
  ScanClaimDto,
  SearchMerchantsDto,
} from './dto/customer.dto'

// 365 days in milliseconds
const LOCK_DURATION_MS = 365 * 24 * 60 * 60 * 1000

@Injectable()
export class CustomerService {
  private readonly logger = new Logger(CustomerService.name)

  constructor(
    @InjectRepository(Customer)
    private readonly customerRepo: Repository<Customer>,
    @InjectRepository(CustomerAttribution)
    private readonly attributionRepo: Repository<CustomerAttribution>,
    @InjectRepository(CustomerCoupon)
    private readonly customerCouponRepo: Repository<CustomerCoupon>,
    @InjectRepository(Coupon)
    private readonly couponRepo: Repository<Coupon>,
    @InjectRepository(SharingAgent)
    private readonly agentRepo: Repository<SharingAgent>,
    @InjectRepository(Store)
    private readonly storeRepo: Repository<Store>,
    private readonly dataSource: DataSource,
  ) {}

  // ========================
  // 归属管理
  // ========================

  /**
   * 记录客户归属（首击锁定）
   * 核心规则：同一客户首次点击 → 锁定该分享员 365 天，不可逆
   */
  async createAttribution(
    dto: CreateAttributionDto,
  ): Promise<{ attributionId: string; isNewLock: boolean }> {
    const {
      customerId,
      agentId,
      campaignId,
      sourceType,
      sourcePlatform,
      clickIp,
      clickDeviceId,
      clickUserAgent,
    } = dto

    // 验证客户存在
    const customer = await this.customerRepo.findOne({ where: { id: customerId } })
    if (!customer) {
      throw new NotFoundException({ code: 5001, message: '客户不存在' })
    }

    // 如果没有 agentId，记录匿名归属（只追踪渠道）
    if (!agentId) {
      const attr = this.attributionRepo.create({
        customerId,
        agentId: '',
        campaignId: campaignId ?? null,
        sourceType,
        sourcePlatform: sourcePlatform ?? null,
        clickIp: clickIp ?? null,
        clickDeviceId: clickDeviceId ?? null,
        clickUserAgent: clickUserAgent ?? null,
        lockStartedAt: new Date(),
        lockExpiredAt: null,
        isActive: false,
        totalRedemptions: 0,
        totalCommission: 0,
      })
      await this.attributionRepo.save(attr)
      return { attributionId: attr.id, isNewLock: false }
    }

    // 验证分享员存在
    const agent = await this.agentRepo.findOne({ where: { id: agentId } })
    if (!agent) {
      throw new NotFoundException({ code: 3001, message: '分享员不存在' })
    }

    const now = new Date()

    // 检查是否已有活跃归属（首击锁定，不可逆）
    const existingActive = await this.attributionRepo.findOne({
      where: { customerId, isActive: true },
    })

    if (existingActive) {
      // 已有关联：检查是否为同一分享员
      if (existingActive.agentId === agentId) {
        // 同一分享员重复点击，刷新点击时间但不重置锁定期
        existingActive.clickIp = clickIp ?? existingActive.clickIp
        existingActive.clickDeviceId = clickDeviceId ?? existingActive.clickDeviceId
        await this.attributionRepo.save(existingActive)
        return { attributionId: existingActive.id, isNewLock: false }
      }
      // 不同分享员：忽略（首击锁定不可逆）
      return { attributionId: existingActive.id, isNewLock: false }
    }

    // 检查该客户是否有过期归属（可重新锁定）
    const expiredAttribution = await this.attributionRepo.findOne({
      where: { customerId, isActive: false },
      order: { lockStartedAt: 'DESC' },
    })

    if (expiredAttribution) {
      // 重新激活过期归属
      expiredAttribution.agentId = agentId
      expiredAttribution.campaignId = campaignId ?? null
      expiredAttribution.sourceType = sourceType
      expiredAttribution.sourcePlatform = sourcePlatform ?? null
      expiredAttribution.clickIp = clickIp ?? null
      expiredAttribution.clickDeviceId = clickDeviceId ?? null
      expiredAttribution.clickUserAgent = clickUserAgent ?? null
      expiredAttribution.lockStartedAt = now
      expiredAttribution.lockExpiredAt = new Date(now.getTime() + LOCK_DURATION_MS)
      expiredAttribution.isActive = true
      expiredAttribution.deactivatedAt = null
      expiredAttribution.totalRedemptions = 0
      expiredAttribution.totalCommission = 0
      await this.attributionRepo.save(expiredAttribution)

      // 更新客户的 firstAgentId
      customer.firstAgentId = agentId
      await this.customerRepo.save(customer)

      return { attributionId: expiredAttribution.id, isNewLock: true }
    }

    // 全新归属
    const attr = this.attributionRepo.create({
      customerId,
      agentId,
      campaignId: campaignId ?? null,
      sourceType,
      sourcePlatform: sourcePlatform ?? null,
      clickIp: clickIp ?? null,
      clickDeviceId: clickDeviceId ?? null,
      clickUserAgent: clickUserAgent ?? null,
      lockStartedAt: now,
      lockExpiredAt: new Date(now.getTime() + LOCK_DURATION_MS),
      isActive: true,
      totalRedemptions: 0,
      totalCommission: 0,
    })
    await this.attributionRepo.save(attr)

    // 更新客户
    customer.firstAgentId = agentId
    await this.customerRepo.save(customer)

    this.logger.log({
      event: 'attribution_locked',
      customerId,
      agentId,
      attributionId: attr.id,
      lockExpiresAt: attr.lockExpiredAt,
    })

    return { attributionId: attr.id, isNewLock: true }
  }

  /**
   * 查询客户当前归属（用于佣金计算）
   */
  async getActiveAttribution(customerId: string) {
    const attr = await this.attributionRepo.findOne({
      where: { customerId, isActive: true },
      relations: ['agent'],
    })

    if (!attr) {
      return null
    }

    const now = new Date()
    const isExpired = attr.lockExpiredAt && attr.lockExpiredAt <= now

    return {
      attributionId: attr.id,
      agentId: attr.agentId,
      agentName: attr.agent?.nickname ?? null,
      campaignId: attr.campaignId,
      sourceType: attr.sourceType,
      sourcePlatform: attr.sourcePlatform,
      lockStartedAt: attr.lockStartedAt,
      lockExpiredAt: attr.lockExpiredAt,
      isExpired,
      daysRemaining: isExpired
        ? 0
        : attr.lockExpiredAt
          ? Math.ceil((attr.lockExpiredAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
          : 365,
      totalRedemptions: attr.totalRedemptions,
      totalCommission: Number(attr.totalCommission),
    }
  }

  /**
   * 查询客户归属历史
   */
  async getAttributionHistory(customerId: string) {
    const attrs = await this.attributionRepo.find({
      where: { customerId },
      order: { lockStartedAt: 'DESC' },
    })

    return attrs.map((a) => ({
      attributionId: a.id,
      agentId: a.agentId,
      campaignId: a.campaignId,
      sourceType: a.sourceType,
      sourcePlatform: a.sourcePlatform,
      lockStartedAt: a.lockStartedAt,
      lockExpiredAt: a.lockExpiredAt,
      isActive: a.isActive,
      deactivatedAt: a.deactivatedAt,
      totalRedemptions: a.totalRedemptions,
      totalCommission: Number(a.totalCommission),
    }))
  }

  // ========================
  // 客户注册
  // ========================

  /**
   * 客户注册（微信授权 / 手机号登录）
   */
  async registerCustomer(
    dto: RegisterCustomerDto,
  ): Promise<{ customerId: string; isNew: boolean }> {
    const { wechatOpenid, phone } = dto

    if (!wechatOpenid && !phone) {
      throw new BadRequestException({ code: 5002, message: '微信OpenID或手机号至少填写一项' })
    }

    // 优先按 OpenID 查
    if (wechatOpenid) {
      const existing = await this.customerRepo.findOne({ where: { wechatOpenid } })
      if (existing) {
        return { customerId: existing.id, isNew: false }
      }
    }

    // 按手机号查
    if (phone) {
      const existing = await this.customerRepo.findOne({ where: { phone } })
      if (existing) {
        // 合并 OpenID
        if (wechatOpenid && !existing.wechatOpenid) {
          existing.wechatOpenid = wechatOpenid
          await this.customerRepo.save(existing)
        }
        return { customerId: existing.id, isNew: false }
      }
    }

    // 新建客户
    const customer = this.customerRepo.create({
      wechatOpenid: wechatOpenid ?? null,
      phone: phone ?? null,
      totalRedemptions: 0,
      totalSpend: 0,
    })
    await this.customerRepo.save(customer)

    this.logger.log({ event: 'customer_registered', customerId: customer.id })
    return { customerId: customer.id, isNew: true }
  }

  /**
   * 获取客户信息
   */
  async getCustomer(customerId: string) {
    const customer = await this.customerRepo.findOne({ where: { id: customerId } })
    if (!customer) {
      throw new NotFoundException({ code: 5001, message: '客户不存在' })
    }

    return {
      customerId: customer.id,
      nickname: customer.nickname,
      avatar: customer.avatar,
      phone: customer.phone ? this.maskPhone(customer.phone) : null,
      province: customer.province,
      city: customer.city,
      totalRedemptions: customer.totalRedemptions,
      totalSpend: Number(customer.totalSpend),
      firstAgentId: customer.firstAgentId,
    }
  }

  // ========================
  // 领券
  // ========================

  /**
   * C端领券
   * 规则：每人限领次数 × 库存校验
   */
  async claimCoupon(customerId: string, dto: ClaimCouponDto) {
    const { couponId, attributionId } = dto
    return this.claimCouponInternal(customerId, { couponId, attributionId, source: 'share_link' })
  }

  /**
   * 客户优惠券列表
   */
  async listCustomerCoupons(customerId: string, query: ListCustomerCouponsDto) {
    const where: any = { customerId }
    if (query.status) {
      where.status = query.status
    }

    const [records, total] = await this.customerCouponRepo.findAndCount({
      where,
      relations: ['coupon'],
      order: { claimedAt: 'DESC' },
      skip: ((query.page ?? 1) - 1) * (query.pageSize ?? 20),
      take: query.pageSize ?? 20,
    })

    const items = records.map((r) => {
      const coupon = r.coupon as any
      return {
        customerCouponId: r.id,
        couponId: r.couponId,
        couponName: coupon?.couponName,
        couponCode: coupon?.couponCode,
        discountAmount: coupon?.discountAmount,
        thresholdAmount: coupon?.thresholdAmount,
        status: r.status,
        claimedAt: r.claimedAt,
        usedAt: r.usedAt,
        expiredAt: r.expiredAt,
      }
    })

    return {
      items,
      pagination: {
        page: query.page ?? 1,
        pageSize: query.pageSize ?? 20,
        total,
        totalPages: Math.ceil(total / (query.pageSize ?? 20)),
      },
    }
  }

  // ========================
  // C端领券发现（STORY-AI-016）
  // ========================

  /**
   * LBS 发现附近商家优惠
   * 优先用坐标（haversine），无坐标则用城市匹配
   */
  async discoverNearbyCoupons(query: DiscoverNearbyDto) {
    const { latitude, longitude, city, radius = 5000, category, page = 1, pageSize = 20 } = query

    let stores: any[]

    if (latitude && longitude) {
      // Haversine 距离公式（千米转米 / 1000）
      // 近似计算：1° 纬度 ≈ 111km; 1° 经度 ≈ 111km * cos(纬度)
      const latDelta = radius / 111000
      const lngDelta = radius / (111000 * Math.cos((latitude * Math.PI) / 180))

      const storesResult = await this.storeRepo
        .createQueryBuilder('s')
        .leftJoinAndSelect('s.merchant', 'merchant')
        .where('s.latitude IS NOT NULL')
        .andWhere('s.longitude IS NOT NULL')
        .andWhere('s.status = :status', { status: true })
        .andWhere('s.latitude BETWEEN :minLat AND :maxLat', {
          minLat: latitude - latDelta,
          maxLat: latitude + latDelta,
        })
        .andWhere('s.longitude BETWEEN :minLng AND :maxLng', {
          minLng: longitude - lngDelta,
          maxLng: longitude + lngDelta,
        })
        .andWhere('merchant.audit_status = :approved', { approved: 'APPROVED' })
        .orderBy(
          `(s.latitude - ${latitude}) * (s.latitude - ${latitude}) + (s.longitude - ${longitude}) * (s.longitude - ${longitude})`,
          'ASC',
        )
        .skip((page - 1) * pageSize)
        .take(pageSize)
        .getMany()

      stores = storesResult
    } else if (city) {
      // 城市兜底
      const storesResult = await this.storeRepo
        .createQueryBuilder('s')
        .leftJoinAndSelect('s.merchant', 'merchant')
        .where('(s.city LIKE :city OR merchant.city LIKE :city)', { city: `%${city}%` })
        .andWhere('s.status = :status', { status: true })
        .andWhere('merchant.audit_status = :approved', { approved: 'APPROVED' })
        .skip((page - 1) * pageSize)
        .take(pageSize)
        .getMany()

      stores = storesResult
    } else {
      return { items: [], pagination: { page, pageSize, total: 0, totalPages: 0 } }
    }

    // 获取每个门店的可用优惠券
    const storeIds = stores.map((s) => s.id)
    if (storeIds.length === 0) {
      return { items: [], pagination: { page, pageSize, total: 0, totalPages: 0 } }
    }

    const now = new Date()
    const coupons = await this.couponRepo
      .createQueryBuilder('c')
      .where('c.merchant_id IN (:...storeIds)', { storeIds })
      .andWhere('c.status = :active', { active: CouponStatus.ACTIVE })
      .andWhere('(c.valid_from IS NULL OR c.valid_from <= :now)', { now })
      .andWhere('(c.valid_until IS NULL OR c.valid_until >= :now)', { now })
      .andWhere('(c.remaining_stock IS NULL OR c.remaining_stock > 0)')
      .getMany()

    // 按门店聚合
    const storeCouponMap = new Map<string, any[]>()
    for (const coupon of coupons) {
      if (!storeCouponMap.has(coupon.merchantId)) {
        storeCouponMap.set(coupon.merchantId, [])
      }
      storeCouponMap.get(coupon.merchantId).push({
        couponId: coupon.id,
        couponName: coupon.couponName,
        couponType: coupon.couponType,
        discountAmount: coupon.discountAmount,
        thresholdAmount: coupon.thresholdAmount,
        cashRewardAmount: coupon.cashRewardAmount,
        validUntil: coupon.validUntil,
        totalIssued: coupon.totalIssued,
      })
    }

    const items = stores.map((s) => ({
      storeId: s.id,
      storeName: s.storeName,
      merchantId: s.merchantId,
      merchantName: s.merchant?.businessName ?? '',
      province: s.province,
      city: s.city,
      district: s.district,
      addressDetail: s.addressDetail,
      latitude: s.latitude ? Number(s.latitude) : null,
      longitude: s.longitude ? Number(s.longitude) : null,
      businessHours: s.businessHours,
      contactPhone: s.contactPhone,
      distance:
        latitude && longitude && s.latitude && s.longitude
          ? this.haversineDistance(latitude, longitude, Number(s.latitude), Number(s.longitude))
          : null,
      coupons: storeCouponMap.get(s.merchantId) ?? [],
    }))

    return {
      items,
      pagination: {
        page,
        pageSize,
        total: stores.length,
        totalPages: Math.ceil(stores.length / pageSize),
      },
    }
  }

  /**
   * 扫码领券（支持 couponCode 或 storeCode）
   */
  async scanClaimCoupon(customerId: string, dto: ScanClaimDto) {
    const { code, storeId, attributionId } = dto
    const now = new Date()

    // 尝试 couponCode 查找
    let coupon = await this.couponRepo.findOne({ where: { couponCode: code } })

    // 尝试 storeCode 查找（取该门店第一个可用券）
    if (!coupon) {
      const store = await this.storeRepo.findOne({
        where: { storeCode: code },
        relations: ['merchant'],
      })
      if (store) {
        coupon = await this.couponRepo
          .createQueryBuilder('c')
          .where('c.merchant_id = :merchantId', { merchantId: store.merchantId })
          .andWhere('c.status = :active', { active: CouponStatus.ACTIVE })
          .andWhere('(c.valid_from IS NULL OR c.valid_from <= :now)', { now })
          .andWhere('(c.valid_until IS NULL OR c.valid_until >= :now)', { now })
          .andWhere('(c.remaining_stock IS NULL OR c.remaining_stock > 0)')
          .orderBy('c.total_issued', 'DESC')
          .limit(1)
          .getOne()
      }
    }

    if (!coupon) {
      throw new NotFoundException({ code: 4010, message: '未找到优惠券' })
    }

    // 用 couponId 走已有的 claimCoupon 逻辑
    const claimResult = await this.claimCouponInternal(customerId, {
      couponId: coupon.id,
      attributionId,
      source: storeId ? 'qr_code' : 'qr_code',
      storeId,
    })

    this.logger.log({ event: 'scan_claim', customerId, couponId: coupon.id, code, storeId })

    return claimResult
  }

  /**
   * 商家/品类搜索
   */
  async searchMerchants(query: SearchMerchantsDto) {
    const { keyword, city, page = 1, pageSize = 20 } = query

    const qb = this.storeRepo
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.merchant', 'merchant')
      .where('s.status = :status', { status: true })
      .andWhere('merchant.audit_status = :approved', { approved: 'APPROVED' })

    if (keyword) {
      qb.andWhere(
        `(s.store_name LIKE :kw OR merchant.business_name LIKE :kw OR merchant.business_category LIKE :kw)`,
        { kw: `%${keyword}%` },
      )
    }

    if (city) {
      qb.andWhere('(s.city LIKE :city OR merchant.city LIKE :city)', { city: `%${city}%` })
    }

    const [stores, total] = await qb
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount()

    // 获取每个商家在营优惠券
    const merchantIds = [...new Set(stores.map((s) => s.merchantId))]
    const now = new Date()
    const coupons = merchantIds.length
      ? await this.couponRepo
          .createQueryBuilder('c')
          .where('c.merchant_id IN (:...merchantIds)', { merchantIds })
          .andWhere('c.status = :active', { active: CouponStatus.ACTIVE })
          .andWhere('(c.valid_from IS NULL OR c.valid_from <= :now)', { now })
          .andWhere('(c.valid_until IS NULL OR c.valid_until >= :now)', { now })
          .andWhere('(c.remaining_stock IS NULL OR c.remaining_stock > 0)')
          .getMany()
      : []

    const merchantCouponMap = new Map<string, any[]>()
    for (const coupon of coupons) {
      if (!merchantCouponMap.has(coupon.merchantId)) {
        merchantCouponMap.set(coupon.merchantId, [])
      }
      merchantCouponMap.get(coupon.merchantId).push({
        couponId: coupon.id,
        couponName: coupon.couponName,
        couponType: coupon.couponType,
        discountAmount: coupon.discountAmount,
        thresholdAmount: coupon.thresholdAmount,
      })
    }

    return {
      items: stores.map((s) => ({
        storeId: s.id,
        storeName: s.storeName,
        merchantId: s.merchantId,
        merchantName: s.merchant?.businessName ?? '',
        businessCategory: s.merchant?.businessCategory ?? '',
        city: s.city,
        district: s.district,
        addressDetail: s.addressDetail,
        contactPhone: s.contactPhone,
        businessHours: s.businessHours,
        coupons: merchantCouponMap.get(s.merchantId) ?? [],
      })),
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    }
  }

  // ========================
  // 私有工具
  // ========================

  /**
   * 私有领券逻辑（扫码/链接共用）
   */
  private async claimCouponInternal(
    customerId: string,
    dto: { couponId: string; attributionId?: string; source?: string; storeId?: string },
  ) {
    const { couponId, attributionId, source, storeId } = dto

    const coupon = await this.couponRepo.findOne({ where: { id: couponId } })
    if (!coupon) {
      throw new NotFoundException({ code: 4011, message: '优惠券不存在' })
    }
    if (coupon.status !== CouponStatus.ACTIVE) {
      throw new BadRequestException({ code: 4012, message: '优惠券已下架' })
    }

    const now = new Date()
    if (coupon.validFrom && coupon.validFrom > now) {
      throw new BadRequestException({ code: 4013, message: '优惠券尚未生效' })
    }
    if (coupon.validUntil && coupon.validUntil < now) {
      throw new BadRequestException({ code: 4014, message: '优惠券已过期' })
    }
    if (coupon.remainingStock !== null && coupon.remainingStock <= 0) {
      throw new BadRequestException({ code: 4015, message: '优惠券已领完' })
    }
    if (coupon.perCustomerLimit > 0) {
      const existingClaims = await this.customerCouponRepo.count({
        where: { customerId, couponId },
      })
      if (existingClaims >= coupon.perCustomerLimit) {
        throw new BadRequestException({
          code: 4016,
          message: `该券每人限领${coupon.perCustomerLimit}次`,
        })
      }
    }

    // 扣减库存
    const updated = await this.couponRepo
      .createQueryBuilder()
      .update(Coupon)
      .set({
        remainingStock:
          coupon.totalStock !== null && coupon.remainingStock !== null
            ? () => `remaining_stock - 1`
            : undefined,
        totalIssued: () => 'total_issued + 1',
      })
      .where('id = :id AND (remaining_stock IS NULL OR remaining_stock > 0)', { id: couponId })
      .execute()

    if (updated.affected === 0) {
      throw new BadRequestException({ code: 4015, message: '优惠券已领完' })
    }

    // 获取归属
    let agentId: string | null = null
    let attributionRecord: any = null
    if (attributionId) {
      attributionRecord = await this.attributionRepo.findOne({ where: { id: attributionId } })
      agentId = attributionRecord?.agentId ?? null
    }

    const couponCode = `CC-${coupon.id.slice(0, 8).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`

    const customerCoupon = this.customerCouponRepo.create({
      customerId,
      couponId,
      couponCode,
      attributionId: attributionId ?? null,
      agentId,
      source: source ?? 'qr_code',
      merchantId: coupon.merchantId,
      merchantName: '',
      couponName: coupon.couponName,
      couponType: coupon.couponType,
      discountAmount: coupon.discountAmount,
      thresholdAmount: coupon.thresholdAmount,
      cashRewardAmount: coupon.cashRewardAmount,
      validFrom: coupon.validFrom,
      expireAt: coupon.validUntil,
      validityType: 'date_range',
      status: CouponStatus.ACTIVE,
      claimedAt: now,
      shareCount: 0,
    })
    await this.customerCouponRepo.save(customerCoupon)

    await this.dataSource
      .createQueryBuilder()
      .update('campaigns')
      .set({ totalClaims: () => 'total_claims + 1' })
      .where('id = :id', { id: coupon.campaignId })
      .execute()

    return {
      customerCouponId: customerCoupon.id,
      couponId: coupon.id,
      couponCode,
      couponName: coupon.couponName,
      discountAmount: coupon.discountAmount,
      thresholdAmount: coupon.thresholdAmount,
      cashRewardAmount: coupon.cashRewardAmount,
      validFrom: coupon.validFrom,
      validUntil: coupon.validUntil,
      status: 'active',
    }
  }

  /**
   * 计算两点间 haversine 距离（米）
   */
  private haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000 // Earth radius in meters
    const dLat = ((lat2 - lat1) * Math.PI) / 180
    const dLon = ((lon2 - lon1) * Math.PI) / 180
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return Math.round(R * c)
  }

  /**
   * 手机号脱敏
   */
  private maskPhone(phone: string): string {
    if (!phone || phone.length < 7) return phone
    return phone.slice(0, 3) + '****' + phone.slice(-4)
  }
}
