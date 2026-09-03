<template>
  <view class="page-padding safe-bottom">
    <view class="notice">生成的海报会附带你的专属二维码；朋友扫码领券后，后续消费佣金会归入你的账户。</view>
    <view class="panel"><text class="label">推广优惠券</text><picker :range="couponNames" :value="couponIndex" @change="selectCoupon"><view class="picker">{{ selectedCoupon?.couponName || '请选择优惠券' }} <text>›</text></view></picker></view>
    <view class="panel"><text class="label">海报风格</text><view class="chips"><text v-for="item in styles" :key="item.value" :class="['chip', { selected: style === item.value }]" @tap="style = item.value">{{ item.label }}</text></view></view>
    <button class="primary" :loading="generating" @tap="generate">生成推广海报</button>
    <view v-if="result" class="results"><text class="result-title">已生成 {{ result.variants.length }} 张海报</text><view v-for="variant in result.variants" :key="variant.index" class="poster"><image :src="variant.imageUrl" mode="widthFix" class="poster-image" /><text>{{ variant.style }} · {{ variant.aspectRatio }}</text></view><button class="secondary" @tap="copyLink">复制专属推广链接</button></view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { generateCustomerPoster, getMyCoupons } from '../../api/customer'
import type { CustomerCoupon, PosterResult } from '../../types/customer'
const coupons = ref<CustomerCoupon[]>([]); const couponIndex = ref(0); const style = ref('promotional'); const generating = ref(false); const result = ref<PosterResult | null>(null)
const styles = [{ label: '促销醒目', value: 'promotional' }, { label: '简约高级', value: 'minimal' }, { label: '温暖生活', value: 'warm' }]
const couponNames = computed(() => coupons.value.map((coupon: CustomerCoupon) => coupon.couponName)); const selectedCoupon = computed(() => coupons.value[couponIndex.value])
onLoad(async (query) => { try { const response = await getMyCoupons({ status: 'active', page: 1, pageSize: 50 }); coupons.value = response.items; const index = coupons.value.findIndex((coupon: CustomerCoupon) => coupon.couponId === query?.couponId); if (index >= 0) couponIndex.value = index } catch (error) { uni.showToast({ title: error instanceof Error ? error.message : '加载优惠券失败', icon: 'none' }) } })
function selectCoupon(event: { detail: { value: string } }) { couponIndex.value = Number(event.detail.value); result.value = null }
async function generate() { if (!selectedCoupon.value) { uni.showToast({ title: '请先领取并选择一张优惠券', icon: 'none' }); return }; generating.value = true; try { result.value = await generateCustomerPoster({ couponId: selectedCoupon.value.couponId, platform: 'wechat', style: style.value, colorScheme: 'warm', variantCount: 3 }); uni.showToast({ title: '海报已生成', icon: 'success' }) } catch (error) { uni.showToast({ title: error instanceof Error ? error.message : '生成失败，请重试', icon: 'none' }) } finally { generating.value = false } }
function copyLink() { if (!result.value) return; uni.setClipboardData({ data: result.value.trackingUrl, success: () => uni.showToast({ title: '链接已复制', icon: 'success' }) }) }
</script>

<style scoped lang="scss">
.notice { padding:22rpx 26rpx; color:#075985; font-size:25rpx; line-height:1.6; background:#f0f9ff; border-radius:14rpx; }.panel,.results { margin-top:22rpx; padding:28rpx; background:#fff; border-radius:18rpx; }.label,.result-title { display:block; margin-bottom:20rpx; font-size:29rpx; font-weight:600; }.picker { display:flex; justify-content:space-between; padding:24rpx; color:#444; background:#f8fafc; border-radius:12rpx; }.chips { display:flex; flex-wrap:wrap; gap:16rpx; }.chip { padding:12rpx 22rpx; color:#64748b; font-size:25rpx; background:#f1f5f9; border-radius:28rpx; }.chip.selected { color:#fff; background:#0ea5e9; }.primary,.secondary { margin-top:28rpx; color:#fff; font-size:30rpx; line-height:88rpx; background:#07c160; border-radius:44rpx; }.poster { margin-top:22rpx; color:#64748b; font-size:23rpx; }.poster-image { display:block; width:100%; margin-bottom:12rpx; background:#f1f5f9; border-radius:12rpx; }.secondary { color:#07c160; background:#fff; border:1rpx solid #07c160; }
</style>
