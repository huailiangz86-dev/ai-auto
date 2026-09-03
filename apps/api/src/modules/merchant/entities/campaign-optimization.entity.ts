import { Column, Entity, Index } from 'typeorm'
import { BaseEntity } from '../../common/entities/base.entity'

@Entity('campaign_optimizations')
@Index('idx_campaign_optimization_merchant', ['merchantId', 'createdAt'])
@Index('idx_campaign_optimization_campaign', ['campaignId', 'createdAt'])
export class CampaignOptimization extends BaseEntity {
  @Column({ name: 'merchant_id', type: 'uuid' })
  merchantId!: string

  @Column({ name: 'campaign_id', type: 'uuid' })
  campaignId!: string

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status!: 'pending' | 'approved' | 'rejected' | 'applied'

  @Column({ type: 'jsonb' })
  metrics!: Record<string, number>

  @Column({ type: 'jsonb' })
  recommendations!: Array<{ title: string; detail: string; priority: 'high' | 'medium' | 'low' }>

  @Column({ type: 'jsonb' })
  adjustments!: Array<{
    type: 'budget' | 'coupon_discount' | 'target_audience'
    value: number | string
    couponId?: string
    reason: string
  }>

  @Column({ name: 'predicted_improvement', type: 'decimal', precision: 7, scale: 2, default: 0 })
  predictedImprovement!: number

  @Column({ name: 'auto_applied', type: 'boolean', default: false })
  autoApplied!: boolean

  @Column({ name: 'applied_at', type: 'timestamptz', nullable: true })
  appliedAt?: Date | null
}
