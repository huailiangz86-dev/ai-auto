import { Column, Entity, Index } from 'typeorm'
import { BaseEntity } from '../../common/entities/base.entity'

export type CreatorTaskPayoutStatus =
  'estimated' | 'verified' | 'settled' | 'risk_hold' | 'rejected'

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
  @Column({ name: 'risk_hold_reason', type: 'text', nullable: true }) riskHoldReason?: string | null
  @Column({ name: 'risk_hold_previous_status', type: 'varchar', length: 24, nullable: true })
  riskHoldPreviousStatus?: CreatorTaskPayoutStatus | null
}

export type CreatorTaskAppealStatus = 'open' | 'accepted' | 'rejected' | 'withdrawn'

@Entity('creator_task_appeals')
@Index('idx_creator_task_appeal_creator_status', ['creatorId', 'status'])
@Index('idx_creator_task_appeal_task', ['creatorTaskId'])
export class CreatorTaskAppeal extends BaseEntity {
  @Column({ name: 'creator_task_id', type: 'uuid' }) creatorTaskId!: string
  @Column({ name: 'creator_id', type: 'uuid' }) creatorId!: string
  @Column({ name: 'payout_id', type: 'uuid', nullable: true }) payoutId?: string | null
  @Column({ type: 'varchar', length: 24 }) target!: 'task' | 'payout'
  @Column({ type: 'text' }) reason!: string
  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" }) evidence!: Record<string, unknown>
  @Column({ type: 'varchar', length: 16, default: 'open' }) status!: CreatorTaskAppealStatus
  @Column({ name: 'resolution', type: 'text', nullable: true }) resolution?: string | null
  @Column({ name: 'resolved_by', type: 'uuid', nullable: true }) resolvedBy?: string | null
  @Column({ name: 'resolved_at', type: 'timestamptz', nullable: true }) resolvedAt?: Date | null
}
