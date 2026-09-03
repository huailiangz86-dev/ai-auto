import { Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { CurrentUser, CurrentUserPayload } from '../auth/decorators/current-user.decorator'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { NotificationService } from './notification.service'

@ApiTags('站内通知 API')
@Controller('notifications')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  @ApiOperation({ summary: '获取当前用户的通知列表与未读数' })
  list(
    @CurrentUser() user: CurrentUserPayload,
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
  ) {
    return this.notificationService.list(user.id, user.role, page, pageSize)
  }

  @Patch(':notificationId/read')
  @ApiOperation({ summary: '标记当前用户的一条通知已读' })
  read(@CurrentUser() user: CurrentUserPayload, @Param('notificationId') notificationId: string) {
    return this.notificationService.markRead(user.id, user.role, notificationId)
  }
}
