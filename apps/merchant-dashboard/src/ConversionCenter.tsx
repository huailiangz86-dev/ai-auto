import {
  CheckOutlined,
  CopyOutlined,
  EyeOutlined,
  LinkOutlined,
  ReloadOutlined,
  StopOutlined,
} from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Drawer,
  Input,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
  message,
} from 'antd'
import { useMemo, useState } from 'react'
import { api } from './api'

const money = (value: number | undefined) =>
  new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' }).format(Number(value ?? 0))

const taskStatus: Record<string, { label: string; color?: string }> = {
  invited: { label: '待达人接受' },
  accepted: { label: '待创作', color: 'processing' },
  creating: { label: '创作中', color: 'processing' },
  submitted: { label: '待商家审核', color: 'warning' },
  approved: { label: '待发布', color: 'success' },
  rejected: { label: '已打回', color: 'error' },
  published: { label: '已发布', color: 'success' },
  tracking: { label: '追踪中', color: 'processing' },
  completed: { label: '已完成', color: 'success' },
  settled: { label: '已结算', color: 'success' },
  risk_hold: { label: '风控暂停', color: 'error' },
  violation: { label: '违规终止', color: 'error' },
}

const payoutStatus: Record<string, { label: string; color?: string }> = {
  estimated: { label: '预计', color: 'default' },
  verified: { label: '待结算', color: 'processing' },
  settled: { label: '已结算', color: 'success' },
  risk_hold: { label: '风控暂停', color: 'error' },
  rejected: { label: '已拒绝', color: 'error' },
  reversed: { label: '已冲销', color: 'error' },
}

interface ConversionCenterData {
  filters: {
    campaignId: string | null
    campaigns: { campaignId: string; campaignName: string; purpose: string }[]
  }
  summary: {
    content: {
      pendingMerchantReview: number
      approved: number
      published: number
      publications: number
    }
    funnel: {
      impressions: number
      clicks: number
      claims: number
      verifiedRedemptions: number
      redemptionRate: number
      gmv: number
      discountCost: number
    }
    settlement: {
      expectedContentReward: number
      pendingContentReward: number
      settledContentReward: number
      creatorConversionPayout: number
      platformFee: number
    }
  }
  coupons: any[]
  creatorTasks: any[]
  transactions: any[]
}

