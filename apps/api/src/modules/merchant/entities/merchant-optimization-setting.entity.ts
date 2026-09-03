import { Column, Entity, Index } from 'typeorm'
import { BaseEntity } from '../../common/entities/base.entity'

/** Merchant-controlled safety limits for AI campaign changes. */
@Entity('merchant_optimization_settings')
@Index('idx_optimization_setting_merchant', ['merchantId'], { unique: true })
export class MerchantOptimizationSetting extends BaseEntity {
  @Column({ name: 'merchant_id', type: 'uuid' })
  merchantId!: string

  @Column({ name: 'auto_adjust_enabled', type: 'boolean', default: false })
  autoAdjustEnabled!: boolean

  @Column({
    name: 'max_budget_change_percent',
    type: 'decimal',
    precision: 5,
    scale: 2,
    default: 20,
  })
  maxBudgetChangePercent!: number
}
