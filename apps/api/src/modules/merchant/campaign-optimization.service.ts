import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { In, Repository } from 'typeorm'
import { CouponStatus } from '@ai-auto/shared'

import { AIBridgeService } from '../ai-bridge/ai-bridge.service'
import { Campaign } from '../campaign/entities/campaign.entity'
import { Coupon } from '../campaign/entities/coupon.entity'
import { CampaignOptimization } from './entities/campaign-optimization.entity'
import { MerchantOptimizationSetting } from './entities/merchant-optimization-setting.entity'
import { UpdateOptimizationSettingDto } from './dto/campaign-optimization.dto'

type Adjustment = CampaignOptimization['adjustments'][number]

@Injectable()
export class CampaignOptimizationService {
  private readonly logger = new Logger(CampaignOptimizationService.name)

  constructor(
    @InjectRepository(Campaign) private readonly campaignRepo: Repository<Campaign>,
    @InjectRepository(Coupon) private readonly couponRepo: Repository<Coupon>,
    @InjectRepository(CampaignOptimization)
    private readonly optimizationRepo: Repository<CampaignOptimization>,
    @InjectRepository(MerchantOptimizationSetting)
    private readonly settingRepo: Repository<MerchantOptimizationSetting>,
    private readonly aiBridge: AIBridgeService,
  ) {}

  async analyze(merchantId: string, campaignId: string) {
    const campaign = await this.findCampaign(merchantId, campaignId)
    const setting = await this.getSetting(merchantId)
    const coupons = await this.couponRepo.find({
      where: { campaignId, merchantId, status: CouponStatus.ACTIVE },
    })
    const metrics = this.buildMetrics(campaign)
    const deterministic = this.buildRecommendations(
      campaign,
      coupons,
      metrics,
      setting.maxBudgetChangePercent,
    )
    const ai = await this.getAiRecommendations(campaignId, metrics)
    const recommendations = ai.length
      ? [...deterministic.recommendations, ...ai]
      : deterministic.recommendations

    const optimization = await this.optimizationRepo.save(
      this.optimizationRepo.create({
        merchantId,
        campaignId,
        status: 'pending',
        metrics,
        recommendations,
        adjustments: deterministic.adjustments,
        predictedImprovement: deterministic.predictedImprovement,
        autoApplied: false,
      }),
    )

    if (setting.autoAdjustEnabled && optimization.adjustments.length) {
      await this.apply(merchantId, optimization.id, true)
    }
    return this.getById(merchantId, optimization.id)
  }

  async list(merchantId: string, campaignId?: string) {
    const where = campaignId ? { merchantId, campaignId } : { merchantId }
    return this.optimizationRepo.find({ where, order: { createdAt: 'DESC' }, take: 50 })
  }

  async getById(merchantId: string, optimizationId: string) {
    const optimization = await this.optimizationRepo.findOne({
      where: { id: optimizationId, merchantId },
    })
    if (!optimization) throw new NotFoundException({ code: 6101, message: '优化建议不存在' })
    return optimization
  }

  async apply(merchantId: string, optimizationId: string, approve: boolean) {
    const optimization = await this.getById(merchantId, optimizationId)
    if (optimization.status !== 'pending') return optimization
    if (!approve) {
      optimization.status = 'rejected'
      return this.optimizationRepo.save(optimization)
    }

    const campaign = await this.findCampaign(merchantId, optimization.campaignId)
    for (const adjustment of optimization.adjustments) {
      if (adjustment.type === 'budget') {
        campaign.maxBudget = Number(adjustment.value)
      }
      if (adjustment.type === 'target_audience') {
        campaign.targetAudience = String(adjustment.value)
      }
      if (adjustment.type === 'coupon_discount' && adjustment.couponId) {
        await this.couponRepo.update(
          { id: adjustment.couponId, campaignId: campaign.id, merchantId },
          { discountAmount: Number(adjustment.value) },
        )
      }
    }
    await this.campaignRepo.save(campaign)
    optimization.status = 'applied'
    optimization.autoApplied = (await this.getSetting(merchantId)).autoAdjustEnabled
    optimization.appliedAt = new Date()
    return this.optimizationRepo.save(optimization)
  }

  async getSetting(merchantId: string) {
    let setting = await this.settingRepo.findOne({ where: { merchantId } })
    if (!setting) setting = await this.settingRepo.save(this.settingRepo.create({ merchantId }))
    return setting
  }

  async updateSetting(merchantId: string, dto: UpdateOptimizationSettingDto) {
    const setting = await this.getSetting(merchantId)
    Object.assign(setting, dto)
    return this.settingRepo.save(setting)
  }

  async weeklyReport(merchantId: string) {
    const campaigns = await this.campaignRepo.find({
      where: { merchantId, campaignStatus: 'active' },
    })
    const rows = campaigns.map((campaign) => ({
      campaignId: campaign.id,
      campaignName: campaign.campaignName,
      ...this.buildMetrics(campaign),
    }))
    const needsAttention = rows.filter(
      (row) => row.clickRate < 1 || (row.claims >= 20 && row.redemptionRate < 10),
    )
    return {
      period: this.currentWeekPeriod(),
      campaigns: rows,
      insights: needsAttention.length
        ? `${needsAttention.length} 个活动低于转化阈值，建议查看待确认的 AI 优化方案。`
        : '本周活动转化表现稳定。',
      bestPublishTime: {
        wechat: '周二至周四 19:00-21:00',
        douyin: '每日 18:00-22:00',
        xiaohongshu: '周末 10:00-12:00',
      },
    }
  }

