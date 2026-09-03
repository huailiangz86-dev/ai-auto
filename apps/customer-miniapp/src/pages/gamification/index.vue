<template>
  <view class="page-padding safe-bottom">
    <view class="hero"><text class="hero-title">分享挑战，快乐加倍</text><text class="points">{{ overview?.points.balance ?? 0 }} 积分</text><text class="hero-copy">累计获得 {{ overview?.points.totalEarned ?? 0 }} 积分 · 可开 {{ overview?.points.availableMysteryBoxes ?? 0 }} 个盲盒</text><button class="box-button" :disabled="!(overview?.points.availableMysteryBoxes)" :loading="opening" @tap="openBox">开启盲盒</button></view>
    <view class="section"><text class="section-title">分享挑战</text><view v-for="item in overview?.challenges" :key="item.challengeId" class="card"><view class="card-row"><text class="card-title">{{ item.title }}</text><text :class="['status', { done: item.completed }]">{{ item.completed ? '已完成' : `+${item.rewardPoints} 积分` }}</text></view><text class="description">{{ item.description }}</text><view class="progress"><view class="progress-inner" :style="{ width: `${Math.min(100, item.progress / item.targetShares * 100)}%` }" /></view><text class="progress-copy">已分享 {{ item.progress }}/{{ item.targetShares }} 次 · 完成可开盲盒</text></view><view v-if="!overview?.challenges.length" class="empty">暂无进行中的挑战，稍后再来看看。</view></view>
    <view class="section"><text class="section-title">积分好礼</text><view v-for="item in rewards" :key="item.rewardProductId" class="card reward"><view><text class="card-title">{{ item.name }}</text><text class="description">{{ item.description || '限量好礼，积分兑换' }}</text></view><button class="redeem" size="mini" @tap="redeem(item)">{{ item.pointsCost }} 积分</button></view></view>
    <view class="section"><text class="section-title">分享达人榜</text><view v-for="item in overview?.leaderboard" :key="item.agentId" class="rank"><text class="rank-number">{{ item.rank }}</text><text class="rank-name">{{ item.nickname }}</text><text>{{ item.invitedCustomers }} 位好友 · ¥{{ item.totalEarned }}</text></view></view>
  </view>
</template>

<script setup lang="ts">
import { onShow } from '@dcloudio/uni-app'
import { ref } from 'vue'
import { getGamificationOverview, getGamificationRewards, openMysteryBox, redeemGamificationReward } from '../../api/customer'
import type { GamificationOverview, RewardProduct } from '../../types/customer'
const overview = ref<GamificationOverview | null>(null)
const rewards = ref<RewardProduct[]>([])
const opening = ref(false)
async function load() { try { [overview.value, rewards.value] = await Promise.all([getGamificationOverview(), getGamificationRewards()]) } catch (error) { uni.showToast({ title: error instanceof Error ? error.message : '加载游戏中心失败', icon: 'none' }) } }
async function openBox() { opening.value = true; try { const result = await openMysteryBox(); uni.showModal({ title: result.guaranteed ? '保底奖励已解锁' : '恭喜获得奖励', content: `获得：${result.reward.name}`, showCancel: false }); await load() } catch (error) { uni.showToast({ title: error instanceof Error ? error.message : '开盲盒失败', icon: 'none' }) } finally { opening.value = false } }
async function redeem(item: RewardProduct) { try { await redeemGamificationReward(item.rewardProductId); uni.showToast({ title: '兑换成功', icon: 'success' }); await load() } catch (error) { uni.showToast({ title: error instanceof Error ? error.message : '兑换失败', icon: 'none' }) } }
onShow(() => { void load() })
</script>

<style scoped lang="scss">
.hero { padding:36rpx 30rpx; color:#fff; background:linear-gradient(135deg,#f97316,#ea580c); border-radius:20rpx; }.hero-title,.points,.hero-copy,.description,.progress-copy { display:block; }.hero-title { font-size:32rpx; font-weight:600; }.points { margin-top:18rpx; font-size:54rpx; font-weight:700; }.hero-copy { margin-top:8rpx; font-size:23rpx; opacity:.9; }.box-button { margin-top:26rpx; color:#9a3412; font-weight:600; background:#fff7ed; border-radius:38rpx; }.section { margin-top:34rpx; }.section-title { display:block; margin-bottom:18rpx; font-size:31rpx; font-weight:600; }.card { margin-top:16rpx; padding:26rpx; background:#fff; border-radius:18rpx; }.card-row,.reward,.rank { display:flex; align-items:center; justify-content:space-between; gap:18rpx; }.card-title { font-size:28rpx; font-weight:600; }.status { color:#ea580c; font-size:23rpx; }.status.done { color:#16a34a; }.description { margin-top:10rpx; color:#64748b; font-size:24rpx; }.progress { height:14rpx; margin-top:22rpx; overflow:hidden; background:#ffedd5; border-radius:8rpx; }.progress-inner { height:100%; background:#f97316; }.progress-copy { margin-top:10rpx; color:#94a3b8; font-size:22rpx; }.redeem { margin:0; color:#fff; font-size:22rpx; background:#f97316; border-radius:28rpx; white-space:nowrap; }.rank { min-height:70rpx; padding:0 12rpx; font-size:23rpx; }.rank-number { width:38rpx; color:#f97316; font-size:28rpx; font-weight:700; }.rank-name { flex:1; font-size:26rpx; }.empty { padding:32rpx; color:#94a3b8; text-align:center; background:#fff; border-radius:18rpx; }
</style>
