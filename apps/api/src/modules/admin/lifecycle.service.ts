import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { DataSource, In } from 'typeorm'
import { AuditActionType, UserRole } from '@ai-auto/shared'
import { Merchant } from '../merchant/entities/merchant.entity'
import { SharingAgent } from '../agent/entities/sharing-agent.entity'
import { MerchantAgentBinding } from '../merchant/entities/merchant-agent-binding.entity'
import { Campaign } from '../campaign/entities/campaign.entity'
import { Commission } from '../commission/entities/commission.entity'
import { Redemption } from '../commission/entities/redemption.entity'
import { Subscription } from '../merchant/entities/subscription.entity'
import { CreatorTask, GrowthTask } from '../task/entities/growth-task.entity'
import { SharingTask, SharingTaskAssignment } from '../task/entities/sharing-task.entity'
import { AgentPlatformAccount } from '../agent/entities/agent-platform-account.entity'
import { ContentPublication } from '../content/entities/content-publication.entity'
import { Notification } from '../notification/entities/notification.entity'
import { AuditLog } from './entities/audit-log.entity'
import { FraudAlert } from './entities/fraud-alert.entity'
import { LifecycleNote } from './entities/lifecycle-note.entity'
import {
  CreateLifecycleNoteDto,
  LifecycleReasonDto,
  ListLifecycleSubjectsDto,
  RestoreLifecycleDto,
  SendLifecycleNotificationDto,
  SetCreatorTaskLimitDto,
  SetLifecycleTagsDto,
} from './dto/lifecycle.dto'

type Actor = { id: string; name?: string | null }

@Injectable()
export class LifecycleService {
  constructor(private readonly dataSource: DataSource) {}

  async listMerchants(query: ListLifecycleSubjectsDto) {
    const page = Math.max(query.page || 1, 1)
    const pageSize = Math.min(Math.max(query.pageSize || 20, 1), 100)
    const qb = this.dataSource.getRepository(Merchant).createQueryBuilder('merchant')
    if (query.keyword) qb.andWhere('(merchant.business_name ILIKE :keyword OR merchant.phone ILIKE :keyword)', { keyword: `%${query.keyword.trim()}%` })
    if (query.status === 'active') qb.andWhere('merchant.status = true')
    if (query.status === 'frozen') qb.andWhere('merchant.status = false')
    const [merchants, total] = await qb.orderBy('merchant.updatedAt', 'DESC').skip((page - 1) * pageSize).take(pageSize).getManyAndCount()
    return this.paginate(await Promise.all(merchants.map((merchant) => this.merchantListItem(merchant))), page, pageSize, total)
  }

  async getMerchantDetail(merchantId: string) {
    const merchant = await this.requireMerchant(merchantId)
    const [summary, notes, relationships, audit] = await Promise.all([
      this.merchantSummary(merchant),
      this.notes('merchant', merchantId),
      this.relationships({ merchantId }),
      this.audit('merchant', merchantId),
    ])
    return { profile: this.merchantProfile(merchant), summary, notes, relationships, audit }
  }

  async listCreators(query: ListLifecycleSubjectsDto) {
    const page = Math.max(query.page || 1, 1)
    const pageSize = Math.min(Math.max(query.pageSize || 20, 1), 100)
    const qb = this.dataSource.getRepository(SharingAgent).createQueryBuilder('creator')
    if (query.keyword) qb.andWhere('(creator.nickname ILIKE :keyword OR creator.phone ILIKE :keyword)', { keyword: `%${query.keyword.trim()}%` })
    if (query.status === 'active') qb.andWhere('creator.status = true AND creator.blacklisted_at IS NULL')
    if (query.status === 'frozen') qb.andWhere('creator.status = false AND creator.blacklisted_at IS NULL')
    if (query.status === 'blacklisted') qb.andWhere('creator.blacklisted_at IS NOT NULL')
    if (query.agentType) qb.andWhere('creator.agent_type = :agentType', { agentType: query.agentType })
    const [creators, total] = await qb.orderBy('creator.updatedAt', 'DESC').skip((page - 1) * pageSize).take(pageSize).getManyAndCount()
    return this.paginate(await Promise.all(creators.map((creator) => this.creatorListItem(creator))), page, pageSize, total)
  }

