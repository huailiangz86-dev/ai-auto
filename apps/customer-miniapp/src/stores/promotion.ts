import { defineStore } from 'pinia'
import {
  getPromotionPerformance,
  prepareCouponShare,
  recordCouponShare,
  recordReferral,
} from '../api/customer'
import { useAuthStore } from './auth'
import type { PromotionPerformance, ShareContext } from '../types/customer'

const REFERRAL_AGENT_KEY = 'pending_referral_agent_id'
const REFERRAL_ATTRIBUTION_KEY = 'pending_referral_attribution_id'

export const usePromotionStore = defineStore('customer-promotion', {
  state: () => ({
    pendingAgentId: uni.getStorageSync<string>(REFERRAL_AGENT_KEY) || '',
    attributionId: uni.getStorageSync<string>(REFERRAL_ATTRIBUTION_KEY) || '',
    shareContext: null as ShareContext | null,
    performance: null as PromotionPerformance | null,
    loading: false,
  }),
  actions: {
    async captureReferral(agentId?: string, couponId?: string) {
      if (!agentId) return
      this.pendingAgentId = agentId
      uni.setStorageSync(REFERRAL_AGENT_KEY, agentId)
      await this.ensureReferral(couponId)
    },
    async ensureReferral(couponId?: string) {
      if (!this.pendingAgentId || this.attributionId || !useAuthStore().isLoggedIn) return
      try {
        const result = await recordReferral(this.pendingAgentId, couponId)
        this.attributionId = result.attributionId
        uni.setStorageSync(REFERRAL_ATTRIBUTION_KEY, result.attributionId)
      } catch (error) {
        const message = error instanceof Error ? error.message : ''
        if (message.includes('自己的分享归属')) {
          this.clearReferral()
          return
        }
        throw error
      }
    },
    async prepareShare(customerCouponId: string, platform: 'wechat_friend' | 'wechat_moment') {
      if (!useAuthStore().isLoggedIn) {
        uni.navigateTo({ url: '/pages/login/index' })
        throw new Error('请先登录后再分享')
      }
      this.shareContext = await prepareCouponShare(customerCouponId, platform)
      return this.shareContext
    },
    async fetchPerformance() {
      if (!useAuthStore().isLoggedIn) return
      this.loading = true
      try {
        this.performance = await getPromotionPerformance()
      } finally {
        this.loading = false
      }
    },
    async recordShare(customerCouponId: string, platform: 'wechat_friend' | 'wechat_moment') {
      await recordCouponShare(customerCouponId, platform)
      await this.fetchPerformance()
    },
    clearReferral() {
      this.pendingAgentId = ''
      this.attributionId = ''
      uni.removeStorageSync(REFERRAL_AGENT_KEY)
      uni.removeStorageSync(REFERRAL_ATTRIBUTION_KEY)
    },
  },
})
