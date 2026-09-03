import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { AuditActionType, CampaignType } from '@ai-auto/shared'
import { DataSource, Repository } from 'typeorm'
import { AuditLog } from '../admin/entities/audit-log.entity'
import { AIBridgeService } from '../ai-bridge/ai-bridge.service'
import { Campaign } from '../campaign/entities/campaign.entity'
import { Store } from '../merchant/entities/store.entity'
import { ApproveGrowthPlanDto, CreateGrowthPlanDto, ListGrowthPlansDto } from './dto/growth-plan.dto'
import { GrowthPlan, GrowthPlanAlternative } from './entities/growth-plan.entity'
import { GrowthTask } from './entities/growth-task.entity'

@Injectable()
export class GrowthPlanService {
  constructor(
    @InjectRepository(GrowthPlan) private readonly plans: Repository<GrowthPlan>,
    @InjectRepository(GrowthTask) private readonly tasks: Repository<GrowthTask>,
    @InjectRepository(Store) private readonly stores: Repository<Store>,
    private readonly ai: AIBridgeService,
    private readonly dataSource: DataSource,
  ) {}

  async create(merchantId: string, dto: CreateGrowthPlanDto) {
    const startAt = new Date(dto.startAt), endAt = new Date(dto.endAt)
    if (endAt <= startAt) throw new BadRequestException('增长周期的结束时间必须晚于开始时间')
    if (dto.storeId && !await this.stores.findOne({ where: { id: dto.storeId, merchantId, status: true } }))
      throw new NotFoundException('门店不存在或已停用')
    const alternatives = await this.generateAlternatives(merchantId, dto)
    return this.dataSource.transaction(async (manager) => {
      const task = await manager.save(GrowthTask, manager.create(GrowthTask, {
        merchantId, storeId: dto.storeId ?? null, goalMetric: dto.goalMetric, baselineValue: dto.baselineValue ?? 0,
        targetValue: dto.targetValue, budget: dto.budget, startAt, endAt,
        acceptableRiskBoundary: dto.acceptableRiskBoundary ?? null, acceptableRoiBoundary: dto.acceptableRoiBoundary ?? null,
        status: 'draft', compensationReserved: 0, campaignCreditsReserved: 0,
      }))
      const plan = await manager.save(GrowthPlan, manager.create(GrowthPlan, {
        merchantId, growthTaskId: task.id, goalBrief: dto.goalBrief, title: `${dto.goalMetric}增长计划`,
        status: 'proposed', alternatives, aiMetadata: { source: 'ai_campaign_configure', generatedAt: new Date().toISOString() },
      }))
      await this.audit(manager, merchantId, AuditActionType.GROWTH_PLAN_CREATED, plan.id, { growthTaskId: task.id, goalMetric: dto.goalMetric, optionCount: alternatives.length })
      return this.serialize(plan, task)
    })
  }