export default function ConversionCenter() {
  const [campaignId, setCampaignId] = useState<string | undefined>()
  const [selectedTask, setSelectedTask] = useState<any>(null)
  const [reviewReason, setReviewReason] = useState('')
  const [reviewing, setReviewing] = useState(false)
  const dashboard = useQuery({
    queryKey: ['merchant-conversion-center', campaignId],
    queryFn: () =>
      api<ConversionCenterData>(
        `/merchant/conversion-center${campaignId ? `?campaignId=${encodeURIComponent(campaignId)}` : ''}`,
      ),
  })
  const data = dashboard.data
  const visibleTasks = useMemo(() => data?.creatorTasks ?? [], [data])
  const review = async (decision: 'approve' | 'reject') => {
    if (!selectedTask) return
    if (decision === 'reject' && !reviewReason.trim()) {
      message.warning('请说明打回原因，达人才能修改内容')
      return
    }
    setReviewing(true)
    try {
      await api(`/merchant/growth-tasks/creator-tasks/${selectedTask.creatorTaskId}/review`, {
        method: 'POST',
        body: JSON.stringify({
          decision,
          reason: reviewReason.trim() || '符合任务 brief 与品牌要求',
        }),
      })
      message.success(
        decision === 'approve' ? '已通过内容审核，达人可以登记发布链接' : '已打回内容并通知达人',
      )
      setSelectedTask(null)
      setReviewReason('')
      await dashboard.refetch()
    } catch (error) {
      message.error(error instanceof Error ? error.message : '审核操作失败')
    } finally {
      setReviewing(false)
    }
  }
  if (dashboard.isLoading) return <Card loading />
  if (dashboard.error) return <Alert type="error" showIcon message={dashboard.error.message} />
  if (!data) return null
  return (
    <>
      <div className="heading">
        <div>
          <Typography.Title level={2}>内容与转化中心</Typography.Title>
          <Typography.Text type="secondary">
            商家验收内容，平台负责合规与风控；每笔券核销可回溯到专属内容入口，不展示消费者身份。
          </Typography.Text>
        </div>
        <Space wrap>
          <Select
            allowClear
            className="conversion-campaign-select"
            placeholder="全部活动"
            value={campaignId}
            onChange={(value) => setCampaignId(value)}
            options={data.filters.campaigns.map((campaign) => ({
              value: campaign.campaignId,
              label: `${campaign.campaignName} · ${campaign.purpose === 'creator_content' ? '达人引流' : '客户活动'}`,
            }))}
          />
          <Button icon={<ReloadOutlined />} onClick={() => void dashboard.refetch()}>
            刷新
          </Button>
        </Space>
      </div>
      <Alert
        className="section"
        type="info"
        showIcon
        message="优惠券属于活动；达人内容使用独立 Tracking ID 导流"
        description="用户从专属链接领取后进入券包，已验证核销才会计入内容转化与核销佣金。内容基础报酬与核销佣金分开结算。"
      />
      <div className="conversion-section-title">内容审核与发布</div>
      <div className="conversion-stat-grid section">
        <Metric
          title="待商家审核"
          value={data.summary.content.pendingMerchantReview}
          suffix="份"
          accent="orange"
        />
        <Metric title="审核通过待发布" value={data.summary.content.approved} suffix="份" />
        <Metric
          title="已发布/追踪中"
          value={data.summary.content.published}
          suffix="份"
          accent="green"
        />
        <Metric title="已记录发布" value={data.summary.content.publications} suffix="次" />
      </div>
      <Card
        className="section"
        title="达人内容任务"
        extra={
          <Typography.Text type="secondary">
            商家只审核品牌与履约；异常内容由平台风控处理
          </Typography.Text>
        }
      >
        <Table
          rowKey="creatorTaskId"
          size="small"
          scroll={{ x: 1220 }}
          dataSource={visibleTasks}
          columns={[
            {
              title: '达人 / 内容',
              width: 210,
              render: (_, task: any) => (
                <Space direction="vertical" size={1}>
                  <Typography.Text strong>{task.creator.nickname}</Typography.Text>
                  <Typography.Text type="secondary">
                    {task.channel} · {task.contentType}
                  </Typography.Text>
                </Space>
              ),
            },
            { title: '任务状态', dataIndex: 'status', width: 120, render: StatusTag },
            {
              title: '内容入口',
              width: 200,
              render: (_, task: any) => (
                <Space direction="vertical" size={1}>
                  <Typography.Text code>{shortId(task.publishing.trackingId)}</Typography.Text>
                  {task.publishing.claimPath ? (
                    <Button
                      size="small"
                      type="link"
                      icon={<CopyOutlined />}
                      onClick={() => void copyClaimPath(task.publishing.claimPath)}
                    >
                      复制领券路径
                    </Button>
                  ) : null}
                  <Typography.Text type="secondary">
                    领券 {task.conversion.claims} · 核销 {task.conversion.verifiedRedemptions}
                  </Typography.Text>
                </Space>
              ),
            },
            { title: '核销 GMV', dataIndex: ['conversion', 'gmv'], width: 120, render: money },
            {
              title: '内容基础报酬',
              width: 145,
              render: (_, task: any) =>
                task.rewards.contentPayout ? (
                  <Space direction="vertical" size={1}>
                    <Typography.Text>
                      {money(
                        task.rewards.contentPayout.verifiedAmount ||
                          task.rewards.contentPayout.expectedAmount,
                      )}
                    </Typography.Text>
                    <PayoutTag value={task.rewards.contentPayout.status} />
                  </Space>
                ) : (
                  <Typography.Text type="secondary">达人未接受</Typography.Text>
                ),
            },
            {
              title: '核销佣金',
              width: 130,
              render: (_, task: any) => (
                <Space direction="vertical" size={1}>
                  <Typography.Text>{money(task.rewards.creatorConversionPayout)}</Typography.Text>
                  <Typography.Text type="secondary">
                    平台费 {money(task.rewards.platformFee)}
                  </Typography.Text>
                </Space>
              ),
            },
            {
              title: '操作',
              fixed: 'right',
              width: 115,
              render: (_, task: any) => (
                <Button
                  type={task.status === 'submitted' ? 'primary' : 'link'}
                  onClick={() => setSelectedTask(task)}
                >
                  {task.status === 'submitted' ? '去审核' : '查看'}
                </Button>
              ),
            },
          ]}
          locale={{ emptyText: '当前筛选下暂无达人内容任务。' }}
        />
      </Card>
      <div className="conversion-section-title">券使用与客户消费</div>
      <div className="conversion-stat-grid section">
        <Metric title="内容曝光" value={data.summary.funnel.impressions} suffix="次" />
        <Metric title="专属入口点击" value={data.summary.funnel.clicks} suffix="次" />
        <Metric title="追踪领券" value={data.summary.funnel.claims} suffix="张" accent="blue" />
        <Metric
          title="已验证核销"
          value={data.summary.funnel.verifiedRedemptions}
          suffix="笔"
          accent="green"
        />
        <Metric title="核销率" value={data.summary.funnel.redemptionRate} suffix="%" />
        <Metric title="核销 GMV" value={data.summary.funnel.gmv} moneyValue accent="green" />
      </div>
      <Card className="section" title="活动转化券效果">
        <Table
          rowKey="couponId"
          size="small"
          scroll={{ x: 980 }}
          dataSource={data.coupons}
          columns={[
            {
              title: '活动 / 转化券',
              render: (_, coupon: any) => (
                <>
                  <div>{coupon.campaignName}</div>
                  <Typography.Text type="secondary">{coupon.couponName}</Typography.Text>
                </>
              ),
            },
            { title: '优惠规则', render: (_, coupon: any) => offerLabel(coupon.offer) },
            { title: '领取', dataIndex: ['performance', 'claims'] },
            { title: '已核销', dataIndex: ['performance', 'verifiedRedemptions'] },
            { title: '过期', dataIndex: ['performance', 'expired'] },
            { title: '核销 GMV', dataIndex: ['performance', 'gmv'], render: money },
            { title: '优惠成本', dataIndex: ['performance', 'discountCost'], render: money },
          ]}
          locale={{ emptyText: '尚无可展示的转化券。' }}
        />
      </Card>
      <div className="conversion-section-title">归因与佣金</div>
      <div className="conversion-stat-grid section">
        <Metric
          title="待结算内容报酬"
          value={data.summary.settlement.pendingContentReward}
          moneyValue
          accent="orange"
        />
        <Metric
          title="已结算内容报酬"
          value={data.summary.settlement.settledContentReward}
          moneyValue
          accent="green"
        />
        <Metric
          title="达人核销佣金"
          value={data.summary.settlement.creatorConversionPayout}
          moneyValue
          accent="blue"
        />
        <Metric title="平台服务费" value={data.summary.settlement.platformFee} moneyValue />
      </div>
      <Card
        className="section"
        title="已验证核销归因凭证"
        extra={
          <Typography.Text type="secondary">仅展示交易与归因快照，不展示消费者身份</Typography.Text>
        }
      >
        <Table
          rowKey="redemptionId"
          size="small"
          scroll={{ x: 1050 }}
          dataSource={data.transactions}
          columns={[
            { title: '核销时间', dataIndex: 'verifiedAt', render: displayDate },
            {
              title: '活动 / 券',
              render: (_, item: any) => (
                <>
                  <div>{item.campaignName}</div>
                  <Typography.Text type="secondary">{item.couponName}</Typography.Text>
                </>
              ),
            },
            { title: 'Creator Task', dataIndex: 'creatorTaskId', render: shortId },
            { title: 'Tracking ID', dataIndex: 'trackingId', render: shortId },
            { title: '交易金额', dataIndex: 'transactionAmount', render: money },
            { title: '优惠成本', dataIndex: 'discountValue', render: money },
            { title: '达人实得', dataIndex: 'creatorPayout', render: money },
            {
              title: '佣金状态',
              dataIndex: 'commissionStatus',
              render: (value) => (value ? <Tag>{value}</Tag> : '—'),
            },
          ]}
          locale={{ emptyText: '暂无已验证的内容归因核销。' }}
        />
      </Card>
      <Drawer
        title="内容审核与归因详情"
        width={640}
        open={Boolean(selectedTask)}
        onClose={() => {
          setSelectedTask(null)
          setReviewReason('')
        }}
      >
        {selectedTask && (
          <TaskDetail
            task={selectedTask}
            reviewReason={reviewReason}
            onReasonChange={setReviewReason}
            reviewing={reviewing}
            onReview={review}
          />
        )}
      </Drawer>
    </>
  )
}

