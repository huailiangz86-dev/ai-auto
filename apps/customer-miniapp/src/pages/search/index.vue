<template>
  <view class="page-padding safe-bottom">
    <view class="search-bar">
      <input v-model="keyword" confirm-type="search" focus placeholder="搜索商家、品类或关键词" @confirm="search" />
      <button :loading="loading" @tap="search">搜索</button>
    </view>
    <text v-if="searched" class="result-count">找到 {{ results.length }} 家相关商家</text>
    <view v-for="store in results" :key="store.storeId" class="store" @tap="openStore(store)">
      <text class="name">{{ store.storeName }}</text>
      <text class="merchant">{{ store.merchantName }} · {{ store.businessCategory || '商家优惠' }}</text>
      <text class="address">{{ [store.city, store.district, store.addressDetail].filter(Boolean).join(' ') || '地址以门店信息为准' }}</text>
      <view v-if="store.coupons.length" class="coupon"><text>可领优惠</text><text>{{ store.coupons[0].couponName }}</text></view>
    </view>
    <view v-if="searched && !loading && !results.length" class="empty-state">没有找到相关优惠，换个关键词试试</view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { searchMerchants } from '../../api/customer'
import type { NearbyStore } from '../../types/customer'

const keyword = ref('')
const city = ref('')
const results = ref<NearbyStore[]>([])
const loading = ref(false)
const searched = ref(false)

onLoad((query) => {
  city.value = query?.city || ''
})

async function search() {
  const value = keyword.value.trim()
  if (!value) {
    uni.showToast({ title: '请输入搜索关键词', icon: 'none' })
    return
  }
  loading.value = true
  try {
    const response = await searchMerchants({ keyword: value, city: city.value || undefined, page: 1, pageSize: 30 })
    results.value = response.items
    searched.value = true
  } catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : '搜索失败，请重试', icon: 'none' })
  } finally {
    loading.value = false
  }
}

function openStore(store: NearbyStore) {
  const coupon = store.coupons[0]
  if (!coupon) return
  uni.navigateTo({
    url: `/pages/coupon-detail/index?couponId=${coupon.couponId}&storeName=${encodeURIComponent(store.storeName)}&couponName=${encodeURIComponent(coupon.couponName)}&amount=${coupon.discountAmount ?? coupon.cashRewardAmount ?? 0}&threshold=${coupon.thresholdAmount ?? 0}&validUntil=${encodeURIComponent(coupon.validUntil ?? '')}`,
  })
}
</script>

<style scoped lang="scss">
.search-bar { display: flex; gap: 16rpx; align-items: center; padding: 14rpx 18rpx 14rpx 24rpx; background: #fff; border-radius: 42rpx; }
.search-bar input { flex: 1; font-size: 28rpx; }
.search-bar button { margin: 0; padding: 0 26rpx; color: #fff; font-size: 26rpx; line-height: 64rpx; background: #07c160; border-radius: 32rpx; }
.result-count { display: block; margin: 26rpx 4rpx 16rpx; color: #64748b; font-size: 24rpx; }
.store { margin-bottom: 18rpx; padding: 28rpx; background: #fff; border-radius: 16rpx; }
.name,.merchant,.address,.coupon { display: block; }
.name { color: #1f2937; font-size: 30rpx; font-weight: 600; }
.merchant,.address { margin-top: 10rpx; color: #64748b; font-size: 24rpx; }
.coupon { display: flex; justify-content: space-between; margin-top: 20rpx; padding: 14rpx 16rpx; color: #dc2626; font-size: 24rpx; background: #fef2f2; border-radius: 10rpx; }
</style>
