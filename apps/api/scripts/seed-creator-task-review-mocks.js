const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { resolve } = require('node:path')
const { Client } = require('pg')

/**
 * Seeds the operations workbench with safe, repeatable Creator Task fixtures.
 *
 * The fixture is intentionally local/demo-only. It creates one submitted task
 * for the review queue and one risk-held task with linked evidence, credits,
 * financial entries, audit records, and notifications.
 */
const MOCK_PASSWORD_HASH = '$2b$12$91FQCPBZ4doMK8cPW//eW.3hlV9MIg2yrane4Bp5xjtMULaynePr2'
const ids = {
  merchant: '00000000-0000-4000-8000-000000002201',
  admin: '00000000-0000-4000-8000-000000002202',
  reviewCreator: '00000000-0000-4000-8000-000000002101',
  riskCreator: '00000000-0000-4000-8000-000000002102',
  campaign: '00000000-0000-4000-8000-000000002301',
  reviewGrowthTask: '00000000-0000-4000-8000-000000002601',
  riskGrowthTask: '00000000-0000-4000-8000-000000002602',
  reviewPlan: '00000000-0000-4000-8000-000000002501',
  reviewTask: '00000000-0000-4000-8000-000000002701',
  riskTask: '00000000-0000-4000-8000-000000002702',
  reviewContent: '00000000-0000-4000-8000-000000002901',
  riskContent: '00000000-0000-4000-8000-000000002902',
  riskPublication: '00000000-0000-4000-8000-000000003001',
  reviewCreditAllocation: '00000000-0000-4000-8000-000000003101',
  reviewCreditConsumption: '00000000-0000-4000-8000-000000003102',
  riskCreditAllocation: '00000000-0000-4000-8000-000000003103',
  riskCreditConsumption: '00000000-0000-4000-8000-000000003104',
  reviewFinancial: '00000000-0000-4000-8000-000000003201',
  riskFinancial: '00000000-0000-4000-8000-000000003202',
  reviewAudit: '00000000-0000-4000-8000-000000003301',
  riskAudit: '00000000-0000-4000-8000-000000003302',
  reviewNotification: '00000000-0000-4000-8000-000000003401',
  riskNotification: '00000000-0000-4000-8000-000000003402',
  reviewPayout: '00000000-0000-4000-8000-000000003501',
  riskPayout: '00000000-0000-4000-8000-000000003502',
  platformRevenueSettled: '00000000-0000-4000-8000-000000003601',
  platformRevenuePending: '00000000-0000-4000-8000-000000003602',
  allocationCreatorPayout: '00000000-0000-4000-8000-000000003701',
  allocationCampaignCredits: '00000000-0000-4000-8000-000000003702',
  allocationRiskReserve: '00000000-0000-4000-8000-000000003703',
}

const timestamps = {
  campaignCreated: '2026-09-01T02:00:00.000Z',
  campaignUpdated: '2026-09-10T02:00:00.000Z',
  reviewTaskCreated: '2026-09-08T02:00:00.000Z',
  riskTaskCreated: '2026-09-07T02:00:00.000Z',
  reviewSubmitted: '2026-09-09T07:30:00.000Z',
  riskHeld: '2026-09-10T03:15:00.000Z',
  evidenceCreated: '2026-09-09T07:10:00.000Z',
  riskEvidenceCreated: '2026-09-08T08:20:00.000Z',
  riskPublished: '2026-09-08T10:00:00.000Z',
}

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

