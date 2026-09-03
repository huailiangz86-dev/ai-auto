import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { AuditActionType, AuditStatus, UserRole } from '@ai-auto/shared'
import { DataSource, EntityManager, Repository } from 'typeorm'
import { AuditLog } from '../admin/entities/audit-log.entity'
import { FinancialLedgerEntry } from '../admin/entities/financial-ledger-entry.entity'
import { Notification } from '../notification/entities/notification.entity'
import { SharingAgent } from '../agent/entities/sharing-agent.entity'
import { PilotInstrumentationService } from '../pilot/pilot-instrumentation.service'
import { PilotMeasurementService } from '../pilot/pilot-measurement.service'
import { CreateCreatorTaskDto, CreateGrowthTaskDto } from './dto/growth-task.dto'
import { CampaignBudgetAllocation } from './entities/campaign-budget-allocation.entity'
import { CreatorTaskPayout } from './entities/creator-task-payout.entity'
import { GrowthPlan } from './entities/growth-plan.entity'
import {
  CampaignCreditLedgerEntry,
  CreatorTask,
  CreatorTaskStatus,
  GrowthTask,
  GrowthTaskStatus,
} from './entities/growth-task.entity'

type Actor = { id: string; type: 'merchant' | 'creator' | 'admin' | 'system' }
const TERMINAL_CREATOR_STATES: CreatorTaskStatus[] = [
  'settled',
  'expired',
  'cancelled',
  'violation',
]
const CREATOR_TRANSITIONS: Partial<Record<CreatorTaskStatus, CreatorTaskStatus[]>> = {
  created: ['matching', 'cancelled'],
  matching: ['invited', 'cancelled'],
  invited: ['accepted', 'expired', 'cancelled'],
  accepted: ['creating', 'cancelled'],
  creating: ['submitted', 'cancelled'],
  submitted: ['approved', 'rejected'],
  rejected: ['creating', 'cancelled'],
  approved: ['published'],
  published: ['tracking'],
  tracking: ['completed'],
  completed: ['settled'],
}
const GROWTH_TRANSITIONS: Record<GrowthTaskStatus, GrowthTaskStatus[]> = {
  draft: ['ready_for_review', 'cancelled'],
  ready_for_review: ['active', 'cancelled'],
  active: ['paused', 'completed', 'cancelled'],
  paused: ['active', 'cancelled'],
  completed: [],
  cancelled: [],
}

@Injectable()
export class GrowthTaskService {
  constructor(
    @InjectRepository(GrowthTask) private readonly growthRepo: Repository<GrowthTask>,
    @InjectRepository(CreatorTask) private readonly creatorTaskRepo: Repository<CreatorTask>,
    @InjectRepository(CampaignCreditLedgerEntry)
    private readonly creditRepo: Repository<CampaignCreditLedgerEntry>,
    @InjectRepository(GrowthPlan) private readonly growthPlanRepo: Repository<GrowthPlan>,
    @InjectRepository(CampaignBudgetAllocation)
    private readonly allocationRepo: Repository<CampaignBudgetAllocation>,
    private readonly dataSource: DataSource,
    private readonly instrumentation: PilotInstrumentationService,
    private readonly pilotMeasurement: PilotMeasurementService,
  ) {}

  async createGrowthTask(merchantId: string, dto: CreateGrowthTaskDto) {
    const startAt = new Date(dto.startAt)
    const endAt = new Date(dto.endAt)
    if (endAt <= startAt) throw new BadRequestException('Growth Task 结束时间必须晚于开始时间')
    return this.growthRepo.save(
      this.growthRepo.create({
        ...dto,
        merchantId,
        storeId: dto.storeId ?? null,
        campaignId: dto.campaignId ?? null,
        baselineValue: dto.baselineValue ?? 0,
        startAt,
        endAt,
        acceptableRiskBoundary: dto.acceptableRiskBoundary ?? null,
        acceptableRoiBoundary: dto.acceptableRoiBoundary ?? null,
        status: 'draft',
        compensationReserved: 0,
        campaignCreditsReserved: 0,
      }),
    )
  }

