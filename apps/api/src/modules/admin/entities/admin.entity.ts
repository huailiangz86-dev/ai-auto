// ============================================================
// AI auto - Admin Entity
// Platform operations administrators
// ============================================================

import { Entity, Column, Index } from 'typeorm'
import { Exclude } from 'class-transformer'
import { BaseEntity } from '../../common/entities/base.entity'

@Entity('admins')
@Index('idx_admin_username', ['username'], { unique: true })
@Index('idx_admin_role', ['role'])
export class Admin extends BaseEntity {
  @Column({ type: 'varchar', length: 50 })
  username!: string

  @Column({ type: 'varchar', length: 255, select: false })
  @Exclude()
  passwordHash!: string

  @Column({ type: 'varchar', length: 100 })
  realName!: string

  @Column({ type: 'varchar', length: 100, nullable: true })
  email?: string | null

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone?: string | null

  // 'super_admin' | 'merchant_reviewer' | 'agent_reviewer' | 'content_moderator' | 'finance' | 'operator'
  @Column({ name: 'role', type: 'varchar', length: 30 })
  role!: string

  // Permissions bitmask (for granular access control)
  @Column({ name: 'permissions', type: 'int', default: 0 })
  permissions!: number

  // MFA
  @Column({ name: 'mfa_enabled', type: 'boolean', default: false })
  mfaEnabled!: boolean

  @Column({ name: 'mfa_secret', type: 'varchar', length: 255, nullable: true, select: false })
  @Exclude()
  mfaSecret?: string | null

  // Status
  @Column({ type: 'boolean', default: true })
  status!: boolean

  // Last login
  @Column({ name: 'last_login_at', type: 'timestamptz', nullable: true })
  lastLoginAt?: Date | null
}
