// ============================================================
// AI auto - Poster Service
// STORY-AI-022: AI 海报/主图生成
// 生成海报变体 → 追踪二维码注入 → Content 记录
// ============================================================

import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'

import { Content } from './entities/content.entity'
import { AgentWallet } from '../agent/entities/agent-wallet.entity'
import { PlatformType, ContentStatus } from '@ai-auto/shared'

import { AIBridgeService } from '../ai-bridge/ai-bridge.service'

// AI Token 计费：¥0.002 / token（图片比文案贵）
const POSTER_TOKEN_PRICE_PER = 0.002
const ESTIMATED_POSTER_TOKENS = 300

// 平台海报尺寸
const PLATFORM_ASPECTS: Record<string, string> = {
  WECHAT: '1:1', // 朋友圈
  VIDEO_ACCOUNT: '9:16', // 视频号
  DOUYIN: '9:16', // 抖音
  XIAOHONGSHU: '3:4', // 小红书
  KUAISHOU: '9:16', // 快手
}

@Injectable()
export class PosterService {
  private readonly logger = new Logger(PosterService.name)

  constructor(
    @InjectRepository(Content)
    private readonly contentRepo: Repository<Content>,
    @InjectRepository(AgentWallet)
    private readonly walletRepo: Repository<AgentWallet>,
    private readonly aiBridge: AIBridgeService,
  ) {}

  // ========================
  // 海报生成
  // ========================

  /**
   * 生成 AI 海报
   * 同步：立即返回海报列表
   */
  async generatePoster(
    agentId: string,
    params: {
      couponId?: string
      campaignId?: string
      platform: PlatformType
      style?: string
      colorScheme?: string
      variantCount?: number
    },
  ) {
    const { couponId, campaignId, platform, style, colorScheme, variantCount = 3 } = params
    const count = Math.min(Math.max(variantCount, 1), 5)

    // 1. 钱包余额检查
    const wallet = await this.walletRepo.findOne({ where: { agentId } })
    if (!wallet) {
      throw new NotFoundException({ code: 7001, message: '钱包不存在' })
    }

    const estimatedCost = this.roundMoney(ESTIMATED_POSTER_TOKENS * POSTER_TOKEN_PRICE_PER)
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
    const qrCodeUrl = this.buildQrCodeUrl(trackingUrl)

    // 3. 获取目标平台尺寸
    const aspectRatio = PLATFORM_ASPECTS[platform.toString()] ?? '1:1'

    // 4. 调用 AI Bridge
    let aiResult: any
    try {
      aiResult = await this.aiBridge.generatePoster({
        coupon_id: couponId ?? '',
        agent_id: agentId,
        platform: platform.toString(),
        style: style ?? 'promotional',
        color_scheme: colorScheme ?? 'warm',
      })
    } catch (error) {
      this.logger.error({ event: 'poster_generation_failed', agentId, error })
      throw new BadRequestException({ code: 8001, message: '海报生成失败，请重试' })
    }

    // 5. 解析结果（多个海报变体）
    const rawVariants = aiResult?.options ?? aiResult?.posters ?? aiResult?.images ?? []
    const variants = rawVariants.slice(0, count).map((v: any, index: number) => ({
      index,
      imageUrl: v.image_url ?? v.url ?? v.src ?? String(v),
      thumbnailUrl: v.thumbnail_url ?? v.thumbnail ?? v.src ?? null,
      style: v.style ?? style ?? 'promotional',
      aspectRatio,
      qrCodeUrl,
    }))

    // 6. 扣费（同步，直接扣）
    await this.walletRepo
      .createQueryBuilder()
      .update()
      .set({ aiTokenBalance: () => `ai_token_balance - ${estimatedCost}` })
      .where('agent_id = :agentId AND ai_token_balance >= :cost', { agentId, cost: estimatedCost })
      .execute()

    // 7. 创建 Content 记录（记录第一个变体）
    const content = this.contentRepo.create({
      agentId,
      campaignId: campaignId ?? null,
      couponId: couponId ?? null,
      contentType: 'poster',
      targetPlatform: platform,
      aiModel: aiResult?.model ?? null,
      contentData: {
        variants,
        variantCount: variants.length,
        aspectRatio,
        trackingUrl,
        qrCodeUrl,
      },
      status: ContentStatus.PUBLISHED,
      aiTokenCost: estimatedCost,
      inputTokens: ESTIMATED_POSTER_TOKENS,
      costDeducted: true,
      trackingUrl,
      trackingQrCode: qrCodeUrl,
    })
    const saved = await this.contentRepo.save(content)

    // 重新查询余额
    const walletAfter = await this.walletRepo.findOne({ where: { agentId } })
    const remainingBalance = walletAfter ? Number(walletAfter.aiTokenBalance) : 0

    this.logger.log({
      event: 'poster_generated',
      agentId,
      contentId: saved.id,
      variantCount: variants.length,
      deducted: estimatedCost,
    })

    return {
      contentId: saved.id,
      variants,
      aspectRatio,
      trackingUrl,
      qrCodeUrl,
      deductedAmount: estimatedCost,
      remainingBalance,
    }
  }

  /**
   * 海报历史列表
   */
  async listPosters(agentId: string, page = 1, pageSize = 20) {
    const [items, total] = await this.contentRepo.findAndCount({
      where: { agentId, contentType: 'poster' },
      order: { createdAt: 'DESC' },
      skip: ((page ?? 1) - 1) * (pageSize ?? 20),
      take: pageSize ?? 20,
    })

    return {
      items: items.map((c) => {
        const data = c.contentData as any
        const variants = data?.variants ?? []
        return {
          contentId: c.id,
          couponId: c.couponId,
          campaignId: c.campaignId,
          targetPlatform: c.targetPlatform,
          aspectRatio: data?.aspectRatio ?? '1:1',
          variantCount: variants.length,
          variants: variants.map((v: any) => ({
            index: v.index,
            imageUrl: v.imageUrl,
            thumbnailUrl: v.thumbnailUrl,
          })),
          aiTokenCost: Number(c.aiTokenCost),
          totalImpressions: Number(c.totalImpressions),
          totalClicks: Number(c.totalClicks),
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

  private buildQrCodeUrl(trackingUrl: string): string {
    return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(trackingUrl)}`
  }

  private roundMoney(amount: number): number {
    return Math.round(amount * 100) / 100
  }
}
