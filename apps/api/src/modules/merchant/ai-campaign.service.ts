// ============================================================
// AI auto - AI Campaign Service
// Natural language → AI parse → auto-create → auto-publish
// Orchestrates AIBridge + CampaignService
// ============================================================

import { Injectable, Logger } from '@nestjs/common'
import { AIBridgeService } from '../ai-bridge/ai-bridge.service'
import { CampaignService } from '../campaign/campaign.service'
import { CampaignType } from '@ai-auto/shared'
import {
  CreateAICampaignDto,
  CreateAICampaignResponseDto,
  AICampaignPlanDto,
} from './dto/ai-campaign.dto'

// 默认活动配置（AI 不可用时）
const DEFAULT_CONFIG = {
  thresholdAmount: 100,
  discountAmount: 20,
  agentRewardAmount: 5,
  totalStock: 1000,
  perCustomerLimit: 1,
  couponValidityDays: 30,
}

@Injectable()
export class AICampaignService {
  private readonly logger = new Logger(AICampaignService.name)

  constructor(
    private readonly aiBridge: AIBridgeService,
    private readonly campaignService: CampaignService,
  ) {}

  /**
   * AI 自然语言 → 自动创建并发布活动
   *
   * 流程：
   * 1. 调用 AI Agent 解析描述 → 结构化配置
   * 2. 解析 AI 返回的配置方案
   * 3. 创建活动（草稿）
   * 4. 创建优惠券
   * 5. 自动发布活动
   * 6. 返回结果
   */
  async createCampaignFromDescription(
    merchantId: string,
    dto: CreateAICampaignDto,
  ): Promise<CreateAICampaignResponseDto> {
    let plan: AICampaignPlanDto

    try {
      const aiResult = await this.aiBridge.configureCampaign({
        description: dto.description,
        merchant_id: merchantId,
        store_id: dto.storeId,
        language: 'zh-CN',
      })
      plan = this.parseAIResponse(aiResult)
    } catch (error) {
      this.logger.warn({
        event: 'ai_parse_failed',
        merchantId,
        error: error instanceof Error ? error.message : String(error),
        message: 'AI 解析失败，使用默认配置',
      })
      plan = this.buildDefaultPlan(dto.description)
    }

    // 合并商家自定义参数
    const merged = this.mergeWithOverrides(plan, dto)

    // 计算优惠券有效期
    const now = new Date()
    const validUntil = new Date(
      now.getTime() +
        (merged.couponValidityDays ?? DEFAULT_CONFIG.couponValidityDays) * 24 * 60 * 60 * 1000,
    )

    // 1. 创建活动
    const { campaignId } = await this.campaignService.createCampaign(merchantId, {
      campaignName: merged.campaignName ?? dto.campaignName ?? plan.title ?? 'AI智能活动',
      campaignType: merged.campaignType ?? CampaignType.DISCOUNT,
      description: merged.description ?? dto.description,
      targetAudience: merged.targetAudience ?? 'all',
      startAt: merged.startAt,
      endAt: merged.endAt,
      maxBudget: dto.maxBudget ?? merged.estimatedBudget,
      storeId: dto.storeId,
    })

    // 2. 创建优惠券
    const { couponId, couponCode } = await this.campaignService.createCoupon(
      merchantId,
      campaignId,
      {
        couponName: plan.title ?? 'AI智能优惠券',
        discountAmount: merged.discountAmount ?? DEFAULT_CONFIG.discountAmount,
        thresholdAmount: merged.thresholdAmount ?? DEFAULT_CONFIG.thresholdAmount,
        cashRewardAmount: merged.cashRewardAmount,
        agentRewardAmount: merged.agentRewardAmount ?? DEFAULT_CONFIG.agentRewardAmount,
        validFrom: now.toISOString(),
        validUntil: validUntil.toISOString(),
        totalStock: merged.totalStock ?? DEFAULT_CONFIG.totalStock,
        perCustomerLimit: merged.perCustomerLimit ?? DEFAULT_CONFIG.perCustomerLimit,
      },
    )

    // 3. 发布活动
    await this.campaignService.publishCampaign(merchantId, campaignId)

    this.logger.log({
      event: 'ai_campaign_created',
      merchantId,
      campaignId,
      couponId,
      planUsed: plan.title ?? 'default',
    })

    return {
      campaignId,
      couponId,
      couponCode,
      campaignName: merged.campaignName ?? dto.campaignName ?? plan.title ?? 'AI智能活动',
      campaignStatus: 'active',
      couponStatus: 'active',
      planSummary: plan,
    }
  }

  // ========================
  // AI 响应解析
  // ========================

  /**
   * 解析 AI 返回（支持多种格式）
   */
  private parseAIResponse(aiResult: any): AICampaignPlanDto {
    const raw = aiResult?.data ?? aiResult?.result ?? aiResult ?? {}

    // 纯文本 → 尝试解析 JSON
    if (typeof raw === 'string') {
      const parsed = this.parseTextResponse(raw)
      if (parsed) return parsed
      return this.buildDefaultPlan(raw)
    }

    // 对象
    if (typeof raw === 'object' && raw !== null) {
      return this.mapAIObject(raw)
    }

    return this.buildDefaultPlan('')
  }

