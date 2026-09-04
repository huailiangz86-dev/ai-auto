import {
  AlertOutlined,
  AuditOutlined,
  BarChartOutlined,
  BellOutlined,
  CheckCircleOutlined,
  DollarOutlined,
  FileTextOutlined,
  FileSearchOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  ShopOutlined,
  TeamOutlined,
  WalletOutlined,
} from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import {
  Alert,
  Badge,
  Button,
  Card,
  Col,
  Descriptions,
  Empty,
  Input,
  Layout,
  Menu,
  Modal,
  Popconfirm,
  Result,
  Row,
  Select,
  Skeleton,
  Space,
  Statistic,
  Tabs,
  Table,
  Tag,
  Typography,
  message,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useEffect, useMemo, useState, type ReactNode } from 'react'

import { clearAdminSession, hasAdminSession } from './api/auth'
import {
  ApiError,
  getDashboard,
  getMerchantDashboardAgents,
  type DashboardAlert,
  type PendingAction,
} from './api/dashboard'
import { KpiCard } from './components/KpiCard'
import { LoginPage } from './components/LoginPage'
import { LifecycleManagement } from './LifecycleManagement'
import { RiskRuleConfiguration } from './RiskRuleConfiguration'
import { RelationshipManagement } from './RelationshipManagement'
import { TrendChart } from './components/TrendChart'
import {
  approveAgent,
  approveMerchant,
  getFraudAlerts,
  getModerationContents,
  getOperationAuditLogs,
  getPendingAgents,
  getPendingMerchants,
  getReconciliations,
  moderateContent,
  rejectAgent,
  rejectMerchant,
  resolveFraudAlert,
  settleReconciliation,
  type FraudAlert,
  type ModerationContent,
  type OperationAuditLog,
  type Reconciliation,
  getCreatorTaskReviewQueue,
  getCreatorTaskRiskQueue,
  getCreatorTaskWorkbench,
  getCampaignEconomics,
  getCreatorTaskAppeals,
  reviewCreatorTask,
  resolveCreatorTaskAppeal,
  resolveCreatorTaskRisk,
  type CreatorTaskQueueItem,
  type CreatorTaskWorkbench,
  type CampaignEconomics,
  type CreatorTaskAppeal,
  type FinancialLedgerEntry,
  getPilotOperationsMetrics,
  getPilotWeeklyEvidence,
  type PilotOperationsMetrics,
  type PilotWeeklyEvidence,
} from './api/operations'

const { Header, Sider, Content } = Layout

const pendingMeta: Record<
  PendingAction['type'],
  { label: string; icon: ReactNode; color: string }
> = {
  fraud_alert: { label: '风控告警待处理', icon: <SafetyCertificateOutlined />, color: '#c53030' },
  merchant_audit: { label: '商户资质待审核', icon: <ShopOutlined />, color: '#b7791f' },
  agent_audit: { label: '分享员申请待审核', icon: <TeamOutlined />, color: '#2c5282' },
  content_moderation: { label: 'AI 生成内容待审核', icon: <FileTextOutlined />, color: '#805ad5' },
}

function DashboardApp({ onLogout }: { onLogout: () => void }) {
  const [collapsed, setCollapsed] = useState(false)
  const [activeKey, setActiveKey] = useState('dashboard')
  const [merchantId, setMerchantId] = useState('')
  const [agentId, setAgentId] = useState('')
  const [trendDays, setTrendDays] = useState(14)
  const agentOptionsQuery = useQuery({
    queryKey: ['merchant-dashboard-agents', merchantId],
    queryFn: () => getMerchantDashboardAgents(merchantId),
    enabled: Boolean(merchantId),
  })
  const query = useQuery({
    queryKey: ['admin-dashboard', merchantId, agentId, trendDays],
    queryFn: () =>
      getDashboard({
        merchantId: merchantId || undefined,
        agentId: agentId || undefined,
        trendDays,
      }),
    refetchInterval: (context) =>
      context.state.data?.refresh.kpiSeconds
        ? context.state.data.refresh.kpiSeconds * 1000
        : 10_000,
  })

  useEffect(() => {
    if (!merchantId && agentId) setAgentId('')
  }, [merchantId, agentId])

  useEffect(() => {
    if (query.error instanceof ApiError && [401, 403].includes(query.error.status)) onLogout()
  }, [onLogout, query.error])

  const scopeTitle = useMemo(() => {
    if (query.data?.scope.level === 'agent') return '分享员下钻视图'
    if (query.data?.scope.level === 'merchant') return '商户下钻视图'
    return '平台全局视图'
  }, [query.data?.scope.level])

  return (
    <Layout className="app-shell">
      <Sider collapsible collapsed={collapsed} trigger={null} className="app-sider" width={224}>
        <div className="brand">
          <span className="brand-mark">A</span>
          {!collapsed && <span>AI auto</span>}
        </div>
        <div className="sider-caption">{!collapsed && '运营平台'}</div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[activeKey]}
          onClick={({ key }) => setActiveKey(key)}
          items={[
            { key: 'dashboard', icon: <BarChartOutlined />, label: '运营大屏' },
            { key: 'merchants', icon: <ShopOutlined />, label: '商户' },
            { key: 'agents', icon: <TeamOutlined />, label: '分享员管理' },
            { key: 'relationships', icon: <TeamOutlined />, label: '合作关系' },
            { key: 'creator-review', icon: <AuditOutlined />, label: '创作者任务审核' },
            { key: 'risk-holds', icon: <SafetyCertificateOutlined />, label: '任务风控暂停' },
            { key: 'finance', icon: <WalletOutlined />, label: '财务对账' },
            { key: 'economics', icon: <DollarOutlined />, label: '经营经济性' },
            { key: 'fraud', icon: <SafetyCertificateOutlined />, label: '风控中心' },
            { key: 'content', icon: <AuditOutlined />, label: '内容审核' },
            { key: 'appeals', icon: <FileSearchOutlined />, label: '申诉处理' },
            { key: 'pilot-evidence', icon: <BarChartOutlined />, label: '试点证据看板' },
            { key: 'audit', icon: <FileTextOutlined />, label: '操作审计' },
          ]}
        />
      </Sider>
      <Layout>
        <Header className="app-header">
          <Button
            type="text"
            aria-label="收起或展开导航"
            icon={<MenuFoldOutlined rotate={collapsed ? 180 : 0} />}
            onClick={() => setCollapsed(!collapsed)}
          />
          <Space size="large">
            <Badge
              count={
                (query.data?.alerts.summary.critical ?? 0) +
                (query.data?.alerts.summary.warning ?? 0)
              }
              size="small"
            >
              <BellOutlined className="header-bell" aria-label="告警" />
            </Badge>
            <span>管理员</span>
            <Button type="text" aria-label="退出登录" icon={<LogoutOutlined />} onClick={onLogout}>
              退出
            </Button>
          </Space>
        </Header>
        <Content className="dashboard-content">
          {activeKey === 'dashboard' ? (
            <>
              <div className="page-heading">
                <div>
                  <Typography.Title level={2}>运营大屏</Typography.Title>
                  <Typography.Text type="secondary">
                    {scopeTitle} · KPI 每 {query.data?.refresh.kpiSeconds ?? 10} 秒刷新
                  </Typography.Text>
                </div>
                <Button
                  icon={<ReloadOutlined spin={query.isFetching} />}
                  onClick={() => void query.refetch()}
                  loading={query.isFetching}
                >
                  刷新数据
                </Button>
              </div>

              <Card className="filter-card" size="small">
                <Space wrap size="middle">
                  <span className="filter-label">数据范围</span>
                  <Input
                    allowClear
                    value={merchantId}
                    onChange={(event) => setMerchantId(event.target.value)}
                    placeholder="输入商户 ID 下钻"
                    aria-label="商户 ID"
                    className="scope-input"
                  />
                  <Select
                    allowClear
                    disabled={!merchantId}
                    value={agentId || undefined}
                    onChange={(value) => setAgentId(value ?? '')}
                    placeholder={merchantId ? '选择该商户的分享员下钻' : '请先输入商户 ID'}
                    aria-label="分享员 ID"
                    className="scope-input"
                    loading={agentOptionsQuery.isFetching}
                    notFoundContent={
                      agentOptionsQuery.isError ? '分享员列表加载失败' : '该商户暂无已绑定分享员'
                    }
                    options={(agentOptionsQuery.data ?? []).map((agent) => ({
                      value: agent.id,
                      label: `${agent.nickname || '未命名分享员'}（${agent.phone}）`,
                    }))}
                  />
                  <Select
                    value={trendDays}
                    onChange={setTrendDays}
                    aria-label="趋势天数"
                    options={[7, 14, 30, 60, 90].map((value) => ({
                      value,
                      label: `近 ${value} 天`,
                    }))}
                  />
                  {(merchantId || agentId) && (
                    <Button
                      type="link"
                      onClick={() => {
                        setMerchantId('')
                        setAgentId('')
                      }}
                    >
                      回到平台视图
                    </Button>
                  )}
                </Space>
              </Card>

              {query.isLoading ? (
                <DashboardSkeleton />
              ) : query.isError ? (
                <Result
                  status="error"
                  title="无法加载运营数据"
                  subTitle={query.error.message}
                  extra={
                    <Button type="primary" onClick={() => void query.refetch()}>
                      重试
                    </Button>
                  }
                />
              ) : query.data ? (
                <Dashboard data={query.data} onNavigate={setActiveKey} />
              ) : null}
            </>
          ) : (
            <OperationsPage activeKey={activeKey} />
          )}
        </Content>
      </Layout>
    </Layout>
  )
}

