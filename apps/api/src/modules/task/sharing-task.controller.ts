import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { UserRole } from '@ai-auto/shared'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { Roles } from '../auth/decorators/roles.decorator'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { CreateSharingTaskDto } from './dto/sharing-task.dto'
import { SharingTaskService } from './sharing-task.service'

@ApiTags('商户任务广场')
@Controller('merchant/tasks')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.MERCHANT_ADMIN)
@ApiBearerAuth()
export class MerchantTaskController {
  constructor(private readonly taskService: SharingTaskService) {}
  @Post() @ApiOperation({ summary: '发布分享任务' }) create(
    @CurrentUser() user: { merchantId: string },
    @Body() dto: CreateSharingTaskDto,
  ) {
    return this.taskService.create(user.merchantId, dto)
  }
  @Get() @ApiOperation({ summary: '商家的任务列表' }) list(
    @CurrentUser() user: { merchantId: string },
  ) {
    return this.taskService.listMerchantTasks(user.merchantId)
  }
}

@ApiTags('分享员任务广场')
@Controller('agent/tasks')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.AGENT)
@ApiBearerAuth()
export class AgentTaskController {
  constructor(private readonly taskService: SharingTaskService) {}
  @Get() @ApiOperation({ summary: '按信誉、绑定账号及历史表现推荐任务' }) list(
    @CurrentUser() user: { agentId: string },
  ) {
    return this.taskService.recommend(user.agentId)
  }
  @Get('mine') @ApiOperation({ summary: '我的已接任务与漏斗进度' }) mine(
    @CurrentUser() user: { agentId: string },
  ) {
    return this.taskService.myTasks(user.agentId)
  }
  @Post(':taskId/accept') @ApiOperation({ summary: '接取分享任务' }) accept(
    @CurrentUser() user: { agentId: string },
    @Param('taskId') taskId: string,
  ) {
    return this.taskService.accept(user.agentId, taskId)
  }
  @Post(':taskId/views') @ApiOperation({ summary: '记录任务内容浏览' }) view(
    @CurrentUser() user: { agentId: string },
    @Param('taskId') taskId: string,
  ) {
    return this.taskService.recordView(user.agentId, taskId)
  }
}
