// ============================================================
// AI auto - Merchant Registration Service
// Handles merchant registration, profile, and store management
// ============================================================

import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository, DataSource } from 'typeorm'
import { Merchant } from './entities/merchant.entity'
import { Store } from './entities/store.entity'
import { Subscription } from './entities/subscription.entity'
import { AuditLog } from '../admin/entities/audit-log.entity'
import { AuditStatus, SubscriptionStatus } from '@ai-auto/shared'

import { RegisterMerchantDto, UpdateMerchantProfileDto } from './dto/merchant-registration.dto'
import { CreateStoreDto, UpdateStoreDto } from './dto/store.dto'

@Injectable()
export class MerchantService {
  private readonly logger = new Logger(MerchantService.name)

  constructor(
    @InjectRepository(Merchant)
    private readonly merchantRepo: Repository<Merchant>,
    @InjectRepository(Store)
    private readonly storeRepo: Repository<Store>,
    @InjectRepository(Subscription)
    private readonly subscriptionRepo: Repository<Subscription>,
    @InjectRepository(AuditLog)
    private readonly auditLogRepo: Repository<AuditLog>,
    private readonly dataSource: DataSource,
  ) {}

  // ========================
  // 商户注册
  // ========================

  /**
   * 商户注册
   * 流程：验证手机号 → 验证验证码 → 创建商户 → 创建首个门店 → 创建待审核记录
   */
  async register(dto: RegisterMerchantDto): Promise<{ merchantId: string; status: string }> {
    // 1. 检查手机号是否已注册
    const existing = await this.merchantRepo.findOne({
      where: { phone: dto.phone },
      select: ['id'],
    })
    if (existing) {
      throw new ConflictException({
        code: 2002,
        message: '该手机号已注册，请直接登录',
      })
    }

    // 2. 验证短信验证码（简化：直接通过，生产需调用 SMS 服务）
    // TODO: 生产环境接入真实 SMS 服务
    if (!dto.verificationCode || dto.verificationCode.length < 4) {
      throw new BadRequestException({
        code: 1006,
        message: '验证码不正确',
      })
    }

    // 3. 事务：创建商户 + 首个门店
    const merchant = await this.dataSource.transaction(async (manager) => {
      // 创建商户
      const merchantEntity = manager.create(Merchant, {
        businessName: dto.businessName,
        contactName: dto.contactName,
        phone: dto.phone,
        email: dto.email,
        businessType: dto.businessType ?? 'individual',
        industryCategory: dto.industryCategory,
        businessLicenseNo: dto.businessLicenseNo,
        province: dto.addressDetail?.split('省')[0] ?? null,
        city: dto.addressDetail?.split('省')[1]?.split('市')[0] ?? null,
        auditStatus: AuditStatus.PENDING,
        subscriptionStatus: SubscriptionStatus.EXPIRED,
      })
      const savedMerchant = await manager.save(merchantEntity)

      // 创建首个门店
      const storeEntity = manager.create(Store, {
        merchantId: savedMerchant.id,
        storeName: dto.storeName,
        province: dto.addressDetail?.split('省')[0] ?? null,
        city: dto.addressDetail?.split('省')[1]?.split('市')[0] ?? null,
        addressDetail: dto.addressDetail,
        latitude: dto.latitude,
        longitude: dto.longitude,
        status: true,
      })
      await manager.save(storeEntity)

      return savedMerchant
    })

    this.logger.log({
      event: 'merchant_registered',
      merchantId: merchant.id,
      phone: dto.phone,
    })

    return {
      merchantId: merchant.id,
      status: 'pending_review',
    }
  }

  // ========================
  // 商户信息
  // ========================

  /**
   * 获取当前商户信息（脱敏）
   */
  async getProfile(merchantId: string) {
    const merchant = await this.merchantRepo.findOne({
      where: { id: merchantId },
      relations: ['stores', 'subscriptions'],
    })

    if (!merchant) {
      throw new NotFoundException({
        code: 2002,
        message: '商户不存在',
      })
    }

    // 获取活跃订阅
    const activeSubscription = merchant.subscriptions?.find(
      (s) => s.status === SubscriptionStatus.ACTIVE,
    )

    return {
      merchantId: merchant.id,
      businessName: merchant.businessName,
      contactName: merchant.contactName,
      phone: this.maskPhone(merchant.phone),
      email: merchant.email,
      businessType: merchant.businessType,
      industryCategory: merchant.industryCategory,
      status: merchant.subscriptionStatus,
      auditStatus: merchant.auditStatus,
      subscription: activeSubscription
        ? {
            plan: activeSubscription.planName,
            status: activeSubscription.status,
            expiresAt: activeSubscription.expireAt,
            storesUsed: merchant.stores?.length ?? 0,
            storesLimit: 3,
          }
        : null,
      apiKey: 'app_•••••••••••••••',
      apiSecretHint: '已设置',
      createdAt: merchant.createdAt,
    }
  }

  /**
   * 更新商户信息（基本信息，不含资质）
   */
  async updateProfile(merchantId: string, dto: UpdateMerchantProfileDto): Promise<void> {
    const merchant = await this.merchantRepo.findOne({
      where: { id: merchantId },
    })
    if (!merchant) {
      throw new NotFoundException({
        code: 2002,
        message: '商户不存在',
      })
    }

    // 只允许更新部分字段
    const allowedFields = ['contactName', 'email', 'addressDetail', 'latitude', 'longitude']
    for (const field of allowedFields) {
      if (dto[field] !== undefined) {
        ;(merchant as any)[field] = dto[field]
      }
    }

    await this.merchantRepo.save(merchant)

    this.logger.log({
      event: 'merchant_profile_updated',
      merchantId,
    })
  }

