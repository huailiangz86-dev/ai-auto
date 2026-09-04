import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { DataSource, Repository } from 'typeorm'
import { AuditActionType } from '@ai-auto/shared'
import { AuditLog } from './entities/audit-log.entity'
import { RiskRule } from './entities/risk-rule.entity'
import {
  CreateRiskRuleDto,
  ListRiskRulesDto,
  UpdateRiskRuleDto,
  RiskRuleConditionDto,
} from './dto/risk-rule.dto'

export interface RiskRuleActor {
  id: string
  name?: string | null
}

@Injectable()
export class RiskRuleService {
  constructor(
    @InjectRepository(RiskRule) private readonly rules: Repository<RiskRule>,
    private readonly dataSource: DataSource,
  ) {}

  async list(query: ListRiskRulesDto = {}) {
    const where: Partial<Pick<RiskRule, 'enabled' | 'triggerType'>> = {}
    if (query.enabled !== undefined) where.enabled = query.enabled
    if (query.triggerType) where.triggerType = query.triggerType
    const items = await this.rules.find({ where, order: { enabled: 'DESC', updatedAt: 'DESC' } })
    return {
      items: items.map((item) => this.serialize(item)),
      summary: {
        total: items.length,
        enabled: items.filter((item) => item.enabled).length,
        disabled: items.filter((item) => !item.enabled).length,
      },
    }
  }

  async create(dto: CreateRiskRuleDto, actor: RiskRuleActor) {
    const ruleKey = this.normalizeKey(dto.ruleKey)
    const existing = await this.rules.findOne({ where: { ruleKey } })
    if (existing) throw new BadRequestException('规则标识已存在')
    const rule = this.rules.create({
      ruleKey,
      name: dto.name.trim(),
      triggerType: dto.triggerType,
      severity: dto.severity,
      conditionConfig: this.condition(dto.conditionConfig),
      actions: [...dto.actions],
      description: dto.description?.trim() || null,
      enabled: dto.enabled ?? true,
      version: 1,
      createdByAdminId: actor.id,
      updatedByAdminId: actor.id,
    })
    const saved = await this.dataSource.transaction(async (manager) => {
      const result = await manager.save(RiskRule, rule)
      await this.audit(
        manager,
        actor,
        AuditActionType.RISK_RULE_CREATED,
        '风控规则已创建',
        result,
        null,
      )
      return result
    })
    return this.serialize(saved)
  }

  async update(id: string, dto: UpdateRiskRuleDto, actor: RiskRuleActor) {
    const rule = await this.require(id)
    const before = this.snapshot(rule)
    if (dto.ruleKey !== undefined) {
      const ruleKey = this.normalizeKey(dto.ruleKey)
      const duplicate = await this.rules.findOne({ where: { ruleKey } })
      if (duplicate && duplicate.id !== id) throw new BadRequestException('规则标识已存在')
      rule.ruleKey = ruleKey
    }
    if (dto.name !== undefined) rule.name = dto.name.trim()
    if (dto.triggerType !== undefined) rule.triggerType = dto.triggerType
    if (dto.severity !== undefined) rule.severity = dto.severity
    if (dto.conditionConfig !== undefined)
      rule.conditionConfig = this.condition(dto.conditionConfig)
    if (dto.actions !== undefined) rule.actions = [...dto.actions]
    if (dto.description !== undefined) rule.description = dto.description?.trim() || null
    if (dto.enabled !== undefined) rule.enabled = dto.enabled
    rule.version = Number(rule.version || 0) + 1
    rule.updatedByAdminId = actor.id
    const saved = await this.dataSource.transaction(async (manager) => {
      const result = await manager.save(RiskRule, rule)
      await this.audit(
        manager,
        actor,
        AuditActionType.RISK_RULE_UPDATED,
        '风控规则已更新',
        result,
        before,
      )
      return result
    })
    return this.serialize(saved)
  }

  async toggle(id: string, enabled: boolean, actor: RiskRuleActor) {
    return this.update(id, { enabled }, actor)
  }

  async remove(id: string, actor: RiskRuleActor) {
    const rule = await this.require(id)
    await this.dataSource.transaction(async (manager) => {
      await manager.softRemove(RiskRule, rule)
      await this.audit(
        manager,
        actor,
        AuditActionType.RISK_RULE_DELETED,
        '风控规则已删除',
        rule,
        this.snapshot(rule),
      )
    })
    return { code: 0, message: '风控规则已删除' }
  }

  private async require(id: string) {
    const rule = await this.rules.findOne({ where: { id } })
    if (!rule) throw new NotFoundException('风控规则不存在')
    return rule
  }

  private condition(input: RiskRuleConditionDto) {
    const allowed = ['windowMinutes', 'threshold', 'multiplier', 'metric', 'scope']
    const condition = Object.fromEntries(
      Object.entries(input).filter(
        ([key, value]) =>
          allowed.includes(key) && value !== undefined && value !== null && value !== '',
      ),
    )
    if (!Object.keys(condition).length)
      throw new BadRequestException('规则条件至少需要一个受支持的配置项')
    return condition
  }

  private normalizeKey(value: string) {
    const key = value.trim().toLowerCase()
    if (!/^[a-z][a-z0-9_]{2,79}$/.test(key))
      throw new BadRequestException('规则标识只能使用小写字母、数字和下划线')
    return key
  }

  private snapshot(rule: RiskRule) {
    return {
      ruleKey: rule.ruleKey,
      name: rule.name,
      triggerType: rule.triggerType,
      severity: rule.severity,
      conditionConfig: rule.conditionConfig,
      actions: rule.actions,
      description: rule.description ?? null,
      enabled: rule.enabled,
      version: rule.version,
    }
  }

  private serialize(rule: RiskRule) {
    return {
      id: rule.id,
      ...this.snapshot(rule),
      createdAt: rule.createdAt,
      updatedAt: rule.updatedAt,
      updatedByAdminId: rule.updatedByAdminId ?? null,
    }
  }

  private audit(
    manager: any,
    actor: RiskRuleActor,
    actionType: AuditActionType,
    description: string,
    rule: RiskRule,
    beforeState: Record<string, unknown> | null,
  ) {
    return manager.save(AuditLog, {
      actorType: 'admin',
      actorId: actor.id,
      actorName: actor.name ?? null,
      actionType,
      actionDescription: description,
      targetType: 'risk_rule',
      targetId: rule.id,
      targetName: rule.name,
      beforeState,
      afterState: this.snapshot(rule),
      metadata: { version: rule.version },
      result: 'success',
    })
  }
}
