import { Column, Entity, Index } from 'typeorm'
import { BaseEntity } from '../../common/entities/base.entity'

@Entity('sharing_tasks')
@Index('idx_sharing_task_merchant_status', ['merchantId', 'status'])
@Index('idx_sharing_task_coupon', ['couponId'])
export class SharingTask extends BaseEntity {
  @Column({ name: 'merchant_id', type: 'uuid' }) merchantId!: string
  @Column({ name: 'coupon_id', type: 'uuid' }) couponId!: string
  @Column({ name: 'target_audience', type: 'text' }) targetAudience!: string
  @Column({ name: 'budget', type: 'decimal', precision: 12, scale: 2 }) budget!: number
  @Column({ name: 'deadline', type: 'timestamptz' }) deadline!: Date
  @Column({ name: 'max_agents', type: 'int', default: 20 }) maxAgents!: number
  @Column({ name: 'target_claims', type: 'int', default: 0 }) targetClaims!: number
  @Column({ name: 'target_redemptions', type: 'int', default: 1 }) targetRedemptions!: number
  @Column({ name: 'reward_per_redemption', type: 'decimal', precision: 12, scale: 2 })
  rewardPerRedemption!: number
  @Column({ type: 'varchar', length: 20, default: 'open' }) status!:
    'draft' | 'open' | 'closed' | 'expired'
}

@Entity('sharing_task_assignments')
@Index('idx_task_assignment_task_agent', ['taskId', 'agentId'], { unique: true })
@Index('idx_task_assignment_agent_status', ['agentId', 'status'])
export class SharingTaskAssignment extends BaseEntity {
  @Column({ name: 'task_id', type: 'uuid' }) taskId!: string
  @Column({ name: 'agent_id', type: 'uuid' }) agentId!: string
  @Column({ type: 'varchar', length: 20, default: 'accepted' }) status!:
    'accepted' | 'completed' | 'cancelled'
  @Column({ name: 'view_count', type: 'int', default: 0 }) viewCount!: number
  @Column({ name: 'claim_count', type: 'int', default: 0 }) claimCount!: number
  @Column({ name: 'redemption_count', type: 'int', default: 0 }) redemptionCount!: number
  @Column({ name: 'earned_reward', type: 'decimal', precision: 12, scale: 2, default: 0 })
  earnedReward!: number
  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true }) completedAt?: Date | null
}
