import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import * as bcrypt from 'bcrypt'
import { Client } from 'pg'

/**
 * Seeds clearly-labelled, idempotent local data for the two review queues:
 *
 * - Operations: one pending professional creator for the sharing-agent audit queue.
 * - Merchant: that pending creator's registered binding plus one approved creator
 *   already active with the same approved merchant.
 *
 * It is deliberately local-only and does not remove or alter unrelated records.
 */
const DEMO_PASSWORD = 'LocalDemo#2026'
const DEMO = {
  adminUsername: 'local_demo_operator',
  merchantPhone: '13900002001',
  pendingCreatorPhone: '18800002001',
  approvedCreatorPhone: '18800002002',
  pendingCreatorOpenid: 'wx_mock_creator_pending_20260911',
  approvedCreatorOpenid: 'wx_mock_creator_approved_20260911',
  pendingInviteCode: 'MOCK-PENDING-01',
  activeInviteCode: 'MOCK-ACTIVE-01',
}

function loadEnvFile(path: string) {
  try {
    for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*?)\s*$/)
      if (!match || match[1] in process.env) continue
      process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2')
    }
  } catch {
    // A shell-provided database configuration is also supported.
  }
}

async function firstId(client: Client, sql: string, params: unknown[]) {
  const result = await client.query<{ id: string }>(sql, params)
  return result.rows[0]?.id ?? null
}

async function ensureAdmin(client: Client, passwordHash: string) {
  let id = await firstId(client, 'SELECT id FROM admins WHERE username = $1 FOR UPDATE', [
    DEMO.adminUsername,
  ])
  if (id) {
    await client.query(
      `UPDATE admins
       SET "passwordHash" = $1, "realName" = '本地演示运营', role = 'super_admin', status = true,
           "updatedAt" = now()
       WHERE id = $2`,
      [passwordHash, id],
    )
  } else {
    id = randomUUID()
    await client.query(
      `INSERT INTO admins (id, username, "passwordHash", "realName", role, status)
       VALUES ($1, $2, $3, '本地演示运营', 'super_admin', true)`,
      [id, DEMO.adminUsername, passwordHash],
    )
  }
  return id
}

async function ensureMerchant(client: Client, passwordHash: string) {
  let id = await firstId(client, 'SELECT id FROM merchants WHERE phone = $1 FOR UPDATE', [
    DEMO.merchantPhone,
  ])
  if (id) {
    await client.query(
      `UPDATE merchants
       SET password_hash = $1, business_name = '本地演示商户（分享员管理）', audit_status = 'approved',
           status = true, subscription_status = 'active', "updatedAt" = now()
       WHERE id = $2`,
      [passwordHash, id],
    )
  } else {
    id = randomUUID()
    await client.query(
      `INSERT INTO merchants
        (id, business_name, phone, password_hash, business_type, industry_category, audit_status, status, subscription_status)
       VALUES ($1, '本地演示商户（分享员管理）', $2, $3, 'enterprise', '本地生活', 'approved', true, 'active')`,
      [id, DEMO.merchantPhone, passwordHash],
    )
  }
  return id
}

async function ensureCreator(
  client: Client,
  passwordHash: string,
  input: { phone: string; nickname: string; openid: string; auditStatus: 'pending' | 'approved'; growthLevel: number },
) {
  let id = await firstId(client, 'SELECT id FROM sharing_agents WHERE phone = $1 FOR UPDATE', [
    input.phone,
  ])
  if (id) {
    await client.query(
      `UPDATE sharing_agents
       SET "passwordHash" = $1, nickname = $2, wechat_openid = $3,
           wechat_unionid = $4, real_name_verified = $5,
           audit_status = $6::sharing_agents_audit_status_enum,
           status = true, agent_type = 'professional_creator', region = '上海',
           creator_categories = '["本地生活","短视频"]'::jsonb, creator_growth_level = $7,
           creator_growth_score = $8, "updatedAt" = now()
       WHERE id = $9`,
      [passwordHash, input.nickname, input.openid, `union_${input.openid}`, input.auditStatus === 'approved', input.auditStatus, input.growthLevel, input.auditStatus === 'approved' ? 88 : 0, id],
    )
  } else {
    id = randomUUID()
    await client.query(
      `INSERT INTO sharing_agents
       (id, phone, "passwordHash", nickname, wechat_openid, wechat_unionid, real_name_verified, audit_status, status, agent_type, region,
         creator_categories, creator_growth_score, creator_growth_level)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::sharing_agents_audit_status_enum, true, 'professional_creator', '上海',
               '["本地生活","短视频"]'::jsonb, $10, $9)`,
      [id, input.phone, passwordHash, input.nickname, input.openid, `union_${input.openid}`, input.auditStatus === 'approved', input.auditStatus, input.growthLevel, input.auditStatus === 'approved' ? 88 : 0],
    )
  }
  return id
}

