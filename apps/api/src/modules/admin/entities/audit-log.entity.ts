// ============================================================
// AI auto - Audit Log Entity
// Immutable audit trail for all sensitive operations
// ============================================================

import { Entity, Column, Index } from 'typeorm'
import { BaseEntity } from '../../common/entities/base.entity'
import { AuditActionType } from '@ai-auto/shared'

@Entity('audit_logs')
@Index('idx_audit_action_type', ['actionType'])
@Index('idx_audit_actor', ['actorType', 'actorId'])
@Index('idx_audit_target', ['targetType', 'targetId'])
@Index('idx_audit_created', ['createdAt'])
export class AuditLog extends BaseEntity {
  // ---- Who ----
  @Column({ name: 'actor_type', type: 'varchar', length: 30 })
  actorType!: string // 'admin' | 'system' | 'merchant' | 'agent'

  @Column({ name: 'actor_id', type: 'uuid', nullable: true })
  actorId?: string | null

  @Column({ name: 'actor_name', type: 'varchar', length: 100, nullable: true })
  actorName?: string | null

  @Column({ name: 'actor_ip', type: 'varchar', length: 45, nullable: true })
  actorIp?: string | null

  // ---- What ----
  @Column({
    name: 'action_type',
    type: 'enum',
    enum: AuditActionType,
  })
  actionType!: AuditActionType

  @Column({ name: 'action_description', type: 'varchar', length: 500 })
  actionDescription!: string

  // ---- On What ----
  @Column({ name: 'target_type', type: 'varchar', length: 30 })
  targetType!: string // 'merchant' | 'agent' | 'campaign' | 'redemption' | 'commission' | 'withdrawal' | 'content'

  @Column({ name: 'target_id', type: 'uuid', nullable: true })
  targetId?: string | null

  @Column({ name: 'target_name', type: 'varchar', length: 200, nullable: true })
  targetName?: string | null

  // ---- Details (immutable snapshot) ----
  // Previous state (for updates/changes)
  @Column({ name: 'before_state', type: 'jsonb', nullable: true })
  beforeState?: Record<string, any> | null

  // New state (for creates/updates)
  @Column({ name: 'after_state', type: 'jsonb', nullable: true })
  afterState?: Record<string, any> | null

  // Additional context
  @Column({ name: 'metadata', type: 'jsonb', nullable: true })
  metadata?: Record<string, any> | null

  // ---- Result ----
  // 'success' | 'failure' | 'partial'
  @Column({ name: 'result', type: 'varchar', length: 20, default: 'success' })
  result!: string

  @Column({ name: 'failure_reason', type: 'text', nullable: true })
  failureReason?: string | null
}
