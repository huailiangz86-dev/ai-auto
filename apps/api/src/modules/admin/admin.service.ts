// ============================================================
// AI auto - Admin Service
// Platform operations: merchant/agent audit, fraud, finance
// ============================================================

import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository, DataSource, In, Not } from 'typeorm'

import { Merchant } from '../merchant/entities/merchant.entity'
import { Store } from '../merchant/entities/store.entity'
import { Subscription } from '../merchant/entities/subscription.entity'
import { SharingAgent } from '../agent/entities/sharing-agent.entity'
import { AuditLog } from './entities/audit-log.entity'
import { FraudAlert } from './entities/fraud-alert.entity'
import { Redemption } from '../commission/entities/redemption.entity'
import { Commission } from '../commission/entities/commission.entity'
import { PlatformRevenue } from '../merchant/entities/platform-revenue.entity'
import { Content } from '../content/entities/content.entity'
import { CreatorTask } from '../task/entities/growth-task.entity'
import { MerchantAgentBinding } from '../merchant/entities/merchant-agent-binding.entity'
import { Notification } from '../notification/entities/notification.entity'
import { AuditStatus, AuditActionType, SubscriptionStatus, UserRole } from '@ai-auto/shared'
import { RedemptionStatus } from '@ai-auto/shared'

import {
  ApproveMerchantDto,
  RejectMerchantDto,
  SuspendAgentDto,
  ListPendingMerchantsDto,
  ListPendingAgentsDto,
} from './dto/admin-audit.dto'
import { DashboardQueryDto } from './dto/dashboard.dto'
import { BlacklistCreatorDto, SetCreatorGrowthScoreDto } from './dto/admin-audit.dto'
import { calculateCreatorGrowthScore } from '../agent/creator-growth-score'

interface DashboardScope {
  merchantId?: string
  agentId?: string
}

