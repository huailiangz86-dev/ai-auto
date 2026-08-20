// ============================================================
// AI auto - Customer Entity
// C-end user who discovers and redeems coupons
// ============================================================

import { Entity, Column, OneToMany, Index } from 'typeorm'
import { BaseEntity } from '../../common/entities/base.entity'

@Entity('customers')
@Index('idx_customer_phone', ['phone'], { unique: true })
@Index('idx_customer_openid', ['wechatOpenid'])
export class Customer extends BaseEntity {
  // ---- Authentication ----
  @Column({ name: 'wechat_openid', type: 'varchar', length: 100, unique: true, nullable: true })
  wechatOpenid?: string | null

  @Column({ name: 'phone', type: 'varchar', length: 20, nullable: true })
  phone?: string | null

  // ---- Profile ----
  @Column({ type: 'varchar', length: 100, nullable: true })
  nickname?: string | null

  @Column({ type: 'varchar', length: 500, nullable: true })
  avatar?: string | null

  @Column({ name: 'gender', type: 'varchar', length: 10, nullable: true })
  gender?: string | null // 'male' | 'female' | 'unknown'

  @Column({ name: 'birthday', type: 'date', nullable: true })
  birthday?: Date | null

  // ---- Location ----
  @Column({ name: 'province', type: 'varchar', length: 50, nullable: true })
  province?: string | null

  @Column({ name: 'city', type: 'varchar', length: 50, nullable: true })
  city?: string | null

  // ---- First Attribution (who brought this customer first) ----
  @Column({ name: 'first_agent_id', type: 'uuid', nullable: true })
  firstAgentId?: string | null

  // ---- Stats ----
  @Column({ name: 'total_redemptions', type: 'int', default: 0 })
  totalRedemptions!: number

  @Column({ name: 'total_spend', type: 'decimal', precision: 14, scale: 2, default: 0 })
  totalSpend!: number

  @Column({ name: 'last_redemption_at', type: 'timestamptz', nullable: true })
  lastRedemptionAt?: Date | null

  // ---- Relations ----
  @OneToMany('CustomerAttribution', 'customer')
  attributions!: any[]

  @OneToMany('Redemption', 'customer')
  redemptions!: any[]
}
