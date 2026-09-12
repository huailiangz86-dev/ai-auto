const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { resolve } = require('node:path')
const { Client } = require('pg')

const MOCK_PASSWORD_HASH = '$2b$12$91FQCPBZ4doMK8cPW//eW.3hlV9MIg2yrane4Bp5xjtMULaynePr2'
const ids = {
  merchant: '00000000-0000-4000-8000-000000000201',
  campaign: '00000000-0000-4000-8000-000000000301',
  coupon: '00000000-0000-4000-8000-000000000401',
  sharingTask: '00000000-0000-4000-8000-000000000501',
  growthTask: '00000000-0000-4000-8000-000000000601',
  creatorTaskCompleted: '00000000-0000-4000-8000-000000000701',
  creatorTaskCurrent: '00000000-0000-4000-8000-000000000702',
  assignment: '00000000-0000-4000-8000-000000000801',
  content: '00000000-0000-4000-8000-000000000901',
  publication: '00000000-0000-4000-8000-000000001001',
  bindingProfessional: '00000000-0000-4000-8000-000000001101',
  bindingOrdinary: '00000000-0000-4000-8000-000000001102',
  platformAccount: '00000000-0000-4000-8000-000000001201',
  note: '00000000-0000-4000-8000-000000001301',
}

const agents = [
  {
    id: '00000000-0000-4000-8000-000000000101',
    phone: '13900000101',
    nickname: 'MOCK-待审核-小林',
    auditStatus: 'pending',
    status: true,
    agentType: 'ordinary_user',
    realNameVerified: false,
    level: 'bronze',
    creatorGrowthScore: 18,
    creatorGrowthLevel: 1,
    creatorCategories: ['生活方式'],
    region: '上海',
    creatorTaskLimit: null,
    operationTags: ['待审核', '新注册'],
    createdAt: '2026-09-01T02:00:00.000Z',
  },
  {
    id: '00000000-0000-4000-8000-000000000102',
    phone: '13900000102',
    nickname: 'MOCK-待审核-阿杰',
    auditStatus: 'pending',
    status: true,
    agentType: 'ordinary_user',
    realNameVerified: true,
    level: 'bronze',
    creatorGrowthScore: 35,
    creatorGrowthLevel: 2,
    creatorCategories: ['数码'],
    region: '杭州',
    creatorTaskLimit: 2,
    operationTags: ['待审核', '已实名'],
    createdAt: '2026-09-02T02:00:00.000Z',
  },
  {
    id: '00000000-0000-4000-8000-000000000103',
    phone: '13900000103',
    nickname: 'MOCK-专业达人-苏苏',
    auditStatus: 'approved',
    status: true,
    agentType: 'professional_creator',
    realNameVerified: true,
    level: 'gold',
    creatorGrowthScore: 86,
    creatorGrowthLevel: 4,
    creatorCategories: ['美食', '探店'],
    region: '杭州',
    creatorTaskLimit: 10,
    operationTags: ['专业达人', '高转化'],
    createdAt: '2026-08-10T02:00:00.000Z',
  },
  {
    id: '00000000-0000-4000-8000-000000000104',
    phone: '13900000104',
    nickname: 'MOCK-冻结-大宇',
    auditStatus: 'approved',
    status: false,
    agentType: 'ordinary_user',
    realNameVerified: true,
    level: 'silver',
    creatorGrowthScore: 54,
    creatorGrowthLevel: 3,
    creatorCategories: ['运动'],
    region: '南京',
    creatorTaskLimit: 3,
    operationTags: ['冻结复核'],
    frozenAt: '2026-09-07T02:00:00.000Z',
    frozenReason: 'MOCK：异常设备登录，等待人工复核',
    createdAt: '2026-08-12T02:00:00.000Z',
  },
  {
    id: '00000000-0000-4000-8000-000000000105',
    phone: '13900000105',
    nickname: 'MOCK-黑名单-小周',
    auditStatus: 'approved',
    status: false,
    agentType: 'professional_creator',
    realNameVerified: false,
    level: 'bronze',
    creatorGrowthScore: 12,
    creatorGrowthLevel: 1,
    creatorCategories: ['其他'],
    region: '深圳',
    creatorTaskLimit: 0,
    operationTags: ['黑名单', '风险'],
    blacklistedAt: '2026-09-06T02:00:00.000Z',
    blacklistReason: 'MOCK：重复提交违规内容',
    createdAt: '2026-08-14T02:00:00.000Z',
  },
  {
    id: '00000000-0000-4000-8000-000000000106',
    phone: '13900000106',
    nickname: null,
    auditStatus: 'approved',
    status: true,
    agentType: 'ordinary_user',
    realNameVerified: false,
    level: 'bronze',
    creatorGrowthScore: 0,
    creatorGrowthLevel: 1,
    creatorCategories: [],
    region: null,
    creatorTaskLimit: null,
    operationTags: [],
    createdAt: '2026-08-16T02:00:00.000Z',
  },
]

