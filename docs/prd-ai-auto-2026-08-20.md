# Product Requirements Document: AI auto

**Date:** 2026-08-20
**Author:** zhang
**Version:** 1.0
**Project Type:** AI-native sharing agent distribution tool (SaaS, tool-only, no e-commerce store)
**Project Level:** 3
**Status:** Draft

---

## Document Overview

This PRD defines the functional and non-functional requirements for **AI auto** — an AI-native sharing agent distribution tool that helps merchants acquire customers through social裂变 (viral sharing) via WeChat, Douyin, Xiaohongshu, and other platforms.

**Related Documents:**
- Brainstorming: `docs/brainstorming-ai-auto-2026-08-19.md`
- Project Overview: `memory/ai-auto-project-overview.md`

---

## Executive Summary

AI auto is a pure tool platform that helps merchants acquire customers through a sharing agent (分享员) model. Unlike traditional SaaS platforms (有赞/微盟), it does NOT provide e-commerce store functionality. Unlike KOL/influencer marketing platforms, it targets ordinary users sharing within their personal social circles (朋友圈/社群/私聊), not professional content creators.

The core differentiator is **AI-native automation**: AI generates promotional content, AI creates marketing campaigns from natural language, and AI Agent handles most operations automatically — a capability no direct competitor currently offers.

**Business Model:**
- Merchant subscription: ¥1,200/store/year (fixed, no tiers)
- Merchant prepaid commission budget (digital wallet model)
- Sharing agent commission: Platform takes 20% from agent's earnings, agent keeps 80%, settlement T+3, minimum withdrawal ¥10
- AI token billing: borne by sharing agent (deducted from commission), not passed to merchant
- Lock period: 365 days (same as competitors)
- Distribution: Single-level only (compliance requirement)
- Agent can bind unlimited accounts across unlimited merchants

**Business Objectives:**
- 500 paying merchants within 12 months
- Millions of sharing impressions
- Revenue streams: subscription fees + agent commission 20% + AI token billing

---

## Product Goals

### Business Objectives

1. **Monetization**: Achieve 500 paying merchant subscriptions within 12 months
2. **Sharing Scale**: Generate millions of sharing impressions through sharing agents
3. **Market Position**: Establish AI auto as the leading AI-native sharing distribution tool in China, ahead of competitors before Tencent's native AI Agent closes the window (estimated 2-3 years)

### Success Metrics (to be finalized)
- Paying merchant count
- Active sharing agent count
- Monthly sharing impressions
- Merchant retention rate
- Agent commission payout volume

---

## Functional Requirements

### FR-001: Merchant Subscription & Account Management

**Priority:** Must Have

**Description:**
The system shall allow merchants to register, subscribe (¥1,200/store/year), and manage their merchant account. Subscription is store-based, not merchant-company-based.

**Acceptance Criteria:**
- [ ] Merchant can register with business license / personal ID
- [ ] Merchant can subscribe and pay ¥1,200/year per store
- [ ] System validates subscription status on every feature access
- [ ] Expired subscription blocks feature access (read-only mode)
- [ ] Subscription renewal reminders sent at 30/7/1 days before expiry

---

### FR-002: Store & Business System Integration

**Priority:** Must Have

**Description:**
The system shall provide unified coupon/product interfaces for merchants to integrate their existing business systems. The platform does NOT maintain a product catalog.

**Acceptance Criteria:**
- [ ] Platform provides coupon interface API (create/update/query/delete coupons)
- [ ] Platform provides product mapping interface (map external product IDs to platform coupons)
- [ ] Platform provides verification callback API (merchant system calls to confirm redemption)
- [ ] Merchant can configure coupon-to-product mapping in merchant dashboard
- [ ] All API calls include signature authentication
- [ ] Platform stores mapping relationships and verifies redemption requests

---

### FR-003: Marketing Activity Creation (Natural Language)

**Priority:** Must Have

**Description:**
The system shall allow merchants to create marketing activities using natural language (e.g., "Create a Mid-Autumn Festival promotion: spend ¥100, get ¥20 off"). AI Agent automatically parses intent and configures the activity.

**Acceptance Criteria:**
- [ ] Merchant types campaign description in plain Chinese
- [ ] AI Agent interprets: activity type, discount rules, target audience, duration, budget
- [ ] AI Agent generates activity configuration (coupon amount, rules, sharing incentives)
- [ ] Merchant reviews and approves AI-generated configuration with one click
- [ ] Activity goes live immediately upon approval
- [ ] AI provides 3 alternative configurations for merchant to choose from

---

### FR-004: Coupon/Reward Issuance

**Priority:** Must Have

**Description:**
The system shall allow merchants to issue coupons and cash rewards tied to their business system products. Each coupon is mapped to a product via the integration interface.

**Acceptance Criteria:**
- [ ] Merchant can create coupon types: discount (¥X off), cash (¥Y reward), combo
- [ ] Each coupon is linked to a product ID from merchant's business system
- [ ] Merchant sets per-customer redemption limits (once per person, unlimited, etc.)
- [ ] Coupon validity period is configurable (from date, to date, or N days after issue)
- [ ] Coupon inventory is tracked (unlimited or limited quantity)
- [ ] Merchant can set sharing agent reward amount per coupon redeemed (e.g., ¥5 per redemption)

---

### FR-005: Sharing Agent Recruitment & Binding

**Priority:** Must Have

**Description:**
The system shall allow merchants to recruit and bind sharing agents. Agents join via merchant's unique recruitment link/QR code.

**Acceptance Criteria:**
- [ ] Merchant generates unique sharing agent recruitment link and QR code
- [ ] Agent registers via link (phone number + optional social account binding)
- [ ] Agent is bound to the merchant's store upon registration
- [ ] Agent can optionally bind multi-platform accounts (Douyin/Xiaohongshu/WeChat Video Account — enterprise account authorization)
- [ ] Merchant can approve/reject agent applications (configurable: auto-approve or manual review)
- [ ] Agent can unbind from merchant (pending activities remain valid)

---

### FR-006: Lock Period & Customer Attribution (365-Day)

**Priority:** Must Have

**Description:**
The system shall implement a 365-day lock period: once a user clicks an agent's shared link, all purchases/redemptions within 365 days are attributed to that agent.

