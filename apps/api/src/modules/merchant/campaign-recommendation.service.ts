// ============================================================
// AI auto - Campaign idea recommendation service
// ============================================================

import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { CampaignType } from '@ai-auto/shared'

import { AIBridgeService } from '../ai-bridge/ai-bridge.service'
import { Campaign } from '../campaign/entities/campaign.entity'
import { Coupon } from '../campaign/entities/coupon.entity'
import { CampaignService } from '../campaign/campaign.service'
import { CustomerCoupon } from '../customer/entities/customer-coupon.entity'

type Holiday = { id: string; name: string; date: string; daysAway: number }
type CampaignIdea = {
  recommendationId: string
  title: string
  holiday: Holiday
  rationale: string
  expectedImpact: {
    expectedClaims: number
    expectedRedemptions: number
    expectedRevenue: number
    expectedRoi: number
    benchmark: string
  }
  campaign: {
    campaignName: string
    campaignType: CampaignType
    description: string
    targetAudience: string
    maxBudget: number
    coupon: {
      couponName: string
      discountAmount?: number
      thresholdAmount: number
      cashRewardAmount?: number
      agentRewardAmount: number
      totalStock: number
      validityDays: number
    }
  }
  source: 'ai' | 'rules'
}

const HOLIDAY_DATES = [
  { id: 'new-year', name: '元旦', month: 1, day: 1 },
  { id: 'valentine', name: '情人节', month: 2, day: 14 },
  { id: 'womens-day', name: '女神节', month: 3, day: 8 },
  { id: 'labour-day', name: '劳动节', month: 5, day: 1 },
  { id: 'national-day', name: '国庆节', month: 10, day: 1 },
  { id: 'double-eleven', name: '双十一', month: 11, day: 11 },
  { id: 'double-twelve', name: '双十二', month: 12, day: 12 },
]

// Lunar dates are deliberately maintained as dated records rather than guessed.
const LUNAR_HOLIDAYS = [
  { id: 'dragon-boat-2026', name: '端午节', date: '2026-06-19' },
  { id: 'qixi-2026', name: '七夕', date: '2026-08-19' },
  { id: 'mid-autumn-2026', name: '中秋节', date: '2026-09-25' },
  { id: 'spring-festival-2027', name: '春节', date: '2027-02-06' },
  { id: 'dragon-boat-2027', name: '端午节', date: '2027-06-09' },
  { id: 'qixi-2027', name: '七夕', date: '2027-08-08' },
  { id: 'mid-autumn-2027', name: '中秋节', date: '2027-09-15' },
]

@Injectable()
export class CampaignRecommendationService {
  private readonly logger = new Logger(CampaignRecommendationService.name)

  constructor(
    @InjectRepository(Campaign) private readonly campaignRepo: Repository<Campaign>,
    @InjectRepository(Coupon) private readonly couponRepo: Repository<Coupon>,
    @InjectRepository(CustomerCoupon)
    private readonly customerCouponRepo: Repository<CustomerCoupon>,
    private readonly campaignService: CampaignService,
    private readonly aiBridge: AIBridgeService,
  ) {}

  async list(merchantId: string, limit = 3) {
    const context = await this.buildContext(merchantId)
    const fallback = this.buildFallbackIdeas(context, limit)
    const aiIdeas = await this.getAiIdeas(merchantId, context, fallback)
    const ideas = aiIdeas.length ? aiIdeas.slice(0, limit) : fallback

    return {
      generatedAt: new Date().toISOString(),
      calendar: context.holidays,
      customerProfile: context.customerProfile,
      recommendations: ideas,
    }
  }

  async launch(merchantId: string, recommendationId: string) {
    // Rebuilding the recommendation makes launch stateless and prevents a caller
    // from altering the coupon amount or audience embedded in a recommendation.
    const context = await this.buildContext(merchantId)
    const ideas = this.buildFallbackIdeas(context, 6)
    const idea = ideas.find((item) => item.recommendationId === recommendationId)
    if (!idea)
      throw new NotFoundException({ code: 6201, message: '推荐不存在、已过期或不属于当前商户' })

    const now = new Date()
    const validUntil = new Date(
      now.getTime() + idea.campaign.coupon.validityDays * 24 * 60 * 60 * 1000,
    )
    const { campaignId } = await this.campaignService.createCampaign(merchantId, {
      campaignName: idea.campaign.campaignName,
      campaignType: idea.campaign.campaignType,
      description: idea.campaign.description,
      targetAudience: idea.campaign.targetAudience,
      maxBudget: idea.campaign.maxBudget,
    })
    const { couponId, couponCode } = await this.campaignService.createCoupon(
      merchantId,
      campaignId,
      {
        couponName: idea.campaign.coupon.couponName,
        discountAmount: idea.campaign.coupon.discountAmount,
        thresholdAmount: idea.campaign.coupon.thresholdAmount,
        cashRewardAmount: idea.campaign.coupon.cashRewardAmount,
        agentRewardAmount: idea.campaign.coupon.agentRewardAmount,
        validFrom: now.toISOString(),
        validUntil: validUntil.toISOString(),
        totalStock: idea.campaign.coupon.totalStock,
        perCustomerLimit: 1,
      },
    )
    await this.campaignService.publishCampaign(merchantId, campaignId)

    this.logger.log({
      event: 'ai_campaign_recommendation_launched',
      merchantId,
      recommendationId,
      campaignId,
    })
    return { campaignId, couponId, couponCode, campaignStatus: 'active', recommendationId }
  }

