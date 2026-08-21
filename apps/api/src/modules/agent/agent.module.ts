// ============================================================
// Agent Module
// ============================================================

import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'

import { SharingAgent } from './entities/sharing-agent.entity'
import { AgentPlatformAccount } from './entities/agent-platform-account.entity'
import { CustomerAttribution } from '../customer/entities/customer-attribution.entity'

import { AgentReputationService } from './agent-reputation.service'
import { PlatformOAuthService } from './platform-oauth.service'
import { AgentController } from './agent.controller'

@Module({
  imports: [TypeOrmModule.forFeature([SharingAgent, AgentPlatformAccount, CustomerAttribution])],
  controllers: [AgentController],
  providers: [AgentReputationService, PlatformOAuthService],
  exports: [AgentReputationService, PlatformOAuthService, SharingAgent, AgentPlatformAccount],
})
export class AgentModule {}
