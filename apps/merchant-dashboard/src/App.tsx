import {
  AppstoreOutlined,
  BankOutlined,
  BellOutlined,
  BulbOutlined,
  CheckCircleOutlined,
  FundViewOutlined,
  FileProtectOutlined,
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
  Descriptions,
  Drawer,
  Form,
  Input,
  InputNumber,
  Layout,
  Menu,
  Modal,
  Row,
  QRCode,
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
import GrowthPlanIntake from './GrowthPlanIntake'
import ConversionCenter from './ConversionCenter'

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
  const [appealDetailId, setAppealDetailId] = useState<string | null>(null)
  const openNotificationTarget = (item: any) => {
    if (item.targetType === 'creator_task_appeal' && item.targetId) {
      setAppealDetailId(item.targetId)
      setPage('appeals')
      return
    }
    if (item.targetType === 'creator_task' || item.targetType === 'creator_task_payout') {
      setPage('appeals')
      message.info('已打开申诉中心，可查看该任务关联的结算与申诉记录。')
      return
    }
    message.info('该通知暂无可查看的业务详情。')
  }
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
    { key: 'conversion-center', icon: <FundViewOutlined />, label: '内容与转化中心' },
    { key: 'stores', icon: <ShopOutlined />, label: '门店管理' },
    { key: 'wallet', icon: <WalletOutlined />, label: '佣金预算' },
    { key: 'appeals', icon: <FileProtectOutlined />, label: '申诉中心' },
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
          {page === 'conversion-center' && <ConversionCenter />}
          {page === 'stores' && <Stores />}
          {page === 'wallet' && <Wallet />}
          {page === 'appeals' && (
            <Appeals
              initialAppealId={appealDetailId}
              onDetailOpened={() => setAppealDetailId(null)}
            />
          )}
          {page === 'notifications' && <Notifications onOpenTarget={openNotificationTarget} />}
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
  if (profile.error) return <Alert type="error" message={profile.error.message} />
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
  const [previewing, setPreviewing] = useState(false)
  const [creating, setCreating] = useState(false)
  const [preview, setPreview] = useState<any>(null)
  const [request, setRequest] = useState<{ description: string; maxBudget?: number } | null>(null)
  const [mappingCampaignId, setMappingCampaignId] = useState<string | null>(null)
  const previewCampaign = async (value: { description: string; maxBudget?: number }) => {
    setPreviewing(true)
    setRequest(value)
    try {
      setPreview(
        await api('/merchant/ai/campaigns/preview', {
          method: 'POST',
          body: JSON.stringify(value),
        }),
      )
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'AI 解析失败')
    } finally {
      setPreviewing(false)
    }
  }
  const create = async (option: any) => {
    if (!request) return
    setCreating(true)
    try {
      const result = await api<any>('/merchant/ai/campaigns', {
        method: 'POST',
        body: JSON.stringify({ ...request, selectedOption: option, autoPublish: false }),
      })
      message.success('AI 已生成活动草稿，完成测量预登记后即可发布')
      setOpen(false)
      setPreview(null)
      setRequest(null)
      void campaigns.refetch()
      return result
    } catch (e) {
      message.error(e instanceof Error ? e.message : '创建失败')
    } finally {
      setCreating(false)
    }
  }
  const closeCreate = () => {
    if (previewing || creating) return
    setOpen(false)
    setPreview(null)
    setRequest(null)
  }
  const items = campaigns.data?.items ?? campaigns.data ?? []
  return (
    <>
      <div className="heading">
        <div>
          <Typography.Title level={2}>活动与优惠券</Typography.Title>
          <Typography.Text type="secondary">
            普通客户活动用于领券和核销；达人内容任务用于发布图文/短视频并追踪引流。确认后先保存为草稿，完成测量预登记后再发布。
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
            {
              title: '执行目的',
              dataIndex: 'purpose',
              render: (value) => (
                <Tag color={value === 'creator_content' ? 'purple' : 'blue'}>
                  {campaignPurposeLabel(value)}
                </Tag>
              ),
            },
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
                  {item.purpose === 'creator_content' ? '配置转化券商品' : '配置优惠券商品'}
                </Button>
              ),
            },
          ]}
          locale={{ emptyText: '还没有活动，试试让 AI 创建一个。' }}
        />
      </Card>
      <Modal
        title={preview ? '确认 AI 活动方案' : 'AI 创建活动'}
        open={open}
        footer={null}
        onCancel={closeCreate}
        width={760}
        destroyOnClose
      >
        {!preview ? (
          <Form layout="vertical" onFinish={previewCampaign}>
            <Form.Item name="description" label="活动想法" rules={[{ required: true }]}>
              <Input.TextArea
                rows={5}
                placeholder="例如：为中秋到店新客做一周满 100 减 20 活动，佣金每单 8 元"
              />
            </Form.Item>
            <Form.Item name="maxBudget" label="最高预算（元）">
              <InputNumber min={0} precision={2} className="full-width" />
            </Form.Item>
            <Button type="primary" htmlType="submit" loading={previewing} block>
              生成 3 套方案
            </Button>
          </Form>
        ) : (
          <div className="ai-campaign-preview">
            <Typography.Paragraph type="secondary">
              AI 已理解“{preview.description}
              ”。请选择方案；达人任务会同时生成内容执行要求和活动转化券，达人通过专属入口引导用户领取。
            </Typography.Paragraph>
            {preview.source === 'fallback' && (
              <Alert
                className="section"
                type="warning"
                showIcon
                message="AI 暂时不可用，以下为关键词降级方案"
              />
            )}
            {(preview.options ?? []).map((option: any) => (
              <Card
                key={option.planId ?? option.optionId}
                className="section"
                size="small"
                title={option.title}
                extra={option.confidence != null ? <Tag>置信度 {option.confidence}</Tag> : null}
              >
                <Descriptions
                  size="small"
                  column={2}
                  items={[
                    {
                      label: '执行目的',
                      children: (
                        <Tag color={option.taskType === 'creator_content' ? 'purple' : 'blue'}>
                          {campaignPurposeLabel(option.taskType)}
                        </Tag>
                      ),
                    },
                    { label: '活动类型', children: campaignTypeLabel(option.campaignType) },
                    { label: '目标人群', children: option.targetAudience || '全部人群' },
                    {
                      label: '优惠规则',
                      children: formatOffer(option),
                    },
                    ...(option.taskType === 'creator_content'
                      ? [
                          {
                            label: '内容交付',
                            children: `${(option.contentTypes ?? []).join(' / ') || '图文或短视频'}；${(option.channels ?? []).join(' / ') || '待匹配渠道'}`,
                          },
                          {
                            label: '引导动作',
                            children: option.callToAction || '通过专属链接引导用户到店',
                          },
                        ]
                      : []),
                    {
                      label: option.startAt && option.endAt ? '活动时间' : '有效期',
                      children: formatValidity(option),
                    },
                    {
                      label: '预算',
                      children:
                        option.estimatedBudget == null
                          ? '按商家预算'
                          : money(option.estimatedBudget),
                    },
                    {
                      label: '分享员佣金',
                      children:
                        option.agentRewardAmount == null
                          ? '待确认'
                          : money(option.agentRewardAmount),
                    },
                  ]}
                />
                {option.explanation && (
                  <Typography.Paragraph type="secondary" className="section">
                    {option.explanation}
                  </Typography.Paragraph>
                )}
                <Button
                  type="primary"
                  icon={<CheckCircleOutlined />}
                  loading={creating}
                  onClick={() => void create(option)}
                  block
                >
                  使用此方案创建草稿
                </Button>
              </Card>
            ))}
            <Button onClick={() => setPreview(null)} disabled={creating} block>
              返回修改活动描述
            </Button>
          </div>
        )}
      </Modal>
      <CouponMappings
        campaignId={mappingCampaignId}
        open={Boolean(mappingCampaignId)}
        onClose={() => setMappingCampaignId(null)}
      />
    </>
  )
}

