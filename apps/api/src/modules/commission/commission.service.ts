// ============================================================
// AI auto - Commission Service
// Commission calculation engine: redemption → commission calculation
// 80% to agent, 20% platform fee, with level multiplier
// ============================================================

import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository, DataSource } from 'typeorm'

import { Commission } from './entities/commission.entity'
import { Redemption } from './entities/redemption.entity'
import { CustomerCoupon } from '../customer/entities/customer-coupon.entity'
import { AgentWallet } from '../agent/entities/agent-wallet.entity'
import { AgentLevel, CouponStatus, RedemptionStatus } from '@ai-auto/shared'

import { RedeemCouponDto, RedeemResultDto, ListRedemptionsDto } from './dto/redeem.dto'

// Commission rates
const PLATFORM_FEE_RATE = 0.2 // 20% platform fee
const AGENT_RATE = 0.8 // 80% to agent

// Level multiplier map
const LEVEL_MULTIPLIERS: Record<string, number> = {
  [AgentLevel.BRONZE]: 1.0,
  [AgentLevel.SILVER]: 1.1,
  [AgentLevel.GOLD]: 1.25,
  [AgentLevel.DIAMOND]: 1.5,
  [AgentLevel.KING]: 2.0,
}

@Injectable()
export class CommissionService {
  private readonly logger = new Logger(CommissionService.name)

  constructor(
    @InjectRepository(Commission)
    private readonly commissionRepo: Repository<Commission>,
    @InjectRepository(Redemption)
    private readonly redemptionRepo: Repository<Redemption>,
    @InjectRepository(CustomerCoupon)
    private readonly customerCouponRepo: Repository<CustomerCoupon>,
    @InjectRepository(AgentWallet)
    private readonly walletRepo: Repository<AgentWallet>,
    private readonly dataSource: DataSource,
  ) {}

  // ========================
  // 核销 → 佣金计算
  // ========================

  /**
   * 核销回调触发佣金计算
   * 幂等：一个 redemptionId 只计算一次
   *
   * @param redemptionId 核销记录ID
   * @param idempotencyKey 幂等键（redemptionId 作为幂等键）
   */
  async calculateCommission(
    redemptionId: string,
    idempotencyKey?: string,
  ): Promise<{ commissionId: string; agentPayout: number }> {
    const key = idempotencyKey ?? redemptionId

    // 幂等检查
    const existing = await this.commissionRepo.findOne({
      where: { idempotencyKey: key },
    })
    if (existing) {
      this.logger.warn({
        event: 'commission_idempotent_skip',
        redemptionId,
        commissionId: existing.id,
      })
      return {
        commissionId: existing.id,
        agentPayout: Number(existing.agentFinalPayout),
      }
    }

    // 获取核销记录
    const redemption = await this.redemptionRepo.findOne({
      where: { id: redemptionId },
      relations: ['attribution'],
    })
    if (!redemption) {
      throw new NotFoundException({ code: 6001, message: '核销记录不存在' })
    }

    // 检查归属
    const attribution = redemption.attribution
    if (!attribution || !attribution.agentId) {
      this.logger.log({
        event: 'commission_no_attribution',
        redemptionId,
        message: '无归属分享员，跳过佣金计算',
      })
      return { commissionId: '', agentPayout: 0 }
    }

    // 检查归属是否过期
    const now = new Date()
    if (attribution.lockExpiredAt && attribution.lockExpiredAt < now) {
      this.logger.log({
        event: 'commission_attribution_expired',
        redemptionId,
        message: '归属已过期，跳过佣金计算',
      })
      return { commissionId: '', agentPayout: 0 }
    }

    // 获取分享员钱包
    const wallet = await this.walletRepo.findOne({
      where: { agentId: attribution.agentId },
    })
    if (!wallet) {
      this.logger.warn({
        event: 'commission_no_wallet',
        agentId: attribution.agentId,
        redemptionId,
      })
      // 创建钱包（如果不存在）
      const newWallet = this.walletRepo.create({
        agentId: attribution.agentId,
        pendingSettlementBalance: 0,
        settledBalance: 0,
        frozenBalance: 0,
        totalEarned: 0,
        totalPlatformFee: 0,
        totalSettled: 0,
        totalWithdrawn: 0,
        aiTokenBalance: 0,
        status: true,
      })
      const saved = await this.walletRepo.save(newWallet)
      // 在事务中更新
      return this.calculateAndRecord(redemption, attribution, saved, key)
    }

    // 在事务中完成计算
    return this.calculateAndRecord(redemption, attribution, wallet, key)
  }

