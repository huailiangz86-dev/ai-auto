import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddSubscriptionPaymentOrders1789900000000 implements MigrationInterface {
  name = 'AddSubscriptionPaymentOrders1789900000000'

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "subscription_payment_orders" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "merchant_id" uuid NOT NULL, "out_trade_no" character varying(32) NOT NULL, "provider" character varying(16) NOT NULL, "plan_months" integer NOT NULL, "amount" numeric(12,2) NOT NULL, "status" character varying(16) NOT NULL DEFAULT 'pending', "provider_transaction_id" character varying(100), "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "paid_at" TIMESTAMP WITH TIME ZONE, "failure_reason" text, CONSTRAINT "PK_subscription_payment_orders" PRIMARY KEY ("id"))`)
    await queryRunner.query(`CREATE UNIQUE INDEX "uq_subscription_payment_order_trade_no" ON "subscription_payment_orders" ("out_trade_no")`)
    await queryRunner.query(`CREATE INDEX "idx_subscription_payment_order_merchant" ON "subscription_payment_orders" ("merchant_id", "createdAt")`)
    await queryRunner.query(`ALTER TABLE "subscription_payment_orders" ADD CONSTRAINT "FK_subscription_payment_order_merchant" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`)
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "subscription_payment_orders" DROP CONSTRAINT "FK_subscription_payment_order_merchant"`)
    await queryRunner.query(`DROP INDEX "public"."idx_subscription_payment_order_merchant"`)
    await queryRunner.query(`DROP INDEX "public"."uq_subscription_payment_order_trade_no"`)
    await queryRunner.query(`DROP TABLE "subscription_payment_orders"`)
  }
}