  private async buildContext(merchantId: string) {
    const [campaigns, coupons, customerCoupons] = await Promise.all([
      this.campaignRepo.find({ where: { merchantId }, order: { createdAt: 'DESC' }, take: 100 }),
      this.couponRepo.find({ where: { merchantId }, order: { createdAt: 'DESC' }, take: 200 }),
      this.customerCouponRepo.find({ where: { merchantId }, relations: ['customer'], take: 500 }),
    ])
    const holidays = this.getUpcomingHolidays()
    const history = this.summarizeHistory(campaigns, coupons)
    const customerProfile = this.summarizeCustomers(customerCoupons, history.preferredCampaignType)
    const peerCampaigns = await this.campaignRepo.find({
      where: { campaignType: history.preferredCampaignType },
      order: { createdAt: 'DESC' },
      take: 500,
    })
    return { holidays, history, customerProfile, peerBenchmark: this.peerBenchmark(peerCampaigns) }
  }

  private getUpcomingHolidays(): Holiday[] {
    const now = new Date()
    const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
    const dates = [...LUNAR_HOLIDAYS]
    for (const year of [now.getUTCFullYear(), now.getUTCFullYear() + 1]) {
      for (const holiday of HOLIDAY_DATES) {
        dates.push({
          id: `${holiday.id}-${year}`,
          name: holiday.name,
          date: `${year}-${String(holiday.month).padStart(2, '0')}-${String(holiday.day).padStart(2, '0')}`,
        })
      }
    }
    return dates
      .map((holiday) => ({
        ...holiday,
        daysAway: Math.ceil((Date.parse(`${holiday.date}T00:00:00Z`) - today) / 86_400_000),
      }))
      .filter((holiday) => holiday.daysAway >= 0 && holiday.daysAway <= 180)
      .sort((a, b) => a.daysAway - b.daysAway)
      .slice(0, 6)
  }

  private summarizeHistory(campaigns: Campaign[], coupons: Coupon[]) {
    const completed = campaigns.filter((campaign) => campaign.campaignStatus !== 'draft')
    const totalClaims = completed.reduce(
      (sum, campaign) => sum + Number(campaign.totalClaims ?? 0),
      0,
    )
    const totalRedemptions = completed.reduce(
      (sum, campaign) => sum + Number(campaign.totalRedemptions ?? 0),
      0,
    )
    const successful = [...completed].sort(
      (a, b) => this.redemptionRate(b) - this.redemptionRate(a),
    )[0]
    const preferredCampaignType =
      successful?.campaignType ?? coupons[0]?.couponType ?? CampaignType.DISCOUNT
    return {
      campaignCount: completed.length,
      totalClaims,
      totalRedemptions,
      redemptionRate: this.percent(totalRedemptions, totalClaims),
      preferredCampaignType,
      bestCampaignName: successful?.campaignName ?? null,
      bestRedemptionRate: successful ? this.redemptionRate(successful) : 0,
    }
  }

  private summarizeCustomers(
    customerCoupons: CustomerCoupon[],
    preferredCampaignType: CampaignType,
  ) {
    const uniqueCustomers = new Map(
      customerCoupons.map((coupon) => [coupon.customerId, coupon.customer]),
    )
    const customers = [...uniqueCustomers.values()].filter(Boolean)
    const returning = customers.filter(
      (customer: any) => Number(customer.totalRedemptions) > 1,
    ).length
    const total = uniqueCustomers.size
    const returningRate = this.percent(returning, total)
    return {
      totalCustomers: total,
      returningCustomerRate: returningRate,
      newCustomerRate: total ? 100 - returningRate : 100,
      preferredCampaignType,
      insight: total
        ? `现有客户中 ${returningRate}% 为复购客，建议优先以${preferredCampaignType === CampaignType.CASH_REWARD ? '现金券' : '满减券'}触达。`
        : '尚无足够客户样本，先用新客首单优惠建立首批转化数据。',
    }
  }

  private peerBenchmark(campaigns: Campaign[]) {
    const rates = campaigns
      .filter((campaign) => Number(campaign.totalClaims) > 0)
      .map((campaign) => this.redemptionRate(campaign))
    const redemptionRate = rates.length
      ? this.round(rates.reduce((sum, rate) => sum + rate, 0) / rates.length)
      : 12
    return {
      sampleSize: rates.length,
      redemptionRate,
      description: rates.length ? '同类商户匿名活动聚合' : '平台同类活动基准估算',
    }
  }

