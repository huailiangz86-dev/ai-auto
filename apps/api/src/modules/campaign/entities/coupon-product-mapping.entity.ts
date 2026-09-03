// ============================================================
// AI auto - Coupon Product Mapping Entity
// Maps platform coupons to merchant's external product IDs
// ============================================================

import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm'
import { BaseEntity } from '../../common/entities/base.entity'
import { Coupon } from './coupon.entity'
import { Merchant } from '../../merchant/entities/merchant.entity'
import { MarketingProduct, MarketingProductSku } from './marketing-product.entity'

@Entity('coupon_product_mappings')
@Index('idx_mapping_coupon', ['couponId'])
@Index('idx_mapping_merchant', ['merchantId'])
@Index('idx_mapping_external', ['externalProductId'])
@Index('idx_mapping_catalogue_product', ['productId'])
export class CouponProductMapping extends BaseEntity {
  @Column({ name: 'coupon_id', type: 'uuid' })
  couponId!: string

  @Column({ name: 'merchant_id', type: 'uuid' })
  merchantId!: string

  @Column({ type: 'varchar', length: 20, default: 'legacy_external' })
  type!: 'catalogue' | 'legacy_external'

  @Column({ name: 'product_id', type: 'uuid', nullable: true })
  productId?: string | null

  @Column({ name: 'sku_id', type: 'uuid', nullable: true })
  skuId?: string | null

  // Merchant's external product ID in their business system
  @Column({ name: 'external_product_id', type: 'varchar', length: 100, nullable: true })
  externalProductId?: string | null

  @Column({ name: 'external_product_name', type: 'varchar', length: 200, nullable: true })
  externalProductName?: string | null

  @Column({ name: 'external_category', type: 'varchar', length: 100, nullable: true })
  externalCategory?: string | null

  // ---- Mapping Status ----
  @Column({ type: 'boolean', default: true })
  status!: boolean

  // ---- Verification Callback ----
  // URL merchant's system calls to verify redemption
  @Column({ name: 'callback_url', type: 'varchar', length: 500, nullable: true })
  callbackUrl?: string | null

  // HMAC secret for signing callback requests
  @Column({ name: 'callback_secret', type: 'varchar', length: 255, nullable: true, select: false })
  callbackSecret?: string | null

  // Relations
  @ManyToOne('Coupon', 'productMappings')
  @JoinColumn({ name: 'coupon_id' })
  coupon!: any

  @ManyToOne('Merchant')
  @JoinColumn({ name: 'merchant_id' })
  merchant!: any

  @ManyToOne(() => MarketingProduct, { nullable: true })
  @JoinColumn({ name: 'product_id' })
  product?: MarketingProduct | null

  @ManyToOne(() => MarketingProductSku, { nullable: true })
  @JoinColumn({ name: 'sku_id' })
  sku?: MarketingProductSku | null
}
