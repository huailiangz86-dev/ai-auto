# AI auto v2.0 Delivery Plan — Two-Sided Growth Network

**Date:** 2026-09-01  
**Status:** Active planning baseline  
**Source of truth:** `docs/prd-ai-auto-2026-08-20.md` v2.0  
**Supersedes for new work:** `docs/sprint-plan-ai-auto-2026-08-20.md` (v1.0 plan remains historical reference)

## Delivery Principle

The implementation order is intentional: **Operations → Merchant → Creator client → Consumer client**. Each surface is built on a shared backend contract, but Operations ships first so creator verification, task compensation, budget classification, risk controls and auditability exist before either market-facing side is invited into the workflow.

P0 proves a managed local marketplace with 10 merchants, 50 Creators, 30 Campaigns and 100 published items. It does not assume open-market liquidity or charge a Creator for AI needed to finish a merchant-funded task.

## Phase Schedule

| Phase | Weeks | Primary surface | Objective | Exit criteria |
|---|---:|---|---|---|
| V2-0 | 1–2 | Operations + domain foundation | Establish Creator, Growth Task, Creator Task, campaign economics, audit and dispute contracts. | Operations can verify/suspend a Creator, approve a funded task rule, inspect revenue/COGS and audit every decision. |
| V2-1 | 3–4 | Operations workbench | Operate the managed pilot: queues, risk holds, content/task review, payout reconciliation and launch metrics. | One Campaign can be safely supervised end-to-end without spreadsheet-only controls. |
| V2-2 | 5–6 | Merchant Growth Workspace | Replace campaign-first setup with goal → AI Growth Plan → budget/economics → Creator strategy → approval. | Merchant can approve a reviewable Growth Plan and see goal progress, verified result and ROI. |
| V2-3 | 7–8 | Creator client | Deliver Creator onboarding, profile/score, task market, task lifecycle and task-aware AI Creator Studio. | Eligible Creator can accept a funded task, create/edit/submit content and see expected payout. |
| V2-4 | 9–10 | Consumer client | Make consumer discovery and redemption a privacy-aware evidence layer, not an implicit Creator conversion funnel. | Consumer journey produces a verified, traceable event chain to task/payout while respecting consent. |
| V2-5 | 11–12 | Cross-side convergence | Matching, payout settlement, incrementality reporting, disputes, repeat Campaign loop and pilot instrumentation. | Merchant ROI and Creator earnings reconcile from the same evidence; repeat Campaign and repeat task signals are measurable. |
| V2-P1 | 13+ | Channel + expansion | Creator Pro/personal Credits, image/video studio, channel APIs, Growth API and enterprise packaging. | P1 monetization never blocks P0 task supply or demand validation. |

## Ordered Backlog

### V2-0 — Operations and Domain Foundation

1. **OPS-V2-001 — Commercial ledger and Creator terminology**
   - Add explicit Merchant Growth Revenue, Creator Payout (COGS), model/channel/consumer costs and gross-profit classifications.
   - Preserve legacy `agent` persistence identifiers only as migration compatibility; use Creator in public API/UI/documentation.
   - Acceptance: operations can reconcile Campaign budget, revenue, COGS and gross profit without interpreting Creator payout as revenue.
2. **OPS-V2-002 — Creator governance**
   - Creator profile/verification, score inputs, suspension/blacklist and immutable audit evidence.
3. **OPS-V2-003 — Growth Task / Creator Task state machine**
   - Implement the FR-044 lifecycle, compensation lock, Campaign Credits and review/risk-hold transitions.
4. **OPS-V2-004 — Operations workbench queues**
   - Add Creator verification, task/content review, risk hold, dispute and economics views to the admin dashboard.
5. **OPS-V2-005 — Pilot instrumentation**
   - Capture activation, acceptance, completion, published, verified and repeat metrics.

### V2-2 — Merchant Growth Workspace

1. **MERCHANT-V2-001 — Goal intake and Growth Plan review**
2. **MERCHANT-V2-002 — Campaign unit economics and funding**
3. **MERCHANT-V2-003 — Creator strategy, matching explanation and approval**
4. **MERCHANT-V2-004 — ROI and verified/incremental reporting**

### V2-3 — Creator Client

1. **CREATOR-V2-001 — Creator onboarding, verification status and account profile**
2. **CREATOR-V2-002 — Today’s tasks, recommendations and task acceptance**
3. **CREATOR-V2-003 — My tasks and lifecycle actions**
4. **CREATOR-V2-004 — AI Creator Studio with Campaign Credits**
5. **CREATOR-V2-005 — Creator Score, earnings, settlement and disputes**

### V2-4 — Consumer Client

1. **CONSUMER-V2-001 — Offer discovery, consent and tracking hand-off**
2. **CONSUMER-V2-002 — Coupon/order verification evidence and privacy controls**
3. **CONSUMER-V2-003 — Attribution event visibility without implicit Creator enrollment**

### V2-5 — Cross-Side Convergence

1. **CORE-V2-001 — Explainable matching and task invitations**
2. **CORE-V2-002 — Creator Payout settlement, risk holds and appeals**
3. **CORE-V2-003 — Verified versus incremental reporting**
4. **CORE-V2-004 — Repeat Campaign / budget expansion / Creator retention instrumentation**

## Dependency Rules

- Merchant and Creator surfaces may not expose a paid task until V2-0 governance, compensation lock and financial classification are live.
- Merchant-funded task AI always debits Campaign Credits; personal Credits are a P1-only path.
- All result dashboards derive from the same evidence chain: task → content/publication → tracking → verified transaction → payout/score.
- Platform/channel integrations may use a manual-publish fallback in P0, but must not claim an automated publication or performance metric without evidence.

## Immediate Implementation Task

**Completed 2026-09-01:** OPS-V2-001 — Commercial ledger and Creator terminology.

Delivered an append-only financial ledger, idempotent operations entry API, Campaign economics query, migration and regression coverage. Creator Payout is now explicitly recorded as COGS, separate from Merchant Growth Revenue and gross profit.

**Completed 2026-09-01:** OPS-V2-002 — Creator governance.

Delivered v2 Creator profile/governance fields, reviewed five-dimension Growth Score with L1–L5 mapping, auditable score decisions and Creator blacklist controls. Existing verification approval and suspension flows remain the compatibility path.

**Next:** OPS-V2-003 — Growth Task / Creator Task state machine (compensation lock, Campaign Credits and review/risk-hold transitions).