import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { AuditActionType, WalletTransactionType } from '@ai-auto/shared'
import { DataSource, Repository } from 'typeorm'
import { AuditLog } from '../admin/entities/audit-log.entity'
import { FinancialLedgerEntry } from '../admin/entities/financial-ledger-entry.entity'
import { Campaign } from '../campaign/entities/campaign.entity'
import { BudgetTransaction, CommissionBudget } from '../merchant/entities/commission-budget.entity'
import { FundGrowthPlanDto } from './dto/campaign-budget.dto'
import { CampaignBudgetAllocation, CampaignBudgetCategory } from './entities/campaign-budget-allocation.entity'
import { GrowthPlan } from './entities/growth-plan.entity'
import { GrowthTask } from './entities/growth-task.entity'

const CATEGORIES: CampaignBudgetCategory[] = ['creator_payout', 'campaign_credits', 'channel_cost', 'consumer_incentive', 'risk_reserve']

@Injectable()
export class CampaignFundingService {
  constructor(
    @InjectRepository(GrowthPlan) private readonly plans: Repository<GrowthPlan>,
    @InjectRepository(GrowthTask) private readonly tasks: Repository<GrowthTask>,
    @InjectRepository(Campaign) private readonly campaigns: Repository<Campaign>,
    @InjectRepository(CampaignBudgetAllocation) private readonly allocations: Repository<CampaignBudgetAllocation>,
    @InjectRepository(FinancialLedgerEntry) private readonly ledger: Repository<FinancialLedgerEntry>,
    private readonly dataSource: DataSource,
  ) {}

  async fund(merchantId: string, planId: string, dto: FundGrowthPlanDto) {
    return this.dataSource.transaction(async (manager) => {
      const plan = await manager.findOne(GrowthPlan, { where: { id: planId, merchantId } })
      if (!plan) throw new NotFoundException('增长计划不存在')
      if (plan.status !== 'approved' || !plan.campaignId) throw new BadRequestException('请先批准增长方案，再确认资金')
      const task = await manager.findOne(GrowthTask, { where: { id: plan.growthTaskId, merchantId } })
      const campaign = await manager.findOne(Campaign, { where: { id: plan.campaignId, merchantId } })
      if (!task || !campaign) throw new NotFoundException('关联的 Campaign 或 Growth Task 不存在')
      const existing = await manager.find(CampaignBudgetAllocation, { where: { campaignId: campaign.id } })
      if (existing.length) return this.serializeFunding(existing, task, campaign, true)

      const option = plan.alternatives.find((item) => item.optionId === plan.selectedOptionId)
      if (!option) throw new BadRequestException('已批准方案的预算分配不存在')
      const lineItems = this.lineItems(option.budgetAllocation)
      const fundingAmount = lineItems.reduce((total, item) => total + item.amount, 0)
      if (fundingAmount <= 0) throw new BadRequestException('资金计划金额必须大于零')
      if (fundingAmount > Number(task.budget)) throw new BadRequestException('方案资金计划超过商户设置的增长预算')

      const wallet = await manager.findOne(CommissionBudget, { where: { merchantId } })
      if (!wallet || !wallet.status) throw new BadRequestException('请先充值可用预算后再确认资金')
      if (Number(wallet.availableBalance) < fundingAmount) throw new BadRequestException(`可用预算不足：可用 ¥${Number(wallet.availableBalance).toFixed(2)}，需 ¥${fundingAmount.toFixed(2)}`)

      const totalBalance = Number(wallet.totalBalance)
      const frozenBalance = Number(wallet.frozenBalance) + fundingAmount
      const availableBalance = Number(wallet.availableBalance) - fundingAmount
      await manager.update(CommissionBudget, wallet.id, { frozenBalance, availableBalance })
      await manager.save(BudgetTransaction, {
        budgetId: wallet.id, type: WalletTransactionType.FREEZE, amount: fundingAmount,
        balanceBefore: totalBalance, balanceAfter: totalBalance, campaignId: campaign.id,
        description: `Growth Plan 资金确认（计划 ${plan.id.slice(0, 8)}）`,
      })
      const created = await manager.save(CampaignBudgetAllocation, lineItems.map((item) => manager.create(CampaignBudgetAllocation, {
        merchantId, growthPlanId: plan.id, growthTaskId: task.id, campaignId: campaign.id,
        category: item.category, plannedAmount: item.amount, committedAmount: item.amount, spentAmount: 0,
        status: 'funded', metadata: { selectedOptionId: option.optionId, sourceReference: dto.sourceReference ?? null },
      })))
      campaign.maxBudget = fundingAmount; campaign.frozenBudget = Number(campaign.frozenBudget) + fundingAmount
      task.budget = fundingAmount
      await manager.save(campaign); await manager.save(task)
      await manager.save(AuditLog, {
        actorType: 'merchant', actorId: merchantId, actionType: AuditActionType.CAMPAIGN_BUDGET_FUNDED,
        actionDescription: 'campaign_budget_funded', targetType: 'campaign', targetId: campaign.id,
        metadata: { growthPlanId: plan.id, growthTaskId: task.id, fundingAmount, allocations: lineItems }, result: 'success',
      })
      return this.serializeFunding(created, task, campaign, false)
    })
  }

