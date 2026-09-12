import { ApiError } from './dashboard'

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api/v1'

interface Envelope<T> {
  code?: number
  data?: T
  message?: string
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = window.localStorage.getItem('admin_access_token')
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  })
  const payload = (await response.json().catch(() => null)) as Envelope<T> | T | null
  if (!response.ok || !payload) {
    const message =
      payload && typeof payload === 'object' && 'message' in payload
        ? String(payload.message)
        : `请求失败（${response.status}）`
    throw new ApiError(message, response.status)
  }
  return typeof payload === 'object' && 'data' in payload && payload.data !== undefined
    ? payload.data
    : (payload as T)
}

export interface PageResult<T> {
  items: T[]
  pagination: { page: number; pageSize: number; total: number; totalPages: number }
}
export interface PendingMerchant {
  merchantId: string
  businessName: string
  contactName: string
  phone: string
  businessType: string
  industryCategory: string
  auditStatus: 'pending' | 'need_info'
  appliedAt: string
}
export interface PendingAgent {
  agentId: string
  phone: string
  nickname: string | null
  registeredAt: string
}
export interface FraudAlert {
  alertId: string
  type: string
  severity: string
  confidence: number
  status: string
  agentId: string | null
  merchantId: string | null
  redemptionId: string | null
  evidence: unknown
  createdAt: string
}
export const RISK_RULE_TRIGGER_TYPES = [
  'redemption_frequency',
  'redemption_rate',
  'self_redemption',
  'ip_clustering',
  'device_clustering',
  'commission_anomaly',
  'content_violation',
] as const
export const RISK_RULE_ACTIONS = [
  'create_alert',
  'manual_review',
  'freeze_commission',
  'pause_campaign',
  'restrict_relationship',
] as const
export interface RiskRule {
  id: string
  ruleKey: string
  name: string
  triggerType: (typeof RISK_RULE_TRIGGER_TYPES)[number]
  severity: 'critical' | 'warning' | 'notice'
  conditionConfig: {
    windowMinutes?: number
    threshold?: number
    multiplier?: number
    metric?: string
    scope?: string
  }
  actions: (typeof RISK_RULE_ACTIONS)[number][]
  description: string | null
  enabled: boolean
  version: number
  createdAt: string
  updatedAt: string
  updatedByAdminId: string | null
}
export interface Reconciliation {
  id: string
  type: string
  amount: number
  merchantId: string | null
  agentId: string | null
  date: string
  description: string | null
  settled: boolean
  settledAt: string | null
}
export interface FinanceReconciliationOverview {
  generatedAt: string
  definition: {
    internal: string
    merchant: string
    creator: string
    recovery: string
  }
  internal: {
    ledgerRevenue: number
    creatorPayoutCogs: number
    operatingCost: number
    riskReserve: number
    ledgerNetResult: number
    ledgerEntryCount: number
    platformRevenue: number
    platformRevenueSettled: number
    platformRevenuePending: number
    platformRevenuePendingCount: number
  }
  merchant: {
    summary: {
      merchants: number
      campaignCount: number
      plannedBudget: number
      committedBudget: number
      spentBudget: number
      budgetRemaining: number
      platformRevenue: number
      platformRevenuePending: number
    }
    items: FinanceMerchantReconciliation[]
  }
  creator: {
    summary: {
      creators: number
      taskCount: number
      pendingReviewCount: number
      expectedPayout: number
      verifiedPayout: number
      settledPayout: number
      heldPayout: number
      outstandingPayout: number
    }
    items: FinanceCreatorReconciliation[]
  }
  recovery: {
    adjudicationReceivable: number
    walletReceivable: number
    difference: number
    status: 'balanced' | 'attention'
  }
}
export interface FinanceMerchantReconciliation {
  merchantId: string
  merchantName: string
  campaignCount: number
  plannedBudget: number
  committedBudget: number
  spentBudget: number
  budgetRemaining: number
  platformRevenue: number
  platformRevenueSettled: number
  platformRevenuePending: number
  status: 'balanced' | 'pending' | 'exception'
}
export interface FinanceCreatorReconciliation {
  creatorId: string
  creatorName: string
  taskCount: number
  pendingReviewCount: number
  payoutCount: number
  expectedPayout: number
  verifiedPayout: number
  settledPayout: number
  heldPayout: number
  outstandingPayout: number
  status: 'balanced' | 'pending' | 'risk_hold'
}
export type FinancialClassification = 'revenue' | 'cogs' | 'operating_cost' | 'reserve'
export interface FinancialLedgerEntry {
  entryId: string
  classification: FinancialClassification
  entryType: string
  amount: number
  currency: string
  merchantId: string | null
  campaignId: string | null
  creatorId: string | null
  creatorTaskId: string | null
  sourceReference: string | null
  occurredAt: string
  description: string | null
  metadata: Record<string, unknown> | null
  recordedByAdminId: string | null
}
export interface CampaignEconomics {
  scope: { campaignId: string | null; merchantId: string | null }
  totals: {
    merchantGrowthRevenue: number
    creatorPayoutCogs: number
    operatingCost: number
    riskReserve: number
    grossProfit: number
    grossMargin: number | null
  }
  summary: {
    entryCount: number
    totalCost: number
    netResult: number
    byEntryType: Record<string, number>
  }
  entries: FinancialLedgerEntry[]
}
export interface ModerationContent {
  id: string
  type: string
  platform: string | null
  agentId: string
  creatorId: string
  merchantId: string | null
  campaignId: string | null
  creatorTaskId: string | null
  status: string
  moderationStatus: string
  moderationMessage: string | null
  content: Record<string, unknown> | null
  trackingUrl: string | null
  createdAt: string
}
export interface OperationAuditLog {
  id: string
  actorType: string
  actorId: string | null
  actorName: string | null
  actionType: string
  actionDescription: string
  targetType: string
  targetId: string | null
  targetName: string | null
  metadata: Record<string, unknown> | null
  createdAt: string
}

