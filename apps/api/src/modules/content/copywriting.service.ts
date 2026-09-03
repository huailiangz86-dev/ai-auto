// ============================================================
// AI auto - Copywriting Service
// STORY-AI-020: AI 文案生成
// Token 预估 → 调用 AI Bridge → 追踪链接注入 → 钱包扣费
// ============================================================

import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository, DataSource } from 'typeorm'

import { Content } from './entities/content.entity'
import { AgentWallet } from '../agent/entities/agent-wallet.entity'
import { AgentPlatformAccount } from '../agent/entities/agent-platform-account.entity'
import { PlatformType, ContentStatus } from '@ai-auto/shared'

import { AIBridgeService } from '../ai-bridge/ai-bridge.service'

import {
  GenerateCopywritingDto,
  ConfirmCopywritingDto,
  ListCopywritingDto,
} from './dto/copywriting.dto'

// AI Token 计费：¥0.001 / token（示例价格）
const TOKEN_PRICE_PER = 0.001
// 文案草稿过期时间（分钟）
const DRAFT_EXPIRY_MINUTES = 30
// 每次生成预估 token 消耗（input ≈ 500, output ≈ 800 per option）
const ESTIMATED_INPUT_TOKENS = 500
const ESTIMATED_OUTPUT_TOKENS_PER_OPTION = 800

// 语气变体
const TONE_VARIANTS = ['热情', '随意', '正式', '幽默', '专业']

@Injectable()
export class CopywritingService {
  private readonly logger = new Logger(CopywritingService.name)

  constructor(
    @InjectRepository(Content)
    private readonly contentRepo: Repository<Content>,
    @InjectRepository(AgentWallet)
    private readonly walletRepo: Repository<AgentWallet>,
    @InjectRepository(AgentPlatformAccount)
    private readonly platformAccountRepo: Repository<AgentPlatformAccount>,
    private readonly aiBridge: AIBridgeService,
    private readonly dataSource: DataSource,
  ) {}

  // ========================
  // Token 预估
  // ========================

  /**
   * 生成前预估 AI Token 费用（同步，仅计算预估）
   */
  estimateCost(count = 3) {
    const estimatedTokens = ESTIMATED_INPUT_TOKENS + ESTIMATED_OUTPUT_TOKENS_PER_OPTION * count
    const estimatedCost = this.roundMoney(estimatedTokens * TOKEN_PRICE_PER)

    return {
      estimatedTokens,
      estimatedCost,
      currentBalance: 0, // 异步查询用 estimateCostAsync
      isSufficient: true, // 实际检查在生成时做
    }
  }

  /**
   * 预估 Token 费用（异步版本，实际查询钱包）
   */
  async estimateCostAsync(agentId: string, count = 3) {
    const estimatedTokens = ESTIMATED_INPUT_TOKENS + ESTIMATED_OUTPUT_TOKENS_PER_OPTION * count
    const estimatedCost = this.roundMoney(estimatedTokens * TOKEN_PRICE_PER)

    const wallet = await this.walletRepo.findOne({ where: { agentId } })
    const currentBalance = wallet ? Number(wallet.aiTokenBalance) : 0
    const isSufficient = currentBalance >= estimatedCost

    return {
      estimatedTokens,
      estimatedCost,
      currentBalance,
      isSufficient,
    }
  }

  // ========================
  // 文案生成
  // ========================

