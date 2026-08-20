// ============================================================
// AI auto - Redemption Entity
// Coupon redemption records (the trigger for commission)
// ============================================================

import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm'
import { BaseEntity } from '../../common/entities/base.entity'
import { RedemptionStatus } from '@ai-auto/shared'
import { Customer } from '../../customer/entities/customer.entity'
import { Coupon } from '../../campaign/entities/coupon.entity'
import { Merchant } from '../../merchant/entities/merchant.entity'
import { CustomerAttribution } from '../../customer/entities/customer-attribution.entity'

@Entity('redemptions')
@Index('idx_redeem_customer', ['customerId'])
@Index('idx_redeem_coupon', ['couponId'])
@Index('idx_redeem_status', ['status'])
@Index('idx_redeem_merchant', ['merchantId'])
@Index('idx_redeem_idem', ['idempotencyKey'], { unique: true })
@Index('idx_redeem_created', ['createdAt'])
export class Redemption extends BaseEntity {
  // ---- Idempotency ----
  // Unique key: prevents duplicate commission calculations
  @Column({ name: 'idempotency_key', type: 'varchar', length: 100, unique: true })
  idempotencyKey!: string

  // ---- Parties ----
  @Column({ name: 'customer_id', type: 'uuid' })
  customerId!: string

  @Column({ name: 'coupon_id', type: 'uuid' })
  couponId!: string

  @Column({ name: 'merchant_id', type: 'uuid' })
  merchantId!: string

  @Column({ name: 'store_id', type: 'uuid', nullable: true })
  storeId?: string | null

  @Column({ name: 'campaign_id', type: 'uuid', nullable: true })
  campaignId?: string | null

  // Attribution (the agent who brought this customer)
  @Column({ name: 'attribution_id', type: 'uuid', nullable: true })
  attributionId?: string | null

  // ---- Coupon Details at Redemption Time ----
  @Column({ name: 'coupon_type', type: 'varchar', length: 30 })
  couponType!: string

  @Column({ name: 'discount_amount', type: 'decimal', precision: 12, scale: 2, nullable: true })
  discountAmount?: number | null

  @Column({ name: 'cash_reward_amount', type: 'decimal', precision: 12, scale: 2, nullable: true })
  cashRewardAmount?: number | null

  // ---- Transaction Amount ----
  @Column({ name: 'transaction_amount', type: 'decimal', precision: 12, scale: 2 })
  transactionAmount!: number

  @Column({ name: 'discount_value', type: 'decimal', precision: 12, scale: 2 })
  discountValue!: number

  // ---- Agent Commission at Redemption Time ----
  @Column({ name: 'agent_reward_amount', type: 'decimal', precision: 12, scale: 2 })
  agentRewardAmount!: number

  @Column({ name: 'agent_level_at_time', type: 'varchar', length: 20, nullable: true })
  agentLevelAtTime?: string | null

  @Column({
    name: 'commission_multiplier_at_time',
    type: 'decimal',
    precision: 4,
    scale: 2,
    nullable: true,
  })
  commissionMultiplierAtTime?: number | null

  // ---- Status ----
  @Column({
    name: 'status',
    type: 'enum',
    enum: RedemptionStatus,
    default: RedemptionStatus.PENDING,
  })
  status!: RedemptionStatus

  // ---- Callback from Merchant ----
  // The coupon code the customer presented
  @Column({ name: 'coupon_code', type: 'varchar', length: 50 })
  couponCode!: string

  // Merchant's transaction ID at their POS
  @Column({ name: 'merchant_transaction_id', type: 'varchar', length: 100, nullable: true })
  merchantTransactionId?: string | null

  // Time customer presented the coupon
  @Column({ name: 'presented_at', type: 'timestamptz', nullable: true })
  presentedAt?: Date | null

  // Time merchant's system called the verification API
  @Column({ name: 'callback_received_at', type: 'timestamptz', nullable: true })
  callbackReceivedAt?: Date | null

  // Whether callback was within 72-hour window
  @Column({ name: 'callback_within_72h', type: 'boolean', nullable: true })
  callbackWithin72h?: boolean | null

  // Callback verification result
  @Column({ name: 'callback_verified', type: 'boolean', nullable: true })
  callbackVerified?: boolean | null

  @Column({ name: 'callback_error', type: 'text', nullable: true })
  callbackError?: string | null

  // ---- Verification Timestamp ----
  @Column({ name: 'verified_at', type: 'timestamptz', nullable: true })
  verifiedAt?: Date | null

  @Column({ name: 'verified_by', type: 'uuid', nullable: true })
  verifiedBy?: string | null

  // ---- Settlement ----
  // Commission ID if commission was calculated
  @Column({ name: 'commission_id', type: 'uuid', nullable: true })
  commissionId?: string | null

  // ---- Fraud Detection ----
  @Column({ name: 'fraud_flagged', type: 'boolean', default: false })
  fraudFlagged!: boolean

  @Column({ name: 'fraud_reason', type: 'text', nullable: true })
  fraudReason?: string | null

  // ---- Relations ----
  @ManyToOne('Customer', 'redemptions')
  @JoinColumn({ name: 'customer_id' })
  customer!: any

  @ManyToOne('Coupon', 'redemptions')
  @JoinColumn({ name: 'coupon_id' })
  coupon!: any

  @ManyToOne('Merchant')
  @JoinColumn({ name: 'merchant_id' })
  merchant!: any

  @ManyToOne('CustomerAttribution')
  @JoinColumn({ name: 'attribution_id' })
  attribution?: any
}
