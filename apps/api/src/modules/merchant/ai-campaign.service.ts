// ============================================================
// AI auto - AI Campaign Service
// Natural language → AI parse → reviewable campaign draft
// Orchestrates AIBridge + CampaignService
// ============================================================

import {
  BadGatewayException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common'
import { AIBridgeService } from '../ai-bridge/ai-bridge.service'
import { CampaignService } from '../campaign/campaign.service'
import { CampaignType } from '@ai-auto/shared'
import {
  CreateAICampaignDto,
  CreateAICampaignResponseDto,
  AICampaignPreviewResponseDto,
  AICampaignPlanDto,
  GenerateAIMarketingProductDto,
  GenerateAIMarketingProductResponseDto,
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

  /** Return AI-generated activity and coupon options without writing data. */
  async previewCampaign(
    merchantId: string,
    dto: CreateAICampaignDto,
  ): Promise<AICampaignPreviewResponseDto> {
    try {
      const response = await this.aiBridge.configureCampaign({
        description: dto.description,
        merchant_id: merchantId,
        store_id: dto.storeId,
        language: 'zh-CN',
      })
      const options = this.parseAIOptions(response, dto.description)
      if (!options.length) throw new Error('AI did not return a usable campaign option')
      return {
        requestId: response?.request_id ?? `ai-preview-${Date.now()}`,
        description: dto.description,
        options,
        source: 'ai',
      }
    } catch (error) {
      this.logger.warn({
        event: 'ai_campaign_preview_fallback',
        merchantId,
        error: error instanceof Error ? error.message : String(error),
      })
      return {
        requestId: `fallback-${Date.now()}`,
        description: dto.description,
        options: [1, 2, 3].map((optionId) => this.buildDefaultPlan(dto.description, optionId)),
        source: 'fallback',
      }
    }
  }

  /** Create a campaign draft from the confirmed AI option. */
  async createCampaignFromDescription(
    merchantId: string,
    dto: CreateAICampaignDto,
  ): Promise<CreateAICampaignResponseDto> {
    let plan: AICampaignPlanDto

    try {
      if (dto.selectedOption) {
        plan = this.mapAIObject(dto.selectedOption, 1, false, dto.description)
      } else {
        const aiResult = await this.aiBridge.configureCampaign({
          description: dto.description,
          merchant_id: merchantId,
          store_id: dto.storeId,
          language: 'zh-CN',
        })
        plan =
          this.parseAIOptions(aiResult, dto.description)[0] ??
          this.buildDefaultPlan(dto.description)
      }
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
    const taskType = merged.taskType ?? this.inferTaskType(dto.description)

    // 计算优惠券有效期
    const now = new Date()
    const validFrom = this.validDate(merged.startAt) ?? now
    const validUntil =
      this.validDate(merged.endAt) ??
      new Date(
        validFrom.getTime() +
          (merged.couponValidityDays ?? DEFAULT_CONFIG.couponValidityDays) * 24 * 60 * 60 * 1000,
      )

    // 1. 创建活动
    const { campaignId } = await this.campaignService.createCampaign(merchantId, {
      campaignName: merged.campaignName ?? dto.campaignName ?? plan.title ?? 'AI智能活动',
      campaignType: merged.campaignType ?? CampaignType.DISCOUNT,
      purpose: taskType,
      description: merged.description ?? dto.description,
      targetAudience: merged.targetAudience ?? 'all',
      startAt: merged.startAt,
      endAt: merged.endAt,
      maxBudget: dto.maxBudget ?? merged.estimatedBudget,
      storeId: dto.storeId,
    })

    // 2. Every campaign receives a consumer conversion coupon. For creator
    // tasks it is not an attached content file: content uses a task-specific
    // link to the campaign-level coupon and the customer later sees it in the
    // coupon pack.
    let couponId: string | null = null
    let couponCode: string | undefined
    let couponStatus: string | null = null
    {
      const coupon = await this.campaignService.createCoupon(merchantId, campaignId, {
        couponName: plan.title ?? 'AI智能优惠券',
        discountAmount: merged.offerPrice ?? merged.discountAmount ?? DEFAULT_CONFIG.discountAmount,
        thresholdAmount: merged.thresholdAmount ?? DEFAULT_CONFIG.thresholdAmount,
        cashRewardAmount: merged.cashRewardAmount,
        agentRewardAmount: merged.agentRewardAmount ?? DEFAULT_CONFIG.agentRewardAmount,
        validFrom: validFrom.toISOString(),
        validUntil: validUntil.toISOString(),
        totalStock: merged.totalStock ?? DEFAULT_CONFIG.totalStock,
        perCustomerLimit: merged.perCustomerLimit ?? DEFAULT_CONFIG.perCustomerLimit,
      })
      couponId = coupon.couponId
      couponCode = coupon.couponCode
      couponStatus = 'active'
    }

    // New dashboard flows pass false so publishing remains a separately measured action.
    // Keep the historical default for API clients that do not send the new flag.
    const autoPublish = dto.autoPublish ?? taskType === 'customer_campaign'
    if (autoPublish) await this.campaignService.publishCampaign(merchantId, campaignId)

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
      campaignStatus: autoPublish ? 'active' : 'draft',
      couponStatus,
      taskType,
      planSummary: plan,
    }
  }

  async generateMarketingProduct(
    merchantId: string,
    dto: GenerateAIMarketingProductDto,
  ): Promise<GenerateAIMarketingProductResponseDto> {
    try {
      const result = await this.aiBridge.generateMarketingProduct({
        merchant_id: merchantId,
        prompt: dto.prompt,
        category: dto.category,
      })
      const raw = result?.product ?? result?.data?.product ?? result?.data ?? result
      const product = this.normalizeMarketingProduct(raw)
      return {
        requestId: result?.request_id ?? `ai-product-${Date.now()}`,
        product,
        usage: result?.usage ?? {},
      }
    } catch (error) {
      this.logger.warn({
        event: 'ai_marketing_product_failed',
        merchantId,
        error: error instanceof Error ? error.message : String(error),
      })
      if (error instanceof BadGatewayException) throw error
      throw new ServiceUnavailableException('AI 商品生成暂不可用，请稍后重试')
    }
  }

  // ========================
  // AI 响应解析
  // ========================

  /**
   * 解析 AI 返回（支持多种格式）
   */
  private parseAIResponse(aiResult: any): AICampaignPlanDto {
    const raw = this.unwrapAIResult(aiResult)

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

  private parseAIOptions(aiResult: any, description = ''): AICampaignPlanDto[] {
    const raw = this.unwrapAIResult(aiResult)
    if (typeof raw === 'string') {
      const parsed = this.parseTextResponse(raw, description)
      return parsed ? [parsed] : []
    }
    if (!raw || typeof raw !== 'object') return []
    const object = raw as Record<string, unknown>
    const parsedIntent = object.parsed_intent as Record<string, unknown> | undefined
    const fallbackTaskType = object.task_type ?? parsedIntent?.task_type
    if (Array.isArray(object.options)) {
      return object.options.slice(0, 3).map((option: unknown, index: number) =>
        this.mapAIObject(
          {
            ...(option && typeof option === 'object' ? option : {}),
            task_type: (option as Record<string, unknown> | null)?.task_type ?? fallbackTaskType,
          },
          index + 1,
          true,
          description,
        ),
      )
    }
    return [this.mapAIObject(raw, 1, false, description)]
  }

  private unwrapAIResult(aiResult: any): unknown {
    return aiResult?.data ?? aiResult?.result ?? aiResult ?? {}
  }

  /**
   * 从对象中提取配置（支持 snake_case + camelCase）
   */
  private mapAIObject(
    raw: any,
    index = 1,
    optionMode = false,
    description = '',
  ): AICampaignPlanDto {
    const source = raw && typeof raw === 'object' ? raw : {}
    const get = (snake: string, camel: string) =>
      source[snake] !== undefined ? source[snake] : source[camel]
    const campaignType = this.normalizeCampaignType(get('campaign_type', 'campaignType'))
    const typeLabel =
      campaignType === CampaignType.CASH_REWARD
        ? '返现'
        : campaignType === CampaignType.COMBO
          ? '组合套餐'
          : '满减'
    const defaultTitle = optionMode
      ? `${typeLabel}${['稳健', '均衡', '扩张'][index - 1] ?? '推荐'}方案`
      : 'AI智能活动'
    const taskType = this.normalizeTaskType(get('task_type', 'taskType'), description)
    const contentTypes = this.stringArray(get('content_types', 'contentTypes'))
    const channels = this.stringArray(get('channels', 'channels'))

    return {
      planId: get('plan_id', 'planId') ?? get('id', 'id') ?? `plan-${Date.now()}`,
      title: get('title', 'title') ?? get('name', 'name') ?? defaultTitle,
      taskType,
      campaignName: get('campaign_name', 'campaignName'),
      description: get('description', 'description'),
      targetAudience: get('target_audience', 'targetAudience'),
      startAt: get('start_at', 'startAt'),
      endAt: get('end_at', 'endAt'),
      campaignType,
      discountAmount: this.nonNegativeNumber(get('discount_amount', 'discountAmount')),
      offerPrice: this.nonNegativeNumber(
        get('offer_price', 'offerPrice') ??
          get('sale_price', 'salePrice') ??
          get('combo_price', 'comboPrice'),
      ),
      originalPrice: this.nonNegativeNumber(
        get('original_price', 'originalPrice') ?? get('market_price', 'marketPrice'),
      ),
      thresholdAmount: this.nonNegativeNumber(
        get('min_purchase', 'minPurchase') ?? get('threshold_amount', 'thresholdAmount'),
      ),
      cashRewardAmount: this.nonNegativeNumber(get('cash_reward', 'cashRewardAmount')),
      agentRewardAmount: this.nonNegativeNumber(get('agent_reward', 'agentRewardAmount')),
      couponValidityDays: this.positiveNumber(
        get('duration_days', 'durationDays') ?? get('validity_days', 'couponValidityDays'),
      ),
      totalStock: this.positiveNumber(get('total_stock', 'totalStock')),
      perCustomerLimit: this.nonNegativeNumber(get('per_customer_limit', 'perCustomerLimit')),
      estimatedBudget: this.nonNegativeNumber(
        get('budget', 'budget') ?? get('estimated_budget', 'estimatedBudget'),
      ),
      explanation: get('explanation', 'explanation') ?? get('reason', 'reason') ?? '',
      confidence: this.confidenceValue(get('confidence', 'confidence')),
      contentBrief: this.textValue(get('content_brief', 'contentBrief')) ?? undefined,
      contentTypes: contentTypes.length ? contentTypes : undefined,
      channels: channels.length ? channels : undefined,
      callToAction: this.textValue(get('call_to_action', 'callToAction')) ?? undefined,
    }
  }

  /**
   * 解析纯文本中的 JSON 块
   */
  private parseTextResponse(text: string, description = ''): AICampaignPlanDto | null {
    const fencedMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
    const objectMatch = text.match(/\{[\s\S]*\}/)
    const payload = fencedMatch?.[1] ?? objectMatch?.[0]
    if (payload) {
      try {
        return this.mapAIObject(JSON.parse(payload), 1, false, description)
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

  private normalizeTaskType(raw: unknown, description = ''): AICampaignPlanDto['taskType'] {
    const value = String(raw ?? '').toLowerCase()
    if (value.includes('creator') || value.includes('content') || value.includes('达人'))
      return 'creator_content'
    if (value.includes('customer') || value.includes('offer') || value.includes('coupon'))
      return 'customer_campaign'
    return this.inferTaskType(description)
  }

  private inferTaskType(description: string): AICampaignPlanDto['taskType'] {
    return /达人|创作者|图文|短视频|内容发布|内容引流|种草|探店/.test(description)
      ? 'creator_content'
      : 'customer_campaign'
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

  private normalizeMarketingProduct(raw: any) {
    const source = raw && typeof raw === 'object' ? raw : {}
    const get = (snake: string, camel: string) =>
      source[snake] !== undefined ? source[snake] : source[camel]
    const productName = this.textValue(get('product_name', 'productName'))
    const category = this.textValue(get('category', 'category'))
    const description = this.textValue(get('description', 'description')) ?? ''
    const rawSkus = get('skus', 'skus')
    if (!productName || !category || !Array.isArray(rawSkus) || rawSkus.length === 0)
      throw new BadGatewayException('AI 返回的营销商品草稿不完整，请重试')
    const skus = rawSkus.slice(0, 20).map((rawSku: any, index: number) => {
      const skuName = this.textValue(rawSku?.sku_name ?? rawSku?.skuName)
      const skuCode = this.textValue(rawSku?.sku_code ?? rawSku?.skuCode)
      const price = this.nonNegativeNumber(rawSku?.price)
      if (!skuName || !skuCode || price == null)
        throw new BadGatewayException(`AI 返回的第 ${index + 1} 个 SKU 不完整，请重试`)
      return {
        skuName,
        skuCode,
        spec: this.textValue(rawSku?.spec),
        price,
        marketPrice: this.nonNegativeNumber(rawSku?.market_price ?? rawSku?.marketPrice),
        attributes:
          rawSku?.attributes && typeof rawSku.attributes === 'object' ? rawSku.attributes : {},
      }
    })
    return { productName, category, description, skus }
  }

  private textValue(value: unknown) {
    return typeof value === 'string' && value.trim() ? value.trim() : null
  }

  private nonNegativeNumber(value: unknown) {
    if (value === null || value === undefined || value === '') return undefined
    const number = Number(value)
    return Number.isFinite(number) && number >= 0 ? number : undefined
  }

  private positiveNumber(value: unknown) {
    const number = this.nonNegativeNumber(value)
    return number != null && number > 0 ? number : undefined
  }

  private confidenceValue(value: unknown) {
    const number = this.nonNegativeNumber(value)
    return number == null ? undefined : Math.min(number, 1)
  }

  private stringArray(value: unknown) {
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      : []
  }

  private validDate(value: unknown) {
    if (typeof value !== 'string') return null
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? null : date
  }

  /**
   * 构建默认配置（AI 不可用时，基于关键词）
   */
  private buildDefaultPlan(description: string, optionId = 1): AICampaignPlanDto {
    const desc = description.toLowerCase()
    const taskType = this.inferTaskType(description)

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

    const originalPrice = this.extractAmount(
      desc,
      /(?:原价|门市价|市场价)\s*(?:是|为|：|:)?\s*[¥￥]?\s*([\d,]+(?:\.\d+)?)\s*(?:元)?/,
    )
    const offerPrice =
      this.extractAmount(
        desc,
        /(?:售价|销售价|优惠价|活动价|套餐价|现价|价格)\s*(?:是|为|：|:)?\s*[¥￥]?\s*([\d,]+(?:\.\d+)?)\s*(?:元)?/,
      ) ??
      this.extractAmount(
        desc,
        /[¥￥]?\s*([\d,]+(?:\.\d+)?)\s*元(?:的)?\s*(?:\S{0,4})?(?:套餐|组合)/,
      )
    const dates = this.extractDateRange(desc)

    if (campaignType === CampaignType.COMBO && offerPrice != null) {
      discountAmount = offerPrice
    }

    return {
      planId: optionId === 1 ? `default-${Date.now()}` : `default-${Date.now()}-${optionId}`,
      title: `${campaignType === CampaignType.CASH_REWARD ? '返现' : campaignType === CampaignType.COMBO ? '组合套餐' : '满减'}${['稳健', '均衡', '扩张'][optionId - 1] ?? '推荐'}方案`,
      taskType,
      campaignType,
      discountAmount,
      thresholdAmount,
      offerPrice,
      originalPrice,
      agentRewardAmount: Math.max(5, Math.round(discountAmount * 0.25)),
      startAt: dates.startAt,
      endAt: dates.endAt,
      couponValidityDays: dates.couponValidityDays ?? DEFAULT_CONFIG.couponValidityDays,
      totalStock: DEFAULT_CONFIG.totalStock,
      perCustomerLimit: DEFAULT_CONFIG.perCustomerLimit,
      explanation: '基于描述关键词生成默认配置',
      contentBrief:
        taskType === 'creator_content'
          ? `围绕“${description}”完成门店体验内容，明确到店行动并通过专属链接追踪引流。`
          : undefined,
      contentTypes: taskType === 'creator_content' ? ['short_video', 'graphic'] : undefined,
      channels: taskType === 'creator_content' ? ['douyin', 'xiaohongshu'] : undefined,
      callToAction: taskType === 'creator_content' ? '点击专属链接了解活动并到店转化' : undefined,
    }
  }

  private extractAmount(description: string, pattern: RegExp) {
    const match = description.match(pattern)
    if (!match) return undefined
    const amount = Number(match[1].replaceAll(',', ''))
    return Number.isFinite(amount) && amount >= 0 ? amount : undefined
  }

  private extractDateRange(description: string): {
    startAt?: string
    endAt?: string
    couponValidityDays?: number
  } {
    const match = description.match(
      /(?:从|自|由)?\s*(?:(\d{4})\s*年\s*)?(\d{1,2})\s*[月/-]\s*(\d{1,2})\s*日?\s*(?:到|至|—|~|～|-)\s*(?:(\d{4})\s*年\s*)?(\d{1,2})\s*[月/-]\s*(\d{1,2})\s*日?/,
    )
    if (!match) return {}

    const currentYear = new Date().getFullYear()
    const startYear = Number(match[1] ?? currentYear)
    const endYear = Number(match[4] ?? startYear)
    const start = new Date(startYear, Number(match[2]) - 1, Number(match[3]), 0, 0, 0, 0)
    const end = new Date(endYear, Number(match[5]) - 1, Number(match[6]), 23, 59, 59, 999)
    if (
      Number.isNaN(start.getTime()) ||
      Number.isNaN(end.getTime()) ||
      start.getFullYear() !== startYear ||
      end.getFullYear() !== endYear ||
      end < start
    )
      return {}

    return {
      startAt: start.toISOString(),
      endAt: end.toISOString(),
      couponValidityDays: Math.floor((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1,
    }
  }
}
