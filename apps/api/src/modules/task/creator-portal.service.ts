import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { AuditActionType, AuditStatus, UserRole } from '@ai-auto/shared'
import { DataSource, In, Repository } from 'typeorm'
import { AuditLog } from '../admin/entities/audit-log.entity'
import { AgentWallet } from '../agent/entities/agent-wallet.entity'
import { SharingAgent } from '../agent/entities/sharing-agent.entity'
import { Notification } from '../notification/entities/notification.entity'
import {
  CreateCreatorTaskAppealDto,
  CreatorTaskListQueryDto,
  ListCreatorTaskAppealsDto,
  ResolveCreatorTaskAppealDto,
  SubmitCreatorVerificationDto,
  UpdateCreatorProfileDto,
  VerifyCreatorTaskPayoutDto,
} from './dto/creator-portal.dto'
import { CampaignBudgetAllocation } from './entities/campaign-budget-allocation.entity'
import {
  CreatorTaskAppeal,
  CreatorTaskAppealStatus,
  CreatorTaskPayout,
} from './entities/creator-task-payout.entity'
import { CreatorTask, GrowthTask } from './entities/growth-task.entity'

@Injectable()
export class CreatorPortalService {
  constructor(
    @InjectRepository(SharingAgent) private readonly creators: Repository<SharingAgent>,
    @InjectRepository(CreatorTask) private readonly tasks: Repository<CreatorTask>,
    @InjectRepository(GrowthTask) private readonly growthTasks: Repository<GrowthTask>,
    @InjectRepository(CampaignBudgetAllocation)
    private readonly allocations: Repository<CampaignBudgetAllocation>,
    @InjectRepository(CreatorTaskPayout) private readonly payouts: Repository<CreatorTaskPayout>,
    @InjectRepository(CreatorTaskAppeal) private readonly appeals: Repository<CreatorTaskAppeal>,
    @InjectRepository(AgentWallet) private readonly wallets: Repository<AgentWallet>,
    private readonly dataSource: DataSource,
  ) {}

  async profile(creatorId: string) {
    return this.profileOf(await this.creator(creatorId))
  }
  async updateProfile(creatorId: string, dto: UpdateCreatorProfileDto) {
    const creator = await this.creator(creatorId)
    if (dto.nickname !== undefined) creator.nickname = dto.nickname.trim() || null
    if (dto.avatar !== undefined) creator.avatar = dto.avatar
    if (dto.region !== undefined) creator.region = dto.region.trim() || null
    if (dto.creatorCategories !== undefined)
      creator.creatorCategories = [
        ...new Set(dto.creatorCategories.map((item) => item.trim()).filter(Boolean)),
      ]
    if (dto.taskPreferences !== undefined) creator.taskPreferences = dto.taskPreferences
    await this.creators.save(creator)
    await this.audit(creatorId, AuditActionType.CREATOR_PROFILE_UPDATED, 'creator', creatorId, {})
    return this.profileOf(creator)
  }
  async submitVerification(creatorId: string, dto: SubmitCreatorVerificationDto) {
    const creator = await this.creator(creatorId)
    creator.realName = dto.realName.trim()
    creator.idCardNo = dto.idCardNo.trim()
    creator.realNameVerified = false
    creator.auditStatus = AuditStatus.PENDING
    creator.auditComment = null
    await this.creators.save(creator)
    await this.audit(
      creatorId,
      AuditActionType.CREATOR_VERIFICATION_SUBMITTED,
      'creator',
      creatorId,
      { idDocumentStored: true },
    )
    return this.profileOf(creator)
  }