  async list(merchantId: string, query: ListGrowthPlansDto) {
    const page = query.page ?? 1, pageSize = Math.min(query.pageSize ?? 20, 100)
    const [plans, total] = await this.plans.findAndCount({ where: { merchantId }, order: { createdAt: 'DESC' }, skip: (page - 1) * pageSize, take: pageSize })
    const tasks = plans.length ? await this.tasks.findByIds(plans.map((item) => item.growthTaskId)) : []
    const byId = new Map(tasks.map((task) => [task.id, task]))
    return { items: plans.map((plan) => this.serialize(plan, byId.get(plan.growthTaskId))), pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } }
  }

  async get(merchantId: string, planId: string) {
    const plan = await this.requirePlan(merchantId, planId)
    return this.serialize(plan, await this.tasks.findOne({ where: { id: plan.growthTaskId, merchantId } }))
  }

  async getEntity(merchantId: string, planId: string) {
    return this.requirePlan(merchantId, planId)
  }
  async approve(merchantId: string, planId: string, dto: ApproveGrowthPlanDto) {
    return this.dataSource.transaction(async (manager) => {
      const plan = await manager.findOne(GrowthPlan, { where: { id: planId, merchantId } })
      if (!plan) throw new NotFoundException('增长计划不存在')
      if (plan.status !== 'proposed') throw new BadRequestException('该增长计划已处理，不能重复批准')
      const option = plan.alternatives.find((item) => item.optionId === dto.optionId)
      if (!option) throw new BadRequestException('所选方案不存在')
      const task = await manager.findOne(GrowthTask, { where: { id: plan.growthTaskId, merchantId } })
      if (!task) throw new NotFoundException('关联的 Growth Task 不存在')
      const campaign = await manager.save(Campaign, manager.create(Campaign, {
        merchantId, storeId: task.storeId ?? null, campaignName: option.title, campaignType: this.campaignType(option.campaignType),
        campaignStatus: 'draft', startAt: task.startAt, endAt: task.endAt, targetAudience: option.targetAudience, maxBudget: task.budget,
        frozenBudget: 0, spentBudget: 0, aiGenerated: true, aiDescription: plan.goalBrief,
        description: `增长计划方案：${option.title}。目标人群：${option.targetAudience}。${option.creatorStrategy.rationale}`,
        totalImpressions: 0, totalClicks: 0, totalClaims: 0, totalRedemptions: 0, totalCommissionSpent: 0,
      }))
      task.campaignId = campaign.id; task.status = 'ready_for_review'; await manager.save(task)
      plan.status = 'approved'; plan.selectedOptionId = option.optionId; plan.approvedAt = new Date(); plan.approvedBy = merchantId; plan.campaignId = campaign.id; await manager.save(plan)
      await this.audit(manager, merchantId, AuditActionType.GROWTH_PLAN_APPROVED, plan.id, { growthTaskId: task.id, campaignId: campaign.id, selectedOptionId: option.optionId, generatedWorkItems: ['campaign_funding', 'creator_matching', 'attribution_setup'] })
      return this.serialize(plan, task)
    })
  }

  private async requirePlan(merchantId: string, planId: string) {
    const plan = await this.plans.findOne({ where: { id: planId, merchantId } })
    if (!plan) throw new NotFoundException('增长计划不存在')
    return plan
  }

  private async generateAlternatives(merchantId: string, dto: CreateGrowthPlanDto): Promise<GrowthPlanAlternative[]> {
    try {
      const response = await this.ai.configureCampaign({ description: dto.goalBrief, merchant_id: merchantId, store_id: dto.storeId, language: 'zh-CN' })
      const options = response?.options ?? response?.data?.options ?? []
      if (Array.isArray(options) && options.length >= 3) return options.slice(0, 3).map((option: any, index: number) => this.toAlternative(option, index + 1, dto))
    } catch { /* pilot fallback remains explicitly reviewable */ }
    return [1, 2, 3].map((optionId) => this.fallback(optionId, dto))
  }

  private toAlternative(raw: any, index: number, dto: CreateGrowthPlanDto): GrowthPlanAlternative {
    const budget = Number(raw.budget) > 0 ? Math.min(Number(raw.budget), dto.budget) : dto.budget
    const likely = Math.max(1, Math.round((dto.targetValue - (dto.baselineValue ?? 0)) * [0.7, 0.9, 1][index - 1]))
    return {
      optionId: Number(raw.option_id) || index, title: ['稳健拉新方案', '均衡增长方案', '扩张验证方案'][index - 1], campaignType: this.planType(raw.campaign_type),
      offer: { thresholdAmount: Number(raw.min_purchase) || 0, discountAmount: raw.discount_amount == null ? undefined : Number(raw.discount_amount), cashRewardAmount: raw.cash_reward == null ? undefined : Number(raw.cash_reward) },
      targetAudience: raw.target_audience || '新客', creatorStrategy: this.creatorStrategy(index), budgetAllocation: this.allocation(budget),
      expectedOutcome: { metric: dto.goalMetric, low: Math.max(1, Math.round(likely * 0.7)), likely, high: Math.round(likely * 1.25), expectedRoi: Number((1 + index * 0.2).toFixed(2)) },
      assumptions: [raw.description || '基于历史同类活动与本地创作者供给的估算。', '结果需经可追溯的核销或订单证据验证。', '商户批准前不会创建活动或向创作者发布任务。'],
    }
  }

  private fallback(index: number, dto: CreateGrowthPlanDto): GrowthPlanAlternative {
    return this.toAlternative({ option_id: index, campaign_type: 'DISCOUNT', min_purchase: 100, discount_amount: [10, 20, 30][index - 1], target_audience: index === 1 ? '新客' : index === 2 ? '新客与沉默用户' : '高潜本地客群', budget: dto.budget * [0.7, 0.9, 1][index - 1], description: 'AI 服务暂不可用，已提供基于预算与目标的保守测算。' }, index, dto)
  }

  private creatorStrategy(index: number) { return { channels: index === 3 ? ['douyin', 'xiaohongshu', 'wechat_video'] : ['douyin', 'xiaohongshu'], recommendedCreatorCount: [3, 5, 8][index - 1], contentTypes: ['short_video', 'graphic'], rationale: '根据门店范围、内容品类与创作者 Growth Score 分层匹配。' } }
  private allocation(budget: number) { return { creatorPayout: Number((budget * 0.45).toFixed(2)), campaignCredits: Number((budget * 0.1).toFixed(2)), offerCost: Number((budget * 0.35).toFixed(2)), reserve: Number((budget * 0.1).toFixed(2)) } }
  private planType(raw: unknown): GrowthPlanAlternative['campaignType'] { const type = String(raw ?? '').toLowerCase(); return type.includes('cash') || type.includes('返现') ? 'cash_reward' : type.includes('combo') || type.includes('套餐') ? 'combo' : 'discount' }
  private campaignType(type: GrowthPlanAlternative['campaignType']) { return type === 'cash_reward' ? CampaignType.CASH_REWARD : type === 'combo' ? CampaignType.COMBO : CampaignType.DISCOUNT }
  private async audit(manager: any, merchantId: string, actionType: AuditActionType, planId: string, metadata: Record<string, unknown>) { await manager.save(AuditLog, { actorType: 'merchant', actorId: merchantId, actionType, actionDescription: actionType, targetType: 'growth_plan', targetId: planId, metadata, result: 'success' }) }
  private serialize(plan: GrowthPlan, task?: GrowthTask | null) { return { planId: plan.id, title: plan.title, status: plan.status, goalBrief: plan.goalBrief, alternatives: plan.alternatives, selectedOptionId: plan.selectedOptionId ?? null, campaignId: plan.campaignId ?? null, approvedAt: plan.approvedAt ?? null, growthTask: task ? { growthTaskId: task.id, status: task.status, goalMetric: task.goalMetric, baselineValue: Number(task.baselineValue), targetValue: Number(task.targetValue), budget: Number(task.budget), startAt: task.startAt, endAt: task.endAt, storeId: task.storeId ?? null, acceptableRiskBoundary: task.acceptableRiskBoundary ?? null, acceptableRoiBoundary: task.acceptableRoiBoundary == null ? null : Number(task.acceptableRoiBoundary), workItems: plan.status === 'approved' ? [{ type: 'campaign_funding', status: 'pending' }, { type: 'creator_matching', status: 'pending' }, { type: 'attribution_setup', status: 'pending' }] : [] } : null, createdAt: plan.createdAt } }
}