function loadEnvFile(path) {
  try {
    for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*?)\s*$/)
      if (!match || match[1] in process.env) continue
      process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2')
    }
  } catch {
    // Shell-provided environment variables are sufficient.
  }
}

function agentValues(agent) {
  return [
    agent.id,
    agent.createdAt,
    agent.createdAt,
    agent.phone,
    agent.nickname,
    MOCK_PASSWORD_HASH,
    agent.auditStatus,
    agent.status,
    agent.realNameVerified,
    agent.level,
    agent.agentType,
    agent.region,
    JSON.stringify(agent.creatorCategories),
    JSON.stringify({}),
    agent.creatorGrowthScore,
    agent.creatorGrowthLevel,
    JSON.stringify({}),
    agent.blacklistedAt ?? null,
    agent.blacklistReason ?? null,
    agent.frozenAt ?? null,
    agent.frozenReason ?? null,
    agent.creatorTaskLimit,
    JSON.stringify(agent.operationTags),
  ]
}

async function upsertAgents(client) {
  const query = `
    INSERT INTO sharing_agents (
      id, "createdAt", "updatedAt", phone, nickname, "passwordHash", audit_status,
      status, real_name_verified, level, agent_type, region, creator_categories,
      task_preferences, creator_growth_score, creator_growth_level, creator_score_breakdown,
      blacklisted_at, blacklist_reason, frozen_at, frozen_reason, creator_task_limit, operation_tags
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb, $14::jsonb,
      $15, $16, $17::jsonb, $18, $19, $20, $21, $22, $23::jsonb)
    ON CONFLICT (id) DO UPDATE SET
      "createdAt" = EXCLUDED."createdAt", "updatedAt" = EXCLUDED."updatedAt",
      phone = EXCLUDED.phone, nickname = EXCLUDED.nickname, "passwordHash" = EXCLUDED."passwordHash",
      audit_status = EXCLUDED.audit_status, status = EXCLUDED.status,
      real_name_verified = EXCLUDED.real_name_verified, level = EXCLUDED.level,
      agent_type = EXCLUDED.agent_type, region = EXCLUDED.region,
      creator_categories = EXCLUDED.creator_categories, task_preferences = EXCLUDED.task_preferences,
      creator_growth_score = EXCLUDED.creator_growth_score, creator_growth_level = EXCLUDED.creator_growth_level,
      creator_score_breakdown = EXCLUDED.creator_score_breakdown, blacklisted_at = EXCLUDED.blacklisted_at,
      blacklist_reason = EXCLUDED.blacklist_reason, frozen_at = EXCLUDED.frozen_at,
      frozen_reason = EXCLUDED.frozen_reason, creator_task_limit = EXCLUDED.creator_task_limit,
      operation_tags = EXCLUDED.operation_tags`
  for (const agent of agents) await client.query(query, agentValues(agent))
}

