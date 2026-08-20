// ============================================================
// Merchant Module
// ============================================================

import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'

import { Merchant } from './entities/merchant.entity'
import { Store } from './entities/store.entity'
import { Subscription } from './entities/subscription.entity'
import { AuditLog } from '../admin/entities/audit-log.entity'

import { MerchantController } from './merchant.controller'
import { MerchantService } from './merchant.service'

@Module({
  imports: [TypeOrmModule.forFeature([Merchant, Store, Subscription, AuditLog])],
  controllers: [MerchantController],
  providers: [MerchantService],
  exports: [MerchantService],
})
export class MerchantModule {}
