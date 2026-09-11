import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import * as bcrypt from 'bcrypt'
import { Client } from 'pg'

/**
 * Creates a small, safe-to-recognise pre-production demo dataset.
 *
 * This command never runs against production, does not delete financial or
 * audit history, and is idempotent while the prepared payout remains open for
 * adjudication. Once that payout is reversed, a later run adds a fresh case so
 * the operations team always has one ready to demonstrate.
 */
const BCRYPT_ROUNDS = 12
const DEMO = {
  adminUsername: 'staging_ops_admin',
  merchantPhone: '13900001001',
  creatorPhone: '18800001001',
  trackingPrefix: 'staging-demo-settlement-recovery',
  settledAmount: 168,
}

function loadEnvFile(path: string) {
  try {
    for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*?)\s*$/)
      if (!match || match[1] in process.env) continue
      process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2')
    }
  } catch {
    // Shell-provided variables are enough when no local env file exists.
  }
}

function configuredPassword() {
  const password = process.env.STAGING_DEMO_PASSWORD
  if (!password || password.length < 12)
    throw new Error('请设置至少 12 位的 STAGING_DEMO_PASSWORD；该值不会写入仓库或输出到终端。')
  return password
}

async function firstId(client: Client, sql: string, params: unknown[]) {
  const result = await client.query<{ id: string }>(sql, params)
  return result.rows[0]?.id ?? null
}

async function ensureAccounts(client: Client, passwordHash: string) {
  let adminId = await firstId(client, 'SELECT id FROM admins WHERE username = $1 FOR UPDATE', [
    DEMO.adminUsername,
  ])
  if (adminId) {
    await client.query(
      `UPDATE admins
       SET "passwordHash" = $1, "realName" = '预发运营管理员', role = 'super_admin', status = true, "updatedAt" = now()
       WHERE id = $2`,
      [passwordHash, adminId],
    )
  } else {
    adminId = randomUUID()
    await client.query(
      `INSERT INTO admins (id, username, "passwordHash", "realName", role, status)
       VALUES ($1, $2, $3, '预发运营管理员', 'super_admin', true)`,
      [adminId, DEMO.adminUsername, passwordHash],
    )
  }

  let merchantId = await firstId(client, 'SELECT id FROM merchants WHERE phone = $1 FOR UPDATE', [
    DEMO.merchantPhone,
  ])
  if (merchantId) {
    await client.query(
      `UPDATE merchants
       SET password_hash = $1, business_name = '预发演示商户', audit_status = 'approved', status = true,
           subscription_status = 'active', "updatedAt" = now()
       WHERE id = $2`,
      [passwordHash, merchantId],
    )
  } else {
    merchantId = randomUUID()
    await client.query(
      `INSERT INTO merchants
        (id, business_name, phone, password_hash, business_type, industry_category, audit_status, status, subscription_status)
       VALUES ($1, '预发演示商户', $2, $3, 'enterprise', '本地生活', 'approved', true, 'active')`,
      [merchantId, DEMO.merchantPhone, passwordHash],
    )
  }

  let creatorId = await firstId(client, 'SELECT id FROM sharing_agents WHERE phone = $1 FOR UPDATE', [
    DEMO.creatorPhone,
  ])
  if (creatorId) {
    await client.query(
      `UPDATE sharing_agents
       SET "passwordHash" = $1, nickname = '预发演示创作者', real_name_verified = true,
           audit_status = 'approved', status = true, agent_type = 'professional_creator',
           region = '上海', creator_categories = '["本地生活","短视频"]'::jsonb,
           creator_growth_score = 86, creator_growth_level = 4, "updatedAt" = now()
       WHERE id = $2`,
      [passwordHash, creatorId],
    )
  } else {
    creatorId = randomUUID()
    await client.query(
      `INSERT INTO sharing_agents
        (id, phone, "passwordHash", nickname, real_name_verified, audit_status, status, agent_type, region,
         creator_categories, creator_growth_score, creator_growth_level)
       VALUES ($1, $2, $3, '预发演示创作者', true, 'approved', true, 'professional_creator', '上海',
               '["本地生活","短视频"]'::jsonb, 86, 4)`,
      [creatorId, DEMO.creatorPhone, passwordHash],
    )
  }
  return { adminId, merchantId, creatorId }
}

async function hasReadyCase(client: Client, creatorId: string) {
  const result = await client.query(
    `SELECT appeal.id
     FROM creator_task_appeals appeal
     JOIN creator_task_payouts payout ON payout.id = appeal.payout_id
     JOIN creator_tasks task ON task.id = appeal.creator_task_id
     WHERE appeal.creator_id = $1 AND appeal.status = 'open' AND appeal.target = 'payout'
       AND payout.status = 'settled' AND task.tracking_id LIKE $2
     LIMIT 1`,
    [creatorId, `${DEMO.trackingPrefix}%`],
  )
  return result.rows[0]?.id as string | undefined
}

