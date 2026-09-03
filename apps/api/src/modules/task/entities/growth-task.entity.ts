import { Column, Entity, Index } from 'typeorm'
import { BaseEntity } from '../../common/entities/base.entity'

export type GrowthTaskStatus =
  'draft' | 'ready_for_review' | 'active' | 'paused' | 'completed' | 'cancelled'
export const CREATOR_TASK_STATUSES = [
  'created',
  'matching',
  'invited',
  'accepted',
  'creating',
  'submitted',
  'approved',
  'published',
  'tracking',
  'completed',
  'settled',
  'rejected',
  'expired',
  'cancelled',
  'violation',
  'risk_hold',
] as const
export type CreatorTaskStatus = (typeof CREATOR_TASK_STATUSES)[number]

@Entity('growth_tasks')
@Index('idx_growth_task_merchant_status', ['merchantId', 'status'])
@Index('idx_growth_task_campaign', ['campaignId'])
export class GrowthTask extends BaseEntity {
  @Column({ name: 'merchant_id', type: 'uuid' }) merchantId!: string
  @Column({ name: 'store_id', type: 'uuid', nullable: true }) storeId?: string | null
  @Column({ name: 'campaign_id', type: 'uuid', nullable: true }) campaignId?: string | null
  @Column({ name: 'goal_metric', type: 'varchar', length: 80 }) goalMetric!: string
  @Column({ name: 'baseline_value', type: 'decimal', precision: 14, scale: 2, default: 0 })
  baselineValue!: number
  @Column({ name: 'target_value', type: 'decimal', precision: 14, scale: 2 }) targetValue!: number
  @Column({ type: 'decimal', precision: 14, scale: 2 }) budget!: number
  @Column({ name: 'compensation_reserved', type: 'decimal', precision: 14, scale: 2, default: 0 })
  compensationReserved!: number
  @Column({
    name: 'campaign_credits_reserved',
    type: 'decimal',
    precision: 14,
    scale: 2,
    default: 0,
  })
  campaignCreditsReserved!: number
  @Column({ name: 'start_at', type: 'timestamptz' }) startAt!: Date
  @Column({ name: 'end_at', type: 'timestamptz' }) endAt!: Date
  @Column({ name: 'acceptable_risk_boundary', type: 'text', nullable: true })
  acceptableRiskBoundary?: string | null
  @Column({
    name: 'acceptable_roi_boundary',
    type: 'decimal',
    precision: 10,
    scale: 4,
    nullable: true,
  })
  acceptableRoiBoundary?: number | null
  @Column({ type: 'varchar', length: 24, default: 'draft' }) status!: GrowthTaskStatus
}

@Entity('creator_tasks')
@Index('idx_creator_task_creator_status', ['creatorId', 'status'])
@Index('idx_creator_task_growth_task', ['growthTaskId'])
@Index('idx_creator_task_campaign_tracking', ['campaignId', 'trackingId'])
export class CreatorTask extends BaseEntity {
  @Column({ name: 'growth_task_id', type: 'uuid' }) growthTaskId!: string
  @Column({ name: 'campaign_id', type: 'uuid', nullable: true }) campaignId?: string | null
  @Column({ name: 'merchant_id', type: 'uuid' }) merchantId!: string
  @Column({ name: 'store_id', type: 'uuid', nullable: true }) storeId?: string | null
  @Column({ name: 'creator_id', type: 'uuid' }) creatorId!: string
  @Column({ type: 'varchar', length: 40 }) channel!: string
  @Column({ name: 'content_type', type: 'varchar', length: 40 }) contentType!: string
  @Column({ type: 'text' }) brief!: string
  @Column({ type: 'timestamptz' }) deadline!: Date
  @Column({ name: 'base_reward', type: 'decimal', precision: 14, scale: 2 }) baseReward!: number
  @Column({ name: 'performance_reward', type: 'jsonb', default: () => "'{}'::jsonb" })
  performanceReward!: Record<string, unknown>
  @Column({
    name: 'campaign_credits_allocated',
    type: 'decimal',
    precision: 14,
    scale: 2,
    default: 0,
  })
  campaignCreditsAllocated!: number
  @Column({
    name: 'campaign_credits_consumed',
    type: 'decimal',
    precision: 14,
    scale: 2,
    default: 0,
  })
  campaignCreditsConsumed!: number
  @Column({ name: 'tracking_id', type: 'varchar', length: 120, nullable: true }) trackingId?:
    string | null
  @Column({ name: 'published_url', type: 'text', nullable: true }) publishedUrl?: string | null
  @Column({ type: 'varchar', length: 24, default: 'created' }) status!: CreatorTaskStatus
  @Column({ name: 'compensation_snapshot', type: 'jsonb', nullable: true })
  compensationSnapshot?: Record<string, unknown> | null
  @Column({ name: 'compensation_locked_at', type: 'timestamptz', nullable: true })
  compensationLockedAt?: Date | null
  @Column({ name: 'review_reason', type: 'text', nullable: true }) reviewReason?: string | null
  @Column({ name: 'reviewed_by', type: 'uuid', nullable: true }) reviewedBy?: string | null
  @Column({ name: 'reviewed_at', type: 'timestamptz', nullable: true }) reviewedAt?: Date | null
  @Column({ name: 'risk_hold_reason', type: 'text', nullable: true }) riskHoldReason?: string | null
  @Column({ name: 'risk_hold_previous_status', type: 'varchar', length: 24, nullable: true })
  riskHoldPreviousStatus?: CreatorTaskStatus | null
  @Column({ name: 'state_reason', type: 'text', nullable: true }) stateReason?: string | null
  @Column({ name: 'state_changed_by', type: 'uuid', nullable: true }) stateChangedBy?: string | null
  @Column({ name: 'state_changed_at', type: 'timestamptz', nullable: true })
  stateChangedAt?: Date | null
}

export type CampaignCreditEntryType = 'allocation' | 'consumption' | 'release'
@Entity('campaign_credit_ledger')
@Index('idx_campaign_credit_task_created', ['creatorTaskId', 'createdAt'])
@Index('idx_campaign_credit_idempotency', ['idempotencyKey'], { unique: true })
export class CampaignCreditLedgerEntry extends BaseEntity {
  @Column({ name: 'creator_task_id', type: 'uuid' }) creatorTaskId!: string
  @Column({ name: 'growth_task_id', type: 'uuid' }) growthTaskId!: string
  @Column({ name: 'merchant_id', type: 'uuid' }) merchantId!: string
  @Column({ name: 'entry_type', type: 'varchar', length: 20 }) entryType!: CampaignCreditEntryType
  @Column({ type: 'decimal', precision: 14, scale: 2 }) amount!: number
  @Column({ name: 'idempotency_key', type: 'varchar', length: 160 }) idempotencyKey!: string
  @Column({ name: 'source_reference', type: 'varchar', length: 120, nullable: true })
  sourceReference?: string | null
  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" }) metadata!: Record<string, unknown>
}