async function upsertBaseRecords(client) {
  await client.query(
    `INSERT INTO admins (id, "createdAt", "updatedAt", username, "passwordHash", "realName", role, status)
     VALUES ($1, '2026-09-01T02:00:00.000Z', '2026-09-10T02:00:00.000Z', 'mock_creator_task_operator', $2,
             '创作者任务 Mock 运营', 'super_admin', true)
     ON CONFLICT (id) DO UPDATE SET username = EXCLUDED.username, "passwordHash" = EXCLUDED."passwordHash",
       "realName" = EXCLUDED."realName", role = EXCLUDED.role, status = EXCLUDED.status`,
    [ids.admin, MOCK_PASSWORD_HASH],
  )
  await client.query(
    `INSERT INTO merchants (id, "createdAt", "updatedAt", business_name, phone, password_hash,
      business_type, industry_category, audit_status, status, subscription_status, contact_name, contact_phone, email)
     VALUES ($1, $2, $3, 'MOCK-创作者任务审核商户', '13800002201', $4, 'enterprise', '餐饮',
             'approved', true, 'active', 'Mock 运营', '13800002201', 'creator-task-review@mock.local')
     ON CONFLICT (id) DO UPDATE SET business_name = EXCLUDED.business_name, phone = EXCLUDED.phone,
       password_hash = EXCLUDED.password_hash, audit_status = EXCLUDED.audit_status, status = EXCLUDED.status,
       subscription_status = EXCLUDED.subscription_status, contact_name = EXCLUDED.contact_name,
       contact_phone = EXCLUDED.contact_phone, email = EXCLUDED.email`,
    [ids.merchant, timestamps.campaignCreated, timestamps.campaignUpdated, MOCK_PASSWORD_HASH],
  )

  const creators = [
    {
      id: ids.reviewCreator,
      phone: '18800002201',
      nickname: 'MOCK-待审核创作者-小夏',
      score: 72,
      level: 'silver',
      growthLevel: 3,
      region: '上海',
      categories: ['本地生活', '美食'],
    },
    {
      id: ids.riskCreator,
      phone: '18800002202',
      nickname: 'MOCK-风控暂停创作者-阿辰',
      score: 81,
      level: 'gold',
      growthLevel: 4,
      region: '杭州',
      categories: ['探店', '短视频'],
    },
  ]
  for (const creator of creators) {
    await client.query(
      `INSERT INTO sharing_agents (
        id, "createdAt", "updatedAt", phone, nickname, "passwordHash", audit_status, status,
        real_name_verified, level, agent_type, region, creator_categories, task_preferences,
        creator_growth_score, creator_growth_level, creator_score_breakdown, operation_tags
      ) VALUES ($1, '2026-08-20T02:00:00.000Z', '2026-09-10T02:00:00.000Z', $2, $3, $4,
        'approved', true, true, $5, 'professional_creator', $6, $7::jsonb,
        '{"preferredChannels":["douyin","xiaohongshu"],"maxActiveTasks":5}'::jsonb,
        $8, $9, '{"influence":78,"quality":84,"relevance":82,"conversion":76,"trust":85}'::jsonb,
        '["MOCK","运营工作台演示"]'::jsonb)
      ON CONFLICT (id) DO UPDATE SET phone = EXCLUDED.phone, nickname = EXCLUDED.nickname,
        "passwordHash" = EXCLUDED."passwordHash", audit_status = EXCLUDED.audit_status, status = EXCLUDED.status,
        real_name_verified = EXCLUDED.real_name_verified, level = EXCLUDED.level, agent_type = EXCLUDED.agent_type,
        region = EXCLUDED.region, creator_categories = EXCLUDED.creator_categories,
        task_preferences = EXCLUDED.task_preferences, creator_growth_score = EXCLUDED.creator_growth_score,
        creator_growth_level = EXCLUDED.creator_growth_level, creator_score_breakdown = EXCLUDED.creator_score_breakdown,
        operation_tags = EXCLUDED.operation_tags`,
      [
        creator.id,
        creator.phone,
        creator.nickname,
        MOCK_PASSWORD_HASH,
        creator.level,
        creator.region,
        JSON.stringify(creator.categories),
        creator.score,
        creator.growthLevel,
      ],
    )
  }
}

