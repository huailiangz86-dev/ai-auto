import {
  AlertOutlined,
  AuditOutlined,
  BarChartOutlined,
  BellOutlined,
  CheckCircleOutlined,
  FileTextOutlined,
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
  Tooltip,
  Typography,
  message,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useEffect, useMemo, useState } from 'react'

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
  type PendingAgent,
  type PendingMerchant,
  type Reconciliation,
  getCreatorTaskReviewQueue,
  getCreatorTaskRiskQueue,
  getCreatorTaskWorkbench,
  reviewCreatorTask,
  resolveCreatorTaskRisk,
  type CreatorTaskQueueItem,
  type CreatorTaskWorkbench,
} from './api/operations'

const { Header, Sider, Content } = Layout

const pendingMeta: Record<PendingAction['type'], { label: string; icon: React.ReactNode; color: string }> = {
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
    queryFn: () => getDashboard({ merchantId: merchantId || undefined, agentId: agentId || undefined, trendDays }),
    refetchInterval: (context) => context.state.data?.refresh.kpiSeconds ? context.state.data.refresh.kpiSeconds * 1000 : 10_000,
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
        <div className="brand"><span className="brand-mark">A</span>{!collapsed && <span>AI auto</span>}</div>
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
            { key: 'creator-review', icon: <AuditOutlined />, label: '创作者任务审核' },
            { key: 'risk-holds', icon: <SafetyCertificateOutlined />, label: '任务风控暂停' },
            { key: 'finance', icon: <WalletOutlined />, label: '财务对账' },
            { key: 'fraud', icon: <SafetyCertificateOutlined />, label: '风控中心' },
            { key: 'content', icon: <AuditOutlined />, label: '内容审核' },
            { key: 'audit', icon: <FileTextOutlined />, label: '操作审计' },
          ]}
        />
      </Sider>
      <Layout>
        <Header className="app-header">
          <Button type="text" aria-label="收起或展开导航" icon={<MenuFoldOutlined rotate={collapsed ? 180 : 0} />} onClick={() => setCollapsed(!collapsed)} />
          <Space size="large">
            <Badge count={(query.data?.alerts.summary.critical ?? 0) + (query.data?.alerts.summary.warning ?? 0)} size="small">
              <BellOutlined className="header-bell" aria-label="告警" />
            </Badge>
            <span>管理员</span>
            <Button type="text" aria-label="退出登录" icon={<LogoutOutlined />} onClick={onLogout}>退出</Button>
          </Space>
        </Header>
        <Content className="dashboard-content">
          {activeKey === 'dashboard' ? <>
            <div className="page-heading">
            <div>
              <Typography.Title level={2}>运营大屏</Typography.Title>
              <Typography.Text type="secondary">{scopeTitle} · KPI 每 {query.data?.refresh.kpiSeconds ?? 10} 秒刷新</Typography.Text>
            </div>
            <Button icon={<ReloadOutlined spin={query.isFetching} />} onClick={() => void query.refetch()} loading={query.isFetching}>刷新数据</Button>
          </div>

            <Card className="filter-card" size="small">
            <Space wrap size="middle">
              <span className="filter-label">数据范围</span>
              <Input allowClear value={merchantId} onChange={(event) => setMerchantId(event.target.value)} placeholder="输入商户 ID 下钻" aria-label="商户 ID" className="scope-input" />
              <Select
                allowClear
                disabled={!merchantId}
                value={agentId || undefined}
                onChange={(value) => setAgentId(value ?? '')}
                placeholder={merchantId ? '选择该商户的分享员下钻' : '请先输入商户 ID'}
                aria-label="分享员 ID"
                className="scope-input"
                loading={agentOptionsQuery.isFetching}
                notFoundContent={agentOptionsQuery.isError ? '分享员列表加载失败' : '该商户暂无已绑定分享员'}
                options={(agentOptionsQuery.data ?? []).map((agent) => ({ value: agent.id, label: `${agent.nickname || '未命名分享员'}（${agent.phone}）` }))}
              />
              <Select value={trendDays} onChange={setTrendDays} aria-label="趋势天数" options={[7, 14, 30, 60, 90].map((value) => ({ value, label: `近 ${value} 天` }))} />
              {(merchantId || agentId) && <Button type="link" onClick={() => { setMerchantId(''); setAgentId('') }}>回到平台视图</Button>}
            </Space>
          </Card>

            {query.isLoading ? <DashboardSkeleton /> : query.isError ? <Result status="error" title="无法加载运营数据" subTitle={query.error.message} extra={<Button type="primary" onClick={() => void query.refetch()}>重试</Button>} /> : query.data ? <Dashboard data={query.data} onNavigate={setActiveKey} /> : null}
          </> : <OperationsPage activeKey={activeKey} />}
        </Content>
      </Layout>
    </Layout>
  )
}

