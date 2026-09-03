import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { UserRole } from '@ai-auto/shared'
import { CurrentUser, CurrentUserPayload } from '../auth/decorators/current-user.decorator'
import { Roles } from '../auth/decorators/roles.decorator'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { CreateCreatorTaskAppealDto, CreatorTaskListQueryDto, SubmitCreatorVerificationDto, UpdateCreatorProfileDto, VerifyCreatorTaskPayoutDto } from './dto/creator-portal.dto'
import { CreatorPortalService } from './creator-portal.service'

@ApiTags('V2 创作者门户')
@Controller('creator')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.AGENT)
@ApiBearerAuth()
export class CreatorPortalController {
  constructor(private readonly service: CreatorPortalService) {}
  @Get('profile') profile(@CurrentUser() user: CurrentUserPayload) { return this.service.profile(user.agentId!) }
  @Patch('profile') updateProfile(@CurrentUser() user: CurrentUserPayload, @Body() dto: UpdateCreatorProfileDto) { return this.service.updateProfile(user.agentId!, dto) }
  @Post('verification') @ApiOperation({ summary: '提交实名认证资料并进入审核队列' }) verification(@CurrentUser() user: CurrentUserPayload, @Body() dto: SubmitCreatorVerificationDto) { return this.service.submitVerification(user.agentId!, dto) }
  @Get('today') @ApiOperation({ summary: '今日已资金确认的邀约、任务和待结算报酬' }) today(@CurrentUser() user: CurrentUserPayload) { return this.service.today(user.agentId!) }
  @Get('tasks') tasks(@CurrentUser() user: CurrentUserPayload, @Query() query: CreatorTaskListQueryDto) { return this.service.listTasks(user.agentId!, query) }
  @Get('tasks/:creatorTaskId') task(@CurrentUser() user: CurrentUserPayload, @Param('creatorTaskId') id: string) { return this.service.task(user.agentId!, id) }
  @Get('earnings') earnings(@CurrentUser() user: CurrentUserPayload) { return this.service.earnings(user.agentId!) }
  @Post('tasks/:creatorTaskId/appeals') appeal(@CurrentUser() user: CurrentUserPayload, @Param('creatorTaskId') id: string, @Body() dto: CreateCreatorTaskAppealDto) { return this.service.appeal(user.agentId!, id, dto) }
  @Get('appeals') appeals(@CurrentUser() user: CurrentUserPayload) { return this.service.listAppeals(user.agentId!) }
}

@ApiTags('V2 创作者报酬运营')
@Controller('admin/creator-tasks')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
@ApiBearerAuth()
export class AdminCreatorPayoutController {
  constructor(private readonly service: CreatorPortalService) {}
  @Post(':creatorTaskId/payout/verify') verify(@CurrentUser() user: CurrentUserPayload, @Param('creatorTaskId') id: string, @Body() dto: VerifyCreatorTaskPayoutDto) { return this.service.verifyPayout(id, user.id, dto) }
}
