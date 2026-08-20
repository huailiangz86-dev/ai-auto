# AI auto — 故事补充：UI 设计 + NFR

**Date:** 2026-08-20
**Author:** zhang
**Status:** Draft

---

## 缺口分析

### 1. UI 设计故事缺失（最大缺口）

当前 41 个故事全是功能性故事，没有任何 UI 设计交付物。UI 设计应该：

- 作为独立 track，与功能开发并行或提前
- 每个功能模块有独立的 UI 故事
- 有明确的设计验收标准（不是"实现功能"而是"设计符合规范且可交付"）

### 2. NFR 覆盖不足

| NFR                | 当前故事覆盖            | 缺口                       |
| ------------------ | ----------------------- | -------------------------- |
| NFR-001 <200ms API | 部分隐含在 STORY-AI-017 | 缺少专项性能测试故事       |
| NFR-002 并发容量   | 无                      | 缺少负载测试故事           |
| NFR-003 认证安全   | STORY-AI-003            | 缺少渗透测试/MFA强制故事   |
| NFR-004 API安全    | STORY-AI-005            | 基本覆盖                   |
| NFR-005 可用性     | 无                      | 缺少灾备演练故事           |
| NFR-006 数据规模   | 无                      | 缺少数据迁移/分区验证故事  |
| NFR-007 合规       | 无                      | 缺少合规清单验收故事       |
| NFR-008 可观测性   | 无                      | 缺少日志/监控/告警接入故事 |

### 3. 故事粒度不均

- STORY-AI-017（核销流程 8点）实际包含：API + 商家后台 + C端 + 风控 → 应拆为 2-3 个故事
- STORY-AI-027（AI Agent 8点）实际包含：NL解析 + 配置生成 + 预览确认 → 应拆为 2 个故事

---

## 补充故事清单

---

### DESIGN-AI-001: 设计系统搭建

**Priority:** Design
**Sprint:** 0 (与 Sprint 0 并行)

**User Story:**
As a design team
I want to establish a shared design system and component library
So that all dashboards and the mini-program maintain visual consistency

**Design Deliverables:**

- [ ] 设计令牌（颜色/字体/间距/阴影）定义文档
- [ ] 基础组件库（Figma/Sketch）：按钮/表单/卡片/表格/弹窗/提示
- [ ] 商家后台组件变体（企业风格 vs 商户风格）
- [ ] 分享员后台组件变体（个人风格）
- [ ] C端小程序组件变体（轻量/流畅）
- [ ] 响应式断点规范（PC vs Mobile）
- [ ] 图标库（Feather Icons / 阿里 iconfont 选型）
- [ ] 设计系统 Storybook 或 Figma 组件库交付

**Dependencies:** None
**Estimate:** 5 points (设计)

---

### DESIGN-AI-002: 商家后台 — 入驻与仪表盘 UI

**Priority:** Design
**Sprint:** 0-1 (先行设计，开发 Sprint 1 开始)

**User Story:**
As a merchant
I want a clean, professional dashboard that helps me understand my business at a glance
So that I can make decisions quickly

**Design Deliverables:**

- [ ] 商家入驻注册表单 UI（营业执照上传/门店信息/企业号授权引导）
- [ ] 商家仪表盘首页 UI（KPI卡片：今日核销/佣金支出/新增客户/ROI趋势图）
- [ ] 仪表盘数据可视化规范（图表类型选择/配色/交互）
- [ ] 订阅管理 UI（套餐选择/支付/续费提醒）
- [ ] 门店管理 UI（门店列表/新增/编辑/地图定位）
- [ ] 商家设置页 UI（账号信息/通知设置/安全设置）
- [ ] 移动端适配（1024px 断点以下商家偶尔用手机看数据）
- [ ] 响应式布局验收：Chrome/Safari/微信浏览器

**Design Specs Required:**

- PC: 1280px 设计稿
- Mobile: 375px 设计稿（商家偶尔手机查看）
- 包含：所有空状态/加载状态/错误状态
- 包含：权限差异（管理员 vs 门店店员）