  async moveGrowthTask(merchantId: string, growthTaskId: string, target: GrowthTaskStatus) {
    return this.dataSource.transaction(async (manager) => {
      const task = await manager.findOne(GrowthTask, { where: { id: growthTaskId, merchantId } })
      if (!task) throw new NotFoundException('Growth Task 不存在')
      if (!GROWTH_TRANSITIONS[task.status].includes(target))
        throw new BadRequestException(`Growth Task 不能从 ${task.status} 变更为 ${target}`)
      const before = task.status
      if (target === 'active' && task.campaignId)
        await this.pilotMeasurement.assertActivationAllowed(merchantId, task.campaignId)
      const isRepeatActivation =
        target === 'active' && (await this.instrumentation.hasPriorActivation(manager, merchantId))
      task.status = target
      await manager.save(task)
      await this.audit(
        manager,
        { id: merchantId, type: 'merchant' },
        AuditActionType.GROWTH_TASK_TRANSITION,
        'growth_task',
        task.id,
        { before, after: target },
      )
      if (target === 'active') {
        const event = {
          subjectType: 'growth_task',
          subjectId: task.id,
          merchantId: task.merchantId,
          campaignId: task.campaignId ?? null,
          growthTaskId: task.id,
          creatorId: null,
          creatorTaskId: null,
          occurredAt: new Date(),
          metadata: { before, after: target },
        }
        await this.instrumentation.record(
          {
            ...event,
            eventType: 'campaign_activated',
            idempotencyKey: 'pilot:growth-task:' + task.id + ':activated',
          },
          manager,
        )
        if (isRepeatActivation)
          await this.instrumentation.record(
            {
              ...event,
              eventType: 'campaign_reinvested',
              idempotencyKey: 'pilot:growth-task:' + task.id + ':reinvested',
              metadata: { ...event.metadata, repeatOfExistingGrowthTask: true },
            },
            manager,
          )
      }
      return task
    })
  }

  async createCreatorTask(merchantId: string, growthTaskId: string, dto: CreateCreatorTaskDto) {
    const deadline = new Date(dto.deadline)
    if (deadline <= new Date()) throw new BadRequestException('创作者任务截止时间必须在未来')
    return this.dataSource.transaction(async (manager) => {
      const growth = await manager.findOne(GrowthTask, { where: { id: growthTaskId, merchantId } })
      if (!growth) throw new NotFoundException('Growth Task 不存在')
      if (growth.status !== 'active')
        throw new BadRequestException('仅活跃的 Growth Task 可以创建创作者任务')
      if (deadline > growth.endAt)
        throw new BadRequestException('创作者任务截止时间不能晚于 Growth Task')
      const compensation = Number(dto.baseReward)
      const credits = Number(dto.campaignCredits ?? 0)
      if (
        Number(growth.compensationReserved) +
          Number(growth.campaignCreditsReserved) +
          compensation +
          credits >
        Number(growth.budget)
      )
        throw new BadRequestException('Growth Budget 不足，无法锁定任务补偿和 Campaign Credits')
      const task = manager.create(CreatorTask, {
        growthTaskId,
        campaignId: growth.campaignId ?? null,
        merchantId,
        storeId: growth.storeId ?? null,
        creatorId: dto.creatorId,
        channel: dto.channel,
        contentType: dto.contentType,
        brief: dto.brief,
        deadline,
        baseReward: compensation,
        performanceReward: dto.performanceReward ?? {},
        campaignCreditsAllocated: credits,
        campaignCreditsConsumed: 0,
        trackingId: dto.trackingId ?? null,
        status: 'created',
      })
      const saved = await manager.save(task)
      growth.compensationReserved = Number(growth.compensationReserved) + compensation
      growth.campaignCreditsReserved = Number(growth.campaignCreditsReserved) + credits
      await manager.save(growth)
      if (credits > 0)
        await manager.save(CampaignCreditLedgerEntry, {
          creatorTaskId: saved.id,
          growthTaskId,
          merchantId,
          entryType: 'allocation',
          amount: credits,
          idempotencyKey: `campaign-credit-allocation:${saved.id}`,
          metadata: { status: saved.status },
        })
      await this.audit(
        manager,
        { id: merchantId, type: 'merchant' },
        AuditActionType.CREATOR_TASK_TRANSITION,
        'creator_task',
        saved.id,
        {
          before: null,
          after: 'created',
          compensationReserved: compensation,
          campaignCreditsAllocated: credits,
        },
      )
      return saved
    })
  }

  async moveCreatorTaskForMerchant(
    merchantId: string,
    creatorTaskId: string,
    target: CreatorTaskStatus,
  ) {
    if (!['matching', 'invited', 'cancelled'].includes(target))
      throw new BadRequestException('商户不能执行该创作者任务流转')
    return this.transitionCreatorTask(
      creatorTaskId,
      target,
      { id: merchantId, type: 'merchant' },
      { merchantId },
    )
  }

