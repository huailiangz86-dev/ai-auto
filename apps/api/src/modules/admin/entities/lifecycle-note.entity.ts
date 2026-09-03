import { Column, Entity, Index } from 'typeorm'
import { BaseEntity } from '../../common/entities/base.entity'

/** Append-only operational notes and follow-ups for merchant/creator lifecycle work. */
@Entity('lifecycle_notes')
@Index('idx_lifecycle_note_subject_created', ['subjectType', 'subjectId', 'createdAt'])
export class LifecycleNote extends BaseEntity {
  @Column({ name: 'subject_type', type: 'varchar', length: 24 })
  subjectType!: 'merchant' | 'creator' | 'relationship'

  @Column({ name: 'subject_id', type: 'uuid' })
  subjectId!: string

  @Column({ type: 'varchar', length: 32, default: 'operation' })
  category!: 'operation' | 'risk' | 'follow_up'

  @Column({ type: 'text' })
  content!: string

  @Column({ type: 'text', nullable: true })
  reason?: string | null

  @Column({ name: 'follow_up_at', type: 'timestamptz', nullable: true })
  followUpAt?: Date | null

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy?: string | null

  @Column({ name: 'created_by_name', type: 'varchar', length: 100, nullable: true })
  createdByName?: string | null
}