export const getPendingMerchants = () =>
  request<PageResult<PendingMerchant>>('/admin/merchants/pending')
export const approveMerchant = (id: string, comment?: string) =>
  request(`/admin/merchants/${id}/approve`, { method: 'POST', body: JSON.stringify({ comment }) })
export const rejectMerchant = (id: string, reason: string) =>
  request(`/admin/merchants/${id}/reject`, { method: 'POST', body: JSON.stringify({ reason }) })
export const getPendingAgents = () => request<PageResult<PendingAgent>>('/admin/agents/pending')
export const approveAgent = (id: string) =>
  request(`/admin/agents/${id}/approve`, { method: 'POST', body: '{}' })
export const rejectAgent = (id: string, reason: string) =>
  request(`/admin/agents/${id}/reject`, { method: 'POST', body: JSON.stringify({ reason }) })
export interface FraudAlertQuery {
  severity?: string
  status?: string
  alertType?: string
  merchantId?: string
  agentId?: string
  page?: number
  pageSize?: number
}
export const getFraudAlerts = (query: FraudAlertQuery = {}) =>
  request<{
    summary: Record<string, number>
    items: FraudAlert[]
    pagination: PageResult<FraudAlert>['pagination']
  }>(`/admin/fraud/alerts${queryString(query)}`)
export const resolveFraudAlert = (
  id: string,
  action: 'dismiss' | 'review' | 'freeze_commission',
  note?: string,
) =>
  request(`/admin/fraud/alerts/${id}/resolve`, {
    method: 'POST',
    body: JSON.stringify({ action, note }),
  })
export const getRiskRules = (query: { enabled?: boolean; triggerType?: string } = {}) =>
  request<{ items: RiskRule[]; summary: { total: number; enabled: number; disabled: number } }>(
    `/admin/risk-rules${queryString(query)}`,
  )
