// ============================================================
// AI auto - CustomerCoupon Entity
// User's claimed coupon record
// Created when a customer claims a coupon (FR-015)
// ============================================================

import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm'
import { BaseEntity } from '../../common/entities/base.entity'
import { CouponStatus } from '@ai-auto/shared'
import { Customer } from './customer.entity'
import { Coupon } from '../../campaign/entities/coupon.entity'
import { CustomerAttribution } from './customer-attribution.entity'
import { SharingAgent } from '../../agent/entities/sharing-agent.entity'

@Entity('customer_coupons')
@Index('idx_cc_customer', ['customerId'])
@Index('idx_cc_coupon', ['couponId'])
@Index('idx_cc_customer_coupon', ['customerId', 'couponId'], { unique: true })
@Index('idx_cc_code', ['couponCode'], { unique: true })
@Index('idx_cc_status', ['status'])
@Index('idx_cc_expire', ['expireAt'])
export class CustomerCoupon extends BaseEntity {
  // ---- Owner ----
  @Column({ name: 'customer_id', type: 'uuid' })
  customerId!: string

  @Column({ name: 'coupon_id', type: 'uuid' })
  couponId!: string

  // ---- Coupon Code ----
  // Unique code for redemption verification (商家扫码用)
  @Column({ name: 'coupon_code', type: 'varchar', length: 50, unique: true })
  couponCode!: string

  // ---- Attribution (who brought this customer) ----
  // Null if customer discovered via LBS/search (no agent attribution)
  @Column({ name: 'attribution_id', type: 'uuid', nullable: true })
  attributionId?: string | null

  @Column({ name: 'agent_id', type: 'uuid', nullable: true })
  agentId?: string | null

  // How the customer found this coupon
  @Column({ name: 'source', type: 'varchar', length: 30, default: 'lbs' })
  source!: string // 'share_link' | 'qr_code' | 'lbs' | 'search' | 'wechat_mp'

  // ---- Coupon Details Snapshot (denormalized for performance) ----
  @Column({ name: 'merchant_id', type: 'uuid' })
  merchantId!: string

  @Column({ name: 'merchant_name', type: 'varchar', length: 200 })
  merchantName!: string

  @Column({ name: 'coupon_name', type: 'varchar', length: 200 })
  couponName!: string

  @Column({ name: 'coupon_type', type: 'varchar', length: 30 })
  couponType!: string

  @Column({ name: 'discount_amount', type: 'decimal', precision: 12, scale: 2, nullable: true })
  discountAmount?: number | null

  @Column({ name: 'threshold_amount', type: 'decimal', precision: 12, scale: 2, nullable: true })
  thresholdAmount?: number | null

  @Column({ name: 'cash_reward_amount', type: 'decimal', precision: 12, scale: 2, nullable: true })
  cashRewardAmount?: number | null

  // ---- Validity ----
  // Validity calculated at claim time
  // Either: valid_from + N days (validity_type = 'days_after_claim')
  // Or: valid_from / valid_until (validity_type = 'date_range')
  @Column({ name: 'valid_from', type: 'timestamptz' })
  validFrom!: Date

  @Column({ name: 'valid_until', type: 'timestamptz' })
  expireAt!: Date

  @Column({ name: 'validity_type', type: 'varchar', length: 30, default: 'days_after_claim' })
  validityType!: string

  // ---- Status ----
  @Column({
    name: 'status',
    type: 'enum',
    enum: CouponStatus,
    default: CouponStatus.ACTIVE,
  })
  status!: CouponStatus

  // ---- Timestamps ----
  @Column({ name: 'claimed_at', type: 'timestamptz' })
  claimedAt!: Date

  @Column({ name: 'used_at', type: 'timestamptz', nullable: true })
  usedAt?: Date | null

  @Column({ name: 'expired_at', type: 'timestamptz', nullable: true })
  expiredAt?: Date | null

  // ---- Redemption Link ----
  @Column({ name: 'redemption_id', type: 'uuid', nullable: true })
  redemptionId?: string | null

  // ---- Share Tracking ----
  @Column({ name: 'share_platform', type: 'varchar', length: 30, nullable: true })
  sharePlatform?: string | null // 'wechat_friend' | 'wechat_moment' | 'douyin' | 'xiaohongshu'

  @Column({ name: 'share_count', type: 'int', default: 0 })
  shareCount!: number

  @Column({ name: 'last_shared_at', type: 'timestamptz', nullable: true })
  lastSharedAt?: Date | null

  // ---- Relations ----
  @ManyToOne('Customer')
  @JoinColumn({ name: 'customer_id' })
  customer!: Customer

  @ManyToOne('Coupon')
  @JoinColumn({ name: 'coupon_id' })
  coupon!: Coupon

  @ManyToOne('CustomerAttribution')
  @JoinColumn({ name: 'attribution_id' })
  attribution?: CustomerAttribution | null

  @ManyToOne('SharingAgent')
  @JoinColumn({ name: 'agent_id' })
  agent?: SharingAgent | null
}
