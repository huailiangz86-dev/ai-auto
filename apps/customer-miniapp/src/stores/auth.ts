import { defineStore } from 'pinia'
import { getProfile, miniProgramLogin } from '../api/customer'
import type { AuthSession, CustomerProfile } from '../types/customer'

const ACCESS_TOKEN_KEY = 'customer_access_token'
const REFRESH_TOKEN_KEY = 'customer_refresh_token'

export const useAuthStore = defineStore('customer-auth', {
  state: () => ({
    session: null as AuthSession | null,
    profile: null as CustomerProfile | null,
    initialized: false,
  }),
  getters: {
    isLoggedIn: (state) => Boolean(state.session?.accessToken),
  },
  actions: {
    restoreSession() {
      const accessToken = uni.getStorageSync<string>(ACCESS_TOKEN_KEY)
      const refreshToken = uni.getStorageSync<string>(REFRESH_TOKEN_KEY)
      if (accessToken) this.session = { accessToken, refreshToken, expiresIn: 0, customerId: '' }
      this.initialized = true
    },
    saveSession(session: AuthSession) {
      this.session = session
      uni.setStorageSync(ACCESS_TOKEN_KEY, session.accessToken)
      uni.setStorageSync(REFRESH_TOKEN_KEY, session.refreshToken)
    },
    clearSession() {
      this.session = null
      this.profile = null
      uni.removeStorageSync(ACCESS_TOKEN_KEY)
      uni.removeStorageSync(REFRESH_TOKEN_KEY)
    },
    async login(phoneCode?: string) {
      const result = await new Promise<UniApp.LoginRes>((resolve, reject) => {
        uni.login({ provider: 'weixin', success: resolve, fail: reject })
      })
      const session = await miniProgramLogin(result.code, phoneCode)
      this.saveSession(session)
      await this.fetchProfile()
    },
    async fetchProfile() {
      if (!this.isLoggedIn) return
      this.profile = await getProfile()
    },
  },
})
