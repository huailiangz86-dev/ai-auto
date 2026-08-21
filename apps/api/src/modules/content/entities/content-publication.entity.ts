// ============================================================
// AI auto - ContentPublication Entity
// Tracks publishing of content to a specific platform
// STORY-AI-023: Multi-platform one-click distribution
// ============================================================

import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm'
import { BaseEntity } from '../../common/entities/base.entity'
import { PlatformType } from '@ai-auto/shared'

export enum PublicationStatus {
  PENDING = 'pending',
  PUBLISHED = 'published',
  FAILED = 'failed',
  MANUAL = 'manual', // copied for manual posting
}

@Entity('content_publications')
@Index('idx_pub_content', ['contentId'])
@Index('idx_pub_platform', ['platform'])
@Index('idx_pub_agent', ['agentId'])
export class ContentPublication extends BaseEntity {
  // ---- Content Link ----
  @Column({ name: 'content_id', type: 'uuid' })
  contentId!: string

  @Column({ name: 'agent_id', type: 'uuid' })
  agentId!: string

  // ---- Platform ----
  @Column({
    name: 'platform',
    type: 'enum',
    enum: PlatformType,
  })
  platform!: PlatformType

  // ---- Publishing Status ----
  @Column({
    name: 'status',
    type: 'enum',
    enum: PublicationStatus,
    default: PublicationStatus.PENDING,
  })
  status!: PublicationStatus

  // ---- Publishing Result ----
  @Column({ name: 'platform_post_id', type: 'varchar', length: 255, nullable: true })
  platformPostId?: string | null

  @Column({ name: 'platform_post_url', type: 'varchar', length: 500, nullable: true })
  platformPostUrl?: string | null

  // ---- Manual mode (copy-paste) ----
  @Column({ name: 'formatted_content', type: 'text', nullable: true })
  formattedContent?: string | null

  // ---- Performance Tracking ----
  @Column({ name: 'impressions', type: 'bigint', default: 0 })
  impressions!: number

  @Column({ name: 'clicks', type: 'bigint', default: 0 })
  clicks!: number

  @Column({ name: 'comments', type: 'int', default: 0 })
  comments!: number

  @Column({ name: 'shares', type: 'int', default: 0 })
  shares!: number

  @Column({ name: 'likes', type: 'int', default: 0 })
  likes!: number

  // ---- Error ----
  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage?: string | null

  // ---- Tracking ----
  @Column({ name: 'published_at', type: 'timestamptz', nullable: true })
  publishedAt?: Date | null
}
