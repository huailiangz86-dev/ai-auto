import { Column, Entity, Index } from 'typeorm'
import { BaseEntity } from '../../common/entities/base.entity'
import { UserRole } from '@ai-auto/shared'

@Entity('notifications')
@Index('idx_notification_recipient_created', ['recipientId', 'recipientRole', 'createdAt'])
@Index('idx_notification_recipient_unread', ['recipientId', 'recipientRole', 'readAt'])
export class Notification extends BaseEntity {
  @Column({ name: 'recipient_id', type: 'uuid' })
  recipientId!: string

  @Column({ name: 'recipient_role', type: 'enum', enum: UserRole })
  recipientRole!: UserRole

  @Column({ type: 'varchar', length: 40 })
  type!: string

  @Column({ type: 'varchar', length: 160 })
  title!: string

  @Column({ type: 'text' })
  body!: string

  @Column({ name: 'target_type', type: 'varchar', length: 40, nullable: true })
  targetType?: string | null

  @Column({ name: 'target_id', type: 'uuid', nullable: true })
  targetId?: string | null

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown> | null

  @Column({ name: 'read_at', type: 'timestamptz', nullable: true })
  readAt?: Date | null
}
