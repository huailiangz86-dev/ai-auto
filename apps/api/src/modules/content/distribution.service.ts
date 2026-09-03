// ============================================================
// AI auto - Distribution Service
// STORY-AI-023: 多平台一键分发
// 内容分发 → 已授权账号自动发布 → 未授权账号提供复制内容
// ============================================================

import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'

import { ContentPublication, PublicationStatus } from './entities/content-publication.entity'
import { Content } from './entities/content.entity'
import { AgentPlatformAccount } from '../agent/entities/agent-platform-account.entity'
import { PlatformType, ContentStatus } from '@ai-auto/shared'

import { CopywritingService } from './copywriting.service'
import { VideoService } from './video.service'
import { PosterService } from './poster.service'
import { KuaishouService } from './kuaishou.service'

export interface DistributeContentDto {
  contentId: string
  platforms: PlatformType[]
  customContent?: string // 自定义文案（覆盖 AI 生成）
}

export interface DistributeResult {
  contentId: string
  results: {
    platform: string
    status: PublicationStatus
    postUrl?: string | null
    formattedContent?: string | null
    error?: string | null
    isManual: boolean
  }[]
  totalPublished: number
  totalFailed: number
  totalManual: number
}

@Injectable()
export class DistributionService {
  private readonly logger = new Logger(DistributionService.name)

  constructor(
    @InjectRepository(ContentPublication)
    private readonly publicationRepo: Repository<ContentPublication>,
    @InjectRepository(Content)
    private readonly contentRepo: Repository<Content>,
    @InjectRepository(AgentPlatformAccount)
    private readonly platformAccountRepo: Repository<AgentPlatformAccount>,
    private readonly copywritingService: CopywritingService,
    private readonly videoService: VideoService,
    private readonly posterService: PosterService,
    private readonly kuaishouService: KuaishouService,
  ) {}

  // ========================
  // 多平台分发
  // ========================

  /**
   * 一键分发内容到多个平台
   * 已授权 → API 发布；未授权 → 复制粘贴格式
   */
  async distribute(agentId: string, dto: DistributeContentDto): Promise<DistributeResult> {
    const { contentId, platforms, customContent } = dto

    // 1. 验证内容存在
    const content = await this.contentRepo.findOne({ where: { id: contentId, agentId } })
    if (!content) {
      throw new NotFoundException({ code: 9001, message: '内容不存在' })
    }
    if (content.status !== ContentStatus.PUBLISHED) {
      throw new BadRequestException({ code: 9002, message: '内容未发布，无法分发' })
    }

    // 2. 批量处理每个平台
    const results: DistributeResult['results'] = []
    let totalPublished = 0
    let totalFailed = 0
    let totalManual = 0

    for (const platform of platforms) {
      try {
        const result = await this.publishToPlatform(agentId, content, platform, customContent)
        results.push(result)
        if (result.status === PublicationStatus.PUBLISHED) totalPublished++
        else if (result.status === PublicationStatus.MANUAL) totalManual++
        else if (result.status === PublicationStatus.FAILED) totalFailed++
      } catch (error) {
        results.push({
          platform: platform.toString(),
          status: PublicationStatus.FAILED,
          error: error instanceof Error ? error.message : '分发失败',
          isManual: false,
        })
        totalFailed++
      }
    }

    this.logger.log({
      event: 'distribution_completed',
      agentId,
      contentId,
      platforms: platforms.map((p) => p.toString()),
      published: totalPublished,
      failed: totalFailed,
      manual: totalManual,
    })

    return {
      contentId,
      results,
      totalPublished,
      totalFailed,
      totalManual,
    }
  }