  async economics(merchantId: string, planId: string) {
    const plan = await this.plans.findOne({ where: { id: planId, merchantId } })
    if (!plan) throw new NotFoundException('增长计划不存在')
    const task = await this.tasks.findOne({ where: { id: plan.growthTaskId, merchantId } })
    const campaign = plan.campaignId ? await this.campaigns.findOne({ where: { id: plan.campaignId, merchantId } }) : null
    const allocations = campaign ? await this.allocations.find({ where: { campaignId: campaign.id }, order: { category: 'ASC' } }) : []
    const entries = campaign ? await this.ledger.find({ where: { campaignId: campaign.id } }) : []
    const revenue = this.sum(entries, 'revenue')
    const creatorPayout = this.sum(entries, 'cogs')
    const operatingCost = this.sum(entries, 'operating_cost')
    const reserve = this.sum(entries, 'reserve')
    const spend = creatorPayout + operatingCost + reserve
    const frozen = Number(campaign?.frozenBudget ?? 0)
    const targetValue = Number(task?.targetValue ?? 0), baselineValue = Number(task?.baselineValue ?? 0)
    const actualValue = task?.goalMetric.includes('核销') ? Number(campaign?.totalRedemptions ?? 0) : 0
    const targetDelta = Math.max(targetValue - baselineValue, 0)
    return {
      growthPlanId: plan.id, campaignId: campaign?.id ?? null, funding: this.serializeFunding(allocations, task, campaign, false),
      economics: { revenue, creatorPayoutCogs: creatorPayout, operatingCost, riskReserve: reserve, spend, grossProfit: revenue - spend, roi: spend === 0 ? null : Number(((revenue - spend) / spend).toFixed(4)) },
      results: { goalMetric: task?.goalMetric ?? null, baselineValue, targetValue, actualValue, targetProgress: targetDelta === 0 ? null : Number((Math.max(actualValue - baselineValue, 0) / targetDelta).toFixed(4)), verifiedRedemptions: Number(campaign?.totalRedemptions ?? 0), verifiedOrders: 0, incrementalOrders: null, incrementalGmv: null },
    }
  }

  private lineItems(allocation: { creatorPayout: number; campaignCredits: number; offerCost: number; reserve: number }) {
    return [
      { category: 'creator_payout' as const, amount: this.money(allocation.creatorPayout) },
      { category: 'campaign_credits' as const, amount: this.money(allocation.campaignCredits) },
      { category: 'channel_cost' as const, amount: 0 },
      { category: 'consumer_incentive' as const, amount: this.money(allocation.offerCost) },
      { category: 'risk_reserve' as const, amount: this.money(allocation.reserve) },
    ]
  }
  private sum(entries: FinancialLedgerEntry[], classification: FinancialLedgerEntry['classification']) { return this.money(entries.filter((entry) => entry.classification === classification).reduce((total, entry) => total + Number(entry.amount), 0)) }
  private money(amount: number) { return Math.round(Number(amount || 0) * 100) / 100 }
  private serializeFunding(allocations: CampaignBudgetAllocation[], task?: GrowthTask | null, campaign?: Campaign | null, idempotent = false) {
    const committed = this.money(allocations.reduce((total, item) => total + Number(item.committedAmount), 0)); const spent = this.money(allocations.reduce((total, item) => total + Number(item.spentAmount), 0))
    return { status: allocations.length ? 'funded' : 'pending', idempotent, campaignId: campaign?.id ?? null, growthTaskId: task?.id ?? null, plannedAmount: committed, committedAmount: committed, spentAmount: spent, frozenAmount: Number(campaign?.frozenBudget ?? 0), remainingAmount: this.money(committed - spent), allocations: CATEGORIES.map((category) => { const item = allocations.find((line) => line.category === category); return { category, plannedAmount: Number(item?.plannedAmount ?? 0), committedAmount: Number(item?.committedAmount ?? 0), spentAmount: Number(item?.spentAmount ?? 0), remainingAmount: this.money(Number(item?.committedAmount ?? 0) - Number(item?.spentAmount ?? 0)) } }) }
  }
}
