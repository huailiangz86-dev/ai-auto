import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddLifecycleManagement1788900000000 implements MigrationInterface {
  name = 'AddLifecycleManagement1788900000000'

  async up(queryRunner: QueryRunner): Promise<void> {
    const auditActions = [
      'merchant_frozen', 'merchant_restored', 'creator_restored', 'creator_task_limit_updated',
      'lifecycle_tagged', 'lifecycle_note_created', 'lifecycle_notification_sent',
      'relationship_restricted', 'relationship_released', 'relationship_unbound',
    ]
    for (const action of auditActions) {
      await queryRunner.query(`ALTER TYPE "audit_logs_action_type_enum" ADD VALUE IF NOT EXISTS '${action}'`)
    }
    await queryRunner.query(`ALTER TABLE "merchants" ADD COLUMN IF NOT EXISTS "frozen_at" TIMESTAMP WITH TIME ZONE`)
    await queryRunner.query(`ALTER TABLE "merchants" ADD COLUMN IF NOT EXISTS "frozen_reason" text`)
    await queryRunner.query(`ALTER TABLE "merchants" ADD COLUMN IF NOT EXISTS "operation_tags" jsonb NOT NULL DEFAULT '[]'::jsonb`)
    await queryRunner.query(`ALTER TABLE "sharing_agents" ADD COLUMN IF NOT EXISTS "frozen_at" TIMESTAMP WITH TIME ZONE`)
    await queryRunner.query(`ALTER TABLE "sharing_agents" ADD COLUMN IF NOT EXISTS "frozen_reason" text`)
    await queryRunner.query(`ALTER TABLE "sharing_agents" ADD COLUMN IF NOT EXISTS "creator_task_limit" integer`)
    await queryRunner.query(`ALTER TABLE "sharing_agents" ADD COLUMN IF NOT EXISTS "operation_tags" jsonb NOT NULL DEFAULT '[]'::jsonb`)
    await queryRunner.query(`ALTER TABLE "merchant_agent_bindings" ADD COLUMN IF NOT EXISTS "restricted_at" TIMESTAMP WITH TIME ZONE`)
    await queryRunner.query(`ALTER TABLE "merchant_agent_bindings" ADD COLUMN IF NOT EXISTS "restriction_reason" text`)
    await queryRunner.query(`CREATE TABLE "lifecycle_notes" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "subject_type" character varying(24) NOT NULL, "subject_id" uuid NOT NULL, "category" character varying(32) NOT NULL DEFAULT 'operation', "content" text NOT NULL, "reason" text, "follow_up_at" TIMESTAMP WITH TIME ZONE, "created_by" uuid, "created_by_name" character varying(100), CONSTRAINT "PK_lifecycle_notes" PRIMARY KEY ("id"))`)
    await queryRunner.query(`CREATE INDEX "idx_lifecycle_note_subject_created" ON "lifecycle_notes" ("subject_type", "subject_id", "createdAt")`)
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "lifecycle_notes"`)
    await queryRunner.query(`ALTER TABLE "merchant_agent_bindings" DROP COLUMN "restriction_reason"`)
    await queryRunner.query(`ALTER TABLE "merchant_agent_bindings" DROP COLUMN "restricted_at"`)
    await queryRunner.query(`ALTER TABLE "sharing_agents" DROP COLUMN "operation_tags"`)
    await queryRunner.query(`ALTER TABLE "sharing_agents" DROP COLUMN "creator_task_limit"`)
    await queryRunner.query(`ALTER TABLE "sharing_agents" DROP COLUMN "frozen_reason"`)
    await queryRunner.query(`ALTER TABLE "sharing_agents" DROP COLUMN "frozen_at"`)
    await queryRunner.query(`ALTER TABLE "merchants" DROP COLUMN "operation_tags"`)
    await queryRunner.query(`ALTER TABLE "merchants" DROP COLUMN "frozen_reason"`)
    await queryRunner.query(`ALTER TABLE "merchants" DROP COLUMN "frozen_at"`)
  }
}
