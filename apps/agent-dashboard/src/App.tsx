import {
  AppstoreOutlined,
  BellOutlined,
  FileTextOutlined,
  LinkOutlined,
  LogoutOutlined,
  RiseOutlined,
  WalletOutlined,
} from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Col,
  Form,
  Input,
  Layout,
  Menu,
  Modal,
  Row,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
  message,
} from 'antd'
import { useState } from 'react'
import { api, clearSession, setSession, type Session } from './api'
import { CreatorWorkspace } from './CreatorWorkspace'
const { Header, Sider, Content } = Layout
const money = (v: number | undefined) =>
  new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' }).format(Number(v ?? 0))

export default function App() {
  const [loggedIn, setLoggedIn] = useState(Boolean(localStorage.getItem('agent_access_token')))
  return loggedIn ? (
    <Portal
      onLogout={() => {
        clearSession()
        setLoggedIn(false)
      }}
    />
  ) : (
    <Auth onAuthenticated={() => setLoggedIn(true)} />
  )
}
function Auth({ onAuthenticated }: { onAuthenticated: () => void }) {
  const [registering, setRegistering] = useState(false)
  const [busy, setBusy] = useState(false)
  const submit = async (value: { phone: string; password: string; nickname?: string }) => {
    setBusy(true)
    try {
      const session = await api<Session>(
        registering ? '/auth/agent/register' : '/auth/agent/login',
        { method: 'POST', body: JSON.stringify(value) },
      )
      setSession(session)
      onAuthenticated()
    } catch (e) {
      message.error(e instanceof Error ? e.message : '登录失败')
    } finally {
      setBusy(false)
    }
  }
  return (
    <main className="auth-page">
      <Card className="auth-card">
        <Typography.Title level={2}>AI auto 分享员后台</Typography.Title>
        <Typography.Paragraph type="secondary">
          生成内容、分发推广、跟进每笔佣金。
        </Typography.Paragraph>
        <Form layout="vertical" onFinish={submit}>
          <Form.Item hidden={!registering} name="nickname" label="昵称">
            <Input placeholder="分享昵称" />
          </Form.Item>
          <Form.Item
            name="phone"
            label="手机号"
            rules={[{ required: true, pattern: /^1[3-9]\d{9}$/, message: '请输入 11 位手机号' }]}
          >
            <Input placeholder="13900000000" />
          </Form.Item>
          <Form.Item
            name="password"
            label="密码"
            rules={[{ required: true, min: 8, message: '至少 8 位' }]}
          >
            <Input.Password />
          </Form.Item>
          <Button type="primary" size="large" block htmlType="submit" loading={busy}>
            {registering ? '注册并开始推广' : '登录'}
          </Button>
        </Form>
        <Button type="link" block onClick={() => setRegistering(!registering)}>
          {registering ? '已有账户，立即登录' : '注册分享员账户'}
        </Button>
      </Card>
    </main>
  )
}
function Portal({ onLogout }: { onLogout: () => void }) {
  const [page, setPage] = useState('overview')
  return (
    <Layout className="portal">
      <Sider breakpoint="lg" collapsedWidth="0" className="portal-sider">
        <div className="portal-brand">
          <RiseOutlined /> AI auto
        </div>
        <Menu
          theme="dark"
          selectedKeys={[page]}
          onClick={({ key }) => setPage(key)}
          items={[
            { key: 'overview', icon: <AppstoreOutlined />, label: '收益概览' },
            { key: 'creator', icon: <FileTextOutlined />, label: '创作者任务中心' },
            { key: 'content', icon: <FileTextOutlined />, label: 'AI 创作与分发' },
            { key: 'income', icon: <WalletOutlined />, label: '佣金与提现' },
            { key: 'platforms', icon: <LinkOutlined />, label: '账号授权' },
            { key: 'notifications', icon: <BellOutlined />, label: '消息通知' },
          ]}
        />
      </Sider>
      <Layout>
        <Header className="portal-header">
          <span>分享员工作台</span>
          <Button type="text" icon={<LogoutOutlined />} onClick={onLogout}>
            退出
          </Button>
        </Header>
        <Content className="portal-content">
          {page === 'overview' && <Overview />}
          {page === 'creator' && <CreatorWorkspace />}
          {page === 'content' && <Contents />}
          {page === 'income' && <Income />}
          {page === 'platforms' && <Platforms />}
          {page === 'notifications' && <Notifications />}
        </Content>
      </Layout>
    </Layout>
  )
}
function Overview() {
  const wallet = useQuery({
    queryKey: ['agent-wallet'],
    queryFn: () => api<any>('/commission/wallet'),
  })
  const commissions = useQuery({
    queryKey: ['agent-commissions'],
    queryFn: () => api<any>('/commission/commissions?page=1&pageSize=5'),
  })
  return (
    <>
      <div className="agent-hero">
        <Typography.Text>累计可获得佣金</Typography.Text>
        <h1>{money(wallet.data?.totalEarned ?? wallet.data?.availableBalance)}</h1>
        <div className="hero-sub">
          <span>可提现 {money(wallet.data?.availableBalance)}</span>
          <span>待结算 {money(wallet.data?.pendingBalance)}</span>
        </div>
      </div>
      <Row gutter={[16, 16]} className="section">
        <Stat title="累计核销" value={wallet.data?.totalRedemptions ?? 0} />
        <Stat title="AI 余额" value={money(wallet.data?.aiTokenBalance)} />
        <Stat title="当前等级" value={wallet.data?.level ?? 'bronze'} />
      </Row>
      <Card title="最近佣金">
        <Table
          size="small"
          rowKey="id"
          loading={commissions.isLoading}
          dataSource={commissions.data?.items ?? []}
          columns={[
            { title: '金额', dataIndex: 'agentFinalPayout', render: money },
            { title: '结算状态', dataIndex: 'status', render: (v) => <Tag>{v}</Tag> },
            {
              title: '结算时间',
              dataIndex: 'settleAt',
              render: (v) => (v ? new Date(v).toLocaleDateString('zh-CN') : '—'),
            },
          ]}
          locale={{ emptyText: '暂无佣金记录' }}
        />
      </Card>
    </>
  )
}
function Stat({ title, value }: { title: string; value: string | number }) {
  return (
    <Col xs={24} sm={8}>
      <Card>
        <Statistic title={title} value={value} />
      </Card>
    </Col>
  )
}
const platformLabels: Record<string, string> = {
  douyin: '抖音',
  xiaohongshu: '小红书',
  video_account: '视频号',
  kuaishou: '快手',
}
const pluginEvent = 'ai-auto:open-publish-drafts'
const pluginResultEvent = 'ai-auto:extension-result'