async function upsertCampaignAndGrowthTasks(client) {
  await client.query(
    `INSERT INTO campaigns (
      id, "createdAt", "updatedAt", merchant_id, campaign_name, campaign_type, campaign_status,
      start_at, end_at, target_audience, max_budget, frozen_budget, spent_budget, ai_generated,
      ai_description, description, total_impressions, total_clicks, total_claims, total_redemptions,
      total_commission_spent
    ) VALUES ($1, $2, $3, $4, 'MOCK-秋季本地生活转化活动', 'discount', 'active',
      '2026-09-01T02:00:00.000Z', '2026-09-30T15:59:59.000Z', 'new', 12000, 520, 1840, true,
      'AI 生成的本地生活创作者投放方案（Mock）', '用于创作者任务审核工作台演示。', 28400, 3620, 486, 74, 740)
    ON CONFLICT (id) DO UPDATE SET campaign_name = EXCLUDED.campaign_name,
      campaign_status = EXCLUDED.campaign_status, max_budget = EXCLUDED.max_budget,
      frozen_budget = EXCLUDED.frozen_budget, spent_budget = EXCLUDED.spent_budget,
      total_impressions = EXCLUDED.total_impressions, total_clicks = EXCLUDED.total_clicks,
      total_claims = EXCLUDED.total_claims, total_redemptions = EXCLUDED.total_redemptions,
      total_commission_spent = EXCLUDED.total_commission_spent`,
    [ids.campaign, timestamps.campaignCreated, timestamps.campaignUpdated, ids.merchant],
  )

  const growthTasks = [
    {
      id: ids.reviewGrowthTask,
      createdAt: timestamps.reviewTaskCreated,
      goalMetric: '新增核销订单',
      baseline: 40,
      target: 120,
      budget: 5000,
      compensation: 128,
      credits: 120,
      endAt: '2026-09-25T15:59:59.000Z',
    },
    {
      id: ids.riskGrowthTask,
      createdAt: timestamps.riskTaskCreated,
      goalMetric: '有效到店人数',
      baseline: 25,
      target: 90,
      budget: 4600,
      compensation: 168,
      credits: 200,
      endAt: '2026-09-22T15:59:59.000Z',
    },
  ]
  for (const task of growthTasks) {
    await client.query(
      `INSERT INTO growth_tasks (
        id, "createdAt", "updatedAt", merchant_id, campaign_id, goal_metric, baseline_value,
        target_value, budget, compensation_reserved, campaign_credits_reserved, start_at, end_at,
        acceptable_risk_boundary, acceptable_roi_boundary, status
      ) VALUES ($1, $2, $2, $3, $4, $5, $6, $7, $8, $9, $10, '2026-09-01T02:00:00.000Z', $11,
        '异常互动率超过 12% 或设备/IP 高度聚集时转人工复核', 1.5, 'active')
      ON CONFLICT (id) DO UPDATE SET goal_metric = EXCLUDED.goal_metric, baseline_value = EXCLUDED.baseline_value,
        target_value = EXCLUDED.target_value, budget = EXCLUDED.budget,
        compensation_reserved = EXCLUDED.compensation_reserved,
        campaign_credits_reserved = EXCLUDED.campaign_credits_reserved, end_at = EXCLUDED.end_at,
        acceptable_risk_boundary = EXCLUDED.acceptable_risk_boundary,
        acceptable_roi_boundary = EXCLUDED.acceptable_roi_boundary, status = EXCLUDED.status`,
      [
        task.id,
        task.createdAt,
        ids.merchant,
        ids.campaign,
        task.goalMetric,
        task.baseline,
        task.target,
        task.budget,
        task.compensation,
        task.credits,
        task.endAt,
      ],
    )
  }

  await client.query(
    `INSERT INTO growth_plans (
      id, "createdAt", "updatedAt", merchant_id, growth_task_id, campaign_id, goal_brief,
      title, status, alternatives, selected_option_id, ai_metadata, approved_at, approved_by
    ) VALUES ($1, '2026-09-01T02:00:00.000Z', '2026-09-10T02:00:00.000Z', $2, $3, $4,
      '通过创作者内容带来可验证的新增到店与核销。', 'MOCK-创作者投放资金计划', 'approved',
      '[]'::jsonb, NULL, '{"source":"mock-creator-task-review"}'::jsonb,
      '2026-09-01T03:00:00.000Z', $5)
    ON CONFLICT (id) DO UPDATE SET "updatedAt" = EXCLUDED."updatedAt", goal_brief = EXCLUDED.goal_brief,
      title = EXCLUDED.title, status = EXCLUDED.status, alternatives = EXCLUDED.alternatives,
      ai_metadata = EXCLUDED.ai_metadata, approved_at = EXCLUDED.approved_at, approved_by = EXCLUDED.approved_by`,
    [ids.reviewPlan, ids.merchant, ids.reviewGrowthTask, ids.campaign, ids.admin],
  )

  await client.query(
    `INSERT INTO campaign_budget_allocations (
      id, "createdAt", "updatedAt", merchant_id, growth_plan_id, growth_task_id, campaign_id,
      category, planned_amount, committed_amount, spent_amount, status, metadata
    ) VALUES
      ($1, '2026-09-01T03:05:00.000Z', '2026-09-10T02:00:00.000Z', $2, $3, $4, $5, 'creator_payout', 296, 296, 0, 'funded', '{"source":"mock"}'::jsonb),
      ($6, '2026-09-01T03:05:00.000Z', '2026-09-10T02:00:00.000Z', $2, $3, $4, $5, 'campaign_credits', 320, 320, 126, 'funded', '{"source":"mock"}'::jsonb),
      ($7, '2026-09-01T03:05:00.000Z', '2026-09-10T02:00:00.000Z', $2, $3, $4, $5, 'risk_reserve', 120, 120, 0, 'funded', '{"source":"mock"}'::jsonb)
    ON CONFLICT (id) DO UPDATE SET committed_amount = EXCLUDED.committed_amount,
      planned_amount = EXCLUDED.planned_amount, spent_amount = EXCLUDED.spent_amount,
      status = EXCLUDED.status, metadata = EXCLUDED.metadata`,
    [
      ids.allocationCreatorPayout,
      ids.merchant,
      ids.reviewPlan,
      ids.reviewGrowthTask,
      ids.campaign,
      ids.allocationCampaignCredits,
      ids.allocationRiskReserve,
    ],
  )
}

