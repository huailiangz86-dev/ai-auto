import {
  AppstoreOutlined,
  BankOutlined,
  BellOutlined,
  BulbOutlined,
  LogoutOutlined,
  RocketOutlined,
  ShopOutlined,
  ShoppingOutlined,
  TeamOutlined,
  WalletOutlined,
} from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import {
  Alert,
  Button,
  Card,
  Col,
  Form,
  Input,
  Layout,
  Menu,
  Modal,
  Row,
  Select,
  Space,
  Spin,
  Statistic,
  Table,
  Tag,
  Typography,
  message,
} from 'antd'
import { useEffect, useState } from 'react'
import { api, clearSession, merchantAuthExpiredEvent, setSession, type Session } from './api'
import CouponMappings from './CouponMappings'
import CreatorMatching from './CreatorMatching'
import MarketingProducts from './MarketingProducts'

const { Header, Sider, Content } = Layout
const money = (value: number | undefined) =>
  new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' }).format(Number(value ?? 0))

import RoiReport from './RoiReport'
export default function App() {
  const [loggedIn, setLoggedIn] = useState(Boolean(localStorage.getItem('merchant_access_token')))
  useEffect(() => {
    const expireSession = () => setLoggedIn(false)
    window.addEventListener(merchantAuthExpiredEvent, expireSession)
    return () => window.removeEventListener(merchantAuthExpiredEvent, expireSession)
  }, [])
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
  const submit = async (value: {
    businessName: string
    phone: string
    password: string
    industryCategory?: string
  }) => {
    setBusy(true)
    try {
      const session = await api<Session>(
        registering ? '/auth/merchant/register' : '/auth/merchant/login',
        { method: 'POST', body: JSON.stringify(value) },
      )
      setSession(session)
      onAuthenticated()
    } catch (error) {
      message.error(error instanceof Error ? error.message : '登录失败')
    } finally {
      setBusy(false)
    }
  }
  return (
    <main className="auth-page">
      <Card className="auth-card">
        <Typography.Title level={2}>AI auto 商家后台</Typography.Title>
        <Typography.Paragraph type="secondary">
          创建活动、管理门店、招募分享员与查看每笔核销。
        </Typography.Paragraph>
        <Form layout="vertical" onFinish={submit}>
          <Form.Item
            hidden={!registering}
            name="businessName"
            label="商户名称"
            rules={registering ? [{ required: true, min: 2 }] : []}
          >
            <Input placeholder="例如：老王火锅望京店" />
          </Form.Item>
          <Form.Item
            name="phone"
            label="手机号"
            rules={[{ required: true, pattern: /^1[3-9]\d{9}$/, message: '请输入 11 位手机号' }]}
          >
            <Input placeholder="13800000000" />
          </Form.Item>
          <Form.Item
            name="password"
            label="密码"
            rules={[{ required: true, min: 8, message: '至少 8 位' }]}
          >
            <Input.Password />
          </Form.Item>
          <Form.Item hidden={!registering} name="industryCategory" label="行业">
            <Input placeholder="餐饮服务（可选）" />
          </Form.Item>
          <Button htmlType="submit" type="primary" size="large" block loading={busy}>
            {registering ? '提交入驻并进入后台' : '登录商家后台'}
          </Button>
        </Form>
        <Button type="link" block onClick={() => setRegistering(!registering)}>
          {registering ? '已有账户，立即登录' : '没有账户，申请入驻'}
        </Button>
      </Card>
    </main>
  )
}

