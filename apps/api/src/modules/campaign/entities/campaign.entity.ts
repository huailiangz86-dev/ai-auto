// ============================================================
// AI auto - Campaign Entity
// Marketing campaign created by merchant
// ============================================================

import { Entity, Column, ManyToOne, OneToMany, JoinColumn, Index } from 'typeorm'
import { BaseEntity } from '../../common/entities/base.entity'
import { CampaignType } from '@ai-auto/shared'
import { Merchant } from '../../merchant/entities/merchant.entity'
import { Store } from '../../merchant/entities/store.entity'

@Entity('campaigns')
@Index('idx_campaign_merchant', ['merchantId'])
@Index('idx_campaign_status', ['campaignStatus'])
@Index('idx_campaign_active', ['campaignStatus', 'startAt', 'endAt'])
@Index('idx_campaign_start_expire', ['startAt', 'endAt'])
export class Campaign extends BaseEntity {
  @Column({ name: 'merchant_id', type: 'uuid' })
  merchantId!: string

  @Column({ name: 'store_id', type: 'uuid', nullable: true })
  storeId?: string | null

  @Column({ name: 'campaign_name', type: 'varchar', length: 200 })
  campaignName!: string

  // ---- Campaign Type ----
  @Column({
    name: 'campaign_type',
    type: 'enum',
    enum: CampaignType,
  })
  campaignType!: CampaignType

  // ---- Status ----
  // 'draft' | 'active' | 'paused' | 'ended' | 'cancelled'
  @Column({ name: 'campaign_status', type: 'varchar', length: 20, default: 'draft' })
  campaignStatus!: string

  // ---- Time ----
  @Column({ name: 'start_at', type: 'timestamptz' })
  startAt!: Date

  @Column({ name: 'end_at', type: 'timestamptz', nullable: true })
  endAt?: Date | null

  // ---- Target ----
  @Column({ name: 'target_audience', type: 'varchar', length: 50, nullable: true })
  targetAudience?: string | null // 'all' | 'new' | 'returning'

  // ---- Budget ----
  @Column({ name: 'max_budget', type: 'decimal', precision: 14, scale: 2, nullable: true })
  maxBudget?: number | null

  @Column({ name: 'frozen_budget', type: 'decimal', precision: 14, scale: 2, default: 0 })
  frozenBudget!: number

  @Column({ name: 'spent_budget', type: 'decimal', precision: 14, scale: 2, default: 0 })
  spentBudget!: number

  // ---- AI Configuration ----
  @Column({ name: 'ai_config_id', type: 'uuid', nullable: true })
  aiConfigId?: string | null

  @Column({ name: 'ai_generated', type: 'boolean', default: false })
  aiGenerated!: boolean

  @Column({ name: 'ai_description', type: 'text', nullable: true })
  aiDescription?: string | null

  // ---- Description ----
  @Column({ type: 'text', nullable: true })
  description?: string | null

  // ---- Statistics ----
  @Column({ name: 'total_impressions', type: 'bigint', default: 0 })
  totalImpressions!: number

  @Column({ name: 'total_clicks', type: 'bigint', default: 0 })
  totalClicks!: number

  @Column({ name: 'total_claims', type: 'bigint', default: 0 })
  totalClaims!: number

  @Column({ name: 'total_redemptions', type: 'int', default: 0 })
  totalRedemptions!: number

  @Column({ name: 'total_commission_spent', type: 'decimal', precision: 14, scale: 2, default: 0 })
  totalCommissionSpent!: number

  // ---- Relations ----
  @ManyToOne('Merchant')
  @JoinColumn({ name: 'merchant_id' })
  merchant!: any

  @ManyToOne('Store')
  @JoinColumn({ name: 'store_id' })
  store?: any

  @OneToMany('Coupon', 'campaign')
  coupons!: any[]
}
