// ============================================================
// AI auto Shared Types and Constants
// ============================================================

// ---------- User Roles ----------
export enum UserRole {
  MERCHANT_ADMIN = 'merchant_admin',
  MERCHANT_STAFF = 'merchant_staff',
  AGENT = 'agent',
  CUSTOMER = 'customer',
  ADMIN = 'admin',
  SUPER_ADMIN = 'super_admin',
}

// ---------- Agent Levels ----------
export enum AgentLevel {
  BRONZE = 'bronze', // 0-10 valid customers
  SILVER = 'silver', // 11-50
  GOLD = 'gold', // 51-200
  DIAMOND = 'diamond', // 201-500
  KING = 'king', // 500+
}

// ---------- Commission Multipliers ----------
export const AGENT_LEVEL_MULTIPLIERS: Record<AgentLevel, number> = {
  [AgentLevel.BRONZE]: 1.0,
  [AgentLevel.SILVER]: 1.1,
  [AgentLevel.GOLD]: 1.2,
  [AgentLevel.DIAMOND]: 1.5,
  [AgentLevel.KING]: 2.0,
}

// ---------- Agent Level Thresholds ----------
export const AGENT_LEVEL_THRESHOLDS: Record<AgentLevel, number> = {
  [AgentLevel.BRONZE]: 0,
  [AgentLevel.SILVER]: 11,
  [AgentLevel.GOLD]: 51,
  [AgentLevel.DIAMOND]: 201,
  [AgentLevel.KING]: 500,
}

// ---------- Platform Commission Rate ----------
export const PLATFORM_COMMISSION_RATE = 0.2 // 20% platform fee
export const AGENT_COMMISSION_RATE = 0.8 // 80% to agent

// ---------- Lock Period ----------
export const LOCK_PERIOD_DAYS = 365

// ---------- Settlement ----------
export const SETTLEMENT_T_PLUS_DAYS = 3 // T+3 business days
export const MIN_WITHDRAWAL_AMOUNT = 10 // ¥10 minimum

// ---------- Subscription ----------
export const SUBSCRIPTION_PRICE_PER_STORE = 1200 // ¥1,200/store/year

// ---------- AI Token Cost ----------
export const AI_TOKEN_COST_BEARER = 'agent' // token cost borne by agent

// ---------- Campaign Types ----------
export enum CampaignType {
  DISCOUNT = 'discount', // 满减
  CASH_REWARD = 'cash_reward', // 现金奖励
  COMBO = 'combo', // 组合券
}

// ---------- Coupon Status ----------
export enum CouponStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  EXPIRED = 'expired',
  REDEEMED = 'redeemed',
}

// ---------- Redemption Status ----------
export enum RedemptionStatus {
  PENDING = 'pending',
  VERIFIED = 'verified',
  SETTLED = 'settled',
  FAILED = 'failed',
}

// ---------- Withdrawal Status ----------
export enum WithdrawalStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  SUCCESS = 'success',
  FAILED = 'failed',
}

// ---------- Subscription Status ----------
export enum SubscriptionStatus {
  ACTIVE = 'active',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled',
}

// ---------- Audit Status ----------
export enum AuditStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  NEED_INFO = 'need_info',
}

// ---------- Audit Action Types ----------
export enum AuditActionType {
  MERCHANT_APPROVED = 'merchant_approved',
  MERCHANT_REJECTED = 'merchant_rejected',
  AGENT_APPROVED = 'agent_approved',
  AGENT_REJECTED = 'agent_rejected',
  AGENT_BANNED = 'agent_banned',
  CREATOR_SCORE_UPDATED = 'creator_score_updated',
  CREATOR_BLACKLISTED = 'creator_blacklisted',
  MERCHANT_FROZEN = 'merchant_frozen',
  MERCHANT_RESTORED = 'merchant_restored',
  CREATOR_RESTORED = 'creator_restored',
  CREATOR_TASK_LIMIT_UPDATED = 'creator_task_limit_updated',
  LIFECYCLE_TAGGED = 'lifecycle_tagged',
  LIFECYCLE_NOTE_CREATED = 'lifecycle_note_created',
  LIFECYCLE_NOTIFICATION_SENT = 'lifecycle_notification_sent',
  RELATIONSHIP_RESTRICTED = 'relationship_restricted',
  RELATIONSHIP_RELEASED = 'relationship_released',
  RELATIONSHIP_UNBOUND = 'relationship_unbound',
  ACTIVITY_FLAGGED = 'activity_flagged',
  CONTENT_FLAGGED = 'content_flagged',
  FRAUD_DETECTED = 'fraud_detected',
  CONTENT_MODERATED = 'content_moderated',
  FRAUD_RESOLVED = 'fraud_resolved',
  GROWTH_TASK_TRANSITION = 'growth_task_transition',
  GROWTH_PLAN_CREATED = 'growth_plan_created',
  GROWTH_PLAN_APPROVED = 'growth_plan_approved',
  CAMPAIGN_BUDGET_FUNDED = 'campaign_budget_funded',
  CREATOR_TASK_TRANSITION = 'creator_task_transition',
  CREATOR_TASK_REVIEWED = 'creator_task_reviewed',
  CREATOR_TASK_RISK_HELD = 'creator_task_risk_held',
  CAMPAIGN_CREDIT_CONSUMED = 'campaign_credit_consumed',
  CREATOR_PROFILE_UPDATED = 'creator_profile_updated',
  CREATOR_VERIFICATION_SUBMITTED = 'creator_verification_submitted',
  CREATOR_TASK_APPEALED = 'creator_task_appealed',
  CREATOR_TASK_PAYOUT_VERIFIED = 'creator_task_payout_verified',
  CREATOR_TASK_APPEAL_RESOLVED = 'creator_task_appeal_resolved',
}

