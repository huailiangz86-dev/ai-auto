import { Column, Entity, Index } from 'typeorm'
import { BaseEntity } from '../../common/entities/base.entity'

export type CreatorTaskPayoutStatus =
  'estimated' | 'verified' | 'settled' | 'risk_hold' | 'rejected' | 'reversed'

@Entity('creator_task_payouts')
@Index('idx_creator_task_payout_creator_status', ['creatorId', 'status'])
@Index('idx_creator_task_payout_settle_at', ['status', 'settleAt'])
export class CreatorTaskPayout extends BaseEntity {
  @Column({ name: 'creator_task_id', type: 'uuid', unique: true }) creatorTaskId!: string
  @Column({ name: 'creator_id', type: 'uuid' }) creatorId!: string
  @Column({ name: 'merchant_id', type: 'uuid' }) merchantId!: string
  @Column({ name: 'campaign_id', type: 'uuid', nullable: true }) campaignId?: string | null
  @Column({ name: 'expected_amount', type: 'decimal', precision: 14, scale: 2 })
  expectedAmount!: number
  @Column({ name: 'verified_amount', type: 'decimal', precision: 14, scale: 2, nullable: true })
  verifiedAmount?: number | null
  @Column({ type: 'varchar', length: 24, default: 'estimated' }) status!: CreatorTaskPayoutStatus
  @Column({ name: 'verification_evidence', type: 'jsonb', default: () => "'{}'::jsonb" })
  verificationEvidence!: Record<string, unknown>
  @Column({ name: 'verified_at', type: 'timestamptz', nullable: true }) verifiedAt?: Date | null
  @Column({ name: 'settle_at', type: 'date', nullable: true }) settleAt?: Date | null
  @Column({ name: 'settled_at', type: 'timestamptz', nullable: true }) settledAt?: Date | null
  // Amount withheld at settlement to reduce a prior adjudicated recovery receivable.
  // The gross verified amount remains intact for fulfilment-cost reporting.
  @Column({ name: 'recovery_offset_amount', type: 'decimal', precision: 14, scale: 2, default: 0 })
  recoveryOffsetAmount!: number
  @Column({ name: 'risk_hold_reason', type: 'text', nullable: true }) riskHoldReason?: string | null
  @Column({ name: 'risk_hold_previous_status', type: 'varchar', length: 24, nullable: true })
  riskHoldPreviousStatus?: CreatorTaskPayoutStatus | null
  // The original verified amount is retained. Adjudication is represented as an
  // append-only adjustment/reversal entry rather than overwriting settlement history.
  @Column({ name: 'adjudicated_amount', type: 'decimal', precision: 14, scale: 2, nullable: true })
  adjudicatedAmount?: number | null
  @Column({ name: 'adjudicated_at', type: 'timestamptz', nullable: true })
  adjudicatedAt?: Date | null
}

export type CreatorTaskAppealStatus = 'open' | 'accepted' | 'rejected' | 'withdrawn'
export type CreatorTaskAppealAppellantType = 'creator' | 'merchant'
export type CreatorTaskAppealDecision = 'uphold' | 'adjust_payout' | 'reverse_settlement'

@Entity('creator_task_appeals')
@Index('idx_creator_task_appeal_creator_status', ['creatorId', 'status'])
@Index('idx_creator_task_appeal_task', ['creatorTaskId'])
export class CreatorTaskAppeal extends BaseEntity {
  @Column({ name: 'creator_task_id', type: 'uuid' }) creatorTaskId!: string
  @Column({ name: 'creator_id', type: 'uuid' }) creatorId!: string
  @Column({ name: 'merchant_id', type: 'uuid' }) merchantId!: string
  @Column({ name: 'payout_id', type: 'uuid', nullable: true }) payoutId?: string | null
  @Column({ name: 'appellant_type', type: 'varchar', length: 16, default: 'creator' })
  appellantType!: CreatorTaskAppealAppellantType
  @Column({ type: 'varchar', length: 24 }) target!: 'task' | 'payout'
  @Column({ name: 'appeal_deadline_at', type: 'timestamptz' }) appealDeadlineAt!: Date
  @Column({ type: 'text' }) reason!: string
  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" }) evidence!: Record<string, unknown>
  @Column({ type: 'varchar', length: 16, default: 'open' }) status!: CreatorTaskAppealStatus
  @Column({ name: 'resolution', type: 'text', nullable: true }) resolution?: string | null
  @Column({ name: 'resolved_by', type: 'uuid', nullable: true }) resolvedBy?: string | null
  @Column({ name: 'resolved_at', type: 'timestamptz', nullable: true }) resolvedAt?: Date | null
  @Column({ name: 'adjudication_decision', type: 'varchar', length: 24, nullable: true })
  adjudicationDecision?: CreatorTaskAppealDecision | null
  @Column({ name: 'amount_before', type: 'decimal', precision: 14, scale: 2, nullable: true })
  amountBefore?: number | null
  @Column({ name: 'amount_after', type: 'decimal', precision: 14, scale: 2, nullable: true })
  amountAfter?: number | null
  @Column({ name: 'financial_ledger_entry_ids', type: 'jsonb', default: () => "'[]'::jsonb" })
  financialLedgerEntryIds!: string[]
  // Recovery progress is kept per adjudication instead of only as a wallet
  // aggregate, so a later settlement can be reconciled to its source ruling.
  @Column({ name: 'recovery_amount', type: 'decimal', precision: 14, scale: 2, default: 0 })
  recoveryAmount!: number
  @Column({ name: 'recovery_recovered_amount', type: 'decimal', precision: 14, scale: 2, default: 0 })
  recoveryRecoveredAmount!: number
  @Column({ name: 'recovery_completed_at', type: 'timestamptz', nullable: true })
  recoveryCompletedAt?: Date | null
}
