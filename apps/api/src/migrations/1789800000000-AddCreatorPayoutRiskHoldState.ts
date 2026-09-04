import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddCreatorPayoutRiskHoldState1789800000000 implements MigrationInterface {
  name = 'AddCreatorPayoutRiskHoldState1789800000000'

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "creator_task_payouts" ADD COLUMN "risk_hold_previous_status" character varying(24)',
    )
    await queryRunner.query(
      `UPDATE "creator_task_payouts" AS payout
       SET "risk_hold_previous_status" = payout."status",
           "status" = 'risk_hold',
           "risk_hold_reason" = COALESCE(payout."risk_hold_reason", task."risk_hold_reason")
       FROM "creator_tasks" AS task
       WHERE payout."creator_task_id" = task."id"
         AND task."status" = 'risk_hold'
         AND payout."status" IN ('estimated', 'verified')`,
    )
    await queryRunner.query(
      `UPDATE "creator_task_payouts"
       SET "risk_hold_previous_status" = CASE
         WHEN "verified_at" IS NOT NULL OR "verified_amount" IS NOT NULL THEN 'verified'
         ELSE 'estimated'
       END
       WHERE "status" = 'risk_hold' AND "risk_hold_previous_status" IS NULL`,
    )
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "creator_task_payouts"
       SET "status" = COALESCE(
         "risk_hold_previous_status",
         CASE WHEN "verified_at" IS NOT NULL OR "verified_amount" IS NOT NULL
           THEN 'verified' ELSE 'estimated' END
       )
       WHERE "status" = 'risk_hold'`,
    )
    await queryRunner.query(
      'ALTER TABLE "creator_task_payouts" DROP COLUMN "risk_hold_previous_status"',
    )
  }
}
