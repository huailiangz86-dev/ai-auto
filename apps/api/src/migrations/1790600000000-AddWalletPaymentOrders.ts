import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddWalletPaymentOrders1790600000000 implements MigrationInterface {
  name = 'AddWalletPaymentOrders1790600000000'

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "wallet_payment_orders" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "merchant_id" uuid NOT NULL, "out_trade_no" character varying(32) NOT NULL, "provider" character varying(16) NOT NULL, "amount" numeric(12,2) NOT NULL, "status" character varying(16) NOT NULL DEFAULT 'pending', "provider_transaction_id" character varying(100), "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "paid_at" TIMESTAMP WITH TIME ZONE, "failure_reason" text, CONSTRAINT "PK_wallet_payment_orders" PRIMARY KEY ("id"))`,
    )
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "uq_wallet_payment_order_trade_no" ON "wallet_payment_orders" ("out_trade_no")`,
    )
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_wallet_payment_order_merchant" ON "wallet_payment_orders" ("merchant_id", "createdAt")`,
    )
    await queryRunner.query(
      `DO $$
       BEGIN
         IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_wallet_payment_order_merchant') THEN
           ALTER TABLE "wallet_payment_orders"
             ADD CONSTRAINT "FK_wallet_payment_order_merchant"
             FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
         END IF;
       END $$`,
    )
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "wallet_payment_orders" DROP CONSTRAINT "FK_wallet_payment_order_merchant"`,
    )
    await queryRunner.query(`DROP INDEX "idx_wallet_payment_order_merchant"`)
    await queryRunner.query(`DROP INDEX "uq_wallet_payment_order_trade_no"`)
    await queryRunner.query(`DROP TABLE "wallet_payment_orders"`)
  }
}
