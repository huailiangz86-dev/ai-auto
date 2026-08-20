// ============================================================
// AI auto - Coupon Entity
// Coupon/reward issued by merchant under a campaign
// ============================================================

import { Entity, Column, ManyToOne, OneToMany, JoinColumn, Index } from 'typeorm'
import { BaseEntity } from '../../common/entities/base.entity'
import { CouponStatus, CampaignType } from '@ai-auto/shared'
import { Campaign } from './campaign.entity'
import { Merchant } from '../../merchant/entities/merchant.entity'

@Entity('coupons')
@Index('idx_coupon_campaign', ['campaignId'])
@Index('idx_coupon_merchant', ['merchantId'])
@Index('idx_coupon_status', ['status'])
@Index('idx_coupon_code', ['couponCode'], { unique: true })
export class Coupon extends BaseEntity {
  @Column({ name: 'campaign_id', type: 'uuid' })
  campaignId!: string

  @Column({ name: 'merchant_id', type: 'uuid' })
  merchantId!: string

  // ---- Coupon Details ----
  @Column({ name: 'coupon_name', type: 'varchar', length: 200 })
  couponName!: string

  @Column({ name: 'coupon_code', type: 'varchar', length: 50, unique: true })
  couponCode!: string

  // ---- Type ----
  @Column({
    name: 'coupon_type',
    type: 'enum',
    enum: CampaignType,
  })
  couponType!: CampaignType

  // ---- Discount/Reward Value ----
  // For discount type: threshold amount
  @Column({ name: 'threshold_amount', type: 'decimal', precision: 12, scale: 2, nullable: true })
  thresholdAmount?: number | null

  // For discount type: discount amount
  @Column({ name: 'discount_amount', type: 'decimal', precision: 12, scale: 2, nullable: true })
  discountAmount?: number | null

  // For cash reward type: cash reward amount
  @Column({ name: 'cash_reward_amount', type: 'decimal', precision: 12, scale: 2, nullable: true })
  cashRewardAmount?: number | null

  // ---- Validity ----
  @Column({ name: 'valid_from', type: 'timestamptz' })
  validFrom!: Date

  @Column({ name: 'valid_until', type: 'timestamptz' })
  validUntil!: Date

  // ---- Inventory ----
  @Column({ name: 'total_stock', type: 'int', nullable: true })
  totalStock?: number | null // null = unlimited

  @Column({ name: 'remaining_stock', type: 'int', nullable: true })
  remainingStock?: number | null

  // ---- Per-Customer Limits ----
  @Column({ name: 'per_customer_limit', type: 'int', default: 1 })
  perCustomerLimit!: number // 0 = unlimited

  // ---- Agent Commission ----
  // How much the agent earns when this coupon is redeemed
  @Column({ name: 'agent_reward_amount', type: 'decimal', precision: 12, scale: 2 })
  agentRewardAmount!: number

  // ---- Status ----
  @Column({
    name: 'status',
    type: 'enum',
    enum: CouponStatus,
    default: CouponStatus.ACTIVE,
  })
  status!: CouponStatus

  // ---- Usage Stats ----
  @Column({ name: 'total_issued', type: 'int', default: 0 })
  totalIssued!: number

  @Column({ name: 'total_redeemed', type: 'int', default: 0 })
  totalRedeemed!: number

  @Column({ name: 'total_commission_paid', type: 'decimal', precision: 14, scale: 2, default: 0 })
  totalCommissionPaid!: number

  // ---- Relations ----
  @ManyToOne('Campaign', 'coupons')
  @JoinColumn({ name: 'campaign_id' })
  campaign!: any

  @ManyToOne('Merchant')
  @JoinColumn({ name: 'merchant_id' })
  merchant!: any

  @OneToMany('CouponProductMapping', 'coupon')
  productMappings!: any[]

  @OneToMany('Redemption', 'coupon')
  redemptions!: any[]
}
