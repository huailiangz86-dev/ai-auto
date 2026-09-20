import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { AuditActionType, CampaignType, CouponStatus } from '@ai-auto/shared'
import { DataSource, Repository } from 'typeorm'
import { AuditLog } from '../admin/entities/audit-log.entity'
import { AIBridgeService } from '../ai-bridge/ai-bridge.service'
import { Campaign } from '../campaign/entities/campaign.entity'
import { Coupon } from '../campaign/entities/coupon.entity'
import { Store } from '../merchant/entities/store.entity'
import {
  ApproveGrowthPlanDto,
  CreateGrowthPlanDto,
  GrowthIntakeDto,
  ListGrowthPlansDto,
} from './dto/growth-plan.dto'
import { GrowthPlan, GrowthPlanAlternative } from './entities/growth-plan.entity'
import { GROWTH_TASK_TYPE_LABELS, GrowthTask, GrowthTaskType } from './entities/growth-task.entity'

@Injectable()
export class GrowthPlanService {
  constructor(
    @InjectRepository(GrowthPlan) private readonly plans: Repository<GrowthPlan>,
    @InjectRepository(GrowthTask) private readonly tasks: Repository<GrowthTask>,
    @InjectRepository(Store) private readonly stores: Repository<Store>,
    @InjectRepository(Campaign) private readonly campaigns: Repository<Campaign>,
    @InjectRepository(Coupon) private readonly coupons: Repository<Coupon>,
    private readonly ai: AIBridgeService,
    private readonly dataSource: DataSource,
  ) {}

  async create(merchantId: string, dto: CreateGrowthPlanDto) {
    const startAt = new Date(dto.startAt),
      endAt = new Date(dto.endAt)
    if (endAt <= startAt) throw new BadRequestException('增长周期的结束时间必须晚于开始时间')
    if (
      dto.storeId &&
      !(await this.stores.findOne({ where: { id: dto.storeId, merchantId, status: true } }))
    )
      throw new NotFoundException('门店不存在或已停用')
    const taskType = dto.taskType ?? this.inferTaskType(dto.goalBrief)
    const normalizedDto = { ...dto, taskType }
    const alternatives = await this.generateAlternatives(merchantId, normalizedDto)
    return this.dataSource.transaction(async (manager) => {
      const task = await manager.save(
        GrowthTask,
        manager.create(GrowthTask, {
          merchantId,
          storeId: dto.storeId ?? null,
          taskType,
          goalMetric: dto.goalMetric,
          baselineValue: dto.baselineValue ?? 0,
          targetValue: dto.targetValue,
          budget: dto.budget,
          startAt,
          endAt,
          acceptableRiskBoundary: dto.acceptableRiskBoundary ?? null,
          acceptableRoiBoundary: dto.acceptableRoiBoundary ?? null,
          status: 'draft',
          compensationReserved: 0,
          campaignCreditsReserved: 0,
        }),
      )
      const plan = await manager.save(
        GrowthPlan,
        manager.create(GrowthPlan, {
          merchantId,
          growthTaskId: task.id,
          goalBrief: dto.goalBrief,
          title: `${dto.goalMetric}增长计划`,
          status: 'proposed',
          alternatives,
          aiMetadata: {
            source: 'ai_campaign_configure',
            taskType,
            generatedAt: new Date().toISOString(),
          },
        }),
      )
      await this.audit(manager, merchantId, AuditActionType.GROWTH_PLAN_CREATED, plan.id, {
        growthTaskId: task.id,
        goalMetric: dto.goalMetric,
        optionCount: alternatives.length,
      })
      return this.serialize(plan, task)
    })
  }

  async intake(merchantId: string, dto: GrowthIntakeDto) {
    const stores = await this.stores.find({ where: { merchantId, status: true } })
    const current = dto.current ?? {}
    try {
      const response = await this.ai.growthIntake({
        merchant_id: merchantId,
        message: dto.message,
        history: dto.history ?? [],
        current,
        available_stores: stores.map((store) => ({
          id: store.id,
          name: store.storeName,
          code: store.storeCode,
        })),
        language: 'zh-CN',
      })
      return this.normalizeIntake(response, current, stores, dto.message)
    } catch {
      return this.fallbackIntake(dto.message, current, stores)
    }
  }

