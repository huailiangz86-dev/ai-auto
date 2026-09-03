const base = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:3000/api/v1'
export const merchantAuthExpiredEvent = 'merchant-auth-expired'
export type Session = { access_token: string; refresh_token: string; user: { businessName?: string } }
export async function api<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('merchant_access_token')
  const response = await fetch(`${base}${path}`, { ...options, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers } })
  const value = await response.json().catch(() => null)
  if (response.status === 401) {
    clearSession()
    window.dispatchEvent(new Event(merchantAuthExpiredEvent))
  }
  if (!response.ok) throw new Error(value?.message ?? `请求失败（${response.status}）`)
  return value?.data ?? value
}
export const setSession = (session: Session) => { localStorage.setItem('merchant_access_token', session.access_token); localStorage.setItem('merchant_refresh_token', session.refresh_token); localStorage.setItem('merchant_user', JSON.stringify(session.user)) }
export const clearSession = () => ['merchant_access_token', 'merchant_refresh_token', 'merchant_user'].forEach((key) => localStorage.removeItem(key))