function DashboardSkeleton() {
  return <Card><Skeleton active paragraph={{ rows: 18 }} /></Card>
}

function Dashboard({ data, onNavigate }: { data: Awaited<ReturnType<typeof getDashboard>>; onNavigate: (key: string) => void }) {
  const alertColumns: ColumnsType<DashboardAlert> = [
    { title: '告警类型', dataIndex: 'type', render: (value: string) => formatAlertType(value) },
    { title: '级别', dataIndex: 'severity', render: (value: DashboardAlert['severity']) => <Tag color={value === 'critical' ? 'error' : value === 'warning' ? 'warning' : 'gold'}>{severityLabel(value)}</Tag> },
    { title: '发生时间', dataIndex: 'occurredAt', render: (value: string) => new Date(value).toLocaleString('zh-CN', { hour12: false }) },
    { title: '状态', dataIndex: 'status', render: (value: string) => <Tag>{value === 'pending' ? '待处理' : value}</Tag> },
  ]
  return (
    <>
      <Row gutter={[16, 16]} className="kpi-grid">
        <Col xs={24} sm={12} xl={6}><KpiCard label="新增商户" value={formatNumber(data.today.newMerchants)} description={`本月新增 ${formatNumber(data.monthly.newMerchants)}`} /></Col>
        <Col xs={24} sm={12} xl={6}><KpiCard label="活跃分享员" value={formatNumber(data.today.activeAgents)} description={`本月新增 ${formatNumber(data.monthly.newAgents)}`} /></Col>
        <Col xs={24} sm={12} xl={6}><KpiCard label="今日 GMV" value={formatCurrency(data.today.gmv)} description={`核销 ${formatNumber(data.today.redemptions)} 笔`} /></Col>
        <Col xs={24} sm={12} xl={6}><KpiCard label="平台收入" value={formatCurrency(data.today.platformRevenue)} description={`佣金支出 ${formatCurrency(data.today.commissionPayout)}`} /></Col>
      </Row>

      <section className="section-block">
        <div className="section-heading"><h2>趋势洞察</h2><span>按日统计 · 截止 {data.date}</span></div>
        <div className="trends-grid">
          <TrendChart title="GMV 趋势" color="#2c5282" suffix=" 元" points={data.trends.gmv} />
          <TrendChart title="分享员增长" color="#276749" suffix=" 人" points={data.trends.agentGrowth} />
          <TrendChart title="佣金支出" color="#805ad5" suffix=" 元" points={data.trends.commissionPayout} />
          <TrendChart title="商户续费率" color="#b7791f" suffix="%" points={data.trends.merchantRetention.map((point) => ({ ...point, value: point.value * 100 }))} />
        </div>
      </section>

      <Row gutter={[16, 16]} className="section-block">
        <Col xs={24} xl={15}>
          <Card title={<span><AlertOutlined /> 告警中心</span>} extra={<span className="alert-summary"><Tag color="error">严重 {data.alerts.summary.critical}</Tag><Tag color="warning">警告 {data.alerts.summary.warning}</Tag><Tag color="gold">注意 {data.alerts.summary.notice}</Tag></span>}>
            {data.alerts.items.length ? <Table rowKey="id" columns={alertColumns} dataSource={data.alerts.items} pagination={false} size="small" scroll={{ x: 560 }} /> : <Empty description="当前没有待处理告警" />}
            {(data.alerts.summary.paymentFailures > 0 || data.alerts.summary.systemErrors > 0) && <Alert className="system-alert" type="warning" showIcon message={`订阅支付失败 ${data.alerts.summary.paymentFailures} 条，系统异常 ${data.alerts.summary.systemErrors} 条`} />}
          </Card>
        </Col>
        <Col xs={24} xl={9}>
          <Card title={<span><CheckCircleOutlined /> 待办事项</span>} className="pending-card">
            {data.pendingActions.map((item) => {
              const meta = pendingMeta[item.type]
              return <div className="pending-row" key={item.type}><span className="pending-icon" style={{ color: meta.color }}>{meta.icon}</span><div><strong>{item.count} 条</strong><span>{meta.label}</span></div><Button type="link" onClick={() => onNavigate(pendingRoute[item.type])}>立即处理</Button></div>
            })}
          </Card>
        </Col>
      </Row>

      <section className="section-block"><div className="section-heading"><h2>平台核心指标</h2><span>累计与当月汇总</span></div><Card><Row gutter={[24, 24]}>
        <Metric title="商户总数" value={data.total.merchants} />
        <Metric title="分享员总数" value={data.total.agents} />
        <Metric title="累计 GMV" value={data.total.cumulativeGmv} prefix="¥" precision={0} />
        <Metric title="累计平台收入" value={data.total.cumulativeRevenue} prefix="¥" precision={0} />
        <Metric title="订阅续费率" value={data.monthly.subscriptionRenewalRate * 100} suffix="%" precision={1} />
        <Metric title="分享员留存率" value={data.monthly.agentRetentionRate * 100} suffix="%" precision={1} />
      </Row></Card></section>
    </>
  )
}