  private buildFallbackIdeas(
    context: Awaited<ReturnType<CampaignRecommendationService['buildContext']>>,
    limit: number,
  ): CampaignIdea[] {
    const holidays = context.holidays.length
      ? context.holidays
      : [
          {
            id: 'always-on',
            name: '本月拉新',
            date: new Date().toISOString().slice(0, 10),
            daysAway: 0,
          },
        ]
    return holidays.slice(0, limit).map((holiday, index) => this.buildIdea(context, holiday, index))
  }

  private buildIdea(
    context: Awaited<ReturnType<CampaignRecommendationService['buildContext']>>,
    holiday: Holiday,
    index: number,
  ): CampaignIdea {
    const type = context.history.preferredCampaignType
    const cash = type === CampaignType.CASH_REWARD
    const threshold = cash ? 0 : 100
    const faceValue = cash ? 10 : 20
    const expectedClaims = Math.max(
      50,
      Math.round((context.history.totalClaims || 100) * (1.1 + index * 0.08)),
    )
    const expectedRedemptions = Math.round(
      (expectedClaims *
        Math.max(context.peerBenchmark.redemptionRate, context.history.redemptionRate || 12)) /
        100,
    )
    const budget = Math.max(1000, expectedClaims * faceValue)
    const expectedRevenue = expectedRedemptions * (cash ? 120 : 150)
    const expectedRoi = this.round((expectedRevenue - budget) / budget)
    const format = cash ? '现金券' : '满减券'
    const historicalReason = context.history.campaignCount
      ? `历史活动中「${context.history.bestCampaignName ?? '同类活动'}」表现最佳，核销率 ${context.history.bestRedemptionRate}%。`
      : '这是首轮拉新方案，先以可控库存验证客户偏好。'
    return {
      recommendationId: `holiday:${holiday.id}:${type}`,
      title: `${holiday.name}${cash ? '返现' : '满减'}拉新活动`,
      holiday,
      rationale: `距${holiday.name}${holiday.daysAway}天；${historicalReason} 客户画像显示${context.customerProfile.returningCustomerRate}%为复购客，推荐${format}。`,
      expectedImpact: {
        expectedClaims,
        expectedRedemptions,
        expectedRevenue,
        expectedRoi,
        benchmark: `${context.peerBenchmark.description}：同类活动平均核销率 ${context.peerBenchmark.redemptionRate}%`,
      },
      campaign: {
        campaignName: `${holiday.name}${cash ? '返现' : '满减'}活动`,
        campaignType: type,
        description: `AI 推荐：围绕${holiday.name}进行限时${format}促销。`,
        targetAudience: context.customerProfile.returningCustomerRate >= 50 ? 'returning' : 'new',
        maxBudget: budget,
        coupon: {
          couponName: `${holiday.name}${cash ? '返现券' : '满减券'}`,
          ...(cash ? { cashRewardAmount: faceValue } : { discountAmount: faceValue }),
          thresholdAmount: threshold,
          agentRewardAmount: Math.max(5, Math.round(faceValue * 0.25)),
          totalStock: expectedClaims,
          validityDays: Math.max(7, Math.min(30, holiday.daysAway || 7)),
        },
      },
      source: 'rules',
    }
  }

  private async getAiIdeas(
    merchantId: string,
    context: Awaited<ReturnType<CampaignRecommendationService['buildContext']>>,
    fallback: CampaignIdea[],
  ) {
    try {
      const result = await this.aiBridge.recommendCampaigns({
        merchant_id: merchantId,
        holidays: context.holidays.map(({ id, name, date, daysAway }) => ({
          id,
          name,
          date,
          days_away: daysAway,
        })),
        history: context.history,
        customer_profile: context.customerProfile,
        peer_benchmark: context.peerBenchmark,
      })
      return Array.isArray(result?.recommendations)
        ? (result.recommendations
            .map((item: any, index: number) => this.mergeAiIdea(item, fallback[index]))
            .filter(Boolean) as CampaignIdea[])
        : []
    } catch (error) {
      this.logger.warn({
        event: 'campaign_recommendation_ai_unavailable',
        merchantId,
        error: error instanceof Error ? error.message : String(error),
      })
      return []
    }
  }

  private mergeAiIdea(item: any, fallback?: CampaignIdea): CampaignIdea | null {
    if (!fallback || !item || typeof item !== 'object') return null
    // The immutable launch configuration remains server-generated; AI may improve
    // copy and explanatory fields only.
    return {
      ...fallback,
      title:
        typeof item.title === 'string' && item.title.trim()
          ? item.title.slice(0, 200)
          : fallback.title,
      rationale:
        typeof item.rationale === 'string' && item.rationale.trim()
          ? item.rationale.slice(0, 1000)
          : fallback.rationale,
      expectedImpact: {
        ...fallback.expectedImpact,
        benchmark:
          typeof item.benchmark === 'string'
            ? item.benchmark.slice(0, 500)
            : fallback.expectedImpact.benchmark,
      },
      source: 'ai',
    }
  }

  private redemptionRate(campaign: Campaign) {
    return this.percent(Number(campaign.totalRedemptions), Number(campaign.totalClaims))
  }
  private percent(value: number, total: number) {
    return total > 0 ? this.round((value / total) * 100) : 0
  }
  private round(value: number) {
    return Math.round(value * 100) / 100
  }
}
