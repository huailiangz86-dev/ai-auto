// ============================================================
// AI auto - Sharing Agent Entity
// Represents a sharing agent on the platform
// ============================================================

import { Entity, Column, ManyToOne, OneToMany, JoinColumn, Index } from 'typeorm'
import { Exclude } from 'class-transformer'
import { BaseEntity } from '../../common/entities/base.entity'
import { AgentLevel, AuditStatus } from '@ai-auto/shared'

@Entity('sharing_agents')
@Index('idx_agent_phone', ['phone'])
@Index('idx_agent_status', ['status'])
@Index('idx_agent_level', ['level'])
@Index('idx_agent_valid_customers', ['validCustomerCount'])
@Index('idx_agent_creator_governance', ['status', 'blacklistedAt', 'creatorGrowthLevel'])
@Index('idx_agent_type', ['agentType'])
export class SharingAgent extends BaseEntity {
  // ---- Basic Info ----
  @Column({ type: 'varchar', length: 20 })
  phone!: string

  @Column({ type: 'varchar', length: 100, nullable: true })
  nickname?: string | null

  @Column({ type: 'varchar', length: 255, nullable: true })
  avatar?: string | null

  @Column({ type: 'varchar', length: 255, select: false })
  @Exclude()
  passwordHash!: string

  // ---- Real Name Verification ----
  @Column({ name: 'real_name', type: 'varchar', length: 100, nullable: true })
  realName?: string | null

  @Column({ name: 'id_card_no', type: 'varchar', length: 50, nullable: true, select: false })
  @Exclude()
  idCardNo?: string | null

  @Column({
    name: 'real_name_verified',
    type: 'boolean',
    default: false,
  })
  realNameVerified!: boolean

  // ---- Audit ----
  @Column({
    name: 'audit_status',
    type: 'enum',
    enum: AuditStatus,
    default: AuditStatus.PENDING,
  })
  auditStatus!: AuditStatus

  @Column({ name: 'audit_comment', type: 'text', nullable: true })
  auditComment?: string | null

  @Column({ name: 'agent_type', type: 'varchar', length: 32, default: 'ordinary_user' })
  agentType!: 'professional_creator' | 'ordinary_user'

  // ---- v2 Creator Profile / Governance ----
  @Column({ name: 'region', type: 'varchar', length: 100, nullable: true })
  region?: string | null

  @Column({ name: 'creator_categories', type: 'jsonb', default: () => "'[]'::jsonb" })
  creatorCategories!: string[]

  @Column({ name: 'task_preferences', type: 'jsonb', default: () => "'{}'::jsonb" })
  taskPreferences!: Record<string, unknown>

  @Column({ name: 'creator_growth_score', type: 'int', default: 0 })
  creatorGrowthScore!: number

  @Column({ name: 'creator_growth_level', type: 'smallint', default: 1 })
  creatorGrowthLevel!: number

  @Column({ name: 'creator_score_breakdown', type: 'jsonb', default: () => "'{}'::jsonb" })
  creatorScoreBreakdown!: Record<string, number>

  @Column({ name: 'creator_score_updated_at', type: 'timestamptz', nullable: true })
  creatorScoreUpdatedAt?: Date | null

  @Column({ name: 'blacklisted_at', type: 'timestamptz', nullable: true })
  blacklistedAt?: Date | null

  @Column({ name: 'blacklist_reason', type: 'text', nullable: true })
  blacklistReason?: string | null

  @Column({ name: 'frozen_at', type: 'timestamptz', nullable: true })
  frozenAt?: Date | null

  @Column({ name: 'frozen_reason', type: 'text', nullable: true })
  frozenReason?: string | null

  @Column({ name: 'creator_task_limit', type: 'int', nullable: true })
  creatorTaskLimit?: number | null

  @Column({ name: 'operation_tags', type: 'jsonb', default: () => "'[]'::jsonb" })
  operationTags!: string[]
  // ---- Reputation / Level System ----
  @Column({
    type: 'enum',
    enum: AgentLevel,
    default: AgentLevel.BRONZE,
  })
  level!: AgentLevel

  @Column({ name: 'reputation_score', type: 'int', default: 0 })
  reputationScore!: number

  // Valid customers = customers who have redeemed at least once
  @Column({ name: 'valid_customer_count', type: 'int', default: 0 })
  validCustomerCount!: number

  @Column({ name: 'commission_multiplier', type: 'decimal', precision: 4, scale: 2, default: 1.0 })
  commissionMultiplier!: number

  @Column({ name: 'level_updated_at', type: 'timestamptz', nullable: true })
  levelUpdatedAt?: Date | null

  // ---- Aggregated Stats ----
  @Column({ name: 'total_earned', type: 'decimal', precision: 14, scale: 2, default: 0 })
  totalEarned!: number

  @Column({ name: 'total_withdrawn', type: 'decimal', precision: 14, scale: 2, default: 0 })
  totalWithdrawn!: number

  // ---- Status ----
  @Column({ type: 'boolean', default: true })
  status!: boolean // true = active, false = banned

  // ---- Bank Account (for withdrawals) ----
  @Column({ name: 'bank_name', type: 'varchar', length: 100, nullable: true })
  bankName?: string | null

  @Column({ name: 'bank_account_no', type: 'varchar', length: 50, nullable: true, select: false })
  @Exclude()
  bankAccountNo?: string | null

  @Column({ name: 'bank_account_name', type: 'varchar', length: 100, nullable: true })
  bankAccountName?: string | null

  // ---- Relations ----
  @OneToMany('AgentPlatformAccount', 'agent')
  platformAccounts!: any[]

  @OneToMany('AgentWallet', 'agent')
  wallets!: any[]
}