  async getCreatorDetail(creatorId: string) {
    const creator = await this.requireCreator(creatorId)
    const [summary, accounts, notes, relationships, audit] = await Promise.all([
      this.creatorSummary(creator),
      this.dataSource.getRepository(AgentPlatformAccount).find({ where: { agentId: creatorId }, order: { boundAt: 'DESC' } }),
      this.notes('creator', creatorId),
      this.relationships({ creatorId }),
      this.audit('creator', creatorId),
    ])
    return { profile: this.creatorProfile(creator), summary, accounts, notes, relationships, audit }
  }

  async freezeMerchant(merchantId: string, dto: LifecycleReasonDto, actor: Actor) {
    const merchant = await this.requireMerchant(merchantId)
    await this.dataSource.transaction(async (manager) => {
      merchant.status = false
      merchant.frozenAt = new Date()
      merchant.frozenReason = dto.reason
      await manager.save(merchant)
      await this.writeAudit(manager, actor, AuditActionType.MERCHANT_FROZEN, '商户已冻结', 'merchant', merchant.id, merchant.businessName, { reason: dto.reason })
      await this.writeNotification(manager, merchant.id, UserRole.MERCHANT_ADMIN, 'merchant_lifecycle', '商户账号已冻结', `处理原因：${dto.reason}`, 'merchant', merchant.id)
    })
    return { code: 0, message: '商户已冻结' }
  }

  async restoreMerchant(merchantId: string, dto: RestoreLifecycleDto, actor: Actor) {
    const merchant = await this.requireMerchant(merchantId)
    await this.dataSource.transaction(async (manager) => {
      merchant.status = true
      merchant.frozenAt = null
      merchant.frozenReason = null
      await manager.save(merchant)
      await this.writeAudit(manager, actor, AuditActionType.MERCHANT_RESTORED, '商户已恢复', 'merchant', merchant.id, merchant.businessName, { reason: dto.reason ?? null })
      await this.writeNotification(manager, merchant.id, UserRole.MERCHANT_ADMIN, 'merchant_lifecycle', '商户账号已恢复', dto.reason ? `恢复说明：${dto.reason}` : '你的账号已恢复正常使用。', 'merchant', merchant.id)
    })
    return { code: 0, message: '商户已恢复' }
  }

  async freezeCreator(creatorId: string, dto: LifecycleReasonDto, actor: Actor) {
    const creator = await this.requireCreator(creatorId)
    await this.dataSource.transaction(async (manager) => {
      creator.status = false
      creator.frozenAt = new Date()
      creator.frozenReason = dto.reason
      await manager.save(creator)
      await this.writeAudit(manager, actor, AuditActionType.AGENT_BANNED, '达人已冻结', 'creator', creator.id, creator.nickname, { reason: dto.reason })
      await this.writeNotification(manager, creator.id, UserRole.AGENT, 'creator_lifecycle', '达人账号已冻结', `处理原因：${dto.reason}`, 'creator', creator.id)
    })
    return { code: 0, message: '达人已冻结' }
  }

  async restoreCreator(creatorId: string, dto: RestoreLifecycleDto, actor: Actor) {
    const creator = await this.requireCreator(creatorId)
    await this.dataSource.transaction(async (manager) => {
      creator.status = true
      creator.frozenAt = null
      creator.frozenReason = null
      creator.blacklistedAt = null
      creator.blacklistReason = null
      await manager.save(creator)
      await this.writeAudit(manager, actor, AuditActionType.CREATOR_RESTORED, '达人已恢复', 'creator', creator.id, creator.nickname, { reason: dto.reason ?? null, blacklistCleared: true })
      await this.writeNotification(manager, creator.id, UserRole.AGENT, 'creator_lifecycle', '达人账号已恢复', dto.reason ? `恢复说明：${dto.reason}` : '你的账号已恢复正常使用。', 'creator', creator.id)
    })
    return { code: 0, message: '达人已恢复' }
  }

