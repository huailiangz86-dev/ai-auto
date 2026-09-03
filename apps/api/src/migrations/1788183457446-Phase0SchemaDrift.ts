import { MigrationInterface, QueryRunner } from 'typeorm'

export class Phase0SchemaDrift1788183457446 implements MigrationInterface {
  name = 'Phase0SchemaDrift1788183457446'

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Fresh databases receive these tables from the expanded initial schema.
    // This migration only repairs databases created before that baseline.
    if (await queryRunner.hasTable('sharing_tasks')) return
    await queryRunner.query(
      `CREATE TABLE "sharing_tasks" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "merchant_id" uuid NOT NULL, "coupon_id" uuid NOT NULL, "target_audience" text NOT NULL, "budget" numeric(12,2) NOT NULL, "deadline" TIMESTAMP WITH TIME ZONE NOT NULL, "max_agents" integer NOT NULL DEFAULT '20', "target_claims" integer NOT NULL DEFAULT '0', "target_redemptions" integer NOT NULL DEFAULT '1', "reward_per_redemption" numeric(12,2) NOT NULL, "status" character varying(20) NOT NULL DEFAULT 'open', CONSTRAINT "PK_4415a4e9cb6ad6b30ee16f59ddd" PRIMARY KEY ("id"))`,
    )
    await queryRunner.query(
      `CREATE INDEX "idx_sharing_task_coupon" ON "sharing_tasks" ("coupon_id") `,
    )
    await queryRunner.query(
      `CREATE INDEX "idx_sharing_task_merchant_status" ON "sharing_tasks" ("merchant_id", "status") `,
    )
    await queryRunner.query(
      `CREATE TABLE "sharing_task_assignments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "task_id" uuid NOT NULL, "agent_id" uuid NOT NULL, "status" character varying(20) NOT NULL DEFAULT 'accepted', "view_count" integer NOT NULL DEFAULT '0', "claim_count" integer NOT NULL DEFAULT '0', "redemption_count" integer NOT NULL DEFAULT '0', "earned_reward" numeric(12,2) NOT NULL DEFAULT '0', "completed_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_33149d68fa1d946fdb9b086ace2" PRIMARY KEY ("id"))`,
    )
    await queryRunner.query(
      `CREATE INDEX "idx_task_assignment_agent_status" ON "sharing_task_assignments" ("agent_id", "status") `,
    )
    await queryRunner.query(
      `CREATE UNIQUE INDEX "idx_task_assignment_task_agent" ON "sharing_task_assignments" ("task_id", "agent_id") `,
    )
    await queryRunner.query(
      `CREATE TABLE "merchant_optimization_settings" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "merchant_id" uuid NOT NULL, "auto_adjust_enabled" boolean NOT NULL DEFAULT false, "max_budget_change_percent" numeric(5,2) NOT NULL DEFAULT '20', CONSTRAINT "PK_a66c36641442f9ab80c664aabfc" PRIMARY KEY ("id"))`,
    )
    await queryRunner.query(
      `CREATE UNIQUE INDEX "idx_optimization_setting_merchant" ON "merchant_optimization_settings" ("merchant_id") `,
    )
    await queryRunner.query(
      `CREATE TABLE "campaign_optimizations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "merchant_id" uuid NOT NULL, "campaign_id" uuid NOT NULL, "status" character varying(20) NOT NULL DEFAULT 'pending', "metrics" jsonb NOT NULL, "recommendations" jsonb NOT NULL, "adjustments" jsonb NOT NULL, "predicted_improvement" numeric(7,2) NOT NULL DEFAULT '0', "auto_applied" boolean NOT NULL DEFAULT false, "applied_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_04e6aead1ef605f96dfc6a72c9f" PRIMARY KEY ("id"))`,
    )
    await queryRunner.query(
      `CREATE INDEX "idx_campaign_optimization_campaign" ON "campaign_optimizations" ("campaign_id", "createdAt") `,
    )
    await queryRunner.query(
      `CREATE INDEX "idx_campaign_optimization_merchant" ON "campaign_optimizations" ("merchant_id", "createdAt") `,
    )
    await queryRunner.query(
      `CREATE TABLE "customer_point_accounts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "customer_id" uuid NOT NULL, "balance" integer NOT NULL DEFAULT '0', "total_earned" integer NOT NULL DEFAULT '0', "total_spent" integer NOT NULL DEFAULT '0', "available_mystery_boxes" integer NOT NULL DEFAULT '0', CONSTRAINT "UQ_9e44a2aaea1ff748144034ec370" UNIQUE ("customer_id"), CONSTRAINT "PK_750c9537faf669fd9854aec0079" PRIMARY KEY ("id"))`,
    )
    await queryRunner.query(
      `CREATE UNIQUE INDEX "idx_point_account_customer" ON "customer_point_accounts" ("customer_id") `,
    )
    await queryRunner.query(
      `CREATE TABLE "customer_point_ledgers" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "customer_id" uuid NOT NULL, "event_id" character varying(150) NOT NULL, "type" character varying(30) NOT NULL, "points" integer NOT NULL, "balance_after" integer NOT NULL, "description" character varying(255) NOT NULL, CONSTRAINT "UQ_e97974f33315619abe7021706c1" UNIQUE ("event_id"), CONSTRAINT "PK_6caaf051b30e538a00103371e0f" PRIMARY KEY ("id"))`,
    )
    await queryRunner.query(
      `CREATE INDEX "idx_point_ledger_customer" ON "customer_point_ledgers" ("customer_id", "createdAt") `,
    )
    await queryRunner.query(
      `CREATE UNIQUE INDEX "idx_point_ledger_event" ON "customer_point_ledgers" ("event_id") `,
    )
    await queryRunner.query(
      `CREATE TABLE "reward_products" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "merchant_id" uuid, "name" character varying(120) NOT NULL, "description" text, "points_cost" integer NOT NULL DEFAULT '0', "stock" integer, "is_active" boolean NOT NULL DEFAULT true, "mystery_box_enabled" boolean NOT NULL DEFAULT false, "guaranteed_reward" boolean NOT NULL DEFAULT false, "image_url" character varying(500), CONSTRAINT "PK_98376d151a106d14f4dfd9725f2" PRIMARY KEY ("id"))`,
    )
    await queryRunner.query(
      `CREATE INDEX "idx_reward_product_active" ON "reward_products" ("is_active") `,
    )
    await queryRunner.query(
      `CREATE TABLE "sharing_challenges" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "merchant_id" uuid, "title" character varying(120) NOT NULL, "description" text NOT NULL, "target_shares" integer NOT NULL, "reward_points" integer NOT NULL DEFAULT '0', "is_active" boolean NOT NULL DEFAULT true, "starts_at" TIMESTAMP WITH TIME ZONE, "ends_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_cc8aa91decac47dc5d2741a69cb" PRIMARY KEY ("id"))`,
    )
    await queryRunner.query(
      `CREATE INDEX "idx_sharing_challenge_active" ON "sharing_challenges" ("is_active") `,
    )
    await queryRunner.query(
      `CREATE TABLE "customer_challenge_progress" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "customer_id" uuid NOT NULL, "challenge_id" uuid NOT NULL, "share_count" integer NOT NULL DEFAULT '0', "completed_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_36c5920df2a327640e5af5fb273" PRIMARY KEY ("id"))`,
    )
    await queryRunner.query(
      `CREATE UNIQUE INDEX "idx_challenge_progress_customer_challenge" ON "customer_challenge_progress" ("customer_id", "challenge_id") `,
    )
    await queryRunner.query(
      `CREATE TABLE "mystery_box_openings" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "customer_id" uuid NOT NULL, "reward_product_id" uuid NOT NULL, "is_guaranteed" boolean NOT NULL DEFAULT false, CONSTRAINT "PK_f15267e02c36032340a7ed99e41" PRIMARY KEY ("id"))`,
    )
    await queryRunner.query(
      `CREATE INDEX "idx_mystery_opening_customer" ON "mystery_box_openings" ("customer_id", "createdAt") `,
    )
    await queryRunner.query(
      `CREATE TYPE "public"."content_publications_platform_enum" AS ENUM('wechat', 'douyin', 'xiaohongshu', 'video_account', 'kuaishou')`,
    )
    await queryRunner.query(
      `CREATE TYPE "public"."content_publications_status_enum" AS ENUM('pending', 'published', 'failed', 'manual')`,
    )
    await queryRunner.query(
      `CREATE TABLE "content_publications" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "content_id" uuid NOT NULL, "agent_id" uuid NOT NULL, "platform" "public"."content_publications_platform_enum" NOT NULL, "status" "public"."content_publications_status_enum" NOT NULL DEFAULT 'pending', "platform_post_id" character varying(255), "platform_post_url" character varying(500), "formatted_content" text, "impressions" bigint NOT NULL DEFAULT '0', "clicks" bigint NOT NULL DEFAULT '0', "comments" integer NOT NULL DEFAULT '0', "shares" integer NOT NULL DEFAULT '0', "likes" integer NOT NULL DEFAULT '0', "error_message" text, "published_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_2b00149ee0982a6c710b05f19ec" PRIMARY KEY ("id"))`,
    )
    await queryRunner.query(`CREATE INDEX "idx_pub_agent" ON "content_publications" ("agent_id") `)
    await queryRunner.query(
      `CREATE INDEX "idx_pub_platform" ON "content_publications" ("platform") `,
    )
    await queryRunner.query(
      `CREATE INDEX "idx_pub_content" ON "content_publications" ("content_id") `,
    )
    await queryRunner.query(
      `CREATE UNIQUE INDEX "idx_mab_code" ON "merchant_agent_bindings" ("invite_code") `,
    )
    await queryRunner.query(
      `ALTER TABLE "merchant_agent_bindings" ADD CONSTRAINT "FK_42493c4134e3dd17f22acd9b637" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    )
    await queryRunner.query(
      `ALTER TABLE "merchant_agent_bindings" ADD CONSTRAINT "FK_ea6f7efc7974c5e3d4e42233196" FOREIGN KEY ("agent_id") REFERENCES "sharing_agents"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "merchant_agent_bindings" DROP CONSTRAINT "FK_ea6f7efc7974c5e3d4e42233196"`,
    )
    await queryRunner.query(
      `ALTER TABLE "merchant_agent_bindings" DROP CONSTRAINT "FK_42493c4134e3dd17f22acd9b637"`,
    )
    await queryRunner.query(`DROP INDEX "public"."idx_mab_code"`)
    await queryRunner.query(`DROP INDEX "public"."idx_pub_content"`)
    await queryRunner.query(`DROP INDEX "public"."idx_pub_platform"`)
    await queryRunner.query(`DROP INDEX "public"."idx_pub_agent"`)
    await queryRunner.query(`DROP TABLE "content_publications"`)
    await queryRunner.query(`DROP TYPE "public"."content_publications_status_enum"`)
    await queryRunner.query(`DROP TYPE "public"."content_publications_platform_enum"`)
    await queryRunner.query(`DROP INDEX "public"."idx_mcl_merchant_active_expiry"`)
    await queryRunner.query(`DROP INDEX "public"."idx_mcl_customer"`)
    await queryRunner.query(`DROP INDEX "public"."uq_mcl_merchant_customer"`)
    await queryRunner.query(`DROP INDEX "public"."idx_mystery_opening_customer"`)
    await queryRunner.query(`DROP TABLE "mystery_box_openings"`)
    await queryRunner.query(`DROP INDEX "public"."idx_challenge_progress_customer_challenge"`)
    await queryRunner.query(`DROP TABLE "customer_challenge_progress"`)
    await queryRunner.query(`DROP INDEX "public"."idx_sharing_challenge_active"`)
    await queryRunner.query(`DROP TABLE "sharing_challenges"`)
    await queryRunner.query(`DROP INDEX "public"."idx_reward_product_active"`)
    await queryRunner.query(`DROP TABLE "reward_products"`)
    await queryRunner.query(`DROP INDEX "public"."idx_point_ledger_event"`)
    await queryRunner.query(`DROP INDEX "public"."idx_point_ledger_customer"`)
    await queryRunner.query(`DROP TABLE "customer_point_ledgers"`)
    await queryRunner.query(`DROP INDEX "public"."idx_point_account_customer"`)
    await queryRunner.query(`DROP TABLE "customer_point_accounts"`)
    await queryRunner.query(`DROP INDEX "public"."idx_campaign_optimization_merchant"`)
    await queryRunner.query(`DROP INDEX "public"."idx_campaign_optimization_campaign"`)
    await queryRunner.query(`DROP TABLE "campaign_optimizations"`)
    await queryRunner.query(`DROP INDEX "public"."idx_optimization_setting_merchant"`)
    await queryRunner.query(`DROP TABLE "merchant_optimization_settings"`)
    await queryRunner.query(`DROP INDEX "public"."idx_task_assignment_task_agent"`)
    await queryRunner.query(`DROP INDEX "public"."idx_task_assignment_agent_status"`)
    await queryRunner.query(`DROP TABLE "sharing_task_assignments"`)
    await queryRunner.query(`DROP INDEX "public"."idx_sharing_task_merchant_status"`)
    await queryRunner.query(`DROP INDEX "public"."idx_sharing_task_coupon"`)
    await queryRunner.query(`DROP TABLE "sharing_tasks"`)
  }
}