async function ensureBinding(
  client: Client,
  input: {
    inviteCode: string
    merchantId: string
    agentId: string
    status: 'registered' | 'active'
    auditComment: string | null
  },
) {
  let id = await firstId(client, 'SELECT id FROM merchant_agent_bindings WHERE invite_code = $1 FOR UPDATE', [
    input.inviteCode,
  ])
  const auditStatus = input.status === 'active' ? 'approved' : 'pending'
  const auditedBy = input.status === 'active' ? input.merchantId : null
  const auditedAt = input.status === 'active' ? new Date() : null
  if (id) {
    await client.query(
      `UPDATE merchant_agent_bindings
       SET merchant_id = $1, agent_id = $2, binding_status = $3,
           audit_status = $4::merchant_agent_bindings_audit_status_enum, audit_comment = $5,
           audited_by = $6, audited_at = $7, bound_at = $7, "updatedAt" = now()
       WHERE id = $8`,
      [
        input.merchantId,
        input.agentId,
        input.status,
        auditStatus,
        input.auditComment,
        auditedBy,
        auditedAt,
        id,
      ],
    )
  } else {
    id = randomUUID()
    await client.query(
      `INSERT INTO merchant_agent_bindings
        (id, merchant_id, agent_id, invite_code, binding_status, audit_status, audit_comment, audited_by, audited_at, bound_at, invite_type, created_by)
       VALUES ($1, $2, $3, $4, $5, $6::merchant_agent_bindings_audit_status_enum, $7,
               $8, $9, $9, 'manual', $2)`,
      [
        id,
        input.merchantId,
        input.agentId,
        input.inviteCode,
        input.status,
        auditStatus,
        input.auditComment,
        auditedBy,
        auditedAt,
      ],
    )
  }
  return id
}

async function ensureCreatorContentDemo(client: Client, agentId: string) {
  let contentId = await firstId(
    client,
    'SELECT id FROM contents WHERE agent_id = $1 AND ai_request_id = $2 FOR UPDATE',
    [agentId, 'local-demo-creator-content-01'],
  )
  if (contentId) {
    await client.query(
      `UPDATE contents
       SET status = 'published'::contents_status_enum, moderation_status = 'passed',
           tracking_url = 'https://example.local/mock/creator-content-01',
           total_impressions = 12860, total_clicks = 846, total_claims = 173, "updatedAt" = now()
       WHERE id = $1`,
      [contentId],
    )
  } else {
    contentId = randomUUID()
    await client.query(
      `INSERT INTO contents
       (id, agent_id, ai_request_id, content_type, target_platform, status, moderation_status, content_data,
        tracking_url, total_impressions, total_clicks, total_claims)
       VALUES ($1, $2, 'local-demo-creator-content-01', 'video', 'douyin'::contents_target_platform_enum,
               'published'::contents_status_enum, 'passed', '{"title":"本地生活探店短视频（Mock）"}'::jsonb,
               'https://example.local/mock/creator-content-01', 12860, 846, 173)`,
      [contentId, agentId],
    )
  }

  const publicationId = await firstId(
    client,
    'SELECT id FROM content_publications WHERE content_id = $1 AND platform = $2::content_publications_platform_enum FOR UPDATE',
    [contentId, 'douyin'],
  )
  if (publicationId) {
    await client.query(
      `UPDATE content_publications
       SET status = 'published'::content_publications_status_enum, platform_post_id = 'mock-douyin-post-01',
           platform_post_url = 'https://example.local/mock/douyin-post-01', impressions = 12860, clicks = 846,
           comments = 39, shares = 68, likes = 512, published_at = now(), "updatedAt" = now()
       WHERE id = $1`,
      [publicationId],
    )
  } else {
    await client.query(
      `INSERT INTO content_publications
       (id, content_id, agent_id, platform, status, platform_post_id, platform_post_url,
        impressions, clicks, comments, shares, likes, published_at)
       VALUES ($1, $2, $3, 'douyin'::content_publications_platform_enum,
               'published'::content_publications_status_enum, 'mock-douyin-post-01',
               'https://example.local/mock/douyin-post-01', 12860, 846, 39, 68, 512, now())`,
      [randomUUID(), contentId, agentId],
    )
  }
  return contentId
}

