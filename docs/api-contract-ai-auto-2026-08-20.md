# AI auto — API 契约文档

**Date:** 2026-08-20
**Version:** 1.0
**Status:** Draft
**Base URL:** `https://api.ai-auto.com/v1`

---

## 目录

1. [概述与认证](#1-概述与认证)
2. [商户 API](#2-商户-api)
3. [分享员 API](#3-分享员-api)
4. [C端用户 API](#4-c端用户-api)
5. [核销回调 API](#5-核销回调-api)
6. [AI Agent API](#6-ai-agent-api)
7. [运营 API](#7-运营-api)
8. [公共数据结构](#8-公共数据结构)
9. [错误码](#9-错误码)

---

## 1. 概述与认证

### 1.1 认证方式

所有 API（除公开接口外）均需要 Bearer Token 认证：

```
Authorization: Bearer <access_token>
```

Token 类型：

- `access_token`：短期令牌，15分钟有效
- `refresh_token`：长期令牌，7天有效，用于刷新 access_token

### 1.2 公共接口（无需认证）

```
POST /v1/auth/phone/send-code      # 发送短信验证码
POST /v1/auth/phone/verify        # 验证短信码+登录/注册
POST /v1/auth/wechat/mini-login   # 微信小程序登录
GET  /v1/public/coupons           # 公开券列表（附近优惠）
GET  /v1/public/merchants/:id     # 商家详情（公开）
GET  /v1/health                   # 健康检查
```

### 1.3 角色与权限

| 角色       | Role ID          | 权限范围                  |
| ---------- | ---------------- | ------------------------- |
| 商户管理员 | `merchant_admin` | 自家商户所有数据          |
| 商户店员   | `merchant_staff` | 核销/查看，无配置权限     |
| 分享员     | `agent`          | 个人收益/内容，无商户数据 |
| C端用户    | `customer`       | 个人领券/核销/钱包        |
| 运营管理员 | `admin`          | 全平台数据                |
| 超级管理员 | `super_admin`    | 全平台+系统配置           |

### 1.4 全局请求头

```
Content-Type: application/json
Authorization: Bearer <token>
X-Request-ID: <uuid>           # 请求追踪 ID
X-Merchant-Key: <api_key>      # 商户 API Key（商户接口专用）
X-Signature: sha256=...         # 回调签名（核销回调专用）
X-Timestamp: <unix_timestamp>  # 时间戳（回调签名用）
X-Nonce: <uuid>                # 随机数（防重放）
```

### 1.5 全局响应格式

```json
// 成功
{
  "code": 0,
  "message": "success",
  "data": { ... }
}

// 分页响应
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [...],
    "pagination": {
      "page": 1,
      "page_size": 20,
      "total": 100,
      "total_pages": 5
    }
  }
}

// 错误
{
  "code": 1001,
  "message": "Invalid token",
  "data": null
}
```

---

## 2. 商户 API

**Base Path:** `/v1/merchant`
**认证:** `merchant_admin` / `merchant_staff`

---

### 2.1 商户入驻

#### POST /v1/merchant/register — 提交入驻申请

**请求体：**

```json
{
  "merchant_name": "老王火锅（望京SOHO店）",
  "contact_name": "王老板",
  "phone": "13812345678",
  "verification_code": "123456",
  "merchant_type": "enterprise", // enterprise | individual | personal
  "industry": "catering", // 行业分类
  "business_license_no": "91110105MA01XXX",
  "address": "北京市朝阳区望京SOHO T3 1层",
  "latitude": 39.984,
  "longitude": 116.472,
  "store_name": "望京SOHO店",
  "platform_authorizations": ["wechat", "douyin"] // 选填
}
```

**响应：**

```json
{
  "code": 0,
  "data": {
    "merchant_id": "M-20260820001",
    "status": "pending_review",
    "estimated_review_days": 2
  }
}
```

#### GET /v1/merchant/profile — 获取商户信息

**响应：**

```json
{
  "code": 0,
  "data": {
    "merchant_id": "M-20260820001",
    "merchant_name": "老王火锅（望京SOHO店）",
    "contact_name": "王老板",
    "phone": "138****5678",
    "email": null,
    "status": "active", // pending_review | active | suspended
    "created_at": "2026-08-20T10:00:00Z",
    "subscription": {
      "plan": "annual",
      "status": "active",
      "expires_at": "2027-08-20T00:00:00Z",
      "stores_used": 1,
      "stores_limit": 3
    },
    "api_key": "app_•••••••••••••••",
    "api_secret_hint": "已设置"
  }
}
```

#### PUT /v1/merchant/profile — 更新商户信息

```json
{
  "contact_name": "王老板",
  "email": "wang@example.com"
}
```

#### POST /v1/merchant/api-key/regenerate — 重置 API Key

**请求体：**

```json
{
  "type": "api_key" // api_key | api_secret
}
```

**响应：**

```json
{
  "code": 0,
  "data": {
    "api_key": "app_new_key_xxx",
    "api_secret": "sec_new_xxx"
  }
}
```

⚠️ 重置后旧 Key/Secret 立即失效。

---

### 2.2 门店管理

#### GET /v1/merchant/stores — 门店列表

**Query:** `?status=active&page=1&page_size=20`

```json
{
  "code": 0,
  "data": {
    "items": [
      {
        "store_id": "S-20260820001",
        "store_name": "望京SOHO店",
        "address": "北京市朝阳区望京SOHO T3 1层",
        "status": "active",
        "agent_count": 23,
        "created_at": "2026-08-20T10:00:00Z"
      }
    ],
    "pagination": { "page": 1, "page_size": 20, "total": 1, "total_pages": 1 }
  }
}
```

#### POST /v1/merchant/stores — 新增门店

```json
{
  "store_name": "五道口店",
  "address": "北京市海淀区五道口购物中心B1",
  "latitude": 39.989,
  "longitude": 116.312,
  "business_hours": {
    "open": "09:00",
    "close": "22:00"
  },
  "phone": "010-12345678",
  "photos": ["https://cdn.example.com/photo1.jpg"]
}
```

#### PUT /v1/merchant/stores/:store_id — 更新门店

#### DELETE /v1/merchant/stores/:store_id — 删除门店

⚠️ 有核销记录的门店不可删除，只能暂停。

---

### 2.3 活动管理

#### GET /v1/merchant/campaigns — 活动列表

**Query:** `?status=running&page=1&page_size=10`

```json
{
  "code": 0,
  "data": {
    "items": [
      {
        "campaign_id": "C-20260820001",
        "campaign_name": "七夕满减活动",
        "campaign_type": "discount", // discount | cash | combo
        "status": "running", // draft | scheduled | running | paused | ended
        "start_at": "2026-08-20T00:00:00Z",
        "end_at": "2026-08-31T23:59:59Z",
        "stats": {
          "views": 23456,
          "claimed": 892,
          "redeemed": 156,
          "commission_paid": 1248.0
        }
      }
    ],
    "pagination": { "page": 1, "page_size": 10, "total": 3, "total_pages": 1 }
  }
}
```

#### POST /v1/merchant/campaigns — 创建活动

```json
{
  "campaign_name": "七夕满减活动",
  "campaign_type": "discount",
  "start_at": "2026-08-20T00:00:00Z",
  "end_at": "2026-08-31T23:59:59Z",
  "target_audience": "all", // all | new_customer | returning
  "coupon": {
    "discount_amount": 20,
    "min_purchase_amount": 100,
    "per_user_limit": 1,
    "total_limit": null, // null=不限量
    "validity_type": "days_after_claim", // days_after_claim | date_range
    "validity_days": 7
  },
  "commission_per_redemption": 8.0
}
```

**响应：**

```json
{
  "code": 0,
  "data": {
    "campaign_id": "C-20260820002",
    "status": "draft"
  }
}
```

#### PUT /v1/merchant/campaigns/:campaign_id — 更新活动

#### POST /v1/merchant/campaigns/:campaign_id/publish — 发布活动

#### POST /v1/merchant/campaigns/:campaign_id/pause — 暂停活动

#### POST /v1/merchant/campaigns/:campaign_id/resume — 恢复活动

#### GET /v1/merchant/campaigns/:campaign_id/stats — 活动统计

```json
{
  "code": 0,
  "data": {
    "campaign_id": "C-20260820001",
    "date_range": {
      "start": "2026-08-20",
      "end": "2026-08-20"
    },
    "total": {
      "views": 23456,
      "unique_views": 12345,
      "claimed": 892,
      "redeemed": 156,
      "redemption_rate": 17.49,
      "commission_paid": 1248.0,
      "gmv": 15600.0
    },
    "daily": [
      {
        "date": "2026-08-20",
        "views": 5000,
        "claimed": 200,
        "redeemed": 45,
        "commission": 360.0
      }
    ],
    "top_agents": [
      {
        "agent_id": "A-001",
        "name": "小美妈妈",
        "redeemed": 12,
        "commission": 96.0
      }
    ]
  }
}
```

---

### 2.4 分享员管理

#### GET /v1/merchant/agents — 分享员列表

**Query:** `?level=gold&status=active&page=1&page_size=20`

```json
{
  "code": 0,
  "data": {
    "items": [
      {
        "agent_id": "A-20260820001",
        "name": "小美妈妈",
        "phone": "138****8888",
        "level": "silver",
        "level_index": 2,
        "status": "active",
        "stats": {
          "today_redemptions": 3,
          "total_redemptions": 156,
          "today_commission": 24.0,
          "total_commission": 1234.0,
          "valid_customers": 45,
          "last_active_at": "2026-08-20T12:32:00Z"
        }
      }
    ],
    "pagination": { "page": 1, "page_size": 20, "total": 23, "total_pages": 2 }
  }
}
```

#### GET /v1/merchant/agents/:agent_id — 分享员详情

```json
{
  "code": 0,
  "data": {
    "agent_id": "A-20260820001",
    "name": "小美妈妈",
    "phone": "138****8888",
    "level": "silver",
    "level_index": 2,
    "registered_at": "2026-08-15T10:00:00Z",
    "status": "active",
    "platforms": {
      "wechat": "bound",
      "douyin": "not_bound",
      "xiaohongshu": "not_bound"
    },
    "stats": {
      "today_redemptions": 3,
      "total_redemptions": 156,
      "today_commission": 24.0,
      "total_commission": 1234.0,
      "valid_customers": 45,
      "avg_commission_per_redemption": 7.91
    },
    "activity_score": 45,
    "last_active_at": "2026-08-20T12:32:00Z"
  }
}
```

#### GET /v1/merchant/agents/:agent_id/customers — 分享员客户列表

**Query:** `?page=1&page_size=50`

#### GET /v1/merchant/agents/:agent_id/redemptions — 分享员核销记录

#### POST /v1/merchant/agents/:agent_id/suspend — 暂停分享员

```json
{
  "reason": "可疑刷单行为",
  "suspend_until": null // null=永久暂停
}
```

#### POST /v1/merchant/agents/:agent_id/resume — 恢复分享员

#### GET /v1/merchant/recruitment/stats — 招募统计

```json
{
  "code": 0,
  "data": {
    "date_range": { "start": "2026-08-14", "end": "2026-08-20" },
    "summary": {
      "total_exposure": 2345,
      "new_agents": 5,
      "bound_agents": 3,
      "active_agents": 2
    },
    "funnel": {
      "exposure": 2345,
      "registrations": 45,
      "binding_rate": 51.11,
      "active_rate": 66.67
    },
    "by_source": [
      { "source": "share_link", "count": 1890, "rate": 76.3 },
      { "source": "qr_code", "count": 312, "rate": 13.3 },
      { "source": "sms", "count": 143, "rate": 10.4 }
    ],
    "daily": [
      { "date": "2026-08-14", "new_agents": 3 },
      { "date": "2026-08-15", "new_agents": 5 }
    ]
  }
}
```

---

### 2.5 核销

#### POST /v1/merchant/verify — 核销券（商家扫码）

**Header:** `X-Merchant-Key: <api_key>`
**签名验证:** `X-Signature: sha256=hmac(data, secret)`

```json
{
  "coupon_code": "ABC123456",
  "transaction_amount": 156.0,
  "store_id": "S-20260820001"
}
```

**响应：**

```json
{
  "code": 0,
  "data": {
    "redemption_id": "R-20260820001",
    "coupon_code": "ABC123456",
    "coupon_name": "七夕满100减20",
    "discount_amount": 20.0,
    "transaction_amount": 156.0,
    "actual_payment": 136.0,
    "commission_amount": 8.0,
    "agent_id": "A-20260820001",
    "agent_name": "小美妈妈",
    "customer_id": "U-20260820001",
    "status": "confirmed", // confirmed | pending | failed
    "confirmed_at": "2026-08-20T13:42:00Z",
    "72h_deadline": "2026-08-23T13:42:00Z" // 72小时确认截止时间
  }
}
```

**错误码：**

- `40103` — 券码无效
- `40104` — 券码已使用
- `40105` — 券码已过期
- `40106` — 不适用当前门店
- `40107` — 不满足消费门槛

#### POST /v1/merchant/verify/confirm — 72小时确认核销

商家系统回调确认后调用。

```json
{
  "redemption_id": "R-20260820001",
  "confirmed": true,
  "actual_transaction_amount": 156.0 // 实际交易金额（可选）
}
```

#### GET /v1/merchant/redemptions — 核销记录

**Query:** `?date_from=2026-08-01&date_to=2026-08-20&status=confirmed&page=1&page_size=20`

```json
{
  "code": 0,
  "data": {
    "summary": {
      "total_count": 156,
      "total_amount": 15600.0,
      "total_commission": 1248.0,
      "total_discount": 3120.0
    },
    "items": [
      {
        "redemption_id": "R-20260820001",
        "coupon_code": "ABC123456",
        "coupon_name": "七夕满100减20",
        "store_name": "望京SOHO店",
        "transaction_amount": 156.0,
        "discount_amount": 20.0,
        "commission_amount": 8.0,
        "agent_name": "小美妈妈",
        "status": "confirmed",
        "redeemed_at": "2026-08-20T13:42:00Z",
        "confirmed_at": "2026-08-20T14:00:00Z"
      }
    ],
    "pagination": { "page": 1, "page_size": 20, "total": 156, "total_pages": 8 }
  }
}
```

---

### 2.6 钱包与订阅

#### GET /v1/merchant/wallet — 商户钱包

```json
{
  "code": 0,
  "data": {
    "balance": 5000.0,
    "pending_commission": 320.0, // 72h 内待确认
    "total_commission_spent": 1248.0,
    "budget": {
      "monthly_limit": 10000.0,
      "monthly_spent": 1248.0,
      "alert_threshold": 0.8
    },
    "auto_recharge": {
      "enabled": true,
      "threshold": 1000.0,
      "amount": 5000.0
    }
  }
}
```

#### POST /v1/merchant/wallet/recharge — 充值佣金预算

```json
{
  "amount": 5000.0,
  "payment_method": "wechat", // wechat | alipay | bank_transfer
  "callback_url": "https://merchant.example.com/callback"
}
```

#### GET /v1/merchant/subscription — 订阅信息

```json
{
  "code": 0,
  "data": {
    "subscription_id": "SUB-20260820001",
    "plan": "annual",
    "status": "active",
    "expires_at": "2027-08-20T00:00:00Z",
    "stores_used": 1,
    "stores_limit": 3,
    "features": ["unlimited_agents", "ai_copy", "multi_platform"],
    "ai_copy_remaining": 95, // 本月剩余 AI 文案次数
    "ai_copy_limit": 100
  }
}
```

#### POST /v1/merchant/subscription/renew — 续费

---

## 3. 分享员 API

**Base Path:** `/v1/agent`
**认证:** `agent`

---

### 3.1 认证

#### POST /v1/agent/auth/phone/send-code

```json
{
  "phone": "13812345678",
  "purpose": "login"
}
```

#### POST /v1/agent/auth/phone/verify

```json
{
  "phone": "13812345678",
  "code": "123456"
}
```

**响应：**

```json
{
  "code": 0,
  "data": {
    "access_token": "eyJ...",
    "refresh_token": "eyJ...",
    "expires_in": 900,
    "is_new_user": false,
    "agent_id": "A-20260820001"
  }
}
```

---

### 3.2 仪表盘

#### GET /v1/agent/dashboard — 首页数据

```json
{
  "code": 0,
  "data": {
    "agent": {
      "agent_id": "A-20260820001",
      "name": "小美妈妈",
      "level": "silver",
      "level_index": 2,
      "level_multiplier": 1.1
    },
    "earnings": {
      "total": 8234.56,
      "pending": 320.0, // T+3 待结算
      "withdrawable": 7914.56,
      "today": 45.2,
      "this_week": 234.5,
      "this_month": 1234.56
    },
    "stats": {
      "today_redemptions": 3,
      "today_views": 234,
      "valid_customers": 50
    },
    "level_progress": {
      "current": 50,
      "next_threshold": 100,
      "next_level": "gold",
      "percentage": 50
    }
  }
}
```

---

### 3.3 券推广

#### GET /v1/agent/coupons — 可推广券列表

**Query:** `?category=catering&page=1&page_size=20`

```json
{
  "code": 0,
  "data": {
    "items": [
      {
        "coupon_id": "CP-20260820001",
        "campaign_id": "C-20260820001",
        "merchant": {
          "merchant_id": "M-20260820001",
          "name": "老王火锅（望京SOHO店）",
          "logo": "https://cdn.example.com/logo.jpg"
        },
        "coupon_name": "七夕满100减20",
        "discount_amount": 20.0,
        "min_purchase_amount": 100,
        "commission": 8.0,
        "commission_rate": 0.4,
        "claimed_count": 892,
        "remaining_count": null,
        "expires_at": "2026-08-31T23:59:59Z",
        "competitiveness": 78 // 竞争力指数 0-100
      }
    ],
    "pagination": { "page": 1, "page_size": 20, "total": 50, "total_pages": 3 }
  }
}
```

---

### 3.4 收益明细

#### GET /v1/agent/earnings — 收益列表

**Query:** `?status=settled&page=1&page_size=20`

```json
{
  "code": 0,
  "data": {
    "summary": {
      "total": 8234.56,
      "settled": 7914.56,
      "pending": 320.0,
      "withdrawn": 6000.0
    },
    "items": [
      {
        "redemption_id": "R-20260820001",
        "merchant_name": "老王火锅（望京SOHO店）",
        "coupon_name": "七夕满100减20",
        "transaction_amount": 100.0,
        "commission": 8.0,
        "commission_rate": 0.8,
        "status": "pending", // pending | settled | withdrawn
        "estimated_settlement_at": "2026-08-23T13:42:00Z",
        "settled_at": null,
        "redeemed_at": "2026-08-20T13:42:00Z"
      }
    ],
    "pagination": { "page": 1, "page_size": 20, "total": 100, "total_pages": 5 }
  }
}
```

#### GET /v1/agent/earnings/stats — 收益统计

**Query:** `?period=monthly&group_by=merchant`

```json
{
  "code": 0,
  "data": {
    "period": {
      "start": "2026-08-01",
      "end": "2026-08-20"
    },
    "total": 1234.56,
    "change_rate": 0.18,
    "by_merchant": [
      {
        "merchant_id": "M-001",
        "name": "老王火锅",
        "amount": 839.0,
        "rate": 0.68
      }
    ],
    "daily": [
      { "date": "2026-08-01", "amount": 45.2 },
      { "date": "2026-08-02", "amount": 32.1 }
    ]
  }
}
```

---

### 3.5 提现

#### GET /v1/agent/wallet — 钱包

```json
{
  "code": 0,
  "data": {
    "balance": 7914.56,
    "pending": 320.0,
    "frozen": 0.0,
    "payment_methods": [
      {
        "type": "wechat",
        "name": "微信收款",
        "account": "wx_•••••88",
        "is_default": true
      },
      {
        "type": "bank_card",
        "name": "建设银行 ****1234",
        "is_default": false
      }
    ]
  }
}
```

#### POST /v1/agent/wallet/withdraw — 申请提现

```json
{
  "amount": 1000.0,
  "payment_method_type": "wechat" // wechat | bank_card
}
```

**响应：**

```json
{
  "code": 0,
  "data": {
    "withdrawal_id": "WD-20260820001",
    "amount": 1000.0,
    "payment_method": "wechat",
    "status": "processing",
    "created_at": "2026-08-20T14:00:00Z",
    "estimated_arrival_at": "2026-08-20T23:59:59Z"
  }
}
```

**限制：** 最低 ¥10，最高不超过可提现余额

#### GET /v1/agent/wallet/withdrawals — 提现记录

#### POST /v1/agent/wallet/payment-methods — 绑定收款方式

**微信：**

```json
{
  "type": "wechat",
  "wechat_openid": "oxXXX"
}
```

**银行卡：**

```json
{
  "type": "bank_card",
  "card_number": "6222021234567890",
  "bank_name": "建设银行",
  "branch_name": "北京望京支行",
  "phone": "13812345678",
  "verification_code": "123456"
}
```

---

### 3.6 等级

#### GET /v1/agent/level — 我的等级

```json
{
  "code": 0,
  "data": {
    "level": "silver",
    "level_index": 2,
    "level_multiplier": 1.1,
    "valid_customers": 50,
    "total_earnings": 8234.56,
    "registered_at": "2026-08-15T10:00:00Z",
    "progress": {
      "current": 50,
      "next_threshold": 100,
      "next_level": "gold",
      "percentage": 50
    },
    "levels": [
      { "level": "bronze", "threshold": 0, "multiplier": 1.0 },
      { "level": "silver", "threshold": 11, "multiplier": 1.1 },
      { "level": "gold", "threshold": 51, "multiplier": 1.2 },
      { "level": "diamond", "threshold": 201, "multiplier": 1.5 },
      { "level": "king", "threshold": 501, "multiplier": 2.0 }
    ]
  }
}
```

---

### 3.7 内容与分发

#### GET /v1/agent/contents — 我的发布内容

**Query:** `?status=published&page=1&page_size=20`

```json
{
  "code": 0,
  "data": {
    "items": [
      {
        "content_id": "CT-20260820001",
        "content_type": "text", // text | image | video
        "platforms": ["wechat_moment", "douyin"],
        "status": "published",
        "campaign": {
          "campaign_id": "C-20260820001",
          "coupon_id": "CP-20260820001",
          "merchant_name": "老王火锅"
        },
        "stats": {
          "views": 234,
          "clicks": 18,
          "claimed": 3,
          "earnings": 24.0
        },
        "created_at": "2026-08-20T13:42:00Z",
        "expires_at": "2026-08-27T13:42:00Z"
      }
    ],
    "pagination": { "page": 1, "page_size": 20, "total": 10, "total_pages": 1 }
  }
}
```

#### POST /v1/agent/contents/generate — AI 生成内容

```json
{
  "coupon_id": "CP-20260820001",
  "content_type": "text", // text | image | video
  "platforms": ["wechat_moment"],
  "style": "casual", // enthusiastic | casual | professional
  "extra_requirements": "添加七夕话题标签"
}
```

**响应：**

```json
{
  "code": 0,
  "data": {
    "generation_id": "G-20260820001",
    "status": "generating",
    "estimated_cost": 0.12,
    "estimated_duration_seconds": 5
  }
}
```

#### GET /v1/agent/contents/generate/:generation_id — 获取生成结果

```json
{
  "code": 0,
  "data": {
    "generation_id": "G-20260820001",
    "status": "completed", // generating | completed | failed
    "results": [
      {
        "content": "🔥老王火锅七夕特惠🔥\n满100减20，全场通用！\n不来就亏了～ 👇\n📍望京SOHO T3 1层",
        "platform": "wechat_moment",
        "word_count": 48,
        "estimated_reads": "1200-2500"
      }
    ],
    "actual_cost": 0.12,
    "generated_at": "2026-08-20T13:43:00Z"
  }
}
```

#### POST /v1/agent/contents/publish — 发布内容

```json
{
  "content_id": "CT-20260820001",
  "platforms": ["wechat_moment"],
  "edited_content": "🔥老王火锅七夕特惠🔥..."
}
```

#### POST /v1/agent/platforms/bind — 绑定平台账号

```json
{
  "platform": "douyin",
  "auth_code": "xxx" // OAuth 授权码
}
```

---

## 4. C端用户 API

**Base Path:** `/v1/customer`
**认证:** `customer`（微信小程序用户）

---

### 4.1 认证

#### POST /v1/customer/auth/wechat/mini-login

```json
{
  "code": "微信登录 code"
}
```

**响应：**

```json
{
  "code": 0,
  "data": {
    "access_token": "eyJ...",
    "refresh_token": "eyJ...",
    "expires_in": 900,
    "is_new_user": true,
    "user_id": "U-20260820001"
  }
}
```

---

### 4.2 发现

#### GET /v1/customer/coupons/feed — 附近优惠

**Query:** `?lat=39.984&lng=116.472&category=catering&page=1&page_size=20`

```json
{
  "code": 0,
  "data": {
    "items": [
      {
        "coupon_id": "CP-20260820001",
        "merchant": {
          "merchant_id": "M-20260820001",
          "name": "老王火锅（望京SOHO店）",
          "logo": "https://cdn.example.com/logo.jpg",
          "rating": 4.8,
          "distance": 302,
          "address": "朝阳区望京SOHO T3 1层"
        },
        "coupon_name": "七夕满100减20",
        "discount_amount": 20.0,
        "min_purchase_amount": 100,
        "claimed_count": 892,
        "tags": ["hot", "discount"],
        "claimed": false,
        "expires_at": "2026-08-31T23:59:59Z"
      }
    ],
    "pagination": { "page": 1, "page_size": 20, "total": 50, "total_pages": 3 }
  }
}
```

#### GET /v1/customer/merchants/:merchant_id — 商家详情

#### GET /v1/customer/coupons/:coupon_id — 券详情

```json
{
  "code": 0,
  "data": {
    "coupon_id": "CP-20260820001",
    "merchant": {
      "merchant_id": "M-20260820001",
      "name": "老王火锅（望京SOHO店）",
      "rating": 4.8,
      "review_count": 1234,
      "distance": 302,
      "address": "朝阳区望京SOHO T3 1层",
      "phone": "138****8888"
    },
    "coupon_name": "七夕满100减20",
    "discount_amount": 20.0,
    "min_purchase_amount": 100,
    "valid_from": "2026-08-20T00:00:00Z",
    "valid_until": "2026-08-31T23:59:59Z",
    "usage_rules": ["满100元可用", "限到店消费使用", "不与其他优惠同用"],
    "claimed": false,
    "claimed_at": null,
    "redeemed": false
  }
}
```

---

### 4.3 领券与核销

#### POST /v1/customer/coupons/:coupon_id/claim — 领取券

**Query:** `?attribution_agent_id=A-20260820001`（从分享链接进入时自动带）

```json
{
  "code": 0,
  "data": {
    "customer_coupon_id": "CU-20260820001",
    "coupon_code": "ABC123456",
    "valid_from": "2026-08-20T00:00:00Z",
    "valid_until": "2026-08-27T00:00:00Z",
    "status": "claimed"
  }
}
```

#### GET /v1/customer/coupons — 我的卡包

**Query:** `?status=claimed`

```json
{
  "code": 0,
  "data": {
    "tabs": {
      "claimed": 3,
      "used": 1,
      "expired": 1
    },
    "items": [
      {
        "customer_coupon_id": "CU-20260820001",
        "coupon_code": "ABC123456",
        "merchant_name": "老王火锅（望京SOHO店）",
        "coupon_name": "七夕满100减20",
        "discount_amount": 20.0,
        "status": "claimed",
        "valid_until": "2026-08-27T23:59:59Z",
        "days_remaining": 7
      }
    ],
    "pagination": { "page": 1, "page_size": 20, "total": 3, "total_pages": 1 }
  }
}
```

#### GET /v1/customer/coupons/:customer_coupon_id/redemption — 核销码

```json
{
  "code": 0,
  "data": {
    "customer_coupon_id": "CU-20260820001",
    "coupon_code": "ABC123456",
    "qr_code_url": "https://cdn.example.com/qr/ABC123456.png",
    "status": "claimed",
    "merchant": {
      "name": "老王火锅（望京SOHO店）",
      "address": "朝阳区望京SOHO T3 1层"
    }
  }
}
```

#### POST /v1/customer/coupons/:customer_coupon_id/share — 记录分享归属

```json
{
  "platform": "wechat_friend" // wechat_friend | wechat_moment
}
```

---

### 4.4 钱包（C端）

#### GET /v1/customer/wallet — C端钱包

```json
{
  "code": 0,
  "data": {
    "balance": 0.0, // C端余额（奖励金）
    "reward_earned": 45.6,
    "reward_spent": 0.0
  }
}
```

---

## 5. 核销回调 API

**Base Path:** `/v1/callback`
**认证:** `X-Merchant-Key` + `X-Signature` 签名

### 5.1 商家系统 → AI auto 平台（商家主动调）

见 [2.5 核销 API](#25-核销)

### 5.2 AI auto 平台 → 商家系统（结果回调）

平台在核销成功后回调商家注册的回掉地址。

**回调签名：**

```
X-Signature: sha256=hmac_sha256(
  timestamp + "." + nonce + "." + body_json,
  api_secret
)
```

**回调请求：**

```json
POST <merchant_callback_url>
Headers:
  Content-Type: application/json
  X-Merchant-Key: <api_key>
  X-Timestamp: 1724143320
  X-Nonce: uuid
  X-Signature: sha256=abc123...

Body:
{
  "event": "redemption.confirmed",
  "redemption_id": "R-20260820001",
  "coupon_code": "ABC123456",
  "merchant_id": "M-20260820001",
  "store_id": "S-20260820001",
  "customer_id": "U-20260820001",
  "agent_id": "A-20260820001",
  "commission_amount": 8.00,
  "transaction_amount": 156.00,
  "discount_amount": 20.00,
  "redeemed_at": "2026-08-20T13:42:00Z"
}
```

**商家服务器需返回：**

```json
{ "code": 0, "message": "ok" }
```

**超时：** 平台等待回调响应超时 5s，超时视为成功。
**重试：** 失败后每 5min 重试，最多重试 12 次（1 小时）。

---

## 6. AI Agent API

**Base Path:** `/v1/ai`
**认证:** `merchant_admin` 或 `agent`

---

### 6.1 AI 创建活动

#### POST /v1/ai/campaign/generate — 自然语言生成活动配置

```json
{
  "merchant_id": "M-20260820001",
  "natural_language": "七夕节做个满100减20的活动，持续到月底",
  "language": "zh-CN"
}
```

**响应：**

```json
{
  "code": 0,
  "data": {
    "task_id": "AI-20260820001",
    "status": "processing"
  }
}
```

#### GET /v1/ai/campaign/generate/:task_id — 获取生成结果

```json
{
  "code": 0,
  "data": {
    "task_id": "AI-20260820001",
    "status": "completed",
    "campaign_config": {
      "campaign_name": "七夕满减活动",
      "campaign_type": "discount",
      "start_at": "2026-08-20T00:00:00Z",
      "end_at": "2026-08-31T23:59:59Z",
      "coupon": {
        "discount_amount": 20,
        "min_purchase_amount": 100,
        "commission_per_redemption": 8.0
      },
      "estimated_metrics": {
        "expected_redemptions": "100-150",
        "expected_customers": "30-50",
        "estimated_cost": "800-1200"
      }
    },
    "alternatives": [{/* 同上，方案 B */}, {/* 同上，方案 C */}],
    "generated_at": "2026-08-20T13:44:00Z"
  }
}
```

#### POST /v1/ai/campaign/confirm — 确认并创建

```json
{
  "task_id": "AI-20260820001",
  "selected_plan": 0, // 0=推荐方案，1=B方案，2=C方案
  "adjustments": {
    // 可选，微调
    "commission_per_redemption": 10.0
  }
}
```

---

### 6.2 AI 文案生成

#### POST /v1/ai/content/generate — AI 生成推广内容

```json
{
  "coupon_id": "CP-20260820001",
  "content_type": "text",
  "platforms": ["wechat_moment", "douyin"],
  "style": "casual",
  "extra_prompt": "加入七夕节日元素",
  "generate_count": 3
}
```

**响应：**

```json
{
  "code": 0,
  "data": {
    "generation_id": "G-20260820001",
    "status": "processing",
    "estimated_cost": 0.36,
    "estimated_duration": 5
  }
}
```

#### GET /v1/ai/content/generate/:generation_id — 获取生成结果

---

### 6.3 AI 海报生成

#### POST /v1/ai/poster/generate — AI 生成海报

```json
{
  "coupon_id": "CP-20260820001",
  "style": "food_real", // food_real | festive | minimalist
  "aspect_ratio": "1:1",
  "platform": "wechat_moment",
  "extra_prompt": "加入七夕鹊桥元素"
}
```

**响应：**

```json
{
  "code": 0,
  "data": {
    "generation_id": "PG-20260820001",
    "status": "processing",
    "estimated_cost": 0.8,
    "estimated_duration": 15
  }
}
```

---

## 7. 运营 API

**Base Path:** `/v1/admin`
**认证:** `admin` / `super_admin`

---

### 7.1 商户审核

#### GET /v1/admin/merchants/pending — 待审核商户队列

```json
{
  "code": 0,
  "data": {
    "items": [
      {
        "merchant_id": "M-20260820001",
        "merchant_name": "老王火锅（望京SOHO店）",
        "contact_name": "王老板",
        "phone": "138****8888",
        "merchant_type": "enterprise",
        "industry": "catering",
        "ai_review_result": {
          "status": "pass", // pass | review | reject
          "confidence": 0.87,
          "reasons": []
        },
        "documents": [
          { "type": "business_license", "url": "..." },
          { "type": "id_card", "url": "..." }
        ],
        "applied_at": "2026-08-20T14:32:00Z"
      }
    ],
    "pagination": { "page": 1, "page_size": 20, "total": 5, "total_pages": 1 }
  }
}
```

#### POST /v1/admin/merchants/:merchant_id/approve — 审核通过

```json
{
  "approved_by": "admin-001"
}
```

#### POST /v1/admin/merchants/:merchant_id/reject — 审核拒绝

```json
{
  "reason": "资质不全：营业执照过期",
  "rejected_by": "admin-001"
}
```

---

### 7.2 分享员审核

#### GET /v1/admin/agents/pending — 待审核分享员

#### POST /v1/admin/agents/:agent_id/suspend — 封禁分享员

```json
{
  "reason": "刷单作弊",
  "frozen_commission": true,
  "suspended_by": "admin-001"
}
```

---

### 7.3 运营仪表盘

#### GET /v1/admin/dashboard — 平台总览

```json
{
  "code": 0,
  "data": {
    "date": "2026-08-20",
    "today": {
      "new_merchants": 28,
      "active_agents": 3421,
      "gmv": 89234.0,
      "platform_revenue": 17846.8
    },
    "total": {
      "merchants": 1234,
      "agents": 12456,
      "cumulative_gmv": 12300000.0,
      "cumulative_revenue": 2400000.0
    },
    "monthly_stats": {
      "new_merchants": 89,
      "new_agents": 2345,
      "subscription_renewal_rate": 0.873,
      "agent_retention_rate": 0.768
    }
  }
}
```

---

### 7.4 风控

#### GET /v1/admin/fraud/alerts — 风控告警

**Query:** `?severity=critical&page=1&page_size=20`

```json
{
  "code": 0,
  "data": {
    "summary": {
      "critical": 3,
      "warning": 12,
      "notice": 25
    },
    "items": [
      {
        "alert_id": "FA-20260820001",
        "type": "suspicious_self_redemption",
        "severity": "critical",
        "confidence": 0.87,
        "merchant": {
          "merchant_id": "M-20260820001",
          "name": "老王火锅"
        },
        "agent": {
          "agent_id": "A-20260820001",
          "name": "小美妈妈"
        },
        "evidence": [
          "同一分享员 5 分钟内产生 23 笔核销",
          "核销金额均为 ¥100.00，高度一致",
          "涉及客户 IP 高度集中"
        ],
        "status": "pending",
        "created_at": "2026-08-20T13:42:00Z"
      }
    ],
    "pagination": { "page": 1, "page_size": 20, "total": 40, "total_pages": 2 }
  }
}
```

#### POST /v1/admin/fraud/alerts/:alert_id/handle — 处理告警

```json
{
  "action": "freeze_commission", // freeze_commission | mark_suspicious | contact_merchant | dismiss
  "notes": "确认刷单，已冻结佣金",
  "handled_by": "admin-001"
}
```

---

### 7.5 财务对账

#### GET /v1/admin/finance/transactions — 收支流水

**Query:** `?type=income&date_from=2026-08-01&date_to=2026-08-20&page=1&page_size=50`

```json
{
  "code": 0,
  "data": {
    "summary": {
      "total_income": 234560.0,
      "total_expense": 187680.0,
      "net_profit": 46880.0,
      "subscription_income": 198720.0,
      "commission_royalty": 35840.0
    },
    "items": [
      {
        "transaction_id": "TX-20260820001",
        "type": "subscription",
        "category": "merchant_subscription",
        "amount": 1200.0,
        "balance": 46880.0,
        "merchant": { "merchant_id": "M-001", "name": "老王火锅" },
        "created_at": "2026-08-20T14:00:00Z"
      },
      {
        "transaction_id": "TX-20260820002",
        "type": "expense",
        "category": "commission_payout",
        "amount": -640.0,
        "recipient": {
          "type": "agent",
          "agent_id": "A-001",
          "name": "小美妈妈"
        }
      }
    ],
    "pagination": {
      "page": 1,
      "page_size": 50,
      "total": 500,
      "total_pages": 10
    }
  }
}
```

---

### 7.6 内容审核

#### GET /v1/admin/content/moderation — 待审核内容

```json
{
  "code": 0,
  "data": {
    "items": [
      {
        "content_id": "CT-20260820001",
        "content_type": "text",
        "content": "🔥超低价！老王火锅...",
        "platform": "wechat_moment",
        "agent": {
          "agent_id": "A-20260820001",
          "name": "小美妈妈"
        },
        "ai_review": {
          "status": "violation",
          "confidence": 0.92,
          "violations": [
            {
              "type": "prohibited_words",
              "text": "超低价",
              "rule": "广告法禁用词"
            },
            { "type": "inducement", "text": "不来就亏了", "rule": "诱导分享" }
          ]
        },
        "created_at": "2026-08-20T13:42:00Z"
      }
    ],
    "pagination": { "page": 1, "page_size": 20, "total": 8, "total_pages": 1 }
  }
}
```

#### POST /v1/admin/content/:content_id/moderate — 审核内容

```json
{
  "action": "reject", // approve | reject | escalate
  "reason": "使用了广告法禁用词",
  "notify_agent": true,
  "moderated_by": "admin-001"
}
```

---

## 8. 公共数据结构

### 8.1 分页

```typescript
interface Pagination {
  page: number // 当前页（从1开始）
  page_size: number // 每页条数
  total: number // 总条数
  total_pages: number // 总页数
}
```

### 8.2 时间范围

```typescript
interface DateRange {
  start: string // YYYY-MM-DD
  end: string // YYYY-MM-DD
}
```

### 8.3 金额

所有金额以**元**为单位，保留2位小数。

```json
{ "amount": 20.0 }
```

### 8.4 状态枚举

| 模块       | 枚举值                                                 |
| ---------- | ------------------------------------------------------ |
| 商户状态   | `pending_review` / `active` / `suspended`              |
| 活动状态   | `draft` / `scheduled` / `running` / `paused` / `ended` |
| 核销状态   | `pending` / `confirmed` / `rejected` / `expired`       |
| 券状态     | `claimed` / `used` / `expired`                         |
| 提现状态   | `processing` / `completed` / `failed`                  |
| 告警级别   | `critical` / `warning` / `notice`                      |
| 分享员等级 | `bronze` / `silver` / `gold` / `diamond` / `king`      |

---

## 9. 错误码

### 9.1 认证与权限（1000-1999）

| Code | HTTP | 描述                |
| ---- | ---- | ------------------- |
| 1001 | 401  | 无效的 access_token |
| 1002 | 401  | token 已过期        |
| 1003 | 401  | refresh_token 无效  |
| 1004 | 403  | 无权限访问此接口    |
| 1005 | 403  | 无权限操作此资源    |
| 1006 | 429  | 请求过于频繁        |

### 9.2 商户相关（2000-2999）

| Code | HTTP | 描述                 |
| ---- | ---- | -------------------- |
| 2001 | 400  | 参数校验失败         |
| 2002 | 404  | 商户不存在           |
| 2003 | 400  | 商户状态不允许此操作 |
| 2004 | 400  | 门店数量超过订阅限制 |
| 2005 | 400  | 活动有效期冲突       |
| 2006 | 400  | 佣金预算不足         |

### 9.3 分享员/C端相关（3000-3999）

| Code | HTTP | 描述           |
| ---- | ---- | -------------- |
| 3001 | 400  | 提现金额超限   |
| 3002 | 400  | 收款方式未绑定 |
| 3003 | 400  | 等级不满足条件 |
| 3004 | 404  | 分享员不存在   |

### 9.4 券与核销（4000-4999）

| Code  | HTTP | 描述               |
| ----- | ---- | ------------------ |
| 4001  | 404  | 券不存在           |
| 4002  | 400  | 券已领取           |
| 4003  | 400  | 每用户限领         |
| 4004  | 400  | 券已用完           |
| 4005  | 400  | 券已过期           |
| 4006  | 400  | 不满足领取条件     |
| 40103 | 400  | 券码无效           |
| 40104 | 400  | 券码已使用         |
| 40105 | 400  | 券码已过期         |
| 40106 | 400  | 不适用当前门店     |
| 40107 | 400  | 不满足消费门槛     |
| 40108 | 400  | 72小时确认窗口已过 |
| 40109 | 409  | 重复核销（幂等）   |

### 9.5 AI 生成（5000-5999）

| Code | HTTP | 描述             |
| ---- | ---- | ---------------- |
| 5001 | 400  | AI 生成失败      |
| 5002 | 400  | Token 余额不足   |
| 5003 | 400  | 内容违反平台规范 |

### 9.6 系统级（9000-9999）

| Code | HTTP | 描述           |
| ---- | ---- | -------------- |
| 9001 | 500  | 服务器内部错误 |
| 9002 | 503  | 服务暂时不可用 |
| 9003 | 504  | 上游服务超时   |
| 9004 | 400  | 签名验证失败   |
| 9005 | 429  | API 限流       |

---

## 附录 A：回调签名算法

```javascript
// Node.js 示例
const crypto = require('crypto')

function signCallback(body, timestamp, nonce, secret) {
  const signStr = `${timestamp}.${nonce}.${JSON.stringify(body)}`
  return (
    'sha256=' +
    crypto.createHmac('sha256', secret).update(signStr).digest('hex')
  )
}

// 验证签名
function verifySignature(req, secret) {
  const signature = req.headers['x-signature']
  const timestamp = req.headers['x-timestamp']
  const nonce = req.headers['x-nonce']

  if (Date.now() / 1000 - parseInt(timestamp) > 300) {
    return false // 超过5分钟，拒绝
  }

  const expected = signCallback(req.body, timestamp, nonce, secret)
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
}
```

---

_API 契约文档由 Claude Code 生成，基于 AI auto PRD + Architecture。_
