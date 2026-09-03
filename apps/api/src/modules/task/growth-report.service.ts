import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { RedemptionStatus } from '@ai-auto/shared'
import { In, Repository } from 'typeorm'
import { FinancialLedgerEntry } from '../admin/entities/financial-ledger-entry.entity'
import { Campaign } from '../campaign/entities/campaign.entity'
import { Commission } from '../commission/entities/commission.entity'
import { Redemption } from '../commission/entities/redemption.entity'
import { Content } from '../content/entities/content.entity'
import {
  ContentPublication,
  PublicationStatus,
} from '../content/entities/content-publication.entity'
import { CustomerAttribution } from '../customer/entities/customer-attribution.entity'
import { CampaignBudgetAllocation } from './entities/campaign-budget-allocation.entity'
import { CreatorTask, CampaignCreditLedgerEntry, GrowthTask } from './entities/growth-task.entity'
import { GrowthPlan } from './entities/growth-plan.entity'
import { IncrementalityMeasurementService } from './incrementality-measurement.service'

/** Verified attribution is auditable; it becomes incremental only after a measurement method is recorded. */
@Injectable()
export class GrowthReportService {
  constructor(
    @InjectRepository(GrowthPlan) private readonly plans: Repository<GrowthPlan>,
    @InjectRepository(GrowthTask) private readonly growthTasks: Repository<GrowthTask>,
    @InjectRepository(Campaign) private readonly campaigns: Repository<Campaign>,
    @InjectRepository(CampaignBudgetAllocation)
    private readonly allocations: Repository<CampaignBudgetAllocation>,
    @InjectRepository(CreatorTask) private readonly creatorTasks: Repository<CreatorTask>,
    @InjectRepository(CampaignCreditLedgerEntry)
    private readonly creditLedger: Repository<CampaignCreditLedgerEntry>,
    @InjectRepository(Redemption) private readonly redemptions: Repository<Redemption>,
    @InjectRepository(Commission) private readonly commissions: Repository<Commission>,
    @InjectRepository(CustomerAttribution)
    private readonly attributions: Repository<CustomerAttribution>,
    @InjectRepository(Content) private readonly contents: Repository<Content>,
    @InjectRepository(ContentPublication)
    private readonly publications: Repository<ContentPublication>,
    @InjectRepository(FinancialLedgerEntry)
    private readonly financialLedger: Repository<FinancialLedgerEntry>,
    private readonly incrementality: IncrementalityMeasurementService,
  ) {}

