# System Architecture: AI auto

**Date:** 2026-08-20
**Architect:** zhang
**Version:** 1.0
**Project Type:** AI-native sharing agent distribution tool (SaaS, tool-only, no e-commerce store)
**Project Level:** 3
**Status:** Draft

---

## Document Overview

This document defines the system architecture for **AI auto** — an AI-native sharing agent distribution platform. It provides the technical blueprint for implementation, addressing all 40 functional requirements and 8 non-functional requirements from the PRD.

**Related Documents:**

- Product Requirements Document: `docs/prd-ai-auto-2026-08-20.md`
- Brainstorming: `docs/brainstorming-ai-auto-2026-08-19.md`

---

## Executive Summary

AI auto is a platform that connects merchants, sharing agents, and C-end customers through a social裂变 mechanism backed by AI automation. The system handles coupon distribution, 365-day customer attribution, commission settlement (T+3), and AI-powered content generation.

**Architecture Highlights:**

- **Backend**: Node.js (NestJS) for API services + Python (FastAPI) for AI Agent
- **Database**: PostgreSQL (primary data) + Redis (caching, sessions, queues)
- **Infrastructure**: Alibaba Cloud (China mainland)
- **Frontend**: Uni-app (WeChat mini-program for C-end) + React (merchant/admin dashboards)
- **AI**: Claude API / GPT-4 / Kimi API for content generation
- **Team Size**: 2-3 developers

---

## Architectural Drivers

These NFRs heavily influence architectural decisions:

| #   | Driver                               | NFR        | Impact                                                       |
| --- | ------------------------------------ | ---------- | ------------------------------------------------------------ |
| 1   | Coupon verification <200ms (p95)     | NFR-001    | Redis cache layer + read replicas + local queue buffering    |
| 2   | Commission accuracy (financial core) | EPIC-005   | Idempotency + distributed transactions + immutable audit log |
| 3   | 365-day attribution tracking         | NFR-006    | Time-series partitioning + reverse index                     |
| 4   | AI content generation (concurrent)   | NFR-002    | Async job queue + rate limiting + pre-generation             |
| 5   | Multi-platform OAuth integration     | FR-028~031 | Unified OAuth gateway + token management service             |
| 6   | Real-time fraud detection            | FR-025     | Stream processing + rule engine                              |
| 7   | 99.9% uptime for verification API    | NFR-005    | Multi-AZ deployment + circuit breakers                       |
| 8   | 1M+ daily sharing events             | NFR-006    | Horizontal scaling + event sourcing                          |

---