  /**
   * 发布到单个平台
   * 已授权 → API 发布；未授权 → 复制粘贴格式
   */
  async publishToPlatform(
    agentId: string,
    content: Content,
    platform: PlatformType,
    customContent?: string,
  ): Promise<{
    platform: string
    status: PublicationStatus
    postUrl?: string | null
    formattedContent?: string | null
    error?: string | null
    isManual: boolean
  }> {
    // 检查平台授权
    const platformAccount = await this.platformAccountRepo.findOne({
      where: { agentId, platformType: platform },
      select: {
        id: true,
        agentId: true,
        platformType: true,
        status: true,
        accessToken: true,
      },
    })
    const isAuthorized = Boolean(platformAccount?.status && platformAccount.accessToken)

    // 获取格式化内容
    const contentText = customContent ?? this.extractContentText(content)

    // 创建发布记录
    const publication = this.publicationRepo.create({
      contentId: content.id,
      agentId,
      platform,
      status: PublicationStatus.PENDING,
      formattedContent: contentText,
    })
    await this.publicationRepo.save(publication)

    if (!isAuthorized) {
      // 未授权 → 手动模式：返回格式化内容供复制
      await this.publicationRepo.update(
        { id: publication.id },
        { status: PublicationStatus.MANUAL },
      )
      return {
        platform: platform.toString(),
        status: PublicationStatus.MANUAL,
        formattedContent: contentText,
        isManual: true,
        error: null,
      }
    }

    // 已授权 → API 发布
    try {
      const publishResult = await this.publishViaAPI(
        agentId,
        content,
        platform,
        platformAccount,
        contentText,
      )
      await this.publicationRepo.update(
        { id: publication.id },
        {
          status: publishResult.pending ? PublicationStatus.PENDING : PublicationStatus.PUBLISHED,
          platformPostId: publishResult.postId ?? null,
          platformPostUrl: publishResult.postUrl ?? null,
          publishedAt: publishResult.pending ? null : new Date(),
        },
      )
      return {
        platform: platform.toString(),
        status: publishResult.pending ? PublicationStatus.PENDING : PublicationStatus.PUBLISHED,
        postUrl: publishResult.postUrl ?? null,
        isManual: false,
        error: null,
      }
    } catch (error) {
      await this.publicationRepo.update(
        { id: publication.id },
        {
          status: PublicationStatus.FAILED,
          errorMessage: error instanceof Error ? error.message : '发布失败',
        },
      )
      return {
        platform: platform.toString(),
        status: PublicationStatus.FAILED,
        error: error instanceof Error ? error.message : '发布失败',
        isManual: false,
      }
    }
  }

  // ========================
  // 发布效果
  // ========================

  /**
   * 更新发布统计数据（供追踪回调调用）
   */
  async updateStats(
    publicationId: string,
    stats: {
      impressions?: number
      clicks?: number
      comments?: number
      shares?: number
      likes?: number
    },
  ) {
    const update: any = {}
    if (stats.impressions !== undefined) update.impressions = stats.impressions
    if (stats.clicks !== undefined) update.clicks = stats.clicks
    if (stats.comments !== undefined) update.comments = stats.comments
    if (stats.shares !== undefined) update.shares = stats.shares
    if (stats.likes !== undefined) update.likes = stats.likes

    if (Object.keys(update).length > 0) {
      await this.publicationRepo.update({ id: publicationId }, update)
    }
  }

  /**
   * 增量更新统计（累加）
   */
  async incrementStats(
    publicationId: string,
    stats: {
      impressions?: number
      clicks?: number
      comments?: number
      shares?: number
      likes?: number
    },
  ) {
    const update: any = {}
    if (stats.impressions !== undefined) {
      update.impressions = () => `impressions + ${stats.impressions}`
    }
    if (stats.clicks !== undefined) {
      update.clicks = () => `clicks + ${stats.clicks}`
    }
    if (stats.comments !== undefined) {
      update.comments = () => `comments + ${stats.comments}`
    }
    if (stats.shares !== undefined) {
      update.shares = () => `shares + ${stats.shares}`
    }
    if (stats.likes !== undefined) {
      update.likes = () => `likes + ${stats.likes}`
    }

    if (Object.keys(update).length > 0) {
      await this.publicationRepo
        .createQueryBuilder()
        .update()
        .set(update)
        .where('id = :id', { id: publicationId })
        .execute()
    }
  }

  /**
   * 获取内容的所有发布记录
   */
  async getPublicationRecords(contentId: string) {
    const records = await this.publicationRepo.find({
      where: { contentId },
      order: { createdAt: 'DESC' },
    })
    return records.map((r) => ({
      publicationId: r.id,
      platform: r.platform,
      status: r.status,
      postUrl: r.platformPostUrl,
      postId: r.platformPostId,
      impressions: Number(r.impressions),
      clicks: Number(r.clicks),
      comments: r.comments,
      shares: r.shares,
      likes: r.likes,
      publishedAt: r.publishedAt,
      createdAt: r.createdAt,
    }))
  }

