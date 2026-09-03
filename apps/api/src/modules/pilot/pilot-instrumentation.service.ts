import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { EntityManager, Repository } from 'typeorm'
import { CampaignCreditLedgerEntry, CreatorTask, GrowthTask } from '../task/entities/growth-task.entity'
import { PilotInstrumentationQueryDto } from './dto/pilot-instrumentation.dto'
import { PilotMetricEvent, PilotMetricEventType } from './entities/pilot-metric-event.entity'

type EventInput = Omit<PilotMetricEvent, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>
const TERMINAL_TASK_STATES = new Set(['settled', 'expired', 'cancelled', 'violation'])
const TARGETS = { merchants: 10, creators: 50, campaigns: 30, publishedContents: 100 }

@Injectable()
export class PilotInstrumentationService {
  constructor(
    @InjectRepository(PilotMetricEvent) private readonly eventRepo: Repository<PilotMetricEvent>,
    @InjectRepository(CreatorTask) private readonly creatorTaskRepo: Repository<CreatorTask>,
    @InjectRepository(GrowthTask) private readonly growthTaskRepo: Repository<GrowthTask>,
    @InjectRepository(CampaignCreditLedgerEntry) private readonly creditRepo: Repository<CampaignCreditLedgerEntry>,
  ) {}

  async record(input: EventInput, manager?: EntityManager) {
    await (manager ?? this.eventRepo.manager).createQueryBuilder().insert().into(PilotMetricEvent).values(input).orIgnore().execute()
  }

  async hasPriorActivation(manager: EntityManager, merchantId: string) {
    return (await manager.count(PilotMetricEvent, { where: { merchantId, eventType: 'campaign_activated' } })) > 0
  }

  /** Links a redemption to a Creator Task only when campaign + Creator identify exactly one eligible task. */
  async recordVerifiedRedemption(input: { redemptionId: string; merchantId: string; campaignId?: string | null; creatorId?: string | null; occurredAt: Date; transactionAmount: number; attributionId?: string | null }) {
    let task: CreatorTask | undefined
    if (input.campaignId && input.creatorId) {
      const candidates = await this.creatorTaskRepo.find({ where: { campaignId: input.campaignId, creatorId: input.creatorId } })
      const eligible = candidates.filter((item) => ['published', 'tracking', 'completed', 'settled'].includes(item.status))
      if (eligible.length === 1) task = eligible[0]
    }
    await this.record({ eventType: 'result_verified', idempotencyKey: `pilot:verified-redemption:${input.redemptionId}`, subjectType: 'redemption', subjectId: input.redemptionId, merchantId: input.merchantId, campaignId: input.campaignId ?? null, growthTaskId: task?.growthTaskId ?? null, creatorId: input.creatorId ?? null, creatorTaskId: task?.id ?? null, occurredAt: input.occurredAt, metadata: { transactionAmount: input.transactionAmount, attributionId: input.attributionId ?? null, taskLinked: Boolean(task) } })
  }

  async getDashboard(query: PilotInstrumentationQueryDto) {
    const [events, allTasks, allGrowthTasks, credits] = await Promise.all([this.eventRepo.find({ order: { occurredAt: 'ASC' } }), this.creatorTaskRepo.find(), this.growthTaskRepo.find(), this.creditRepo.find()])
    const tasks = allTasks.filter((item) => this.matchesTask(item, query))
    const growthTasks = allGrowthTasks.filter((item) => this.matchesGrowthTask(item, query))
    const taskIds = new Set(tasks.map((item) => item.id)); const growthIds = new Set(growthTasks.map((item) => item.id))
    const scopedEvents = events.filter((event) => this.matchesEvent(event, query, taskIds, growthIds))
    const pilot = { merchants: this.unique([...growthTasks.map((item) => item.merchantId), ...tasks.map((item) => item.merchantId)]).length, creators: this.unique(tasks.map((item) => item.creatorId)).length, campaigns: this.unique([...growthTasks.map((item) => item.campaignId), ...tasks.map((item) => item.campaignId)]).filter(Boolean).length, publishedContents: this.unique(scopedEvents.filter((item) => item.eventType === 'content_published').map((item) => item.subjectId)).length }
    const status = Object.fromEntries(Object.entries(TARGETS).map(([key, target]) => [key, { target, actual: pilot[key as keyof typeof pilot], passed: pilot[key as keyof typeof pilot] >= target }]))
    const funnel = this.toFunnel(scopedEvents); const reviewDurations = this.reviewDurations(scopedEvents)
    const timedOut = tasks.filter((task) => new Date(task.deadline).getTime() < Date.now() && !TERMINAL_TASK_STATES.has(task.status))
    const consumedEvents = scopedEvents.filter((item) => item.eventType === 'campaign_credits_consumed')
    const creditConsumed = consumedEvents.reduce((sum, item) => sum + Number(item.metadata.amount ?? 0), 0)
    const compensationLocked = scopedEvents.filter((item) => item.eventType === 'task_accepted').reduce((sum, item) => sum + Number(item.metadata.baseReward ?? 0), 0)
    const scopedCredits = credits.filter((item) => !query.merchantId || item.merchantId === query.merchantId)
    return {
      generatedAt: new Date(), scope: query, pilot: { targets: TARGETS, actual: pilot, status, passed: Object.values(status).every((item) => item.passed) }, funnel,
      breakdown: { byCampaign: this.groupFunnels(scopedEvents, (event) => event.campaignId ?? 'unattributed'), byCreator: this.groupFunnels(scopedEvents, (event) => event.creatorId ?? 'unattributed'), byTask: this.groupFunnels(scopedEvents, (event) => event.creatorTaskId ?? 'unattributed') },
      operations: {
        overdueTasks: { count: timedOut.length, ids: timedOut.map((item) => item.id) },
        review: { samples: reviewDurations.length, averageHours: this.round(this.average(reviewDurations), 2), p95Hours: this.percentile(reviewDurations, .95) },
        risk: { currentlyHeld: tasks.filter((item) => item.status === 'risk_hold').length, holdEvents: scopedEvents.filter((item) => item.eventType === 'task_risk_held').length, resolvedEvents: scopedEvents.filter((item) => item.eventType === 'task_risk_resolved').length },
        compensation: { lockedAmount: this.round(compensationLocked, 2), acceptedTasks: funnel.stages.accepted },
        campaignCredits: { consumed: this.round(creditConsumed, 2), consumptionEvents: consumedEvents.length, ledgerConsumed: this.round(scopedCredits.filter((item) => item.entryType === 'consumption').reduce((sum, item) => sum + Number(item.amount), 0), 2) },
      },
    }
  }