  async setMerchantTags(merchantId: string, dto: SetLifecycleTagsDto, actor: Actor) {
    const merchant = await this.requireMerchant(merchantId)
    merchant.operationTags = this.normalizedTags(dto.tags)
    await this.dataSource.transaction(async (manager) => {
      await manager.save(merchant)
      await this.writeAudit(manager, actor, AuditActionType.LIFECYCLE_TAGGED, '商户运营标签已更新', 'merchant', merchant.id, merchant.businessName, { tags: merchant.operationTags })
    })
    return { code: 0, data: { tags: merchant.operationTags } }
  }

  async setCreatorTags(creatorId: string, dto: SetLifecycleTagsDto, actor: Actor) {
    const creator = await this.requireCreator(creatorId)
    creator.operationTags = this.normalizedTags(dto.tags)
    await this.dataSource.transaction(async (manager) => {
      await manager.save(creator)
      await this.writeAudit(manager, actor, AuditActionType.LIFECYCLE_TAGGED, '达人运营标签已更新', 'creator', creator.id, creator.nickname, { tags: creator.operationTags })
    })
    return { code: 0, data: { tags: creator.operationTags } }
  }

  async setCreatorType(creatorId: string, agentType: 'professional_creator' | 'ordinary_user', actor: Actor) {
    const creator = await this.requireCreator(creatorId)
    creator.agentType = agentType
    await this.dataSource.transaction(async (manager) => {
      await manager.save(creator)
      await this.writeAudit(manager, actor, AuditActionType.LIFECYCLE_TAGGED, '分享员身份类型已更新', 'creator', creator.id, creator.nickname, { agentType })
    })
    return { code: 0, data: { agentType: creator.agentType } }
  }

  async setCreatorTaskLimit(creatorId: string, dto: SetCreatorTaskLimitDto, actor: Actor) {
    const creator = await this.requireCreator(creatorId)
    creator.creatorTaskLimit = dto.limit ?? null
    await this.dataSource.transaction(async (manager) => {
      await manager.save(creator)
      await this.writeAudit(manager, actor, AuditActionType.CREATOR_TASK_LIMIT_UPDATED, '达人限接任务设置已更新', 'creator', creator.id, creator.nickname, { limit: creator.creatorTaskLimit })
    })
    return { code: 0, data: { limit: creator.creatorTaskLimit } }
  }

  async createNote(subjectType: 'merchant' | 'creator' | 'relationship', subjectId: string, dto: CreateLifecycleNoteDto, actor: Actor) {
    let targetName: string | null | undefined
    if (subjectType === 'merchant') targetName = (await this.requireMerchant(subjectId)).businessName
    else if (subjectType === 'creator') targetName = (await this.requireCreator(subjectId)).nickname
    else targetName = (await this.requireBinding(subjectId)).inviteCode
    const note = await this.dataSource.transaction(async (manager) => {
      const saved = await manager.save(LifecycleNote, { subjectType, subjectId, category: dto.category, content: dto.content, reason: dto.reason ?? null, followUpAt: dto.followUpAt ? new Date(dto.followUpAt) : null, createdBy: actor.id, createdByName: actor.name ?? null })
      await this.writeAudit(manager, actor, AuditActionType.LIFECYCLE_NOTE_CREATED, '运营跟进记录已新增', subjectType, subjectId, targetName, { category: dto.category, reason: dto.reason ?? null, followUpAt: dto.followUpAt ?? null })
      return saved
    })
    return { code: 0, data: note }
  }