## System Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         AI auto Platform                             │
│                                                                      │
│  ┌──────────┐  ┌──────────────┐  ┌─────────────┐                 │
│  │ WeChat   │  │  Merchant    │  │   Admin     │                 │
│  │ Mini-Prg │  │  Dashboard    │  │  Dashboard   │                 │
│  │(Uni-app) │  │  (React)      │  │  (React)     │                 │
│  └────┬─────┘  └──────┬───────┘  └──────┬──────┘                 │
│       │                 │                   │                        │
│       └────────────────┴───────────────────┘                        │
│                         │ HTTPS                                     │
│                    ┌────▼────┐                                     │
│                    │ API GW  │ (Kong / Nginx)                      │
│                    │ Rate Lim│ + CORS + Auth                       │
│                    └────┬────┘                                     │
│            ┌────────────┼────────────┐                            │
│     ┌──────▼──────┐     │     ┌─────▼─────┐                     │
│     │ Core API     │     │     │ AI Agent   │                     │
│     │ (NestJS)     │◄────┴────►│ (FastAPI)  │                     │
│     │ :3000         │            │ :8000      │                     │
│     └──────┬───────┘            └─────┬─────┘                     │
│            │                              │                          │
│  ┌─────────┼──────────────────────────────────────────┐             │
│  │         │           Data Layer                    │             │
│  │  ┌──────▼──────┐        ┌──────▼──────┐         │             │
│  │  │ PostgreSQL   │        │    Redis     │         │             │
│  │  │  (Primary)   │        │  Cache/Queue │         │             │
│  │  │  :5432       │        │   :6379      │         │             │
│  │  └──────┬───────┘        └──────┬───────┘         │             │
│  │         │                          │                 │             │
│  │  ┌──────▼──────┐         ┌──────▼──────┐         │             │
│  │  │ PostgreSQL   │         │  RocketMQ   │         │             │
│  │  │ (Read Replica│         │  (Job Queue)│         │             │
│  │  │  :5433)      │         │             │         │             │
│  │  └─────────────┘         └─────────────┘         │             │
│  └─────────────────────────────────────────────────┘             │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────┐        │
│  │              External Integrations                      │        │
│  │  WeChat│Douyin│Xiaohongshu│LLM APIs│Payment GW      │        │
│  └─────────────────────────────────────────────────────────┘        │
└─────────────────────────────────────────────────────────────────────┘
```

### Component Inventory

| Component          | Type           | Technology               | Instances |
| ------------------ | -------------- | ------------------------ | --------- |
| API Gateway        | Network        | Kong / Nginx             | 2+        |
| Core API           | Service        | NestJS (Node.js)         | 3+        |
| AI Agent           | Service        | FastAPI (Python)         | 2+        |
| PostgreSQL Primary | Database       | PostgreSQL 16            | 1         |
| PostgreSQL Replica | Database       | PostgreSQL 16            | 1+        |
| Redis Cluster      | Cache/Queue    | Redis 7                  | 3         |
| Job Queue          | Message Queue  | RocketMQ / Redis Streams | 1         |
| File Storage       | Object Storage | Alibaba OSS              | 1         |
| CDN                | CDN            | Alibaba CDN              | 1         |

---

## Technology Stack

### Backend — Core API

**Choice:** NestJS (Node.js + TypeScript)

**Rationale:**

- Non-blocking I/O is ideal for I/O-heavy workloads (95% of requests are DB/network calls)
- TypeScript provides enterprise-grade type safety for financial calculations (commission engine)
- NestJS framework offers modular architecture, dependency injection, and familiar OOP patterns
- 2-3 person team: faster development than Java (3-5x less boilerplate)
- Excellent ecosystem for JWT auth, ORM (Prisma/Drizzle), validation (class-validator)

**Trade-offs:**

- ✗ Single-threaded CPU bottleneck for heavy computation → resolved by offloading to AI Agent Python service
- ✗ Not ideal for CPU-intensive tasks → AI service is separate Python process

### Backend — AI Agent

**Choice:** Python + FastAPI

**Rationale:**

- Python has the most mature LLM SDK ecosystem (Claude, GPT-4, Kimi)
- FastAPI is async-first, comparable performance to Node.js
- AI content generation (copy/video/poster) runs in isolated service
- Independent scaling: AI service can scale separately from Core API

**Trade-offs:**

- ✗ Two language runtimes = slightly more DevOps complexity → mitigated by Docker containers

### Database

**Choice:** PostgreSQL 16

**Rationale:**

- ACID transactions are mandatory for commission calculations (financial data)
- JSONB supports flexible schemas (coupon rules, activity configurations)
- Full-text search (PostgreSQL tsvector) for C-end coupon discovery
- TimescaleDB extension available for time-series attribution data
- Rich index types (B-tree, GIN, partial indexes) for attribution queries
- Supports read replicas for horizontal scaling

**Trade-offs:**

- ✗ Write throughput ceiling → mitigated with read replicas + connection pooling

### Cache & Session & Queue

**Choice:** Redis 7

**Rationale:**

- Attribution lookup cache (Redis): 365-day attribution query <5ms
- Session store for merchant/agent/admin dashboards
- Rate limiting token bucket
- Job queue: async AI content generation jobs
- Pub/sub for real-time notifications

**Trade-offs:**

- ✗ Redis persistence is optional (data is reconstructible) → PG is source of truth

### Frontend — C-End (Mini-Program)

**Choice:** Uni-app (Vue 3 syntax, compiled to WeChat mini-program)

**Rationale:**

- Single codebase compiles to WeChat mini-program (primary target)
- Can also compile to H5, iOS/Android if needed in future
- Better DX than native WXML/WXSS
- Rich component ecosystem
- Team already has Vue experience

**Trade-offs:**

- ✗ WeChat-specific APIs require platform-specific handling → isolated in a platform adapter layer
- ✗ Performance slightly lower than native → acceptable for coupon discovery use case

### Frontend — Merchant & Admin Dashboard

**Choice:** React 18 + Vite + Ant Design Pro

**Rationale:**

- Ant Design Pro provides enterprise-grade data table, chart, and form components out of the box
- Vite for fast hot reload during development
- Rich ecosystem for complex dashboards (merchant ROI analytics, admin fraud monitoring)
- TypeScript + React = predictable state management

### Infrastructure

**Choice:** Alibaba Cloud (China mainland)

**Rationale:**

- WeChat / Douyin / Alipay APIs have lowest latency from China-based infrastructure
- Comprehensive managed services reduce DevOps burden for 2-3 person team
- Compliance: data residency in mainland China as required by NFR-007
- Cost-effective: pay-as-you-go scaling

**Services:**

| Service          | Usage                                      |
| ---------------- | ------------------------------------------ |
| ECS / ACK (K8s)  | Compute                                    |
| RDS PostgreSQL   | Managed database                           |
| Redis (ApsaraDB) | Managed cache                              |
| OSS              | File storage (AI-generated videos/posters) |
| CDN              | Static assets + mini-program assets        |
| SLS              | Structured logging                         |
| ARMS             | Application monitoring                     |
| API Gateway      | External API management                    |
| RocketMQ         | Async job queue                            |

### Authentication

**Choice:** JWT (merchant/agent) + WeChat OAuth (C-end)

**Rationale:**

- JWT for stateless authentication in Core API
- WeChat OAuth for C-end mini-program (WeChat session)
- Admin accounts use JWT with 2FA enforcement

### AI Providers

**Choice:** Claude API (primary) + GPT-4 (fallback) + Kimi (cost optimization)

**Rationale:**

- Claude has strongest Chinese language performance
- GPT-4 as fallback for reliability
- Kimi for cost-sensitive bulk generation

---

## System Components

### Component 1: API Gateway

**Purpose:** Single entry point for all client requests

**Responsibilities:**

- TLS termination
- CORS enforcement
- Request routing (merchant API / agent API / C-end API / admin API)
- Rate limiting (1000 req/min per API key for merchant APIs per NFR-004)
- JWT token validation
- Request logging (structured JSON logs for SLS)

**Interfaces:**

- REST API over HTTPS (port 443)
- WebSocket for real-time notifications (agent commission updates)

**Dependencies:**

- Auth Service (JWT validation via shared secret)
- Redis (rate limit counters)
- Core API (routing target)

**FRs Addressed:** FR-003, FR-005, FR-013, FR-014, FR-015, FR-028

---

### Component 2: Core API Service (NestJS)

**Purpose:** Central business logic hub — all domain operations except AI generation

**Sub-Modules:**

**2a. Merchant Module**

- Registration, subscription, store management
- API key generation (HMAC-SHA256 signed keys per NFR-003)
- Commission budget wallet management (prepaid balance)
- Coupon/activity CRUD
- Attribution management

**2b. Agent Module**

- Agent registration, account binding (multi-platform)
- Reputation score calculation
- Commission account (accrual, settlement T+3, withdrawal)
- Content publish tracking

**2c. Attribution Module**

- Click attribution (URL parameter parsing: agent_id, merchant_id, platform)
- 365-day lock period tracking
- Customer profile (user_id, first_click_ts, agent_id)
- Attribution chain: agent → click → customer → redemptions

**2d. Commission Module**

- Commission calculation engine (compound model, 20% platform fee)
- T+3 settlement scheduler (cron job: daily at 00:05 CST)
- Withdrawal processor
- Commission ledger (immutable audit log)

**2e. Coupon Module**

- Coupon issuance and management
- Redemption verification API (NFR-001: <200ms p95)
- Coupon inventory tracking
- Validity checking

**2f. Content Module**

- AI content generation job submission
- Content moderation (AI scan before publishing)
- Content versioning

**2g. OAuth Gateway Module**

- Unified OAuth flow for Douyin/Xiaohongshu/WeChat
- Token storage and auto-refresh
- Per-account (not per-user) token management

**2h. Analytics Module**

- Real-time event ingestion
- Aggregation pipelines (hourly/daily/weekly)
- BI dashboard data endpoints

**Interfaces:**

- Internal REST APIs
- Async job submission to RocketMQ

**Dependencies:**

- PostgreSQL (all domain data)
- Redis (attribution cache, rate limits, sessions)
- AI Agent (async via queue)
- OAuth providers (external)
- Payment gateway (external)

**FRs Addressed:** FR-001~~FR-009, FR-013, FR-014, FR-016~~FR-020, FR-024~~FR-026, FR-028~~FR-030, FR-032~FR-034, FR-038

---

### Component 3: AI Agent Service (FastAPI)

**Purpose:** Isolated AI content generation and campaign automation engine

**Sub-Modules:**

**3a. Content Generation Engine**

- Copy generation: prompt engineering + Claude/GPT-4 API
- Video generation: text-to-video API (Runway/PIKA/Kling) or script + TTS pipeline
- Poster generation: image generation API + overlay composition
- Content moderation scan (prohibited keywords, policy violations)

**3b. Campaign Agent**

- Natural language → campaign configuration parser (LLM)
- Activity auto-configuration (FR-032)
- Performance optimizer: adjusts budget allocation, timing (FR-019)
- Trend analyzer: holiday/event calendar + merchant history (FR-020)

**3c. AI Customer Service**

- FAQ engine: FAQ matching + LLM response generation
- Escalation classifier: routes unresolved queries to human admin

**Interfaces:**

- Internal REST API (POST /generate/copy, POST /generate/video, POST /campaign/create)
- Streaming responses for long video generation
- Webhook callbacks on job completion

**Dependencies:**

- LLM APIs (Claude, GPT-4, Kimi)
- Video generation APIs
- Image generation APIs
- RocketMQ (job queue consumer)
- PostgreSQL (job status, content storage references)

**FRs Addressed:** FR-003, FR-010, FR-011, FR-012, FR-019, FR-020, FR-023, FR-027, FR-032, FR-033

---

### Component 4: Attribution Engine (Embedded in Core API)

**Purpose:** Core mechanism that powers the 365-day lock period and customer attribution

**Algorithm:**

```sql
-- Attribution lookup on each verification request
-- Performance: <5ms via Redis cache
-- Cache key: md5(customer_openid + merchant_id)
-- Cache TTL: 366 days

SELECT agent_id, first_click_timestamp, lock_expire_timestamp
FROM attribution
WHERE customer_id = $1
  AND merchant_id = $2
  AND lock_expire_timestamp > NOW()
ORDER BY first_click_timestamp ASC
LIMIT 1;
```

**Lock Period Flow:**

```
1. Agent shares link → URL includes: agent_id, merchant_id, platform, campaign_id
2. C-end clicks link → Attribution module records:
   - customer_id (from WeChat OAuth)
   - agent_id
   - merchant_id
   - first_click_timestamp = NOW()
   - lock_expire_timestamp = NOW() + 365 days
3. Redis caches: customer → {agent_id, lock_expire}
4. Any redemption within 365 days → Redis lookup → assign commission to agent
5. Lock expires → attribution record retained for 1 year (FR retention), then purged
```

**FRs Addressed:** FR-006

---

### Component 5: Commission Engine

**Purpose:** Financial core — accurate, auditable, tamper-proof commission calculation

**Principles:**

- **Idempotency**: Every commission event has a unique idempotency_key (redemption_id)
- **Immutable Ledger**: commission_ledger table is append-only, never updated
- **Dual-entry**: Every credit has a matching debit (agent credit, platform fee credit)
- **Audit Trail**: All mutations logged to immutable audit_log table

**Commission Flow (per redemption):**

```
1. Merchant calls POST /verify with: coupon_code + transaction_amount
2. Attribution lookup (Redis): find agent_id for this customer
3. Commission calculation:
   - merchant_reward = merchant_configured_reward  (e.g., ¥10 per redemption)
   - agent_share = merchant_reward × 80%          (e.g., ¥8)
   - platform_fee = merchant_reward × 20%         (e.g., ¥2)
4. Insert into commission_ledger (idempotency_key = redemption_id)
5. Update agent's pending_balance (not yet settled)
6. Settlement job (daily, T+3):
   - Move from pending_balance → available_balance
   - Mark settlement record as settled