function DashboardSkeleton() {
  return (
    <Card>
      <Skeleton active paragraph={{ rows: 18 }} />
    </Card>
  )
}

function Dashboard({
  data,
  onNavigate,
}: {
  data: Awaited<ReturnType<typeof getDashboard>>
  onNavigate: (key: string) => void
}) {
  const alertColumns: ColumnsType<DashboardAlert> = [
    { title: '告警类型', dataIndex: 'type', render: (value: string) => formatAlertType(value) },
    {
      title: '级别',
      dataIndex: 'severity',
      render: (value: DashboardAlert['severity']) => (
        <Tag color={value === 'critical' ? 'error' : value === 'warning' ? 'warning' : 'gold'}>
          {severityLabel(value)}
        </Tag>
      ),
    },
    {
      title: '发生时间',
      dataIndex: 'occurredAt',
      render: (value: string) => new Date(value).toLocaleString('zh-CN', { hour12: false }),
    },
    {
      title: '状态',
      dataIndex: 'status',
      render: (value: string) => <Tag>{value === 'pending' ? '待处理' : value}</Tag>,
    },
  ]
  return (
    <>
      <Row gutter={[16, 16]} className="kpi-grid">
        <Col xs={24} sm={12} xl={6}>
          <KpiCard
            label="新增商户"
            value={formatNumber(data.today.newMerchants)}
            description={`本月新增 ${formatNumber(data.monthly.newMerchants)}`}
          />
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <KpiCard
            label="活跃分享员"
            value={formatNumber(data.today.activeAgents)}
            description={`本月新增 ${formatNumber(data.monthly.newAgents)}`}
          />
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <KpiCard
            label="今日 GMV"
            value={formatCurrency(data.today.gmv)}
            description={`核销 ${formatNumber(data.today.redemptions)} 笔`}
          />
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <KpiCard
            label="平台收入"
            value={formatCurrency(data.today.platformRevenue)}
            description={`佣金支出 ${formatCurrency(data.today.commissionPayout)}`}
          />
        </Col>
      </Row>

      <section className="section-block">
        <div className="section-heading">
          <h2>趋势洞察</h2>
          <span>按日统计 · 截止 {data.date}</span>
        </div>
        <div className="trends-grid">
          <TrendChart title="GMV 趋势" color="#2c5282" suffix=" 元" points={data.trends.gmv} />
          <TrendChart
            title="分享员增长"
            color="#276749"
            suffix=" 人"
            points={data.trends.agentGrowth}
          />
          <TrendChart
            title="佣金支出"
            color="#805ad5"
            suffix=" 元"
            points={data.trends.commissionPayout}
          />
          <TrendChart
            title="商户续费率"
            color="#b7791f"
            suffix="%"
            points={data.trends.merchantRetention.map((point) => ({
              ...point,
              value: point.value * 100,
            }))}
          />
        </div>
      </section>

      <Row gutter={[16, 16]} className="section-block">
        <Col xs={24} xl={15}>
          <Card
            title={
              <span>
                <AlertOutlined /> 告警中心
              </span>
            }
            extra={
              <span className="alert-summary">
                <Tag color="error">严重 {data.alerts.summary.critical}</Tag>
                <Tag color="warning">警告 {data.alerts.summary.warning}</Tag>
                <Tag color="gold">注意 {data.alerts.summary.notice}</Tag>
              </span>
            }
          >
            {data.alerts.items.length ? (
              <Table
                rowKey="id"
                columns={alertColumns}
                dataSource={data.alerts.items}
                pagination={false}
                size="small"
                scroll={{ x: 560 }}
              />
            ) : (
              <Empty description="当前没有待处理告警" />
            )}
            {(data.alerts.summary.paymentFailures > 0 || data.alerts.summary.systemErrors > 0) && (
              <Alert
                className="system-alert"
                type="warning"
                showIcon
                message={`订阅支付失败 ${data.alerts.summary.paymentFailures} 条，系统异常 ${data.alerts.summary.systemErrors} 条`}
              />
            )}
          </Card>
        </Col>
        <Col xs={24} xl={9}>
          <Card
            title={
              <span>
                <CheckCircleOutlined /> 待办事项
              </span>
            }
            className="pending-card"
          >
            {data.pendingActions.map((item) => {
              const meta = pendingMeta[item.type]
              return (
                <div className="pending-row" key={item.type}>
                  <span className="pending-icon" style={{ color: meta.color }}>
                    {meta.icon}
                  </span>
                  <div>
                    <strong>{item.count} 条</strong>
                    <span>{meta.label}</span>
                  </div>
                  <Button type="link" onClick={() => onNavigate(pendingRoute[item.type])}>
                    立即处理
                  </Button>
                </div>
              )
            })}
          </Card>
        </Col>
      </Row>

      <section className="section-block">
        <div className="section-heading">
          <h2>平台核心指标</h2>
          <span>累计与当月汇总</span>
        </div>
        <Card>
          <Row gutter={[24, 24]}>
            <Metric title="商户总数" value={data.total.merchants} />
            <Metric title="分享员总数" value={data.total.agents} />
            <Metric title="累计 GMV" value={data.total.cumulativeGmv} prefix="¥" precision={0} />
            <Metric
              title="累计平台收入"
              value={data.total.cumulativeRevenue}
              prefix="¥"
              precision={0}
            />
            <Metric
              title="订阅续费率"
              value={data.monthly.subscriptionRenewalRate * 100}
              suffix="%"
              precision={1}
            />
            <Metric
              title="分享员留存率"
              value={data.monthly.agentRetentionRate * 100}
              suffix="%"
              precision={1}
            />
          </Row>
        </Card>
      </section>
    </>
  )
}

const pendingRoute: Record<PendingAction['type'], string> = {
  fraud_alert: 'fraud',
  merchant_audit: 'merchants',
  agent_audit: 'agents',
  content_moderation: 'content',
}

