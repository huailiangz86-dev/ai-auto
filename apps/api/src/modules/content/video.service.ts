// ============================================================
// AI auto - Video Service
// STORY-AI-021: AI 短视频生成
// 异步任务 → SSE 进度推送 → 钱包扣费
// ============================================================

import { Injectable, Logger, Inject, BadRequestException, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository, DataSource } from 'typeorm'
import Redis from 'ioredis'

import { Content } from './entities/content.entity'
import { AgentWallet } from '../agent/entities/agent-wallet.entity'
import { PlatformType, ContentStatus } from '@ai-auto/shared'

import { AIBridgeService } from '../ai-bridge/ai-bridge.service'
import { REDIS_CLIENT } from '../redis/redis.module'

// 视频 Token 计费：¥0.01 / token（视频更贵）
const VIDEO_TOKEN_PRICE_PER = 0.01
// 预估 token 消耗
const ESTIMATED_VIDEO_TOKENS = 1000

// SSE 频道前缀
const SSE_CHANNEL = 'video:progress:'
// 任务过期时间（小时）
const JOB_EXPIRY_HOURS = 24

export interface VideoJobStatus {
  contentId: string
  status: string // 'pending' | 'script' | 'voiceover' | 'synthesizing' | 'subtitles' | 'completed' | 'failed'
  progress: number // 0-100
  videoUrl?: string
  thumbnailUrl?: string
  script?: string
  error?: string
  createdAt: string
  updatedAt: string
}

@Injectable()
export class VideoService {
  private readonly logger = new Logger(VideoService.name)

  constructor(
    @InjectRepository(Content)
    private readonly contentRepo: Repository<Content>,
    @InjectRepository(AgentWallet)
    private readonly walletRepo: Repository<AgentWallet>,
    private readonly aiBridge: AIBridgeService,
    private readonly dataSource: DataSource,
    @Inject(REDIS_CLIENT)
    private readonly redis: Redis,
  ) {}

  // ========================
  // 视频生成（异步）
  // ========================

  /**
   * 创建视频生成任务
   * 返回任务ID，立即返回；实际生成异步执行
   */
  async generateVideo(
    agentId: string,
    params: {
      couponId?: string
      campaignId?: string
      platform: PlatformType
      durationSeconds?: number // 15-60
      voiceId?: string
    },
  ) {
    const { couponId, campaignId, platform, durationSeconds = 8 } = params

    if (![4, 8, 12].includes(durationSeconds)) {
      throw new BadRequestException({ code: 7004, message: '视频时长仅支持 4、8 或 12 秒' })
    }

    // 1. 钱包余额检查
    const wallet = await this.walletRepo.findOne({ where: { agentId } })
    if (!wallet) {
      throw new NotFoundException({ code: 7001, message: '钱包不存在' })
    }

    const estimatedCost = this.roundMoney(ESTIMATED_VIDEO_TOKENS * VIDEO_TOKEN_PRICE_PER)
    const currentBalance = Number(wallet.aiTokenBalance)
    if (currentBalance < estimatedCost) {
      throw new BadRequestException({
        code: 7002,
        message: `AI Token 余额不足。当前余额 ${currentBalance} 元，预估费用 ${estimatedCost} 元`,
      })
    }

    // 2. 构建追踪链接
    const trackingUrl = this.buildTrackingUrl(
      agentId,
      couponId ?? null,
      campaignId ?? null,
      platform,
    )

    // 3. 创建 Content 记录（pending 状态）
    const content = this.contentRepo.create({
      agentId,
      campaignId: campaignId ?? null,
      couponId: couponId ?? null,
      contentType: 'video',
      targetPlatform: platform,
      contentData: {
        durationSeconds,
        trackingUrl,
        jobStatus: 'pending',
        progress: 0,
      },
      status: ContentStatus.DRAFT,
      aiTokenCost: estimatedCost,
      costDeducted: false,
      trackingUrl,
    })
    const savedContent = await this.contentRepo.save(content)

    // 4. 发布 SSE 频道（允许客户端订阅）
    await this.redis.setex(`${SSE_CHANNEL}${savedContent.id}`, JOB_EXPIRY_HOURS * 3600, 'pending')

    // 5. 异步执行视频生成（不阻塞响应）
    this.processVideoJob(savedContent.id, agentId, {
      couponId,
      campaignId,
      platform,
      durationSeconds,
      trackingUrl,
    }).catch((err) => {
      this.logger.error({
        event: 'video_job_failed',
        contentId: savedContent.id,
        error: err.message,
      })
    })

    this.logger.log({ event: 'video_job_created', contentId: savedContent.id, agentId })

    return {
      contentId: savedContent.id,
      status: 'pending',
      progress: 0,
      estimatedCost,
      remainingBalance: currentBalance,
    }
  }