async function main() {
  loadEnvFile(resolve(process.cwd(), '.env.local'))
  loadEnvFile(resolve(process.cwd(), '.env'))
  if ((process.env.NODE_ENV ?? 'development') === 'production') {
    throw new Error('此 mock 数据脚本只允许在本地/测试环境执行。')
  }

  const client = new Client({
    host: process.env.DB_HOST ?? '127.0.0.1',
    port: Number(process.env.DB_PORT ?? '5432'),
    user: process.env.DB_USERNAME ?? 'ai_auto',
    password: process.env.DB_PASSWORD ?? 'ai_auto_dev',
    database: process.env.DB_NAME ?? 'ai_auto_dev',
  })
  await client.connect()
  let stage = 'initialization'
  try {
    const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12)
    await client.query('BEGIN')
    stage = 'admin'
    const adminId = await ensureAdmin(client, passwordHash)
    stage = 'merchant'
    const merchantId = await ensureMerchant(client, passwordHash)
    stage = 'pending creator'
    const pendingCreatorId = await ensureCreator(client, passwordHash, {
      phone: DEMO.pendingCreatorPhone,
      nickname: '待审核达人·小鹿（本地 Mock）',
      openid: DEMO.pendingCreatorOpenid,
      auditStatus: 'pending',
      growthLevel: 1,
    })
    stage = 'approved creator'
    const approvedCreatorId = await ensureCreator(client, passwordHash, {
      phone: DEMO.approvedCreatorPhone,
      nickname: '已审核达人·阿柠（本地 Mock）',
      openid: DEMO.approvedCreatorOpenid,
      auditStatus: 'approved',
      growthLevel: 4,
    })
    stage = 'pending binding'
    const pendingBindingId = await ensureBinding(client, {
      inviteCode: DEMO.pendingInviteCode,
      merchantId,
      agentId: pendingCreatorId,
      status: 'registered',
      auditComment: null,
    })
    stage = 'active binding'
    const activeBindingId = await ensureBinding(client, {
      inviteCode: DEMO.activeInviteCode,
      merchantId,
      agentId: approvedCreatorId,
      status: 'active',
      auditComment: 'Mock：达人资质与商户合作关系均已审核通过',
    })
    stage = 'creator content'
    const contentId = await ensureCreatorContentDemo(client, approvedCreatorId)
    await client.query('COMMIT')
    console.log(
      JSON.stringify({
        ok: true,
        accounts: {
          admin: { username: DEMO.adminUsername, password: DEMO_PASSWORD },
          merchant: { phone: DEMO.merchantPhone, password: DEMO_PASSWORD },
        },
        pendingAgentAudit: { agentId: pendingCreatorId, phone: DEMO.pendingCreatorPhone, openid: DEMO.pendingCreatorOpenid },
        merchantBindings: {
          pending: { bindingId: pendingBindingId, status: 'registered' },
          approved: { bindingId: activeBindingId, status: 'active' },
        },
        creatorContent: { contentId, status: 'published', impressions: 12860, clicks: 846, claims: 173 },
      }),
    )
  } catch (error) {
    await client.query('ROLLBACK')
    throw new Error(`导入 ${stage} 数据失败：${error instanceof Error ? error.message : String(error)}`)
  } finally {
    await client.end()
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
