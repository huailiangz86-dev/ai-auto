import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddIncrementalityMeasurements1789500000000 implements MigrationInterface {
  name = 'AddIncrementalityMeasurements1789500000000'

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "incrementality_measurements" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "growth_plan_id" uuid NOT NULL, "merchant_id" uuid NOT NULL, "campaign_id" uuid NOT NULL, "method" character varying(32) NOT NULL, "window_start_at" TIMESTAMP WITH TIME ZONE NOT NULL, "window_end_at" TIMESTAMP WITH TIME ZONE NOT NULL, "inputs" jsonb NOT NULL, "assumptions" jsonb NOT NULL DEFAULT '[]'::jsonb, "recorded_at" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_incrementality_measurement" PRIMARY KEY ("id"), CONSTRAINT "UQ_incrementality_measurement_plan" UNIQUE ("growth_plan_id"))`)
    await queryRunner.query(`CREATE INDEX "idx_incrementality_measurement_merchant" ON "incrementality_measurements" ("merchant_id", "createdAt")`)
    await queryRunner.query(`ALTER TABLE "incrementality_measurements" ADD CONSTRAINT "FK_incrementality_measurement_plan" FOREIGN KEY ("growth_plan_id") REFERENCES "growth_plans"("id")`)
    await queryRunner.query(`ALTER TABLE "incrementality_measurements" ADD CONSTRAINT "FK_incrementality_measurement_campaign" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id")`)
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "incrementality_measurements"`)
  }
}