type OperationKey =
  | 'merchants'
  | 'agents'
  | 'relationships'
  | 'creator-review'
  | 'risk-holds'
  | 'finance'
  | 'economics'
  | 'fraud'
  | 'content'
  | 'appeals'
  | 'pilot-evidence'
  | 'audit'
const operationTitles: Record<OperationKey, string> = {
  merchants: '商户',
  agents: '分享员管理',
  relationships: '合作关系',
  'creator-review': '创作者任务审核',
  'risk-holds': '任务风控暂停',
  finance: '财务对账',
  economics: '经营经济性',
  fraud: '风控中心',
  content: '内容审核',
  appeals: '申诉处理',
  'pilot-evidence': '试点证据看板',
  audit: '操作审计',
}

function OperationsPage({ activeKey }: { activeKey: string }) {
  const key = activeKey as OperationKey
  const [reasonModal, contextHolder] = Modal.useModal()
  const [economicsCampaignId, setEconomicsCampaignId] = useState('')
  const [economicsMerchantId, setEconomicsMerchantId] = useState('')
  const [appealsStatus, setAppealsStatus] = useState<CreatorTaskAppeal['status'] | 'all'>('open')
  const [appealsTarget, setAppealsTarget] = useState<CreatorTaskAppeal['target'] | ''>('')
  const [appealsMerchantId, setAppealsMerchantId] = useState('')
  const [appealsCreatorId, setAppealsCreatorId] = useState('')
  const [appealsTaskId, setAppealsTaskId] = useState('')
  const [appealsPage, setAppealsPage] = useState(1)
  const merchants = useQuery({
    queryKey: ['pending-merchants'],
    queryFn: getPendingMerchants,
    enabled: key === 'merchants',
  })
  const agents = useQuery({
    queryKey: ['pending-agents'],
    queryFn: getPendingAgents,
    enabled: key === 'agents',
  })
  const fraud = useQuery({
    queryKey: ['fraud-alerts'],
    queryFn: getFraudAlerts,
    enabled: key === 'fraud',
  })
  const finance = useQuery({
    queryKey: ['finance-reconciliations'],
    queryFn: getReconciliations,
    enabled: key === 'finance',
  })
  const economics = useQuery({
    queryKey: ['campaign-economics', economicsCampaignId, economicsMerchantId],
    queryFn: () =>
      getCampaignEconomics({
        campaignId: economicsCampaignId || undefined,
        merchantId: economicsMerchantId || undefined,
      }),
    enabled: key === 'economics',
  })
  const contents = useQuery({
    queryKey: ['moderation-contents'],
    queryFn: getModerationContents,
    enabled: key === 'content',
  })
  const appeals = useQuery({
    queryKey: [
      'creator-task-appeals',
      appealsStatus,
      appealsTarget,
      appealsMerchantId,
      appealsCreatorId,
      appealsTaskId,
      appealsPage,
    ],
    queryFn: () =>
      getCreatorTaskAppeals({
        status: appealsStatus,
        target: appealsTarget || undefined,
        merchantId: appealsMerchantId || undefined,
        creatorId: appealsCreatorId || undefined,
        creatorTaskId: appealsTaskId || undefined,
        page: appealsPage,
        pageSize: 20,
      }),
    enabled: key === 'appeals',
  })
  const auditLogs = useQuery({
    queryKey: ['operation-audit-logs'],
    queryFn: getOperationAuditLogs,
    enabled: key === 'audit',
  })
  const pilot = useQuery({
    queryKey: ['pilot-evidence'],
    queryFn: async () => ({
      metrics: await getPilotOperationsMetrics(),
      weekly: await getPilotWeeklyEvidence(),
    }),
    enabled: key === 'pilot-evidence',
  })
  const refresh = () => {
    if (key === 'merchants') void merchants.refetch()
    if (key === 'agents') void agents.refetch()
    if (key === 'fraud') void fraud.refetch()
    if (key === 'finance') void finance.refetch()
    if (key === 'economics') void economics.refetch()
    if (key === 'content') void contents.refetch()
    if (key === 'appeals') void appeals.refetch()
    if (key === 'audit') void auditLogs.refetch()
    if (key === 'pilot-evidence') void pilot.refetch()
  }
  const run = async (action: () => Promise<unknown>) => {
    try {
      await action()
      message.success('操作已提交')
      refresh()
    } catch (error) {
      message.error(error instanceof Error ? error.message : '操作失败')
    }
  }
  const askReason = (title: string, onOk: (reason: string) => Promise<unknown>) =>
    reasonModal.confirm({
      title,
      content: <Input.TextArea id="operation-reason" placeholder="请填写处理原因" />,
      onOk: async () => {
        const value = (
          document.getElementById('operation-reason') as HTMLTextAreaElement | null
        )?.value?.trim()
        if (!value) throw new Error('请填写处理原因')
        await run(() => onOk(value))
      },
    })
  const loadingByKey: Record<OperationKey, boolean> = {
    merchants: merchants.isLoading,
    agents: agents.isLoading,
    relationships: false,
    'creator-review': false,
    'risk-holds': false,
    finance: finance.isLoading,
    economics: economics.isLoading,
    fraud: fraud.isLoading,
    content: contents.isLoading,
    appeals: appeals.isLoading,
    'pilot-evidence': pilot.isLoading,
    audit: auditLogs.isLoading,
  }
  const errorByKey: Record<OperationKey, Error | null> = {
    merchants: merchants.error,
    agents: agents.error,
    relationships: null,
    'creator-review': null,
    'risk-holds': null,
    finance: finance.error,
    economics: economics.error,
    fraud: fraud.error,
    content: contents.error,
    appeals: appeals.error,
    'pilot-evidence': pilot.error,
    audit: auditLogs.error,
  }
  const loading = loadingByKey[key]
  const error = errorByKey[key]
  return (
    <>
      {contextHolder}
      <div className="page-heading">
        <div>
          <Typography.Title level={2}>{operationTitles[key]}</Typography.Title>
          <Typography.Text type="secondary">所有处理动作均会即时写回业务状态。</Typography.Text>
        </div>
        <Button icon={<ReloadOutlined spin={loading} />} onClick={refresh}>
          刷新
        </Button>
      </div>
      {!error && key === 'merchants' ? (
        <Tabs
          defaultActiveKey="review"
          items={[
            {
              key: 'review',
              label: `资质审核（${merchants.data?.pagination.total ?? 0}）`,
              children: (
                <AuditTable
                  rows={merchants.data?.items ?? []}
                  idKey="merchantId"
                  columns={[
                    ['商户', 'businessName'],
                    ['联系人', 'contactName'],
                    ['联系电话', 'phone'],
                    ['行业', 'industryCategory'],
                    ['申请时间', 'appliedAt'],
                  ]}
                  onApprove={(id) => run(() => approveMerchant(id))}
                  onReject={(id) =>
                    askReason('拒绝商户申请', (reason) => rejectMerchant(id, reason))
                  }
                />
              ),
            },
            {
              key: 'management',
              label: '全量商户管理',
              children: <LifecycleManagement kind="merchants" />,
            },
          ]}
        />
      ) : null}
      {!error && key === 'creator-review' ? (
        <CreatorTaskQueue
          mode="review"
          onReview={(id, decision, reason) => run(() => reviewCreatorTask(id, decision, reason))}
        />
      ) : null}
      {!error && key === 'risk-holds' ? (
        <CreatorTaskQueue
          mode="risk"
          onRisk={(id, action, reason) => run(() => resolveCreatorTaskRisk(id, action, reason))}
        />
      ) : null}{' '}
      {error ? (
        <Result
          status="error"
          title="无法加载业务数据"
          subTitle={error.message}
          extra={<Button onClick={refresh}>重试</Button>}
        />
      ) : null}
      {!error && key === 'agents' ? (
        <Tabs
          defaultActiveKey="review"
          items={[
            {
              key: 'review',
              label: `分享员审核（${agents.data?.pagination.total ?? 0}）`,
              children: (
                <AuditTable
                  rows={agents.data?.items ?? []}
                  idKey="agentId"
                  columns={[
                    ['昵称', 'nickname'],
                    ['联系电话', 'phone'],
                    ['申请时间', 'registeredAt'],
                  ]}
                  onApprove={(id) => run(() => approveAgent(id))}
                  onReject={(id) =>
                    askReason('拒绝分享员申请', (reason) => rejectAgent(id, reason))
                  }
                />
              ),
            },
            {
              key: 'management',
              label: '达人管理',
              children: <LifecycleManagement kind="creators" />,
            },
          ]}
        />
      ) : null}
      {!error && key === 'relationships' ? <RelationshipManagement /> : null}
      {!error && key === 'fraud' ? (
        <Tabs
          items={[
            {
              key: 'alerts',
              label: `风控告警（${fraud.data?.summary.total ?? fraud.data?.items.length ?? 0}）`,
              children: (
                <FraudTable
                  rows={fraud.data?.items ?? []}
                  onResolve={(id, action) =>
                    action === 'review'
                      ? run(() => resolveFraudAlert(id, action))
                      : askReason(
                          action === 'dismiss' ? '标记风控告警为误报' : '冻结待结算佣金',
                          (note) => resolveFraudAlert(id, action, note),
                        )
                  }
                />
              ),
            },
            { key: 'rules', label: '规则配置', children: <RiskRuleConfiguration /> },
          ]}
        />
      ) : null}
      {!error && key === 'finance' ? (
        <FinanceTable
          rows={finance.data?.items ?? []}
          pendingAmount={finance.data?.summary.pendingAmount ?? 0}
          onSettle={(id) => run(() => settleReconciliation(id))}
        />
      ) : null}
      {!error && key === 'economics' ? (
        <CampaignEconomicsDashboard
          data={economics.data}
          campaignId={economicsCampaignId}
          merchantId={economicsMerchantId}
          onCampaignIdChange={(value) => setEconomicsCampaignId(value)}
          onMerchantIdChange={(value) => setEconomicsMerchantId(value)}
          onRefresh={() => void economics.refetch()}
          loading={economics.isFetching}
        />
      ) : null}
      {!error && key === 'content' ? (
        <ContentTable
          rows={contents.data?.items ?? []}
          onModerate={(id, decision) =>
            decision === 'passed'
              ? run(() => moderateContent(id, decision))
              : askReason(decision === 'flagged' ? '标记内容并要求修改' : '拦截内容', (reason) =>
                  moderateContent(id, decision, reason),
                )
          }
        />
      ) : null}
      {!error && key === 'appeals' ? (
        <AppealsDashboard
          data={appeals.data}
          status={appealsStatus}
          target={appealsTarget}
          merchantId={appealsMerchantId}
          creatorId={appealsCreatorId}
          taskId={appealsTaskId}
          page={appealsPage}
          loading={appeals.isFetching}
          onStatusChange={(value) => {
            setAppealsStatus(value)
            setAppealsPage(1)
          }}
          onTargetChange={(value) => {
            setAppealsTarget(value)
            setAppealsPage(1)
          }}
          onMerchantIdChange={(value) => {
            setAppealsMerchantId(value)
            setAppealsPage(1)
          }}
          onCreatorIdChange={(value) => {
            setAppealsCreatorId(value)
            setAppealsPage(1)
          }}
          onTaskIdChange={(value) => {
            setAppealsTaskId(value)
            setAppealsPage(1)
          }}
          onPageChange={setAppealsPage}
          onRefresh={() => void appeals.refetch()}
          onResolve={(id, decision, resolution) =>
            run(() => resolveCreatorTaskAppeal(id, decision, resolution))
          }
        />
      ) : null}
      {!error && key === 'pilot-evidence' && pilot.data ? (
        <PilotEvidenceDashboard data={pilot.data} />
      ) : null}
      {!error && key === 'audit' ? (
        <OperationAuditTable rows={auditLogs.data?.items ?? []} />
      ) : null}
    </>
  )
}

