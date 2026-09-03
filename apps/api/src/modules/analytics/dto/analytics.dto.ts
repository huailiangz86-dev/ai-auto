// ============================================================
// AI auto - Analytics DTO
// Attribution chain tracking & campaign analytics
// ============================================================

import { IsString, IsOptional, IsNumber, IsEnum, IsDateString, Min, Max } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

// ---- 查询基础参数 ----
export class AnalyticsQueryDto {
  @ApiPropertyOptional({ description: '活动ID' })
  @IsOptional()
  @IsString()
  campaignId?: string

  @ApiPropertyOptional({ description: '开始日期（ISO）' })
  @IsOptional()
  @IsDateString()
  startDate?: string

  @ApiPropertyOptional({ description: '结束日期（ISO）' })
  @IsOptional()
  @IsDateString()
  endDate?: string

  @ApiPropertyOptional({ description: '门店ID' })
  @IsOptional()
  @IsString()
  storeId?: string

  @ApiPropertyOptional({ description: '分享员ID' })
  @IsOptional()
  @IsString()
  agentId?: string
}

// ---- 漏斗数据 ----
export class FunnelDataDto {
  @ApiProperty({ description: '浏览量（链接曝光）' })
  impressions!: number

  @ApiProperty({ description: '点击量（点击链接的客户）' })
  clicks!: number

  @ApiProperty({ description: '领取量（领取优惠券）' })
  claims!: number

  @ApiProperty({ description: '核销量（到店使用）' })
  redemptions!: number

  @ApiPropertyOptional({ description: '复购量' })
  repurchases?: number

  @ApiPropertyOptional({ description: '再分享量' })
  reshares?: number
}

// ---- 全链路记录 ----
export class AttributionChainDto {
  @ApiProperty({ description: '分享员昵称' })
  agentNickname!: string

  @ApiProperty({ description: '分享平台' })
  platform!: string

  @ApiProperty({ description: '客户ID' })
  customerId!: string

  @ApiProperty({ description: '活动名称' })
  campaignName!: string

  @ApiProperty({ description: '领取时间' })
  claimedAt!: Date

  @ApiPropertyOptional({ description: '核销时间' })
  redeemedAt?: Date | null

  @ApiPropertyOptional({ description: '佣金金额' })
  commissionAmount?: number

  @ApiProperty({ description: '锁定期剩余天数' })
  lockDaysRemaining!: number
}

// ---- 周期对比 ----
export class PeriodComparisonDto {
  @ApiProperty({ description: '当前周期' })
  current!: {
    period: string
    impressions: number
    clicks: number
    claims: number
    redemptions: number
    commission: number
    roi: number
  }

  @ApiProperty({ description: '上一周期' })
  previous!: {
    period: string
    impressions: number
    clicks: number
    claims: number
    redemptions: number
    commission: number
    roi: number
  }

  @ApiProperty({ description: '环比变化（%）' })
  changes!: {
    impressions: number
    clicks: number
    claims: number
    redemptions: number
    commission: number
    roi: number
  }
}

// ---- ROI 数据 ----
export class ROIDataDto {
  @ApiProperty({ description: '总佣金支出' })
  totalCommissionSpent!: number

  @ApiProperty({ description: '总核销订单数' })
  totalRedemptions!: number

  @ApiProperty({ description: '新增客户数' })
  newCustomers!: number

  @ApiProperty({ description: '复购客户数' })
  repurchaseCustomers!: number

  @ApiProperty({ description: '总交易额' })
  totalTransactionAmount!: number

  @ApiProperty({ description: '平均每单佣金' })
  avgCommissionPerOrder!: number

  @ApiProperty({ description: '平均每客户佣金成本' })
  avgCommissionPerCustomer!: number

  @ApiProperty({ description: '复购率（%）' })
  repurchaseRate!: number

  @ApiProperty({ description: 'ROI = 交易额/佣金支出' })
  roi!: number
}

// ---- 时序图表 ----
export class TimeSeriesPointDto {
  @ApiProperty({ description: '日期（YYYY-MM-DD）' })
  date!: string

  @ApiPropertyOptional({ description: '浏览量' })
  impressions?: number

  @ApiPropertyOptional({ description: '点击量' })
  clicks?: number

  @ApiPropertyOptional({ description: '领取量' })
  claims?: number

  @ApiPropertyOptional({ description: '核销量' })
  redemptions?: number

  @ApiPropertyOptional({ description: '佣金支出' })
  commission?: number

  @ApiPropertyOptional({ description: '交易额' })
  transactionAmount?: number
}

// ---- 分享员排行榜 ----
export class AgentLeaderboardDto {
  @ApiProperty({ description: '分享员ID' })
  agentId!: string

  @ApiProperty({ description: '分享员昵称' })
  nickname!: string

  @ApiProperty({ description: '带来客户数' })
  customerCount!: number

  @ApiProperty({ description: '核销量' })
  redemptionCount!: number

  @ApiProperty({ description: '佣金支出' })
  commissionSpent!: number

  @ApiProperty({ description: '排名' })
  rank!: number
}
