<template>
  <view class="page-padding safe-bottom">
    <view v-if="coupon" class="redemption">
      <text class="merchant">{{ coupon.merchantName || '商家优惠券' }}</text>
      <text class="name">{{ coupon.couponName }}</text>
      <view class="qr-placeholder">
        <text>券码</text>
        <text class="code">{{ coupon.couponCode }}</text>
      </view>
      <text class="hint">请向商家出示此券码，核销后状态会自动更新</text>
      <text class="expire">有效期至 {{ formatDate(coupon.expireAt) }}</text>
      <view v-if="evidence" class="evidence">
        <text class="evidence-title">核销证据</text>
        <view v-for="event in evidence.events" :key="event.type" class="evidence-event">
          <text>{{ event.label }}</text>
          <text>{{ formatDate(event.occurredAt) }}</text>
        </view>
        <text class="privacy-note">{{ evidence.privacy.notice }}</text>
        <button v-if="evidence.privacy.trackingConsent && !evidence.traceability.verified" class="privacy-action" @tap="withdrawTracking">停止来源追踪</button>
        <text v-else-if="evidence.traceability.accountingRetention" class="privacy-note">{{ evidence.traceability.accountingRetention }}</text>
      </view>
      <button class="share-button" open-type="share" @tap="prepareFriendShare">
        分享优惠，赚奖励金
      </button>
    </view>
    <view v-else class="empty-state">未找到优惠券，请在券包中重试</view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onShareAppMessage, onShareTimeline, onShow } from '@dcloudio/uni-app'
import { useCouponStore } from '../../stores/coupon'
import { usePromotionStore } from '../../stores/promotion'
import { getCouponEvidence, updateCouponEvidenceConsent } from '../../api/customer'
import type { CouponEvidence, CustomerCoupon } from '../../types/customer'
import { formatDate } from '../../utils/format'

let id = ''
const coupon = computed(() =>
  useCouponStore().coupons.find((item: CustomerCoupon) => item.customerCouponId === id),
)
const promotionStore = usePromotionStore()
const evidence = ref<CouponEvidence | null>(null)

async function refreshEvidence() {
  if (!id) return
  try {
    evidence.value = await getCouponEvidence(id)
  } catch {
    evidence.value = null
  }
}

async function withdrawTracking() {
  if (!id) return
  try {
    evidence.value = await updateCouponEvidenceConsent(id, false)
    uni.showToast({ title: '已停止后续来源追踪', icon: 'success' })
  } catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : '设置失败', icon: 'none' })
  }
}

async function prepareShare(platform: 'wechat_friend' | 'wechat_moment') {
  if (!coupon.value) throw new Error('优惠券尚未加载完成')
  const context = await promotionStore.prepareShare(coupon.value.customerCouponId, platform)
  if (context.isNewAgent) {
    uni.showToast({ title: '已自动开通推广身份', icon: 'success' })
  }
  return context
}

function prepareFriendShare() {
  void prepareShare('wechat_friend').catch((error) => {
    uni.showToast({ title: error instanceof Error ? error.message : '暂时无法分享', icon: 'none' })
  })
}

function fallbackSharePath() {
  return coupon.value
    ? `/pages/coupon-detail/index?couponId=${coupon.value.couponId}`
    : '/pages/home/index'
}

onShareAppMessage((): any => ({
  title: coupon.value ? `送你一张${coupon.value.couponName}` : '附近优惠等你领',
  path: promotionStore.shareContext?.sharePath ?? fallbackSharePath(),
  promise: prepareShare('wechat_friend').then((context) => context),
  success: () => {
    if (coupon.value)
      void promotionStore.recordShare(coupon.value.customerCouponId, 'wechat_friend')
  },
}))

onShareTimeline((): any => ({
  title: coupon.value ? `${coupon.value.couponName}，到店可用` : '附近优惠等你领',
  query: promotionStore.shareContext?.sharePath.split('?')[1] ?? '',
  promise: prepareShare('wechat_moment').then((context) => context),
  success: () => {
    if (coupon.value)
      void promotionStore.recordShare(coupon.value.customerCouponId, 'wechat_moment')
  },
}))

onLoad((query) => {
  id = query?.id || ''
  if (!coupon.value) void useCouponStore().fetchCoupons()
  void refreshEvidence()
})

onShow(() => {
  void useCouponStore().fetchCoupons()
  void refreshEvidence()
  uni.showShareMenu({ menus: ['shareAppMessage', 'shareTimeline'] })
})
</script>

<style scoped lang="scss">
.redemption {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 60rpx 32rpx;
  background: #fff;
  border-radius: 20rpx;
}
.merchant {
  color: #666;
  font-size: 28rpx;
}
.name {
  margin-top: 16rpx;
  font-size: 38rpx;
  font-weight: 700;
}
.qr-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 440rpx;
  height: 440rpx;
  margin: 52rpx 0 28rpx;
  color: #333;
  border: 16rpx solid #333;
  box-sizing: border-box;
}
.code {
  margin-top: 24rpx;
  font-family: monospace;
  font-size: 30rpx;
  letter-spacing: 3rpx;
}
.hint,
.expire {
  color: #999;
  font-size: 24rpx;
  text-align: center;
}
.expire {
  margin-top: 14rpx;
}
.evidence {
  width: 100%;
  margin-top: 32rpx;
  padding: 24rpx;
  background: #f7faf8;
  border-radius: 16rpx;
  box-sizing: border-box;
}
.evidence-title {
  display: block;
  color: #333;
  font-size: 28rpx;
  font-weight: 600;
}
.evidence-event {
  display: flex;
  justify-content: space-between;
  margin-top: 16rpx;
  color: #666;
  font-size: 24rpx;
}
.privacy-note {
  display: block;
  margin-top: 20rpx;
  color: #888;
  font-size: 22rpx;
  line-height: 1.5;
}
.privacy-action {
  margin: 20rpx 0 0;
  color: #576b95;
  font-size: 23rpx;
  line-height: 56rpx;
  background: transparent;
}
.share-button {
  width: 100%;
  margin-top: 44rpx;
  color: #fff;
  font-size: 28rpx;
  line-height: 82rpx;
  background: #07c160;
  border-radius: 41rpx;
}
</style>
