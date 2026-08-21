// ============================================================
// AI auto - Analytics Service
// Attribution chain tracking, funnel, ROI, and reporting
// ============================================================

import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import {
  Repository,
  Between,
  MoreThanOrEqual,
  LessThanOrEqual,
  In,
  SelectQueryBuilder,
} from 'typeorm'

import { CustomerAttribution } from '../customer/entities/customer-attribution.entity'
import { CustomerCoupon } from '../customer/entities/customer-coupon.entity'
import { Redemption } from '../commission/entities/redemption.entity'
import { Commission } from '../commission/entities/commission.entity'
import { Campaign } from '../campaign/entities/campaign.entity'
import { SharingAgent } from '../agent/entities/sharing-agent.entity'
import { RedemptionStatus } from '@ai-auto/shared'
import { CouponStatus } from '@ai-auto/shared'
import {
  AnalyticsQueryDto,
  FunnelDataDto,
  AttributionChainDto,
  PeriodComparisonDto,
  ROIDataDto,
  TimeSeriesPointDto,
  AgentLeaderboardDto,
} from './dto/analytics.dto'

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name)

  constructor(
    @InjectRepository(CustomerAttribution)
    private readonly attributionRepo: Repository<CustomerAttribution>,
    @InjectRepository(CustomerCoupon)
    private readonly couponRepo: Repository<CustomerCoupon>,
    @InjectRepository(Redemption)
    private readonly redemptionRepo: Repository<Redemption>,
    @InjectRepository(Commission)
    private readonly commissionRepo: Repository<Commission>,
    @InjectRepository(Campaign)
    private readonly campaignRepo: Repository<Campaign>,
    @InjectRepository(SharingAgent)
    private readonly agentRepo: Repository<SharingAgent>,
  ) {}

  // ========================
  // 漏斗数据
  // ========================

  /**
   * 漏斗数据：浏览→点击→领取→核销
   */
  async getFunnelData(merchantId: string, query: AnalyticsQueryDto): Promise<FunnelDataDto> {
    const start = query.startDate ? new Date(query.startDate) : undefined
    const end = query.endDate ? new Date(query.endDate) : undefined
    const campaignIds = await this.getCampaignIds(merchantId, query.campaignId)

    // 核销数
    const redemptionWhere: any = { merchantId, status: RedemptionStatus.VERIFIED }
    if (start && end) redemptionWhere.createdAt = Between(start, end)
    else if (start) redemptionWhere.createdAt = MoreThanOrEqual(start)
    else if (end) redemptionWhere.createdAt = LessThanOrEqual(end)
    if (campaignIds.length > 0) redemptionWhere.campaignId = In(campaignIds)
    const redemptionCount = await this.redemptionRepo.count({ where: redemptionWhere })

    // 领取数
    const claimWhere: any = { merchantId }
    if (start && end) claimWhere.claimedAt = Between(start, end)
    else if (start) claimWhere.claimedAt = MoreThanOrEqual(start)
    else if (end) claimWhere.claimedAt = LessThanOrEqual(end)
    if (campaignIds.length > 0) claimWhere.couponId = In(campaignIds)
    const claimCount = await this.couponRepo.count({ where: claimWhere })

    // 点击数（归属记录 = 点击了分享链接的客户）
    const clickWhere: any = {}
    if (start && end) clickWhere.lockStartedAt = Between(start, end)
    else if (start) clickWhere.lockStartedAt = MoreThanOrEqual(start)
    else if (end) clickWhere.lockStartedAt = LessThanOrEqual(end)
    if (campaignIds.length > 0) clickWhere.campaignId = In(campaignIds)
    const clickCount = await this.attributionRepo.count({ where: clickWhere })

    // 归属记录近似浏览量
    const impressionCount = Math.max(clickCount, claimCount, redemptionCount)

    // 复购客户数
    const repurchaseWhere: any = { merchantId, status: RedemptionStatus.VERIFIED }
    if (start && end) repurchaseWhere.createdAt = Between(start, end)
    else if (start) repurchaseWhere.createdAt = MoreThanOrEqual(start)
    else if (end) repurchaseWhere.createdAt = LessThanOrEqual(end)
    const redemptions = await this.redemptionRepo.find({ where: repurchaseWhere })
    const customerCounts = new Map<string, number>()
    for (const r of redemptions) {
      customerCounts.set(r.customerId, (customerCounts.get(r.customerId) ?? 0) + 1)
    }
    const repurchaseCount = Array.from(customerCounts.values()).filter((c) => c > 1).length

    return {
      impressions: impressionCount,
      clicks: clickCount,
      claims: claimCount,
      redemptions: redemptionCount,
      repurchases: repurchaseCount,
      reshares: 0,
    }
  }

  // ========================
  // 全链路追踪
  // ========================

  /**
   * 全链路追踪：分享员→链接→客户→领券→核销
   */
  async getAttributionChain(merchantId: string, query: AnalyticsQueryDto) {
    const start = query.startDate ? new Date(query.startDate) : undefined
    const end = query.endDate ? new Date(query.endDate) : undefined
    const campaignIds = await this.getCampaignIds(merchantId, query.campaignId)

    const where: any = { merchantId }
    if (start && end) where.claimedAt = Between(start, end)
    else if (start) where.claimedAt = MoreThanOrEqual(start)
    else if (end) where.claimedAt = LessThanOrEqual(end)
    if (campaignIds.length > 0) where.couponId = In(campaignIds)
    if (query.agentId) where.agentId = query.agentId

    const [coupons, total] = await this.couponRepo.findAndCount({
      where,
      relations: ['attribution', 'attribution.agent'],
      order: { claimedAt: 'DESC' },
      take: 50,
    })

    const now = new Date()
    const items: AttributionChainDto[] = coupons.map((cc) => {
      const attr = cc.attribution
      const lockExpiredAt = attr?.lockExpiredAt ? new Date(attr.lockExpiredAt) : null
      const lockDaysRemaining = lockExpiredAt
        ? Math.max(0, Math.ceil((lockExpiredAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
        : 0
      return {
        agentNickname: cc.agentId ? (attr?.agent?.nickname ?? '未知') : '自然流量',
        platform: attr?.sourcePlatform ?? cc.source ?? 'unknown',
        customerId: cc.customerId,
        campaignName: cc.couponName ?? '未知活动',
        claimedAt: cc.claimedAt,
        redeemedAt: cc.usedAt,
        commissionAmount: cc.redemptionId ? Number(cc.discountAmount ?? 0) : undefined,
        lockDaysRemaining,
      }
    })

    return { items, total }
  }

  // ========================
  // 周期对比
  // ========================

  /**
   * 环比对比：当前周期 vs 上一周期
   */
  async getPeriodComparison(
    merchantId: string,
    startDate: string,
    endDate: string,
    periodType: 'daily' | 'weekly' | 'monthly' = 'weekly',
  ): Promise<PeriodComparisonDto> {
    const current = await this.computePeriodStats(merchantId, startDate, endDate)
    const previous = this.getPreviousPeriod(startDate, endDate, periodType)
    const prevStats = await this.computePeriodStats(merchantId, previous.start, previous.end)

    const pct = (curr: number, prev: number) =>
      prev === 0 ? 0 : Math.round(((curr - prev) / prev) * 100)

    return {
      current: {
        period: `${startDate} ~ ${endDate}`,
        ...current,
      },
      previous: {
        period: `${previous.start} ~ ${previous.end}`,
        ...prevStats,
      },
      changes: {
        impressions: pct(current.impressions, prevStats.impressions),
        clicks: pct(current.clicks, prevStats.clicks),
        claims: pct(current.claims, prevStats.claims),
        redemptions: pct(current.redemptions, prevStats.redemptions),
        commission: pct(current.commission, prevStats.commission),
        roi: this.roundMoney(current.roi - prevStats.roi),
      },
    }
  }

  // ========================
  // ROI
  // ========================

  /**
   * ROI 计算：佣金支出 vs 新客户价值
   */
  async getROI(merchantId: string, query: AnalyticsQueryDto): Promise<ROIDataDto> {
    const start = query.startDate ? new Date(query.startDate) : undefined
    const end = query.endDate ? new Date(query.endDate) : undefined
    const campaignIds = await this.getCampaignIds(merchantId, query.campaignId)

    const redemptionWhere: any = { merchantId, status: RedemptionStatus.VERIFIED }
    if (start && end) redemptionWhere.createdAt = Between(start, end)
    else if (start) redemptionWhere.createdAt = MoreThanOrEqual(start)
    else if (end) redemptionWhere.createdAt = LessThanOrEqual(end)
    if (campaignIds.length > 0) redemptionWhere.campaignId = In(campaignIds)

    const redemptions = await this.redemptionRepo.find({ where: redemptionWhere })

    const totalRedemptions = redemptions.length
    const totalTransactionAmount = redemptions.reduce(
      (sum, r) => sum + Number(r.transactionAmount),
      0,
    )
    const totalCommissionSpent = redemptions.reduce(
      (sum, r) => sum + Number(r.agentRewardAmount),
      0,
    )

    // 新客户（有归属记录的客户）
    const attrWhere: any = {}
    if (start && end) attrWhere.lockStartedAt = Between(start, end)
    else if (start) attrWhere.lockStartedAt = MoreThanOrEqual(start)
    else if (end) attrWhere.lockStartedAt = LessThanOrEqual(end)
    if (campaignIds.length > 0) attrWhere.campaignId = In(campaignIds)
    const newCustomers = await this.attributionRepo.count({ where: attrWhere })

    // 复购客户
    const customerCounts = new Map<string, number>()
    for (const r of redemptions) {
      customerCounts.set(r.customerId, (customerCounts.get(r.customerId) ?? 0) + 1)
    }
    const repurchaseCustomers = Array.from(customerCounts.values()).filter((c) => c > 1).length

    const roi =
      totalCommissionSpent > 0 ? this.roundMoney(totalTransactionAmount / totalCommissionSpent) : 0

    return {
      totalCommissionSpent: this.roundMoney(totalCommissionSpent),
      totalRedemptions,
      newCustomers,
      repurchaseCustomers,
      totalTransactionAmount: this.roundMoney(totalTransactionAmount),
      avgCommissionPerOrder:
        totalRedemptions > 0 ? this.roundMoney(totalCommissionSpent / totalRedemptions) : 0,
      avgCommissionPerCustomer:
        newCustomers > 0 ? this.roundMoney(totalCommissionSpent / newCustomers) : 0,
      repurchaseRate:
        newCustomers > 0 ? this.roundMoney((repurchaseCustomers / newCustomers) * 100) : 0,
      roi,
    }
  }

  // ========================
  // 时序图表
  // ========================

  /**
   * 时序数据：日报/周报/月报
   */
  async getTimeSeries(
    merchantId: string,
    startDate: string,
    endDate: string,
    groupBy: 'daily' | 'weekly' | 'monthly' = 'daily',
  ): Promise<TimeSeriesPointDto[]> {
    const start = new Date(startDate)
    const end = new Date(endDate)
    const dates = this.generateDateRange(start, end, groupBy)

    const [redemptions, claims, clicks] = await Promise.all([
      this.redemptionRepo
        .createQueryBuilder('r')
        .select(["TO_CHAR(r.created_at, 'YYYY-MM-DD')", 'date'])
        .addSelect('COUNT(*)', 'count')
        .addSelect('SUM(r.transaction_amount)', 'transaction')
        .addSelect('SUM(r.agent_reward_amount)', 'commission')
        .where('r.merchant_id = :merchantId', { merchantId })
        .andWhere('r.status = :status', { status: RedemptionStatus.VERIFIED })
        .andWhere('r.created_at BETWEEN :start AND :end', { start, end })
        .groupBy("TO_CHAR(r.created_at, 'YYYY-MM-DD')")
        .getRawMany(),
      this.couponRepo
        .createQueryBuilder('c')
        .select(["TO_CHAR(c.claimed_at, 'YYYY-MM-DD')", 'date'])
        .addSelect('COUNT(*)', 'count')
        .where('c.merchant_id = :merchantId', { merchantId })
        .andWhere('c.claimed_at BETWEEN :start AND :end', { start, end })
        .groupBy("TO_CHAR(c.claimed_at, 'YYYY-MM-DD')")
        .getRawMany(),
      this.attributionRepo
        .createQueryBuilder('a')
        .select(["TO_CHAR(a.lock_started_at, 'YYYY-MM-DD')", 'date'])
        .addSelect('COUNT(*)', 'count')
        .where('a.merchant_id = :merchantId', { merchantId })
        .andWhere('a.lock_started_at BETWEEN :start AND :end', { start, end })
        .groupBy("TO_CHAR(a.lock_started_at, 'YYYY-MM-DD')")
        .getRawMany(),
    ])

    const rMap = new Map(redemptions.map((r) => [r.date, r]))
    const cMap = new Map(claims.map((c) => [c.date, c]))
    const clMap = new Map(clicks.map((c) => [c.date, c]))

    return dates.map((date) => {
      const key = date.toISOString().split('T')[0]
      const r = rMap.get(key)
      const c = cMap.get(key)
      const cl = clMap.get(key)
      return {
        date: key,
        impressions: cl ? parseInt(cl.count, 10) : 0,
        clicks: cl ? parseInt(cl.count, 10) : 0,
        claims: c ? parseInt(c.count, 10) : 0,
        redemptions: r ? parseInt(r.count, 10) : 0,
        commission: r ? this.roundMoney(Number(r.commission)) : 0,
        transactionAmount: r ? this.roundMoney(Number(r.transaction)) : 0,
      }
    })
  }

  // ========================
  // 分享员排行榜
  // ========================

  /**
   * 分享员贡献排行榜
   */
  async getAgentLeaderboard(merchantId: string, query: AnalyticsQueryDto, limit = 20) {
    const campaignIds = await this.getCampaignIds(merchantId, query.campaignId)

    const attrWhere: any = {}
    if (query.startDate) attrWhere.lockStartedAt = MoreThanOrEqual(new Date(query.startDate))
    if (query.endDate) attrWhere.lockStartedAt = LessThanOrEqual(new Date(query.endDate))
    if (query.agentId) attrWhere.agentId = query.agentId
    if (campaignIds.length > 0) attrWhere.campaignId = In(campaignIds)

    const attrs = await this.attributionRepo.find({
      where: attrWhere,
      relations: ['agent'],
      order: { totalCommission: 'DESC', totalRedemptions: 'DESC' },
      take: limit,
    })

    return attrs.map((a, idx) => ({
      agentId: a.agentId,
      nickname: a.agent?.nickname ?? '未知',
      customerCount: a.totalRedemptions + 1,
      redemptionCount: a.totalRedemptions,
      commissionSpent: Number(a.totalCommission),
      rank: idx + 1,
    }))
  }

  // ========================
  // 私有工具
  // ========================

  private async getCampaignIds(merchantId: string, campaignId?: string): Promise<string[]> {
    if (campaignId) return [campaignId]
    const campaigns = await this.campaignRepo.find({
      where: { merchantId },
      select: ['id'],
    })
    return campaigns.map((c) => c.id)
  }

  private async computePeriodStats(merchantId: string, startDate: string, endDate: string) {
    const start = new Date(startDate)
    const end = new Date(endDate)

    const impressions = await this.attributionRepo.count({
      where: { lockStartedAt: Between(start, end) },
    })
    const claims = await this.couponRepo.count({
      where: { claimedAt: Between(start, end) },
    })
    const redemptions = await this.redemptionRepo.count({
      where: {
        merchantId,
        status: RedemptionStatus.VERIFIED,
        createdAt: Between(start, end),
      },
    })

    const commissionTotal = await this.commissionRepo
      .createQueryBuilder('c')
      .select('COALESCE(SUM(c.agent_final_payout), 0)', 'total')
      .where('c.merchant_id = :merchantId', { merchantId })
      .andWhere('c.status IN (:...statuses)', { statuses: ['pending', 'settled'] })
      .andWhere('c.created_at BETWEEN :start AND :end', { start, end })
      .getRawOne()

    const transactionTotal = await this.redemptionRepo
      .createQueryBuilder('r')
      .select('COALESCE(SUM(r.transaction_amount), 0)', 'total')
      .where('r.merchant_id = :merchantId', { merchantId })
      .andWhere('r.status = :status', { status: RedemptionStatus.VERIFIED })
      .andWhere('r.created_at BETWEEN :start AND :end', { start, end })
      .getRawOne()

    const commission = Number(commissionTotal?.total ?? 0)
    const transaction = Number(transactionTotal?.total ?? 0)
    const roi = commission > 0 ? this.roundMoney(transaction / commission) : 0

    return {
      impressions,
      clicks: impressions,
      claims,
      redemptions,
      commission: this.roundMoney(commission),
      roi,
    }
  }

  private getPreviousPeriod(
    startDate: string,
    endDate: string,
    periodType: 'daily' | 'weekly' | 'monthly',
  ): { start: string; end: string } {
    const start = new Date(startDate)
    const end = new Date(endDate)
    const diff = end.getTime() - start.getTime()

    const shift = (d: Date, ms: number) => new Date(d.getTime() - ms)
    const DAY = 24 * 60 * 60 * 1000

    let prevStart: Date
    let prevEnd: Date

    if (periodType === 'daily') {
      prevStart = shift(start, diff + DAY)
      prevEnd = new Date(prevStart.getTime() + diff)
    } else if (periodType === 'weekly') {
      prevStart = shift(start, 7 * DAY)
      prevEnd = shift(end, 7 * DAY)
    } else {
      prevStart = new Date(start)
      prevStart.setMonth(prevStart.getMonth() - 1)
      prevEnd = new Date(end)
      prevEnd.setMonth(prevEnd.getMonth() - 1)
    }

    return {
      start: prevStart.toISOString().split('T')[0],
      end: prevEnd.toISOString().split('T')[0],
    }
  }

  private generateDateRange(
    start: Date,
    end: Date,
    groupBy: 'daily' | 'weekly' | 'monthly',
  ): Date[] {
    const dates: Date[] = []
    const current = new Date(start)

    while (current <= end) {
      dates.push(new Date(current))
      if (groupBy === 'daily') current.setDate(current.getDate() + 1)
      else if (groupBy === 'weekly') current.setDate(current.getDate() + 7)
      else current.setMonth(current.getMonth() + 1)
    }

    return dates
  }

  private roundMoney(amount: number): number {
    return Math.round(amount * 100) / 100
  }
}