const pendingRoute: Record<PendingAction['type'], string> = { fraud_alert: 'fraud', merchant_audit: 'merchants', agent_audit: 'agents', content_moderation: 'content' }

type OperationKey = 'merchants' | 'agents' | 'creator-review' | 'risk-holds' | 'finance' | 'fraud' | 'content' | 'audit'
const operationTitles: Record<OperationKey, string> = { merchants: '商户', agents: '分享员管理', 'creator-review': '创作者任务审核', 'risk-holds': '任务风控暂停', finance: '财务对账', fraud: '风控中心', content: '内容审核', audit: '操作审计' }

function OperationsPage({ activeKey }: { activeKey: string }) {
  const key = activeKey as OperationKey
  const [reasonModal, contextHolder] = Modal.useModal()
  const merchants = useQuery({ queryKey: ['pending-merchants'], queryFn: getPendingMerchants, enabled: key === 'merchants' })
  const agents = useQuery({ queryKey: ['pending-agents'], queryFn: getPendingAgents, enabled: key === 'agents' })
  const fraud = useQuery({ queryKey: ['fraud-alerts'], queryFn: getFraudAlerts, enabled: key === 'fraud' })
  const finance = useQuery({ queryKey: ['finance-reconciliations'], queryFn: getReconciliations, enabled: key === 'finance' })
  const contents = useQuery({ queryKey: ['moderation-contents'], queryFn: getModerationContents, enabled: key === 'content' })
  const auditLogs = useQuery({ queryKey: ['operation-audit-logs'], queryFn: getOperationAuditLogs, enabled: key === 'audit' })
  const refresh = () => { void merchants.refetch(); void agents.refetch(); void fraud.refetch(); void finance.refetch(); void contents.refetch(); void auditLogs.refetch() }
  const run = async (action: () => Promise<unknown>) => { try { await action(); message.success('操作已提交'); refresh() } catch (error) { message.error(error instanceof Error ? error.message : '操作失败') } }
  const askReason = (title: string, onOk: (reason: string) => Promise<unknown>) => reasonModal.confirm({ title, content: <Input.TextArea id="operation-reason" placeholder="请填写处理原因" />, onOk: async () => { const value = (document.getElementById('operation-reason') as HTMLTextAreaElement | null)?.value?.trim(); if (!value) throw new Error('请填写处理原因'); await run(() => onOk(value)) } })
  const loading = merchants.isLoading || agents.isLoading || fraud.isLoading || finance.isLoading || contents.isLoading || auditLogs.isLoading
  const error = merchants.error || agents.error || fraud.error || finance.error || contents.error || auditLogs.error
  return <>
    {contextHolder}
    <div className="page-heading"><div><Typography.Title level={2}>{operationTitles[key]}</Typography.Title><Typography.Text type="secondary">所有处理动作均会即时写回业务状态。</Typography.Text></div><Button icon={<ReloadOutlined spin={loading} />} onClick={refresh}>刷新</Button></div>
    {!error && key === 'merchants' ? <Tabs defaultActiveKey="review" items={[
      { key: 'review', label: `资质审核（${merchants.data?.pagination.total ?? 0}）`, children: <AuditTable rows={merchants.data?.items ?? []} idKey="merchantId" columns={[['商户', 'businessName'], ['联系人', 'contactName'], ['联系电话', 'phone'], ['行业', 'industryCategory'], ['申请时间', 'appliedAt']]} onApprove={(id) => run(() => approveMerchant(id))} onReject={(id) => askReason('拒绝商户申请', (reason) => rejectMerchant(id, reason))} /> },
      { key: 'management', label: '全量商户管理', children: <LifecycleManagement kind="merchants" /> },
    ]} /> : null}
    {!error && key === 'creator-review' ? <CreatorTaskQueue mode="review" onReview={(id, decision, reason) => run(() => reviewCreatorTask(id, decision, reason))} /> : null}
    {!error && key === 'risk-holds' ? <CreatorTaskQueue mode="risk" onRisk={(id, action, reason) => run(() => resolveCreatorTaskRisk(id, action, reason))} /> : null}    {error ? <Result status="error" title="无法加载业务数据" subTitle={error.message} extra={<Button onClick={refresh}>重试</Button>} /> : null}
    {!error && key === 'agents' ? <Tabs defaultActiveKey="review" items={[
      { key: 'review', label: `分享员审核（${agents.data?.pagination.total ?? 0}）`, children: <AuditTable rows={agents.data?.items ?? []} idKey="agentId" columns={[['昵称', 'nickname'], ['联系电话', 'phone'], ['申请时间', 'registeredAt']]} onApprove={(id) => run(() => approveAgent(id))} onReject={(id) => askReason('拒绝分享员申请', (reason) => rejectAgent(id, reason))} /> },
      { key: 'management', label: '达人管理', children: <LifecycleManagement kind="creators" /> },
    ]} /> : null}
    {!error && key === 'fraud' ? <FraudTable rows={fraud.data?.items ?? []} onResolve={(id, action) => action === 'review' ? run(() => resolveFraudAlert(id, action)) : askReason(action === 'dismiss' ? '标记风控告警为误报' : '冻结待结算佣金', (note) => resolveFraudAlert(id, action, note))} /> : null}
    {!error && key === 'finance' ? <FinanceTable rows={finance.data?.items ?? []} pendingAmount={finance.data?.summary.pendingAmount ?? 0} onSettle={(id) => run(() => settleReconciliation(id))} /> : null}
    {!error && key === 'content' ? <ContentTable rows={contents.data?.items ?? []} onModerate={(id, decision) => decision === 'passed' ? run(() => moderateContent(id, decision)) : askReason(decision === 'flagged' ? '标记内容并要求修改' : '拦截内容', (reason) => moderateContent(id, decision, reason))} /> : null}
    {!error && key === 'audit' ? <OperationAuditTable rows={auditLogs.data?.items ?? []} /> : null}
  </>
}

