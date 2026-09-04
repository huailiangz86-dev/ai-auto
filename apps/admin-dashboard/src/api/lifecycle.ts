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
  if (!response.ok || !payload)
    throw new ApiError(
      payload && typeof payload === 'object' && 'message' in payload
        ? String(payload.message)
        : `请求失败（${response.status}）`,
      response.status,
    )
  return typeof payload === 'object' && 'data' in payload && payload.data !== undefined
    ? payload.data
    : (payload as T)
}

export interface LifecyclePage<T> {
  items: T[]
  pagination: { page: number; pageSize: number; total: number; totalPages: number }
}
export interface MerchantLifecycle {
  id: string
  businessName: string
  phone: string
  contactName: string | null
  administratorContact: { name: string | null; phone: string; email: string | null }
  industryCategory: string | null
  auditStatus: string
  subscriptionStatus: string
  status: 'active' | 'frozen'
  frozenAt: string | null
  frozenReason: string | null
  tags: string[]
  summary: {
    activity: { campaigns: number; activeCampaigns: number }
    budget: { planned: number; spent: number }
    settlement: { gmv: number; redemptions: number; commission: number }
  }
}
export interface CreatorLifecycle {
  id: string
  nickname: string | null
  phone: string
  auditStatus: string
  agentType: 'professional_creator' | 'ordinary_user'
  realNameVerified: boolean
  level: string
  growthScore: number
  growthLevel: number
  categories: string[]
  status: 'active' | 'frozen' | 'blacklisted'
  frozenAt: string | null
  frozenReason: string | null
  blacklistReason: string | null
  taskLimit: number | null
  tags: string[]
  summary: {
    taskPerformance: { total: number; completed: number; fulfillmentRate: number; current: number }
    conversion: { redemptions: number; commissionEarned: number }
    publishing: { published: number; total: number }
  }
}
export interface LifecycleRelationship {
  id: string
  merchant: { id: string; businessName: string }
  creator: { id: string; nickname: string | null; phone: string } | null
  bindingStatus: 'pending' | 'registered' | 'active' | 'rejected' | 'unbound' | string
  restrictedAt: string | null
  restrictionReason: string | null
  boundAt: string | null
  unboundAt: string | null
  cooperationQuality: { score: number | null; completed: number; total: number }
}
export interface LifecycleDetail {
  profile: MerchantLifecycle | CreatorLifecycle
  summary: Record<string, unknown>
  notes: {
    id: string
    category: string
    content: string
    reason: string | null
    followUpAt: string | null
    createdAt: string
  }[]
  relationships: LifecycleRelationship[]
  audit: {
    id: string
    actionDescription: string
    createdAt: string
    metadata: Record<string, unknown> | null
  }[]
}
const qs = (query: Record<string, string | number | undefined>) => {
  const params = new URLSearchParams()
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== '') params.set(key, String(value))
  })
  return params.toString() ? `?${params.toString()}` : ''
}
export const getLifecycleMerchants = (query: Record<string, string | number | undefined> = {}) =>
  request<LifecyclePage<MerchantLifecycle>>(`/admin/lifecycle/merchants${qs(query)}`)
export const getLifecycleMerchant = (id: string) =>
  request<LifecycleDetail>(`/admin/lifecycle/merchants/${id}`)
export const getLifecycleCreators = (query: Record<string, string | number | undefined> = {}) =>
  request<LifecyclePage<CreatorLifecycle>>(`/admin/lifecycle/creators${qs(query)}`)
export const getLifecycleCreator = (id: string) =>
  request<LifecycleDetail>(`/admin/lifecycle/creators/${id}`)
export const setCreatorType = (id: string, agentType: CreatorLifecycle['agentType']) =>
  request(`/admin/lifecycle/creators/${id}/type`, {
    method: 'POST',
    body: JSON.stringify({ agentType }),
  })
export const freezeLifecycleSubject = (
  kind: 'merchants' | 'creators',
  id: string,
  reason: string,
) =>
  request(`/admin/lifecycle/${kind}/${id}/freeze`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  })
export const restoreLifecycleSubject = (
  kind: 'merchants' | 'creators',
  id: string,
  reason?: string,
) =>
  request(`/admin/lifecycle/${kind}/${id}/restore`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  })
export const setLifecycleTags = (kind: 'merchants' | 'creators', id: string, tags: string[]) =>
  request(`/admin/lifecycle/${kind}/${id}/tags`, { method: 'POST', body: JSON.stringify({ tags }) })
export const addLifecycleNote = (
  kind: 'merchants' | 'creators',
  id: string,
  payload: { category: string; content: string; reason?: string },
) =>
  request(`/admin/lifecycle/${kind}/${id}/notes`, { method: 'POST', body: JSON.stringify(payload) })
export const notifyLifecycleSubject = (
  kind: 'merchants' | 'creators',
  id: string,
  title: string,
  body: string,
) =>
  request(`/admin/lifecycle/${kind}/${id}/notifications`, {
    method: 'POST',
    body: JSON.stringify({ title, body }),
  })
export const setCreatorTaskLimit = (id: string, limit: number | null) =>
  request(`/admin/lifecycle/creators/${id}/task-limit`, {
    method: 'POST',
    body: JSON.stringify(limit === null ? {} : { limit }),
  })
export const getLifecycleRelationships = (
  query: { merchantId?: string; creatorId?: string } = {},
) => request<LifecycleRelationship[]>(`/admin/lifecycle/relationships${qs(query)}`)
export const restrictLifecycleRelationship = (id: string, reason: string) =>
  request(`/admin/lifecycle/relationships/${id}/restrict`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  })
export const releaseLifecycleRelationship = (id: string, reason?: string) =>
  request(`/admin/lifecycle/relationships/${id}/release`, {
    method: 'POST',
    body: JSON.stringify(reason ? { reason } : {}),
  })
export const unbindLifecycleRelationship = (id: string, reason: string) =>
  request(`/admin/lifecycle/relationships/${id}/unbind`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  })
