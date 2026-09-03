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
  Min,
  Max,
  MaxLength,
} from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { CampaignType } from '@ai-auto/shared'

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
}

// ---- AI 返回的活动配置方案 ----
export class AICampaignPlanDto {
  @ApiProperty({ description: '方案编号' })
  planId!: string

  @ApiProperty({ description: '方案标题' })
  title!: string

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
}

// ---- AI 生成结果响应 ----
export class CreateAICampaignResponseDto {
  @ApiProperty({ description: '活动ID' })
  campaignId!: string

  @ApiProperty({ description: '优惠券ID' })
  couponId!: string

  @ApiPropertyOptional({ description: '券码' })
  couponCode?: string

  @ApiProperty({ description: '活动名称' })
  campaignName!: string

  @ApiProperty({ description: '活动状态' })
  campaignStatus!: string

  @ApiProperty({ description: '优惠券状态' })
  couponStatus!: string

  @ApiPropertyOptional({ description: 'AI 生成的方案摘要' })
  planSummary?: AICampaignPlanDto
}
