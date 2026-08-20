// ============================================================
// AI auto - Merchant Wallet DTO
// Commission budget management
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

// ---- 充值 ----
export class TopupBudgetDto {
  @ApiProperty({ description: '充值金额（元）', example: 1000.0, minimum: 1 })
  @IsNotEmpty({ message: '充值金额不能为空' })
  @IsNumber()
  @Min(1, { message: '最低充值 ¥1' })
  amount!: number

  @ApiProperty({ description: '支付方式', enum: ['alipay', 'wechatpay', 'bank_card'] })
  @IsNotEmpty({ message: '支付方式不能为空' })
  @IsString()
  method!: string

  @ApiPropertyOptional({ description: '支付流水号' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  paymentTransactionId?: string

  @ApiPropertyOptional({ description: '备注' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string
}

// ---- 冻结预算 ----
export class FreezeBudgetDto {
  @ApiProperty({ description: '冻结金额（元）', example: 500.0, minimum: 0.01 })
  @IsNotEmpty({ message: '冻结金额不能为空' })
  @IsNumber()
  @Min(0.01)
  amount!: number

  @ApiProperty({ description: '关联活动ID' })
  @IsNotEmpty({ message: '活动ID不能为空' })
  @IsString()
  campaignId!: string

  @ApiPropertyOptional({ description: '备注' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string
}

// ---- 解冻/扣减 ----
export class UnfreezeBudgetDto {
  @ApiProperty({ description: '解冻金额（元）', example: 50.0 })
  @IsNotEmpty({ message: '解冻金额不能为空' })
  @IsNumber()
  @Min(0.01)
  amount!: number

  @ApiPropertyOptional({ description: '备注' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string
}

// ---- 查询 DTO ----
export class ListTransactionsDto {
  @ApiPropertyOptional({ description: '交易类型', enum: ['TOPUP', 'FREEZE', 'UNFREEZE', 'SPEND'] })
  @IsOptional()
  @IsString()
  type?: string

  @ApiPropertyOptional({ description: '开始日期' })
  @IsOptional()
  @IsDateString()
  startDate?: string

  @ApiPropertyOptional({ description: '结束日期' })
  @IsOptional()
  @IsDateString()
  endDate?: string

  @ApiPropertyOptional({ description: '活动ID' })
  @IsOptional()
  @IsString()
  campaignId?: string

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

// ---- 统计 ----
export class GetWalletStatsDto {
  @ApiPropertyOptional({ description: '开始日期' })
  @IsOptional()
  @IsDateString()
  startDate?: string

  @ApiPropertyOptional({ description: '结束日期' })
  @IsOptional()
  @IsDateString()
  endDate?: string
}
