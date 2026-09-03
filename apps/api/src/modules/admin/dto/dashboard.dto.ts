// ============================================================
// AI auto - Admin dashboard query DTO
// ============================================================

import { IsDateString, IsOptional, IsString, Max, Min } from 'class-validator'
import { Type } from 'class-transformer'
import { ApiPropertyOptional } from '@nestjs/swagger'

/**
 * The dashboard is platform-scoped by default. Supplying a merchant or agent
 * identifier narrows every transaction-based metric, enabling drill-down from
 * the platform view without exposing a second, inconsistent set of metrics.
 */
export class DashboardQueryDto {
  @ApiPropertyOptional({ description: '统计日期（YYYY-MM-DD，默认今天）' })
  @IsOptional()
  @IsDateString()
  date?: string

  @ApiPropertyOptional({ description: '下钻商户 ID' })
  @IsOptional()
  @IsString()
  merchantId?: string

  @ApiPropertyOptional({ description: '下钻分享员 ID' })
  @IsOptional()
  @IsString()
  agentId?: string

  @ApiPropertyOptional({ description: '趋势天数，默认 14 天，最大 90 天', default: 14 })
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(90)
  trendDays?: number
}
