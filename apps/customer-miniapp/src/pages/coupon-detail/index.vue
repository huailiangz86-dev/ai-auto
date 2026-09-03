<template>
  <view class="page-padding safe-bottom">
    <view class="hero"
      ><text class="amount">¥{{ amount }}</text
      ><text class="name">{{ couponName }}</text
      ><text class="condition">满 {{ threshold }} 元可用</text></view
    >
    <view class="card"
      ><text class="card-title">适用商家</text
      ><text>{{ storeName || '以商家活动说明为准' }}</text></view
    >
    <view class="card"
      ><text class="card-title">使用说明</text
      ><text>到店消费时向商家出示券码；本券不可与其他优惠同时使用。</text
      ><text>有效期至 {{ formatDate(validUntil) }}，过期自动失效。</text></view
    >
    <label class="consent">
      <checkbox :checked="trackingConsent" color="#07c160" @tap="trackingConsent = !trackingConsent" />
      <text>同意将本券与来源内容关联，用于核对核销与创作者报酬</text>
    </label>
    <text class="consent-note">不勾选也能正常领券和使用；不会向创作者展示你的身份或联系方式。</text>
    <button class="primary" @tap="claim">领取优惠券</button>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { getCouponDetail } from '../../api/customer'
import { useCouponStore } from '../../stores/coupon'
import { usePromotionStore } from '../../stores/promotion'
import { formatDate } from '../../utils/format'

const couponId = ref('')
const couponName = ref('优惠券')
const storeName = ref('')
const amount = ref('0')
const threshold = ref('0')
const validUntil = ref('')
const agentId = ref('')
const trackingConsent = ref(false)

onLoad(async (query) => {
  couponId.value = query?.couponId || ''
  couponName.value = query?.couponName || couponName.value
  storeName.value = query?.storeName || ''
  amount.value = query?.amount || '0'
  threshold.value = query?.threshold || '0'
  validUntil.value = query?.validUntil || ''
  agentId.value = query?.agentId || ''

  if (agentId.value) {
    try {
      await usePromotionStore().captureReferral(agentId.value, couponId.value)
    } catch {
      // 未登录时仅保留来源；登录或领券时会继续建立归属。
    }
  }

  if (couponId.value && !query?.couponName) {
    try {
      const detail = await getCouponDetail(couponId.value)
      couponName.value = detail.couponName
      amount.value = String(detail.discountAmount ?? detail.cashRewardAmount ?? 0)
      threshold.value = String(detail.thresholdAmount ?? 0)
      validUntil.value = detail.validUntil ?? ''
    } catch (error) {
      uni.showToast({
        title: error instanceof Error ? error.message : '优惠券不存在',
        icon: 'none',
      })
    }
  }
})
async function claim() {
  if (!couponId.value) return
  try {
    const claimed = await useCouponStore().claim(couponId.value, trackingConsent.value)
    uni.showToast({ title: '领取成功', icon: 'success' })
    uni.redirectTo({ url: `/pages/redemption/index?id=${claimed.customerCouponId}` })
  } catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : '领取失败', icon: 'none' })
  }
}
</script>

<style scoped lang="scss">
.hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 64rpx 32rpx;
  color: #fff;
  background: linear-gradient(135deg, #fa5151, #ff8b4d);
  border-radius: 20rpx;
}
.amount {
  font-size: 88rpx;
  font-weight: 700;
}
.name {
  margin-top: 12rpx;
  font-size: 32rpx;
}
.condition {
  margin-top: 12rpx;
  font-size: 24rpx;
  opacity: 0.9;
}
.card {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  margin-top: 24rpx;
  padding: 28rpx;
  color: #666;
  font-size: 28rpx;
  line-height: 1.6;
  background: #fff;
  border-radius: 16rpx;
}
.card-title {
  color: #333;
  font-size: 30rpx;
  font-weight: 600;
}
.consent {
  display: flex;
  gap: 12rpx;
  align-items: flex-start;
  margin-top: 36rpx;
  color: #555;
  font-size: 24rpx;
  line-height: 1.5;
}
.consent-note {
  display: block;
  margin-top: 12rpx;
  color: #999;
  font-size: 22rpx;
  line-height: 1.5;
}
.primary {
  margin-top: 28rpx;
  color: #fff;
  font-size: 32rpx;
  line-height: 92rpx;
  background: #07c160;
  border-radius: 46rpx;
}
</style>
