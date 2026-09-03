import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { UserRole } from '@ai-auto/shared'

import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { Roles } from '../auth/decorators/roles.decorator'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { MerchantAgentBindingService } from './merchant-agent-binding.service'
import {
  AuditAgentDto,
  CreateInviteDto,
  ListBindingAgentsDto,
  UnbindAgentDto,
} from './dto/agent-binding.dto'

@ApiTags('商家分享员管理 API')
@Controller('merchant/agents')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class MerchantAgentBindingController {
  constructor(private readonly bindingService: MerchantAgentBindingService) {}

  @Post('invites')
  @Roles(UserRole.MERCHANT_ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '创建分享员招募链接' })
  createInvite(@CurrentUser() user: { merchantId: string }, @Body() dto: CreateInviteDto) {
    return this.bindingService.createInviteLink(user.merchantId, dto)
  }

  @Get()
  @Roles(UserRole.MERCHANT_ADMIN, UserRole.MERCHANT_STAFF)
  @ApiOperation({ summary: '查看商家分享员绑定列表' })
  list(@CurrentUser() user: { merchantId: string }, @Query() query: ListBindingAgentsDto) {
    return this.bindingService.listBindingAgents(user.merchantId, query)
  }

  @Post(':bindingId/audit')
  @Roles(UserRole.MERCHANT_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '审核分享员绑定申请' })
  audit(
    @CurrentUser() user: { merchantId: string },
    @Param('bindingId') bindingId: string,
    @Body() dto: AuditAgentDto,
  ) {
    return this.bindingService.auditAgentBinding(user.merchantId, bindingId, dto)
  }

  @Delete(':bindingId')
  @Roles(UserRole.MERCHANT_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '解绑分享员' })
  unbind(
    @CurrentUser() user: { merchantId: string },
    @Param('bindingId') bindingId: string,
    @Body() dto: UnbindAgentDto,
  ) {
    return this.bindingService.unbindAgent(user.merchantId, bindingId, dto)
  }
}