function CampaignEconomicsDashboard({
  data,
  campaignId,
  merchantId,
  onCampaignIdChange,
  onMerchantIdChange,
  onRefresh,
  loading,
}: {
  data?: CampaignEconomics
  campaignId: string
  merchantId: string
  onCampaignIdChange: (value: string) => void
  onMerchantIdChange: (value: string) => void
  onRefresh: () => void
  loading: boolean
}) {
  const totals = data?.totals
  const scope = data?.scope.campaignId
    ? `Campaign ${data.scope.campaignId}`
    : data?.scope.merchantId
      ? `商户 ${data.scope.merchantId}`
      : '平台全部账本'
  const columns: ColumnsType<FinancialLedgerEntry> = [
    { title: '发生时间', dataIndex: 'occurredAt', render: formatDate },
    { title: '分类', dataIndex: 'classification', render: formatFinancialClassification },
    { title: '类型', dataIndex: 'entryType' },
    {
      title: '金额',
      dataIndex: 'amount',
      render: (value: number, row) => (
        <Typography.Text type={row.classification === 'revenue' ? 'success' : undefined}>
          {formatCurrency(value, 2)}
        </Typography.Text>
      ),
    },
    { title: 'Campaign', dataIndex: 'campaignId', render: shortId },
    { title: 'Creator Task', dataIndex: 'creatorTaskId', render: shortId },
    { title: '来源', dataIndex: 'sourceReference', render: emptyText },
    { title: '说明', dataIndex: 'description', render: emptyText },
  ]
  return (
    <>
      <Card className="filter-card" size="small">
        <Space wrap>
          <Input
            allowClear
            value={campaignId}
            onChange={(event) => onCampaignIdChange(event.target.value)}
            placeholder="Campaign ID（可选）"
            aria-label="Campaign ID"
            className="scope-input"
          />
          <Input
            allowClear
            value={merchantId}
            onChange={(event) => onMerchantIdChange(event.target.value)}
            placeholder="商户 ID（可选）"
            aria-label="商户 ID"
            className="scope-input"
          />
          <Button icon={<ReloadOutlined spin={loading} />} onClick={onRefresh} loading={loading}>
            刷新经济性
          </Button>
        </Space>
      </Card>
      {!data ? (
        <Card>
          <Skeleton active paragraph={{ rows: 10 }} />
        </Card>
      ) : (
        <>
          <Alert
            showIcon
            type={(totals?.grossProfit ?? 0) >= 0 ? 'success' : 'warning'}
            className="operation-summary"
            message={`当前范围：${scope}；毛利率 ${formatPercent(totals?.grossMargin)}`}
          />
          <Card size="small" className="economics-note">
            <Space wrap>
              <Typography.Text>已纳入 {data.summary.entryCount} 笔可追溯流水</Typography.Text>
              <Typography.Text>总成本 {formatCurrency(data.summary.totalCost, 2)}</Typography.Text>
              <Typography.Text type={(data.summary.netResult ?? 0) >= 0 ? 'success' : 'danger'}>
                净经营结果 {formatCurrency(data.summary.netResult, 2)}
              </Typography.Text>
            </Space>
          </Card>
          <Card size="small" title="流水构成" className="economics-note">
            <Space wrap>
              {Object.entries(data.summary.byEntryType).map(([entryType, amount]) => (
                <Tag key={entryType}>
                  {entryType}：{formatCurrency(amount, 2)}
                </Tag>
              ))}
              {!Object.keys(data.summary.byEntryType).length ? (
                <Typography.Text type="secondary">暂无分类流水</Typography.Text>
              ) : null}
            </Space>
          </Card>
          <Row gutter={[16, 16]} className="section-block">
            <Col xs={12} sm={8} xl={4}>
              <Statistic
                title="收入（平台/商户增长）"
                value={totals?.merchantGrowthRevenue ?? 0}
                prefix="¥"
                precision={2}
              />
            </Col>
            <Col xs={12} sm={8} xl={4}>
              <Statistic
                title="Creator Payout COGS"
                value={totals?.creatorPayoutCogs ?? 0}
                prefix="¥"
                precision={2}
              />
            </Col>
            <Col xs={12} sm={8} xl={4}>
              <Statistic
                title="运营成本"
                value={totals?.operatingCost ?? 0}
                prefix="¥"
                precision={2}
              />
            </Col>
            <Col xs={12} sm={8} xl={4}>
              <Statistic
                title="风险准备金"
                value={totals?.riskReserve ?? 0}
                prefix="¥"
                precision={2}
              />
            </Col>
            <Col xs={12} sm={8} xl={4}>
              <Statistic
                title="毛利"
                value={totals?.grossProfit ?? 0}
                prefix="¥"
                precision={2}
                valueStyle={{ color: (totals?.grossProfit ?? 0) >= 0 ? '#276749' : '#c53030' }}
              />
            </Col>
            <Col xs={12} sm={8} xl={4}>
              <Statistic
                title="毛利率"
                value={(totals?.grossMargin ?? 0) * 100}
                suffix="%"
                precision={1}
              />
            </Col>
          </Row>
          <Card title="账本明细" className="section-block">
            <Table
              rowKey="entryId"
              columns={columns}
              dataSource={data.entries}
              pagination={{ pageSize: 20, showSizeChanger: false }}
              scroll={{ x: 1180 }}
              locale={{ emptyText: '当前范围没有经济性账本记录' }}
            />
          </Card>
        </>
      )}
    </>
  )
}