  async notify(subjectType: 'merchant' | 'creator', subjectId: string, dto: SendLifecycleNotificationDto, actor: Actor) {
    let targetName: string | null | undefined
    if (subjectType === 'merchant') targetName = (await this.requireMerchant(subjectId)).businessName
    else targetName = (await this.requireCreator(subjectId)).nickname
    const role = subjectType === 'merchant' ? UserRole.MERCHANT_ADMIN : UserRole.AGENT
    await this.dataSource.transaction(async (manager) => {
      await this.writeNotification(manager, subjectId, role, `${subjectType}_operation`, dto.title, dto.body, subjectType, subjectId)
      await this.writeAudit(manager, actor, AuditActionType.LIFECYCLE_NOTIFICATION_SENT, '运营站内通知已发送', subjectType, subjectId, targetName, { title: dto.title })
    })
    return { code: 0, message: '通知已发送' }
  }

  async listRelationships(merchantId?: string, creatorId?: string) { return this.relationships({ merchantId, creatorId }) }

  async restrictRelationship(bindingId: string, dto: LifecycleReasonDto, actor: Actor) {
    const binding = await this.requireBinding(bindingId)
    await this.dataSource.transaction(async (manager) => {
      binding.restrictedAt = new Date()
      binding.restrictionReason = dto.reason
      await manager.save(binding)
      await this.writeAudit(manager, actor, AuditActionType.RELATIONSHIP_RESTRICTED, '商户—达人合作已限制', 'relationship', binding.id, binding.inviteCode, { merchantId: binding.merchantId, creatorId: binding.agentId ?? null, reason: dto.reason })
    })
    return { code: 0, message: '合作已限制' }
  }

  async releaseRelationship(bindingId: string, dto: RestoreLifecycleDto, actor: Actor) {
    const binding = await this.requireBinding(bindingId)
    await this.dataSource.transaction(async (manager) => {
      binding.restrictedAt = null
      binding.restrictionReason = null
      await manager.save(binding)
      await this.writeAudit(manager, actor, AuditActionType.RELATIONSHIP_RELEASED, '商户—达人合作限制已解除', 'relationship', binding.id, binding.inviteCode, { reason: dto.reason ?? null })
    })
    return { code: 0, message: '合作限制已解除' }
  }

  async unbindRelationship(bindingId: string, dto: LifecycleReasonDto, actor: Actor) {
    const binding = await this.requireBinding(bindingId)
    if (binding.bindingStatus === 'unbound') throw new BadRequestException({ code: 6501, message: '该合作关系已解除' })
    await this.dataSource.transaction(async (manager) => {
      binding.bindingStatus = 'unbound'
      binding.unboundAt = new Date()
      binding.restrictedAt = null
      binding.restrictionReason = dto.reason
      await manager.save(binding)
      await this.writeAudit(manager, actor, AuditActionType.RELATIONSHIP_UNBOUND, '商户—达人合作已人工解除', 'relationship', binding.id, binding.inviteCode, { merchantId: binding.merchantId, creatorId: binding.agentId ?? null, reason: dto.reason })
    })
    return { code: 0, message: '合作已解除' }
  }

  private async merchantListItem(merchant: Merchant) { return { ...this.merchantProfile(merchant), summary: await this.merchantSummary(merchant) } }
  private async creatorListItem(creator: SharingAgent) { return { ...this.creatorProfile(creator), summary: await this.creatorSummary(creator) } }

  private merchantProfile(merchant: Merchant) {
    return {
      id: merchant.id,
      businessName: merchant.businessName,
      phone: this.maskPhone(merchant.phone),
      contactName: merchant.contactName,
      administratorContact: {
        name: merchant.contactName ?? null,
        phone: merchant.contactPhone || merchant.phone,
        email: merchant.email ?? null,
      },
      industryCategory: merchant.industryCategory,
      auditStatus: merchant.auditStatus,
      subscriptionStatus: merchant.subscriptionStatus,
      status: merchant.status ? 'active' : 'frozen',
      frozenAt: merchant.frozenAt ?? null,
      frozenReason: merchant.frozenReason ?? null,
      tags: merchant.operationTags ?? [],
      createdAt: merchant.createdAt,
      updatedAt: merchant.updatedAt,
    }
  }