**Acceptance Criteria:**
- [ ] User clicks agent's shared link/QR code → system records attribution (agent_id, user_id, timestamp)
- [ ] Lock period is exactly 365 days from click timestamp
- [ ] Within lock period, all redemptions by this user → agent receives commission
- [ ] After 365 days, user is released and can be re-attributed to a new agent
- [ ] Multiple agents can share links to same user → first-click wins (irrevocable within lock period)
- [ ] Attribution is tracked via URL parameters + platform cookie/local storage + account binding

---

### FR-007: Commission Calculation & Distribution (Compound Model)

**Priority:** Must Have

**Description:**
The system shall calculate and distribute commissions using the compound model: for each redemption, the platform takes 20% from the agent's earnings, and the agent keeps 80%. If the same customer redeems again within lock period, the agent receives commission again (compound/recurring model). Settlement is T+3 (3 business days after redemption).

**Acceptance Criteria:**
- [ ] When a redemption occurs, system calculates agent reward: merchant-set reward × 80% = agent payout
- [ ] Platform deducts 20% from the agent's earnings as platform fee
- [ ] Compound model: each redemption event triggers a new commission calculation
- [ ] Agent sees real-time commission accrual in dashboard (pending settlement)
- [ ] Commission is calculated after verification callback from merchant system
- [ ] Commission settles T+3 (3 business days after redemption date)
- [ ] Agent can view commission breakdown per customer, per coupon, per platform

---

### FR-008: T+3 Commission Settlement & Withdrawal

**Priority:** Must Have

**Description:**
The system shall settle agent commissions T+3 (3 business days after redemption) and allow withdrawals with a minimum threshold of ¥10.

**Acceptance Criteria:**
- [ ] Agent can withdraw available settled balance at any time (minimum withdrawal: ¥10)
- [ ] Commissions settle T+3 from redemption date (3 business days)
- [ ] Settlement processed via Alipay/WeChat Pay/Bank card
- [ ] System verifies: settled balance >= withdrawal amount >= ¥10, bank card verified
- [ ] Withdrawal records are immutable and auditable
- [ ] Platform displays transaction history with timestamps and settlement status
- [ ] Failed withdrawals trigger automatic retry + admin alert

---

### FR-009: Sharing Agent Reputation System (Customer Acquisition Score)

**Priority:** Should Have

**Description:**
The system shall implement a reputation/level system for sharing agents based on their customer acquisition performance. Levels: Bronze → Silver → Gold → Diamond → King.

**Acceptance Criteria:**
- [ ] Reputation score = total valid customers acquired (customers who redeemed at least once)
- [ ] Level thresholds: Bronze (0-10), Silver (11-50), Gold (51-200), Diamond (201-500), King (500+)
- [ ] Higher level = higher base commission multiplier (e.g., Bronze 1.0x, Silver 1.1x, Gold 1.2x, Diamond 1.5x, King 2.0x)
- [ ] Level is recalculated monthly based on rolling 12-month valid customer count
- [ ] Agent sees real-time reputation score and next level progress in dashboard
- [ ] Top-performing agents appear in platform leaderboard

---

### FR-010: AI Content Generation — Copywriting

**Priority:** Must Have

**Description:**
The system shall generate promotional copy for sharing agents automatically using AI. AI token costs are borne by the sharing agent (deducted from commission), not passed to the merchant.

**Acceptance Criteria:**
- [ ] Agent selects a coupon/activity to promote
- [ ] Agent chooses target platform (WeChat Moments/Group/Private, Douyin, Xiaohongshu)
- [ ] AI generates 3-5 copy variations with different tones (enthusiastic, casual, formal)
- [ ] AI token cost is displayed to agent before generation
- [ ] AI token cost is deducted from agent's commission balance upon generation
- [ ] Agent can edit AI-generated copy before publishing
- [ ] AI-generated copy includes tracking link/QR code automatically
- [ ] Copy includes merchant's brand name and coupon highlights
- [ ] Platform may use aggregate data from AI-generated content for operational analytics (no individual content without consent)

---

### FR-011: AI Content Generation — Short Video

**Priority:** Should Have

**Description:**
The system shall generate short promotional videos for sharing agents automatically using AI. Includes script, visuals, voiceover, and subtitles.

**Acceptance Criteria:**
- [ ] Agent selects a coupon/activity to promote
- [ ] AI generates video script (15-60 seconds) with scene breakdown
- [ ] AI generates voiceover (text-to-speech, multiple voice options)
- [ ] AI generates subtitles and captions
- [ ] Agent can preview and edit before finalizing
- [ ] Output format: MP4, suitable for WeChat Video/Douyin/Xiaohongshu
- [ ] Video includes tracking parameters for attribution

---

### FR-012: AI Content Generation — Poster/Hero Image

**Priority:** Should Have

**Description:**
The system shall generate promotional posters and hero images for sharing agents automatically.

**Acceptance Criteria:**
- [ ] Agent selects coupon/activity and target platform
- [ ] AI generates 3 poster variations with different layouts
- [ ] Posters include: merchant logo, coupon value, QR code, CTA button
- [ ] Agent can customize colors and text overlay
- [ ] Output format: PNG/JPEG, dimensions match target platform specs (WeChat: 1:1 or 9:16, Douyin: 9:16, Xiaohongshu: 3:4)

---

### FR-013: Multi-Platform One-Click Publishing

**Priority:** Must Have

**Description:**
The system shall allow sharing agents to publish content to multiple platforms (WeChat, Douyin, Xiaohongshu) from a single interface, with tracking parameters auto-embedded.

**Acceptance Criteria:**
- [ ] Agent selects AI-generated or custom content
- [ ] Agent selects target platforms (checkboxes: WeChat/Moments/Group, Douyin, Xiaohongshu)
- [ ] System auto-embeds unique tracking parameters per platform
- [ ] Content is published via platform's official API (if authorized) or agent copies formatted content manually
- [ ] Agent sees unified performance dashboard across all platforms
- [ ] Attribution is tracked per platform per click

---

### FR-014: Agent Account Binding (Multi-Platform Enterprise Accounts)

**Priority:** Must Have

**Description:**
The system shall allow sharing agents to bind their enterprise accounts on Douyin, Xiaohongshu, and WeChat Video Account. There is no upper limit on the number of accounts an agent can bind. Merchants facilitate enterprise account creation. Platform provides authorization API integration.

