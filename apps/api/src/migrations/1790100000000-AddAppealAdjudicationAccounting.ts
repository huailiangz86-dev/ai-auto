import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Keeps adjudication as a history-preserving event: the original payout is
 * never overwritten and financial/audit rows are database-enforced append only.
 */
export class AddAppealAdjudicationAccounting1790100000000 implements MigrationInterface {
  name = 'AddAppealAdjudicationAccounting1790100000000'

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "audit_logs_action_type_enum" ADD VALUE IF NOT EXISTS 'creator_task_appeal_adjudicated'`,
    )
    await queryRunner.query(
      `ALTER TABLE "creator_task_payouts" ADD COLUMN "adjudicated_amount" numeric(14,2)`,
    )
    await queryRunner.query(
      `ALTER TABLE "creator_task_payouts" ADD COLUMN "adjudicated_at" TIMESTAMP WITH TIME ZONE`,
    )
    await queryRunner.query(
      `ALTER TABLE "creator_task_appeals" ADD COLUMN "adjudication_decision" character varying(24)`,
    )
    await queryRunner.query(
      `ALTER TABLE "creator_task_appeals" ADD COLUMN "amount_before" numeric(14,2)`,
    )
    await queryRunner.query(
      `ALTER TABLE "creator_task_appeals" ADD COLUMN "amount_after" numeric(14,2)`,
    )
    await queryRunner.query(
      `ALTER TABLE "creator_task_appeals" ADD COLUMN "financial_ledger_entry_ids" jsonb NOT NULL DEFAULT '[]'::jsonb`,
    )
    await queryRunner.query(
      `ALTER TABLE "agent_wallets" ADD COLUMN "recovery_receivable_balance" numeric(14,2) NOT NULL DEFAULT 0`,
    )
    await queryRunner.query(
      `ALTER TABLE "agent_wallets" ADD COLUMN "total_recovered" numeric(14,2) NOT NULL DEFAULT 0`,
    )
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION prevent_immutable_financial_history_mutation()
      RETURNS trigger AS $$
      BEGIN
        RAISE EXCEPTION 'immutable financial/audit history cannot be updated or deleted';
      END;
      $$ LANGUAGE plpgsql
    `)
    await queryRunner.query(`
      CREATE TRIGGER financial_ledger_entries_immutable
      BEFORE UPDATE OR DELETE ON "financial_ledger_entries"
      FOR EACH ROW EXECUTE FUNCTION prevent_immutable_financial_history_mutation()
    `)
    await queryRunner.query(`
      CREATE TRIGGER audit_logs_immutable
      BEFORE UPDATE OR DELETE ON "audit_logs"
      FOR EACH ROW EXECUTE FUNCTION prevent_immutable_financial_history_mutation()
    `)
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TRIGGER "audit_logs_immutable" ON "audit_logs"`)
    await queryRunner.query(
      `DROP TRIGGER "financial_ledger_entries_immutable" ON "financial_ledger_entries"`,
    )
    await queryRunner.query(`DROP FUNCTION prevent_immutable_financial_history_mutation()`)
    await queryRunner.query(`ALTER TABLE "agent_wallets" DROP COLUMN "total_recovered"`)
    await queryRunner.query(`ALTER TABLE "agent_wallets" DROP COLUMN "recovery_receivable_balance"`)
    await queryRunner.query(
      `ALTER TABLE "creator_task_appeals" DROP COLUMN "financial_ledger_entry_ids"`,
    )
    await queryRunner.query(`ALTER TABLE "creator_task_appeals" DROP COLUMN "amount_after"`)
    await queryRunner.query(`ALTER TABLE "creator_task_appeals" DROP COLUMN "amount_before"`)
    await queryRunner.query(
      `ALTER TABLE "creator_task_appeals" DROP COLUMN "adjudication_decision"`,
    )
    await queryRunner.query(`ALTER TABLE "creator_task_payouts" DROP COLUMN "adjudicated_at"`)
    await queryRunner.query(`ALTER TABLE "creator_task_payouts" DROP COLUMN "adjudicated_amount"`)
  }
}
