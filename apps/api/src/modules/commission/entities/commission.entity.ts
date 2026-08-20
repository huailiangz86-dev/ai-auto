// ============================================================
// AI auto - Commission Entity
// Agent commission records (calculated on redemption verification)
// 80% to agent, 20% platform fee, with level multiplier
// ============================================================

import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm'
import { BaseEntity } from '../../common/entities/base.entity'
import { CommissionTransactionType } from '@ai-auto/shared'
import { AgentWallet } from '../../agent/entities/agent-wallet.entity'
import { Redemption } from './redemption.entity'

@Entity('commissions')
@Index('idx_comm_wallet', ['walletId'])
@Index('idx_comm_status', ['status'])
@Index('idx_comm_settle_batch', ['settleBatch'])
@Index('idx_comm_idem', ['idempotencyKey'], { unique: true })
@Index('idx_comm_created', ['createdAt'])
export class Commission extends BaseEntity {
  // ---- Idempotency ----
  @Column({ name: 'idempotency_key', type: 'varchar', length: 100, unique: true })
  idempotencyKey!: string

  // ---- Links ----
  @Column({ name: 'wallet_id', type: 'uuid' })
  walletId!: string

  @Column({ name: 'redemption_id', type: 'uuid' })
  redemptionId!: string

  // ---- Amounts ----
  // Merchant's reward amount for this redemption
  @Column({ name: 'merchant_reward', type: 'decimal', precision: 12, scale: 2 })
  merchantReward!: number

  // Platform's 20% fee
  @Column({ name: 'platform_fee', type: 'decimal', precision: 12, scale: 2 })
  platformFee!: number

  // Agent's base payout (80% of merchant reward)
  @Column({ name: 'agent_base_payout', type: 'decimal', precision: 12, scale: 2 })
  agentBasePayout!: number

  // Agent's final payout after level multiplier
  @Column({ name: 'agent_final_payout', type: 'decimal', precision: 12, scale: 2 })
  agentFinalPayout!: number

  @Column({ name: 'level_multiplier', type: 'decimal', precision: 4, scale: 2 })
  levelMultiplier!: number

  // ---- Attribution Info ----
  @Column({ name: 'agent_id', type: 'uuid' })
  agentId!: string

  @Column({ name: 'customer_id', type: 'uuid' })
  customerId!: string

  @Column({ name: 'campaign_id', type: 'uuid', nullable: true })
  campaignId?: string | null

  @Column({ name: 'attribution_id', type: 'uuid', nullable: true })
  attributionId?: string | null

  @Column({ name: 'merchant_id', type: 'uuid' })
  merchantId!: string

  // ---- Settlement ----
  // 'pending' | 'settled' | 'frozen'
  @Column({ name: 'status', type: 'varchar', length: 20, default: 'pending' })
  status!: string

  @Column({ name: 'settle_batch', type: 'varchar', length: 50, nullable: true })
  settleBatch?: string | null

  @Column({ name: 'settled_at', type: 'timestamptz', nullable: true })
  settledAt?: Date | null

  // T+3 settlement: when this commission will be settled
  @Column({ name: 'settle_at', type: 'date' })
  settleAt!: Date

  // ---- Balance Snapshot at Creation ----
  @Column({ name: 'wallet_balance_before', type: 'decimal', precision: 14, scale: 2 })
  walletBalanceBefore!: number

  @Column({ name: 'wallet_balance_after', type: 'decimal', precision: 14, scale: 2 })
  walletBalanceAfter!: number

  // ---- Relations ----
  @ManyToOne('AgentWallet', 'commissions')
  @JoinColumn({ name: 'wallet_id' })
  wallet!: any

  @ManyToOne('Redemption')
  @JoinColumn({ name: 'redemption_id' })
  redemption!: any
}
