// ============================================================
// AI auto - Campaign Controller
// Marketing campaign and coupon management
// ============================================================

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
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

import { CampaignService } from './campaign.service'
import {
  CreateCampaignDto,
  CreateCouponDto,
  UpdateCampaignDto,
  UpdateCouponDto,
  ListCampaignsDto,
  ListCouponsDto,
} from './dto/campaign.dto'

@ApiTags('营销活动 API')
@Controller('v1/merchant/campaigns')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CampaignController {
  constructor(private readonly campaignService: CampaignService) {}

  // ========================
  // 活动管理
  // ========================

  @Post()
  @Roles(UserRole.MERCHANT_ADMIN)
  @ApiOperation({ summary: '创建活动' })
  @HttpCode(HttpStatus.CREATED)
  async createCampaign(
    @CurrentUser() user: { merchantId: string },
    @Body() dto: CreateCampaignDto,
  ) {
    return this.campaignService.createCampaign(user.merchantId, dto)
  }

  @Get()
  @Roles(UserRole.MERCHANT_ADMIN, UserRole.MERCHANT_STAFF)
  @ApiOperation({ summary: '活动列表' })
  async listCampaigns(
    @CurrentUser() user: { merchantId: string },
    @Query() query: ListCampaignsDto,
  ) {
    return this.campaignService.listCampaigns(user.merchantId, query)
  }

  @Get(':campaignId')
  @Roles(UserRole.MERCHANT_ADMIN, UserRole.MERCHANT_STAFF)
  @ApiOperation({ summary: '活动详情（含优惠券列表）' })
  async getCampaign(
    @CurrentUser() user: { merchantId: string },
    @Param('campaignId') campaignId: string,
  ) {
    return this.campaignService.getCampaign(user.merchantId, campaignId)
  }

  @Put(':campaignId')
  @Roles(UserRole.MERCHANT_ADMIN)
  @ApiOperation({ summary: '更新活动' })
  async updateCampaign(
    @CurrentUser() user: { merchantId: string },
    @Param('campaignId') campaignId: string,
    @Body() dto: UpdateCampaignDto,
  ) {
    await this.campaignService.updateCampaign(user.merchantId, campaignId, dto)
    return { code: 0, message: '更新成功' }
  }

  @Post(':campaignId/publish')
  @Roles(UserRole.MERCHANT_ADMIN)
  @ApiOperation({ summary: '发布活动' })
  @HttpCode(HttpStatus.OK)
  async publishCampaign(
    @CurrentUser() user: { merchantId: string },
    @Param('campaignId') campaignId: string,
  ) {
    return this.campaignService.publishCampaign(user.merchantId, campaignId)
  }

  @Post(':campaignId/pause')
  @Roles(UserRole.MERCHANT_ADMIN)
  @ApiOperation({ summary: '暂停活动' })
  @HttpCode(HttpStatus.OK)
  async pauseCampaign(
    @CurrentUser() user: { merchantId: string },
    @Param('campaignId') campaignId: string,
  ) {
    return this.campaignService.pauseCampaign(user.merchantId, campaignId)
  }

  @Post(':campaignId/terminate')
  @Roles(UserRole.MERCHANT_ADMIN)
  @ApiOperation({ summary: '终止活动' })
  @HttpCode(HttpStatus.OK)
  async terminateCampaign(
    @CurrentUser() user: { merchantId: string },
    @Param('campaignId') campaignId: string,
  ) {
    return this.campaignService.terminateCampaign(user.merchantId, campaignId)
  }

  // ========================
  // 优惠券管理
  // ========================

  @Post(':campaignId/coupons')
  @Roles(UserRole.MERCHANT_ADMIN)
  @ApiOperation({ summary: '添加优惠券' })
  @HttpCode(HttpStatus.CREATED)
  async createCoupon(
    @CurrentUser() user: { merchantId: string },
    @Param('campaignId') campaignId: string,
    @Body() dto: CreateCouponDto,
  ) {
    return this.campaignService.createCoupon(user.merchantId, campaignId, dto)
  }

  @Get(':campaignId/coupons')
  @Roles(UserRole.MERCHANT_ADMIN, UserRole.MERCHANT_STAFF)
  @ApiOperation({ summary: '优惠券列表' })
  async listCoupons(
    @CurrentUser() user: { merchantId: string },
    @Param('campaignId') campaignId: string,
    @Query() query: ListCouponsDto,
  ) {
    return this.campaignService.listCoupons(user.merchantId, {
      ...query,
      campaignId,
    })
  }

  @Get('coupons/all')
  @Roles(UserRole.MERCHANT_ADMIN, UserRole.MERCHANT_STAFF)
  @ApiOperation({ summary: '全部优惠券列表（跨活动）' })
  async listAllCoupons(
    @CurrentUser() user: { merchantId: string },
    @Query() query: ListCouponsDto,
  ) {
    return this.campaignService.listCoupons(user.merchantId, query)
  }

  @Get('coupons/:couponId')
  @Roles(UserRole.MERCHANT_ADMIN, UserRole.MERCHANT_STAFF)
  @ApiOperation({ summary: '优惠券详情' })
  async getCoupon(
    @CurrentUser() user: { merchantId: string },
    @Param('couponId') couponId: string,
  ) {
    return this.campaignService.getCoupon(user.merchantId, couponId)
  }

  @Put('coupons/:couponId')
  @Roles(UserRole.MERCHANT_ADMIN)
  @ApiOperation({ summary: '更新优惠券' })
  async updateCoupon(
    @CurrentUser() user: { merchantId: string },
    @Param('couponId') couponId: string,
    @Body() dto: UpdateCouponDto,
  ) {
    await this.campaignService.updateCoupon(user.merchantId, couponId, dto)
    return { code: 0, message: '更新成功' }
  }

  @Delete('coupons/:couponId')
  @Roles(UserRole.MERCHANT_ADMIN)
  @ApiOperation({ summary: '删除优惠券' })
  async deleteCoupon(
    @CurrentUser() user: { merchantId: string },
    @Param('couponId') couponId: string,
  ) {
    await this.campaignService.deleteCoupon(user.merchantId, couponId)
    return { code: 0, message: '删除成功' }
  }
}
