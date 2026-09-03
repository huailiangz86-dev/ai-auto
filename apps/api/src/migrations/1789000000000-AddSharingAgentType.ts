import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddSharingAgentType1789000000000 implements MigrationInterface {
  name = 'AddSharingAgentType1789000000000'

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "sharing_agents" ADD COLUMN IF NOT EXISTS "agent_type" character varying(32) NOT NULL DEFAULT 'ordinary_user'`)
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_agent_type" ON "sharing_agents" ("agent_type")`)
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_agent_type"`)
    await queryRunner.query(`ALTER TABLE "sharing_agents" DROP COLUMN IF EXISTS "agent_type"`)
  }
}
