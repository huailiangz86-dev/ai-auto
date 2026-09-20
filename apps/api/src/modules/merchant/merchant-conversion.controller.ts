import { Controller, Get, Query, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { UserRole } from '@ai-auto/shared'
import { CurrentUser, CurrentUserPayload } from '../auth/decorators/current-user.decorator'
import { Roles } from '../auth/decorators/roles.decorator'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { MerchantConversionCenterQueryDto } from './dto/merchant-conversion.dto'
import { MerchantConversionService } from './merchant-conversion.service'

@ApiTags('商家内容与转化中心')
@Controller('merchant/conversion-center')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.MERCHANT_ADMIN, UserRole.MERCHANT_STAFF)
@ApiBearerAuth()
export class MerchantConversionController {
  constructor(private readonly service: MerchantConversionService) {}

  @Get()
  @ApiOperation({ summary: '查看内容审核、优惠券转化、归因与佣金的脱敏工作台' })
  dashboard(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: MerchantConversionCenterQueryDto,
  ) {
    return this.service.dashboard(user.merchantId, query)
  }
}
