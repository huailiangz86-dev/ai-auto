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
import { RiskRule } from './entities/risk-rule.entity'
import { CreatorTaskPayout } from '../task/entities/creator-task-payout.entity'

import { AdminController } from './admin.controller'
import { LifecycleController } from './lifecycle.controller'
import { AdminService } from './admin.service'
import { FinancialLedgerService } from './financial-ledger.service'
import { LifecycleService } from './lifecycle.service'
import { RiskRuleController } from './risk-rule.controller'
import { RiskRuleService } from './risk-rule.service'

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
      RiskRule,
      CreatorTaskPayout,
    ]),
  ],
  controllers: [AdminController, LifecycleController, RiskRuleController],
  providers: [AdminService, FinancialLedgerService, LifecycleService, RiskRuleService],
  exports: [AdminService],
})
export class AdminModule {}
