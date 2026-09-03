import { MigrationInterface, QueryRunner } from 'typeorm'

export class InitialSchema1787000000000 implements MigrationInterface {
  name = 'InitialSchema1787000000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`)
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
      `CREATE TYPE "subscriptions_status_enum" AS ENUM('active', 'expired', 'cancelled')`,
    )
    await queryRunner.query(
      `CREATE TABLE "subscriptions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "merchant_id" uuid NOT NULL, "store_id" uuid, "plan_name" character varying(100) NOT NULL DEFAULT 'standard', "status" "subscriptions_status_enum" NOT NULL DEFAULT 'active', "start_at" date NOT NULL, "expire_at" date NOT NULL, "amount_paid" numeric(12,2) NOT NULL, "payment_method" character varying(50), "payment_transaction_id" character varying(100), "auto_renew" boolean NOT NULL DEFAULT false, "renewal_reminder_sent" boolean NOT NULL DEFAULT false, CONSTRAINT "PK_a87248d73155605cf782be9ee5e" PRIMARY KEY ("id"))`,
    )
    await queryRunner.query(
      `CREATE INDEX "idx_subscription_expire" ON "subscriptions" ("expire_at") `,
    )
    await queryRunner.query(`CREATE INDEX "idx_subscription_status" ON "subscriptions" ("status") `)
    await queryRunner.query(
      `CREATE INDEX "idx_subscription_merchant" ON "subscriptions" ("merchant_id") `,
    )
    await queryRunner.query(
      `CREATE TYPE "notifications_recipient_role_enum" AS ENUM('merchant_admin', 'merchant_staff', 'agent', 'customer', 'admin', 'super_admin')`,
    )
    await queryRunner.query(
      `CREATE TABLE "notifications" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "recipient_id" uuid NOT NULL, "recipient_role" "notifications_recipient_role_enum" NOT NULL, "type" character varying(40) NOT NULL, "title" character varying(160) NOT NULL, "body" text NOT NULL, "target_type" character varying(40), "target_id" uuid, "metadata" jsonb, "read_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_6a72c3c0f683f6462415e653c3a" PRIMARY KEY ("id"))`,
    )
    await queryRunner.query(
      `CREATE INDEX "idx_notification_recipient_unread" ON "notifications" ("recipient_id", "recipient_role", "read_at") `,
    )
    await queryRunner.query(
      `CREATE INDEX "idx_notification_recipient_created" ON "notifications" ("recipient_id", "recipient_role", "createdAt") `,
    )
    await queryRunner.query(
      `CREATE TABLE "platform_revenues" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "revenue_type" character varying(30) NOT NULL, "amount" numeric(14,2) NOT NULL, "commission_id" uuid, "subscription_id" uuid, "merchant_id" uuid, "agent_id" uuid, "revenue_date" date NOT NULL, "balance_before" numeric(14,2) NOT NULL, "balance_after" numeric(14,2) NOT NULL, "settled" boolean NOT NULL DEFAULT false, "settled_at" TIMESTAMP WITH TIME ZONE, "description" character varying(500), "metadata" jsonb, CONSTRAINT "PK_c082889ff269069e294dec1df02" PRIMARY KEY ("id"))`,
    )
    await queryRunner.query(`CREATE INDEX "idx_pr_agent" ON "platform_revenues" ("agent_id") `)
    await queryRunner.query(
      `CREATE INDEX "idx_pr_merchant" ON "platform_revenues" ("merchant_id") `,
    )
    await queryRunner.query(`CREATE INDEX "idx_pr_date" ON "platform_revenues" ("revenue_date") `)
    await queryRunner.query(`CREATE INDEX "idx_pr_type" ON "platform_revenues" ("revenue_type") `)
    await queryRunner.query(
      `CREATE TABLE "stores" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "merchant_id" uuid NOT NULL, "store_name" character varying(200) NOT NULL, "store_code" character varying(50) NOT NULL, "province" character varying(50), "city" character varying(50), "district" character varying(50), "address_detail" character varying(500), "latitude" numeric(10,7), "longitude" numeric(10,7), "contact_phone" character varying(20), "business_hours" character varying(200), "status" boolean NOT NULL DEFAULT true, CONSTRAINT "UQ_2036aef5ff1670dac3746643f2e" UNIQUE ("store_code"), CONSTRAINT "PK_7aa6e7d71fa7acdd7ca43d7c9cb" PRIMARY KEY ("id"))`,
    )
    await queryRunner.query(`CREATE INDEX "idx_store_status" ON "stores" ("status") `)
    await queryRunner.query(`CREATE INDEX "idx_store_merchant" ON "stores" ("merchant_id") `)
    await queryRunner.query(
      `CREATE TYPE "merchants_audit_status_enum" AS ENUM('pending', 'approved', 'rejected', 'need_info')`,
    )
    await queryRunner.query(
      `CREATE TYPE "merchants_subscription_status_enum" AS ENUM('active', 'expired', 'cancelled')`,
    )
    await queryRunner.query(
      `CREATE TABLE "merchants" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "business_name" character varying(200) NOT NULL, "business_license_no" character varying(50), "phone" character varying(20) NOT NULL, "email" character varying(255), "password_hash" character varying(255) NOT NULL, "business_type" character varying(50) NOT NULL DEFAULT 'individual', "industry_category" character varying(100), "audit_status" "merchants_audit_status_enum" NOT NULL DEFAULT 'pending', "audit_comment" text, "audited_at" TIMESTAMP WITH TIME ZONE, "status" boolean NOT NULL DEFAULT true, "contact_name" character varying(100), "contact_phone" character varying(20), "province" character varying(50), "city" character varying(50), "district" character varying(50), "address_detail" character varying(500), "subscription_status" "merchants_subscription_status_enum" NOT NULL DEFAULT 'expired', "douyin_bind_status" boolean NOT NULL DEFAULT false, "xiaohongshu_bind_status" boolean NOT NULL DEFAULT false, "video_account_bind_status" boolean NOT NULL DEFAULT false, CONSTRAINT "PK_4fd312ef25f8e05ad47bfe7ed25" PRIMARY KEY ("id"))`,
    )
    await queryRunner.query(
      `CREATE INDEX "idx_merchant_audit_status" ON "merchants" ("audit_status") `,
    )
    await queryRunner.query(`CREATE INDEX "idx_merchant_status" ON "merchants" ("status") `)
    await queryRunner.query(`CREATE INDEX "idx_merchant_phone" ON "merchants" ("phone") `)
    await queryRunner.query(
      `CREATE TABLE "merchant_optimization_settings" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "merchant_id" uuid NOT NULL, "auto_adjust_enabled" boolean NOT NULL DEFAULT false, "max_budget_change_percent" numeric(5,2) NOT NULL DEFAULT '20', CONSTRAINT "PK_a66c36641442f9ab80c664aabfc" PRIMARY KEY ("id"))`,
    )
    await queryRunner.query(
      `CREATE UNIQUE INDEX "idx_optimization_setting_merchant" ON "merchant_optimization_settings" ("merchant_id") `,
    )
    await queryRunner.query(
      `CREATE TABLE "merchant_api_keys" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "merchant_id" uuid NOT NULL, "api_key" character varying(100) NOT NULL, "api_secret_hash" character varying(255) NOT NULL, "key_name" character varying(100), "ip_whitelist" text, "rate_limit_per_minute" integer NOT NULL DEFAULT '100', "callback_url" character varying(500), "callback_secret" character varying(255), "status" boolean NOT NULL DEFAULT true, "total_calls" bigint NOT NULL DEFAULT '0', "last_called_at" TIMESTAMP WITH TIME ZONE, "first_used_at" TIMESTAMP WITH TIME ZONE, "previous_api_secret_hash" character varying(255), "previous_secret_expires_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "UQ_feedcd713072c6209626a9d16c6" UNIQUE ("api_key"), CONSTRAINT "PK_e83f71483989cc0ba1decdbbbb7" PRIMARY KEY ("id"))`,
    )
    await queryRunner.query(
      `CREATE INDEX "idx_mak_merchant" ON "merchant_api_keys" ("merchant_id") `,
    )
    await queryRunner.query(
      `CREATE INDEX "idx_mak_secret_hash" ON "merchant_api_keys" ("api_secret_hash") `,
    )
    await queryRunner.query(`CREATE UNIQUE INDEX "idx_mak_key" ON "merchant_api_keys" ("api_key") `)
    await queryRunner.query(
      `CREATE TYPE "merchant_agent_bindings_audit_status_enum" AS ENUM('pending', 'approved', 'rejected', 'need_info')`,
    )
    await queryRunner.query(
      `CREATE TABLE "merchant_agent_bindings" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "merchant_id" uuid NOT NULL, "agent_id" uuid, "store_id" uuid, "invite_code" character varying(20) NOT NULL, "binding_status" character varying(20) NOT NULL DEFAULT 'pending', "audit_status" "merchant_agent_bindings_audit_status_enum" NOT NULL DEFAULT 'pending', "audit_comment" text, "audited_by" uuid, "audited_at" TIMESTAMP WITH TIME ZONE, "invite_type" character varying(20) NOT NULL DEFAULT 'link', "created_by" uuid, "douyin_bind" boolean NOT NULL DEFAULT false, "xiaohongshu_bind" boolean NOT NULL DEFAULT false, "wechat_video_bind" boolean NOT NULL DEFAULT false, "bound_at" TIMESTAMP WITH TIME ZONE, "unbound_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "UQ_898bd7ae022b0fe5f8e6af68193" UNIQUE ("invite_code"), CONSTRAINT "PK_44673fda4d83fe2ecfe37655f87" PRIMARY KEY ("id"))`,
    )
    await queryRunner.query(
      `CREATE INDEX "idx_mab_merchant_agent" ON "merchant_agent_bindings" ("merchant_id", "agent_id") `,
    )
    await queryRunner.query(
      `CREATE UNIQUE INDEX "idx_mab_code" ON "merchant_agent_bindings" ("invite_code") `,
    )
    await queryRunner.query(
      `CREATE INDEX "idx_mab_agent" ON "merchant_agent_bindings" ("agent_id") `,
    )
    await queryRunner.query(
      `CREATE INDEX "idx_mab_merchant" ON "merchant_agent_bindings" ("merchant_id") `,
    )
    await queryRunner.query(
      `CREATE TABLE "commission_budgets" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "merchant_id" uuid NOT NULL, "store_id" uuid, "total_balance" numeric(14,2) NOT NULL DEFAULT '0', "available_balance" numeric(14,2) NOT NULL DEFAULT '0', "frozen_balance" numeric(14,2) NOT NULL DEFAULT '0', "total_spent" numeric(14,2) NOT NULL DEFAULT '0', "total_topup" numeric(14,2) NOT NULL DEFAULT '0', "status" boolean NOT NULL DEFAULT true, "low_balance_threshold" numeric(12,2) NOT NULL DEFAULT '100', CONSTRAINT "PK_05d41f9cc82c43eacd536378a6e" PRIMARY KEY ("id"))`,
    )
    await queryRunner.query(`CREATE INDEX "idx_budget_status" ON "commission_budgets" ("status") `)
    await queryRunner.query(
      `CREATE INDEX "idx_budget_merchant" ON "commission_budgets" ("merchant_id") `,
    )
    await queryRunner.query(
      `CREATE TYPE "budget_transactions_type_enum" AS ENUM('recharge', 'freeze', 'unfreeze', 'deduct', 'withdrawal')`,
    )
    await queryRunner.query(
      `CREATE TABLE "budget_transactions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "budget_id" uuid NOT NULL, "type" "budget_transactions_type_enum" NOT NULL, "amount" numeric(12,2) NOT NULL, "balance_before" numeric(14,2) NOT NULL, "balance_after" numeric(14,2) NOT NULL, "description" character varying(500), "campaign_id" uuid, CONSTRAINT "PK_31ac84aae9de19608a7d00b9bc5" PRIMARY KEY ("id"))`,
    )
    await queryRunner.query(
      `CREATE INDEX "idx_budget_tx_created" ON "budget_transactions" ("createdAt") `,
    )
    await queryRunner.query(`CREATE INDEX "idx_budget_tx_type" ON "budget_transactions" ("type") `)
    await queryRunner.query(
      `CREATE INDEX "idx_budget_tx_budget" ON "budget_transactions" ("budget_id") `,
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
      `CREATE TABLE "customers" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "wechat_openid" character varying(100), "phone" character varying(20), "nickname" character varying(100), "avatar" character varying(500), "gender" character varying(10), "birthday" date, "province" character varying(50), "city" character varying(50), "first_agent_id" uuid, "total_redemptions" integer NOT NULL DEFAULT '0', "total_spend" numeric(14,2) NOT NULL DEFAULT '0', "last_redemption_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "UQ_4b666c1e33c831e65c9143e6c07" UNIQUE ("wechat_openid"), CONSTRAINT "PK_133ec679a801fab5e070f73d3ea" PRIMARY KEY ("id"))`,
    )
    await queryRunner.query(`CREATE INDEX "idx_customer_openid" ON "customers" ("wechat_openid") `)
    await queryRunner.query(`CREATE UNIQUE INDEX "idx_customer_phone" ON "customers" ("phone") `)
    await queryRunner.query(
      `CREATE TABLE "merchant_customer_locks" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "merchant_id" uuid NOT NULL, "customer_id" uuid NOT NULL, "attribution_id" uuid, "agent_id" uuid, "source" character varying(20) NOT NULL, "acquired_at" TIMESTAMP WITH TIME ZONE NOT NULL, "lock_expired_at" TIMESTAMP WITH TIME ZONE NOT NULL, "is_active" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_93f5d291c5dfad9f78589ca423e" PRIMARY KEY ("id"))`,
    )
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_mcl_merchant_customer" ON "merchant_customer_locks" ("merchant_id", "customer_id") `,
    )
    await queryRunner.query(
      `CREATE INDEX "idx_mcl_customer" ON "merchant_customer_locks" ("customer_id") `,
    )
    await queryRunner.query(
      `CREATE INDEX "idx_mcl_merchant_active_expiry" ON "merchant_customer_locks" ("merchant_id", "is_active", "lock_expired_at") `,
    )
    await queryRunner.query(
      `CREATE TABLE "customer_data_export_requests" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "customer_id" uuid NOT NULL, "format" character varying(20) NOT NULL DEFAULT 'json', "status" character varying(20) NOT NULL DEFAULT 'completed', "completed_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_b4f92d0b9dd7c8d3bdeccdf7df0" PRIMARY KEY ("id"))`,
    )
    await queryRunner.query(
      `CREATE INDEX "idx_customer_export_request_customer_created" ON "customer_data_export_requests" ("customer_id", "createdAt") `,
    )
    await queryRunner.query(
      `CREATE TYPE "coupons_coupon_type_enum" AS ENUM('discount', 'cash_reward', 'combo')`,
    )
    await queryRunner.query(
      `CREATE TYPE "coupons_status_enum" AS ENUM('active', 'inactive', 'expired', 'redeemed')`,
    )
    await queryRunner.query(
      `CREATE TABLE "coupons" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "campaign_id" uuid NOT NULL, "merchant_id" uuid NOT NULL, "coupon_name" character varying(200) NOT NULL, "coupon_code" character varying(50) NOT NULL, "coupon_type" "coupons_coupon_type_enum" NOT NULL, "threshold_amount" numeric(12,2), "discount_amount" numeric(12,2), "cash_reward_amount" numeric(12,2), "valid_from" TIMESTAMP WITH TIME ZONE NOT NULL, "valid_until" TIMESTAMP WITH TIME ZONE NOT NULL, "total_stock" integer, "remaining_stock" integer, "per_customer_limit" integer NOT NULL DEFAULT '1', "agent_reward_amount" numeric(12,2) NOT NULL, "status" "coupons_status_enum" NOT NULL DEFAULT 'active', "total_issued" integer NOT NULL DEFAULT '0', "total_redeemed" integer NOT NULL DEFAULT '0', "total_commission_paid" numeric(14,2) NOT NULL DEFAULT '0', CONSTRAINT "UQ_c8818df7c5fc8ef75a2eecee6a6" UNIQUE ("coupon_code"), CONSTRAINT "PK_d7ea8864a0150183770f3e9a8cb" PRIMARY KEY ("id"))`,
    )
    await queryRunner.query(`CREATE UNIQUE INDEX "idx_coupon_code" ON "coupons" ("coupon_code") `)
    await queryRunner.query(`CREATE INDEX "idx_coupon_status" ON "coupons" ("status") `)
    await queryRunner.query(`CREATE INDEX "idx_coupon_merchant" ON "coupons" ("merchant_id") `)
    await queryRunner.query(`CREATE INDEX "idx_coupon_campaign" ON "coupons" ("campaign_id") `)
    await queryRunner.query(
      `CREATE TABLE "customer_attributions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "customer_id" uuid NOT NULL, "agent_id" uuid NOT NULL, "campaign_id" uuid, "source_type" character varying(30) NOT NULL, "source_platform" character varying(30), "click_ip" character varying(45), "click_device_id" character varying(100), "click_user_agent" character varying(500), "lock_started_at" TIMESTAMP WITH TIME ZONE NOT NULL, "lock_expired_at" TIMESTAMP WITH TIME ZONE NOT NULL, "is_active" boolean NOT NULL DEFAULT true, "deactivated_at" TIMESTAMP WITH TIME ZONE, "total_redemptions" integer NOT NULL DEFAULT '0', "total_commission" numeric(14,2) NOT NULL DEFAULT '0', "first_redemption_at" TIMESTAMP WITH TIME ZONE, "days_to_first_redemption" integer, CONSTRAINT "PK_f0b740422984d48b78a87c62ad6" PRIMARY KEY ("id"))`,
    )
    await queryRunner.query(
      `CREATE INDEX "idx_attr_active" ON "customer_attributions" ("customer_id", "lock_expired_at") `,
    )
    await queryRunner.query(
      `CREATE INDEX "idx_attr_expire" ON "customer_attributions" ("lock_expired_at") `,
    )
    await queryRunner.query(
      `CREATE UNIQUE INDEX "idx_attr_customer_agent" ON "customer_attributions" ("customer_id", "agent_id") `,
    )
    await queryRunner.query(
      `CREATE INDEX "idx_attr_agent" ON "customer_attributions" ("agent_id") `,
    )
    await queryRunner.query(
      `CREATE INDEX "idx_attr_customer" ON "customer_attributions" ("customer_id") `,
    )
    await queryRunner.query(
      `CREATE TYPE "sharing_agents_audit_status_enum" AS ENUM('pending', 'approved', 'rejected', 'need_info')`,
    )
    await queryRunner.query(
      `CREATE TYPE "sharing_agents_level_enum" AS ENUM('bronze', 'silver', 'gold', 'diamond', 'king')`,
    )
    await queryRunner.query(
      `CREATE TABLE "sharing_agents" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "phone" character varying(20) NOT NULL, "nickname" character varying(100), "avatar" character varying(255), "passwordHash" character varying(255) NOT NULL, "real_name" character varying(100), "id_card_no" character varying(50), "real_name_verified" boolean NOT NULL DEFAULT false, "audit_status" "sharing_agents_audit_status_enum" NOT NULL DEFAULT 'pending', "audit_comment" text, "level" "sharing_agents_level_enum" NOT NULL DEFAULT 'bronze', "reputation_score" integer NOT NULL DEFAULT '0', "valid_customer_count" integer NOT NULL DEFAULT '0', "commission_multiplier" numeric(4,2) NOT NULL DEFAULT '1', "level_updated_at" TIMESTAMP WITH TIME ZONE, "total_earned" numeric(14,2) NOT NULL DEFAULT '0', "total_withdrawn" numeric(14,2) NOT NULL DEFAULT '0', "status" boolean NOT NULL DEFAULT true, "bank_name" character varying(100), "bank_account_no" character varying(50), "bank_account_name" character varying(100), CONSTRAINT "PK_5884494053660034fec4c9ba44c" PRIMARY KEY ("id"))`,
    )
    await queryRunner.query(
      `CREATE INDEX "idx_agent_valid_customers" ON "sharing_agents" ("valid_customer_count") `,
    )
    await queryRunner.query(`CREATE INDEX "idx_agent_level" ON "sharing_agents" ("level") `)
    await queryRunner.query(`CREATE INDEX "idx_agent_status" ON "sharing_agents" ("status") `)
    await queryRunner.query(`CREATE INDEX "idx_agent_phone" ON "sharing_agents" ("phone") `)
    await queryRunner.query(
      `CREATE TYPE "customer_coupons_status_enum" AS ENUM('active', 'inactive', 'expired', 'redeemed')`,
    )
    await queryRunner.query(
      `CREATE TABLE "customer_coupons" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "customer_id" uuid NOT NULL, "coupon_id" uuid NOT NULL, "coupon_code" character varying(50) NOT NULL, "attribution_id" uuid, "agent_id" uuid, "source" character varying(30) NOT NULL DEFAULT 'lbs', "merchant_id" uuid NOT NULL, "merchant_name" character varying(200) NOT NULL, "coupon_name" character varying(200) NOT NULL, "coupon_type" character varying(30) NOT NULL, "discount_amount" numeric(12,2), "threshold_amount" numeric(12,2), "cash_reward_amount" numeric(12,2), "valid_from" TIMESTAMP WITH TIME ZONE NOT NULL, "valid_until" TIMESTAMP WITH TIME ZONE NOT NULL, "validity_type" character varying(30) NOT NULL DEFAULT 'days_after_claim', "status" "customer_coupons_status_enum" NOT NULL DEFAULT 'active', "claimed_at" TIMESTAMP WITH TIME ZONE NOT NULL, "used_at" TIMESTAMP WITH TIME ZONE, "expired_at" TIMESTAMP WITH TIME ZONE, "redemption_id" uuid, "share_platform" character varying(30), "share_count" integer NOT NULL DEFAULT '0', "last_shared_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "UQ_235ba74c6de32845304d870007d" UNIQUE ("coupon_code"), CONSTRAINT "PK_1df6b53207c9e479ce26fa51579" PRIMARY KEY ("id"))`,
    )
    await queryRunner.query(`CREATE INDEX "idx_cc_expire" ON "customer_coupons" ("valid_until") `)
    await queryRunner.query(`CREATE INDEX "idx_cc_status" ON "customer_coupons" ("status") `)
    await queryRunner.query(
      `CREATE UNIQUE INDEX "idx_cc_code" ON "customer_coupons" ("coupon_code") `,
    )
    await queryRunner.query(
      `CREATE UNIQUE INDEX "idx_cc_customer_coupon" ON "customer_coupons" ("customer_id", "coupon_id") `,
    )
    await queryRunner.query(`CREATE INDEX "idx_cc_coupon" ON "customer_coupons" ("coupon_id") `)
    await queryRunner.query(`CREATE INDEX "idx_cc_customer" ON "customer_coupons" ("customer_id") `)
    await queryRunner.query(
      `CREATE TYPE "campaigns_campaign_type_enum" AS ENUM('discount', 'cash_reward', 'combo')`,
    )
    await queryRunner.query(
      `CREATE TABLE "campaigns" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "merchant_id" uuid NOT NULL, "store_id" uuid, "campaign_name" character varying(200) NOT NULL, "campaign_type" "campaigns_campaign_type_enum" NOT NULL, "campaign_status" character varying(20) NOT NULL DEFAULT 'draft', "start_at" TIMESTAMP WITH TIME ZONE NOT NULL, "end_at" TIMESTAMP WITH TIME ZONE, "target_audience" character varying(50), "max_budget" numeric(14,2), "frozen_budget" numeric(14,2) NOT NULL DEFAULT '0', "spent_budget" numeric(14,2) NOT NULL DEFAULT '0', "ai_config_id" uuid, "ai_generated" boolean NOT NULL DEFAULT false, "ai_description" text, "description" text, "total_impressions" bigint NOT NULL DEFAULT '0', "total_clicks" bigint NOT NULL DEFAULT '0', "total_claims" bigint NOT NULL DEFAULT '0', "total_redemptions" integer NOT NULL DEFAULT '0', "total_commission_spent" numeric(14,2) NOT NULL DEFAULT '0', CONSTRAINT "PK_831e3fcd4fc45b4e4c3f57a9ee4" PRIMARY KEY ("id"))`,
    )
    await queryRunner.query(
      `CREATE INDEX "idx_campaign_start_expire" ON "campaigns" ("start_at", "end_at") `,
    )
    await queryRunner.query(
      `CREATE INDEX "idx_campaign_active" ON "campaigns" ("campaign_status", "start_at", "end_at") `,
    )
    await queryRunner.query(
      `CREATE INDEX "idx_campaign_status" ON "campaigns" ("campaign_status") `,
    )
    await queryRunner.query(`CREATE INDEX "idx_campaign_merchant" ON "campaigns" ("merchant_id") `)
    await queryRunner.query(
      `CREATE TYPE "contents_target_platform_enum" AS ENUM('wechat', 'douyin', 'xiaohongshu', 'video_account', 'kuaishou')`,
    )
    await queryRunner.query(
      `CREATE TYPE "contents_status_enum" AS ENUM('draft', 'generating', 'ready', 'published', 'failed', 'flagged')`,
    )
    await queryRunner.query(
      `CREATE TABLE "contents" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "agent_id" uuid NOT NULL, "campaign_id" uuid, "coupon_id" uuid, "content_type" character varying(30) NOT NULL, "target_platform" "contents_target_platform_enum", "ai_request_id" character varying(100), "ai_model" character varying(50), "content_data" jsonb, "selected_option" integer, "status" "contents_status_enum" NOT NULL DEFAULT 'draft', "moderation_status" character varying(20) NOT NULL DEFAULT 'pending', "moderation_result" jsonb, "moderation_message" text, "ai_token_cost" numeric(10,4) NOT NULL DEFAULT '0', "cost_deducted" boolean NOT NULL DEFAULT false, "tracking_url" character varying(500), "tracking_qr_code" character varying(500), "total_impressions" bigint NOT NULL DEFAULT '0', "total_clicks" bigint NOT NULL DEFAULT '0', "total_claims" integer NOT NULL DEFAULT '0', "input_tokens" integer, "output_tokens" integer, CONSTRAINT "PK_b7c504072e537532d7080c54fac" PRIMARY KEY ("id"))`,
    )
    await queryRunner.query(`CREATE INDEX "idx_content_type" ON "contents" ("content_type") `)
    await queryRunner.query(`CREATE INDEX "idx_content_status" ON "contents" ("status") `)
    await queryRunner.query(`CREATE INDEX "idx_content_campaign" ON "contents" ("campaign_id") `)
    await queryRunner.query(`CREATE INDEX "idx_content_agent" ON "contents" ("agent_id") `)
    await queryRunner.query(
      `CREATE TYPE "content_publications_platform_enum" AS ENUM('wechat', 'douyin', 'xiaohongshu', 'video_account', 'kuaishou')`,
    )
    await queryRunner.query(
      `CREATE TYPE "content_publications_status_enum" AS ENUM('pending', 'published', 'failed', 'manual')`,
    )
    await queryRunner.query(
      `CREATE TABLE "content_publications" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "content_id" uuid NOT NULL, "agent_id" uuid NOT NULL, "platform" "content_publications_platform_enum" NOT NULL, "status" "content_publications_status_enum" NOT NULL DEFAULT 'pending', "platform_post_id" character varying(255), "platform_post_url" character varying(500), "formatted_content" text, "impressions" bigint NOT NULL DEFAULT '0', "clicks" bigint NOT NULL DEFAULT '0', "comments" integer NOT NULL DEFAULT '0', "shares" integer NOT NULL DEFAULT '0', "likes" integer NOT NULL DEFAULT '0', "error_message" text, "published_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_2b00149ee0982a6c710b05f19ec" PRIMARY KEY ("id"))`,
    )
    await queryRunner.query(`CREATE INDEX "idx_pub_agent" ON "content_publications" ("agent_id") `)
    await queryRunner.query(
      `CREATE INDEX "idx_pub_platform" ON "content_publications" ("platform") `,
    )
    await queryRunner.query(
      `CREATE INDEX "idx_pub_content" ON "content_publications" ("content_id") `,
    )
    await queryRunner.query(
      `CREATE TYPE "withdrawals_status_enum" AS ENUM('pending', 'processing', 'success', 'failed')`,
    )
    await queryRunner.query(
      `CREATE TABLE "withdrawals" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "idempotency_key" character varying(100) NOT NULL, "wallet_id" uuid NOT NULL, "agent_id" uuid NOT NULL, "amount" numeric(12,2) NOT NULL, "platform_fee" numeric(12,2) NOT NULL DEFAULT '0', "actual_amount" numeric(12,2) NOT NULL, "method" character varying(30) NOT NULL, "account_no" character varying(100) NOT NULL, "account_name" character varying(100) NOT NULL, "account_identifier" character varying(255), "status" "withdrawals_status_enum" NOT NULL DEFAULT 'pending', "process_started_at" TIMESTAMP WITH TIME ZONE, "process_completed_at" TIMESTAMP WITH TIME ZONE, "process_error" text, "retry_count" integer NOT NULL DEFAULT '0', "payment_transaction_id" character varying(100), "wallet_balance_before" numeric(14,2) NOT NULL, "wallet_balance_after" numeric(14,2) NOT NULL, "reviewed_by" uuid, "reviewed_at" TIMESTAMP WITH TIME ZONE, "reviewed_comment" text, CONSTRAINT "UQ_a9d48ecdfb6334a8cbde6ce8fb6" UNIQUE ("idempotency_key"), CONSTRAINT "PK_9871ec481baa7755f8bd8b7c7e9" PRIMARY KEY ("id"))`,
    )
    await queryRunner.query(
      `CREATE UNIQUE INDEX "idx_withdraw_idem" ON "withdrawals" ("idempotency_key") `,
    )
    await queryRunner.query(`CREATE INDEX "idx_withdraw_status" ON "withdrawals" ("status") `)
    await queryRunner.query(`CREATE INDEX "idx_withdraw_wallet" ON "withdrawals" ("wallet_id") `)
    await queryRunner.query(
      `CREATE TYPE "redemptions_status_enum" AS ENUM('pending', 'verified', 'settled', 'failed')`,
    )
    await queryRunner.query(
      `CREATE TABLE "redemptions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "idempotency_key" character varying(100) NOT NULL, "customer_id" uuid NOT NULL, "coupon_id" uuid NOT NULL, "merchant_id" uuid NOT NULL, "store_id" uuid, "campaign_id" uuid, "attribution_id" uuid, "coupon_type" character varying(30) NOT NULL, "discount_amount" numeric(12,2), "cash_reward_amount" numeric(12,2), "transaction_amount" numeric(12,2) NOT NULL, "discount_value" numeric(12,2) NOT NULL, "agent_reward_amount" numeric(12,2) NOT NULL, "agent_level_at_time" character varying(20), "commission_multiplier_at_time" numeric(4,2), "status" "redemptions_status_enum" NOT NULL DEFAULT 'pending', "coupon_code" character varying(50) NOT NULL, "merchant_transaction_id" character varying(100), "presented_at" TIMESTAMP WITH TIME ZONE, "callback_received_at" TIMESTAMP WITH TIME ZONE, "callback_within_72h" boolean, "callback_verified" boolean, "callback_error" text, "verified_at" TIMESTAMP WITH TIME ZONE, "verified_by" uuid, "commission_id" uuid, "fraud_flagged" boolean NOT NULL DEFAULT false, "fraud_reason" text, CONSTRAINT "UQ_bdc3c1e23f4c013580487ec7486" UNIQUE ("idempotency_key"), CONSTRAINT "PK_def143ab94376fea5985bb04219" PRIMARY KEY ("id"))`,
    )
    await queryRunner.query(`CREATE INDEX "idx_redeem_created" ON "redemptions" ("createdAt") `)
    await queryRunner.query(
      `CREATE UNIQUE INDEX "idx_redeem_idem" ON "redemptions" ("idempotency_key") `,
    )
    await queryRunner.query(`CREATE INDEX "idx_redeem_merchant" ON "redemptions" ("merchant_id") `)
    await queryRunner.query(`CREATE INDEX "idx_redeem_status" ON "redemptions" ("status") `)
    await queryRunner.query(`CREATE INDEX "idx_redeem_coupon" ON "redemptions" ("coupon_id") `)
    await queryRunner.query(`CREATE INDEX "idx_redeem_customer" ON "redemptions" ("customer_id") `)
    await queryRunner.query(
      `CREATE TABLE "commissions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "idempotency_key" character varying(100) NOT NULL, "wallet_id" uuid NOT NULL, "redemption_id" uuid NOT NULL, "merchant_reward" numeric(12,2) NOT NULL, "platform_fee" numeric(12,2) NOT NULL, "agent_base_payout" numeric(12,2) NOT NULL, "agent_final_payout" numeric(12,2) NOT NULL, "level_multiplier" numeric(4,2) NOT NULL, "agent_id" uuid NOT NULL, "customer_id" uuid NOT NULL, "campaign_id" uuid, "attribution_id" uuid, "merchant_id" uuid NOT NULL, "status" character varying(20) NOT NULL DEFAULT 'pending', "settle_batch" character varying(50), "settled_at" TIMESTAMP WITH TIME ZONE, "settle_at" date NOT NULL, "wallet_balance_before" numeric(14,2) NOT NULL, "wallet_balance_after" numeric(14,2) NOT NULL, CONSTRAINT "UQ_ad9e65c900069dc659b3e8d172d" UNIQUE ("idempotency_key"), CONSTRAINT "PK_2701379966e2e670bb5ff0ae78e" PRIMARY KEY ("id"))`,
    )
    await queryRunner.query(`CREATE INDEX "idx_comm_created" ON "commissions" ("createdAt") `)
    await queryRunner.query(
      `CREATE UNIQUE INDEX "idx_comm_idem" ON "commissions" ("idempotency_key") `,
    )
    await queryRunner.query(
      `CREATE INDEX "idx_comm_settle_batch" ON "commissions" ("settle_batch") `,
    )
    await queryRunner.query(`CREATE INDEX "idx_comm_status" ON "commissions" ("status") `)
    await queryRunner.query(`CREATE INDEX "idx_comm_wallet" ON "commissions" ("wallet_id") `)
    await queryRunner.query(
      `CREATE TABLE "coupon_product_mappings" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "coupon_id" uuid NOT NULL, "merchant_id" uuid NOT NULL, "external_product_id" character varying(100) NOT NULL, "external_product_name" character varying(200), "external_category" character varying(100), "status" boolean NOT NULL DEFAULT true, "callback_url" character varying(500), "callback_secret" character varying(255), CONSTRAINT "PK_d1ee21d47e794d859771224a0b8" PRIMARY KEY ("id"))`,
    )
    await queryRunner.query(
      `CREATE UNIQUE INDEX "idx_mapping_merchant_product" ON "coupon_product_mappings" ("merchant_id", "external_product_id") `,
    )
    await queryRunner.query(
      `CREATE INDEX "idx_mapping_external" ON "coupon_product_mappings" ("external_product_id") `,
    )
    await queryRunner.query(
      `CREATE INDEX "idx_mapping_merchant" ON "coupon_product_mappings" ("merchant_id") `,
    )
    await queryRunner.query(
      `CREATE INDEX "idx_mapping_coupon" ON "coupon_product_mappings" ("coupon_id") `,
    )
    await queryRunner.query(
      `CREATE TABLE "agent_wallets" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "agent_id" uuid NOT NULL, "pending_settlement_balance" numeric(14,2) NOT NULL DEFAULT '0', "settled_balance" numeric(14,2) NOT NULL DEFAULT '0', "frozen_balance" numeric(14,2) NOT NULL DEFAULT '0', "total_earned" numeric(14,2) NOT NULL DEFAULT '0', "total_platform_fee" numeric(14,2) NOT NULL DEFAULT '0', "total_settled" numeric(14,2) NOT NULL DEFAULT '0', "total_withdrawn" numeric(14,2) NOT NULL DEFAULT '0', "last_settlement_at" TIMESTAMP WITH TIME ZONE, "status" boolean NOT NULL DEFAULT true, "ai_token_balance" numeric(12,4) NOT NULL DEFAULT '0', CONSTRAINT "UQ_32fcd9fab937358ba834f5d7310" UNIQUE ("agent_id"), CONSTRAINT "PK_a39561da06e06e413f2a4d20639" PRIMARY KEY ("id"))`,
    )
    await queryRunner.query(`CREATE INDEX "idx_wallet_status" ON "agent_wallets" ("status") `)
    await queryRunner.query(`CREATE INDEX "idx_wallet_agent" ON "agent_wallets" ("agent_id") `)
    await queryRunner.query(
      `CREATE TYPE "agent_platform_accounts_platform_type_enum" AS ENUM('wechat', 'douyin', 'xiaohongshu', 'video_account', 'kuaishou')`,
    )
    await queryRunner.query(
      `CREATE TABLE "agent_platform_accounts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "agent_id" uuid NOT NULL, "platform_type" "agent_platform_accounts_platform_type_enum" NOT NULL, "platform_user_id" character varying(255) NOT NULL, "platform_nickname" character varying(200), "platform_avatar" character varying(500), "account_no" character varying(50), "access_token" text, "refresh_token" text, "token_expire_at" TIMESTAMP WITH TIME ZONE, "is_enterprise_account" boolean NOT NULL DEFAULT false, "status" boolean NOT NULL DEFAULT true, "deactivated_at" TIMESTAMP WITH TIME ZONE, "bound_at" TIMESTAMP WITH TIME ZONE NOT NULL, "unbind_at" TIMESTAMP WITH TIME ZONE, "total_impressions" bigint NOT NULL DEFAULT '0', "total_clicks" bigint NOT NULL DEFAULT '0', "total_claims" bigint NOT NULL DEFAULT '0', CONSTRAINT "PK_0dc5351de6fcd7b3d8440206ed5" PRIMARY KEY ("id"))`,
    )
    await queryRunner.query(`CREATE INDEX "idx_ap_status" ON "agent_platform_accounts" ("status") `)
    await queryRunner.query(
      `CREATE INDEX "idx_ap_agent" ON "agent_platform_accounts" ("agent_id") `,
    )
    await queryRunner.query(
      `CREATE INDEX "idx_ap_account_platform_uid" ON "agent_platform_accounts" ("platform_type", "platform_user_id") `,
    )
    await queryRunner.query(
      `CREATE TABLE "fraud_alerts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "alert_type" character varying(50) NOT NULL, "severity" character varying(20) NOT NULL DEFAULT 'warning', "confidence_score" numeric(4,3) NOT NULL, "status" character varying(20) NOT NULL DEFAULT 'pending', "agent_id" uuid, "merchant_id" uuid, "redemption_id" uuid, "evidence" jsonb NOT NULL, "ai_model_output" jsonb, "ai_model_name" character varying(50), "auto_action_taken" character varying(100), "reviewed_by" uuid, "reviewed_at" TIMESTAMP WITH TIME ZONE, "review_notes" text, "final_action" character varying(50), "merchant_notified" boolean NOT NULL DEFAULT false, "agent_notified" boolean NOT NULL DEFAULT false, "notified_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_d1e5b58078239461d43d906f08e" PRIMARY KEY ("id"))`,
    )
    await queryRunner.query(`CREATE INDEX "idx_fraud_created" ON "fraud_alerts" ("createdAt") `)
    await queryRunner.query(`CREATE INDEX "idx_fraud_severity" ON "fraud_alerts" ("severity") `)
    await queryRunner.query(`CREATE INDEX "idx_fraud_status" ON "fraud_alerts" ("status") `)
    await queryRunner.query(
      `CREATE TYPE "audit_logs_action_type_enum" AS ENUM('merchant_approved', 'merchant_rejected', 'agent_approved', 'agent_rejected', 'agent_banned', 'activity_flagged', 'content_flagged', 'fraud_detected', 'content_moderated', 'fraud_resolved')`,
    )
    await queryRunner.query(
      `CREATE TABLE "audit_logs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "actor_type" character varying(30) NOT NULL, "actor_id" uuid, "actor_name" character varying(100), "actor_ip" character varying(45), "action_type" "audit_logs_action_type_enum" NOT NULL, "action_description" character varying(500) NOT NULL, "target_type" character varying(30) NOT NULL, "target_id" uuid, "target_name" character varying(200), "before_state" jsonb, "after_state" jsonb, "metadata" jsonb, "result" character varying(20) NOT NULL DEFAULT 'success', "failure_reason" text, CONSTRAINT "PK_1bb179d048bbc581caa3b013439" PRIMARY KEY ("id"))`,
    )
    await queryRunner.query(`CREATE INDEX "idx_audit_created" ON "audit_logs" ("createdAt") `)
    await queryRunner.query(
      `CREATE INDEX "idx_audit_target" ON "audit_logs" ("target_type", "target_id") `,
    )
    await queryRunner.query(
      `CREATE INDEX "idx_audit_actor" ON "audit_logs" ("actor_type", "actor_id") `,
    )
    await queryRunner.query(`CREATE INDEX "idx_audit_action_type" ON "audit_logs" ("action_type") `)
    await queryRunner.query(
      `CREATE TABLE "admins" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "username" character varying(50) NOT NULL, "passwordHash" character varying(255) NOT NULL, "realName" character varying(100) NOT NULL, "email" character varying(100), "phone" character varying(20), "role" character varying(30) NOT NULL, "permissions" integer NOT NULL DEFAULT '0', "mfa_enabled" boolean NOT NULL DEFAULT false, "mfa_secret" character varying(255), "status" boolean NOT NULL DEFAULT true, "last_login_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_e3b38270c97a854c48d2e80874e" PRIMARY KEY ("id"))`,
    )
    await queryRunner.query(`CREATE INDEX "idx_admin_role" ON "admins" ("role") `)
    await queryRunner.query(`CREATE UNIQUE INDEX "idx_admin_username" ON "admins" ("username") `)
    await queryRunner.query(
      `ALTER TABLE "subscriptions" ADD CONSTRAINT "FK_f3ae75c47587162f3a387cb2bfe" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    )
    await queryRunner.query(
      `ALTER TABLE "stores" ADD CONSTRAINT "FK_882687fd3a8a29fa5bf13858a5b" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    )
    await queryRunner.query(
      `ALTER TABLE "merchant_api_keys" ADD CONSTRAINT "FK_91449376218f51df6d7d6c2d4eb" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    )
    await queryRunner.query(
      `ALTER TABLE "merchant_agent_bindings" ADD CONSTRAINT "FK_42493c4134e3dd17f22acd9b637" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    )
    await queryRunner.query(
      `ALTER TABLE "merchant_agent_bindings" ADD CONSTRAINT "FK_ea6f7efc7974c5e3d4e42233196" FOREIGN KEY ("agent_id") REFERENCES "sharing_agents"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    )
    await queryRunner.query(
      `ALTER TABLE "commission_budgets" ADD CONSTRAINT "FK_7c5857d9bb823ba3c3f5253e168" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    )
    await queryRunner.query(
      `ALTER TABLE "budget_transactions" ADD CONSTRAINT "FK_1efbffe7759c49b3955b6fa12d8" FOREIGN KEY ("budget_id") REFERENCES "commission_budgets"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    )
    await queryRunner.query(
      `ALTER TABLE "merchant_customer_locks" ADD CONSTRAINT "FK_ccefd20cc50c904413848ccdfa9" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    )
    await queryRunner.query(
      `ALTER TABLE "coupons" ADD CONSTRAINT "FK_7f82a6e658dde20514631ca745f" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    )
    await queryRunner.query(
      `ALTER TABLE "coupons" ADD CONSTRAINT "FK_3084d0ab3a20e04c82ec4fde54b" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    )
    await queryRunner.query(
      `ALTER TABLE "customer_attributions" ADD CONSTRAINT "FK_fba7fb279d7fa6d38cbfd0339be" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    )
    await queryRunner.query(
      `ALTER TABLE "customer_attributions" ADD CONSTRAINT "FK_2e9bda556635e3c4450dc7eeae0" FOREIGN KEY ("agent_id") REFERENCES "sharing_agents"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    )
    await queryRunner.query(
      `ALTER TABLE "customer_attributions" ADD CONSTRAINT "FK_c1dce253c35b3aa6f570072d270" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    )
    await queryRunner.query(
      `ALTER TABLE "customer_coupons" ADD CONSTRAINT "FK_81bdc07e96b94286e69a3da0a3a" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    )
    await queryRunner.query(
      `ALTER TABLE "customer_coupons" ADD CONSTRAINT "FK_9168bade515f39ee2d1e8bbcb17" FOREIGN KEY ("coupon_id") REFERENCES "coupons"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    )
    await queryRunner.query(
      `ALTER TABLE "customer_coupons" ADD CONSTRAINT "FK_f672127abb1545924b3036eeb10" FOREIGN KEY ("attribution_id") REFERENCES "customer_attributions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    )
    await queryRunner.query(
      `ALTER TABLE "customer_coupons" ADD CONSTRAINT "FK_a31af353ee9e2b4b6108cfd73f4" FOREIGN KEY ("agent_id") REFERENCES "sharing_agents"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    )
    await queryRunner.query(
      `ALTER TABLE "campaigns" ADD CONSTRAINT "FK_dbff8380c4dc6bf1b5cd5d93c96" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    )
    await queryRunner.query(
      `ALTER TABLE "campaigns" ADD CONSTRAINT "FK_812788b5c9dc82fa4e9b0bad399" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    )
    await queryRunner.query(
      `ALTER TABLE "contents" ADD CONSTRAINT "FK_af36b6668da153cd8a100b04e00" FOREIGN KEY ("agent_id") REFERENCES "sharing_agents"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    )
    await queryRunner.query(
      `ALTER TABLE "contents" ADD CONSTRAINT "FK_3d13bb55cb7c933406f08bb32cf" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    )
    await queryRunner.query(
      `ALTER TABLE "withdrawals" ADD CONSTRAINT "FK_100cd2fde8ba74f923429eec374" FOREIGN KEY ("wallet_id") REFERENCES "agent_wallets"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    )
    await queryRunner.query(
      `ALTER TABLE "redemptions" ADD CONSTRAINT "FK_452c521e650ce0ef7e7a628ae2a" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    )
    await queryRunner.query(
      `ALTER TABLE "redemptions" ADD CONSTRAINT "FK_113ec72a295bab45524216f9052" FOREIGN KEY ("coupon_id") REFERENCES "coupons"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    )
    await queryRunner.query(
      `ALTER TABLE "redemptions" ADD CONSTRAINT "FK_49de51193e2922007aeebcb280b" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    )
    await queryRunner.query(
      `ALTER TABLE "redemptions" ADD CONSTRAINT "FK_dbae6fc8fb5db291306868f82f4" FOREIGN KEY ("attribution_id") REFERENCES "customer_attributions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    )
    await queryRunner.query(
      `ALTER TABLE "commissions" ADD CONSTRAINT "FK_48c97a7a647823c03f196c46081" FOREIGN KEY ("wallet_id") REFERENCES "agent_wallets"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    )
    await queryRunner.query(
      `ALTER TABLE "commissions" ADD CONSTRAINT "FK_afe1b48f3243a04c4bc82818139" FOREIGN KEY ("redemption_id") REFERENCES "redemptions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    )
    await queryRunner.query(
      `ALTER TABLE "coupon_product_mappings" ADD CONSTRAINT "FK_859710f0db5052385043dad6689" FOREIGN KEY ("coupon_id") REFERENCES "coupons"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    )
    await queryRunner.query(
      `ALTER TABLE "coupon_product_mappings" ADD CONSTRAINT "FK_2e2dcea540444fd8bf88e6f6bc4" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    )
    await queryRunner.query(
      `ALTER TABLE "agent_wallets" ADD CONSTRAINT "FK_32fcd9fab937358ba834f5d7310" FOREIGN KEY ("agent_id") REFERENCES "sharing_agents"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    )
    await queryRunner.query(
      `ALTER TABLE "agent_platform_accounts" ADD CONSTRAINT "FK_19abeacc84e3f52ada24486002d" FOREIGN KEY ("agent_id") REFERENCES "sharing_agents"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    )
    await queryRunner.query(
      `ALTER TABLE "fraud_alerts" ADD CONSTRAINT "FK_d17d146d06c1a12ba1e4bf6e654" FOREIGN KEY ("agent_id") REFERENCES "sharing_agents"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    )
    await queryRunner.query(
      `ALTER TABLE "fraud_alerts" ADD CONSTRAINT "FK_b214b2dc3707d4f8464d54ca8f0" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    )
    await queryRunner.query(
      `ALTER TABLE "fraud_alerts" ADD CONSTRAINT "FK_2b086530ee201bb06375c5efa9a" FOREIGN KEY ("redemption_id") REFERENCES "redemptions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "fraud_alerts" DROP CONSTRAINT "FK_2b086530ee201bb06375c5efa9a"`,
    )
    await queryRunner.query(
      `ALTER TABLE "fraud_alerts" DROP CONSTRAINT "FK_b214b2dc3707d4f8464d54ca8f0"`,
    )
    await queryRunner.query(
      `ALTER TABLE "fraud_alerts" DROP CONSTRAINT "FK_d17d146d06c1a12ba1e4bf6e654"`,
    )
    await queryRunner.query(
      `ALTER TABLE "agent_platform_accounts" DROP CONSTRAINT "FK_19abeacc84e3f52ada24486002d"`,
    )
    await queryRunner.query(
      `ALTER TABLE "agent_wallets" DROP CONSTRAINT "FK_32fcd9fab937358ba834f5d7310"`,
    )
    await queryRunner.query(
      `ALTER TABLE "coupon_product_mappings" DROP CONSTRAINT "FK_2e2dcea540444fd8bf88e6f6bc4"`,
    )
    await queryRunner.query(
      `ALTER TABLE "coupon_product_mappings" DROP CONSTRAINT "FK_859710f0db5052385043dad6689"`,
    )
    await queryRunner.query(
      `ALTER TABLE "commissions" DROP CONSTRAINT "FK_afe1b48f3243a04c4bc82818139"`,
    )
    await queryRunner.query(
      `ALTER TABLE "commissions" DROP CONSTRAINT "FK_48c97a7a647823c03f196c46081"`,
    )
    await queryRunner.query(
      `ALTER TABLE "redemptions" DROP CONSTRAINT "FK_dbae6fc8fb5db291306868f82f4"`,
    )
    await queryRunner.query(
      `ALTER TABLE "redemptions" DROP CONSTRAINT "FK_49de51193e2922007aeebcb280b"`,
    )
    await queryRunner.query(
      `ALTER TABLE "redemptions" DROP CONSTRAINT "FK_113ec72a295bab45524216f9052"`,
    )
    await queryRunner.query(
      `ALTER TABLE "redemptions" DROP CONSTRAINT "FK_452c521e650ce0ef7e7a628ae2a"`,
    )
    await queryRunner.query(
      `ALTER TABLE "withdrawals" DROP CONSTRAINT "FK_100cd2fde8ba74f923429eec374"`,
    )
    await queryRunner.query(
      `ALTER TABLE "contents" DROP CONSTRAINT "FK_3d13bb55cb7c933406f08bb32cf"`,
    )
    await queryRunner.query(
      `ALTER TABLE "contents" DROP CONSTRAINT "FK_af36b6668da153cd8a100b04e00"`,
    )
    await queryRunner.query(
      `ALTER TABLE "campaigns" DROP CONSTRAINT "FK_812788b5c9dc82fa4e9b0bad399"`,
    )
    await queryRunner.query(
      `ALTER TABLE "campaigns" DROP CONSTRAINT "FK_dbff8380c4dc6bf1b5cd5d93c96"`,
    )
    await queryRunner.query(
      `ALTER TABLE "customer_coupons" DROP CONSTRAINT "FK_a31af353ee9e2b4b6108cfd73f4"`,
    )
    await queryRunner.query(
      `ALTER TABLE "customer_coupons" DROP CONSTRAINT "FK_f672127abb1545924b3036eeb10"`,
    )
    await queryRunner.query(
      `ALTER TABLE "customer_coupons" DROP CONSTRAINT "FK_9168bade515f39ee2d1e8bbcb17"`,
    )
    await queryRunner.query(
      `ALTER TABLE "customer_coupons" DROP CONSTRAINT "FK_81bdc07e96b94286e69a3da0a3a"`,
    )
    await queryRunner.query(
      `ALTER TABLE "customer_attributions" DROP CONSTRAINT "FK_c1dce253c35b3aa6f570072d270"`,
    )
    await queryRunner.query(
      `ALTER TABLE "customer_attributions" DROP CONSTRAINT "FK_2e9bda556635e3c4450dc7eeae0"`,
    )
    await queryRunner.query(
      `ALTER TABLE "customer_attributions" DROP CONSTRAINT "FK_fba7fb279d7fa6d38cbfd0339be"`,
    )
    await queryRunner.query(
      `ALTER TABLE "coupons" DROP CONSTRAINT "FK_3084d0ab3a20e04c82ec4fde54b"`,
    )
    await queryRunner.query(
      `ALTER TABLE "coupons" DROP CONSTRAINT "FK_7f82a6e658dde20514631ca745f"`,
    )
    await queryRunner.query(
      `ALTER TABLE "merchant_customer_locks" DROP CONSTRAINT "FK_ccefd20cc50c904413848ccdfa9"`,
    )
    await queryRunner.query(
      `ALTER TABLE "budget_transactions" DROP CONSTRAINT "FK_1efbffe7759c49b3955b6fa12d8"`,
    )
    await queryRunner.query(
      `ALTER TABLE "commission_budgets" DROP CONSTRAINT "FK_7c5857d9bb823ba3c3f5253e168"`,
    )
    await queryRunner.query(
      `ALTER TABLE "merchant_agent_bindings" DROP CONSTRAINT "FK_ea6f7efc7974c5e3d4e42233196"`,
    )
    await queryRunner.query(
      `ALTER TABLE "merchant_agent_bindings" DROP CONSTRAINT "FK_42493c4134e3dd17f22acd9b637"`,
    )
    await queryRunner.query(
      `ALTER TABLE "merchant_api_keys" DROP CONSTRAINT "FK_91449376218f51df6d7d6c2d4eb"`,
    )
    await queryRunner.query(`ALTER TABLE "stores" DROP CONSTRAINT "FK_882687fd3a8a29fa5bf13858a5b"`)
    await queryRunner.query(
      `ALTER TABLE "subscriptions" DROP CONSTRAINT "FK_f3ae75c47587162f3a387cb2bfe"`,
    )
    await queryRunner.query(`DROP INDEX "idx_admin_username"`)
    await queryRunner.query(`DROP INDEX "idx_admin_role"`)
    await queryRunner.query(`DROP TABLE "admins"`)
    await queryRunner.query(`DROP INDEX "idx_audit_action_type"`)
    await queryRunner.query(`DROP INDEX "idx_audit_actor"`)
    await queryRunner.query(`DROP INDEX "idx_audit_target"`)
    await queryRunner.query(`DROP INDEX "idx_audit_created"`)
    await queryRunner.query(`DROP TABLE "audit_logs"`)
    await queryRunner.query(`DROP TYPE "audit_logs_action_type_enum"`)
    await queryRunner.query(`DROP INDEX "idx_fraud_status"`)
    await queryRunner.query(`DROP INDEX "idx_fraud_severity"`)
    await queryRunner.query(`DROP INDEX "idx_fraud_created"`)
    await queryRunner.query(`DROP TABLE "fraud_alerts"`)
    await queryRunner.query(`DROP INDEX "idx_ap_account_platform_uid"`)
    await queryRunner.query(`DROP INDEX "idx_ap_agent"`)
    await queryRunner.query(`DROP INDEX "idx_ap_status"`)
    await queryRunner.query(`DROP TABLE "agent_platform_accounts"`)
    await queryRunner.query(`DROP TYPE "agent_platform_accounts_platform_type_enum"`)
    await queryRunner.query(`DROP INDEX "idx_wallet_agent"`)
    await queryRunner.query(`DROP INDEX "idx_wallet_status"`)
    await queryRunner.query(`DROP TABLE "agent_wallets"`)
    await queryRunner.query(`DROP INDEX "idx_mapping_coupon"`)
    await queryRunner.query(`DROP INDEX "idx_mapping_merchant"`)
    await queryRunner.query(`DROP INDEX "idx_mapping_external"`)
    await queryRunner.query(`DROP INDEX "idx_mapping_merchant_product"`)
    await queryRunner.query(`DROP TABLE "coupon_product_mappings"`)
    await queryRunner.query(`DROP INDEX "idx_comm_wallet"`)
    await queryRunner.query(`DROP INDEX "idx_comm_status"`)
    await queryRunner.query(`DROP INDEX "idx_comm_settle_batch"`)
    await queryRunner.query(`DROP INDEX "idx_comm_idem"`)
    await queryRunner.query(`DROP INDEX "idx_comm_created"`)
    await queryRunner.query(`DROP TABLE "commissions"`)
    await queryRunner.query(`DROP INDEX "idx_redeem_customer"`)
    await queryRunner.query(`DROP INDEX "idx_redeem_coupon"`)
    await queryRunner.query(`DROP INDEX "idx_redeem_status"`)
    await queryRunner.query(`DROP INDEX "idx_redeem_merchant"`)
    await queryRunner.query(`DROP INDEX "idx_redeem_idem"`)
    await queryRunner.query(`DROP INDEX "idx_redeem_created"`)
    await queryRunner.query(`DROP TABLE "redemptions"`)
    await queryRunner.query(`DROP TYPE "redemptions_status_enum"`)
    await queryRunner.query(`DROP INDEX "idx_withdraw_wallet"`)
    await queryRunner.query(`DROP INDEX "idx_withdraw_status"`)
    await queryRunner.query(`DROP INDEX "idx_withdraw_idem"`)
    await queryRunner.query(`DROP TABLE "withdrawals"`)
    await queryRunner.query(`DROP TYPE "withdrawals_status_enum"`)
    await queryRunner.query(`DROP INDEX "idx_pub_content"`)
    await queryRunner.query(`DROP INDEX "idx_pub_platform"`)
    await queryRunner.query(`DROP INDEX "idx_pub_agent"`)
    await queryRunner.query(`DROP TABLE "content_publications"`)
    await queryRunner.query(`DROP TYPE "content_publications_status_enum"`)
    await queryRunner.query(`DROP TYPE "content_publications_platform_enum"`)
    await queryRunner.query(`DROP INDEX "idx_content_agent"`)
    await queryRunner.query(`DROP INDEX "idx_content_campaign"`)
    await queryRunner.query(`DROP INDEX "idx_content_status"`)
    await queryRunner.query(`DROP INDEX "idx_content_type"`)
    await queryRunner.query(`DROP TABLE "contents"`)
    await queryRunner.query(`DROP TYPE "contents_status_enum"`)
    await queryRunner.query(`DROP TYPE "contents_target_platform_enum"`)
    await queryRunner.query(`DROP INDEX "idx_campaign_merchant"`)
    await queryRunner.query(`DROP INDEX "idx_campaign_status"`)
    await queryRunner.query(`DROP INDEX "idx_campaign_active"`)
    await queryRunner.query(`DROP INDEX "idx_campaign_start_expire"`)
    await queryRunner.query(`DROP TABLE "campaigns"`)
    await queryRunner.query(`DROP TYPE "campaigns_campaign_type_enum"`)
    await queryRunner.query(`DROP INDEX "idx_cc_customer"`)
    await queryRunner.query(`DROP INDEX "idx_cc_coupon"`)
    await queryRunner.query(`DROP INDEX "idx_cc_customer_coupon"`)
    await queryRunner.query(`DROP INDEX "idx_cc_code"`)
    await queryRunner.query(`DROP INDEX "idx_cc_status"`)
    await queryRunner.query(`DROP INDEX "idx_cc_expire"`)
    await queryRunner.query(`DROP TABLE "customer_coupons"`)
    await queryRunner.query(`DROP TYPE "customer_coupons_status_enum"`)
    await queryRunner.query(`DROP INDEX "idx_agent_phone"`)
    await queryRunner.query(`DROP INDEX "idx_agent_status"`)
    await queryRunner.query(`DROP INDEX "idx_agent_level"`)
    await queryRunner.query(`DROP INDEX "idx_agent_valid_customers"`)
    await queryRunner.query(`DROP TABLE "sharing_agents"`)
    await queryRunner.query(`DROP TYPE "sharing_agents_level_enum"`)
    await queryRunner.query(`DROP TYPE "sharing_agents_audit_status_enum"`)
    await queryRunner.query(`DROP INDEX "idx_attr_customer"`)
    await queryRunner.query(`DROP INDEX "idx_attr_agent"`)
    await queryRunner.query(`DROP INDEX "idx_attr_customer_agent"`)
    await queryRunner.query(`DROP INDEX "idx_attr_expire"`)
    await queryRunner.query(`DROP INDEX "idx_attr_active"`)
    await queryRunner.query(`DROP TABLE "customer_attributions"`)
    await queryRunner.query(`DROP INDEX "idx_coupon_campaign"`)
    await queryRunner.query(`DROP INDEX "idx_coupon_merchant"`)
    await queryRunner.query(`DROP INDEX "idx_coupon_status"`)
    await queryRunner.query(`DROP INDEX "idx_coupon_code"`)
    await queryRunner.query(`DROP TABLE "coupons"`)
    await queryRunner.query(`DROP TYPE "coupons_status_enum"`)
    await queryRunner.query(`DROP TYPE "coupons_coupon_type_enum"`)
    await queryRunner.query(`DROP INDEX "idx_customer_export_request_customer_created"`)
    await queryRunner.query(`DROP TABLE "customer_data_export_requests"`)
    await queryRunner.query(`DROP INDEX "idx_mcl_merchant_active_expiry"`)
    await queryRunner.query(`DROP INDEX "idx_mcl_customer"`)
    await queryRunner.query(`DROP INDEX "uq_mcl_merchant_customer"`)
    await queryRunner.query(`DROP TABLE "merchant_customer_locks"`)
    await queryRunner.query(`DROP INDEX "idx_customer_phone"`)
    await queryRunner.query(`DROP INDEX "idx_customer_openid"`)
    await queryRunner.query(`DROP TABLE "customers"`)
    await queryRunner.query(`DROP INDEX "idx_mystery_opening_customer"`)
    await queryRunner.query(`DROP TABLE "mystery_box_openings"`)
    await queryRunner.query(`DROP INDEX "idx_challenge_progress_customer_challenge"`)
    await queryRunner.query(`DROP TABLE "customer_challenge_progress"`)
    await queryRunner.query(`DROP INDEX "idx_sharing_challenge_active"`)
    await queryRunner.query(`DROP TABLE "sharing_challenges"`)
    await queryRunner.query(`DROP INDEX "idx_reward_product_active"`)
    await queryRunner.query(`DROP TABLE "reward_products"`)
    await queryRunner.query(`DROP INDEX "idx_point_ledger_event"`)
    await queryRunner.query(`DROP INDEX "idx_point_ledger_customer"`)
    await queryRunner.query(`DROP TABLE "customer_point_ledgers"`)
    await queryRunner.query(`DROP INDEX "idx_point_account_customer"`)
    await queryRunner.query(`DROP TABLE "customer_point_accounts"`)
    await queryRunner.query(`DROP INDEX "idx_campaign_optimization_merchant"`)
    await queryRunner.query(`DROP INDEX "idx_campaign_optimization_campaign"`)
    await queryRunner.query(`DROP TABLE "campaign_optimizations"`)
    await queryRunner.query(`DROP INDEX "idx_budget_tx_budget"`)
    await queryRunner.query(`DROP INDEX "idx_budget_tx_type"`)
    await queryRunner.query(`DROP INDEX "idx_budget_tx_created"`)
    await queryRunner.query(`DROP TABLE "budget_transactions"`)
    await queryRunner.query(`DROP TYPE "budget_transactions_type_enum"`)
    await queryRunner.query(`DROP INDEX "idx_budget_merchant"`)
    await queryRunner.query(`DROP INDEX "idx_budget_status"`)
    await queryRunner.query(`DROP TABLE "commission_budgets"`)
    await queryRunner.query(`DROP INDEX "idx_mab_merchant"`)
    await queryRunner.query(`DROP INDEX "idx_mab_agent"`)
    await queryRunner.query(`DROP INDEX "idx_mab_code"`)
    await queryRunner.query(`DROP INDEX "idx_mab_merchant_agent"`)
    await queryRunner.query(`DROP TABLE "merchant_agent_bindings"`)
    await queryRunner.query(`DROP TYPE "merchant_agent_bindings_audit_status_enum"`)
    await queryRunner.query(`DROP INDEX "idx_mak_key"`)
    await queryRunner.query(`DROP INDEX "idx_mak_secret_hash"`)
    await queryRunner.query(`DROP INDEX "idx_mak_merchant"`)
    await queryRunner.query(`DROP TABLE "merchant_api_keys"`)
    await queryRunner.query(`DROP INDEX "idx_optimization_setting_merchant"`)
    await queryRunner.query(`DROP TABLE "merchant_optimization_settings"`)
    await queryRunner.query(`DROP INDEX "idx_merchant_phone"`)
    await queryRunner.query(`DROP INDEX "idx_merchant_status"`)
    await queryRunner.query(`DROP INDEX "idx_merchant_audit_status"`)
    await queryRunner.query(`DROP TABLE "merchants"`)
    await queryRunner.query(`DROP TYPE "merchants_subscription_status_enum"`)
    await queryRunner.query(`DROP TYPE "merchants_audit_status_enum"`)
    await queryRunner.query(`DROP INDEX "idx_store_merchant"`)
    await queryRunner.query(`DROP INDEX "idx_store_status"`)
    await queryRunner.query(`DROP TABLE "stores"`)
    await queryRunner.query(`DROP INDEX "idx_pr_type"`)
    await queryRunner.query(`DROP INDEX "idx_pr_date"`)
    await queryRunner.query(`DROP INDEX "idx_pr_merchant"`)
    await queryRunner.query(`DROP INDEX "idx_pr_agent"`)
    await queryRunner.query(`DROP TABLE "platform_revenues"`)
    await queryRunner.query(`DROP INDEX "idx_notification_recipient_created"`)
    await queryRunner.query(`DROP INDEX "idx_notification_recipient_unread"`)
    await queryRunner.query(`DROP TABLE "notifications"`)
    await queryRunner.query(`DROP TYPE "notifications_recipient_role_enum"`)
    await queryRunner.query(`DROP INDEX "idx_subscription_merchant"`)
    await queryRunner.query(`DROP INDEX "idx_subscription_status"`)
    await queryRunner.query(`DROP INDEX "idx_subscription_expire"`)
    await queryRunner.query(`DROP TABLE "subscriptions"`)
    await queryRunner.query(`DROP TYPE "subscriptions_status_enum"`)
    await queryRunner.query(`DROP INDEX "idx_task_assignment_task_agent"`)
    await queryRunner.query(`DROP INDEX "idx_task_assignment_agent_status"`)
    await queryRunner.query(`DROP TABLE "sharing_task_assignments"`)
    await queryRunner.query(`DROP INDEX "idx_sharing_task_merchant_status"`)
    await queryRunner.query(`DROP INDEX "idx_sharing_task_coupon"`)
    await queryRunner.query(`DROP TABLE "sharing_tasks"`)
  }
}
