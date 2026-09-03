import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddCreatorPortalPayoutsAndAppeals1789300000000 implements MigrationInterface {
  name = 'AddCreatorPortalPayoutsAndAppeals1789300000000'

  async up(queryRunner: QueryRunner): Promise<void> {
    for (const value of ['creator_profile_updated', 'creator_verification_submitted', 'creator_task_appealed', 'creator_task_payout_verified', 'creator_task_appeal_resolved']) await queryRunner.query(`ALTER TYPE "audit_logs_action_type_enum" ADD VALUE IF NOT EXISTS '${value}'`)
    await queryRunner.query(`CREATE TABLE "creator_task_payouts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "creator_task_id" uuid NOT NULL, "creator_id" uuid NOT NULL, "merchant_id" uuid NOT NULL, "campaign_id" uuid, "expected_amount" numeric(14,2) NOT NULL, "verified_amount" numeric(14,2), "status" character varying(24) NOT NULL DEFAULT 'estimated', "verification_evidence" jsonb NOT NULL DEFAULT '{}'::jsonb, "verified_at" TIMESTAMP WITH TIME ZONE, "settle_at" date, "settled_at" TIMESTAMP WITH TIME ZONE, "risk_hold_reason" text, CONSTRAINT "UQ_creator_task_payout_task" UNIQUE ("creator_task_id"), CONSTRAINT "PK_creator_task_payouts" PRIMARY KEY ("id"))`)
    await queryRunner.query(`CREATE INDEX "idx_creator_task_payout_creator_status" ON "creator_task_payouts" ("creator_id", "status")`)
    await queryRunner.query(`CREATE INDEX "idx_creator_task_payout_settle_at" ON "creator_task_payouts" ("status", "settle_at")`)
    await queryRunner.query(`ALTER TABLE "creator_task_payouts" ADD CONSTRAINT "FK_creator_task_payout_task" FOREIGN KEY ("creator_task_id") REFERENCES "creator_tasks"("id")`)
    await queryRunner.query(`CREATE TABLE "creator_task_appeals" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "creator_task_id" uuid NOT NULL, "creator_id" uuid NOT NULL, "payout_id" uuid, "target" character varying(24) NOT NULL, "reason" text NOT NULL, "evidence" jsonb NOT NULL DEFAULT '{}'::jsonb, "status" character varying(16) NOT NULL DEFAULT 'open', "resolution" text, "resolved_by" uuid, "resolved_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_creator_task_appeals" PRIMARY KEY ("id"))`)
    await queryRunner.query(`CREATE INDEX "idx_creator_task_appeal_creator_status" ON "creator_task_appeals" ("creator_id", "status")`)
    await queryRunner.query(`CREATE INDEX "idx_creator_task_appeal_task" ON "creator_task_appeals" ("creator_task_id")`)
    await queryRunner.query(`ALTER TABLE "creator_task_appeals" ADD CONSTRAINT "FK_creator_task_appeal_task" FOREIGN KEY ("creator_task_id") REFERENCES "creator_tasks"("id")`)
    await queryRunner.query(`ALTER TABLE "creator_task_appeals" ADD CONSTRAINT "FK_creator_task_appeal_payout" FOREIGN KEY ("payout_id") REFERENCES "creator_task_payouts"("id")`)
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "creator_task_appeals"`)
    await queryRunner.query(`DROP TABLE "creator_task_payouts"`)
  }
}
