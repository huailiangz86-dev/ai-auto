// ============================================================
// AI auto - Merchant Agent Binding Service
// Merchant recruits agents → Agent registers with invite code → Merchant approves
// Flow: generate invite → agent registers → merchant audits → active
// ============================================================

import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  Optional,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { In, Repository, DataSource } from 'typeorm'

import { MerchantAgentBinding } from './entities/merchant-agent-binding.entity'
import { SharingAgent } from '../agent/entities/sharing-agent.entity'
import { AgentPlatformAccount } from '../agent/entities/agent-platform-account.entity'
import { AuditStatus } from '@ai-auto/shared'
import { CreatorTask } from '../task/entities/growth-task.entity'
import { CreatorTaskPayout } from '../task/entities/creator-task-payout.entity'
import { GrowthTask } from '../task/entities/growth-task.entity'
import { GrowthPlan } from '../task/entities/growth-plan.entity'
import { CustomerAttribution } from '../customer/entities/customer-attribution.entity'

import {
  CreateInviteDto,
  InviteLinkResponseDto,
  AgentRegisterDto,
  AuditAgentDto,
  ListBindingAgentsDto,
  UnbindAgentDto,
} from './dto/agent-binding.dto'

// 招募链接有效期（天）
const INVITE_LINK_EXPIRY_DAYS = 30

// 招募链接前缀
const INVITE_LINK_BASE = 'https://ai-auto.example.com/invite'

@Injectable()
export class MerchantAgentBindingService {
  private readonly logger = new Logger(MerchantAgentBindingService.name)

  constructor(
    @InjectRepository(MerchantAgentBinding)
    private readonly bindingRepo: Repository<MerchantAgentBinding>,
    @InjectRepository(SharingAgent)
    private readonly agentRepo: Repository<SharingAgent>,
    @InjectRepository(AgentPlatformAccount)
    private readonly platformAccountRepo: Repository<AgentPlatformAccount>,
    private readonly dataSource: DataSource,
    @Optional()
    @InjectRepository(CreatorTask)
    private readonly creatorTaskRepo?: Repository<CreatorTask>,
    @Optional()
    @InjectRepository(CreatorTaskPayout)
    private readonly creatorTaskPayoutRepo?: Repository<CreatorTaskPayout>,
    @Optional()
    @InjectRepository(GrowthTask)
    private readonly growthTaskRepo?: Repository<GrowthTask>,
    @Optional()
    @InjectRepository(GrowthPlan)
    private readonly growthPlanRepo?: Repository<GrowthPlan>,
    @Optional()
    @InjectRepository(CustomerAttribution)
    private readonly attributionRepo?: Repository<CustomerAttribution>,
  ) {}

  // ========================
  // 招募链接生成
  // ========================

  /**
   * 商家生成招募链接/二维码
   */
  async createInviteLink(merchantId: string, dto: CreateInviteDto): Promise<InviteLinkResponseDto> {
    // 生成唯一邀请码（8位）
    const inviteCode = this.generateInviteCode()

    const binding = this.bindingRepo.create({
      merchantId,
      storeId: dto.storeId ?? null,
      inviteCode,
      inviteType: dto.inviteType ?? 'link',
      bindingStatus: 'pending',
      auditStatus: AuditStatus.PENDING,
      createdBy: merchantId,
    })
    await this.bindingRepo.save(binding)

    // 组装招募链接
    const params = new URLSearchParams({
      code: inviteCode,
      mid: merchantId,
      ...(dto.storeId ? { sid: dto.storeId } : {}),
    })
    const inviteLink = `${INVITE_LINK_BASE}?${params.toString()}`

    this.logger.log({
      event: 'invite_created',
      merchantId,
      inviteCode,
      storeId: dto.storeId,
    })

    return {
      inviteLink,
      inviteQrCode: `${INVITE_LINK_BASE}/qr/${inviteCode}.png`,
      inviteCode,
      expiresInDays: INVITE_LINK_EXPIRY_DAYS,
    }
  }

