// ============================================================
// AI auto - Analytics Controller
// Attribution chain tracking, funnel, ROI, and reporting
// ============================================================

import { Controller, Get, Post, Body, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger'

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { Roles } from '../auth/decorators/roles.decorator'
import { UserRole } from '@ai-auto/shared'

import { AnalyticsService } from './analytics.service'
import { AnalyticsQueryDto } from './dto/analytics.dto'

@ApiTags('数据分析 API')
@Controller('v1/analytics')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  // ========================
  // 漏斗
  // ========================

  @Get('funnel')
  @Roles(UserRole.MERCHANT_ADMIN, UserRole.MERCHANT_STAFF, UserRole.ADMIN)
  @ApiOperation({ summary: '漏斗数据（浏览→点击→领取→核销）' })
  async getFunnel(@CurrentUser() user: { merchantId: string }, @Query() query: AnalyticsQueryDto) {
    return this.analyticsService.getFunnelData(user.merchantId, query)
  }

  // ========================
  // 全链路追踪
  // ========================

  @Get('attribution-chain')
  @Roles(UserRole.MERCHANT_ADMIN, UserRole.ADMIN)
  @ApiOperation({ summary: '全链路追踪（分享员→链接→客户→核销）' })
  async getAttributionChain(
    @CurrentUser() user: { merchantId: string },
    @Query() query: AnalyticsQueryDto,
  ) {
    return this.analyticsService.getAttributionChain(user.merchantId, query)
  }

  // ========================
  // 周期对比
  // ========================

  @Get('comparison')
  @Roles(UserRole.MERCHANT_ADMIN, UserRole.ADMIN)
  @ApiOperation({ summary: '周期环比对比（当前 vs 上一周期）' })
  async getComparison(
    @CurrentUser() user: { merchantId: string },
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('periodType') periodType: 'daily' | 'weekly' | 'monthly' = 'weekly',
  ) {
    return this.analyticsService.getPeriodComparison(
      user.merchantId,
      startDate,
      endDate,
      periodType,
    )
  }

  // ========================
  // ROI
  // ========================

  @Get('roi')
  @Roles(UserRole.MERCHANT_ADMIN, UserRole.ADMIN)
  @ApiOperation({ summary: 'ROI 分析（佣金支出 vs 新客户价值）' })
  async getROI(@CurrentUser() user: { merchantId: string }, @Query() query: AnalyticsQueryDto) {
    return this.analyticsService.getROI(user.merchantId, query)
  }

  // ========================
  // 时序图表
  // ========================

  @Get('timeseries')
  @Roles(UserRole.MERCHANT_ADMIN, UserRole.MERCHANT_STAFF, UserRole.ADMIN)
  @ApiOperation({ summary: '时序图表（日报/周报/月报）' })
  async getTimeSeries(
    @CurrentUser() user: { merchantId: string },
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('groupBy') groupBy: 'daily' | 'weekly' | 'monthly' = 'daily',
  ) {
    return this.analyticsService.getTimeSeries(user.merchantId, startDate, endDate, groupBy)
  }

  // ========================
  // 分享员排行榜
  // ========================

  @Get('agent-leaderboard')
  @Roles(UserRole.MERCHANT_ADMIN, UserRole.ADMIN)
  @ApiOperation({ summary: '分享员贡献排行榜' })
  async getAgentLeaderboard(
    @CurrentUser() user: { merchantId: string },
    @Query() query: AnalyticsQueryDto,
  ) {
    return this.analyticsService.getAgentLeaderboard(user.merchantId, query)
  }
}