  /**
   * 从对象中提取配置（支持 snake_case + camelCase）
   */
  private mapAIObject(raw: any): AICampaignPlanDto {
    const get = (snake: string, camel: string) =>
      raw[snake] !== undefined ? raw[snake] : raw[camel]

    return {
      planId: get('plan_id', 'planId') ?? get('id', 'id') ?? `plan-${Date.now()}`,
      title: get('title', 'title') ?? get('name', 'name') ?? 'AI智能活动',
      campaignType: this.normalizeCampaignType(get('campaign_type', 'campaignType')),
      campaignName: get('campaign_name', 'campaignName'),
      description: get('description', 'description'),
      targetAudience: get('target_audience', 'targetAudience'),
      startAt: get('start_at', 'startAt'),
      endAt: get('end_at', 'endAt'),
      discountAmount: get('discount_amount', 'discountAmount'),
      thresholdAmount: get('threshold_amount', 'thresholdAmount'),
      cashRewardAmount: get('cash_reward', 'cashRewardAmount'),
      agentRewardAmount: get('agent_reward', 'agentRewardAmount'),
      couponValidityDays: get('validity_days', 'couponValidityDays'),
      totalStock: get('total_stock', 'totalStock'),
      perCustomerLimit: get('per_customer_limit', 'perCustomerLimit'),
      estimatedBudget: get('estimated_budget', 'estimatedBudget'),
      explanation: get('explanation', 'explanation') ?? get('reason', 'reason') ?? '',
    }
  }

  /**
   * 解析纯文本中的 JSON 块
   */
  private parseTextResponse(text: string): AICampaignPlanDto | null {
    const jsonMatch =
      text.match(/```json\s*([\s\S]*?)\s*```/) ||
      text.match(/```\s*([\s\S]*?)\s*```/) ||
      text.match(/\{.+}/)
    if (jsonMatch) {
      try {
        return this.mapAIObject(JSON.parse(jsonMatch[0]))
      } catch {
        // JSON 解析失败
      }
    }
    return null
  }

  /**
   * 规范化活动类型
   */
  private normalizeCampaignType(raw: any): CampaignType {
    if (!raw) return CampaignType.DISCOUNT
    const s = String(raw).toLowerCase()
    if (s.includes('cash') || s.includes('返现') || s.includes('reward'))
      return CampaignType.CASH_REWARD
    if (s.includes('combo') || s.includes('组合') || s.includes('bundle') || s.includes('套餐'))
      return CampaignType.COMBO
    return CampaignType.DISCOUNT
  }

  /**
   * 合并商家自定义参数
   */
  private mergeWithOverrides(plan: AICampaignPlanDto, dto: CreateAICampaignDto): AICampaignPlanDto {
    return {
      ...plan,
      campaignName: dto.campaignName ?? plan.campaignName,
      estimatedBudget: dto.maxBudget ?? plan.estimatedBudget,
    }
  }

  /**
   * 构建默认配置（AI 不可用时，基于关键词）
   */
  private buildDefaultPlan(description: string): AICampaignPlanDto {
    const desc = description.toLowerCase()

    let campaignType = CampaignType.DISCOUNT
    let thresholdAmount = DEFAULT_CONFIG.thresholdAmount
    let discountAmount = DEFAULT_CONFIG.discountAmount

    if (desc.includes('返现') || desc.includes('现金')) {
      campaignType = CampaignType.CASH_REWARD
      discountAmount = 10
      thresholdAmount = 0
    } else if (desc.includes('组合') || desc.includes('套餐')) {
      campaignType = CampaignType.COMBO
    }

    // 识别满减金额（"满200" → 门槛200）
    const thresholdMatch = desc.match(/满(\d+)/)
    if (thresholdMatch) {
      thresholdAmount = parseInt(thresholdMatch[1], 10)
    }

    // 识别折扣百分比（"8折" → 折扣=门槛*0.2）
    const percentMatch = desc.match(/(\d+)折/)
    if (percentMatch) {
      const percent = parseInt(percentMatch[1], 10)
      discountAmount = Math.round((thresholdAmount * (10 - percent)) / 10)
    }

    // 识别纯金额折扣（"减50" → 面值50）
    const discountMatch = desc.match(/减(\d+)/)
    if (discountMatch && !percentMatch) {
      discountAmount = parseInt(discountMatch[1], 10)
    }

    return {
      planId: `default-${Date.now()}`,
      title: 'AI智能活动',
      campaignType,
      discountAmount,
      thresholdAmount,
      agentRewardAmount: Math.max(5, Math.round(discountAmount * 0.25)),
      couponValidityDays: DEFAULT_CONFIG.couponValidityDays,
      totalStock: DEFAULT_CONFIG.totalStock,
      perCustomerLimit: DEFAULT_CONFIG.perCustomerLimit,
      explanation: '基于描述关键词生成默认配置',
    }
  }
}
