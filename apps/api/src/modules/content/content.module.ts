// ============================================================
// Content Module
// AI-generated content: copywriting, video, poster
// ============================================================

import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'

import { Content } from './entities/content.entity'
import { AgentWallet } from '../agent/entities/agent-wallet.entity'
import { AgentPlatformAccount } from '../agent/entities/agent-platform-account.entity'

import { CopywritingService } from './copywriting.service'
import { ContentController } from './content.controller'

import { AIBridgeModule } from '../ai-bridge/ai-bridge.module'

@Module({
  imports: [TypeOrmModule.forFeature([Content, AgentWallet, AgentPlatformAccount]), AIBridgeModule],
  controllers: [ContentController],
  providers: [CopywritingService],
  exports: [CopywritingService],
})
export class ContentModule {}
