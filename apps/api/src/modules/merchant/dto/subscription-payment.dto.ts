import { IsIn, IsInt } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'
import type { SubscriptionPaymentProvider } from '../entities/subscription-payment-order.entity'

export class CreateSubscriptionPaymentDto {
  @ApiProperty({ enum: ['wechatpay', 'alipay'] })
  @IsIn(['wechatpay', 'alipay'])
  provider!: SubscriptionPaymentProvider

  @ApiProperty({ enum: [1, 12], description: '订阅时长（月）' })
  @IsInt()
  @IsIn([1, 12])
  planMonths!: 1 | 12
}
