// ============================================================
// AI auto - Agent Wallet Entity
// Agent's commission wallet with balance management
// ============================================================

import { Entity, Column, ManyToOne, OneToMany, JoinColumn, Index } from 'typeorm'
import { BaseEntity } from '../../common/entities/base.entity'
import { SharingAgent } from './sharing-agent.entity'

@Entity('agent_wallets')
@Index('idx_wallet_agent', ['agentId'])
@Index('idx_wallet_status', ['status'])
export class AgentWallet extends BaseEntity {
  @Column({ name: 'agent_id', type: 'uuid', unique: true })
  agentId!: string

  // ---- Balances ----
  // pending_settlement: earned but not yet settled (T+3)
  @Column({
    name: 'pending_settlement_balance',
    type: 'decimal',
    precision: 14,
    scale: 2,
    default: 0,
  })
  pendingSettlementBalance!: number

  // settled: available for withdrawal
  @Column({ name: 'settled_balance', type: 'decimal', precision: 14, scale: 2, default: 0 })
  settledBalance!: number

  // frozen: temporarily locked (e.g., withdrawal in progress)
  @Column({ name: 'frozen_balance', type: 'decimal', precision: 14, scale: 2, default: 0 })
  frozenBalance!: number

  // ---- Lifetime Stats ----
  @Column({ name: 'total_earned', type: 'decimal', precision: 14, scale: 2, default: 0 })
  totalEarned!: number

  @Column({ name: 'total_platform_fee', type: 'decimal', precision: 14, scale: 2, default: 0 })
  totalPlatformFee!: number

  @Column({ name: 'total_settled', type: 'decimal', precision: 14, scale: 2, default: 0 })
  totalSettled!: number

  @Column({ name: 'total_withdrawn', type: 'decimal', precision: 14, scale: 2, default: 0 })
  totalWithdrawn!: number

  // ---- Last Settlement ----
  @Column({ name: 'last_settlement_at', type: 'timestamptz', nullable: true })
  lastSettlementAt?: Date | null

  // ---- Wallet Status ----
  @Column({ type: 'boolean', default: true })
  status!: boolean

  // ---- AI Token Balance ----
  // Deducted from commission when agent uses AI content generation
  @Column({ name: 'ai_token_balance', type: 'decimal', precision: 12, scale: 4, default: 0 })
  aiTokenBalance!: number

  // ---- Relations ----
  @ManyToOne('SharingAgent', 'wallets')
  @JoinColumn({ name: 'agent_id' })
  agent!: any

  @OneToMany('Commission', 'wallet')
  commissions!: any[]

  @OneToMany('Withdrawal', 'wallet')
  withdrawals!: any[]
}
