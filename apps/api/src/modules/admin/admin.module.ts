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
import { Redemption } from '../commission/entities/redemption.entity'
import { Commission } from '../commission/entities/commission.entity'
import { PlatformRevenue } from '../merchant/entities/platform-revenue.entity'
import { Content } from '../content/entities/content.entity'
import { MerchantAgentBinding } from '../merchant/entities/merchant-agent-binding.entity'
import { FinancialLedgerEntry } from './entities/financial-ledger-entry.entity'
import { LifecycleNote } from './entities/lifecycle-note.entity'

import { AdminController } from './admin.controller'
import { LifecycleController } from './lifecycle.controller'
import { AdminService } from './admin.service'
import { FinancialLedgerService } from './financial-ledger.service'
import { LifecycleService } from './lifecycle.service'

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Merchant,
      Store,
      Subscription,
      SharingAgent,
      AuditLog,
      FraudAlert,
      Redemption,
      Commission,
      PlatformRevenue,
      Content,
      MerchantAgentBinding,
      FinancialLedgerEntry,
      LifecycleNote,
    ]),
  ],
  controllers: [AdminController, LifecycleController],
  providers: [AdminService, FinancialLedgerService, LifecycleService],
  exports: [AdminService],
})
export class AdminModule {}