  /**
   * SSE 进度端点用的任务状态查询
   */
  async getJobStatus(contentId: string, agentId?: string): Promise<VideoJobStatus> {
    const content = await this.contentRepo.findOne({
      where: agentId ? { id: contentId, agentId } : { id: contentId },
    })
    if (!content) {
      throw new NotFoundException({ code: 8001, message: '视频任务不存在' })
    }

    let data = content.contentData as any
    if (data?.providerTaskId && !['completed', 'failed'].includes(data.jobStatus)) {
      try {
        const provider = await this.aiBridge.getVideoStatus(data.providerTaskId)
        const jobStatus =
          provider.status === 'ready'
            ? 'completed'
            : provider.status === 'failed'
              ? 'failed'
              : 'generating'
        const progress = Number(provider.progress ?? data.progress ?? 0)
        data = {
          ...data,
          jobStatus,
          progress,
          videoUrl: provider.video_url ?? null,
          error: provider.error ?? null,
        }
        await this.updateJobData(contentId, data)
        if (jobStatus === 'completed') {
          await this.contentRepo.update(
            { id: contentId },
            { status: ContentStatus.PUBLISHED, costDeducted: true },
          )
        } else if (jobStatus === 'failed') {
          await this.contentRepo.update({ id: contentId }, { status: ContentStatus.FAILED })
        }
        await this.publishProgress(contentId, {
          status: jobStatus,
          progress,
          videoUrl: data.videoUrl,
          error: data.error,
        })
      } catch (error) {
        this.logger.warn({ event: 'video_status_refresh_failed', contentId, error: String(error) })
      }
    }
    return {
      contentId: content.id,
      status: data?.jobStatus ?? 'pending',
      progress: data?.progress ?? 0,
      videoUrl: data?.videoUrl ?? null,
      thumbnailUrl: data?.thumbnailUrl ?? null,
      script: data?.script ?? null,
      error: data?.error ?? null,
      createdAt: content.createdAt?.toISOString() ?? new Date().toISOString(),
      updatedAt: content.updatedAt?.toISOString() ?? new Date().toISOString(),
    }
  }

  /**
   * SSE 进度通知（发布到 Redis 频道）
   */
  async publishProgress(contentId: string, status: Partial<VideoJobStatus>): Promise<void> {
    const key = `${SSE_CHANNEL}${contentId}`
    const jobData = JSON.stringify({ contentId, ...status, updatedAt: new Date().toISOString() })
    await this.redis.setex(key, JOB_EXPIRY_HOURS * 3600, jobData)
  }

  /**
   * 获取 SSE 频道名称
   */
  getSseChannel(contentId: string): string {
    return `video:progress:${contentId}`
  }

  // ========================
  // 视频历史
  // ========================

  /**
   * 视频历史列表
   */
  async listVideos(agentId: string, page = 1, pageSize = 20) {
    const [items, total] = await this.contentRepo.findAndCount({
      where: { agentId, contentType: 'video' },
      order: { createdAt: 'DESC' },
      skip: ((page ?? 1) - 1) * (pageSize ?? 20),
      take: pageSize ?? 20,
    })

    return {
      items: items.map((c) => {
        const data = c.contentData as any
        return {
          contentId: c.id,
          campaignId: c.campaignId,
          couponId: c.couponId,
          targetPlatform: c.targetPlatform,
          status: c.status,
          jobStatus: data?.jobStatus ?? 'pending',
          progress: data?.progress ?? 0,
          videoUrl: data?.videoUrl ?? null,
          thumbnailUrl: data?.thumbnailUrl ?? null,
          aiTokenCost: Number(c.aiTokenCost),
          totalImpressions: Number(c.totalImpressions),
          totalClicks: Number(c.totalClicks),
          totalClaims: c.totalClaims,
          createdAt: c.createdAt,
        }
      }),
      pagination: {
        page: page ?? 1,
        pageSize: pageSize ?? 20,
        total,
        totalPages: Math.ceil(total / (pageSize ?? 20)),
      },
    }
  }

  // ========================
  // 私有：异步任务处理
  // ========================

  /**
   * 异步执行视频生成（复用 AIBridgeService.generateVideo）
   * 创建供应商异步任务；后续由客户端轮询时刷新供应商状态。
   */
  private async processVideoJob(
    contentId: string,
    agentId: string,
    params: {
      couponId?: string
      campaignId?: string
      platform: PlatformType
      durationSeconds?: number
      trackingUrl: string
    },
  ) {
    try {
      await this.updateJobData(contentId, { jobStatus: 'generating', progress: 5 })
      await this.publishProgress(contentId, { status: 'generating', progress: 5 })

      // 调用 AI Bridge 生成视频
      const videoResult = await this.aiBridge.generateVideo({
        coupon_id: params.couponId ?? '',
        campaign_id: params.campaignId ?? '',
        agent_id: agentId,
        platform: params.platform.toString(),
        duration_seconds: params.durationSeconds ?? 8,
      })

      const providerTaskId = videoResult?.task_id ?? videoResult?.taskId
      if (!providerTaskId) throw new Error('视频供应商未返回任务标识')
      await this.updateJobData(contentId, {
        jobStatus: 'generating',
        progress: 5,
        providerTaskId,
      })
      this.logger.log({ event: 'video_provider_job_created', contentId, providerTaskId })
    } catch (error) {
      await this.updateJobData(contentId, {
        jobStatus: 'failed',
        progress: 0,
        error: error instanceof Error ? error.message : '生成失败',
      })
      await this.contentRepo.update(
        { id: contentId },
        {
          status: ContentStatus.FAILED,
        },
      )
      await this.publishProgress(contentId, {
        status: 'failed',
        error: error instanceof Error ? error.message : '生成失败',
      })
      this.logger.error({ event: 'video_job_error', contentId, error: String(error) })
    }
  }

  private async updateJobData(contentId: string, data: Record<string, any>): Promise<void> {
    const content = await this.contentRepo.findOne({ where: { id: contentId } })
    if (content) {
      const existing = content.contentData ?? {}
      await this.contentRepo.update(
        { id: contentId },
        {
          contentData: { ...existing, ...data },
        },
      )
    }
  }

  // ========================
  // 私有工具
  // ========================

  private buildTrackingUrl(
    agentId: string,
    couponId: string | null,
    campaignId: string | null,
    platform: PlatformType,
  ): string {
    const base = 'https://ai-auto.example.com/claim'
    const params = new URLSearchParams({ agent: agentId })
    if (couponId) params.set('c', couponId)
    if (campaignId) params.set('camp', campaignId)
    params.set('p', platform.toString())
    return `${base}?${params.toString()}`
  }

  private roundMoney(amount: number): number {
    return Math.round(amount * 100) / 100
  }
}