**Prototype:** 可交互原型（建议 Figma）
**Dependencies:** DESIGN-AI-001, STORY-AI-004
**Estimate:** 5 points (设计)

---

### DESIGN-AI-003: 商家后台 — 活动与券 UI

**Priority:** Design
**Sprint:** 1-2

**User Story:**
As a merchant
I want to create and manage coupon campaigns intuitively
So that I can launch promotions without technical skills

**Design Deliverables:**

- [ ] 活动列表页 UI（卡片/表格双视图切换，状态筛选）
- [ ] 活动创建向导 UI（步骤条：基本信息→券配置→预算→发布）
- [ ] 券配置页 UI（满减/现金奖励/组合券三种模式差异化）
- [ ] AI 自然语言创建入口 UI（对话式引导，而非表单）
- [ ] 活动数据分析页 UI（漏斗图：浏览→领取→核销）
- [ ] 商家后台核销扫码 UI（扫码枪兼容/手动输入切换）
- [ ] 核销历史列表 UI（状态/时间/金额筛选）
- [ ] 券与商品映射配置 UI（表格+搜索+批量操作）

**Design Specs Required:**

- PC: 1280px 设计稿
- 包含：表单验证反馈设计
- 包含：步骤条/向导组件
- 包含：数据为空时的引导文案

**Prototype:** 可交互原型
**Dependencies:** DESIGN-AI-001, DESIGN-AI-002
**Estimate:** 5 points (设计)

---

### DESIGN-AI-004: 商家后台 — 分享员管理 UI

**Priority:** Design
**Sprint:** 2

**User Story:**
As a merchant
I want to manage my sharing agents clearly
So that I can recruit and motivate my distribution network

**Design Deliverables:**

- [ ] 分享员列表页 UI（头像/昵称/等级/今日核销/累计佣金）
- [ ] 分享员详情页 UI（客户列表/推广内容/业绩趋势）
- [ ] 招募链接/二维码生成 UI（样式选择/有效期设置）
- [ ] 招募效果分析页 UI（招募漏斗：曝光→注册→绑定）
- [ ] 分享员审核 UI（如需人工审核模式）
- [ ] 信誉分排行榜 UI（Top10 / 环比变化）

**Design Specs Required:**

- PC: 1280px 设计稿
- 包含：头像/头像占位/默认昵称
- 包含：等级徽章设计（青铜→白银→黄金→钻石→王者）

**Dependencies:** DESIGN-AI-001, STORY-AI-013
**Estimate:** 3 points (设计)

---

### DESIGN-AI-005: 分享员后台 — 基础 UI

**Priority:** Design
**Sprint:** 1-2

**User Story:**
As a sharing agent
I want a personal dashboard that shows my earnings and performance
So that I stay motivated to keep sharing

**Design Deliverables:**

- [ ] 分享员注册/登录 UI（手机号+验证码）
- [ ] 分享员仪表盘首页 UI（今日收益/本周收益/等级进度条/待提现余额）
- [ ] 收益明细页 UI（列表+日汇总+月汇总切换）
- [ ] 提现页 UI（余额→输入金额→选择到账方式→确认）
- [ ] 银行卡绑定 UI（实名+卡号+银行选择）
- [ ] 分享员设置页 UI（个人信息/通知/账号安全）
- [ ] 移动端优先设计（375px → 414px 为主，PC 为辅）

**Design Specs Required:**

- Mobile: 375px 设计稿（主）
- PC: 1280px 设计稿（辅助查看）
- 包含：提现成功/失败反馈设计
- 包含：最低 ¥10 门槛提示设计

**Prototype:** 可交互原型（手机端优先）
**Dependencies:** DESIGN-AI-001, STORY-AI-003, STORY-AI-008
**Estimate:** 5 points (设计)

---

### DESIGN-AI-006: 分享员后台 — 内容与分发 UI

