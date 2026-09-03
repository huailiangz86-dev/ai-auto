import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddCampaignMeasurementProtocols1789600000000 implements MigrationInterface {
  name = 'AddCampaignMeasurementProtocols1789600000000'

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "campaign_measurement_protocols" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "campaign_id" uuid NOT NULL, "merchant_id" uuid NOT NULL, "method" character varying(32) NOT NULL, "experiment_group_definition" text NOT NULL, "control_group_definition" text NOT NULL, "baseline_start_at" TIMESTAMP WITH TIME ZONE NOT NULL, "baseline_end_at" TIMESTAMP WITH TIME ZONE NOT NULL, "observation_start_at" TIMESTAMP WITH TIME ZONE NOT NULL, "observation_end_at" TIMESTAMP WITH TIME ZONE NOT NULL, "orders_definition" text NOT NULL, "gmv_definition" text NOT NULL, "registered_at" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_campaign_measurement_protocol" PRIMARY KEY ("id"), CONSTRAINT "UQ_campaign_measurement_protocol_campaign" UNIQUE ("campaign_id"))`,
    )
    await queryRunner.query(
      `CREATE INDEX "idx_campaign_measurement_protocol_merchant" ON "campaign_measurement_protocols" ("merchant_id", "registered_at")`,
    )
    await queryRunner.query(
      `ALTER TABLE "campaign_measurement_protocols" ADD CONSTRAINT "FK_campaign_measurement_protocol_campaign" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id")`,
    )
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "campaign_measurement_protocols"`)
  }
}