  async list(merchantId: string, query: ListGrowthPlansDto) {
    const page = query.page ?? 1,
      pageSize = Math.min(query.pageSize ?? 20, 100)
    const [plans, total] = await this.plans.findAndCount({
      where: { merchantId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    })
    const tasks = plans.length
      ? await this.tasks.findByIds(plans.map((item) => item.growthTaskId))
      : []
    const byId = new Map(tasks.map((task) => [task.id, task]))
    const synchronizedPlans = await Promise.all(
      plans.map((plan) => this.ensureApprovedAssets(merchantId, plan)),
    )
    return {
      items: synchronizedPlans.map((plan) => this.serialize(plan, byId.get(plan.growthTaskId))),
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    }
  }

  async get(merchantId: string, planId: string) {
    const plan = await this.ensureApprovedAssets(
      merchantId,
      await this.requirePlan(merchantId, planId),
    )
    const [campaign, coupon] = await Promise.all([
      plan.campaignId
        ? this.campaigns.findOne({ where: { id: plan.campaignId, merchantId } })
        : null,
      plan.couponId ? this.coupons.findOne({ where: { id: plan.couponId, merchantId } }) : null,
    ])
    return this.serialize(
      plan,
      await this.tasks.findOne({ where: { id: plan.growthTaskId, merchantId } }),
      { campaign, coupon },
    )
  }

  async getEntity(merchantId: string, planId: string) {
    return this.requirePlan(merchantId, planId)
  }
  async approve(merchantId: string, planId: string, dto: ApproveGrowthPlanDto) {
    return this.dataSource.transaction(async (manager) => {
      const plan = await manager.findOne(GrowthPlan, { where: { id: planId, merchantId } })
      if (!plan) throw new NotFoundException('增长计划不存在')
      if (plan.status !== 'proposed')
        throw new BadRequestException('该增长计划已处理，不能重复批准')
      const option = plan.alternatives.find((item) => item.optionId === dto.optionId)
      if (!option) throw new BadRequestException('所选方案不存在')
      const task = await manager.findOne(GrowthTask, {
        where: { id: plan.growthTaskId, merchantId },
      })
      if (!task) throw new NotFoundException('关联的 Growth Task 不存在')
      const taskType = option.taskType ?? task.taskType ?? this.inferTaskType(plan.goalBrief)
      task.taskType = taskType
      const campaign = await this.createGrowthCampaign(manager, plan, task, option, taskType)
      // A creator-content task has a consumer-facing conversion asset too.
      // The coupon belongs to the campaign, while every creator task receives
      // its own tracking ID and acts as a distribution entry point.
      const coupon = await this.createGrowthCoupon(manager, plan, task, campaign.id, option)
      task.campaignId = campaign.id
      task.status = 'ready_for_review'
      await manager.save(task)
      plan.status = 'approved'
      plan.selectedOptionId = option.optionId
      plan.approvedAt = new Date()
      plan.approvedBy = merchantId
      plan.campaignId = campaign.id
      plan.couponId = coupon?.id ?? null
      await manager.save(plan)
      await this.audit(manager, merchantId, AuditActionType.GROWTH_PLAN_APPROVED, plan.id, {
        growthTaskId: task.id,
        campaignId: campaign.id,
        couponId: coupon?.id ?? null,
        selectedOptionId: option.optionId,
        taskType,
        generatedWorkItems:
          taskType === 'creator_content'
            ? [
                'campaign_funding',
                'creator_matching',
                'content_distribution',
                'conversion_coupon',
                'attribution_setup',
              ]
            : ['campaign_funding', 'consumer_offer', 'attribution_setup'],
      })
      return this.serialize(plan, task)
    })
  }

  private async requirePlan(merchantId: string, planId: string) {
    const plan = await this.plans.findOne({ where: { id: planId, merchantId } })
    if (!plan) throw new NotFoundException('增长计划不存在')
    return plan
  }

  /**
   * Repair approved plans created before campaign/coupon linking was added.
   * This is intentionally idempotent and runs on reads as a safety net while
   * the historical backfill migration is being rolled out to each environment.
   */
  private async ensureApprovedAssets(merchantId: string, sourcePlan: GrowthPlan) {
    if (sourcePlan.status !== 'approved') return sourcePlan

    return this.dataSource.transaction(async (manager) => {
      const plan = await manager.findOne(GrowthPlan, {
        where: { id: sourcePlan.id, merchantId },
        lock: { mode: 'pessimistic_write' },
      })
      if (!plan || plan.status !== 'approved') return sourcePlan

      const task = await manager.findOne(GrowthTask, {
        where: { id: plan.growthTaskId, merchantId },
      })
      const option = plan.alternatives.find((item) => item.optionId === plan.selectedOptionId)
      if (!task || !option) return plan
      const previousTaskType = task.taskType
      const taskType = option.taskType ?? task.taskType ?? this.inferTaskType(plan.goalBrief)
      task.taskType = taskType

      let campaign = plan.campaignId
        ? await manager.findOne(Campaign, {
            where: { id: plan.campaignId, merchantId },
          })
        : null
      if (!campaign && task.campaignId) {
        campaign = await manager.findOne(Campaign, {
          where: { id: task.campaignId, merchantId },
        })
      }
      if (!campaign)
        campaign = await this.createGrowthCampaign(manager, plan, task, option, taskType)

      if (campaign.purpose !== taskType) {
        campaign.purpose = taskType
        await manager.save(campaign)
      }

      if (task.campaignId !== campaign.id) {
        task.campaignId = campaign.id
        await manager.save(task)
      }

      let coupon: Coupon | null = plan.couponId
        ? await manager.findOne(Coupon, { where: { id: plan.couponId, merchantId } })
        : null
      if (!coupon)
        coupon = await manager.findOne(Coupon, {
          where: { campaignId: campaign.id, merchantId },
        })
      if (!coupon) coupon = await this.createGrowthCoupon(manager, plan, task, campaign.id, option)

      const couponId = coupon?.id ?? null
      if (
        plan.campaignId !== campaign.id ||
        plan.couponId !== couponId ||
        previousTaskType !== taskType
      ) {
        plan.campaignId = campaign.id
        plan.couponId = couponId
        await manager.save(task)
        await manager.save(plan)
      }
      return plan
    })
  }

  private createGrowthCampaign(
    manager: any,
    plan: GrowthPlan,
    task: GrowthTask,
    option: GrowthPlanAlternative,
    taskType: GrowthTaskType = option.taskType ?? task.taskType ?? 'customer_campaign',
  ) {
    return manager.save(
      Campaign,
      manager.create(Campaign, {
        merchantId: plan.merchantId,
        storeId: task.storeId ?? null,
        campaignName: option.title,
        campaignType: this.campaignType(option.campaignType),
        purpose: taskType,
        campaignStatus: 'draft',
        startAt: task.startAt,
        endAt: task.endAt,
        targetAudience: option.targetAudience,
        maxBudget: task.budget,
        frozenBudget: 0,
        spentBudget: 0,
        aiGenerated: true,
        aiDescription: plan.goalBrief,
        description:
          taskType === 'creator_content'
            ? `达人内容引流任务：${option.title}。内容要求：${option.contentBrief ?? plan.goalBrief}。内容通过专属链接引导用户领取活动转化券。${option.creatorStrategy.rationale}`
            : `客户优惠活动：${option.title}。目标人群：${option.targetAudience}。${option.creatorStrategy.rationale}`,
        totalImpressions: 0,
        totalClicks: 0,
        totalClaims: 0,
        totalRedemptions: 0,
        totalCommissionSpent: 0,
      }),
    )
  }

  private createGrowthCoupon(
    manager: any,
    plan: GrowthPlan,
    task: GrowthTask,
    campaignId: string,
    option: GrowthPlanAlternative,
  ) {
    return manager.save(
      Coupon,
      manager.create(Coupon, {
        campaignId,
        merchantId: plan.merchantId,
        couponName: `${option.title}优惠券`,
        couponCode: this.growthCouponCode(plan.id, option.optionId),
        couponType: this.campaignType(option.campaignType),
        thresholdAmount: option.offer.thresholdAmount ?? 0,
        discountAmount: option.offer.discountAmount ?? null,
        cashRewardAmount: option.offer.cashRewardAmount ?? null,
        validFrom: task.startAt,
        validUntil: task.endAt,
        totalStock: null,
        remainingStock: null,
        perCustomerLimit: 1,
        agentRewardAmount: option.offer.agentRewardAmount ?? 0,
        status: CouponStatus.ACTIVE,
        totalIssued: 0,
        totalRedeemed: 0,
        totalCommissionPaid: 0,
      }),
    )
  }

  private normalizeIntake(
    response: any,
    current: Record<string, unknown>,
    stores: Store[],
    message = '',
  ) {
    const raw = response?.extracted ?? response?.data?.extracted ?? {}
    const local = this.parseIntakeMessage(message, current, stores)
    const read = (...keys: string[]) => {
      const fromRaw = keys
        .map((key) => raw[key])
        .find((value) => value !== undefined && value !== null && value !== '')
      if (fromRaw !== undefined) return fromRaw
      const fromMessage = keys
        .map((key) => local[key])
        .find((value) => value !== undefined && value !== null && value !== '')
      if (fromMessage !== undefined) return fromMessage
      return keys
        .map((key) => current[key])
        .find((value) => value !== undefined && value !== null && value !== '')
    }
    const storeScope = this.scopeValue(read('storeScope', 'store_scope'), current)
    const storeId = this.storeIdValue(read('storeId', 'store_id'), stores)
    const storeName = this.storeNameValue(read('storeName', 'store_name'), stores)
    const matchedStore =
      storeScope === 'all'
        ? undefined
        : stores.find((store) => store.id === storeId || store.storeName === storeName)
    const taskType = this.taskTypeValue(read('taskType', 'task_type'), current, message)
    const extracted = {
      goalBrief:
        this.stringValue(read('goalBrief', 'goal_brief')) ??
        this.stringValue(current.goalBrief) ??
        null,
      goalMetric: this.stringValue(read('goalMetric', 'goal_metric')),
      baselineValue: this.numberValue(read('baselineValue', 'baseline_value')),
      targetValue: this.numberValue(read('targetValue', 'target_value')),
      budget: this.numberValue(read('budget')),
      startAt: this.stringValue(read('startAt', 'start_at')),
      endAt: this.stringValue(read('endAt', 'end_at')),
      storeId: storeScope === 'all' ? null : (matchedStore?.id ?? null),
      storeName: storeScope === 'all' ? '全部门店' : (matchedStore?.storeName ?? null),
      storeScope,
      taskType,
      acceptableRoiBoundary: this.numberValue(
        read('acceptableRoiBoundary', 'acceptable_roi_boundary'),
      ),
      acceptableRiskBoundary: this.stringValue(
        read('acceptableRiskBoundary', 'acceptable_risk_boundary'),
      ),
    }
    const missing = this.missingFields(extracted, stores)
    return {
      reply: this.replyFor(response?.reply ?? response?.data?.reply, missing, extracted),
      extracted,
      missing,
      ready: missing.length === 0,
      summary: response?.summary ?? response?.data?.summary ?? {},
    }
  }

  private fallbackIntake(message: string, current: Record<string, unknown>, stores: Store[]) {
    return this.normalizeIntake({}, current, stores, message)
  }

  /**
   * Keep a deterministic local extraction path for short follow-up messages.
   * The AI response remains preferred, but this prevents a provider timeout or
   * a sparse model response from making already supplied information look missing.
   */
  private parseIntakeMessage(
    message: string,
    current: Record<string, unknown>,
    stores: Store[],
  ): Record<string, unknown> {
    const text = message.trim()
    if (!text) return {}

    const hints: Record<string, unknown> = {}
    const hasGoalSignal = /目标|增长|新增|拉新|复购|订单|gmv|核销|新客|客流|营收|销售额|活动/i.test(
      text,
    )
    if (hasGoalSignal) hints.goalBrief = text

    if (/达人|创作者|图文|短视频|内容发布|内容引流|种草|探店/.test(text))
      hints.taskType = 'creator_content'
    else if (/优惠券|发券|满减|折扣|领券|券活动/.test(text)) hints.taskType = 'customer_campaign'

    const metric = this.metricFromText(text)
    if (metric) hints.goalMetric = metric

    const budget = this.parseAmount(
      text,
      this.amountPattern('总预算|预算|投入|花费|成本|最多|花|用|拿|准备'),
    )
    if (budget != null) hints.budget = budget

    const target = this.targetFromText(text, metric)
    if (target != null) hints.targetValue = target

    const dates = this.parseDates(text)
    if (dates.length > 0) {
      if (dates.length >= 2) {
        hints.startAt = dates[0].iso
        hints.endAt = dates[1].iso
      } else if (/结束|截止|到期/.test(text) && !/开始|起始|从/.test(text)) {
        hints.endAt = dates[0].iso
      } else {
        hints.startAt = dates[0].iso
      }
    }

    const duration = this.parseAmount(
      text,
      new RegExp(`(?:活动|持续|连续|做|为期)${this.numberGap()}(${this.numberToken()})\\s*天`),
    )
    const startAt = this.stringValue(hints.startAt ?? current.startAt ?? current.start_at)
    const endAt = this.stringValue(hints.endAt ?? current.endAt ?? current.end_at)
    if (duration != null && startAt && !endAt) {
      const start = new Date(startAt)
      if (!Number.isNaN(start.getTime())) {
        start.setDate(start.getDate() + Math.max(duration - 1, 0))
        start.setHours(23, 59, 59, 0)
        hints.endAt = this.toShanghaiIso(start)
      }
    }

    const matchedStore = stores.find((store) => text.includes(store.storeName))
    if (matchedStore) {
      hints.storeId = matchedStore.id
      hints.storeName = matchedStore.storeName
      hints.storeScope = 'specific'
    } else if (/全部门店|所有门店|全店|各门店|全门店/.test(text)) {
      hints.storeId = null
      hints.storeName = '全部门店'
      hints.storeScope = 'all'
    }

    return hints
  }

  private metricFromText(text: string): string | null {
    if (/新客|新增客户|拉新|到店新客/.test(text)) return '新增到店核销数'
    if (/复购|回购/.test(text)) return '复购订单数'
    if (/GMV|销售额|营收|订单额|成交额/.test(text)) return '新增 GMV'
    if (/订单|下单/.test(text)) return '新增订单数'
    if (/核销/.test(text)) return '新增到店核销数'
    return null
  }

  private targetFromText(text: string, metric: string | null): number | null {
    const patterns: RegExp[] = []
    if (metric === '新增到店核销数') {
      patterns.push(
        this.amountPattern('新增客户|新客|客户|拉新|到店新客', '人|位|个'),
        this.amountPattern('新增|达到|目标|获取|带来'),
      )
    } else if (metric === '新增 GMV') {
      patterns.push(this.amountPattern('GMV|销售额|营收|订单额|成交额', '万|千|百|亿|元'))
    } else if (metric) {
      patterns.push(
        this.amountPattern('新增|订单|下单|达到|目标|获取|带来', '万|千|百|亿|单|笔|个'),
      )
    }
    patterns.push(this.amountPattern('新增|达到|目标|获取|带来|提升至|做到'))
    for (const pattern of patterns) {
      const value = this.parseAmount(text, pattern)
      if (value != null) return value
    }
    return null
  }

  private amountPattern(prefixes: string, units = '万|千|百|亿|人|位|个|单|笔|元'): RegExp {
    return new RegExp(
      `(?:${prefixes})${this.numberGap()}(${this.numberToken()})\\s*(${units})?`,
      'i',
    )
  }

  private numberToken() {
    return '(?:\\d+(?:\\.\\d+)?|[零〇一二两三四五六七八九十百千万亿]+)'
  }

  private numberGap() {
    return '[^0-9零〇一二两三四五六七八九十百千万亿]{0,12}'
  }

  private parseDates(text: string): { iso: string; year: number; month: number; day: number }[] {
    const token = '[0-9零〇一二两三四五六七八九十]{1,4}'
    const pattern = new RegExp(
      `(?:(20\\d{2})\\s*[年/-])?(${token})\\s*[月/-]\\s*(${token})\\s*日?(?:\\s*(${token})\\s*[点时](?:\\s*(${token})\\s*分?)?)?`,
      'g',
    )
    const baseYear = new Date().getFullYear()
    return [...text.matchAll(pattern)].flatMap((match) => {
      const year = match[1] ? Number(match[1]) : baseYear
      const month = this.parseIntegerToken(match[2])
      const day = this.parseIntegerToken(match[3])
      const hour = match[4] ? this.parseIntegerToken(match[4]) : null
      const minute = match[5] ? this.parseIntegerToken(match[5]) : 0
      if (!month || !day || month > 12 || day > 31) return []
      const date = new Date(
        `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour ?? 0).padStart(2, '0')}:${String(minute ?? 0).padStart(2, '0')}:00+08:00`,
      )
      if (Number.isNaN(date.getTime())) return []
      if (!hour && /截止|结束|到期/.test(text)) date.setHours(23, 59, 59, 0)
      return [{ iso: this.toShanghaiIso(date), year, month, day }]
    })
  }

  private parseIntegerToken(value: string): number {
    if (/^\d+(?:\.\d+)?$/.test(value)) return Number(value)
    const digits: Record<string, number> = {
      零: 0,
      〇: 0,
      一: 1,
      二: 2,
      两: 2,
      三: 3,
      四: 4,
      五: 5,
      六: 6,
      七: 7,
      八: 8,
      九: 9,
    }
    const smallUnits: Record<string, number> = { 十: 10, 百: 100, 千: 1000 }
    const largeUnits: Record<string, number> = { 万: 10000, 亿: 100000000 }
    let total = 0
    let section = 0
    let number = 0
    for (const char of value) {
      if (digits[char] !== undefined) {
        number = digits[char]
      } else if (smallUnits[char]) {
        section += (number || 1) * smallUnits[char]
        number = 0
      } else if (largeUnits[char]) {
        section += number
        total += (section || 1) * largeUnits[char]
        section = 0
        number = 0
      }
    }
    return total + section + number
  }

  private toShanghaiIso(date: Date) {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hour = String(date.getHours()).padStart(2, '0')
    const minute = String(date.getMinutes()).padStart(2, '0')
    const second = String(date.getSeconds()).padStart(2, '0')
    return `${year}-${month}-${day}T${hour}:${minute}:${second}+08:00`
  }

  private missingFields(extracted: any, stores: Store[]) {
    const missing = ['goalBrief', 'goalMetric', 'targetValue', 'budget', 'startAt', 'endAt'].filter(
      (key) => extracted[key] == null || extracted[key] === '',
    )
    if (stores.length > 0 && !extracted.storeId && extracted.storeScope !== 'all')
      missing.push('store_id')
    return missing.map(
      (key) =>
        (
          ({
            goalBrief: 'goal_brief',
            goalMetric: 'goal_metric',
            targetValue: 'target_value',
            budget: 'budget',
            startAt: 'start_at',
            endAt: 'end_at',
            storeId: 'store_id',
          }) as Record<string, string>
        )[key] ?? key,
    )
  }

  private replyFor(reply: unknown, missing: string[], extracted: any) {
    const labels: Record<string, string> = {
      goal_brief: '完整增长目标',
      goal_metric: '增长指标',
      target_value: '目标值',
      budget: '总预算',
      start_at: '开始时间',
      end_at: '结束时间',
      store_id: '适用门店（或说明全部门店）',
    }
    const text = typeof reply === 'string' ? reply.trim() : ''
    const genericFailure =
      /无法识别|未能识别|没有成功识别|没识别成功|识别不出来|识别不出|识别失败|请换一种说法|请重新描述|无法提取|不太理解/.test(
        text,
      )
    if (missing.length) {
      const missingText = missing.map((key) => labels[key] ?? key).join('、')
      const hasCompleteMissingPrompt =
        !genericFailure &&
        (text.includes('还需要') || text.includes('缺少') || text.includes('补充')) &&
        missing.every((key) => text.includes(labels[key] ?? key))
      if (hasCompleteMissingPrompt)
        return `${text}${/[。！？.!?]$/.test(text) ? '' : '。'}你可以只补充上面这些内容，不需要重新开始。`
      const acknowledgement =
        genericFailure || !text ? '我已保留之前识别的内容，本轮没有新增可确认信息。' : text
      return `${acknowledgement}${/[。！？.!?]$/.test(acknowledgement) ? '' : '。'}还需要补充：${missingText}。你可以只补充这些内容，不需要重新开始。`
    }
    const baseline = extracted.baselineValue == null ? '未提供' : `${extracted.baselineValue}`
    const targetDelta =
      extracted.baselineValue == null
        ? '待结合当前基线计算'
        : `${Math.max(extracted.targetValue - extracted.baselineValue, 0)}`
    const store = extracted.storeScope === 'all' ? '全部门店' : extracted.storeName || '已确认门店'
    const optional = [
      extracted.acceptableRoiBoundary == null ? '' : `最低 ROI ${extracted.acceptableRoiBoundary}`,
      extracted.acceptableRiskBoundary ? `风险边界：${extracted.acceptableRiskBoundary}` : '',
    ]
      .filter(Boolean)
      .join('；')
    const taskType = extracted.taskType ?? 'customer_campaign'
    return `信息已经齐全。我识别到：任务类型 ${GROWTH_TASK_TYPE_LABELS[taskType as GrowthTaskType]}；目标“${extracted.goalBrief || extracted.goalMetric}”；增长指标 ${extracted.goalMetric}；当前基线 ${baseline}；目标值 ${extracted.targetValue}；本期目标增量 ${targetDelta}；总预算 ¥${extracted.budget}；适用门店 ${store}；时间 ${extracted.startAt} 至 ${extracted.endAt}${optional ? `；${optional}` : ''}。请确认后生成增长方案。`
  }

  private parseAmount(text: string, pattern: RegExp) {
    const match = text.match(pattern)
    if (!match) return null
    const value = this.parseIntegerToken(match[1])
    const unit = match[2]
    if (/[万亿千百]/.test(match[1])) return value
    return unit === '亿'
      ? value * 100000000
      : unit === '万'
        ? value * 10000
        : unit === '千'
          ? value * 1000
          : unit === '百'
            ? value * 100
            : value
  }
  private stringValue(value: unknown) {
    return typeof value === 'string' && value.trim() ? value.trim() : null
  }

  private taskTypeValue(
    value: unknown,
    current: Record<string, unknown>,
    message: string,
  ): GrowthTaskType {
    if (value === 'creator_content' || value === 'customer_campaign') return value
    const currentValue = current.taskType ?? current.task_type
    if (currentValue === 'creator_content' || currentValue === 'customer_campaign')
      return currentValue
    return this.inferTaskType(message)
  }

  private inferTaskType(text: string): GrowthTaskType {
    return /达人|创作者|图文|短视频|内容发布|内容引流|种草|探店/.test(text)
      ? 'creator_content'
      : 'customer_campaign'
  }
  private numberValue(value: unknown) {
    return value === null || value === undefined || value === '' || Number.isNaN(Number(value))
      ? null
      : Number(value)
  }
  private storeIdValue(value: unknown, stores: Store[]) {
    return typeof value === 'string' && stores.some((store) => store.id === value) ? value : null
  }
  private storeNameValue(value: unknown, stores: Store[]) {
    return typeof value === 'string' && stores.some((store) => store.storeName === value)
      ? value
      : null
  }
  private scopeValue(value: unknown, current: Record<string, unknown>) {
    const currentScope = current.storeScope ?? current.store_scope
    return value === 'all' || currentScope === 'all'
      ? 'all'
      : value === 'specific' || currentScope === 'specific'
        ? 'specific'
        : null
  }

  private async generateAlternatives(
    merchantId: string,
    dto: CreateGrowthPlanDto,
  ): Promise<GrowthPlanAlternative[]> {
    try {
      const response = await this.ai.configureCampaign({
        description: dto.goalBrief,
        merchant_id: merchantId,
        store_id: dto.storeId,
        language: 'zh-CN',
        growth_context: {
          goal_metric: dto.goalMetric,
          task_type: dto.taskType,
          baseline_value: dto.baselineValue ?? null,
          baseline_provided: dto.baselineValue !== undefined,
          target_value: dto.targetValue,
          target_delta:
            dto.baselineValue === undefined
              ? null
              : Math.max(dto.targetValue - dto.baselineValue, 0),
          budget: dto.budget,
          start_at: dto.startAt,
          end_at: dto.endAt,
          store_id: dto.storeId ?? null,
          acceptable_roi_boundary: dto.acceptableRoiBoundary ?? null,
          acceptable_risk_boundary: dto.acceptableRiskBoundary ?? null,
        },
      })
      const options = response?.options ?? response?.data?.options ?? []
      if (Array.isArray(options) && options.length >= 3)
        return options
          .slice(0, 3)
          .map((option: any, index: number) => this.toAlternative(option, index + 1, dto))
    } catch {
      /* pilot fallback remains explicitly reviewable */
    }
    return [1, 2, 3].map((optionId) => this.fallback(optionId, dto))
  }

  private toAlternative(raw: any, index: number, dto: CreateGrowthPlanDto): GrowthPlanAlternative {
    const budget = Number(raw.budget) > 0 ? Math.min(Number(raw.budget), dto.budget) : dto.budget
    const taskType =
      dto.taskType ?? this.alternativeTaskType(raw.task_type ?? raw.taskType, dto.goalBrief)
    const likely = Math.max(
      1,
      Math.round((dto.targetValue - (dto.baselineValue ?? 0)) * [0.7, 0.9, 1][index - 1]),
    )
    return {
      optionId: Number(raw.option_id) || index,
      title:
        raw.title ||
        (taskType === 'creator_content'
          ? ['稳健内容引流方案', '均衡内容引流方案', '扩张内容引流方案'][index - 1]
          : ['稳健拉新方案', '均衡增长方案', '扩张验证方案'][index - 1]),
      taskType,
      campaignType: this.planType(raw.campaign_type),
      offer: {
        thresholdAmount: Number(raw.min_purchase) || 0,
        discountAmount: raw.discount_amount == null ? undefined : Number(raw.discount_amount),
        cashRewardAmount: raw.cash_reward == null ? undefined : Number(raw.cash_reward),
        agentRewardAmount:
          raw.agent_reward == null && raw.agentRewardAmount == null
            ? Math.max(1, Number(((budget * 0.1) / likely).toFixed(2)))
            : Number(raw.agent_reward ?? raw.agentRewardAmount),
      },
      targetAudience: raw.target_audience || '新客',
      creatorStrategy: this.creatorStrategy(index),
      contentBrief:
        taskType === 'creator_content'
          ? raw.content_brief ||
            `围绕“${dto.goalBrief}”完成${this.creatorStrategy(index).contentTypes.join(' / ')}内容，突出门店体验、优惠入口和到店行动。`
          : undefined,
      creatorDeliverables:
        taskType === 'creator_content'
          ? {
              contentTypes: raw.content_types || this.creatorStrategy(index).contentTypes,
              channels: raw.channels || this.creatorStrategy(index).channels,
              callToAction: raw.call_to_action || '通过专属链接引导用户了解活动并到店转化',
            }
          : undefined,
      budgetAllocation: this.allocation(budget, taskType),
      expectedOutcome: {
        metric: dto.goalMetric,
        low: Math.max(1, Math.round(likely * 0.7)),
        likely,
        high: Math.round(likely * 1.25),
        expectedRoi: Number((1 + index * 0.2).toFixed(2)),
      },
      assumptions: [
        raw.description || '基于历史同类活动与本地创作者供给的估算。',
        '结果需经可追溯的核销或订单证据验证。',
        '商户批准前不会创建活动或向创作者发布任务。',
      ],
    }
  }

  private fallback(index: number, dto: CreateGrowthPlanDto): GrowthPlanAlternative {
    return this.toAlternative(
      {
        option_id: index,
        campaign_type: 'DISCOUNT',
        min_purchase: 100,
        discount_amount: [10, 20, 30][index - 1],
        target_audience: index === 1 ? '新客' : index === 2 ? '新客与沉默用户' : '高潜本地客群',
        budget: dto.budget * [0.7, 0.9, 1][index - 1],
        description: 'AI 服务暂不可用，已提供基于预算与目标的保守测算。',
      },
      index,
      dto,
    )
  }

  private creatorStrategy(index: number) {
    return {
      channels: index === 3 ? ['douyin', 'xiaohongshu', 'wechat_video'] : ['douyin', 'xiaohongshu'],
      recommendedCreatorCount: [3, 5, 8][index - 1],
      contentTypes: ['short_video', 'graphic'],
      rationale:
        '根据门店范围、内容品类与创作者 Growth Score 分层匹配；发布后通过专属链接追踪引流结果。',
    }
  }
  private allocation(budget: number, taskType: GrowthTaskType = 'customer_campaign') {
    const offerCost = taskType === 'creator_content' ? budget * 0.2 : budget * 0.35
    return {
      creatorPayout: Number((budget * (taskType === 'creator_content' ? 0.55 : 0.45)).toFixed(2)),
      campaignCredits: Number((budget * (taskType === 'creator_content' ? 0.15 : 0.1)).toFixed(2)),
      offerCost: Number(offerCost.toFixed(2)),
      reserve: Number((budget * (taskType === 'creator_content' ? 0.1 : 0.1)).toFixed(2)),
    }
  }
  private planType(raw: unknown): GrowthPlanAlternative['campaignType'] {
    const type = String(raw ?? '').toLowerCase()
    return type.includes('cash') || type.includes('返现')
      ? 'cash_reward'
      : type.includes('combo') || type.includes('套餐')
        ? 'combo'
        : 'discount'
  }

  private alternativeTaskType(raw: unknown, goalBrief: string): GrowthTaskType {
    if (raw === 'creator_content' || raw === 'creator' || raw === 'content')
      return 'creator_content'
    if (raw === 'customer_campaign' || raw === 'customer' || raw === 'offer')
      return 'customer_campaign'
    return this.inferTaskType(goalBrief)
  }
  private campaignType(type: GrowthPlanAlternative['campaignType']) {
    return type === 'cash_reward'
      ? CampaignType.CASH_REWARD
      : type === 'combo'
        ? CampaignType.COMBO
        : CampaignType.DISCOUNT
  }
  private async audit(
    manager: any,
    merchantId: string,
    actionType: AuditActionType,
    planId: string,
    metadata: Record<string, unknown>,
  ) {
    await manager.save(AuditLog, {
      actorType: 'merchant',
      actorId: merchantId,
      actionType,
      actionDescription: actionType,
      targetType: 'growth_plan',
      targetId: planId,
      metadata,
      result: 'success',
    })
  }
  private serialize(
    plan: GrowthPlan,
    task?: GrowthTask | null,
    assets?: { campaign: Campaign | null; coupon: Coupon | null },
  ) {
    const selectedAlternative = plan.alternatives.find(
      (item) => item.optionId === plan.selectedOptionId,
    )
    const taskType =
      task?.taskType ?? selectedAlternative?.taskType ?? this.inferTaskType(plan.goalBrief)
    return {
      planId: plan.id,
      title: plan.title,
      status: plan.status,
      goalBrief: plan.goalBrief,
      taskType,
      taskTypeLabel: GROWTH_TASK_TYPE_LABELS[taskType],
      alternatives: plan.alternatives,
      selectedOptionId: plan.selectedOptionId ?? null,
      campaignId: plan.campaignId ?? null,
      couponId: plan.couponId ?? null,
      linkedAssets: assets
        ? {
            campaign: assets.campaign
              ? { campaignId: assets.campaign.id, campaignName: assets.campaign.campaignName }
              : null,
            coupon: assets.coupon
              ? {
                  couponId: assets.coupon.id,
                  couponName: assets.coupon.couponName,
                  couponCode: assets.coupon.couponCode,
                }
              : null,
          }
        : undefined,
      approvedAt: plan.approvedAt ?? null,
      growthTask: task
        ? {
            growthTaskId: task.id,
            status: task.status,
            goalMetric: task.goalMetric,
            baselineValue: Number(task.baselineValue),
            targetValue: Number(task.targetValue),
            budget: Number(task.budget),
            startAt: task.startAt,
            endAt: task.endAt,
            taskType,
            storeId: task.storeId ?? null,
            acceptableRiskBoundary: task.acceptableRiskBoundary ?? null,
            acceptableRoiBoundary:
              task.acceptableRoiBoundary == null ? null : Number(task.acceptableRoiBoundary),
            contentBrief:
              selectedAlternative?.contentBrief ??
              (taskType === 'creator_content' ? plan.goalBrief : null),
            creatorDeliverables:
              selectedAlternative?.creatorDeliverables ??
              (taskType === 'creator_content'
                ? {
                    contentTypes: selectedAlternative?.creatorStrategy.contentTypes ?? [],
                    channels: selectedAlternative?.creatorStrategy.channels ?? [],
                    callToAction: '通过专属链接引导用户了解活动并到店转化',
                  }
                : null),
            workItems:
              plan.status === 'approved'
                ? task.taskType === 'creator_content'
                  ? [
                      { type: 'campaign_funding', status: 'pending' },
                      { type: 'creator_matching', status: 'pending' },
                      { type: 'content_distribution', status: 'pending' },
                      { type: 'conversion_coupon', status: 'pending' },
                      { type: 'attribution_setup', status: 'pending' },
                    ]
                  : [
                      { type: 'campaign_funding', status: 'pending' },
                      { type: 'consumer_offer', status: 'pending' },
                      { type: 'attribution_setup', status: 'pending' },
                    ]
                : [],
          }
        : null,
      createdAt: plan.createdAt,
    }
  }

  private growthCouponCode(planId: string, optionId: number) {
    return `GP-${String(planId ?? 'PLAN')
      .replace(/-/g, '')
      .slice(0, 16)
      .toUpperCase()}-${optionId}`
  }
}
