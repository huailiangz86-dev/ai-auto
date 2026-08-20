// ============================================================
// AI auto - Commission Controller
// Commission calculation, settlement, and withdrawal endpoints
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
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { Roles } from '../auth/decorators/roles.decorator'
import { UserRole } from '@ai-auto/shared'

import { CommissionService } from './commission.service'
import { SettlementService } from './settlement.service'
import { CreateWithdrawalDto, ListWithdrawalsDto } from './dto/withdrawal.dto'

@ApiTags('佣金 API')
@Controller('v1/commission')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CommissionController {
  constructor(
    private readonly commissionService: CommissionService,
    private readonly settlementService: SettlementService,
  ) {}

  // ========================
  // 佣金计算
  // ========================

  @Post('calculate')
  @Roles(UserRole.MERCHANT_ADMIN, UserRole.ADMIN)
  @ApiOperation({ summary: '触发佣金计算（核销回调后）' })
  @HttpCode(HttpStatus.OK)
  async calculateCommission(@Body() body: { redemptionId: string; idempotencyKey?: string }) {
    return this.commissionService.calculateCommission(body.redemptionId, body.idempotencyKey)
  }

  // ========================
  // 钱包
  // ========================

  @Get('wallet')
  @Roles(UserRole.AGENT)
  @ApiOperation({ summary: '查询我的钱包余额' })
  async getMyWallet(@CurrentUser() user: { agentId: string }) {
    return this.commissionService.getAgentWallet(user.agentId)
  }

  @Get('commissions')
  @Roles(UserRole.AGENT)
  @ApiOperation({ summary: '查询我的佣金流水' })
  async listMyCommissions(
    @CurrentUser() user: { agentId: string },
    @Query('page') page = 1,
    @Query('pageSize') pageSize = 20,
  ) {
    return this.commissionService.listAgentCommissions(user.agentId, page, pageSize)
  }

  // ========================
  // 提现
  // ========================

  @Post('withdrawals')
  @Roles(UserRole.AGENT)
  @ApiOperation({ summary: '申请提现（最低 ¥10）' })
  @HttpCode(HttpStatus.CREATED)
  async createWithdrawal(
    @CurrentUser() user: { agentId: string },
    @Body() dto: CreateWithdrawalDto,
  ) {
    return this.settlementService.createWithdrawal(user.agentId, dto)
  }

  @Get('withdrawals')
  @Roles(UserRole.AGENT)
  @ApiOperation({ summary: '提现记录列表' })
  async listWithdrawals(
    @CurrentUser() user: { agentId: string },
    @Query() query: ListWithdrawalsDto,
  ) {
    return this.settlementService.listWithdrawals(user.agentId, query)
  }

  @Get('withdrawals/:withdrawalId')
  @Roles(UserRole.AGENT)
  @ApiOperation({ summary: '提现详情' })
  async getWithdrawal(
    @CurrentUser() user: { agentId: string },
    @Param('withdrawalId') withdrawalId: string,
  ) {
    return this.settlementService.getWithdrawal(user.agentId, withdrawalId)
  }
}
