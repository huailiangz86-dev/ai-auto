// ============================================================
// AI auto - MerchantApiKey Entity
// API key management for merchant callback integrations
// ============================================================

import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm'
import { BaseEntity } from '../../common/entities/base.entity'
import { Merchant } from './merchant.entity'

@Entity('merchant_api_keys')
@Index('idx_mak_key', ['apiKey'], { unique: true })
@Index('idx_mak_secret_hash', ['apiSecretHash'])
@Index('idx_mak_merchant', ['merchantId'])
export class MerchantApiKey extends BaseEntity {
  @Column({ name: 'merchant_id', type: 'uuid' })
  merchantId!: string

  // ---- API Key (public identifier) ----
  // Format: app_{random}
  @Column({ name: 'api_key', type: 'varchar', length: 100, unique: true })
  apiKey!: string

  // ---- API Secret (hashed, never stored in plain text) ----
  @Column({ name: 'api_secret_hash', type: 'varchar', length: 255 })
  apiSecretHash!: string

  // ---- Key Metadata ----
  @Column({ name: 'key_name', type: 'varchar', length: 100, nullable: true })
  keyName?: string | null

  // ---- IP Whitelist ----
  // Comma-separated IP addresses or CIDR ranges
  @Column({ name: 'ip_whitelist', type: 'text', nullable: true })
  ipWhitelist?: string | null

  // ---- Rate Limit ----
  // Max requests per minute
  @Column({ name: 'rate_limit_per_minute', type: 'int', default: 100 })
  rateLimitPerMinute!: number

  // ---- Callback URL ----
  // Where AI auto sends redemption notifications
  @Column({ name: 'callback_url', type: 'varchar', length: 500, nullable: true })
  callbackUrl?: string | null

  // HMAC secret for signing callback requests to merchant
  @Column({ name: 'callback_secret', type: 'varchar', length: 255, nullable: true })
  callbackSecret?: string | null

  // ---- Status ----
  // true = active, false = revoked
  @Column({ type: 'boolean', default: true })
  status!: boolean

  // ---- Usage Stats ----
  @Column({ name: 'total_calls', type: 'bigint', default: 0 })
  totalCalls!: number

  @Column({ name: 'last_called_at', type: 'timestamptz', nullable: true })
  lastCalledAt?: Date | null

  // ---- Timestamps ----
  @Column({ name: 'first_used_at', type: 'timestamptz', nullable: true })
  firstUsedAt?: Date | null

  // ---- Rotation ----
  @Column({ name: 'previous_api_secret_hash', type: 'varchar', length: 255, nullable: true })
  previousApiSecretHash?: string | null

  // Previous secret valid until (grace period after rotation)
  @Column({ name: 'previous_secret_expires_at', type: 'timestamptz', nullable: true })
  previousSecretExpiresAt?: Date | null

  // ---- Relations ----
  @ManyToOne('Merchant')
  @JoinColumn({ name: 'merchant_id' })
  merchant!: Merchant
}
