import { MigrationInterface, QueryRunner } from 'typeorm'

export class LinkGrowthPlansToCoupons1790500000000 implements MigrationInterface {
  name = 'LinkGrowthPlansToCoupons1790500000000'

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "growth_plans" ADD COLUMN IF NOT EXISTS "coupon_id" uuid`)
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
        COALESCE(option_data.value->>'title', c."campaign_name") || '优惠券',
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
        0,
        'active'::"coupons_status_enum",
        0,
        0,
        0
      FROM "growth_plans" p
      INNER JOIN "campaigns" c ON c."id" = p."campaign_id" AND c."merchant_id" = p."merchant_id"
      CROSS JOIN LATERAL jsonb_array_elements(p."alternatives") option_data(value)
      WHERE p."status" = 'approved'
        AND p."campaign_id" IS NOT NULL
        AND p."coupon_id" IS NULL
        AND p."selected_option_id" IS NOT NULL
        AND (option_data.value->>'optionId')::integer = p."selected_option_id"
        AND COALESCE(
          option_data.value->>'taskType',
          option_data.value->>'task_type',
          'customer_campaign'
        ) <> 'creator_content'
      ON CONFLICT ("coupon_code") DO NOTHING
    `)
    await queryRunner.query(`
      UPDATE "growth_plans" p
      SET "coupon_id" = c."id"
      FROM "coupons" c
      WHERE p."coupon_id" IS NULL
        AND p."campaign_id" = c."campaign_id"
        AND p."merchant_id" = c."merchant_id"
        AND c."coupon_code" = 'GP-' || UPPER(REPLACE(p."id"::text, '-', '')) || '-' || p."selected_option_id"
    `)
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_growth_plan_campaign" ON "growth_plans" ("campaign_id")`,
    )
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_growth_plan_coupon" ON "growth_plans" ("coupon_id")`,
    )
    await queryRunner.query(
      `DO $$
       BEGIN
         IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_growth_plan_coupon') THEN
           ALTER TABLE "growth_plans"
             ADD CONSTRAINT "FK_growth_plan_coupon"
             FOREIGN KEY ("coupon_id") REFERENCES "coupons"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
         END IF;
       END $$`,
    )
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "growth_plans" DROP CONSTRAINT "FK_growth_plan_coupon"`)
    await queryRunner.query(`DROP INDEX "idx_growth_plan_coupon"`)
    await queryRunner.query(`DROP INDEX "idx_growth_plan_campaign"`)
    await queryRunner.query(`ALTER TABLE "growth_plans" DROP COLUMN "coupon_id"`)
  }
}
