import { LockOutlined, UserOutlined } from '@ant-design/icons'
import { Alert, Button, Card, Form, Input, Typography } from 'antd'
import { useState } from 'react'

import { loginAdmin, storeAdminSession } from '../api/auth'

type LoginPageProps = {
  onAuthenticated: () => void
}

export function LoginPage({ onAuthenticated }: LoginPageProps) {
  const [error, setError] = useState<string>()
  const [loading, setLoading] = useState(false)

  async function submit(values: { username: string; password: string }) {
    setLoading(true)
    setError(undefined)
    try {
      storeAdminSession(await loginAdmin(values.username.trim(), values.password))
      onAuthenticated()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '管理员登录失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="login-page">
      <Card className="login-card" bordered={false}>
        <div className="login-brand"><span className="brand-mark">A</span><span>AI auto</span></div>
        <Typography.Title level={2}>运营平台登录</Typography.Title>
        <Typography.Paragraph type="secondary">使用管理员账号后即可查看实时运营数据。</Typography.Paragraph>
        {error && <Alert className="login-error" type="error" showIcon message={error} />}
        <Form layout="vertical" requiredMark={false} onFinish={(values) => void submit(values)}>
          <Form.Item label="用户名" name="username" rules={[{ required: true, message: '请输入管理员用户名' }]}>
            <Input autoComplete="username" prefix={<UserOutlined />} placeholder="管理员用户名" size="large" />
          </Form.Item>
          <Form.Item label="密码" name="password" rules={[{ required: true, message: '请输入密码' }]}>
            <Input.Password autoComplete="current-password" prefix={<LockOutlined />} placeholder="密码" size="large" />
          </Form.Item>
          <Button htmlType="submit" type="primary" size="large" block loading={loading}>登录并进入大屏</Button>
        </Form>
      </Card>
    </main>
  )
}