  // ========================
  // 分享员注册绑定
  // ========================

  /**
   * 分享员通过邀请码注册并绑定商家
   * 幂等：同一手机号+同一商家只处理一次
   */
  async agentRegister(
    dto: AgentRegisterDto,
  ): Promise<{ agentId: string; bindingId: string; status: string }> {
    const { phone, nickname, inviteCode } = dto

    // 查找邀请码记录
    const binding = await this.bindingRepo.findOne({
      where: { inviteCode },
    })
    if (!binding) {
      throw new NotFoundException({ code: 9001, message: '邀请码无效' })
    }
    if (binding.bindingStatus === 'active') {
      throw new BadRequestException({ code: 9002, message: '该邀请码已使用' })
    }
    if (binding.bindingStatus === 'unbound' || binding.bindingStatus === 'rejected') {
      throw new BadRequestException({ code: 9003, message: '该邀请码已失效' })
    }

    // 检查是否已有该分享员绑定此商家
    const existingAgent = await this.agentRepo.findOne({ where: { phone } })
    if (existingAgent) {
      // 已有分享员 → 直接关联
      await this.bindingRepo.update(binding.id, {
        agentId: existingAgent.id,
        bindingStatus: 'registered',
        auditStatus: AuditStatus.PENDING,
      })

      this.logger.log({
        event: 'agent_register_existing',
        agentId: existingAgent.id,
        bindingId: binding.id,
      })

      return {
        agentId: existingAgent.id,
        bindingId: binding.id,
        status: 'registered',
      }
    }

    // 创建新分享员 + 关联
    const newAgent = await this.dataSource.transaction(async (manager) => {
      const agent = manager.create(SharingAgent, {
        phone,
        nickname: nickname ?? `用户${phone.slice(-4)}`,
        auditStatus: AuditStatus.APPROVED, // 默认自动通过（可配置）
        status: true,
      })
      await manager.save(agent)

      await manager.update(MerchantAgentBinding, binding.id, {
        agentId: agent.id,
        bindingStatus: 'registered',
        auditStatus: AuditStatus.PENDING,
      })

      return agent
    })

    this.logger.log({
      event: 'agent_register_new',
      agentId: newAgent.id,
      bindingId: binding.id,
      merchantId: binding.merchantId,
    })

    return {
      agentId: newAgent.id,
      bindingId: binding.id,
      status: 'registered',
    }
  }

  // ========================
  // 商家审核
  // ========================

  /**
   * 商家审核分享员绑定申请
   */
  async auditAgentBinding(
    merchantId: string,
    bindingId: string,
    dto: AuditAgentDto,
  ): Promise<{ status: string }> {
    const binding = await this.bindingRepo.findOne({
      where: { id: bindingId, merchantId },
    })
    if (!binding) {
      throw new NotFoundException({ code: 9004, message: '绑定记录不存在' })
    }
    if (binding.bindingStatus !== 'registered') {
      throw new BadRequestException({
        code: 9005,
        message: `当前状态不允许审核（${binding.bindingStatus}）`,
      })
    }

    const isApproved = dto.result === 'approved'
    if (isApproved) {
      const agent = binding.agentId
        ? await this.agentRepo.findOne({ where: { id: binding.agentId } })
        : null
      if (!agent || !agent.status) {
        throw new BadRequestException({ code: 9008, message: '分享员账号不可用，无法建立合作关系' })
      }
      if (agent.auditStatus !== AuditStatus.APPROVED) {
        throw new BadRequestException({
          code: 9009,
          message: '分享员尚未通过平台审核，无法建立合作关系',
        })
      }
    }
    await this.bindingRepo.update(bindingId, {
      bindingStatus: isApproved ? 'active' : 'rejected',
      auditStatus: isApproved ? AuditStatus.APPROVED : AuditStatus.REJECTED,
      auditComment: dto.auditComment ?? null,
      auditedBy: merchantId,
      auditedAt: new Date(),
      boundAt: isApproved ? new Date() : null,
    })

    this.logger.log({
      event: 'agent_binding_audited',
      bindingId,
      merchantId,
      result: dto.result,
    })

    return { status: isApproved ? 'active' : 'rejected' }
  }