  /**
   * 生成 AI 文案（先预估扣费，成功后保存草稿）
   * 草稿状态 → 等待用户确认 → 确认后发布
   */
  async generateCopywriting(agentId: string, dto: GenerateCopywritingDto) {
    const { couponId, campaignId, platform, tone, count = 3, keywords } = dto
    const countNum = Math.min(Math.max(count, 1), 10)

    // 1. 钱包余额检查
    const wallet = await this.walletRepo.findOne({ where: { agentId } })
    if (!wallet) {
      throw new NotFoundException({ code: 7001, message: '钱包不存在' })
    }

    const estimatedTokens = ESTIMATED_INPUT_TOKENS + ESTIMATED_OUTPUT_TOKENS_PER_OPTION * countNum
    const estimatedCost = this.roundMoney(estimatedTokens * TOKEN_PRICE_PER)
    const currentBalance = Number(wallet.aiTokenBalance)

    if (currentBalance < estimatedCost) {
      throw new BadRequestException({
        code: 7002,
        message: `AI Token 余额不足。当前余额 ${currentBalance} 元，预估费用 ${estimatedCost} 元`,
      })
    }

    // 2. 获取分享员的平台账号
    const platformAccount = await this.platformAccountRepo.findOne({
      where: { agentId, platformType: platform },
    })

    // 3. 生成追踪链接
    const trackingUrl = this.buildTrackingUrl(
      agentId,
      couponId ?? null,
      campaignId ?? null,
      platform,
    )

    // 4. 调用 AI Bridge
    const tonesToGenerate = tone ? [tone] : TONE_VARIANTS.slice(0, countNum)

    let aiResult: any
    try {
      aiResult = await this.aiBridge.generateCopywriting({
        coupon_id: couponId ?? '',
        campaign_id: campaignId ?? '',
        agent_id: agentId,
        platform: platform.toString(),
        tone: tonesToGenerate[0],
        count: countNum,
      })
    } catch (error) {
      this.logger.error({ event: 'copywriting_generation_failed', agentId, error })
      throw new BadRequestException({ code: 7003, message: 'AI 生成失败，请重试' })
    }

    // 5. 解析 AI 返回
    const options = this.parseCopywritingOptions(aiResult, trackingUrl, tonesToGenerate)
    const actualTokens = estimatedTokens // AI Bridge 实际消耗需从返回获取
    const actualCost = this.roundMoney(actualTokens * TOKEN_PRICE_PER)

    // 6. 创建草稿记录（Content entity）
    const draftContent = this.contentRepo.create({
      agentId,
      campaignId: campaignId ?? null,
      couponId: couponId ?? null,
      contentType: 'copywriting',
      targetPlatform: platform,
      aiModel: aiResult?.model ?? 'claude-3',
      contentData: {
        options,
        draft: true,
        expiresAt: new Date(Date.now() + DRAFT_EXPIRY_MINUTES * 60 * 1000).toISOString(),
      },
      status: ContentStatus.DRAFT,
      aiTokenCost: actualCost,
      inputTokens: Math.round(ESTIMATED_INPUT_TOKENS),
      outputTokens: Math.round(ESTIMATED_OUTPUT_TOKENS_PER_OPTION * countNum),
      trackingUrl,
      costDeducted: false, // 确认后才扣费
    })
    await this.contentRepo.save(draftContent)

    this.logger.log({
      event: 'copywriting_draft_created',
      agentId,
      contentId: draftContent.id,
      estimatedCost: actualCost,
    })

    return {
      draftId: draftContent.id,
      aiModel: draftContent.aiModel ?? 'claude-3',
      actualTokens,
      actualCost,
      options,
      expiresInMinutes: DRAFT_EXPIRY_MINUTES,
    }
  }

