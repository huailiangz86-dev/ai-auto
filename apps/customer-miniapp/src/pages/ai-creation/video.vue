<template>
  <view class="page-padding safe-bottom">
    <view class="notice">AI 将基于优惠券生成 4、8 或 12 秒的可分享短视频，并在视频内容中关联你的专属追踪链接。</view>
    <view class="panel"><text class="label">推广优惠券</text><picker :range="couponNames" :value="couponIndex" @change="selectCoupon"><view class="picker">{{ selectedCoupon?.couponName || '请选择优惠券' }} <text>›</text></view></picker></view>
    <view class="panel"><text class="label">视频时长</text><view class="chips"><text v-for="item in durations" :key="item" :class="['chip', { selected: duration === item }]" @tap="duration = item">{{ item }} 秒</text></view></view>
    <button class="primary" :loading="creating" @tap="generate">生成 AI 短视频</button>
    <view v-if="job" class="job"><text class="job-title">{{ statusText }}</text><view class="progress"><view class="progress-inner" :style="{ width: `${job.progress}%` }" /></view><text class="job-info">{{ job.progress }}% · {{ job.contentId }}</text><text v-if="job.error" class="error">{{ job.error }}</text><video v-if="job.videoUrl" :src="job.videoUrl" controls class="video" /></view>
  </view>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { generateCustomerVideo, getCustomerVideoStatus, getMyCoupons } from '../../api/customer'
import type { CustomerCoupon, VideoJob } from '../../types/customer'
const coupons = ref<CustomerCoupon[]>([]); const couponIndex = ref(0); const duration = ref(30); const creating = ref(false); const job = ref<VideoJob | null>(null)
const durations = [4, 8, 12]; let pollingTimer: ReturnType<typeof setInterval> | null = null
const couponNames = computed(() => coupons.value.map((coupon: CustomerCoupon) => coupon.couponName)); const selectedCoupon = computed(() => coupons.value[couponIndex.value])
const statusText = computed(() => job.value?.status === 'completed' ? '视频生成完成' : job.value?.status === 'failed' ? '视频生成失败' : 'AI 正在创作视频…')
onLoad(async (query) => { try { const result = await getMyCoupons({ status: 'active', page: 1, pageSize: 50 }); coupons.value = result.items; const index = coupons.value.findIndex((coupon: CustomerCoupon) => coupon.couponId === query?.couponId); if (index >= 0) couponIndex.value = index } catch (error) { uni.showToast({ title: error instanceof Error ? error.message : '加载优惠券失败', icon: 'none' }) } })
onShow(() => { if (job.value && !isFinished()) startPolling() }); onUnmounted(stopPolling)
function selectCoupon(event: { detail: { value: string } }) { couponIndex.value = Number(event.detail.value) }
function isFinished() { return job.value?.status === 'completed' || job.value?.status === 'failed' }
function stopPolling() { if (pollingTimer) { clearInterval(pollingTimer); pollingTimer = null } }
function startPolling() { stopPolling(); pollingTimer = setInterval(() => void refreshJob(), 3000) }
async function refreshJob() { if (!job.value) return; try { job.value = await getCustomerVideoStatus(job.value.contentId); if (isFinished()) stopPolling() } catch (error) { stopPolling(); uni.showToast({ title: error instanceof Error ? error.message : '查询进度失败', icon: 'none' }) } }
async function generate() { if (!selectedCoupon.value) { uni.showToast({ title: '请先领取并选择一张优惠券', icon: 'none' }); return }; creating.value = true; stopPolling(); try { job.value = await generateCustomerVideo({ couponId: selectedCoupon.value.couponId, platform: 'wechat', durationSeconds: duration.value }); startPolling() } catch (error) { uni.showToast({ title: error instanceof Error ? error.message : '创建任务失败', icon: 'none' }) } finally { creating.value = false } }
</script>

<style scoped lang="scss">
.notice { padding:22rpx 26rpx; color:#075985; font-size:25rpx; line-height:1.6; background:#f0f9ff; border-radius:14rpx; }.panel,.job { margin-top:22rpx; padding:28rpx; background:#fff; border-radius:18rpx; }.label,.job-title { display:block; margin-bottom:20rpx; font-size:29rpx; font-weight:600; }.picker { display:flex; justify-content:space-between; padding:24rpx; color:#444; background:#f8fafc; border-radius:12rpx; }.chips { display:flex; gap:16rpx; }.chip { padding:12rpx 22rpx; color:#64748b; font-size:25rpx; background:#f1f5f9; border-radius:28rpx; }.chip.selected { color:#fff; background:#0ea5e9; }.primary { margin-top:28rpx; color:#fff; font-size:30rpx; line-height:88rpx; background:#07c160; border-radius:44rpx; }.progress { height:18rpx; overflow:hidden; background:#e2e8f0; border-radius:10rpx; }.progress-inner { height:100%; background:#0ea5e9; border-radius:10rpx; transition:width .3s; }.job-info { display:block; margin-top:18rpx; color:#64748b; font-size:23rpx; }.error { display:block; margin-top:16rpx; color:#dc2626; font-size:25rpx; }.video { width:100%; margin-top:22rpx; border-radius:12rpx; }
</style>