async function upsertCreatorTasks(client) {
  await client.query(
    `INSERT INTO creator_tasks (
      id, "createdAt", "updatedAt", growth_task_id, campaign_id, merchant_id, creator_id, channel,
      content_type, brief, deadline, base_reward, performance_reward, campaign_credits_allocated,
      campaign_credits_consumed, tracking_id, published_url, status, compensation_snapshot,
      compensation_locked_at, review_reason, reviewed_by, reviewed_at, risk_hold_reason,
      risk_hold_previous_status, state_reason, state_changed_by, state_changed_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'xiaohongshu', 'image_text',
      '围绕秋季双人套餐制作一篇真实探店图文：突出门店环境、套餐内容和到店核销方式，避免绝对化宣传。',
      '2026-09-15T15:59:59.000Z', 128, '{"qualityBonus":32,"performanceRate":0.08}'::jsonb, 120, 36,
      'mock-creator-review-001', NULL, 'submitted',
      '{"baseReward":128,"campaignCreditsAllocated":120,"source":"mock-creator-task-review"}'::jsonb,
      '2026-09-08T02:10:00.000Z', NULL, NULL, NULL, NULL, NULL,
      '创作者已提交内容，等待运营审核', $8, $3)
    ON CONFLICT (id) DO UPDATE SET "updatedAt" = EXCLUDED."updatedAt", brief = EXCLUDED.brief,
      deadline = EXCLUDED.deadline, base_reward = EXCLUDED.base_reward,
      performance_reward = EXCLUDED.performance_reward, campaign_credits_allocated = EXCLUDED.campaign_credits_allocated,
      campaign_credits_consumed = EXCLUDED.campaign_credits_consumed, tracking_id = EXCLUDED.tracking_id,
      published_url = EXCLUDED.published_url, status = EXCLUDED.status,
      compensation_snapshot = EXCLUDED.compensation_snapshot, compensation_locked_at = EXCLUDED.compensation_locked_at,
      review_reason = EXCLUDED.review_reason, reviewed_by = EXCLUDED.reviewed_by, reviewed_at = EXCLUDED.reviewed_at,
      risk_hold_reason = EXCLUDED.risk_hold_reason, risk_hold_previous_status = EXCLUDED.risk_hold_previous_status,
      state_reason = EXCLUDED.state_reason, state_changed_by = EXCLUDED.state_changed_by,
      state_changed_at = EXCLUDED.state_changed_at`,
    [
      ids.reviewTask,
      timestamps.reviewTaskCreated,
      timestamps.reviewSubmitted,
      ids.reviewGrowthTask,
      ids.campaign,
      ids.merchant,
      ids.reviewCreator,
      ids.reviewCreator,
    ],
  )

  await client.query(
    `INSERT INTO creator_tasks (
      id, "createdAt", "updatedAt", growth_task_id, campaign_id, merchant_id, creator_id, channel,
      content_type, brief, deadline, base_reward, performance_reward, campaign_credits_allocated,
      campaign_credits_consumed, tracking_id, published_url, status, compensation_snapshot,
      compensation_locked_at, review_reason, reviewed_by, reviewed_at, risk_hold_reason,
      risk_hold_previous_status, state_reason, state_changed_by, state_changed_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'douyin', 'short_video',
      '拍摄 30 秒门店探店视频，展示招牌菜和真实用餐体验，视频内需保留活动追踪口令。',
      '2026-09-13T15:59:59.000Z', 168, '{"qualityBonus":42,"performanceRate":0.1}'::jsonb, 200, 90,
      'mock-creator-risk-001', 'https://example.local/mock/creator-risk-001', 'risk_hold',
      '{"baseReward":168,"campaignCreditsAllocated":200,"source":"mock-creator-task-review"}'::jsonb,
      '2026-09-07T02:30:00.000Z', NULL, NULL, NULL, $8,
      'published', '风控暂停待复核', $9, $3)
    ON CONFLICT (id) DO UPDATE SET "updatedAt" = EXCLUDED."updatedAt", brief = EXCLUDED.brief,
      deadline = EXCLUDED.deadline, base_reward = EXCLUDED.base_reward,
      performance_reward = EXCLUDED.performance_reward, campaign_credits_allocated = EXCLUDED.campaign_credits_allocated,
      campaign_credits_consumed = EXCLUDED.campaign_credits_consumed, tracking_id = EXCLUDED.tracking_id,
      published_url = EXCLUDED.published_url, status = EXCLUDED.status,
      compensation_snapshot = EXCLUDED.compensation_snapshot, compensation_locked_at = EXCLUDED.compensation_locked_at,
      review_reason = EXCLUDED.review_reason, reviewed_by = EXCLUDED.reviewed_by, reviewed_at = EXCLUDED.reviewed_at,
      risk_hold_reason = EXCLUDED.risk_hold_reason, risk_hold_previous_status = EXCLUDED.risk_hold_previous_status,
      state_reason = EXCLUDED.state_reason, state_changed_by = EXCLUDED.state_changed_by,
      state_changed_at = EXCLUDED.state_changed_at`,
    [
      ids.riskTask,
      timestamps.riskTaskCreated,
      timestamps.riskHeld,
      ids.riskGrowthTask,
      ids.campaign,
      ids.merchant,
      ids.riskCreator,
      '检测到互动设备与其他任务存在聚集，已暂停结算并等待人工核查',
      ids.admin,
    ],
  )
}

