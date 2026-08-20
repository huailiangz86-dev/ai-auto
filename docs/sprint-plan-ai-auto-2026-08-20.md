# Sprint Plan: AI auto

**Date:** 2026-08-20
**Scrum Master:** zhang
**Project Level:** 3
**Total Stories:** 71
**Total Points:** 268
**Planned Sprints:** 7

---

## Executive Summary

本计划将 AI auto 的 13 个 Epic 拆解为 71 个用户故事（268 点），由 2 名高级开发人员执行，分 7 个 Sprint 交付。核心交付策略：先基础设施 → 再核心业务（归属+佣金） → 然后功能迭代（商户/分享员/C端/平台） → 最后高级功能（AI Agent/游戏化）。每个 Sprint 交付可演示的增量价值。

**关键指标：**
- 总故事数：71
- 总故事点：268
- 计划 Sprint：7
- 团队容量：48点/Sprint（80%利用率）
- 预计完成：约 14 周（不含缓冲）

---

## Team Capacity

**团队配置：**
- 开发人员：2人
- Sprint 长度：2周（10个工作日）
- 每日有效工时：6小时/人
- 高级水平：1点 = 2小时

**容量计算：**
```
2人 × 10天 × 6小时 = 120小时/Sprint
120小时 ÷ 2小时/点 = 60点/Sprint
80%利用率 → 48点/Sprint
```

---

## Story Inventory

---

### STORY-AI-001: 基础项目搭建

**Epic:** Infrastructure
**Priority:** Infrastructure
**Sprint:** 0

**User Story:**
As a developer
I want to have a complete development environment
So that the team can start implementing features efficiently

**Acceptance Criteria:**
- [ ] 代码仓库初始化（monorepo 结构）
- [ ] NestJS 项目脚手架 + TypeScript 配置
- [ ] FastAPI 项目脚手架（AI Agent 服务）
- [ ] 数据库 ORM 配置（TypeORM + PostgreSQL）
- [ ] Redis 连接配置
- [ ] Docker Compose 本地开发环境（PostgreSQL + Redis）
- [ ] ESLint + Prettier + Husky 配置
- [ ] Git 工作流配置（分支策略）
- [ ] CI/CD 基础配置（GitHub Actions）
- [ ] 环境变量模板（.env.example）

**Technical Notes:**
- Monorepo 结构：apps/api, apps/ai-agent, apps/web, apps/mini-program
- 使用 pnpm workspace
- 数据库迁移工具：TypeORM migration

**Dependencies:** None
**Estimate:** 3 points

---

### STORY-AI-002: 数据库设计与实现

**Epic:** Infrastructure
**Priority:** Infrastructure
**Sprint:** 0

**User Story:**
As a developer
I want to have all database schemas designed and created
So that all features can persist data correctly

**Acceptance Criteria:**
- [ ] 商户表（merchants）：注册信息、订阅状态、企业号绑定
- [ ] 门店表（stores）：多门店支持
- [ ] 分享员表（sharing_agents）：注册信息、信誉分、等级
- [ ] 分享员平台绑定表（agent_platform_accounts）：多平台 OAuth 状态
- [ ] 客户表（customers）：C端用户、归属信息
- [ ] 客户归属表（customer_attributions）：365天锁客记录
- [ ] 活动表（campaigns）：营销活动配置
- [ ] 券表（coupons）：优惠券/现金奖励
- [ ] 券映射表（coupon_product_mappings）：券与商家商品的映射
- [ ] 核销表（redemptions）：核销记录
- [ ] 佣金表（commissions）：佣金计算与结算
- [ ] 分享员钱包表（agent_wallets）：余额、冻结、结算
- [ ] 订阅表（subscriptions）：商户订阅记录
- [ ] 佣金预算表（commission_budgets）：商家预充值钱包
- [ ] 内容表（contents）：AI生成的内容记录
- [ ] 提现表（withdrawals）：提现记录
- [ ] 平台管理员表（admins）：运营后台账号
- [ ] 审核日志表（audit_logs）：所有审核操作记录
- [ ] 所有表加创建时间/更新时间/软删除字段
- [ ] 索引设计：归属查询、佣金结算、核销查询高频路径
- [ ] 时序分区：归属表按月分区（365天数据量）

**Technical Notes:**
- 佣金表必须幂等设计（idempotency_key 唯一索引）
- 归属表：agent_id + customer_id + campaign_id 唯一约束（首击锁定）
- 钱包表：decimal(12,2) 精度，事务一致性

**Dependencies:** STORY-AI-001
**Estimate:** 8 points

---

### STORY-AI-003: 用户认证与权限系统

**Epic:** Infrastructure
**Priority:** Infrastructure
**Sprint:** 0

**User Story:**
As a user (merchant/agent/admin)
I want to securely register, login, and access features based on my role
So that the platform is secure and each role sees only what they should

**Acceptance Criteria:**
- [ ] 商户注册与登录（手机号+验证码）
- [ ] 分享员注册与登录（手机号+验证码）
- [ ] 平台管理员登录（账号密码+ MFA）
- [ ] JWT 认证（access token + refresh token）
- [ ] 角色权限控制（Merchant / Agent / Admin / Customer）
- [ ] API 路由守卫（NestJS Guard）
- [ ] 敏感数据加密（AES-256：银行账号、身份证号）
- [ ] 密码重置流程（手机验证码）
- [ ] 会话管理（Redis 存储 + 主动登出）

**Technical Notes:**
- JWT: access token 15分钟，refresh token 7天
- 验证码：Redis 存储，5分钟有效期
- 权限：RBAC，4个角色，每个角色多个权限

**Dependencies:** STORY-AI-001, STORY-AI-002
**Estimate:** 5 points

---

### STORY-AI-004: 商家入驻与订阅 (EPIC-001)

**Epic:** EPIC-001 商户入驻订阅
**Priority:** Must Have
**Sprint:** 1

**User Story:**
As a merchant
I want to register, subscribe, and pay for the platform
So that I can start using the sharing agent distribution tool

**Acceptance Criteria:**
- [ ] 商户注册表单（营业执照/个人身份证）
- [ ] 企业号（抖音/小红书/视频号）授权接入引导页
- [ ] 订阅套餐选择与支付（¥1,200/店/年）
- [ ] 订阅状态验证（每次功能访问检查订阅有效期）
- [ ] 订阅过期屏蔽功能（只读模式，提示续费）
- [ ] 订阅续费提醒（30天/7天/1天前）
- [ ] 门店管理（多门店 CRUD）
- [ ] 商户资质审核（平台运营后台 STORY-AI-038）

**Technical Notes:**
- 支付接入：支付宝/微信支付（当面付）
- 订阅表关联门店，1个订阅覆盖N个门店

**Dependencies:** STORY-AI-003
**Estimate:** 5 points

---

### STORY-AI-005: 商家业务系统集成 (EPIC-001)

**Epic:** EPIC-001 商户入驻订阅
**Priority:** Must Have
**Sprint:** 1

**User Story:**
As a merchant
I want to integrate my existing POS/ERP system with the platform
So that coupons and products are automatically synced

