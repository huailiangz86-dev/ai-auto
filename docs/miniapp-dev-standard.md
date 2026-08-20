# AI auto — 小程序开发标准

**Date:** 2026-08-20
**Version:** 1.0
**范围:** C端微信小程序 + 分享员后台（Uni-app）

---

## 1. 项目结构

```
apps/
├── customer-miniapp/          # C端小程序（Uni-app）
│   ├── src/
│   │   ├── pages/           # 页面
│   │   │   ├── home/        # 首页
│   │   │   ├── merchant/     # 商家详情
│   │   │   ├── wallet/      # 卡包
│   │   │   └── profile/     # 我的
│   │   ├── components/      # 通用组件
│   │   │   ├── merchant-card/
│   │   │   ├── coupon-card/
│   │   │   └── qr-display/
│   │   ├── api/             # API 调用层
│   │   ├── stores/          # 状态管理（Pinia）
│   │   ├── utils/           # 工具函数
│   │   └── styles/          # 全局样式
│   ├── static/
│   ├── package.json
│   └── manifest.json
│
└── agent-app/               # 分享员后台（Uni-app）
    └── src/
        ├── pages/           # 页面
        │   ├── dashboard/
        │   ├── coupons/
        │   ├── earnings/
        │   ├── content/
        │   └── profile/
        ├── components/
        ├── api/
        └── stores/
```

---

## 2. 页面规范

### 2.1 命名规范

页面目录与文件名使用 kebab-case：

```
pages/
├── home/
│   ├── index.vue           # 页面入口
│   └── index.config.ts     # 页面配置
├── merchant-detail/
│   └── index.vue
└── my-coupons/
    └── index.vue
```

### 2.2 页面配置

```typescript
// pages/home/index.config.ts
export default definePageConfig({
  navigationBarTitleText: '附近优惠',
  enablePullDownRefresh: true,
  onReachBottomDistance: 50,
  usingComponents: {
    'merchant-card': '/components/merchant-card/index',
  },
})
```

---

## 3. API 调用规范

### 3.1 API 层封装

```typescript
// api/http.ts
const BASE_URL = 'https://api.ai-auto.com/v1'

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  data?: Record<string, unknown>
  header?: Record<string, string>
}

export function request<T>(endpoint: string, options: RequestOptions = {}) {
  const token = uni.getStorageSync('access_token')

  return new Promise<T>((resolve, reject) => {
    uni.request({
      url: `${BASE_URL}${endpoint}`,
      method: options.method ?? 'GET',
      data: options.data,
      header: {
        'Content-Type': 'application/json',
        Authorization: token ? `Bearer ${token}` : '',
        ...options.header,
      },
      success: (res) => {
        if (res.statusCode === 200 && res.data.code === 0) {
          resolve(res.data.data)
        } else {
          reject(new Error(res.data.message ?? '请求失败'))
        }
      },
      fail: (err) => {
        uni.showToast({ title: '网络错误', icon: 'error' })
        reject(err)
      },
    })
  })
}
```

### 3.2 API 函数定义

```typescript
// api/coupon.ts
export const getNearbyCoupons = (params: {
  lat: number
  lng: number
  category?: string
  page?: number
  pageSize?: number
}) =>
  request<{ items: Coupon[]; pagination: Pagination }>(
    '/customer/coupons/feed',
    { method: 'GET', data: params },
  )

export const claimCoupon = (couponId: string, attributionAgentId?: string) =>
  request<CustomerCoupon>(`/customer/coupons/${couponId}/claim`, {
    method: 'POST',
    data: attributionAgentId
      ? { attribution_agent_id: attributionAgentId }
      : {},
  })
```

---

## 4. 组件规范

### 4.1 组件结构

```
components/
└── merchant-card/
    ├── index.vue          # 组件入口
    ├── index.config.ts   # 原生组件注册（可选）
    └── props.ts           # Props 类型定义
```

### 4.2 Props 类型定义

```typescript
// components/merchant-card/props.ts
export interface MerchantCardProps {
  merchant: {
    id: string
    name: string
    logo: string
    rating: number
    distance: number
    address: string
  }
  coupon: {
    id: string
    name: string
    discountAmount: number
    minPurchase?: number
    tags: string[]
  }
  claimed: boolean
  onClaim?: (couponId: string) => void
}
```

### 4.3 组件使用

```vue
<!-- pages/home/index.vue -->
<template>
  <merchant-card
    v-for="item in couponList"
    :key="item.couponId"
    :merchant="item.merchant"
    :coupon="item.coupon"
    :claimed="item.claimed"
    @claim="handleClaim"
  />
</template>

<script setup lang="ts">
const handleClaim = async (couponId: string) => {
  // 领券逻辑
}
</script>
```

---

## 5. 状态管理

### 5.1 Store 定义

```typescript
// stores/coupon.ts
import { defineStore } from 'pinia'

interface CouponStore {
  coupons: Coupon[]
  loading: boolean
  pagination: Pagination
}

export const useCouponStore = defineStore('coupon', {
  state: (): CouponStore => ({
    coupons: [],
    loading: false,
    pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
  }),

  actions: {
    async fetchNearby(params: FetchParams) {
      this.loading = true
      try {
        const data = await getNearbyCoupons(params)
        if (params.page === 1) {
          this.coupons = data.items
        } else {
          this.coupons.push(...data.items)
        }
        this.pagination = data.pagination
      } finally {
        this.loading = false
      }
    },

    async claimCoupon(couponId: string) {
      const coupon = this.coupons.find((c) => c.couponId === couponId)
      if (!coupon) return
      await claimCoupon(couponId, coupon.attributionAgentId)
      coupon.claimed = true
    },
  },
})
```

