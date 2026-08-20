// ============================================================
// AI auto - Subscription Entity
// Merchant subscription records (¥1,200/store/year)
// ============================================================

import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm'
import { BaseEntity } from '../../common/entities/base.entity'
import { SubscriptionStatus } from '@ai-auto/shared'
import { Merchant } from './merchant.entity'

@Entity('subscriptions')
@Index('idx_subscription_merchant', ['merchantId'])
@Index('idx_subscription_status', ['status'])
@Index('idx_subscription_expire', ['expireAt'])
export class Subscription extends BaseEntity {
  @Column({ name: 'merchant_id', type: 'uuid' })
  merchantId!: string

  // The subscription applies to this store (null = all stores)
  @Column({ name: 'store_id', type: 'uuid', nullable: true })
  storeId?: string | null

  @Column({ name: 'plan_name', type: 'varchar', length: 100, default: 'standard' })
  planName!: string

  @Column({
    name: 'status',
    type: 'enum',
    enum: SubscriptionStatus,
    default: SubscriptionStatus.ACTIVE,
  })
  status!: SubscriptionStatus

  @Column({ name: 'start_at', type: 'date' })
  startAt!: Date

  @Column({ name: 'expire_at', type: 'date' })
  expireAt!: Date

  // Price charged
  @Column({ name: 'amount_paid', type: 'decimal', precision: 12, scale: 2 })
  amountPaid!: number

  @Column({ name: 'payment_method', type: 'varchar', length: 50, nullable: true })
  paymentMethod?: string | null // 'alipay' | 'wechatpay'

  @Column({ name: 'payment_transaction_id', type: 'varchar', length: 100, nullable: true })
  paymentTransactionId?: string | null

  @Column({ name: 'auto_renew', type: 'boolean', default: false })
  autoRenew!: boolean

  @Column({ name: 'renewal_reminder_sent', type: 'boolean', default: false })
  renewalReminderSent!: boolean

  // Relations
  @ManyToOne('Merchant', 'subscriptions')
  @JoinColumn({ name: 'merchant_id' })
  merchant!: any
}