**Acceptance Criteria:**
- [ ] 券统一接口 API（创建/更新/查询/删除）
- [ ] 商品映射接口（将商家商品ID映射到平台券）
- [ ] 核销回调 API（商家系统调用确认核销）
- [ ] 签名认证（HMAC-SHA256）
- [ ] 商家后台：券与商品映射配置页面
- [ ] 映射关系存储与验证

**Technical Notes:**
- 回调 API：POST /api/v1/merchant/callback/verify
- 防重放：nonce + timestamp（5分钟窗口）
- IP 白名单配置

**Dependencies:** STORY-AI-003, STORY-AI-002
**Estimate:** 5 points

---

### STORY-AI-006: 客户归属与365天锁客 (EPIC-004)

**Epic:** EPIC-004 归属与锁客
**Priority:** Must Have
**Sprint:** 1

**User Story:**
As a system
I want to track customer attribution from the first click and lock them to the agent for 365 days
So that commissions are correctly attributed and the compound model works

**Acceptance Criteria:**
- [ ] 用户点击分享链接/扫码 → 记录归属（agent_id, customer_id, timestamp）
- [ ] 锁客周期精确365天（UTC 00:00 起算）
- [ ] 锁客期内所有核销归该分享员
- [ ] 365天后客户释放，可被新分享员锁定
- [ ] 同一客户被多个分享员分享 → 首击锁定（不可逆）
- [ ] 归属追踪：URL参数 + Cookie + 账号绑定三重校验
- [ ] 归属查询 API（用于佣金计算）

**Technical Notes:**
- 首击判定：精确到毫秒的时间戳比较
- 归属表分区：按月分区，加速365天窗口查询
- Redis 缓存：活跃归属关系缓存（key: customer_id → agent_id, TTL: 365天）

**Dependencies:** STORY-AI-002
**Estimate:** 8 points

---

### STORY-AI-007: 佣金计算与分账引擎 (EPIC-005)

**Epic:** EPIC-005 佣金引擎
**Priority:** Must Have
**Sprint:** 1

**User Story:**
As a system
I want to calculate commissions accurately when a customer redeems
So that agents receive their fair earnings and the platform takes its 20% cut

**Acceptance Criteria:**
- [ ] 核销事件触发佣金计算（商家设置的奖励 × 80% = 分享员实得）
- [ ] 平台扣取20%作为平台服务费
- [ ] 复利模型：每次核销独立计算佣金（不因复购减少）
- [ ] 佣金幂等计算（同一核销ID只计算一次）
- [ ] 分享员钱包实时更新（待结算余额）
- [ ] 佣金流水记录（可查询每个客户的佣金明细）
- [ ] 信誉分佣金乘数应用（青铜1.0x → 王者2.0x）
- [ ] 佣金计算 API（内部服务调用）

**Technical Notes:**
- 幂等性：redemption_id + idempotency_key 唯一索引
- 精度：所有金额用 decimal(12,2)，避免浮点误差
- 事务：钱包更新和佣金记录在同一事务中

**Dependencies:** STORY-AI-006, STORY-AI-002
**Estimate:** 8 points

---

### STORY-AI-008: T+3 佣金结算与提现 (EPIC-005)

**Epic:** EPIC-005 佣金引擎
**Priority:** Must Have
**Sprint:** 1

**User Story:**
As a sharing agent
I want to receive my settled commissions on T+3 and withdraw with a minimum of ¥10
So that I can actually earn money from my sharing efforts

**Acceptance Criteria:**
- [ ] T+3 结算（核销日后第3个工作日）
- [ ] 结算批处理任务（每日凌晨执行）
- [ ] 最低提现 ¥10 门槛校验
- [ ] 提现方式：支付宝/微信支付/银行卡
- [ ] 银行卡实名认证（姓名+卡号+银行）
- [ ] 提现状态追踪（申请中/处理中/成功/失败）
- [ ] 提现失败自动重试（最多3次）+ 管理员告警
- [ ] 提现记录不可变、可审计
- [ ] 交易历史展示（时间戳+金额+结算状态）

**Technical Notes:**
- 定时任务：cron 0 2 * * *（每天凌晨2点）
- 支付网关：蚂蚁链 + 微信支付商家转账
- 幂等提现：withdrawal_request_id 唯一索引

**Dependencies:** STORY-AI-007
**Estimate:** 5 points

---

### STORY-AI-009: 商家钱包与预算管理 (EPIC-005)

**Epic:** EPIC-005 佣金引擎
**Priority:** Must Have
**Sprint:** 1

**User Story:**
As a merchant
I want to prepay commission budget and track spending
So that I can control costs and understand ROI

**Acceptance Criteria:**
- [ ] 商家数字钱包（预充值/冻结/消耗三态）
- [ ] 佣金预算充值（支付宝/微信支付）
- [ ] 发布活动前冻结预算
- [ ] 核销后扣减实际佣金（解冻差额）
- [ ] 预算不足时阻止新活动
- [ ] 钱包流水明细（充值/冻结/解冻/扣减）
- [ ] 月度账单与发票申请入口

**Technical Notes:**
- 冻结机制：发布活动时估算最大佣金，预冻结
- 事务一致性：冻结/解冻/扣减必须原子操作

**Dependencies:** STORY-AI-004
**Estimate:** 3 points

---

### STORY-AI-010: 营销活动管理 (EPIC-002)

**Epic:** EPIC-002 营销活动管理
**Priority:** Must Have
**Sprint:** 2

**User Story:**
As a merchant
I want to create, manage, and monitor marketing activities
So that I can run effective campaigns to attract customers

**Acceptance Criteria:**
- [ ] 优惠券活动创建（满减/现金奖励/组合券）
- [ ] 每张券设置单客奖励金额（分享员佣金来源）
- [ ] 券有效期配置（指定日期/N天后生效）
- [ ] 券库存配置（无限/限量）
- [ ] 单客领取限制（每人一次/不限）
- [ ] 活动列表（状态筛选：草稿/进行中/已结束）
- [ ] 活动详情（券统计：浏览/领取/核销）
- [ ] 活动暂停/终止

**Technical Notes:**
- 券库存扣减：乐观锁（version 字段）
- 防止超领：Redis Lua 脚本原子扣减

**Dependencies:** STORY-AI-004, STORY-AI-005
**Estimate:** 5 points

---

### STORY-AI-011: AI 自然语言创建活动 (EPIC-002 / FR-003)

**Epic:** EPIC-002 营销活动管理
**Priority:** Must Have
**Sprint:** 2

**User Story:**
As a merchant
I want to describe a campaign in natural language and have AI automatically configure it
So that I can create activities without learning complex settings

**Acceptance Criteria:**
- [ ] 商家输入中文活动描述（如"帮我做七夕满减活动"）
- [ ] AI 解析：活动类型、折扣规则、目标人群、活动时间、预算
- [ ] AI 生成活动配置方案（3个选项供选择）
- [ ] AI 解释每个方案的预期效果
- [ ] 商家一键确认 → 活动立即生效
- [ ] 配置预览（确认页展示完整配置）
- [ ] AI 错误理解时的修正机制（商家可手动调整）

**Technical Notes:**
- AI 服务（FastAPI）：Claude API 调用
- Prompt 工程：提取结构化参数 → 映射到平台配置
- 缓存：相同描述不重复调用 AI

**Dependencies:** STORY-AI-010
**Estimate:** 8 points

---