**Priority:** Design
**Sprint:** 2-3

**User Story:**
As a sharing agent
I want to generate content and publish to multiple platforms in one place
So that I can share efficiently

**Design Deliverables:**

- [ ] 可推广券列表 UI（卡片展示：券名/佣金/有效期）
- [ ] AI 文案生成页 UI（选择券→选择平台→语气选择→生成预览→编辑→发布）
- [ ] AI 视频生成页 UI（脚本预览/配音选择/字幕样式/预览播放）
- [ ] AI 海报生成页 UI（多海报对比选择→自定义颜色/文字）
- [ ] 多平台分发页 UI（平台 checkbox 列表→批量发布进度条）
- [ ] 已发布内容管理 UI（发布历史/效果数据/编辑/删除）
- [ ] 追踪链接管理 UI（短链生成/二维码下载/数据统计）

**Design Specs Required:**

- Mobile: 375px 设计稿
- 包含：生成进度/等待状态/失败重试设计
- 包含：Token 费用预估展示设计

**Dependencies:** DESIGN-AI-001, DESIGN-AI-005, STORY-AI-020
**Estimate:** 5 points (设计)

---

### DESIGN-AI-007: C端小程序 — 核心 UI

**Priority:** Design
**Sprint:** 2-3 (先行设计，开发 Sprint 3 开始)

**User Story:**
As a C-end customer
I want to discover and claim coupons effortlessly
So that I use the mini-program frequently

**Design Deliverables:**

- [ ] 小程序首页 UI（LBS 发现/搜索/分享入口）
- [ ] 附近商家列表 UI（卡片：商家图/名称/距离/优惠标签）
- [ ] 商家详情页 UI（商家信息/全部券/门店地图）
- [ ] 券详情页 UI（价值感突出/使用说明/有效期/立即领取按钮）
- [ ] 我的卡包 UI（Tab: 已领/已用/已过期 + 券详情入口）
- [ ] 核销页 UI（二维码/数字码大字体展示）
- [ ] 微信分享 UI（朋友圈封面/文案/小程序卡片）
- [ ] 登录授权页 UI（简洁的隐私协议+同意按钮）

**Design Specs Required:**

- Mobile: 375px（iPhone 为主）
- 包含：微信视觉规范（蓝白主色调/按钮规范）
- 包含：分享到朋友圈/好友/群不同场景设计
- 包含：微信授权流程引导设计
- 包含：所有微交互（下拉刷新/上拉加载更多/页面切换动画）

**Prototype:** 可交互原型（手机端）
**Dependencies:** DESIGN-AI-001, STORY-AI-016, STORY-AI-018
**Estimate:** 5 points (设计)

---

### DESIGN-AI-008: C端小程序 — AI 创作工具 UI

**Priority:** Design
**Sprint:** 3-4

**User Story:**
As a C-end customer
I want AI to help me create promotional content
So that I can earn commissions by sharing

**Design Deliverables:**

- [ ] AI 文案生成 UI（自然语言输入→生成→编辑→分享一键）
- [ ] AI 视频生成 UI（选择模板→文字输入→生成→预览→发布）
- [ ] AI 海报生成 UI（选模板→自定义→下载/分享）
- [ ] 内容编辑页 UI（所见即所得编辑器）
- [ ] 我的作品页 UI（所有 AI 生成内容的列表）
- [ ] 推广效果页 UI（我分享的内容的数据）

**Design Specs Required:**

- Mobile: 375px
- 包含：生成中的加载设计（骨架屏/进度条）
- 包含：生成失败的提示和重试

**Dependencies:** DESIGN-AI-001, DESIGN-AI-007, STORY-AI-036
**Estimate:** 3 points (设计)

---

### DESIGN-AI-009: 运营后台 — 核心 UI

**Priority:** Design
**Sprint:** 4-5

**User Story:**
As a platform admin
I want a powerful but organized operations console
So that I can manage the platform efficiently

**Design Deliverables:**

