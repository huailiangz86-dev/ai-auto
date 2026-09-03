export type CouponStatus = 'active' | 'used' | 'expired'

export interface CouponSummary {
  couponId: string
  couponName: string
  couponType: string
  discountAmount?: number | null
  thresholdAmount?: number | null
  cashRewardAmount?: number | null
  validUntil?: string | null
  totalIssued?: number
}

export interface NearbyStore {
  storeId: string
  storeName: string
  merchantId: string
  merchantName: string
  city?: string | null
  district?: string | null
  addressDetail?: string | null
  contactPhone?: string | null
  businessHours?: string | null
  distance?: number | null
  coupons: CouponSummary[]
}

export interface CustomerCoupon {
  customerCouponId: string
  couponId: string
  couponCode: string
  couponName: string
  merchantName?: string
  discountAmount?: number | null
  thresholdAmount?: number | null
  status: CouponStatus
  claimedAt: string
  usedAt?: string | null
  expireAt?: string | null
  expiredAt?: string | null
}

export interface Pagination {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export interface CustomerProfile {
  customerId: string
  nickname?: string | null
  avatar?: string | null
  phone?: string | null
  city?: string | null
  totalRedemptions: number
  totalSpend: number
}

export interface CouponEvidenceEvent {
  type: string
  occurredAt: string
  status: 'recorded' | 'verified'
  label: string
}

export interface CouponEvidence {
  customerCouponId: string
  coupon: { name: string; code: string; status: CouponStatus }
  privacy: {
    trackingConsent: boolean
    consentVersion?: string | null
    consentedAt?: string | null
    revokedAt?: string | null
    notice: string
  }
  traceability: { attributionLinked: boolean; verified: boolean; accountingRetention?: string | null }
  events: CouponEvidenceEvent[]
}

export interface AuthSession {
  accessToken: string
  refreshToken: string
  expiresIn: number
  customerId: string
}

export interface ShareContext {
  agentId: string
  customerCouponId: string
  sharePath: string
  isNewAgent: boolean
}

export interface PromotionPerformance {
  isAgent: boolean
  agentId: string | null
  shareCount: number
  invitedCustomers: number
  redemptions: number
  estimatedCommission: number
  totalEarned: number
}

export interface CouponDetail {
  couponId: string
  couponName: string
  couponType: string
  discountAmount?: number | null
  thresholdAmount?: number | null
  cashRewardAmount?: number | null
  validFrom?: string | null
  validUntil?: string | null
  merchantId: string
}

export type CreationPlatform = 'wechat' | 'douyin' | 'xiaohongshu' | 'video_account' | 'kuaishou'

export interface CopywritingOption {
  index: number
  tone: string
  copy: string
  estimatedTokens?: number | null
}

export interface CopywritingDraft {
  draftId: string
  aiModel: string
  actualTokens: number
  actualCost: number
  options: CopywritingOption[]
  expiresInMinutes: number
}

export interface ConfirmedCopywriting {
  contentId: string
  copy: string
  trackingUrl: string
  trackingQrCode?: string | null
  deductedAmount: number
  remainingBalance: number
  status: string
}

export interface VideoJob {
  contentId: string
  status: string
  progress: number
  estimatedCost?: number
  videoUrl?: string | null
  thumbnailUrl?: string | null
  error?: string | null
}

export interface PosterVariant {
  index: number
  imageUrl: string
  thumbnailUrl?: string | null
  style: string
  aspectRatio: string
  qrCodeUrl?: string | null
}

export interface PosterResult {
  contentId: string
  variants: PosterVariant[]
  trackingUrl: string
  qrCodeUrl?: string | null
  deductedAmount: number
  remainingBalance: number
}

export interface SharingChallenge { challengeId: string; title: string; description: string; targetShares: number; rewardPoints: number; progress: number; completed: boolean; mysteryBoxReward: boolean }
export interface RewardProduct { rewardProductId: string; name: string; description?: string | null; pointsCost: number; stock?: number | null; imageUrl?: string | null }
export interface LeaderboardItem { rank: number; agentId: string; nickname: string; avatar?: string | null; totalEarned: number; invitedCustomers: number }
export interface GamificationOverview { points: { balance: number; totalEarned: number; totalSpent: number; availableMysteryBoxes: number }; challenges: SharingChallenge[]; leaderboard: LeaderboardItem[] }
export interface MysteryBoxResult { openingId: string; reward: RewardProduct; guaranteed: boolean; remainingBoxes: number }
