# 本地管理员初始化

在 `apps/api` 目录执行：

```bash
pnpm admin:create -- --username admin
```

命令会隐藏式询问密码。用户名已存在时会重置密码并重新启用账号，不存在时会创建
`super_admin` 账号。也可以通过 `--real-name` 和 `--role` 指定资料。

该命令只允许在非生产环境执行，并且不会输出密码或密码哈希。生产环境如确需执行，
必须显式设置 `ALLOW_ADMIN_BOOTSTRAP=true`。

## 分享员管理 mock 数据

在本地数据库写入可重复执行的分享员管理测试数据：

```bash
pnpm admin:seed-agent-mocks
```

脚本会创建/更新带 `MOCK-` 前缀的分享员、测试商户、合作关系、任务、发布记录和运营备注，
不会删除其他业务数据。重新执行会把这些固定 mock 记录恢复到基线状态。

如需测试分享员端登录，mock 分享员密码统一为 `MockAgent123!`。

## 创作者任务审核 mock 数据

在本地数据库写入运营工作台所需的创作者任务审核演示数据：

```bash
pnpm admin:seed-creator-task-review-mocks
```

脚本会创建/更新一条 `submitted` 待审核任务和一条 `risk_hold` 风控暂停任务，
并关联 Creator Studio 内容、发布记录、Campaign Credits、财务台账、审计日志和通知。
数据使用固定 UUID，可重复执行恢复到基线，不会删除其他业务数据，也禁止在生产环境执行。