type AppealsResult = Awaited<ReturnType<typeof getCreatorTaskAppeals>>

function AppealsDashboard({
  data,
  status,
  target,
  merchantId,
  creatorId,
  taskId,
  page,
  loading,
  onStatusChange,
  onTargetChange,
  onMerchantIdChange,
  onCreatorIdChange,
  onTaskIdChange,
  onPageChange,
  onRefresh,
  onResolve,
}: {
  data?: AppealsResult
  status: CreatorTaskAppeal['status'] | 'all'
  target: CreatorTaskAppeal['target'] | ''
  merchantId: string
  creatorId: string
  taskId: string
  page: number
  loading: boolean
  onStatusChange: (value: CreatorTaskAppeal['status'] | 'all') => void
  onTargetChange: (value: CreatorTaskAppeal['target'] | '') => void
  onMerchantIdChange: (value: string) => void
  onCreatorIdChange: (value: string) => void
  onTaskIdChange: (value: string) => void
  onPageChange: (value: number) => void
  onRefresh: () => void
  onResolve: (id: string, decision: 'accepted' | 'rejected', resolution: string) => Promise<unknown>
}) {
  const [selected, setSelected] = useState<CreatorTaskAppeal | null>(null)
  const [resolutionTarget, setResolutionTarget] = useState<{
    appeal: CreatorTaskAppeal
    decision: 'accepted' | 'rejected'
  } | null>(null)
  const [resolutionText, setResolutionText] = useState('')
  const summary = data?.summary
  const items = data?.items ?? []
  const columns: ColumnsType<CreatorTaskAppeal> = [
    {
      title: '创作者',
      key: 'creator',
      render: (_, row) => (
        <Space direction="vertical" size={0}>
          <Typography.Text strong>{row.creator?.nickname || '未命名创作者'}</Typography.Text>
          <Typography.Text type="secondary">{row.creator?.phone || row.creatorId}</Typography.Text>
        </Space>
      ),
    },
    {
      title: '关联任务',
      key: 'task',
      render: (_, row) =>
        row.task ? (
          <Space direction="vertical" size={0}>
            <span>
              {row.task.channel} · {row.task.contentType}
            </span>
            <Typography.Text type="secondary">
              {row.task.status} · {formatCurrency(row.task.baseReward)}
            </Typography.Text>
          </Space>
        ) : (
          row.creatorTaskId
        ),
    },
    {
      title: '商户 / Campaign',
      key: 'scope',
      render: (_, row) => (
        <Space direction="vertical" size={0}>
          <span>{row.task?.merchantId || '—'}</span>
          <Typography.Text type="secondary">
            {row.task?.campaignId || '无 Campaign'}
          </Typography.Text>
        </Space>
      ),
    },
    { title: '目标', dataIndex: 'target', render: formatAppealTarget },
    { title: '状态', dataIndex: 'status', render: formatAppealStatus },
    { title: '申诉原因', dataIndex: 'reason', ellipsis: true },
    {
      title: '报酬',
      key: 'payout',
      render: (_, row) =>
        row.payout
          ? `${formatCurrency(row.payout.verifiedAmount ?? row.payout.expectedAmount, 2)} · ${row.payout.status}`
          : '—',
    },
    { title: '提交时间', dataIndex: 'createdAt', render: formatDate },
    {
      title: '操作',
      key: 'action',
      fixed: 'right',
      render: (_, row) => (
        <Space wrap>
          <Button type="link" onClick={() => setSelected(row)}>
            详情
          </Button>
          {row.status === 'open' ? (
            <>
              <Button
                type="link"
                onClick={() => {
                  setResolutionTarget({ appeal: row, decision: 'accepted' })
                  setResolutionText('')
                }}
              >
                接受
              </Button>
              <Button
                danger
                type="link"
                onClick={() => {
                  setResolutionTarget({ appeal: row, decision: 'rejected' })
                  setResolutionText('')
                }}
              >
                驳回
              </Button>
            </>
          ) : null}
        </Space>
      ),
    },
  ]
  const handleResolve = async () => {
    if (!resolutionTarget || !resolutionText.trim()) {
      message.error('请填写处理说明')
      return
    }
    await onResolve(
      resolutionTarget.appeal.appealId,
      resolutionTarget.decision,
      resolutionText.trim(),
    )
    setResolutionTarget(null)
    setResolutionText('')
  }
  return (
    <>
      <Row gutter={[12, 12]} className="section-block">
        <Col xs={12} sm={6}>
          <Statistic title="待处理" value={summary?.open ?? 0} />
        </Col>
        <Col xs={12} sm={6}>
          <Statistic title="已接受" value={summary?.accepted ?? 0} />
        </Col>
        <Col xs={12} sm={6}>
          <Statistic title="已驳回" value={summary?.rejected ?? 0} />
        </Col>
        <Col xs={12} sm={6}>
          <Statistic title="全部申诉" value={summary?.total ?? 0} />
        </Col>
      </Row>
      <Card className="filter-card" size="small">
        <Space wrap>
          <Select
            value={status}
            onChange={onStatusChange}
            aria-label="申诉状态"
            options={[
              { value: 'open', label: '待处理' },
              { value: 'accepted', label: '已接受' },
              { value: 'rejected', label: '已驳回' },
              { value: 'withdrawn', label: '已撤回' },
              { value: 'all', label: '全部状态' },
            ]}
          />
          <Select
            allowClear
            value={target || undefined}
            onChange={(value) => onTargetChange(value ?? '')}
            placeholder="全部申诉对象"
            options={[
              { value: 'task', label: '任务争议' },
              { value: 'payout', label: '报酬争议' },
            ]}
            className="scope-input"
          />
          <Input
            allowClear
            value={merchantId}
            onChange={(event) => onMerchantIdChange(event.target.value)}
            placeholder="商户 ID"
            className="scope-input"
          />
          <Input
            allowClear
            value={creatorId}
            onChange={(event) => onCreatorIdChange(event.target.value)}
            placeholder="创作者 ID"
            className="scope-input"
          />
          <Input
            allowClear
            value={taskId}
            onChange={(event) => onTaskIdChange(event.target.value)}
            placeholder="Creator Task ID"
            className="scope-input"
          />
          <Button icon={<ReloadOutlined spin={loading} />} onClick={onRefresh} loading={loading}>
            刷新队列
          </Button>
        </Space>
      </Card>
      <Card>
        <Table
          rowKey="appealId"
          columns={columns}
          dataSource={items}
          loading={loading}
          scroll={{ x: 1180 }}
          pagination={{
            current: data?.pagination.page ?? page,
            pageSize: data?.pagination.pageSize ?? 20,
            total: data?.pagination.total ?? 0,
            showSizeChanger: false,
            onChange: onPageChange,
          }}
          locale={{
            emptyText: status === 'open' ? '当前没有待处理申诉' : '当前没有符合条件的申诉',
          }}
        />
      </Card>
      <Modal
        open={Boolean(selected)}
        title="申诉详情"
        onCancel={() => setSelected(null)}
        footer={<Button onClick={() => setSelected(null)}>关闭</Button>}
        width={820}
      >
        {selected ? (
          <Descriptions bordered size="small" column={2}>
            <Descriptions.Item label="创作者">
              {selected.creator?.nickname || '未命名创作者'}
            </Descriptions.Item>
            <Descriptions.Item label="联系电话">{selected.creator?.phone || '—'}</Descriptions.Item>
            <Descriptions.Item label="任务状态">{selected.task?.status || '—'}</Descriptions.Item>
            <Descriptions.Item label="申诉对象">
              {formatAppealTarget(selected.target)}
            </Descriptions.Item>
            <Descriptions.Item label="申诉原因" span={2}>
              {selected.reason}
            </Descriptions.Item>
            <Descriptions.Item label="证据" span={2}>
              <Typography.Paragraph style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                {JSON.stringify(selected.evidence, null, 2)}
              </Typography.Paragraph>
            </Descriptions.Item>
            <Descriptions.Item label="历史处理" span={2}>
              {selected.resolution || '尚未处理'}
            </Descriptions.Item>
          </Descriptions>
        ) : null}
      </Modal>
      <Modal
        open={Boolean(resolutionTarget)}
        title={resolutionTarget?.decision === 'accepted' ? '接受申诉' : '驳回申诉'}
        onCancel={() => setResolutionTarget(null)}
        onOk={() => void handleResolve()}
        okText="确认处理"
        cancelText="取消"
      >
        <Input.TextArea
          autoFocus
          value={resolutionText}
          onChange={(event) => setResolutionText(event.target.value)}
          placeholder="请填写处理说明，系统会写入审计并通知创作者"
          rows={5}
        />
      </Modal>
    </>
  )
}

