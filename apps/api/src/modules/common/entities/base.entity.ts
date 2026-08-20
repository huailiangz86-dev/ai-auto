// ============================================================
// AI auto - Common Entity Base Class
// All entities inherit from this base class
// ============================================================

import {
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Column,
} from 'typeorm'

/**
 * Base entity with common fields:
 * - id: Auto-incrementing UUID primary key
 * - createdAt: Creation timestamp
 * - updatedAt: Last update timestamp
 * - deletedAt: Soft delete timestamp (nullable)
 */
export abstract class BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deletedAt?: Date | null
}

/**
 * Base entity with soft-delete awareness
 */
export abstract class SoftDeletableEntity extends BaseEntity {
  @Column({ name: 'is_deleted', type: 'boolean', default: false })
  isDeleted!: boolean
}