  /**
   * 获取跨平台汇总数据
   */
  async getAggregatedStats(contentId: string) {
    const records = await this.publicationRepo.find({ where: { contentId } })

    return {
      totalImpressions: records.reduce((sum, r) => sum + Number(r.impressions), 0),
      totalClicks: records.reduce((sum, r) => sum + Number(r.clicks), 0),
      totalComments: records.reduce((sum, r) => sum + r.comments, 0),
      totalShares: records.reduce((sum, r) => sum + r.shares, 0),
      totalLikes: records.reduce((sum, r) => sum + r.likes, 0),
      platformBreakdown: records.map((r) => ({
        platform: r.platform,
        impressions: Number(r.impressions),
        clicks: Number(r.clicks),
        comments: r.comments,
        shares: r.shares,
        likes: r.likes,
      })),
    }
  }

  // ========================
  // 私有工具
  // ========================

  /**
   * 从 Content entity 提取可发布的文本内容
   */
  private extractContentText(content: Content): string {
    const data = content.contentData as any

    // 文案内容
    if (content.contentType === 'copywriting') {
      const selectedCopy = data?.selectedCopy
      if (selectedCopy) return selectedCopy
      const options = data?.options ?? []
      const selected = options[content.selectedOption ?? 0]
      return selected?.copy ?? ''
    }

    // 海报：返回追踪链接
    if (content.contentType === 'poster') {
      const qrCodeUrl = content.trackingQrCode ?? data?.qrCodeUrl
      const trackingUrl = content.trackingUrl ?? data?.trackingUrl ?? ''
      return `点击领取优惠券：${trackingUrl}\n\n二维码：${qrCodeUrl}`
    }

    // 视频：返回追踪链接
    if (content.contentType === 'video') {
      const trackingUrl = content.trackingUrl ?? ''
      return `点击观看视频并领取优惠券：${trackingUrl}`
    }

    return content.trackingUrl ?? ''
  }

  /**
   * 通过平台 API 发布内容
   * TODO: 对接各平台 Open API
   */
  private ensureTrackingUrl(contentText: string, trackingUrl?: string | null): string {
    if (!trackingUrl || contentText.includes(trackingUrl)) return contentText
    return `${contentText.trim()}\n\n${trackingUrl}`
  }

  private async publishViaAPI(
    agentId: string,
    content: Content,
    platform: PlatformType,
    platformAccount: AgentPlatformAccount,
    contentText: string,
  ): Promise<{ postId?: string; postUrl?: string; pending?: boolean }> {
    if (platform === PlatformType.KUAISHOU) {
      if (content.contentType !== 'video') {
        throw new BadRequestException('快手开放接口仅支持视频内容自动发布')
      }
      if (!platformAccount.accessToken) {
        throw new BadRequestException('快手账号未授权')
      }
      const data = content.contentData ?? {}
      const videoUrl = String(data['video_url'] ?? data['videoUrl'] ?? '')
      const coverUrl = String(data['thumbnail_url'] ?? data['thumbnailUrl'] ?? '')
      if (!videoUrl || !coverUrl) {
        throw new BadRequestException('快手发布需要已生成的视频和封面')
      }
      const result = await this.kuaishouService.uploadAndPublish({
        accessToken: platformAccount.accessToken,
        videoUrl,
        coverUrl,
        caption: this.ensureTrackingUrl(contentText, content.trackingUrl),
      })
      return { postId: result.photoId, postUrl: result.playUrl, pending: result.pending }
    }

    // TODO: 实现各平台 API 发布逻辑
    // - 微信：企业微信 / 公众号 API
    // - 抖音：抖音开放平台 API
    // - 小红书：蒲公英平台 API
    // - 视频号：微信开放平台 API

    // 占位：返回模拟结果
    this.logger.log({
      event: 'platform_api_publish_placeholder',
      agentId,
      platform: platform.toString(),
      contentType: content.contentType,
    })

    return {
      postId: `mock-${platform.toString()}-${Date.now()}`,
      postUrl: `https://${platform.toString()}.example.com/post/mock`,
    }
  }
}
