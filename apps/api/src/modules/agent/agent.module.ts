// ============================================================
// Agent Module
// ============================================================

import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'

import { SharingAgent } from './entities/sharing-agent.entity'
import { AgentPlatformAccount } from './entities/agent-platform-account.entity'

@Module({
  imports: [TypeOrmModule.forFeature([SharingAgent, AgentPlatformAccount])],
  controllers: [],
  providers: [],
  exports: [SharingAgent, AgentPlatformAccount],
})
export class AgentModule {}
