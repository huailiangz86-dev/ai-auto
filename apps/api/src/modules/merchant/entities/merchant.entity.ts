// ============================================================
// AI auto - Merchant Entity
// Represents a merchant/business owner on the platform
// ============================================================

import { Entity, Column, OneToMany, ManyToOne, OneToOne, JoinColumn, Index } from 'typeorm'
import { Exclude } from 'class-transformer'
import { BaseEntity } from '../../common/entities/base.entity'
import { SubscriptionStatus, AuditStatus } from '@ai-auto/shared'

@Entity('merchants')
@Index('idx_merchant_phone', ['phone'])
@Index('idx_merchant_status', ['status'])
@Index('idx_merchant_audit_status', ['auditStatus'])
export class Merchant extends BaseEntity {
  // ---- Basic Info ----
  @Column({ name: 'business_name', type: 'varchar', length: 200 })
  businessName!: string

  @Column({ name: 'business_license_no', type: 'varchar', length: 50, nullable: true })
  businessLicenseNo?: string | null

  @Column({ type: 'varchar', length: 20 })
  phone!: string

  @Column({ type: 'varchar', length: 255, nullable: true })
  email?: string | null

  // ---- Password (hashed) ----
  @Column({ name: 'password_hash', type: 'varchar', length: 255, select: false })
  @Exclude()
  passwordHash!: string

  // ---- Business Type ----
  @Column({
    name: 'business_type',
    type: 'varchar',
    length: 50,
    default: 'individual',
  })
  businessType!: string // 'enterprise' | 'individual'

  // ---- Industry ----
  @Column({ name: 'industry_category', type: 'varchar', length: 100, nullable: true })
  industryCategory?: string | null

  // ---- Audit ----
  @Column({
    name: 'audit_status',
    type: 'enum',
    enum: AuditStatus,
    default: AuditStatus.PENDING,
  })
  auditStatus!: AuditStatus

  @Column({ name: 'audit_comment', type: 'text', nullable: true })
  auditComment?: string | null

  @Column({ name: 'audited_at', type: 'timestamptz', nullable: true })
  auditedAt?: Date | null

  // Kept separately from audit status so an approved merchant can still be
  // temporarily disabled without changing its audit history.
  @Column({ type: 'boolean', default: true })
  status!: boolean

  @Column({ name: 'frozen_at', type: 'timestamptz', nullable: true })
  frozenAt?: Date | null

  @Column({ name: 'frozen_reason', type: 'text', nullable: true })
  frozenReason?: string | null

  @Column({ name: 'operation_tags', type: 'jsonb', default: () => "'[]'::jsonb" })
  operationTags!: string[]

  // ---- Contact Person ----
  @Column({ name: 'contact_name', type: 'varchar', length: 100, nullable: true })
  contactName?: string | null

  @Column({ name: 'contact_phone', type: 'varchar', length: 20, nullable: true })
  contactPhone?: string | null

  // ---- Address ----
  @Column({ name: 'province', type: 'varchar', length: 50, nullable: true })
  province?: string | null

  @Column({ name: 'city', type: 'varchar', length: 50, nullable: true })
  city?: string | null

  @Column({ name: 'district', type: 'varchar', length: 50, nullable: true })
  district?: string | null

  @Column({ name: 'address_detail', type: 'varchar', length: 500, nullable: true })
  addressDetail?: string | null

  // ---- Subscription ----
  @Column({
    name: 'subscription_status',
    type: 'enum',
    enum: SubscriptionStatus,
    default: SubscriptionStatus.EXPIRED,
  })
  subscriptionStatus!: SubscriptionStatus

  // ---- Platform Multi-Account ----
  @Column({ name: 'douyin_bind_status', type: 'boolean', default: false })
  douyinBindStatus!: boolean

  @Column({ name: 'xiaohongshu_bind_status', type: 'boolean', default: false })
  xiaohongshuBindStatus!: boolean

  @Column({ name: 'video_account_bind_status', type: 'boolean', default: false })
  videoAccountBindStatus!: boolean

  // ---- Relations ----
  @OneToMany('Store', 'merchant')
  stores!: any[]

  @OneToMany('Subscription', 'merchant')
  subscriptions!: any[]

  @OneToMany('CommissionBudget', 'merchant')
  commissionBudgets!: any[]
}