function CreatorTaskQueue({ mode, onReview, onRisk }: {
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
    queryFn: () => (mode === 'review' ? getCreatorTaskReviewQueue : getCreatorTaskRiskQueue)({ campaignId: campaignId || undefined, merchantId: merchantId || undefined, page, pageSize: 20 }),
  })
  const detail = useQuery({ queryKey: ['creator-task-workbench', selectedId], queryFn: () => getCreatorTaskWorkbench(selectedId!), enabled: Boolean(selectedId) })
  const askReason = (title: string, execute: (reason: string) => Promise<unknown>) => reasonModal.confirm({
    title,
    content: <Input.TextArea id="creator-task-reason" placeholder="请填写处理原因，系统会写入审计记录并通知创作者" />,
    onOk: async () => {
      const reason = (document.getElementById('creator-task-reason') as HTMLTextAreaElement | null)?.value?.trim()
      if (!reason) throw new Error('请填写处理原因')
      await execute(reason)
      message.success('操作已提交')
      await queue.refetch()
      if (selectedId) await detail.refetch()
    },
  })
  const columns: ColumnsType<CreatorTaskQueueItem> = [
    { title: '任务', key: 'task', render: (_, row) => <Space direction="vertical" size={0}><Typography.Text strong>{row.channel} · {row.contentType}</Typography.Text><Typography.Text type="secondary" ellipsis={{ tooltip: row.brief }} style={{ maxWidth: 220 }}>{row.brief}</Typography.Text></Space> },
    { title: '状态', dataIndex: 'status', render: (value) => <Tag color={value === 'risk_hold' ? 'error' : value === 'submitted' ? 'processing' : 'default'}>{value}</Tag> },
    { title: mode === 'risk' ? '暂停原因' : '审核留痕', key: 'reason', render: (_, row) => mode === 'risk' ? (row.risk.holdReason || '—') : (row.review.reason || '待审核') },
    { title: '补偿 / Credits', key: 'economics', render: (_, row) => <Space direction="vertical" size={0}><span>¥{row.economics.baseReward.toFixed(2)}{row.economics.compensationLockedAt ? '（已锁定）' : ''}</span><Typography.Text type="secondary">Credits {row.economics.campaignCreditsConsumed}/{row.economics.campaignCreditsAllocated}</Typography.Text></Space> },
    { title: '截止时间', dataIndex: 'deadline', render: formatDate },
    { title: '操作', key: 'action', render: (_, row) => <Space wrap><Button type="link" onClick={() => setSelectedId(row.id)}>工作台</Button>{mode === 'review' ? <><Button type="link" onClick={() => askReason('通过创作者任务', (reason) => onReview!(row.id, 'approve', reason))}>通过</Button><Button danger type="link" onClick={() => askReason('驳回创作者任务', (reason) => onReview!(row.id, 'reject', reason))}>驳回</Button></> : <><Button type="link" onClick={() => askReason('恢复创作者任务', (reason) => onRisk!(row.id, 'resume', reason))}>恢复</Button><Button danger type="link" onClick={() => askReason('判定创作者任务违规', (reason) => onRisk!(row.id, 'violation', reason))}>判违规</Button></>}</Space> },
  ]
  const workbench = detail.data
  return <>
    {contextHolder}
    <Card className="filter-card" size="small"><Space wrap><Input allowClear value={campaignId} onChange={(event) => { setCampaignId(event.target.value); setPage(1) }} placeholder="Campaign ID" className="scope-input" /><Input allowClear value={merchantId} onChange={(event) => { setMerchantId(event.target.value); setPage(1) }} placeholder="商户 ID" className="scope-input" /><Button onClick={() => void queue.refetch()} loading={queue.isFetching}>筛选</Button></Space></Card>
    {queue.isError ? <Result status="error" title="无法加载运营队列" subTitle={queue.error.message} /> : <Card><Table rowKey="id" columns={columns} dataSource={queue.data?.items ?? []} loading={queue.isLoading} scroll={{ x: 980 }} pagination={{ current: queue.data?.pagination.page ?? page, pageSize: queue.data?.pagination.pageSize ?? 20, total: queue.data?.pagination.total ?? 0, onChange: (nextPage) => setPage(nextPage), showSizeChanger: false }} locale={{ emptyText: mode === 'review' ? '当前没有待审核创作者任务' : '当前没有风控暂停任务' }} /></Card>}
    <Modal open={Boolean(selectedId)} title="任务运营工作台" onCancel={() => setSelectedId(null)} footer={<Button onClick={() => setSelectedId(null)}>关闭</Button>} width={920}>
      {detail.isLoading ? <Skeleton active paragraph={{ rows: 10 }} /> : workbench ? <TaskWorkbenchDetail data={workbench} /> : detail.isError ? <Result status="error" title="无法加载任务详情" subTitle={detail.error.message} /> : null}
    </Modal>
  </>
}