### STORY-AI-012: 裂变链路追踪与分析 (EPIC-002 / FR-018)

**Epic:** EPIC-002 营销活动管理
**Priority:** Should Have
**Sprint:** 2

**User Story:**
As a merchant
I want to see the full attribution chain from impression to redemption
So that I can understand ROI and optimize campaigns

**Acceptance Criteria:**
- [ ] 漏斗数据：浏览→点击→领取→核销→复购→再分享
- [ ] 全链路追踪：哪个分享员→哪个链接→哪个客户→哪个核销
- [ ] 时序图表（日报/周报/月报）
- [ ] 环比对比（上期/上上周）
- [ ] CSV/Excel 数据导出
- [ ] ROI 计算（佣金支出 vs 新客户价值）

**Technical Notes:**
- 事件流：统一事件采集 → Kafka → ClickHouse
- 实时仪表盘：WebSocket 推送更新

**Dependencies:** STORY-AI-006, STORY-AI-007
**Estimate:** 5 points

---

### STORY-AI-013: 分享员招募与绑定 (EPIC-003)

**Epic:** EPIC-003 分享员管理
**Priority:** Must Have
**Sprint:** 2

**User Story:**
As a merchant
I want to recruit sharing agents and let them bind to my store
So that I can build a distribution network

**Acceptance Criteria:**
- [ ] 生成招募链接和二维码
- [ ] 分享员注册（手机号+可选社交账号绑定）
- [ ] 注册时绑定商家门店
- [ ] 分享员可选绑定多平台账号（抖音/小红书/视频号企业号）
- [ ] 商家审核分享员（自动通过/手动审核可选）
- [ ] 分享员解绑商家（待生效活动保留）

**Technical Notes:**
- 招募链接参数：merchant_id + store_id + invite_code
- OAuth 授权：各平台企业号授权流程

**Dependencies:** STORY-AI-004
**Estimate:** 5 points

---

### STORY-AI-014: 分享员信誉分系统 (EPIC-003 / FR-009)

**Epic:** EPIC-003 分享员管理
**Priority:** Should Have
**Sprint:** 2

**User Story:**
As a sharing agent
I want to see my reputation score and level, and earn higher commissions with higher levels
So that I have motivation to grow and improve

**Acceptance Criteria:**
- [ ] 信誉分 = 有效客户数（核销至少1次的客户）
- [ ] 等级阈值：青铜(0-10) → 白银(11-50) → 黄金(51-200) → 钻石(201-500) → 王者(500+)
- [ ] 等级佣金乘数：青铜1.0x, 白银1.1x, 黄金1.2x, 钻石1.5x, 王者2.0x
- [ ] 月度滚动计算（最近12个月有效客户数）
- [ ] 分享员后台实时显示信誉分和下一等级进度
- [ ] 平台排行榜（Top分享员展示）

**Technical Notes:**
- 定时任务：每月1号重新计算所有分享员等级
- 缓存：等级和乘数结果 Redis 缓存（TTL: 1小时）

**Dependencies:** STORY-AI-007, STORY-AI-008
**Estimate:** 3 points

---

### STORY-AI-015: 分享员多平台账号绑定 (EPIC-007 / FR-014)

**Epic:** EPIC-007 多平台分发
**Priority:** Must Have
**Sprint:** 2

**User Story:**
As a sharing agent
I want to bind multiple platform accounts (no limit)
So that I can distribute content across Douyin, Xiaohongshu, and WeChat Video Account

**Acceptance Criteria:**
- [ ] 支持平台列表展示（抖音/小红书/视频号）
- [ ] 每个平台可绑定多个账号（无上限）
- [ ] OAuth 授权流程（各平台标准）
- [ ] Token 自动刷新（过期前自动续期）
- [ ] 授权撤销通知 + 内容发布自动暂停
- [ ] 商家协助开通企业号引导
- [ ] 账号列表与状态展示（正常/授权过期/需重新授权）

**Technical Notes:**
- Token 存储：加密后存数据库，Redis 缓存热数据
- 各平台 OAuth 回调处理（重定向 URI 配置）

**Dependencies:** STORY-AI-013
**Estimate:** 5 points

---

### STORY-AI-016: C端领券入口 (EPIC-008 / FR-015)

**Epic:** EPIC-008 C端小程序
**Priority:** Must Have
**Sprint:** 3

**User Story:**
As a C-end customer
I want to discover and claim coupons through multiple channels
So that I can easily find deals from merchants near me or shared by friends

**Acceptance Criteria:**
- [ ] LBS 发现附近商家优惠（小程序定位权限）
- [ ] 分享员分享链接/二维码直接领券（带归属追踪）
- [ ] 店内扫码领券（支持扫码，不只依赖lbs）
- [ ] 搜索商家/品类/关键词
- [ ] 券详情页（使用说明/有效期/适用门店）
- [ ] 领券收藏夹 + 卡包
- [ ] 归属追踪参数正确传递（各入口均带 agent_id + campaign_id）

**Technical Notes:**
- 微信小程序：wx.getLocation, wx.scanCode
- LBS：GeoHash 索引 + 附近商家查询（PostGIS 或 Redis GEO）

**Dependencies:** STORY-AI-006, STORY-AI-010
**Estimate:** 5 points

---

### STORY-AI-017: C端券核销流程 (EPIC-008 / FR-016)

**Epic:** EPIC-008 C端小程序
**Priority:** Must Have
**Sprint:** 3

**User Story:**
As a merchant
I want to verify coupon redemptions when customers present them
So that commissions are triggered and recorded

**Acceptance Criteria:**
- [ ] C端出示券码（二维码/数字码）
- [ ] 商家扫码/输入券码（商家后台或POS系统）
- [ ] 商家调用核销API（券码+交易金额）
- [ ] 核销回调72小时内完成
- [ ] 平台验证：券有效/未过期/未核销/客户在锁客期内
- [ ] 核销成功：返回优惠金额+触发佣金计算
- [ ] 核销失败：返回具体原因（已使用/已过期/不在锁客期）
- [ ] C端收到核销成功通知
- [ ] 72小时超时未回调的自动告警

**Technical Notes:**
- 幂等核销：同一券码同一时间戳的回调只处理一次
- 防刷：核销频率监控（同客户同商家限制）
- 回调 URL：商家配置，签名验证

**Dependencies:** STORY-AI-005, STORY-AI-007, STORY-AI-006
**Estimate:** 8 points

---

### STORY-AI-018: C端小程序基础框架 (EPIC-008 / FR-035)

**Epic:** EPIC-008 C端小程序
**Priority:** Must Have
**Sprint:** 3

**User Story:**
As a C-end customer
I want to use a WeChat mini-program with basic functions
So that I can discover, claim, and use coupons easily

**Acceptance Criteria:**
- [ ] 小程序注册与登录（微信授权手机号）
- [ ] 附近商家优惠页（LBS）
- [ ] 券详情页（含使用说明/有效期/适用门店）
- [ ] 领券（存入用户卡包）
- [ ] 我的卡包（已领/已用/已过期）
- [ ] 核销页（出示二维码/数字码给商家扫）
- [ ] 个人中心（账号信息/隐私设置）

**Technical Notes:**
- 技术栈：Uni-app（跨端，一套代码编译到微信/支付宝/抖音小程序）
- 状态管理：Pinia
- 请求封装：Axios + 拦截器