7. Withdrawal: available_balance → payment gateway → agent's bank/WeChat Pay
```

**FRs Addressed:** FR-007, FR-008, FR-024

---

### Component 6: Fraud Detection Engine

**Purpose:** Real-time and batch fraud detection to protect commission integrity

**Detection Rules (configurable):**

| Rule                 | Logic                                                  | Action              |
| -------------------- | ------------------------------------------------------ | ------------------- |
| Velocity check       | >10 redemptions from same customer in 1 hour           | Flag pending review |
| Self-redemption      | Customer device fingerprint matches agent              | Block + alert       |
| Coordinated traffic  | >5 agents sharing from same /24 IP subnet              | Flag pending review |
| Unusual pattern      | Redemption amount variance >300% from merchant average | Flag pending review |
| Duplicate redemption | Same coupon_code + customer_id submitted twice         | Reject second       |

**Implementation:**

- Real-time: Redis sliding window counters for velocity checks
- Batch: Daily job scans all transactions for pattern anomalies
- ML model (future): LSTM anomaly detection on transaction sequences

**FRs Addressed:** FR-025

---

### Component 7: Multi-Platform OAuth Service

**Purpose:** Unified integration with Douyin, Xiaohongshu, and WeChat Video Account

**Token Management:**

- Each agent can bind multiple accounts per platform (no limit)
- Tokens stored encrypted (AES-256) in PostgreSQL
- Background job refreshes tokens 7 days before expiry
- Revocation detection → notify agent, suspend publishing for that account

**Platform-Specific Adapters:**

```
OAuthGateway
  ├── DouyinAdapter (open.douyin.com APIs)
  ├── XiaohongshuAdapter (.xiaohongshu.com APIs)
  ├── WeChatVideoAdapter (open.weixin.qq.com APIs)
  └── KuaishouAdapter (open.kuaishou.com APIs) — Phase 4
```

**FRs Addressed:** FR-013, FR-014, FR-028, FR-029, FR-030, FR-031

---

## Data Architecture

### Data Model (Core Entities)

```
┌─────────────────┐      ┌──────────────────┐
│    Merchant      │──┐    │     Store         │
│  (company/org)  │  └───►│  (per ¥1,200/yr)│
└────────┬────────┘       └────────┬─────────┘
         │                         │
         │ 1:N                    │ 1:N
         ▼                         ▼
┌─────────────────┐       ┌──────────────────┐
│  Coupon         │       │  Agent           │
│  (per store)   │       │  (can bind multi │
│                 │       │   merchants)     │
└────────┬───────┘       └────────┬─────────┘
         │                         │
         │ n:1                     │ n:n (via attribution)
         ▼                         ▼
┌─────────────────┐       ┌──────────────────┐
│CustomerCoupon   │◄──────│   Customer       │
│(per claim)     │       │  (WeChat OpenID) │
└────────┬───────┘       └──────────────────┘
         │                         ▲
         │ n:1                    │
         ▼                         │
┌─────────────────┐               │
│ Attribution     │───────────────┘
│ (365-day lock) │        1:N
└────────┬───────┘
         │
         │ 1:N
         ▼
┌─────────────────┐
│CommissionLedger│  ←─ immutable append-only
└────────┬───────┘
         │
         ├─► AgentAccount (pending_balance, available_balance)
         └─► PlatformRevenue (20% platform fee)
              ↑
              │ commission_royalty
