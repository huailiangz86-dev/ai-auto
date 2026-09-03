import { Column, Entity, Index } from 'typeorm'
import { BaseEntity } from '../../common/entities/base.entity'

export type CampaignBudgetCategory = 'creator_payout' | 'campaign_credits' | 'channel_cost' | 'consumer_incentive' | 'risk_reserve'
export type CampaignBudgetAllocationStatus = 'funded' | 'released' | 'spent'

@Entity('campaign_budget_allocations')
@Index('idx_campaign_budget_allocation_campaign', ['campaignId', 'category'], { unique: true })
@Index('idx_campaign_budget_allocation_merchant', ['merchantId', 'status'])
export class CampaignBudgetAllocation extends BaseEntity {
  @Column({ name: 'merchant_id', type: 'uuid' }) merchantId!: string
  @Column({ name: 'growth_plan_id', type: 'uuid' }) growthPlanId!: string
  @Column({ name: 'growth_task_id', type: 'uuid' }) growthTaskId!: string
  @Column({ name: 'campaign_id', type: 'uuid' }) campaignId!: string
  @Column({ type: 'varchar', length: 32 }) category!: CampaignBudgetCategory
  @Column({ name: 'planned_amount', type: 'decimal', precision: 14, scale: 2 }) plannedAmount!: number
  @Column({ name: 'committed_amount', type: 'decimal', precision: 14, scale: 2, default: 0 }) committedAmount!: number
  @Column({ name: 'spent_amount', type: 'decimal', precision: 14, scale: 2, default: 0 }) spentAmount!: number
  @Column({ type: 'varchar', length: 16, default: 'funded' }) status!: CampaignBudgetAllocationStatus
  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" }) metadata!: Record<string, unknown>
}