export const createRiskRule = (payload: {
  name: string
  ruleKey: string
  triggerType: RiskRule['triggerType']
  severity: RiskRule['severity']
  conditionConfig: RiskRule['conditionConfig']
  actions: RiskRule['actions']
  description?: string
  enabled?: boolean
}) => request<RiskRule>('/admin/risk-rules', { method: 'POST', body: JSON.stringify(payload) })
export const updateRiskRule = (
  id: string,
  payload: Partial<Parameters<typeof createRiskRule>[0]>,
) =>
  request<RiskRule>(`/admin/risk-rules/${id}`, { method: 'PATCH', body: JSON.stringify(payload) })
export const deleteRiskRule = (id: string) =>
  request(`/admin/risk-rules/${id}`, { method: 'DELETE' })
export const getReconciliations = () =>
  request<{ summary: { pendingAmount: number }; items: Reconciliation[] }>(
    '/admin/finance/reconciliations?status=pending',
  )
export const getFinanceReconciliationOverview = (
  query: { merchantId?: string; creatorId?: string } = {},
) =>
  request<FinanceReconciliationOverview>(
    `/admin/finance/reconciliation-overview${queryString(query)}`,
  )
export const settleReconciliation = (id: string) =>
  request(`/admin/finance/reconciliations/${id}/settle`, { method: 'POST', body: '{}' })
export const getCampaignEconomics = (query: Record<string, string | number | undefined> = {}) =>
  request<CampaignEconomics>(`/admin/finance/campaign-economics${queryString(query)}`)
export interface ModerationContentQuery {
  status?: string
  contentType?: string
  targetPlatform?: string
  merchantId?: string
  creatorId?: string
  campaignId?: string
  creatorTaskId?: string
  page?: number
  pageSize?: number
}
export const getModerationContents = (query: ModerationContentQuery = {}) =>
  request<PageResult<ModerationContent>>(
    `/admin/contents/moderation${queryString({ ...query, status: query.status || 'pending' })}`,
  )
export const moderateContent = (
  id: string,
  decision: 'passed' | 'flagged' | 'blocked',
  message?: string,
) =>
  request(`/admin/contents/${id}/moderation`, {
    method: 'POST',
    body: JSON.stringify({ decision, message }),
  })
export interface OperationAuditLogQuery {
  targetType?: string
  targetId?: string
  page?: number
  pageSize?: number
}
export const getOperationAuditLogs = (query: OperationAuditLogQuery = {}) =>
  request<PageResult<OperationAuditLog>>(`/admin/audit-logs${queryString(query)}`)