**Dependencies:** STORY-AI-003
**Estimate:** 5 points

---

### STORY-AI-019: C端社交分享与裂变 (EPIC-008 / FR-036)

**Epic:** EPIC-008 C端小程序
**Priority:** Must Have
**Sprint:** 3

**User Story:**
As a C-end customer
I want to share coupons and earn commissions
So that I can become a sharing agent myself

**Acceptance Criteria:**
- [ ] 分享券页面到微信好友/群/朋友圈
- [ ] 分享链接带归属追踪（用户自己的 agent_id）
- [ ] 分享后用户获得佣金（和普通分享员同等模型）
- [ ] 用户可在小程序查看自己的推广效果
- [ ] 用户可使用 AI 创作工具（Story-AI-026）
- [ ] 无感转化：分享即成为分享员（无需额外注册）

**Technical Notes:**
- 微信分享：wx.updateShareMenu + JSSDK
- 无感注册：分享时自动创建 agent_id 关联

**Dependencies:** STORY-AI-016, STORY-AI-018
**Estimate:** 3 points

---

### STORY-AI-020: AI 文案生成 (EPIC-006 / FR-010)

**Epic:** EPIC-006 AI内容生成
**Priority:** Must Have
**Sprint:** 3

**User Story:**
As a sharing agent
I want AI to generate promotional copy for me
So that I can create content quickly without writing skills

**Acceptance Criteria:**
- [ ] 选择要推广的券/活动
- [ ] 选择目标平台（微信朋友圈/社群/私聊/抖音/小红书）
- [ ] AI 生成 3-5 个文案变体（不同语气：热情/随意/正式）
- [ ] 生成前显示 AI token 费用预估
- [ ] 费用从分享员佣金余额扣除（生成后扣费）
- [ ] 生成后可编辑文案再发布
- [ ] 文案自动包含追踪链接/二维码
- [ ] 文案包含商家品牌名和券亮点
- [ ] 平台可使用汇总数据做运营分析

**Technical Notes:**
- AI 服务：FastAPI + Claude API
- Token 计费：精确计算 input + output token
- 扣费时机：生成完成后，失败不扣费

**Dependencies:** STORY-AI-010, STORY-AI-003
**Estimate:** 5 points

---

### STORY-AI-021: AI 短视频生成 (EPIC-006 / FR-011)

**Epic:** EPIC-006 AI内容生成
**Priority:** Should Have
**Sprint:** 4

**User Story:**
As a sharing agent
I want AI to generate short promotional videos for me
So that I can create video content without production skills

**Acceptance Criteria:**
- [ ] 选择要推广的券/活动
- [ ] AI 生成视频脚本（15-60秒，分镜）
- [ ] AI 生成配音（文字转语音，多音色可选）
- [ ] AI 生成字幕和字幕
- [ ] 生成前预览和编辑
- [ ] 输出格式：MP4，适合微信视频/抖音/小红书
- [ ] 视频包含追踪参数

**Technical Notes:**
- AI 服务：RunnigHub omni / Seedance 2.0
- 异步任务：任务队列（Redis/BullMQ）
- 进度通知：WebSocket / SSE

**Dependencies:** STORY-AI-020
**Estimate:** 8 points

---

### STORY-AI-022: AI 海报/主图生成 (EPIC-006 / FR-012)

**Epic:** EPIC-006 AI内容生成
**Priority:** Should Have
**Sprint:** 4

**User Story:**
As a sharing agent
I want AI to generate promotional posters
So that I can create visual content quickly

**Acceptance Criteria:**
- [ ] 选择券/活动和目标平台
- [ ] AI 生成 3 个海报变体（不同布局）
- [ ] 海报包含：商家logo、券价值、二维码、CTA按钮
- [ ] 可自定义颜色和文字叠加
- [ ] 输出格式：PNG/JPEG，尺寸匹配目标平台（微信1:1/9:16，抖音9:16，小红书3:4）

**Technical Notes:**
- AI 服务：RunnigHub IP-Adapter 方案（写实风格）
- 图片 CDN：阿里云 OSS + CDN

**Dependencies:** STORY-AI-020
**Estimate:** 3 points

---

### STORY-AI-023: 多平台一键分发 (EPIC-007 / FR-013)

**Epic:** EPIC-007 多平台分发
**Priority:** Must Have
**Sprint:** 4

**User Story:**
As a sharing agent
I want to publish content to multiple platforms from one place
So that I can distribute efficiently without manual posting

**Acceptance Criteria:**
- [ ] 选择 AI 生成或自定义内容
- [ ] 选择目标平台（多选：微信朋友圈/社群/抖音/小红书）
- [ ] 自动嵌入各平台追踪参数
- [ ] 已授权账号自动发布（API 发布）
- [ ] 未授权账号：复制格式化内容（手动粘贴发布）
- [ ] 统一效果仪表盘（跨平台数据汇总）
- [ ] 平台级归因追踪（每平台每点击独立统计）

**Technical Notes:**
- 发布队列：异步任务，分平台处理
- API 发布：各平台 Open API（已授权前提下）
- 降级策略：API 不可用时提供复制粘贴格式

**Dependencies:** STORY-AI-015, STORY-AI-020, STORY-AI-021, STORY-AI-022
**Estimate:** 8 points

---

### STORY-AI-024: 抖音企业号接入 (EPIC-007 / FR-028)

**Epic:** EPIC-007 多平台分发
**Priority:** Must Have
**Sprint:** 4

**User Story:**
As a sharing agent
I want to connect my Douyin enterprise account and publish content via API
So that I can leverage Douyin for sharing

**Acceptance Criteria:**
- [ ] 分享员 OAuth 授权抖音企业号
- [ ] 通过 API 发布短视频到抖音
- [ ] 追踪抖音内容表现（播放/点击/评论）
- [ ] 抖音自定义参数归因
- [ ] 抖音内容合规格式（尺寸/时长/音乐）
- [ ] 商家协助开通企业号引导

**Technical Notes:**
- 抖音 Open API：抖音开放平台企业号 API
- OAuth 回调：redirect_uri 配置

**Dependencies:** STORY-AI-015, STORY-AI-023
**Estimate:** 5 points

---

### STORY-AI-025: 小红书企业号接入 (EPIC-007 / FR-029)

**Epic:** EPIC-007 多平台分发
**Priority:** Should Have
**Sprint:** 5

**User Story:**
As a sharing agent
I want to connect my Xiaohongshu professional account and publish notes via API
So that I can leverage Xiaohongshu for sharing

**Acceptance Criteria:**
- [ ] 分享员 OAuth 授权小红书专业号
- [ ] 通过 API 发布笔记到小红书
- [ ] 追踪小红书笔记表现（播放/点赞/收藏/评论）
- [ ] 小红书自定义 URL 参数归因
- [ ] 小红书内容合规格式

**Technical Notes:**
- 小红书 Open API：蒲公英平台 API

**Dependencies:** STORY-AI-015
**Estimate:** 5 points

---

### STORY-AI-026: 视频号接入 (EPIC-007 / FR-030)

**Epic:** EPIC-007 多平台分发
**Priority:** Should Have
**Sprint:** 5

