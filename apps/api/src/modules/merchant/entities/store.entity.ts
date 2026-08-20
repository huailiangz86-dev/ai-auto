// ============================================================
// AI auto - Store Entity
// Represents a physical or logical store under a merchant
// Multiple stores can share one subscription
// ============================================================

import { Entity, Column, ManyToOne, OneToMany, JoinColumn, Index } from 'typeorm'
import { BaseEntity } from '../../common/entities/base.entity'
import { Merchant } from './merchant.entity'

@Entity('stores')
@Index('idx_store_merchant', ['merchantId'])
@Index('idx_store_status', ['status'])
export class Store extends BaseEntity {
  @Column({ name: 'merchant_id', type: 'uuid' })
  merchantId!: string

  @Column({ name: 'store_name', type: 'varchar', length: 200 })
  storeName!: string

  @Column({ name: 'store_code', type: 'varchar', length: 50, unique: true })
  storeCode!: string

  // ---- Address & Location ----
  @Column({ name: 'province', type: 'varchar', length: 50, nullable: true })
  province?: string | null

  @Column({ name: 'city', type: 'varchar', length: 50, nullable: true })
  city?: string | null

  @Column({ name: 'district', type: 'varchar', length: 50, nullable: true })
  district?: string | null

  @Column({ name: 'address_detail', type: 'varchar', length: 500, nullable: true })
  addressDetail?: string | null

  @Column({ name: 'latitude', type: 'decimal', precision: 10, scale: 7, nullable: true })
  latitude?: number | null

  @Column({ name: 'longitude', type: 'decimal', precision: 10, scale: 7, nullable: true })
  longitude?: number | null

  // ---- Contact ----
  @Column({ name: 'contact_phone', type: 'varchar', length: 20, nullable: true })
  contactPhone?: string | null

  @Column({ name: 'business_hours', type: 'varchar', length: 200, nullable: true })
  businessHours?: string | null

  // ---- Status ----
  @Column({ type: 'boolean', default: true })
  status!: boolean // true = active, false = inactive

  // ---- Relations ----
  @ManyToOne('Merchant', 'stores')
  @JoinColumn({ name: 'merchant_id' })
  merchant!: any
}