export interface CreatorTaskQueueItem {
  id: string
  growthTaskId: string
  campaignId: string | null
  merchantId: string
  creatorId: string
  channel: string
  contentType: string
  brief: string
  deadline: string
  status: string
  review: { reason: string | null; reviewedBy: string | null; reviewedAt: string | null }
  risk: {
    holdReason: string | null
    previousStatus: string | null
    resolutionReason: string | null
    changedBy: string | null
    changedAt: string | null
  }
  economics: {
    baseReward: number
    compensationLockedAt: string | null
    campaignCreditsAllocated: number
    campaignCreditsConsumed: number
    campaignCreditsRemaining: number
  }
  createdAt: string
  updatedAt: string
}
export interface CreatorTaskWorkbench {
  task: CreatorTaskQueueItem
  growthTask: {
    id: string
    status: string
    goalMetric: string
    budget: number
    compensationReserved: number
    campaignCreditsReserved: number
  } | null
  economics: {
    compensation: {
      baseReward: number
      lockedSnapshot: Record<string, unknown> | null
      lockedAt: string | null
    }
    campaignCredits: { allocated: number; consumed: number; remaining: number; ledger: unknown[] }
    financialEntries: unknown[]
  }
  evidence: {
    id: string
    contentType: string
    creatorStudioAction: string | null
    contentData: Record<string, unknown> | null
    createdAt: string
    publications: unknown[]
  }[]
  auditRecords: unknown[]
  notifications: unknown[]
}
export interface CreatorTaskAppeal {
  appealId: string
  creatorTaskId: string
  creatorId: string
  merchantId: string
  payoutId: string | null
  appellantType: 'creator' | 'merchant'
  target: 'task' | 'payout'
  status: 'open' | 'accepted' | 'rejected' | 'withdrawn'
  reason: string
  evidence: Record<string, unknown>
  resolution: string | null
  resolvedBy: string | null
  resolvedAt: string | null
  adjudicationDecision: 'uphold' | 'adjust_payout' | 'reverse_settlement' | null
  amountBefore: number | null
  amountAfter: number | null
  financialLedgerEntryIds: string[]
  createdAt: string
  updatedAt: string
  creator: {
    creatorId: string
    nickname: string | null
    phone: string
    realNameVerified: boolean
    auditStatus: string
    growthScore: number
    growthLevel: number
  } | null
  task: {
    id: string
    growthTaskId: string
    campaignId: string | null
    merchantId: string
    channel: string
    contentType: string
    brief: string
    deadline: string
    status: string
    baseReward: number
    reviewReason: string | null
    riskHoldReason: string | null
  } | null
  payout: {
    payoutId?: string
    status: string
    expectedAmount: number
    verifiedAmount: number | null
    verificationEvidence?: Record<string, unknown>
    verifiedAt?: string | null
    settleAt: string | null
    settledAt?: string | null
    adjudicatedAmount?: number | null
    adjudicatedAt?: string | null
  } | null
}
export type RecoveryRiskLevel = 'normal' | 'watch' | 'overdue' | 'critical'
export interface RecoveryReceivable {
  appealId: string
  creatorId: string
  creatorTaskId: string
  payoutId: string | null
  merchantId: string
  resolvedAt: string | null
  recoveryAmount: number
  recoveredAmount: number
  remainingAmount: number
  lastOffsetAt: string | null
  daysWithoutOffset: number
  risk: { level: RecoveryRiskLevel; daysWithoutOffset: number; recommendedAction: string }
  offsets: {
    ledgerEntryId: string
    amount: number
    occurredAt: string
    settlementPayoutId: string | null
  }[]
  wallet: {
    recoveryReceivableAmount: number
    availableBalance: number
    pendingSettlementBalance: number
  } | null
  creator: {
    nickname: string | null
    phone: string
    realNameVerified: boolean
    auditStatus: string
  } | null
}
export interface RecoveryReceivablesResult extends PageResult<RecoveryReceivable> {
  summary: {
    normal: number
    watch: number
    overdue: number
    critical: number
    outstandingAmount: number
  }
  policy: {
    offset: string
    thresholds: { watchDays: number; overdueDays: number; criticalDays: number }
    automatedAction: string
  }
}
export interface RecoveryReconciliation {
  reconciledAt: string
  walletReceivable: number
  adjudicationReceivable: number
  receivableDifference: number
  receivableMatches: boolean
  outstandingAdjudications: number
  settlementOffsets: {
    checkedPayouts: number
    matches: boolean
    mismatches: { payoutId: string; recordedOffset: number; payoutOffset: number }[]
  }
}
export interface CreatorTaskQueueQuery {
  creatorTaskId?: string
  campaignId?: string
  merchantId?: string
  creatorId?: string
  growthTaskId?: string
  status?: string
  page?: number
  pageSize?: number
}
export interface CreatorTaskAppealQuery {
  status?: 'all' | 'open' | 'accepted' | 'rejected' | 'withdrawn'
  target?: 'task' | 'payout'
  merchantId?: string
  creatorId?: string
  creatorTaskId?: string
  page?: number
  pageSize?: number
}
function queryString(query: object) {
  const params = new URLSearchParams()
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== '') params.set(key, String(value))
  })
  const result = params.toString()
  return result ? `?${result}` : ''
}
export const getCreatorTaskReviewQueue = (query: CreatorTaskQueueQuery = {}) =>
  request<PageResult<CreatorTaskQueueItem>>(
    `/admin/creator-tasks/review-queue${queryString(query)}`,
  )
