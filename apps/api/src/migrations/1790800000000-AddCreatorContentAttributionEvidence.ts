import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddCreatorContentAttributionEvidence1790800000000 implements MigrationInterface {
  name = 'AddCreatorContentAttributionEvidence1790800000000'

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "customer_attributions" ADD COLUMN IF NOT EXISTS "creator_task_id" uuid`,
    )
    await queryRunner.query(
      `ALTER TABLE "customer_attributions" ADD COLUMN IF NOT EXISTS "tracking_id" character varying(120)`,
    )
    await queryRunner.query(
      `ALTER TABLE "creator_tasks" ADD COLUMN IF NOT EXISTS "submission_evidence" jsonb NOT NULL DEFAULT '{}'::jsonb`,
    )
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_attr_creator_task" ON "customer_attributions" ("creator_task_id")`,
    )
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_attr_tracking_id" ON "customer_attributions" ("tracking_id")`,
    )

    // A creator can have several tasks in one campaign. Historical records do
    // not carry a trustworthy task-level source, so they deliberately remain
    // unassigned instead of being guessed from agent_id.
    await queryRunner.query(`
      UPDATE "creator_tasks"
      SET "tracking_id" = 'ct-' || REPLACE("id"::text, '-', '')
      WHERE "tracking_id" IS NULL
    `)

    // Creator-content campaigns also need a conversion asset. This repairs
    // plans created by the earlier content-only flow without changing the
    // attribution of already issued customer coupons.
    await queryRunner.query(`
      INSERT INTO "coupons" (
        "campaign_id", "merchant_id", "coupon_name", "coupon_code", "coupon_type",
        "threshold_amount", "discount_amount", "cash_reward_amount", "valid_from", "valid_until",
        "total_stock", "remaining_stock", "per_customer_limit", "agent_reward_amount", "status",
        "total_issued", "total_redeemed", "total_commission_paid"
      )
      SELECT
        p."campaign_id",
        p."merchant_id",
        COALESCE(option_data.value->>'title', c."campaign_name") || '转化优惠券',
        'GP-' || UPPER(REPLACE(p."id"::text, '-', '')) || '-' || p."selected_option_id",
        COALESCE(option_data.value->>'campaignType', 'discount')::"coupons_coupon_type_enum",
        COALESCE((option_data.value->'offer'->>'thresholdAmount')::numeric, 0),
        (option_data.value->'offer'->>'discountAmount')::numeric,
        (option_data.value->'offer'->>'cashRewardAmount')::numeric,
        c."start_at",
        COALESCE(c."end_at", c."start_at" + INTERVAL '30 days'),
        NULL,
        NULL,
        1,
        COALESCE((option_data.value->'offer'->>'agentRewardAmount')::numeric, 0),
        'active'::"coupons_status_enum",
        0,
        0,
        0
      FROM "growth_plans" p
      INNER JOIN "growth_tasks" t ON t."id" = p."growth_task_id"
      INNER JOIN "campaigns" c ON c."id" = p."campaign_id" AND c."merchant_id" = p."merchant_id"
      CROSS JOIN LATERAL jsonb_array_elements(p."alternatives") option_data(value)
      WHERE p."status" = 'approved'
        AND t."task_type" = 'creator_content'
        AND p."campaign_id" IS NOT NULL
        AND p."coupon_id" IS NULL
        AND p."selected_option_id" IS NOT NULL
        AND (option_data.value->>'optionId')::integer = p."selected_option_id"
      ON CONFLICT ("coupon_code") DO NOTHING
    `)
    await queryRunner.query(`
      UPDATE "growth_plans" p
      SET "coupon_id" = c."id"
      FROM "coupons" c, "growth_tasks" t
      WHERE p."coupon_id" IS NULL
        AND t."task_type" = 'creator_content'
        AND t."id" = p."growth_task_id"
        AND p."campaign_id" = c."campaign_id"
        AND p."merchant_id" = c."merchant_id"
        AND c."coupon_code" = 'GP-' || UPPER(REPLACE(p."id"::text, '-', '')) || '-' || p."selected_option_id"
    `)
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_attr_tracking_id"`)
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_attr_creator_task"`)
    await queryRunner.query(
      `ALTER TABLE "creator_tasks" DROP COLUMN IF EXISTS "submission_evidence"`,
    )
    await queryRunner.query(
      `ALTER TABLE "customer_attributions" DROP COLUMN IF EXISTS "tracking_id"`,
    )
    await queryRunner.query(
      `ALTER TABLE "customer_attributions" DROP COLUMN IF EXISTS "creator_task_id"`,
    )
  }
}
