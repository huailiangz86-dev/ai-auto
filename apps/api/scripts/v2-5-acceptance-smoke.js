const assert = require('node:assert/strict')
const { randomUUID } = require('node:crypto')
const { Client } = require('pg')
const { JwtService } = require('@nestjs/jwt')
require('dotenv').config({ path: '../../.env.local' })

const baseUrl = process.env.V2_5_SMOKE_BASE_URL || 'http://127.0.0.1:3199/api/v1'
const db = new Client({
  host: process.env.DB_HOST || 'localhost', port: Number(process.env.DB_PORT || '5432'),
  user: process.env.DB_USERNAME || 'ai_auto', password: process.env.DB_PASSWORD || 'ai_auto_dev',
  database: process.env.DB_NAME || 'ai_auto_dev',
})
const ids = Object.fromEntries(['merchant', 'creator', 'customer', 'campaign', 'coupon', 'rejectCoupon', 'task', 'plan', 'creatorTask', 'content'].map((key) => [key, randomUUID()]))
const jwt = new JwtService({ secret: process.env.JWT_SECRET || 'dev-secret-change-in-production' })
const token = (id, role) => jwt.sign({ sub: id, role, type: 'access' }, { expiresIn: '15m' })

async function request(path, method = 'GET', accessToken, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method, headers: { 'content-type': 'application/json', ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const payload = await response.json().catch(() => null)
  assert.equal(response.status < 300, true, `${method} ${path}: ${response.status} ${JSON.stringify(payload)}`)
  return payload
}

async function seed() {
  await db.query(`INSERT INTO merchants (id, business_name, phone, password_hash) VALUES ($1, 'V2-5 E2E Merchant', $2, 'test-hash')`, [ids.merchant, `19${Date.now().toString().slice(-9)}`])
  await db.query(`INSERT INTO sharing_agents (id, phone, "passwordHash", nickname) VALUES ($1, $2, 'test-hash', 'V2-5 Creator')`, [ids.creator, `18${Date.now().toString().slice(-9)}`])
  await db.query(`INSERT INTO customers (id, phone, nickname) VALUES ($1, $2, 'V2-5 Consumer')`, [ids.customer, `17${Date.now().toString().slice(-9)}`])
  await db.query(`INSERT INTO campaigns (id, merchant_id, campaign_name, campaign_type, campaign_status, start_at, end_at, max_budget) VALUES ($1, $2, 'V2-5 Evidence Campaign', 'discount', 'active', now() - interval '1 day', now() + interval '7 days', 200)`, [ids.campaign, ids.merchant])
  await db.query(`INSERT INTO coupons (id, campaign_id, merchant_id, coupon_name, coupon_code, coupon_type, threshold_amount, discount_amount, valid_from, valid_until, total_stock, remaining_stock, per_customer_limit, agent_reward_amount, status) VALUES ($1, $2, $3, 'V2-5 Coupon', $4, 'discount', 50, 10, now() - interval '1 day', now() + interval '7 days', 20, 20, 2, 10, 'active')`, [ids.coupon, ids.campaign, ids.merchant, `V25-${ids.coupon.slice(0, 8)}`])
  await db.query(`INSERT INTO coupons (id, campaign_id, merchant_id, coupon_name, coupon_code, coupon_type, threshold_amount, discount_amount, valid_from, valid_until, total_stock, remaining_stock, per_customer_limit, agent_reward_amount, status) VALUES ($1, $2, $3, 'V2-5 Rejection Coupon', $4, 'discount', 50, 10, now() - interval '1 day', now() + interval '7 days', 20, 20, 1, 10, 'active')`, [ids.rejectCoupon, ids.campaign, ids.merchant, `V25R-${ids.rejectCoupon.slice(0, 8)}`])
  await db.query(`INSERT INTO growth_tasks (id, merchant_id, campaign_id, goal_metric, baseline_value, target_value, budget, start_at, end_at, status) VALUES ($1, $2, $3, '新增订单数', 10, 20, 200, now() - interval '1 day', now() + interval '7 days', 'active')`, [ids.task, ids.merchant, ids.campaign])
  await db.query(`INSERT INTO growth_plans (id, merchant_id, growth_task_id, campaign_id, goal_brief, title, status, alternatives) VALUES ($1, $2, $3, $4, 'E2E 增量验证', 'V2-5 E2E Plan', 'approved', '[]'::jsonb)`, [ids.plan, ids.merchant, ids.task, ids.campaign])
  await db.query(`INSERT INTO creator_tasks (id, growth_task_id, campaign_id, merchant_id, creator_id, channel, content_type, brief, deadline, base_reward, tracking_id, status) VALUES ($1, $2, $3, $4, $5, 'douyin', 'short_video', 'V2-5 E2E brief', now() + interval '2 days', 8, 'v2-5-track', 'published')`, [ids.creatorTask, ids.task, ids.campaign, ids.merchant, ids.creator])
  await db.query(`INSERT INTO contents (id, agent_id, campaign_id, coupon_id, creator_task_id, content_type, target_platform, status, moderation_status, tracking_url) VALUES ($1, $2, $3, $4, $5, 'video', 'douyin', 'published', 'approved', 'https://example.test/v2-5-track')`, [ids.content, ids.creator, ids.campaign, ids.coupon, ids.creatorTask])
  await db.query(`INSERT INTO content_publications (content_id, agent_id, platform, status, platform_post_url, published_at) VALUES ($1, $2, 'douyin', 'published', 'https://example.test/post/v2-5', now())`, [ids.content, ids.creator])
  await db.query(`INSERT INTO campaign_budget_allocations (merchant_id, growth_plan_id, growth_task_id, campaign_id, category, planned_amount, committed_amount, spent_amount) VALUES ($1,$2,$3,$4,'campaign_credits',20,20,5),($1,$2,$3,$4,'channel_cost',20,20,2),($1,$2,$3,$4,'risk_reserve',10,10,1)`, [ids.merchant, ids.plan, ids.task, ids.campaign])
}

async function cleanup() {
  const merchant = ids.merchant
  await db.query('DELETE FROM pilot_metric_events WHERE merchant_id = $1', [merchant])
  await db.query('DELETE FROM commissions WHERE merchant_id = $1', [merchant])
  await db.query('DELETE FROM redemptions WHERE merchant_id = $1', [merchant])
  await db.query('DELETE FROM customer_coupons WHERE merchant_id = $1', [merchant])
  await db.query('DELETE FROM merchant_customer_locks WHERE merchant_id = $1', [merchant])
  await db.query('DELETE FROM customer_attributions WHERE customer_id = $1', [ids.customer])
  await db.query('DELETE FROM content_publications WHERE content_id = $1', [ids.content])
  await db.query('DELETE FROM contents WHERE id = $1', [ids.content])
  await db.query('DELETE FROM creator_tasks WHERE id = $1', [ids.creatorTask])
  await db.query('DELETE FROM incrementality_measurements WHERE growth_plan_id = $1', [ids.plan])
  await db.query('DELETE FROM campaign_budget_allocations WHERE growth_plan_id = $1', [ids.plan])
  await db.query('DELETE FROM growth_plans WHERE id = $1', [ids.plan])
  await db.query('DELETE FROM growth_tasks WHERE id = $1', [ids.task])
  await db.query('DELETE FROM coupons WHERE merchant_id = $1', [merchant])
  await db.query('DELETE FROM campaigns WHERE merchant_id = $1', [merchant])
  await db.query('DELETE FROM agent_wallets WHERE agent_id = $1', [ids.creator])
  await db.query('DELETE FROM sharing_agents WHERE id = $1', [ids.creator])
  await db.query('DELETE FROM customers WHERE id = $1', [ids.customer])
  await db.query('DELETE FROM merchants WHERE id = $1', [ids.merchant])
}

async function main() {
  await db.connect()
  try {
    await seed()
    const merchantToken = token(ids.merchant, 'merchant_admin')
    const customerToken = token(ids.customer, 'customer')
    const creatorToken = token(ids.creator, 'agent')
    const tracking = await request('/customer/attribution', 'POST', null, { customerId: ids.customer, agentId: ids.creator, campaignId: ids.campaign, sourceType: 'share_link', sourcePlatform: 'douyin' })
    assert.equal(tracking.isNewLock, true)

    const accepted = await request('/customer/coupons/claim', 'POST', customerToken, { couponId: ids.coupon, attributionId: tracking.attributionId, trackingConsent: true })
    const redemption = await request('/commission/redeem', 'POST', merchantToken, { couponCode: accepted.couponCode, transactionAmount: 100, merchantTransactionId: `v2-5-${ids.plan}` })
    assert.equal(redemption.success, true)
    assert.equal(redemption.commissionResult.agentPayout, 8)
    const commissions = await request('/commission/commissions', 'GET', creatorToken)
    assert.equal(commissions.items.length, 1)
    assert.equal(commissions.items[0].agentPayout, 8)

    const unmeasured = await request(`/merchant/growth-plans/${ids.plan}/report`, 'GET', merchantToken)
    assert.equal(unmeasured.verified.orders, 1)
    assert.equal(unmeasured.evidence.transactions[0].trackingId, 'v2-5-track')
    assert.equal(unmeasured.incremental.status, 'not_measured')
    const incremental = await request(`/merchant/growth-plans/${ids.plan}/incrementality`, 'POST', merchantToken, { method: 'geo_holdout', windowStartAt: '2026-08-01T00:00:00.000Z', windowEndAt: '2026-08-31T00:00:00.000Z', treatmentBaselineOrders: 10, treatmentObservedOrders: 25, controlBaselineOrders: 8, controlObservedOrders: 13, treatmentBaselineGmv: 1000, treatmentObservedGmv: 2500, controlBaselineGmv: 800, controlObservedGmv: 1300 })
    assert.equal(incremental.orders, 10)
    assert.equal(incremental.gmv, 1000)
    const report = await request(`/merchant/growth-plans/${ids.plan}/report`, 'GET', merchantToken)
    assert.equal(report.incremental.status, 'measured')
    assert.equal(report.incremental.orders, 10)
    const budgetUpdate = await request(`/merchant/campaigns/${ids.campaign}`, 'PUT', merchantToken, { maxBudget: 300 })
    assert.equal(budgetUpdate.code, 0)
    const repeatCampaign = await request('/merchant/campaigns', 'POST', merchantToken, { campaignName: 'V2-5 Repeat Campaign', campaignType: 'discount', targetAudience: 'new', startAt: new Date().toISOString(), endAt: new Date(Date.now() + 7 * 86400000).toISOString(), maxBudget: 100 })
    assert.equal(Boolean(repeatCampaign.campaignId), true)

    const rejected = await request('/customer/coupons/claim', 'POST', customerToken, { couponId: ids.rejectCoupon, attributionId: tracking.attributionId, trackingConsent: false })
    const rejectedRow = await db.query('SELECT attribution_id, agent_id, tracking_consent FROM customer_coupons WHERE id = $1', [rejected.customerCouponId])
    assert.deepEqual(rejectedRow.rows[0], { attribution_id: null, agent_id: null, tracking_consent: false })
    const evidence = await request(`/customer/coupons/${accepted.customerCouponId}/evidence-consent`, 'POST', customerToken, { trackingConsent: false })
    assert.equal(evidence.traceability.attributionLinked, false)
    const acceptedRow = await db.query('SELECT attribution_id, agent_id, tracking_consent FROM customer_coupons WHERE id = $1', [accepted.customerCouponId])
    assert.deepEqual(acceptedRow.rows[0], { attribution_id: null, agent_id: null, tracking_consent: false })
    const retained = await db.query('SELECT id, customer_id, coupon_id, merchant_id, commission_id, status FROM redemptions WHERE id = $1', [redemption.redemptionId])
    assert.equal(retained.rows[0].status, 'verified')
    assert.equal(Boolean(retained.rows[0].commission_id), true)

    console.log(JSON.stringify({ ok: true, evidenceChain: 'content/tracking -> consent -> claim -> verified redemption -> creator payout -> merchant ROI/incrementality', verifiedOrders: report.verified.orders, incrementalOrders: report.incremental.orders, roi: report.investment.roi, privacy: 'reject and withdrawal break coupon-side creator attribution; verified settlement record retained' }))
  } finally {
    await cleanup().catch((error) => console.error('cleanup failed', error.message))
    await db.end()
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1 })