```

**New Entities Added:**

- **CustomerCoupon**: 用户领券记录（claim 时生成，含券码）
- **FraudAlert**: 风控告警（Component 6 输出）
- **MerchantApiKey**: 商户 API Key 管理
- **PlatformRevenue**: 平台收入流水（20% 佣金记录）

### Entity Specifications

**Merchant**

| Field                     | Type          | Notes                    |
| ------------------------- | ------------- | ------------------------ |
| id                        | UUID          | Primary key              |
| name                      | VARCHAR(200)  | Company/store name       |
| business_license_url      | TEXT          | OSS path                 |
| subscription_expire_at    | TIMESTAMP     | Subscription expiry      |
| commission_wallet_balance | DECIMAL(12,2) | Prepaid budget           |
| status                    | ENUM          | pending/active/suspended |
| created_at                | TIMESTAMP     |                          |

**Store** (belongs to Merchant)

| Field                  | Type         | Notes              |
| ---------------------- | ------------ | ------------------ |
| id                     | UUID         |                    |
| merchant_id            | UUID         | FK                 |
| name                   | VARCHAR(200) | Store name         |
| subscription_expire_at | TIMESTAMP    | Per-store expiry   |
| auto_approve_agent     | BOOLEAN      | Agent binding mode |

**Coupon** (created by Merchant, mapped to merchant's product)

| Field               | Type          | Notes                     |
| ------------------- | ------------- | ------------------------- |
| id                  | UUID          |                           |
| store_id            | UUID          | FK                        |
| merchant_product_id | VARCHAR(100)  | External product ID       |
| coupon_type         | ENUM          | discount/cash/combo       |
| coupon_value        | DECIMAL(10,2) | ¥ amount                  |
| agent_reward        | DECIMAL(10,2) | ¥ per redemption to agent |
| valid_from          | TIMESTAMP     |                           |
| valid_until         | TIMESTAMP     |                           |
| per_customer_limit  | INT           | 1 or unlimited            |
| total_inventory     | INT           | nullable = unlimited      |
| inventory_remaining | INT           |                           |
| status              | ENUM          | active/paused/exhausted   |

**Agent**

| Field             | Type          | Notes                           |
| ----------------- | ------------- | ------------------------------- |
| id                | UUID          |                                 |
| phone             | VARCHAR(20)   |                                 |
| status            | ENUM          | pending/active/banned           |
| reputation_score  | INT           | Customer acquisition score      |
| level             | ENUM          | bronze/silver/gold/diamond/king |
| pending_balance   | DECIMAL(12,2) | Awaiting T+3 settlement         |
| available_balance | DECIMAL(12,2) | Ready for withdrawal            |

**AgentPlatformAccount** (one per platform per agent)

| Field                 | Type      | Notes                                     |
| --------------------- | --------- | ----------------------------------------- |
| id                    | UUID      |                                           |
| agent_id              | UUID      | FK                                        |
| platform              | ENUM      | douyin/xiaohongshu/video_account/kuaishou |
| account_type          | ENUM      | personal/enterprise                       |
| oauth_token_encrypted | TEXT      | AES-256 encrypted                         |
| token_expire_at       | TIMESTAMP |                                           |
| binding_status        | ENUM      | authorized/revoked/expired                |

**Attribution** (365-day lock)

| Field           | Type                                       | Notes                             |
| --------------- | ------------------------------------------ | --------------------------------- |
| id              | UUID                                       |                                   |
| customer_id     | VARCHAR(100)                               | WeChat OpenID                     |
| merchant_id     | UUID                                       | FK                                |
| agent_id        | UUID                                       | FK                                |
| coupon_id       | UUID                                       | Nullable                          |
| first_click_at  | TIMESTAMP                                  | Lock start                        |
| lock_expire_at  | TIMESTAMP                                  | Lock end (first_click + 365 days) |
| source_platform | ENUM                                       | wechat/douyin/xiaohongshu         |
| campaign_id     | UUID                                       | Nullable                          |
| INDEX           | (customer_id, merchant_id, lock_expire_at) | Primary query index               |

**CommissionLedger** (append-only, immutable)

| Field              | Type          | Notes                                  |
| ------------------ | ------------- | -------------------------------------- |
| id                 | UUID          |                                        |
| idempotency_key    | VARCHAR(100)  | UNIQUE — redemption_id                 |
| agent_id           | UUID          | FK                                     |
| merchant_id        | UUID          | FK                                     |
| customer_id        | VARCHAR(100)  |                                        |
| coupon_id          | UUID          | FK                                     |
| redemption_id      | UUID          |                                        |
| merchant_reward    | DECIMAL(10,2) | Total reward                           |
| agent_share        | DECIMAL(10,2) | 80% of reward                          |
| platform_fee       | DECIMAL(10,2) | 20% of reward                          |
| is_compound        | BOOLEAN       | True if same customer redeems again    |
| compound_parent_id | UUID          | FK to previous commission ledger entry |
| settlement_status  | ENUM          | pending/settled/withdrawn              |
| settlement_date    | DATE          | T+3 from redemption                    |
| created_at         | TIMESTAMP     |                                        |

**AgentWithdrawal**

| Field           | Type          | Notes                             |
| --------------- | ------------- | --------------------------------- |
| id              | UUID          |                                   |
| agent_id        | UUID          | FK                                |
| amount          | DECIMAL(10,2) | Must be >= ¥10                    |
| payment_method  | ENUM          | alipay/wechat_pay/bank_card       |
| payment_account | VARCHAR(200)  | Encrypted                         |
| status          | ENUM          | pending/processing/success/failed |
| idempotency_key | VARCHAR(100)  | UNIQUE                            |
| created_at      | TIMESTAMP     |                                   |

**ContentJob** (AI generation tracking)

| Field             | Type          | Notes                              |
| ----------------- | ------------- | ---------------------------------- |
| id                | UUID          |                                    |
| agent_id          | UUID          | FK                                 |
| coupon_id         | UUID          | FK                                 |
| content_type      | ENUM          | copy/video/poster                  |
| status            | ENUM          | queued/processing/completed/failed |
| prompt            | TEXT          |                                    |
| result_url        | TEXT          | OSS path to generated content      |
| token_cost        | DECIMAL(10,4) | Token consumption                  |
| ai_cost           | DECIMAL(10,4) | Actual cost                        |
| agent_share_cost  | DECIMAL(10,4) | Deducted from agent balance        |
| moderation_passed | BOOLEAN       | Content policy check               |
| created_at        | TIMESTAMP     |                                    |
| completed_at      | TIMESTAMP     |                                    |

**CustomerCoupon** (user's claimed coupon, created on claim)

| Field              | Type                     | Notes                                          |
| ------------------ | ------------------------ | ---------------------------------------------- |
| id                 | UUID                     | Primary key                                    |
| customer_id        | UUID                     | FK to Customer                                 |
| coupon_id          | UUID                     | FK to Coupon                                   |
| coupon_code        | VARCHAR(50)              | UNIQUE — 用于商家扫码核销                      |
| attribution_id     | UUID                     | FK to Attribution（nullable，LBS来源无归属）   |
| agent_id           | UUID                     | FK to Agent（nullable）                        |
| source             | ENUM                     | share_link/qr_code/lbs/search/wechat_mp        |
| merchant_id        | UUID                     | FK to Merchant                                 |
| merchant_name      | VARCHAR(200)             | 反规范：便于列表查询                           |
| coupon_name        | VARCHAR(200)             | 反规范：便于列表查询                           |
| coupon_type        | ENUM                     | discount/cash/combo                            |
| discount_amount    | DECIMAL(12,2)            | 快照：领券时记录                               |
| threshold_amount   | DECIMAL(12,2)            | 快照                                           |
| cash_reward_amount | DECIMAL(12,2)            | 快照                                           |
| valid_from         | TIMESTAMP                |                                                |
| expire_at          | TIMESTAMP                | 领券时根据 validity_type 计算                  |
| validity_type      | ENUM                     | days_after_claim/date_range                    |
| status             | ENUM                     | active/used/expired                            |
| claimed_at         | TIMESTAMP                |                                                |
| used_at            | TIMESTAMP                | 核销时间                                       |
| redemption_id      | UUID                     | FK to Redemption（nullable）                   |
| share_platform     | ENUM                     | wechat_friend/wechat_moment/douyin/xiaohongshu |
| share_count        | INT                      | 分享次数                                       |
| INDEX              | (customer_id, coupon_id) | UNIQUE — 每人每券只能领一次                    |
| INDEX              | (coupon_code)            | UNIQUE                                         |
| INDEX              | (expire_at)              | 过期扫描                                       |

**FraudAlert** (风控告警)

| Field             | Type               | Notes                                                                                                                                                             |
| ----------------- | ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| id                | UUID               | Primary key                                                                                                                                                       |
| alert_type        | ENUM               | suspicious_self_redemption/high_frequency_redemption/merchant_abnormal_rate/coupon_stacking/device_fingerprint/ip_clustering/commission_anomaly/content_violation |
| severity          | ENUM               | critical/warning/notice                                                                                                                                           |
| confidence_score  | DECIMAL(4,3)       | AI 模型置信度 0.0-1.0                                                                                                                                             |
| status            | ENUM               | pending/reviewed/actioned/dismissed                                                                                                                               |
| agent_id          | UUID               | FK（nullable）                                                                                                                                                    |
| merchant_id       | UUID               | FK（nullable）                                                                                                                                                    |
| redemption_id     | UUID               | FK（nullable）                                                                                                                                                    |
| evidence          | JSONB              | 证据数组 [{type, description, value, threshold}]                                                                                                                  |
| ai_model_output   | JSONB              | AI 模型原始输出                                                                                                                                                   |
| ai_model_name     | VARCHAR(50)        |                                                                                                                                                                   |
| auto_action_taken | VARCHAR(100)       | redemption_blocked/commission_frozen/agent_suspended                                                                                                              |
| reviewed_by       | UUID               | 审核人                                                                                                                                                            |
| reviewed_at       | TIMESTAMP          |                                                                                                                                                                   |
| review_notes      | TEXT               |                                                                                                                                                                   |
| final_action      | VARCHAR(50)        | freeze_commission/suspend_agent/suspend_merchant/dismiss                                                                                                          |
| merchant_notified | BOOLEAN            |                                                                                                                                                                   |
| agent_notified    | BOOLEAN            |                                                                                                                                                                   |
| INDEX             | (status, severity) | 优先级队列查询                                                                                                                                                    |
| INDEX             | (created_at)       | 时间倒序                                                                                                                                                          |

**MerchantApiKey** (商户 API Key 管理)

| Field                      | Type          | Notes                     |
| -------------------------- | ------------- | ------------------------- |
| id                         | UUID          | Primary key               |
| merchant_id                | UUID          | FK to Merchant            |
| api_key                    | VARCHAR(100)  | UNIQUE，格式 app_{random} |
| api_secret_hash            | VARCHAR(255)  | bcrypt 加密存储           |
| key_name                   | VARCHAR(100)  | 备注名（可选）            |
| ip_whitelist               | TEXT          | 逗号分隔，nullable=不限制 |
| rate_limit_per_minute      | INT           | 默认 100                  |
| callback_url               | VARCHAR(500)  | 核销结果回调地址          |
| callback_secret            | VARCHAR(255)  | HMAC-SHA256 签名密钥      |
| status                     | BOOLEAN       | true=启用，false=吊销     |
| total_calls                | BIGINT        | 调用计数                  |
| last_called_at             | TIMESTAMP     |                           |
| first_used_at              | TIMESTAMP     |                           |
| previous_api_secret_hash   | VARCHAR(255)  | 轮换时保留旧密钥          |
| previous_secret_expires_at | TIMESTAMP     | 轮换宽限期                |
| INDEX                      | (api_key)     | UNIQUE                    |
| INDEX                      | (merchant_id) | 商户下所有 Key 查询       |

**PlatformRevenue** (平台收入流水，append-only)

| Field           | Type           | Notes                                           |
| --------------- | -------------- | ----------------------------------------------- |
| id              | UUID           | Primary key                                     |
| revenue_type    | ENUM           | commission_royalty/subscription/ai_token/refund |
| amount          | DECIMAL(14,2)  | 正数=收入，负数=退款                            |
| commission_id   | UUID           | FK（佣金提成时）                                |
| subscription_id | UUID           | FK（订阅收入时）                                |
| merchant_id     | UUID           | FK（nullable）                                  |
| agent_id        | UUID           | FK（nullable）                                  |
| revenue_date    | DATE           | 日结聚合 key（YYYY-MM-DD）                      |
| balance_before  | DECIMAL(14,2)  | 变动前余额                                      |
| balance_after   | DECIMAL(14,2)  | 变动后余额                                      |
| settled         | BOOLEAN        | 是否已结算                                      |
| settled_at      | TIMESTAMP      |                                                 |
| description     | VARCHAR(500)   |                                                 |
| metadata        | JSONB          | 扩展信息（活动名、客户数等）                    |
| INDEX           | (revenue_date) | 日结查询                                        |
| INDEX           | (revenue_type) | 分类查询                                        |

### Database Design

**Partitioning Strategy:**

- `attribution` table: RANGE partition by `lock_expire_at` (monthly partitions)
  - Enables fast queries within active lock period
  - Old partitions (>13 months) can be archived or dropped
- `commission_ledger` table: RANGE partition by `settlement_date` (monthly)
  - Fast settlement batch processing
  - Efficient historical queries

**Indexing Strategy:**

| Table                  | Index                                          | Purpose                         |
| ---------------------- | ---------------------------------------------- | ------------------------------- |
| attribution            | (customer_id, merchant_id, lock_expire_at)     | Primary attribution lookup <5ms |
| attribution            | (agent_id, lock_expire_at)                     | Agent customer list             |
| commission_ledger      | (agent_id, settlement_status, settlement_date) | Settlement batch query          |
| commission_ledger      | (idempotency_key)                              | Idempotency check — UNIQUE      |
| coupon                 | (store_id, status, valid_until)                | Active coupon lookup            |
| agent_platform_account | (agent_id, platform, binding_status)           | OAuth account lookup            |

**Data Retention:**

- Attribution records: retained 1 year after lock_expire_at (FR retention requirement)
- Commission ledger: permanent (financial audit requirement)
- Content job results (videos/posters): retained 1 year in OSS, then archived

---

## API Design

### API Architecture

**Pattern:** REST + WebSocket
**Versioning:** URL path (`/api/v1/`, `/api/v2/`)
**Format:** JSON
**Auth:** JWT (Bearer token) for merchant/agent/admin; WeChat session for C-end

### Key API Endpoints

#### Public APIs (C-End Mini-Program)

```
GET    /api/v1/coupons/nearby          # LBS-based nearby coupons (FR-015)
GET    /api/v1/coupons/search?q=      # Search coupons (FR-015)
GET    /api/v1/coupons/:id             # Coupon detail (FR-015)
POST   /api/v1/coupons/:id/claim       # Claim coupon to wallet (FR-015)
GET    /api/v1/wallet                  # My coupons (FR-035)
POST   /api/v1/wallet/:coupon_id/share # Share to WeChat (FR-036)
```

#### Merchant APIs (Signed with HMAC-SHA256)

```
POST   /api/v1/merchant/register
POST   /api/v1/merchant/subscribe
GET    /api/v1/merchant/wallet         # Commission wallet balance
POST   /api/v1/merchant/wallet/topup
GET    /api/v1/merchant/coupons
POST   /api/v1/merchant/coupons
PUT    /api/v1/merchant/coupons/:id
GET    /api/v1/merchant/coupons/:id/stats
GET    /api/v1/merchant/agents
POST   /api/v1/merchant/agents/approve/:id
POST   /api/v1/merchant/agents/reject/:id
GET    /api/v1/merchant/analytics/roi
GET    /api/v1/merchant/analytics/funnel
```

**Verification Callback API** (called by merchant's POS system):

```
POST /api/v1/verify
Headers: X-Merchant-Key: <api_key>
        X-Signature: <hmac_sha256(request_body, secret)>
        X-Timestamp: <unix_timestamp>
        X-Nonce: <uuid>     # Anti-replay
