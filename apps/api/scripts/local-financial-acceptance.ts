import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { JwtService } from '@nestjs/jwt'
import { Client } from 'pg'
import { CreatorPayoutSettlementService } from '../src/modules/task/creator-payout-settlement.service'
import { CreatorTaskPayout } from '../src/modules/task/entities/creator-task-payout.entity'
import dataSource from '../src/data-source'

// This acceptance probe intentionally keeps its fixture history. The financial
// ledger and audit log are append-only after migration 1790100000000, so deleting
// a completed probe would itself violate the behaviour under test.
require('dotenv').config({ path: '../../.env.local' })

const baseUrl = process.env.LOCAL_FINANCIAL_ACCEPTANCE_BASE_URL ?? 'http://127.0.0.1:3199/api/v1'
const runId = `local-financial-${Date.now()}`
const ids = Object.fromEntries(
  ['merchant', 'creator', 'admin', 'campaign', 'growthTask', 'growthPlan', 'creatorTask'].map(
    (name) => [name, randomUUID()],
  ),
) as Record<string, string>

const db = new Client({
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? '5432'),
  user: process.env.DB_USERNAME ?? 'ai_auto',
  password: process.env.DB_PASSWORD ?? 'ai_auto_dev',
  database: process.env.DB_NAME ?? 'ai_auto_dev',
})

const jwt = new JwtService({ secret: process.env.JWT_SECRET ?? 'dev-secret-change-in-production' })
const token = (id: string, role: string) =>
  jwt.sign({ sub: id, role, username: `${runId}:${role}`, type: 'access' }, { expiresIn: '15m' })

async function request(path: string, method = 'GET', accessToken?: string, body?: unknown) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
  const payload = await response.json().catch(() => null)
  assert.ok(response.status < 300, `${method} ${path}: ${response.status} ${JSON.stringify(payload)}`)
  return payload
}

async function seed() {
  const uniquePhone = `${Date.now().toString().slice(-10)}`
  await db.query(
    `INSERT INTO merchants (id, business_name, phone, password_hash)
     VALUES ($1, $2, $3, 'local-financial-acceptance')`,
    [ids.merchant, `${runId} merchant`, `13${uniquePhone.slice(0, 9)}`],
  )
  await db.query(
    `INSERT INTO sharing_agents
      (id, phone, "passwordHash", nickname, real_name_verified, audit_status, status)
     VALUES ($1, $2, 'local-financial-acceptance', $3, true, 'approved', true)`,
    [ids.creator, `18${uniquePhone.slice(0, 9)}`, `${runId} creator`],
  )
  await db.query(
    `INSERT INTO campaigns
      (id, merchant_id, campaign_name, campaign_type, campaign_status, start_at, end_at, max_budget)
     VALUES ($1, $2, $3, 'discount', 'active', now() - interval '1 day', now() + interval '7 days', 200)`,
    [ids.campaign, ids.merchant, `${runId} campaign`],
  )
  await db.query(
    `INSERT INTO growth_tasks
      (id, merchant_id, campaign_id, goal_metric, baseline_value, target_value, budget, start_at, end_at, status)
     VALUES ($1, $2, $3, '新增订单数', 0, 1, 200, now() - interval '1 day', now() + interval '7 days', 'active')`,
    [ids.growthTask, ids.merchant, ids.campaign],
  )
  await db.query(
    `INSERT INTO growth_plans
      (id, merchant_id, growth_task_id, campaign_id, goal_brief, title, status, alternatives)
     VALUES ($1, $2, $3, $4, '本地财务验收', $5, 'approved', '[]'::jsonb)`,
    [ids.growthPlan, ids.merchant, ids.growthTask, ids.campaign, `${runId} plan`],
  )
  await db.query(
    `INSERT INTO campaign_budget_allocations
      (merchant_id, growth_plan_id, growth_task_id, campaign_id, category, planned_amount, committed_amount, spent_amount, status)
     VALUES
      ($1, $2, $3, $4, 'creator_payout', 100, 100, 0, 'funded'),
      ($1, $2, $3, $4, 'campaign_credits', 0, 0, 0, 'funded'),
      ($1, $2, $3, $4, 'channel_cost', 10, 10, 10, 'funded')`,
    [ids.merchant, ids.growthPlan, ids.growthTask, ids.campaign],
  )
  await db.query(
    `INSERT INTO creator_tasks
      (id, growth_task_id, campaign_id, merchant_id, creator_id, channel, content_type, brief, deadline, base_reward, tracking_id, status)
     VALUES ($1, $2, $3, $4, $5, 'douyin', 'short_video', $6, now() + interval '2 days', 100, $7, 'invited')`,
    [ids.creatorTask, ids.growthTask, ids.campaign, ids.merchant, ids.creator, `${runId} brief`, runId],
  )
}

