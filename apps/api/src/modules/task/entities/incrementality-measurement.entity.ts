import { Column, Entity, Index } from 'typeorm'
import { BaseEntity } from '../../common/entities/base.entity'

export type IncrementalityMethod = 'geo_holdout' | 'audience_holdout'

export type IncrementalityInputs = {
  treatmentBaselineOrders: number
  controlBaselineOrders: number
  treatmentObservedOrders: number
  controlObservedOrders: number
  treatmentBaselineGmv: number
  controlBaselineGmv: number
  treatmentObservedGmv: number
  controlObservedGmv: number
}

@Entity('incrementality_measurements')
@Index('idx_incrementality_measurement_plan', ['growthPlanId'], { unique: true })
@Index('idx_incrementality_measurement_merchant', ['merchantId', 'createdAt'])
export class IncrementalityMeasurement extends BaseEntity {
  @Column({ name: 'growth_plan_id', type: 'uuid' }) growthPlanId!: string
  @Column({ name: 'merchant_id', type: 'uuid' }) merchantId!: string
  @Column({ name: 'campaign_id', type: 'uuid' }) campaignId!: string
  @Column({ type: 'varchar', length: 32 }) method!: IncrementalityMethod
  @Column({ name: 'window_start_at', type: 'timestamptz' }) windowStartAt!: Date
  @Column({ name: 'window_end_at', type: 'timestamptz' }) windowEndAt!: Date
  @Column({ type: 'jsonb' }) inputs!: IncrementalityInputs
  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" }) assumptions!: string[]
  @Column({ name: 'recorded_at', type: 'timestamptz' }) recordedAt!: Date
}