async function createReadyCase(client: Client, ids: { merchantId: string; creatorId: string }) {
  const campaignId = randomUUID()
  const growthTaskId = randomUUID()
  const growthPlanId = randomUUID()
  const creatorTaskId = randomUUID()
  const payoutId = randomUUID()
  const appealId = randomUUID()
  const trackingId = `${DEMO.trackingPrefix}-${Date.now()}`

  await client.query(
    `INSERT INTO campaigns
      (id, merchant_id, campaign_name, campaign_type, campaign_status, start_at, end_at, max_budget)
     VALUES ($1, $2, '预发结算追回演示活动', 'discount', 'active', now() - interval '7 days', now() + interval '14 days', 500)`,
    [campaignId, ids.merchantId],
  )
  await client.query(
    `INSERT INTO growth_tasks
      (id, merchant_id, campaign_id, goal_metric, baseline_value, target_value, budget, start_at, end_at, status)
     VALUES ($1, $2, $3, '核销订单数', 20, 40, 500, now() - interval '7 days', now() + interval '14 days', 'active')`,
    [growthTaskId, ids.merchantId, campaignId],
  )
  await client.query(
    `INSERT INTO growth_plans
      (id, merchant_id, growth_task_id, campaign_id, goal_brief, title, status, alternatives)
     VALUES ($1, $2, $3, $4, '预发环境：验证已结算报酬的撤销与自动追回。',
             '预发结算追回演示方案', 'approved', '[]'::jsonb)`,
    [growthPlanId, ids.merchantId, growthTaskId, campaignId],
  )
  await client.query(
    `INSERT INTO campaign_budget_allocations
      (merchant_id, growth_plan_id, growth_task_id, campaign_id, category, planned_amount, committed_amount, spent_amount, status)
     VALUES ($1, $2, $3, $4, 'creator_payout', 168, 168, 168, 'funded')`,
    [ids.merchantId, growthPlanId, growthTaskId, campaignId],
  )
  await client.query(
    `INSERT INTO creator_tasks
      (id, growth_task_id, campaign_id, merchant_id, creator_id, channel, content_type, brief, deadline,
       base_reward, tracking_id, published_url, status, compensation_snapshot, compensation_locked_at,
       state_reason, state_changed_at)
     VALUES ($1, $2, $3, $4, $5, 'douyin', 'short_video', '预发演示：已完成并结算，供撤销/追回验证。',
             now() + interval '7 days', 168, $6, 'https://example.test/preprod-settlement-recovery', 'settled',
             '{"baseReward":168,"currency":"CNY","source":"staging-demo"}'::jsonb, now() - interval '4 days',
             '预发演示数据：已结算', now() - interval '1 day')`,
    [creatorTaskId, growthTaskId, campaignId, ids.merchantId, ids.creatorId, trackingId],
  )
  await client.query(
    `INSERT INTO creator_task_payouts
      (id, creator_task_id, creator_id, merchant_id, campaign_id, expected_amount, verified_amount, status,
       verification_evidence, verified_at, settle_at, settled_at, recovery_offset_amount)
     VALUES ($1, $2, $3, $4, $5, 168, 168, 'settled',
             '{"source":"staging-demo","result":"verified","note":"预发已结算报酬"}'::jsonb,
             now() - interval '5 days', CURRENT_DATE - 2, now() - interval '1 day', 0)`,
    [payoutId, creatorTaskId, ids.creatorId, ids.merchantId, campaignId],
  )
  await client.query(
    `INSERT INTO agent_wallets
      (agent_id, pending_settlement_balance, settled_balance, frozen_balance, total_earned, total_platform_fee,
       total_settled, total_withdrawn, recovery_receivable_balance, total_recovered, status, ai_token_balance,
       last_settlement_at)
     VALUES ($1, 0, 168, 0, 168, 0, 168, 0, 0, 0, true, 0, now() - interval '1 day')
     ON CONFLICT (agent_id) DO UPDATE
       SET settled_balance = agent_wallets.settled_balance + 168,
           total_earned = agent_wallets.total_earned + 168,
           total_settled = agent_wallets.total_settled + 168,
           last_settlement_at = EXCLUDED.last_settlement_at,
           "updatedAt" = now()`,
    [ids.creatorId],
  )
  await client.query(
    `INSERT INTO creator_task_appeals
      (id, creator_task_id, creator_id, merchant_id, payout_id, appellant_type, target, appeal_deadline_at,
       reason, evidence, status, financial_ledger_entry_ids, recovery_amount, recovery_recovered_amount)
     VALUES ($1, $2, $3, $4, $5, 'merchant', 'payout', now() + interval '29 days',
             '预发演示：商户申请撤销已结算报酬并验证后续自动追回。',
             '{"source":"staging-demo","suggestedDecision":"reverse_settlement"}'::jsonb,
             'open', '[]'::jsonb, 0, 0)`,
    [appealId, creatorTaskId, ids.creatorId, ids.merchantId, payoutId],
  )
  return { appealId, creatorTaskId, payoutId, amount: DEMO.settledAmount }
}

async function main() {
  loadEnvFile(resolve(process.cwd(), '.env.local'))
  loadEnvFile(resolve(process.cwd(), '.env'))
  if ((process.env.NODE_ENV ?? 'development') === 'production')
    throw new Error('该脚本只允许用于预发/测试环境，NODE_ENV=production 时禁止执行。')

  const passwordHash = await bcrypt.hash(configuredPassword(), BCRYPT_ROUNDS)
  const client = new Client({
    host: process.env.DB_HOST ?? '127.0.0.1',
    port: Number(process.env.DB_PORT ?? '5432'),
    user: process.env.DB_USERNAME ?? 'ai_auto',
    password: process.env.DB_PASSWORD ?? 'ai_auto_dev',
    database: process.env.DB_NAME ?? 'ai_auto_dev',
  })
  await client.connect()
  try {
    await client.query('BEGIN')
    const accounts = await ensureAccounts(client, passwordHash)
    const readyAppealId = await hasReadyCase(client, accounts.creatorId)
    const caseData = readyAppealId
      ? { appealId: readyAppealId, reused: true }
      : { ...(await createReadyCase(client, accounts)), reused: false }
    await client.query('COMMIT')
    console.log(
      JSON.stringify({
        ok: true,
        accounts: {
          admin: { username: DEMO.adminUsername, role: 'admin' },
          merchant: { phone: DEMO.merchantPhone, role: 'merchant_admin' },
          creator: { phone: DEMO.creatorPhone, role: 'agent' },
        },
        preparedCase: caseData,
      }),
    )
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    await client.end()
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