// ---------- Customer Coupon Source ----------
export enum CouponSource {
  SHARE_LINK = 'share_link',
  QR_CODE = 'qr_code',
  LBS = 'lbs',
  SEARCH = 'search',
  WECHAT_MP = 'wechat_mp',
}

// ---------- Customer Coupon Status ----------
export enum CustomerCouponStatus {
  ACTIVE = 'active', // claimed, not used, not expired
  USED = 'used', // redeemed at merchant
  EXPIRED = 'expired', // past validity period
}

// ---------- Fraud Alert ----------
export enum FraudAlertType {
  SUSPICIOUS_SELF_REDEMPTION = 'suspicious_self_redemption',
  HIGH_FREQUENCY_REDEMPTION = 'high_frequency_redemption',
  MERCHANT_ABNORMAL_RATE = 'merchant_abnormal_rate',
  COUPON_STACKING = 'coupon_stacking',
  DEVICE_FINGERPRINT = 'device_fingerprint',
  IP_CLUSTERING = 'ip_clustering',
  COMMISSION_ANOMALY = 'commission_anomaly',
  CONTENT_VIOLATION = 'content_violation',
}

export enum FraudAlertSeverity {
  CRITICAL = 'critical',
  WARNING = 'warning',
  NOTICE = 'notice',
}

export enum FraudAlertStatus {
  PENDING = 'pending',
  REVIEWED = 'reviewed',
  ACTIONED = 'actioned',
  DISMISSED = 'dismissed',
}

// ---------- Platform Revenue Type ----------
export enum RevenueType {
  COMMISSION_ROYALTY = 'commission_royalty',
  SUBSCRIPTION = 'subscription',
  AI_TOKEN = 'ai_token',
  REFUND = 'refund',
}

// ---------- Platform Types ----------
export enum PlatformType {
  WECHAT = 'wechat',
  DOUYIN = 'douyin',
  XIAOHONGSHU = 'xiaohongshu',
  VIDEO_ACCOUNT = 'video_account',
  KUAISHOU = 'kuaishou',
}

// ---------- Content Status ----------
export enum ContentStatus {
  DRAFT = 'draft',
  GENERATING = 'generating',
  READY = 'ready',
  PUBLISHED = 'published',
  FAILED = 'failed',
  FLAGGED = 'flagged',
}

// ---------- Wallet Transaction Types ----------
export enum WalletTransactionType {
  RECHARGE = 'recharge',
  FREEZE = 'freeze',
  UNFREEZE = 'unfreeze',
  DEDUCT = 'deduct',
  WITHDRAWAL = 'withdrawal',
}

// ---------- Commission Transaction Types ----------
export enum CommissionTransactionType {
  EARNED = 'earned',
  PLATFORM_FEE = 'platform_fee',
  SETTLED = 'settled',
  WITHDRAWN = 'withdrawn',
}

// ---------- Common Response Types ----------
export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface PaginationParams {
  page?: number
  pageSize?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

// ---------- Date Ranges ----------
export const SUBSCRIPTION_RENEWAL_REMINDER_DAYS = [30, 7, 1]
export const REDEMPTION_CALLBACK_TIMEOUT_HOURS = 72
export const TOKEN_EXPIRY_MINUTES = 15
export const REFRESH_TOKEN_EXPIRY_DAYS = 7
export const SMS_CODE_EXPIRY_MINUTES = 5

// ---------- ID Generation ----------
export function generateIdempotencyKey(prefix: string, ...parts: (string | number)[]): string {
  return [prefix, ...parts.map(String)].join(':')
}

// ---------- Platform Fee Calculation ----------
export function calculatePlatformFee(amount: number): number {
  return Math.round(amount * PLATFORM_COMMISSION_RATE * 100) / 100
}

export function calculateAgentPayout(amount: number): number {
  return Math.round(amount * AGENT_COMMISSION_RATE * 100) / 100
}

export function calculateCommissionWithLevel(
  amount: number,
  level: AgentLevel,
): { platformFee: number; agentPayout: number; finalPayout: number } {
  const baseAgentPayout = calculateAgentPayout(amount)
  const multiplier = AGENT_LEVEL_MULTIPLIERS[level]
  const finalPayout = Math.round(baseAgentPayout * multiplier * 100) / 100
  const platformFee = Math.round((amount - finalPayout) * 100) / 100
  return { platformFee, agentPayout: baseAgentPayout, finalPayout }
}
