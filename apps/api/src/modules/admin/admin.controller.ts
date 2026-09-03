// ============================================================
// AI auto - Admin Controller
// Platform operations: audit, fraud, finance
// ============================================================

import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common'
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger'

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { Roles } from '../auth/decorators/roles.decorator'
import { UserRole } from '@ai-auto/shared'
import { CurrentUser, CurrentUserPayload } from '../auth/decorators/current-user.decorator'

import { AdminService } from './admin.service'
import { FinancialLedgerService } from './financial-ledger.service'
import {
  ApproveMerchantDto,
  RejectMerchantDto,
  SuspendAgentDto,
  RejectAgentDto,
  ResolveFraudAlertDto,
  ModerateContentDto,
  ListPendingMerchantsDto,
  ListPendingAgentsDto,
  SetCreatorGrowthScoreDto,
  BlacklistCreatorDto,
} from './dto/admin-audit.dto'
import { DashboardQueryDto } from './dto/dashboard.dto'
import { CampaignEconomicsQueryDto, CreateFinancialLedgerEntryDto } from './dto/financial-ledger.dto'

@ApiTags('运营后台 API')
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly financialLedgerService: FinancialLedgerService,
  ) {}

  // ========================
  // 运营大屏
  // ========================

  @Get('dashboard')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: '运营大屏：实时 KPI、趋势、告警与待办' })
  async getDashboard(@Query() query: DashboardQueryDto) {
    return { code: 0, data: await this.adminService.getDashboard(query) }
  }

  @Get('dashboard/merchants/:merchantId/agents')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: '运营大屏：获取商户已绑定的分享员下钻选项' })
  async listDashboardAgents(@Param('merchantId') merchantId: string) {
    return { code: 0, data: await this.adminService.listDashboardAgents(merchantId) }
  }

  // ========================
  // 商户审核
  // ========================

  @Get('merchants/pending')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: '待审核商户列表' })
  async listPendingMerchants(@Query() query: ListPendingMerchantsDto) {
    return this.adminService.listPendingMerchants(query)
  }

  @Post('merchants/:merchantId/approve')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: '审核通过商户' })
  @HttpCode(HttpStatus.OK)
  async approveMerchant(
    @CurrentUser() user: CurrentUserPayload,
    @Param('merchantId') merchantId: string,
    @Body() dto: ApproveMerchantDto,
  ) {
    return this.adminService.approveMerchant(merchantId, dto, { id: user.id, name: user.username })
  }

  @Post('merchants/:merchantId/reject')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: '审核拒绝商户' })
  @HttpCode(HttpStatus.OK)
  async rejectMerchant(
    @CurrentUser() user: CurrentUserPayload,
    @Param('merchantId') merchantId: string,
    @Body() dto: RejectMerchantDto,
  ) {
    return this.adminService.rejectMerchant(merchantId, dto, { id: user.id, name: user.username })
  }

  // ========================
  // 分享员审核
  // ========================

  @Get('agents/pending')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: '待审核分享员列表' })
  async listPendingAgents(@Query() query: ListPendingAgentsDto) {
    return this.adminService.listPendingAgents(query)
  }

  @Post('agents/:agentId/approve')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: '审核通过分享员' })
  @HttpCode(HttpStatus.OK)
  async approveAgent(@CurrentUser() user: CurrentUserPayload, @Param('agentId') agentId: string) {
    return this.adminService.approveAgent(agentId, { id: user.id, name: user.username })
  }

  @Post('agents/:agentId/reject')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: '审核拒绝分享员' })
  @HttpCode(HttpStatus.OK)
  async rejectAgent(
    @CurrentUser() user: CurrentUserPayload,
    @Param('agentId') agentId: string,
    @Body() dto: RejectAgentDto,
  ) {
    return this.adminService.rejectAgent(agentId, dto.reason, { id: user.id, name: user.username })
  }

  @Post('agents/:agentId/suspend')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: '封禁分享员' })
  @HttpCode(HttpStatus.OK)
  async suspendAgent(
    @CurrentUser() user: CurrentUserPayload,
    @Param('agentId') agentId: string,
    @Body() dto: SuspendAgentDto,
  ) {
    return this.adminService.suspendAgent(agentId, dto, { id: user.id, name: user.username })
  }

  // ========================
  // ========================
  // v2 Creator 治理
  // ========================

  @Post('creators/:agentId/growth-score')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '更新创作者五维 Growth Score 与 L1–L5 等级' })
  async setCreatorGrowthScore(
    @CurrentUser() user: CurrentUserPayload,
    @Param('agentId') agentId: string,
    @Body() dto: SetCreatorGrowthScoreDto,
  ) {
    return this.adminService.setCreatorGrowthScore(agentId, dto, { id: user.id, name: user.username })
  }

  @Post('creators/:agentId/blacklist')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '将创作者列入黑名单，并留下不可变审计证据' })
  async blacklistCreator(
    @CurrentUser() user: CurrentUserPayload,
    @Param('agentId') agentId: string,
    @Body() dto: BlacklistCreatorDto,
  ) {
    return this.adminService.blacklistCreator(agentId, dto, { id: user.id, name: user.username })
  }
  // 风控
  // ========================

  @Get('fraud/alerts')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: '风控告警列表' })
  async listFraudAlerts(
    @Query('severity') severity: string,
    @Query('page') page: number,
    @Query('pageSize') pageSize: number,
  ) {
    return this.adminService.listFraudAlerts(severity, page, pageSize)
  }

  @Post('fraud/alerts/:alertId/resolve')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '处理风控告警' })
  async resolveFraudAlert(
    @CurrentUser() user: CurrentUserPayload,
    @Param('alertId') alertId: string,
    @Body() body: ResolveFraudAlertDto,
  ) {
    return this.adminService.resolveFraudAlert(alertId, body, { id: user.id, name: user.username })
  }

  // ========================
  // ========================
  // v2 活动经济性账本
  // ========================

  @Get('finance/campaign-economics')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'v2 活动经济性：商家增长收入、创作者履约成本与毛利' })
  async getCampaignEconomics(@Query() query: CampaignEconomicsQueryDto) {
    return { code: 0, data: await this.financialLedgerService.getEconomics(query) }
  }

  @Post('finance/campaign-entries')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'v2 记账：创作者打款必须按履约成本（COGS）登记' })
  async recordCampaignEntry(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateFinancialLedgerEntryDto,
  ) {
    return { code: 0, data: await this.financialLedgerService.record(dto, { id: user.id }) }
  }
  // 财务对账
  // ========================

  @Get('finance/reconciliations')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: '平台收入待对账流水' })
  async listFinanceReconciliations(
    @Query('status') status?: 'pending' | 'settled',
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
  ) {
    return this.adminService.listFinanceReconciliations(status, page, pageSize)
  }

  @Post('finance/reconciliations/:revenueId/settle')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '确认平台收入对账' })
  async settleFinanceReconciliation(@Param('revenueId') revenueId: string) {
    return this.adminService.settleFinanceReconciliation(revenueId)
  }

  // ========================
  // 内容审核
  // ========================

  @Get('contents/moderation')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'AI 内容审核队列' })
  async listContentModeration(
    @Query('status') status?: string,
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
  ) {
    return this.adminService.listContentModeration(status, page, pageSize)
  }

  @Post('contents/:contentId/moderation')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '提交 AI 内容审核结论' })
  async moderateContent(
    @CurrentUser() user: CurrentUserPayload,
    @Param('contentId') contentId: string,
    @Body() body: ModerateContentDto,
  ) {
    return this.adminService.moderateContent(contentId, body, { id: user.id, name: user.username })
  }

  @Get('audit-logs')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: '人工处理审计日志' })
  async listAuditLogs(
    @Query('targetType') targetType?: string,
    @Query('targetId') targetId?: string,
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
  ) {
    return this.adminService.listAuditLogs(targetType, targetId, page, pageSize)
  }
}