  async report(merchantId: string, planId: string) {
    const plan = await this.plans.findOne({ where: { id: planId, merchantId } })
    if (!plan) throw new NotFoundException('增长计划不存在')
    const growthTask = await this.growthTasks.findOne({
      where: { id: plan.growthTaskId, merchantId },
    })
    const campaign = plan.campaignId
      ? await this.campaigns.findOne({ where: { id: plan.campaignId, merchantId } })
      : null
    if (!growthTask || !campaign) throw new NotFoundException('该增长计划尚未关联 Campaign')
    const [allocations, creatorTasks, redemptions, commissions, ledger] = await Promise.all([
      this.allocations.find({ where: { campaignId: campaign.id } }),
      this.creatorTasks.find({ where: { growthTaskId: growthTask.id } }),
      this.redemptions.find({
        where: {
          merchantId,
          campaignId: campaign.id,
          status: In([RedemptionStatus.VERIFIED, RedemptionStatus.SETTLED]),
        },
        order: { verifiedAt: 'DESC' },
      }),
      this.commissions.find({ where: { merchantId, campaignId: campaign.id } }),
      this.financialLedger.find({ where: { campaignId: campaign.id } }),
    ])
    const creatorTaskIds = creatorTasks.map((task) => task.id)
    const attributionIds = redemptions.flatMap((redemption) =>
      redemption.attributionId ? [redemption.attributionId] : [],
    )
    const [credits, attributions, contents] = await Promise.all([
      creatorTaskIds.length
        ? this.creditLedger.find({ where: { creatorTaskId: In(creatorTaskIds) } })
        : [],
      attributionIds.length ? this.attributions.find({ where: { id: In(attributionIds) } }) : [],
      creatorTaskIds.length
        ? this.contents.find({ where: { creatorTaskId: In(creatorTaskIds) } })
        : [],
    ])
    const contentIds = contents.map((content) => content.id)
    const publications = contentIds.length
      ? await this.publications.find({ where: { contentId: In(contentIds) } })
      : []
    const commissionByRedemption = new Map<string, Commission>(
      commissions.map((commission): [string, Commission] => [commission.redemptionId, commission]),
    )
    const attributionById = new Map<string, CustomerAttribution>(
      attributions.map((attribution): [string, CustomerAttribution] => [
        attribution.id,
        attribution,
      ]),
    )
    const contentByTask = new Map<string, Content[]>()
    contents.forEach(
      (content) =>
        content.creatorTaskId &&
        contentByTask.set(content.creatorTaskId, [
          ...(contentByTask.get(content.creatorTaskId) ?? []),
          content,
        ]),
    )
    const publicationByContent = new Map<string, ContentPublication[]>()
    publications.forEach((publication) =>
      publicationByContent.set(publication.contentId, [
        ...(publicationByContent.get(publication.contentId) ?? []),
        publication,
      ]),
    )
    const verifiedGmv = this.sum(redemptions, 'transactionAmount'),
      verifiedOrders = redemptions.length
    const verifiedNewCustomers = new Set(redemptions.map((redemption) => redemption.customerId))
      .size
    const actualValue = this.goalActual(
      growthTask.goalMetric,
      verifiedNewCustomers,
      verifiedOrders,
      verifiedGmv,
    )
    const baselineValue = Number(growthTask.baselineValue),
      targetValue = Number(growthTask.targetValue),
      targetDelta = Math.max(targetValue - baselineValue, 0)
    const creatorPayout = Math.max(
      this.sum(commissions, 'agentFinalPayout'),
      this.sum(
        ledger.filter((entry) => entry.classification === 'cogs'),
        'amount',
      ),
    )
    const discountCost = this.sum(redemptions, 'discountValue')
    const consumedCredits = this.sum(
      credits.filter((entry) => entry.entryType === 'consumption'),
      'amount',
    )
    const allocationSpend = (category: string) =>
      Number(allocations.find((item) => item.category === category)?.spentAmount ?? 0)
    const campaignCreditsCost = allocationSpend('campaign_credits')
    const channelCost =
      allocationSpend('channel_cost') +
      this.sum(
        ledger.filter((entry) => entry.classification === 'operating_cost'),
        'amount',
      )
    const riskReserve =
      allocationSpend('risk_reserve') +
      this.sum(
        ledger.filter((entry) => entry.classification === 'reserve'),
        'amount',
      )
    const totalInvestment = this.money(
      creatorPayout + campaignCreditsCost + discountCost + channelCost + riskReserve,
    )
    const grossProfit = this.money(verifiedGmv - totalInvestment),
      roi = totalInvestment > 0 ? this.round(grossProfit / totalInvestment) : null
    const published = publications.filter(
      (publication) =>
        publication.status === PublicationStatus.PUBLISHED ||
        publication.status === PublicationStatus.MANUAL,
    )
    const creatorTaskByCreator = new Map<string, CreatorTask>(
      creatorTasks.map((task): [string, CreatorTask] => [task.creatorId, task]),
    )
    return {
      growthPlanId: plan.id,
      campaign: { id: campaign.id, name: campaign.campaignName, status: campaign.campaignStatus },
      goal: {
        metric: growthTask.goalMetric,
        baselineValue,
        targetValue,
        actualValue,
        targetProgress:
          targetDelta === 0
            ? null
            : this.round(Math.max(actualValue - baselineValue, 0) / targetDelta),
      },
      verified: {
        redemptions: verifiedOrders,
        orders: verifiedOrders,
        newCustomers: verifiedNewCustomers,
        gmv: verifiedGmv,
        attributionLocks: attributions.length,
        label: '已验证归因结果',
        definition: '仅统计已验证或已结算的核销/订单；每条记录可回溯至交易与归因凭证。',
      },
      incremental: await this.incrementality.result(merchantId, plan.id),
      investment: {
        currency: 'CNY',
        total: totalInvestment,
        planned: this.sum(allocations, 'committedAmount'),
        creatorPayout,
        campaignCreditsCost,
        campaignCreditsConsumed: consumedCredits,
        discountCost,
        channelCost,
        riskReserve,
        grossProfit,
        roi,
        calculation:
          'ROI =（已验证 GMV − 已投入）÷ 已投入；已投入只计入已发生、可追溯的成本。Campaign Credits 消耗量与已记账成本分开显示。',
      },
      evidence: {
        summary: {
          creatorTasks: creatorTasks.length,
          trackedCreatorTasks: creatorTasks.filter((task) => Boolean(task.trackingId)).length,
          contents: contents.length,
          publications: published.length,
          verifiedTransactions: verifiedOrders,
          payouts: commissions.length,
        },
        transactions: redemptions.slice(0, 100).map((redemption) => {
          const attribution = redemption.attributionId
            ? attributionById.get(redemption.attributionId)
            : undefined
          const creatorTask = attribution
            ? creatorTaskByCreator.get(attribution.agentId)
            : undefined
          const commission = commissionByRedemption.get(redemption.id)
          return {
            redemptionId: redemption.id,
            verifiedAt: redemption.verifiedAt ?? redemption.createdAt,
            transactionAmount: Number(redemption.transactionAmount),
            discountValue: Number(redemption.discountValue),
            campaignId: redemption.campaignId,
            attributionId: redemption.attributionId ?? null,
            attributionLockStartedAt: attribution?.lockStartedAt ?? null,
            creatorTaskId: creatorTask?.id ?? null,
            trackingId: creatorTask?.trackingId ?? null,
            payout: Number(commission?.agentFinalPayout ?? 0),
            payoutStatus: commission?.status ?? null,
          }
        }),
        creatorTasks: creatorTasks.map((task) => {
          const taskContents = contentByTask.get(task.id) ?? []
          const taskPublications = taskContents.flatMap(
            (content) => publicationByContent.get(content.id) ?? [],
          )
          return {
            creatorTaskId: task.id,
            creatorId: task.creatorId,
            status: task.status,
            trackingId: task.trackingId ?? null,
            publishedUrl: task.publishedUrl ?? null,
            contentCount: taskContents.length,
            publicationCount: taskPublications.length,
            publishedAt:
              taskPublications.find((publication) => publication.publishedAt)?.publishedAt ?? null,
          }
        }),
      },
    }
  }
  private goalActual(metric: string, newCustomers: number, orders: number, gmv: number) {
    return metric.includes('GMV') ? gmv : metric.includes('订单') ? orders : newCustomers
  }
  private sum<T extends Record<string, any>>(items: T[], field: keyof T) {
    return this.money(items.reduce((total, item) => total + Number(item[field] ?? 0), 0))
  }
  private money(value: number) {
    return Math.round(value * 100) / 100
  }
  private round(value: number) {
    return Math.round(value * 10000) / 10000
  }
}
