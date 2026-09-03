// ============================================================
// AI auto - Merchant Controller
// Handles merchant registration, profile, stores, and subscription
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
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { Roles } from '../auth/decorators/roles.decorator'
import { UserRole } from '@ai-auto/shared'

import { MerchantService } from './merchant.service'
import { RegisterMerchantDto, UpdateMerchantProfileDto } from './dto/merchant-registration.dto'
import { CreateStoreDto, UpdateStoreDto, ListStoresDto } from './dto/store.dto'

@ApiTags('商户 API')
@Controller('merchant')
export class MerchantController {
  constructor(private readonly merchantService: MerchantService) {}

  // ========================
  // 注册（无需认证）
  // ========================

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '提交入驻申请' })
  @ApiResponse({ status: 201, description: '入驻申请已提交' })
  @ApiResponse({ status: 409, description: '手机号已注册' })
  async register(@Body() dto: RegisterMerchantDto) {
    return this.merchantService.register(dto)
  }

  // ========================
  // 商户信息（需认证）
  // ========================

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取商户信息' })
  async getProfile(@CurrentUser() user: { merchantId: string }) {
    return this.merchantService.getProfile(user.merchantId)
  }

  @Put('profile')
  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.MERCHANT_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: '更新商户信息' })
  async updateProfile(
    @CurrentUser() user: { merchantId: string },
    @Body() dto: UpdateMerchantProfileDto,
  ) {
    await this.merchantService.updateProfile(user.merchantId, dto)
    return { code: 0, message: '更新成功' }
  }

  // ========================
  // 门店管理
  // ========================

  @Get('stores')
  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.MERCHANT_ADMIN, UserRole.MERCHANT_STAFF)
  @ApiBearerAuth()
  @ApiOperation({ summary: '门店列表' })
  async listStores(@CurrentUser() user: { merchantId: string }, @Query() query: ListStoresDto) {
    return this.merchantService.listStores(user.merchantId, query.page, query.pageSize)
  }

  @Post('stores')
  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.MERCHANT_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: '新增门店' })
  async createStore(@CurrentUser() user: { merchantId: string }, @Body() dto: CreateStoreDto) {
    return this.merchantService.createStore(user.merchantId, dto)
  }

  @Put('stores/:storeId')
  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.MERCHANT_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: '更新门店' })
  async updateStore(
    @CurrentUser() user: { merchantId: string },
    @Param('storeId') storeId: string,
    @Body() dto: UpdateStoreDto,
  ) {
    await this.merchantService.updateStore(user.merchantId, storeId, dto)
    return { code: 0, message: '更新成功' }
  }

  @Delete('stores/:storeId')
  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.MERCHANT_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: '删除门店' })
  async deleteStore(
    @CurrentUser() user: { merchantId: string },
    @Param('storeId') storeId: string,
  ) {
    await this.merchantService.deleteStore(user.merchantId, storeId)
    return { code: 0, message: '删除成功' }
  }

  // ========================
  // 订阅管理
  // ========================

  @Get('subscription')
  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.MERCHANT_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取订阅信息' })
  async getSubscription(@CurrentUser() user: { merchantId: string }) {
    return this.merchantService.getSubscription(user.merchantId)
  }

  @Post('subscription/renew')
  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.MERCHANT_ADMIN)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '订阅续费' })
  async renewSubscription(@CurrentUser() _user: { merchantId: string }) {
    // TODO: 接入支付后实现
    return { code: 0, message: '续费功能开发中' }
  }
}
