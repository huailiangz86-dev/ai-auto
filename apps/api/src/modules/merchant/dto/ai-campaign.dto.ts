// ============================================================
// AI auto - AI Campaign DTO
// Natural language → structured campaign configuration
// ============================================================

import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsNumber,
  IsEnum,
  IsDateString,
  IsBoolean,
  IsObject,
  Min,
  Max,
  MaxLength,
} from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { CampaignType } from '@ai-auto/shared'

export type AICampaignTaskType = 'customer_campaign' | 'creator_content'

// ---- AI 生成活动请求 ----
export class CreateAICampaignDto {
  @ApiProperty({
    description: '商家自然语言描述',
    example: '帮我做一个七夕满减活动，消费满100减20，目标新客，活动一周',
  })
  @IsNotEmpty({ message: '活动描述不能为空' })
  @IsString()
  @MaxLength(1000)
  description!: string

  @ApiPropertyOptional({ description: '门店ID（不填则全局活动）' })
  @IsOptional()
  @IsString()
  storeId?: string

  @ApiPropertyOptional({ description: '活动名称（AI 生成，可覆盖）' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  campaignName?: string

  @ApiPropertyOptional({ description: '最高预算（分）' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  maxBudget?: number

  @ApiPropertyOptional({ description: '预览后确认采用的 AI 方案' })
  @IsOptional()
  @IsObject()
  selectedOption?: Record<string, unknown>

  @ApiPropertyOptional({ description: '是否在创建后直接发布；默认不发布，需完成测量预登记' })
  @IsOptional()
  @IsBoolean()
  autoPublish?: boolean
}

// ---- AI 返回的活动配置方案 ----
export class AICampaignPlanDto {
  @ApiProperty({ description: '方案编号' })
  planId!: string

  @ApiProperty({ description: '方案标题' })
  title!: string

  @ApiProperty({
    description: '执行类型：普通客户优惠活动或达人内容引流任务',
    enum: ['customer_campaign', 'creator_content'],
  })
  taskType!: AICampaignTaskType

  @ApiProperty({ description: '活动类型' })
  campaignType!: CampaignType

  @ApiPropertyOptional({ description: '活动名称' })
  campaignName?: string

  @ApiPropertyOptional({ description: '活动描述' })
  description?: string

  @ApiPropertyOptional({ description: '目标人群' })
  targetAudience?: string

  @ApiPropertyOptional({ description: '活动开始时间（ISO）' })
  startAt?: string

  @ApiPropertyOptional({ description: '活动结束时间（ISO）' })
  endAt?: string

  @ApiPropertyOptional({ description: '优惠券面值（满减金额）' })
  discountAmount?: number

  @ApiPropertyOptional({ description: '组合套餐活动价' })
  offerPrice?: number

  @ApiPropertyOptional({ description: '组合套餐原价' })
  originalPrice?: number

  @ApiPropertyOptional({ description: '满减门槛' })
  thresholdAmount?: number

  @ApiPropertyOptional({ description: '现金奖励' })
  cashRewardAmount?: number

  @ApiPropertyOptional({ description: '分享员佣金（元）' })
  agentRewardAmount?: number

  @ApiPropertyOptional({ description: '优惠券有效期（天）' })
  couponValidityDays?: number

  @ApiPropertyOptional({ description: '总库存（null=无限）' })
  totalStock?: number

  @ApiPropertyOptional({ description: '每人限领次数' })
  perCustomerLimit?: number

  @ApiPropertyOptional({ description: '预算消耗预估（估算佣金总额）' })
  estimatedBudget?: number

  @ApiPropertyOptional({ description: 'AI 对该方案的解释' })
  explanation?: string

  @ApiPropertyOptional({ description: '达人任务内容 Brief' })
  contentBrief?: string

  @ApiPropertyOptional({ description: '达人任务内容形式' })
  contentTypes?: string[]

  @ApiPropertyOptional({ description: '达人任务发布渠道' })
  channels?: string[]

  @ApiPropertyOptional({ description: '达人任务引导动作' })
  callToAction?: string

  @ApiPropertyOptional({ description: 'AI 置信度（0-1）' })
  confidence?: number
}

// ---- AI 生成结果响应 ----
export class CreateAICampaignResponseDto {
  @ApiProperty({ description: '活动ID' })
  campaignId!: string

  @ApiPropertyOptional({ description: '活动转化优惠券ID；达人内容通过专属链接引导领取' })
  couponId?: string | null

  @ApiPropertyOptional({ description: '券码' })
  couponCode?: string

  @ApiProperty({ description: '活动名称' })
  campaignName!: string

  @ApiProperty({ description: '活动状态' })
  campaignStatus!: string

  @ApiPropertyOptional({ description: '活动转化优惠券状态' })
  couponStatus?: string | null

  @ApiProperty({ description: '执行类型', enum: ['customer_campaign', 'creator_content'] })
  taskType!: AICampaignTaskType

  @ApiPropertyOptional({ description: 'AI 生成的方案摘要' })
  planSummary?: AICampaignPlanDto
}

// ---- AI 活动预览 ----
export class AICampaignPreviewResponseDto {
  @ApiProperty({ description: '本次 AI 预览请求 ID' })
  requestId!: string

  @ApiProperty({ description: '活动自然语言描述' })
  description!: string

  @ApiProperty({ description: 'AI 生成或本地降级的方案列表', type: [AICampaignPlanDto] })
  options!: AICampaignPlanDto[]

  @ApiProperty({ description: '方案来源', enum: ['ai', 'fallback'] })
  source!: 'ai' | 'fallback'
}

// ---- AI 营销商品生成 ----
export class GenerateAIMarketingProductDto {
  @ApiProperty({
    description: '营销商品自然语言描述',
    example: '生成一个双人火锅套餐，原价298，售价198',
  })
  @IsNotEmpty({ message: '商品描述不能为空' })
  @IsString()
  @MaxLength(2000)
  prompt!: string

  @ApiPropertyOptional({ description: '商品类目提示' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string
}

export class AIMarketingProductSkuDto {
  skuName!: string
  skuCode!: string
  spec?: string | null
  price!: number
  marketPrice?: number | null
  attributes!: Record<string, string>
}

export class AIMarketingProductDraftDto {
  productName!: string
  category!: string
  description!: string
  skus!: AIMarketingProductSkuDto[]
}

export class GenerateAIMarketingProductResponseDto {
  requestId!: string
  product!: AIMarketingProductDraftDto
  usage?: Record<string, unknown>
}
