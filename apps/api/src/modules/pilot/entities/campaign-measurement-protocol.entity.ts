import { Column, Entity, Index } from 'typeorm'
import { BaseEntity } from '../../common/entities/base.entity'

export type PilotMeasurementMethod = 'geo_holdout' | 'audience_holdout'

/** Immutable before activation: defines what the pilot may later claim to have measured. */
@Entity('campaign_measurement_protocols')
@Index('idx_campaign_measurement_protocol_campaign', ['campaignId'], { unique: true })
@Index('idx_campaign_measurement_protocol_merchant', ['merchantId', 'registeredAt'])
export class CampaignMeasurementProtocol extends BaseEntity {
  @Column({ name: 'campaign_id', type: 'uuid' }) campaignId!: string
  @Column({ name: 'merchant_id', type: 'uuid' }) merchantId!: string
  @Column({ type: 'varchar', length: 32 }) method!: PilotMeasurementMethod
  @Column({ name: 'experiment_group_definition', type: 'text' }) experimentGroupDefinition!: string
  @Column({ name: 'control_group_definition', type: 'text' }) controlGroupDefinition!: string
  @Column({ name: 'baseline_start_at', type: 'timestamptz' }) baselineStartAt!: Date
  @Column({ name: 'baseline_end_at', type: 'timestamptz' }) baselineEndAt!: Date
  @Column({ name: 'observation_start_at', type: 'timestamptz' }) observationStartAt!: Date
  @Column({ name: 'observation_end_at', type: 'timestamptz' }) observationEndAt!: Date
  @Column({ name: 'orders_definition', type: 'text' }) ordersDefinition!: string
  @Column({ name: 'gmv_definition', type: 'text' }) gmvDefinition!: string
  @Column({ name: 'registered_at', type: 'timestamptz' }) registeredAt!: Date
}
