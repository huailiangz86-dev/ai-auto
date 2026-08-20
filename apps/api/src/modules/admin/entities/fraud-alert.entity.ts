// ============================================================
// AI auto - FraudAlert Entity
// Fraud detection alerts for risk management
// ============================================================

import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm'
import { BaseEntity } from '../../common/entities/base.entity'
import { SharingAgent } from '../../agent/entities/sharing-agent.entity'
import { Merchant } from '../../merchant/entities/merchant.entity'
import { Redemption } from '../../commission/entities/redemption.entity'

@Entity('fraud_alerts')
@Index('idx_fraud_status', ['status'])
@Index('idx_fraud_severity', ['severity'])
@Index('idx_fraud_created', ['createdAt'])
export class FraudAlert extends BaseEntity {
  // ---- Alert Type ----
  @Column({ name: 'alert_type', type: 'varchar', length: 50 })
  alertType!: string
  // 'suspicious_self_redemption' | 'high_frequency_redemption' |
  // 'merchant_abnormal_rate' | 'coupon_stacking' | 'device_fingerprint' |
  // 'ip_clustering' | 'commission_anomaly' | 'content_violation'

  // ---- Severity ----
  // critical: immediate freeze required
  // warning: review within 24h
  // notice: log only, no action
  @Column({
    name: 'severity',
    type: 'varchar',
    length: 20,
    default: 'warning',
  })
  severity!: string

  // ---- Confidence Score ----
  // 0.0 - 1.0, AI model output
  @Column({ name: 'confidence_score', type: 'decimal', precision: 4, scale: 3 })
  confidenceScore!: number

  // ---- Status ----
  // pending: awaiting review
  // reviewed: human reviewed
  // actioned: action has been taken
  // dismissed: false positive
  @Column({
    name: 'status',
    type: 'varchar',
    length: 20,
    default: 'pending',
  })
  status!: string

  // ---- Involved Parties ----
  @Column({ name: 'agent_id', type: 'uuid', nullable: true })
  agentId?: string | null

  @Column({ name: 'merchant_id', type: 'uuid', nullable: true })
  merchantId?: string | null

  @Column({ name: 'redemption_id', type: 'uuid', nullable: true })
  redemptionId?: string | null

  // ---- Evidence ----
  // JSON array of evidence items
  @Column({ name: 'evidence', type: 'jsonb' })
  evidence!: {
    type: string
    description: string
    value: string | number
    threshold?: number
  }[]

  // ---- AI Model Output ----
  @Column({ name: 'ai_model_output', type: 'jsonb', nullable: true })
  aiModelOutput?: Record<string, any> | null

  @Column({ name: 'ai_model_name', type: 'varchar', length: 50, nullable: true })
  aiModelName?: string | null

  // ---- Automatic Actions Taken ----
  @Column({ name: 'auto_action_taken', type: 'varchar', length: 100, nullable: true })
  autoActionTaken?: string | null
  // 'redemption_blocked' | 'commission_frozen' | 'agent_suspended' |
  // 'merchant_notified' | 'content_blocked'

  // ---- Manual Review ----
  @Column({ name: 'reviewed_by', type: 'uuid', nullable: true })
  reviewedBy?: string | null

  @Column({ name: 'reviewed_at', type: 'timestamptz', nullable: true })
  reviewedAt?: Date | null

  @Column({ name: 'review_notes', type: 'text', nullable: true })
  reviewNotes?: string | null

  // Final action taken
  @Column({ name: 'final_action', type: 'varchar', length: 50, nullable: true })
  finalAction?: string | null
  // 'freeze_commission' | 'suspend_agent' | 'suspend_merchant' |
  // 'mark_suspicious' | 'contact_merchant' | 'contact_agent' | 'dismiss'

  // ---- Notification ----
  @Column({ name: 'merchant_notified', type: 'boolean', default: false })
  merchantNotified!: boolean

  @Column({ name: 'agent_notified', type: 'boolean', default: false })
  agentNotified!: boolean

  @Column({ name: 'notified_at', type: 'timestamptz', nullable: true })
  notifiedAt?: Date | null

  // ---- Relations ----
  @ManyToOne('SharingAgent')
  @JoinColumn({ name: 'agent_id' })
  agent?: SharingAgent | null

  @ManyToOne('Merchant')
  @JoinColumn({ name: 'merchant_id' })
  merchant?: Merchant | null

  @ManyToOne('Redemption')
  @JoinColumn({ name: 'redemption_id' })
  redemption?: Redemption | null
}