export const getCreatorTaskRiskQueue = (query: CreatorTaskQueueQuery = {}) =>
  request<PageResult<CreatorTaskQueueItem>>(
    `/admin/creator-tasks/risk-hold-queue${queryString(query)}`,
  )
export const getCreatorTaskWorkbench = (id: string) =>
  request<CreatorTaskWorkbench>(`/admin/creator-tasks/${id}/workbench`)
export const reviewCreatorTask = (id: string, decision: 'approve' | 'reject', reason: string) =>
  request(`/admin/creator-tasks/${id}/review`, {
    method: 'POST',
    body: JSON.stringify({ decision, reason }),
  })
export const resolveCreatorTaskRisk = (
  id: string,
  action: 'resume' | 'violation',
  reason: string,
) =>
  request(`/admin/creator-tasks/${id}/risk-resolution`, {
    method: 'POST',
    body: JSON.stringify({ action, reason }),
  })
export const getCreatorTaskAppeals = (query: CreatorTaskAppealQuery = {}) =>
  request<
    PageResult<CreatorTaskAppeal> & {
      summary: Record<'open' | 'accepted' | 'rejected' | 'withdrawn' | 'total', number>
    }
  >(`/admin/creator-tasks/appeals${queryString(query)}`)
export const getRecoveryReceivables = (
  query: {
    creatorId?: string
    riskLevel?: 'all' | Exclude<RecoveryRiskLevel, 'normal'>
    page?: number
    pageSize?: number
  } = {},
) =>
  request<RecoveryReceivablesResult>(
    `/admin/creator-tasks/recovery-receivables${queryString(query)}`,
  )
export const getRecoveryReconciliation = () =>
  request<RecoveryReconciliation>('/admin/creator-tasks/recovery-reconciliation')
export const resolveCreatorTaskAppeal = (
  id: string,
  decision: 'uphold' | 'adjust_payout' | 'reverse_settlement',
  resolution: string,
  adjustedAmount?: number,
) =>
  request<CreatorTaskAppeal>(`/admin/creator-tasks/appeals/${id}/resolve`, {
    method: 'POST',
    body: JSON.stringify({ decision, resolution, adjustedAmount }),
  })
export interface PilotOperationsMetrics {
  activatedCampaigns: number
  merchants: number
  repeatCampaignRate: number
  budgetExpansionRate: number
  validTaskAcceptanceRate: number
  measurableCampaignShare: number
  counts: {
    repeatMerchants: number
    expandedMerchants: number
    invited: number
    accepted: number
    measurableCampaigns: number
  }
}
export interface PilotWeeklyEvidence {
  week: { startAt: string; endAt: string }
  summary: {
    campaigns: number
    preRegisteredCampaigns: number
    consented: number
    claimed: number
    redeemed: number
    creatorPayouts: number
    reports: number
    acceptedCreatorTasks: number
    discrepancyCount: number
  }
  discrepancies: {
    redemptionId: string
    campaignId: string | null
    transactionAmount: number
    consentedAt: string | null
    claimedAt: string | null
    verifiedAt: string
    creatorId: string | null
    creatorPayout: { payoutId: string; status: string; amount: number } | null
    reportIncluded: boolean
    missingStages: string[]
  }[]
}
export const getPilotOperationsMetrics = () =>
  request<PilotOperationsMetrics>('/admin/pilot-instrumentation/operations-metrics')
export const getPilotWeeklyEvidence = () =>
  request<PilotWeeklyEvidence>('/admin/pilot-instrumentation/weekly-evidence')