**User Story:**
As a sharing agent
I want to connect my WeChat Video Account and publish via API
So that I can leverage WeChat's video ecosystem

**Acceptance Criteria:**
- [ ] 分享员 OAuth 授权视频号（微信开放平台）
- [ ] 通过 API 发布短视频到视频号
- [ ] 追踪视频号表现（播放/分享/评论）
- [ ] 视频号分享追踪参数

**Technical Notes:**
- 微信 Open Platform：视频号授权

**Dependencies:** STORY-AI-015
**Estimate:** 5 points

---

### STORY-AI-027: AI Agent 活动自动配置 (EPIC-010 / FR-032)

**Epic:** EPIC-010 AI Agent引擎
**Priority:** Must Have
**Sprint:** 5

**User Story:**
As a merchant
I want to describe a campaign in natural language and have AI Agent automatically configure everything
So that I don't need to learn complex platform settings

**Acceptance Criteria:**
- [ ] 商家输入自然语言活动描述
- [ ] AI Agent 提取：活动类型、折扣机制、预算、时间、目标人群
- [ ] AI Agent 映射到平台配置参数
- [ ] AI Agent 生成 3 个配置方案
- [ ] AI Agent 解释每个方案的预期效果
- [ ] 商家确认后活动自动创建并生效

**Technical Notes:**
- FastAPI AI Agent 服务：ReAct 模式 + Claude API
- 会话上下文：多轮对话支持，商家可追问修改

**Dependencies:** STORY-AI-011
**Estimate:** 8 points

---

### STORY-AI-028: AI Agent 活动优化 (EPIC-010 / FR-033)

**Epic:** EPIC-010 AI Agent引擎
**Priority:** Should Have
**Sprint:** 6

**User Story:**
As a merchant
I want AI Agent to automatically optimize my campaigns in real time
So that I get better results without constant manual attention

**Acceptance Criteria:**
- [ ] AI 监控活动表现（点击率/核销率/ROI）
- [ ] AI 识别表现差的活动并生成优化建议
- [ ] AI 可自动调整：预算分配/券金额/人群定向
- [ ] AI 每周发送效果报告 + AI 洞察
- [ ] 所有 AI 调整需要商家确认（可开启自动调整模式）
- [ ] AI 推荐最佳发布时间（各平台）

**Technical Notes:**
- 定时任务：每日分析 + 每周报告
- 自动化调整：需商家授权 + 金额上限

**Dependencies:** STORY-AI-012, STORY-AI-027
**Estimate:** 5 points

---

### STORY-AI-029: AI Agent 活动创意推荐 (EPIC-010 / FR-020)

**Epic:** EPIC-010 AI Agent引擎
**Priority:** Could Have
**Sprint:** 6

**User Story:**
As a merchant
I want AI Agent to proactively recommend marketing activity ideas
So that I always have fresh ideas aligned with holidays and trends

**Acceptance Criteria:**
- [ ] 维护节假日和关键日期日历
- [ ] AI 分析商家历史活动和客户画像
- [ ] AI 生成活动推荐 + 理由（如"距中秋节30天：你的客户对现金券响应度是折扣券的2倍"）
- [ ] 商家一键启动 AI 推荐的活动
- [ ] AI 解释预期影响和 ROI（基于同类商家数据）

**Technical Notes:**
- 推荐引擎：基于历史转化率的协同过滤
- 节日日历：手动维护 + AI 热点识别

**Dependencies:** STORY-AI-027, STORY-AI-028
**Estimate:** 3 points

---

### STORY-AI-030: AI 客服机器人 (EPIC-009 / FR-027)

**Epic:** EPIC-009 平台运营后台
**Priority:** Should Have
**Sprint:** 6

**User Story:**
As a user (merchant/agent/customer)
I want to chat with an AI customer service bot
So that I can get answers to common questions instantly

**Acceptance Criteria:**
- [ ] 聊天界面（商户/分享员/客户后台均可访问）
- [ ] AI 机器人处理 80% 常见问题（无需人工介入）
- [ ] 无法回答的问题转人工客服
- [ ] 支持：FAQ/佣金状态/券有效性/账号问题
- [ ] 机器人从人工处理记录中学习（人工反馈循环）

**Technical Notes:**
- AI 客服：Claude API + RAG（知识库）
- 知识库：FAQ + 平台规则文档

**Dependencies:** STORY-AI-003
**Estimate:** 5 points

---

### STORY-AI-031: AI 内容审核 (EPIC-009 / FR-023)

**Epic:** EPIC-009 平台运营后台
**Priority:** Must Have
**Sprint:** 5

**User Story:**
As a platform
I want AI to automatically moderate all promotional content
So that violations are caught before or shortly after publishing

**Acceptance Criteria:**
- [ ] 所有 AI 生成内容扫描：违禁词/政策违规/敏感内容
- [ ] 发现违规：内容标记 + 通知分享员 + 阻止或要求修改
- [ ] 管理员可设置内容策略规则（平台级+按商家）
- [ ] 违规历史按分享员和商家追踪
- [ ] 累次违规转人工审核

**Technical Notes:**
- 审核服务：阿里云内容安全 / 腾讯云内容安全
- 异步审核：发布前同步审核，发布后异步抽审

**Dependencies:** STORY-AI-020, STORY-AI-021
**Estimate:** 5 points

---

### STORY-AI-032: 商户资质审核 (EPIC-009 / FR-021)

**Epic:** EPIC-009 平台运营后台
**Priority:** Must Have
**Sprint:** 5

**User Story:**
As a platform admin
I want to review and approve merchant registrations
So that only qualified merchants operate on the platform

**Acceptance Criteria:**
- [ ] 待审核商户队列（按注册时间排序）
- [ ] 审核项：营业执照/行业资质/门店信息
- [ ] 可批准/拒绝（附理由）/要求补充资料
- [ ] 商户收到审核结果通知
- [ ] 所有审核决策审计日志

**Technical Notes:**
- 审核状态机：pending → approved / rejected / need_info

**Dependencies:** STORY-AI-004
**Estimate:** 3 points

---

### STORY-AI-033: 分享员资质审核 (EPIC-009 / FR-022)

**Epic:** EPIC-009 平台运营后台
**Priority:** Must Have
**Sprint:** 5

**User Story:**
As a platform admin
I want to review and approve sharing agent registrations
So that the platform maintains quality distributors

**Acceptance Criteria:**
- [ ] 待审核分享员队列（需人工审核模式）
- [ ] 审核项：实名认证/社交账号绑定/平台账号状态
- [ ] 可批准/拒绝/封禁
- [ ] 审核决策审计日志

**Technical Notes:**
- 实名认证：阿里云实人认证 / 腾讯云人脸核身

**Dependencies:** STORY-AI-013
**Estimate:** 3 points

---

### STORY-AI-034: 资金风控 (EPIC-009 / FR-025)

**Epic:** EPIC-009 平台运营后台
**Priority:** Must Have
**Sprint:** 5

**User Story:**
As a platform
I want to detect and prevent fraudulent activities
So that the platform and honest participants are protected

**Acceptance Criteria:**
- [ ] AI 检测异常模式：异常高领取率/自核销/IP/设备行为协同
- [ ] 可疑交易标记 + 佣金记入前需人工审核
- [ ] 商家核销回调验证已知欺诈模式
- [ ] 累次违规者列入黑名单 + 账户冻结
- [ ] 风控规则管理员可配置
- [ ] 风控案例记录和报告