  async moveCreatorTaskForCreator(
    creatorId: string,
    creatorTaskId: string,
    target: CreatorTaskStatus,
    publishedUrl?: string,
  ) {
    if (
      !['accepted', 'creating', 'submitted', 'published', 'tracking', 'completed'].includes(target)
    )
      throw new BadRequestException('创作者不能执行该任务流转')
    return this.transitionCreatorTask(
      creatorTaskId,
      target,
      { id: creatorId, type: 'creator' },
      { creatorId, publishedUrl },
    )
  }

  async reviewCreatorTask(
    creatorTaskId: string,
    actorId: string,
    decision: 'approve' | 'reject',
    reason: string,
  ) {
    const target: CreatorTaskStatus = decision === 'approve' ? 'approved' : 'rejected'
    const task = await this.transitionCreatorTask(
      creatorTaskId,
      target,
      { id: actorId, type: 'admin' },
      { reviewReason: reason, reviewedBy: actorId, reviewedAt: new Date() },
      AuditActionType.CREATOR_TASK_REVIEWED,
    )
    await this.notifyCreator(
      task.creatorId,
      task.id,
      'creator_task_reviewed',
      target === 'approved' ? '创作者任务审核通过' : '创作者任务审核未通过',
      target === 'approved' ? '你的任务已审核通过，可继续发布。' : `驳回原因：${reason}`,
      { decision, reason },
    )
    return task
  }

  async holdForRisk(creatorTaskId: string, actorId: string, reason: string) {
    return this.dataSource.transaction(async (manager) => {
      const task = await this.requireCreatorTask(manager, creatorTaskId)
      if (TERMINAL_CREATOR_STATES.includes(task.status) || task.status === 'risk_hold')
        throw new BadRequestException('该任务不能进入风控暂停')
      const before = task.status
      task.status = 'risk_hold'
      task.riskHoldPreviousStatus = before
      task.riskHoldReason = reason
      task.stateChangedBy = actorId
      task.stateChangedAt = new Date()
      await manager.save(task)
      await this.audit(
        manager,
        { id: actorId, type: 'admin' },
        AuditActionType.CREATOR_TASK_RISK_HELD,
        'creator_task',
        task.id,
        { before, after: 'risk_hold', reason },
      )
      await this.instrumentation.record(
        {
          eventType: 'task_risk_held',
          idempotencyKey:
            'pilot:creator-task:' + task.id + ':risk-hold:' + task.stateChangedAt!.getTime(),
          subjectType: 'creator_task',
          subjectId: task.id,
          merchantId: task.merchantId,
          campaignId: task.campaignId ?? null,
          growthTaskId: task.growthTaskId,
          creatorId: task.creatorId,
          creatorTaskId: task.id,
          occurredAt: task.stateChangedAt!,
          metadata: { before, reason },
        },
        manager,
      )
      await manager.save(Notification, {
        recipientId: task.creatorId,
        recipientRole: UserRole.AGENT,
        type: 'creator_task_risk_hold',
        title: '创作者任务已暂停进行风控核查',
        body: `暂停原因：${reason}`,
        targetType: 'creator_task',
        targetId: task.id,
        metadata: { reason, previousStatus: before },
      })
      return task
    })
  }