function TaskWorkbenchDetail({ data }: { data: CreatorTaskWorkbench }) {
  return <>
    <Row gutter={[16, 16]}><Col span={8}><Statistic title="基础补偿" value={data.economics.compensation.baseReward} prefix="¥" precision={2} /></Col><Col span={8}><Statistic title="Campaign Credits 剩余" value={data.economics.campaignCredits.remaining} precision={2} /></Col><Col span={8}><Statistic title="Creator Studio 证据" value={data.evidence.length} suffix="条" /></Col></Row>
    <Alert showIcon type="info" className="operation-summary" message={`补偿${data.economics.compensation.lockedAt ? '已于 ' + formatDate(data.economics.compensation.lockedAt) + ' 锁定' : '尚未锁定'}；Credits 已消耗 ${data.economics.campaignCredits.consumed}/${data.economics.campaignCredits.allocated}`} />
    <Typography.Title level={5}>内容证据与 Creator Studio 操作</Typography.Title><Table size="small" rowKey="id" pagination={false} dataSource={data.evidence} columns={[{ title: '操作', key: 'action', render: (_, row) => row.creatorStudioAction || row.contentType }, { title: '生成时间', dataIndex: 'createdAt', render: formatDate }, { title: '发布记录', dataIndex: 'publications', render: (items: unknown[]) => `${items.length} 条` }]} />
    <Typography.Title level={5}>审计与通知</Typography.Title><Table size="small" rowKey={(_, index) => String(index)} pagination={false} dataSource={[...data.auditRecords, ...data.notifications]} columns={[{ title: '记录', key: 'record', render: (row: Record<string, unknown>) => String(row.actionDescription || row.title || row.type || '操作记录') }, { title: '时间', key: 'created', render: (row: Record<string, unknown>) => formatDate(String(row.createdAt || '')) }, { title: '详情', key: 'detail', render: (row: Record<string, unknown>) => <Typography.Text type="secondary">{JSON.stringify(row.metadata || row.body || '—')}</Typography.Text> }]} />
  </>
}
function AuditTable<T extends Record<string, unknown>>({ rows, idKey, columns, onApprove, onReject }: { rows: T[]; idKey: keyof T; columns: [string, keyof T][]; onApprove: (id: string) => void; onReject: (id: string) => void }) {
  const tableColumns: ColumnsType<T> = [...columns.map(([title, key]) => ({ title, dataIndex: key as string, render: (value: unknown) => String(value ?? '—') })), { title: '操作', key: 'action', render: (_, row) => <Space><Popconfirm title="确认通过该申请？" onConfirm={() => onApprove(String(row[idKey]))}><Button type="link">通过</Button></Popconfirm><Button danger type="link" onClick={() => onReject(String(row[idKey]))}>拒绝</Button></Space> }]
  return <Card><Table rowKey={(row) => String(row[idKey])} columns={tableColumns} dataSource={rows} locale={{ emptyText: '当前没有待处理申请' }} scroll={{ x: 720 }} /></Card>
}

