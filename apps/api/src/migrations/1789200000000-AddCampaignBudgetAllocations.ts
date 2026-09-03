import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddCampaignBudgetAllocations1789200000000 implements MigrationInterface {
  name = 'AddCampaignBudgetAllocations1789200000000'

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TYPE "audit_logs_action_type_enum" ADD VALUE IF NOT EXISTS 'campaign_budget_funded'`)
    await queryRunner.query(`CREATE TABLE "campaign_budget_allocations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "merchant_id" uuid NOT NULL, "growth_plan_id" uuid NOT NULL, "growth_task_id" uuid NOT NULL, "campaign_id" uuid NOT NULL, "category" character varying(32) NOT NULL, "planned_amount" numeric(14,2) NOT NULL, "committed_amount" numeric(14,2) NOT NULL DEFAULT 0, "spent_amount" numeric(14,2) NOT NULL DEFAULT 0, "status" character varying(16) NOT NULL DEFAULT 'funded', "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb, CONSTRAINT "PK_campaign_budget_allocations" PRIMARY KEY ("id"), CONSTRAINT "UQ_campaign_budget_allocation_category" UNIQUE ("campaign_id", "category"))`)
    await queryRunner.query(`CREATE INDEX "idx_campaign_budget_allocation_merchant" ON "campaign_budget_allocations" ("merchant_id", "status")`)
    await queryRunner.query(`ALTER TABLE "campaign_budget_allocations" ADD CONSTRAINT "FK_campaign_budget_allocation_merchant" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id")`)
    await queryRunner.query(`ALTER TABLE "campaign_budget_allocations" ADD CONSTRAINT "FK_campaign_budget_allocation_plan" FOREIGN KEY ("growth_plan_id") REFERENCES "growth_plans"("id")`)
    await queryRunner.query(`ALTER TABLE "campaign_budget_allocations" ADD CONSTRAINT "FK_campaign_budget_allocation_task" FOREIGN KEY ("growth_task_id") REFERENCES "growth_tasks"("id")`)
    await queryRunner.query(`ALTER TABLE "campaign_budget_allocations" ADD CONSTRAINT "FK_campaign_budget_allocation_campaign" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id")`)
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "campaign_budget_allocations"`)
  }
}
