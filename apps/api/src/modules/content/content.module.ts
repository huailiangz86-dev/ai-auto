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
import { VideoService } from './video.service'
import { ContentController } from './content.controller'

import { AIBridgeModule } from '../ai-bridge/ai-bridge.module'
import { RedisModule } from '../redis/redis.module'

@Module({
  imports: [
    TypeOrmModule.forFeature([Content, AgentWallet, AgentPlatformAccount]),
    AIBridgeModule,
    RedisModule,
  ],
  controllers: [ContentController],
  providers: [CopywritingService, VideoService],
  exports: [CopywritingService, VideoService],
})
export class ContentModule {}