  private toFunnel(events: PilotMetricEvent[]) {
    const count = (type: PilotMetricEventType) => this.unique(events.filter((item) => item.eventType === type).map((item) => item.subjectId)).length
    const stages = { activated: count('campaign_activated'), invited: count('task_invited'), accepted: count('task_accepted'), published: count('content_published'), completed: count('task_completed'), verified: count('result_verified'), reinvested: count('campaign_reinvested') }
    return { stages, conversion: { acceptanceRate: this.rate(stages.accepted, stages.invited), publicationRate: this.rate(stages.published, stages.accepted), completionRate: this.rate(stages.completed, stages.published), verificationRate: this.rate(stages.verified, stages.completed), reinvestmentRate: this.rate(stages.reinvested, stages.activated) } }
  }
  private groupFunnels(events: PilotMetricEvent[], key: (event: PilotMetricEvent) => string) { const groups = new Map<string, PilotMetricEvent[]>(); for (const event of events) { const id = key(event); groups.set(id, [...(groups.get(id) ?? []), event]) } return Array.from(groups.entries()).map(([id, items]) => ({ id, ...this.toFunnel(items) })) }
  private reviewDurations(events: PilotMetricEvent[]) { const submitted = new Map(events.filter((item) => item.eventType === 'task_submitted').map((item) => [item.creatorTaskId, item.occurredAt])); return events.filter((item) => item.eventType === 'task_reviewed').flatMap((item) => { const start = submitted.get(item.creatorTaskId); return start ? [Math.max(0, (item.occurredAt.getTime() - start.getTime()) / 3_600_000)] : [] }) }
  private matchesTask(task: CreatorTask, query: PilotInstrumentationQueryDto) { return (!query.merchantId || task.merchantId === query.merchantId) && (!query.campaignId || task.campaignId === query.campaignId) && (!query.creatorId || task.creatorId === query.creatorId) && (!query.growthTaskId || task.growthTaskId === query.growthTaskId) && (!query.creatorTaskId || task.id === query.creatorTaskId) }
  private matchesGrowthTask(task: GrowthTask, query: PilotInstrumentationQueryDto) { return (!query.merchantId || task.merchantId === query.merchantId) && (!query.campaignId || task.campaignId === query.campaignId) && (!query.growthTaskId || task.id === query.growthTaskId) }
  private matchesEvent(event: PilotMetricEvent, query: PilotInstrumentationQueryDto, taskIds: Set<string>, growthIds: Set<string>) { const dateOk = (!query.startAt || event.occurredAt >= new Date(query.startAt)) && (!query.endAt || event.occurredAt <= new Date(query.endAt)); const taskOk = !query.creatorTaskId || event.creatorTaskId === query.creatorTaskId; const creatorOk = !query.creatorId || event.creatorId === query.creatorId || Boolean(event.creatorTaskId && taskIds.has(event.creatorTaskId)); const growthOk = !query.growthTaskId || event.growthTaskId === query.growthTaskId || Boolean(event.creatorTaskId && taskIds.has(event.creatorTaskId)); const relatedOk = (!query.creatorId && !query.growthTaskId) || !event.growthTaskId || growthIds.has(event.growthTaskId) || Boolean(event.creatorTaskId && taskIds.has(event.creatorTaskId)); return dateOk && (!query.merchantId || event.merchantId === query.merchantId) && (!query.campaignId || event.campaignId === query.campaignId) && taskOk && creatorOk && growthOk && relatedOk }
  private unique<T>(values: T[]) { return [...new Set(values)] }
  private rate(numerator: number, denominator: number) { return denominator ? this.round(numerator / denominator, 4) : 0 }
  private average(values: number[]) { return values.length ? values.reduce((sum, item) => sum + item, 0) / values.length : 0 }
  private percentile(values: number[], percentile: number) { if (!values.length) return 0; const valuesSorted = [...values].sort((a, b) => a - b); return this.round(valuesSorted[Math.min(valuesSorted.length - 1, Math.ceil(valuesSorted.length * percentile) - 1)], 2) }
  private round(value: number, precision: number) { const base = 10 ** precision; return Math.round(value * base) / base }
}