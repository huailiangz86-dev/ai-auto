<template>
  <view class="login-page">
    <view class="brand">
      <text class="logo">优</text>
      <text class="title">AI auto 优惠</text>
      <text class="subtitle">发现附近好优惠，领券到店即可使用</text>
    </view>
    <button
      class="login-button"
      open-type="getPhoneNumber"
      :loading="loading"
      @getphonenumber="login"
    >
      微信手机号授权登录
    </button>
    <text class="agreement">登录即表示你同意《用户服务协议》和《隐私政策》</text>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useAuthStore } from '../../stores/auth'

const loading = ref(false)

async function login(event: { detail?: { code?: string; errMsg?: string } }) {
  if (!event.detail?.code) {
    uni.showToast({ title: '需要手机号授权后才能登录', icon: 'none' })
    return
  }
  loading.value = true
  try {
    await useAuthStore().login(event.detail.code)
    uni.showToast({ title: '登录成功', icon: 'success' })
    uni.navigateBack()
  } catch (error) {
    uni.showModal({
      title: '暂时无法登录',
      content: error instanceof Error ? error.message : '请稍后重试。',
      showCancel: false,
    })
  } finally {
    loading.value = false
  }
}
</script>

<style scoped lang="scss">
.login-page {
  display: flex;
  flex-direction: column;
  min-height: calc(100vh - 80rpx);
  padding: 96rpx 48rpx 48rpx;
  background: #fff;
}
.brand {
  display: flex;
  flex-direction: column;
  align-items: center;
}
.logo {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 128rpx;
  height: 128rpx;
  color: #fff;
  font-size: 62rpx;
  font-weight: 700;
  background: #07c160;
  border-radius: 32rpx;
}
.title {
  margin-top: 30rpx;
  font-size: 42rpx;
  font-weight: 700;
}
.subtitle {
  margin-top: 20rpx;
  color: #999;
  font-size: 28rpx;
}
.login-button {
  width: 100%;
  margin-top: auto;
  color: #fff;
  font-size: 32rpx;
  line-height: 94rpx;
  background: #07c160;
  border-radius: 47rpx;
}
.agreement {
  margin-top: 28rpx;
  color: #999;
  font-size: 22rpx;
  text-align: center;
}
</style>