async function upsertEvidence(client) {
  await client.query(
    `INSERT INTO contents (
      id, "createdAt", "updatedAt", agent_id, campaign_id, creator_task_id, content_type,
      target_platform, ai_request_id, ai_model, content_data, status, moderation_status,
      moderation_result, tracking_url, total_impressions, total_clicks, total_claims,
      input_tokens, output_tokens
    ) VALUES ($1, $2, $3, $4, $5, $6, 'creator_studio', 'xiaohongshu',
      'mock-creator-studio-review-001', 'mock-content-model-v1',
      '{"action":"brief_understood_and_draft_generated","title":"上海这家店的秋季双人套餐，适合周末约饭","body":"Mock：包含门店环境、套餐内容、到店核销步骤和适用时间。","qualityScore":91}'::jsonb,
      'ready', 'passed', '{"riskLevel":"low","score":0.03,"provider":"mock"}'::jsonb,
      'https://example.local/mock/creator-review-001', 0, 0, 0, 860, 420)
    ON CONFLICT (id) DO UPDATE SET "updatedAt" = EXCLUDED."updatedAt", content_data = EXCLUDED.content_data,
      status = EXCLUDED.status, moderation_status = EXCLUDED.moderation_status,
      moderation_result = EXCLUDED.moderation_result, tracking_url = EXCLUDED.tracking_url,
      total_impressions = EXCLUDED.total_impressions, total_clicks = EXCLUDED.total_clicks,
      total_claims = EXCLUDED.total_claims, input_tokens = EXCLUDED.input_tokens, output_tokens = EXCLUDED.output_tokens`,
    [
      ids.reviewContent,
      timestamps.evidenceCreated,
      timestamps.reviewSubmitted,
      ids.reviewCreator,
      ids.campaign,
      ids.reviewTask,
    ],
  )

  await client.query(
    `INSERT INTO contents (
      id, "createdAt", "updatedAt", agent_id, campaign_id, creator_task_id, content_type,
      target_platform, ai_request_id, ai_model, content_data, status, moderation_status,
      moderation_result, tracking_url, total_impressions, total_clicks, total_claims,
      input_tokens, output_tokens
    ) VALUES ($1, $2, $3, $4, $5, $6, 'creator_studio', 'douyin',
      'mock-creator-studio-risk-001', 'mock-content-model-v1',
      '{"action":"published_content_evidence","title":"杭州本地人都在吃的工作日晚餐","body":"Mock：已发布短视频，等待风控核查。","qualityScore":87}'::jsonb,
      'published', 'passed', '{"riskLevel":"medium","score":0.41,"provider":"mock"}'::jsonb,
      'https://example.local/mock/creator-risk-001', 18620, 2140, 318, 920, 510)
    ON CONFLICT (id) DO UPDATE SET "updatedAt" = EXCLUDED."updatedAt", content_data = EXCLUDED.content_data,
      status = EXCLUDED.status, moderation_status = EXCLUDED.moderation_status,
      moderation_result = EXCLUDED.moderation_result, tracking_url = EXCLUDED.tracking_url,
      total_impressions = EXCLUDED.total_impressions, total_clicks = EXCLUDED.total_clicks,
      total_claims = EXCLUDED.total_claims, input_tokens = EXCLUDED.input_tokens, output_tokens = EXCLUDED.output_tokens`,
    [
      ids.riskContent,
      timestamps.riskEvidenceCreated,
      timestamps.riskHeld,
      ids.riskCreator,
      ids.campaign,
      ids.riskTask,
    ],
  )

  await client.query(
    `INSERT INTO content_publications (
      id, "createdAt", "updatedAt", content_id, agent_id, platform, status, platform_post_id,
      platform_post_url, impressions, clicks, comments, shares, likes, published_at
    ) VALUES ($1, $2, $3, $4, $5, 'douyin', 'published', 'MOCK-DOUYIN-REVIEW-001',
      'https://example.local/mock/creator-risk-001', 18620, 2140, 96, 182, 1240, $2)
    ON CONFLICT (id) DO UPDATE SET "updatedAt" = EXCLUDED."updatedAt", status = EXCLUDED.status,
      platform_post_id = EXCLUDED.platform_post_id, platform_post_url = EXCLUDED.platform_post_url,
      impressions = EXCLUDED.impressions, clicks = EXCLUDED.clicks, comments = EXCLUDED.comments,
      shares = EXCLUDED.shares, likes = EXCLUDED.likes, published_at = EXCLUDED.published_at`,
    [
      ids.riskPublication,
      timestamps.riskPublished,
      timestamps.riskHeld,
      ids.riskContent,
      ids.riskCreator,
    ],
  )
}

