# CRM 接口冒烟测试记录（2026-08-28）

## 结论

**已闭环（PASS）。** CRM 的客户列表、客户详情和 CSV 导出均已通过真实 HTTP 冒烟；商户数据隔离、脱敏、空数据、无权限和分页边界均符合预期。

快手账号及发布相关模块未作任何修改。

## 测试环境

- 数据库：本机 PostgreSQL `ai_auto_dev`，使用专用测试 schema `crm_smoke_20260828`。
- 启动参数：`NODE_ENV=test`、`DB_SYNCHRONIZE=true`、端口 `3100`。
- API 实际路由前缀：`/api/v1/analytics`（沿用现有控制器与全局前缀组合）。
- 专用 schema 避开了 `public.customers` 由其他数据库账号拥有的问题；同步、夹具均不触及 `public` 中的历史数据。

## 修复内容

1. `AgentModule` 改为导出 `TypeOrmModule`，而非导出实体类，恢复 Nest 模块初始化。
2. 补回 `Merchant.status`，使实体索引与既有认证读取逻辑一致。
3. 将 `Campaign` 的状态索引改为实际字段 `campaignStatus`。
4. 支持可选 `DB_SCHEMA`，用于隔离本地测试 schema。
5. 新增 `GET /api/v1/analytics/crm/customers/:customerReference`：仅在当前商户的有效锁客范围内解析客户标识；跨商户或过期客户均返回 404，响应保持脱敏 CRM 投影。
6. 将静态 `/export` 路由置于参数详情路由之前，避免被 `:customerReference` 抢占。

## HTTP 冒烟结果

夹具包含两家有数据商户、一家空数据商户、一名分享员、客户归属、有效及过期锁客记录，以及锁客期内外的核销记录。

| 场景 | 结果 | 断言 |
| --- | --- | --- |
| 健康检查 | 通过 | `GET /api/v1/health` 返回 200 |
| 商户 A 列表 | 通过 | 总数为 3；只返回商户 A 的有效锁客客户；锁客期前核销不计入金额 |
| 商户 B 列表 | 通过 | 总数为 1；不返回商户 A 客户 |
| 分页 | 通过 | `page=1&pageSize=2` 返回 2 条、`page=2` 返回 1 条、越界页返回空数组；`pageSize=101` 返回 400 |
| 空数据 | 通过 | 无锁客商户返回 `items: []`、`total: 0` |
| 未认证 | 通过 | 无令牌请求返回 401 |
| 无角色权限 | 通过 | 分享员令牌请求返回 403 |
| 客户详情 | 通过 | 本商户参考标识返回 200；另一商户使用相同标识返回 404 |
| CSV 导出 | 通过 | 返回 200 与 `text/csv`；包含脱敏手机号；不包含原始手机号、昵称、平台客户 UUID 或其他商户数据 |

## 可重复执行

`apps/api/scripts/crm-http-smoke.js` 会在名称受限的 `crm_smoke_*` 专用 schema 中重置并写入夹具，随后执行所有上述 HTTP 断言；未设置该专用 schema 时脚本会拒绝运行。

本次最终复核：

- `pnpm exec jest --runInBand src/modules/analytics/merchant-crm.service.spec.ts`：3/3 通过。
- `pnpm type-check`：通过。
- `pnpm build`：通过。
- `pnpm start`（测试环境、`DB_SYNCHRONIZE=true`）：启动成功。
- `node scripts/crm-http-smoke.js`：通过。
