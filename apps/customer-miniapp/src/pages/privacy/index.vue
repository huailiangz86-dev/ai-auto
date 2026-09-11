<template>
  <view class="page-padding safe-bottom">
    <view class="intro">
      <text class="title">你的数据，由你掌控</text>
      <text class="description">我们仅在必要范围内处理你的资料、领券和核销记录。你可随时导出平台持有的个人数据。</text>
    </view>

    <view class="card">
      <text class="card-title">数据导出</text>
      <text class="card-description">导出内容包括个人资料、归属记录、优惠券及核销记录，格式为 JSON。请勿将导出的数据发送给不可信的人。</text>
      <button class="primary" :loading="exporting" @tap="exportData">导出我的数据</button>
    </view>

    <view v-if="dataExport" class="card result">
      <text class="card-title">导出已准备</text>
      <text class="result-line">生成时间：{{ formatTime(dataExport.generatedAt) }}</text>
      <text class="result-line">归属记录 {{ dataExport.data.attributions.length }} 条 · 优惠券 {{ dataExport.data.coupons.length }} 张 · 核销 {{ dataExport.data.redemptions.length }} 条</text>
      <button class="secondary" @tap="copyExport">复制 JSON 数据</button>
    </view>

    <view class="card notice">
      <text class="card-title">定位与来源追踪</text>
      <text class="card-description">定位仅用于附近优惠排序。优惠来源追踪需在领券时单独授权；你可在优惠券核销页停止后续追踪。</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { downloadPersonalDataExport, requestPersonalDataExport } from '../../api/customer'
import type { PersonalDataExport } from '../../types/customer'

const exporting = ref(false)
const dataExport = ref<PersonalDataExport | null>(null)

function formatTime(value?: string | null) {
  if (!value) return '刚刚'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN', { hour12: false })
}

async function exportData() {
  exporting.value = true
  try {
    const exportRequest = await requestPersonalDataExport()
    dataExport.value = await downloadPersonalDataExport(exportRequest.requestId)
    uni.showToast({ title: '数据已准备完成', icon: 'success' })
  } catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : '数据导出失败，请重试', icon: 'none' })
  } finally {
    exporting.value = false
  }
}

function copyExport() {
  if (!dataExport.value) return
  uni.setClipboardData({
    data: JSON.stringify(dataExport.value, null, 2),
    success: () => uni.showToast({ title: 'JSON 数据已复制', icon: 'success' }),
  })
}
</script>

<style scoped lang="scss">
.intro,.card { padding: 30rpx 28rpx; background: #fff; border-radius: 18rpx; }
.intro { color: #075985; background: #f0f9ff; border: 1rpx solid #bae6fd; }
.title,.card-title,.description,.card-description,.result-line { display: block; }
.title { font-size: 32rpx; font-weight: 600; }
.description,.card-description { margin-top: 14rpx; color: #64748b; font-size: 25rpx; line-height: 1.65; }
.card { margin-top: 22rpx; }
.card-title { font-size: 29rpx; font-weight: 600; }
.primary,.secondary { margin-top: 26rpx; font-size: 29rpx; line-height: 84rpx; border-radius: 42rpx; }
.primary { color: #fff; background: #07c160; }
.secondary { color: #07c160; background: #fff; border: 1rpx solid #07c160; }
.result { background: #f0fdf4; }
.result-line { margin-top: 14rpx; color: #475569; font-size: 24rpx; line-height: 1.6; }
.notice { margin-bottom: 24rpx; }
</style>
