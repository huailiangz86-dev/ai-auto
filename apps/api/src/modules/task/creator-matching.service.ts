import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { AuditActionType, AuditStatus, UserRole } from '@ai-auto/shared'
import { DataSource, EntityManager, Repository } from 'typeorm'
import { AuditLog } from '../admin/entities/audit-log.entity'
import { AgentPlatformAccount } from '../agent/entities/agent-platform-account.entity'
import { SharingAgent } from '../agent/entities/sharing-agent.entity'
import { Store } from '../merchant/entities/store.entity'
import { Notification } from '../notification/entities/notification.entity'
import { CreatorMatchQueryDto, InviteMatchedCreatorsDto } from './dto/creator-matching.dto'
import { CampaignBudgetAllocation } from './entities/campaign-budget-allocation.entity'
import { CampaignCreditLedgerEntry, CreatorTask, GrowthTask } from './entities/growth-task.entity'
import { MerchantAgentBinding } from '../merchant/entities/merchant-agent-binding.entity'

const NON_TERMINAL_STATUSES = new Set([
  'created',
  'matching',
  'invited',
  'accepted',
  'creating',
  'submitted',
  'approved',
  'published',
  'tracking',
  'completed',
  'risk_hold',
])

export interface Match {
  creatorId: string
  nickname: string | null
  avatar: string | null
  region: string | null
  creatorCategories: string[]
  creatorGrowthScore: number
  creatorGrowthLevel: number
  activeTaskCount: number
  taskLimit: number | null
  matchingScore: number
  explanation: {
    scoreComponents: Record<string, number>
    reasons: string[]
    matchedChannels: string[]
  }
}

@Injectable()
export class CreatorMatchingService {
  constructor(
    @InjectRepository(GrowthTask) private readonly growthTasks: Repository<GrowthTask>,
    @InjectRepository(CampaignBudgetAllocation)
    private readonly allocations: Repository<CampaignBudgetAllocation>,
    private readonly dataSource: DataSource,
  ) {}

  async listMatches(merchantId: string, growthTaskId: string, query: CreatorMatchQueryDto) {
    const growth = await this.growthTasks.findOne({ where: { id: growthTaskId, merchantId } })
    if (!growth) throw new NotFoundException('Growth Task 不存在')
    if (growth.status !== 'active')
      throw new BadRequestException('请在资金确认后启动 Growth Task，再进行创作者匹配')
    await this.requireFunded(this.allocations, growth)
    const items = await this.evaluate(this.growthTasks.manager, growth, query)
    return {
      growthTaskId,
      criteria: {
        channel: query.channel,
        contentType: query.contentType ?? null,
        categories: query.categories ?? [],
      },
      items,
    }
  }

