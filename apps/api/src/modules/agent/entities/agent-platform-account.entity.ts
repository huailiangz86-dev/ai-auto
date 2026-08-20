// ============================================================
// AI auto - Agent Platform Account Entity
// Agent's bound platform accounts (Douyin/Xiaohongshu/WeChat Video Account)
// ============================================================

import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm'
import { BaseEntity } from '../../common/entities/base.entity'
import { PlatformType } from '@ai-auto/shared'
import { SharingAgent } from './sharing-agent.entity'

@Entity('agent_platform_accounts')
@Index('idx_ap_account_platform_uid', ['platformType', 'platformUserId'])
@Index('idx_ap_agent', ['agentId'])
@Index('idx_ap_status', ['status'])
export class AgentPlatformAccount extends BaseEntity {
  @Column({ name: 'agent_id', type: 'uuid' })
  agentId!: string

  @Column({
    name: 'platform_type',
    type: 'enum',
    enum: PlatformType,
  })
  platformType!: PlatformType

  @Column({ name: 'platform_user_id', type: 'varchar', length: 255 })
  platformUserId!: string

  @Column({ name: 'platform_nickname', type: 'varchar', length: 200, nullable: true })
  platformNickname?: string | null

  @Column({ name: 'platform_avatar', type: 'varchar', length: 500, nullable: true })
  platformAvatar?: string | null

  @Column({ name: 'account_no', type: 'varchar', length: 50, nullable: true })
  accountNo?: string | null

  // ---- OAuth Token Storage (encrypted) ----
  @Column({ name: 'access_token', type: 'text', nullable: true, select: false })
  accessToken?: string | null

  @Column({ name: 'refresh_token', type: 'text', nullable: true, select: false })
  refreshToken?: string | null

  @Column({ name: 'token_expire_at', type: 'timestamptz', nullable: true })
  tokenExpireAt?: Date | null

  // ---- Account Type ----
  @Column({ name: 'is_enterprise_account', type: 'boolean', default: false })
  isEnterpriseAccount!: boolean

  // ---- Status ----
  @Column({ type: 'boolean', default: true })
  status!: boolean

  @Column({ name: 'deactivated_at', type: 'timestamptz', nullable: true })
  deactivatedAt?: Date | null

  // ---- Bind Info ----
  @Column({ name: 'bound_at', type: 'timestamptz' })
  boundAt!: Date

  @Column({ name: 'unbind_at', type: 'timestamptz', nullable: true })
  unbindAt?: Date | null

  // ---- Aggregated Stats from this platform ----
  @Column({ name: 'total_impressions', type: 'bigint', default: 0 })
  totalImpressions!: number

  @Column({ name: 'total_clicks', type: 'bigint', default: 0 })
  totalClicks!: number

  @Column({ name: 'total_claims', type: 'bigint', default: 0 })
  totalClaims!: number

  // ---- Relations ----
  @ManyToOne('SharingAgent', 'platformAccounts')
  @JoinColumn({ name: 'agent_id' })
  agent!: any
}