**Technical Notes:**
- 风控引擎：规则引擎 + ML 模型
- 实时流处理：Flink / Kafka Streams

**Dependencies:** STORY-AI-017, STORY-AI-007
**Estimate:** 5 points

---

### STORY-AI-035: 平台运营大屏 (EPIC-009 / FR-026)

**Epic:** EPIC-009 平台运营后台
**Priority:** Must Have
**Sprint:** 6

**User Story:**
As a platform admin
I want to see real-time KPIs and business metrics
So that I can monitor platform health and take action quickly

**Acceptance Criteria:**
- [ ] 实时 KPI：今日新商户/活跃分享员/今日核销/GMV/平台收入
- [ ] 图表：GMV趋势/分享员增长/商户留存/佣金支出趋势
- [ ] 告警：欺诈告警/异常活动/系统错误/支付失败
- [ ] 下钻：从平台级 → 商户级 → 分享员级
- [ ] 数据刷新：实时(KPI) 到 日报(详情报告)

**Technical Notes:**
- 实时数据：ClickHouse + Grafana
- 告警：AlertManager + 钉钉/企微通知

**Dependencies:** STORY-AI-002, STORY-AI-007, STORY-AI-012
**Estimate:** 5 points

---

### STORY-AI-036: C端 AI 创作工具 (EPIC-008 / FR-017)

**Epic:** EPIC-008 C端小程序
**Priority:** Should Have
**Sprint:** 6

**User Story:**
As a C-end customer
I want AI creation tools in the mini-program
So that I can create promotional content and become a sharing agent

**Acceptance Criteria:**
- [ ] AI 写推广文章（产品体验/种草）
- [ ] AI 生成短视频（可选自己的照片/头像）
- [ ] AI 生成个人推广海报
- [ ] AI 生成内容带追踪链接 → 用户成为事实上的分享员
- [ ] 用户分享后产生佣金（和普通分享员同等模型）
- [ ] 平台追踪并记入用户佣金账户

**Technical Notes:**
- 复用 STORY-AI-020/021/022 的 AI 服务
- 无感转化：分享即自动注册为分享员

**Dependencies:** STORY-AI-018, STORY-AI-020
**Estimate:** 5 points

---

### STORY-AI-037: C端游戏化裂变 (EPIC-013 / FR-037)

**Epic:** EPIC-013 游戏化与留存
**Priority:** Could Have
**Sprint:** 7

**User Story:**
As a C-end customer
I want gamified sharing challenges
So that sharing becomes fun and rewarding

**Acceptance Criteria:**
- [ ] 分享任务：分享给X个好友 → 解锁更高金额券
- [ ] 盲盒奖励：分享解锁随机优惠/奖品
- [ ] 积分系统：分享/核销积累积分 → 兑换礼品
- [ ] 排行榜：按商家或按平台展示 Top 分享者

**Technical Notes:**
- 积分商品库：独立管理
- 盲盒随机算法：均匀分布 + 保底机制

**Dependencies:** STORY-AI-019
**Estimate:** 5 points

---

### STORY-AI-038: 分享员任务广场 (EPIC-003 / FR-038)

**Epic:** EPIC-003 分享员管理
**Priority:** Should Have
**Sprint:** 7

**User Story:**
As a merchant
I want to post sharing tasks
And as an agent
I want to browse and accept tasks
So that we can efficiently match supply and demand

**Acceptance Criteria:**
- [ ] 商家发布任务：券/目标人群/预算/截止时间
- [ ] 分享员浏览和接单
- [ ] AI 按信誉等级/平台账号/历史表现匹配任务
- [ ] 任务完成追踪（浏览→领取→核销）
- [ ] 任务完成后自动发放佣金

**Technical Notes:**
- 任务匹配：推荐算法（协同过滤 + 信誉加权）

**Dependencies:** STORY-AI-013, STORY-AI-014, STORY-AI-023
**Estimate:** 5 points

---

### STORY-AI-039: 分享员收入证明生成 (EPIC-003 / FR-039)

**Epic:** EPIC-003 分享员管理
**Priority:** Could Have
**Sprint:** 7

**User Story:**
As a sharing agent
I want to download my annual income statement
So that I can file my taxes

**Acceptance Criteria:**
- [ ] 分享员下载年度佣金明细（PDF）
- [ ] 包含：总收入/月度明细/核销数/平台扣费
- [ ] 平台提供带公章的收入证明
- [ ] 导出任意时间范围的佣金数据
- [ ] 明确提示：税务由分享员自理

**Technical Notes:**
- PDF 生成：Puppeteer / wkhtmltopdf

**Dependencies:** STORY-AI-008
**Estimate:** 3 points

---

### STORY-AI-040: 商户 CRM 整合 (EPIC-011 / FR-040)

**Epic:** EPIC-011 分析报表
**Priority:** Could Have
**Sprint:** 7

**User Story:**
As a merchant
I want to see all customers acquired through my agents
So that I can understand my customer base and plan marketing

**Acceptance Criteria:**
- [ ] 商户看到通过平台获取的所有客户（锁客期内）
- [ ] 客户画像：首次获取日期/总核销数/总消费
- [ ] 客户列表导出（隐私合规）
- [ ] 客户数据不跨商户共享
- [ ] 客户提供类似 GDPR 的数据导出权

**Technical Notes:**
- 隐私合规：脱敏处理 + 授权确认

**Dependencies:** STORY-AI-006, STORY-AI-012
**Estimate:** 3 points

---

### STORY-AI-041: 快手接入 (EPIC-007 / FR-031)

**Epic:** EPIC-007 多平台分发
**Priority:** Could Have
**Sprint:** 7

**User Story:**
As a sharing agent
I want to connect my Kuaishou account
So that I can distribute to Kuaishou as well

**Acceptance Criteria:**
- [ ] 分享员 OAuth 授权快手账号
- [ ] 发布内容到快手
- [ ] 快手归因追踪

**Dependencies:** STORY-AI-015
**Estimate:** 3 points

---

## Sprint Allocation

---

### Sprint 0 — 基础设施 (Weeks 1-2)

**Goal:** 搭建完整开发环境，交付数据库设计和认证系统

**Stories:**
- STORY-AI-001: 基础项目搭建 (3点) — 基础设施
- STORY-AI-002: 数据库设计与实现 (8点) — 基础设施
- STORY-AI-003: 用户认证与权限系统 (5点) — 基础设施

**Total:** 16点 / 48容量 (33%)

**Risks:**
- 数据库设计返工：如果业务逻辑不清晰，可能需要修改表结构
- 多平台 OAuth 复杂度：各平台 OAuth 流程差异较大

**Dependencies:**
- GitHub Actions CI/CD 配置需外部账号

---

### Sprint 1 — 核心业务引擎 (Weeks 3-4)

**Goal:** 完成归属锁客 + 佣金引擎 + 商家入驻基础

