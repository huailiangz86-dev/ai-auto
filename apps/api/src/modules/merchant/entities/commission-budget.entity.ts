// ============================================================
// AI auto - Commission Budget Entity
// Merchant's digital wallet for commission rewards (prepaid model)
// ============================================================

import { Entity, Column, ManyToOne, OneToMany, JoinColumn, Index } from 'typeorm'
import { BaseEntity } from '../../common/entities/base.entity'
import { WalletTransactionType } from '@ai-auto/shared'

@Entity('commission_budgets')
@Index('idx_budget_merchant', ['merchantId'])
@Index('idx_budget_status', ['status'])
export class CommissionBudget extends BaseEntity {
  @Column({ name: 'merchant_id', type: 'uuid' })
  merchantId!: string

  @Column({ name: 'store_id', type: 'uuid', nullable: true })
  storeId?: string | null

  // ---- Balance ----
  @Column({ name: 'total_balance', type: 'decimal', precision: 14, scale: 2, default: 0 })
  totalBalance!: number

  @Column({ name: 'available_balance', type: 'decimal', precision: 14, scale: 2, default: 0 })
  availableBalance!: number

  @Column({ name: 'frozen_balance', type: 'decimal', precision: 14, scale: 2, default: 0 })
  frozenBalance!: number

  @Column({ name: 'total_spent', type: 'decimal', precision: 14, scale: 2, default: 0 })
  totalSpent!: number

  @Column({ name: 'total_topup', type: 'decimal', precision: 14, scale: 2, default: 0 })
  totalTopup!: number

  @Column({ type: 'boolean', default: true })
  status!: boolean

  @Column({ name: 'low_balance_threshold', type: 'decimal', precision: 12, scale: 2, default: 100 })
  lowBalanceThreshold!: number

  // ---- Relations ----
  @ManyToOne('Merchant', 'commissionBudgets')
  @JoinColumn({ name: 'merchant_id' })
  merchant!: any

  @OneToMany('BudgetTransaction', 'budget')
  transactions!: any[]
}

@Entity('budget_transactions')
@Index('idx_budget_tx_budget', ['budgetId'])
@Index('idx_budget_tx_type', ['type'])
@Index('idx_budget_tx_created', ['createdAt'])
export class BudgetTransaction extends BaseEntity {
  @Column({ name: 'budget_id', type: 'uuid' })
  budgetId!: string

  @Column({ type: 'enum', enum: WalletTransactionType })
  type!: WalletTransactionType

  @Column({ name: 'amount', type: 'decimal', precision: 12, scale: 2 })
  amount!: number

  @Column({ name: 'balance_before', type: 'decimal', precision: 14, scale: 2 })
  balanceBefore!: number

  @Column({ name: 'balance_after', type: 'decimal', precision: 14, scale: 2 })
  balanceAfter!: number

  @Column({ type: 'varchar', length: 500, nullable: true })
  description?: string | null

  @Column({ name: 'campaign_id', type: 'uuid', nullable: true })
  campaignId?: string | null

  @ManyToOne('CommissionBudget', 'transactions')
  @JoinColumn({ name: 'budget_id' })
  budget!: any
}