async function main() {
  const merchantToken = token(ids.merchant, 'merchant_admin')
  const creatorToken = token(ids.creator, 'agent')
  const adminToken = token(ids.admin, 'admin')
  await db.connect()
  await seed()
  await dataSource.initialize()
  try {
    // Creator and operations use the production HTTP routes for every workflow action.
    for (const [path, body] of [
      [`/creator/tasks/${ids.creatorTask}/accept`, undefined],
      [`/creator/tasks/${ids.creatorTask}/start`, undefined],
      [`/creator/tasks/${ids.creatorTask}/submit`, undefined],
    ] as const)
      await request(path, 'POST', creatorToken, body)
    await request(`/admin/creator-tasks/${ids.creatorTask}/review`, 'POST', adminToken, {
      decision: 'approve', reason: '本地验收：履约内容符合要求',
    })
    await request(`/creator/tasks/${ids.creatorTask}/publish`, 'POST', creatorToken, {
      publishedUrl: `https://example.test/${runId}`,
    })
    await request(`/creator/tasks/${ids.creatorTask}/tracking`, 'POST', creatorToken)
    await request(`/creator/tasks/${ids.creatorTask}/complete`, 'POST', creatorToken)
    const verified = await request(
      `/admin/creator-tasks/${ids.creatorTask}/payout/verify`,
      'POST',
      adminToken,
      { verifiedAmount: 100, evidence: { runId, source: 'local-financial-acceptance' } },
    )
    assert.equal(verified.status, 'verified')
    assert.equal(verified.verifiedAmount, 100)

    const beforeSettlement = await request('/creator/earnings', 'GET', creatorToken)
    assert.equal(beforeSettlement.settlement.wallet.pending, 100)
    assert.equal(beforeSettlement.settlement.wallet.available, 0)

    // The scheduled job only settles due rows. Backdating this local-only fixture
    // exercises the job itself without weakening the HTTP workflow assertions.
    await db.query(
      `UPDATE creator_task_payouts SET settle_at = CURRENT_DATE - INTERVAL '1 day'
       WHERE creator_task_id = $1`,
      [ids.creatorTask],
    )
    const settlement = new CreatorPayoutSettlementService(
      dataSource.getRepository(CreatorTaskPayout),
      dataSource,
    )
    assert.deepEqual(await settlement.settleDuePayouts(), { processed: 1, totalAmount: 100 })

    const afterSettlement = await request('/creator/earnings', 'GET', creatorToken)
    assert.equal(afterSettlement.settlement.wallet.pending, 0)
    assert.equal(afterSettlement.settlement.wallet.available, 100)

    const merchantAppeal = await request(
      `/merchant/creator-tasks/${ids.creatorTask}/appeals`,
      'POST',
      merchantToken,
      { target: 'payout', reason: '本地验收：补充履约证据后调整报酬', evidence: { runId } },
    )
    const creatorAppeal = await request(
      `/creator/tasks/${ids.creatorTask}/appeals`,
      'POST',
      creatorToken,
      { target: 'payout', reason: '本地验收：对后续追回提出异议', evidence: { runId } },
    )
    const adjusted = await request(
      `/admin/creator-tasks/appeals/${merchantAppeal.id}/resolve`,
      'POST',
      adminToken,
      { decision: 'adjust_payout', adjustedAmount: 120, confirmedAmount: 120, resolution: '本地验收：追加 ¥20 报酬。' },
    )
    assert.equal(adjusted.amountBefore, 100)
    assert.equal(adjusted.amountAfter, 120)
    // Simulate a completed withdrawal before the reversal. This creates a real
    // outstanding receivable that a later payout must automatically offset.
    await db.query(
      `UPDATE agent_wallets SET settled_balance = 0, total_withdrawn = 120 WHERE agent_id = $1`,
      [ids.creator],
    )
    const reversed = await request(
      `/admin/creator-tasks/appeals/${creatorAppeal.id}/resolve`,
      'POST',
      adminToken,
      { decision: 'reverse_settlement', confirmedAmount: 120, resolution: '本地验收：撤销已结算报酬并完成追回。' },
    )
    assert.equal(reversed.amountBefore, 120)
    assert.equal(reversed.amountAfter, 0)

    const [creatorAppeals, merchantAppeals, creatorAppealDetail, merchantAppealDetail, creatorNotifications, merchantNotifications, report] = await Promise.all([
      request('/creator/appeals', 'GET', creatorToken),
      request('/merchant/appeals', 'GET', merchantToken),
      request(`/creator/appeals/${creatorAppeal.id}`, 'GET', creatorToken),
      request(`/merchant/appeals/${merchantAppeal.id}`, 'GET', merchantToken),
      request('/notifications', 'GET', creatorToken),
      request('/notifications', 'GET', merchantToken),
      request(`/merchant/growth-plans/${ids.growthPlan}/report`, 'GET', merchantToken),
    ])
    const creatorAppealRecord = creatorAppeals.items.find(
      (item: { appealId: string }) => item.appealId === creatorAppeal.id,
    )
    const merchantAppealRecord = merchantAppeals.items.find(
      (item: { appealId: string }) => item.appealId === merchantAppeal.id,
    )
    assert.equal(creatorAppealRecord.status, 'accepted')
    assert.equal(merchantAppealRecord.status, 'accepted')
    // Both portals receive only records connected to their own task relationship.
    assert.ok(creatorAppeals.items.every((item: { creatorId: string }) => item.creatorId === ids.creator))
    assert.ok(merchantAppeals.items.every((item: { merchantId: string }) => item.merchantId === ids.merchant))
    assert.deepEqual(
      {
        decision: merchantAppealRecord.adjudicationDecision,
        before: merchantAppealRecord.amountBefore,
        after: merchantAppealRecord.amountAfter,
        ledgerCount: merchantAppealRecord.financialLedgerEntries.length,
      },
      { decision: 'adjust_payout', before: 100, after: 120, ledgerCount: 1 },
    )
    assert.deepEqual(
      {
        decision: creatorAppealRecord.adjudicationDecision,
        before: creatorAppealRecord.amountBefore,
        after: creatorAppealRecord.amountAfter,
        ledgerCount: creatorAppealRecord.financialLedgerEntries.length,
      },
      { decision: 'reverse_settlement', before: 120, after: 0, ledgerCount: 1 },
    )
    assert.equal(creatorAppealDetail.appealId, creatorAppeal.id)
    assert.equal(merchantAppealDetail.appealId, merchantAppeal.id)
    assert.ok(
      creatorNotifications.items.some(
        (item: { type: string; targetId: string }) =>
          item.type === 'creator_task_appeal_adjudicated' && item.targetId === merchantAppeal.id,
      ),
    )
    assert.ok(
      merchantNotifications.items.some(
        (item: { type: string; targetId: string }) =>
          item.type === 'creator_task_appeal_resolved' && item.targetId === merchantAppeal.id,
      ),
    )
    assert.ok(creatorNotifications.items.every((item: { recipientId: string }) => item.recipientId === ids.creator))
    assert.ok(merchantNotifications.items.every((item: { recipientId: string }) => item.recipientId === ids.merchant))
    assert.equal(report.investment.creatorPayout, 0)
    assert.equal(report.investment.total, 10)
    assert.equal(report.investment.roi, -1)

    ids.followUpCreatorTask = randomUUID()
    await db.query(
      `INSERT INTO creator_tasks
        (id, growth_task_id, campaign_id, merchant_id, creator_id, channel, content_type, brief, deadline, base_reward, tracking_id, status)
       VALUES ($1, $2, $3, $4, $5, 'douyin', 'short_video', $6, now() + interval '2 days', 100, $7, 'completed')`,
      [ids.followUpCreatorTask, ids.growthTask, ids.campaign, ids.merchant, ids.creator, `${runId} recovery offset`, `${runId}-offset`],
    )
    await db.query(
      `INSERT INTO creator_task_payouts
        (creator_task_id, creator_id, merchant_id, campaign_id, expected_amount, status, verification_evidence)
       VALUES ($1, $2, $3, $4, 100, 'estimated', '{}'::jsonb)`,
      [ids.followUpCreatorTask, ids.creator, ids.merchant, ids.campaign],
    )
    await request(`/admin/creator-tasks/${ids.followUpCreatorTask}/payout/verify`, 'POST', adminToken, {
      verifiedAmount: 100, evidence: { runId, purpose: 'recovery-offset' },
    })
    await db.query(
      `UPDATE creator_task_payouts SET settle_at = CURRENT_DATE - INTERVAL '1 day'
       WHERE creator_task_id = $1`,
      [ids.followUpCreatorTask],
    )
    assert.deepEqual(await settlement.settleDuePayouts(), { processed: 1, totalAmount: 0 })
    const recoveryQueue = await request('/admin/creator-tasks/recovery-receivables', 'GET', adminToken)
    const recoveryItem = recoveryQueue.items.find((item: { appealId: string }) => item.appealId === creatorAppeal.id)
    assert.equal(recoveryItem.remainingAmount, 20)
    assert.equal(recoveryItem.recoveredAmount, 100)
    assert.equal(recoveryItem.offsets.length, 1)
    const dailyReconciliation = await request(
      '/admin/creator-tasks/recovery-reconciliation',
      'GET',
      adminToken,
    )
    assert.equal(dailyReconciliation.receivableMatches, true)
    assert.equal(dailyReconciliation.settlementOffsets.matches, true)
    const reportAfterRecoveryOffset = await request(
      `/merchant/growth-plans/${ids.growthPlan}/report`, 'GET', merchantToken,
    )
    assert.equal(reportAfterRecoveryOffset.investment.creatorPayout, 100)
    assert.equal(reportAfterRecoveryOffset.investment.total, 110)
    assert.equal(reportAfterRecoveryOffset.investment.roi, -1)

    const reconciliation = await db.query(
      `SELECT
         payout.status AS payout_status,
         payout.verified_amount,
         payout.adjudicated_amount,
         wallet.pending_settlement_balance,
         wallet.settled_balance,
         wallet.recovery_receivable_balance,
         wallet.total_recovered
       FROM creator_task_payouts payout
       JOIN agent_wallets wallet ON wallet.agent_id = payout.creator_id
       WHERE payout.creator_task_id = $1
       GROUP BY payout.status, payout.verified_amount, payout.adjudicated_amount,
         wallet.pending_settlement_balance, wallet.settled_balance,
         wallet.recovery_receivable_balance, wallet.total_recovered`,
      [ids.creatorTask],
    )
    const ledgerTotals = await db.query(
      `SELECT
          COALESCE(SUM(amount) FILTER (WHERE entry_type = 'appeal_payout_adjustment'), 0) AS adjustment,
          COALESCE(SUM(amount) FILTER (WHERE entry_type = 'appeal_payout_reversal'), 0) AS reversal
         FROM financial_ledger_entries WHERE creator_task_id = $1`,
      [ids.creatorTask],
    )
    const auditTotals = await db.query(`SELECT COUNT(*) AS audit_rows FROM audit_logs WHERE target_id IN ($1, $2)`, [
      merchantAppeal.id,
      creatorAppeal.id,
    ])
    const row = reconciliation.rows[0]
    const ledger = ledgerTotals.rows[0]
    const auditRows = Number(auditTotals.rows[0].audit_rows)
    assert.deepEqual(
      {
        payoutStatus: row.payout_status,
        verified: Number(row.verified_amount),
        adjudicated: Number(row.adjudicated_amount),
        pending: Number(row.pending_settlement_balance),
        available: Number(row.settled_balance),
        receivable: Number(row.recovery_receivable_balance),
        recovered: Number(row.total_recovered),
        adjustment: Number(ledger.adjustment),
        reversal: Number(ledger.reversal),
      },
      { payoutStatus: 'reversed', verified: 100, adjudicated: 0, pending: 0, available: 0, receivable: 20, recovered: 100, adjustment: 20, reversal: -120 },
    )
    assert.ok(auditRows >= 2)
    console.log(JSON.stringify({ ok: true, runId, ids, reconciliation: { ...row, ...ledger, auditRows }, report: reportAfterRecoveryOffset.investment }, null, 2))
  } finally {
    await dataSource.destroy()
    await db.end()
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
