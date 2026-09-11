import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { UserRole } from '@ai-auto/shared'
import { CurrentUser, CurrentUserPayload } from '../auth/decorators/current-user.decorator'
import { Roles } from '../auth/decorators/roles.decorator'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import {
  CreateCreatorTaskAppealDto,
  CreateMerchantTaskAppealDto,
  CreatorTaskListQueryDto,
  ListRecoveryReceivablesDto,
  ListCreatorTaskAppealsDto,
  ResolveCreatorTaskAppealDto,
  SubmitCreatorVerificationDto,
  UpdateCreatorProfileDto,
  VerifyCreatorTaskPayoutDto,
} from './dto/creator-portal.dto'
import { CreatorPortalService } from './creator-portal.service'

@ApiTags('V2 创作者门户')
@Controller('creator')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.AGENT)
@ApiBearerAuth()
export class CreatorPortalController {
  constructor(private readonly service: CreatorPortalService) {}
  @Get('profile') profile(@CurrentUser() user: CurrentUserPayload) {
    return this.service.profile(user.agentId)
  }
  @Patch('profile') updateProfile(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: UpdateCreatorProfileDto,
  ) {
    return this.service.updateProfile(user.agentId, dto)
  }
  @Post('verification') @ApiOperation({ summary: '提交实名认证资料并进入审核队列' }) verification(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: SubmitCreatorVerificationDto,
  ) {
    return this.service.submitVerification(user.agentId, dto)
  }
  @Get('today') @ApiOperation({ summary: '今日已资金确认的邀约、任务和待结算报酬' }) today(
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.service.today(user.agentId)
  }
  @Get('tasks') tasks(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: CreatorTaskListQueryDto,
  ) {
    return this.service.listTasks(user.agentId, query)
  }
  @Get('tasks/:creatorTaskId') task(
    @CurrentUser() user: CurrentUserPayload,
    @Param('creatorTaskId') id: string,
  ) {
    return this.service.task(user.agentId, id)
  }
  @Get('earnings') earnings(@CurrentUser() user: CurrentUserPayload) {
    return this.service.earnings(user.agentId)
  }
  @Post('tasks/:creatorTaskId/appeals') appeal(
    @CurrentUser() user: CurrentUserPayload,
    @Param('creatorTaskId') id: string,
    @Body() dto: CreateCreatorTaskAppealDto,
  ) {
    return this.service.appeal(user.agentId, id, dto)
  }
  @Get('appeals') appeals(@CurrentUser() user: CurrentUserPayload) {
    return this.service.listAppeals(user.agentId)
  }
  @Get('appeals/:appealId')
  @ApiOperation({ summary: '创作者查看自己涉及的申诉详情与账务关联' })
  appealDetail(@CurrentUser() user: CurrentUserPayload, @Param('appealId') appealId: string) {
    return this.service.appealDetailForCreator(user.agentId, appealId)
  }
}

@ApiTags('V2 商户申诉')
@Controller('merchant')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.MERCHANT_ADMIN)
@ApiBearerAuth()
export class MerchantTaskAppealController {
  constructor(private readonly service: CreatorPortalService) {}

  @Get('appeals')
  @ApiOperation({ summary: '商户查看自己发起或涉及的任务申诉' })
  appeals(@CurrentUser() user: CurrentUserPayload) {
    return this.service.listAppealsForMerchant(user.merchantId!)
  }

  @Get('appeals/:appealId')
  @ApiOperation({ summary: '商户查看自己涉及的申诉详情与账务关联' })
  appealDetail(@CurrentUser() user: CurrentUserPayload, @Param('appealId') appealId: string) {
    return this.service.appealDetailForMerchant(user.merchantId!, appealId)
  }

  @Get('creator-tasks/appealable')
  @ApiOperation({ summary: '商户可在期限内申诉的已完成任务与已结算报酬' })
  appealableTasks(@CurrentUser() user: CurrentUserPayload) {
    return this.service.listAppealableTasksForMerchant(user.merchantId!)
  }

  @Post('creator-tasks/:creatorTaskId/appeals')
  @ApiOperation({ summary: '商户发起创作者任务或结算申诉（完成后 30 个自然日内）' })
  appeal(
    @CurrentUser() user: CurrentUserPayload,
    @Param('creatorTaskId') id: string,
    @Body() dto: CreateMerchantTaskAppealDto,
  ) {
    return this.service.appealForMerchant(user.merchantId!, id, dto)
  }
}

@ApiTags('V2 创作者报酬运营')
@Controller('admin/creator-tasks')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
@ApiBearerAuth()
export class AdminCreatorPayoutController {
  constructor(private readonly service: CreatorPortalService) {}
  @Post(':creatorTaskId/payout/verify') verify(
    @CurrentUser() user: CurrentUserPayload,
    @Param('creatorTaskId') id: string,
    @Body() dto: VerifyCreatorTaskPayoutDto,
  ) {
    return this.service.verifyPayout(id, user.id, dto)
  }
  @Get('appeals') @ApiOperation({ summary: '运营工作台：创作者任务与报酬申诉队列' }) appeals(
    @Query() query: ListCreatorTaskAppealsDto,
  ) {
    return this.service.listAppealsForOperations(query)
  }
  @Get('recovery-receivables')
  @ApiOperation({ summary: '运营工作台：待追回款列表；后续报酬结算自动抵扣' })
  recoveryReceivables(@Query() query: ListRecoveryReceivablesDto) {
    return this.service.listRecoveryReceivables(query)
  }
  @Get('recovery-reconciliation')
  @ApiOperation({ summary: '每日对账：钱包待追回余额、裁决待追回余额与后续结算抵扣流水校验' })
  recoveryReconciliation() {
    return this.service.recoveryReconciliation()
  }
  @Post('appeals/:appealId/resolve')
  @ApiOperation({ summary: '运营工作台：处理创作者任务与报酬申诉；金额裁决需二次确认' })
  resolveAppeal(
    @CurrentUser() user: CurrentUserPayload,
    @Param('appealId') appealId: string,
    @Body() dto: ResolveCreatorTaskAppealDto,
  ) {
    return this.service.resolveAppeal(appealId, { id: user.id, name: user.username }, dto)
  }
}