function campaignTypeLabel(value: string | undefined) {
  if (value === 'cash_reward') return '现金奖励'
  if (value === 'combo') return '组合套餐'
  return '满减优惠'
}

function campaignPurposeLabel(value: string | undefined) {
  return value === 'creator_content' ? '达人内容引流任务' : '普通客户优惠活动'
}

function formatOffer(option: any) {
  if (option.taskType === 'creator_content') return '活动转化券（由内容专属入口领取）'
  if (option.campaignType === 'cash_reward')
    return option.cashRewardAmount == null ? '现金奖励' : `返现 ¥${option.cashRewardAmount}`
  if (option.campaignType === 'combo') {
    const offerPrice = option.offerPrice ?? option.discountAmount
    if (offerPrice == null) return '组合套餐券'
    return option.originalPrice == null
      ? `套餐价 ¥${offerPrice}`
      : `套餐价 ¥${offerPrice}（原价 ¥${option.originalPrice}）`
  }
  const threshold = option.thresholdAmount ?? 0
  const discount = option.discountAmount ?? 0
  return threshold > 0 ? `满 ¥${threshold} 减 ¥${discount}` : `立减 ¥${discount}`
}

function formatValidity(option: any) {
  if (option.startAt && option.endAt) {
    const start = new Date(option.startAt)
    const end = new Date(option.endAt)
    if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
      return `${start.toLocaleDateString('zh-CN')} 至 ${end.toLocaleDateString('zh-CN')}`
    }
  }
  return option.couponValidityDays ? `${option.couponValidityDays} 天` : '按活动时间'
}

