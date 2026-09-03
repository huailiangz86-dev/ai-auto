import { request } from './http'
import type {
  AuthSession,
  CouponDetail,
  CustomerCoupon,
  CustomerProfile,
  NearbyStore,
  Pagination,
  PromotionPerformance,
  ShareContext,
  ConfirmedCopywriting,
  CopywritingDraft,
  CreationPlatform,
  PosterResult,
  VideoJob,
  GamificationOverview,
  MysteryBoxResult,
  RewardProduct,
  CouponEvidence,
} from '../types/customer'

interface PageResult<T> {
  items: T[]
  pagination: Pagination
}

export const getNearbyCoupons = (params: {
  latitude?: number
  longitude?: number
  city?: string
  category?: string
  page?: number
  pageSize?: number
}) => request<PageResult<NearbyStore>>({ url: '/customer/discover/nearby', method: 'GET', params })

export const getMyCoupons = (params: { status?: string; page?: number; pageSize?: number } = {}) =>
  request<PageResult<CustomerCoupon>>({ url: '/customer/coupons', method: 'GET', params })

export const claimCoupon = (
  couponId: string,
  attributionId?: string,
  trackingConsent = false,
) =>
  request<CustomerCoupon>({
    url: '/customer/coupons/claim',
    method: 'POST',
    data: { couponId, attributionId, trackingConsent },
  })

export const getCouponEvidence = (customerCouponId: string) =>
  request<CouponEvidence>({ url: `/customer/coupons/${customerCouponId}/evidence`, method: 'GET' })

export const updateCouponEvidenceConsent = (customerCouponId: string, trackingConsent: boolean) =>
  request<CouponEvidence>({
    url: `/customer/coupons/${customerCouponId}/evidence-consent`,
    method: 'POST',
    data: { trackingConsent },
  })

export const getProfile = () =>
  request<CustomerProfile>({ url: '/customer/profile', method: 'GET' })

export const getCouponDetail = (couponId: string) =>
  request<CouponDetail>({ url: `/customer/coupons/${couponId}/detail`, method: 'GET' })

export const prepareCouponShare = (
  customerCouponId: string,
  platform: 'wechat_friend' | 'wechat_moment',
) =>
  request<ShareContext>({
    url: `/customer/shares/${customerCouponId}`,
    method: 'POST',
    data: { platform },
  })

export const recordCouponShare = (
  customerCouponId: string,
  platform: 'wechat_friend' | 'wechat_moment',
) =>
  request<{ shareCount: number }>({
    url: `/customer/shares/${customerCouponId}/record`,
    method: 'POST',
    data: { platform },
  })

export const recordReferral = (agentId: string, couponId?: string) =>
  request<{ attributionId: string; isNewLock: boolean }>({
    url: `/customer/shares/referrals/${agentId}`,
    method: 'POST',
    data: { couponId },
  })

export const getPromotionPerformance = () =>
  request<PromotionPerformance>({ url: '/customer/shares/performance', method: 'GET' })

export const generateCustomerCopywriting = (data: {
  couponId?: string
  campaignId?: string
  platform: CreationPlatform
  tone?: string
  count?: number
  keywords?: string
}) => request<CopywritingDraft>({ url: '/customer/ai-creation/copywriting/generate', method: 'POST', data })

export const confirmCustomerCopywriting = (data: {
  draftId: string
  selectedIndex: number
  editedCopy?: string
}) =>
  request<ConfirmedCopywriting>({
    url: '/customer/ai-creation/copywriting/confirm',
    method: 'POST',
    data,
  })

export const generateCustomerVideo = (data: {
  couponId?: string
  campaignId?: string
  platform: CreationPlatform
  durationSeconds?: number
}) => request<VideoJob>({ url: '/customer/ai-creation/video/generate', method: 'POST', data })

export const getCustomerVideoStatus = (contentId: string) =>
  request<VideoJob>({ url: `/customer/ai-creation/video/${contentId}/status`, method: 'GET' })

export const generateCustomerPoster = (data: {
  couponId?: string
  campaignId?: string
  platform: CreationPlatform
  style?: string
  colorScheme?: string
  variantCount?: number
}) => request<PosterResult>({ url: '/customer/ai-creation/poster/generate', method: 'POST', data })

export const getGamificationOverview = () => request<GamificationOverview>({ url: '/customer/gamification/overview', method: 'GET' })
export const getGamificationRewards = () => request<RewardProduct[]>({ url: '/customer/gamification/rewards', method: 'GET' })
export const openMysteryBox = () => request<MysteryBoxResult>({ url: '/customer/gamification/mystery-boxes/open', method: 'POST' })
export const redeemGamificationReward = (rewardProductId: string) => request<{ reward: RewardProduct; remainingPoints: number }>({ url: `/customer/gamification/rewards/${rewardProductId}/redeem`, method: 'POST' })

/**
 * 该端点在 API 契约中定义，由微信 code 换取 C 端专用 JWT。
 * 当前服务端尚未提供时，登录页会显示可操作的提示，而不是写入伪造令牌。
 */
export const miniProgramLogin = (code: string, phoneCode?: string) =>
  request<{
    access_token: string
    refresh_token: string
    expires_in: number
    customer_id: string
  }>({
    url: '/customer/auth/wechat/mini-login',
    method: 'POST',
    data: { code, phoneCode },
  }).then((data): AuthSession => ({
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
    customerId: data.customer_id,
  }))
