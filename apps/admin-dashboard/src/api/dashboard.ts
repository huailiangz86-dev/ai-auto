export type TrendPoint = { date: string; value: number }

export type DashboardData = {
  generatedAt: string
  date: string
  scope: { level: 'platform' | 'merchant' | 'agent'; merchantId: string | null; agentId: string | null }
  today: {
    newMerchants: number
    activeAgents: number
    redemptions: number
    gmv: number
    platformRevenue: number
    commissionPayout: number
  }
  total: { merchants: number; agents: number; cumulativeGmv: number; cumulativeRevenue: number }
  monthly: {
    newMerchants: number
    newAgents: number
    subscriptionRenewalRate: number
    agentRetentionRate: number
  }
  trends: {
    gmv: TrendPoint[]
    agentGrowth: TrendPoint[]
    commissionPayout: TrendPoint[]
    merchantRetention: TrendPoint[]
  }
  alerts: {
    summary: { critical: number; warning: number; notice: number; paymentFailures: number; systemErrors: number }
    items: DashboardAlert[]
  }
  pendingActions: PendingAction[]
  refresh: { kpiSeconds: number; detail: string }
}

export type DashboardAlert = {
  id: string
  category: string
  type: string
  severity: 'critical' | 'warning' | 'notice'
  status: string
  occurredAt: string
  evidence: string[] | Record<string, unknown> | null
}

export type PendingAction = {
  type: 'fraud_alert' | 'merchant_audit' | 'agent_audit' | 'content_moderation'
  count: number
  action: string
}

export type DashboardQuery = { merchantId?: string; agentId?: string; trendDays: number }
export type MerchantDashboardAgent = { id: string; nickname: string | null; phone: string }

type ApiEnvelope<T> = { code: number; data: T; message?: string }

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api/v1'

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
    this.name = 'ApiError'
  }
}

export async function getDashboard(query: DashboardQuery): Promise<DashboardData> {
  const search = new URLSearchParams({ trendDays: String(query.trendDays) })
  if (query.merchantId) search.set('merchantId', query.merchantId)
  if (query.agentId) search.set('agentId', query.agentId)

  const token = window.localStorage.getItem('admin_access_token')
  const response = await fetch(`${apiBaseUrl}/admin/dashboard?${search.toString()}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  })
  const payload = (await response.json().catch(() => null)) as ApiEnvelope<DashboardData> | null

  if (!response.ok || !payload || payload.code !== 0) {
    throw new ApiError(payload?.message ?? `大屏数据请求失败（${response.status}）`, response.status)
  }
  return payload.data
}

export async function getMerchantDashboardAgents(merchantId: string): Promise<MerchantDashboardAgent[]> {
  const token = window.localStorage.getItem('admin_access_token')
  const response = await fetch(`${apiBaseUrl}/admin/dashboard/merchants/${encodeURIComponent(merchantId)}/agents`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  })
  const payload = (await response.json().catch(() => null)) as ApiEnvelope<MerchantDashboardAgent[]> | null
  if (!response.ok || !payload || payload.code !== 0) {
    throw new ApiError(payload?.message ?? `分享员下钻选项请求失败（${response.status}）`, response.status)
  }
  return payload.data
}