  async invite(merchantId: string, growthTaskId: string, dto: InviteMatchedCreatorsDto) {
    const deadline = new Date(dto.deadline)
    if (deadline <= new Date()) throw new BadRequestException('创作者任务截止时间必须在未来')
    if (new Set(dto.creatorIds).size !== dto.creatorIds.length)
      throw new BadRequestException('不能重复选择同一位创作者')
    return this.dataSource.transaction(async (manager) => {
      const growth = await manager.findOne(GrowthTask, { where: { id: growthTaskId, merchantId } })
      if (!growth) throw new NotFoundException('Growth Task 不存在')
      if (growth.status !== 'active')
        throw new BadRequestException('仅活跃的 Growth Task 可以发出创作者邀约')
      if (deadline > growth.endAt)
        throw new BadRequestException('创作者任务截止时间不能晚于 Growth Task')
      const allocations = await this.requireFunded(
        manager.getRepository(CampaignBudgetAllocation),
        growth,
      )
      const matches = await this.evaluate(manager, growth, dto)
      const matched = new Map(matches.map((item) => [item.creatorId, item]))
      const ineligible = dto.creatorIds.filter((creatorId) => !matched.has(creatorId))
      if (ineligible.length)
        throw new BadRequestException(`所选创作者已不符合邀约条件：${ineligible.join(', ')}`)

      const existing = await manager.find(CreatorTask, { where: { growthTaskId } })
      const alreadyAssigned = new Set(
        existing
          .filter((task) => NON_TERMINAL_STATUSES.has(task.status))
          .map((task) => task.creatorId),
      )
      const duplicates = dto.creatorIds.filter((creatorId) => alreadyAssigned.has(creatorId))
      if (duplicates.length)
        throw new BadRequestException(`所选创作者已有进行中的任务：${duplicates.join(', ')}`)

      const reward = Number(dto.baseReward)
      const credits = Number(dto.campaignCredits ?? 0)
      const totalReward = reward * dto.creatorIds.length
      const totalCredits = credits * dto.creatorIds.length
      const payoutBudget = allocations.find((item) => item.category === 'creator_payout')
      const creditsBudget = allocations.find((item) => item.category === 'campaign_credits')
      if (Number(growth.compensationReserved) + totalReward > Number(payoutBudget.committedAmount))
        throw new BadRequestException('创作者报酬预算不足，无法发出全部邀约')
      if (
        Number(growth.campaignCreditsReserved) + totalCredits >
        Number(creditsBudget.committedAmount)
      )
        throw new BadRequestException('Campaign Credits 预算不足，无法发出全部邀约')

      const now = new Date()
      const tasks = dto.creatorIds.map((creatorId) =>
        manager.create(CreatorTask, {
          growthTaskId: growth.id,
          campaignId: growth.campaignId ?? null,
          merchantId,
          storeId: growth.storeId ?? null,
          creatorId,
          channel: dto.channel,
          contentType: dto.contentType ?? 'short_video',
          brief: dto.brief,
          deadline,
          baseReward: reward,
          performanceReward: dto.performanceReward ?? {},
          campaignCreditsAllocated: credits,
          campaignCreditsConsumed: 0,
          trackingId: dto.trackingId ?? null,
          status: 'invited',
          stateChangedBy: merchantId,
          stateChangedAt: now,
        }),
      )
      const saved = await manager.save(CreatorTask, tasks)
      growth.compensationReserved = Number(growth.compensationReserved) + totalReward
      growth.campaignCreditsReserved = Number(growth.campaignCreditsReserved) + totalCredits
      await manager.save(growth)
      if (credits > 0)
        await manager.save(
          CampaignCreditLedgerEntry,
          saved.map((task) =>
            manager.create(CampaignCreditLedgerEntry, {
              creatorTaskId: task.id,
              growthTaskId: growth.id,
              merchantId,
              entryType: 'allocation',
              amount: credits,
              idempotencyKey: `campaign-credit-allocation:${task.id}`,
              metadata: { status: 'invited' },
            }),
          ),
        )
      await manager.save(
        AuditLog,
        saved.flatMap((task) => {
          const match = matched.get(task.creatorId)
          return [
            {
              actorType: 'merchant',
              actorId: merchantId,
              actionType: AuditActionType.CREATOR_TASK_TRANSITION,
              actionDescription: 'creator_task_created',
              targetType: 'creator_task',
              targetId: task.id,
              metadata: {
                before: null,
                after: 'created',
                compensationReserved: reward,
                campaignCreditsAllocated: credits,
              },
              result: 'success',
            },
            {
              actorType: 'merchant',
              actorId: merchantId,
              actionType: AuditActionType.CREATOR_TASK_TRANSITION,
              actionDescription: 'creator_task_matched_and_invited',
              targetType: 'creator_task',
              targetId: task.id,
              metadata: {
                before: 'created',
                transitions: ['matching', 'invited'],
                matching: match.explanation,
                matchingScore: match.matchingScore,
              },
              result: 'success',
            },
          ]
        }),
      )
      await manager.save(
        Notification,
        saved.map((task) =>
          manager.create(Notification, {
            recipientId: task.creatorId,
            recipientRole: UserRole.AGENT,
            type: 'creator_task_invited',
            title: '你收到了新的商业创作邀约',
            body: `任务报酬 ¥${reward.toFixed(2)}，请在 ${deadline.toLocaleString('zh-CN')} 前决定是否接受。`,
            targetType: 'creator_task',
            targetId: task.id,
            metadata: {
              growthTaskId: growth.id,
              channel: task.channel,
              contentType: task.contentType,
              baseReward: reward,
              campaignCredits: credits,
              matching: matched.get(task.creatorId).explanation,
            },
          }),
        ),
      )
      return {
        growthTaskId: growth.id,
        invitedCount: saved.length,
        items: saved.map((task) => ({
          creatorTaskId: task.id,
          creatorId: task.creatorId,
          status: task.status,
          deadline: task.deadline,
          baseReward: Number(task.baseReward),
          campaignCredits: Number(task.campaignCreditsAllocated),
        })),
      }
    })
  }