function GrowthPlans() {
  const plans = useQuery({
    queryKey: ['growth-plans'],
    queryFn: () => api<any>('/merchant/growth-plans?page=1&pageSize=30'),
  })
  const [open, setOpen] = useState(false),
    [selected, setSelected] = useState<any>(null),
    [approving, setApproving] = useState(false),
    [mappingCampaignId, setMappingCampaignId] = useState<string | null>(null)
  const detail = useQuery({
    queryKey: ['growth-plan', selected?.planId],
    queryFn: () => api<any>(`/merchant/growth-plans/${selected.planId}`),
    enabled: Boolean(selected?.planId),
  })
  // The detail query can still contain the pre-approval response after the
  // merchant approves the same plan. Prefer the newly returned approval result
  // until the detail query has caught up, otherwise the linked asset section
  // would remain hidden behind stale `status: proposed` data.
  const plan =
    detail.data?.planId === selected?.planId && detail.data?.status === selected?.status
      ? detail.data
      : (selected ?? detail.data)
  const linkedCampaign = useQuery({
    queryKey: ['growth-plan-campaign', plan?.campaignId],
    queryFn: () => api<any>(`/merchant/campaigns/${plan.campaignId}`),
    enabled: Boolean(plan?.campaignId),
  })
  const approve = async (optionId: number) => {
    if (!selected) return
    setApproving(true)
    try {
      const approvedPlan = await api<any>(`/merchant/growth-plans/${selected.planId}/approve`, {
        method: 'POST',
        body: JSON.stringify({ optionId }),
      })
      await plans.refetch()
      setSelected(approvedPlan)
      await detail.refetch()
      message.success(
        approvedPlan?.taskType === 'creator_content'
          ? '方案已批准，已创建内容执行活动草稿，可继续匹配达人'
          : '方案已批准，已创建并关联活动与优惠券草稿',
      )
    } catch (error) {
      message.error(error instanceof Error ? error.message : '批准失败')
    } finally {
      setApproving(false)
    }
  }
  const economics = useQuery({
    queryKey: ['growth-plan-economics', selected?.planId],
    queryFn: () => api<any>(`/merchant/growth-plans/${selected.planId}/economics`),
    enabled: Boolean(selected?.planId && plan?.status === 'approved'),
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
      void economics.refetch()
      void plans.refetch()
    } catch (error) {
      message.error(error instanceof Error ? error.message : '资金确认失败')
    } finally {
      setApproving(false)
    }
  }
  const linkedCampaignName =
    plan?.linkedAssets?.campaign?.campaignName ?? linkedCampaign.data?.campaignName
  const linkedCouponId =
    plan?.couponId ??
    plan?.linkedAssets?.coupon?.couponId ??
    linkedCampaign.data?.coupons?.[0]?.couponId ??
    null
  const linkedCoupon =
    plan?.linkedAssets?.coupon ??
    linkedCampaign.data?.coupons?.find((coupon: any) => coupon.couponId === linkedCouponId)
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
            {
              title: '执行类型',
              dataIndex: 'taskTypeLabel',
              render: (value, row: any) => (
                <Tag color={row.taskType === 'creator_content' ? 'purple' : 'blue'}>
                  {value ||
                    (row.taskType === 'creator_content' ? '达人内容引流任务' : '客户优惠活动')}
                </Tag>
              ),
            },
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
              title: '已选方案',
              render: (_, r: any) => {
                const option = r.alternatives?.find(
                  (item: any) => item.optionId === r.selectedOptionId,
                )
                return option ? (
                  <Tag color="success">
                    方案 {option.optionId} · {option.title}
                  </Tag>
                ) : (
                  <Typography.Text type="secondary">未选择</Typography.Text>
                )
              },
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
      <GrowthPlanIntake
        open={open}
        onClose={() => setOpen(false)}
        onCreated={(plan) => {
          setOpen(false)
          setSelected(plan)
          void plans.refetch()
        }}
      />
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
                  <Card className="section" title="已关联营销执行资产">
                    <Descriptions
                      size="small"
                      column={2}
                      items={[
                        {
                          label: '活动',
                          children: linkedCampaignName
                            ? `${linkedCampaignName}（${plan.campaignId}）`
                            : plan.campaignId || '加载中…',
                        },
                        ...(plan.taskType === 'creator_content'
                          ? [
                              {
                                label: '内容 Brief',
                                children:
                                  plan.growthTask?.contentBrief ||
                                  '批准后由商家在达人邀约时确认内容要求',
                              },
                              {
                                label: '交付与渠道',
                                children: `${(plan.growthTask?.creatorDeliverables?.contentTypes ?? []).join(' / ') || '图文 / 短视频'}；${(plan.growthTask?.creatorDeliverables?.channels ?? []).join(' / ') || '待匹配渠道'}`,
                              },
                              {
                                label: '引流 CTA',
                                children:
                                  plan.growthTask?.creatorDeliverables?.callToAction ||
                                  '通过专属链接引导用户到店',
                              },
                            ]
                          : [
                              {
                                label: '优惠券',
                                children: linkedCoupon?.couponName
                                  ? `${linkedCoupon.couponName}（${linkedCouponId}）`
                                  : linkedCouponId || '正在同步…',
                              },
                            ]),
                      ]}
                    />
                    <Typography.Paragraph type="secondary" className="section">
                      {plan.taskType === 'creator_content'
                        ? '这是达人内容执行活动：商家通过 Brief、渠道和专属引流链路验收内容与带来的客户；用户通过内容入口领取活动转化券。'
                        : 'AI 增长计划只生成活动与优惠券规则；营销商品沿用商品目录，通过优惠券关联，避免重复创建商品。'}
                    </Typography.Paragraph>
                    <Button
                      type="primary"
                      disabled={!plan.campaignId}
                      onClick={() => setMappingCampaignId(plan.campaignId)}
                    >
                      关联营销商品
                    </Button>
                  </Card>
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
                  {plan.taskType === 'creator_content' && plan.growthTask && (
                    <CreatorMatching
                      growthTask={plan.growthTask}
                      funded={economics.data?.funding?.status === 'funded'}
                      onChanged={() => {
                        void detail.refetch()
                        void economics.refetch()
                        void plans.refetch()
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
                      {option.taskType === 'creator_content' && (
                        <>
                          <Typography.Text type="secondary">内容 Brief</Typography.Text>
                          <Typography.Paragraph ellipsis={{ rows: 3 }}>
                            {option.contentBrief ||
                              '按目标生成图文 / 短视频内容并通过专属链接引流。'}
                          </Typography.Paragraph>
                        </>
                      )}
                      <Typography.Text type="secondary">预算分配</Typography.Text>
                      <div>
                        达人报酬 ¥{option.budgetAllocation.creatorPayout} · Credits ¥
                        {option.budgetAllocation.campaignCredits} · 优惠成本 ¥
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
      <CouponMappings
        campaignId={mappingCampaignId}
        open={Boolean(mappingCampaignId)}
        onClose={() => setMappingCampaignId(null)}
      />
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
      void agents.refetch()
    } catch (e) {
      message.error(e instanceof Error ? e.message : '操作失败')
    }
  }
  return (
    <>
      <div className="heading">
        <div>
          <Typography.Title level={2}>达人与分享员合作</Typography.Title>
          <Typography.Text type="secondary">
            创建招募链接，审核申请，并查看合作范围、达人任务交付和引流结果。
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
          expandable={{
            expandedRowRender: (record: any) => (
              <Card size="small" title="达人内容任务明细">
                {record.creatorTaskStats?.tasks?.length ? (
                  <Table
                    rowKey="creatorTaskId"
                    size="small"
                    pagination={false}
                    dataSource={record.creatorTaskStats.tasks}
                    columns={[
                      { title: '任务', dataIndex: 'taskTitle' },
                      { title: '渠道', dataIndex: 'channel' },
                      { title: '内容形式', dataIndex: 'contentType' },
                      { title: '状态', dataIndex: 'status', render: (value) => <Tag>{value}</Tag> },
                      {
                        title: '发布链接',
                        dataIndex: 'publishedUrl',
                        render: (value) =>
                          value ? <Typography.Text copyable>{value}</Typography.Text> : '—',
                      },
                    ]}
                  />
                ) : (
                  <Typography.Text type="secondary">暂无达人内容任务</Typography.Text>
                )}
              </Card>
            ),
            rowExpandable: (record: any) => Boolean(record.creatorTaskStats?.total),
          }}
          loading={agents.isLoading}
          dataSource={agents.data?.items ?? []}
          columns={[
            { title: '分享员', dataIndex: 'nickname' },
            {
              title: '人员类型',
              dataIndex: 'agentType',
              render: (value) =>
                value === 'professional_creator' ? (
                  <Tag color="purple">专业达人</Tag>
                ) : (
                  <Tag>普通分享员</Tag>
                ),
            },
            { title: '手机号', dataIndex: 'phone' },
            {
              title: '合作范围',
              render: (_, record: any) =>
                record.relationship?.scope === 'store' ? `指定门店：${record.storeId}` : '全部门店',
            },
            { title: '绑定状态', dataIndex: 'bindingStatus', render: (v) => <Tag>{v}</Tag> },
            {
              title: '内容任务 / 引流',
              render: (_, record: any) => {
                const stats = record.creatorTaskStats ?? {}
                return (
                  <Space direction="vertical" size={0}>
                    <span>
                      {stats.total ?? 0} 个任务 · 已发布 {stats.published ?? 0}
                    </span>
                    <Typography.Text type="secondary">
                      引流客户 {stats.attributedCustomers ?? 0} · 核销{' '}
                      {stats.attributedRedemptions ?? 0}
                    </Typography.Text>
                  </Space>
                )
              },
            },
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
  type StoreStatus = 'active' | 'inactive'
  interface MerchantStore {
    storeId: string
    storeName: string
    storeCode?: string | null
    province?: string | null
    city?: string | null
    district?: string | null
    addressDetail?: string | null
    address?: string | null
    latitude?: number | null
    longitude?: number | null
    contactPhone?: string | null
    businessHours?: string | null
    status: StoreStatus
    agentCount?: number
  }
  interface StoreFormValues {
    storeName: string
    storeCode?: string
    province?: string
    city?: string
    district?: string
    addressDetail?: string
    latitude?: number
    longitude?: number
    contactPhone?: string
    businessHours?: string
  }

  const [form] = Form.useForm<StoreFormValues>()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<MerchantStore | null>(null)
  const [saving, setSaving] = useState(false)
  const [actionStoreId, setActionStoreId] = useState<string | null>(null)
  const stores = useQuery({
    queryKey: ['merchant-stores'],
    queryFn: () => api<{ items: MerchantStore[] }>('/merchant/stores?page=1&pageSize=50'),
  })

  const edit = (store?: MerchantStore) => {
    setEditing(store ?? null)
    form.resetFields()
    form.setFieldsValue(
      store
        ? {
            storeName: store.storeName,
            storeCode: store.storeCode ?? undefined,
            province: store.province ?? undefined,
            city: store.city ?? undefined,
            district: store.district ?? undefined,
            addressDetail: store.addressDetail ?? undefined,
            latitude: store.latitude ?? undefined,
            longitude: store.longitude ?? undefined,
            contactPhone: store.contactPhone ?? undefined,
            businessHours: store.businessHours ?? undefined,
          }
        : { businessHours: '09:00-22:00' },
    )
    setOpen(true)
  }

  const save = async (values: StoreFormValues) => {
    setSaving(true)
    try {
      await api(editing ? `/merchant/stores/${editing.storeId}` : '/merchant/stores', {
        method: editing ? 'PUT' : 'POST',
        body: JSON.stringify({
          ...values,
          storeCode: values.storeCode?.trim() || undefined,
          province: values.province?.trim() || undefined,
          city: values.city?.trim() || undefined,
          district: values.district?.trim() || undefined,
          addressDetail: values.addressDetail?.trim() || undefined,
          contactPhone: values.contactPhone?.trim() || undefined,
          businessHours: values.businessHours?.trim() || undefined,
        }),
      })
      message.success(editing ? '门店已更新' : '门店已创建')
      setOpen(false)
      setEditing(null)
      form.resetFields()
      void stores.refetch()
    } catch (error) {
      message.error(error instanceof Error ? error.message : '保存门店失败')
    } finally {
      setSaving(false)
    }
  }

  const changeStatus = async (store: MerchantStore) => {
    const isActive = store.status === 'active'
    setActionStoreId(store.storeId)
    try {
      await api(`/merchant/stores/${store.storeId}`, {
        method: 'PUT',
        body: JSON.stringify({ status: !isActive }),
      })
      message.success(isActive ? '门店已停用' : '门店已启用')
      void stores.refetch()
    } catch (error) {
      message.error(error instanceof Error ? error.message : '更新门店状态失败')
    } finally {
      setActionStoreId(null)
    }
  }

  const remove = (store: MerchantStore) => {
    Modal.confirm({
      title: `删除“${store.storeName}”？`,
      content: '删除后不可恢复。若门店已有核销记录，系统会拒绝删除，请改为停用。',
      okText: '确认删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        setActionStoreId(store.storeId)
        try {
          await api(`/merchant/stores/${store.storeId}`, { method: 'DELETE' })
          message.success('门店已删除')
          await stores.refetch()
        } catch (error) {
          message.error(error instanceof Error ? error.message : '删除门店失败')
          throw error
        } finally {
          setActionStoreId(null)
        }
      },
    })
  }

  return (
    <>
      <div className="heading">
        <div>
          <Typography.Title level={2}>门店管理</Typography.Title>
          <Typography.Text type="secondary">维护可核销门店与门店联系方式。</Typography.Text>
        </div>
        <Button type="primary" onClick={() => edit()}>
          新建门店
        </Button>
      </div>
      <Card>
        <Table
          rowKey="storeId"
          loading={stores.isLoading}
          dataSource={stores.data?.items ?? []}
          pagination={false}
          columns={[
            {
              title: '门店名称',
              dataIndex: 'storeName',
              render: (name: string, store: MerchantStore) => (
                <>
                  <Typography.Text strong>{name}</Typography.Text>
                  {store.storeCode && (
                    <>
                      <br />
                      <Typography.Text type="secondary">编号：{store.storeCode}</Typography.Text>
                    </>
                  )}
                </>
              ),
            },
            {
              title: '地址与联系信息',
              render: (_: unknown, store: MerchantStore) => (
                <>
                  <div>{store.address || store.addressDetail || '暂未填写地址'}</div>
                  <Typography.Text type="secondary">
                    {[store.contactPhone, store.businessHours].filter(Boolean).join(' · ') ||
                      '暂未填写联系方式或营业时间'}
                  </Typography.Text>
                </>
              ),
            },
            { title: '分享员', dataIndex: 'agentCount', render: (count?: number) => count ?? 0 },
            {
              title: '状态',
              dataIndex: 'status',
              render: (status: StoreStatus) => (
                <Tag color={status === 'active' ? 'success' : 'default'}>
                  {status === 'active' ? '营业中' : '已停用'}
                </Tag>
              ),
            },
            {
              title: '操作',
              render: (_: unknown, store: MerchantStore) => {
                const active = store.status === 'active'
                const acting = actionStoreId === store.storeId
                return (
                  <Space>
                    <Button type="link" onClick={() => edit(store)} disabled={acting}>
                      编辑
                    </Button>
                    <Button type="link" onClick={() => void changeStatus(store)} loading={acting}>
                      {active ? '停用' : '启用'}
                    </Button>
                    <Button danger type="link" onClick={() => remove(store)} disabled={acting}>
                      删除
                    </Button>
                  </Space>
                )
              },
            },
          ]}
          locale={{ emptyText: '还没有门店，先新建一个可核销门店。' }}
        />
      </Card>
      <Modal
        title={editing ? '编辑门店' : '新建门店'}
        open={open}
        footer={null}
        onCancel={() => {
          if (saving) return
          setOpen(false)
          setEditing(null)
          form.resetFields()
        }}
        destroyOnClose
      >
        <Form<StoreFormValues> layout="vertical" form={form} onFinish={save}>
          <Form.Item
            name="storeName"
            label="门店名称"
            rules={[{ required: true, message: '请填写门店名称' }]}
          >
            <Input maxLength={200} placeholder="例如：望京 SOHO 店" />
          </Form.Item>
          <Form.Item name="storeCode" label="门店编号">
            <Input maxLength={50} placeholder="可选，便于内部识别" />
          </Form.Item>
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item name="province" label="省 / 直辖市">
                <Input maxLength={50} placeholder="北京市" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="city" label="城市">
                <Input maxLength={50} placeholder="北京市" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="district" label="区县">
                <Input maxLength={50} placeholder="朝阳区" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="addressDetail" label="详细地址">
            <Input maxLength={500} placeholder="例如：望京街 1 号 A 座 101" />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="contactPhone" label="联系电话">
                <Input maxLength={20} placeholder="门店电话或负责人电话" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="businessHours" label="营业时间">
                <Input maxLength={200} placeholder="09:00-22:00" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="latitude" label="纬度">
                <InputNumber precision={6} className="full-width" placeholder="39.984000" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="longitude" label="经度">
                <InputNumber precision={6} className="full-width" placeholder="116.472000" />
              </Form.Item>
            </Col>
          </Row>
          <Button type="primary" htmlType="submit" loading={saving} block>
            {editing ? '保存修改' : '创建门店'}
          </Button>
        </Form>
      </Modal>
    </>
  )
}

function Wallet() {
  interface WalletCheckout {
    orderNo: string
    amount: number
    provider: 'wechatpay' | 'alipay'
    expiresAt: string
    payUrl?: string
    codeUrl?: string
  }
  interface WalletTopupOrder {
    status: 'pending' | 'paid' | 'failed' | 'closed'
    orderNo: string
    amount: number
    provider: 'wechatpay' | 'alipay'
  }
  const wallet = useQuery({
    queryKey: ['merchant-wallet-detail'],
    queryFn: () => api<any>('/merchant/wallet'),
  })
  const transactions = useQuery({
    queryKey: ['merchant-wallet-transactions'],
    queryFn: () => api<any>('/merchant/wallet/transactions?page=1&pageSize=50'),
  })
  const [topupOpen, setTopupOpen] = useState(false)
  const [checkout, setCheckout] = useState<WalletCheckout | null>(null)
  const topupOrder = useQuery({
    queryKey: ['merchant-wallet-topup-order', checkout?.orderNo],
    queryFn: () => api<WalletTopupOrder>(`/merchant/wallet/topup/orders/${checkout?.orderNo}`),
    enabled: Boolean(checkout?.orderNo),
    refetchInterval: (query) => {
      const status = query.state.data?.status
      return status === 'paid' || status === 'failed' || status === 'closed' ? false : 2000
    },
  })
  const topupStatus = topupOrder.data?.status
  useEffect(() => {
    if (topupStatus === 'paid') {
      message.success('支付成功，预算已入账')
      setTopupOpen(false)
      setCheckout(null)
      void wallet.refetch()
      void transactions.refetch()
    } else if (topupStatus === 'failed' || topupStatus === 'closed') {
      message.error(topupStatus === 'closed' ? '充值订单已过期，请重新下单' : '充值支付失败')
    }
  }, [topupStatus])

  const closeTopup = () => {
    setTopupOpen(false)
    setCheckout(null)
  }

  const topup = async (v: { amount: number; provider: 'wechatpay' | 'alipay' }) => {
    try {
      const created = await api<WalletCheckout>('/merchant/wallet/topup/checkout', {
        method: 'POST',
        body: JSON.stringify(v),
      })
      setCheckout(created)
      if (created.payUrl) {
        const paymentWindow = window.open(created.payUrl, '_blank', 'noopener,noreferrer')
        if (!paymentWindow) message.info('支付宝收银台已生成，请允许浏览器打开新窗口')
      }
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
        title={checkout ? '完成充值支付' : '充值佣金预算'}
        open={topupOpen}
        footer={null}
        onCancel={closeTopup}
      >
        {checkout ? (
          <Space direction="vertical" size="middle" className="full-width" align="center">
            <Alert
              type="info"
              showIcon
              message={`待支付 ${money(checkout.amount)}`}
              description={
                checkout.provider === 'alipay'
                  ? '支付宝收银台已在新窗口打开，请完成支付后等待本页自动确认。'
                  : '请使用微信扫描二维码完成支付，支付成功后预算会自动入账。'
              }
            />
            {checkout.codeUrl ? (
              <QRCode value={checkout.codeUrl} size={220} />
            ) : checkout.payUrl ? (
              <Button onClick={() => window.open(checkout.payUrl, '_blank', 'noopener,noreferrer')}>
                重新打开支付宝收银台
              </Button>
            ) : null}
            <Typography.Text type="secondary">
              订单号：{checkout.orderNo} ·{' '}
              {topupOrder.isLoading
                ? '正在查询支付状态…'
                : topupStatus === 'pending'
                  ? '等待支付'
                  : topupStatus === 'paid'
                    ? '支付成功'
                    : '订单已失效'}
            </Typography.Text>
            <Button onClick={closeTopup}>关闭</Button>
          </Space>
        ) : (
          <Form layout="vertical" onFinish={topup} initialValues={{ provider: 'wechatpay' }}>
            <Form.Item name="amount" label="金额（元）" rules={[{ required: true, min: 1 }]}>
              <InputNumber min={1} precision={2} className="full-width" />
            </Form.Item>
            <Form.Item name="provider" label="支付方式" rules={[{ required: true }]}>
              <Select
                options={[
                  { value: 'wechatpay', label: '微信支付（扫码）' },
                  { value: 'alipay', label: '支付宝（收银台）' },
                ]}
              />
            </Form.Item>
            <Typography.Paragraph type="secondary">
              支付成功后入账；关闭弹窗不会取消已创建的支付订单。
            </Typography.Paragraph>
            <Button block htmlType="submit" type="primary">
              创建支付订单
            </Button>
          </Form>
        )}
      </Modal>
    </>
  )
}

interface AppealableCreatorTask {
  creatorTaskId: string
  brief: string
  channel: string
  contentType: string
  completedAt: string
  payout: { status: string; verifiedAmount: number | null; settledAt?: string | null }
  taskAppealDeadlineAt: string
  payoutAppealDeadlineAt: string | null
  taskAppealable: boolean
  payoutAppealable: boolean
}

const decisionLabel = (value?: string | null) =>
  ({
    uphold: '维持原结算',
    adjust_payout: '调整报酬',
    reverse_settlement: '撤销/追回结算',
    accepted: '申诉受理',
    rejected: '申诉驳回',
  })[value ?? ''] ?? '待运营裁决'

function Appeals({
  initialAppealId,
  onDetailOpened,
}: {
  initialAppealId: string | null
  onDetailOpened: () => void
}) {
  const [form] = Form.useForm<{ reason: string }>()
  const [selected, setSelected] = useState<{
    task: AppealableCreatorTask
    target: 'task' | 'payout'
  } | null>(null)
  const appealableTasks = useQuery({
    queryKey: ['merchant-appealable-creator-tasks'],
    queryFn: () => api<{ items: AppealableCreatorTask[] }>('/merchant/creator-tasks/appealable'),
  })
  const appeals = useQuery({
    queryKey: ['merchant-task-appeals'],
    queryFn: () => api<{ items: any[] }>('/merchant/appeals'),
  })
  const [detailAppealId, setDetailAppealId] = useState<string | null>(null)
  useEffect(() => {
    if (initialAppealId) {
      setDetailAppealId(initialAppealId)
      onDetailOpened()
    }
  }, [initialAppealId, onDetailOpened])
  const appealDetail = useQuery({
    queryKey: ['merchant-task-appeal-detail', detailAppealId],
    queryFn: () => api<any>(`/merchant/appeals/${detailAppealId}`),
    enabled: Boolean(detailAppealId),
  })
  const submit = async ({ reason }: { reason: string }) => {
    if (!selected) return
    try {
      await api(`/merchant/creator-tasks/${selected.task.creatorTaskId}/appeals`, {
        method: 'POST',
        body: JSON.stringify({ target: selected.target, reason }),
      })
      message.success('申诉已提交，平台运营将进行处理')
      form.resetFields()
      setSelected(null)
      void appealableTasks.refetch()
      void appeals.refetch()
    } catch (error) {
      message.error(error instanceof Error ? error.message : '提交申诉失败')
    }
  }
  return (
    <>
      <div className="heading">
        <div>
          <Typography.Title level={2}>申诉中心</Typography.Title>
          <Typography.Text type="secondary">
            商户与创作者均可在任务完成或报酬结算完成后 30 个自然日内申诉。
          </Typography.Text>
        </div>
      </div>
      <Card title="可申诉的任务与结算">
        <Table
          rowKey="creatorTaskId"
          loading={appealableTasks.isLoading}
          dataSource={appealableTasks.data?.items ?? []}
          columns={[
            { title: '任务内容', dataIndex: 'brief', ellipsis: true },
            {
              title: '渠道 / 内容',
              render: (_, row: AppealableCreatorTask) => `${row.channel} / ${row.contentType}`,
            },
            {
              title: '结算金额',
              render: (_, row: AppealableCreatorTask) =>
                row.payout.verifiedAmount == null ? '—' : money(row.payout.verifiedAmount),
            },
            {
              title: '申诉截止时间',
              render: (_, row: AppealableCreatorTask) => {
                const dates = [
                  row.taskAppealable
                    ? `任务：${new Date(row.taskAppealDeadlineAt).toLocaleString('zh-CN')}`
                    : null,
                  row.payoutAppealable && row.payoutAppealDeadlineAt
                    ? `结算：${new Date(row.payoutAppealDeadlineAt).toLocaleString('zh-CN')}`
                    : null,
                ].filter(Boolean)
                return dates.join('；') || '已过期'
              },
            },
            {
              title: '操作',
              render: (_, row: AppealableCreatorTask) => (
                <Space>
                  {row.taskAppealable && (
                    <Button type="link" onClick={() => setSelected({ task: row, target: 'task' })}>
                      申诉任务履约
                    </Button>
                  )}
                  {row.payoutAppealable && (
                    <Button
                      type="link"
                      onClick={() => setSelected({ task: row, target: 'payout' })}
                    >
                      申诉结算
                    </Button>
                  )}
                </Space>
              ),
            },
          ]}
          locale={{ emptyText: '当前没有处于 30 个自然日申诉期内的任务或结算。' }}
        />
      </Card>
      <Card title="申诉记录" className="section">
        <Table
          rowKey="id"
          loading={appeals.isLoading}
          dataSource={appeals.data?.items ?? []}
          columns={[
            {
              title: '申诉方',
              dataIndex: 'appellantType',
              render: (value) => (value === 'merchant' ? '商户' : '创作者'),
            },
            {
              title: '类型',
              dataIndex: 'target',
              render: (value) => (value === 'payout' ? '结算' : '任务履约'),
            },
            { title: '申诉原因', dataIndex: 'reason', ellipsis: true },
            {
              title: '状态',
              dataIndex: 'status',
              render: (value) => (
                <Tag
                  color={
                    value === 'open' ? 'processing' : value === 'accepted' ? 'success' : 'default'
                  }
                >
                  {value}
                </Tag>
              ),
            },
            {
              title: '提交时间',
              dataIndex: 'createdAt',
              render: (value) => new Date(value).toLocaleString('zh-CN'),
            },
            {
              title: '处理说明',
              dataIndex: 'resolution',
              render: (value) => value || '待运营处理',
            },
            {
              title: '操作',
              render: (_, row: any) => (
                <Button type="link" onClick={() => setDetailAppealId(row.appealId)}>
                  查看详情
                </Button>
              ),
            },
          ]}
          locale={{ emptyText: '暂无申诉记录。' }}
        />
      </Card>
      <Drawer
        title="申诉裁决与账务详情"
        width={640}
        open={Boolean(detailAppealId)}
        onClose={() => setDetailAppealId(null)}
      >
        {appealDetail.isLoading ? (
          '加载中…'
        ) : appealDetail.data ? (
          <AppealDetailCard appeal={appealDetail.data} />
        ) : (
          <Alert type="error" message="无法加载申诉详情" />
        )}
      </Drawer>
      <Modal
        title={selected?.target === 'payout' ? '申诉任务结算' : '申诉任务履约'}
        open={Boolean(selected)}
        onCancel={() => {
          form.resetFields()
          setSelected(null)
        }}
        footer={null}
        destroyOnClose
      >
        <Alert
          className="section"
          type="info"
          showIcon
          message="提交后将通知创作者，并进入平台运营处理队列。"
        />
        <Form form={form} layout="vertical" onFinish={submit}>
          <Form.Item
            name="reason"
            label="申诉原因"
            rules={[{ required: true, max: 2000, message: '请填写不超过 2000 字的申诉原因' }]}
          >
            <Input.TextArea rows={5} placeholder="请说明争议事实、诉求和可补充的证据。" />
          </Form.Item>
          <Button type="primary" htmlType="submit" block>
            提交申诉
          </Button>
        </Form>
      </Modal>
    </>
  )
}

function AppealDetailCard({ appeal }: { appeal: any }) {
  const recovery = appeal.recovery ?? {
    amount: Math.max(0, Number(appeal.amountBefore ?? 0) - Number(appeal.amountAfter ?? 0)),
    recovered: 0,
    remaining: Math.max(0, Number(appeal.amountBefore ?? 0) - Number(appeal.amountAfter ?? 0)),
    status: Math.max(0, Number(appeal.amountBefore ?? 0) - Number(appeal.amountAfter ?? 0))
      ? 'recovering'
      : 'not_applicable',
  }
  const payout = appeal.payout
  const payoutStatus =
    payout?.status === 'reversed'
      ? Number(recovery.remaining) > 0
        ? '已撤销；后续结算仍在自动追回'
        : '已撤销；追回已完成'
      : payout?.status === 'settled'
        ? `已到账 ${money(payout.settledAmount)}${Number(payout.recoveryOffsetAmount ?? 0) > 0 ? `（已自动抵扣 ${money(payout.recoveryOffsetAmount)}）` : ''}`
        : payout?.status
          ? `结算状态：${payout.status}`
          : '暂无关联结算'
  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Descriptions
        bordered
        size="small"
        column={1}
        items={[
          {
            key: 'decision',
            label: '裁决结论',
            children: (
              <Tag color={appeal.adjudicationDecision ? 'processing' : 'default'}>
                {decisionLabel(appeal.adjudicationDecision)}
              </Tag>
            ),
          },
          {
            key: 'amount',
            label: '金额变化',
            children:
              appeal.amountBefore == null
                ? '未产生金额调整'
                : `${money(appeal.amountBefore)} → ${money(appeal.amountAfter)}`,
          },
          {
            key: 'recovery',
            label: '应追回',
            children: Number(recovery.amount) ? money(recovery.amount) : '无',
          },
          { key: 'recovered', label: '已追回', children: money(recovery.recovered) },
          { key: 'remaining', label: '剩余待追回', children: money(recovery.remaining) },
          {
            key: 'recoveryStatus',
            label: '追回状态',
            children:
              recovery.status === 'completed' ? (
                <Tag color="success">已完成</Tag>
              ) : recovery.status === 'recovering' ? (
                <Tag color="processing">追回中</Tag>
              ) : (
                '不适用'
              ),
          },
          { key: 'settlement', label: '到账/追回状态', children: payoutStatus },
          { key: 'resolution', label: '处理说明', children: appeal.resolution || '待运营处理' },
          {
            key: 'resolvedAt',
            label: '处理时间',
            children: appeal.resolvedAt
              ? new Date(appeal.resolvedAt).toLocaleString('zh-CN')
              : '待处理',
          },
          {
            key: 'evidence',
            label: '申诉证据',
            children: Object.keys(appeal.evidence ?? {}).length ? (
              <Typography.Text code>{JSON.stringify(appeal.evidence)}</Typography.Text>
            ) : (
              '未提交附件或结构化证据'
            ),
          },
        ]}
      />
      <Card size="small" title="后续结算抵扣明细">
        <Table
          size="small"
          rowKey="id"
          pagination={false}
          dataSource={(appeal.financialLedgerEntries ?? []).filter(
            (item: any) => item.entryType === 'recovery_auto_offset',
          )}
          columns={[
            {
              title: '后续结算流水',
              render: (_, item: any) => item.metadata?.settlementPayoutId ?? '—',
              ellipsis: true,
            },
            {
              title: '本次追回',
              dataIndex: 'amount',
              render: (value) => money(Math.abs(Number(value))),
            },
            {
              title: '追回后剩余',
              render: (_, item: any) => money(item.metadata?.remainingRecoveryAmount),
            },
            {
              title: '发生时间',
              dataIndex: 'occurredAt',
              render: (value) => new Date(value).toLocaleString('zh-CN'),
            },
          ]}
          locale={{ emptyText: '暂无后续结算抵扣记录' }}
        />
      </Card>
      <Card size="small" title="关联账务流水">
        <Table
          size="small"
          rowKey="id"
          pagination={false}
          dataSource={appeal.financialLedgerEntries ?? []}
          columns={[
            { title: '流水 ID', dataIndex: 'id', ellipsis: true },
            { title: '类型', dataIndex: 'entryType' },
            { title: '金额', dataIndex: 'amount', render: money },
            {
              title: '发生时间',
              dataIndex: 'occurredAt',
              render: (value) => new Date(value).toLocaleString('zh-CN'),
            },
          ]}
          locale={{
            emptyText: (appeal.financialLedgerEntryIds ?? []).length
              ? `流水 ${appeal.financialLedgerEntryIds.join('、')} 暂不可用`
              : '本次裁决未产生账务流水',
          }}
        />
      </Card>
    </Space>
  )
}

function Notifications({ onOpenTarget }: { onOpenTarget: (item: any) => void }) {
  const notifications = useQuery({
    queryKey: ['merchant-notifications'],
    queryFn: () => api<any>('/notifications?page=1&pageSize=50'),
  })
  const markRead = async (id: string) => {
    try {
      await api(`/notifications/${id}/read`, { method: 'PATCH' })
      void notifications.refetch()
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
            {
              title: '操作',
              render: (_, item: any) =>
                item.targetType && item.targetId ? (
                  <Button type="link" onClick={() => onOpenTarget(item)}>
                    查看详情
                  </Button>
                ) : (
                  '—'
                ),
            },
          ]}
          locale={{ emptyText: '暂无通知' }}
        />
      </Card>
    </>
  )
}
