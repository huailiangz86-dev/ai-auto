import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Stores the portion of a future payout that was automatically applied to an
 * outstanding recovery receivable. The payout's verified amount stays gross.
 */
export class AddCreatorPayoutRecoveryOffset1790200000000 implements MigrationInterface {
  name = 'AddCreatorPayoutRecoveryOffset1790200000000'

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "creator_task_payouts" ADD COLUMN IF NOT EXISTS "recovery_offset_amount" numeric(14,2) NOT NULL DEFAULT 0`,
    )
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "creator_task_payouts" DROP COLUMN "recovery_offset_amount"`,
    )
  }
}
