import { IsIn, IsNumber, Min } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'
import type { WalletPaymentProvider } from '../entities/wallet-payment-order.entity'

export class CreateWalletTopupDto {
  @ApiProperty({ description: '充值金额（元）', minimum: 1, example: 1000 })
  @IsNumber()
  @Min(1)
  amount!: number

  @ApiProperty({ enum: ['wechatpay', 'alipay'] })
  @IsIn(['wechatpay', 'alipay'])
  provider!: WalletPaymentProvider
}