async function upsertSupportingData(client) {
  await client.query(
    `INSERT INTO merchants (id, "createdAt", "updatedAt", business_name, phone, password_hash,
      business_type, industry_category, audit_status, status, subscription_status, contact_name, contact_phone, email)
     VALUES ($1, '2026-08-01T02:00:00.000Z', '2026-08-01T02:00:00.000Z', 'MOCK-分享员测试商户',
      '13800000201', $2, 'enterprise', '餐饮', 'approved', true, 'active', '测试运营', '13800000201', 'mock-agent@local.test')
     ON CONFLICT (id) DO UPDATE SET business_name = EXCLUDED.business_name, phone = EXCLUDED.phone,
      password_hash = EXCLUDED.password_hash, audit_status = EXCLUDED.audit_status, status = EXCLUDED.status,
      subscription_status = EXCLUDED.subscription_status, contact_name = EXCLUDED.contact_name,
      contact_phone = EXCLUDED.contact_phone, email = EXCLUDED.email`,
    [ids.merchant, MOCK_PASSWORD_HASH],
  )
  await client.query(
    `INSERT INTO campaigns (id, "createdAt", "updatedAt", merchant_id, campaign_name, campaign_type,
      campaign_status, start_at, end_at, max_budget, spent_budget, total_impressions, total_clicks,
      total_claims, total_redemptions, total_commission_spent)
     VALUES ($1, '2026-08-20T02:00:00.000Z', '2026-09-01T02:00:00.000Z', $2, 'MOCK-达人转化活动', 'discount',
      'active', '2026-08-20T02:00:00.000Z', '2026-09-30T02:00:00.000Z', 10000, 2600, 12800, 3200, 420, 58, 580)
     ON CONFLICT (id) DO UPDATE SET campaign_name = EXCLUDED.campaign_name, campaign_status = EXCLUDED.campaign_status,
      max_budget = EXCLUDED.max_budget, spent_budget = EXCLUDED.spent_budget, total_impressions = EXCLUDED.total_impressions,
      total_clicks = EXCLUDED.total_clicks, total_claims = EXCLUDED.total_claims, total_redemptions = EXCLUDED.total_redemptions,
      total_commission_spent = EXCLUDED.total_commission_spent`,
    [ids.campaign, ids.merchant],
  )
  await client.query(
    `INSERT INTO coupons (id, "createdAt", "updatedAt", campaign_id, merchant_id, coupon_name, coupon_code,
      coupon_type, valid_from, valid_until, agent_reward_amount, status, total_issued, total_redeemed, total_commission_paid)
     VALUES ($1, '2026-08-20T02:00:00.000Z', '2026-09-01T02:00:00.000Z', $2, $3, 'MOCK-满100减10', 'MOCK-AGENT-001',
      'discount', '2026-08-20T02:00:00.000Z', '2026-09-30T02:00:00.000Z', 10, 'active', 420, 58, 580)
     ON CONFLICT (id) DO UPDATE SET coupon_name = EXCLUDED.coupon_name, status = EXCLUDED.status,
      total_issued = EXCLUDED.total_issued, total_redeemed = EXCLUDED.total_redeemed,
      total_commission_paid = EXCLUDED.total_commission_paid`,
    [ids.coupon, ids.campaign, ids.merchant],
  )
  await client.query(
    `INSERT INTO growth_tasks (id, "createdAt", "updatedAt", merchant_id, campaign_id, goal_metric,
      baseline_value, target_value, budget, compensation_reserved, campaign_credits_reserved,
      start_at, end_at, status)
     VALUES ($1, '2026-08-20T02:00:00.000Z', '2026-09-01T02:00:00.000Z', $2, $3, '新增核销订单', 20, 100,
      3000, 1000, 1200, '2026-08-20T02:00:00.000Z', '2026-09-30T02:00:00.000Z', 'active')
     ON CONFLICT (id) DO UPDATE SET goal_metric = EXCLUDED.goal_metric, budget = EXCLUDED.budget, status = EXCLUDED.status`,
    [ids.growthTask, ids.merchant, ids.campaign],
  )
  await client.query(
    `INSERT INTO creator_tasks (id, "createdAt", "updatedAt", growth_task_id, campaign_id, merchant_id,
      creator_id, channel, content_type, brief, deadline, base_reward, campaign_credits_allocated,
      campaign_credits_consumed, status, published_url)
     VALUES ($1, '2026-08-25T02:00:00.000Z', '2026-09-01T02:00:00.000Z', $2, $3, $4, $5, 'douyin',
      'short_video', 'MOCK：探店短视频已完成', '2026-09-10T02:00:00.000Z', 80, 80, 80, 'completed', 'https://example.test/mock-agent-completed'),
            ($6, '2026-09-02T02:00:00.000Z', '2026-09-02T02:00:00.000Z', $2, $3, $4, $5, 'xiaohongshu',
      'image_text', 'MOCK：新品种草图文制作中', '2026-09-20T02:00:00.000Z', 60, 60, 20, 'creating', null)
     ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, brief = EXCLUDED.brief,
      base_reward = EXCLUDED.base_reward, campaign_credits_consumed = EXCLUDED.campaign_credits_consumed,
      published_url = EXCLUDED.published_url`,
    [
      ids.creatorTaskCompleted,
      ids.growthTask,
      ids.campaign,
      ids.merchant,
      agents[2].id,
      ids.creatorTaskCurrent,
    ],
  )
  await client.query(
    `INSERT INTO sharing_tasks (id, "createdAt", "updatedAt", merchant_id, coupon_id, target_audience,
      budget, deadline, max_agents, target_claims, target_redemptions, reward_per_redemption, status)
     VALUES ($1, '2026-08-20T02:00:00.000Z', '2026-09-01T02:00:00.000Z', $2, $3, '杭州本地美食用户',
      1000, '2026-09-30T02:00:00.000Z', 20, 420, 58, 10, 'open')
     ON CONFLICT (id) DO UPDATE SET target_claims = EXCLUDED.target_claims, target_redemptions = EXCLUDED.target_redemptions,
      status = EXCLUDED.status`,
    [ids.sharingTask, ids.merchant, ids.coupon],
  )
  await client.query(
    `INSERT INTO sharing_task_assignments (id, "createdAt", "updatedAt", task_id, agent_id, status,
      view_count, claim_count, redemption_count, earned_reward, completed_at)
     VALUES ($1, '2026-08-25T02:00:00.000Z', '2026-09-01T02:00:00.000Z', $2, $3, 'completed',
      12800, 420, 58, 580, '2026-09-05T02:00:00.000Z')
     ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, view_count = EXCLUDED.view_count,
      claim_count = EXCLUDED.claim_count, redemption_count = EXCLUDED.redemption_count,
      earned_reward = EXCLUDED.earned_reward, completed_at = EXCLUDED.completed_at`,
    [ids.assignment, ids.sharingTask, agents[2].id],
  )
  await client.query(
    `INSERT INTO contents (id, "createdAt", "updatedAt", agent_id, campaign_id, coupon_id, creator_task_id,
      content_type, target_platform, status, moderation_status, tracking_url, total_impressions, total_clicks, total_claims)
     VALUES ($1, '2026-08-28T02:00:00.000Z', '2026-09-01T02:00:00.000Z', $2, $3, $4, $5, 'video',
      'douyin', 'published', 'approved', 'https://example.test/mock-agent-content', 12800, 3200, 420)
     ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, moderation_status = EXCLUDED.moderation_status,
      tracking_url = EXCLUDED.tracking_url, total_impressions = EXCLUDED.total_impressions, total_clicks = EXCLUDED.total_clicks,
      total_claims = EXCLUDED.total_claims`,
    [ids.content, agents[2].id, ids.campaign, ids.coupon, ids.creatorTaskCompleted],
  )
  await client.query(
    `INSERT INTO content_publications (id, "createdAt", "updatedAt", content_id, agent_id, platform, status,
      platform_post_id, platform_post_url, impressions, clicks, comments, shares, likes, published_at)
     VALUES ($1, '2026-08-29T02:00:00.000Z', '2026-09-01T02:00:00.000Z', $2, $3, 'douyin', 'published',
      'MOCK-POST-001', 'https://example.test/mock-agent-post', 12800, 3200, 86, 210, 680, '2026-08-29T02:00:00.000Z')
     ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, impressions = EXCLUDED.impressions,
      clicks = EXCLUDED.clicks, comments = EXCLUDED.comments, shares = EXCLUDED.shares, likes = EXCLUDED.likes`,
    [ids.publication, ids.content, agents[2].id],
  )
  await client.query(
    `INSERT INTO merchant_agent_bindings (id, "createdAt", "updatedAt", merchant_id, agent_id, invite_code,
      binding_status, audit_status, invite_type, douyin_bind, xiaohongshu_bind, wechat_video_bind, bound_at)
     VALUES ($1, '2026-08-22T02:00:00.000Z', '2026-09-01T02:00:00.000Z', $2, $3, 'MOCK-PRO-001',
      'active', 'approved', 'manual', true, true, false, '2026-08-22T02:00:00.000Z'),
            ($4, '2026-08-23T02:00:00.000Z', '2026-09-01T02:00:00.000Z', $2, $5, 'MOCK-ORD-001',
      'active', 'approved', 'manual', false, false, true, '2026-08-23T02:00:00.000Z')
     ON CONFLICT (id) DO UPDATE SET binding_status = EXCLUDED.binding_status, audit_status = EXCLUDED.audit_status,
      douyin_bind = EXCLUDED.douyin_bind, xiaohongshu_bind = EXCLUDED.xiaohongshu_bind,
      wechat_video_bind = EXCLUDED.wechat_video_bind, bound_at = EXCLUDED.bound_at`,
    [ids.bindingProfessional, ids.merchant, agents[2].id, ids.bindingOrdinary, agents[1].id],
  )
  await client.query(
    `INSERT INTO agent_platform_accounts (id, "createdAt", "updatedAt", agent_id, platform_type,
      platform_user_id, platform_nickname, account_no, bound_at, total_impressions, total_clicks, total_claims)
     VALUES ($1, '2026-08-22T02:00:00.000Z', '2026-09-01T02:00:00.000Z', $2, 'douyin', 'MOCK-DOUYIN-001',
      'MOCK-专业达人-苏苏', 'mock-account-001', '2026-08-22T02:00:00.000Z', 12800, 3200, 420)
     ON CONFLICT (id) DO UPDATE SET platform_nickname = EXCLUDED.platform_nickname,
      total_impressions = EXCLUDED.total_impressions, total_clicks = EXCLUDED.total_clicks, total_claims = EXCLUDED.total_claims`,
    [ids.platformAccount, agents[2].id],
  )
  await client.query(
    `INSERT INTO lifecycle_notes (id, "createdAt", "updatedAt", subject_type, subject_id, category,
      content, reason, created_by_name)
     VALUES ($1, '2026-09-01T02:00:00.000Z', '2026-09-01T02:00:00.000Z', 'creator', $2, 'operation',
      'MOCK：达人近期转化稳定，可继续扩大任务额度。', 'MOCK fixture', '本地测试管理员')
     ON CONFLICT (id) DO UPDATE SET content = EXCLUDED.content, reason = EXCLUDED.reason`,
    [ids.note, agents[2].id],
  )
}

async function main() {
  loadEnvFile(resolve(process.cwd(), '.env.local'))
  loadEnvFile(resolve(process.cwd(), '.env'))
  assert.notEqual(process.env.NODE_ENV, 'production', '禁止在生产环境写入 mock 数据')

  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USERNAME || 'ai_auto',
    password: process.env.DB_PASSWORD || 'ai_auto_dev',
    database: process.env.DB_NAME || 'ai_auto_dev',
  })
  await client.connect()
  try {
    await client.query('BEGIN')
    await upsertAgents(client)
    await upsertSupportingData(client)
    await client.query('COMMIT')
    console.log(`已写入 ${agents.length} 条分享员 mock 数据（固定前缀：MOCK-）`)
    console.log(`待审核分享员：${agents.filter((agent) => agent.auditStatus === 'pending').length}`)
    console.log(`详情测试达人 ID：${agents[2].id}`)
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    await client.end()
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
