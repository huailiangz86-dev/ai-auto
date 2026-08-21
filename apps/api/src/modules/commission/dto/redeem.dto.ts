// ============================================================
// AI auto - Coupon Redemption DTO
// STORY-AI-017: C端核销流程
// ============================================================

import { IsNotEmpty, IsString, IsNumber, IsOptional, Min, Max, MaxLength } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

// ---- 商家核销请求 ----
export class RedeemCouponDto {
  @ApiProperty({ description: '券码（CustomerCoupon.couponCode）' })
  @IsNotEmpty({ message: '券码不能为空' })
  @IsString()
  @MaxLength(100)
  couponCode!: string

  @ApiProperty({ description: '实际交易金额（元）' })
  @IsNumber()
  @Min(0.01)
  transactionAmount!: number

  @ApiPropertyOptional({ description: '核销门店ID' })
  @IsOptional()
  @IsString()
  storeId?: string

  @ApiPropertyOptional({ description: '商家侧交易流水号（幂等）' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  merchantTransactionId?: string

  @ApiPropertyOptional({ description: '商家侧核销时间（ISO）' })
  @IsOptional()
  @IsString()
  presentedAt?: string
}

// ---- 核销结果 ----
export class RedeemResultDto {
  @ApiProperty({ description: '核销记录ID' })
  redemptionId!: string

  @ApiProperty({ description: '券码' })
  couponCode!: string

  @ApiProperty({ description: '优惠金额/权益值（元）' })
  discountValue!: number

  @ApiProperty({ description: '是否成功' })
  success!: boolean

  @ApiPropertyOptional({ description: '失败原因' })
  failureReason?: string

  @ApiPropertyOptional({ description: '佣金计算结果' })
  commissionResult?: {
    commissionId: string
    agentPayout: number
    level: string
    multiplier: number
  }

  @ApiPropertyOptional({ description: '客户归属分享员昵称' })
  agentNickname?: string | null

  @ApiPropertyOptional({ description: '归属到期剩余天数' })
  lockDaysRemaining?: number
}

// ---- 商家查询核销记录 ----
export class ListRedemptionsDto {
  @ApiPropertyOptional({ description: '开始日期' })
  @IsOptional()
  @IsString()
  startDate?: string

  @ApiPropertyOptional({ description: '结束日期' })
  @IsOptional()
  @IsString()
  endDate?: string

  @ApiPropertyOptional({ description: '状态' })
  @IsOptional()
  @IsString()
  status?: string

  @ApiPropertyOptional({ description: '页码', default: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  page?: number = 1

  @ApiPropertyOptional({ description: '每页数量', default: 20 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  pageSize?: number = 20
}