function Portal({ onLogout }: { onLogout: () => void }) {
  const [page, setPage] = useState('overview')
  const items = [
    { key: 'overview', icon: <AppstoreOutlined />, label: '经营概览' },
    { key: 'growth-plans', icon: <RocketOutlined />, label: 'AI 增长计划' },
    {
      type: 'group' as const,
      label: '营销中心',
      children: [
        { key: 'campaigns', icon: <BulbOutlined />, label: '活动与优惠券' },
        { key: 'products', icon: <ShoppingOutlined />, label: '营销商品' },
      ],
    },
    { key: 'agents', icon: <TeamOutlined />, label: '分享员管理' },
    { key: 'stores', icon: <ShopOutlined />, label: '门店管理' },
    { key: 'wallet', icon: <WalletOutlined />, label: '佣金预算' },
    { key: 'notifications', icon: <BellOutlined />, label: '消息通知' },
    { key: 'roi-report', icon: <WalletOutlined />, label: 'ROI 与效果报告' },
  ]
  return (
    <Layout className="portal">
      <Sider breakpoint="lg" collapsedWidth="0" className="portal-sider">
        <div className="portal-brand">
          <BankOutlined /> AI auto
        </div>
        <Menu
          theme="dark"
          selectedKeys={[page]}
          onClick={({ key }) => setPage(String(key))}
          items={items}
        />
      </Sider>
      <Layout>
        <Header className="portal-header">
          <span>商家运营工作台</span>
          <Button type="text" icon={<LogoutOutlined />} onClick={onLogout}>
            退出
          </Button>
        </Header>
        <Content className="portal-content">
          {page === 'overview' && <Overview />}
          {page === 'growth-plans' && <GrowthPlans />}
          {page === 'roi-report' && <RoiReport />}
          {page === 'campaigns' && <Campaigns />}
          {page === 'products' && <MarketingProducts />}
          {page === 'agents' && <Agents />}
          {page === 'stores' && <Stores />}
          {page === 'wallet' && <Wallet />}
          {page === 'notifications' && <Notifications />}
        </Content>
      </Layout>
    </Layout>
  )
}

function Overview() {
  const profile = useQuery({
    queryKey: ['merchant-profile'],
    queryFn: () => api<any>('/merchant/profile'),
  })
  const wallet = useQuery({
    queryKey: ['merchant-wallet'],
    queryFn: () => api<any>('/merchant/wallet'),
  })
  const stats = useQuery({
    queryKey: ['merchant-stats'],
    queryFn: () => api<any>('/merchant/wallet/stats'),
  })
  if (profile.isLoading) return <Spin />
  if (profile.error) return <Alert type="error" message={(profile.error as Error).message} />
  return (
    <>
      <div className="heading">
        <div>
          <Typography.Title level={2}>{profile.data.businessName}</Typography.Title>
          <Typography.Text type="secondary">
            审核状态：
            <Tag color={profile.data.auditStatus === 'approved' ? 'success' : 'warning'}>
              {profile.data.auditStatus}
            </Tag>
          </Typography.Text>
        </div>
      </div>
      <Row gutter={[16, 16]}>
        <Metric
          title="可用佣金预算"
          value={wallet.data?.availableBalance ?? wallet.data?.balance}
        />
        <Metric title="冻结预算" value={wallet.data?.frozenBalance} />
        <Metric title="累计核销金额" value={stats.data?.totalGmv} />
        <Metric title="今日核销" value={stats.data?.todayRedemptions} plain />
      </Row>
      <Card title="订阅与下一步" className="section">
        <Typography.Paragraph>
          {profile.data.subscription
            ? `当前套餐：${profile.data.subscription.plan}，到期 ${new Date(profile.data.subscription.expiresAt).toLocaleDateString('zh-CN')}`
            : '尚未开通订阅，请在审核通过后购买套餐。'}
        </Typography.Paragraph>
        <Space>
          <Button type="primary">管理订阅</Button>
          <Button>查看操作指南</Button>
        </Space>
      </Card>
    </>
  )
}
function Metric({ title, value, plain }: { title: string; value?: number; plain?: boolean }) {
  return (
    <Col xs={24} sm={12} xl={6}>
      <Card>
        <Statistic title={title} value={plain ? Number(value ?? 0) : money(value)} />
      </Card>
    </Col>
  )
}

