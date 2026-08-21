// ============================================================
// Agent Module
// ============================================================

import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'

import { SharingAgent } from './entities/sharing-agent.entity'
import { AgentPlatformAccount } from './entities/agent-platform-account.entity'
import { CustomerAttribution } from '../customer/entities/customer-attribution.entity'

import { AgentReputationService } from './agent-reputation.service'

@Module({
  imports: [TypeOrmModule.forFeature([SharingAgent, AgentPlatformAccount, CustomerAttribution])],
  controllers: [],
  providers: [AgentReputationService],
  exports: [AgentReputationService, SharingAgent, AgentPlatformAccount],
})
export class AgentModule {}
