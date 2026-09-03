import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany } from 'typeorm'
import { BaseEntity } from '../../common/entities/base.entity'
import { Merchant } from '../../merchant/entities/merchant.entity'

@Entity('marketing_products')
@Index('idx_marketing_product_merchant_status', ['merchantId', 'status'])
@Index('idx_marketing_product_merchant_external', ['merchantId', 'externalProductId'], {
  unique: true,
  where: 'external_product_id IS NOT NULL',
})
export class MarketingProduct extends BaseEntity {
  @Column({ name: 'merchant_id', type: 'uuid' }) merchantId!: string
  @Column({ name: 'product_name', type: 'varchar', length: 200 }) productName!: string
  @Column({ type: 'varchar', length: 100, nullable: true }) category?: string | null
  @Column({ type: 'text', nullable: true }) description?: string | null
  @Column({ name: 'product_source', type: 'varchar', length: 20, default: 'managed' })
  productSource!: 'managed' | 'external'
  @Column({ name: 'external_product_id', type: 'varchar', length: 100, nullable: true })
  externalProductId?: string | null
  @Column({ type: 'varchar', length: 20, default: 'draft' }) status!:
    'draft' | 'on_sale' | 'off_shelf'
  @ManyToOne(() => Merchant) @JoinColumn({ name: 'merchant_id' }) merchant!: Merchant
  @OneToMany(() => MarketingProductSku, (sku) => sku.product) skus!: MarketingProductSku[]
}

@Entity('marketing_product_skus')
@Index('idx_marketing_sku_product', ['productId'])
@Index('idx_marketing_sku_product_code', ['productId', 'skuCode'], { unique: true })
export class MarketingProductSku extends BaseEntity {
  @Column({ name: 'product_id', type: 'uuid' }) productId!: string
  @Column({ name: 'sku_name', type: 'varchar', length: 200 }) skuName!: string
  @Column({ name: 'sku_code', type: 'varchar', length: 100 }) skuCode!: string
  @Column({ type: 'jsonb', default: {} }) attributes!: Record<string, string>
  @Column({ type: 'decimal', precision: 12, scale: 2 }) price!: number
  @Column({ name: 'market_price', type: 'decimal', precision: 12, scale: 2, nullable: true })
  marketPrice?: number | null
  @Column({ type: 'int', nullable: true }) stock?: number | null
  @Column({ type: 'varchar', length: 20, default: 'on_sale' }) status!: string
  @ManyToOne(() => MarketingProduct, (product) => product.skus, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  product!: MarketingProduct
}
