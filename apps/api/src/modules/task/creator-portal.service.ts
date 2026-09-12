import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { AuditActionType, AuditStatus, UserRole } from '@ai-auto/shared'
import { DataSource, In, MoreThan, Repository } from 'typeorm'
import { AuditLog } from '../admin/entities/audit-log.entity'
import { FinancialLedgerEntry } from '../admin/entities/financial-ledger-entry.entity'
import { AgentWallet } from '../agent/entities/agent-wallet.entity'
import { SharingAgent } from '../agent/entities/sharing-agent.entity'
import { Notification } from '../notification/entities/notification.entity'
import {
  CreateCreatorTaskAppealDto,
  CreatorTaskListQueryDto,
  ListRecoveryReceivablesDto,
  ListCreatorTaskAppealsDto,
  ResolveCreatorTaskAppealDto,
  SubmitCreatorVerificationDto,
  UpdateCreatorProfileDto,
  VerifyCreatorTaskPayoutDto,
} from './dto/creator-portal.dto'
import { CampaignBudgetAllocation } from './entities/campaign-budget-allocation.entity'
import {
  CreatorTaskAppeal,
  CreatorTaskAppealAppellantType,
  CreatorTaskAppealDecision,
  CreatorTaskAppealStatus,
  CreatorTaskPayout,
} from './entities/creator-task-payout.entity'
import { CreatorTask, CreatorTaskStatus, GrowthTask } from './entities/growth-task.entity'
import { GrowthTaskService } from './growth-task.service'

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
    private readonly growthTaskService: GrowthTaskService,
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
    await this.growthTaskService.expireOverdueCreatorTasks(creatorId)
    const items = await this.enrich(
      await this.tasks.find({ where: { creatorId }, order: { deadline: 'ASC' } }),
    )
    return {
      eligibility: this.eligibility(creator),
      invitations: items.filter(
        (item) => item.status === 'invited' && item.funded && item.deadline > new Date(),
      ),
      activeTasks: items.filter((item) =>
        [
          'accepted',
          'creating',
          'submitted',
          'approved',
          'published',
          'tracking',
          'risk_hold',
        ].includes(item.status),
      ),
      pendingSettlement: items.filter((item) =>
        ['verified', 'risk_hold'].includes(item.payout.status),
      ),
    }
  }
  async listTasks(creatorId: string, query: CreatorTaskListQueryDto) {
    await this.growthTaskService.expireOverdueCreatorTasks(creatorId)
    const page = Math.max(Number(query.page ?? 1) || 1, 1),
      pageSize = Math.min(Math.max(Number(query.pageSize ?? 20) || 20, 1), 100)
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
    await this.growthTaskService.expireOverdueCreatorTasks(creatorId)
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
          recoveryReceivable: Number(wallet?.recoveryReceivableBalance ?? 0),
          totalRecovered: Number(wallet?.totalRecovered ?? 0),
        },
      },
      openAppealCount: appeals,
    }
  }
  async appeal(creatorId: string, taskId: string, dto: CreateCreatorTaskAppealDto) {
    const task = await this.tasks.findOne({ where: { id: taskId, creatorId } })
    if (!task) throw new NotFoundException('创作者任务不存在')
    return this.createAppeal(task, 'creator', dto)
  }
  async appealForMerchant(merchantId: string, taskId: string, dto: CreateCreatorTaskAppealDto) {
    const task = await this.tasks.findOne({ where: { id: taskId, merchantId } })
    if (!task) throw new NotFoundException('创作者任务不存在')
    return this.createAppeal(task, 'merchant', dto)
  }
  private async createAppeal(
    task: CreatorTask,
    appellantType: CreatorTaskAppealAppellantType,
    dto: CreateCreatorTaskAppealDto,
  ) {
    const payout = await this.payouts.findOne({ where: { creatorTaskId: task.id } })
    const appealDeadlineAt = this.appealDeadline(task, payout, dto.target)
    if (new Date() > appealDeadlineAt)
      throw new BadRequestException('申诉期限已过：任务完成或结算完成后仅可在 30 个自然日内申诉')
    const openAppeal = await this.appeals.findOne({
      where: { creatorTaskId: task.id, appellantType, target: dto.target, status: 'open' },
    })
    if (openAppeal) throw new BadRequestException('该任务已有相同类型的待处理申诉')
    const appeal = await this.appeals.save(
      this.appeals.create({
        creatorTaskId: task.id,
        creatorId: task.creatorId,
        merchantId: task.merchantId,
        payoutId: payout?.id ?? null,
        appellantType,
        target: dto.target,
        appealDeadlineAt,
        reason: dto.reason,
        evidence: dto.evidence ?? {},
        status: 'open',
      }),
    )
    const actorId = appellantType === 'creator' ? task.creatorId : task.merchantId
    await this.dataSource.getRepository(AuditLog).save({
      actorType: appellantType,
      actorId,
      actionType:
        appellantType === 'creator'
          ? AuditActionType.CREATOR_TASK_APPEALED
          : AuditActionType.MERCHANT_TASK_APPEALED,
      actionDescription: 'creator_task_appealed',
      targetType: 'creator_task_appeal',
      targetId: appeal.id,
      metadata: { creatorTaskId: task.id, target: dto.target, appealDeadlineAt },
      result: 'success',
    })
    await this.dataSource.getRepository(Notification).save({
      recipientId: appellantType === 'creator' ? task.merchantId : task.creatorId,
      recipientRole: appellantType === 'creator' ? UserRole.MERCHANT_ADMIN : UserRole.AGENT,
      type: 'creator_task_appeal_created',
      title: appellantType === 'creator' ? '创作者发起了任务申诉' : '商户发起了任务申诉',
      body: `对方已就${dto.target === 'payout' ? '任务结算' : '任务履约'}发起申诉，运营将进行处理。`,
      targetType: 'creator_task_appeal',
      targetId: appeal.id,
      metadata: { creatorTaskId: task.id, target: dto.target, appealDeadlineAt },
    })
    return appeal
  }
  async listAppeals(creatorId: string) {
    const appeals = await this.appeals.find({ where: { creatorId }, order: { createdAt: 'DESC' } })
    return {
      items: await this.enrichAppeals(appeals),
    }
  }
  async listAppealsForMerchant(merchantId: string) {
    const appeals = await this.appeals.find({ where: { merchantId }, order: { createdAt: 'DESC' } })
    return {
      items: await this.enrichAppeals(appeals),
    }
  }
  async appealDetailForCreator(creatorId: string, appealId: string) {
    return this.appealDetail({ id: appealId, creatorId })
  }
  async appealDetailForMerchant(merchantId: string, appealId: string) {
    return this.appealDetail({ id: appealId, merchantId })
  }
  private async appealDetail(where: { id: string; creatorId?: string; merchantId?: string }) {
    const appeal = await this.appeals.findOne({ where })
    if (!appeal) throw new NotFoundException('申诉不存在或无权查看')
    return (await this.enrichAppeals([appeal]))[0]
  }
  async listRecoveryReceivables(query: ListRecoveryReceivablesDto = {}) {
    const page = Math.max(Number(query.page ?? 1) || 1, 1)
    const pageSize = Math.min(Math.max(Number(query.pageSize ?? 20) || 20, 1), 100)
    // A wallet can contain receivables from several rulings. Operations must
    // work from the ruling, otherwise an operator cannot explain which payout
    // cleared which debt.
    const appeals = (
      await this.appeals.find({
        where: {
          status: 'accepted',
          adjudicationDecision: 'reverse_settlement',
          ...(query.creatorId ? { creatorId: query.creatorId } : {}),
        },
        order: { resolvedAt: 'ASC', createdAt: 'ASC' },
      })
    ).filter(
      (appeal) =>
        this.money(
          Number(appeal.recoveryAmount ?? 0) - Number(appeal.recoveryRecoveredAmount ?? 0),
        ) > 0,
    )
    const sourceReferences = appeals.map((appeal) => `appeal:${appeal.id}`)
    const financialEntries = sourceReferences.length
      ? await this.dataSource.getRepository(FinancialLedgerEntry).find({
          where: { entryType: 'recovery_auto_offset', sourceReference: In(sourceReferences) },
          order: { occurredAt: 'DESC', createdAt: 'DESC' },
        })
      : []
    const entriesByAppealId = new Map<string, FinancialLedgerEntry[]>()
    for (const entry of financialEntries) {
      const appealId = String((entry.metadata ?? {}).appealId ?? '')
      if (!appealId) continue
      entriesByAppealId.set(appealId, [...(entriesByAppealId.get(appealId) ?? []), entry])
    }
    const wallets = appeals.length
      ? await this.wallets.find({
          where: { agentId: In(appeals.map((appeal) => appeal.creatorId)) },
        })
      : []
    const creators = appeals.length
      ? await this.creators.find({ where: { id: In(appeals.map((appeal) => appeal.creatorId)) } })
      : []
    const creatorById = new Map(creators.map((creator) => [creator.id, creator]))
    const walletByCreatorId = new Map(wallets.map((wallet) => [wallet.agentId, wallet]))
    const items = appeals
      .map((appeal) => {
        const offsets = entriesByAppealId.get(appeal.id) ?? []
        const lastOffsetAt = offsets.reduce<Date | null>((latest, entry) => {
          if (!latest || new Date(entry.occurredAt) > latest) return new Date(entry.occurredAt)
          return latest
        }, null)
        const risk = this.recoveryRisk(appeal.resolvedAt ?? appeal.createdAt, lastOffsetAt)
        const creator = creatorById.get(appeal.creatorId)
        const wallet = walletByCreatorId.get(appeal.creatorId)
        const remaining = this.money(
          Number(appeal.recoveryAmount ?? 0) - Number(appeal.recoveryRecoveredAmount ?? 0),
        )
        return {
          appealId: appeal.id,
          creatorId: appeal.creatorId,
          creatorTaskId: appeal.creatorTaskId,
          payoutId: appeal.payoutId ?? null,
          merchantId: appeal.merchantId,
          resolvedAt: appeal.resolvedAt ?? null,
          recoveryAmount: Number(appeal.recoveryAmount ?? 0),
          recoveredAmount: Number(appeal.recoveryRecoveredAmount ?? 0),
          remainingAmount: remaining,
          lastOffsetAt,
          daysWithoutOffset: risk.daysWithoutOffset,
          risk,
          offsets: offsets.map((entry) => ({
            ledgerEntryId: entry.id,
            amount: this.money(Math.abs(Number(entry.amount))),
            occurredAt: entry.occurredAt,
            settlementPayoutId: String((entry.metadata ?? {}).settlementPayoutId ?? '') || null,
          })),
          wallet: wallet
            ? {
                recoveryReceivableAmount: Number(wallet.recoveryReceivableBalance ?? 0),
                availableBalance: Number(wallet.settledBalance ?? 0),
                pendingSettlementBalance: Number(wallet.pendingSettlementBalance ?? 0),
              }
            : null,
          creator: creator
            ? {
                nickname: creator.nickname ?? null,
                phone: this.maskPhone(creator.phone),
                realNameVerified: creator.realNameVerified,
                auditStatus: creator.auditStatus,
              }
            : null,
        }
      })
      .filter(
        (item) =>
          query.riskLevel === 'all' || !query.riskLevel || item.risk.level === query.riskLevel,
      )
      .sort((left, right) => right.daysWithoutOffset - left.daysWithoutOffset)
    const total = items.length
    return {
      items: items.slice((page - 1) * pageSize, page * pageSize),
      summary: items.reduce(
        (summary, item) => {
          summary[item.risk.level]++
          summary.outstandingAmount = this.money(summary.outstandingAmount + item.remainingAmount)
          return summary
        },
        { normal: 0, watch: 0, overdue: 0, critical: 0, outstandingAmount: 0 },
      ),
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
      policy: {
        offset: '后续已核验报酬在结算时优先抵扣待追回款，仅剩余金额进入创作者可用余额。',
        thresholds: { watchDays: 7, overdueDays: 30, criticalDays: 60 },
        automatedAction: '无；暂停提现、人工协商和核销均需人工按已审批规则处理。',
      },
    }
  }

  async recoveryReconciliation() {
    const [wallets, recoveryAppeals, offsetEntries] = await Promise.all([
      this.wallets.find({ where: { recoveryReceivableBalance: MoreThan(0) } }),
      this.appeals.find({
        where: { status: 'accepted', adjudicationDecision: 'reverse_settlement' },
      }),
      this.dataSource.getRepository(FinancialLedgerEntry).find({
        where: { entryType: 'recovery_auto_offset' },
      }),
    ])
    const outstandingAppeals = recoveryAppeals.filter(
      (appeal) =>
        this.money(
          Number(appeal.recoveryAmount ?? 0) - Number(appeal.recoveryRecoveredAmount ?? 0),
        ) > 0,
    )
    const expectedReceivable = this.money(
      outstandingAppeals.reduce(
        (total, appeal) =>
          total + Number(appeal.recoveryAmount ?? 0) - Number(appeal.recoveryRecoveredAmount ?? 0),
        0,
      ),
    )
    const walletReceivable = this.money(
      wallets.reduce((total, wallet) => total + Number(wallet.recoveryReceivableBalance ?? 0), 0),
    )
    const settlementPayoutIds = [
      ...new Set(
        offsetEntries
          .map((entry) => String((entry.metadata ?? {}).settlementPayoutId ?? ''))
          .filter(Boolean),
      ),
    ]
    const payouts = settlementPayoutIds.length
      ? await this.payouts.find({ where: { id: In(settlementPayoutIds) } })
      : []
    const payoutById = new Map(payouts.map((payout) => [payout.id, payout]))
    const offsetByPayoutId = new Map<string, number>()
    for (const entry of offsetEntries) {
      const payoutId = String((entry.metadata ?? {}).settlementPayoutId ?? '')
      if (!payoutId) continue
      offsetByPayoutId.set(
        payoutId,
        this.money((offsetByPayoutId.get(payoutId) ?? 0) + Math.abs(Number(entry.amount))),
      )
    }
    const offsetMismatches = [...offsetByPayoutId.entries()]
      .map(([payoutId, recordedOffset]) => ({
        payoutId,
        recordedOffset,
        payoutOffset: Number(payoutById.get(payoutId)?.recoveryOffsetAmount ?? 0),
      }))
      .filter((item) => this.money(item.recordedOffset) !== this.money(item.payoutOffset))
    return {
      reconciledAt: new Date(),
      walletReceivable,
      adjudicationReceivable: expectedReceivable,
      receivableDifference: this.money(walletReceivable - expectedReceivable),
      receivableMatches: walletReceivable === expectedReceivable,
      outstandingAdjudications: outstandingAppeals.length,
      settlementOffsets: {
        checkedPayouts: offsetByPayoutId.size,
        matches: offsetMismatches.length === 0,
        mismatches: offsetMismatches,
      },
    }
  }
  async listAppealableTasksForMerchant(merchantId: string) {
    const tasks = await this.tasks.find({
      where: { merchantId, status: 'completed' },
      order: { updatedAt: 'DESC' },
    })
    if (!tasks.length) return { items: [] }
    const payouts = await this.payouts.find({
      where: { creatorTaskId: In(tasks.map((task) => task.id)) },
    })
    const payoutsByTask = new Map(payouts.map((payout) => [payout.creatorTaskId, payout]))
    const now = new Date()
    return {
      items: tasks
        .map((task) => {
          const payout = payoutsByTask.get(task.id) ?? null
          const taskAppealDeadlineAt = this.appealDeadline(task, payout, 'task')
          const payoutAppealDeadlineAt =
            payout?.status === 'settled' && payout.settledAt
              ? this.appealDeadline(task, payout, 'payout')
              : null
          return {
            creatorTaskId: task.id,
            creatorId: task.creatorId,
            brief: task.brief,
            channel: task.channel,
            contentType: task.contentType,
            completedAt: task.stateChangedAt ?? task.updatedAt,
            payout: this.payout(payout ?? undefined),
            taskAppealDeadlineAt,
            payoutAppealDeadlineAt,
            taskAppealable: now <= taskAppealDeadlineAt,
            payoutAppealable: payoutAppealDeadlineAt ? now <= payoutAppealDeadlineAt : false,
          }
        })
        .filter((item) => item.taskAppealable || item.payoutAppealable),
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
      const current = await manager.findOne(CreatorTaskAppeal, {
        where: { id: appealId },
        lock: { mode: 'pessimistic_write' },
      })
      if (!current) throw new NotFoundException('创作者任务申诉不存在')
      if (current.status !== 'open')
        throw new BadRequestException(`该申诉已处理（${current.status}）`)
      const [task, payout] = await Promise.all([
        manager.findOne(CreatorTask, { where: { id: current.creatorTaskId } }),
        current.payoutId
          ? manager.findOne(CreatorTaskPayout, { where: { id: current.payoutId } })
          : manager.findOne(CreatorTaskPayout, { where: { creatorTaskId: current.creatorTaskId } }),
      ])
      const decision = this.normalizeAdjudicationDecision(dto.decision)
      if ((decision === 'adjust_payout' || decision === 'reverse_settlement') && !payout)
        throw new BadRequestException('该申诉没有可裁决的报酬记录')
      const amountBefore = this.money(
        Number(payout?.adjudicatedAmount ?? payout?.verifiedAmount ?? 0),
      )
      let amountAfter = amountBefore
      const financialLedgerEntryIds: string[] = []
      if (decision === 'adjust_payout') {
        if (dto.adjustedAmount === undefined)
          throw new BadRequestException('调整报酬时必须填写调整后金额')
        amountAfter = this.money(Number(dto.adjustedAmount))
        this.assertConfirmedAmount(dto.confirmedAmount, amountAfter, '调整后金额')
        const delta = this.money(amountAfter - amountBefore)
        await this.applyPayoutAdjustment(manager, payout, delta)
        payout.adjudicatedAmount = amountAfter
        payout.adjudicatedAt = new Date()
        await manager.save(payout)
        if (delta !== 0) {
          const entry = await this.recordAdjudicationLedger(manager, {
            appeal: current,
            payout: payout,
            actorId: actor.id,
            amount: delta,
            entryType: 'appeal_payout_adjustment',
            description: '申诉裁决：调整创作者履约报酬',
            amountBefore,
            amountAfter,
          })
          financialLedgerEntryIds.push(entry.id)
        }
      }
      if (decision === 'reverse_settlement') {
        if (!['verified', 'settled'].includes(payout.status))
          throw new BadRequestException('仅已核验或已结算的报酬可撤销/追回')
        this.assertConfirmedAmount(dto.confirmedAmount, amountBefore, '追回金额')
        const recoveredNow = await this.reversePayout(manager, payout, amountBefore)
        payout.adjudicatedAmount = 0
        payout.adjudicatedAt = new Date()
        payout.status = 'reversed'
        await manager.save(payout)
        amountAfter = 0
        current.recoveryAmount = amountBefore
        current.recoveryRecoveredAmount = recoveredNow
        current.recoveryCompletedAt = recoveredNow >= amountBefore ? new Date() : null
        if (amountBefore !== 0) {
          const entry = await this.recordAdjudicationLedger(manager, {
            appeal: current,
            payout: payout,
            actorId: actor.id,
            amount: -amountBefore,
            entryType: 'appeal_payout_reversal',
            description: '申诉裁决：撤销/追回创作者结算',
            amountBefore,
            amountAfter,
          })
          financialLedgerEntryIds.push(entry.id)
        }
      }
      const resolvedAt = new Date()
      // Legacy accepted/rejected requests remain readable during rollout. New
      // adjudications expose an explicit final decision and its financial effect.
      current.status =
        dto.decision === 'accepted' || dto.decision === 'rejected'
          ? dto.decision
          : decision === 'uphold'
            ? 'rejected'
            : 'accepted'
      current.resolution = dto.resolution.trim()
      current.resolvedBy = actor.id
      current.resolvedAt = resolvedAt
      current.adjudicationDecision = decision
      current.amountBefore = amountBefore
      current.amountAfter = amountAfter
      current.financialLedgerEntryIds = financialLedgerEntryIds
      await manager.save(current)
      await manager.save(AuditLog, {
        actorType: 'admin',
        actorId: actor.id,
        actorName: actor.name ?? null,
        actionType:
          dto.decision === 'accepted' || dto.decision === 'rejected'
            ? AuditActionType.CREATOR_TASK_APPEAL_RESOLVED
            : AuditActionType.CREATOR_TASK_APPEAL_ADJUDICATED,
        actionDescription:
          dto.decision === 'accepted' || dto.decision === 'rejected'
            ? '创作者任务申诉处理'
            : '创作者任务申诉裁决',
        targetType: 'creator_task_appeal',
        targetId: current.id,
        metadata: {
          decision:
            dto.decision === 'accepted' || dto.decision === 'rejected' ? dto.decision : decision,
          resolution: current.resolution,
          target: current.target,
          creatorTaskId: current.creatorTaskId,
          creatorId: current.creatorId,
          merchantId: task?.merchantId ?? null,
          payoutId: payout?.id ?? current.payoutId ?? null,
          payoutStatus: payout?.status ?? null,
          amountBefore,
          amountAfter,
          confirmedAmount: dto.confirmedAmount == null ? null : this.money(dto.confirmedAmount),
          financialLedgerEntryIds,
          previousStatus: 'open',
        },
        result: 'success',
      })
      await manager.save(Notification, {
        recipientId: current.appellantType === 'merchant' ? current.merchantId : current.creatorId,
        recipientRole:
          current.appellantType === 'merchant' ? UserRole.MERCHANT_ADMIN : UserRole.AGENT,
        type: 'creator_task_appeal_resolved',
        title: this.adjudicationTitle(decision),
        body: `${this.adjudicationTitle(decision)}；处理依据：${current.resolution}`,
        targetType: 'creator_task_appeal',
        targetId: current.id,
        metadata: {
          creatorTaskId: current.creatorTaskId,
          target: current.target,
          resolvedAt,
          decision,
          amountBefore,
          amountAfter,
        },
      })
      const counterpartyId =
        current.appellantType === 'merchant' ? current.creatorId : current.merchantId
      await manager.save(Notification, {
        recipientId: counterpartyId,
        recipientRole:
          current.appellantType === 'merchant' ? UserRole.AGENT : UserRole.MERCHANT_ADMIN,
        type: 'creator_task_appeal_adjudicated',
        title: this.adjudicationTitle(decision),
        body: `对方申诉已裁决；处理依据：${current.resolution}`,
        targetType: 'creator_task_appeal',
        targetId: current.id,
        metadata: { creatorTaskId: current.creatorTaskId, decision, amountBefore, amountAfter },
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
      const amount = this.money(Number(dto.verifiedAmount))
      if (!Number.isFinite(amount) || amount < 0) throw new BadRequestException('核验报酬金额异常')
      const verifiedAt = new Date()
      const settleAt = this.addBusinessDays(verifiedAt, 3)
      payout.status = 'verified'
      payout.verifiedAmount = amount
      payout.verificationEvidence = dto.evidence ?? {}
      payout.verifiedAt = verifiedAt
      payout.settleAt = settleAt
      payout.recoveryOffsetAmount = 0
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
          recoveryReceivableBalance: 0,
          totalRecovered: 0,
          aiTokenBalance: 0,
          status: true,
        })
      wallet.pendingSettlementBalance = this.money(Number(wallet.pendingSettlementBalance) + amount)
      wallet.totalEarned = this.money(Number(wallet.totalEarned) + amount)
      await manager.save(wallet)
      if (amount > 0)
        await manager.save(FinancialLedgerEntry, {
          classification: 'cogs',
          entryType: 'creator_task_payout',
          amount,
          currency: 'CNY',
          merchantId: task.merchantId,
          campaignId: task.campaignId ?? null,
          creatorId: task.creatorId,
          creatorTaskId: task.id,
          sourceReference: payout.id,
          idempotencyKey: `creator-task-payout:${payout.id}:verified`,
          recordedByAdminId: actorId,
          occurredAt: verifiedAt,
          description: 'Creator Payout COGS',
          metadata: {
            payoutId: payout.id,
            verifiedAmount: amount,
            status: 'verified',
            settleAt,
          },
        })
      await manager.save(AuditLog, {
        actorType: 'admin',
        actorId,
        actionType: AuditActionType.CREATOR_TASK_PAYOUT_VERIFIED,
        actionDescription: 'creator_task_payout_verified',
        targetType: 'creator_task_payout',
        targetId: payout.id,
        metadata: {
          taskId,
          amount,
          settleAt,
          recoveryOffsetAmount: 0,
          evidence: dto.evidence ?? {},
        },
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
    const auditsByTask = new Map<string, AuditLog[]>()
    for (const item of allocations)
      categories.set(
        item.growthTaskId,
        new Set([...(categories.get(item.growthTaskId) ?? []), item.category]),
      )
    for (const audit of audits) {
      if (!audit.targetId || audit.targetType !== 'creator_task') continue
      auditsByTask.set(audit.targetId, [...(auditsByTask.get(audit.targetId) ?? []), audit])
      if (audit.actionDescription === 'creator_task_matched_and_invited')
        reasons.set(audit.targetId, (audit.metadata as Record<string, unknown>)?.matching)
    }
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
        lifecycle: this.lifecycle(task, funded, auditsByTask.get(task.id) ?? []),
        stateReason: task.stateReason ?? task.riskHoldReason ?? null,
        stateChangedBy: task.stateChangedBy ?? null,
        stateChangedAt: task.stateChangedAt ?? null,
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

  private lifecycle(task: CreatorTask, funded: boolean, audits: AuditLog[]) {
    const states: CreatorTaskStatus[] = [
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
      'settled',
    ]
    const currentState =
      task.status === 'risk_hold' ? (task.riskHoldPreviousStatus ?? 'accepted') : task.status
    const index = states.indexOf(currentState)
    const actions: string[] = []
    if (task.status === 'invited' && task.deadline > new Date()) {
      actions.push('decline')
      if (funded) actions.unshift('accept')
    } else if (task.status === 'accepted') actions.push('start')
    else if (task.status === 'creating') actions.push('submit')
    else if (task.status === 'rejected') actions.push('start')
    else if (task.status === 'approved') actions.push('publish')
    else if (task.status === 'published') actions.push('tracking')
    else if (task.status === 'tracking') actions.push('complete')
    if (['rejected', 'completed', 'settled', 'violation', 'risk_hold'].includes(task.status))
      actions.push('appeal')
    const history = audits
      .filter((audit) =>
        [
          AuditActionType.CREATOR_TASK_TRANSITION,
          AuditActionType.CREATOR_TASK_REVIEWED,
          AuditActionType.CREATOR_TASK_RISK_HELD,
        ].includes(audit.actionType),
      )
      .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime())
      .map((audit) => {
        const metadata = audit.metadata ?? {}
        return {
          action: audit.actionDescription,
          fromStatus: typeof metadata.before === 'string' ? metadata.before : null,
          toStatus: typeof metadata.after === 'string' ? metadata.after : null,
          reason:
            typeof metadata.reason === 'string'
              ? metadata.reason
              : typeof metadata.reviewReason === 'string'
                ? metadata.reviewReason
                : null,
          actorType: audit.actorType,
          actorId: audit.actorId ?? null,
          occurredAt: audit.createdAt,
        }
      })
    return {
      currentStatus: task.status,
      progress: {
        currentStep: index < 0 ? 0 : index + 1,
        totalSteps: states.length,
        percent: index < 0 ? 0 : Math.round(((index + 1) / states.length) * 100),
      },
      availableActions: actions,
      stateReason: task.stateReason ?? task.riskHoldReason ?? null,
      stateChangedBy: task.stateChangedBy ?? null,
      stateChangedAt: task.stateChangedAt ?? null,
      history,
    }
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
    const ledgerIds = [...new Set(appeals.flatMap((item) => item.financialLedgerEntryIds ?? []))]
    const [tasks, payouts, creators, financialEntries] = await Promise.all([
      this.tasks.find({ where: { id: In(taskIds) } }),
      this.payouts.find({ where: { creatorTaskId: In(taskIds) } }),
      this.creators.find({ where: { id: In(creatorIds) } }),
      ledgerIds.length
        ? this.dataSource.getRepository(FinancialLedgerEntry).find({ where: { id: In(ledgerIds) } })
        : Promise.resolve([] as FinancialLedgerEntry[]),
    ])
    const byTask = new Map(tasks.map((item) => [item.id, item]))
    const byPayoutTask = new Map(payouts.map((item) => [item.creatorTaskId, item]))
    const byPayoutId = new Map(payouts.map((item) => [item.id, item]))
    const byCreator = new Map(creators.map((item) => [item.id, item]))
    const ledgerById = new Map(financialEntries.map((item) => [item.id, item]))
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
        merchantId: appeal.merchantId,
        payoutId: appeal.payoutId ?? null,
        appellantType: appeal.appellantType,
        target: appeal.target,
        appealDeadlineAt: appeal.appealDeadlineAt,
        status: appeal.status,
        reason: appeal.reason,
        evidence: appeal.evidence ?? {},
        resolution: appeal.resolution ?? null,
        resolvedBy: appeal.resolvedBy ?? null,
        resolvedAt: appeal.resolvedAt ?? null,
        adjudicationDecision: appeal.adjudicationDecision ?? null,
        amountBefore: appeal.amountBefore == null ? null : Number(appeal.amountBefore),
        amountAfter: appeal.amountAfter == null ? null : Number(appeal.amountAfter),
        recovery: {
          amount: Number(appeal.recoveryAmount ?? 0),
          recovered: Number(appeal.recoveryRecoveredAmount ?? 0),
          remaining: this.money(
            Math.max(
              0,
              Number(appeal.recoveryAmount ?? 0) - Number(appeal.recoveryRecoveredAmount ?? 0),
            ),
          ),
          status:
            Number(appeal.recoveryAmount ?? 0) === 0
              ? 'not_applicable'
              : Number(appeal.recoveryRecoveredAmount ?? 0) >= Number(appeal.recoveryAmount ?? 0)
                ? 'completed'
                : 'recovering',
          completedAt: appeal.recoveryCompletedAt ?? null,
        },
        financialLedgerEntryIds: appeal.financialLedgerEntryIds ?? [],
        financialLedgerEntries: (appeal.financialLedgerEntryIds ?? [])
          .map((id) => ledgerById.get(id))
          .filter((item): item is FinancialLedgerEntry => Boolean(item))
          .map((item) => ({
            id: item.id,
            entryType: item.entryType,
            amount: Number(item.amount),
            description: item.description ?? null,
            occurredAt: item.occurredAt,
            metadata: item.metadata ?? {},
          })),
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
          adjudicatedAmount:
            payout.adjudicatedAmount == null ? null : Number(payout.adjudicatedAmount),
          adjudicatedAt: payout.adjudicatedAt ?? null,
          recoveryOffsetAmount: Number(payout.recoveryOffsetAmount ?? 0),
          settledAmount: this.money(
            Number(payout.adjudicatedAmount ?? payout.verifiedAmount ?? 0) -
              Number(payout.recoveryOffsetAmount ?? 0),
          ),
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
  private appealDeadline(
    task: CreatorTask,
    payout: CreatorTaskPayout | null,
    target: 'task' | 'payout',
  ) {
    let completedAt: Date | null = null
    if (target === 'task') {
      if (task.status !== 'completed') throw new BadRequestException('仅任务完成后可发起履约申诉')
      completedAt = task.stateChangedAt ?? task.updatedAt
    } else {
      if (!payout || payout.status !== 'settled' || !payout.settledAt)
        throw new BadRequestException('仅报酬结算完成后可发起结算申诉')
      completedAt = payout.settledAt
    }
    const deadline = new Date(completedAt)
    deadline.setDate(deadline.getDate() + 30)
    return deadline
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
  private normalizeAdjudicationDecision(
    decision: ResolveCreatorTaskAppealDto['decision'],
  ): CreatorTaskAppealDecision {
    // accepted/rejected are retained only for clients deployed before the
    // adjudication workflow; they are non-financial uphold decisions.
    return decision === 'adjust_payout' || decision === 'reverse_settlement' ? decision : 'uphold'
  }
  private assertConfirmedAmount(value: number | undefined, expected: number, label: string) {
    if (value === undefined) throw new BadRequestException(`涉及资金变动时必须二次确认${label}`)
    if (this.money(value) !== expected)
      throw new BadRequestException(`二次确认${label}与裁决金额不一致，未执行账务变动`)
  }
  private adjudicationTitle(decision: CreatorTaskAppealDecision) {
    return {
      uphold: '裁决：维持原结果',
      adjust_payout: '裁决：调整报酬',
      reverse_settlement: '裁决：撤销/追回结算',
    }[decision]
  }
  private async applyPayoutAdjustment(manager: any, payout: CreatorTaskPayout, delta: number) {
    if (!['verified', 'settled'].includes(payout.status))
      throw new BadRequestException('仅已核验或已结算的报酬可调整')
    const wallet = await this.walletForAdjudication(manager, payout.creatorId)
    if (payout.status === 'verified') {
      const nextPending = this.money(Number(wallet.pendingSettlementBalance) + delta)
      if (nextPending < 0) throw new BadRequestException('待结算余额不足，无法下调该报酬')
      wallet.pendingSettlementBalance = nextPending
    } else {
      const nextSettled = this.money(Number(wallet.settledBalance) + delta)
      if (nextSettled < 0) throw new BadRequestException('可用钱包余额不足，无法下调已结算报酬')
      wallet.settledBalance = nextSettled
      wallet.totalSettled = this.money(Number(wallet.totalSettled) + delta)
    }
    wallet.totalEarned = this.money(Number(wallet.totalEarned) + delta)
    await manager.save(wallet)
  }
  private async reversePayout(manager: any, payout: CreatorTaskPayout, amount: number) {
    const wallet = await this.walletForAdjudication(manager, payout.creatorId)
    let recoveredNow = 0
    if (payout.status === 'verified') {
      const nextPending = this.money(Number(wallet.pendingSettlementBalance) - amount)
      if (nextPending < 0) throw new BadRequestException('待结算余额不足，无法撤销该报酬')
      wallet.pendingSettlementBalance = nextPending
    } else {
      const available = Number(wallet.settledBalance)
      recoveredNow = this.money(Math.min(available, amount))
      wallet.settledBalance = this.money(available - recoveredNow)
      wallet.totalSettled = this.money(Math.max(0, Number(wallet.totalSettled) - amount))
      wallet.totalRecovered = this.money(Number(wallet.totalRecovered ?? 0) + recoveredNow)
      wallet.recoveryReceivableBalance = this.money(
        Number(wallet.recoveryReceivableBalance ?? 0) + amount - recoveredNow,
      )
    }
    wallet.totalEarned = this.money(Math.max(0, Number(wallet.totalEarned) - amount))
    await manager.save(wallet)
    return recoveredNow
  }
  private async walletForAdjudication(manager: any, creatorId: string) {
    let wallet = await manager.findOne(AgentWallet, {
      where: { agentId: creatorId },
      lock: { mode: 'pessimistic_write' },
    })
    if (!wallet)
      wallet = manager.create(AgentWallet, {
        agentId: creatorId,
        pendingSettlementBalance: 0,
        settledBalance: 0,
        frozenBalance: 0,
        totalEarned: 0,
        totalPlatformFee: 0,
        totalSettled: 0,
        totalWithdrawn: 0,
        recoveryReceivableBalance: 0,
        totalRecovered: 0,
        aiTokenBalance: 0,
        status: true,
      })
    return wallet
  }
  private async recordAdjudicationLedger(
    manager: any,
    input: {
      appeal: CreatorTaskAppeal
      payout: CreatorTaskPayout
      actorId: string
      amount: number
      entryType: 'appeal_payout_adjustment' | 'appeal_payout_reversal'
      description: string
      amountBefore: number
      amountAfter: number
    },
  ) {
    return manager.save(
      FinancialLedgerEntry,
      manager.create(FinancialLedgerEntry, {
        classification: 'cogs',
        entryType: input.entryType,
        amount: input.amount,
        currency: 'CNY',
        merchantId: input.payout.merchantId,
        campaignId: input.payout.campaignId ?? null,
        creatorId: input.payout.creatorId,
        creatorTaskId: input.payout.creatorTaskId,
        sourceReference: `appeal:${input.appeal.id}`,
        idempotencyKey: `appeal-adjudication:${input.appeal.id}:${input.entryType}`,
        recordedByAdminId: input.actorId,
        occurredAt: new Date(),
        description: input.description,
        metadata: {
          appealId: input.appeal.id,
          payoutId: input.payout.id,
          amountBefore: input.amountBefore,
          amountAfter: input.amountAfter,
        },
      }),
    )
  }
  private recoveryRisk(resolvedAt: Date, lastOffsetAt: Date | null) {
    const start = lastOffsetAt ?? resolvedAt
    const daysWithoutOffset = Math.max(
      0,
      Math.floor((Date.now() - new Date(start).getTime()) / (24 * 60 * 60 * 1000)),
    )
    if (daysWithoutOffset >= 60)
      return {
        level: 'critical' as const,
        daysWithoutOffset,
        recommendedAction: '人工核查并按已审批规则决定协商或核销；系统不会自动核销。',
      }
    if (daysWithoutOffset >= 30)
      return {
        level: 'overdue' as const,
        daysWithoutOffset,
        recommendedAction: '进入人工协商队列；如需暂停提现，须由有权限的运营人员单独处理。',
      }
    if (daysWithoutOffset >= 7)
      return {
        level: 'watch' as const,
        daysWithoutOffset,
        recommendedAction: '运营跟进创作者后续结算情况。',
      }
    return { level: 'normal' as const, daysWithoutOffset, recommendedAction: '持续自动抵扣。' }
  }
  private money(value: number) {
    return Math.round(value * 100) / 100
  }
}