function Metric({
  title,
  value,
  suffix,
  accent,
  moneyValue,
}: {
  title: string
  value: number
  suffix?: string
  accent?: string
  moneyValue?: boolean
}) {
  return (
    <Card className={`conversion-metric ${accent ? `conversion-metric-${accent}` : ''}`}>
      <Statistic
        title={title}
        value={moneyValue ? money(value) : value}
        suffix={moneyValue ? undefined : suffix}
      />
    </Card>
  )
}

function TaskDetail({
  task,
  reviewReason,
  onReasonChange,
  reviewing,
  onReview,
}: {
  task: any
  reviewReason: string
  onReasonChange: (value: string) => void
  reviewing: boolean
  onReview: (decision: 'approve' | 'reject') => void
}) {
  const publications = task.publishing.publications ?? []
  return (
    <Space direction="vertical" size="large" className="conversion-drawer-content">
      {task.status === 'submitted' ? (
        <Alert
          type="warning"
          showIcon
          message="待商家商业审核"
          description="请确认内容是否符合任务 brief、门店信息、优惠承诺与品牌调性；AI 合规和异常流量由平台处理。"
        />
      ) : null}
      <Descriptions
        bordered
        size="small"
        column={1}
        items={[
          { key: 'creator', label: '达人', children: task.creator.nickname },
          { key: 'brief', label: '任务 brief', children: task.brief },
          { key: 'content', label: '内容形式', children: `${task.channel} · ${task.contentType}` },
          {
            key: 'tracking',
            label: '专属 Tracking ID',
            children: (
              <Typography.Text code>{task.publishing.trackingId || '生成中'}</Typography.Text>
            ),
          },
          {
            key: 'claim-path',
            label: '内容专属领券路径',
            children: task.publishing.claimPath ? (
              <Space direction="vertical" size={4}>
                <Typography.Text code copyable={{ text: task.publishing.claimPath }}>
                  {task.publishing.claimPath}
                </Typography.Text>
                <Typography.Text type="secondary">
                  活动转化券：{task.publishing.conversionCoupon?.couponName ?? '—'}
                  ；请由达人放在正文、置顶评论或视频描述中。
                </Typography.Text>
              </Space>
            ) : (
              '该任务尚未绑定活动转化券'
            ),
          },
          { key: 'draft', label: '达人提交', children: <Evidence task={task} /> },
          {
            key: 'published',
            label: '发布链接',
            children: task.publishing.publishedUrl ? (
              <Typography.Link href={task.publishing.publishedUrl} target="_blank">
                打开发布链接 <LinkOutlined />
              </Typography.Link>
            ) : (
              '尚未登记'
            ),
          },
          {
            key: 'conversion',
            label: '转化',
            children: `归因锁定 ${task.conversion.attributionLocks} · 领券 ${task.conversion.claims} · 已验证核销 ${task.conversion.verifiedRedemptions} · GMV ${money(task.conversion.gmv)}`,
          },
          {
            key: 'payout',
            label: '报酬',
            children: `基础 ${money(task.rewards.baseReward)}；核销佣金 ${money(task.rewards.creatorConversionPayout)}；平台费 ${money(task.rewards.platformFee)}`,
          },
        ]}
      />
      {publications.length ? (
        <Card size="small" title="已记录发布">
          <Table
            size="small"
            rowKey="publicationId"
            pagination={false}
            dataSource={publications}
            columns={[
              { title: '平台', dataIndex: 'platform' },
              { title: '状态', dataIndex: 'status', render: (value) => <Tag>{value}</Tag> },
              { title: '曝光', dataIndex: 'impressions' },
              { title: '点击', dataIndex: 'clicks' },
              {
                title: '链接',
                dataIndex: 'postUrl',
                render: (url) =>
                  url ? (
                    <Typography.Link href={url} target="_blank">
                      打开
                    </Typography.Link>
                  ) : (
                    '—'
                  ),
              },
            ]}
          />
        </Card>
      ) : null}
      {task.status === 'submitted' ? (
        <Card size="small" title="审核决定">
          <Input.TextArea
            value={reviewReason}
            onChange={(event) => onReasonChange(event.target.value)}
            rows={4}
            placeholder="通过时可补充审核备注；打回时必须明确写出需要修改的内容"
          />
          <Space className="section">
            <Button
              type="primary"
              icon={<CheckOutlined />}
              loading={reviewing}
              onClick={() => void onReview('approve')}
            >
              通过并允许发布
            </Button>
            <Button
              danger
              icon={<StopOutlined />}
              loading={reviewing}
              onClick={() => void onReview('reject')}
            >
              打回修改
            </Button>
          </Space>
        </Card>
      ) : null}
    </Space>
  )
}