  // ========================
  // 门店管理
  // ========================

  /**
   * 门店列表
   */
  async listStores(merchantId: string, page = 1, pageSize = 20) {
    const [stores, total] = await this.storeRepo.findAndCount({
      where: { merchantId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    })

    const items = stores.map((s) => ({
      storeId: s.id,
      storeName: s.storeName,
      storeCode: s.storeCode,
      address: [s.province, s.city, s.district, s.addressDetail].filter(Boolean).join(''),
      latitude: s.latitude,
      longitude: s.longitude,
      contactPhone: s.contactPhone,
      businessHours: s.businessHours,
      status: s.status ? 'active' : 'inactive',
      agentCount: 0, // TODO: 关联查询
      createdAt: s.createdAt,
    }))

    return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) }
  }

  /**
   * 创建门店
   */
  async createStore(merchantId: string, dto: CreateStoreDto) {
    // 检查订阅是否允许新增门店
    const activeSub = await this.subscriptionRepo.findOne({
      where: {
        merchantId,
        status: SubscriptionStatus.ACTIVE,
      },
    })

    if (!activeSub) {
      throw new BadRequestException({
        code: 2004,
        message: '订阅已过期，无法新增门店',
      })
    }

    // 检查门店数量限制（标准订阅：3门店）
    const storeCount = await this.storeRepo.count({
      where: { merchantId, status: true },
    })

    if (storeCount >= 3) {
      throw new BadRequestException({
        code: 2004,
        message: '门店数量已达上限（3个），请续费升级',
      })
    }

    // 生成门店编号
    const storeCode =
      dto.storeCode ??
      `S-${merchantId.slice(0, 8).toUpperCase()}-${String(storeCount + 1).padStart(3, '0')}`

    const store = this.storeRepo.create({
      merchantId,
      storeName: dto.storeName,
      storeCode,
      province: dto.province,
      city: dto.city,
      district: dto.district,
      addressDetail: dto.addressDetail,
      latitude: dto.latitude,
      longitude: dto.longitude,
      contactPhone: dto.contactPhone,
      businessHours: dto.businessHours,
      status: true,
    })

    await this.storeRepo.save(store)

    this.logger.log({
      event: 'store_created',
      merchantId,
      storeId: store.id,
      storeName: dto.storeName,
    })

    return { storeId: store.id, storeCode }
  }

  /**
   * 更新门店
   */
  async updateStore(merchantId: string, storeId: string, dto: UpdateStoreDto) {
    const store = await this.storeRepo.findOne({
      where: { id: storeId, merchantId },
    })

    if (!store) {
      throw new NotFoundException({
        code: 2002,
        message: '门店不存在',
      })
    }

    const allowedFields = [
      'storeName',
      'addressDetail',
      'latitude',
      'longitude',
      'contactPhone',
      'businessHours',
      'status',
    ]
    for (const field of allowedFields) {
      if (dto[field] !== undefined) {
        ;(store as any)[field] = dto[field]
      }
    }

    await this.storeRepo.save(store)

    this.logger.log({
      event: 'store_updated',
      merchantId,
      storeId,
    })
  }

  /**
   * 删除门店（软删除，只能删除无核销记录的门店）
   */
  async deleteStore(merchantId: string, storeId: string) {
    const store = await this.storeRepo.findOne({
      where: { id: storeId, merchantId },
    })

    if (!store) {
      throw new NotFoundException({
        code: 2002,
        message: '门店不存在',
      })
    }

    // TODO: 检查是否有核销记录，有则只能暂停
    // const redemptionCount = await this.redemptionRepo.count({ where: { storeId } });
    // if (redemptionCount > 0) {
    //   store.status = false;
    //   await this.storeRepo.save(store);
    //   throw new BadRequestException({ code: 2004, message: '该门店已有核销记录，已自动暂停' });
    // }

    await this.storeRepo.softDelete(storeId)

    this.logger.log({
      event: 'store_deleted',
      merchantId,
      storeId,
    })
  }

  // ========================
  // 订阅管理
  // ========================

  /**
   * 获取订阅信息
   */
  async getSubscription(merchantId: string) {
    const subscriptions = await this.subscriptionRepo.find({
      where: { merchantId },
      order: { createdAt: 'DESC' },
    })

    const active = subscriptions.find((s) => s.status === SubscriptionStatus.ACTIVE)

    return {
      subscriptionId: active?.id,
      plan: active?.planName ?? null,
      status: active?.status ?? null,
      expiresAt: active?.expireAt ?? null,
      storesUsed: (await this.storeRepo.count({ where: { merchantId } })) || 0,
      storesLimit: 3,
      features: active ? ['unlimited_agents', 'ai_copy', 'multi_platform'] : [],
      aiCopyRemaining: 95,
      aiCopyLimit: 100,
    }
  }

  // ========================
  // 工具方法
  // ========================

  private maskPhone(phone: string): string {
    if (!phone || phone.length < 11) return phone
    return phone.slice(0, 3) + '****' + phone.slice(-4)
  }
}