  /**
   * 在事务中完成佣金计算和钱包更新
   */
  private async calculateAndRecord(
    redemption: any,
    attribution: any,
    wallet: AgentWallet,
    idempotencyKey: string,
  ) {
    const agentReward = Number(redemption.agentRewardAmount)
    if (agentReward <= 0) {
      return { commissionId: '', agentPayout: 0 }
    }

    // 获取分享员等级（从关联查询，这里简化处理）
    const levelMultiplier = this.getLevelMultiplier(wallet as any)

    // 计算金额
    const platformFee = this.roundMoney(agentReward * PLATFORM_FEE_RATE)
    const agentBasePayout = this.roundMoney(agentReward * AGENT_RATE)
    const agentFinalPayout = this.roundMoney(agentBasePayout * levelMultiplier)

    const balanceBefore = Number(wallet.pendingSettlementBalance)
    const balanceAfter = this.roundMoney(balanceBefore + agentFinalPayout)

    // T+3 结算日
    const settleAt = this.calculateSettleDate(redemption.createdAt)

    // 事务中原子更新
    await this.dataSource.transaction(async (manager) => {
      // 创建佣金记录
      const commission = manager.create(Commission, {
        idempotencyKey,
        walletId: wallet.id,
        redemptionId: redemption.id,
        merchantReward: agentReward,
        platformFee,
        agentBasePayout,
        agentFinalPayout,
        levelMultiplier,
        agentId: attribution.agentId,
        customerId: redemption.customerId,
        campaignId: attribution.campaignId ?? null,
        attributionId: attribution.id,
        merchantId: redemption.merchantId,
        status: 'pending',
        settleAt,
        walletBalanceBefore: balanceBefore,
        walletBalanceAfter: balanceAfter,
      })
      await manager.save(commission)

      // 更新钱包余额
      await manager.update(AgentWallet, wallet.id, {
        pendingSettlementBalance: balanceAfter,
        totalEarned: this.roundMoney(Number(wallet.totalEarned) + agentFinalPayout),
        totalPlatformFee: this.roundMoney(Number(wallet.totalPlatformFee) + platformFee),
      })

      // 更新归属统计
      await manager.increment(
        'customer_attributions',
        { id: attribution.id },
        'totalRedemptions',
        1,
      )
      await manager.increment(
        'customer_attributions',
        { id: attribution.id },
        'totalCommission',
        agentFinalPayout,
      )

      // 更新客户统计
      await manager.increment('customers', { id: redemption.customerId }, 'totalRedemptions', 1)
    })

    this.logger.log({
      event: 'commission_calculated',
      redemptionId: redemption.id,
      agentId: attribution.agentId,
      agentReward,
      platformFee,
      agentFinalPayout,
      levelMultiplier,
    })

    return { commissionId: idempotencyKey, agentPayout: agentFinalPayout }
  }

  /**
   * 获取分享员等级乘数（从信誉分换算）
   */
  private getLevelMultiplier(wallet: any): number {
    // 实际应从 SharingAgent 表获取等级
    // 简化：默认青铜等级
    const level = wallet.agentLevel ?? AgentLevel.BRONZE
    return LEVEL_MULTIPLIERS[level] ?? 1.0
  }

  /**
   * 计算结算日（T+3 工作日）
   */
  private calculateSettleDate(fromDate: Date): Date {
    const d = new Date(fromDate)
    let businessDays = 0
    while (businessDays < 3) {
      d.setDate(d.getDate() + 1)
      const day = d.getDay()
      if (day !== 0 && day !== 6) {
        // 排除周末
        businessDays++
      }
    }
    // 截断到日期（不含时间）
    d.setHours(0, 0, 0, 0)
    return d
  }

  /**
   * 金额精度处理（decimal(12,2)）
   */
  private roundMoney(amount: number): number {
    return Math.round(amount * 100) / 100
  }

  // ========================
  // 佣金查询
  // ========================

  /**
   * 查询分享员佣金流水
   */
  async listAgentCommissions(agentId: string, page = 1, pageSize = 20) {
    const wallet = await this.walletRepo.findOne({ where: { agentId } })
    if (!wallet) {
      return { items: [], pagination: { page, pageSize, total: 0, totalPages: 0 } }
    }

    const [commissions, total] = await this.commissionRepo.findAndCount({
      where: { walletId: wallet.id },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    })

    return {
      items: commissions.map((c) => ({
        commissionId: c.id,
        redemptionId: c.redemptionId,
        customerId: c.customerId,
        merchantReward: Number(c.merchantReward),
        platformFee: Number(c.platformFee),
        agentPayout: Number(c.agentFinalPayout),
        levelMultiplier: Number(c.levelMultiplier),
        status: c.status,
        settleAt: c.settleAt,
        settledAt: c.settledAt,
        createdAt: c.createdAt,
      })),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    }
  }

