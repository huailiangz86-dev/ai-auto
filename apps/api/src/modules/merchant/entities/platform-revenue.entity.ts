// ============================================================
// AI auto - PlatformRevenue Entity
// Platform revenue records (20% commission fee from each redemption)
// Immutable append-only ledger
// ============================================================

import { Entity, Column, Index } from 'typeorm'
import { BaseEntity } from '../../common/entities/base.entity'

@Entity('platform_revenues')
@Index('idx_pr_type', ['revenueType'])
@Index('idx_pr_date', ['revenueDate'])
@Index('idx_pr_merchant', ['merchantId'])
@Index('idx_pr_agent', ['agentId'])
export class PlatformRevenue extends BaseEntity {
  // ---- Revenue Type ----
  // 'commission_royalty': 20% from agent commission
  // 'subscription': merchant subscription fee
  // 'ai_token': AI token sales
  // 'refund': refund record (negative)
  @Column({ name: 'revenue_type', type: 'varchar', length: 30 })
  revenueType!: string

  // ---- Amount ----
  // Positive for income, negative for refund/expense
  @Column({ name: 'amount', type: 'decimal', precision: 14, scale: 2 })
  amount!: number

  // ---- Source Reference ----
  // Commission royalty: links to commission record
  // Subscription: links to subscription record
  @Column({ name: 'commission_id', type: 'uuid', nullable: true })
  commissionId?: string | null

  @Column({ name: 'subscription_id', type: 'uuid', nullable: true })
  subscriptionId?: string | null

  @Column({ name: 'merchant_id', type: 'uuid', nullable: true })
  merchantId?: string | null

  @Column({ name: 'agent_id', type: 'uuid', nullable: true })
  agentId?: string | null

  // ---- Period ----
  // Daily aggregation key (YYYY-MM-DD)
  @Column({ name: 'revenue_date', type: 'date' })
  revenueDate!: Date

  // ---- Balance ----
  // Running balance after this transaction
  @Column({ name: 'balance_before', type: 'decimal', precision: 14, scale: 2 })
  balanceBefore!: number

  @Column({ name: 'balance_after', type: 'decimal', precision: 14, scale: 2 })
  balanceAfter!: number

  // ---- Settlement ----
  @Column({ name: 'settled', type: 'boolean', default: false })
  settled!: boolean

  @Column({ name: 'settled_at', type: 'timestamptz', nullable: true })
  settledAt?: Date | null

  // ---- Metadata ----
  @Column({ name: 'description', type: 'varchar', length: 500, nullable: true })
  description?: string | null

  // JSON metadata (e.g., campaign info, customer count, etc.)
  @Column({ name: 'metadata', type: 'jsonb', nullable: true })
  metadata?: Record<string, any> | null
}
