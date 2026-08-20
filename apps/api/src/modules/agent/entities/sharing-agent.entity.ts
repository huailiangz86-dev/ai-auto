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
