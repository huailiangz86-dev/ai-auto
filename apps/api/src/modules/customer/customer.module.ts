// ============================================================
// Customer Module
// Attribution (365-day lock) + Coupon claiming
// ============================================================

import { Module } from '@nestjs/common'
import { HttpModule } from '@nestjs/axios'
import { TypeOrmModule } from '@nestjs/typeorm'

import { Customer } from './entities/customer.entity'
import { CustomerAttribution } from './entities/customer-attribution.entity'
import { CustomerCoupon } from './entities/customer-coupon.entity'
import { MerchantCustomerLock } from './entities/merchant-customer-lock.entity'
import { CustomerDataExportRequest } from './entities/customer-data-export-request.entity'
import { Coupon } from '../campaign/entities/coupon.entity'
import { Redemption } from '../commission/entities/redemption.entity'
import { SharingAgent } from '../agent/entities/sharing-agent.entity'
import { Store } from '../merchant/entities/store.entity'
import { AgentWallet } from '../agent/entities/agent-wallet.entity'
import { AuthModule } from '../auth/auth.module'
import { ContentModule } from '../content/content.module'
import { GamificationModule } from '../gamification/gamification.module'
import { TaskModule } from '../task/task.module'

import { CustomerController } from './customer.controller'
import { CustomerAuthService } from './customer-auth.service'
import { CustomerShareService } from './customer-share.service'
import { CustomerService } from './customer.service'
import { CustomerCreationService } from './customer-creation.service'

@Module({
  imports: [
    HttpModule,
    AuthModule,
    ContentModule,
    GamificationModule,
    TaskModule,
    TypeOrmModule.forFeature([
      Customer,
      CustomerAttribution,
      CustomerCoupon,
      MerchantCustomerLock,
      CustomerDataExportRequest,
      Coupon,
      Redemption,
      SharingAgent,
      Store,
      AgentWallet,
    ]),
  ],
  controllers: [CustomerController],
  providers: [CustomerService, CustomerShareService, CustomerAuthService, CustomerCreationService],
  exports: [CustomerService, CustomerShareService, CustomerAuthService, CustomerCreationService],
})
export class CustomerModule {}