  private creatorProfile(creator: SharingAgent) {
    return { id: creator.id, nickname: creator.nickname, phone: this.maskPhone(creator.phone), auditStatus: creator.auditStatus, agentType: creator.agentType ?? 'ordinary_user', realNameVerified: creator.realNameVerified, level: creator.level, growthScore: creator.creatorGrowthScore ?? 0, growthLevel: creator.creatorGrowthLevel ?? 1, categories: creator.creatorCategories ?? [], taskPreferences: creator.taskPreferences ?? {}, status: creator.blacklistedAt ? 'blacklisted' : creator.status ? 'active' : 'frozen', frozenAt: creator.frozenAt ?? null, frozenReason: creator.frozenReason ?? null, blacklistedAt: creator.blacklistedAt ?? null, blacklistReason: creator.blacklistReason ?? null, taskLimit: creator.creatorTaskLimit ?? null, tags: creator.operationTags ?? [], createdAt: creator.createdAt, updatedAt: creator.updatedAt }
  }

  private async merchantSummary(merchant: Merchant) {
    const [campaigns, tasks, creatorTasks, redemptions, commissions, subscriptions, alerts] = await Promise.all([
      this.dataSource.getRepository(Campaign).find({ where: { merchantId: merchant.id }, select: ['id', 'campaignStatus', 'maxBudget', 'spentBudget', 'totalRedemptions', 'totalCommissionSpent'] }),
      this.dataSource.getRepository(GrowthTask).find({ where: { merchantId: merchant.id }, select: ['id', 'status', 'budget'] }),
      this.dataSource.getRepository(CreatorTask).find({ where: { merchantId: merchant.id }, select: ['id', 'status', 'campaignCreditsAllocated', 'campaignCreditsConsumed'] }),
      this.dataSource.getRepository(Redemption).find({ where: { merchantId: merchant.id }, select: ['id', 'status', 'transactionAmount'] }),
      this.dataSource.getRepository(Commission).find({ where: { merchantId: merchant.id }, select: ['id', 'status', 'agentFinalPayout'] }),
      this.dataSource.getRepository(Subscription).find({ where: { merchantId: merchant.id }, order: { createdAt: 'DESC' }, take: 1 }),
      this.dataSource.getRepository(FraudAlert).find({ where: { merchantId: merchant.id, status: 'pending' }, select: ['id', 'severity'] }),
    ])
    return { activity: { campaigns: campaigns.length, activeCampaigns: campaigns.filter((item) => item.campaignStatus === 'active').length, growthTasks: tasks.length, activeGrowthTasks: tasks.filter((item) => item.status === 'active').length }, budget: { planned: this.sum(campaigns, 'maxBudget') + this.sum(tasks, 'budget'), spent: this.sum(campaigns, 'spentBudget'), commissionSpent: this.sum(campaigns, 'totalCommissionSpent') }, settlement: { redemptions: redemptions.length, verifiedRedemptions: redemptions.filter((item) => item.status === 'verified' || item.status === 'settled').length, gmv: this.sum(redemptions, 'transactionAmount'), commission: this.sum(commissions, 'agentFinalPayout'), pendingCommission: this.sum(commissions.filter((item) => item.status === 'pending' || item.status === 'frozen'), 'agentFinalPayout') }, creatorTasks: { total: creatorTasks.length, inProgress: creatorTasks.filter((item) => !['completed', 'settled', 'cancelled', 'rejected', 'violation', 'expired'].includes(item.status)).length, completed: creatorTasks.filter((item) => ['completed', 'settled'].includes(item.status)).length }, credits: { allocated: this.sum(creatorTasks, 'campaignCreditsAllocated'), consumed: this.sum(creatorTasks, 'campaignCreditsConsumed') }, risk: { pendingAlerts: alerts.length, criticalAlerts: alerts.filter((item) => item.severity === 'critical').length }, subscription: subscriptions[0] ? { status: subscriptions[0].status, startAt: subscriptions[0].startAt, expireAt: subscriptions[0].expireAt } : null }
  }