Body: {
  "coupon_code": "ABC123",
  "customer_id": "oXXXX_wechat_openid",
  "transaction_amount": 150.00,
  "transaction_id": "order_12345"
}
Response: {
  "valid": true,
  "discount": 20.00,
  "agent_id": "uuid",
  "agent_reward": 8.00,
  "commission_triggered": true
}
SLA: < 200ms p95 (NFR-001)
Rate limit: 1000 req/min per API key (NFR-004)
```

#### Agent APIs (JWT Auth)

```
POST   /api/v1/agent/register
GET    /api/v1/agent/profile
POST   /api/v1/agent/platforms/bind         # Bind OAuth account
DELETE /api/v1/agent/platforms/:platform/:account_id
GET    /api/v1/agent/balance                 # pending + available balance
POST   /api/v1/agent/withdraw               # min ¥10
GET    /api/v1/agent/withdraw/history
GET    /api/v1/agent/commission/history
GET    /api/v1/agent/reputation             # score + level + next threshold
GET    /api/v1/agent/customers              # Locked customer list
GET    /api/v1/agent/activities             # Available coupons to promote
POST   /api/v1/agent/content/generate       # Submit AI generation job
GET    /api/v1/agent/content/jobs           # Job history
POST   /api/v1/agent/content/:job_id/publish # Publish to platform
```

#### AI Agent Internal APIs

```
POST   /internal/ai/generate/copy           # Generate copy variants
POST   /internal/ai/generate/video          # Generate video
POST   /internal/ai/generate/poster         # Generate poster
POST   /internal/ai/campaign/create         # Create campaign from NL
POST   /internal/ai/moderate                # Content policy check
```

#### Admin APIs (JWT + Admin Role)

```
GET    /api/v1/admin/merchants/pending       # Review queue
POST   /api/v1/admin/merchants/:id/approve
POST   /api/v1/admin/merchants/:id/reject
GET    /api/v1/admin/agents/pending
POST   /api/v1/admin/agents/:id/ban
GET    /api/v1/admin/fraud/alerts
POST   /api/v1/admin/fraud/alerts/:id/resolve
GET    /api/v1/admin/finance/daily
GET    /api/v1/admin/dashboard/kpi          # Real-time KPIs
```

### Authentication & Authorization

**JWT Structure:**

```json
{
  "sub": "user_id",
  "role": "merchant | agent | admin",
  "merchant_id": "uuid", // if role = merchant
  "agent_id": "uuid", // if role = agent
  "exp": 1234567890,
  "iat": 1234567800
}
```

**RBAC Permissions:**

| Role     | Permissions                                                        |
| -------- | ------------------------------------------------------------------ |
| Merchant | Manage own coupons, agents, view own analytics, verify redemptions |
| Agent    | View own balance, generate content, publish to platforms, withdraw |
| Admin    | All merchant/agent data, fraud management, financial reports       |

**HMAC-SHA256 for Merchant Callback API:**

```
signature = HMAC-SHA256(timestamp + "." + request_body, merchant_secret)
Header: X-Signature: sha256=<signature>
Header: X-Timestamp: <unix timestamp>
Header: X-Nonce: <uuid>   # Reject if nonce seen in last 5 minutes (anti-replay)
```

---

## Non-Functional Requirements Coverage

### NFR-001: Performance — API Response Time

**Requirement:** Coupon verification <200ms (p95), AI copy <5s, dashboard <3s

**Architecture Solutions:**

- **Verification API**: Redis attribution cache lookup <1ms + PG read replica for coupon data <50ms = total <200ms
- **AI content**: Async job queue (submit immediately, return job_id), WebSocket callback on completion
- **Dashboard**: Read replicas + PostgreSQL materialized views for pre-aggregated analytics
- **Connection pooling**: pg-pool (min 10, max 100 connections per API instance)

**Validation:** Load test with k6: 1000 concurrent verification requests, p95 <200ms

---

### NFR-002: Performance — Concurrent Capacity

**Requirement:** 10,000+ concurrent agents, 1,000+ concurrent verifications, 500+ AI jobs

**Architecture Solutions:**

- Horizontal scaling: Core API deploys 3+ instances behind ALB
- Redis for rate limiting and attribution caching
- AI jobs queued via RocketMQ, worker pool scales independently
- Database: read replicas + connection pooling
- CDN for static assets (AI-generated images/videos served via OSS+CDN)

**Validation:** Load test: 1000 RPS verification + 100 RPS AI job submission simultaneously

---

### NFR-003: Security — Authentication & Authorization

**Requirement:** JWT auth, RBAC, AES-256 at rest, TLS 1.3, MFA for admin/merchant

**Architecture Solutions:**

- JWT with RS256 signing (asymmetric)
- Merchant callback uses HMAC-SHA256 with anti-replay nonce
- Sensitive fields (bank accounts, OAuth tokens) encrypted with AES-256-GCM before PG storage
- TLS 1.3 enforced at API Gateway (Alibaba Cloud SLB)
- Admin and merchant dashboard accounts: OTP via Alibaba Cloud DMS (Dynamic OTP)
- Regular dependency audit: `npm audit` + `pip audit` in CI

---

### NFR-004: Security — API Security

**Requirement:** Rate limiting 1000 req/min per API key, input validation, IP whitelist

**Architecture Solutions:**

- Kong API Gateway: rate limit plugin per API key
- Input validation: Zod (merchant API) / Pydantic (AI Agent)
- IP whitelist configurable per merchant for callback endpoint
- Anti-replay: nonce + timestamp in HMAC signature (5-minute window)
- WAF (Alibaba Cloud WAF) for DDoS and SQL injection protection

---

### NFR-005: Reliability — Uptime

**Requirement:** Platform 99.5%, verification API 99.9%, RPO <1h, RTO <4h

**Architecture Solutions:**

- Multi-AZ deployment: Primary region + failover region (Alibaba Cloud)
- Verification API on dedicated instance pool with 99.9% SLA
- Circuit breaker: if PG write fails, queue to Redis and retry (resilience)
- Health check endpoint: `/health` with DB + Redis + external API connectivity
- Daily full backup + continuous WAL archiving to OSS (15-minute RPO)
- RTO <4h: Infrastructure as Code (Terraform/Pulumi) for rapid redeployment

---

### NFR-006: Scalability — Data Volume

**Requirement:** 500 merchants, 10K agents, 100M attribution records, 1M daily sharing events

**Architecture Solutions:**

- **Horizontal scaling**: Core API and AI Agent are stateless, scale behind ALB
- **Database scaling**:
  - Write to PG primary, reads to PG replica
  - TimescaleDB for time-series attribution data (auto-partitioning)
  - commission_ledger: monthly range partitions
  - attribution: monthly range partitions by lock_expire_at
- **Event scaling**: Redis Streams for high-frequency click events, batch flush to PG

**Validation:** 6-month projection based on current load testing results

---

### NFR-007: Compliance — Platform Policies

**Requirement:** Single-level only, data in mainland China, no inducement

**Architecture Solutions:**

- **Single-level enforcement**: Attribution always traces back to ONE agent (no chain propagation)
- **Data residency**: All services, databases, and OSS buckets on Alibaba Cloud China (华北2/华东1)
- **Content moderation**: AI scan all generated content before publishing
- **Policy rules database**: Configurable prohibited keywords + WeChat/Douyin policy documents in code

---

### NFR-008: Maintainability — Observability

**Requirement:** Structured logging, distributed tracing, metrics, alerts, immutable audit logs

**Architecture Solutions:**

- **Logging**: Structured JSON logs (pino for Node.js, loguru for Python) → Alibaba Cloud SLS
- **Tracing**: OpenTelemetry SDK in both Node.js and Python → SLS Trace Explorer
- **Metrics**: Prometheus client (Node.js + Python) → ARMS (Alibaba Cloud monitoring)
- **Dashboards**: Grafana dashboards for API latency, error rate, AI job throughput
- **Alerts**: AlertManager → DingTalk webhook for critical issues (error rate >1%, p95 >200ms, payment failures)
- **Audit logs**: commission_ledger table is append-only with no UPDATE/DELETE permissions (DB role separation)

---

## Security Architecture

### Authentication Flow

```
C-End: WeChat Login → WeChat OAuth → Platform JWT
Merchant: Email/Password → Platform JWT + MFA OTP
Agent: Phone/WeChat Login → Platform JWT
Admin: Email/Password → Platform JWT + MFA OTP + Admin role claim
```

### Encryption Strategy

| Data              | At Rest                                     | In Transit |
| ----------------- | ------------------------------------------- | ---------- |
| DB (PG)           | AES-256 (PG native encryption + key in KMS) | TLS 1.3    |
| Redis             | N/A (ephemeral, PG is source of truth)      | TLS 1.3    |
| OAuth Tokens      | AES-256-GCM (DB column encryption)          | TLS 1.3    |
| Bank Account Info | AES-256-GCM                                 | TLS 1.3    |
| OSS Files         | AES-256 (OSS server-side encryption)        | HTTPS only |
| JWT Secrets       | Alibaba Cloud KMS (not in code/env files)   | N/A        |

### Key Management

- Master encryption keys stored in Alibaba Cloud KMS
- Keys rotated annually (manual trigger in CI/CD)
- No encryption keys in source code or environment variables
- Merchant API secrets stored hashed (HMAC verification uses shared secret, not hashed)

---

## Scalability & Performance

### Scaling Strategy

**Horizontal Scaling (stateless services):**

- Core API (NestJS): scale from 2 to 10+ instances behind ALB based on CPU/memory
- AI Agent (FastAPI): scale from 1 to 5 instances based on job queue depth
- Auto-scaling trigger: CPU >70% for 3 minutes, or queue depth >100

**Database Scaling:**

- PG Primary → PG Read Replica (1 read replica, scale to 3 as load increases)
- Read queries: route to replica
- Write queries: always to primary
- Connection pooler: PgBouncer in transaction mode (max 100 connections per instance)

**Redis Scaling:**

- Redis Cluster mode (3 shards, 1 master + 1 replica per shard)
- Attribution cache: 366-day TTL per key
- Rate limit: sliding window per API key

### Caching Strategy

| Cache Target         | Cache Type           | TTL                                       | Invalidation            |
| -------------------- | -------------------- | ----------------------------------------- | ----------------------- |
| Attribution lookup   | Redis String         | 366 days                                  | Key expires             |
| Active coupon        | Redis Hash           | 5 min                                     | On coupon update        |
| Agent balance        | Redis String         | Real-time update on commission/withdrawal | Push invalidation       |
| Rate limit counter   | Redis String         | Sliding 1 min window                      | Auto-expiry             |
| AI generation result | Redis String         | 1 hour                                    | Job completion callback |
| Dashboard analytics  | PG Materialized View | 1 hour                                    | Scheduled refresh       |

### Load Balancing

- **Alibaba Cloud ALB** (Application Load Balancer): layer 7, routes by URL path
- Health checks: GET /health every 10s, remove unhealthy instances
- Algorithm: round-robin for API, least connections for WebSocket

---

## Reliability & Availability

### High Availability Design

```
Region: Alibaba Cloud China (e.g., cn-hangzhou)
AZ1: Primary data center
AZ2: Secondary AZ (failover)

