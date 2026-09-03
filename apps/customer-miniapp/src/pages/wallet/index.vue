<template>
  <view class="page-padding safe-bottom">
    <view class="balance">
      <text>累计推广奖励</text>
      <text class="money">¥{{ formatMoney(performance?.totalEarned) }}</text>
      <text>{{
        performance?.isAgent ? '核销完成后奖励将按规则进入账户' : '分享优惠即可自动开通推广身份'
      }}</text>
    </view>

    <view class="metrics">
      <view
        ><text>{{ performance?.shareCount ?? 0 }}</text
        ><text>成功分享</text></view
      >
      <view
        ><text>{{ performance?.invitedCustomers ?? 0 }}</text
        ><text>带来客户</text></view
      >
      <view
        ><text>{{ performance?.redemptions ?? 0 }}</text
        ><text>完成核销</text></view
      >
    </view>

    <view class="card">
      <text class="title">推广效果</text>
      <view class="line"
        ><text>待结算/预估奖励</text
        ><text>¥{{ formatMoney(performance?.estimatedCommission) }}</text></view
      >
      <view class="line"
        ><text>推广身份</text><text>{{ performance?.isAgent ? '已开通' : '尚未开通' }}</text></view
      >
    </view>

    <view class="card hint-card">
      <text class="title">如何获得奖励？</text>
      <text
        >在券包中打开优惠券并分享给好友或朋友圈；好友领券并完成核销后，奖励会按平台规则结算。</text
      >
      <button class="outline-button" @tap="goCoupons">去分享优惠券</button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { usePromotionStore } from '../../stores/promotion'
import { formatMoney } from '../../utils/format'

const promotionStore = usePromotionStore()
const performance = computed(() => promotionStore.performance)

function goCoupons() {
  uni.switchTab({ url: '/pages/coupons/index' })
}

onShow(() => {
  void promotionStore.fetchPerformance().catch((error: unknown) => {
    uni.showToast({ title: error instanceof Error ? error.message : '数据加载失败', icon: 'none' })
  })
})
</script>

<style scoped lang="scss">
.balance {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  padding: 44rpx;
  color: #fff;
  font-size: 26rpx;
  background: linear-gradient(135deg, #07c160, #30a86e);
  border-radius: 20rpx;
}
.money {
  font-size: 68rpx;
  font-weight: 700;
}
.metrics {
  display: flex;
  margin: 24rpx 0;
  padding: 28rpx 0;
  background: #fff;
  border-radius: 16rpx;
}
.metrics view {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 12rpx;
  align-items: center;
  border-right: 1rpx solid #eee;
}
.metrics view:last-child {
  border: 0;
}
.metrics text:first-child {
  font-size: 34rpx;
  font-weight: 600;
}
.metrics text:last-child {
  color: #999;
  font-size: 22rpx;
}
.card {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
  margin-top: 24rpx;
  padding: 30rpx;
  color: #666;
  font-size: 26rpx;
  line-height: 1.6;
  background: #fff;
  border-radius: 16rpx;
}
.title {
  color: #333;
  font-size: 30rpx;
  font-weight: 600;
}
.line {
  display: flex;
  justify-content: space-between;
}
.line text:last-child {
  color: #07c160;
  font-weight: 600;
}
.hint-card {
  color: #666;
}
.outline-button {
  margin: 6rpx 0 0;
  color: #07c160;
  font-size: 26rpx;
  line-height: 70rpx;
  background: #e8f8ee;
  border-radius: 35rpx;
}
</style>