interface AdminActor {
  id: string
  name?: string | null
}
const SYSTEM_ACTOR: AdminActor = { id: '00000000-0000-0000-0000-000000000000', name: '系统' }

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name)

  constructor(
    @InjectRepository(Merchant)
    private readonly merchantRepo: Repository<Merchant>,
    @InjectRepository(Store)
    private readonly storeRepo: Repository<Store>,
    @InjectRepository(Subscription)
    private readonly subscriptionRepo: Repository<Subscription>,
    @InjectRepository(SharingAgent)
    private readonly agentRepo: Repository<SharingAgent>,
    @InjectRepository(AuditLog)
    private readonly auditLogRepo: Repository<AuditLog>,
    @InjectRepository(FraudAlert)
    private readonly fraudAlertRepo: Repository<FraudAlert>,
    @InjectRepository(Redemption)
    private readonly redemptionRepo: Repository<Redemption>,
    @InjectRepository(Commission)
    private readonly commissionRepo: Repository<Commission>,
    @InjectRepository(PlatformRevenue)
    private readonly platformRevenueRepo: Repository<PlatformRevenue>,
    @InjectRepository(Content)
    private readonly contentRepo: Repository<Content>,
    @InjectRepository(MerchantAgentBinding)
    private readonly merchantAgentBindingRepo: Repository<MerchantAgentBinding>,
    private readonly dataSource: DataSource,
  ) {}

  // ========================
  // 运营大屏
  // ========================

  /**
   * Returns a single coherent dashboard snapshot. KPI queries are live against
   * the operational store; clients can poll this endpoint for the requested
   * real-time refresh while trend data remains daily-granularity.
   */
  async getDashboard(query: DashboardQueryDto = {}) {
    const dateKey = query.date ?? this.currentShanghaiDateKey()
    const day = this.parseDashboardDay(dateKey)
    const nextDay = this.addDays(day, 1)
    const monthStart = this.parseDashboardDay(`${dateKey.slice(0, 7)}-01`)
    const trendDays = query.trendDays ?? 14
    const trendStart = this.addDays(day, -(trendDays - 1))
    const scope = { merchantId: query.merchantId, agentId: query.agentId }

    const [today, total, monthly, trends, alerts, pendingActions] = await Promise.all([
      this.getTodayMetrics(day, nextDay, scope),
      this.getTotalMetrics(scope),
      this.getMonthlyStats(monthStart, nextDay, scope),
      this.getTrendMetrics(trendStart, nextDay, trendDays, scope),
      this.getAlertSummary(day, nextDay, scope),
      this.getPendingActions(),
    ])

    return {
      generatedAt: new Date(),
      date: dateKey,
      scope: {
        level: query.agentId ? 'agent' : query.merchantId ? 'merchant' : 'platform',
        merchantId: query.merchantId ?? null,
        agentId: query.agentId ?? null,
      },
      today,
      total,
      monthly,
      trends,
      alerts,
      pendingActions,
      refresh: { kpiSeconds: 10, detail: 'daily' },
    }
  }

  /**
   * Returns the agents actually bound to a merchant so the dashboard can
   * narrow platform -> merchant -> agent without relying on a manually copied
   * agent identifier.
   */
  async listDashboardAgents(merchantId: string) {
    const bindings = await this.merchantAgentBindingRepo.find({
      where: { merchantId, bindingStatus: 'active' },
      select: ['agentId'],
    })
    const agentIds = [
      ...new Set(bindings.flatMap((binding) => (binding.agentId ? [binding.agentId] : []))),
    ]
    if (agentIds.length === 0) return []

    const agents = await this.agentRepo.find({
      where: { id: In(agentIds), status: true },
      select: ['id', 'nickname', 'phone'],
      order: { createdAt: 'DESC' },
    })
    return agents.map((agent) => ({
      id: agent.id,
      nickname: agent.nickname,
      phone: this.maskPhone(agent.phone),
    }))
  }

  private async getTodayMetrics(start: Date, end: Date, scope: DashboardScope) {
    const [newMerchants, activeAgents, redemptionSummary, revenueSummary, commissionSummary] =
      await Promise.all([
        this.countMerchantsCreated(start, end, scope.merchantId),
        this.countActiveAgents(start, end, scope),
        this.sumRedemptions(start, end, scope),
        this.sumRevenue(start, end, scope),
        this.sumCommissions(start, end, scope),
      ])

    return {
      newMerchants,
      activeAgents,
      redemptions: redemptionSummary.count,
      gmv: redemptionSummary.amount,
      platformRevenue: revenueSummary,
      commissionPayout: commissionSummary,
    }
  }

  private async getTotalMetrics(scope: DashboardScope) {
    const [merchants, agents, redemptionSummary, revenue] = await Promise.all([
      this.countMerchants(scope.merchantId),
      this.countAgents(scope),
      this.sumRedemptions(undefined, undefined, scope),
      this.sumRevenue(undefined, undefined, scope),
    ])

    return {
      merchants,
      agents,
      cumulativeGmv: redemptionSummary.amount,
      cumulativeRevenue: revenue,
    }
  }

  private async getMonthlyStats(start: Date, end: Date, scope: DashboardScope) {
    const [newMerchants, newAgents, subscriptions] = await Promise.all([
      this.countMerchantsCreated(start, end, scope.merchantId),
      this.countAgentsCreated(start, end, scope),
      this.subscriptionRepo.find({
        where: scope.merchantId ? { merchantId: scope.merchantId } : {},
        select: ['id', 'status', 'autoRenew'],
      }),
    ])
    const activeSubscriptions = subscriptions.filter((s) => s.status === SubscriptionStatus.ACTIVE)
    const renewalRate =
      activeSubscriptions.length === 0
        ? 0
        : this.toRatio(
            activeSubscriptions.filter((s) => s.autoRenew).length,
            activeSubscriptions.length,
          )

    const totalAgents = await this.countAgents(scope)
    const activeAgents = await this.countActiveAgents(start, end, scope)

    return {
      newMerchants,
      newAgents,
      subscriptionRenewalRate: renewalRate,
      agentRetentionRate: this.toRatio(activeAgents, totalAgents),
    }
  }

  private async getTrendMetrics(start: Date, end: Date, days: number, scope: DashboardScope) {
    const [gmv, agentGrowth, commission, merchantRetention] = await Promise.all([
      this.dailyRedemptionTrend(start, end, days, scope),
      this.dailyAgentGrowthTrend(start, end, days, scope),
      this.dailyCommissionTrend(start, end, days, scope),
      this.dailyMerchantRetentionTrend(start, days, scope.merchantId),
    ])

    return { gmv, agentGrowth, commissionPayout: commission, merchantRetention }
  }

  private async getAlertSummary(start: Date, end: Date, scope: DashboardScope) {
    const fraudWhere: Record<string, unknown> = { status: 'pending' }
    if (scope.merchantId) fraudWhere.merchantId = scope.merchantId
    if (scope.agentId) fraudWhere.agentId = scope.agentId
    const [critical, warning, notice, recent] = await Promise.all([
      this.fraudAlertRepo.count({ where: { ...fraudWhere, severity: 'critical' } }),
      this.fraudAlertRepo.count({ where: { ...fraudWhere, severity: 'warning' } }),
      this.fraudAlertRepo.count({ where: { ...fraudWhere, severity: 'notice' } }),
      this.fraudAlertRepo.find({
        where: fraudWhere,
        order: { createdAt: 'DESC' },
        take: 10,
      }),
    ])
    const paymentFailures = await this.subscriptionRepo.count({
      where: { status: SubscriptionStatus.EXPIRED },
    })

    return {
      summary: { critical, warning, notice, paymentFailures, systemErrors: 0 },
      items: recent.map((alert) => ({
        id: alert.id,
        category: 'fraud',
        type: alert.alertType,
        severity: alert.severity,
        status: alert.status,
        occurredAt: alert.createdAt,
        evidence: alert.evidence,
      })),
      window: { start, end },
    }
  }

  private async getPendingActions() {
    const [fraud, merchants, agents, contents] = await Promise.all([
      this.fraudAlertRepo.count({ where: { status: 'pending' } }),
      this.merchantRepo.count({ where: { auditStatus: AuditStatus.PENDING } }),
      this.agentRepo.count({ where: { auditStatus: AuditStatus.PENDING } }),
      this.contentRepo.count({ where: { moderationStatus: 'pending' } }),
    ])
    return [
      { type: 'fraud_alert', count: fraud, action: 'review_fraud_alerts' },
      { type: 'merchant_audit', count: merchants, action: 'review_merchants' },
      { type: 'agent_audit', count: agents, action: 'review_agents' },
      { type: 'content_moderation', count: contents, action: 'review_contents' },
    ]
  }

  private async countMerchantsCreated(start: Date, end: Date, merchantId?: string) {
    const qb = this.merchantRepo
      .createQueryBuilder('m')
      .where('m."createdAt" >= :start AND m."createdAt" < :end', { start, end })
    if (merchantId) qb.andWhere('m.id = :merchantId', { merchantId })
    return qb.getCount()
  }

  private async countMerchants(merchantId?: string) {
    return this.merchantRepo.count({ where: merchantId ? { id: merchantId } : {} })
  }

  private async countAgentsCreated(start: Date, end: Date, scope: DashboardScope) {
    const qb = this.agentRepo
      .createQueryBuilder('a')
      .where('a."createdAt" >= :start AND a."createdAt" < :end', { start, end })
      .andWhere('a.status = true')
    if (scope.agentId) qb.andWhere('a.id = :agentId', { agentId: scope.agentId })
    return qb.getCount()
  }

  private async countAgents(scope: DashboardScope) {
    const qb = this.agentRepo.createQueryBuilder('a').where('a.status = true')
    if (scope.agentId) qb.andWhere('a.id = :agentId', { agentId: scope.agentId })
    return qb.getCount()
  }

  private async countActiveAgents(start: Date, end: Date, scope: DashboardScope) {
    const qb = this.redemptionRepo
      .createQueryBuilder('r')
      .innerJoin(Commission, 'c', 'c.redemption_id = r.id')
      .select('COUNT(DISTINCT c.agent_id)', 'count')
      .where('r.status = :status', { status: RedemptionStatus.VERIFIED })
      .andWhere('r."createdAt" >= :start AND r."createdAt" < :end', { start, end })
    this.applyTransactionScope(qb, 'r', 'c', scope)
    const raw = await qb.getRawOne<{ count: string }>()
    return Number(raw?.count ?? 0)
  }

  private async sumRedemptions(
    start: Date | undefined,
    end: Date | undefined,
    scope: DashboardScope,
  ) {
    const qb = this.redemptionRepo
      .createQueryBuilder('r')
      .select('COUNT(*)', 'count')
      .addSelect('COALESCE(SUM(r.transaction_amount), 0)', 'amount')
      .where('r.status = :status', { status: RedemptionStatus.VERIFIED })
    if (start && end)
      qb.andWhere('r."createdAt" >= :start AND r."createdAt" < :end', { start, end })
    if (scope.merchantId)
      qb.andWhere('r.merchant_id = :merchantId', { merchantId: scope.merchantId })
    if (scope.agentId) {
      qb.innerJoin(Commission, 'c', 'c.redemption_id = r.id').andWhere('c.agent_id = :agentId', {
        agentId: scope.agentId,
      })
    }
    const raw = await qb.getRawOne<{ count: string; amount: string }>()
    return { count: Number(raw?.count ?? 0), amount: Number(raw?.amount ?? 0) }
  }

  private async sumRevenue(start: Date | undefined, end: Date | undefined, scope: DashboardScope) {
    const qb = this.platformRevenueRepo
      .createQueryBuilder('p')
      .select('COALESCE(SUM(p.amount), 0)', 'amount')
    if (start && end) qb.where('p.revenue_date >= :start AND p.revenue_date < :end', { start, end })
    if (scope.merchantId)
      qb.andWhere('p.merchant_id = :merchantId', { merchantId: scope.merchantId })
    if (scope.agentId) qb.andWhere('p.agent_id = :agentId', { agentId: scope.agentId })
    const raw = await qb.getRawOne<{ amount: string }>()
    return Number(raw?.amount ?? 0)
  }

  private async sumCommissions(start: Date, end: Date, scope: DashboardScope) {
    const qb = this.commissionRepo
      .createQueryBuilder('c')
      .select('COALESCE(SUM(c.agent_final_payout), 0)', 'amount')
      .where('c."createdAt" >= :start AND c."createdAt" < :end', { start, end })
      .andWhere('c.status IN (:...statuses)', { statuses: ['pending', 'settled'] })
    if (scope.merchantId)
      qb.andWhere('c.merchant_id = :merchantId', { merchantId: scope.merchantId })
    if (scope.agentId) qb.andWhere('c.agent_id = :agentId', { agentId: scope.agentId })
    const raw = await qb.getRawOne<{ amount: string }>()
    return Number(raw?.amount ?? 0)
  }

  private async dailyRedemptionTrend(start: Date, end: Date, days: number, scope: DashboardScope) {
    const qb = this.redemptionRepo
      .createQueryBuilder('r')
      .select("TO_CHAR(r.\"createdAt\" AT TIME ZONE 'Asia/Shanghai', 'YYYY-MM-DD')", 'date')
      .addSelect('COALESCE(SUM(r.transaction_amount), 0)', 'value')
      .where('r.status = :status', { status: RedemptionStatus.VERIFIED })
      .andWhere('r."createdAt" >= :start AND r."createdAt" < :end', { start, end })
      .groupBy("TO_CHAR(r.\"createdAt\" AT TIME ZONE 'Asia/Shanghai', 'YYYY-MM-DD')")
    if (scope.merchantId)
      qb.andWhere('r.merchant_id = :merchantId', { merchantId: scope.merchantId })
    if (scope.agentId) {
      qb.innerJoin(Commission, 'c', 'c.redemption_id = r.id').andWhere('c.agent_id = :agentId', {
        agentId: scope.agentId,
      })
    }
    return this.fillTrend(start, days, await qb.getRawMany())
  }

  private async dailyAgentGrowthTrend(start: Date, end: Date, days: number, scope: DashboardScope) {
    const qb = this.agentRepo
      .createQueryBuilder('a')
      .select("TO_CHAR(a.\"createdAt\" AT TIME ZONE 'Asia/Shanghai', 'YYYY-MM-DD')", 'date')
      .addSelect('COUNT(*)', 'value')
      .where('a.status = true')
      .andWhere('a."createdAt" >= :start AND a."createdAt" < :end', { start, end })
      .groupBy("TO_CHAR(a.\"createdAt\" AT TIME ZONE 'Asia/Shanghai', 'YYYY-MM-DD')")
    if (scope.agentId) qb.andWhere('a.id = :agentId', { agentId: scope.agentId })
    return this.fillTrend(start, days, await qb.getRawMany())
  }

  private async dailyCommissionTrend(start: Date, end: Date, days: number, scope: DashboardScope) {
    const qb = this.commissionRepo
      .createQueryBuilder('c')
      .select("TO_CHAR(c.\"createdAt\" AT TIME ZONE 'Asia/Shanghai', 'YYYY-MM-DD')", 'date')
      .addSelect('COALESCE(SUM(c.agent_final_payout), 0)', 'value')
      .where('c.status IN (:...statuses)', { statuses: ['pending', 'settled'] })
      .andWhere('c."createdAt" >= :start AND c."createdAt" < :end', { start, end })
      .groupBy("TO_CHAR(c.\"createdAt\" AT TIME ZONE 'Asia/Shanghai', 'YYYY-MM-DD')")
    if (scope.merchantId)
      qb.andWhere('c.merchant_id = :merchantId', { merchantId: scope.merchantId })
    if (scope.agentId) qb.andWhere('c.agent_id = :agentId', { agentId: scope.agentId })
    return this.fillTrend(start, days, await qb.getRawMany())
  }

  private async dailyMerchantRetentionTrend(start: Date, days: number, merchantId?: string) {
    const end = this.addDays(start, days)
    const qb = this.subscriptionRepo
      .createQueryBuilder('s')
      .select("TO_CHAR(s.start_at, 'YYYY-MM-DD')", 'date')
      .addSelect('COUNT(*) FILTER (WHERE s.status = :active)', 'active')
      .addSelect('COUNT(*)', 'total')
      .where('s.start_at >= :start AND s.start_at < :end', { start, end })
      .setParameter('active', SubscriptionStatus.ACTIVE)
      .groupBy("TO_CHAR(s.start_at, 'YYYY-MM-DD')")
    if (merchantId) qb.andWhere('s.merchant_id = :merchantId', { merchantId })
    const values = (await qb.getRawMany()).map((item) => ({
      date: item.date,
      value: this.toRatio(Number(item.active), Number(item.total)),
    }))
    return this.fillTrend(start, days, values)
  }

  private applyTransactionScope(
    qb: any,
    redemptionAlias: string,
    commissionAlias: string,
    scope: DashboardScope,
  ) {
    if (scope.merchantId)
      qb.andWhere(`${redemptionAlias}.merchant_id = :merchantId`, { merchantId: scope.merchantId })
    if (scope.agentId)
      qb.andWhere(`${commissionAlias}.agent_id = :agentId`, { agentId: scope.agentId })
  }

  private fillTrend(start: Date, days: number, rows: { date: string; value: string | number }[]) {
    const values = new Map(rows.map((row) => [row.date, Number(row.value)]))
    return Array.from({ length: days }, (_, index) => {
      const date = this.addDays(start, index)
      return { date: this.toDateKey(date), value: values.get(this.toDateKey(date)) ?? 0 }
    })
  }

  private parseDashboardDay(value?: string) {
    const parsed = new Date(`${value}T00:00:00+08:00`)
    if (Number.isNaN(parsed.getTime())) throw new BadRequestException('统计日期无效')
    return parsed
  }

  private addDays(date: Date, days: number) {
    const next = new Date(date)
    next.setUTCDate(next.getUTCDate() + days)
    return next
  }

  private toDateKey(date: Date) {
    return new Date(date.getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10)
  }

  private currentShanghaiDateKey() {
    return this.toDateKey(new Date())
  }

  private toRatio(numerator: number, denominator: number) {
    return denominator === 0 ? 0 : Math.round((numerator / denominator) * 10000) / 10000
  }

  // ========================
  // 商户审核
  // ========================

  /**
   * 待审核商户列表
   */
  async listPendingMerchants(query: ListPendingMerchantsDto) {
    const { page = 1, pageSize = 20 } = query
    const [merchants, total] = await this.merchantRepo.findAndCount({
      where: { auditStatus: In([AuditStatus.PENDING, AuditStatus.NEED_INFO]) },
      order: { createdAt: 'ASC' }, // 先进先审
      skip: (page - 1) * pageSize,
      take: pageSize,
    })

    const items = merchants.map((m) => ({
      merchantId: m.id,
      businessName: m.businessName,
      contactName: m.contactName,
      phone: this.maskPhone(m.phone),
      businessType: m.businessType,
      industryCategory: m.industryCategory,
      auditStatus: m.auditStatus,
      documents: [
        { type: 'business_license', label: '营业执照' },
        { type: 'id_card', label: '法人身份证' },
      ],
      appliedAt: m.createdAt,
    }))

    return {
      items,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    }
  }

  /**
   * 审核通过商户
   * 流程：更新状态 → 创建订阅记录 → 记录审核日志
   */
  async approveMerchant(merchantId: string, dto: ApproveMerchantDto, actor = SYSTEM_ACTOR) {
    const merchant = await this.merchantRepo.findOne({
      where: { id: merchantId },
    })

    if (!merchant) {
      throw new NotFoundException({
        code: 2002,
        message: '商户不存在',
      })
    }

    if (![AuditStatus.PENDING, AuditStatus.NEED_INFO].includes(merchant.auditStatus)) {
      throw new BadRequestException({
        code: 2003,
        message: `当前状态不支持审核操作（${merchant.auditStatus}）`,
      })
    }

    await this.dataSource.transaction(async (manager) => {
      // 1. 更新商户审核状态
      merchant.auditStatus = AuditStatus.APPROVED
      merchant.subscriptionStatus = SubscriptionStatus.EXPIRED // 待支付后激活
      merchant.auditedAt = new Date()
      merchant.auditComment = dto.comment ?? null
      await manager.save(merchant)

      await this.writeAudit(
        manager,
        actor,
        AuditActionType.MERCHANT_APPROVED,
        '商户审核通过',
        'merchant',
        merchantId,
        merchant.businessName,
        { comment: dto.comment ?? null },
      )
      await this.writeNotification(
        manager,
        merchantId,
        UserRole.MERCHANT_ADMIN,
        'merchant_audit',
        '商户入驻审核已通过',
        '你的入驻申请已通过，请完成订阅开通后创建活动。',
        'merchant',
        merchantId,
      )
    })

    this.logger.log({
      event: 'merchant_approved',
      merchantId,
      approvedBy: actor.id,
    })

    return { code: 0, message: '审核通过' }
  }

  /**
   * 审核拒绝商户
   */
  async rejectMerchant(merchantId: string, dto: RejectMerchantDto, actor = SYSTEM_ACTOR) {
    const merchant = await this.merchantRepo.findOne({
      where: { id: merchantId },
    })

    if (!merchant) {
      throw new NotFoundException({
        code: 2002,
        message: '商户不存在',
      })
    }

    if (![AuditStatus.PENDING, AuditStatus.NEED_INFO].includes(merchant.auditStatus)) {
      throw new BadRequestException({
        code: 2003,
        message: `当前状态不支持审核操作（${merchant.auditStatus}）`,
      })
    }

    await this.dataSource.transaction(async (manager) => {
      merchant.auditStatus = AuditStatus.REJECTED
      merchant.auditComment = dto.reason
      merchant.auditedAt = new Date()
      await manager.save(merchant)

      await this.writeAudit(
        manager,
        actor,
        AuditActionType.MERCHANT_REJECTED,
        '商户审核拒绝',
        'merchant',
        merchantId,
        merchant.businessName,
        { reason: dto.reason },
      )
      await this.writeNotification(
        manager,
        merchantId,
        UserRole.MERCHANT_ADMIN,
        'merchant_audit',
        '商户入驻审核未通过',
        `审核意见：${dto.reason}`,
        'merchant',
        merchantId,
      )
    })

    this.logger.log({
      event: 'merchant_rejected',
      merchantId,
      reason: dto.reason,
    })

    return { code: 0, message: '已拒绝' }
  }

  /**
   * 激活商户订阅
   * 商户支付完成后调用
   */
  async activateMerchantSubscription(merchantId: string, planMonths: number) {
    const merchant = await this.merchantRepo.findOne({
      where: { id: merchantId },
      relations: ['stores'],
    })

    if (!merchant) {
      throw new NotFoundException({ code: 2002, message: '商户不存在' })
    }

    const startDate = new Date()
    const expireDate = new Date(startDate)
    expireDate.setMonth(expireDate.getMonth() + planMonths)

    await this.dataSource.transaction(async (manager) => {
      // 更新商户订阅状态
      merchant.subscriptionStatus = SubscriptionStatus.ACTIVE
      await manager.save(merchant)

      // 创建订阅记录
      await manager.save(Subscription, {
        merchantId,
        planName: planMonths >= 12 ? 'annual' : 'monthly',
        status: SubscriptionStatus.ACTIVE,
        startAt: startDate,
        expireAt: expireDate,
        amountPaid: planMonths >= 12 ? 3600 : 300, // TODO: 真实金额
        paymentMethod: 'wechatpay',
      })

      await this.writeAudit(
        manager,
        SYSTEM_ACTOR,
        AuditActionType.MERCHANT_APPROVED,
        '商户订阅开通',
        'merchant_subscription',
        merchantId,
        merchant.businessName,
        { planMonths, startAt: startDate.toISOString(), expireAt: expireDate.toISOString() },
      )
    })

    this.logger.log({
      event: 'merchant_subscription_activated',
      merchantId,
      planMonths,
      expiresAt: expireDate,
    })

    return { code: 0, message: '订阅已激活' }
  }

  // ========================
  // 分享员审核
  // ========================

  /**
   * 待审核分享员列表
   */
  async listPendingAgents(query: ListPendingAgentsDto) {
    const { page = 1, pageSize = 20, keyword } = query
    const qb = this.agentRepo
      .createQueryBuilder('agent')
      .where('agent.audit_status = :auditStatus', { auditStatus: AuditStatus.PENDING })
    if (keyword?.trim()) {
      qb.andWhere(
        '(agent.nickname ILIKE :keyword OR agent.phone ILIKE :keyword OR agent.wechat_openid ILIKE :keyword OR agent.wechat_unionid ILIKE :keyword)',
        { keyword: `%${keyword.trim()}%` },
      )
    }
    const [agents, total] = await qb
      .orderBy('agent.createdAt', 'ASC')
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount()

    const items = agents.map((a) => ({
      agentId: a.id,
      phone: this.maskPhone(a.phone),
      nickname: a.nickname,
      wechatOpenid: a.wechatOpenid ?? null,
      wechatOpenidMasked: this.maskWechatId(a.wechatOpenid),
      wechatUnionid: a.wechatUnionid ?? null,
      registeredAt: a.createdAt,
    }))

    return {
      items,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    }
  }

  /**
   * 审核通过分享员
   */
  async approveAgent(agentId: string, actor = SYSTEM_ACTOR) {
    const agent = await this.agentRepo.findOne({
      where: { id: agentId },
    })

    if (!agent) {
      throw new NotFoundException({ code: 3004, message: '分享员不存在' })
    }

    if (agent.auditStatus !== AuditStatus.PENDING) {
      throw new BadRequestException({
        code: 3005,
        message: `当前状态不支持审核操作（${agent.auditStatus}）`,
      })
    }
    if (agent.agentType === 'professional_creator' && !agent.wechatOpenid) {
      throw new BadRequestException({
        code: 3010,
        message: '专业达人须先通过微信小程序登录并绑定 OpenID，不能仅凭昵称审核',
      })
    }

    await this.dataSource.transaction(async (manager) => {
      agent.auditStatus = AuditStatus.APPROVED
      await manager.save(agent)

      await this.writeAudit(
        manager,
        actor,
        AuditActionType.AGENT_APPROVED,
        '分享员审核通过',
        'agent',
        agentId,
        agent.nickname,
        null,
      )
      await this.writeNotification(
        manager,
        agentId,
        UserRole.AGENT,
        'agent_audit',
        '分享员审核已通过',
        '你的分享员账号已通过审核，现在可以绑定账号并创建推广内容。',
        'agent',
        agentId,
      )
    })

    this.logger.log({ event: 'agent_approved', agentId })
    return { code: 0, message: '审核通过' }
  }

  /**
   * 审核拒绝分享员
   */
  async rejectAgent(agentId: string, reason: string, actor = SYSTEM_ACTOR) {
    const agent = await this.agentRepo.findOne({
      where: { id: agentId },
    })

    if (!agent) {
      throw new NotFoundException({ code: 3004, message: '分享员不存在' })
    }
    if (agent.auditStatus !== AuditStatus.PENDING) {
      throw new BadRequestException({
        code: 3005,
        message: `当前状态不支持审核操作（${agent.auditStatus}）`,
      })
    }

    await this.dataSource.transaction(async (manager) => {
      agent.auditStatus = AuditStatus.REJECTED
      agent.auditComment = reason
      await manager.save(agent)

      await this.writeAudit(
        manager,
        actor,
        AuditActionType.AGENT_REJECTED,
        '分享员审核拒绝',
        'agent',
        agentId,
        agent.nickname,
        { reason },
      )
      await this.writeNotification(
        manager,
        agentId,
        UserRole.AGENT,
        'agent_audit',
        '分享员审核未通过',
        `审核意见：${reason}`,
        'agent',
        agentId,
      )
    })

    this.logger.log({ event: 'agent_rejected', agentId, reason })
    return { code: 0, message: '已拒绝' }
  }

  /**
   * 封禁分享员
   */
  async suspendAgent(agentId: string, dto: SuspendAgentDto, actor = SYSTEM_ACTOR) {
    const agent = await this.agentRepo.findOne({
      where: { id: agentId },
    })

    if (!agent) {
      throw new NotFoundException({ code: 3004, message: '分享员不存在' })
    }

    await this.dataSource.transaction(async (manager) => {
      agent.status = false // 封禁
      agent.auditComment = dto.reason
      await manager.save(agent)

      await this.writeAudit(
        manager,
        actor,
        AuditActionType.AGENT_BANNED,
        '分享员账号封禁',
        'agent',
        agentId,
        agent.nickname,
        { reason: dto.reason, frozenCommission: dto.frozenCommission },
      )
      await this.writeNotification(
        manager,
        agentId,
        UserRole.AGENT,
        'agent_suspended',
        '分享员账号已被限制',
        `处理原因：${dto.reason}`,
        'agent',
        agentId,
      )
    })

    this.logger.log({ event: 'agent_suspended', agentId, reason: dto.reason })
    return { code: 0, message: '已封禁' }
  }

  // ========================
  // 风控告警
  // ========================

  /**
   * 风控告警列表
   */
  async listFraudAlerts(
    severity?: string,
    page = 1,
    pageSize = 20,
    filters: {
      status?: string
      alertType?: string
      merchantId?: string
      agentId?: string
    } = {},
  ) {
    const normalizedPage = Math.max(Number(page) || 1, 1)
    const normalizedPageSize = Math.min(Math.max(Number(pageSize) || 20, 1), 100)
    const hasAdvancedFilters = Boolean(
      filters.status || filters.alertType || filters.merchantId || filters.agentId,
    )
    let alerts: FraudAlert[]
    let total: number
    if (!hasAdvancedFilters) {
      const where: Record<string, string> = {}
      if (severity) where.severity = severity
      ;[alerts, total] = await this.fraudAlertRepo.findAndCount({
        where,
        order: { createdAt: 'DESC' },
        skip: (normalizedPage - 1) * normalizedPageSize,
        take: normalizedPageSize,
      })
    } else {
      const qb = this.fraudAlertRepo.createQueryBuilder('alert')
      if (severity) qb.andWhere('alert.severity = :severity', { severity })
      if (filters.status && filters.status !== 'all') {
        qb.andWhere('alert.status = :alertStatus', { alertStatus: filters.status })
      }
      if (filters.alertType)
        qb.andWhere('alert.alert_type = :alertType', { alertType: filters.alertType })
      if (filters.merchantId)
        qb.andWhere('alert.merchant_id = :merchantId', { merchantId: filters.merchantId })
      if (filters.agentId) qb.andWhere('alert.agent_id = :agentId', { agentId: filters.agentId })
      ;[alerts, total] = await qb
        .orderBy('alert.createdAt', 'DESC')
        .skip((normalizedPage - 1) * normalizedPageSize)
        .take(normalizedPageSize)
        .getManyAndCount()
    }

    const summaryWhere = (level: string) => ({
      severity: level,
      ...(filters.status && filters.status !== 'all'
        ? { status: filters.status }
        : { status: 'pending' }),
      ...(filters.alertType ? { alertType: filters.alertType } : {}),
      ...(filters.merchantId ? { merchantId: filters.merchantId } : {}),
      ...(filters.agentId ? { agentId: filters.agentId } : {}),
    })

    return {
      summary: {
        critical: await this.fraudAlertRepo.count({ where: summaryWhere('critical') }),
        warning: await this.fraudAlertRepo.count({ where: summaryWhere('warning') }),
        notice: await this.fraudAlertRepo.count({ where: summaryWhere('notice') }),
        total: await this.fraudAlertRepo.count({
          where: {
            ...(filters.status && filters.status !== 'all'
              ? { status: filters.status }
              : { status: 'pending' }),
            ...(filters.alertType ? { alertType: filters.alertType } : {}),
            ...(filters.merchantId ? { merchantId: filters.merchantId } : {}),
            ...(filters.agentId ? { agentId: filters.agentId } : {}),
          },
        }),
      },
      items: alerts.map((a) => ({
        alertId: a.id,
        type: a.alertType,
        severity: a.severity,
        confidence: a.confidenceScore,
        status: a.status,
        agentId: a.agentId ?? null,
        merchantId: a.merchantId ?? null,
        redemptionId: a.redemptionId ?? null,
        evidence: a.evidence,
        createdAt: a.createdAt,
      })),
      pagination: {
        page: normalizedPage,
        pageSize: normalizedPageSize,
        total,
        totalPages: Math.ceil(total / normalizedPageSize),
      },
    }
  }

  async resolveFraudAlert(
    alertId: string,
    body: { action: 'dismiss' | 'review' | 'freeze_commission'; note?: string },
    actor = SYSTEM_ACTOR,
  ) {
    const alert = await this.fraudAlertRepo.findOne({ where: { id: alertId } })
    if (!alert) throw new NotFoundException({ code: 7001, message: '风控告警不存在' })
    if (alert.status !== 'pending')
      throw new BadRequestException({ code: 7002, message: '该告警已处理' })

    if (!['dismiss', 'review', 'freeze_commission'].includes(body.action)) {
      throw new BadRequestException({ code: 7003, message: '无效的风控处理动作' })
    }
    if (['dismiss', 'freeze_commission'].includes(body.action) && !body.note?.trim()) {
      throw new BadRequestException({ code: 7004, message: '标记误报或冻结佣金时必须填写处理说明' })
    }
    const status =
      body.action === 'dismiss' ? 'dismissed' : body.action === 'review' ? 'reviewed' : 'actioned'
    await this.dataSource.transaction(async (manager) => {
      await manager.update(FraudAlert, alertId, {
        status,
        finalAction: body.action,
        reviewNotes: body.note ?? null,
        reviewedAt: new Date(),
        reviewedBy: actor.id,
      })
      if (body.action === 'freeze_commission' && alert.agentId) {
        const where: Record<string, unknown> = { agentId: alert.agentId, status: 'pending' }
        if (alert.merchantId) where.merchantId = alert.merchantId
        await manager.update(Commission, where, { status: 'frozen' })
      }
      await this.writeAudit(
        manager,
        actor,
        AuditActionType.FRAUD_RESOLVED,
        '风控告警人工处理',
        'fraud_alert',
        alertId,
        alert.alertType,
        {
          action: body.action,
          note: body.note ?? null,
          previousStatus: alert.status,
          nextStatus: status,
        },
      )
      if (alert.agentId)
        await this.writeNotification(
          manager,
          alert.agentId,
          UserRole.AGENT,
          'fraud_alert',
          '风控告警已处理',
          `处理结论：${body.action}${body.note ? `；说明：${body.note}` : ''}`,
          'fraud_alert',
          alertId,
        )
      if (alert.merchantId)
        await this.writeNotification(
          manager,
          alert.merchantId,
          UserRole.MERCHANT_ADMIN,
          'fraud_alert',
          '关联风控告警已处理',
          `处理结论：${body.action}${body.note ? `；说明：${body.note}` : ''}`,
          'fraud_alert',
          alertId,
        )
    })
    return { code: 0, message: '风控告警已处理', status }
  }

  async listFinanceReconciliations(status?: 'pending' | 'settled', page = 1, pageSize = 20) {
    const normalizedPage = Math.max(Number(page) || 1, 1)
    const normalizedPageSize = Math.min(Math.max(Number(pageSize) || 20, 1), 100)
    const where =
      status === 'pending' ? { settled: false } : status === 'settled' ? { settled: true } : {}
    const [items, total] = await this.platformRevenueRepo.findAndCount({
      where,
      order: { revenueDate: 'DESC', createdAt: 'DESC' },
      skip: (normalizedPage - 1) * normalizedPageSize,
      take: normalizedPageSize,
    })
    const pendingAmount = await this.platformRevenueRepo
      .createQueryBuilder('revenue')
      .select('COALESCE(SUM(revenue.amount), 0)', 'amount')
      .where('revenue.settled = false')
      .getRawOne<{ amount: string }>()
    return {
      summary: { pendingAmount: Number(pendingAmount?.amount ?? 0) },
      items: items.map((item) => ({
        id: item.id,
        type: item.revenueType,
        amount: Number(item.amount),
        merchantId: item.merchantId,
        agentId: item.agentId,
        date: item.revenueDate,
        description: item.description,
        settled: item.settled,
        settledAt: item.settledAt,
      })),
      pagination: {
        page: normalizedPage,
        pageSize: normalizedPageSize,
        total,
        totalPages: Math.ceil(total / normalizedPageSize),
      },
    }
  }

  async settleFinanceReconciliation(revenueId: string) {
    const revenue = await this.platformRevenueRepo.findOne({ where: { id: revenueId } })
    if (!revenue) throw new NotFoundException({ code: 8001, message: '对账流水不存在' })
    if (revenue.settled) return { code: 0, message: '该流水已对账' }
    await this.platformRevenueRepo.update(revenueId, { settled: true, settledAt: new Date() })
    return { code: 0, message: '已确认对账' }
  }

  /**
   * Returns the four reconciliation views used by the operations console.
   *
   * The values intentionally keep their business sources separate:
   * - internal: the append-only financial ledger and legacy platform revenue;
   * - merchant: committed campaign budget versus consumed budget;
   * - creator: task payout lifecycle (estimated/verified/settled/held);
   * - recovery: adjudicated receivables versus wallet receivables.
   * This prevents a budget remainder or a pending payout from being presented
   * as an unexplained accounting discrepancy.
   */
  async getFinanceReconciliationOverview(query: { merchantId?: string; creatorId?: string } = {}) {
    const merchantId = query.merchantId ?? null
    const creatorId = query.creatorId ?? null
    const [internalRows, platformRevenueRows, merchantRows, creatorRows, recoveryRows] =
      await Promise.all([
        this.dataSource.query(
          `SELECT
           COALESCE(SUM(amount) FILTER (WHERE classification = 'revenue'), 0) AS ledger_revenue,
           COALESCE(SUM(amount) FILTER (WHERE classification = 'cogs'), 0) AS creator_payout_cogs,
           COALESCE(SUM(amount) FILTER (WHERE classification = 'operating_cost'), 0) AS operating_cost,
           COALESCE(SUM(amount) FILTER (WHERE classification = 'reserve'), 0) AS risk_reserve,
           COUNT(*)::int AS ledger_entry_count
         FROM financial_ledger_entries
         WHERE ($1::uuid IS NULL OR merchant_id = $1)`,
          [merchantId],
        ),
        this.dataSource.query(
          `SELECT
           COALESCE(SUM(amount), 0) AS platform_revenue,
           COALESCE(SUM(amount) FILTER (WHERE settled = true), 0) AS platform_revenue_settled,
           COALESCE(SUM(amount) FILTER (WHERE settled = false), 0) AS platform_revenue_pending,
           COUNT(*) FILTER (WHERE settled = false)::int AS platform_revenue_pending_count
         FROM platform_revenues
         WHERE ($1::uuid IS NULL OR merchant_id = $1)`,
          [merchantId],
        ),
        this.dataSource.query(
          `WITH budget AS (
           SELECT merchant_id,
             COALESCE(SUM(planned_amount), 0) AS planned_budget,
             COALESCE(SUM(committed_amount), 0) AS committed_budget,
             COALESCE(SUM(spent_amount), 0) AS spent_budget
           FROM campaign_budget_allocations
           WHERE ($1::uuid IS NULL OR merchant_id = $1)
           GROUP BY merchant_id
         ), campaign_counts AS (
           SELECT merchant_id, COUNT(*)::int AS campaign_count
           FROM campaigns
           WHERE ($1::uuid IS NULL OR merchant_id = $1)
           GROUP BY merchant_id
         ), revenue AS (
           SELECT merchant_id,
             COALESCE(SUM(amount), 0) AS platform_revenue,
             COALESCE(SUM(amount) FILTER (WHERE settled = true), 0) AS platform_revenue_settled,
             COALESCE(SUM(amount) FILTER (WHERE settled = false), 0) AS platform_revenue_pending
           FROM platform_revenues
           WHERE ($1::uuid IS NULL OR merchant_id = $1)
           GROUP BY merchant_id
         )
         SELECT m.id AS merchant_id, m.business_name AS merchant_name,
           COALESCE(c.campaign_count, 0)::int AS campaign_count,
           COALESCE(b.planned_budget, 0) AS planned_budget,
           COALESCE(b.committed_budget, 0) AS committed_budget,
           COALESCE(b.spent_budget, 0) AS spent_budget,
           COALESCE(r.platform_revenue, 0) AS platform_revenue,
           COALESCE(r.platform_revenue_settled, 0) AS platform_revenue_settled,
           COALESCE(r.platform_revenue_pending, 0) AS platform_revenue_pending
         FROM merchants m
         LEFT JOIN budget b ON b.merchant_id = m.id
         LEFT JOIN campaign_counts c ON c.merchant_id = m.id
         LEFT JOIN revenue r ON r.merchant_id = m.id
         WHERE ($1::uuid IS NULL OR m.id = $1)
           AND (b.merchant_id IS NOT NULL OR r.merchant_id IS NOT NULL)
         ORDER BY m.business_name ASC`,
          [merchantId],
        ),
        this.dataSource.query(
          `WITH tasks AS (
           SELECT creator_id,
             COUNT(*)::int AS task_count,
             COUNT(*) FILTER (WHERE status IN ('submitted', 'risk_hold'))::int AS pending_review_count
           FROM creator_tasks
           WHERE ($1::uuid IS NULL OR merchant_id = $1)
             AND ($2::uuid IS NULL OR creator_id = $2)
           GROUP BY creator_id
         ), payouts AS (
           SELECT creator_id,
             COUNT(*)::int AS payout_count,
             COALESCE(SUM(expected_amount), 0) AS expected_payout,
             COALESCE(SUM(CASE WHEN status IN ('verified', 'settled', 'risk_hold', 'reversed') THEN COALESCE(verified_amount, expected_amount) ELSE 0 END), 0) AS verified_payout,
             COALESCE(SUM(CASE WHEN status = 'settled' THEN COALESCE(verified_amount, expected_amount) ELSE 0 END), 0) AS settled_payout,
             COALESCE(SUM(CASE WHEN status = 'risk_hold' THEN COALESCE(verified_amount, expected_amount) ELSE 0 END), 0) AS held_payout,
             COALESCE(SUM(CASE WHEN status IN ('estimated', 'verified', 'risk_hold') THEN COALESCE(verified_amount, expected_amount) ELSE 0 END), 0) AS outstanding_payout
           FROM creator_task_payouts
           WHERE ($1::uuid IS NULL OR merchant_id = $1)
             AND ($2::uuid IS NULL OR creator_id = $2)
           GROUP BY creator_id
         )
         SELECT a.id AS creator_id, COALESCE(a.nickname, '未命名创作者') AS creator_name,
           COALESCE(t.task_count, 0)::int AS task_count,
           COALESCE(t.pending_review_count, 0)::int AS pending_review_count,
           COALESCE(p.payout_count, 0)::int AS payout_count,
           COALESCE(p.expected_payout, 0) AS expected_payout,
           COALESCE(p.verified_payout, 0) AS verified_payout,
           COALESCE(p.settled_payout, 0) AS settled_payout,
           COALESCE(p.held_payout, 0) AS held_payout,
           COALESCE(p.outstanding_payout, 0) AS outstanding_payout
         FROM sharing_agents a
         LEFT JOIN tasks t ON t.creator_id = a.id
         LEFT JOIN payouts p ON p.creator_id = a.id
         WHERE ($2::uuid IS NULL OR a.id = $2)
           AND (t.creator_id IS NOT NULL OR p.creator_id IS NOT NULL)
         ORDER BY a.nickname ASC NULLS LAST`,
          [merchantId, creatorId],
        ),
        this.dataSource.query(
          `SELECT
           (SELECT COALESCE(SUM(GREATEST(recovery_amount - recovery_recovered_amount, 0)), 0)
              FROM creator_task_appeals
             WHERE status = 'accepted' AND adjudication_decision = 'reverse_settlement'
               AND ($1::uuid IS NULL OR merchant_id = $1)
               AND ($2::uuid IS NULL OR creator_id = $2)) AS adjudication_receivable,
           (SELECT COALESCE(SUM(recovery_receivable_balance), 0)
              FROM agent_wallets
             WHERE ($2::uuid IS NULL OR agent_id = $2)
               AND ($1::uuid IS NULL OR agent_id IN (
                 SELECT creator_id FROM creator_task_appeals WHERE merchant_id = $1
               ))) AS wallet_receivable`,
          [merchantId, creatorId],
        ),
      ])

    const internal = internalRows[0] ?? {}
    const platformRevenue = platformRevenueRows[0] ?? {}
    const ledgerRevenue = this.moneyNumber(internal.ledger_revenue)
    const creatorPayoutCogs = this.moneyNumber(internal.creator_payout_cogs)
    const operatingCost = this.moneyNumber(internal.operating_cost)
    const riskReserve = this.moneyNumber(internal.risk_reserve)
    const ledgerNetResult = this.moneyNumber(
      ledgerRevenue - creatorPayoutCogs - operatingCost - riskReserve,
    )
    const platformRevenueTotal = this.moneyNumber(platformRevenue.platform_revenue)
    const platformRevenueSettled = this.moneyNumber(platformRevenue.platform_revenue_settled)
    const platformRevenuePending = this.moneyNumber(platformRevenue.platform_revenue_pending)

    const merchantItems = merchantRows.map((row: Record<string, unknown>) => {
      const committedBudget = this.moneyNumber(row.committed_budget)
      const spentBudget = this.moneyNumber(row.spent_budget)
      const budgetRemaining = this.moneyNumber(committedBudget - spentBudget)
      const platformPending = this.moneyNumber(row.platform_revenue_pending)
      return {
        merchantId: String(row.merchant_id),
        merchantName: String(row.merchant_name),
        campaignCount: Number(row.campaign_count ?? 0),
        plannedBudget: this.moneyNumber(row.planned_budget),
        committedBudget,
        spentBudget,
        budgetRemaining,
        platformRevenue: this.moneyNumber(row.platform_revenue),
        platformRevenueSettled: this.moneyNumber(row.platform_revenue_settled),
        platformRevenuePending: platformPending,
        status:
          spentBudget > committedBudget
            ? 'exception'
            : platformPending > 0
              ? 'pending'
              : 'balanced',
      }
    })

    const creatorItems = creatorRows.map((row: Record<string, unknown>) => {
      const heldPayout = this.moneyNumber(row.held_payout)
      const outstandingPayout = this.moneyNumber(row.outstanding_payout)
      const pendingReviewCount = Number(row.pending_review_count ?? 0)
      return {
        creatorId: String(row.creator_id),
        creatorName: String(row.creator_name),
        taskCount: Number(row.task_count ?? 0),
        pendingReviewCount,
        payoutCount: Number(row.payout_count ?? 0),
        expectedPayout: this.moneyNumber(row.expected_payout),
        verifiedPayout: this.moneyNumber(row.verified_payout),
        settledPayout: this.moneyNumber(row.settled_payout),
        heldPayout,
        outstandingPayout,
        status:
          heldPayout > 0
            ? 'risk_hold'
            : pendingReviewCount > 0 || outstandingPayout > 0
              ? 'pending'
              : 'balanced',
      }
    })

    const adjudicationReceivable = this.moneyNumber(recoveryRows[0]?.adjudication_receivable)
    const walletReceivable = this.moneyNumber(recoveryRows[0]?.wallet_receivable)
    const recoveryDifference = this.moneyNumber(walletReceivable - adjudicationReceivable)
    const merchantSummary = merchantItems.reduce(
      (summary, item) => ({
        merchants: summary.merchants + 1,
        campaignCount: summary.campaignCount + item.campaignCount,
        plannedBudget: this.moneyNumber(summary.plannedBudget + item.plannedBudget),
        committedBudget: this.moneyNumber(summary.committedBudget + item.committedBudget),
        spentBudget: this.moneyNumber(summary.spentBudget + item.spentBudget),
        budgetRemaining: this.moneyNumber(summary.budgetRemaining + item.budgetRemaining),
        platformRevenue: this.moneyNumber(summary.platformRevenue + item.platformRevenue),
        platformRevenuePending: this.moneyNumber(
          summary.platformRevenuePending + item.platformRevenuePending,
        ),
      }),
      {
        merchants: 0,
        campaignCount: 0,
        plannedBudget: 0,
        committedBudget: 0,
        spentBudget: 0,
        budgetRemaining: 0,
        platformRevenue: 0,
        platformRevenuePending: 0,
      },
    )
    const creatorSummary = creatorItems.reduce(
      (summary, item) => ({
        creators: summary.creators + 1,
        taskCount: summary.taskCount + item.taskCount,
        pendingReviewCount: summary.pendingReviewCount + item.pendingReviewCount,
        expectedPayout: this.moneyNumber(summary.expectedPayout + item.expectedPayout),
        verifiedPayout: this.moneyNumber(summary.verifiedPayout + item.verifiedPayout),
        settledPayout: this.moneyNumber(summary.settledPayout + item.settledPayout),
        heldPayout: this.moneyNumber(summary.heldPayout + item.heldPayout),
        outstandingPayout: this.moneyNumber(summary.outstandingPayout + item.outstandingPayout),
      }),
      {
        creators: 0,
        taskCount: 0,
        pendingReviewCount: 0,
        expectedPayout: 0,
        verifiedPayout: 0,
        settledPayout: 0,
        heldPayout: 0,
        outstandingPayout: 0,
      },
    )

    return {
      generatedAt: new Date(),
      definition: {
        internal: '财务台账与平台收入流水核对，不代表商户或创作者的对外结算单。',
        merchant: '商户已承诺预算与活动已消耗预算核对；预算余款不等于异常。',
        creator: '任务报酬按应付、已核验、已结算、风控冻结拆分。',
        recovery: '裁决待追回金额与达人钱包待追回余额核对。',
      },
      internal: {
        ledgerRevenue,
        creatorPayoutCogs,
        operatingCost,
        riskReserve,
        ledgerNetResult,
        ledgerEntryCount: Number(internal.ledger_entry_count ?? 0),
        platformRevenue: platformRevenueTotal,
        platformRevenueSettled,
        platformRevenuePending,
        platformRevenuePendingCount: Number(platformRevenue.platform_revenue_pending_count ?? 0),
      },
      merchant: { summary: merchantSummary, items: merchantItems },
      creator: { summary: creatorSummary, items: creatorItems },
      recovery: {
        adjudicationReceivable,
        walletReceivable,
        difference: recoveryDifference,
        status: Math.abs(recoveryDifference) <= 0.01 ? 'balanced' : 'attention',
      },
    }
  }

  async listContentModeration(
    query:
      | {
          status?: string
          contentType?: string
          targetPlatform?: string
          merchantId?: string
          creatorId?: string
          campaignId?: string
          creatorTaskId?: string
          page?: number
          pageSize?: number
        }
      | string = {},
    legacyPage = 1,
    legacyPageSize = 20,
  ) {
    const normalizedQuery =
      typeof query === 'string'
        ? { status: query, page: legacyPage, pageSize: legacyPageSize }
        : query
    const normalizedPage = Math.max(Number(normalizedQuery.page) || 1, 1)
    const normalizedPageSize = Math.min(Math.max(Number(normalizedQuery.pageSize) || 20, 1), 100)
    const qb = this.contentRepo
      .createQueryBuilder('content')
      .leftJoinAndSelect('content.campaign', 'campaign')
      .leftJoinAndMapOne(
        'content.creatorTaskScope',
        CreatorTask,
        'creatorTaskScope',
        'creatorTaskScope.id = content.creator_task_id',
      )
    if (normalizedQuery.status && normalizedQuery.status !== 'all') {
      qb.andWhere('content.moderation_status = :moderationStatus', {
        moderationStatus: normalizedQuery.status,
      })
    }
    if (normalizedQuery.contentType) {
      qb.andWhere('content.content_type = :contentType', {
        contentType: normalizedQuery.contentType,
      })
    }
    if (normalizedQuery.targetPlatform) {
      qb.andWhere('content.target_platform = :targetPlatform', {
        targetPlatform: normalizedQuery.targetPlatform,
      })
    }
    if (normalizedQuery.creatorId) {
      qb.andWhere('content.agent_id = :creatorId', { creatorId: normalizedQuery.creatorId })
    }
    if (normalizedQuery.campaignId) {
      qb.andWhere('content.campaign_id = :campaignId', { campaignId: normalizedQuery.campaignId })
    }
    if (normalizedQuery.creatorTaskId) {
      qb.andWhere('content.creator_task_id = :creatorTaskId', {
        creatorTaskId: normalizedQuery.creatorTaskId,
      })
    }
    if (normalizedQuery.merchantId) {
      qb.andWhere(
        '(campaign.merchant_id = :contentMerchantId OR creatorTaskScope.merchant_id = :contentMerchantId)',
        { contentMerchantId: normalizedQuery.merchantId },
      )
    }
    const [items, total] = await qb
      .orderBy('content.createdAt', 'ASC')
      .skip((normalizedPage - 1) * normalizedPageSize)
      .take(normalizedPageSize)
      .getManyAndCount()
    return {
      items: items.map((item) => ({
        id: item.id,
        type: item.contentType,
        platform: item.targetPlatform,
        agentId: item.agentId,
        creatorId: item.agentId,
        merchantId:
          item.campaign?.merchantId ??
          (item as Content & { creatorTaskScope?: CreatorTask }).creatorTaskScope?.merchantId ??
          null,
        campaignId: item.campaignId ?? null,
        creatorTaskId: item.creatorTaskId ?? null,
        status: item.status,
        moderationStatus: item.moderationStatus,
        moderationMessage: item.moderationMessage ?? null,
        content: item.contentData,
        trackingUrl: item.trackingUrl,
        createdAt: item.createdAt,
      })),
      pagination: {
        page: normalizedPage,
        pageSize: normalizedPageSize,
        total,
        totalPages: Math.ceil(total / normalizedPageSize),
      },
    }
  }

  async moderateContent(
    contentId: string,
    body: { decision: 'passed' | 'flagged' | 'blocked'; message?: string },
    actor = SYSTEM_ACTOR,
  ) {
    const content = await this.contentRepo.findOne({ where: { id: contentId } })
    if (!content) throw new NotFoundException({ code: 9001, message: '内容不存在' })
    if (!['passed', 'flagged', 'blocked'].includes(body.decision)) {
      throw new BadRequestException({ code: 9002, message: '无效的审核结论' })
    }
    if (content.moderationStatus !== 'pending') {
      throw new BadRequestException({
        code: 9003,
        message: `该内容已审核（${content.moderationStatus}）`,
      })
    }
    if (body.decision !== 'passed' && !body.message?.trim()) {
      throw new BadRequestException({ code: 9004, message: '标记或拦截内容时必须填写审核意见' })
    }
    await this.dataSource.transaction(async (manager) => {
      await manager.update(Content, contentId, {
        moderationStatus: body.decision,
        moderationMessage: body.message ?? null,
        moderationResult: {
          reviewedAt: new Date().toISOString(),
          reviewerId: actor.id,
          source: 'admin',
        } as any,
      })
      await this.writeAudit(
        manager,
        actor,
        AuditActionType.CONTENT_MODERATED,
        'AI 内容人工审核',
        'content',
        contentId,
        content.contentType,
        { decision: body.decision, message: body.message ?? null },
      )
      await this.writeNotification(
        manager,
        content.agentId,
        UserRole.AGENT,
        'content_moderation',
        `推广内容审核${body.decision === 'passed' ? '通过' : '未通过'}`,
        body.message ??
          (body.decision === 'passed'
            ? '内容已通过审核，可以进行分发。'
            : '请调整内容后重新提交审核。'),
        'content',
        contentId,
      )
    })
    return { code: 0, message: '内容审核已完成', moderationStatus: body.decision }
  }

  async listAuditLogs(targetType?: string, targetId?: string, page = 1, pageSize = 20) {
    const safePage = Math.max(Number(page) || 1, 1)
    const safePageSize = Math.min(Math.max(Number(pageSize) || 20, 1), 100)
    const where: Record<string, string> = {}
    if (targetType) where.targetType = targetType
    if (targetId) where.targetId = targetId
    const [items, total] = await this.auditLogRepo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (safePage - 1) * safePageSize,
      take: safePageSize,
    })
    return {
      items,
      pagination: {
        page: safePage,
        pageSize: safePageSize,
        total,
        totalPages: Math.ceil(total / safePageSize),
      },
    }
  }

  // ========================
  // ========================
  // v2 Creator governance
  // ========================

  async setCreatorGrowthScore(
    agentId: string,
    dto: SetCreatorGrowthScoreDto,
    actor = SYSTEM_ACTOR,
  ) {
    const agent = await this.agentRepo.findOne({ where: { id: agentId } })
    if (!agent) throw new NotFoundException({ code: 3004, message: '创作者不存在' })

    const before = {
      score: agent.creatorGrowthScore ?? 0,
      level: agent.creatorGrowthLevel ?? 1,
      breakdown: agent.creatorScoreBreakdown ?? {},
    }
    const score = calculateCreatorGrowthScore(dto)
    const updatedAt = new Date()

    await this.dataSource.transaction(async (manager) => {
      agent.creatorGrowthScore = score.score
      agent.creatorGrowthLevel = score.level
      agent.creatorScoreBreakdown = score.breakdown
      agent.creatorScoreUpdatedAt = updatedAt
      await manager.save(agent)
      await this.writeAudit(
        manager,
        actor,
        AuditActionType.CREATOR_SCORE_UPDATED,
        '创作者 Growth Score 已更新',
        'creator',
        agentId,
        agent.nickname,
        { before, after: score, evidenceNote: dto.evidenceNote ?? null },
      )
    })

    return { code: 0, data: { creatorId: agentId, ...score, updatedAt } }
  }

  async blacklistCreator(agentId: string, dto: BlacklistCreatorDto, actor = SYSTEM_ACTOR) {
    const agent = await this.agentRepo.findOne({ where: { id: agentId } })
    if (!agent) throw new NotFoundException({ code: 3004, message: '创作者不存在' })

    const blacklistedAt = agent.blacklistedAt ?? new Date()
    await this.dataSource.transaction(async (manager) => {
      agent.status = false
      agent.blacklistedAt = blacklistedAt
      agent.blacklistReason = dto.reason
      await manager.save(agent)
      await this.writeAudit(
        manager,
        actor,
        AuditActionType.CREATOR_BLACKLISTED,
        '创作者已加入黑名单',
        'creator',
        agentId,
        agent.nickname,
        { reason: dto.reason, blacklistedAt },
      )
      await this.writeNotification(
        manager,
        agentId,
        UserRole.AGENT,
        'creator_blacklisted',
        '创作者账号已被限制',
        `处理原因：${dto.reason}`,
        'creator',
        agentId,
      )
    })

    return { code: 0, message: '创作者已加入黑名单', creatorId: agentId, blacklistedAt }
  }
  // 工具方法
  // ========================

  private moneyNumber(value: unknown): number {
    const amount = Number(value ?? 0)
    return Number.isFinite(amount) ? Math.round(amount * 100) / 100 : 0
  }

  private maskPhone(phone: string): string {
    if (!phone || phone.length < 11) return phone
    return phone.slice(0, 3) + '****' + phone.slice(-4)
  }

  private maskWechatId(value?: string | null): string | null {
    if (!value) return null
    return value.length <= 10 ? value : `${value.slice(0, 6)}…${value.slice(-4)}`
  }

  private writeAudit(
    manager: any,
    actor: AdminActor,
    actionType: AuditActionType,
    actionDescription: string,
    targetType: string,
    targetId: string,
    targetName: string | null | undefined,
    metadata: Record<string, unknown> | null,
  ) {
    return manager.save(AuditLog, {
      actorType: 'admin',
      actorId: actor.id,
      actorName: actor.name ?? null,
      actionType,
      actionDescription,
      targetType,
      targetId,
      targetName: targetName ?? null,
      metadata,
      result: 'success',
    })
  }

  private writeNotification(
    manager: any,
    recipientId: string,
    recipientRole: UserRole,
    type: string,
    title: string,
    body: string,
    targetType: string,
    targetId: string,
  ) {
    return manager.save(Notification, {
      recipientId,
      recipientRole,
      type,
      title,
      body,
      targetType,
      targetId,
    })
  }
}