  /**
   * 查询分享员钱包余额
   */
  async getAgentWallet(agentId: string) {
    let wallet = await this.walletRepo.findOne({ where: { agentId } })
    if (!wallet) {
      wallet = this.walletRepo.create({
        agentId,
        pendingSettlementBalance: 0,
        settledBalance: 0,
        frozenBalance: 0,
        totalEarned: 0,
        totalPlatformFee: 0,
        totalSettled: 0,
        totalWithdrawn: 0,
        aiTokenBalance: 0,
        status: true,
      })
      wallet = await this.walletRepo.save(wallet)
    }

    return {
      walletId: wallet.id,
      agentId: wallet.agentId,
      pendingSettlement: Number(wallet.pendingSettlementBalance),
      available: Number(wallet.settledBalance),
      frozen: Number(wallet.frozenBalance),
      totalEarned: Number(wallet.totalEarned),
      totalSettled: Number(wallet.totalSettled),
      totalWithdrawn: Number(wallet.totalWithdrawn),
      lastSettlementAt: wallet.lastSettlementAt,
    }
  }

  // ========================
  // 核销（STORY-AI-017）
  // ========================

  /**
   * 商家核销券码
   * 验证 → 创建 Redemption → 触发佣金计算
   */
  async redeemCoupon(merchantId: string, dto: RedeemCouponDto): Promise<RedeemResultDto> {
    const { couponCode, transactionAmount, storeId, merchantTransactionId, presentedAt } = dto
    const now = new Date()

    // 幂等键：同一个商家+同一交易号只处理一次
    const idempotencyKey = merchantTransactionId
      ? `redeem:${merchantId}:${merchantTransactionId}`
      : `redeem:${merchantId}:${couponCode}:${now.getTime()}`

    // 幂等检查
    const existingRedemption = await this.redemptionRepo.findOne({
      where: { idempotencyKey },
    })
    if (existingRedemption) {
      return this.buildRedeemResult(existingRedemption, 'already_processed')
    }

    // 按 couponCode 查找 CustomerCoupon
    const customerCoupon = await this.customerCouponRepo.findOne({
      where: { couponCode },
    })
    if (!customerCoupon) {
      return {
        redemptionId: '',
        couponCode,
        discountValue: 0,
        success: false,
        failureReason: '券码不存在或已失效',
      }
    }

    // 平台验证
    const validation = await this.validateForRedemption(customerCoupon, merchantId)
    if (!validation.valid) {
      return {
        redemptionId: '',
        couponCode,
        discountValue: 0,
        success: false,
        failureReason: validation.reason,
      }
    }

    // 计算优惠值
    const discountValue =
      Number(customerCoupon.discountAmount ?? 0) > 0
        ? Number(customerCoupon.discountAmount)
        : Number(customerCoupon.cashRewardAmount ?? 0)

    // 创建 Redemption 记录
    const redemptionData: Partial<Redemption> = {
      idempotencyKey,
      customerId: customerCoupon.customerId,
      couponId: customerCoupon.couponId,
      merchantId,
      storeId: storeId ?? null,
      campaignId: null,
      attributionId: customerCoupon.attributionId ?? null,
      couponType: customerCoupon.couponType,
      discountAmount: customerCoupon.discountAmount ?? null,
      cashRewardAmount: customerCoupon.cashRewardAmount ?? null,
      transactionAmount,
      discountValue,
      agentRewardAmount: discountValue,
      couponCode,
      merchantTransactionId: merchantTransactionId ?? null,
      presentedAt: presentedAt ? new Date(presentedAt) : now,
      callbackReceivedAt: now,
      status: RedemptionStatus.PENDING,
      fraudFlagged: false,
    }
    const savedRedemption = await this.redemptionRepo.save(
      this.redemptionRepo.create(redemptionData),
    )

    // 标记 CustomerCoupon 为已核销
    await this.customerCouponRepo.update(
      { id: customerCoupon.id },
      { status: CouponStatus.REDEEMED, usedAt: now },
    )

    // 触发佣金计算
    const commissionResult = await this.calculateCommission(
      savedRedemption.id,
      savedRedemption.idempotencyKey,
    )

    // 更新 Redemption 记录
    await this.redemptionRepo.update({ id: savedRedemption.id }, {
      commissionId: commissionResult.commissionId || null,
      status: 'verified',
      verifiedAt: now,
      verifiedBy: null,
    } as any)

    // 获取归属分享员信息
    const attributionInfo = await this.getAttributionInfo(customerCoupon.attributionId)

    this.logger.log({
      event: 'coupon_redeemed',
      redemptionId: savedRedemption.id,
      couponCode,
      merchantId,
      discountValue,
      commissionAgentPayout: commissionResult.agentPayout,
    })

    return {
      redemptionId: savedRedemption.id,
      couponCode,
      discountValue,
      success: true,
      commissionResult:
        commissionResult.agentPayout > 0
          ? {
              commissionId: commissionResult.commissionId,
              agentPayout: commissionResult.agentPayout,
              level: attributionInfo.level,
              multiplier: attributionInfo.multiplier,
            }
          : undefined,
      agentNickname: attributionInfo.nickname,
      lockDaysRemaining: attributionInfo.lockDaysRemaining,
    }
  }

