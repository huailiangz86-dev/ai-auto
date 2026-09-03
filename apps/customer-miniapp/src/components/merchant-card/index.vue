<template>
  <view class="merchant-card" @tap="$emit('open', store)">
    <view class="cover"><text>优惠</text></view>
    <view class="details">
      <view class="title-row"
        ><text class="name">{{ store.merchantName || store.storeName }}</text
        ><text class="distance">{{ formatDistance(store.distance) }}</text></view
      >
      <text class="address">{{
        [store.district, store.addressDetail].filter(Boolean).join(' ') || '地址待商家补充'
      }}</text>
      <coupon-card
        v-for="coupon in store.coupons.slice(0, 2)"
        :key="coupon.couponId"
        :coupon="coupon"
        :claimed="claimedCouponIds.includes(coupon.couponId)"
        :loading="claimingCouponId === coupon.couponId"
        @claim="$emit('claim', $event)"
      />
    </view>
  </view>
</template>

<script setup lang="ts">
import CouponCard from '../coupon-card/index.vue'
import type { NearbyStore } from '../../types/customer'
import { formatDistance } from '../../utils/location'

defineProps<{ store: NearbyStore; claimedCouponIds: string[]; claimingCouponId?: string }>()
defineEmits<{ claim: [couponId: string]; open: [store: NearbyStore] }>()
</script>

<style scoped lang="scss">
.merchant-card {
  margin-bottom: 24rpx;
  overflow: hidden;
  background: #fff;
  border-radius: 16rpx;
  box-shadow: 0 4rpx 16rpx rgb(0 0 0 / 4%);
}
.cover {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 190rpx;
  color: #fff;
  font-size: 32rpx;
  font-weight: 600;
  letter-spacing: 8rpx;
  background: linear-gradient(135deg, #07c160, #44c08a);
}
.details {
  padding: 22rpx;
}
.title-row {
  display: flex;
  justify-content: space-between;
  gap: 16rpx;
}
.name {
  overflow: hidden;
  font-size: 32rpx;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.distance {
  flex: none;
  color: #576b95;
  font-size: 24rpx;
}
.address {
  display: block;
  margin: 12rpx 0 18rpx;
  overflow: hidden;
  color: #999;
  font-size: 24rpx;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.coupon-card + .coupon-card {
  margin-top: 14rpx;
}
</style>
