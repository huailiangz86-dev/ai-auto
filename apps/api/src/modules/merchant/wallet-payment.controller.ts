import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { Buffer } from 'node:buffer'
import { Request } from 'express'
import { UserRole } from '@ai-auto/shared'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { Public } from '../common/decorators/public.decorator'
import { Roles } from '../auth/decorators/roles.decorator'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { CreateWalletTopupDto } from './dto/wallet-payment.dto'
import { WalletPaymentService } from './wallet-payment.service'

@ApiTags('商家钱包支付 API')
@Controller('merchant/wallet')
export class WalletPaymentController {
  constructor(private readonly payments: WalletPaymentService) {}

  @Post('topup/checkout')
  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.MERCHANT_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: '创建佣金预算充值支付订单' })
  createCheckout(@CurrentUser() user: { merchantId: string }, @Body() dto: CreateWalletTopupDto) {
    return this.payments.createCheckout(user.merchantId, dto)
  }

  @Get('topup/orders/:orderNo')
  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.MERCHANT_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: '查询佣金预算充值支付状态' })
  getOrder(@CurrentUser() user: { merchantId: string }, @Param('orderNo') orderNo: string) {
    return this.payments.getOrder(user.merchantId, orderNo)
  }

  @Post('topup/payments/alipay/notify')
  @Public()
  @ApiOperation({ summary: '支付宝佣金预算充值异步通知' })
  async alipayNotify(@Body() params: Record<string, string>) {
    return (await this.payments.handleAlipayNotification(params)) ? 'success' : 'fail'
  }

  @Post('topup/payments/wechatpay/notify')
  @Public()
  @ApiOperation({ summary: '微信支付佣金预算充值异步通知' })
  async wechatNotify(@Req() request: Request & { rawBody?: Buffer }) {
    const accepted = await this.payments.handleWechatNotification(
      request.headers,
      request.rawBody ?? Buffer.from(JSON.stringify(request.body ?? {})),
    )
    return accepted
      ? { code: 'SUCCESS', message: '' }
      : { code: 'FAIL', message: 'signature verification failed' }
  }
}