- [ ] 运营仪表盘首页 UI（实时 KPI 大屏：商户数/活跃分享员/今日核销/GMV/平台收入）
- [ ] 商户审核队列 UI（卡片列表+审核操作面板）
- [ ] 分享员审核队列 UI（列表+审核详情）
- [ ] 核销告警面板 UI（实时推送的告警卡片/处理流程）
- [ ] 财务对账 UI（日账单/月账单/异常流水）
- [ ] 内容审核 UI（AI 审核结果列表/人工复核操作）
- [ ] 风控规则配置 UI（可视化规则编辑/开关/阈值设置）

**Design Specs Required:**

- PC: 1440px 设计稿（运营后台纯 PC）
- 包含：数据表格所有状态（加载/空/错误/筛选/分页）
- 包含：操作确认弹窗（审核拒绝/封禁等高风险操作）
- 包含：仪表盘大屏适配（投屏 1920px 断点）

**Prototype:** 可交互原型
**Dependencies:** DESIGN-AI-001, STORY-AI-031, STORY-AI-032, STORY-AI-033, STORY-AI-034
**Estimate:** 5 points (设计)

---

### NFR-AI-001: 可观测性 — 日志与监控接入

**Epic:** Infrastructure
**Priority:** Infrastructure
**Sprint:** 0-1

**User Story:**
As an operations team
I want structured logging, distributed tracing, and metrics dashboards
So that we can debug issues and monitor system health

**Acceptance Criteria:**

- [ ] NestJS 所有日志输出 JSON 格式，包含 trace_id / user_id / operation
- [ ] FastAPI 所有日志输出 JSON 格式
- [ ] OpenTelemetry SDK 接入 Core API 和 AI Agent
- [ ] 关键路径全链路追踪（登录→核销→佣金计算）
- [ ] Prometheus metrics 端点暴露（request_total / request_duration_seconds / error_rate）
- [ ] Grafana 仪表盘导入（API 延迟/错误率/数据库连接/队列深度）
- [ ] 告警规则配置（p95 > 200ms / 错误率 > 1% / 支付失败）

**Technical Notes:**

- 日志：pino (Node.js) / loguru (Python)
- 链路：OpenTelemetry SDK
- 指标：prom-client / prometheus-fastapi
- 告警：AlertManager → 钉钉 webhook

**Dependencies:** STORY-AI-002, STORY-AI-003
**Estimate:** 5 points

---

### NFR-AI-002: 安全 — 敏感数据加密与 MFA

**Epic:** Infrastructure
**Priority:** Infrastructure
**Sprint:** 1-2

**User Story:**
As a security team
We want all sensitive data encrypted and critical accounts protected with MFA
So that we meet NFR-003 compliance

**Acceptance Criteria:**

- [ ] 敏感字段（银行卡号/身份证号/OAuth Token）使用 AES-256-GCM 加密存储
- [ ] 加密密钥通过环境变量注入（非代码硬编码）
- [ ] 管理员账号强制 MFA（首次登录必须绑定）
- [ ] 商户账号支持 MFA 绑定/解绑
- [ ] JWT secret 使用 RS256（非对称签名）
- [ ] 审计日志记录所有敏感操作（登录/改密/提现/审核）
- [ ] 依赖包安全扫描集成到 CI（npm audit / pip-audit）

**Technical Notes:**

- AES-256-GCM：使用 Node.js crypto / Python cryptography
- MFA：TOTP（Google Authenticator / 阿里云 DMS OTP）
- JWT RS256：使用 ssh-keygen 生成密钥对

**Dependencies:** STORY-AI-003
**Estimate:** 5 points

---

### NFR-AI-003: 性能 — 核销 API <200ms 验证

**Epic:** Infrastructure
**Priority:** Infrastructure
**Sprint:** 1-2

**User Story:**
As a platform
We want the coupon verification API to meet its <200ms p95 SLA
So that merchants' POS systems don't experience delays

**Acceptance Criteria:**

