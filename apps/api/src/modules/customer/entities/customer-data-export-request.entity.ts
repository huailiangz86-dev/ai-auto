// ============================================================
// Customer personal-data export request audit trail
// ============================================================

import { Column, Entity, Index } from 'typeorm'
import { BaseEntity } from '../../common/entities/base.entity'

@Entity('customer_data_export_requests')
@Index('idx_customer_export_request_customer_created', ['customerId', 'createdAt'])
export class CustomerDataExportRequest extends BaseEntity {
  @Column({ name: 'customer_id', type: 'uuid' })
  customerId!: string

  @Column({ type: 'varchar', length: 20, default: 'json' })
  format!: string

  @Column({ type: 'varchar', length: 20, default: 'completed' })
  status!: string

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt?: Date | null
}
