// ============================================================
// Content Module
// AI-generated content: copywriting, video, poster
// ============================================================

import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { HttpModule } from '@nestjs/axios'

import { Content } from './entities/content.entity'
import { ContentPublication } from './entities/content-publication.entity'
import { AgentWallet } from '../agent/entities/agent-wallet.entity'
import { AgentPlatformAccount } from '../agent/entities/agent-platform-account.entity'
import { CreatorTask } from '../task/entities/growth-task.entity'
import { TaskModule } from '../task/task.module'

import { CopywritingService } from './copywriting.service'
import { VideoService } from './video.service'
import { PosterService } from './poster.service'
import { DistributionService } from './distribution.service'
import { DouyinService } from './douyin.service'
import { CreatorStudioService } from './creator-studio.service'
import { KuaishouService } from './kuaishou.service'
import { ContentController } from './content.controller'

import { AIBridgeModule } from '../ai-bridge/ai-bridge.module'
import { RedisModule } from '../redis/redis.module'

@Module({
  imports: [
    TypeOrmModule.forFeature([Content, ContentPublication, AgentWallet, AgentPlatformAccount, CreatorTask]),
    TaskModule,
    HttpModule,
    AIBridgeModule,
    RedisModule,
  ],
  controllers: [ContentController],
  providers: [
    CopywritingService,
    VideoService,
    CreatorStudioService,
    PosterService,
    DistributionService,
    DouyinService,
    KuaishouService,
  ],
  exports: [
    CopywritingService,
    CreatorStudioService,
    VideoService,
    PosterService,
    DistributionService,
    DouyinService,
    KuaishouService,
  ],
})
export class ContentModule {}
