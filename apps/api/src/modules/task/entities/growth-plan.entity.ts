import { Column, Entity, Index } from 'typeorm'
import { BaseEntity } from '../../common/entities/base.entity'

export type GrowthPlanStatus = 'proposed' | 'approved' | 'superseded'

export type GrowthPlanAlternative = {
  optionId: number
  title: string
  campaignType: 'discount' | 'cash_reward' | 'combo'
  offer: { thresholdAmount: number; discountAmount?: number; cashRewardAmount?: number }
  targetAudience: string
  creatorStrategy: { channels: string[]; recommendedCreatorCount: number; contentTypes: string[]; rationale: string }
  budgetAllocation: { creatorPayout: number; campaignCredits: number; offerCost: number; reserve: number }
  expectedOutcome: { metric: string; low: number; likely: number; high: number; expectedRoi: number }
  assumptions: string[]
}

@Entity('growth_plans')
@Index('idx_growth_plan_merchant_status', ['merchantId', 'status'])
@Index('idx_growth_plan_growth_task', ['growthTaskId'], { unique: true })
export class GrowthPlan extends BaseEntity {
  @Column({ name: 'merchant_id', type: 'uuid' }) merchantId!: string
  @Column({ name: 'growth_task_id', type: 'uuid' }) growthTaskId!: string
  @Column({ name: 'campaign_id', type: 'uuid', nullable: true }) campaignId?: string | null
  @Column({ name: 'goal_brief', type: 'text' }) goalBrief!: string
  @Column({ type: 'varchar', length: 200 }) title!: string
  @Column({ type: 'varchar', length: 24, default: 'proposed' }) status!: GrowthPlanStatus
  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" }) alternatives!: GrowthPlanAlternative[]
  @Column({ name: 'selected_option_id', type: 'int', nullable: true }) selectedOptionId?: number | null
  @Column({ name: 'ai_metadata', type: 'jsonb', default: () => "'{}'::jsonb" }) aiMetadata!: Record<string, unknown>
  @Column({ name: 'approved_at', type: 'timestamptz', nullable: true }) approvedAt?: Date | null
  @Column({ name: 'approved_by', type: 'uuid', nullable: true }) approvedBy?: string | null
}