---

## 6. 微信特殊规范

### 6.1 登录流程

```typescript
// utils/auth.ts
export async function loginWithWeChat(): Promise<string> {
  // 1. 获取微信 code
  const { code } = await new Promise<{ code: string }>((resolve, reject) => {
    uni.login({
      provider: 'weixin',
      success: (res) => resolve(res as any),
      fail: reject,
    })
  })

  // 2. 用 code 换 token
  const data = await request<{ access_token: string }>(
    '/customer/auth/wechat/mini-login',
    {
      method: 'POST',
      data: { code },
    },
  )

  // 3. 存储 token
  uni.setStorageSync('access_token', data.access_token)

  return data.access_token
}
```

### 6.2 JSSDK 配置

```typescript
// utils/jssdk.ts
export async function configShareMenu(params: {
  title: string
  imageUrl: string
  query: string
}) {
  const { ticket } = await getJsapiTicket()

  uni.updateShareMenu({
    withShareTicket: true,
    templateInfo: {
      parameter: [
        { name: 'title', value: params.title },
        { name: 'imageUrl', value: params.imageUrl },
      ],
    },
    success: () => {
      // 分享信息已更新
    },
  })

  // 设置转发参数
  uni.showShareMenu({
    menus: ['shareAppMessage', 'shareTimeline'],
    success: () => {
      // 允许分享到好友和朋友圈
    },
  })
}
```

### 6.3 扫码核销

```typescript
// pages/redemption/index.vue
async function handleScan() {
  const result = await new Promise<string>((resolve, reject) => {
    uni.scanCode({
      success: (res) => resolve(res.result as string),
      fail: reject,
    })
  })

  // 解析小程序码参数，获取 couponCode
  const couponCode = extractCouponCode(result)
  // 调用核销接口
  await verifyWithCouponCode(couponCode)
}
```

---

## 7. 样式规范

### 7.1 单位

微信小程序使用 rpx（响应式像素）：

```css
/* 使用 rpx 而非 px，确保各机型适配 */
.container {
  padding: 24rpx;
  margin: 16rpx;
}

.button-primary {
  height: 88rpx;
  border-radius: 16rpx;
}
```

### 7.2 安全区域

```css
/* 适配 iPhone X 等有底部安全区域的机型 */
.page-bottom {
  padding-bottom: calc(96rpx + env(safe-area-inset-bottom));
}

.tab-bar {
  position: fixed;
  bottom: 0;
  padding-bottom: env(safe-area-inset-bottom);
}
```

---

## 8. 测试规范

### 8.1 组件测试

```typescript
// components/merchant-card/merchant-card.spec.ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import MerchantCard from './index.vue'

describe('MerchantCard', () => {
  it('renders merchant name correctly', () => {
    const wrapper = mount(MerchantCard, {
      props: {
        merchant: {
          id: '1',
          name: '老王火锅',
          logo: '',
          rating: 4.8,
          distance: 302,
          address: '',
        },
        coupon: { id: '1', name: '满100减20', discountAmount: 20, tags: [] },
        claimed: false,
      },
    })
    expect(wrapper.text()).toContain('老王火锅')
  })

  it('shows claimed state correctly', () => {
    const wrapper = mount(MerchantCard, {
      props: {
        merchant: {
          id: '1',
          name: '老王火锅',
          logo: '',
          rating: 4.8,
          distance: 302,
          address: '',
        },
        coupon: { id: '1', name: '满100减20', discountAmount: 20, tags: [] },
        claimed: true,
      },
    })
    expect(wrapper.find('.claim-btn').text()).toBe('已领取')
  })
})
```

---

## 9. 性能规范

### 9.1 图片优化

```vue
<!-- 使用 image 组件的 mode 属性 -->
<image :src="merchant.logo" mode="aspectFill" lazy-load />
```

### 9.2 长列表

超过 20 条数据使用虚拟列表或分页加载：

```typescript
// 下拉加载更多
onReachBottom(() => {
  if (!store.loading && store.pagination.page < store.pagination.totalPages) {
    store.fetchNearby({ page: store.pagination.page + 1 })
  }
})
```

---

## 10. 目录规范

| 目录          | 内容     | 规范                                             |
| ------------- | -------- | ------------------------------------------------ |
| `pages/`      | 页面     | 每个页面独立目录，含 index.vue + index.config.ts |
| `components/` | 通用组件 | 大驼峰命名，Props 类型独立文件                   |
| `api/`        | API 调用 | 按领域分文件（coupon.ts, merchant.ts）           |
| `stores/`     | 状态管理 | 一个 Store 一个文件                              |
| `utils/`      | 工具函数 | 纯函数，无副作用                                 |
| `styles/`     | 全局样式 | 变量定义 + 公共样式                              |

---

_本文档配合 `dev-standard.md` 开发规范总纲使用。_
