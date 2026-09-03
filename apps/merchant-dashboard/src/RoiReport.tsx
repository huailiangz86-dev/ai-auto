import { useMutation, useQuery } from '@tanstack/react-query'
import {
  Alert,
  Button,
  Card,
  Col,
  Empty,
  Form,
  Input,
  InputNumber,
  Progress,
  Row,
  Select,
  Spin,
  Statistic,
  Table,
  Tag,
  Typography,
} from 'antd'
import { useEffect, useState } from 'react'
import { api } from './api'

const money = (value: number | null | undefined) =>
  new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' }).format(Number(value ?? 0))
const shortId = (value: string | null | undefined) => (value ? `${value.slice(0, 8)}…` : '—')

export default function RoiReport() {
  const plans = useQuery({
    queryKey: ['growth-plans-for-report'],
    queryFn: () => api<any>('/merchant/growth-plans?page=1&pageSize=100'),
  })
  const [planId, setPlanId] = useState<string>()
  const reportPlans = (plans.data?.items ?? []).filter((plan: any) => plan.status === 'approved')
  useEffect(() => {
    if (!planId && reportPlans[0]?.planId) setPlanId(reportPlans[0].planId)
  }, [planId, reportPlans])
  const report = useQuery({
    queryKey: ['growth-roi-report', planId],
    queryFn: () => api<any>(`/merchant/growth-plans/${planId}/report`),
    enabled: Boolean(planId),
  })
  const measurement = useMutation({
    mutationFn: (values: any) => api(`/merchant/growth-plans/${planId}/incrementality`, {
      method: 'POST', body: JSON.stringify(values),
    }),
    onSuccess: () => void report.refetch(),
  })
  const data = report.data
  return (
    <>
      <div className="heading">
        <div>
          <Typography.Title level={2}>ROI 与效果报告</Typography.Title>
          <Typography.Text type="secondary">
            同一视图呈现目标、可验证归因、投入与证据链；增量结果只在具备测量方法后显示。
          </Typography.Text>
        </div>
      </div>
      <Card className="section" size="small">
        <Select
          className="report-select"
          loading={plans.isLoading}
          value={planId}
          onChange={setPlanId}
          placeholder="选择增长计划"
          options={reportPlans.map((plan: any) => ({
            value: plan.planId,
            label: `${plan.title ?? plan.growthTask?.goalMetric ?? '增长计划'} · 已批准`,
          }))}
        />
      </Card>
      {report.isLoading && <Spin />}
      {report.error && <Alert type="error" showIcon message={(report.error as Error).message} />}
      {!plans.isLoading && !planId && <Empty description="还没有可查看的增长计划" />}
      {data && (
        <>
          <Card
            className="section"
            title={data.campaign.name}
            extra={<Tag color="processing">{data.campaign.status}</Tag>}
          >
            <Row gutter={[16, 16]}>
              <Col xs={24} lg={8}>
                <Typography.Text strong>{data.goal.metric}</Typography.Text>
                <Statistic value={data.goal.actualValue} suffix={`/ ${data.goal.targetValue}`} />
                <Progress
                  percent={Math.min(100, Math.round((data.goal.targetProgress ?? 0) * 100))}
                  status="active"
                />
              </Col>
              <Col xs={12} lg={4}>
                <Statistic title="已验证核销/订单" value={data.verified.orders} />
              </Col>
              <Col xs={12} lg={4}>
                <Statistic title="已验证新客" value={data.verified.newCustomers} />
              </Col>
              <Col xs={12} lg={4}>
                <Statistic title="已验证 GMV" value={data.verified.gmv} prefix="¥" precision={2} />
              </Col>
              <Col xs={12} lg={4}>
                <Statistic title="ROI" value={data.investment.roi ?? '—'} precision={4} />
              </Col>
            </Row>
          </Card>
          <Row gutter={[16, 16]} className="section">
            <Col xs={24} lg={12}>
              <Card title="已验证结果" extra={<Tag color="success">已验证归因</Tag>}>
                <Typography.Paragraph>{data.verified.definition}</Typography.Paragraph>
                <Row>
                  <Col span={12}>归因锁定：{data.verified.attributionLocks}</Col>
                  <Col span={12}>可追溯交易：{data.evidence.summary.verifiedTransactions}</Col>
                </Row>
              </Card>
            </Col>
            <Col xs={24} lg={12}>
              <Card
                title="增量结果"
                extra={<Tag color={data.incremental.status === 'measured' ? 'processing' : 'default'}>{data.incremental.status === 'measured' ? '已测量' : '尚未测量'}</Tag>}
              >
                {data.incremental.status === 'measured' ? (
                  <>
                    <Row gutter={[16, 16]}>
                      <Col span={12}><Statistic title="增量订单" value={data.incremental.orders} precision={2} /></Col>
                      <Col span={12}><Statistic title="增量 GMV" value={data.incremental.gmv} prefix="¥" precision={2} /></Col>
                    </Row>
                    <Typography.Paragraph className="section">{data.incremental.method}</Typography.Paragraph>
                    <Typography.Text type="secondary">{data.incremental.assumptions.join(' ')}</Typography.Text>
                  </>
                ) : (
                  <>
                    <Alert
                      type="info"
                      showIcon
                      message={data.incremental.method}
                      description={data.incremental.assumptions.join(' ')}
                    />
                    <Form
                      className="section"
                      layout="vertical"
                      initialValues={{ method: 'geo_holdout' }}
                      onFinish={(values) => measurement.mutate(values)}
                    >
                      <Typography.Text strong>录入对照组测量</Typography.Text>
                      <Typography.Paragraph type="secondary">
                        请使用同一统计口径填写基线期和观察期数据；系统会以双重差分计算增量。
                      </Typography.Paragraph>
                      <Form.Item name="method" label="对照方法" rules={[{ required: true }]}>
                        <Select options={[{ value: 'geo_holdout', label: '地域对照组' }, { value: 'audience_holdout', label: '受众对照组' }]} />
                      </Form.Item>
                      <Row gutter={12}>
                        <Col span={12}><Form.Item name="windowStartAt" label="观察开始（ISO 时间）" rules={[{ required: true }]}><Input placeholder="2026-09-01T00:00:00Z" /></Form.Item></Col>
                        <Col span={12}><Form.Item name="windowEndAt" label="观察结束（ISO 时间）" rules={[{ required: true }]}><Input placeholder="2026-09-15T00:00:00Z" /></Form.Item></Col>
                      </Row>
                      <Row gutter={12}>
                        {[
                          ['treatmentBaselineOrders', '实验组基线订单'], ['controlBaselineOrders', '对照组基线订单'],
                          ['treatmentObservedOrders', '实验组观察订单'], ['controlObservedOrders', '对照组观察订单'],
                          ['treatmentBaselineGmv', '实验组基线 GMV'], ['controlBaselineGmv', '对照组基线 GMV'],
                          ['treatmentObservedGmv', '实验组观察 GMV'], ['controlObservedGmv', '对照组观察 GMV'],
                        ].map(([name, label]) => <Col xs={12} key={name}><Form.Item name={name} label={label} rules={[{ required: true }]}><InputNumber min={0} precision={2} className="full-width" /></Form.Item></Col>)}
                      </Row>
                      {measurement.error && <Alert type="error" showIcon message={(measurement.error as Error).message} />}
                      <Button type="primary" htmlType="submit" loading={measurement.isPending}>计算增量结果</Button>
                    </Form>
                  </>
                )}
              </Card>
            </Col>
          </Row>
          <Card
            className="section"
            title="投入、毛利与 ROI"
            extra={
              <Typography.Text type="secondary">
                已投入 {money(data.investment.total)} / 计划 {money(data.investment.planned)}
              </Typography.Text>
            }
          >
            <Table
              pagination={false}
              rowKey="name"
              dataSource={[
                {
                  name: '创作者报酬',
                  actual: data.investment.creatorPayout,
                  note: '佣金结算或 COGS 账本，取可追溯的较大已发生金额',
                },
                {
                  name: 'Campaign Credits',
                  actual: data.investment.campaignCreditsCost,
                  note: `已消耗 ${data.investment.campaignCreditsConsumed} Credits；费用按已记账金额统计`,
                },
                {
                  name: '优惠成本',
                  actual: data.investment.discountCost,
                  note: '已验证订单的优惠抵扣',
                },
                {
                  name: '渠道/运营成本',
                  actual: data.investment.channelCost,
                  note: '已记账的渠道与运营成本',
                },
                {
                  name: '风险准备金',
                  actual: data.investment.riskReserve,
                  note: '已发生、已记账准备金',
                },
                {
                  name: '总投入',
                  actual: data.investment.total,
                  note: '仅计入已发生且可追溯的成本',
                },
                { name: '毛利', actual: data.investment.grossProfit, note: '已验证 GMV − 总投入' },
              ]}
              columns={[
                { title: '项目', dataIndex: 'name' },
                { title: '金额', dataIndex: 'actual', render: money },
                { title: '口径', dataIndex: 'note' },
              ]}
            />
            <Typography.Paragraph type="secondary" className="section">
              {data.investment.calculation}
            </Typography.Paragraph>
          </Card>
          <Card
            className="section"
            title="归因证据链"
            extra={
              <Tag>
                {data.evidence.summary.creatorTasks} 个 Creator Task ·{' '}
                {data.evidence.summary.publications} 次发布
              </Tag>
            }
          >
            <Typography.Paragraph type="secondary">
              Creator Task → 内容/发布 → Tracking ID → 已验证交易 →
              创作者报酬。为保护消费者隐私，报表不展示消费者身份信息。
            </Typography.Paragraph>
            <Table
              size="small"
              rowKey="redemptionId"
              dataSource={data.evidence.transactions}
              scroll={{ x: 900 }}
              columns={[
                {
                  title: '验证时间',
                  dataIndex: 'verifiedAt',
                  render: (value) => (value ? new Date(value).toLocaleString('zh-CN') : '—'),
                },
                { title: '交易', dataIndex: 'transactionAmount', render: money },
                { title: '优惠', dataIndex: 'discountValue', render: money },
                { title: 'Creator Task', dataIndex: 'creatorTaskId', render: shortId },
                { title: 'Tracking ID', dataIndex: 'trackingId', render: shortId },
                {
                  title: '归因锁定开始',
                  dataIndex: 'attributionLockStartedAt',
                  render: (value) => (value ? new Date(value).toLocaleDateString('zh-CN') : '—'),
                },
                { title: '报酬', dataIndex: 'payout', render: money },
              ]}
              locale={{ emptyText: '尚无已验证交易证据。' }}
            />
          </Card>
          <Card className="section" title="Creator Task 与发布凭证">
            <Table
              size="small"
              rowKey="creatorTaskId"
              dataSource={data.evidence.creatorTasks}
              scroll={{ x: 750 }}
              columns={[
                { title: 'Creator Task', dataIndex: 'creatorTaskId', render: shortId },
                { title: '状态', dataIndex: 'status', render: (value) => <Tag>{value}</Tag> },
                { title: 'Tracking ID', dataIndex: 'trackingId', render: shortId },
                { title: '内容', dataIndex: 'contentCount' },
                { title: '发布', dataIndex: 'publicationCount' },
                {
                  title: '发布时间',
                  dataIndex: 'publishedAt',
                  render: (value) => (value ? new Date(value).toLocaleString('zh-CN') : '—'),
                },
              ]}
              locale={{ emptyText: '尚无 Creator Task 凭证。' }}
            />
          </Card>
        </>
      )}
    </>
  )
}
