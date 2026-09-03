import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddCreatorGovernanceFields1788500000000 implements MigrationInterface {
  name = 'AddCreatorGovernanceFields1788500000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TYPE "audit_logs_action_type_enum" ADD VALUE IF NOT EXISTS 'creator_score_updated'`)
    await queryRunner.query(`ALTER TYPE "audit_logs_action_type_enum" ADD VALUE IF NOT EXISTS 'creator_blacklisted'`)
    await queryRunner.query(`ALTER TABLE "sharing_agents" ADD "region" character varying(100)`)
    await queryRunner.query(`ALTER TABLE "sharing_agents" ADD "creator_categories" jsonb NOT NULL DEFAULT '[]'::jsonb`)
    await queryRunner.query(`ALTER TABLE "sharing_agents" ADD "task_preferences" jsonb NOT NULL DEFAULT '{}'::jsonb`)
    await queryRunner.query(`ALTER TABLE "sharing_agents" ADD "creator_growth_score" integer NOT NULL DEFAULT 0`)
    await queryRunner.query(`ALTER TABLE "sharing_agents" ADD "creator_growth_level" smallint NOT NULL DEFAULT 1`)
    await queryRunner.query(`ALTER TABLE "sharing_agents" ADD "creator_score_breakdown" jsonb NOT NULL DEFAULT '{}'::jsonb`)
    await queryRunner.query(`ALTER TABLE "sharing_agents" ADD "creator_score_updated_at" TIMESTAMP WITH TIME ZONE`)
    await queryRunner.query(`ALTER TABLE "sharing_agents" ADD "blacklisted_at" TIMESTAMP WITH TIME ZONE`)
    await queryRunner.query(`ALTER TABLE "sharing_agents" ADD "blacklist_reason" text`)
    await queryRunner.query(`CREATE INDEX "idx_agent_creator_governance" ON "sharing_agents" ("status", "blacklisted_at", "creator_growth_level")`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "idx_agent_creator_governance"`)
    await queryRunner.query(`ALTER TABLE "sharing_agents" DROP COLUMN "blacklist_reason"`)
    await queryRunner.query(`ALTER TABLE "sharing_agents" DROP COLUMN "blacklisted_at"`)
    await queryRunner.query(`ALTER TABLE "sharing_agents" DROP COLUMN "creator_score_updated_at"`)
    await queryRunner.query(`ALTER TABLE "sharing_agents" DROP COLUMN "creator_score_breakdown"`)
    await queryRunner.query(`ALTER TABLE "sharing_agents" DROP COLUMN "creator_growth_level"`)
    await queryRunner.query(`ALTER TABLE "sharing_agents" DROP COLUMN "creator_growth_score"`)
    await queryRunner.query(`ALTER TABLE "sharing_agents" DROP COLUMN "task_preferences"`)
    await queryRunner.query(`ALTER TABLE "sharing_agents" DROP COLUMN "creator_categories"`)
    await queryRunner.query(`ALTER TABLE "sharing_agents" DROP COLUMN "region"`)
    // PostgreSQL enum values cannot be removed safely; the new audit values remain after rollback.
  }
}