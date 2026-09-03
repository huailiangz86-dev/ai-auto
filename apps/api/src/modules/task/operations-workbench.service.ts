import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { In, Repository, SelectQueryBuilder } from 'typeorm'
import { AuditLog } from '../admin/entities/audit-log.entity'
import { FinancialLedgerEntry } from '../admin/entities/financial-ledger-entry.entity'
import { Content } from '../content/entities/content.entity'
import { ContentPublication } from '../content/entities/content-publication.entity'
import { Notification } from '../notification/entities/notification.entity'
import { OperationsQueueQueryDto } from './dto/growth-task.dto'
import { CampaignCreditLedgerEntry, CreatorTask, CreatorTaskStatus, GrowthTask } from './entities/growth-task.entity'

const REVIEW_STATUSES: CreatorTaskStatus[] = ['submitted', 'approved', 'rejected']
const RISK_STATUSES: CreatorTaskStatus[] = ['risk_hold', 'violation']

@Injectable()
export class OperationsWorkbenchService {
  constructor(
    @InjectRepository(CreatorTask) private readonly creatorTaskRepo: Repository<CreatorTask>,
    @InjectRepository(GrowthTask) private readonly growthTaskRepo: Repository<GrowthTask>,
    @InjectRepository(CampaignCreditLedgerEntry) private readonly creditRepo: Repository<CampaignCreditLedgerEntry>,
    @InjectRepository(FinancialLedgerEntry) private readonly financialLedgerRepo: Repository<FinancialLedgerEntry>,
    @InjectRepository(Content) private readonly contentRepo: Repository<Content>,
    @InjectRepository(ContentPublication) private readonly publicationRepo: Repository<ContentPublication>,
    @InjectRepository(AuditLog) private readonly auditRepo: Repository<AuditLog>,
    @InjectRepository(Notification) private readonly notificationRepo: Repository<Notification>,
  ) {}

  async listReviewQueue(query: OperationsQueueQueryDto) {
    const statuses: CreatorTaskStatus[] = query.status ? [query.status] : ['submitted']
    return this.listQueue(query, statuses.filter((status) => REVIEW_STATUSES.includes(status)))
  }

  async listRiskQueue(query: OperationsQueueQueryDto) {
    const statuses: CreatorTaskStatus[] = query.status ? [query.status] : ['risk_hold']
    return this.listQueue(query, statuses.filter((status) => RISK_STATUSES.includes(status)))
  }

  /** Correlates the task state, financial locks, credits, evidence, audit trail, and notifications. */
  async getTaskDetail(creatorTaskId: string) {
    const task = await this.creatorTaskRepo.findOne({ where: { id: creatorTaskId } })
    if (!task) throw new NotFoundException('创作者任务不存在')
    const [growthTask, creditLedger, financialEntries, evidence, auditRecords, notifications] = await Promise.all([
      this.growthTaskRepo.findOne({ where: { id: task.growthTaskId } }),
      this.creditRepo.find({ where: { creatorTaskId: task.id }, order: { createdAt: 'DESC' } }),
      this.financialLedgerRepo.find({ where: { creatorTaskId: task.id }, order: { occurredAt: 'DESC', createdAt: 'DESC' } }),
      this.contentRepo.find({ where: { creatorTaskId: task.id }, order: { createdAt: 'DESC' } }),
      this.auditRepo.find({ where: { targetType: 'creator_task', targetId: task.id }, order: { createdAt: 'DESC' } }),
      this.notificationRepo.find({ where: { recipientId: task.creatorId, targetType: 'creator_task', targetId: task.id }, order: { createdAt: 'DESC' } }),
    ])
    const evidenceIds = evidence.map((item) => item.id)
    const publications = evidenceIds.length
      ? await this.publicationRepo.find({ where: { contentId: In(evidenceIds) }, order: { createdAt: 'DESC' } })
      : []
    const allocated = Number(task.campaignCreditsAllocated)
    const consumed = Number(task.campaignCreditsConsumed)
    return {
      task: this.toTaskSummary(task),
      growthTask: growthTask && {
        id: growthTask.id,
        status: growthTask.status,
        goalMetric: growthTask.goalMetric,
        budget: Number(growthTask.budget),
        compensationReserved: Number(growthTask.compensationReserved),
        campaignCreditsReserved: Number(growthTask.campaignCreditsReserved),
      },
      economics: {
        compensation: { baseReward: Number(task.baseReward), lockedSnapshot: task.compensationSnapshot, lockedAt: task.compensationLockedAt },
        campaignCredits: {
          allocated,
          consumed,
          remaining: allocated - consumed,
          ledger: creditLedger.map((entry) => ({ ...entry, amount: Number(entry.amount) })),
        },
        financialEntries: financialEntries.map((entry) => ({ ...entry, amount: Number(entry.amount) })),
      },
      evidence: evidence.map((item) => ({
        ...item,
        creatorStudioAction: item.contentType === 'creator_studio' ? item.contentData?.action ?? null : null,
        publications: publications.filter((publication) => publication.contentId === item.id),
      })),
      auditRecords,
      notifications,
    }
  }

  private async listQueue(query: OperationsQueueQueryDto, statuses: CreatorTaskStatus[]) {
    const page = Math.max(Number(query.page) || 1, 1)
    const pageSize = Math.min(Math.max(Number(query.pageSize) || 20, 1), 100)
    if (statuses.length === 0) return { items: [], pagination: { page, pageSize, total: 0, totalPages: 0 } }
    const builder = this.creatorTaskRepo.createQueryBuilder('task').where('task.status IN (:...statuses)', { statuses })
    this.applyScope(builder, query)
    const [items, total] = await builder.orderBy('task.deadline', 'ASC').addOrderBy('task.createdAt', 'ASC').skip((page - 1) * pageSize).take(pageSize).getManyAndCount()
    return { items: items.map((task) => this.toTaskSummary(task)), pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } }
  }

  private applyScope(builder: SelectQueryBuilder<CreatorTask>, query: OperationsQueueQueryDto) {
    if (query.campaignId) builder.andWhere('task.campaignId = :campaignId', { campaignId: query.campaignId })
    if (query.merchantId) builder.andWhere('task.merchantId = :merchantId', { merchantId: query.merchantId })
    if (query.creatorId) builder.andWhere('task.creatorId = :creatorId', { creatorId: query.creatorId })
    if (query.growthTaskId) builder.andWhere('task.growthTaskId = :growthTaskId', { growthTaskId: query.growthTaskId })
  }

  private toTaskSummary(task: CreatorTask) {
    const allocated = Number(task.campaignCreditsAllocated)
    const consumed = Number(task.campaignCreditsConsumed)
    return {
      id: task.id, growthTaskId: task.growthTaskId, campaignId: task.campaignId, merchantId: task.merchantId, creatorId: task.creatorId,
      channel: task.channel, contentType: task.contentType, brief: task.brief, deadline: task.deadline, status: task.status, publishedUrl: task.publishedUrl,
      review: { reason: task.reviewReason, reviewedBy: task.reviewedBy, reviewedAt: task.reviewedAt },
      risk: { holdReason: task.riskHoldReason, previousStatus: task.riskHoldPreviousStatus, resolutionReason: task.stateReason, changedBy: task.stateChangedBy, changedAt: task.stateChangedAt },
      economics: { baseReward: Number(task.baseReward), compensationLockedAt: task.compensationLockedAt, campaignCreditsAllocated: allocated, campaignCreditsConsumed: consumed, campaignCreditsRemaining: allocated - consumed },
      createdAt: task.createdAt, updatedAt: task.updatedAt,
    }
  }
}