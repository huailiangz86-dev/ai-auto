// ============================================================
// AI auto - Withdrawal Entity
// Agent withdrawal requests
// ============================================================

import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm'
import { BaseEntity } from '../../common/entities/base.entity'
import { WithdrawalStatus } from '@ai-auto/shared'
import { AgentWallet } from '../../agent/entities/agent-wallet.entity'

@Entity('withdrawals')
@Index('idx_withdraw_wallet', ['walletId'])
@Index('idx_withdraw_status', ['status'])
@Index('idx_withdraw_idem', ['idempotencyKey'], { unique: true })
export class Withdrawal extends BaseEntity {
  // ---- Idempotency ----
  @Column({ name: 'idempotency_key', type: 'varchar', length: 100, unique: true })
  idempotencyKey!: string

  // ---- Links ----
  @Column({ name: 'wallet_id', type: 'uuid' })
  walletId!: string

  @Column({ name: 'agent_id', type: 'uuid' })
  agentId!: string

  // ---- Amount ----
  @Column({ name: 'amount', type: 'decimal', precision: 12, scale: 2 })
  amount!: number

  // Platform fee (if any)
  @Column({ name: 'platform_fee', type: 'decimal', precision: 12, scale: 2, default: 0 })
  platformFee!: number

  // Actual amount to receive
  @Column({ name: 'actual_amount', type: 'decimal', precision: 12, scale: 2 })
  actualAmount!: number

  // ---- Withdrawal Method ----
  // 'alipay' | 'wechatpay' | 'bank_card'
  @Column({ name: 'method', type: 'varchar', length: 30 })
  method!: string

  // Target account info
  @Column({ name: 'account_no', type: 'varchar', length: 100 })
  accountNo!: string

  @Column({ name: 'account_name', type: 'varchar', length: 100 })
  accountName!: string

  // Alipay: open_id, WeChat: openid, Bank: bank_code
  @Column({ name: 'account_identifier', type: 'varchar', length: 255, nullable: true })
  accountIdentifier?: string | null

  // ---- Status ----
  @Column({
    name: 'status',
    type: 'enum',
    enum: WithdrawalStatus,
    default: WithdrawalStatus.PENDING,
  })
  status!: WithdrawalStatus

  // ---- Processing ----
  @Column({ name: 'process_started_at', type: 'timestamptz', nullable: true })
  processStartedAt?: Date | null

  @Column({ name: 'process_completed_at', type: 'timestamptz', nullable: true })
  processCompletedAt?: Date | null

  @Column({ name: 'process_error', type: 'text', nullable: true })
  processError?: string | null

  @Column({ name: 'retry_count', type: 'int', default: 0 })
  retryCount!: number

  // Payment gateway transaction ID
  @Column({ name: 'payment_transaction_id', type: 'varchar', length: 100, nullable: true })
  paymentTransactionId?: string | null

  // ---- Balance Snapshot ----
  @Column({ name: 'wallet_balance_before', type: 'decimal', precision: 14, scale: 2 })
  walletBalanceBefore!: number

  @Column({ name: 'wallet_balance_after', type: 'decimal', precision: 14, scale: 2 })
  walletBalanceAfter!: number

  // ---- Admin Review ----
  @Column({ name: 'reviewed_by', type: 'uuid', nullable: true })
  reviewedBy?: string | null

  @Column({ name: 'reviewed_at', type: 'timestamptz', nullable: true })
  reviewedAt?: Date | null

  @Column({ name: 'reviewed_comment', type: 'text', nullable: true })
  reviewedComment?: string | null

  // ---- Relations ----
  @ManyToOne('AgentWallet', 'withdrawals')
  @JoinColumn({ name: 'wallet_id' })
  wallet!: any
}
