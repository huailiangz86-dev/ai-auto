import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { ContentStatus, PlatformType } from '@ai-auto/shared'
import { Repository } from 'typeorm'
import { AIBridgeService } from '../ai-bridge/ai-bridge.service'
import { CreatorTask } from '../task/entities/growth-task.entity'
import { GrowthTaskService } from '../task/growth-task.service'
import {
  CreatorStudioGenerateDto,
  CreatorStudioPublishAdviceDto,
  CreatorStudioRewriteDto,
  CreatorStudioScoreDto,
} from './dto/creator-studio.dto'
import { Content } from './entities/content.entity'

export const CREATOR_STUDIO_CREDIT_COSTS = {
  generate: 1,
  rewrite: 0.5,
  score: 0.5,
  publish_advice: 0.5,
} as const

type StudioAction = keyof typeof CREATOR_STUDIO_CREDIT_COSTS

@Injectable()
export class CreatorStudioService {
  constructor(
    @InjectRepository(Content) private readonly contentRepo: Repository<Content>,
    @InjectRepository(CreatorTask) private readonly creatorTaskRepo: Repository<CreatorTask>,
    private readonly aiBridge: AIBridgeService,
    private readonly growthTaskService: GrowthTaskService,
  ) {}

  generate(agentId: string, dto: CreatorStudioGenerateDto) {
    return this.run(agentId, dto.creatorTaskId, 'generate', dto.sourceReference, dto.platform, {
      tone: dto.tone,
      instructions: dto.instructions,
    })
  }

  rewrite(agentId: string, dto: CreatorStudioRewriteDto) {
    return this.run(agentId, dto.creatorTaskId, 'rewrite', dto.sourceReference, dto.platform, {
      content: dto.content,
      instructions: dto.instructions,
    })
  }

  score(agentId: string, dto: CreatorStudioScoreDto) {
    return this.run(agentId, dto.creatorTaskId, 'score', dto.sourceReference, dto.platform, {
      content: dto.content,
    })
  }

  publishAdvice(agentId: string, dto: CreatorStudioPublishAdviceDto) {
    return this.run(agentId, dto.creatorTaskId, 'publish_advice', dto.sourceReference, dto.platform, {
      content: dto.content,
      publishMode: dto.publishMode ?? 'immediate',
    })
  }

  private async run(
    agentId: string,
    creatorTaskId: string,
    action: StudioAction,
    sourceReference: string,
    platform: PlatformType | undefined,
    input: Record<string, unknown>,
  ) {
    const task = await this.creatorTaskRepo.findOne({ where: { id: creatorTaskId, creatorId: agentId } })
    if (!task) throw new NotFoundException('创作者任务不存在')

    const credits = await this.growthTaskService.consumeCampaignCredits(
      agentId,
      task.id,
      CREATOR_STUDIO_CREDIT_COSTS[action],
      `creator-studio:${action}:${sourceReference}`,
    )
    const result = await this.aiBridge.runCreatorStudio({
      action,
      creator_task_id: task.id,
      campaign_id: task.campaignId ?? '',
      agent_id: agentId,
      task_brief: task.brief,
      platform: platform?.toString(),
      ...input,
    })
    const evidence = await this.contentRepo.save(
      this.contentRepo.create({
        agentId,
        campaignId: task.campaignId ?? null,
        creatorTaskId: task.id,
        contentType: 'creator_studio',
        targetPlatform: platform ?? null,
        status: ContentStatus.DRAFT,
        contentData: { action, input, result, sourceReference, campaignCredits: credits },
        aiModel: result?.model ?? null,
        costDeducted: true,
      }),
    )
    return { contentId: evidence.id, action, result, campaignCredits: credits }
  }
}
