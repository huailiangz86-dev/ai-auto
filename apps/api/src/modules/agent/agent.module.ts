// ============================================================
// Agent Module
// ============================================================

import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { HttpModule } from '@nestjs/axios'

import { SharingAgent } from './entities/sharing-agent.entity'
import { AgentPlatformAccount } from './entities/agent-platform-account.entity'
import { CustomerAttribution } from '../customer/entities/customer-attribution.entity'
import { Commission } from '../commission/entities/commission.entity'

import { AgentReputationService } from './agent-reputation.service'
import { PlatformOAuthService } from './platform-oauth.service'
import { AgentController } from './agent.controller'
import { IncomeStatementController } from './income-statement.controller'
import { IncomeStatementService } from './income-statement.service'

@Module({
  imports: [
    HttpModule,
    TypeOrmModule.forFeature([SharingAgent, AgentPlatformAccount, CustomerAttribution, Commission]),
  ],
  controllers: [AgentController, IncomeStatementController],
  providers: [AgentReputationService, PlatformOAuthService, IncomeStatementService],
  // Re-export the TypeORM dynamic module rather than entity classes. Entity
  // classes are not Nest providers and exporting them prevents application
  // bootstrap before TypeORM can synchronize the test schema.
  exports: [AgentReputationService, PlatformOAuthService, IncomeStatementService, TypeOrmModule],
})
export class AgentModule {}