  // ========================
  // 商家管理
  // ========================

  /**
   * 商家查看已绑定分享员列表
   */
  async listBindingAgents(merchantId: string, query: ListBindingAgentsDto) {
    const where: any = { merchantId }
    if (query.status) {
      where.bindingStatus = query.status
    }

    const [bindings, total] = await this.bindingRepo.findAndCount({
      where,
      relations: ['agent'],
      order: { createdAt: 'DESC' },
      skip: ((query.page ?? 1) - 1) * (query.pageSize ?? 20),
      take: query.pageSize ?? 20,
    })
    const agentIds = bindings.flatMap((binding) => (binding.agentId ? [binding.agentId] : []))
    const creatorTasks =
      agentIds.length && this.creatorTaskRepo
        ? await this.creatorTaskRepo.find({ where: { merchantId, creatorId: In(agentIds) } })
        : []
    const growthTaskIds = [...new Set(creatorTasks.map((task) => task.growthTaskId))]
    const [growthTasks, plans, payouts] = await Promise.all([
      growthTaskIds.length && this.growthTaskRepo
        ? this.growthTaskRepo.findBy({ id: In(growthTaskIds) })
        : [],
      growthTaskIds.length && this.growthPlanRepo
        ? this.growthPlanRepo.findBy({ growthTaskId: In(growthTaskIds) })
        : [],
      creatorTasks.length && this.creatorTaskPayoutRepo
        ? this.creatorTaskPayoutRepo.find({
            where: { creatorTaskId: In(creatorTasks.map((task) => task.id)) },
          })
        : [],
    ])
    const typedGrowthTasks = growthTasks as GrowthTask[]
    const typedPlans = plans as GrowthPlan[]
    const typedPayouts = payouts as CreatorTaskPayout[]
    const campaignIds = [
      ...new Set(
        creatorTasks
          .map((task) => task.campaignId)
          .concat(typedGrowthTasks.map((task) => task.campaignId ?? null))
          .filter((campaignId): campaignId is string => Boolean(campaignId)),
      ),
    ]
    // A creator can be bound to more than one merchant. Attribution must be
    // scoped through this merchant's campaign IDs, otherwise the dashboard
    // could expose customers acquired for another merchant.
    const attributions =
      agentIds.length && campaignIds.length && this.attributionRepo
        ? await this.attributionRepo.find({
            where: { agentId: In(agentIds), campaignId: In(campaignIds) },
          })
        : []
    const growthById = new Map<string, GrowthTask>(
      typedGrowthTasks.map((task): [string, GrowthTask] => [task.id, task]),
    )
    const planByGrowthId = new Map<string, GrowthPlan>(
      typedPlans.map((plan): [string, GrowthPlan] => [plan.growthTaskId, plan]),
    )
    const payoutByTask = new Map<string, CreatorTaskPayout>(
      typedPayouts.map((payout): [string, CreatorTaskPayout] => [payout.creatorTaskId, payout]),
    )
    const attributionByAgent = new Map<string, CustomerAttribution[]>()
    for (const attribution of attributions)
      attributionByAgent.set(attribution.agentId, [
        ...(attributionByAgent.get(attribution.agentId) ?? []),
        attribution,
      ])

    return {
      items: bindings.map((b) => ({
        bindingId: b.id,
        agentId: b.agentId,
        phone: b.agent?.phone ? b.agent.phone.slice(0, 3) + '****' + b.agent.phone.slice(-4) : null,
        nickname: b.agent?.nickname ?? null,
        agentType: b.agent?.agentType ?? 'ordinary_user',
        storeId: b.storeId,
        inviteCode: b.inviteCode,
        bindingStatus: b.bindingStatus,
        auditStatus: b.auditStatus,
        boundAt: b.boundAt,
        douyinBind: b.douyinBind,
        xiaohongshuBind: b.xiaohongshuBind,
        wechatVideoBind: b.wechatVideoBind,
        createdAt: b.createdAt,
        relationship: {
          scope: b.storeId ? 'store' : 'all_stores',
          label: b.bindingStatus === 'active' ? '合作中' : b.bindingStatus,
        },
        creatorTaskStats: this.creatorTaskStats(
          creatorTasks.filter((task) => task.creatorId === b.agentId),
          growthById,
          planByGrowthId,
          payoutByTask,
          attributionByAgent.get(b.agentId ?? '') ?? [],
        ),
      })),
      pagination: {
        page: query.page ?? 1,
        pageSize: query.pageSize ?? 20,
        total,
        totalPages: Math.ceil(total / (query.pageSize ?? 20)),
      },
    }
  }

