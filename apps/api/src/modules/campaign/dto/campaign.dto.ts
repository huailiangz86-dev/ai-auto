// ============================================================
// AI auto - Campaign DTO
// ============================================================

import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsEnum,
  IsDateString,
  Min,
  Max,
  MaxLength,
  IsArray,
  ValidateNested,
  MinLength,
} from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { CampaignType } from '@ai-auto/shared'

// ---- 创建活动 ----
export class CreateCampaignDto {
  @ApiPropertyOptional({ description: '门店ID（不填则全局活动）' })
  @IsOptional()
  @IsString()
  storeId?: string

  @ApiProperty({ description: '活动名称', example: '七夕满减活动' })
  @IsNotEmpty({ message: '活动名称不能为空' })
  @IsString()
  @MaxLength(200)
  campaignName!: string

  @ApiProperty({ description: '活动类型', enum: CampaignType })
  @IsNotEmpty({ message: '活动类型不能为空' })
  @IsEnum(CampaignType)
  campaignType!: CampaignType

  @ApiPropertyOptional({ description: '活动描述' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string

  @ApiPropertyOptional({ description: '目标人群', enum: ['all', 'new', 'returning'] })
  @IsOptional()
  @IsEnum(['all', 'new', 'returning'])
  targetAudience?: string

  @ApiPropertyOptional({ description: '活动开始时间' })
  @IsOptional()
  @IsDateString()
  startAt?: string

  @ApiPropertyOptional({ description: '活动结束时间' })
  @IsOptional()
  @IsDateString()
  endAt?: string

  @ApiPropertyOptional({ description: '最高预算（分账用）' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  maxBudget?: number
}

// ---- 创建优惠券 ----
export class CreateCouponDto {
  @ApiProperty({ description: '优惠券名称', example: '满100减20优惠券' })
  @IsNotEmpty({ message: '优惠券名称不能为空' })
  @IsString()
  @MaxLength(200)
  couponName!: string

  @ApiPropertyOptional({ description: '优惠券编码（商家自定）' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  couponCode?: string

  @ApiProperty({ description: '面值（满减金额或现金奖励金额）', example: 20 })
  @IsNotEmpty({ message: '面值不能为空' })
  @IsNumber()
  @Min(0.01)
  discountAmount?: number

  @ApiPropertyOptional({ description: '满减门槛（0=无门槛）', example: 100 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  thresholdAmount?: number

  @ApiPropertyOptional({ description: '现金奖励金额', example: 5 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  cashRewardAmount?: number

  @ApiPropertyOptional({ description: '分享员佣金（核销后所得）', example: 5 })
  @IsNotEmpty({ message: '分享员佣金不能为空' })
  @IsNumber()
  @Min(0)
  agentRewardAmount!: number

  @ApiProperty({ description: '有效开始时间' })
  @IsNotEmpty({ message: '有效开始时间不能为空' })
  @IsDateString()
  validFrom!: string

  @ApiProperty({ description: '有效结束时间' })
  @IsNotEmpty({ message: '有效结束时间不能为空' })
  @IsDateString()
  validUntil!: string

  @ApiPropertyOptional({ description: '总库存（null=无限）', example: 1000 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  totalStock?: number

  @ApiPropertyOptional({ description: '每人限领次数（0=不限）', example: 1 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  perCustomerLimit?: number = 1
}

// ---- 更新活动 ----
export class UpdateCampaignDto {
  @ApiPropertyOptional({ description: '活动名称' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  campaignName?: string

  @ApiPropertyOptional({ description: '活动描述' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string

  @ApiPropertyOptional({ description: '活动结束时间' })
  @IsOptional()
  @IsDateString()
  endAt?: string

  @ApiPropertyOptional({ description: '最高预算' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  maxBudget?: number

  @ApiPropertyOptional({ description: '目标人群' })
  @IsOptional()
  @IsEnum(['all', 'new', 'returning'])
  targetAudience?: string
}

// ---- 更新优惠券 ----
export class UpdateCouponDto {
  @ApiPropertyOptional({ description: '优惠券名称' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  couponName?: string

  @ApiPropertyOptional({ description: '有效结束时间' })
  @IsOptional()
  @IsDateString()
  validUntil?: string

  @ApiPropertyOptional({ description: '总库存' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  totalStock?: number

  @ApiPropertyOptional({ description: '分享员佣金' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  agentRewardAmount?: number
}

// ---- 列表查询 ----
export class ListCampaignsDto {
  @IsOptional()
  @IsString()
  status?: string // draft/active/paused/ended

  @IsOptional()
  @IsString()
  campaignType?: string

  @IsOptional()
  @IsNumber()
  @Min(1)
  page?: number = 1

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  pageSize?: number = 20
}

export class ListCouponsDto {
  @IsOptional()
  @IsString()
  campaignId?: string

  @IsOptional()
  @IsString()
  status?: string

  @IsOptional()
  @IsNumber()
  @Min(1)
  page?: number = 1

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  pageSize?: number = 20
}

// ---- 批量操作 ----
export class BatchCreateCouponsDto {
  @ApiProperty({ description: '优惠券列表（最多20个）', type: [CreateCouponDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateCouponDto)
  @MinLength(1)
  @MaxLength(20)
  coupons!: CreateCouponDto[]
}
