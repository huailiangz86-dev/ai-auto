// ============================================================
// AI auto - Merchant Agent Binding Entity
// Merchant recruits sharing agents and binds them to stores
// One agent can bind to multiple merchants; one merchant can have multiple agents
// ============================================================

import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm'
import { BaseEntity } from '../../common/entities/base.entity'
import { AuditStatus } from '@ai-auto/shared'

@Entity('merchant_agent_bindings')
@Index('idx_mab_merchant', ['merchantId'])
@Index('idx_mab_agent', ['agentId'])
@Index('idx_mab_code', ['inviteCode'], { unique: true })
@Index('idx_mab_merchant_agent', ['merchantId', 'agentId'])
export class MerchantAgentBinding extends BaseEntity {
  // ---- Parties ----
  @Column({ name: 'merchant_id', type: 'uuid' })
  merchantId!: string

  @Column({ name: 'agent_id', type: 'uuid', nullable: true })
  agentId?: string | null // null until agent registers

  // ---- Store binding ----
  @Column({ name: 'store_id', type: 'uuid', nullable: true })
  storeId?: string | null // null = all stores

  // ---- Invite Code ----
  @Column({ name: 'invite_code', type: 'varchar', length: 20, unique: true })
  inviteCode!: string

  // ---- Binding Status ----
  // 'pending': invite created, agent not yet registered
  // 'registered': agent registered, awaiting merchant approval
  // 'active': merchant approved, binding is active
  // 'rejected': merchant rejected
  // 'unbound': agent unbound from merchant
  @Column({ name: 'binding_status', type: 'varchar', length: 20, default: 'pending' })
  bindingStatus!: string

  // ---- Audit ----
  @Column({
    name: 'audit_status',
    type: 'enum',
    enum: AuditStatus,
    default: AuditStatus.PENDING,
  })
  auditStatus!: AuditStatus

  @Column({ name: 'audit_comment', type: 'text', nullable: true })
  auditComment?: string | null

  @Column({ name: 'audited_by', type: 'uuid', nullable: true })
  auditedBy?: string | null

  @Column({ name: 'audited_at', type: 'timestamptz', nullable: true })
  auditedAt?: Date | null

  // ---- Invitation Source ----
  // How the invite was created
  @Column({ name: 'invite_type', type: 'varchar', length: 20, default: 'link' })
  inviteType!: string // 'link' | 'qrcode' | 'manual'

  // Who created the invite
  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy?: string | null

  // ---- Platform binding (optional) ----
  // When agent registers, they can bind platform accounts
  @Column({ name: 'douyin_bind', type: 'boolean', default: false })
  douyinBind!: boolean

  @Column({ name: 'xiaohongshu_bind', type: 'boolean', default: false })
  xiaohongshuBind!: boolean

  @Column({ name: 'wechat_video_bind', type: 'boolean', default: false })
  wechatVideoBind!: boolean

  // ---- Timestamp ----
  @Column({ name: 'bound_at', type: 'timestamptz', nullable: true })
  boundAt?: Date | null

  @Column({ name: 'unbound_at', type: 'timestamptz', nullable: true })
  unboundAt?: Date | null

  @Column({ name: 'restricted_at', type: 'timestamptz', nullable: true })
  restrictedAt?: Date | null

  @Column({ name: 'restriction_reason', type: 'text', nullable: true })
  restrictionReason?: string | null

  // ---- Relations ----
  @ManyToOne('Merchant')
  @JoinColumn({ name: 'merchant_id' })
  merchant!: any

  @ManyToOne('SharingAgent')
  @JoinColumn({ name: 'agent_id' })
  agent!: any
}