**Acceptance Criteria:**
- [ ] Agent sees list of supported platforms (Douyin, Xiaohongshu, WeChat Video Account)
- [ ] Agent can bind multiple accounts per platform (no upper limit)
- [ ] Agent initiates OAuth authorization flow for each account
- [ ] Merchant can assist agent in registering enterprise accounts (platform provides guidance)
- [ ] Platform stores and manages OAuth tokens per account (auto-refresh before expiry)
- [ ] If authorization is revoked on any account, agent is notified and content auto-publishing for that account is suspended
- [ ] Agent can view all bound accounts and their status in dashboard

---

### FR-015: Customer (C-End) Coupon Discovery

**Priority:** Must Have

**Description:**
The system shall provide multiple discovery channels for C-end customers to find and claim coupons.

**Acceptance Criteria:**
- [ ] LBS-based discovery: customers see nearby merchants' coupons in mini-program
- [ ] Agent shared link/QR code: direct coupon claim page with attribution
- [ ] In-store QR code scan: customers scan merchant's physical QR to claim
- [ ] Search: customers search by merchant name, category, or keyword
- [ ] Each discovery channel includes proper attribution tracking

---

### FR-016: Customer (C-End) Coupon Redemption

**Priority:** Must Have

**Description:**
The system shall handle coupon redemption. C-end customers present coupon codes; the merchant's business system calls the platform's verification API to confirm redemption and trigger commission. Verification callback must be made within 72 hours of customer presenting the coupon.

**Acceptance Criteria:**
- [ ] Customer presents coupon code (QR code or numeric code)
- [ ] Merchant scans/inputs code in their business system or merchant dashboard
- [ ] Merchant system calls platform verification API: coupon code + transaction amount
- [ ] Verification callback must be made within 72 hours of customer presenting the coupon
- [ ] Platform verifies: coupon valid, not expired, not redeemed, customer within lock period
- [ ] Platform returns: valid/invalid + discount amount + commission trigger
- [ ] Commission is calculated and credited to agent's account (settles T+3)
- [ ] Customer receives redemption confirmation

---

### FR-017: C-End AI Creation Tools

**Priority:** Should Have

**Description:**
The system shall provide AI-powered content creation tools within the C-end mini-program, allowing customers to generate promotional content and share it to earn rewards.

**Acceptance Criteria:**
- [ ] Customer can use AI to write promotional articles (e.g., product review, experience sharing)
- [ ] Customer can use AI to generate short videos (with their own photo/avatar optional)
- [ ] Customer can use AI to generate personal promotional posters
- [ ] AI-generated content includes tracking link → customer becomes a de facto sharing agent
- [ ] Customer earns commission on redemptions from their shared links (same model as sharing agents)
- [ ] Platform tracks and credits customer's agent account

---

### FR-018: Sharing Effect Tracking & Analytics

**Priority:** Must Have

**Description:**
The system shall provide real-time tracking of sharing performance for both merchants and agents.

**Acceptance Criteria:**
- [ ] Merchant dashboard shows: impressions, clicks, claims, redemptions, commission spend, ROI
- [ ] Agent dashboard shows: impressions, clicks, claims, redemptions, commission earned, customer retention
- [ ] Attribution chain is fully traceable: which agent → which link → which customer → which redemption
- [ ] Time-series charts for all metrics (daily/weekly/monthly)
- [ ] Comparison with previous period (MoM, WoW, DoD)
- [ ] Data exports available (CSV/Excel)

---

### FR-019: AI-Powered Activity Optimization

**Priority:** Should Have

**Description:**
The system shall use AI Agent to automatically optimize marketing activities based on real-time performance data.

**Acceptance Criteria:**
- [ ] AI monitors activity performance (click rate, redemption rate, ROI)
- [ ] AI identifies underperforming activities and generates optimization recommendations
- [ ] AI can automatically adjust: budget allocation, coupon amounts, audience targeting
- [ ] AI sends weekly performance reports to merchant with AI-generated insights
- [ ] All AI adjustments require merchant approval (auto-adjust mode optional)
- [ ] AI recommends timing optimization (best posting times per platform)

---

### FR-020: AI Activity Idea Recommendation

**Priority:** Could Have

**Description:**
The system shall proactively recommend marketing activity ideas to merchants based on holidays, trends, and merchant's historical performance.

**Acceptance Criteria:**
- [ ] Platform maintains calendar of holidays and key dates
- [ ] AI analyzes merchant's past activities and customer profile
- [ ] AI generates activity recommendations with rationale (e.g., "Mid-Autumn Festival in 30 days: your customers respond 2x better to cash coupons than discount coupons")
- [ ] Merchant can one-click launch AI-recommended activity
- [ ] AI explains expected impact and ROI based on similar merchants

---

### FR-021: Platform Admin — Merchant Review

**Priority:** Must Have

**Description:**
The system shall allow platform admins to review and approve merchant registrations and business qualifications.

**Acceptance Criteria:**
- [ ] Admin sees queue of pending merchant applications
- [ ] Admin reviews: business license, industry qualifications, store information
- [ ] Admin can approve, reject (with reason), or request more information
- [ ] Merchant is notified of review result
- [ ] Audit log of all review decisions

---

### FR-022: Platform Admin — Agent Review

**Priority:** Must Have

**Description:**
The system shall allow platform admins to review and approve sharing agent registrations (if manual review mode is enabled).

**Acceptance Criteria:**
- [ ] Admin sees queue of pending agent applications (if merchant requires manual review)
- [ ] Admin reviews: ID verification, social account binding, platform account status
- [ ] Admin can approve, reject, or ban agents
- [ ] Audit log of all agent review decisions

---

### FR-023: Platform Admin — Content Moderation

**Priority:** Must Have

**Description:**
The system shall perform AI-powered content moderation on all promotional content generated by agents, before or after publishing.

**Acceptance Criteria:**
- [ ] All AI-generated content is scanned for: prohibited keywords, policy violations, sensitive content
- [ ] If violation detected: content is flagged, agent is notified, content is blocked or requires edit
- [ ] Admin can set content policy rules (platform-wide and per-merchant)
- [ ] Violation history is tracked per agent and per merchant
- [ ] Repeat offenders are escalated to admin for manual review