  private async creatorSummary(creator: SharingAgent) {
    const [creatorTasks, assignments, publications, commissions, bindings, alerts] = await Promise.all([
      this.dataSource.getRepository(CreatorTask).find({ where: { creatorId: creator.id }, select: ['id', 'status', 'channel'] }),
      this.dataSource.getRepository(SharingTaskAssignment).find({ where: { agentId: creator.id }, select: ['id', 'status', 'viewCount', 'claimCount', 'redemptionCount', 'earnedReward'] }),
      this.dataSource.getRepository(ContentPublication).find({ where: { agentId: creator.id }, select: ['id', 'status', 'impressions', 'clicks'] }),
      this.dataSource.getRepository(Commission).find({ where: { agentId: creator.id }, select: ['id', 'agentFinalPayout'] }),
      this.dataSource.getRepository(MerchantAgentBinding).find({ where: { agentId: creator.id }, select: ['id', 'bindingStatus', 'restrictedAt'] }),
      this.dataSource.getRepository(FraudAlert).find({ where: { agentId: creator.id, status: 'pending' }, select: ['id', 'severity'] }),
    ])
    const taskTotal = creatorTasks.length + assignments.length
    const taskCompleted = creatorTasks.filter((item) => ['completed', 'settled'].includes(item.status)).length + assignments.filter((item) => item.status === 'completed').length
    return { taskPerformance: { total: taskTotal, completed: taskCompleted, fulfillmentRate: taskTotal ? Number((taskCompleted / taskTotal).toFixed(4)) : 0, current: creatorTasks.filter((item) => !['completed', 'settled', 'cancelled', 'rejected', 'violation', 'expired'].includes(item.status)).length }, conversion: { views: this.sum(assignments, 'viewCount'), claims: this.sum(assignments, 'claimCount'), redemptions: this.sum(assignments, 'redemptionCount'), earnedReward: this.sum(assignments, 'earnedReward'), commissionEarned: this.sum(commissions, 'agentFinalPayout') }, publishing: { total: publications.length, published: publications.filter((item) => item.status === 'published').length, impressions: this.sum(publications, 'impressions'), clicks: this.sum(publications, 'clicks') }, relationships: { total: bindings.length, active: bindings.filter((item) => item.bindingStatus === 'active').length, restricted: bindings.filter((item) => Boolean(item.restrictedAt)).length }, risk: { pendingAlerts: alerts.length, criticalAlerts: alerts.filter((item) => item.severity === 'critical').length } }
  }

