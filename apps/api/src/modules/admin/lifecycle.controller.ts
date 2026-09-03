import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { UserRole } from '@ai-auto/shared'
import { CurrentUser, CurrentUserPayload } from '../auth/decorators/current-user.decorator'
import { Roles } from '../auth/decorators/roles.decorator'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import {
  CreateLifecycleNoteDto,
  LifecycleReasonDto,
  ListLifecycleSubjectsDto,
  RestoreLifecycleDto,
  SendLifecycleNotificationDto,
  SetCreatorTaskLimitDto,
  SetCreatorTypeDto,
  SetLifecycleTagsDto,
} from './dto/lifecycle.dto'
import { LifecycleService } from './lifecycle.service'

@ApiTags('运营生命周期 API')
@Controller('admin/lifecycle')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class LifecycleController {
  constructor(private readonly lifecycleService: LifecycleService) {}
  private actor(user: CurrentUserPayload) { return { id: user.id, name: user.username } }

  @Get('merchants') @ApiOperation({ summary: '商户管理：全量商户生命周期列表' })
  listMerchants(@Query() query: ListLifecycleSubjectsDto) { return this.lifecycleService.listMerchants(query) }
  @Get('merchants/:merchantId') @ApiOperation({ summary: '商户管理：经营档案与操作记录' })
  getMerchant(@Param('merchantId') merchantId: string) { return this.lifecycleService.getMerchantDetail(merchantId) }
  @Post('merchants/:merchantId/freeze') @HttpCode(HttpStatus.OK)
  freezeMerchant(@CurrentUser() user: CurrentUserPayload, @Param('merchantId') merchantId: string, @Body() dto: LifecycleReasonDto) { return this.lifecycleService.freezeMerchant(merchantId, dto, this.actor(user)) }
  @Post('merchants/:merchantId/restore') @HttpCode(HttpStatus.OK)
  restoreMerchant(@CurrentUser() user: CurrentUserPayload, @Param('merchantId') merchantId: string, @Body() dto: RestoreLifecycleDto) { return this.lifecycleService.restoreMerchant(merchantId, dto, this.actor(user)) }
  @Post('merchants/:merchantId/tags') @HttpCode(HttpStatus.OK)
  setMerchantTags(@CurrentUser() user: CurrentUserPayload, @Param('merchantId') merchantId: string, @Body() dto: SetLifecycleTagsDto) { return this.lifecycleService.setMerchantTags(merchantId, dto, this.actor(user)) }
  @Post('merchants/:merchantId/notes') @HttpCode(HttpStatus.CREATED)
  addMerchantNote(@CurrentUser() user: CurrentUserPayload, @Param('merchantId') merchantId: string, @Body() dto: CreateLifecycleNoteDto) { return this.lifecycleService.createNote('merchant', merchantId, dto, this.actor(user)) }
  @Post('merchants/:merchantId/notifications') @HttpCode(HttpStatus.CREATED)
  notifyMerchant(@CurrentUser() user: CurrentUserPayload, @Param('merchantId') merchantId: string, @Body() dto: SendLifecycleNotificationDto) { return this.lifecycleService.notify('merchant', merchantId, dto, this.actor(user)) }

  @Get('creators') @ApiOperation({ summary: '达人管理：全量达人生命周期列表' })
  listCreators(@Query() query: ListLifecycleSubjectsDto) { return this.lifecycleService.listCreators(query) }
  @Get('creators/:creatorId') @ApiOperation({ summary: '达人管理：档案、履约转化与合作记录' })
  getCreator(@Param('creatorId') creatorId: string) { return this.lifecycleService.getCreatorDetail(creatorId) }
  @Post('creators/:creatorId/freeze') @HttpCode(HttpStatus.OK)
  freezeCreator(@CurrentUser() user: CurrentUserPayload, @Param('creatorId') creatorId: string, @Body() dto: LifecycleReasonDto) { return this.lifecycleService.freezeCreator(creatorId, dto, this.actor(user)) }
  @Post('creators/:creatorId/restore') @HttpCode(HttpStatus.OK)
  restoreCreator(@CurrentUser() user: CurrentUserPayload, @Param('creatorId') creatorId: string, @Body() dto: RestoreLifecycleDto) { return this.lifecycleService.restoreCreator(creatorId, dto, this.actor(user)) }
  @Post('creators/:creatorId/tags') @HttpCode(HttpStatus.OK)
  setCreatorTags(@CurrentUser() user: CurrentUserPayload, @Param('creatorId') creatorId: string, @Body() dto: SetLifecycleTagsDto) { return this.lifecycleService.setCreatorTags(creatorId, dto, this.actor(user)) }
  @Post('creators/:creatorId/type') @HttpCode(HttpStatus.OK)
  setCreatorType(@CurrentUser() user: CurrentUserPayload, @Param('creatorId') creatorId: string, @Body() dto: SetCreatorTypeDto) { return this.lifecycleService.setCreatorType(creatorId, dto.agentType, this.actor(user)) }
  @Post('creators/:creatorId/task-limit') @HttpCode(HttpStatus.OK)
  setCreatorTaskLimit(@CurrentUser() user: CurrentUserPayload, @Param('creatorId') creatorId: string, @Body() dto: SetCreatorTaskLimitDto) { return this.lifecycleService.setCreatorTaskLimit(creatorId, dto, this.actor(user)) }
  @Post('creators/:creatorId/notes') @HttpCode(HttpStatus.CREATED)
  addCreatorNote(@CurrentUser() user: CurrentUserPayload, @Param('creatorId') creatorId: string, @Body() dto: CreateLifecycleNoteDto) { return this.lifecycleService.createNote('creator', creatorId, dto, this.actor(user)) }
  @Post('creators/:creatorId/notifications') @HttpCode(HttpStatus.CREATED)
  notifyCreator(@CurrentUser() user: CurrentUserPayload, @Param('creatorId') creatorId: string, @Body() dto: SendLifecycleNotificationDto) { return this.lifecycleService.notify('creator', creatorId, dto, this.actor(user)) }

  @Get('relationships') @ApiOperation({ summary: '商户—达人绑定、合作质量与限制状态' })
  listRelationships(@Query('merchantId') merchantId?: string, @Query('creatorId') creatorId?: string) { return this.lifecycleService.listRelationships(merchantId, creatorId) }
  @Post('relationships/:bindingId/restrict') @HttpCode(HttpStatus.OK)
  restrictRelationship(@CurrentUser() user: CurrentUserPayload, @Param('bindingId') bindingId: string, @Body() dto: LifecycleReasonDto) { return this.lifecycleService.restrictRelationship(bindingId, dto, this.actor(user)) }
  @Post('relationships/:bindingId/release') @HttpCode(HttpStatus.OK)
  releaseRelationship(@CurrentUser() user: CurrentUserPayload, @Param('bindingId') bindingId: string, @Body() dto: RestoreLifecycleDto) { return this.lifecycleService.releaseRelationship(bindingId, dto, this.actor(user)) }
  @Post('relationships/:bindingId/unbind') @HttpCode(HttpStatus.OK)
  unbindRelationship(@CurrentUser() user: CurrentUserPayload, @Param('bindingId') bindingId: string, @Body() dto: LifecycleReasonDto) { return this.lifecycleService.unbindRelationship(bindingId, dto, this.actor(user)) }
  @Post('relationships/:bindingId/notes') @HttpCode(HttpStatus.CREATED)
  addRelationshipNote(@CurrentUser() user: CurrentUserPayload, @Param('bindingId') bindingId: string, @Body() dto: CreateLifecycleNoteDto) { return this.lifecycleService.createNote('relationship', bindingId, dto, this.actor(user)) }
}
