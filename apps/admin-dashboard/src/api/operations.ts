import { ApiError } from './dashboard'

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api/v1'

type Envelope<T> = { code?: number; data?: T; message?: string }

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
    ? (payload.data as T)
    : (payload as T)
}

export type PageResult<T> = {
  items: T[]
  pagination: { page: number; pageSize: number; total: number; totalPages: number }
}
export type PendingMerchant = {
  merchantId: string
  businessName: string
  contactName: string
  phone: string
  businessType: string
  industryCategory: string
  appliedAt: string
}
export type PendingAgent = {
  agentId: string
  phone: string
  nickname: string | null
  registeredAt: string
}
export type FraudAlert = {
  alertId: string
  type: string
  severity: string
  confidence: number
  status: string
  evidence: unknown
  createdAt: string
}
export type Reconciliation = {
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
export type ModerationContent = {
  id: string
  type: string
  platform: string | null
  agentId: string
  status: string
  moderationStatus: string
  content: Record<string, unknown> | null
  trackingUrl: string | null
  createdAt: string
}
export type OperationAuditLog = {
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
export const getFraudAlerts = () =>
  request<{ summary: Record<string, number>; items: FraudAlert[] }>('/admin/fraud/alerts')
export const resolveFraudAlert = (
  id: string,
  action: 'dismiss' | 'review' | 'freeze_commission',
  note?: string,
) =>
  request(`/admin/fraud/alerts/${id}/resolve`, {
    method: 'POST',
    body: JSON.stringify({ action, note }),
  })
export const getReconciliations = () =>
  request<{ summary: { pendingAmount: number }; items: Reconciliation[] }>(
    '/admin/finance/reconciliations?status=pending',
  )
export const settleReconciliation = (id: string) =>
  request(`/admin/finance/reconciliations/${id}/settle`, { method: 'POST', body: '{}' })
export const getModerationContents = () =>
  request<PageResult<ModerationContent>>('/admin/contents/moderation?status=pending')
export const moderateContent = (
  id: string,
  decision: 'passed' | 'flagged' | 'blocked',
  message?: string,
) =>
  request(`/admin/contents/${id}/moderation`, {
    method: 'POST',
    body: JSON.stringify({ decision, message }),
  })
export const getOperationAuditLogs = () =>
  request<PageResult<OperationAuditLog>>('/admin/audit-logs')

export type CreatorTaskQueueItem = {
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
export type CreatorTaskWorkbench = {
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
  evidence: Array<{
    id: string
    contentType: string
    creatorStudioAction: string | null
    contentData: Record<string, unknown> | null
    createdAt: string
    publications: unknown[]
  }>
  auditRecords: unknown[]
  notifications: unknown[]
}
export type CreatorTaskQueueQuery = {
  campaignId?: string
  merchantId?: string
  creatorId?: string
  growthTaskId?: string
  status?: string
  page?: number
  pageSize?: number
}
function queryString(query: CreatorTaskQueueQuery) {
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
export type PilotOperationsMetrics = {
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
export type PilotWeeklyEvidence = {
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
  discrepancies: Array<{
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
  }>
}
export const getPilotOperationsMetrics = () =>
  request<PilotOperationsMetrics>('/admin/pilot-instrumentation/operations-metrics')
export const getPilotWeeklyEvidence = () =>
  request<PilotWeeklyEvidence>('/admin/pilot-instrumentation/weekly-evidence')
