// ============================================================
// Content Module
// AI-generated content: copywriting, video, poster
// ============================================================

import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'

import { Content } from './entities/content.entity'
import { ContentPublication } from './entities/content-publication.entity'
import { AgentWallet } from '../agent/entities/agent-wallet.entity'
import { AgentPlatformAccount } from '../agent/entities/agent-platform-account.entity'

import { CopywritingService } from './copywriting.service'
import { VideoService } from './video.service'
import { PosterService } from './poster.service'
import { DistributionService } from './distribution.service'
import { DouyinService } from './douyin.service'
import { ContentController } from './content.controller'

import { AIBridgeModule } from '../ai-bridge/ai-bridge.module'
import { RedisModule } from '../redis/redis.module'

@Module({
  imports: [
    TypeOrmModule.forFeature([Content, ContentPublication, AgentWallet, AgentPlatformAccount]),
    AIBridgeModule,
    RedisModule,
  ],
  controllers: [ContentController],
  providers: [CopywritingService, VideoService, PosterService, DistributionService, DouyinService],
  exports: [CopywritingService, VideoService, PosterService, DistributionService, DouyinService],
})
export class ContentModule {}