**Stories:**
- STORY-AI-004: 商家入驻与订阅 (5点) — Must Have
- STORY-AI-005: 商家业务系统集成 (5点) — Must Have
- STORY-AI-006: 客户归属与365天锁客 (8点) — Must Have ⭐核心
- STORY-AI-007: 佣金计算与分账引擎 (8点) — Must Have ⭐核心
- STORY-AI-008: T+3 佣金结算与提现 (5点) — Must Have
- STORY-AI-009: 商家钱包与预算管理 (3点) — Must Have

**Total:** 34点 / 48容量 (71%)

**Risks:**
- 归属锁客逻辑复杂：首击判定需要严格测试
- 支付接入：支付宝/微信支付商户号申请可能需要时间

**Dependencies:**
- Sprint 0 完成

---

### Sprint 2 — 业务功能 (Weeks 5-6)

**Goal:** 营销活动管理 + 分享员招募 + 基础平台功能

**Stories:**
- STORY-AI-010: 营销活动管理 (5点) — Must Have
- STORY-AI-011: AI 自然语言创建活动 (8点) — Must Have
- STORY-AI-012: 裂变链路追踪与分析 (5点) — Should Have
- STORY-AI-013: 分享员招募与绑定 (5点) — Must Have
- STORY-AI-014: 分享员信誉分系统 (3点) — Should Have
- STORY-AI-015: 分享员多平台账号绑定 (5点) — Must Have

**Total:** 31点 / 48容量 (65%)

**Risks:**
- AI 自然语言解析准确率：需要足够测试用例验证
- 多平台 OAuth 联调：各平台测试账号准备

**Dependencies:**
- Sprint 0, Sprint 1 完成

---

### Sprint 3 — C端核心 (Weeks 7-8)

**Goal:** C端小程序基础 + 核销流程 + AI 文案

**Stories:**
- STORY-AI-016: C端领券入口 (5点) — Must Have
- STORY-AI-017: C端券核销流程 (8点) — Must Have ⭐核心
- STORY-AI-018: C端小程序基础框架 (5点) — Must Have
- STORY-AI-019: C端社交分享与裂变 (3点) — Must Have
- STORY-AI-020: AI 文案生成 (5点) — Must Have

**Total:** 26点 / 48容量 (54%)

**Risks:**
- 小程序 LBS 权限：用户拒绝定位时的降级处理
- 核销72小时回调：商家POS系统对接需要配合

**Dependencies:**
- Sprint 1 完成（核销依赖归属和佣金）

---

### Sprint 4 — 内容与分发 (Weeks 9-10)

**Goal:** AI 视频/海报 + 多平台分发 + 抖音接入

**Stories:**
- STORY-AI-021: AI 短视频生成 (8点) — Should Have
- STORY-AI-022: AI 海报/主图生成 (3点) — Should Have
- STORY-AI-023: 多平台一键分发 (8点) — Must Have
- STORY-AI-024: 抖音企业号接入 (5点) — Must Have

**Total:** 24点 / 48容量 (50%)

**Risks:**
- AI 视频生成成本：RunningHub 费用模型需要确认
- 抖音 API 限制：灰度/正式版 API 权限申请

**Dependencies:**
- Sprint 2 完成（分发依赖账号绑定）

---

### Sprint 5 — 平台运营 + AI 审核 (Weeks 11-12)

**Goal:** 平台审核/风控/运营 + AI 内容审核

**Stories:**
- STORY-AI-025: 小红书企业号接入 (5点) — Should Have
- STORY-AI-026: 视频号接入 (5点) — Should Have
- STORY-AI-027: AI Agent 活动自动配置 (8点) — Must Have
- STORY-AI-030: AI 内容审核 (5点) — Must Have
- STORY-AI-031: 商户资质审核 (3点) — Must Have
- STORY-AI-032: 分享员资质审核 (3点) — Must Have
- STORY-AI-033: 资金风控 (5点) — Must Have

**Total:** 34点 / 48容量 (71%)

**Risks:**
- AI 内容审核准确性：需要持续优化阈值
- 风控误杀：规则过于严格会影响正常用户

**Dependencies:**
- Sprint 2 完成（审核依赖入驻流程）
- Sprint 3 完成（内容审核依赖 AI 生成）

---

### Sprint 6 — AI Agent + 运营大屏 (Weeks 13-14)

**Goal:** AI Agent 自动优化 + 运营大屏 + C端 AI 工具

**Stories:**
- STORY-AI-028: AI Agent 活动优化 (5点) — Should Have
- STORY-AI-029: AI Agent 活动创意推荐 (3点) — Could Have
- STORY-AI-034: AI 客服机器人 (5点) — Should Have
- STORY-AI-035: 平台运营大屏 (5点) — Must Have
- STORY-AI-036: C端 AI 创作工具 (5点) — Should Have

**Total:** 23点 / 48容量 (48%)

**Risks:**
- AI Agent 决策透明度：商家可能不信任 AI 自动调整
- 大屏实时性能：ClickHouse 查询优化

**Dependencies:**
- Sprint 5 完成（AI Agent 依赖基础配置能力）

---

### Sprint 7 — 增值功能 (Weeks 15-16)

**Goal:** 游戏化 + 任务广场 + 收入证明 + CRM + 快手

**Stories:**
- STORY-AI-037: C端游戏化裂变 (5点) — Could Have
- STORY-AI-038: 分享员任务广场 (5点) — Should Have
- STORY-AI-039: 分享员收入证明生成 (3点) — Could Have
- STORY-AI-040: 商户 CRM 整合 (3点) — Could Have
- STORY-AI-041: 快手接入 (3点) — Could Have

**Total:** 19点 / 48容量 (40%)

**Risks:**
- 任务广场匹配算法：需要足够数据才能有效推荐
- 游戏化用户感知价值：需要持续运营才能看到效果

**Dependencies:**
- Sprint 3 完成（C端功能）

---

## Epic Traceability

| Epic ID | Epic Name | Stories | Total Points | Sprints |
|---------|-----------|---------|--------------|---------|
| EPIC-001 | 商户入驻订阅 | 004, 005 | 10 | Sprint 1 |
| EPIC-002 | 营销活动管理 | 010, 011, 012 | 18 | Sprint 2 |
| EPIC-003 | 分享员管理 | 013, 014, 038, 039 | 16 | Sprint 2, 7 |
| EPIC-004 | 归属与锁客 | 006 | 8 | Sprint 1 |
| EPIC-005 | 佣金引擎 | 007, 008, 009 | 16 | Sprint 1 |
| EPIC-006 | AI内容生成 | 020, 021, 022 | 16 | Sprint 3, 4 |
| EPIC-007 | 多平台分发 | 015, 023, 024, 025, 026, 041 | 31 | Sprint 2, 4, 5, 7 |
| EPIC-008 | C端小程序 | 016, 017, 018, 019, 036 | 26 | Sprint 3, 6 |
| EPIC-009 | 平台运营后台 | 030, 031, 032, 033, 034, 035 | 26 | Sprint 5, 6 |
| EPIC-010 | AI Agent引擎 | 027, 028, 029 | 16 | Sprint 5, 6 |
| EPIC-011 | 分析报表 | 012, 040 | 8 | Sprint 2, 7 |
| EPIC-012 | API生态 | 005, 017 | 13 | Sprint 1, 3 |
| EPIC-013 | 游戏化与留存 | 037, 038 | 10 | Sprint 7 |
| Infra | 基础设施 | 001, 002, 003 | 16 | Sprint 0 |
| **总计** | | **41个** | **268点** | **7+1 Sprint** |

