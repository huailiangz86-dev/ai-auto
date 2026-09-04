# 本地管理员初始化

在 `apps/api` 目录执行：

```bash
pnpm admin:create -- --username admin
```

命令会隐藏式询问密码。用户名已存在时会重置密码并重新启用账号，不存在时会创建
`super_admin` 账号。也可以通过 `--real-name` 和 `--role` 指定资料。

该命令只允许在非生产环境执行，并且不会输出密码或密码哈希。生产环境如确需执行，
必须显式设置 `ALLOW_ADMIN_BOOTSTRAP=true`。