---

### FR-024: Platform Admin — Financial Management

**Priority:** Must Have

**Description:**
The system shall manage all financial flows: merchant subscription fees, agent commission disbursements, and platform commission retention.

**Acceptance Criteria:**
- [ ] Platform maintains merchant prepaid accounts (subscription fees credited upon payment)
- [ ] Merchant must prepay commission budget (digital wallet model) before setting up reward campaigns
- [ ] Platform tracks merchant commission budget pools (amount allocated for agent rewards, deducted from prepaid balance)
- [ ] Platform tracks agent commission accounts (earnings accrued, settled T+3, withdrawals processed)
- [ ] Platform generates daily/weekly/monthly financial reports: subscription revenue, commission payouts, net platform revenue
- [ ] Agent commission disbursements processed via payment gateway (Alipay/WeChat Pay/Bank)
- [ ] Platform retains 20% of agent commission as platform fee

---

### FR-025: Platform Admin — Fraud Detection

**Priority:** Must Have

**Description:**
The system shall detect and prevent fraudulent activities including fake redemptions, self-redemption by merchants, and coordinated fake traffic.

**Acceptance Criteria:**
- [ ] AI detects abnormal patterns: unusually high claim rate, self-redemption, coordinated IP/device behavior
- [ ] Suspicious transactions are flagged and pending admin review before commission is credited
- [ ] Merchant's verification callback is validated against known fraud patterns
- [ ] Repeat offenders are blacklisted and accounts are frozen
- [ ] Fraud detection rules are configurable by admin
- [ ] Fraud cases are logged and reported

---

### FR-026: Platform Admin — Dashboard & Monitoring

**Priority:** Must Have

**Description:**
The system shall provide a real-time operations dashboard for platform admins, showing key business metrics.

**Acceptance Criteria:**
- [ ] Real-time KPIs: new merchants today, active agents, daily redemptions, GMV, platform revenue
- [ ] Charts: GMV trend, agent growth, merchant retention, commission payout trend
- [ ] Alerts: fraud alerts, unusual activity, system errors, payment failures
- [ ] Admin can drill down from platform level → merchant level → agent level
- [ ] Data refresh: real-time ( KPIs) to daily ( detailed reports)

---

### FR-027: AI Customer Service (Bot)

**Priority:** Should Have

**Description:**
The system shall provide AI-powered customer service that handles common questions from merchants, agents, and customers automatically.

**Acceptance Criteria:**
- [ ] Chat interface accessible from merchant/agent/customer dashboards
- [ ] AI bot handles 80% of common questions without human intervention
- [ ] Questions not handled by bot are escalated to human admin
- [ ] Bot supports: FAQ, commission status, coupon validity, account issues
- [ ] Bot learns from resolved escalations (human feedback loop)

---

### FR-028: Multi-Platform API Integration (Phase 1: Douyin)

**Priority:** Must Have

**Description:**
The system shall integrate with Douyin (抖音) enterprise account APIs to enable content publishing and performance tracking.

**Acceptance Criteria:**
- [ ] Agent can authorize Douyin enterprise account via OAuth
- [ ] Agent can publish short videos to Douyin via API
- [ ] Agent can track Douyin content performance (views, clicks, comments)
- [ ] Attribution is tracked via Douyin custom parameters in shared links
- [ ] Douyin-specific content format compliance (aspect ratio, duration, music)

---

### FR-029: Multi-Platform API Integration (Phase 2: Xiaohongshu)

**Priority:** Should Have

**Description:**
The system shall integrate with Xiaohongshu (小红书) enterprise account APIs.

**Acceptance Criteria:**
- [ ] Agent can authorize Xiaohongshu professional account via OAuth
- [ ] Agent can publish notes to Xiaohongshu via API
- [ ] Agent can track Xiaohongshu note performance (views, likes, saves, comments)
- [ ] Attribution tracked via custom URL parameters
- [ ] Xiaohongshu-specific content format compliance

---

### FR-030: Multi-Platform API Integration (Phase 3: WeChat Video Account)

**Priority:** Should Have

**Description:**
The system shall integrate with WeChat Video Account (视频号) APIs.

**Acceptance Criteria:**
- [ ] Agent can authorize WeChat Video Account via WeChat Open Platform OAuth
- [ ] Agent can publish short videos to Video Account
- [ ] Attribution tracked via WeChat share tracking parameters
- [ ] Performance tracking (views, shares, comments)

---

### FR-031: Multi-Platform API Integration (Phase 4: Kuaishou)

**Priority:** Could Have

**Description:**
The system shall integrate with Kuaishou (快手) APIs in a later phase.

**Acceptance Criteria:**
- [ ] Agent can authorize Kuaishou account via OAuth
- [ ] Agent can publish content to Kuaishou
- [ ] Attribution tracked via Kuaishou custom parameters
- [ ] Phase 4 priority, not in initial release

---

### FR-032: AI Agent — Automatic Campaign Configuration

**Priority:** Must Have

**Description:**
The system shall use AI Agent to automatically configure marketing campaigns from merchant's natural language description, without manual template filling.

**Acceptance Criteria:**
- [ ] Merchant inputs campaign description in natural Chinese
- [ ] AI Agent extracts: campaign type, discount mechanics, budget, duration, target audience
- [ ] AI Agent maps description to platform configuration parameters
- [ ] AI Agent generates 3 configuration options for merchant to choose
- [ ] AI Agent explains each option's expected outcome
- [ ] Upon approval, campaign is created and activated

---

### FR-033: AI Agent — Automatic Content Distribution

**Priority:** Should Have

**Description:**
The system shall use AI Agent to automatically determine the best platforms, timing, and content format for each marketing campaign.

**Acceptance Criteria:**
- [ ] AI Agent analyzes campaign target audience
- [ ] AI Agent selects optimal platforms based on audience demographics
- [ ] AI Agent determines optimal posting times per platform
- [ ] AI Agent generates platform-specific content variations
- [ ] AI Agent schedules posts across platforms automatically (with merchant approval)
- [ ] AI Agent monitors performance and adjusts schedule dynamically

---

### FR-034: Merchant Enterprise Account Registration Assistance

**Priority:** Should Have

