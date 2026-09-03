import { Column, Entity, Index } from 'typeorm'
import { BaseEntity } from '../../common/entities/base.entity'

export const PILOT_METRIC_EVENT_TYPES = [
  'campaign_activated', 'campaign_reinvested', 'task_invited', 'task_accepted', 'task_submitted',
  'task_reviewed', 'content_published', 'task_completed', 'result_verified', 'task_risk_held',
  'task_risk_resolved', 'campaign_credits_consumed',
] as const
export type PilotMetricEventType = (typeof PILOT_METRIC_EVENT_TYPES)[number]

/** Immutable facts. Dashboards aggregate this history, never mutable task state. */
@Entity('pilot_metric_events')
@Index('idx_pilot_event_occurred', ['occurredAt'])
@Index('idx_pilot_event_campaign_type', ['campaignId', 'eventType', 'occurredAt'])
@Index('idx_pilot_event_creator_type', ['creatorId', 'eventType', 'occurredAt'])
@Index('idx_pilot_event_task_type', ['creatorTaskId', 'eventType', 'occurredAt'])
@Index('idx_pilot_event_idempotency', ['idempotencyKey'], { unique: true })
export class PilotMetricEvent extends BaseEntity {
  @Column({ name: 'event_type', type: 'varchar', length: 48 }) eventType!: PilotMetricEventType
  @Column({ name: 'idempotency_key', type: 'varchar', length: 180 }) idempotencyKey!: string
  @Column({ name: 'subject_type', type: 'varchar', length: 32 }) subjectType!: string
  @Column({ name: 'subject_id', type: 'uuid' }) subjectId!: string
  @Column({ name: 'merchant_id', type: 'uuid' }) merchantId!: string
  @Column({ name: 'campaign_id', type: 'uuid', nullable: true }) campaignId?: string | null
  @Column({ name: 'growth_task_id', type: 'uuid', nullable: true }) growthTaskId?: string | null
  @Column({ name: 'creator_id', type: 'uuid', nullable: true }) creatorId?: string | null
  @Column({ name: 'creator_task_id', type: 'uuid', nullable: true }) creatorTaskId?: string | null
  @Column({ name: 'occurred_at', type: 'timestamptz' }) occurredAt!: Date
  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" }) metadata!: Record<string, unknown>
}