[ALB] ──► [Core API x3] ──► [PG Primary]
          (auto-scale)         │
                               └──► [PG Replica]
          [AI Agent x2] ──► [RocketMQ]
                               │
                               └──► [Redis Cluster x3]

Failover: If PG Primary fails → promote PG Replica (RTO ~15 min)
Failover: If Core API instance dies → ALB removes from pool, new instance spins up
```

### Disaster Recovery

- **RPO**: 15 minutes (continuous WAL replication to OSS)
- **RTO**: 4 hours (Terraform redeployment + data restore from latest backup)
- **Backup schedule**: Daily full backup at 3 AM CST + continuous WAL archiving
- **DR Region**: Cross-region backup to Alibaba Cloud Shenzhen (cn-shenzhen)

### Monitoring & Alerting

| Metric                       | Alert Threshold | Action              |
| ---------------------------- | --------------- | ------------------- |
| Verification API p95 latency | >200ms          | Page on-call        |
| API error rate               | >1%             | Page on-call        |
| PG connections               | >80% pool       | Alert DevOps        |
| AI job queue depth           | >500            | Scale AI Agent      |
| Withdrawal failure rate      | >0.1%           | Page on-call        |
| Redis memory                 | >70%            | Scale Redis cluster |

---

## Integration Architecture

### External Integrations

```
┌──────────────────────────────────────────────────────────┐
│              WeChat Open Platform                        │
│  Mini-program hosting / OAuth / Share tracking          │
│  WeChat Pay (future: commission payouts)                 │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│           Douyin Open Platform                           │
│  Enterprise account OAuth / Content publishing API        │
│  Analytics API / Custom parameters for attribution       │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│           Xiaohongshu                                    │
│  Professional account OAuth / Note publishing API        │
│  Attribution via custom URL parameters                   │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│           Payment Gateway (Alipay / WeChat Pay)         │
│  Agent commission withdrawal (T+3 settlement)             │
│  Merchant subscription payment (Alipay / WeChat Pay)   │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│           LLM Providers                                   │
│  Claude API / GPT-4 / Kimi API                         │
│  Video generation API (Runway / PIKA / Kling)          │
│  Image generation API (DALL-E / Stable Diffusion)       │
└──────────────────────────────────────────────────────────┘
```

### Internal Integration Pattern

- **Sync**: REST calls for time-critical operations (verification API)
- **Async**: RocketMQ for AI content generation jobs, commission settlement batch jobs
- **Event streaming**: Redis Streams for real-time click attribution events

### API Rate Limits (External)

| Provider        | Rate Limit           | Strategy                                       |
| --------------- | -------------------- | ---------------------------------------------- |
| WeChat API      | Varies by API        | Per-instance token bucket                      |
| Douyin API      | 1000 req/day per app | Job queue with daily reset                     |
| Xiaohongshu API | 100 req/day per app  | Strict throttling                              |
| Claude API      | 1000 req/min         | Distributed token bucket per AI Agent instance |

---

## Development Architecture

### Code Organization

```
ai-auto/
├── apps/
│   ├── core-api/          # NestJS application
│   │   ├── src/
│   │   │   ├── merchant/   # Merchant module
│   │   │   ├── agent/      # Agent module
│   │   │   ├── attribution/# Attribution module
│   │   │   ├── commission/ # Commission engine
│   │   │   ├── coupon/      # Coupon module
│   │   │   ├── content/    # Content management
│   │   │   ├── oauth/      # Multi-platform OAuth
│   │   │   ├── analytics/  # Reporting
│   │   │   ├── fraud/      # Fraud detection
│   │   │   ├── admin/      # Admin module
│   │   │   └── shared/     # Common (DTOs, guards, pipes)
│   │   ├── test/
│   │   └── Dockerfile
│   │
│   ├── ai-agent/          # FastAPI Python application
│   │   ├── app/
│   │   │   ├── content/    # Content generation
│   │   │   ├── campaign/   # Campaign automation
│   │   │   ├── moderation/ # Content policy
│   │   │   └── chat/       # AI customer service
│   │   ├── tests/
│   │   └── Dockerfile
│   │
│   └── infra/             # IaC (Terraform)
│
├── packages/
│   ├── types/             # Shared TypeScript types
│   ├── utils/             # Shared utilities
│   └── config/           # Shared configs
│
├── docs/                  # Architecture, API specs
├── scripts/               # Dev helpers
└── docker-compose.yml    # Local dev environment
```

### Testing Strategy

| Type              | Coverage Target                              | Framework                            |
| ----------------- | -------------------------------------------- | ------------------------------------ |
| Unit tests        | 80%+ on commission engine, attribution logic | Jest (JS), pytest (Python)           |
| Integration tests | All API endpoints                            | Supertest (JS), TestClient (FastAPI) |
| E2E tests         | Critical user flows (claim→redeem→withdraw)  | Playwright                           |
| Load tests        | Verification API at 1000 RPS                 | k6                                   |
| AI content tests  | Prompt output quality, moderation accuracy   | Manual + automated scoring           |

### CI/CD Pipeline

```
GitHub Actions:
  Push → Lint (ESLint/ruff) → Type-check (tsc/pylint) → Test (Jest/pytest) → Build → Security scan (Snyk) → Push Docker image to ACR

  Merge to main → Deploy to Staging → E2E tests → Manual approval → Deploy to Production
