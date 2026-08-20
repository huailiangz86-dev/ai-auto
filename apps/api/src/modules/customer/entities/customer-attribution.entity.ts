// ============================================================
// AI auto - Customer Attribution Entity
// 365-day lock period tracking: which agent brought which customer
// CRITICAL: This is the core economic mechanism
// ============================================================

import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm'
import { BaseEntity } from '../../common/entities/base.entity'
import { Customer } from './customer.entity'
import { SharingAgent } from '../../agent/entities/sharing-agent.entity'
import { Campaign } from '../../campaign/entities/campaign.entity'

@Entity('customer_attributions')
@Index('idx_attr_customer', ['customerId'])
@Index('idx_attr_agent', ['agentId'])
@Index('idx_attr_customer_agent', ['customerId', 'agentId'], { unique: true })
@Index('idx_attr_expire', ['lockExpiredAt'])
@Index('idx_attr_active', ['customerId', 'lockExpiredAt'])
// Partitioning note: partition by RANGE (YEAR_MONTH(created_at))
export class CustomerAttribution extends BaseEntity {
  @Column({ name: 'customer_id', type: 'uuid' })
  customerId!: string

  @Column({ name: 'agent_id', type: 'uuid' })
  agentId!: string

  // Which campaign/channel the customer came through
  @Column({ name: 'campaign_id', type: 'uuid', nullable: true })
  campaignId?: string | null

  // ---- Attribution Source ----
  @Column({ name: 'source_type', type: 'varchar', length: 30 })
  sourceType!: string // 'share_link' | 'qr_code' | 'lbs' | 'search' | 'wechat_mp'

  @Column({ name: 'source_platform', type: 'varchar', length: 30, nullable: true })
  sourcePlatform?: string | null // 'wechat' | 'douyin' | 'xiaohongshu'

  // ---- Attribution Metadata ----
  @Column({ name: 'click_ip', type: 'varchar', length: 45, nullable: true })
  clickIp?: string | null

  @Column({ name: 'click_device_id', type: 'varchar', length: 100, nullable: true })
  clickDeviceId?: string | null

  @Column({ name: 'click_user_agent', type: 'varchar', length: 500, nullable: true })
  clickUserAgent?: string | null

  // ---- Lock Period ----
  // Exact timestamp when customer clicked the share link
  @Column({ name: 'lock_started_at', type: 'timestamptz' })
  lockStartedAt!: Date

  // Exact timestamp when 365-day lock expires
  @Column({ name: 'lock_expired_at', type: 'timestamptz' })
  lockExpiredAt!: Date

  // Whether this is still the active attribution
  // When lock expires, this becomes false (customer can be re-attributed)
  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean

  // When attribution became inactive
  @Column({ name: 'deactivated_at', type: 'timestamptz', nullable: true })
  deactivatedAt?: Date | null

  // ---- Revenue from this customer ----
  @Column({ name: 'total_redemptions', type: 'int', default: 0 })
  totalRedemptions!: number

  @Column({ name: 'total_commission', type: 'decimal', precision: 14, scale: 2, default: 0 })
  totalCommission!: number

  // ---- Conversion Tracking ----
  // Time from first click to first redemption
  @Column({ name: 'first_redemption_at', type: 'timestamptz', nullable: true })
  firstRedemptionAt?: Date | null

  @Column({ name: 'days_to_first_redemption', type: 'int', nullable: true })
  daysToFirstRedemption?: number | null

  // ---- Relations ----
  @ManyToOne('Customer', 'attributions')
  @JoinColumn({ name: 'customer_id' })
  customer!: any

  @ManyToOne('SharingAgent')
  @JoinColumn({ name: 'agent_id' })
  agent!: any

  @ManyToOne('Campaign')
  @JoinColumn({ name: 'campaign_id' })
  campaign?: any
}
