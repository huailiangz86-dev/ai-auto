import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddBilateralCreatorTaskAppeals1790000000000 implements MigrationInterface {
  name = 'AddBilateralCreatorTaskAppeals1790000000000'

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "audit_logs_action_type_enum" ADD VALUE IF NOT EXISTS 'merchant_task_appealed'`,
    )
    await queryRunner.query(
      `ALTER TABLE "creator_task_appeals" ADD COLUMN IF NOT EXISTS "merchant_id" uuid`,
    )
    await queryRunner.query(
      `ALTER TABLE "creator_task_appeals" ADD COLUMN IF NOT EXISTS "appellant_type" character varying(16) NOT NULL DEFAULT 'creator'`,
    )
    await queryRunner.query(
      `ALTER TABLE "creator_task_appeals" ADD COLUMN IF NOT EXISTS "appeal_deadline_at" TIMESTAMP WITH TIME ZONE`,
    )
    await queryRunner.query(
      `UPDATE "creator_task_appeals" AS appeal
       SET "merchant_id" = task."merchant_id",
           "appeal_deadline_at" = appeal."createdAt" + INTERVAL '30 days'
       FROM "creator_tasks" AS task
       WHERE task."id" = appeal."creator_task_id"`,
    )
    await queryRunner.query(
      `ALTER TABLE "creator_task_appeals" ALTER COLUMN "merchant_id" SET NOT NULL`,
    )
    await queryRunner.query(
      `ALTER TABLE "creator_task_appeals" ALTER COLUMN "appeal_deadline_at" SET NOT NULL`,
    )
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_creator_task_appeal_merchant_status" ON "creator_task_appeals" ("merchant_id", "status")`,
    )
    await queryRunner.query(
      `DO $$
       BEGIN
         IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_creator_task_appeal_merchant') THEN
           ALTER TABLE "creator_task_appeals"
             ADD CONSTRAINT "FK_creator_task_appeal_merchant"
             FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
         END IF;
       END $$`,
    )
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "creator_task_appeals" DROP CONSTRAINT "FK_creator_task_appeal_merchant"`,
    )
    await queryRunner.query(`DROP INDEX "public"."idx_creator_task_appeal_merchant_status"`)
    await queryRunner.query(`ALTER TABLE "creator_task_appeals" DROP COLUMN "appeal_deadline_at"`)
    await queryRunner.query(`ALTER TABLE "creator_task_appeals" DROP COLUMN "appellant_type"`)
    await queryRunner.query(`ALTER TABLE "creator_task_appeals" DROP COLUMN "merchant_id"`)
  }
}
