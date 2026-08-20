// ============================================================
// Commission Module
// Commission calculation engine + settlement + wallet management
// ============================================================

import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'

import { Commission } from './entities/commission.entity'
import { Redemption } from './entities/redemption.entity'
import { Withdrawal } from './entities/withdrawal.entity'
import { AgentWallet } from '../agent/entities/agent-wallet.entity'

import { CommissionController } from './commission.controller'
import { CommissionService } from './commission.service'
import { SettlementService } from './settlement.service'

@Module({
  imports: [TypeOrmModule.forFeature([Commission, Redemption, Withdrawal, AgentWallet])],
  controllers: [CommissionController],
  providers: [CommissionService, SettlementService],
  exports: [CommissionService, SettlementService],
})
export class CommissionModule {}