  /**
   * 确认文案选择（正式发布）
   * 扣费 + 更新状态
   */
  async confirmCopywriting(agentId: string, dto: ConfirmCopywritingDto) {
    const { draftId, selectedIndex, editedCopy } = dto

    // 1. 获取草稿
    const content = await this.contentRepo.findOne({
      where: { id: draftId, agentId },
    })
    if (!content) {
      throw new NotFoundException({ code: 7011, message: '草稿不存在' })
    }
    if (content.status !== ContentStatus.DRAFT) {
      throw new BadRequestException({ code: 7012, message: '草稿已确认或已失效' })
    }

    // 2. 检查过期
    const data = content.contentData as any
    if (data?.expiresAt && new Date(data.expiresAt) < new Date()) {
      // 过期 → 标记为失效
      await this.contentRepo.update({ id: draftId }, { status: ContentStatus.FAILED })
      throw new BadRequestException({ code: 7013, message: '草稿已过期，请重新生成' })
    }

    // 3. 获取选中的变体
    const options = data?.options ?? []
    if (selectedIndex < 0 || selectedIndex >= options.length) {
      throw new BadRequestException({ code: 7014, message: '无效的变体序号' })
    }

    const selectedOption = options[selectedIndex]
    const finalCopy = editedCopy ?? selectedOption.copy

    // 4. 扣费（在事务中）
    const cost = Number(content.aiTokenCost)

    await this.dataSource.transaction(async (manager) => {
      // 扣减 AI Token 余额
      await manager
        .getRepository(AgentWallet)
        .createQueryBuilder()
        .update()
        .set({
          aiTokenBalance: () => `ai_token_balance - ${cost}`,
        })
        .where('agent_id = :agentId AND ai_token_balance >= :cost', { agentId, cost })
        .execute()

      // 更新 Content 状态
      await manager.getRepository(Content).update(
        { id: draftId },
        {
          status: ContentStatus.PUBLISHED,
          selectedOption: selectedIndex,
          contentData: {
            ...data,
            draft: false,
            selectedCopy: finalCopy,
          },
          costDeducted: true,
        },
      )
    })

    // 5. 重新查询钱包余额
    const wallet = await this.walletRepo.findOne({ where: { agentId } })
    const remainingBalance = wallet ? Number(wallet.aiTokenBalance) : 0

    // 6. 生成追踪二维码 URL
    const trackingQrCode = this.buildQrCodeUrl(content.trackingUrl ?? '')

    this.logger.log({
      event: 'copywriting_confirmed',
      agentId,
      contentId: draftId,
      selectedIndex,
      deducted: cost,
    })

    return {
      contentId: draftId,
      copy: finalCopy,
      trackingUrl: content.trackingUrl ?? '',
      trackingQrCode,
      deductedAmount: cost,
      remainingBalance,
      status: ContentStatus.PUBLISHED,
    }
  }

  /**
   * 文案历史列表
   */
  async listCopywriting(agentId: string, query: ListCopywritingDto) {
    const { status, platform, page = 1, pageSize = 20 } = query

    const where: any = { agentId, contentType: 'copywriting' }
    if (status) where.status = status
    if (platform) where.targetPlatform = platform

    const [items, total] = await this.contentRepo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: ((page ?? 1) - 1) * (pageSize ?? 20),
      take: pageSize ?? 20,
    })

    return {
      items: items.map((c) => {
        const data = c.contentData as any
        const options = data?.options ?? []
        return {
          contentId: c.id,
          campaignId: c.campaignId,
          couponId: c.couponId,
          targetPlatform: c.targetPlatform,
          status: c.status,
          aiModel: c.aiModel,
          aiTokenCost: Number(c.aiTokenCost),
          optionsCount: options.length,
          selectedCopy: data?.selectedCopy ?? options[c.selectedOption ?? 0]?.copy ?? null,
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
  // 私有工具
  // ========================

  /**
   * 构建追踪链接
   */
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

  /**
   * 构建追踪二维码 URL（占位）
   */
  private buildQrCodeUrl(trackingUrl: string): string {
    // 实际可对接 QR Code 生成服务
    return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(trackingUrl)}`
  }

  /**
   * 解析 AI Bridge 返回的文案变体，并注入追踪链接
   */
  private parseCopywritingOptions(aiResult: any, trackingUrl: string, tones: string[]): any[] {
    if (!aiResult) return []

    const rawOptions = aiResult.options ?? aiResult.copies ?? aiResult.contents ?? []
    return rawOptions.map((opt: any, index: number) => ({
      index,
      tone: tones[index] ?? tones[0] ?? '热情',
      copy: this.injectTrackingLink(
        opt.copy ?? opt.text ?? opt.content ?? String(opt),
        trackingUrl,
      ),
      estimatedTokens: opt.tokens ?? opt.estimated_tokens ?? null,
    }))
  }

  /**
   * 将追踪链接注入文案末尾
   */
  private injectTrackingLink(copy: string, trackingUrl: string): string {
    // 如果文案已包含链接，追加；否则在末尾添加
    if (copy.includes(trackingUrl)) return copy
    return `${copy.trim()}\n\n🔗 ${trackingUrl}`
  }

  /**
   * 金额精度处理
   */
  private roundMoney(amount: number): number {
    return Math.round(amount * 100) / 100
  }
}