function Evidence({ task }: { task: any }) {
  const draftUrl = task.review.draftUrl
  if (draftUrl)
    return (
      <Typography.Link href={draftUrl} target="_blank">
        查看达人草稿 <EyeOutlined />
      </Typography.Link>
    )
  if (task.review.note) return task.review.note
  return '达人未填写草稿链接或说明'
}

function StatusTag(value: string) {
  const config = taskStatus[value] ?? { label: value }
  return <Tag color={config.color}>{config.label}</Tag>
}

function PayoutTag({ value }: { value: string }) {
  const config = payoutStatus[value] ?? { label: value }
  return <Tag color={config.color}>{config.label}</Tag>
}

function shortId(value: string | null | undefined) {
  return value ? `${value.slice(0, 8)}…` : '—'
}

function displayDate(value: string | null | undefined) {
  return value ? new Date(value).toLocaleString('zh-CN') : '—'
}

function offerLabel(offer: any) {
  if (Number(offer.cashRewardAmount) > 0) return `返 ¥${offer.cashRewardAmount}`
  return Number(offer.thresholdAmount) > 0
    ? `满 ¥${offer.thresholdAmount} 减 ¥${offer.discountAmount}`
    : `立减 ¥${offer.discountAmount}`
}

async function copyClaimPath(path: string) {
  try {
    await navigator.clipboard.writeText(path)
    message.success('已复制内容专属领券路径')
  } catch {
    message.error('复制失败，请在详情中手动复制')
  }
}
