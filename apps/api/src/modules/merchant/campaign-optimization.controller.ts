import { Body, Controller, Get, Param, Post, Put, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { UserRole } from '@ai-auto/shared'

import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { Roles } from '../auth/decorators/roles.decorator'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { CampaignOptimizationService } from './campaign-optimization.service'
import {
  ResolveOptimizationDto,
  UpdateOptimizationSettingDto,
} from './dto/campaign-optimization.dto'

@ApiTags('AI 活动优化 API')
@Controller('merchant/ai/optimizations')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.MERCHANT_ADMIN)
@ApiBearerAuth()
export class CampaignOptimizationController {
  constructor(private readonly optimizationService: CampaignOptimizationService) {}

  @Post('campaigns/:campaignId/analyze')
  @ApiOperation({ summary: '分析活动指标并生成可确认的优化建议' })
  async analyze(@CurrentUser() user: { id: string }, @Param('campaignId') campaignId: string) {
    return this.optimizationService.analyze(user.id, campaignId)
  }

  @Get()
  @ApiOperation({ summary: '获取本商户最近的 AI 优化建议与执行记录' })
  async list(@CurrentUser() user: { id: string }) {
    return this.optimizationService.list(user.id)
  }

  @Post(':optimizationId/resolve')
  @ApiOperation({ summary: '确认执行或拒绝 AI 优化建议' })
  async resolve(
    @CurrentUser() user: { id: string },
    @Param('optimizationId') optimizationId: string,
    @Body() dto: ResolveOptimizationDto,
  ) {
    return this.optimizationService.apply(user.id, optimizationId, dto.approve)
  }

  @Get('settings/current')
  @ApiOperation({ summary: '获取 AI 自动调整授权与变动上限' })
  async getSettings(@CurrentUser() user: { id: string }) {
    return this.optimizationService.getSetting(user.id)
  }

  @Put('settings/current')
  @ApiOperation({ summary: '设置 AI 自动调整开关与单次变动上限' })
  async updateSettings(
    @CurrentUser() user: { id: string },
    @Body() dto: UpdateOptimizationSettingDto,
  ) {
    return this.optimizationService.updateSetting(user.id, dto)
  }

  @Get('reports/weekly')
  @ApiOperation({ summary: '获取本周活动效果报告、AI 洞察和最佳发布时间' })
  async weeklyReport(@CurrentUser() user: { id: string }) {
    return this.optimizationService.weeklyReport(user.id)
  }
}
