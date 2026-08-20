// ============================================================
// Merchant Module
// ============================================================

import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'

import { Merchant } from './entities/merchant.entity'
import { Store } from './entities/store.entity'
import { Subscription } from './entities/subscription.entity'
import { AuditLog } from '../admin/entities/audit-log.entity'
import { CommissionBudget } from './entities/commission-budget.entity'
import { BudgetTransaction } from './entities/commission-budget.entity'
import { PlatformRevenue } from './entities/platform-revenue.entity'

import { MerchantController } from './merchant.controller'
import { MerchantService } from './merchant.service'
import { MerchantWalletController } from './merchant-wallet.controller'
import { MerchantWalletService } from './merchant-wallet.service'

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Merchant,
      Store,
      Subscription,
      AuditLog,
      CommissionBudget,
      BudgetTransaction,
      PlatformRevenue,
    ]),
  ],
  controllers: [MerchantController, MerchantWalletController],
  providers: [MerchantService, MerchantWalletService],
  exports: [MerchantService, MerchantWalletService],
})
export class MerchantModule {}