- [ ] k6 负载测试脚本（100 RPS → 500 RPS → 1000 RPS）
- [ ] 验证 API p95 < 200ms（Redis cache hit 场景）
- [ ] 验证 API p95 < 200ms（Redis cache miss → PG 查询场景）
- [ ] Redis attribution cache 命中率 > 95%（活跃归属数据）
- [ ] PG read replica 用于归属查询（写主库、读从库）
- [ ] 连接池配置验证（pg pool: min 10 / max 100）
- [ ] 性能报告输出（p50 / p95 / p99 / max）

**Technical Notes:**

- 负载测试：k6 + Grafana dashboard
- Redis cache TTL: 365 天（归属数据），5 分钟（券数据）
- 目标：Redis < 1ms + PG read replica < 50ms + API overhead < 100ms = < 150ms

**Dependencies:** STORY-AI-006, STORY-AI-007
**Estimate:** 5 points

---

### NFR-AI-004: 灾备 — 数据库备份与 RTO 验证

**Epic:** Infrastructure
**Priority:** Infrastructure
**Sprint:** 2

**User Story:**
As a platform
We want to verify our disaster recovery procedures
So that we can meet NFR-005 (RPO < 1h, RTO < 4h)

**Acceptance Criteria:**

- [ ] 每日凌晨 3 点自动全量备份（pg_dump → OSS）
- [ ] WAL 归档持续备份（流复制到 OSS）
- [ ] 数据库恢复到测试环境演练（每月一次）
- [ ] RPO 验证：最新备份时间戳距今 < 1 小时
- [ ] RTO 演练：从备份启动到服务可用 < 4 小时
- [ ] 跨可用区（Azone）PG 部署验证
- [ ] Redis 数据重建流程（从 PG 重建 attribution cache）

**Technical Notes:**

- 备份脚本：Bash + pg_dump + AWS CLI / 阿里云 CLI
- 恢复演练：每季度一次 DR drill

**Dependencies:** STORY-AI-002
**Estimate:** 3 points

---

### NFR-AI-005: 合规 — 平台政策合规清单验收

**Epic:** Infrastructure
**Priority:** Infrastructure
**Sprint:** 1

**User Story:**
As a compliance team
We want to verify all platform policies are enforced
So that we avoid WeChat/Douyin policy violations

**Acceptance Criteria:**

- [ ] 单级分销强制验证：attribution chain 深度永远 = 1（无链式传播）
- [ ] 微信分享合规文案检查（无诱导分享/诱导关注字样）
- [ ] AI 生成内容自动添加平台要求披露（各平台规定）
- [ ] 数据境内存储确认（无境外服务器）
- [ ] 敏感数据（银行卡/身份证）不导出 CSV/Excel
- [ ] 用户同意书（隐私协议）版本管理 + 展示记录

**Technical Notes:**

- 合规检查：自动化测试用例覆盖所有合规规则
- 披露文案：各平台要求不同，需配置化

**Dependencies:** STORY-AI-003, STORY-AI-006
**Estimate:** 3 points

---

### NFR-AI-006: 可观测性 — 审计日志服务

**Epic:** Infrastructure
**Priority:** Infrastructure
**Sprint:** 1

**User Story:**
As a compliance team
We want all financial operations to be immutably logged
So that commission disputes can be resolved with evidence

**Acceptance Criteria:**

- [ ] commission_ledger 表禁止 UPDATE/DELETE（DB 角色权限限制）
- [ ] 审计日志表记录所有写入操作（actor/before/after/timestamp）
- [ ] 佣金相关操作写入 audit_logs（计算/结算/提现/失败重试）
- [ ] 审计日志只可追加，不可修改（DB 角色权限限制）
- [ ] 审计日志 API（管理员只读查询）
- [ ] 导出功能（CSV）脱敏（银行卡号中间脱星）

**Technical Notes:**

- audit_log_entity: see STORY-AI-002 entity
- DB role separation: readonly_role (SELECT audit_logs) vs app_role (INSERT only)