function PilotEvidenceDashboard({
  data,
}: {
  data: { metrics: PilotOperationsMetrics; weekly: PilotWeeklyEvidence }
}) {
  const { metrics, weekly } = data
  return (
    <>
      <Alert
        showIcon
        type={weekly.summary.discrepancyCount ? 'warning' : 'success'}
        className="operation-summary"
        message={`周度证据链：同意 ${weekly.summary.consented} → 领券 ${weekly.summary.claimed} → 核销 ${weekly.summary.redeemed} → Creator 报酬 ${weekly.summary.creatorPayouts} → 报告 ${weekly.summary.reports}；差异 ${weekly.summary.discrepancyCount} 笔`}
      />
      <Row gutter={[16, 16]} className="section-block">
        <Col xs={12} xl={6}>
          <Statistic
            title="重复 Campaign 率"
            value={metrics.repeatCampaignRate * 100}
            suffix="%"
            precision={1}
          />
        </Col>
        <Col xs={12} xl={6}>
          <Statistic
            title="预算扩张率"
            value={metrics.budgetExpansionRate * 100}
            suffix="%"
            precision={1}
          />
        </Col>
        <Col xs={12} xl={6}>
          <Statistic
            title="有效任务接受率"
            value={metrics.validTaskAcceptanceRate * 100}
            suffix="%"
            precision={1}
          />
        </Col>
        <Col xs={12} xl={6}>
          <Statistic
            title="可测量 Campaign 占比"
            value={metrics.measurableCampaignShare * 100}
            suffix="%"
            precision={1}
          />
        </Col>
      </Row>
      <Card
        title="逐笔证据差异清单"
        extra={
          <Typography.Text type="secondary">
            周起始：{formatDate(weekly.week.startAt)}
          </Typography.Text>
        }
      >
        <Table
          rowKey="redemptionId"
          pagination={{ pageSize: 10 }}
          scroll={{ x: 920 }}
          dataSource={weekly.discrepancies}
          locale={{ emptyText: '本周没有已验证核销记录' }}
          columns={[
            { title: '核销', dataIndex: 'redemptionId', ellipsis: true },
            {
              title: '交易金额',
              dataIndex: 'transactionAmount',
              render: (value) => formatCurrency(value),
            },
            {
              title: '同意 / 领券',
              key: 'claim',
              render: (_, row) => (row.consentedAt && row.claimedAt ? '完整' : '缺失'),
            },
            {
              title: 'Creator 报酬',
              key: 'payout',
              render: (_, row) =>
                row.creatorPayout
                  ? `${row.creatorPayout.status} · ${formatCurrency(row.creatorPayout.amount)}`
                  : row.creatorId
                    ? '缺失'
                    : '无创作者归因',
            },
            {
              title: '差异',
              dataIndex: 'missingStages',
              render: (items: string[]) =>
                items.length ? (
                  items.map((item) => (
                    <Tag color="warning" key={item}>
                      {item}
                    </Tag>
                  ))
                ) : (
                  <Tag color="success">完整</Tag>
                ),
            },
          ]}
        />
      </Card>
    </>
  )
}
function CreatorTaskQueue({
  mode,
  onReview,
  onRisk,
}: {
  mode: 'review' | 'risk'
  onReview?: (id: string, decision: 'approve' | 'reject', reason: string) => Promise<unknown>
  onRisk?: (id: string, action: 'resume' | 'violation', reason: string) => Promise<unknown>
}) {
  const [campaignId, setCampaignId] = useState('')
  const [merchantId, setMerchantId] = useState('')
  const [page, setPage] = useState(1)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [reasonModal, contextHolder] = Modal.useModal()
  const queue = useQuery({
    queryKey: ['creator-task-queue', mode, campaignId, merchantId, page],
    queryFn: () =>
      (mode === 'review' ? getCreatorTaskReviewQueue : getCreatorTaskRiskQueue)({
        campaignId: campaignId || undefined,
        merchantId: merchantId || undefined,
        page,
        pageSize: 20,
      }),
  })
  const detail = useQuery({
    queryKey: ['creator-task-workbench', selectedId],
    queryFn: () => getCreatorTaskWorkbench(selectedId!),
    enabled: Boolean(selectedId),
  })
  const askReason = (title: string, execute: (reason: string) => Promise<unknown>) =>
    reasonModal.confirm({
      title,
      content: (
        <Input.TextArea
          id="creator-task-reason"
          placeholder="请填写处理原因，系统会写入审计记录并通知创作者"
        />
      ),
      onOk: async () => {
        const reason = (
          document.getElementById('creator-task-reason') as HTMLTextAreaElement | null
        )?.value?.trim()
        if (!reason) throw new Error('请填写处理原因')
        await execute(reason)
        message.success('操作已提交')
        await queue.refetch()
        if (selectedId) await detail.refetch()
      },
    })
  const columns: ColumnsType<CreatorTaskQueueItem> = [
    {
      title: '任务',
      key: 'task',
      render: (_, row) => (
        <Space direction="vertical" size={0}>
          <Typography.Text strong>
            {row.channel} · {row.contentType}
          </Typography.Text>
          <Typography.Text
            type="secondary"
            ellipsis={{ tooltip: row.brief }}
            style={{ maxWidth: 220 }}
          >
            {row.brief}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      render: (value) => (
        <Tag
          color={value === 'risk_hold' ? 'error' : value === 'submitted' ? 'processing' : 'default'}
        >
          {value}
        </Tag>
      ),
    },
    {
      title: mode === 'risk' ? '暂停原因' : '审核留痕',
      key: 'reason',
      render: (_, row) =>
        mode === 'risk' ? row.risk.holdReason || '—' : row.review.reason || '待审核',
    },
    {
      title: '补偿 / Credits',
      key: 'economics',
      render: (_, row) => (
        <Space direction="vertical" size={0}>
          <span>
            ¥{row.economics.baseReward.toFixed(2)}
            {row.economics.compensationLockedAt ? '（已锁定）' : ''}
          </span>
          <Typography.Text type="secondary">
            Credits {row.economics.campaignCreditsConsumed}/{row.economics.campaignCreditsAllocated}
          </Typography.Text>
        </Space>
      ),
    },
    { title: '截止时间', dataIndex: 'deadline', render: formatDate },
    {
      title: '操作',
      key: 'action',
      render: (_, row) => (
        <Space wrap>
          <Button type="link" onClick={() => setSelectedId(row.id)}>
            工作台
          </Button>
          {mode === 'review' ? (
            <>
              <Button
                type="link"
                onClick={() =>
                  askReason('通过创作者任务', (reason) => onReview!(row.id, 'approve', reason))
                }
              >
                通过
              </Button>
              <Button
                danger
                type="link"
                onClick={() =>
                  askReason('驳回创作者任务', (reason) => onReview!(row.id, 'reject', reason))
                }
              >
                驳回
              </Button>
            </>
          ) : (
            <>
              <Button
                type="link"
                onClick={() =>
                  askReason('恢复创作者任务', (reason) => onRisk!(row.id, 'resume', reason))
                }
              >
                恢复
              </Button>
              <Button
                danger
                type="link"
                onClick={() =>
                  askReason('判定创作者任务违规', (reason) => onRisk!(row.id, 'violation', reason))
                }
              >
                判违规
              </Button>
            </>
          )}
        </Space>
      ),
    },
  ]
  const workbench = detail.data
  return (
    <>
      {contextHolder}
      <Card className="filter-card" size="small">
        <Space wrap>
          <Input
            allowClear
            value={campaignId}
            onChange={(event) => {
              setCampaignId(event.target.value)
              setPage(1)
            }}
            placeholder="Campaign ID"
            className="scope-input"
          />
          <Input
            allowClear
            value={merchantId}
            onChange={(event) => {
              setMerchantId(event.target.value)
              setPage(1)
            }}
            placeholder="商户 ID"
            className="scope-input"
          />
          <Button onClick={() => void queue.refetch()} loading={queue.isFetching}>
            筛选
          </Button>
        </Space>
      </Card>
      {queue.isError ? (
        <Result status="error" title="无法加载运营队列" subTitle={queue.error.message} />
      ) : (
        <Card>
          <Table
            rowKey="id"
            columns={columns}
            dataSource={queue.data?.items ?? []}
            loading={queue.isLoading}
            scroll={{ x: 980 }}
            pagination={{
              current: queue.data?.pagination.page ?? page,
              pageSize: queue.data?.pagination.pageSize ?? 20,
              total: queue.data?.pagination.total ?? 0,
              onChange: (nextPage) => setPage(nextPage),
              showSizeChanger: false,
            }}
            locale={{
              emptyText: mode === 'review' ? '当前没有待审核创作者任务' : '当前没有风控暂停任务',
            }}
          />
        </Card>
      )}
      <Modal
        open={Boolean(selectedId)}
        title="任务运营工作台"
        onCancel={() => setSelectedId(null)}
        footer={<Button onClick={() => setSelectedId(null)}>关闭</Button>}
        width={920}
      >
        {detail.isLoading ? (
          <Skeleton active paragraph={{ rows: 10 }} />
        ) : workbench ? (
          <TaskWorkbenchDetail data={workbench} />
        ) : detail.isError ? (
          <Result status="error" title="无法加载任务详情" subTitle={detail.error.message} />
        ) : null}
      </Modal>
    </>
  )
}

function TaskWorkbenchDetail({ data }: { data: CreatorTaskWorkbench }) {
  return (
    <>
      <Row gutter={[16, 16]}>
        <Col span={8}>
          <Statistic
            title="基础补偿"
            value={data.economics.compensation.baseReward}
            prefix="¥"
            precision={2}
          />
        </Col>
        <Col span={8}>
          <Statistic
            title="Campaign Credits 剩余"
            value={data.economics.campaignCredits.remaining}
            precision={2}
          />
        </Col>
        <Col span={8}>
          <Statistic title="Creator Studio 证据" value={data.evidence.length} suffix="条" />
        </Col>
      </Row>
      <Alert
        showIcon
        type="info"
        className="operation-summary"
        message={`补偿${data.economics.compensation.lockedAt ? '已于 ' + formatDate(data.economics.compensation.lockedAt) + ' 锁定' : '尚未锁定'}；Credits 已消耗 ${data.economics.campaignCredits.consumed}/${data.economics.campaignCredits.allocated}`}
      />
      <Typography.Title level={5}>内容证据与 Creator Studio 操作</Typography.Title>
      <Table
        size="small"
        rowKey="id"
        pagination={false}
        dataSource={data.evidence}
        columns={[
          {
            title: '操作',
            key: 'action',
            render: (_, row) => row.creatorStudioAction || row.contentType,
          },
          { title: '生成时间', dataIndex: 'createdAt', render: formatDate },
          {
            title: '发布记录',
            dataIndex: 'publications',
            render: (items: unknown[]) => `${items.length} 条`,
          },
        ]}
      />
      <Typography.Title level={5}>审计与通知</Typography.Title>
      <Table
        size="small"
        rowKey={(_, index) => String(index)}
        pagination={false}
        dataSource={[...data.auditRecords, ...data.notifications]}
        columns={[
          {
            title: '记录',
            key: 'record',
            render: (row: Record<string, unknown>) =>
              String(row.actionDescription || row.title || row.type || '操作记录'),
          },
          {
            title: '时间',
            key: 'created',
            render: (row: Record<string, unknown>) => formatDate(String(row.createdAt || '')),
          },
          {
            title: '详情',
            key: 'detail',
            render: (row: Record<string, unknown>) => (
              <Typography.Text type="secondary">
                {JSON.stringify(row.metadata || row.body || '—')}
              </Typography.Text>
            ),
          },
        ]}
      />
    </>
  )
}
function AuditTable<T extends object>({
  rows,
  idKey,
  columns,
  onApprove,
  onReject,
}: {
  rows: T[]
  idKey: keyof T
  columns: [string, keyof T][]
  onApprove: (id: string) => void
  onReject: (id: string) => void
}) {
  const tableColumns: ColumnsType<T> = [
    ...columns.map(([title, key]) => ({
      title,
      dataIndex: key as string,
      render: (value: unknown) => String(value ?? '—'),
    })),
    {
      title: '操作',
      key: 'action',
      render: (_, row) => (
        <Space>
          <Popconfirm title="确认通过该申请？" onConfirm={() => onApprove(String(row[idKey]))}>
            <Button type="link">通过</Button>
          </Popconfirm>
          <Button danger type="link" onClick={() => onReject(String(row[idKey]))}>
            拒绝
          </Button>
        </Space>
      ),
    },
  ]
  return (
    <Card>
      <Table
        rowKey={(row) => String(row[idKey])}
        columns={tableColumns}
        dataSource={rows}
        locale={{ emptyText: '当前没有待处理申请' }}
        scroll={{ x: 720 }}
      />
    </Card>
  )
}

function FraudTable({
  rows,
  onResolve,
}: {
  rows: FraudAlert[]
  onResolve: (id: string, action: 'dismiss' | 'review' | 'freeze_commission') => void
}) {
  const columns: ColumnsType<FraudAlert> = [
    { title: '类型', dataIndex: 'type' },
    {
      title: '级别',
      dataIndex: 'severity',
      render: (value) => (
        <Tag color={value === 'critical' ? 'error' : value === 'warning' ? 'warning' : 'gold'}>
          {value}
        </Tag>
      ),
    },
    {
      title: '置信度',
      dataIndex: 'confidence',
      render: (value) => `${Math.round(Number(value) * 100)}%`,
    },
    { title: '发生时间', dataIndex: 'createdAt', render: formatDate },
    {
      title: '操作',
      key: 'action',
      render: (_, row) => (
        <Space>
          <Button type="link" onClick={() => onResolve(row.alertId, 'review')}>
            标记已阅
          </Button>
          <Popconfirm
            title="确认冻结该分享员待结算佣金？"
            onConfirm={() => onResolve(row.alertId, 'freeze_commission')}
          >
            <Button danger type="link">
              冻结佣金
            </Button>
          </Popconfirm>
          <Button type="link" onClick={() => onResolve(row.alertId, 'dismiss')}>
            误报
          </Button>
        </Space>
      ),
    },
  ]
  return (
    <Card>
      <Table
        rowKey="alertId"
        columns={columns}
        dataSource={rows}
        locale={{ emptyText: '当前没有待处理告警' }}
        scroll={{ x: 760 }}
      />
    </Card>
  )
}

function FinanceTable({
  rows,
  pendingAmount,
  onSettle,
}: {
  rows: Reconciliation[]
  pendingAmount: number
  onSettle: (id: string) => void
}) {
  const columns: ColumnsType<Reconciliation> = [
    { title: '收入类型', dataIndex: 'type' },
    { title: '金额', dataIndex: 'amount', render: (value: number) => formatCurrency(value) },
    { title: '记账日期', dataIndex: 'date', render: formatDate },
    { title: '说明', dataIndex: 'description', render: (v) => v ?? '—' },
    {
      title: '操作',
      key: 'action',
      render: (_, row) => (
        <Popconfirm title="确认该笔收入已完成对账？" onConfirm={() => onSettle(row.id)}>
          <Button type="link">确认对账</Button>
        </Popconfirm>
      ),
    },
  ]
  return (
    <>
      <Alert
        showIcon
        type="info"
        message={`待对账平台收入：${formatCurrency(pendingAmount)}`}
        className="operation-summary"
      />
      <Card>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={rows}
          locale={{ emptyText: '没有待对账流水' }}
          scroll={{ x: 680 }}
        />
      </Card>
    </>
  )
}

function ContentTable({
  rows,
  onModerate,
}: {
  rows: ModerationContent[]
  onModerate: (id: string, decision: 'passed' | 'flagged' | 'blocked') => void
}) {
  const columns: ColumnsType<ModerationContent> = [
    { title: '类型', dataIndex: 'type' },
    { title: '平台', dataIndex: 'platform', render: (v) => v ?? '—' },
    {
      title: '内容预览',
      dataIndex: 'content',
      render: (value) => (
        <Typography.Paragraph
          ellipsis={{ rows: 2, tooltip: JSON.stringify(value) }}
          style={{ maxWidth: 330, margin: 0 }}
        >
          {JSON.stringify(value)}
        </Typography.Paragraph>
      ),
    },
    { title: '生成时间', dataIndex: 'createdAt', render: formatDate },
    {
      title: '操作',
      key: 'action',
      render: (_, row) => (
        <Space>
          <Button type="link" onClick={() => onModerate(row.id, 'passed')}>
            通过
          </Button>
          <Button type="link" onClick={() => onModerate(row.id, 'flagged')}>
            标记
          </Button>
          <Popconfirm title="确认拦截该内容？" onConfirm={() => onModerate(row.id, 'blocked')}>
            <Button danger type="link">
              拦截
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]
  return (
    <Card>
      <Table
        rowKey="id"
        columns={columns}
        dataSource={rows}
        locale={{ emptyText: '没有待审核内容' }}
        scroll={{ x: 850 }}
      />
    </Card>
  )
}

function OperationAuditTable({ rows }: { rows: OperationAuditLog[] }) {
  const columns: ColumnsType<OperationAuditLog> = [
    { title: '处理时间', dataIndex: 'createdAt', render: formatDate },
    { title: '处理人', key: 'actor', render: (_, row) => row.actorName || row.actorId || '系统' },
    { title: '动作', dataIndex: 'actionDescription' },
    {
      title: '处理对象',
      key: 'target',
      render: (_, row) => `${row.targetType}${row.targetName ? ` · ${row.targetName}` : ''}`,
    },
    {
      title: '处理依据',
      dataIndex: 'metadata',
      render: (metadata) =>
        metadata ? (
          <Typography.Paragraph
            ellipsis={{ rows: 2, tooltip: JSON.stringify(metadata) }}
            style={{ maxWidth: 280, margin: 0 }}
          >
            {JSON.stringify(metadata)}
          </Typography.Paragraph>
        ) : (
          '—'
        ),
    },
  ]
  return (
    <Card>
      <Alert
        showIcon
        type="info"
        message="审核、风控和内容处理均会写入不可变审计记录，并同步向业务主体发送站内通知。"
        className="operation-summary"
      />
      <Table
        rowKey="id"
        columns={columns}
        dataSource={rows}
        locale={{ emptyText: '暂无人工处理记录' }}
        scroll={{ x: 900 }}
      />
    </Card>
  )
}

function Metric(props: {
  title: string
  value: number
  prefix?: string
  suffix?: string
  precision?: number
}) {
  return (
    <Col xs={12} sm={8} xl={4}>
      <Statistic {...props} valueStyle={{ fontSize: 22, color: '#1a202c' }} />
    </Col>
  )
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('zh-CN').format(value)
}
function formatCurrency(value: number, maximumFractionDigits = 0) {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    maximumFractionDigits,
  }).format(value)
}
function formatPercent(value: number | null | undefined) {
  return value === null || value === undefined ? '暂无' : `${(value * 100).toFixed(1)}%`
}
function formatDate(value: string) {
  return value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '—'
}
function formatFinancialClassification(value: string) {
  return (
    {
      revenue: '收入',
      cogs: 'Creator Payout COGS',
      operating_cost: '运营成本',
      reserve: '风险准备金',
    }[value] ?? value
  )
}
function formatAppealTarget(value: CreatorTaskAppeal['target']) {
  return value === 'payout' ? '报酬争议' : '任务争议'
}
function formatAppealStatus(value: CreatorTaskAppeal['status']) {
  const labels: Record<CreatorTaskAppeal['status'], string> = {
    open: '待处理',
    accepted: '已接受',
    rejected: '已驳回',
    withdrawn: '已撤回',
  }
  const colors: Record<CreatorTaskAppeal['status'], string> = {
    open: 'warning',
    accepted: 'success',
    rejected: 'error',
    withdrawn: 'default',
  }
  return <Tag color={colors[value]}>{labels[value]}</Tag>
}
function shortId(value: string | null) {
  return value ? `${value.slice(0, 8)}...` : '—'
}
function emptyText(value: string | null) {
  return value || '—'
}
function severityLabel(value: DashboardAlert['severity']) {
  return value === 'critical' ? '严重' : value === 'warning' ? '警告' : '注意'
}
function formatAlertType(value: string) {
  return value.replaceAll('_', ' ')
}

function App() {
  const [authenticated, setAuthenticated] = useState(hasAdminSession)

  const logout = () => {
    clearAdminSession()
    setAuthenticated(false)
  }

  return authenticated ? (
    <DashboardApp onLogout={logout} />
  ) : (
    <LoginPage onAuthenticated={() => setAuthenticated(true)} />
  )
}

export default App
