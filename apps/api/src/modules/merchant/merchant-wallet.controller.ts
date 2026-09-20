// ============================================================
// AI auto - Merchant Wallet Controller
// Commission budget: topup / freeze / unfreeze / transactions
// ============================================================

import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Body,
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

import { MerchantWalletService } from './merchant-wallet.service'
import { WalletPaymentService } from './wallet-payment.service'
import { TopupBudgetDto, FreezeBudgetDto, ListTransactionsDto } from './dto/wallet.dto'

@ApiTags('商家钱包 API')
@Controller('merchant/wallet')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class MerchantWalletController {
  constructor(
    private readonly walletService: MerchantWalletService,
    private readonly walletPaymentService: WalletPaymentService,
  ) {}

  // ========================
  // 钱包查询
  // ========================

  @Get()
  @Roles(UserRole.MERCHANT_ADMIN, UserRole.MERCHANT_STAFF)
  @ApiOperation({ summary: '查询我的钱包余额' })
  async getWallet(@CurrentUser() user: { merchantId: string }) {
    return this.walletService.getWallet(user.merchantId)
  }

  // ========================
  // 充值
  // ========================

  @Post('topup')
  @Roles(UserRole.MERCHANT_ADMIN)
  @ApiOperation({ summary: '兼容旧入口：创建佣金预算充值支付订单' })
  @HttpCode(HttpStatus.OK)
  async topupBudget(@CurrentUser() user: { merchantId: string }, @Body() dto: TopupBudgetDto) {
    if (dto.method !== 'alipay' && dto.method !== 'wechatpay') {
      throw new BadRequestException('请使用支付宝或微信支付充值')
    }

    // Keep the legacy route for existing dashboard builds, but route it through
    // the payment-order flow so this endpoint can never credit the wallet directly.
    return this.walletPaymentService.createCheckout(user.merchantId, {
      amount: dto.amount,
      provider: dto.method,
    })
  }

  // ========================
  // 冻结/解冻
  // ========================

  @Post('freeze')
  @Roles(UserRole.MERCHANT_ADMIN)
  @ApiOperation({ summary: '冻结活动预算' })
  @HttpCode(HttpStatus.CREATED)
  async freezeBudget(@CurrentUser() user: { merchantId: string }, @Body() dto: FreezeBudgetDto) {
    return this.walletService.freezeBudget(user.merchantId, dto)
  }

  @Post('unfreeze')
  @Roles(UserRole.MERCHANT_ADMIN)
  @ApiOperation({ summary: '解冻预算（活动取消）' })
  @HttpCode(HttpStatus.OK)
  async unfreezeBudget(
    @CurrentUser() user: { merchantId: string },
    @Body() body: { campaignId: string; amount: number; description?: string },
  ) {
    return this.walletService.unfreezeBudget(
      user.merchantId,
      body.campaignId,
      body.amount,
      false,
      body.description,
    )
  }

  // ========================
  // 流水
  // ========================

  @Get('transactions')
  @Roles(UserRole.MERCHANT_ADMIN, UserRole.MERCHANT_STAFF)
  @ApiOperation({ summary: '钱包流水明细' })
  async listTransactions(
    @CurrentUser() user: { merchantId: string },
    @Query() query: ListTransactionsDto,
  ) {
    return this.walletService.listTransactions(user.merchantId, query)
  }

  // ========================
  // 统计
  // ========================

  @Get('stats')
  @Roles(UserRole.MERCHANT_ADMIN, UserRole.ADMIN)
  @ApiOperation({ summary: '商家收入统计' })
  async getStats(
    @CurrentUser() user: { merchantId: string },
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.walletService.getRevenueStats(user.merchantId, startDate, endDate)
  }
}