```

---

## Deployment Architecture

### Environments

| Environment            | Purpose           | Deploy Trigger     |
| ---------------------- | ----------------- | ------------------ |
| Local (Docker Compose) | Development       | Manual             |
| Dev                    | Internal testing  | Push to dev branch |
| Staging                | Pre-production QA | Merge to main      |
| Production             | Live users        | Manual approval    |

### Deployment Strategy

**Strategy:** Rolling update with blue-green fallback

- **Blue-green**: New version deploys to "green" fleet, smoke test runs, traffic shifts 10% → 100%
- If error rate spikes: instant traffic shift back to "blue" fleet
- Zero-downtime deployment for Core API (rolling update, max 1 instance unavailable)
- AI Agent: rolling update (stateless, no user-facing downtime)

### Infrastructure as Code

- **Terraform** for Alibaba Cloud resource provisioning
- **Docker Compose** for local development
- **Kubernetes (ACK)** for production container orchestration (optional — start with ECS for 2-3 person team)

---

## Requirements Traceability

### Functional Requirements Coverage

| FR                               | Component                       | Implementation Note                             |
| -------------------------------- | ------------------------------- | ----------------------------------------------- |
| FR-001 Merchant Subscription     | Core API (Merchant Module)      | Subscription validation on every feature access |
| FR-002 Store Integration         | Core API (Coupon Module)        | Product mapping API + verification callback     |
| FR-003 NL Campaign Creation      | AI Agent (Campaign Agent)       | LLM parser → campaign config                    |
| FR-004 Coupon Issuance           | Core API (Coupon Module)        | CRUD + inventory tracking                       |
| FR-005 Agent Recruitment         | Core API (Agent Module)         | Recruitment link + QR code generation           |
| FR-006 365-Day Lock              | Attribution Engine              | Redis cache + PG persistent storage             |
| FR-007 Commission Calculation    | Commission Engine               | Immutable ledger + idempotency                  |
| FR-008 T+3 Withdrawal            | Commission Engine               | Settlement scheduler + payment gateway          |
| FR-009 Reputation System         | Core API (Agent Module)         | Score = valid customer count                    |
| FR-010 AI Copywriting            | AI Agent                        | Claude/GPT-4 prompt engineering                 |
| FR-011 AI Video                  | AI Agent                        | Video generation pipeline                       |
| FR-012 AI Poster                 | AI Agent                        | Image generation + overlay                      |
| FR-013 Multi-Platform Publish    | Core API (OAuth + Content)      | Platform adapters + job queue                   |
| FR-014 Account Binding           | OAuth Gateway                   | Per-account token management                    |
| FR-015 C-End Discovery           | Core API (Coupon Module)        | LBS + search + shared link                      |
| FR-016 Coupon Redemption         | Core API (Coupon Module)        | Verification API <200ms                         |
| FR-017 C-End AI Tools            | AI Agent + Mini-program         | AI via internal API                             |
| FR-018 Analytics                 | Core API (Analytics Module)     | Materialized views + real-time                  |
| FR-019 AI Optimization           | AI Agent (Campaign Agent)       | Performance monitoring loop                     |
| FR-020 AI Recommendations        | AI Agent (Campaign Agent)       | Holiday calendar + ML                           |
| FR-021 Merchant Review           | Core API (Admin Module)         | Review queue workflow                           |
| FR-022 Agent Review              | Core API (Admin Module)         | Approval workflow                               |
| FR-023 Content Moderation        | AI Agent (Moderation)           | Pre-publish policy scan                         |
| FR-024 Financial Mgmt            | Commission Engine               | Wallet + ledger + reports                       |
| FR-025 Fraud Detection           | Fraud Detection Engine          | Real-time + batch rules                         |
| FR-026 Admin Dashboard           | Core API (Admin Module)         | KPI aggregation                                 |
| FR-027 AI Customer Service       | AI Agent (Chat)                 | FAQ + escalation                                |
| FR-028 Douyin Integration        | OAuth Gateway + DouyinAdapter   | Phase 1                                         |
| FR-029 Xiaohongshu Integration   | OAuth Gateway + XHSAdapter      | Phase 2                                         |
| FR-030 Video Account Integration | OAuth Gateway + VideoAdapter    | Phase 3                                         |
| FR-031 Kuaishou Integration      | OAuth Gateway + KuaishouAdapter | Phase 4                                         |
| FR-032 AI Auto Campaign          | AI Agent (Campaign Agent)       | NL → config                                     |
| FR-033 AI Auto Distribution      | AI Agent (Campaign Agent)       | Platform + timing optimizer                     |
| FR-034 Enterprise Account Assist | Core API (Merchant Module)      | Registration guides                             |
| FR-035 Mini-Program Basic        | Uni-app                         | WeChat mini-program                             |
| FR-036 C-End Sharing             | Core API (Coupon Module)        | Share with attribution                          |
| FR-037 Gamification              | Core API (Coupon Module)        | Quest + mystery box                             |
| FR-038 Task Marketplace          | Core API (Agent Module)         | Task board + matching                           |
| FR-039 Tax Income Proof          | Core API (Agent Module)         | PDF generation                                  |
| FR-040 Merchant CRM              | Core API (Analytics Module)     | Customer list export                            |

### Non-Functional Requirements Coverage

| NFR                            | Solution                                          | Validation              |
| ------------------------------ | ------------------------------------------------- | ----------------------- |
| NFR-001: <200ms verification   | Redis cache + PG replica + async write            | k6 load test, 1000 RPS  |
| NFR-002: 10K concurrent agents | Horizontal scaling + ALB + Redis                  | Load test               |
| NFR-003: Auth & Authz          | JWT + RBAC + AES-256 + MFA                        | Security audit          |
| NFR-004: API Security          | Kong rate limit + HMAC + IP whitelist + WAF       | Penetration test        |
| NFR-005: 99.5% uptime          | Multi-AZ + circuit breaker + daily backup         | Uptime monitor          |
| NFR-006: Data volume           | Partitioning + read replicas + OSS                | 6-month projection test |
| NFR-007: Compliance            | Single-level enforcement + CN region + moderation | Policy review           |
| NFR-008: Observability         | SLS + OpenTelemetry + ARMS + Grafana              | Dashboard live          |

---

## Trade-offs & Decision Log

### Decision 1: Node.js vs Java for Core API

**Decision:** Node.js (NestJS) for Core API, Python (FastAPI) for AI Agent
**Rationale:** I/O-bound workload + 2-3 person team = fastest development speed
**Trade-off:**

- ✓ Fast iteration, TypeScript safety, large ecosystem
- ✗ Python AI Agent adds deployment complexity (mitigated by Docker)
  **Outcome:** Accepted — AI Agent isolation provides better scalability

### Decision 2: PostgreSQL vs MySQL

**Decision:** PostgreSQL 16
**Rationale:** ACID for financial commission ledger + JSONB for flexible coupon rules + TimescaleDB for time-series
**Trade-off:**

- ✓ Strongest data integrity for financial core
- ✗ Slightly more ops overhead than MySQL (mitigated by RDS managed service)

### Decision 3: Uni-app vs Native Mini-Program

**Decision:** Uni-app (compiled to WeChat mini-program)
**Rationale:** Team has Vue experience, single codebase for future multi-platform
**Trade-off:**

- ✓ Faster development, future-proof
- ✗ Slight performance penalty vs native (acceptable for coupon discovery UX)

### Decision 4: Single-level vs Multi-level Distribution

**Decision:** Single-level only (agent → customer)
**Rationale:** Compliance with WeChat/Douyin policies; multi-level risks platform ban
**Trade-off:**

- ✗ Less viral potential than multi-level
- ✓ Compliance guaranteed; compound model compensates with long-term incentive

### Decision 5: Redis as Attribution Cache

**Decision:** Redis as front-end cache for attribution, PG as persistent source
**Rationale:** Attribution lookup is the hottest path (<5ms required); Redis handles it
**Trade-off:**

- ✓ <5ms lookup performance
- ✗ Redis data loss risk → mitigated by PG being source of truth; Redis rebuilds from PG on restart

---

## Open Issues & Risks

| #   | Issue                                                            | Severity | Owner       | Status |
| --- | ---------------------------------------------------------------- | -------- | ----------- | ------ |
| 1   | WeChat/Douyin API rate limits may affect attribution tracking    | High     | Engineering | Open   |
| 2   | LLM API cost volatility (token pricing changes)                  | Medium   | Product     | Open   |
| 3   | Payment gateway (Alipay/WeChat Pay) B2C payout compliance        | High     | Finance     | Open   |
| 4   | Agent minimum withdrawal ¥10 may cause high payment gateway fees | Low      | Product     | Open   |
| 5   | GDPR-like regulations may affect data retention policy           | Medium   | Legal       | Open   |

---

## Future Considerations

The following are out of scope for initial release but planned for future phases:

1. **Native Mobile Apps**: Standalone iOS/Android apps for agents (beyond mini-program)
2. **Kuaishou Integration**: Phase 4 multi-platform expansion
3. **AI Virtual Agents**: Platform-curated AI personas to assist merchants (EPIC-006 next phase)
4. **Web3 / Blockchain**: Immutable audit trail for financial records (future cost-benefit analysis needed)
5. **International Expansion**: Multi-region deployment for overseas markets
6. **ML Fraud Model**: LSTM-based anomaly detection for coordinated fraud rings

---

## Approval & Sign-off

**Review Status:**

- [ ] Technical Lead
- [ ] Product Owner
- [ ] Security Architect
- [ ] DevOps Lead

---

## Revision History

| Version | Date       | Author | Changes              |
| ------- | ---------- | ------ | -------------------- |
| 1.0     | 2026-08-20 | zhang  | Initial architecture |

---

## Next Steps

### Phase 4: Sprint Planning

Run `/bmad:sprint-planning` to:

- Break 13 epics into detailed user stories
- Estimate story complexity
- Plan sprint iterations
- Begin implementation following this architectural blueprint

**Implementation Principles:**

1. Follow module boundaries defined in this document
2. Implement NFR solutions as specified (Redis attribution cache, immutable ledger)
3. Commission engine first — foundation for all financial features
4. Verification API <200ms is critical path — optimize from day 1
5. Follow API contracts exactly for all external integrations

---

**This document was created using BMAD Method v6 - Phase 3 (Solutioning)**

---

## Appendix A: Technology Evaluation Matrix

| Category              | Option 1         | Option 2           | Option 3      | Selected          |
| --------------------- | ---------------- | ------------------ | ------------- | ----------------- |
| Backend Language      | Node.js (NestJS) | Java (Spring Boot) | Go            | **Node.js**       |
| AI Service            | Python (FastAPI) | Node.js            | Go            | **Python**        |
| Database              | PostgreSQL       | MySQL              | MongoDB       | **PostgreSQL**    |
| Cache                 | Redis            | Memcached          | No cache      | **Redis**         |
| Job Queue             | RocketMQ         | BullMQ             | Kafka         | **RocketMQ**      |
| Frontend (C-end)      | Uni-app          | Native WXML        | Taro          | **Uni-app**       |
| Frontend (Dashboards) | React            | Vue                | Angular       | **React**         |
| Cloud Provider        | Alibaba Cloud    | AWS China          | Tencent Cloud | **Alibaba Cloud** |
| API Gateway           | Kong             | Nginx              | AWS ALB       | **Kong**          |
| Container             | Docker           | Native             | Helm          | **Docker**        |

---

## Appendix B: Capacity Planning

| Resource             | Phase 1 (0-6mo) | Phase 2 (6-18mo) | Phase 3 (18-36mo) |
| -------------------- | --------------- | ---------------- | ----------------- |
| Merchants            | 20              | 500              | 10,000            |
| Active Agents        | 500             | 10,000           | 100,000           |
| C-End Users          | 10,000          | 500,000          | 5,000,000         |
| Daily Verifications  | 1,000           | 50,000           | 500,000           |
| Daily Sharing Events | 10,000          | 500,000          | 5,000,000         |
| Attribution Records  | 100K            | 10M              | 100M              |
| Core API Instances   | 2               | 4                | 8                 |
| AI Agent Instances   | 1               | 2                | 5                 |
| PG Primary           | 4 vCPU 16GB     | 8 vCPU 32GB      | 16 vCPU 64GB      |
| Redis Cluster        | 3 shards        | 6 shards         | 12 shards         |

---

## Appendix C: Cost Estimation (Phase 1, Monthly)

| Item              | Specification       | Estimated Cost (CNY/month) |
| ----------------- | ------------------- | -------------------------- |
| ECS (Core API x2) | 2 vCPU 4GB × 2      | ~400                       |
| ECS (AI Agent x1) | 4 vCPU 8GB          | ~400                       |
| RDS PostgreSQL    | 2 vCPU 4GB Multi-AZ | ~800                       |
| Redis Cluster     | 3 shards × 1GB      | ~600                       |
| OSS Storage       | 100GB               | ~30                        |
| CDN               | 100GB egress        | ~100                       |
| Alibaba Cloud WAF | Basic               | ~500                       |
| API Gateway       | 10M calls           | ~200                       |
| LLM API (est.)    | 100K generations    | ~2,000                     |
| Monitoring (ARMS) | Basic               | ~300                       |
| **Total**         |                     | **~5,330/month**           |
