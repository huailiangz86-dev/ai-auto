// ============================================================
// Admin Module
// ============================================================

import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'

import { Merchant } from '../merchant/entities/merchant.entity'
import { Store } from '../merchant/entities/store.entity'
import { Subscription } from '../merchant/entities/subscription.entity'
import { SharingAgent } from '../agent/entities/sharing-agent.entity'
import { AuditLog } from './entities/audit-log.entity'
import { FraudAlert } from './entities/fraud-alert.entity'

import { AdminController } from './admin.controller'
import { AdminService } from './admin.service'

@Module({
  imports: [
    TypeOrmModule.forFeature([Merchant, Store, Subscription, SharingAgent, AuditLog, FraudAlert]),
  ],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