  private async relationships(filter: { merchantId?: string; creatorId?: string }) {
    const where: Record<string, string> = {}
    if (filter.merchantId) where.merchantId = filter.merchantId
    if (filter.creatorId) where.agentId = filter.creatorId
    const bindings = await this.dataSource.getRepository(MerchantAgentBinding).find({ where, order: { updatedAt: 'DESC' } })
    const merchantIds = [...new Set(bindings.map((item) => item.merchantId))]
    const creatorIds = [...new Set(bindings.flatMap((item) => item.agentId ? [item.agentId] : []))]
    const [merchants, creators, tasks] = await Promise.all([
      merchantIds.length ? this.dataSource.getRepository(Merchant).findBy({ id: In(merchantIds) }) : [],
      creatorIds.length ? this.dataSource.getRepository(SharingAgent).findBy({ id: In(creatorIds) }) : [],
      creatorIds.length && merchantIds.length ? this.dataSource.getRepository(CreatorTask).find({ where: creatorIds.map((creatorId) => ({ creatorId })) }) : [],
    ])
    const merchantMap = new Map<string, Merchant>(merchants.map((item): [string, Merchant] => [item.id, item]))
    const creatorMap = new Map<string, SharingAgent>(creators.map((item): [string, SharingAgent] => [item.id, item]))
    return bindings.map((binding) => ({ id: binding.id, merchant: merchantMap.get(binding.merchantId) ? { id: binding.merchantId, businessName: merchantMap.get(binding.merchantId)?.businessName } : { id: binding.merchantId, businessName: '已删除商户' }, creator: binding.agentId && creatorMap.get(binding.agentId) ? { id: binding.agentId, nickname: creatorMap.get(binding.agentId)?.nickname, phone: this.maskPhone(creatorMap.get(binding.agentId)?.phone ?? '') } : null, bindingStatus: binding.bindingStatus, restrictedAt: binding.restrictedAt ?? null, restrictionReason: binding.restrictionReason ?? null, boundAt: binding.boundAt ?? null, unboundAt: binding.unboundAt ?? null, cooperationQuality: this.cooperationQuality(binding, tasks) }))
  }

  private cooperationQuality(binding: MerchantAgentBinding, tasks: CreatorTask[]) {
    if (!binding.agentId) return { score: null, completed: 0, total: 0 }
    const related = tasks.filter((task) => task.creatorId === binding.agentId && task.merchantId === binding.merchantId)
    const completed = related.filter((task) => ['completed', 'settled'].includes(task.status)).length
    return { score: related.length ? Math.round((completed / related.length) * 100) : null, completed, total: related.length }
  }

  private async notes(subjectType: string, subjectId: string) { return this.dataSource.getRepository(LifecycleNote).find({ where: { subjectType: subjectType as any, subjectId }, order: { createdAt: 'DESC' }, take: 100 }) }
  private async audit(targetType: string, targetId: string) { return this.dataSource.getRepository(AuditLog).find({ where: { targetType, targetId }, order: { createdAt: 'DESC' }, take: 100 }) }
  private async requireMerchant(id: string) { const item = await this.dataSource.getRepository(Merchant).findOne({ where: { id } }); if (!item) throw new NotFoundException({ code: 2002, message: '商户不存在' }); return item }
  private async requireCreator(id: string) { const item = await this.dataSource.getRepository(SharingAgent).findOne({ where: { id } }); if (!item) throw new NotFoundException({ code: 3004, message: '达人不存在' }); return item }
  private async requireBinding(id: string) { const item = await this.dataSource.getRepository(MerchantAgentBinding).findOne({ where: { id } }); if (!item) throw new NotFoundException({ code: 6500, message: '合作关系不存在' }); return item }
  private paginate<T>(items: T[], page: number, pageSize: number, total: number) { return { items, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } } }
  private normalizedTags(tags: string[]) { return [...new Set(tags.map((item) => item.trim()).filter(Boolean))].slice(0, 20) }
  private sum(rows: any[], field: string) { return rows.reduce((total, item) => total + Number(item[field] ?? 0), 0) }
  private maskPhone(phone: string) { return phone && phone.length >= 11 ? `${phone.slice(0, 3)}****${phone.slice(-4)}` : phone }
  private writeAudit(manager: any, actor: Actor, actionType: AuditActionType, actionDescription: string, targetType: string, targetId: string, targetName: string | null | undefined, metadata: Record<string, unknown>) { return manager.save(AuditLog, { actorType: 'admin', actorId: actor.id, actorName: actor.name ?? null, actionType, actionDescription, targetType, targetId, targetName: targetName ?? null, metadata, result: 'success' }) }
  private writeNotification(manager: any, recipientId: string, recipientRole: UserRole, type: string, title: string, body: string, targetType: string, targetId: string) { return manager.save(Notification, { recipientId, recipientRole, type, title, body, targetType, targetId }) }
}