function Campaigns() {
  const campaigns = useQuery({
    queryKey: ['merchant-campaigns'],
    queryFn: () => api<any>('/merchant/campaigns?page=1&pageSize=30'),
  })
  const [open, setOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [mappingCampaignId, setMappingCampaignId] = useState<string | null>(null)
  const create = async (value: { description: string; maxBudget?: number }) => {
    setCreating(true)
    try {
      await api('/merchant/ai/campaigns', { method: 'POST', body: JSON.stringify(value) })
      message.success('AI 已创建并发布活动')
      setOpen(false)
      campaigns.refetch()
    } catch (e) {
      message.error(e instanceof Error ? e.message : '创建失败')
    } finally {
      setCreating(false)
    }
  }
  const items = campaigns.data?.items ?? campaigns.data ?? []
  return (
    <>
      <div className="heading">
        <div>
          <Typography.Title level={2}>活动与优惠券</Typography.Title>
          <Typography.Text type="secondary">
            用一句话创建活动，AI 会完成规则解析、优惠券和发布。
          </Typography.Text>
        </div>
        <Button type="primary" icon={<BulbOutlined />} onClick={() => setOpen(true)}>
          AI 创建活动
        </Button>
      </div>
      <Card>
        <Table
          rowKey={(item: any) => item.campaignId ?? item.id}
          loading={campaigns.isLoading}
          dataSource={items}
          columns={[
            { title: '活动名称', dataIndex: 'campaignName', render: (v, r: any) => v ?? r.name },
            { title: '状态', dataIndex: 'status', render: (v) => <Tag>{v}</Tag> },
            {
              title: '开始时间',
              dataIndex: 'startAt',
              render: (v) => (v ? new Date(v).toLocaleString('zh-CN') : '—'),
            },
            { title: '预算', dataIndex: 'budget', render: (v) => money(v) },
            {
              title: '商品映射',
              render: (_, item: any) => (
                <Button
                  type="link"
                  onClick={() => setMappingCampaignId(item.campaignId ?? item.id)}
                >
                  配置优惠券商品
                </Button>
              ),
            },
          ]}
          locale={{ emptyText: '还没有活动，试试让 AI 创建一个。' }}
        />
      </Card>
      <Modal title="AI 创建活动" open={open} footer={null} onCancel={() => setOpen(false)}>
        <Form layout="vertical" onFinish={create}>
          <Form.Item name="description" label="活动想法" rules={[{ required: true }]}>
            <Input.TextArea
              rows={5}
              placeholder="例如：为中秋到店新客做一周满 100 减 20 活动，佣金每单 8 元"
            />
          </Form.Item>
          <Form.Item name="maxBudget" label="最高佣金预算（元）">
            <Input type="number" />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={creating} block>
            生成并发布
          </Button>
        </Form>
      </Modal>
      <CouponMappings
        campaignId={mappingCampaignId}
        open={Boolean(mappingCampaignId)}
        onClose={() => setMappingCampaignId(null)}
      />
    </>
  )
}

function GrowthPlans() {
  const plans = useQuery({
    queryKey: ['growth-plans'],
    queryFn: () => api<any>('/merchant/growth-plans?page=1&pageSize=30'),
  })
  const [open, setOpen] = useState(false),
    [selected, setSelected] = useState<any>(null),
    [creating, setCreating] = useState(false),
    [approving, setApproving] = useState(false)
  const detail = useQuery({
    queryKey: ['growth-plan', selected?.planId],
    queryFn: () => api<any>(`/merchant/growth-plans/${selected.planId}`),
    enabled: Boolean(selected?.planId),
  })
  const create = async (values: any) => {
    setCreating(true)
    try {
      const body = {
        ...values,
        baselineValue: Number(values.baselineValue ?? 0),
        targetValue: Number(values.targetValue),
        budget: Number(values.budget),
        acceptableRoiBoundary: values.acceptableRoiBoundary
          ? Number(values.acceptableRoiBoundary)
          : undefined,
        startAt: new Date(values.startAt).toISOString(),
        endAt: new Date(values.endAt).toISOString(),
      }
      const plan = await api<any>('/merchant/growth-plans', {
        method: 'POST',
        body: JSON.stringify(body),
      })
      message.success('已生成 3 套可审阅增长方案')
      setOpen(false)
      setSelected(plan)
      plans.refetch()
    } catch (error) {
      message.error(error instanceof Error ? error.message : '生成失败')
    } finally {
      setCreating(false)
    }
  }
  const approve = async (optionId: number) => {
    if (!selected) return
    setApproving(true)
    try {
      const plan = await api<any>(`/merchant/growth-plans/${selected.planId}/approve`, {
        method: 'POST',
        body: JSON.stringify({ optionId }),
      })
      setSelected(plan)
      message.success('方案已批准，已创建关联活动草稿')
      plans.refetch()
    } catch (error) {
      message.error(error instanceof Error ? error.message : '批准失败')
    } finally {
      setApproving(false)
    }
  }
  const economics = useQuery({
    queryKey: ['growth-plan-economics', selected?.planId],
    queryFn: () => api<any>(`/merchant/growth-plans/${selected.planId}/economics`),
    enabled: Boolean(selected?.planId && (detail.data ?? selected)?.status === 'approved'),
  })
  const fund = async () => {
    if (!selected) return
    setApproving(true)
    try {
      await api<any>(`/merchant/growth-plans/${selected.planId}/fund`, {
        method: 'POST',
        body: JSON.stringify({ sourceReference: `merchant-dashboard-${Date.now()}` }),
      })
      message.success('资金已确认并冻结')
      economics.refetch()
      plans.refetch()
    } catch (error) {
      message.error(error instanceof Error ? error.message : '资金确认失败')
    } finally {
      setApproving(false)
    }
  }
  const plan = detail.data ?? selected
  return (
    <>
      <div className="heading">
        <div>
          <Typography.Title level={2}>AI 增长计划</Typography.Title>
          <Typography.Text type="secondary">
            先描述增长目标，查看 AI 的假设与结果区间，再明确批准后进入活动执行。
          </Typography.Text>
        </div>
        <Button type="primary" icon={<RocketOutlined />} onClick={() => setOpen(true)}>
          新建增长目标
        </Button>
      </div>
      <Card>
        <Table
          rowKey="planId"
          loading={plans.isLoading}
          dataSource={plans.data?.items ?? []}
          columns={[
            { title: '增长目标', dataIndex: ['growthTask', 'goalMetric'] },
            { title: '预算', dataIndex: ['growthTask', 'budget'], render: money },
            {
              title: '状态',
              dataIndex: 'status',
              render: (v) => (
                <Tag color={v === 'approved' ? 'success' : 'processing'}>
                  {v === 'approved' ? '已批准' : '待商户批准'}
                </Tag>
              ),
            },
            {
              title: '时间窗口',
              render: (_, r: any) =>
                r.growthTask
                  ? `${new Date(r.growthTask.startAt).toLocaleDateString('zh-CN')} 至 ${new Date(r.growthTask.endAt).toLocaleDateString('zh-CN')}`
                  : '—',
            },
            {
              title: '操作',
              render: (_, r: any) => (
                <Button type="link" onClick={() => setSelected(r)}>
                  查看方案
                </Button>
              ),
            },
          ]}
          locale={{ emptyText: '还没有增长计划，先告诉 AI 想增长什么。' }}
        />
      </Card>
      <Modal title="创建 AI 增长计划" open={open} footer={null} onCancel={() => setOpen(false)}>
        <Form
          layout="vertical"
          onFinish={create}
          initialValues={{ goalMetric: '新增到店核销数', baselineValue: 0 }}
        >
          <Form.Item
            name="goalBrief"
            label="你想增长什么？"
            rules={[{ required: true, message: '请用一句话描述目标与业务场景' }]}
          >
            <Input.TextArea
              rows={4}
              placeholder="例如：国庆前为望京门店新增 200 位到店核销新客，主推双人套餐"
            />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="goalMetric" label="核心指标" rules={[{ required: true }]}>
                <Select
                  options={['新增到店核销数', '新增订单数', '新增 GMV', '复购订单数'].map(
                    (value) => ({ value, label: value }),
                  )}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="budget" label="总预算（元）" rules={[{ required: true }]}>
                <Input type="number" min="1" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="baselineValue" label="当前基线">
                <Input type="number" min="0" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="targetValue" label="目标值" rules={[{ required: true }]}>
                <Input type="number" min="1" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="startAt" label="开始时间" rules={[{ required: true }]}>
                <Input type="datetime-local" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="endAt" label="结束时间" rules={[{ required: true }]}>
                <Input type="datetime-local" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="acceptableRoiBoundary" label="可接受最低 ROI（可选）">
            <Input type="number" min="0" step="0.01" />
          </Form.Item>
          <Form.Item name="acceptableRiskBoundary" label="风险边界（可选）">
            <Input placeholder="例如：不使用高频轰炸、不超出门店接待能力" />
          </Form.Item>
          <Button type="primary" htmlType="submit" block loading={creating}>
            生成可审阅方案
          </Button>
        </Form>
      </Modal>
      <Modal
        title={plan?.title ?? '增长计划'}
        open={Boolean(selected)}
        footer={null}
        onCancel={() => setSelected(null)}
        width={900}
      >
        {detail.isLoading ? (
          <Spin />
        ) : (
          plan && (
            <>
              <Alert
                type={plan.status === 'approved' ? 'success' : 'info'}
                showIcon
                message={
                  plan.status === 'approved'
                    ? '方案已批准，活动草稿已创建'
                    : '请选择一套方案。未批准前不会创建活动或发布创作者任务。'
                }
                description={plan.goalBrief}
              />
              {plan.status === 'approved' && (
                <>
                  <Card
                    className="section"
                    title="Campaign 资金与单位经济"
                    extra={
                      economics.data?.funding?.status === 'funded' ? (
                        <Tag color="success">资金已确认</Tag>
                      ) : (
                        <Button type="primary" loading={approving} onClick={fund}>
                          确认并冻结资金
                        </Button>
                      )
                    }
                  >
                    {economics.isLoading ? (
                      <Spin />
                    ) : economics.data ? (
                      <Row gutter={16}>
                        <Col span={8}>
                          <Statistic
                            title="已冻结预算"
                            value={economics.data.funding.frozenAmount ?? 0}
                            prefix="¥"
                          />
                        </Col>
                        <Col span={8}>
                          <Statistic
                            title="已花费"
                            value={economics.data.economics.spend ?? 0}
                            prefix="¥"
                          />
                        </Col>
                        <Col span={8}>
                          <Statistic title="ROI" value={economics.data.economics.roi ?? '—'} />
                        </Col>
                        <Col span={24} className="section">
                          <Space wrap>
                            {economics.data.funding.allocations.map((item: any) => (
                              <Tag key={item.category}>
                                {item.category}: ¥{item.committedAmount}
                              </Tag>
                            ))}
                          </Space>
                        </Col>
                      </Row>
                    ) : (
                      <Typography.Text type="secondary">
                        资金确认后可查看冻结金额、已花费与 ROI。
                      </Typography.Text>
                    )}
                  </Card>
                  {plan.growthTask && (
                    <CreatorMatching
                      growthTask={plan.growthTask}
                      funded={economics.data?.funding?.status === 'funded'}
                      onChanged={() => {
                        detail.refetch()
                        economics.refetch()
                        plans.refetch()
                      }}
                    />
                  )}
                </>
              )}
              {plan.alternatives?.map((option: any) => (
                <Card
                  key={option.optionId}
                  className="section"
                  title={`${option.optionId}. ${option.title}`}
                  extra={
                    plan.status === 'proposed' ? (
                      <Button
                        type="primary"
                        loading={approving}
                        onClick={() => approve(option.optionId)}
                      >
                        批准此方案
                      </Button>
                    ) : plan.selectedOptionId === option.optionId ? (
                      <Tag color="success">已选择</Tag>
                    ) : null
                  }
                >
                  <Row gutter={16}>
                    <Col span={8}>
                      <Typography.Text type="secondary">目标人群</Typography.Text>
                      <div>{option.targetAudience}</div>
                      <Typography.Text type="secondary">预算分配</Typography.Text>
                      <div>
                        创作者 ¥{option.budgetAllocation.creatorPayout} · Credits ¥
                        {option.budgetAllocation.campaignCredits} · 优惠 ¥
                        {option.budgetAllocation.offerCost}
                      </div>
                    </Col>
                    <Col span={8}>
                      <Typography.Text type="secondary">预期结果区间</Typography.Text>
                      <div>
                        {option.expectedOutcome.low} – {option.expectedOutcome.high}（最可能{' '}
                        {option.expectedOutcome.likely}）
                      </div>
                      <Typography.Text type="secondary">预估 ROI</Typography.Text>
                      <div>{option.expectedOutcome.expectedRoi}</div>
                    </Col>
                    <Col span={8}>
                      <Typography.Text type="secondary">创作者策略</Typography.Text>
                      <div>
                        {option.creatorStrategy.channels.join(' / ')} · 约{' '}
                        {option.creatorStrategy.recommendedCreatorCount} 人
                      </div>
                      <Typography.Paragraph type="secondary" className="section">
                        {option.creatorStrategy.rationale}
                      </Typography.Paragraph>
                    </Col>
                  </Row>
                  <Typography.Paragraph className="section">
                    <Typography.Text strong>关键假设：</Typography.Text>
                    {option.assumptions.join('；')}
                  </Typography.Paragraph>
                </Card>
              ))}
              {plan.growthTask?.workItems?.length > 0 && (
                <Card className="section" title="批准后待推进工作">
                  <Space wrap>
                    {plan.growthTask.workItems.map((item: any) => (
                      <Tag key={item.type}>{item.type}</Tag>
                    ))}
                  </Space>
                </Card>
              )}
            </>
          )
        )}
      </Modal>
    </>
  )
}

function Agents() {
  const agents = useQuery({
    queryKey: ['merchant-agents'],
    queryFn: () => api<any>('/merchant/agents?page=1&pageSize=50'),
  })
  const [invite, setInvite] = useState<any>(null)
  const createInvite = async () => {
    try {
      setInvite(await api('/merchant/agents/invites', { method: 'POST', body: '{}' }))
    } catch (e) {
      message.error(e instanceof Error ? e.message : '创建失败')
    }
  }
  const audit = async (id: string, result: string) => {
    try {
      await api(`/merchant/agents/${id}/audit`, {
        method: 'POST',
        body: JSON.stringify({ result }),
      })
      message.success('审核完成')
      agents.refetch()
    } catch (e) {
      message.error(e instanceof Error ? e.message : '操作失败')
    }
  }
  return (
    <>
      <div className="heading">
        <div>
          <Typography.Title level={2}>分享员管理</Typography.Title>
          <Typography.Text type="secondary">
            创建招募链接，审核申请，并维护合作关系。
          </Typography.Text>
        </div>
        <Button type="primary" onClick={createInvite}>
          创建招募链接
        </Button>
      </div>
      {invite && (
        <Alert
          className="section"
          type="success"
          showIcon
          message="招募链接已创建"
          description={
            <>
              <Typography.Paragraph copyable={{ text: invite.inviteLink }}>
                {invite.inviteLink}
              </Typography.Paragraph>
              <Typography.Text>
                邀请码：{invite.inviteCode}（有效期 {invite.expiresInDays} 天）
              </Typography.Text>
            </>
          }
        />
      )}
      <Card>
        <Table
          rowKey="bindingId"
          loading={agents.isLoading}
          dataSource={agents.data?.items ?? []}
          columns={[
            { title: '分享员', dataIndex: 'nickname' },
            { title: '手机号', dataIndex: 'phone' },
            { title: '绑定状态', dataIndex: 'bindingStatus', render: (v) => <Tag>{v}</Tag> },
            {
              title: '平台绑定',
              render: (_, r: any) =>
                `${r.douyinBind ? '抖音 ' : ''}${r.xiaohongshuBind ? '小红书 ' : ''}${r.wechatVideoBind ? '视频号' : ''}` ||
                '未绑定',
            },
            {
              title: '操作',
              render: (_, r: any) =>
                r.bindingStatus === 'registered' ? (
                  <Space>
                    <Button type="link" onClick={() => audit(r.bindingId, 'approved')}>
                      通过
                    </Button>
                    <Button danger type="link" onClick={() => audit(r.bindingId, 'rejected')}>
                      拒绝
                    </Button>
                  </Space>
                ) : (
                  '—'
                ),
            },
          ]}
          locale={{ emptyText: '暂无分享员，先创建招募链接。' }}
        />
      </Card>
    </>
  )
}

function Stores() {
  const stores = useQuery({
    queryKey: ['merchant-stores'],
    queryFn: () => api<any>('/merchant/stores?page=1&pageSize=50'),
  })
  return (
    <>
      <div className="heading">
        <div>
          <Typography.Title level={2}>门店管理</Typography.Title>
          <Typography.Text type="secondary">维护可核销门店与门店联系方式。</Typography.Text>
        </div>
      </div>
      <Card>
        <Table
          rowKey="storeId"
          loading={stores.isLoading}
          dataSource={stores.data?.items ?? []}
          columns={[
            { title: '门店名称', dataIndex: 'storeName' },
            { title: '地址', dataIndex: 'addressDetail' },
            {
              title: '状态',
              dataIndex: 'status',
              render: (v) => <Tag color={v ? 'success' : 'default'}>{v ? '营业中' : '已停用'}</Tag>,
            },
          ]}
        />
      </Card>
    </>
  )
}

function Wallet() {
  const wallet = useQuery({
    queryKey: ['merchant-wallet-detail'],
    queryFn: () => api<any>('/merchant/wallet'),
  })
  const transactions = useQuery({
    queryKey: ['merchant-wallet-transactions'],
    queryFn: () => api<any>('/merchant/wallet/transactions?page=1&pageSize=50'),
  })
  const [topupOpen, setTopupOpen] = useState(false)
  const topup = async (v: { amount: number }) => {
    try {
      await api('/merchant/wallet/topup', {
        method: 'POST',
        body: JSON.stringify({ ...v, method: 'wechatpay' }),
      })
      message.success('预算已充值')
      setTopupOpen(false)
      wallet.refetch()
      transactions.refetch()
    } catch (e) {
      message.error(e instanceof Error ? e.message : '充值失败')
    }
  }
  return (
    <>
      <div className="heading">
        <div>
          <Typography.Title level={2}>佣金预算</Typography.Title>
          <Typography.Text type="secondary">
            活动佣金从预算中冻结与结算，每一笔变化均可追溯。
          </Typography.Text>
        </div>
        <Button type="primary" onClick={() => setTopupOpen(true)}>
          充值预算
        </Button>
      </div>
      <Row gutter={16}>
        <Metric title="可用余额" value={wallet.data?.availableBalance ?? wallet.data?.balance} />
        <Metric title="冻结中" value={wallet.data?.frozenBalance} />
      </Row>
      <Card title="预算流水" className="section">
        <Table
          rowKey="id"
          loading={transactions.isLoading}
          dataSource={transactions.data?.items ?? []}
          columns={[
            { title: '类型', dataIndex: 'type' },
            { title: '金额', dataIndex: 'amount', render: money },
            { title: '说明', dataIndex: 'description' },
            {
              title: '时间',
              dataIndex: 'createdAt',
              render: (v) => new Date(v).toLocaleString('zh-CN'),
            },
          ]}
        />
      </Card>
      <Modal
        title="充值佣金预算"
        open={topupOpen}
        footer={null}
        onCancel={() => setTopupOpen(false)}
      >
        <Form layout="vertical" onFinish={topup}>
          <Form.Item name="amount" label="金额（元）" rules={[{ required: true }]}>
            <Input type="number" min="1" />
          </Form.Item>
          <Button block htmlType="submit" type="primary">
            确认充值
          </Button>
        </Form>
      </Modal>
    </>
  )
}

function Notifications() {
  const notifications = useQuery({
    queryKey: ['merchant-notifications'],
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
          <Typography.Text type="secondary">入驻审核、关联风控等结果会在这里留存。</Typography.Text>
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
