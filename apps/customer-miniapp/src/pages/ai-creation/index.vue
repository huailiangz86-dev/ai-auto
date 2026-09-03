<template>
  <view class="page-padding safe-bottom">
    <view class="hero">
      <text class="hero-title">AI 帮你把好券分享出去</text>
      <text class="hero-copy">创作带专属追踪链接的内容；好友领券、到店消费后，佣金自动记入你的账户。</text>
      <view class="earnings"><text>已赚佣金</text><text class="money">¥{{ formatMoney(performance.totalEarned) }}</text></view>
    </view>

    <text class="section-title">选择创作类型</text>
    <view class="tool-card" @tap="openTool('copywriting')">
      <text class="tool-icon">✍️</text><view><text class="tool-name">AI 推广文案</text><text class="tool-description">为好券写产品体验与种草话术</text></view><text class="chevron">›</text>
    </view>
    <view class="tool-card" @tap="openTool('video')">
      <text class="tool-icon">🎬</text><view><text class="tool-name">AI 短视频</text><text class="tool-description">生成适合朋友圈分享的短视频</text></view><text class="chevron">›</text>
    </view>
    <view class="tool-card" @tap="openTool('poster')">
      <text class="tool-icon">🖼️</text><view><text class="tool-name">AI 推广海报</text><text class="tool-description">生成附带专属二维码的推广海报</text></view><text class="chevron">›</text>
    </view>
    <text class="hint">生成费用会从分享员 AI 余额扣除，确认前会由服务端校验余额。</text>
  </view>
</template>

<script setup lang="ts">
import { reactive } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { getPromotionPerformance } from '../../api/customer'
import { formatMoney } from '../../utils/format'

const performance = reactive({ totalEarned: 0 })

function openTool(tool: 'copywriting' | 'video' | 'poster') {
  uni.navigateTo({ url: `/pages/ai-creation/${tool}` })
}

onShow(async () => {
  try {
    Object.assign(performance, await getPromotionPerformance())
  } catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : '加载创作信息失败', icon: 'none' })
  }
})
</script>

<style scoped lang="scss">
.hero { padding: 38rpx 32rpx; color: #fff; background: linear-gradient(135deg, #0ea5e9, #2563eb); border-radius: 20rpx; }
.hero-title, .hero-copy { display: block; }
.hero-title { font-size: 38rpx; font-weight: 700; }
.hero-copy { margin-top: 16rpx; font-size: 25rpx; line-height: 1.65; opacity: .9; }
.earnings { display: flex; align-items: baseline; gap: 18rpx; margin-top: 32rpx; font-size: 25rpx; }
.money { color: #fef3c7; font-size: 42rpx; font-weight: 700; }
.section-title { display: block; margin: 42rpx 0 20rpx; font-size: 30rpx; font-weight: 600; }
.tool-card { display: flex; align-items: center; gap: 22rpx; margin-top: 18rpx; padding: 28rpx; background: #fff; border-radius: 18rpx; }
.tool-icon { font-size: 50rpx; }.tool-name,.tool-description { display:block; }.tool-name { font-size:30rpx; font-weight:600; }.tool-description { margin-top:8rpx; color:#888; font-size:24rpx; }.chevron { margin-left:auto; color:#999; font-size:42rpx; }.hint { display:block; margin:24rpx 10rpx; color:#888; font-size:23rpx; line-height:1.6; }
</style>
