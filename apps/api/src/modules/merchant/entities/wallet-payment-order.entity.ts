import { Column, Entity, Index } from 'typeorm'
import { BaseEntity } from '../../common/entities/base.entity'

export type WalletPaymentProvider = 'wechatpay' | 'alipay'
export type WalletPaymentOrderStatus = 'pending' | 'paid' | 'failed' | 'closed'

@Entity('wallet_payment_orders')
@Index('idx_wallet_payment_order_merchant', ['merchantId', 'createdAt'])
@Index('uq_wallet_payment_order_trade_no', ['outTradeNo'], { unique: true })
export class WalletPaymentOrder extends BaseEntity {
  @Column({ name: 'merchant_id', type: 'uuid' }) merchantId!: string
  @Column({ name: 'out_trade_no', type: 'varchar', length: 32 }) outTradeNo!: string
  @Column({ type: 'varchar', length: 16 }) provider!: WalletPaymentProvider
  @Column({ type: 'numeric', precision: 12, scale: 2 }) amount!: number
  @Column({ type: 'varchar', length: 16, default: 'pending' }) status!: WalletPaymentOrderStatus
  @Column({ name: 'provider_transaction_id', type: 'varchar', length: 100, nullable: true })
  providerTransactionId?: string | null
  @Column({ name: 'expires_at', type: 'timestamptz' }) expiresAt!: Date
  @Column({ name: 'paid_at', type: 'timestamptz', nullable: true }) paidAt?: Date | null
  @Column({ name: 'failure_reason', type: 'text', nullable: true }) failureReason?: string | null
}
