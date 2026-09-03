import { Column, Entity, Index } from 'typeorm'
import { BaseEntity } from '../../common/entities/base.entity'

export type FinancialClassification = 'revenue' | 'cogs' | 'operating_cost' | 'reserve'

/**
 * Append-only v2 commercial ledger. Creator payout is explicitly COGS and
 * therefore cannot be mixed with Merchant Growth Revenue in reporting.
 */
@Entity('financial_ledger_entries')
@Index('idx_fle_campaign_occurred', ['campaignId', 'occurredAt'])
@Index('idx_fle_merchant_occurred', ['merchantId', 'occurredAt'])
@Index('idx_fle_classification_occurred', ['classification', 'occurredAt'])
@Index('idx_fle_idempotency', ['idempotencyKey'], { unique: true })
export class FinancialLedgerEntry extends BaseEntity {
  @Column({ name: 'classification', type: 'varchar', length: 20 })
  classification!: FinancialClassification

  @Column({ name: 'entry_type', type: 'varchar', length: 40 })
  entryType!: string

  @Column({ type: 'decimal', precision: 14, scale: 2 })
  amount!: number

  @Column({ type: 'char', length: 3, default: 'CNY' })
  currency!: string

  @Column({ name: 'merchant_id', type: 'uuid', nullable: true })
  merchantId?: string | null

  @Column({ name: 'campaign_id', type: 'uuid', nullable: true })
  campaignId?: string | null

  // Compatibility note: current persistence uses agent_id; public v2 APIs use Creator.
  @Column({ name: 'creator_id', type: 'uuid', nullable: true })
  creatorId?: string | null

  @Column({ name: 'creator_task_id', type: 'uuid', nullable: true })
  creatorTaskId?: string | null

  @Column({ name: 'source_reference', type: 'varchar', length: 120, nullable: true })
  sourceReference?: string | null

  @Column({ name: 'idempotency_key', type: 'varchar', length: 160 })
  idempotencyKey!: string

  @Column({ name: 'recorded_by_admin_id', type: 'uuid', nullable: true })
  recordedByAdminId?: string | null

  @Column({ name: 'occurred_at', type: 'timestamptz' })
  occurredAt!: Date

  @Column({ type: 'varchar', length: 500, nullable: true })
  description?: string | null

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  metadata!: Record<string, unknown>
}