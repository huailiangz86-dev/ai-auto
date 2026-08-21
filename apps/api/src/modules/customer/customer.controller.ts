// ============================================================
// AI auto - Customer Controller
// Attribution (365-day lock) + Coupon claiming endpoints
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

import { CustomerService } from './customer.service'
import {
  CreateAttributionDto,
  ClaimCouponDto,
  RegisterCustomerDto,
  ListCustomerCouponsDto,
  DiscoverNearbyDto,
  ScanClaimDto,
  SearchMerchantsDto,
} from './dto/customer.dto'

@ApiTags('客户 API')
@Controller('v1/customer')
export class CustomerController {
  constructor(private readonly customerService: CustomerService) {}

  // ========================
  // 归属管理（C端/分享员）
  // ========================

  @Post('attribution')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '记录客户归属（首击锁定）' })
  async createAttribution(@Body() dto: CreateAttributionDto) {
    return this.customerService.createAttribution(dto)
  }

  @Get('attribution/:customerId')
  @ApiOperation({ summary: '获取客户当前归属' })
  async getAttribution(@Param('customerId') customerId: string) {
    return this.customerService.getActiveAttribution(customerId)
  }

  @Get('attribution/:customerId/history')
  @ApiOperation({ summary: '获取客户归属历史' })
  async getAttributionHistory(@Param('customerId') customerId: string) {
    return this.customerService.getAttributionHistory(customerId)
  }

  // ========================
  // 客户注册（C端）
  // ========================

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '客户注册（微信授权/手机号）' })
  async register(@Body() dto: RegisterCustomerDto) {
    return this.customerService.registerCustomer(dto)
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.CUSTOMER)
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取客户信息' })
  async getProfile(@CurrentUser() user: { customerId: string }) {
    return this.customerService.getCustomer(user.customerId)
  }

  // ========================
  // 领券（C端）
  // ========================

  @Post('coupons/claim')
  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.CUSTOMER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'C端领券' })
  @HttpCode(HttpStatus.CREATED)
  async claimCoupon(@CurrentUser() user: { customerId: string }, @Body() dto: ClaimCouponDto) {
    return this.customerService.claimCoupon(user.customerId, dto)
  }

  @Get('coupons')
  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.CUSTOMER)
  @ApiBearerAuth()
  @ApiOperation({ summary: '我的优惠券列表' })
  async listMyCoupons(
    @CurrentUser() user: { customerId: string },
    @Query() query: ListCustomerCouponsDto,
  ) {
    return this.customerService.listCustomerCoupons(user.customerId, query)
  }

  // ========================
  // 领券发现（C端 - STORY-AI-016）
  // ========================

  @Get('discover/nearby')
  @ApiOperation({ summary: 'LBS 发现附近商家优惠' })
  async discoverNearby(@Query() query: DiscoverNearbyDto) {
    return this.customerService.discoverNearbyCoupons(query)
  }

  @Post('coupons/scan-claim')
  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.CUSTOMER)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '扫码领券' })
  async scanClaimCoupon(@CurrentUser() user: { customerId: string }, @Body() dto: ScanClaimDto) {
    return this.customerService.scanClaimCoupon(user.customerId, dto)
  }

  @Get('search')
  @ApiOperation({ summary: '搜索商家/品类/关键词' })
  async searchMerchants(@Query() query: SearchMerchantsDto) {
    return this.customerService.searchMerchants(query)
  }
}