async function upsertPayoutsAndPlatformRevenue(client) {
  await client.query(
    `INSERT INTO creator_task_payouts (
      id, "createdAt", "updatedAt", creator_task_id, creator_id, merchant_id, campaign_id,
      expected_amount, verified_amount, status, verification_evidence, verified_at, settle_at,
      settled_at, recovery_offset_amount, risk_hold_reason, risk_hold_previous_status,
      adjudicated_amount, adjudicated_at
    ) VALUES ($1, '2026-09-09T07:35:00.000Z', '2026-09-09T07:35:00.000Z', $2, $3, $4, $5,
      128, NULL, 'estimated', '{"source":"mock","stage":"pending_review"}'::jsonb, NULL, NULL,
      NULL, 0, NULL, NULL, NULL, NULL)
    ON CONFLICT (id) DO UPDATE SET expected_amount = EXCLUDED.expected_amount,
      verified_amount = EXCLUDED.verified_amount, status = EXCLUDED.status,
      verification_evidence = EXCLUDED.verification_evidence, verified_at = EXCLUDED.verified_at,
      settle_at = EXCLUDED.settle_at, settled_at = EXCLUDED.settled_at,
      recovery_offset_amount = EXCLUDED.recovery_offset_amount, risk_hold_reason = EXCLUDED.risk_hold_reason,
      risk_hold_previous_status = EXCLUDED.risk_hold_previous_status, adjudicated_amount = EXCLUDED.adjudicated_amount,
      adjudicated_at = EXCLUDED.adjudicated_at`,
    [ids.reviewPayout, ids.reviewTask, ids.reviewCreator, ids.merchant, ids.campaign],
  )

  await client.query(
    `INSERT INTO creator_task_payouts (
      id, "createdAt", "updatedAt", creator_task_id, creator_id, merchant_id, campaign_id,
      expected_amount, verified_amount, status, verification_evidence, verified_at, settle_at,
      settled_at, recovery_offset_amount, risk_hold_reason, risk_hold_previous_status,
      adjudicated_amount, adjudicated_at
    ) VALUES ($1, '2026-09-08T08:25:00.000Z', '2026-09-10T03:15:00.000Z', $2, $3, $4, $5,
      168, 168, 'risk_hold', '{"source":"mock","verifiedEvents":318,"riskSignals":["device_cluster","ip_cluster"]}'::jsonb,
      '2026-09-09T02:00:00.000Z', '2026-09-12', NULL, 0,
      '检测到互动设备与其他任务存在聚集，已暂停结算并等待人工核查', 'verified', NULL, NULL)
    ON CONFLICT (id) DO UPDATE SET expected_amount = EXCLUDED.expected_amount,
      verified_amount = EXCLUDED.verified_amount, status = EXCLUDED.status,
      verification_evidence = EXCLUDED.verification_evidence, verified_at = EXCLUDED.verified_at,
      settle_at = EXCLUDED.settle_at, settled_at = EXCLUDED.settled_at,
      recovery_offset_amount = EXCLUDED.recovery_offset_amount, risk_hold_reason = EXCLUDED.risk_hold_reason,
      risk_hold_previous_status = EXCLUDED.risk_hold_previous_status, adjudicated_amount = EXCLUDED.adjudicated_amount,
      adjudicated_at = EXCLUDED.adjudicated_at`,
    [ids.riskPayout, ids.riskTask, ids.riskCreator, ids.merchant, ids.campaign],
  )

  await client.query(
    `INSERT INTO platform_revenues (
      id, "createdAt", "updatedAt", revenue_type, amount, commission_id, subscription_id,
      merchant_id, agent_id, revenue_date, balance_before, balance_after, settled, settled_at,
      description, metadata
    ) VALUES
      ($1, '2026-09-08T04:00:00.000Z', '2026-09-08T04:00:00.000Z', 'commission_royalty', 740, NULL, NULL,
        $2, $3, '2026-09-08', 1000, 1740, true, '2026-09-09T02:00:00.000Z',
        'MOCK-已确认平台佣金收入', '{"source":"mock","campaignId":"00000000-0000-4000-8000-000000002301"}'::jsonb),
      ($4, '2026-09-10T04:00:00.000Z', '2026-09-10T04:00:00.000Z', 'commission_royalty', 168, NULL, NULL,
        $2, $5, '2026-09-10', 1740, 1908, false, NULL,
        'MOCK-待确认平台佣金收入', '{"source":"mock","campaignId":"00000000-0000-4000-8000-000000002301"}'::jsonb)
    ON CONFLICT (id) DO UPDATE SET amount = EXCLUDED.amount, settled = EXCLUDED.settled,
      settled_at = EXCLUDED.settled_at, balance_before = EXCLUDED.balance_before,
      balance_after = EXCLUDED.balance_after, description = EXCLUDED.description, metadata = EXCLUDED.metadata`,
    [
      ids.platformRevenueSettled,
      ids.merchant,
      ids.riskCreator,
      ids.platformRevenuePending,
      ids.reviewCreator,
    ],
  )
}

