import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { UserRole } from '@ai-auto/shared'
import { CurrentUser, CurrentUserPayload } from '../auth/decorators/current-user.decorator'
import { Roles } from '../auth/decorators/roles.decorator'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import {
  ConsumeCampaignCreditsDto,
  CreateCreatorTaskDto,
  CreateGrowthTaskDto,
  PublishCreatorTaskDto,
  ReviewCreatorTaskDto,
  ResolveRiskHoldDto,
  OperationsQueueQueryDto,
  TaskReasonDto,
} from './dto/growth-task.dto'
import { CreatorMatchQueryDto, InviteMatchedCreatorsDto } from './dto/creator-matching.dto'
import { CreatorMatchingService } from './creator-matching.service'
import { GrowthTaskService } from './growth-task.service'
import { OperationsWorkbenchService } from './operations-workbench.service'

@ApiTags('V2 商户 Growth Task')
@Controller('merchant/growth-tasks')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.MERCHANT_ADMIN)
@ApiBearerAuth()
export class MerchantGrowthTaskController {
  constructor(private readonly service: GrowthTaskService, private readonly creatorMatching: CreatorMatchingService) {}

  @Post()
  @ApiOperation({ summary: '创建 Growth Task 草稿' })
  create(@CurrentUser() user: CurrentUserPayload, @Body() dto: CreateGrowthTaskDto) {
    return this.service.createGrowthTask(user.merchantId!, dto)
  }
  @Post(':growthTaskId/ready-for-review')
  ready(@CurrentUser() user: CurrentUserPayload, @Param('growthTaskId') id: string) {
    return this.service.moveGrowthTask(user.merchantId!, id, 'ready_for_review')
  }
  @Post(':growthTaskId/activate')
  activate(@CurrentUser() user: CurrentUserPayload, @Param('growthTaskId') id: string) {
    return this.service.moveGrowthTask(user.merchantId!, id, 'active')
  }
  @Post(':growthTaskId/pause')
  pause(@CurrentUser() user: CurrentUserPayload, @Param('growthTaskId') id: string) {
    return this.service.moveGrowthTask(user.merchantId!, id, 'paused')
  }
  @Post(':growthTaskId/complete')
  complete(@CurrentUser() user: CurrentUserPayload, @Param('growthTaskId') id: string) {
    return this.service.moveGrowthTask(user.merchantId!, id, 'completed')
  }
  @Post(':growthTaskId/cancel')
  cancel(@CurrentUser() user: CurrentUserPayload, @Param('growthTaskId') id: string) {
    return this.service.moveGrowthTask(user.merchantId!, id, 'cancelled')
  }
  @Post(':growthTaskId/creator-tasks')
  @ApiOperation({ summary: '从活跃 Growth Task 创建创作者任务并预留补偿和 Credits' })
  createCreator(
    @CurrentUser() user: CurrentUserPayload,
    @Param('growthTaskId') id: string,
    @Body() dto: CreateCreatorTaskDto,
  ) {
    return this.service.createCreatorTask(user.merchantId!, id, dto)
  }
  @Get(':growthTaskId/creator-matches')
  @ApiOperation({ summary: '查看可解释的创作者匹配候选；仅返回通过治理、渠道和可用性校验的创作者' })
  matches(
    @CurrentUser() user: CurrentUserPayload,
    @Param('growthTaskId') id: string,
    @Query() query: CreatorMatchQueryDto,
  ) {
    return this.creatorMatching.listMatches(user.merchantId!, id, query)
  }
  @Post(':growthTaskId/creator-invitations')
  @ApiOperation({ summary: '按已确认的匹配候选批量发出商业创作邀约，并锁定对应预算' })
  inviteMatched(
    @CurrentUser() user: CurrentUserPayload,
    @Param('growthTaskId') id: string,
    @Body() dto: InviteMatchedCreatorsDto,
  ) {
    return this.creatorMatching.invite(user.merchantId!, id, dto)
  }
  @Post('creator-tasks/:creatorTaskId/matching')
  matching(@CurrentUser() user: CurrentUserPayload, @Param('creatorTaskId') id: string) {
    return this.service.moveCreatorTaskForMerchant(user.merchantId!, id, 'matching')
  }
  @Post('creator-tasks/:creatorTaskId/invite')
  invite(@CurrentUser() user: CurrentUserPayload, @Param('creatorTaskId') id: string) {
    return this.service.moveCreatorTaskForMerchant(user.merchantId!, id, 'invited')
  }
  @Post('creator-tasks/:creatorTaskId/cancel')
  cancelCreator(@CurrentUser() user: CurrentUserPayload, @Param('creatorTaskId') id: string) {
    return this.service.moveCreatorTaskForMerchant(user.merchantId!, id, 'cancelled')
  }
}