function PublishTestLauncher({ content }: { content: any }) {
  const [open, setOpen] = useState(false)
  const [platforms, setPlatforms] = useState<string[]>(['douyin', 'xiaohongshu'])
  const sendToPlugin = () => {
    if (platforms.length === 0) {
      message.warning('请至少选择一个平台')
      return
    }
    let received = false
    const receive = (event: Event) => {
      const detail = (event as CustomEvent<{ ok: boolean; message?: string }>).detail
      received = true
      window.removeEventListener(pluginResultEvent, receive)
      if (detail?.ok) {
        message.success(
          `已打开 ${platforms.map((platform) => platformLabels[platform]).join('、')} 的发布页；请手动确认发布。`,
        )
        setOpen(false)
      } else message.error(detail?.message ?? '插件未能创建发布页')
    }
    window.addEventListener(pluginResultEvent, receive)
    window.dispatchEvent(
      new CustomEvent(pluginEvent, {
        detail: {
          content: { contentId: content.contentId, text: content.selectedCopy },
          platforms,
        },
      }),
    )
    window.setTimeout(() => {
      if (!received) {
        window.removeEventListener(pluginResultEvent, receive)
        message.error('未检测到 AI auto 发布助手插件。请安装并启用插件后重试。')
      }
    }, 1200)
  }
  return (
    <>
      <Button type="link" onClick={() => setOpen(true)}>
        发送到发布页
      </Button>
      <Modal
        title="发送到平台发布页（测试）"
        open={open}
        onCancel={() => setOpen(false)}
        onOk={sendToPlugin}
        okText="打开发布页"
        cancelText="取消"
      >
        <Alert
          showIcon
          type="warning"
          message="不会自动发布"
          description="插件仅会打开各平台发布页面，并提供预填文案。请检查内容、素材和平台规则后，手动点击平台的发布按钮。"
        />
        <Typography.Paragraph
          className="section"
          ellipsis={{ rows: 4, expandable: true, symbol: '展开' }}
        >
          {content.selectedCopy}
        </Typography.Paragraph>
        <Checkbox.Group value={platforms} onChange={(values) => setPlatforms(values as string[])}>
          <Space direction="vertical">
            {Object.entries(platformLabels).map(([value, label]) => (
              <Checkbox value={value} key={value}>
                {label}
              </Checkbox>
            ))}
          </Space>
        </Checkbox.Group>
      </Modal>
    </>
  )
}
function CreatorStudio() {
  const [taskId, setTaskId] = useState('')
  const [platform, setPlatform] = useState('douyin')
  const [content, setContent] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<any>(null)
  const run = async (action: 'generate' | 'rewrite' | 'score' | 'publish-advice') => {
    if (!taskId) {
      message.warning('请输入已接受或创作中的任务 ID')
      return
    }
    if (action !== 'generate' && !content.trim()) {
      message.warning('请输入待处理内容')
      return
    }
    setBusy(true)
    try {
      const body: any = { creatorTaskId: taskId, sourceReference: crypto.randomUUID(), platform }
      if (action === 'generate') body.tone = '种草'
      else body.content = content
      const response = await api<any>(`/content/creator-studio/${action}`, {
        method: 'POST',
        body: JSON.stringify(body),
      })
      setResult(response)
      message.success(`已完成${response.action}，Campaign Credits 余额：${response.campaignCredits?.remaining ?? '—'}`)
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Creator Studio 操作失败')
    } finally {
      setBusy(false)
    }
  }
  return (
    <Card className="section" title="任务 AI Creator Studio" extra={<Tag color="processing">Campaign Credits</Tag>}>
      <Typography.Paragraph type="secondary">
        仅使用商户为任务分配的 Campaign Credits；生成、改写、评分和发布建议不会扣除个人 AI 余额。
      </Typography.Paragraph>
      <Space direction="vertical" style={{ width: '100%' }}>
        <Input value={taskId} onChange={(event) => setTaskId(event.target.value)} placeholder="Creator Task ID" />
        <Input value={platform} onChange={(event) => setPlatform(event.target.value)} placeholder="发布平台，例如 douyin" />
        <Input.TextArea value={content} onChange={(event) => setContent(event.target.value)} rows={4} placeholder="粘贴要改写、评分或获取发布建议的内容" />
        <Space wrap>
          <Button type="primary" loading={busy} onClick={() => run('generate')}>生成</Button>
          <Button loading={busy} onClick={() => run('rewrite')}>改写</Button>
          <Button loading={busy} onClick={() => run('score')}>评分</Button>
          <Button loading={busy} onClick={() => run('publish-advice')}>发布建议</Button>
        </Space>
        {result ? <Typography.Paragraph copyable={{ text: JSON.stringify(result.result) }}>{JSON.stringify(result.result)}</Typography.Paragraph> : null}
      </Space>
    </Card>
  )
}
function Contents() {
  const copywriting = useQuery({
    queryKey: ['copy-history'],
    queryFn: () => api<any>('/content/copywriting?page=1&pageSize=30'),
  })
  const videos = useQuery({
    queryKey: ['video-history'],
    queryFn: () => api<any>('/content/video?page=1&pageSize=30'),
  })
  const posters = useQuery({
    queryKey: ['poster-history'],
    queryFn: () => api<any>('/content/poster?page=1&pageSize=30'),
  })
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const create = async (v: {
    couponId?: string
    campaignId?: string
    platform: string
    tone?: string
  }) => {
    setBusy(true)
    try {
      await api('/content/copywriting/generate', {
        method: 'POST',
        body: JSON.stringify({ ...v, count: 3 }),
      })
      message.success('文案草稿已生成，前往文案历史选择并确认。')
      setOpen(false)
      copywriting.refetch()
    } catch (e) {
      message.error(e instanceof Error ? e.message : '生成失败')
    } finally {
      setBusy(false)
    }
  }
  const all = [
    ...(copywriting.data?.items ?? []).map((x: any) => ({ ...x, kind: '文案' })),
    ...(videos.data?.items ?? []).map((x: any) => ({ ...x, kind: '视频' })),
    ...(posters.data?.items ?? []).map((x: any) => ({ ...x, kind: '海报' })),
  ]
  return (
    <>
      <div className="heading">
        <div>
          <Typography.Title level={2}>AI 创作与分发</Typography.Title>
          <Typography.Text type="secondary">
            已确认的文案可交给发布助手打开平台发布页并预填；最终发布始终由你手动确认。
          </Typography.Text>
        </div>
        <Button type="primary" onClick={() => setOpen(true)}>
          生成推广文案
        </Button>
      </div>
      <Alert
        className="section"
        showIcon
        type="info"
        message="发布助手测试模式不会调用平台发布接口或点击发布按钮，仅将已确认文案送至发布页。"
      />
      <CreatorStudio />
      <Card className="section">
        <Table
          rowKey={(r) => `${r.kind}-${r.contentId ?? r.id}`}
          loading={copywriting.isLoading || videos.isLoading || posters.isLoading}
          dataSource={all}
          columns={[
            { title: '类型', dataIndex: 'kind' },
            { title: '平台', dataIndex: 'targetPlatform' },
            { title: '状态', render: (_, r: any) => <Tag>{r.jobStatus ?? r.status}</Tag> },
            {
              title: '追踪效果',
              render: (_, r: any) => `${r.totalClicks ?? 0} 点击 / ${r.totalClaims ?? 0} 领券`,
            },
            {
              title: '生成时间',
              dataIndex: 'createdAt',
              render: (v) => (v ? new Date(v).toLocaleString('zh-CN') : '—'),
            },
            {
              title: '分发',
              render: (_, r: any) =>
                r.kind === '文案' && r.status === 'published' && r.selectedCopy ? (
                  <PublishTestLauncher content={r} />
                ) : (
                  '确认文案后可用'
                ),
            },
          ]}
          locale={{ emptyText: '还没有创作内容。' }}
        />
      </Card>
      <Modal title="生成 AI 推广文案" open={open} footer={null} onCancel={() => setOpen(false)}>
        <Form layout="vertical" onFinish={create}>
          <Form.Item name="couponId" label="优惠券 ID">
            <Input placeholder="填写要推广的优惠券 ID" />
          </Form.Item>
          <Form.Item name="campaignId" label="活动 ID">
            <Input placeholder="可选" />
          </Form.Item>
          <Form.Item
            name="platform"
            label="发布平台"
            initialValue="wechat"
            rules={[{ required: true }]}
          >
            <Input />
          </Form.Item>
          <Form.Item name="tone" label="文案语气" initialValue="种草">
            <Input />
          </Form.Item>
          <Button block type="primary" htmlType="submit" loading={busy}>
            生成 3 条文案
          </Button>
        </Form>
      </Modal>
    </>
  )
}
function Income() {
  const wallet = useQuery({
    queryKey: ['agent-income-wallet'],
    queryFn: () => api<any>('/commission/wallet'),
  })
  const withdrawals = useQuery({
    queryKey: ['withdrawals'],
    queryFn: () => api<any>('/commission/withdrawals?page=1&pageSize=30'),
  })
  const [open, setOpen] = useState(false)
  const withdraw = async (v: { amount: number; accountNo: string; accountName: string }) => {
    try {
      await api('/commission/withdrawals', {
        method: 'POST',
        body: JSON.stringify({ ...v, method: 'wechatpay', idempotencyKey: crypto.randomUUID() }),
      })
      message.success('提现申请已提交')
      setOpen(false)
      withdrawals.refetch()
      wallet.refetch()
    } catch (e) {
      message.error(e instanceof Error ? e.message : '申请失败')
    }
  }
  return (
    <>
      <div className="heading">
        <div>
          <Typography.Title level={2}>佣金与提现</Typography.Title>
          <Typography.Text type="secondary">
            可提现余额 {money(wallet.data?.availableBalance)}，最低提现 ¥10。
          </Typography.Text>
        </div>
        <Button
          type="primary"
          disabled={Number(wallet.data?.availableBalance ?? 0) < 10}
          onClick={() => setOpen(true)}
        >
          申请提现
        </Button>
      </div>
      <Card>
        <Table
          rowKey="id"
          loading={withdrawals.isLoading}
          dataSource={withdrawals.data?.items ?? []}
          columns={[
            { title: '金额', dataIndex: 'amount', render: money },
            { title: '到账金额', dataIndex: 'actualAmount', render: money },
            { title: '状态', dataIndex: 'status', render: (v) => <Tag>{v}</Tag> },
            {
              title: '申请时间',
              dataIndex: 'createdAt',
              render: (v) => new Date(v).toLocaleString('zh-CN'),
            },
          ]}
          locale={{ emptyText: '暂无提现记录' }}
        />
      </Card>
      <Modal title="申请提现" open={open} footer={null} onCancel={() => setOpen(false)}>
        <Form layout="vertical" onFinish={withdraw}>
          <Form.Item name="amount" label="提现金额" rules={[{ required: true }]}>
            <Input type="number" min="10" />
          </Form.Item>
          <Form.Item name="accountName" label="收款人姓名" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="accountNo" label="微信 OpenID / 收款账号" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Button block type="primary" htmlType="submit">
            确认提交
          </Button>
        </Form>
      </Modal>
    </>
  )
}
function Platforms() {
  const accounts = useQuery({
    queryKey: ['platform-accounts'],
    queryFn: () => api<any>('/agent/platforms'),
  })
  const authorize = async (platformType: string) => {
    try {
      const result = await api<any>(
        `/agent/platforms/authorize?platformType=${platformType}&redirectUri=${encodeURIComponent(window.location.origin + '/oauth/callback')}`,
      )
      window.location.assign(result.authorizeUrl)
    } catch (e) {
      message.error(e instanceof Error ? e.message : '无法发起授权')
    }
  }
  const types = ['wechat', 'douyin', 'xiaohongshu', 'video_account', 'kuaishou']
  return (
    <>
      <div className="heading">
        <div>
          <Typography.Title level={2}>账号授权</Typography.Title>
          <Typography.Text type="secondary">
            授权账号后，已审核内容可以一键分发并持续回收推广效果。
          </Typography.Text>
        </div>
      </div>
      <Row gutter={[16, 16]}>
        {types.map((type) => {
          const bound = (accounts.data?.items ?? []).find(
            (x: any) => x.platformType === type && x.isActive,
          )
          return (
            <Col xs={24} sm={12} xl={8} key={type}>
              <Card title={type}>
                <Typography.Paragraph>
                  {bound ? `已绑定：${bound.platformNickname || '已授权账号'}` : '尚未授权'}
                </Typography.Paragraph>
                <Button type={bound ? 'default' : 'primary'} onClick={() => authorize(type)}>
                  {bound ? '重新授权' : '去授权'}
                </Button>
              </Card>
            </Col>
          )
        })}
      </Row>
    </>
  )
}
function Notifications() {
  const notifications = useQuery({
    queryKey: ['agent-notifications'],
    queryFn: () => api<any>('/notifications?page=1&pageSize=50'),
  })
  const markRead = async (id: string) => {
    try {
      await api(`/notifications/${id}/read`, { method: 'PATCH' })
      notifications.refetch()
    } catch (e) {
      message.error(e instanceof Error ? e.message : '操作失败')
    }
  }
  return (
    <>
      <div className="heading">
        <div>
          <Typography.Title level={2}>消息通知</Typography.Title>
          <Typography.Text type="secondary">
            账号审核、风控和内容审核结果会在这里留存。
          </Typography.Text>
        </div>
        <Tag color="processing">未读 {notifications.data?.unread ?? 0}</Tag>
      </div>
      <Card>
        <Table
          rowKey="id"
          loading={notifications.isLoading}
          dataSource={notifications.data?.items ?? []}
          columns={[
            { title: '标题', dataIndex: 'title' },
            { title: '内容', dataIndex: 'body' },
            {
              title: '时间',
              dataIndex: 'createdAt',
              render: (v) => new Date(v).toLocaleString('zh-CN'),
            },
            {
              title: '状态',
              render: (_, item: any) =>
                item.readAt ? (
                  <Tag>已读</Tag>
                ) : (
                  <Button type="link" onClick={() => markRead(item.id)}>
                    标记已读
                  </Button>
                ),
            },
          ]}
          locale={{ emptyText: '暂无通知' }}
        />
      </Card>
    </>
  )
}