  private async findCampaign(merchantId: string, campaignId: string) {
    const campaign = await this.campaignRepo.findOne({ where: { id: campaignId, merchantId } })
    if (!campaign) throw new NotFoundException({ code: 6102, message: '活动不存在或无权操作' })
    return campaign
  }

  private buildMetrics(campaign: Campaign) {
    const impressions = Number(campaign.totalImpressions)
    const clicks = Number(campaign.totalClicks)
    const claims = Number(campaign.totalClaims)
    const redemptions = Number(campaign.totalRedemptions)
    const commissionSpent = Number(campaign.totalCommissionSpent)
    return {
      impressions,
      clicks,
      claims,
      redemptions,
      clickRate: this.percent(clicks, impressions),
      claimRate: this.percent(claims, clicks),
      redemptionRate: this.percent(redemptions, claims),
      costPerRedemption: redemptions ? this.round(commissionSpent / redemptions) : 0,
      budgetUtilization: this.percent(Number(campaign.spentBudget), Number(campaign.maxBudget)),
    }
  }

  private buildRecommendations(
    campaign: Campaign,
    coupons: Coupon[],
    metrics: Record<string, number>,
    maxChange: number,
  ) {
    const recommendations: CampaignOptimization['recommendations'] = []
    const adjustments: Adjustment[] = []
    let predictedImprovement = 0
    if (metrics.impressions === 0) {
      recommendations.push({
        title: '活动尚无曝光',
        detail: '建议先在推荐发布时间发布内容，并检查活动是否已开启。',
        priority: 'high',
      })
    }
    if (metrics.impressions >= 100 && metrics.clickRate < 1) {
      recommendations.push({
        title: '点击率偏低',
        detail: '建议更换首图和文案，突出优惠金额与使用场景。',
        priority: 'high',
      })
      predictedImprovement += 15
    }
    if (metrics.claims >= 20 && metrics.redemptionRate < 10 && coupons[0]?.discountAmount) {
      const current = Number(coupons[0].discountAmount)
      const next = this.round(current * (1 + Math.min(maxChange, 10) / 100))
      recommendations.push({
        title: '核销率偏低',
        detail: `建议将券面额从 ¥${current} 调整至 ¥${next}，降低用户到店决策门槛。`,
        priority: 'high',
      })
      adjustments.push({
        type: 'coupon_discount',
        couponId: coupons[0].id,
        value: next,
        reason: '核销率低于 10%',
      })
      predictedImprovement += 12
    }
    if (metrics.budgetUtilization < 30 && Number(campaign.maxBudget) > 0) {
      const next = this.round(Number(campaign.maxBudget) * (1 - Math.min(maxChange, 20) / 100))
      recommendations.push({
        title: '预算使用偏慢',
        detail: '建议下调当前活动预算上限，并将余量转投至转化更好的活动。',
        priority: 'medium',
      })
      adjustments.push({ type: 'budget', value: next, reason: '预算使用率低于 30%' })
      predictedImprovement += 5
    }
    if (campaign.targetAudience === 'all' && metrics.claimRate < 10) {
      recommendations.push({
        title: '人群定位可收敛',
        detail: '建议优先触达新客，先验证首单优惠的转化效果。',
        priority: 'medium',
      })
      adjustments.push({ type: 'target_audience', value: 'new', reason: '领取率低于 10%' })
      predictedImprovement += 8
    }
    if (!recommendations.length)
      recommendations.push({
        title: '表现稳定',
        detail: '当前活动未发现需要立即调整的指标，建议按推荐时间持续发布内容。',
        priority: 'low',
      })
    return { recommendations, adjustments, predictedImprovement }
  }

  private async getAiRecommendations(campaignId: string, metrics: Record<string, number>) {
    try {
      const result = await this.aiBridge.optimizeCampaign({
        campaign_id: campaignId,
        current_metrics: metrics,
      })
      return Array.isArray(result?.recommendations)
        ? result.recommendations
            .slice(0, 3)
            .map((item: any) => ({
              title: String(item.title ?? 'AI 洞察'),
              detail: String(item.detail ?? item.reason ?? item),
              priority:
                item.priority === 'high' || item.priority === 'medium'
                  ? item.priority
                  : ('low' as const),
            }))
        : []
    } catch (error) {
      this.logger.warn({
        event: 'campaign_optimization_ai_unavailable',
        campaignId,
        error: error instanceof Error ? error.message : String(error),
      })
      return []
    }
  }

  private percent(value: number, total: number) {
    return total > 0 ? this.round((value / total) * 100) : 0
  }
  private round(value: number) {
    return Math.round(value * 100) / 100
  }
  private currentWeekPeriod() {
    const end = new Date()
    const start = new Date(end)
    start.setDate(end.getDate() - 6)
    return { startAt: start.toISOString(), endAt: end.toISOString() }
  }
}
