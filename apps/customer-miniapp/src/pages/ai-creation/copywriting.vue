<template>
  <view class="page-padding safe-bottom">
    <view class="notice">选择一张已领取的优惠券，AI 会将你的专属追踪链接写入文案。</view>
    <view class="panel">
      <text class="label">推广优惠券</text>
      <picker :range="couponNames" :value="couponIndex" @change="selectCoupon">
        <view class="picker">{{ selectedCoupon?.couponName || '请选择优惠券' }} <text>›</text></view>
      </picker>
    </view>
    <view class="panel">
      <text class="label">创作方向</text>
      <view class="chips"><text v-for="item in tones" :key="item" :class="['chip', { selected: tone === item }]" @tap="tone = item">{{ item }}</text></view>
      <textarea v-model="keywords" class="keywords" :maxlength="200" placeholder="补充想强调的卖点，例如：适合朋友聚餐、离地铁近" />
    </view>
    <button class="primary" :loading="generating" @tap="generate">生成 3 条推广文案</button>

    <view v-if="draft" class="results">
      <text class="results-title">挑选一条，确认后生成专属推广链接</text>
      <view v-for="option in draft.options" :key="option.index" :class="['option', { active: selectedIndex === option.index }]" @tap="selectedIndex = option.index">
        <text class="option-tone">{{ option.tone }}</text><text class="option-copy">{{ option.copy }}</text>
      </view>
      <button class="primary" :loading="confirming" @tap="confirm">确认这条文案</button>
    </view>

    <view v-if="confirmed" class="success">
      <text class="success-title">文案已生成，可直接分享</text>
      <text class="tracking">{{ confirmed.trackingUrl }}</text>
      <button class="secondary" @tap="copyLink">复制专属链接</button>
      <text class="success-hint">链接已绑定你的分享员账户；好友通过它领券或消费，佣金会自动追踪。</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { confirmCustomerCopywriting, generateCustomerCopywriting, getMyCoupons } from '../../api/customer'
import type { ConfirmedCopywriting, CopywritingDraft, CustomerCoupon } from '../../types/customer'

const coupons = ref<CustomerCoupon[]>([])
const couponIndex = ref(0)
const tone = ref('种草')
const keywords = ref('')
const draft = ref<CopywritingDraft | null>(null)
const selectedIndex = ref(0)
const confirmed = ref<ConfirmedCopywriting | null>(null)
const generating = ref(false)
const confirming = ref(false)
const tones = ['种草', '产品体验', '热情', '幽默']
const couponNames = computed(() => coupons.value.map((coupon: CustomerCoupon) => coupon.couponName))
const selectedCoupon = computed(() => coupons.value[couponIndex.value])

onLoad(async (query) => {
  try {
    const result = await getMyCoupons({ status: 'active', page: 1, pageSize: 50 })
    coupons.value = result.items
    const requestedCouponId = query?.couponId
    const requestedIndex = coupons.value.findIndex(
      (coupon: CustomerCoupon) => coupon.couponId === requestedCouponId,
    )
    if (requestedIndex >= 0) couponIndex.value = requestedIndex
  } catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : '加载优惠券失败', icon: 'none' })
  }
})

function selectCoupon(event: { detail: { value: string } }) {
  couponIndex.value = Number(event.detail.value)
  draft.value = null
  confirmed.value = null
}

async function generate() {
  if (!selectedCoupon.value) {
    uni.showToast({ title: '请先领取并选择一张优惠券', icon: 'none' })
    return
  }
  generating.value = true
  try {
    draft.value = await generateCustomerCopywriting({
      couponId: selectedCoupon.value.couponId,
      platform: 'wechat',
      tone: tone.value,
      count: 3,
      keywords: keywords.value || undefined,
    })
    selectedIndex.value = 0
    confirmed.value = null
  } catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : '生成失败，请重试', icon: 'none' })
  } finally {
    generating.value = false
  }
}

async function confirm() {
  if (!draft.value) return
  confirming.value = true
  try {
    confirmed.value = await confirmCustomerCopywriting({ draftId: draft.value.draftId, selectedIndex: selectedIndex.value })
    uni.showToast({ title: '已生成专属链接', icon: 'success' })
  } catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : '确认失败，请重试', icon: 'none' })
  } finally {
    confirming.value = false
  }
}

function copyLink() {
  if (!confirmed.value) return
  uni.setClipboardData({ data: confirmed.value.trackingUrl, success: () => uni.showToast({ title: '链接已复制', icon: 'success' }) })
}
</script>

<style scoped lang="scss">
.notice { padding: 22rpx 26rpx; color: #075985; font-size: 25rpx; line-height: 1.6; background: #f0f9ff; border-radius: 14rpx; }.panel,.results,.success { margin-top: 22rpx; padding: 28rpx; background:#fff; border-radius:18rpx; }.label,.results-title { display:block; margin-bottom:20rpx; font-size:29rpx; font-weight:600; }.picker { display:flex; justify-content:space-between; padding:24rpx; color:#444; background:#f8fafc; border-radius:12rpx; }.chips { display:flex; flex-wrap:wrap; gap:16rpx; }.chip { padding:12rpx 22rpx; color:#64748b; font-size:25rpx; background:#f1f5f9; border-radius:28rpx; }.chip.selected { color:#fff; background:#0ea5e9; }.keywords { box-sizing:border-box; width:100%; height:150rpx; margin-top:24rpx; padding:20rpx; font-size:26rpx; background:#f8fafc; border-radius:12rpx; }.primary,.secondary { margin-top:28rpx; color:#fff; font-size:30rpx; line-height:88rpx; background:#07c160; border-radius:44rpx; }.option { margin-top:18rpx; padding:22rpx; border:2rpx solid #e2e8f0; border-radius:14rpx; }.option.active { border-color:#07c160; background:#f0fdf4; }.option-tone,.option-copy { display:block; }.option-tone { color:#059669; font-size:23rpx; }.option-copy { margin-top:10rpx; font-size:26rpx; line-height:1.65; white-space:pre-wrap; }.success { background:#f0fdf4; }.success-title { display:block; color:#166534; font-size:30rpx; font-weight:600; }.tracking { display:block; margin-top:18rpx; padding:18rpx; color:#475569; font-size:22rpx; line-height:1.55; word-break:break-all; background:#fff; border-radius:10rpx; }.secondary { color:#07c160; background:#fff; border:1rpx solid #07c160; }.success-hint { display:block; margin-top:20rpx; color:#64748b; font-size:23rpx; line-height:1.6; }
</style>