async function upsertLedgers(client) {
  const credits = [
    [
      ids.reviewCreditAllocation,
      ids.reviewTask,
      ids.reviewGrowthTask,
      'allocation',
      120,
      'mock-creator-review-allocation',
      { source: 'mock', purpose: 'creator_task_campaign_credits' },
    ],
    [
      ids.reviewCreditConsumption,
      ids.reviewTask,
      ids.reviewGrowthTask,
      'consumption',
      36,
      'mock-creator-review-studio',
      { source: 'mock', action: 'creator_studio_draft' },
    ],
    [
      ids.riskCreditAllocation,
      ids.riskTask,
      ids.riskGrowthTask,
      'allocation',
      200,
      'mock-creator-risk-allocation',
      { source: 'mock', purpose: 'creator_task_campaign_credits' },
    ],
    [
      ids.riskCreditConsumption,
      ids.riskTask,
      ids.riskGrowthTask,
      'consumption',
      90,
      'mock-creator-risk-video',
      { source: 'mock', action: 'creator_studio_video' },
    ],
  ]
  for (const [
    id,
    creatorTaskId,
    growthTaskId,
    entryType,
    amount,
    sourceReference,
    metadata,
  ] of credits) {
    await client.query(
      `INSERT INTO campaign_credit_ledger (
        id, "createdAt", "updatedAt", creator_task_id, growth_task_id, merchant_id, entry_type,
        amount, idempotency_key, source_reference, metadata
      ) VALUES ($1, '2026-09-09T08:00:00.000Z', '2026-09-09T08:00:00.000Z', $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
      ON CONFLICT (id) DO UPDATE SET entry_type = EXCLUDED.entry_type, amount = EXCLUDED.amount,
        idempotency_key = EXCLUDED.idempotency_key, source_reference = EXCLUDED.source_reference,
        metadata = EXCLUDED.metadata`,
      [
        id,
        creatorTaskId,
        growthTaskId,
        ids.merchant,
        entryType,
        amount,
        `mock:${sourceReference}`,
        sourceReference,
        JSON.stringify(metadata),
      ],
    )
  }

  const financialEntries = [
    [
      ids.reviewFinancial,
      ids.reviewTask,
      ids.reviewCreator,
      ids.reviewGrowthTask,
      128,
      'creator_payout_reserved',
      '创作者任务基础补偿已预留（Mock）',
      'mock-creator-review-payout',
    ],
    [
      ids.riskFinancial,
      ids.riskTask,
      ids.riskCreator,
      ids.riskGrowthTask,
      168,
      'creator_payout_reserved',
      '风控暂停任务基础补偿已冻结（Mock）',
      'mock-creator-risk-payout',
    ],
  ]
  for (const [
    id,
    creatorTaskId,
    creatorId,
    ,
    amount,
    entryType,
    description,
    sourceReference,
  ] of financialEntries) {
    await client.query(
      `INSERT INTO financial_ledger_entries (
        id, "createdAt", "updatedAt", classification, entry_type, amount, currency, merchant_id,
        campaign_id, creator_id, creator_task_id, source_reference, idempotency_key,
        recorded_by_admin_id, occurred_at, description, metadata
      ) VALUES ($1, '2026-09-09T08:05:00.000Z', '2026-09-09T08:05:00.000Z', 'cogs', $2, $3, 'CNY', $4,
        $5, $6, $7, $8, $9, $10, '2026-09-09T08:05:00.000Z', $11, '{"source":"mock"}'::jsonb)
      ON CONFLICT (id) DO UPDATE SET entry_type = EXCLUDED.entry_type, amount = EXCLUDED.amount,
        classification = EXCLUDED.classification, description = EXCLUDED.description,
        metadata = EXCLUDED.metadata, occurred_at = EXCLUDED.occurred_at`,
      [
        id,
        entryType,
        amount,
        ids.merchant,
        ids.campaign,
        creatorId,
        creatorTaskId,
        sourceReference,
        `mock:${sourceReference}`,
        ids.admin,
        description,
      ],
    )
  }
}

