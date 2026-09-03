import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddMerchantGrowthPlans1789100000000 implements MigrationInterface {
  name = 'AddMerchantGrowthPlans1789100000000'

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TYPE "audit_logs_action_type_enum" ADD VALUE IF NOT EXISTS 'growth_plan_created'`)
    await queryRunner.query(`ALTER TYPE "audit_logs_action_type_enum" ADD VALUE IF NOT EXISTS 'growth_plan_approved'`)
    await queryRunner.query(`CREATE TABLE "growth_plans" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "merchant_id" uuid NOT NULL, "growth_task_id" uuid NOT NULL, "campaign_id" uuid, "goal_brief" text NOT NULL, "title" character varying(200) NOT NULL, "status" character varying(24) NOT NULL DEFAULT 'proposed', "alternatives" jsonb NOT NULL DEFAULT '[]'::jsonb, "selected_option_id" integer, "ai_metadata" jsonb NOT NULL DEFAULT '{}'::jsonb, "approved_at" TIMESTAMP WITH TIME ZONE, "approved_by" uuid, CONSTRAINT "PK_growth_plans" PRIMARY KEY ("id"), CONSTRAINT "UQ_growth_plan_growth_task" UNIQUE ("growth_task_id"))`)
    await queryRunner.query(`CREATE INDEX "idx_growth_plan_merchant_status" ON "growth_plans" ("merchant_id", "status")`)
    await queryRunner.query(`ALTER TABLE "growth_plans" ADD CONSTRAINT "FK_growth_plan_merchant" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id")`)
    await queryRunner.query(`ALTER TABLE "growth_plans" ADD CONSTRAINT "FK_growth_plan_task" FOREIGN KEY ("growth_task_id") REFERENCES "growth_tasks"("id")`)
    await queryRunner.query(`ALTER TABLE "growth_plans" ADD CONSTRAINT "FK_growth_plan_campaign" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id")`)
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "growth_plans"`)
  }
}
