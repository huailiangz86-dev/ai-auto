<template>
  <view class="page-padding safe-bottom"
    ><view class="tabs"
      ><text
        v-for="item in tabs"
        :key="item.value"
        :class="{ active: status === item.value }"
        @tap="changeStatus(item.value)"
        >{{ item.label }}</text
      ></view
    ><view v-if="store.coupons.length"
      ><view
        v-for="coupon in store.coupons"
        :key="coupon.customerCouponId"
        class="coupon-row"
        @tap="openCoupon(coupon.customerCouponId)"
        ><view
          ><text class="coupon-name">{{ coupon.couponName }}</text
          ><text class="merchant">{{ coupon.merchantName || '商家优惠' }}</text
          ><text class="expiry">有效期至 {{ formatDate(coupon.expireAt) }}</text></view
        ><view class="right"
          ><text class="amount">¥{{ formatMoney(coupon.discountAmount) }}</text
          ><text :class="['status', coupon.status]">{{ statusLabel(coupon.status) }}</text></view
        ></view
      ></view
    ><view v-else-if="!store.loadingCoupons" class="empty-state"
      >这里还没有优惠券，去首页逛逛吧</view
    ></view
  >
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useCouponStore } from '../../stores/coupon'
import type { CouponStatus } from '../../types/customer'
import { formatDate, formatMoney } from '../../utils/format'
const store = useCouponStore()
const status = ref<CouponStatus>('active')
const tabs: { label: string; value: CouponStatus }[] = [
  { label: '待使用', value: 'active' },
  { label: '已使用', value: 'used' },
  { label: '已过期', value: 'expired' },
]
function changeStatus(value: CouponStatus) {
  status.value = value
  void store.fetchCoupons(value)
}
function statusLabel(value: CouponStatus) {
  return value === 'active' ? '待使用' : value === 'used' ? '已使用' : '已过期'
}
function openCoupon(id: string) {
  uni.navigateTo({ url: `/pages/redemption/index?id=${id}` })
}
onShow(() => {
  void store.fetchCoupons(status.value)
})
</script>

<style scoped lang="scss">
.tabs {
  display: flex;
  justify-content: space-around;
  margin: -24rpx -24rpx 24rpx;
  padding: 0 24rpx;
  background: #fff;
}
.tabs text {
  padding: 28rpx 0 20rpx;
  color: #666;
  font-size: 28rpx;
}
.tabs .active {
  color: #07c160;
  font-weight: 600;
  border-bottom: 4rpx solid #07c160;
}
.coupon-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 20rpx;
  padding: 28rpx;
  background: #fff;
  border-radius: 16rpx;
}
.coupon-name,
.merchant,
.expiry {
  display: block;
}
.coupon-name {
  font-size: 30rpx;
  font-weight: 600;
}
.merchant,
.expiry {
  margin-top: 10rpx;
  color: #999;
  font-size: 23rpx;
}
.right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}
.amount {
  color: #fa5151;
  font-size: 42rpx;
  font-weight: 700;
}
.status {
  margin-top: 16rpx;
  color: #ff6b00;
  font-size: 22rpx;
}
.status.used,
.status.expired {
  color: #999;
}
</style>