async function upsertAuditAndNotifications(client) {
  await client.query(
    `INSERT INTO audit_logs (
      id, "createdAt", "updatedAt", actor_type, actor_id, actor_name, action_type,
      action_description, target_type, target_id, target_name, before_state, after_state, metadata, result
    ) VALUES ($1, $2, $2, 'creator', $3, 'MOCK-待审核创作者-小夏', 'creator_task_transition',
      '创作者已提交任务，进入运营审核队列', 'creator_task', $4, 'MOCK-秋季双人套餐图文任务',
      '{"status":"creating"}'::jsonb, '{"status":"submitted"}'::jsonb,
      '{"source":"mock","reviewRequired":true}'::jsonb, 'success')
    ON CONFLICT (id) DO UPDATE SET action_description = EXCLUDED.action_description,
      target_id = EXCLUDED.target_id, before_state = EXCLUDED.before_state, after_state = EXCLUDED.after_state,
      metadata = EXCLUDED.metadata, result = EXCLUDED.result`,
    [ids.reviewAudit, timestamps.reviewSubmitted, ids.reviewCreator, ids.reviewTask],
  )

  await client.query(
    `INSERT INTO audit_logs (
      id, "createdAt", "updatedAt", actor_type, actor_id, actor_name, action_type,
      action_description, target_type, target_id, target_name, before_state, after_state, metadata, result
    ) VALUES ($1, $2, $2, 'admin', $3, '风控复核员', 'creator_task_risk_held',
      '创作者任务已进入风控暂停', 'creator_task', $4, 'MOCK-探店短视频风控任务',
      '{"status":"published"}'::jsonb, '{"status":"risk_hold"}'::jsonb,
      '{"source":"mock","reason":"互动设备聚集","payoutStatus":"risk_hold"}'::jsonb, 'success')
    ON CONFLICT (id) DO UPDATE SET action_description = EXCLUDED.action_description,
      target_id = EXCLUDED.target_id, before_state = EXCLUDED.before_state, after_state = EXCLUDED.after_state,
      metadata = EXCLUDED.metadata, result = EXCLUDED.result`,
    [ids.riskAudit, timestamps.riskHeld, ids.admin, ids.riskTask],
  )

  const notifications = [
    [
      ids.reviewNotification,
      ids.reviewCreator,
      ids.reviewTask,
      'creator_task_submitted',
      '任务已提交，等待运营审核',
      '你的秋季双人套餐图文任务已提交，运营会在工作日内完成审核。',
      { source: 'mock', status: 'submitted' },
    ],
    [
      ids.riskNotification,
      ids.riskCreator,
      ids.riskTask,
      'creator_task_risk_hold',
      '任务已暂停进行风控核查',
      '系统检测到互动设备存在聚集风险，任务和报酬暂时冻结，处理结果会通过通知同步。',
      { source: 'mock', status: 'risk_hold', reason: '互动设备聚集' },
    ],
  ]
  for (const [id, creatorId, taskId, type, title, body, metadata] of notifications) {
    await client.query(
      `INSERT INTO notifications (
        id, "createdAt", "updatedAt", recipient_id, recipient_role, type, title, body,
        target_type, target_id, metadata, read_at
      ) VALUES ($1, '2026-09-10T04:00:00.000Z', '2026-09-10T04:00:00.000Z', $2, 'agent', $3, $4, $5,
        'creator_task', $6, $7::jsonb, NULL)
      ON CONFLICT (id) DO UPDATE SET recipient_id = EXCLUDED.recipient_id, type = EXCLUDED.type,
        title = EXCLUDED.title, body = EXCLUDED.body, target_id = EXCLUDED.target_id,
        metadata = EXCLUDED.metadata, read_at = EXCLUDED.read_at`,
      [id, creatorId, type, title, body, taskId, JSON.stringify(metadata)],
    )
  }
}

async function main() {
  loadEnvFile(resolve(process.cwd(), '.env.local'))
  loadEnvFile(resolve(process.cwd(), '.env'))
  assert.notEqual(process.env.NODE_ENV, 'production', '禁止在生产环境写入创作者任务 mock 数据')

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
    await upsertBaseRecords(client)
    await upsertCampaignAndGrowthTasks(client)
    await upsertCreatorTasks(client)
    await upsertEvidence(client)
    await upsertPayoutsAndPlatformRevenue(client)
    await upsertLedgers(client)
    await upsertAuditAndNotifications(client)
    await client.query('COMMIT')
    console.log('已写入创作者任务审核 mock 数据（固定前缀：MOCK-）')
    console.log(`待审核队列任务：${ids.reviewTask}`)
    console.log(`风控暂停队列任务：${ids.riskTask}`)
    console.log('Mock 创作者密码：MockAgent123!')
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
