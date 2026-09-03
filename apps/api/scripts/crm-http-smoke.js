const assert = require('node:assert/strict')
const { Client } = require('pg')
const { JwtService } = require('@nestjs/jwt')

const baseUrl = process.env.CRM_SMOKE_BASE_URL || 'http://localhost:3100'
const schema = process.env.DB_SCHEMA
if (!schema || !/^crm_smoke_[a-z0-9_]+$/.test(schema)) {
  throw new Error('DB_SCHEMA must name a dedicated crm_smoke_* schema')
}

const ids = {
  merchantA: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
  merchantB: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
  merchantEmpty: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3',
  agent: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4',
  campaignA: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5',
  campaignB: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa6',
  couponA: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa7',
  couponB: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa8',
  customerA1: '11111111-1111-4111-8111-111111111111',
  customerA2: '33333333-3333-4333-8333-333333333333',
  customerA3: '44444444-4444-4444-8444-444444444444',
  customerExpired: '55555555-5555-4555-8555-555555555555',
  customerB: '22222222-2222-4222-8222-222222222222',
  attributionA1: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa9',
  attributionA2: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaab0',
  attributionA3: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaab1',
  attributionB: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaab2',
}

const jwt = new JwtService({ secret: 'dev-secret-change-in-production' })

function token(subject, role) {
  return jwt.sign({ sub: subject, role, type: 'access' }, { expiresIn: '15m' })
}

async function seed() {
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || '5432'),
    user: process.env.DB_USERNAME || 'ai_auto',
    password: process.env.DB_PASSWORD || 'ai_auto_dev',
    database: process.env.DB_NAME || 'ai_auto_dev',
    options: `-c search_path=${schema},public`,
  })
  await client.connect()
  try {
    await client.query('BEGIN')
    await client.query(
      'TRUNCATE TABLE redemptions, merchant_customer_locks, customer_attributions, coupons, campaigns, sharing_agents, customers, merchants RESTART IDENTITY CASCADE',
    )
    await client.query(
      `INSERT INTO merchants (id, business_name, phone, password_hash)
       VALUES ($1, 'CRM Smoke Merchant A', '13000000001', 'test-hash'),
              ($2, 'CRM Smoke Merchant B', '13000000002', 'test-hash'),
              ($3, 'CRM Smoke Empty Merchant', '13000000003', 'test-hash')`,
      [ids.merchantA, ids.merchantB, ids.merchantEmpty],
    )
    await client.query(
      'INSERT INTO sharing_agents (id, phone, "passwordHash", nickname) VALUES ($1, $2, $3, $4)',
      [ids.agent, '13100000001', 'test-hash', 'CRM 分享员'],
    )
    await client.query(
      `INSERT INTO campaigns (id, merchant_id, campaign_name, campaign_type, campaign_status, start_at)
       VALUES ($1, $2, 'CRM Smoke Campaign A', 'discount', 'active', now() - interval '7 days'),
              ($3, $4, 'CRM Smoke Campaign B', 'discount', 'active', now() - interval '7 days')`,
      [ids.campaignA, ids.merchantA, ids.campaignB, ids.merchantB],
    )
    await client.query(
      `INSERT INTO coupons (id, campaign_id, merchant_id, coupon_name, coupon_code, coupon_type, valid_from, valid_until, agent_reward_amount)
       VALUES ($1, $2, $3, 'CRM Smoke Coupon A', 'CRM-SMOKE-A', 'discount', now() - interval '7 days', now() + interval '7 days', 5),
              ($4, $5, $6, 'CRM Smoke Coupon B', 'CRM-SMOKE-B', 'discount', now() - interval '7 days', now() + interval '7 days', 5)`,
      [ids.couponA, ids.campaignA, ids.merchantA, ids.couponB, ids.campaignB, ids.merchantB],
    )
    await client.query(
      `INSERT INTO customers (id, phone, nickname, first_agent_id)
       VALUES ($1, '13812345678', 'CRM-Alice-RAW', $6),
              ($2, '13887654321', 'CRM-Bob-RAW', $6),
              ($3, '13712344321', 'CRM-Cathy-RAW', $6),
              ($4, '13600001111', 'CRM-Expired-RAW', $6),
              ($5, '13999998888', 'CRM-OtherMerchant-RAW', $6)`,
      [
        ids.customerA1,
        ids.customerA2,
        ids.customerA3,
        ids.customerExpired,
        ids.customerB,
        ids.agent,
      ],
    )
    await client.query(
      `INSERT INTO customer_attributions (id, customer_id, agent_id, source_type, lock_started_at, lock_expired_at)
       VALUES ($1, $2, $6, 'share_link', now() - interval '3 days', now() + interval '30 days'),
              ($3, $4, $6, 'share_link', now() - interval '2 days', now() + interval '30 days'),
              ($5, $7, $6, 'share_link', now() - interval '1 day', now() + interval '30 days'),
              ($8, $9, $6, 'share_link', now() - interval '1 day', now() + interval '30 days')`,
      [
        ids.attributionA1,
        ids.customerA1,
        ids.attributionA2,
        ids.customerA2,
        ids.attributionA3,
        ids.agent,
        ids.customerA3,
        ids.attributionB,
        ids.customerB,
      ],
    )
    await client.query(
      `INSERT INTO merchant_customer_locks (merchant_id, customer_id, attribution_id, agent_id, source, acquired_at, lock_expired_at, is_active)
       VALUES ($1, $2, $3, $6, 'agent', now() - interval '3 days', now() + interval '30 days', true),
              ($1, $4, $5, $6, 'agent', now() - interval '2 days', now() + interval '30 days', true),
              ($1, $7, $8, $6, 'platform', now() - interval '1 day', now() + interval '30 days', true),
              ($1, $9, null, $6, 'agent', now() - interval '10 days', now() - interval '1 day', true),
              ($10, $11, $12, $6, 'agent', now() - interval '1 day', now() + interval '30 days', true)`,
      [
        ids.merchantA,
        ids.customerA1,
        ids.attributionA1,
        ids.customerA2,
        ids.attributionA2,
        ids.agent,
        ids.customerA3,
        ids.attributionA3,
        ids.customerExpired,
        ids.merchantB,
        ids.customerB,
        ids.attributionB,
      ],
    )
    await client.query(
      `INSERT INTO redemptions (idempotency_key, customer_id, coupon_id, merchant_id, attribution_id, coupon_type, transaction_amount, discount_value, agent_reward_amount, status, coupon_code, "createdAt")
       VALUES ('crm-smoke-a1-verified', $1, $2, $3, $4, 'discount', 88.50, 10, 5, 'verified', 'CRM-REDEEM-A1', now() - interval '1 day'),
              ('crm-smoke-a1-settled', $1, $2, $3, $4, 'discount', 11.20, 1, 1, 'settled', 'CRM-REDEEM-A2', now() - interval '12 hours'),
              ('crm-smoke-a1-before-lock', $1, $2, $3, $4, 'discount', 999.99, 10, 5, 'verified', 'CRM-REDEEM-A3', now() - interval '5 days'),
              ('crm-smoke-b1-verified', $5, $6, $7, $8, 'discount', 42.00, 5, 2, 'verified', 'CRM-REDEEM-B1', now() - interval '12 hours')`,
      [
        ids.customerA1,
        ids.couponA,
        ids.merchantA,
        ids.attributionA1,
        ids.customerB,
        ids.couponB,
        ids.merchantB,
        ids.attributionB,
      ],
    )
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    await client.end()
  }
}