function FraudTable({ rows, onResolve }: { rows: FraudAlert[]; onResolve: (id: string, action: 'dismiss' | 'review' | 'freeze_commission') => void }) {
  const columns: ColumnsType<FraudAlert> = [{ title: '类型', dataIndex: 'type' }, { title: '级别', dataIndex: 'severity', render: (value) => <Tag color={value === 'critical' ? 'error' : value === 'warning' ? 'warning' : 'gold'}>{value}</Tag> }, { title: '置信度', dataIndex: 'confidence', render: (value) => `${Math.round(Number(value) * 100)}%` }, { title: '发生时间', dataIndex: 'createdAt', render: formatDate }, { title: '操作', key: 'action', render: (_, row) => <Space><Button type="link" onClick={() => onResolve(row.alertId, 'review')}>标记已阅</Button><Popconfirm title="确认冻结该分享员待结算佣金？" onConfirm={() => onResolve(row.alertId, 'freeze_commission')}><Button danger type="link">冻结佣金</Button></Popconfirm><Button type="link" onClick={() => onResolve(row.alertId, 'dismiss')}>误报</Button></Space> }]
  return <Card><Table rowKey="alertId" columns={columns} dataSource={rows} locale={{ emptyText: '当前没有待处理告警' }} scroll={{ x: 760 }} /></Card>
}

