type AdminLoginResponse = {
  access_token: string
  refresh_token: string
  expires_in: number
  token_type: string
  user: {
    id: string
    username: string
    realName: string | null
    role: 'admin'
    adminRole: string
  }
}

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api/v1'

export async function loginAdmin(username: string, password: string): Promise<AdminLoginResponse> {
  const response = await fetch(`${apiBaseUrl}/auth/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  const payload = (await response.json().catch(() => null)) as
    | AdminLoginResponse
    | { message?: string | string[] }
    | null

  if (!response.ok || !payload || !('access_token' in payload)) {
    const message = payload && 'message' in payload ? payload.message : undefined
    throw new Error(Array.isArray(message) ? message.join('；') : message ?? '管理员登录失败')
  }
  return payload
}

export function storeAdminSession(session: AdminLoginResponse) {
  window.localStorage.setItem('admin_access_token', session.access_token)
  window.localStorage.setItem('admin_refresh_token', session.refresh_token)
  window.localStorage.setItem('admin_user', JSON.stringify(session.user))
}

export function clearAdminSession() {
  window.localStorage.removeItem('admin_access_token')
  window.localStorage.removeItem('admin_refresh_token')
  window.localStorage.removeItem('admin_user')
}

export function hasAdminSession() {
  return Boolean(window.localStorage.getItem('admin_access_token'))
}
