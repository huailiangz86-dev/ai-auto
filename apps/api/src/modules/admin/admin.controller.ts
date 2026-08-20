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

import { AdminService } from './admin.service'
import {
  ApproveMerchantDto,
  RejectMerchantDto,
  SuspendAgentDto,
  ListPendingMerchantsDto,
  ListPendingAgentsDto,
} from './dto/admin-audit.dto'

@ApiTags('运营后台 API')
@Controller('v1/admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

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
  async approveMerchant(@Param('merchantId') merchantId: string, @Body() dto: ApproveMerchantDto) {
    return this.adminService.approveMerchant(merchantId, dto)
  }

  @Post('merchants/:merchantId/reject')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: '审核拒绝商户' })
  @HttpCode(HttpStatus.OK)
  async rejectMerchant(@Param('merchantId') merchantId: string, @Body() dto: RejectMerchantDto) {
    return this.adminService.rejectMerchant(merchantId, dto)
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
  async approveAgent(@Param('agentId') agentId: string) {
    return this.adminService.approveAgent(agentId)
  }

  @Post('agents/:agentId/reject')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: '审核拒绝分享员' })
  @HttpCode(HttpStatus.OK)
  async rejectAgent(@Param('agentId') agentId: string, @Body() body: { reason: string }) {
    return this.adminService.rejectAgent(agentId, body.reason)
  }

  @Post('agents/:agentId/suspend')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: '封禁分享员' })
  @HttpCode(HttpStatus.OK)
  async suspendAgent(@Param('agentId') agentId: string, @Body() dto: SuspendAgentDto) {
    return this.adminService.suspendAgent(agentId, dto)
  }

  // ========================
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
}
