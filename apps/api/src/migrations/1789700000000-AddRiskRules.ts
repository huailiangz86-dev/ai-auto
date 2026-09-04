import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddRiskRules1789700000000 implements MigrationInterface {
  name = 'AddRiskRules1789700000000'

  async up(queryRunner: QueryRunner): Promise<void> {
    for (const action of ['risk_rule_created', 'risk_rule_updated', 'risk_rule_deleted']) {
      await queryRunner.query(
        `ALTER TYPE "audit_logs_action_type_enum" ADD VALUE IF NOT EXISTS '${action}'`,
      )
    }
    await queryRunner.query(
      `CREATE TABLE "risk_rules" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "rule_key" character varying(80) NOT NULL, "name" character varying(120) NOT NULL, "trigger_type" character varying(40) NOT NULL, "severity" character varying(20) NOT NULL DEFAULT 'warning', "condition_config" jsonb NOT NULL DEFAULT '{}'::jsonb, "actions" jsonb NOT NULL DEFAULT '[]'::jsonb, "description" text, "enabled" boolean NOT NULL DEFAULT true, "version" integer NOT NULL DEFAULT 1, "created_by_admin_id" uuid, "updated_by_admin_id" uuid, CONSTRAINT "PK_risk_rules" PRIMARY KEY ("id"))`,
    )
    await queryRunner.query(
      `CREATE UNIQUE INDEX "idx_risk_rule_key_active" ON "risk_rules" ("rule_key") WHERE "deletedAt" IS NULL`,
    )
    await queryRunner.query(`CREATE INDEX "idx_risk_rule_enabled" ON "risk_rules" ("enabled")`)
    await queryRunner.query(`CREATE INDEX "idx_risk_rule_trigger" ON "risk_rules" ("trigger_type")`)
    await queryRunner.query(
      `INSERT INTO "risk_rules" ("rule_key", "name", "trigger_type", "severity", "condition_config", "actions", "description") SELECT 'high_frequency_redemption', '同一分享员高频核销', 'redemption_frequency', 'warning', '{"windowMinutes":15,"threshold":10}'::jsonb, '["create_alert","manual_review"]'::jsonb, '同一分享员在滚动窗口内核销笔数超过阈值时创建告警并进入人工复核。' WHERE NOT EXISTS (SELECT 1 FROM "risk_rules" WHERE "rule_key" = 'high_frequency_redemption')`,
    )
    await queryRunner.query(
      `INSERT INTO "risk_rules" ("rule_key", "name", "trigger_type", "severity", "condition_config", "actions", "description") SELECT 'merchant_redemption_rate', '商户核销率异常', 'redemption_rate', 'notice', '{"windowMinutes":10080,"multiplier":3}'::jsonb, '["create_alert"]'::jsonb, '商户滚动七日核销率超过同类均值倍数时创建关注告警。' WHERE NOT EXISTS (SELECT 1 FROM "risk_rules" WHERE "rule_key" = 'merchant_redemption_rate')`,
    )
    await queryRunner.query(
      `INSERT INTO "risk_rules" ("rule_key", "name", "trigger_type", "severity", "condition_config", "actions", "description") SELECT 'suspicious_self_redemption', '疑似自核销', 'self_redemption', 'critical', '{"threshold":1}'::jsonb, '["freeze_commission","create_alert","manual_review"]'::jsonb, '检测到分享员与消费者存在高风险自核销关系时冻结待结算佣金并进入人工复核。' WHERE NOT EXISTS (SELECT 1 FROM "risk_rules" WHERE "rule_key" = 'suspicious_self_redemption')`,
    )
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "idx_risk_rule_trigger"`)
    await queryRunner.query(`DROP INDEX "idx_risk_rule_enabled"`)
    await queryRunner.query(`DROP INDEX "idx_risk_rule_key_active"`)
    await queryRunner.query(`DROP TABLE "risk_rules"`)
  }
}