function FinanceTable({ rows, pendingAmount, onSettle }: { rows: Reconciliation[]; pendingAmount: number; onSettle: (id: string) => void }) {
  const columns: ColumnsType<Reconciliation> = [{ title: '收入类型', dataIndex: 'type' }, { title: '金额', dataIndex: 'amount', render: formatCurrency }, { title: '记账日期', dataIndex: 'date', render: formatDate }, { title: '说明', dataIndex: 'description', render: (v) => v ?? '—' }, { title: '操作', key: 'action', render: (_, row) => <Popconfirm title="确认该笔收入已完成对账？" onConfirm={() => onSettle(row.id)}><Button type="link">确认对账</Button></Popconfirm> }]
  return <><Alert showIcon type="info" message={`待对账平台收入：${formatCurrency(pendingAmount)}`} className="operation-summary" /><Card><Table rowKey="id" columns={columns} dataSource={rows} locale={{ emptyText: '没有待对账流水' }} scroll={{ x: 680 }} /></Card></>
}

function ContentTable({ rows, onModerate }: { rows: ModerationContent[]; onModerate: (id: string, decision: 'passed' | 'flagged' | 'blocked') => void }) {
  const columns: ColumnsType<ModerationContent> = [{ title: '类型', dataIndex: 'type' }, { title: '平台', dataIndex: 'platform', render: (v) => v ?? '—' }, { title: '内容预览', dataIndex: 'content', render: (value) => <Typography.Paragraph ellipsis={{ rows: 2, tooltip: JSON.stringify(value) }} style={{ maxWidth: 330, margin: 0 }}>{JSON.stringify(value)}</Typography.Paragraph> }, { title: '生成时间', dataIndex: 'createdAt', render: formatDate }, { title: '操作', key: 'action', render: (_, row) => <Space><Button type="link" onClick={() => onModerate(row.id, 'passed')}>通过</Button><Button type="link" onClick={() => onModerate(row.id, 'flagged')}>标记</Button><Popconfirm title="确认拦截该内容？" onConfirm={() => onModerate(row.id, 'blocked')}><Button danger type="link">拦截</Button></Popconfirm></Space> }]
  return <Card><Table rowKey="id" columns={columns} dataSource={rows} locale={{ emptyText: '没有待审核内容' }} scroll={{ x: 850 }} /></Card>
}

function OperationAuditTable({ rows }: { rows: OperationAuditLog[] }) {
  const columns: ColumnsType<OperationAuditLog> = [
    { title: '处理时间', dataIndex: 'createdAt', render: formatDate },
    { title: '处理人', key: 'actor', render: (_, row) => row.actorName || row.actorId || '系统' },
    { title: '动作', dataIndex: 'actionDescription' },
    { title: '处理对象', key: 'target', render: (_, row) => `${row.targetType}${row.targetName ? ` · ${row.targetName}` : ''}` },
    { title: '处理依据', dataIndex: 'metadata', render: (metadata) => metadata ? <Typography.Paragraph ellipsis={{ rows: 2, tooltip: JSON.stringify(metadata) }} style={{ maxWidth: 280, margin: 0 }}>{JSON.stringify(metadata)}</Typography.Paragraph> : '—' },
  ]
  return <Card><Alert showIcon type="info" message="审核、风控和内容处理均会写入不可变审计记录，并同步向业务主体发送站内通知。" className="operation-summary" /><Table rowKey="id" columns={columns} dataSource={rows} locale={{ emptyText: '暂无人工处理记录' }} scroll={{ x: 900 }} /></Card>
}

function Metric(props: { title: string; value: number; prefix?: string; suffix?: string; precision?: number }) {
  return <Col xs={12} sm={8} xl={4}><Statistic {...props} valueStyle={{ fontSize: 22, color: '#1a202c' }} /></Col>
}

function formatNumber(value: number) { return new Intl.NumberFormat('zh-CN').format(value) }
function formatCurrency(value: number) { return new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY', maximumFractionDigits: 0 }).format(value) }
function formatDate(value: string) { return value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '—' }
function severityLabel(value: DashboardAlert['severity']) { return value === 'critical' ? '严重' : value === 'warning' ? '警告' : '注意' }
function formatAlertType(value: string) { return value.replaceAll('_', ' ') }

function App() {
  const [authenticated, setAuthenticated] = useState(hasAdminSession)

  const logout = () => {
    clearAdminSession()
    setAuthenticated(false)
  }

  return authenticated
    ? <DashboardApp onLogout={logout} />
    : <LoginPage onAuthenticated={() => setAuthenticated(true)} />
}

export default App

