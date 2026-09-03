<template>
  <view class="page-padding safe-bottom"
    ><view class="profile"
      ><view class="avatar">{{ profileName.slice(0, 1) || '我' }}</view
      ><view
        ><text class="name">{{ profileName }}</text
        ><text class="phone">{{ auth.profile?.phone || '登录后同步手机号' }}</text></view
      ><button v-if="!auth.isLoggedIn" class="login-link" size="mini" @tap="goLogin">
        去登录
      </button></view
    ><view class="creation-entry" @tap="goCreation"
      ><view><text class="creation-title">🤖 AI 创作工具</text><text class="creation-subtitle">生成推广内容，分享赚佣金</text></view
      ><text class="arrow">›</text></view
    ><view class="gamification-entry" @tap="goGamification"
      ><view><text class="creation-title">🎁 分享挑战</text><text class="creation-subtitle">攒积分、开盲盒、冲排行榜</text></view
      ><text class="arrow">›</text></view
    ><view class="menu"
      ><view class="menu-item" @tap="privacy"><text>隐私设置</text><text>›</text></view
      ><view class="menu-item"><text>关于 AI auto</text><text>›</text></view
      ><view v-if="auth.isLoggedIn" class="menu-item danger" @tap="logout"
        ><text>退出登录</text><text>›</text></view
      ></view
    ></view
  >
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useAuthStore } from '../../stores/auth'
const auth = useAuthStore()
const profileName = computed(() => auth.profile?.nickname || '微信用户')
function goLogin() {
  uni.navigateTo({ url: '/pages/login/index' })
}
function goCreation() {
  if (!auth.isLoggedIn) {
    uni.navigateTo({ url: '/pages/login/index' })
    return
  }
  uni.navigateTo({ url: '/pages/ai-creation/index' })
}
function goGamification() {
  if (!auth.isLoggedIn) { goLogin(); return }
  uni.navigateTo({ url: '/pages/gamification/index' })
}
function privacy() {
  uni.showModal({
    title: '隐私设置',
    content: '我们仅在你授权后获取定位信息，用于排序附近优惠。你可以在微信设置中随时关闭授权。',
    showCancel: false,
  })
}
function logout() {
  auth.clearSession()
  uni.showToast({ title: '已退出登录', icon: 'success' })
}
onShow(() => {
  if (auth.isLoggedIn) void auth.fetchProfile()
})
</script>

<style scoped lang="scss">
.profile {
  display: flex;
  align-items: center;
  gap: 22rpx;
  padding: 38rpx 28rpx;
  background: #fff;
  border-radius: 18rpx;
}
.avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100rpx;
  height: 100rpx;
  color: #fff;
  font-size: 40rpx;
  background: #07c160;
  border-radius: 50%;
}
.name,
.phone {
  display: block;
}
.name {
  font-size: 32rpx;
  font-weight: 600;
}
.phone {
  margin-top: 12rpx;
  color: #999;
  font-size: 24rpx;
}
.login-link {
  margin-left: auto;
  color: #07c160;
  font-size: 24rpx;
  background: #e8f8ee;
}
.menu {
  margin-top: 24rpx;
  overflow: hidden;
  background: #fff;
  border-radius: 18rpx;
}
.creation-entry {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 24rpx;
  padding: 30rpx 28rpx;
  color: #075985;
  background: #f0f9ff;
  border: 1rpx solid #bae6fd;
  border-radius: 18rpx;
}
.gamification-entry { display: flex; align-items: center; justify-content: space-between; margin-top: 18rpx; padding: 30rpx 28rpx; color: #9a3412; background: #fff7ed; border: 1rpx solid #fed7aa; border-radius: 18rpx; }
.creation-title,
.creation-subtitle {
  display: block;
}
.creation-title {
  font-size: 30rpx;
  font-weight: 600;
}
.creation-subtitle {
  margin-top: 8rpx;
  color: #64748b;
  font-size: 24rpx;
}
.arrow {
  color: #0284c7;
  font-size: 42rpx;
}
.menu-item {
  display: flex;
  justify-content: space-between;
  padding: 30rpx 28rpx;
  font-size: 28rpx;
  border-bottom: 1rpx solid #f2f2f2;
}
.menu-item:last-child {
  border-bottom: 0;
}
.danger {
  color: #fa5151;
}
</style>
