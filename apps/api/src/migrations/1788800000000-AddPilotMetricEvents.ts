import { MigrationInterface, QueryRunner } from 'typeorm'
export class AddPilotMetricEvents1788800000000 implements MigrationInterface {
  name = 'AddPilotMetricEvents1788800000000'
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "pilot_metric_events" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "event_type" character varying(48) NOT NULL, "idempotency_key" character varying(180) NOT NULL, "subject_type" character varying(32) NOT NULL, "subject_id" uuid NOT NULL, "merchant_id" uuid NOT NULL, "campaign_id" uuid, "growth_task_id" uuid, "creator_id" uuid, "creator_task_id" uuid, "occurred_at" TIMESTAMP WITH TIME ZONE NOT NULL, "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb, CONSTRAINT "PK_pilot_metric_events" PRIMARY KEY ("id"))`)
    await queryRunner.query(`CREATE UNIQUE INDEX "idx_pilot_event_idempotency" ON "pilot_metric_events" ("idempotency_key")`)
    await queryRunner.query(`CREATE INDEX "idx_pilot_event_occurred" ON "pilot_metric_events" ("occurred_at")`)
    await queryRunner.query(`CREATE INDEX "idx_pilot_event_campaign_type" ON "pilot_metric_events" ("campaign_id", "event_type", "occurred_at")`)
    await queryRunner.query(`CREATE INDEX "idx_pilot_event_creator_type" ON "pilot_metric_events" ("creator_id", "event_type", "occurred_at")`)
    await queryRunner.query(`CREATE INDEX "idx_pilot_event_task_type" ON "pilot_metric_events" ("creator_task_id", "event_type", "occurred_at")`)
  }
  async down(queryRunner: QueryRunner): Promise<void> { await queryRunner.query(`DROP TABLE "pilot_metric_events"`) }
}