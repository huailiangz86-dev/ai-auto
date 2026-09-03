<template>
  <view class="page-padding safe-bottom">
    <view class="search" @tap="showSearchTip"
      ><text>🔍</text><text>搜索商家、品类或关键词</text></view
    >
    <scroll-view class="categories" scroll-x
      ><text
        v-for="item in categories"
        :key="item"
        :class="['category', { active: category === item }]"
        @tap="selectCategory(item)"
        >{{ item }}</text
      ></scroll-view
    >
    <view class="location"
      ><text>📍</text><text>{{ locationText }}</text
      ><text class="retry" @tap="loadNearby(true)">刷新</text></view
    >
    <view class="section-title"
      ><text>为你推荐</text
      ><text v-if="store.nearbyStores.length">{{ store.nearbyStores.length }} 家</text></view
    >
    <merchant-card
      v-for="item in store.nearbyStores"
      :key="item.storeId"
      :store="item"
      :claimed-coupon-ids="claimedCouponIds"
      :claiming-coupon-id="claimingCouponId"
      @claim="handleClaim"
      @open="openStore"
    />
    <view v-if="!store.loadingNearby && !store.nearbyStores.length" class="empty-state"
      >附近暂时没有可领取的优惠</view
    >
    <view v-if="store.loadingNearby" class="loading">加载中…</view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onPullDownRefresh, onReachBottom } from '@dcloudio/uni-app'
import MerchantCard from '../../components/merchant-card/index.vue'
import { useCouponStore } from '../../stores/coupon'
import { getCurrentLocation } from '../../utils/location'
import type { CustomerCoupon, NearbyStore } from '../../types/customer'

const store = useCouponStore()
const categories = ['附近', '推荐', '美食', '饮品', '休闲']
const category = ref('附近')
const locationText = ref('正在获取位置…')
const location = ref<{ latitude?: number; longitude?: number; city?: string }>({})
const claimingCouponId = ref('')
const claimedCouponIds = computed(() =>
  store.coupons
    .filter((coupon: CustomerCoupon) => coupon.status === 'active')
    .map((coupon: CustomerCoupon) => coupon.couponId),
)

async function loadNearby(refresh = false) {
  const result = await getCurrentLocation()
  location.value = result
  locationText.value = result.failed ? '未开启定位，展示所在城市优惠' : '已按当前位置为你排序'
  await store.fetchNearby({
    ...location.value,
    category: category.value === '附近' ? undefined : category.value,
    page: refresh ? 1 : undefined,
  })
}

function selectCategory(value: string) {
  category.value = value
  void loadNearby(true)
}
function showSearchTip() {
  uni.showToast({ title: '搜索功能即将开放', icon: 'none' })
}

function handleClaim(couponId: string) {
  // Consent is collected on the offer page before a referral can become
  // attribution evidence; a quick claim must not silently enroll the consumer.
  uni.navigateTo({ url: `/pages/coupon-detail/index?couponId=${couponId}` })
}

function openStore(item: NearbyStore) {
  const coupon = item.coupons[0]
  if (!coupon) return
  uni.navigateTo({
    url: `/pages/coupon-detail/index?couponId=${coupon.couponId}&storeName=${encodeURIComponent(item.storeName)}&couponName=${encodeURIComponent(coupon.couponName)}&amount=${coupon.discountAmount ?? coupon.cashRewardAmount ?? 0}&threshold=${coupon.thresholdAmount ?? 0}&validUntil=${encodeURIComponent(coupon.validUntil ?? '')}`,
  })
}

onLoad(() => {
  void loadNearby()
  void store.fetchCoupons()
})
onPullDownRefresh(async () => {
  await loadNearby(true)
  uni.stopPullDownRefresh()
})
onReachBottom(() => {
  if (!store.loadingNearby && store.nearbyPagination.page < store.nearbyPagination.totalPages)
    void store.fetchNearby({ ...location.value, page: store.nearbyPagination.page + 1 })
})
</script>

<style scoped lang="scss">
.search {
  display: flex;
  gap: 12rpx;
  align-items: center;
  padding: 20rpx 24rpx;
  color: #999;
  font-size: 28rpx;
  background: #fff;
  border-radius: 40rpx;
}
.categories {
  margin: 24rpx 0;
  white-space: nowrap;
}
.category {
  display: inline-block;
  margin-right: 40rpx;
  color: #666;
  font-size: 28rpx;
}
.category.active {
  color: #07c160;
  font-weight: 600;
}
.location {
  display: flex;
  gap: 12rpx;
  align-items: center;
  padding: 18rpx 20rpx;
  color: #576b95;
  font-size: 24rpx;
  background: #e8f8ee;
  border-radius: 12rpx;
}
.retry {
  margin-left: auto;
  color: #07c160;
}
.section-title {
  display: flex;
  justify-content: space-between;
  margin: 32rpx 0 18rpx;
  font-size: 32rpx;
  font-weight: 600;
}
.section-title text:last-child {
  color: #999;
  font-size: 24rpx;
  font-weight: normal;
}
.loading {
  padding: 40rpx;
  color: #999;
  text-align: center;
  font-size: 26rpx;
}
</style>