  private creatorTaskStats(
    tasks: CreatorTask[],
    growthById: Map<string, GrowthTask>,
    planByGrowthId: Map<string, GrowthPlan>,
    payoutByTask: Map<string, CreatorTaskPayout>,
    attributions: CustomerAttribution[],
  ) {
    const activeStatuses = new Set([
      'created',
      'matching',
      'invited',
      'accepted',
      'creating',
      'submitted',
      'approved',
      'published',
      'tracking',
    ])
    // Older creator tasks predate task_type; only an explicit customer task is excluded.
    const contentTasks = tasks.filter(
      (task) => growthById.get(task.growthTaskId)?.taskType !== 'customer_campaign',
    )
    const attributedCustomers = new Set(attributions.map((item) => item.customerId))
    return {
      total: contentTasks.length,
      active: contentTasks.filter((task) => activeStatuses.has(task.status)).length,
      published: contentTasks.filter((task) =>
        ['published', 'tracking', 'completed', 'settled'].includes(task.status),
      ).length,
      completed: contentTasks.filter((task) => ['completed', 'settled'].includes(task.status))
        .length,
      pendingReview: contentTasks.filter((task) => task.status === 'submitted').length,
      attributedCustomers: attributedCustomers.size,
      attributedRedemptions: attributions.reduce(
        (total, attribution) => total + Number(attribution.totalRedemptions ?? 0),
        0,
      ),
      expectedPayout: contentTasks.reduce(
        (total, task) =>
          total + Number(payoutByTask.get(task.id)?.expectedAmount ?? task.baseReward ?? 0),
        0,
      ),
      tasks: contentTasks.slice(0, 5).map((task) => ({
        creatorTaskId: task.id,
        growthTaskId: task.growthTaskId,
        taskTitle:
          planByGrowthId.get(task.growthTaskId)?.title ??
          growthById.get(task.growthTaskId)?.goalMetric ??
          '达人内容引流任务',
        contentType: task.contentType,
        channel: task.channel,
        status: task.status,
        publishedUrl: task.publishedUrl ?? null,
        deadline: task.deadline,
      })),
    }
  }

  /**
   * 分享员解绑商家（待生效活动保留）
   */
  async unbindAgent(merchantId: string, bindingId: string, dto: UnbindAgentDto) {
    const binding = await this.bindingRepo.findOne({
      where: { id: bindingId, merchantId },
    })
    if (!binding) {
      throw new NotFoundException({ code: 9006, message: '绑定记录不存在' })
    }
    if (binding.bindingStatus === 'unbound') {
      throw new BadRequestException({ code: 9007, message: '已解绑' })
    }

    await this.bindingRepo.update(bindingId, {
      bindingStatus: 'unbound',
      unboundAt: new Date(),
      auditComment: dto.reason ?? '主动解绑',
    })

    this.logger.log({
      event: 'agent_unbound',
      bindingId,
      merchantId,
      agentId: binding.agentId,
    })

    return { status: 'unbound' }
  }

  // ========================
  // 私有工具
  // ========================

  /**
   * 生成唯一邀请码（8位大写字母数字）
   */
  private generateInviteCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    let code = ''
    for (let i = 0; i < 8; i++) {
      code += chars[Math.floor(Math.random() * chars.length)]
    }
    return code
  }
}
