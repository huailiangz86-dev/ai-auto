import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddFinancialLedgerEntries1788400000000 implements MigrationInterface {
  name = 'AddFinancialLedgerEntries1788400000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "financial_ledger_entries" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "classification" character varying(20) NOT NULL, "entry_type" character varying(40) NOT NULL, "amount" numeric(14,2) NOT NULL, "currency" character(3) NOT NULL DEFAULT 'CNY', "merchant_id" uuid, "campaign_id" uuid, "creator_id" uuid, "creator_task_id" uuid, "source_reference" character varying(120), "idempotency_key" character varying(160) NOT NULL, "recorded_by_admin_id" uuid, "occurred_at" TIMESTAMP WITH TIME ZONE NOT NULL, "description" character varying(500), "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb, CONSTRAINT "PK_financial_ledger_entries" PRIMARY KEY ("id"))`,
    )
    await queryRunner.query(`CREATE UNIQUE INDEX "idx_fle_idempotency" ON "financial_ledger_entries" ("idempotency_key")`)
    await queryRunner.query(`CREATE INDEX "idx_fle_campaign_occurred" ON "financial_ledger_entries" ("campaign_id", "occurred_at")`)
    await queryRunner.query(`CREATE INDEX "idx_fle_merchant_occurred" ON "financial_ledger_entries" ("merchant_id", "occurred_at")`)
    await queryRunner.query(`CREATE INDEX "idx_fle_classification_occurred" ON "financial_ledger_entries" ("classification", "occurred_at")`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "idx_fle_classification_occurred"`)
    await queryRunner.query(`DROP INDEX "idx_fle_merchant_occurred"`)
    await queryRunner.query(`DROP INDEX "idx_fle_campaign_occurred"`)
    await queryRunner.query(`DROP INDEX "idx_fle_idempotency"`)
    await queryRunner.query(`DROP TABLE "financial_ledger_entries"`)
  }
}