  async today(creatorId: string) {
    const creator = await this.creator(creatorId)
    const items = await this.enrich(
      await this.tasks.find({ where: { creatorId }, order: { deadline: 'ASC' } }),
    )
    return {
      eligibility: this.eligibility(creator),
      invitations: items.filter(
        (item) => item.status === 'invited' && item.funded && item.deadline > new Date(),
      ),
      activeTasks: items.filter((item) =>
        ['accepted', 'creating', 'submitted', 'approved', 'published', 'tracking'].includes(
          item.status,
        ),
      ),
      pendingSettlement: items.filter((item) =>
        ['verified', 'risk_hold'].includes(item.payout.status),
      ),
    }
  }
  async listTasks(creatorId: string, query: CreatorTaskListQueryDto) {
    const page = Number(query.page ?? 1),
      pageSize = Math.min(Number(query.pageSize ?? 20), 100)
    const where: Record<string, string> = { creatorId }
    if (query.status) where.status = query.status
    const [tasks, total] = await this.tasks.findAndCount({
      where,
      order: { updatedAt: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    })
    return {
      items: await this.enrich(tasks),
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    }
  }
  async task(creatorId: string, taskId: string) {
    const task = await this.tasks.findOne({ where: { id: taskId, creatorId } })
    if (!task) throw new NotFoundException('创作者任务不存在')
    return (await this.enrich([task]))[0]
  }
  async earnings(creatorId: string) {
    const [payouts, wallet, appeals] = await Promise.all([
      this.payouts.find({ where: { creatorId }, order: { createdAt: 'DESC' } }),
      this.wallets.findOne({ where: { agentId: creatorId } }),
      this.appeals.count({ where: { creatorId, status: 'open' } }),
    ])
    const sum = (statuses: string[], field: 'expectedAmount' | 'verifiedAmount') =>
      payouts
        .filter((item) => statuses.includes(item.status))
        .reduce((total, item) => total + Number(item[field] ?? 0), 0)
    return {
      expected: sum(['estimated', 'verified', 'settled', 'risk_hold'], 'expectedAmount'),
      verified: sum(['verified', 'settled'], 'verifiedAmount'),
      taskPayouts: payouts.map((item) => this.payout(item)),
      settlement: {
        tPlusBusinessDays: 3,
        pending: sum(['verified'], 'verifiedAmount'),
        settled: sum(['settled'], 'verifiedAmount'),
        wallet: {
          pending: Number(wallet?.pendingSettlementBalance ?? 0),
          available: Number(wallet?.settledBalance ?? 0),
          frozen: Number(wallet?.frozenBalance ?? 0),
        },
      },
      openAppealCount: appeals,
    }
  }
  async appeal(creatorId: string, taskId: string, dto: CreateCreatorTaskAppealDto) {
    const task = await this.tasks.findOne({ where: { id: taskId, creatorId } })
    if (!task) throw new NotFoundException('创作者任务不存在')
    const payout = await this.payouts.findOne({ where: { creatorTaskId: taskId } })
    if (dto.target === 'payout' && !payout) throw new BadRequestException('该任务尚未生成报酬记录')
    const openAppeal = await this.appeals.findOne({
      where: { creatorTaskId: taskId, creatorId, target: dto.target, status: 'open' },
    })
    if (openAppeal) throw new BadRequestException('该任务已有相同类型的待处理申诉')
    const appeal = await this.appeals.save(
      this.appeals.create({
        creatorTaskId: taskId,
        creatorId,
        payoutId: payout?.id ?? null,
        target: dto.target,
        reason: dto.reason,
        evidence: dto.evidence ?? {},
        status: 'open',
      }),
    )
    await this.audit(
      creatorId,
      AuditActionType.CREATOR_TASK_APPEALED,
      'creator_task_appeal',
      appeal.id,
      { taskId, target: dto.target },
    )
    return appeal
  }
  async listAppeals(creatorId: string) {
    return {
      items: await this.appeals.find({ where: { creatorId }, order: { createdAt: 'DESC' } }),
    }
  }

  async listAppealsForOperations(query: ListCreatorTaskAppealsDto = {}) {
    const page = Math.max(Number(query.page ?? 1) || 1, 1)
    const pageSize = Math.min(Math.max(Number(query.pageSize ?? 20) || 20, 1), 100)
    const normalizedQuery = { ...query, status: query.status ?? ('open' as const) }
    const builder = this.appealQuery(normalizedQuery)
    const [appeals, total] = await builder
      .orderBy('appeal.createdAt', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount()
    return {
      summary: await this.appealSummary({ ...query, status: 'all' }),
      items: await this.enrichAppeals(appeals),
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    }
  }

  async resolveAppeal(
    appealId: string,
    actor: { id: string; name?: string | null },
    dto: ResolveCreatorTaskAppealDto,
  ) {
    const appeal = await this.dataSource.transaction(async (manager) => {
      const current = await manager.findOne(CreatorTaskAppeal, { where: { id: appealId } })
      if (!current) throw new NotFoundException('创作者任务申诉不存在')
      if (current.status !== 'open')
        throw new BadRequestException(`该申诉已处理（${current.status}）`)
      const [task, payout] = await Promise.all([
        manager.findOne(CreatorTask, { where: { id: current.creatorTaskId } }),
        current.payoutId
          ? manager.findOne(CreatorTaskPayout, { where: { id: current.payoutId } })
          : manager.findOne(CreatorTaskPayout, { where: { creatorTaskId: current.creatorTaskId } }),
      ])
      const resolvedAt = new Date()
      current.status = dto.decision
      current.resolution = dto.resolution.trim()
      current.resolvedBy = actor.id
      current.resolvedAt = resolvedAt
      await manager.save(current)
      await manager.save(AuditLog, {
        actorType: 'admin',
        actorId: actor.id,
        actorName: actor.name ?? null,
        actionType: AuditActionType.CREATOR_TASK_APPEAL_RESOLVED,
        actionDescription: '创作者任务申诉处理',
        targetType: 'creator_task_appeal',
        targetId: current.id,
        metadata: {
          decision: dto.decision,
          resolution: current.resolution,
          target: current.target,
          creatorTaskId: current.creatorTaskId,
          creatorId: current.creatorId,
          merchantId: task?.merchantId ?? null,
          payoutId: payout?.id ?? current.payoutId ?? null,
          payoutStatus: payout?.status ?? null,
          previousStatus: 'open',
        },
        result: 'success',
      })
      await manager.save(Notification, {
        recipientId: current.creatorId,
        recipientRole: UserRole.AGENT,
        type: 'creator_task_appeal_resolved',
        title: dto.decision === 'accepted' ? '任务申诉已通过' : '任务申诉未通过',
        body: `申诉处理结果：${dto.decision === 'accepted' ? '通过' : '驳回'}；处理说明：${current.resolution}`,
        targetType: 'creator_task_appeal',
        targetId: current.id,
        metadata: { creatorTaskId: current.creatorTaskId, target: current.target, resolvedAt },
      })
      return current
    })
    return (await this.enrichAppeals([appeal]))[0]
  }

  async verifyPayout(taskId: string, actorId: string, dto: VerifyCreatorTaskPayoutDto) {
    return this.dataSource.transaction(async (manager) => {
      const task = await manager.findOne(CreatorTask, { where: { id: taskId } })
      if (!task) throw new NotFoundException('创作者任务不存在')
      if (task.status !== 'completed') throw new BadRequestException('仅已完成任务可核验报酬')
      const payout = await manager.findOne(CreatorTaskPayout, {
        where: { creatorTaskId: taskId },
        lock: { mode: 'pessimistic_write' },
      })
      if (!payout) throw new BadRequestException('任务尚未接受')
      if (payout.status !== 'estimated') throw new BadRequestException('仅待核验报酬可核验')
      const amount = Number(dto.verifiedAmount),
        settleAt = this.addBusinessDays(new Date(), 3)
      payout.status = 'verified'
      payout.verifiedAmount = amount
      payout.verificationEvidence = dto.evidence ?? {}
      payout.verifiedAt = new Date()
      payout.settleAt = settleAt
      await manager.save(payout)
      let wallet = await manager.findOne(AgentWallet, {
        where: { agentId: task.creatorId },
        lock: { mode: 'pessimistic_write' },
      })
      if (!wallet)
        wallet = manager.create(AgentWallet, {
          agentId: task.creatorId,
          pendingSettlementBalance: 0,
          settledBalance: 0,
          frozenBalance: 0,
          totalEarned: 0,
          totalPlatformFee: 0,
          totalSettled: 0,
          totalWithdrawn: 0,
          aiTokenBalance: 0,
          status: true,
        })
      wallet.pendingSettlementBalance = Number(wallet.pendingSettlementBalance) + amount
      wallet.totalEarned = Number(wallet.totalEarned) + amount
      await manager.save(wallet)
      await manager.save(AuditLog, {
        actorType: 'admin',
        actorId,
        actionType: AuditActionType.CREATOR_TASK_PAYOUT_VERIFIED,
        actionDescription: 'creator_task_payout_verified',
        targetType: 'creator_task_payout',
        targetId: payout.id,
        metadata: { taskId, amount, settleAt, evidence: dto.evidence ?? {} },
        result: 'success',
      })
      await manager.save(Notification, {
        recipientId: task.creatorId,
        recipientRole: UserRole.AGENT,
        type: 'creator_task_payout_verified',
        title: '任务报酬已核验',
        body: `已核验 ¥${amount.toFixed(2)}，将在 T+3 个工作日结算。`,
        targetType: 'creator_task',
        targetId: task.id,
        metadata: { payoutId: payout.id, settleAt },
      })
      return this.payout(payout)
    })
  }

  private async enrich(tasks: CreatorTask[]) {
    if (!tasks.length) return []
    const growthIds = [...new Set(tasks.map((item) => item.growthTaskId))]
    const [growth, allocations, payouts, audits] = await Promise.all([
      this.growthTasks.findBy({ id: In(growthIds) }),
      this.allocations.find({ where: { growthTaskId: In(growthIds), status: 'funded' } }),
      this.payouts.find({ where: { creatorTaskId: In(tasks.map((item) => item.id)) } }),
      this.dataSource
        .getRepository(AuditLog)
        .find({ where: { targetId: In(tasks.map((item) => item.id)) } }),
    ])
    const byGrowth = new Map(growth.map((item) => [item.id, item]))
    const byPayout = new Map(payouts.map((item) => [item.creatorTaskId, item]))
    const categories = new Map<string, Set<string>>()
    const reasons = new Map<string, unknown>()
    for (const item of allocations)
      categories.set(
        item.growthTaskId,
        new Set([...(categories.get(item.growthTaskId) ?? []), item.category]),
      )
    for (const audit of audits)
      if (audit.actionDescription === 'creator_task_matched_and_invited')
        reasons.set(audit.targetId, (audit.metadata as Record<string, unknown>).matching)
    return tasks.map((task) => {
      const funded =
        byGrowth.get(task.growthTaskId)?.status === 'active' &&
        ['creator_payout', 'campaign_credits'].every((type) =>
          categories.get(task.growthTaskId)?.has(type),
        )
      return {
        creatorTaskId: task.id,
        growthTaskId: task.growthTaskId,
        campaignId: task.campaignId ?? null,
        channel: task.channel,
        contentType: task.contentType,
        brief: task.brief,
        deadline: task.deadline,
        status: task.status,
        funded,
        matchingReason: reasons.get(task.id) ?? null,
        expectedPayout: Number(task.baseReward),
        performanceReward: task.performanceReward,
        campaignCredits: {
          allocated: Number(task.campaignCreditsAllocated),
          consumed: Number(task.campaignCreditsConsumed),
          remaining: Number(task.campaignCreditsAllocated) - Number(task.campaignCreditsConsumed),
        },
        publishedUrl: task.publishedUrl ?? null,
        reviewReason: task.reviewReason ?? null,
        riskHoldReason: task.riskHoldReason ?? null,
        payout: this.payout(byPayout.get(task.id)),
      }
    })
  }
  private appealQuery(query: ListCreatorTaskAppealsDto) {
    const builder = this.appeals
      .createQueryBuilder('appeal')
      .leftJoin(CreatorTask, 'task', 'task.id = appeal.creatorTaskId')
    if (query.status && query.status !== 'all')
      builder.andWhere('appeal.status = :status', { status: query.status })
    if (query.target) builder.andWhere('appeal.target = :target', { target: query.target })
    if (query.creatorId)
      builder.andWhere('appeal.creatorId = :creatorId', { creatorId: query.creatorId })
    if (query.creatorTaskId)
      builder.andWhere('appeal.creatorTaskId = :creatorTaskId', {
        creatorTaskId: query.creatorTaskId,
      })
    if (query.merchantId)
      builder.andWhere('task.merchantId = :merchantId', { merchantId: query.merchantId })
    return builder
  }
  private async appealSummary(query: ListCreatorTaskAppealsDto) {
    const statuses: CreatorTaskAppealStatus[] = ['open', 'accepted', 'rejected', 'withdrawn']
    const entries = await Promise.all(
      statuses.map(
        async (status) =>
          [status, await this.appealQuery({ ...query, status }).getCount()] as const,
      ),
    )
    const summary = Object.fromEntries(entries) as Record<CreatorTaskAppealStatus, number>
    return { ...summary, total: entries.reduce((count, [, value]) => count + value, 0) }
  }
  private async enrichAppeals(appeals: CreatorTaskAppeal[]) {
    if (!appeals.length) return []
    const taskIds = [...new Set(appeals.map((item) => item.creatorTaskId))]
    const creatorIds = [...new Set(appeals.map((item) => item.creatorId))]
    const [tasks, payouts, creators] = await Promise.all([
      this.tasks.find({ where: { id: In(taskIds) } }),
      this.payouts.find({ where: { creatorTaskId: In(taskIds) } }),
      this.creators.find({ where: { id: In(creatorIds) } }),
    ])
    const byTask = new Map(tasks.map((item) => [item.id, item]))
    const byPayoutTask = new Map(payouts.map((item) => [item.creatorTaskId, item]))
    const byPayoutId = new Map(payouts.map((item) => [item.id, item]))
    const byCreator = new Map(creators.map((item) => [item.id, item]))
    return appeals.map((appeal) => {
      const task = byTask.get(appeal.creatorTaskId)
      const payout =
        (appeal.payoutId ? byPayoutId.get(appeal.payoutId) : null) ??
        byPayoutTask.get(appeal.creatorTaskId) ??
        null
      const creator = byCreator.get(appeal.creatorId)
      return {
        appealId: appeal.id,
        creatorTaskId: appeal.creatorTaskId,
        creatorId: appeal.creatorId,
        payoutId: appeal.payoutId ?? null,
        target: appeal.target,
        status: appeal.status,
        reason: appeal.reason,
        evidence: appeal.evidence ?? {},
        resolution: appeal.resolution ?? null,
        resolvedBy: appeal.resolvedBy ?? null,
        resolvedAt: appeal.resolvedAt ?? null,
        createdAt: appeal.createdAt,
        updatedAt: appeal.updatedAt,
        creator: creator
          ? {
              creatorId: creator.id,
              nickname: creator.nickname ?? null,
              phone: this.maskPhone(creator.phone),
              realNameVerified: creator.realNameVerified,
              auditStatus: creator.auditStatus,
              growthScore: Number(creator.creatorGrowthScore ?? 0),
              growthLevel: creator.creatorGrowthLevel ?? 1,
            }
          : null,
        task: task
          ? {
              id: task.id,
              growthTaskId: task.growthTaskId,
              campaignId: task.campaignId ?? null,
              merchantId: task.merchantId,
              channel: task.channel,
              contentType: task.contentType,
              brief: task.brief,
              deadline: task.deadline,
              status: task.status,
              baseReward: Number(task.baseReward),
              reviewReason: task.reviewReason ?? null,
              riskHoldReason: task.riskHoldReason ?? null,
            }
          : null,
        payout: payout ? this.payout(payout) : null,
      }
    })
  }
  private profileOf(creator: SharingAgent) {
    return {
      creatorId: creator.id,
      nickname: creator.nickname ?? null,
      avatar: creator.avatar ?? null,
      phone: creator.phone,
      region: creator.region ?? null,
      categories: creator.creatorCategories ?? [],
      taskPreferences: creator.taskPreferences ?? {},
      verification: {
        realNameVerified: creator.realNameVerified,
        auditStatus: creator.auditStatus,
        auditComment: creator.auditComment ?? null,
      },
      growth: {
        score: Number(creator.creatorGrowthScore),
        level: creator.creatorGrowthLevel,
        breakdown: creator.creatorScoreBreakdown ?? {},
        updatedAt: creator.creatorScoreUpdatedAt ?? null,
      },
      eligibility: this.eligibility(creator),
    }
  }
  private eligibility(creator: SharingAgent) {
    const reasons = [
      !creator.realNameVerified ? '待完成实名核验' : null,
      creator.auditStatus !== AuditStatus.APPROVED ? '账号待审核' : null,
      creator.blacklistedAt ? '账号已列入黑名单' : null,
      creator.frozenAt ? '账号已冻结' : null,
      !creator.status ? '账号不可用' : null,
    ].filter(Boolean)
    return { eligible: reasons.length === 0, reasons }
  }
  private payout(payout?: CreatorTaskPayout) {
    return payout
      ? {
          payoutId: payout.id,
          status: payout.status,
          expectedAmount: Number(payout.expectedAmount),
          verifiedAmount: payout.verifiedAmount == null ? null : Number(payout.verifiedAmount),
          verificationEvidence: payout.verificationEvidence,
          verifiedAt: payout.verifiedAt ?? null,
          settleAt: payout.settleAt ?? null,
          settledAt: payout.settledAt ?? null,
          riskHoldReason: payout.riskHoldReason ?? null,
          riskHoldPreviousStatus: payout.riskHoldPreviousStatus ?? null,
        }
      : { status: 'not_created', expectedAmount: 0, verifiedAmount: null, settleAt: null }
  }
  private async creator(id: string) {
    const creator = await this.creators.findOne({ where: { id } })
    if (!creator) throw new NotFoundException('创作者不存在')
    return creator
  }
  private audit(
    actorId: string,
    actionType: AuditActionType,
    targetType: string,
    targetId: string,
    metadata: Record<string, unknown>,
  ) {
    return this.dataSource.getRepository(AuditLog).save({
      actorType: 'creator',
      actorId,
      actionType,
      actionDescription: actionType,
      targetType,
      targetId,
      metadata,
      result: 'success',
    })
  }
  private maskPhone(phone?: string | null) {
    return phone && phone.length >= 7 ? `${phone.slice(0, 3)}****${phone.slice(-4)}` : (phone ?? '')
  }
  private addBusinessDays(date: Date, days: number) {
    const value = new Date(date)
    while (days > 0) {
      value.setDate(value.getDate() + 1)
      if (value.getDay() !== 0 && value.getDay() !== 6) days--
    }
    value.setHours(0, 0, 0, 0)
    return value
  }
}
