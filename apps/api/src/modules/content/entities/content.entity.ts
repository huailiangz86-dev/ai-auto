// ============================================================
// AI auto - Content Entity
// AI-generated content records
// ============================================================

import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm'
import { BaseEntity } from '../../common/entities/base.entity'
import { ContentStatus, PlatformType } from '@ai-auto/shared'
import { SharingAgent } from '../../agent/entities/sharing-agent.entity'
import { Campaign } from '../../campaign/entities/campaign.entity'

@Entity('contents')
@Index('idx_content_agent', ['agentId'])
@Index('idx_content_campaign', ['campaignId'])
@Index('idx_content_status', ['status'])
@Index('idx_content_type', ['contentType'])
@Index('idx_content_creator_task', ['creatorTaskId'])
export class Content extends BaseEntity {
  // ---- Links ----
  @Column({ name: 'agent_id', type: 'uuid' })
  agentId!: string

  @Column({ name: 'campaign_id', type: 'uuid', nullable: true })
  campaignId?: string | null

  @Column({ name: 'coupon_id', type: 'uuid', nullable: true })
  couponId?: string | null

  // Merchant-funded Creator Studio output is linked to the assignment that
  // funded it, so task review and the financial evidence chain stay joined.
  @Column({ name: 'creator_task_id', type: 'uuid', nullable: true })
  creatorTaskId?: string | null

  // ---- Content Type ----
  // 'copywriting' | 'video' | 'poster'
  @Column({ name: 'content_type', type: 'varchar', length: 30 })
  contentType!: string

  // Target platform
  @Column({
    name: 'target_platform',
    type: 'enum',
    enum: PlatformType,
    nullable: true,
  })
  targetPlatform?: PlatformType | null

  // ---- AI Generation Request ----
  @Column({ name: 'ai_request_id', type: 'varchar', length: 100, nullable: true })
  aiRequestId?: string | null

  // AI model used
  @Column({ name: 'ai_model', type: 'varchar', length: 50, nullable: true })
  aiModel?: string | null

  // ---- Content Data (JSON) ----
  // For copywriting: { options: [{copy, tone, tracking_url}] }
  // For video: { script, voiceover, subtitles, video_url, thumbnail_url }
  // For poster: { options: [{image_url, thumbnail_url}] }
  @Column({ name: 'content_data', type: 'jsonb', nullable: true })
  contentData?: Record<string, any> | null

  @Column({ name: 'selected_option', type: 'int', nullable: true })
  selectedOption?: number | null

  // ---- Status ----
  @Column({
    name: 'status',
    type: 'enum',
    enum: ContentStatus,
    default: ContentStatus.DRAFT,
  })
  status!: ContentStatus

  // ---- Moderation ----
  @Column({ name: 'moderation_status', type: 'varchar', length: 20, default: 'pending' })
  moderationStatus!: string // 'pending' | 'passed' | 'flagged' | 'blocked'

  @Column({ name: 'moderation_result', type: 'jsonb', nullable: true })
  moderationResult?: Record<string, any> | null

  @Column({ name: 'moderation_message', type: 'text', nullable: true })
  moderationMessage?: string | null

  // ---- Cost (AI Token) ----
  @Column({ name: 'ai_token_cost', type: 'decimal', precision: 10, scale: 4, default: 0 })
  aiTokenCost!: number

  @Column({ name: 'cost_deducted', type: 'boolean', default: false })
  costDeducted!: boolean

  // ---- Tracking ----
  @Column({ name: 'tracking_url', type: 'varchar', length: 500, nullable: true })
  trackingUrl?: string | null

  @Column({ name: 'tracking_qr_code', type: 'varchar', length: 500, nullable: true })
  trackingQrCode?: string | null

  // ---- Performance ----
  @Column({ name: 'total_impressions', type: 'bigint', default: 0 })
  totalImpressions!: number

  @Column({ name: 'total_clicks', type: 'bigint', default: 0 })
  totalClicks!: number

  @Column({ name: 'total_claims', type: 'int', default: 0 })
  totalClaims!: number

  // ---- AI Token Usage ----
  @Column({ name: 'input_tokens', type: 'int', nullable: true })
  inputTokens?: number | null

  @Column({ name: 'output_tokens', type: 'int', nullable: true })
  outputTokens?: number | null

  // ---- Relations ----
  @ManyToOne(() => SharingAgent)
  @JoinColumn({ name: 'agent_id' })
  agent!: SharingAgent

  @ManyToOne(() => Campaign)
  @JoinColumn({ name: 'campaign_id' })
  campaign?: Campaign
}