@ApiTags('V2 创作者任务')
@Controller('creator/tasks')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.AGENT)
@ApiBearerAuth()
export class CreatorTaskController {
  constructor(private readonly service: GrowthTaskService) {}

  @Post(':creatorTaskId/accept')
  accept(@CurrentUser() user: CurrentUserPayload, @Param('creatorTaskId') id: string) {
    return this.service.moveCreatorTaskForCreator(user.agentId!, id, 'accepted')
  }
  @Post(':creatorTaskId/start')
  start(@CurrentUser() user: CurrentUserPayload, @Param('creatorTaskId') id: string) {
    return this.service.moveCreatorTaskForCreator(user.agentId!, id, 'creating')
  }
  @Post(':creatorTaskId/submit')
  submit(@CurrentUser() user: CurrentUserPayload, @Param('creatorTaskId') id: string) {
    return this.service.moveCreatorTaskForCreator(user.agentId!, id, 'submitted')
  }
  @Post(':creatorTaskId/publish')
  publish(
    @CurrentUser() user: CurrentUserPayload,
    @Param('creatorTaskId') id: string,
    @Body() dto: PublishCreatorTaskDto,
  ) {
    return this.service.moveCreatorTaskForCreator(user.agentId!, id, 'published', dto.publishedUrl)
  }
  @Post(':creatorTaskId/tracking')
  tracking(@CurrentUser() user: CurrentUserPayload, @Param('creatorTaskId') id: string) {
    return this.service.moveCreatorTaskForCreator(user.agentId!, id, 'tracking')
  }
  @Post(':creatorTaskId/complete')
  complete(@CurrentUser() user: CurrentUserPayload, @Param('creatorTaskId') id: string) {
    return this.service.moveCreatorTaskForCreator(user.agentId!, id, 'completed')
  }
  @Post(':creatorTaskId/campaign-credits/consume')
  consume(
    @CurrentUser() user: CurrentUserPayload,
    @Param('creatorTaskId') id: string,
    @Body() dto: ConsumeCampaignCreditsDto,
  ) {
    return this.service.consumeCampaignCredits(user.agentId!, id, dto.amount, dto.sourceReference)
  }
}

@ApiTags('V2 创作者任务运营')
@Controller('admin/creator-tasks')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
@ApiBearerAuth()
export class AdminCreatorTaskController {
  constructor(
    private readonly service: GrowthTaskService,
    private readonly workbench: OperationsWorkbenchService,
  ) {}

  @Get('review-queue')
  @ApiOperation({ summary: '运营工作台：创作者任务审核队列（支持 Campaign/商户/创作者筛选和分页）' })
  reviewQueue(@Query() query: OperationsQueueQueryDto) {
    return this.workbench.listReviewQueue(query)
  }

  @Get('risk-hold-queue')
  @ApiOperation({ summary: '运营工作台：风控暂停队列（支持筛选和分页）' })
  riskHoldQueue(@Query() query: OperationsQueueQueryDto) {
    return this.workbench.listRiskQueue(query)
  }

  @Get(':creatorTaskId/workbench')
  @ApiOperation({ summary: '运营工作台：任务经济明细、内容证据、审计记录与通知关联视图' })
  workbenchDetail(@Param('creatorTaskId') id: string) {
    return this.workbench.getTaskDetail(id)
  }

  @Post(':creatorTaskId/review')
  review(
    @CurrentUser() user: CurrentUserPayload,
    @Param('creatorTaskId') id: string,
    @Body() dto: ReviewCreatorTaskDto,
  ) {
    return this.service.reviewCreatorTask(id, user.id, dto.decision, dto.reason)
  }
  @Post(':creatorTaskId/risk-hold')
  hold(
    @CurrentUser() user: CurrentUserPayload,
    @Param('creatorTaskId') id: string,
    @Body() dto: TaskReasonDto,
  ) {
    return this.service.holdForRisk(id, user.id, dto.reason)
  }
  @Post(':creatorTaskId/risk-resolution')
  resolve(
    @CurrentUser() user: CurrentUserPayload,
    @Param('creatorTaskId') id: string,
    @Body() body: ResolveRiskHoldDto,
  ) {
    return this.service.resolveRiskHold(id, user.id, body.action, body.reason)
  }
}