**Description:**
The system shall provide step-by-step guidance and documentation to help merchants register enterprise accounts on Douyin, Xiaohongshu, and WeChat Video Account. Platform does not register on behalf of merchant but facilitates the process.

**Acceptance Criteria:**
- [ ] Merchant dashboard provides platform-specific registration guides (text + screenshots)
- [ ] Platform provides pre-filled application templates where possible
- [ ] Merchant can invite sharing agents to bind their accounts after registration
- [ ] Admin can assist via chat/phone for enterprise account registration issues
- [ ] Registration status is tracked per merchant per platform

---

### FR-035: C-End Mini-Program — Basic Functions

**Priority:** Must Have

**Description:**
The system shall provide a WeChat mini-program for C-end customers with basic coupon discovery and redemption functions.

**Acceptance Criteria:**
- [ ] LBS-based nearby merchant coupon discovery
- [ ] Coupon detail page with redemption instructions
- [ ] Coupon collection (saved to user's coupon wallet)
- [ ] Coupon redemption (show QR code / numeric code to merchant)
- [ ] Coupon history (collected, used, expired)
- [ ] Share coupons to friends via WeChat

---

### FR-036: C-End Mini-Program — Social Sharing

**Priority:** Must Have

**Description:**
The system shall allow C-end customers to share coupons and promotional content to WeChat contacts, effectively becoming sharing agents themselves.

**Acceptance Criteria:**
- [ ] Customer can share coupon page to WeChat friends/groups
- [ ] Shared link includes attribution tracking (customer's agent ID)
- [ ] Customer earns commission when their shared links result in redemptions
- [ ] Customer can view their sharing performance in mini-program
- [ ] Customer can use AI creation tools within mini-program

---

### FR-037: C-End Mini-Program — Gamification

**Priority:** Could Have

**Description:**
The system shall incorporate gamification elements to encourage C-end users to share and engage.

**Acceptance Criteria:**
- [ ] "Sharing quest" system: share to X friends → unlock higher coupon value
- [ ] "Mystery box" rewards: sharing unlocks random discount/cash rewards
- [ ] Points system: earn points for sharing/redeeming, redeem for gifts
- [ ] Leaderboard: top sharers per merchant or per platform

---

### FR-038: Agent Task Marketplace

**Priority:** Should Have

**Description:**
The system shall provide a marketplace where merchants post sharing tasks and agents accept them. Agents are matched based on reputation level and platform presence.

**Acceptance Criteria:**
- [ ] Merchant can post sharing task: coupon, target audience, budget, deadline
- [ ] Agent can browse and accept tasks
- [ ] AI matches agents to tasks based on: reputation level, platform accounts, past performance
- [ ] Task completion is tracked (views → claims → redemptions)
- [ ] Commission is paid upon task completion verification

---

### FR-039: Tax Income Proof Generation

**Priority:** Could Have

**Description:**
The system shall generate annual income proof documents for sharing agents to support their tax filing (taxes handled by agents themselves, platform provides documentation).

**Acceptance Criteria:**
- [ ] Agent can download annual commission statement (PDF)
- [ ] Statement includes: total earnings, months, redemptions, platform fee deducted
- [ ] Platform generates official income proof with platform seal
- [ ] Agent can export data for any date range
- [ ] Platform clearly states: taxes are agent's responsibility

---

### FR-040: Merchant CRM Integration

**Priority:** Could Have

**Description:**
The system shall provide basic CRM data to merchants: customer list attributed to their agents, customer profile, redemption history.

**Acceptance Criteria:**
- [ ] Merchant sees list of all customers acquired via platform (within lock period)
- [ ] Customer profile: first acquisition date, total redemptions, total spend
- [ ] Merchant can export customer list (with privacy compliance)
- [ ] Customer data is not shared across merchants
- [ ] GDPR-like data export rights for customers (if applicable)

---

## Non-Functional Requirements

### NFR-001: Performance — API Response Time

**Priority:** Must Have

**Description:**
All API endpoints shall respond within defined SLA.

**Acceptance Criteria:**
- [ ] Coupon verification API: < 200ms (p95) under normal load
- [ ] AI content generation API: < 5s (p95) for copy, < 30s for video
- [ ] Dashboard page load: < 3s (p95)
- [ ] Real-time tracking data refresh: < 10s latency
- [ ] Commission calculation: < 1s per redemption event

**Rationale:** Coupon verification is in the merchant's critical path at point-of-sale; slow response affects merchant operations.

---

### NFR-002: Performance — Concurrent Capacity

**Priority:** Must Have

**Description:**
The system shall handle concurrent load without degradation.

**Acceptance Criteria:**
- [ ] Support 10,000+ concurrent active sharing agents
- [ ] Support 1,000+ concurrent coupon verification requests
- [ ] Support 500+ concurrent AI content generation requests
- [ ] Auto-scale infrastructure to handle 3x peak load
- [ ] Database can handle 10M+ attribution records

**Rationale:** Platform targets 500 merchants + millions of sharing impressions; peak traffic during flash sales or viral events must be supported.

---

### NFR-003: Security — Authentication & Authorization

**Priority:** Must Have

**Description:**
All system access shall be properly authenticated and authorized.

**Acceptance Criteria:**
- [ ] All API calls require valid authentication tokens (JWT)
- [ ] Role-based access control: Admin, Merchant, Agent, Customer (C-end)
- [ ] Merchant API keys are signed (HMAC-SHA256)
- [ ] All sensitive data (bank accounts, IDs) is encrypted at rest (AES-256)
- [ ] All data in transit is encrypted (TLS 1.3)
- [ ] Multi-factor authentication available for merchant and admin accounts

**Rationale:** Financial data and personal information require strong security controls.

---

### NFR-004: Security — API Security

**Priority:** Must Have

**Description:**
External APIs (merchant verification callback, platform API) shall be protected against abuse.

**Acceptance Criteria:**
- [ ] Rate limiting: 1000 req/min per API key for merchant APIs
- [ ] Input validation on all API parameters (prevent SQL injection, XSS)
- [ ] Request signing required for all merchant callback APIs
- [ ] IP whitelist option for merchant callback endpoints
- [ ] Anti-replay protection on verification callback (nonce + timestamp)

**Rationale:** Merchant verification callback is a high-value financial API; abuse leads to commission fraud.

---

### NFR-005: Reliability — Uptime

**Priority:** Must Have

**Description:**
The system shall maintain target availability.

**Acceptance Criteria:**
- [ ] Platform uptime: 99.5% (excluding scheduled maintenance)
- [ ] Planned maintenance announced 48 hours in advance
- [ ] Coupon verification API has dedicated SLA: 99.9% uptime
- [ ] Disaster recovery: RPO < 1 hour, RTO < 4 hours
- [ ] Database backup: daily full backup, continuous WAL archiving

**Rationale:** Coupon verification downtime directly impacts merchant point-of-sale; financial transactions cannot be lost.

---

### NFR-006: Scalability — Data Volume

**Priority:** Must Have

**Description:**
The system shall scale to support the target data volume.

**Acceptance Criteria:**
- [ ] Support 500+ paying merchants
- [ ] Support 10,000+ active sharing agents
- [ ] Support 100M+ attribution records
- [ ] Support 1M+ daily sharing events
- [ ] AI content generation: 10,000+ generations/day

**Rationale:** Business objective is 500 merchants + millions of sharing impressions; system must handle this from day one.

---

### NFR-007: Compliance — Platform Policies

**Priority:** Must Have

**Description:**
The system shall comply with WeChat, Douyin, and Xiaohongshu platform policies.

**Acceptance Criteria:**
- [ ] No multi-level distribution (only single-level: agent → customer)
- [ ] Commission amounts do not constitute illegal financial products
- [ ] Content generated via AI includes required disclosures (if mandated by platform)
- [ ] Platform supports data residency in mainland China
- [ ] No inducement to share (anti-spam compliance per WeChat policy)

**Rationale:** Non-compliance leads to platform bans; WeChat and Douyin actively penalize policy violations.

---

### NFR-008: Maintainability — Observability

**Priority:** Should Have

**Description:**
The system shall be observable for debugging and monitoring.

**Acceptance Criteria:**
- [ ] Structured logging (JSON format) for all services
- [ ] Distributed tracing for API calls (OpenTelemetry)
- [ ] Metrics dashboard (Prometheus + Grafana)
- [ ] Alerting for critical metrics (error rate > 1%, latency > SLA, payment failures)
- [ ] Audit logs for all financial transactions (immutable)

**Rationale:** Financial platform requires full traceability for debugging commission disputes and fraud investigation.

---

## Epics

### EPIC-001: Merchant Onboarding & Subscription

**Description:**
Enable merchants to register, subscribe, configure stores, and integrate their business systems with the platform.

**Functional Requirements:**
- FR-001, FR-002, FR-034

**Story Count Estimate:** 5

**Priority:** Must Have

**Business Value:**
No subscription, no platform. This is the foundation for all revenue.

---

### EPIC-002: Marketing Activity Management

**Description:**
Enable merchants to create, configure, launch, and monitor marketing activities with AI assistance.

**Functional Requirements:**
- FR-003, FR-004, FR-018, FR-019, FR-020

**Story Count Estimate:** 6

**Priority:** Must Have

**Business Value:**
Core product value — merchants must be able to run campaigns efficiently.

---

### EPIC-003: Sharing Agent Management

**Description:**
Enable merchants to recruit, manage, and analyze sharing agents. Enable agents to register, bind accounts, and manage their performance.

**Functional Requirements:**
- FR-005, FR-009, FR-038, FR-039

**Story Count Estimate:** 6

**Priority:** Must Have

**Business Value:**
Agents are the distribution channel; without agents, there is no sharing.

---

### EPIC-004: Attribution & Lock Period

**Description:**
Implement the 365-day lock period mechanism that tracks customer attribution from first click through all subsequent redemptions.

**Functional Requirements:**
- FR-006

**Story Count Estimate:** 3

**Priority:** Must Have

**Business Value:**
Lock period is the core economic mechanism that makes the compound commission model work.

---

### EPIC-005: Commission Engine

**Description:**
Implement the commission calculation and distribution system, including the 20% platform fee, 80% agent payout, compound model, T+3 settlement, and minimum ¥10 withdrawal.

**Functional Requirements:**
- FR-007, FR-008, FR-024

**Story Count Estimate:** 5

**Priority:** Must Have

**Business Value:**
Commission accuracy is the single most important trust factor. Errors lead to agent churn.

---

### EPIC-006: AI Content Generation

**Description:**
Implement AI-powered content generation for agents: copywriting, short videos, and promotional posters.

**Functional Requirements:**
- FR-010, FR-011, FR-012

**Story Count Estimate:** 6

**Priority:** Should Have

**Business Value:**
Core differentiator vs. competitors. Reduces agent barrier to entry significantly.

---

### EPIC-007: Multi-Platform Distribution

**Description:**
Integrate with Douyin, Xiaohongshu, WeChat Video Account, and Kuaishou for content publishing and performance tracking.

**Functional Requirements:**
- FR-013, FR-014, FR-028, FR-029, FR-030, FR-031

**Story Count Estimate:** 8

**Priority:** Must Have

**Business Value:**
Multi-platform support is a key differentiator from WeChat-only competitors.

---

### EPIC-008: C-End Mini-Program

**Description:**
Build the WeChat mini-program for C-end customers: coupon discovery, redemption, AI tools, and social sharing.

**Functional Requirements:**
- FR-015, FR-016, FR-017, FR-035, FR-036, FR-037

**Story Count Estimate:** 7

**Priority:** Must Have

**Business Value:**
C-end is the consumption layer; without it, the platform has no闭环.

---

### EPIC-009: Platform Admin Operations

**Description:**
Build the platform admin console for merchant/agent review, content moderation, fraud detection, and financial management.

**Functional Requirements:**
- FR-021, FR-022, FR-023, FR-024, FR-025, FR-026, FR-027

**Story Count Estimate:** 8

**Priority:** Must Have

**Business Value:**
Platform operations are essential for compliance, fraud prevention, and business intelligence.

---

### EPIC-010: AI Agent Engine

**Description:**
Build the AI Agent that handles automatic campaign configuration, content distribution, and performance optimization with minimal human intervention.

**Functional Requirements:**
- FR-032, FR-033

**Story Count Estimate:** 5

**Priority:** Should Have

**Business Value:**
AI Agent is the core long-term differentiator. Even basic AI automation (FR-003) is a major competitive advantage.

---

### EPIC-011: Analytics & Reporting

**Description:**
Build comprehensive analytics dashboards for merchants, agents, and platform admins, with real-time data and AI-generated insights.

**Functional Requirements:**
- FR-018, FR-019, FR-020, FR-026

**Story Count Estimate:** 4

**Priority:** Should Have

**Business Value:**
Data transparency drives merchant confidence and agent engagement.

---

### EPIC-012: Integration & API Ecosystem

**Description:**
Build the platform's external API ecosystem for merchant business system integration, including coupon APIs, verification callbacks, and data reporting.

**Functional Requirements:**
- FR-002, FR-016

**Story Count Estimate:** 4

**Priority:** Must Have

**Business Value:**
Clean APIs reduce merchant integration friction and are critical for adoption.

---

### EPIC-013: Gamification & Retention

**Description:**
Implement gamification features to drive sharing behavior and platform stickiness for agents and C-end users.

**Functional Requirements:**
- FR-037, FR-038

**Story Count Estimate:** 3

**Priority:** Could Have

**Business Value:**
Gamification increases sharing frequency and platform retention, but not critical for launch.

---

## User Personas

### Persona 1: Small Restaurant Owner (Merchant)
- **Age:** 30-50
- **Tech literacy:** Medium
- **Pain points:** High marketing cost for little results, doesn't know how to get customers to share
- **Goals:** More foot traffic, more repeat customers, low-cost customer acquisition
- **Willingness to pay:** ¥1,200/year is acceptable if ROI is proven
- **Key FRs:** FR-001, FR-003, FR-004, FR-018

### Persona 2: Stay-at-Home Mom / Part-Time Sharer (Agent)
- **Age:** 25-45
- **Tech literacy:** Medium-high (WeChat, Douyin power user)
- **Pain points:** Wants to earn extra income but doesn't want to commit to a formal job; doesn't know how to create good content
- **Goals:** Earn ¥500-3,000/month passively by sharing; wants to withdraw settled commissions regularly (T+3)
- **Key FRs:** FR-010, FR-011, FR-008, FR-005, FR-009

### Persona 3: Budget-Conscious Consumer (C-End)
- **Age:** 20-45
- **Pain points:** Always looking for deals; shares coupons with friends for mutual benefit
- **Goals:** Save money on purchases; earn rewards by sharing
- **Key FRs:** FR-015, FR-016, FR-036, FR-017

### Persona 4: Platform Operations Manager (Admin)
- **Role:** Internal staff
- **Pain points:** Manual review is time-consuming; fraud detection is reactive not proactive
- **Goals:** Keep platform compliant, reduce fraud, generate business insights
- **Key FRs:** FR-021, FR-023, FR-025, FR-026

---

## User Flows

### Flow 1: Merchant Campaign Lifecycle

```
1. Merchant subscribes (FR-001)
2. Merchant integrates business system via API (FR-002)
3. Merchant creates coupon/reward via natural language (FR-003) or manual (FR-004)
4. Merchant recruits sharing agents (FR-005)
5. AI generates promotional content (FR-010/011)
6. Agents share to platforms (FR-013)
7. Customers discover and claim coupons (FR-015)
8. Merchants verify redemption (FR-016)
9. Commission calculated and credited (FR-007)
10. Agent withdraws (FR-008)
11. Merchant views ROI dashboard (FR-018)
```

### Flow 2: Sharing Agent Lifecycle

```
1. Agent receives recruitment link from merchant
2. Agent registers and binds phone/account (FR-005)
3. Agent optionally binds multi-platform accounts (FR-014) — unlimited accounts per platform
4. Agent browses coupons/activities to promote (FR-004)
5. Agent uses AI to generate content — AI token cost borne by agent (FR-010/011/012)
6. Agent publishes to one or more platforms (FR-013)
7. Agent tracks performance in real time (FR-018)
8. Customer redeems → commission calculated (settles T+3) (FR-007)
9. Agent requests withdrawal (min ¥10, settled balance) (FR-008)
10. Agent's reputation score increases (FR-009)
```

### Flow 3: C-End Customer Journey

```
1. Customer discovers coupon (LBS / shared link / search) (FR-015)
2. Customer claims coupon (saved to wallet)
3. Customer goes to store, presents coupon code
4. Merchant verifies via platform API (FR-016)
5. Commission credited to sharing agent
6. Customer can optionally use AI tools to share and earn (FR-017)
7. If customer shares, they become a de facto agent (FR-036)
```

---

## Dependencies

### Internal Dependencies

- AI content generation service (requires LLM API integration: Claude/GPT/Kimi)
- Payment gateway integration (Alipay, WeChat Pay for commission payouts)
- Multi-platform OAuth providers (Douyin, Xiaohongshu, WeChat Open Platform)
- Data analytics pipeline (real-time event tracking)

### External Dependencies

- **WeChat Open Platform**: Mini-program hosting, OAuth, share tracking, Official Account binding
- **Douyin Open Platform**: Enterprise account OAuth, content publishing API, analytics API
- **Xiaohongshu**: Professional account OAuth, note publishing API
- **WeChat Video Account**: Video publishing API, share tracking
- **LLM Providers**: Claude API / GPT-4 / Kimi API for AI content generation
- **Payment Providers**: Alipay / WeChat Pay for agent commission payouts
- **Cloud Infrastructure**: Aliyun / AWS China for hosting

### External Risks

- WeChat policy changes on sharing/inducement
- Douyin/Xiaohongshu API changes or rate limits
- LLM API pricing changes or service disruptions
- Payment provider policy changes on B2C payouts

---

## Assumptions

1. Merchants have existing business systems (POS/ERP) that can call the platform's verification API within 72 hours
2. Sharing agents are individuals, not businesses (simplifies tax compliance — agents handle their own taxes)
3. Settlement cycle is T+3 (3 business days after redemption); this is acceptable to agents given the compound model
4. AI token costs are borne by agents (deducted from commission), not passed to merchants
5. Agent can bind unlimited accounts across unlimited merchants — no restrictions on multi-merchant activity
6. AI-generated content IP belongs to the sharing agent; platform may use aggregate data for analytics
7. Merchant prepays commission budget (digital wallet model) before setting up reward campaigns
8. Minimum agent withdrawal is ¥10
9. Platform retains attribution data for 1 year after lock period expires, with regular backups
10. Target market is mainland China (Simplified Chinese, CNY, mainland cloud infrastructure)
11. WeChat mini-program is the primary C-end channel (not a standalone app)
12. No blockchain needed for coupon verification (database-based is sufficient)
13. Commission model (single-level) complies with WeChat and Douyin policies as of 2026
14. Enterprise account registration on Douyin/Xiaohongshu can be facilitated by merchants but not performed by the platform on their behalf

---

## Out of Scope

The following are explicitly NOT part of this project:

- **E-commerce store / mall**: Platform does not build a product catalog, shopping cart, or order fulfillment system (unlike 有赞/微盟)
- **Multi-level distribution (≥2 levels)**: Only single-level (agent → customer) is supported
- **Payment processing for C-end transactions**: Platform does not handle customer payments; only coupon verification
- **Inventory management**: Platform does not track merchant product inventory
- **Logistics / delivery**: No delivery or shipping functionality
- **Social media accounts for merchants**: Platform assists in registration but does not register accounts on behalf of merchants
- **Legal/tax services for agents**: Platform provides income proof only; agents handle their own tax compliance
- **Physical goods fulfillment**: Platform is a marketing/distribution tool, not a commerce platform
- **International markets**: Initial release is mainland China only
- **Native mobile apps**: C-end uses WeChat mini-program; merchant and admin use web dashboards
- **Blockchain/crypto**: Coupon verification is database-based, no blockchain involved

---

## Open Questions

The following questions have been resolved based on stakeholder feedback:

| # | Question | Resolution |
|---|---------|------------|
| 1 | AI Token Billing Model | **分享员 pays** — deducted from agent's commission balance, NOT passed to merchant |
| 2 | Settlement Cycle | **T+3** — 3 business days after redemption date |
| 3 | Minimum Withdrawal | **¥10** — minimum amount for agent withdrawal |
| 4 | Verification Callback SLA | **72 hours** — maximum time window for merchant to call verification API after customer presents coupon |
| 5 | Data Retention | **1 year** — attribution data retained for 1 year after lock period expires; regular backups maintained |
| 6 | Agent Multi-Binding | **Unlimited** — one agent can bind to multiple merchants, no upper limit |
| 7 | Content IP Ownership | **Agent owns IP** — AI-generated content belongs to the sharing agent; platform may use aggregate data for operational analytics (no individual content without consent) |

---

## Approval & Sign-off

### Stakeholders

| Role | Name | Responsibility |
|------|------|--------------|
| Product Owner | zhang | Product vision, requirements, prioritization |
| Engineering Lead | TBD | Technical architecture, implementation |
| Design Lead | TBD | UX/UI design |
| QA Lead | TBD | Testing, quality assurance |

### Approval Status

- [ ] Product Owner
- [ ] Engineering Lead
- [ ] Design Lead
- [ ] QA Lead

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-08-20 | zhang | Initial PRD |

---

## Next Steps

### Phase 3: Architecture

Run `/bmad:architecture` to create system architecture based on these requirements.

The architecture will address:
- All functional requirements (FRs)
- All non-functional requirements (NFRs)
- Technical stack decisions
- Data models and APIs
- System components

### Phase 4: Sprint Planning

After architecture is complete, run `/bmad:sprint-planning` to:
- Break epics into detailed user stories
- Estimate story complexity
- Plan sprint iterations
- Begin implementation

---

**This document was created using BMAD Method v6 - Phase 2 (Planning)**

---

## Appendix A: Requirements Traceability Matrix

| Epic ID | Epic Name | Functional Requirements | Story Count (Est.) |
|---------|-----------|-------------------------|-------------------|
| EPIC-001 | Merchant Onboarding & Subscription | FR-001, FR-002, FR-034 | 5 |
| EPIC-002 | Marketing Activity Management | FR-003, FR-004, FR-018, FR-019, FR-020 | 6 |
| EPIC-003 | Sharing Agent Management | FR-005, FR-009, FR-038, FR-039 | 6 |
| EPIC-004 | Attribution & Lock Period | FR-006 | 3 |
| EPIC-005 | Commission Engine | FR-007, FR-008, FR-024 | 5 |
| EPIC-006 | AI Content Generation | FR-010, FR-011, FR-012 | 6 |
| EPIC-007 | Multi-Platform Distribution | FR-013, FR-014, FR-028, FR-029, FR-030, FR-031 | 8 |
| EPIC-008 | C-End Mini-Program | FR-015, FR-016, FR-017, FR-035, FR-036, FR-037 | 7 |
| EPIC-009 | Platform Admin Operations | FR-021, FR-022, FR-023, FR-024, FR-025, FR-026, FR-027 | 8 |
| EPIC-010 | AI Agent Engine | FR-032, FR-033 | 5 |
| EPIC-011 | Analytics & Reporting | FR-018, FR-019, FR-020, FR-026 | 4 |
| EPIC-012 | Integration & API Ecosystem | FR-002, FR-016 | 4 |
| EPIC-013 | Gamification & Retention | FR-037, FR-038 | 3 |
| **Total** | | **40 FRs** | **76 stories** |

---

## Appendix B: Prioritization Details

| Priority | Count | FRs |
|----------|-------|-----|
| **Must Have** | 20 | FR-001, 002, 003, 004, 005, 006, 007, 008, 010, 013, 014, 015, 016, 021, 022, 023, 024, 025, 026, 028, 032 |
| **Should Have** | 15 | FR-009, 011, 012, 017, 018, 019, 027, 029, 030, 033, 034, 035, 036, 038 |
| **Could Have** | 5 | FR-020, 031, 037, 039, 040 |

### Must Have (20 FRs) — Core MVP
These form the minimum viable product for launch. Without any one of these, the platform cannot function commercially.

### Should Have (15 FRs) — Enhanced Product
Important differentiators that significantly improve user experience and competitive advantage. Can be deferred 1-2 sprints after launch.

### Could Have (5 FRs) — Growth Features
Nice-to-have features that can be added in later phases. Not critical for initial market entry.

---

## Appendix C: MoSCoW Summary

```
Must Have (20 FRs)  ████████████████████████████████████  50%
Should Have (15 FRs) ██████████████████████              38%
Could Have (5 FRs)  ████████                              13%
```