  async resolveRiskHold(
    creatorTaskId: string,
    actorId: string,
    action: 'resume' | 'violation',
    reason: string,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const task = await this.requireCreatorTask(manager, creatorTaskId)
      if (task.status !== 'risk_hold') throw new BadRequestException('任务当前不在风控暂停状态')
      const target: CreatorTaskStatus =
        action === 'violation' ? 'violation' : (task.riskHoldPreviousStatus ?? 'accepted')
      task.status = target
      task.stateReason = reason
      task.stateChangedBy = actorId
      task.stateChangedAt = new Date()
      await manager.save(task)
      await this.audit(
        manager,
        { id: actorId, type: 'admin' },
        AuditActionType.CREATOR_TASK_RISK_HELD,
        'creator_task',
        task.id,
        { before: 'risk_hold', after: target, action, reason },
      )
      await this.instrumentation.record(
        {
          eventType: 'task_risk_resolved',
          idempotencyKey:
            'pilot:creator-task:' + task.id + ':risk-resolved:' + task.stateChangedAt!.getTime(),
          subjectType: 'creator_task',
          subjectId: task.id,
          merchantId: task.merchantId,
          campaignId: task.campaignId ?? null,
          growthTaskId: task.growthTaskId,
          creatorId: task.creatorId,
          creatorTaskId: task.id,
          occurredAt: task.stateChangedAt!,
          metadata: { action, reason, after: target },
        },
        manager,
      )
      await manager.save(Notification, {
        recipientId: task.creatorId,
        recipientRole: UserRole.AGENT,
        type: 'creator_task_risk_resolved',
        title: action === 'resume' ? '创作者任务风控暂停已解除' : '创作者任务已判定违规',
        body: `${action === 'resume' ? '任务已恢复至原状态。' : '该任务已终止。'}处理说明：${reason}`,
        targetType: 'creator_task',
        targetId: task.id,
        metadata: { action, reason, before: 'risk_hold', after: target },
      })
      return task
    })
  }

  async consumeCampaignCredits(
    creatorId: string,
    creatorTaskId: string,
    amount: number,
    sourceReference: string,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const task = await this.requireCreatorTask(manager, creatorTaskId)
      if (task.creatorId !== creatorId) throw new NotFoundException('创作者任务不存在')
      if (!['accepted', 'creating'].includes(task.status))
        throw new BadRequestException('仅已接受或创作中的商业任务可消耗 Campaign Credits')
      const idempotencyKey = `campaign-credit-consumption:${task.id}:${sourceReference}`
      const existing = await manager.findOne(CampaignCreditLedgerEntry, {
        where: { idempotencyKey },
      })
      if (existing)
        return {
          creatorTaskId: task.id,
          consumed: Number(task.campaignCreditsConsumed),
          remaining: Number(task.campaignCreditsAllocated) - Number(task.campaignCreditsConsumed),
          idempotent: true,
        }
      if (Number(task.campaignCreditsConsumed) + amount > Number(task.campaignCreditsAllocated))
        throw new BadRequestException('Campaign Credits 余额不足；不会扣减创作者个人 Credits')
      task.campaignCreditsConsumed = Number(task.campaignCreditsConsumed) + amount
      await manager.save(task)
      await manager.save(CampaignCreditLedgerEntry, {
        creatorTaskId: task.id,
        growthTaskId: task.growthTaskId,
        merchantId: task.merchantId,
        entryType: 'consumption',
        amount,
        idempotencyKey,
        sourceReference,
        metadata: { creatorId },
      })
      await manager.save(FinancialLedgerEntry, {
        classification: 'operating_cost',
        entryType: 'campaign_credit_consumption',
        amount,
        currency: 'CNY',
        merchantId: task.merchantId,
        campaignId: task.campaignId ?? null,
        creatorId,
        creatorTaskId: task.id,
        sourceReference,
        idempotencyKey: `financial:${idempotencyKey}`,
        occurredAt: new Date(),
        description: '商户 Campaign Credits 消耗',
        metadata: { payer: 'merchant', personalCreatorCreditsDebited: false },
      })
      await this.audit(
        manager,
        { id: creatorId, type: 'creator' },
        AuditActionType.CAMPAIGN_CREDIT_CONSUMED,
        'creator_task',
        task.id,
        {
          amount,
          sourceReference,
          remaining: Number(task.campaignCreditsAllocated) - Number(task.campaignCreditsConsumed),
        },
      )
      await this.instrumentation.record(
        {
          eventType: 'campaign_credits_consumed',
          idempotencyKey: 'pilot:campaign-credit:' + task.id + ':' + sourceReference,
          subjectType: 'creator_task',
          subjectId: task.id,
          merchantId: task.merchantId,
          campaignId: task.campaignId ?? null,
          growthTaskId: task.growthTaskId,
          creatorId: task.creatorId,
          creatorTaskId: task.id,
          occurredAt: new Date(),
          metadata: {
            amount,
            sourceReference,
            remaining: Number(task.campaignCreditsAllocated) - Number(task.campaignCreditsConsumed),
          },
        },
        manager,
      )
      return {
        creatorTaskId: task.id,
        consumed: Number(task.campaignCreditsConsumed),
        remaining: Number(task.campaignCreditsAllocated) - Number(task.campaignCreditsConsumed),
        idempotent: false,
      }
    })
  }

  private async transitionCreatorTask(
    creatorTaskId: string,
    target: CreatorTaskStatus,
    actor: Actor,
    options: Record<string, unknown>,
    action = AuditActionType.CREATOR_TASK_TRANSITION,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const task = await this.requireCreatorTask(manager, creatorTaskId)
      if (options.merchantId && task.merchantId !== options.merchantId)
        throw new NotFoundException('创作者任务不存在')
      if (options.creatorId && task.creatorId !== options.creatorId)
        throw new NotFoundException('创作者任务不存在')
      if (!CREATOR_TRANSITIONS[task.status]?.includes(target))
        throw new BadRequestException(`创作者任务不能从 ${task.status} 变更为 ${target}`)
      if (target === 'published' && !options.publishedUrl)
        throw new BadRequestException('发布任务必须提供 publishedUrl')
      if (target === 'accepted') {
        const creator = await manager.findOne(SharingAgent, { where: { id: task.creatorId } })
        if (
          !creator ||
          !creator.status ||
          !creator.realNameVerified ||
          creator.auditStatus !== AuditStatus.APPROVED ||
          creator.blacklistedAt ||
          creator.frozenAt
        )
          throw new BadRequestException('创作者尚未通过实名或准入审核，不能接受商业任务')
        const funded = await manager.find(CampaignBudgetAllocation, {
          where: { growthTaskId: task.growthTaskId, status: 'funded' },
        })
        if (
          !['creator_payout', 'campaign_credits'].every((category) =>
            funded.some((item) => item.category === category),
          )
        )
          throw new BadRequestException('商户资金尚未确认，任务暂不可接受')
        if (task.deadline <= new Date()) throw new BadRequestException('任务邀约已过期')
      }
      const before = task.status
      task.status = target
      task.stateChangedBy = actor.id
      task.stateChangedAt = new Date()
      if (options.publishedUrl) task.publishedUrl = String(options.publishedUrl)
      if (options.reviewReason !== undefined) task.reviewReason = String(options.reviewReason)
      if (options.reviewedBy) task.reviewedBy = String(options.reviewedBy)
      if (options.reviewedAt) task.reviewedAt = options.reviewedAt as Date
      if (target === 'accepted') {
        task.compensationSnapshot = {
          baseReward: Number(task.baseReward),
          performanceReward: task.performanceReward,
          campaignCreditsAllocated: Number(task.campaignCreditsAllocated),
        }
        task.compensationLockedAt = new Date()
      }
      await manager.save(task)
      if (target === 'accepted')
        await manager.save(
          CreatorTaskPayout,
          manager.create(CreatorTaskPayout, {
            creatorTaskId: task.id,
            creatorId: task.creatorId,
            merchantId: task.merchantId,
            campaignId: task.campaignId ?? null,
            expectedAmount: Number(task.baseReward),
            status: 'estimated',
            verificationEvidence: {},
          }),
        )
      await this.audit(manager, actor, action, 'creator_task', task.id, {
        before,
        after: target,
        compensationLockedAt: task.compensationLockedAt ?? null,
        reviewReason: task.reviewReason ?? null,
      })
      const eventType = (
        {
          invited: 'task_invited',
          accepted: 'task_accepted',
          submitted: 'task_submitted',
          approved: 'task_reviewed',
          rejected: 'task_reviewed',
          published: 'content_published',
          completed: 'task_completed',
        } as const
      )[target]
      if (eventType)
        await this.instrumentation.record(
          {
            eventType,
            idempotencyKey: 'pilot:creator-task:' + task.id + ':' + target,
            subjectType: 'creator_task',
            subjectId: task.id,
            merchantId: task.merchantId,
            campaignId: task.campaignId ?? null,
            growthTaskId: task.growthTaskId,
            creatorId: task.creatorId,
            creatorTaskId: task.id,
            occurredAt: task.stateChangedAt ?? new Date(),
            metadata: {
              before,
              after: target,
              baseReward: Number(task.baseReward),
              campaignCreditsAllocated: Number(task.campaignCreditsAllocated),
              publishedUrl: task.publishedUrl ?? null,
              reviewDecision:
                target === 'approved' ? 'approve' : target === 'rejected' ? 'reject' : null,
            },
          },
          manager,
        )
      return task
    })
  }

  private async requireCreatorTask(manager: EntityManager, creatorTaskId: string) {
    const task = await manager.findOne(CreatorTask, { where: { id: creatorTaskId } })
    if (!task) throw new NotFoundException('创作者任务不存在')
    return task
  }

  private audit(
    manager: EntityManager,
    actor: Actor,
    actionType: AuditActionType,
    targetType: string,
    targetId: string,
    metadata: Record<string, unknown>,
  ) {
    return manager.save(AuditLog, {
      actorType: actor.type,
      actorId: actor.id,
      actionType,
      actionDescription: actionType,
      targetType,
      targetId,
      metadata,
      result: 'success',
    })
  }

  private async notifyCreator(
    creatorId: string,
    creatorTaskId: string,
    type: string,
    title: string,
    body: string,
    metadata: Record<string, unknown>,
  ) {
    await this.dataSource.getRepository(Notification).save({
      recipientId: creatorId,
      recipientRole: UserRole.AGENT,
      type,
      title,
      body,
      targetType: 'creator_task',
      targetId: creatorTaskId,
      metadata,
    })
  }
}
