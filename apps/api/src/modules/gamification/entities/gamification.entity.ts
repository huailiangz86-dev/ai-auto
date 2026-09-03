import { Column, Entity, Index } from 'typeorm'
import { BaseEntity } from '../../common/entities/base.entity'

@Entity('customer_point_accounts')
@Index('idx_point_account_customer', ['customerId'], { unique: true })
export class CustomerPointAccount extends BaseEntity {
  @Column({ name: 'customer_id', type: 'uuid', unique: true }) customerId!: string
  @Column({ type: 'int', default: 0 }) balance!: number
  @Column({ name: 'total_earned', type: 'int', default: 0 }) totalEarned!: number
  @Column({ name: 'total_spent', type: 'int', default: 0 }) totalSpent!: number
  @Column({ name: 'available_mystery_boxes', type: 'int', default: 0 })
  availableMysteryBoxes!: number
}

@Entity('customer_point_ledgers')
@Index('idx_point_ledger_event', ['eventId'], { unique: true })
@Index('idx_point_ledger_customer', ['customerId', 'createdAt'])
export class CustomerPointLedger extends BaseEntity {
  @Column({ name: 'customer_id', type: 'uuid' }) customerId!: string
  @Column({ name: 'event_id', type: 'varchar', length: 150, unique: true }) eventId!: string
  @Column({ type: 'varchar', length: 30 }) type!: 'share' | 'redemption' | 'challenge' | 'redeem'
  @Column({ type: 'int' }) points!: number
  @Column({ name: 'balance_after', type: 'int' }) balanceAfter!: number
  @Column({ type: 'varchar', length: 255 }) description!: string
}

@Entity('reward_products')
@Index('idx_reward_product_active', ['isActive'])
export class RewardProduct extends BaseEntity {
  @Column({ name: 'merchant_id', type: 'uuid', nullable: true }) merchantId?: string | null
  @Column({ type: 'varchar', length: 120 }) name!: string
  @Column({ type: 'text', nullable: true }) description?: string | null
  @Column({ name: 'points_cost', type: 'int', default: 0 }) pointsCost!: number
  @Column({ name: 'stock', type: 'int', nullable: true }) stock?: number | null
  @Column({ name: 'is_active', type: 'boolean', default: true }) isActive!: boolean
  @Column({ name: 'mystery_box_enabled', type: 'boolean', default: false })
  mysteryBoxEnabled!: boolean
  @Column({ name: 'guaranteed_reward', type: 'boolean', default: false }) guaranteedReward!: boolean
  @Column({ name: 'image_url', type: 'varchar', length: 500, nullable: true }) imageUrl?:
    string | null
}

@Entity('sharing_challenges')
@Index('idx_sharing_challenge_active', ['isActive'])
export class SharingChallenge extends BaseEntity {
  @Column({ name: 'merchant_id', type: 'uuid', nullable: true }) merchantId?: string | null
  @Column({ type: 'varchar', length: 120 }) title!: string
  @Column({ type: 'text' }) description!: string
  @Column({ name: 'target_shares', type: 'int' }) targetShares!: number
  @Column({ name: 'reward_points', type: 'int', default: 0 }) rewardPoints!: number
  @Column({ name: 'is_active', type: 'boolean', default: true }) isActive!: boolean
  @Column({ name: 'starts_at', type: 'timestamptz', nullable: true }) startsAt?: Date | null
  @Column({ name: 'ends_at', type: 'timestamptz', nullable: true }) endsAt?: Date | null
}

@Entity('customer_challenge_progress')
@Index('idx_challenge_progress_customer_challenge', ['customerId', 'challengeId'], { unique: true })
export class CustomerChallengeProgress extends BaseEntity {
  @Column({ name: 'customer_id', type: 'uuid' }) customerId!: string
  @Column({ name: 'challenge_id', type: 'uuid' }) challengeId!: string
  @Column({ name: 'share_count', type: 'int', default: 0 }) shareCount!: number
  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true }) completedAt?: Date | null
}

@Entity('mystery_box_openings')
@Index('idx_mystery_opening_customer', ['customerId', 'createdAt'])
export class MysteryBoxOpening extends BaseEntity {
  @Column({ name: 'customer_id', type: 'uuid' }) customerId!: string
  @Column({ name: 'reward_product_id', type: 'uuid' }) rewardProductId!: string
  @Column({ name: 'is_guaranteed', type: 'boolean', default: false }) isGuaranteed!: boolean
}