---

## Functional Requirements Coverage

| FR ID | FR Name | Story | Sprint |
|-------|---------|-------|--------|
| FR-001 | 商户注册订阅 | STORY-AI-004 | Sprint 1 |
| FR-002 | 业务系统集成 | STORY-AI-005 | Sprint 1 |
| FR-003 | 自然语言活动创建 | STORY-AI-011 | Sprint 2 |
| FR-004 | 券/奖励发放 | STORY-AI-010 | Sprint 2 |
| FR-005 | 分享员招募绑定 | STORY-AI-013 | Sprint 2 |
| FR-006 | 365天锁客 | STORY-AI-006 | Sprint 1 |
| FR-007 | 佣金计算分账 | STORY-AI-007 | Sprint 1 |
| FR-008 | T+3结算提现 | STORY-AI-008 | Sprint 1 |
| FR-009 | 分享员信誉分 | STORY-AI-014 | Sprint 2 |
| FR-010 | AI文案生成 | STORY-AI-020 | Sprint 3 |
| FR-011 | AI视频生成 | STORY-AI-021 | Sprint 4 |
| FR-012 | AI海报生成 | STORY-AI-022 | Sprint 4 |
| FR-013 | 多平台分发 | STORY-AI-023 | Sprint 4 |
| FR-014 | 多平台账号绑定 | STORY-AI-015 | Sprint 2 |
| FR-015 | C端领券发现 | STORY-AI-016 | Sprint 3 |
| FR-016 | C端核销 | STORY-AI-017 | Sprint 3 |
| FR-017 | C端AI工具 | STORY-AI-036 | Sprint 6 |
| FR-018 | 裂变追踪分析 | STORY-AI-012 | Sprint 2 |
| FR-019 | AI活动优化 | STORY-AI-028 | Sprint 6 |
| FR-020 | AI活动创意推荐 | STORY-AI-029 | Sprint 6 |
| FR-021 | 商户审核 | STORY-AI-031 | Sprint 5 |
| FR-022 | 分享员审核 | STORY-AI-032 | Sprint 5 |
| FR-023 | 内容审核 | STORY-AI-030 | Sprint 5 |
| FR-024 | 财务管理 | STORY-AI-009, STORY-AI-035 | Sprint 1, 6 |
| FR-025 | 风控 | STORY-AI-033 | Sprint 5 |
| FR-026 | 运营大屏 | STORY-AI-035 | Sprint 6 |
| FR-027 | AI客服 | STORY-AI-034 | Sprint 6 |
| FR-028 | 抖音接入 | STORY-AI-024 | Sprint 4 |
| FR-029 | 小红书接入 | STORY-AI-025 | Sprint 5 |
| FR-030 | 视频号接入 | STORY-AI-026 | Sprint 5 |
| FR-031 | 快手接入 | STORY-AI-041 | Sprint 7 |
| FR-032 | AI Agent自动配置 | STORY-AI-027 | Sprint 5 |
| FR-033 | AI Agent自动分发 | STORY-AI-028 | Sprint 6 |
| FR-034 | 企业号注册协助 | STORY-AI-013 | Sprint 2 |
| FR-035 | C端小程序基础 | STORY-AI-018 | Sprint 3 |
| FR-036 | C端社交分享 | STORY-AI-019 | Sprint 3 |
| FR-037 | C端游戏化 | STORY-AI-037 | Sprint 7 |
| FR-038 | 任务广场 | STORY-AI-038 | Sprint 7 |
| FR-039 | 收入证明 | STORY-AI-039 | Sprint 7 |
| FR-040 | CRM整合 | STORY-AI-040 | Sprint 7 |

**覆盖率：40/40 FRs = 100%**

---

## Risks and Mitigation

**High Risk:**
- **归属锁客逻辑复杂**（Sprint 1）— 缓解：提前设计评审，编写充分边界测试用例
- **支付接入延迟** — 缓解：使用沙箱环境先行开发，正式支付异步接入
- **多平台 OAuth 联调** — 缓解：各平台测试账号提前申请，Mock 服务并行开发

**Medium Risk:**
- **AI 文案生成准确率** — 缓解：Prompt 迭代优化，保留人工编辑入口
- **AI 视频生成成本** — 缓解：预生成+缓存策略，按需生成
- **风控误伤** — 缓解：规则灰度发布，观察后再全量

**Low Risk:**
- **小程序审核** — 缓解：提前准备资质，准备多个版本
- **浏览器兼容性** — 缓解：Tailwind CSS + PostCSS 自动前缀

---

## Dependencies

### 内部依赖
- 数据库设计（STORY-AI-002）是所有后续故事的前置
- 归属系统（STORY-AI-006）是佣金引擎（STORY-AI-007）的前置
- 账号绑定（STORY-AI-015）是多平台分发（STORY-AI-023）的前置

### 外部依赖
- 支付宝/微信支付商户号
- 抖音/小红书/视频号企业号开发者权限
- Claude API / RunningHub API 额度
- 阿里云 PostgreSQL / Redis / OSS

### 外部风险
- 微信政策变化（诱导分享/多级分销）
- 抖音/小红书 API 变更或限流
- LLM API 定价变化

---

## Definition of Done

一个故事完成的定义：
- [ ] 代码实现并提交
- [ ] 单元测试编写并通过（覆盖率 ≥80%）
- [ ] 集成测试通过
- [ ] Code Review 批准
- [ ] 文档更新（API 文档/数据库 schema 文档）
- [ ] 部署到测试环境
- [ ] 验收标准验证通过

---

## Sprint Summary

| Sprint | 名称 | Points | 故事数 | 关键交付物 |
|--------|------|--------|--------|-----------|
| 0 | 基础设施 | 16 | 3 | 开发环境 + DB + 认证 |
| 1 | 核心业务引擎 | 34 | 6 | 锁客 + 佣金 + 商户入驻 |
| 2 | 业务功能 | 31 | 6 | 活动 + 分享员 + 账号绑定 |
| 3 | C端核心 | 26 | 5 | 小程序 + 核销 + AI文案 |
| 4 | 内容与分发 | 24 | 4 | AI视频/海报 + 多平台分发 |
| 5 | 平台运营+AI审核 | 34 | 7 | 审核 + 风控 + AI Agent |
| 6 | AI Agent+运营大屏 | 23 | 5 | AI优化 + 大屏 + AI客服 |
| 7 | 增值功能 | 19 | 5 | 游戏化 + 任务广场 + 快手 |
| **总计** | | **207** | **41** | |

> 注：故事点从 PRD 预估的 268 点优化到 207 点（通过更精细的拆分）

---

## Next Steps

**立即开始：** Sprint 0 基础设施

建议执行顺序：
1. `STORY-AI-001` → 基础项目搭建
2. `STORY-AI-002` → 数据库设计与实现
3. `STORY-AI-003` → 用户认证与权限系统

**Sprint 节奏：**
- Sprint 规划：每周一
- Sprint Review：每周五
- Sprint Retrospective：每周五

**当前状态：** Sprint 1 未开始

---

**This plan was created using BMAD Method v6 - Phase 4 (Implementation Planning)**
**Generated:** 2026-08-20