**Dependencies:** STORY-AI-002, STORY-AI-003
**Estimate:** 3 points

---

## 故事拆分建议

以下故事建议拆分为更小的故事：

### STORY-AI-017 拆分为 2 个

**STORY-AI-017A: C端券核销 API 与幂等处理** (3点)

- API 实现（验证/幂等/72h 窗口）
- C端出示券码 + 商家扫码核销

**STORY-AI-017B: 核销商家后台 UI 与回调集成** (5点)

- 商家后台核销扫码 UI
- 商家 POS 系统回调集成
- 72h 超时告警

### STORY-AI-027 拆分为 2 个

**STORY-AI-027A: AI Agent NL → 配置解析** (5点)

- LLM prompt 工程
- 配置参数映射
- 配置预览 JSON

**STORY-AI-027B: AI Agent 多轮对话与确认流程** (3点)

- 商家追问/修改机制
- 配置确认 → 活动创建

### STORY-AI-012 拆分为 2 个

**STORY-AI-012A: 裂变链路数据采集** (3点)

- 事件埋点规范
- ClickHouse 数据接入
- 实时漏斗数据 API

**STORY-AI-012B: 裂变分析仪表盘 UI + 导出** (2点)

- 商家后台分析仪表盘 UI
- CSV/Excel 导出功能

---

## 更新后的 Sprint 分配建议

| Sprint   | 功能故事 | 设计故事   | NFR故事 | 合计 | 容量      |
| -------- | -------- | ---------- | ------- | ---- | --------- |
| Sprint 0 | 16点     | 10点(并行) | 3点     | 29点 | 48        |
| Sprint 1 | 34点     | 5点        | 16点    | 55点 | 48 ❌超载 |
| Sprint 2 | 31点     | 13点       | 3点     | 47点 | 48        |
| Sprint 3 | 26点     | 8点        | 0点     | 34点 | 48        |
| Sprint 4 | 24点     | 5点        | 0点     | 29点 | 48        |
| Sprint 5 | 34点     | 5点        | 0点     | 39点 | 48        |
| Sprint 6 | 23点     | 0点        | 0点     | 23点 | 48        |
| Sprint 7 | 19点     | 0点        | 0点     | 19点 | 48        |

**问题：** Sprint 1 超载（55 > 48）。建议：

- 将 STORY-AI-012 拆分后的 3 点移到 Sprint 3
- 将 STORY-AI-009（商家钱包 3点）移到 Sprint 2 末尾
- NFR-AI-001/002/005/006 在 Sprint 1 密集，建议分散

---

## 设计 → 开发工作流建议

```
Sprint N-1 设计 Sprint N 的 UI
     ↓
Sprint N 开发 Sprint N 的功能
     ↓
Sprint N+1 设计 Sprint N+1 的 UI
     ↓
...
```

**当前建议：**

1. **立即启动 DESIGN-AI-001 + DESIGN-AI-002**（商家后台是最重要的付费用户界面）
2. **DESIGN-AI-007 C端小程序 UI 与功能开发 Sprint 3 并行**
3. **DESIGN-AI-009 运营后台 UI 在功能 Sprint 5 前 1 个 Sprint 完成**
4. 所有设计故事由 UX designer 执行（如果没有专职 designer，可以用 AI Figma plugin 生成初稿，工程师 review）

---

## UI 设计交付标准

每个 UI 故事的验收标准必须包含：

- [ ] **可交互原型**（Figma Link）
- [ ] **设计稿标注**（所有尺寸/间距/字体/颜色标注）
- [ ] **设计组件规范**（对应的组件库条目）
- [ ] **响应式适配**（所有断点）
- [ ] **状态覆盖**（默认/hover/active/disabled/loading/error/empty）
- [ ] **Accessibility**（ARIA label / 键盘导航 / 颜色对比度）
- [ ] **设计验收签字**（Product Owner review）

---

_This supplement was created to address gaps in the original sprint plan: UI design track and NFR story coverage._
