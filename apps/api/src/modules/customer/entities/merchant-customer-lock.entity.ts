// ============================================================
// Merchant customer lock
// A merchant-scoped customer relationship created by a platform acquisition.
// It is deliberately separate from the global customer profile so CRM access
// can never be inferred from a customer's activity at another merchant.
// ============================================================

import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm'
import { BaseEntity } from '../../common/entities/base.entity'
import { Customer } from './customer.entity'

@Entity('merchant_customer_locks')
@Index('idx_mcl_merchant_active_expiry', ['merchantId', 'isActive', 'lockExpiredAt'])
@Index('idx_mcl_customer', ['customerId'])
@Index('uq_mcl_merchant_customer', ['merchantId', 'customerId'], { unique: true })
export class MerchantCustomerLock extends BaseEntity {
  @Column({ name: 'merchant_id', type: 'uuid' })
  merchantId!: string

  @Column({ name: 'customer_id', type: 'uuid' })
  customerId!: string

  @Column({ name: 'attribution_id', type: 'uuid', nullable: true })
  attributionId?: string | null

  @Column({ name: 'agent_id', type: 'uuid', nullable: true })
  agentId?: string | null

  @Column({ type: 'varchar', length: 20 })
  source!: string // platform | agent

  @Column({ name: 'acquired_at', type: 'timestamptz' })
  acquiredAt!: Date

  @Column({ name: 'lock_expired_at', type: 'timestamptz' })
  lockExpiredAt!: Date

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean

  @ManyToOne(() => Customer)
  @JoinColumn({ name: 'customer_id' })
  customer!: Customer
}