async function request(path, accessToken) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
  })
  return { response, text: await response.text() }
}

async function run() {
  await seed()
  const merchantAToken = token(ids.merchantA, 'merchant_admin')
  const merchantBToken = token(ids.merchantB, 'merchant_admin')
  const merchantEmptyToken = token(ids.merchantEmpty, 'merchant_admin')
  const agentToken = token(ids.agent, 'agent')
  const root = '/api/v1/analytics/crm/customers'

  let result = await request(root)
  assert.equal(result.response.status, 401)

  result = await request(root, agentToken)
  assert.equal(result.response.status, 403)

  result = await request(`${root}?page=1&pageSize=2`, merchantAToken)
  assert.equal(result.response.status, 200)
  const merchantAList = JSON.parse(result.text)
  assert.deepEqual(merchantAList.pagination, { page: 1, pageSize: 2, total: 3, totalPages: 2 })
  assert.equal(merchantAList.items.length, 2)
  assert.ok(merchantAList.items.every((item) => item.phone?.includes('****')))
  assert.ok(result.text.includes('CUST-'))
  assert.ok(!result.text.includes('13812345678'))
  assert.ok(!result.text.includes('CRM-Alice-RAW'))
  assert.ok(!result.text.includes(ids.customerB))

  result = await request(`${root}?page=2&pageSize=2`, merchantAToken)
  assert.equal(result.response.status, 200)
  const merchantAPageTwo = JSON.parse(result.text)
  assert.equal(merchantAPageTwo.items.length, 1)

  result = await request(`${root}?page=99&pageSize=2`, merchantAToken)
  assert.equal(result.response.status, 200)
  assert.deepEqual(JSON.parse(result.text).items, [])

  result = await request(root, merchantEmptyToken)
  assert.equal(result.response.status, 200)
  assert.deepEqual(JSON.parse(result.text), {
    items: [],
    pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
  })

  result = await request(`${root}?pageSize=101`, merchantAToken)
  assert.equal(result.response.status, 400)

  result = await request(root, merchantBToken)
  assert.equal(result.response.status, 200)
  const merchantBList = JSON.parse(result.text)
  assert.equal(merchantBList.pagination.total, 1)
  assert.equal(merchantBList.items[0].customerReference, 'CUST-22222222')

  const customerReference = merchantAList.items[0].customerReference
  result = await request(`${root}/${customerReference}`, merchantAToken)
  assert.equal(result.response.status, 200)
  assert.deepEqual(JSON.parse(result.text), merchantAList.items[0])

  result = await request(`${root}/${customerReference}`, merchantBToken)
  assert.equal(result.response.status, 404)

  result = await request(`${root}/export`, merchantAToken)
  assert.equal(result.response.status, 200)
  assert.match(result.response.headers.get('content-type') || '', /text\/csv/)
  assert.ok(result.text.includes('138****5678'))
  assert.ok(!result.text.includes('13812345678'))
  assert.ok(!result.text.includes('CRM-Alice-RAW'))
  assert.ok(!result.text.includes('13999998888'))
  assert.ok(!result.text.includes(ids.customerA1))

  console.log('CRM HTTP smoke passed: isolation, empty data, authorization, pagination, detail, and CSV masking')
}

run().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
