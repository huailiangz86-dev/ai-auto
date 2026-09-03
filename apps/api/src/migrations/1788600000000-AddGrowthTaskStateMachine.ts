import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddGrowthTaskStateMachine1788600000000 implements MigrationInterface {
  name = 'AddGrowthTaskStateMachine1788600000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "audit_logs_action_type_enum" ADD VALUE IF NOT EXISTS 'growth_task_transition'`,
    )
    await queryRunner.query(
      `ALTER TYPE "audit_logs_action_type_enum" ADD VALUE IF NOT EXISTS 'creator_task_transition'`,
    )
    await queryRunner.query(
      `ALTER TYPE "audit_logs_action_type_enum" ADD VALUE IF NOT EXISTS 'creator_task_reviewed'`,
    )
    await queryRunner.query(
      `ALTER TYPE "audit_logs_action_type_enum" ADD VALUE IF NOT EXISTS 'creator_task_risk_held'`,
    )
    await queryRunner.query(
      `ALTER TYPE "audit_logs_action_type_enum" ADD VALUE IF NOT EXISTS 'campaign_credit_consumed'`,
    )
    await queryRunner.query(
      `CREATE TABLE "growth_tasks" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "merchant_id" uuid NOT NULL, "store_id" uuid, "campaign_id" uuid, "goal_metric" character varying(80) NOT NULL, "baseline_value" numeric(14,2) NOT NULL DEFAULT 0, "target_value" numeric(14,2) NOT NULL, "budget" numeric(14,2) NOT NULL, "compensation_reserved" numeric(14,2) NOT NULL DEFAULT 0, "campaign_credits_reserved" numeric(14,2) NOT NULL DEFAULT 0, "start_at" TIMESTAMP WITH TIME ZONE NOT NULL, "end_at" TIMESTAMP WITH TIME ZONE NOT NULL, "acceptable_risk_boundary" text, "acceptable_roi_boundary" numeric(10,4), "status" character varying(24) NOT NULL DEFAULT 'draft', CONSTRAINT "PK_growth_tasks" PRIMARY KEY ("id"))`,
    )
    await queryRunner.query(
      `CREATE TABLE "creator_tasks" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "growth_task_id" uuid NOT NULL, "campaign_id" uuid, "merchant_id" uuid NOT NULL, "store_id" uuid, "creator_id" uuid NOT NULL, "channel" character varying(40) NOT NULL, "content_type" character varying(40) NOT NULL, "brief" text NOT NULL, "deadline" TIMESTAMP WITH TIME ZONE NOT NULL, "base_reward" numeric(14,2) NOT NULL, "performance_reward" jsonb NOT NULL DEFAULT '{}'::jsonb, "campaign_credits_allocated" numeric(14,2) NOT NULL DEFAULT 0, "campaign_credits_consumed" numeric(14,2) NOT NULL DEFAULT 0, "tracking_id" character varying(120), "published_url" text, "status" character varying(24) NOT NULL DEFAULT 'created', "compensation_snapshot" jsonb, "compensation_locked_at" TIMESTAMP WITH TIME ZONE, "review_reason" text, "reviewed_by" uuid, "reviewed_at" TIMESTAMP WITH TIME ZONE, "risk_hold_reason" text, "risk_hold_previous_status" character varying(24), "state_reason" text, "state_changed_by" uuid, "state_changed_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_creator_tasks" PRIMARY KEY ("id"))`,
    )
    await queryRunner.query(
      `CREATE TABLE "campaign_credit_ledger" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "creator_task_id" uuid NOT NULL, "growth_task_id" uuid NOT NULL, "merchant_id" uuid NOT NULL, "entry_type" character varying(20) NOT NULL, "amount" numeric(14,2) NOT NULL, "idempotency_key" character varying(160) NOT NULL, "source_reference" character varying(120), "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb, CONSTRAINT "PK_campaign_credit_ledger" PRIMARY KEY ("id"))`,
    )
    await queryRunner.query(
      `CREATE INDEX "idx_growth_task_merchant_status" ON "growth_tasks" ("merchant_id", "status")`,
    )
    await queryRunner.query(
      `CREATE INDEX "idx_growth_task_campaign" ON "growth_tasks" ("campaign_id")`,
    )
    await queryRunner.query(
      `CREATE INDEX "idx_creator_task_creator_status" ON "creator_tasks" ("creator_id", "status")`,
    )
    await queryRunner.query(
      `CREATE INDEX "idx_creator_task_growth_task" ON "creator_tasks" ("growth_task_id")`,
    )
    await queryRunner.query(
      `CREATE INDEX "idx_creator_task_campaign_tracking" ON "creator_tasks" ("campaign_id", "tracking_id")`,
    )
    await queryRunner.query(
      `CREATE INDEX "idx_campaign_credit_task_created" ON "campaign_credit_ledger" ("creator_task_id", "createdAt")`,
    )
    await queryRunner.query(
      `CREATE UNIQUE INDEX "idx_campaign_credit_idempotency" ON "campaign_credit_ledger" ("idempotency_key")`,
    )
    await queryRunner.query(
      `ALTER TABLE "growth_tasks" ADD CONSTRAINT "FK_growth_task_merchant" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id")`,
    )
    await queryRunner.query(
      `ALTER TABLE "growth_tasks" ADD CONSTRAINT "FK_growth_task_store" FOREIGN KEY ("store_id") REFERENCES "stores"("id")`,
    )
    await queryRunner.query(
      `ALTER TABLE "growth_tasks" ADD CONSTRAINT "FK_growth_task_campaign" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id")`,
    )
    await queryRunner.query(
      `ALTER TABLE "creator_tasks" ADD CONSTRAINT "FK_creator_task_growth" FOREIGN KEY ("growth_task_id") REFERENCES "growth_tasks"("id")`,
    )
    await queryRunner.query(
      `ALTER TABLE "creator_tasks" ADD CONSTRAINT "FK_creator_task_creator" FOREIGN KEY ("creator_id") REFERENCES "sharing_agents"("id")`,
    )
    await queryRunner.query(
      `ALTER TABLE "campaign_credit_ledger" ADD CONSTRAINT "FK_campaign_credit_creator_task" FOREIGN KEY ("creator_task_id") REFERENCES "creator_tasks"("id")`,
    )
    await queryRunner.query(
      `ALTER TABLE "campaign_credit_ledger" ADD CONSTRAINT "FK_campaign_credit_growth_task" FOREIGN KEY ("growth_task_id") REFERENCES "growth_tasks"("id")`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "campaign_credit_ledger"`)
    await queryRunner.query(`DROP TABLE "creator_tasks"`)
    await queryRunner.query(`DROP TABLE "growth_tasks"`)
    // PostgreSQL enum values are intentionally retained on rollback.
  }
}
