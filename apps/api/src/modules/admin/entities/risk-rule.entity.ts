import { Column, Entity, Index } from 'typeorm'
import { BaseEntity } from '../../common/entities/base.entity'

export const RISK_RULE_TRIGGER_TYPES = [
  'redemption_frequency',
  'redemption_rate',
  'self_redemption',
  'ip_clustering',
  'device_clustering',
  'commission_anomaly',
  'content_violation',
] as const

export const RISK_RULE_ACTIONS = [
  'create_alert',
  'manual_review',
  'freeze_commission',
  'pause_campaign',
  'restrict_relationship',
] as const

export type RiskRuleTriggerType = (typeof RISK_RULE_TRIGGER_TYPES)[number]
export type RiskRuleAction = (typeof RISK_RULE_ACTIONS)[number]
export type RiskRuleSeverity = 'critical' | 'warning' | 'notice'

/** Configurable, versioned policy metadata consumed by the risk evaluation pipeline. */
@Entity('risk_rules')
@Index('idx_risk_rule_key_active', ['ruleKey'], { unique: true, where: '"deletedAt" IS NULL' })
@Index('idx_risk_rule_enabled', ['enabled'])
@Index('idx_risk_rule_trigger', ['triggerType'])
export class RiskRule extends BaseEntity {
  @Column({ name: 'rule_key', type: 'varchar', length: 80 })
  ruleKey!: string

  @Column({ type: 'varchar', length: 120 })
  name!: string

  @Column({ name: 'trigger_type', type: 'varchar', length: 40 })
  triggerType!: RiskRuleTriggerType

  @Column({ type: 'varchar', length: 20, default: 'warning' })
  severity!: RiskRuleSeverity

  @Column({ name: 'condition_config', type: 'jsonb', default: () => "'{}'::jsonb" })
  conditionConfig!: Record<string, unknown>

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  actions!: RiskRuleAction[]

  @Column({ type: 'text', nullable: true })
  description?: string | null

  @Column({ type: 'boolean', default: true })
  enabled!: boolean

  @Column({ type: 'int', default: 1 })
  version!: number

  @Column({ name: 'created_by_admin_id', type: 'uuid', nullable: true })
  createdByAdminId?: string | null

  @Column({ name: 'updated_by_admin_id', type: 'uuid', nullable: true })
  updatedByAdminId?: string | null
}
