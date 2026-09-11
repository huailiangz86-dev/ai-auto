import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Makes every recovery receivable attributable to one adjudication. Future
 * settlement offsets remain append-only financial ledger entries.
 */
export class AddRecoveryProgressToAppeals1790300000000 implements MigrationInterface {
  name = 'AddRecoveryProgressToAppeals1790300000000'

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "creator_task_appeals" ADD COLUMN "recovery_amount" numeric(14,2) NOT NULL DEFAULT 0`,
    )
    await queryRunner.query(
      `ALTER TABLE "creator_task_appeals" ADD COLUMN "recovery_recovered_amount" numeric(14,2) NOT NULL DEFAULT 0`,
    )
    await queryRunner.query(
      `ALTER TABLE "creator_task_appeals" ADD COLUMN "recovery_completed_at" TIMESTAMP WITH TIME ZONE`,
    )
    // Historical rows predate per-ruling recovery tracking. They retain the
    // aggregate wallet balance; new adjudications are fully traceable.
    await queryRunner.query(
      `UPDATE "creator_task_appeals"
       SET "recovery_amount" = GREATEST(COALESCE("amount_before", 0) - COALESCE("amount_after", 0), 0)
       WHERE "adjudication_decision" = 'reverse_settlement'`,
    )
    // Earlier releases retained only a creator-level receivable. Attribute its
    // remaining balance to the oldest rulings first so old rows do not become
    // falsely collectible again after this migration. This is an opening
    // balance allocation, not a newly-created financial ledger event.
    await queryRunner.query(`
      WITH recovery_rows AS (
        SELECT
          appeal.id,
          appeal.recovery_amount,
          wallet.recovery_receivable_balance,
          COALESCE(
            SUM(appeal.recovery_amount) OVER (
              PARTITION BY appeal.creator_id
              ORDER BY COALESCE(appeal.resolved_at, appeal."createdAt"), appeal.id
              ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
            ),
            0
          ) AS prior_recovery_amount
        FROM creator_task_appeals appeal
        JOIN agent_wallets wallet ON wallet.agent_id = appeal.creator_id
        WHERE appeal.adjudication_decision = 'reverse_settlement'
      ), allocated AS (
        SELECT
          id,
          GREATEST(
            0,
            LEAST(recovery_amount, recovery_receivable_balance - prior_recovery_amount)
          ) AS remaining_amount,
          recovery_amount
        FROM recovery_rows
      )
      UPDATE creator_task_appeals appeal
      SET recovery_recovered_amount = allocated.recovery_amount - allocated.remaining_amount,
          recovery_completed_at = CASE
            WHEN allocated.remaining_amount = 0 AND allocated.recovery_amount > 0
            THEN COALESCE(appeal.resolved_at, appeal."createdAt")
            ELSE NULL
          END
      FROM allocated
      WHERE appeal.id = allocated.id
    `)
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "creator_task_appeals" DROP COLUMN "recovery_completed_at"`)
    await queryRunner.query(`ALTER TABLE "creator_task_appeals" DROP COLUMN "recovery_recovered_amount"`)
    await queryRunner.query(`ALTER TABLE "creator_task_appeals" DROP COLUMN "recovery_amount"`)
  }
}