  private async evaluate(
    manager: EntityManager,
    growth: GrowthTask,
    query: CreatorMatchQueryDto,
  ): Promise<Match[]> {
    const [creators, accounts, existing, bindings, store] = await Promise.all([
      manager.find(SharingAgent, { where: { status: true, auditStatus: AuditStatus.APPROVED } }),
      manager.find(AgentPlatformAccount, { where: { status: true } }),
      manager.find(CreatorTask),
      manager.find(MerchantAgentBinding, { where: { merchantId: growth.merchantId } }),
      growth.storeId
        ? manager.findOne(Store, {
            where: { id: growth.storeId, merchantId: growth.merchantId, status: true },
          })
        : Promise.resolve(null),
    ])
    const requiredCategories = (query.categories ?? [])
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean)
    const tasksByCreator = new Map<string, CreatorTask[]>()
    for (const task of existing)
      if (NON_TERMINAL_STATUSES.has(task.status))
        tasksByCreator.set(task.creatorId, [...(tasksByCreator.get(task.creatorId) ?? []), task])
    const accountsByCreator = new Map<string, AgentPlatformAccount[]>()
    for (const account of accounts)
      accountsByCreator.set(account.agentId, [
        ...(accountsByCreator.get(account.agentId) ?? []),
        account,
      ])
    const bindingsByCreator = new Map<string, MerchantAgentBinding[]>()
    for (const binding of bindings) {
      if (!binding.agentId) continue
      bindingsByCreator.set(binding.agentId, [
        ...(bindingsByCreator.get(binding.agentId) ?? []),
        binding,
      ])
    }
    return creators
      .flatMap((creator) => {
        if (creator.blacklistedAt || creator.frozenAt || !creator.realNameVerified) return []
        const creatorBindings = bindingsByCreator.get(creator.id) ?? []
        if (
          creatorBindings.length > 0 &&
          !creatorBindings.some(
            (binding) =>
              binding.bindingStatus === 'active' && !binding.restrictedAt && !binding.unboundAt,
          )
        )
          return []
        const activeTasks = tasksByCreator.get(creator.id) ?? []
        if (activeTasks.some((task) => task.growthTaskId === growth.id)) return []
        if (creator.creatorTaskLimit != null && activeTasks.length >= creator.creatorTaskLimit)
          return []
        const matchedChannels = (accountsByCreator.get(creator.id) ?? [])
          .filter((account) => this.channelMatches(account.platformType, query.channel))
          .map((account) => account.platformType)
        if (!matchedChannels.length) return []
        const creatorCategories = creator.creatorCategories ?? []
        const categoryOverlap =
          requiredCategories.length === 0
            ? 1
            : requiredCategories.filter((category) =>
                creatorCategories.some((item) => item.toLowerCase() === category),
              ).length / requiredCategories.length
        const localMatch =
          Boolean(store?.city && creator.region?.includes(store.city)) ||
          Boolean(store?.district && creator.region?.includes(store.district))
        const scoreComponents = {
          growthScore: Math.round(
            Math.max(0, Math.min(100, Number(creator.creatorGrowthScore))) * 0.55,
          ),
          relevance: Math.round(categoryOverlap * 20),
          channelReadiness: 15,
          localRelevance: localMatch ? 10 : 4,
          availability: 10,
        }
        const matchingScore = Object.values(scoreComponents).reduce(
          (total, value) => total + value,
          0,
        )
        const reasons = [
          `Growth Score ${Number(creator.creatorGrowthScore)}（${scoreComponents.growthScore} 分）`,
          `已绑定 ${matchedChannels.join('、')} 账号`,
          categoryOverlap === 1 ? '内容类目符合要求' : '内容类目为部分匹配',
          localMatch ? '与门店所在区域匹配' : '当前可承接任务',
        ]
        return [
          {
            creatorId: creator.id,
            nickname: creator.nickname ?? null,
            avatar: creator.avatar ?? null,
            region: creator.region ?? null,
            creatorCategories,
            creatorGrowthScore: Number(creator.creatorGrowthScore),
            creatorGrowthLevel: creator.creatorGrowthLevel,
            activeTaskCount: activeTasks.length,
            taskLimit: creator.creatorTaskLimit ?? null,
            matchingScore,
            explanation: { scoreComponents, reasons, matchedChannels },
          },
        ]
      })
      .sort((a, b) => b.matchingScore - a.matchingScore)
  }

  private async requireFunded(
    repository: Repository<CampaignBudgetAllocation>,
    growth: GrowthTask,
  ) {
    const allocations = await repository.find({
      where: { growthTaskId: growth.id, status: 'funded' },
    })
    if (
      !allocations.some((item) => item.category === 'creator_payout') ||
      !allocations.some((item) => item.category === 'campaign_credits')
    )
      throw new BadRequestException('请先确认并冻结 Campaign 资金，才能匹配或邀约创作者')
    return allocations
  }

  private channelMatches(accountChannel: string, requestedChannel: string) {
    return (
      accountChannel === requestedChannel ||
      (requestedChannel === 'wechat_video' && accountChannel === 'wechat')
    )
  }
}
