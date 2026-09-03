<template>
  <view class="coupon-card">
    <view class="amount">
      <text class="currency">¥</text
      ><text class="price">{{
        formatMoney(coupon.discountAmount || coupon.cashRewardAmount)
      }}</text>
      <text class="condition">满{{ formatMoney(coupon.thresholdAmount) }}元可用</text>
    </view>
    <view class="content">
      <text class="title">{{ coupon.couponName }}</text>
      <text class="meta">有效期至 {{ formatDate(coupon.validUntil) }}</text>
    </view>
    <button
      class="claim-btn"
      :disabled="claimed || loading"
      size="mini"
      @tap.stop="$emit('claim', coupon.couponId)"
    >
      {{ claimed ? '已领取' : loading ? '领取中' : '领取' }}
    </button>
  </view>
</template>

<script setup lang="ts">
import type { CouponSummary } from '../../types/customer'
import { formatDate, formatMoney } from '../../utils/format'

defineProps<{ coupon: CouponSummary; claimed?: boolean; loading?: boolean }>()
defineEmits<{ claim: [couponId: string] }>()
</script>

<style scoped lang="scss">
.coupon-card {
  display: flex;
  align-items: center;
  min-height: 142rpx;
  padding: 18rpx 20rpx;
  background: #fff8ed;
  border-radius: 16rpx;
}
.amount {
  width: 148rpx;
  color: #fa5151;
  text-align: center;
  border-right: 1rpx dashed #f2c998;
}
.currency {
  font-size: 26rpx;
}
.price {
  font-size: 54rpx;
  font-weight: 700;
}
.condition {
  display: block;
  color: #8a6d3b;
  font-size: 20rpx;
}
.content {
  flex: 1;
  padding: 0 18rpx;
  overflow: hidden;
}
.title {
  display: block;
  overflow: hidden;
  font-size: 27rpx;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.meta {
  display: block;
  margin-top: 10rpx;
  color: #999;
  font-size: 22rpx;
}
.claim-btn {
  margin: 0;
  padding: 0 22rpx;
  color: #fff;
  font-size: 24rpx;
  line-height: 56rpx;
  background: #07c160;
  border-radius: 28rpx;
}
.claim-btn[disabled] {
  color: #999;
  background: #e8f8ee;
}
</style>
