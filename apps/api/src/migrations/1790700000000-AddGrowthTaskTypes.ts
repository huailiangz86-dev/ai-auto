import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddGrowthTaskTypes1790700000000 implements MigrationInterface {
  name = 'AddGrowthTaskTypes1790700000000'

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "growth_tasks" ADD COLUMN IF NOT EXISTS "task_type" character varying(32) NOT NULL DEFAULT 'customer_campaign'`,
    )
    await queryRunner.query(
      `ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "purpose" character varying(32) NOT NULL DEFAULT 'customer_campaign'`,
    )
    // A creator-content plan must never point at a consumer coupon. This also
    // repairs environments where the historical backfill ran before task
    // types were introduced.
    await queryRunner.query(`
      UPDATE "growth_plans" p
      SET "coupon_id" = NULL
      FROM "growth_tasks" t
      WHERE t."id" = p."growth_task_id"
        AND t."task_type" = 'creator_content'
        AND p."coupon_id" IS NOT NULL
    `)
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_growth_task_merchant_type" ON "growth_tasks" ("merchant_id", "task_type")`,
    )
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_growth_task_merchant_type"`)
    await queryRunner.query(`ALTER TABLE "campaigns" DROP COLUMN IF EXISTS "purpose"`)
    await queryRunner.query(`ALTER TABLE "growth_tasks" DROP COLUMN IF EXISTS "task_type"`)
  }
}
