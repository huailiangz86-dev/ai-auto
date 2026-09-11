import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddCreatorWechatIdentity1790400000000 implements MigrationInterface {
  name = 'AddCreatorWechatIdentity1790400000000'

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "sharing_agents" ADD COLUMN IF NOT EXISTS "wechat_openid" character varying(128)`)
    await queryRunner.query(`ALTER TABLE "sharing_agents" ADD COLUMN IF NOT EXISTS "wechat_unionid" character varying(128)`)
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "idx_agent_wechat_openid_unique" ON "sharing_agents" ("wechat_openid") WHERE "wechat_openid" IS NOT NULL`)
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_agent_wechat_unionid" ON "sharing_agents" ("wechat_unionid") WHERE "wechat_unionid" IS NOT NULL`)
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_agent_wechat_unionid"`)
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_agent_wechat_openid_unique"`)
    await queryRunner.query(`ALTER TABLE "sharing_agents" DROP COLUMN IF EXISTS "wechat_unionid"`)
    await queryRunner.query(`ALTER TABLE "sharing_agents" DROP COLUMN IF EXISTS "wechat_openid"`)
  }
}
