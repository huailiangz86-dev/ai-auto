// ============================================================
// Commission Module
// Commission calculation engine + wallet management
// ============================================================

import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'

import { Commission } from './entities/commission.entity'
import { Redemption } from './entities/redemption.entity'
import { AgentWallet } from '../agent/entities/agent-wallet.entity'

import { CommissionController } from './commission.controller'
import { CommissionService } from './commission.service'

@Module({
  imports: [TypeOrmModule.forFeature([Commission, Redemption, AgentWallet])],
  controllers: [CommissionController],
  providers: [CommissionService],
  exports: [CommissionService],
})
export class CommissionModule {}