  /**
   * 商家查询核销记录列表
   */
  async listRedemptions(merchantId: string, query: ListRedemptionsDto) {
    const { status, startDate, endDate, page = 1, pageSize = 20 } = query

    const where: any = { merchantId }
    if (status) where.status = status
    if (startDate) where.createdAt = new Date(startDate)

    const [records, total] = await this.redemptionRepo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: ((page ?? 1) - 1) * (pageSize ?? 20),
      take: pageSize ?? 20,
    })

    return {
      items: records.map((r) => ({
        redemptionId: r.id,
        couponCode: r.couponCode,
        customerId: r.customerId,
        transactionAmount: Number(r.transactionAmount),
        discountValue: Number(r.discountValue),
        status: r.status,
        createdAt: r.createdAt,
        verifiedAt: r.verifiedAt,
        merchantTransactionId: r.merchantTransactionId,
        failureReason: r.callbackError ?? null,
      })),
      pagination: {
        page: page ?? 1,
        pageSize: pageSize ?? 20,
        total,
        totalPages: Math.ceil(total / (pageSize ?? 20)),
      },
    }
  }

  // ========================
  // 私有工具
  // ========================

  /**
   * 核销前平台验证
   */
  private async validateForRedemption(
    cc: CustomerCoupon,
    merchantId: string,
  ): Promise<{ valid: boolean; reason?: string }> {
    const now = new Date()

    // 1. 券状态
    if (cc.status === CouponStatus.REDEEMED) {
      return { valid: false, reason: '优惠券已核销' }
    }
    if (cc.status === CouponStatus.EXPIRED) {
      return { valid: false, reason: '优惠券已过期' }
    }

    // 2. 有效期
    if (cc.validFrom && cc.validFrom > now) {
      return { valid: false, reason: '优惠券尚未生效' }
    }
    if (cc.expireAt && cc.expireAt < now) {
      return { valid: false, reason: '优惠券已过期' }
    }

    // 3. 商家归属匹配
    if (cc.merchantId !== merchantId) {
      return { valid: false, reason: '优惠券不属于当前商家' }
    }

    return { valid: true }
  }

  /**
   * 获取归属分享员信息
   */
  private async getAttributionInfo(attributionId: string | null | undefined): Promise<{
    nickname: string | null
    level: string
    multiplier: number
    lockDaysRemaining: number
  }> {
    if (!attributionId) {
      return { nickname: null, level: 'BRONZE', multiplier: 1.0, lockDaysRemaining: 0 }
    }

    const attr = await this.redemptionRepo.manager
      .getRepository('CustomerAttribution')
      .findOne({ where: { id: attributionId } })
    if (!attr || !attr.agentId) {
      return { nickname: null, level: 'BRONZE', multiplier: 1.0, lockDaysRemaining: 0 }
    }

    const now = new Date()
    const isExpired = attr.lockExpiredAt && attr.lockExpiredAt < now
    const daysRemaining = isExpired
      ? 0
      : attr.lockExpiredAt
        ? Math.ceil((attr.lockExpiredAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        : 365

    return {
      nickname: null,
      level: 'BRONZE',
      multiplier: 1.0,
      lockDaysRemaining: daysRemaining,
    }
  }

  /**
   * 构建核销结果（幂等返回）
   */
  private buildRedeemResult(r: Redemption, reason: string): RedeemResultDto {
    return {
      redemptionId: r.id,
      couponCode: r.couponCode,
      discountValue: Number(r.discountValue),
      success: r.status === RedemptionStatus.VERIFIED || r.status === RedemptionStatus.SETTLED,
      failureReason:
        reason === 'already_processed' ? '该核销已处理' : (r.callbackError ?? undefined),
    }
  }
}
