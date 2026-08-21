// ============================================================
// Customer Module
// Attribution (365-day lock) + Coupon claiming
// ============================================================

import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'

import { Customer } from './entities/customer.entity'
import { CustomerAttribution } from './entities/customer-attribution.entity'
import { CustomerCoupon } from './entities/customer-coupon.entity'
import { Coupon } from '../campaign/entities/coupon.entity'
import { SharingAgent } from '../agent/entities/sharing-agent.entity'
import { Store } from '../merchant/entities/store.entity'

import { CustomerController } from './customer.controller'
import { CustomerService } from './customer.service'

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Customer,
      CustomerAttribution,
      CustomerCoupon,
      Coupon,
      SharingAgent,
      Store,
    ]),
  ],
  controllers: [CustomerController],
  providers: [CustomerService],
  exports: [CustomerService],
})
export class CustomerModule {}
