// ============================================================
// AI auto - Admin Service
// Platform operations: merchant/agent audit, fraud, finance
// ============================================================

import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository, DataSource, Not } from 'typeorm'

import { Merchant } from '../merchant/entities/merchant.entity'
import { Store } from '../merchant/entities/store.entity'
import { Subscription } from '../merchant/entities/subscription.entity'
import { SharingAgent } from '../agent/entities/sharing-agent.entity'
import { AuditLog } from './entities/audit-log.entity'
import { FraudAlert } from './entities/fraud-alert.entity'
import { AuditStatus, AuditActionType, SubscriptionStatus } from '@ai-auto/shared'

import {
  ApproveMerchantDto,
  RejectMerchantDto,
  SuspendAgentDto,
  ListPendingMerchantsDto,
  ListPendingAgentsDto,
} from './dto/admin-audit.dto'

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
    private readonly dataSource: DataSource,
  ) {}

  // ========================
  // 商户审核
  // ========================

  /**
   * 待审核商户列表
   */
  async listPendingMerchants(query: ListPendingMerchantsDto) {
    const { page = 1, pageSize = 20 } = query
    const [merchants, total] = await this.merchantRepo.findAndCount({
      where: { auditStatus: AuditStatus.PENDING },
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
  async approveMerchant(merchantId: string, dto: ApproveMerchantDto) {
    const merchant = await this.merchantRepo.findOne({
      where: { id: merchantId },
    })

    if (!merchant) {
      throw new NotFoundException({
        code: 2002,
        message: '商户不存在',
      })
    }

    if (merchant.auditStatus !== AuditStatus.PENDING) {
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

      // 2. 记录审核日志
      await manager.save(AuditLog, {
        action: AuditActionType.MERCHANT_APPROVED,
        targetType: 'merchant',
        targetId: merchantId,
        adminId: 'system', // TODO: 从 CurrentUser 获取
        metadata: { comment: dto.comment },
      })
    })

    this.logger.log({
      event: 'merchant_approved',
      merchantId,
      approvedBy: 'system',
    })

    return { code: 0, message: '审核通过' }
  }

  /**
   * 审核拒绝商户
   */
  async rejectMerchant(merchantId: string, dto: RejectMerchantDto) {
    const merchant = await this.merchantRepo.findOne({
      where: { id: merchantId },
    })

    if (!merchant) {
      throw new NotFoundException({
        code: 2002,
        message: '商户不存在',
      })
    }

    if (merchant.auditStatus !== AuditStatus.PENDING) {
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

      await manager.save(AuditLog, {
        action: AuditActionType.MERCHANT_REJECTED,
        targetType: 'merchant',
        targetId: merchantId,
        adminId: 'system',
        metadata: { reason: dto.reason },
      })
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

      // 记录审核日志（激活订阅）
      await manager.save(AuditLog, {
        action: AuditActionType.MERCHANT_APPROVED,
        targetType: 'merchant_subscription',
        targetId: merchantId,
        adminId: 'system',
        metadata: { planMonths },
      })
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
    const { page = 1, pageSize = 20 } = query
    const [agents, total] = await this.agentRepo.findAndCount({
      where: { auditStatus: AuditStatus.PENDING },
      order: { createdAt: 'ASC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    })

    const items = agents.map((a) => ({
      agentId: a.id,
      phone: this.maskPhone(a.phone),
      nickname: a.nickname,
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
  async approveAgent(agentId: string) {
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
      agent.auditStatus = AuditStatus.APPROVED
      await manager.save(agent)

      await manager.save(AuditLog, {
        action: AuditActionType.AGENT_APPROVED,
        targetType: 'agent',
        targetId: agentId,
        adminId: 'system',
      })
    })

    this.logger.log({ event: 'agent_approved', agentId })
    return { code: 0, message: '审核通过' }
  }

  /**
   * 审核拒绝分享员
   */
  async rejectAgent(agentId: string, reason: string) {
    const agent = await this.agentRepo.findOne({
      where: { id: agentId },
    })

    if (!agent) {
      throw new NotFoundException({ code: 3004, message: '分享员不存在' })
    }

    await this.dataSource.transaction(async (manager) => {
      agent.auditStatus = AuditStatus.REJECTED
      agent.auditComment = reason
      await manager.save(agent)

      await manager.save(AuditLog, {
        action: AuditActionType.AGENT_REJECTED,
        targetType: 'agent',
        targetId: agentId,
        adminId: 'system',
        metadata: { reason },
      })
    })

    this.logger.log({ event: 'agent_rejected', agentId, reason })
    return { code: 0, message: '已拒绝' }
  }

  /**
   * 封禁分享员
   */
  async suspendAgent(agentId: string, dto: SuspendAgentDto) {
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

      await manager.save(AuditLog, {
        action: AuditActionType.AGENT_BANNED,
        targetType: 'agent',
        targetId: agentId,
        adminId: 'system',
        metadata: { reason: dto.reason, frozenCommission: dto.frozenCommission },
      })
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
  async listFraudAlerts(severity?: string, page = 1, pageSize = 20) {
    const where: any = {}
    if (severity) {
      where.severity = severity
    }

    const [alerts, total] = await this.fraudAlertRepo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    })

    return {
      summary: {
        critical: await this.fraudAlertRepo.count({
          where: { severity: 'critical', status: 'pending' },
        }),
        warning: await this.fraudAlertRepo.count({
          where: { severity: 'warning', status: 'pending' },
        }),
        notice: await this.fraudAlertRepo.count({
          where: { severity: 'notice', status: 'pending' },
        }),
      },
      items: alerts.map((a) => ({
        alertId: a.id,
        type: a.alertType,
        severity: a.severity,
        confidence: a.confidenceScore,
        status: a.status,
        evidence: a.evidence,
        createdAt: a.createdAt,
      })),
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    }
  }

  // ========================
  // 工具方法
  // ========================

  private maskPhone(phone: string): string {
    if (!phone || phone.length < 11) return phone
    return phone.slice(0, 3) + '****' + phone.slice(-4)
  }
}
