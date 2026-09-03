# STORY-AI-035：运营大屏本地验收

## 启动环境

1. 从根目录的 `.env.example` 创建仅本机使用的 `.env`，并保留 `CORS_ORIGINS=http://localhost:3100`。
2. 在 `apps/admin-dashboard` 创建 `.env.local`，内容为：

   ```dotenv
   VITE_API_BASE_URL=http://localhost:3000/api/v1
   ```

3. 启动依赖及 API：`docker compose up -d postgres redis`，然后执行 `pnpm --filter @ai-auto/api dev`。
4. 启动大屏：`pnpm --filter @ai-auto/admin-dashboard dev`，访问 `http://localhost:3100`。

## 验收清单

- 使用 `POST /api/v1/auth/admin/login` 的管理员账号登录。浏览器本地存储应出现 `admin_access_token`，随后所有大屏请求都会带 `Authorization: Bearer <token>`。
- 观察网络请求：`GET /api/v1/admin/dashboard` 首次成功后每 10 秒刷新一次；手动刷新按钮应立即触发一次请求。
- 确认 GMV、分享员增长、佣金支出、商户续费率四张趋势图均来自接口 `trends`；告警中心和待办事项分别来自 `alerts` 与 `pendingActions`。
- 依次填入真实商户 UUID、再从“该商户的分享员”下拉框选择已绑定分享员。请求应依次包含 `merchantId`，再同时包含 `merchantId` 与 `agentId`，页面标题随之显示商户/分享员下钻视图。

## 通知基础设施确认（后续工作，不属于本故事实现）

当前仓库尚未包含 Alertmanager 配置、Webhook 凭证或钉钉/企微发送器；因此本故事只呈现应用内待处理告警，未发送外部通知。开始外部通知前，需由运维提供并确认：

- 可访问的 Alertmanager 实例及 Prometheus 告警规则（含错误率、p95 和支付失败指标）；
- 钉钉或企微机器人的 Webhook、签名/密钥，以及对应群或企业应用；
- 严重级别到接收人群组的路由、去重/静默窗口和值班升级规则。

这些前置条件确认后，再实施 Alertmanager → 钉钉/企微的分级路由；不在本地环境或源码中写入 Webhook 密钥。
