import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Button,
  Card,
  Descriptions,
  Input,
  InputNumber,
  Modal,
  Result,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
  message,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useState } from 'react'
import {
  addLifecycleNote,
  freezeLifecycleSubject,
  getLifecycleCreator,
  getLifecycleCreators,
  getLifecycleMerchant,
  getLifecycleMerchants,
  notifyLifecycleSubject,
  restoreLifecycleSubject,
  setCreatorType,
  setCreatorTaskLimit,
  setLifecycleTags,
  type CreatorLifecycle,
  type LifecycleDetail,
  type MerchantLifecycle,
} from './api/lifecycle'

type Kind = 'merchants' | 'creators'
type Row = MerchantLifecycle | CreatorLifecycle
type MerchantAuditScope = 'approved' | 'rejected'

export function LifecycleManagement({
  kind,
  merchantAuditScope,
}: {
  kind: Kind
  merchantAuditScope?: MerchantAuditScope
}) {
  const [keyword, setKeyword] = useState('')
  const [status, setStatus] = useState('')
  const [agentType, setAgentType] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [reasonModal, contextHolder] = Modal.useModal()
  const [taskLimitTarget, setTaskLimitTarget] = useState<CreatorLifecycle | null>(null)
  const [taskLimit, setTaskLimit] = useState<number | null>(null)
  const [taskLimitSaving, setTaskLimitSaving] = useState(false)
  const queryClient = useQueryClient()
  const list = useQuery({
    queryKey: ['lifecycle', kind, merchantAuditScope, keyword, status, agentType],
    queryFn: async (): Promise<{
      items: Row[]
      pagination: { page: number; pageSize: number; total: number; totalPages: number }
    }> =>
      kind === 'merchants'
        ? getLifecycleMerchants({ keyword, status, auditStatus: merchantAuditScope })
        : getLifecycleCreators({ keyword, status, agentType }),
  })
  const detail = useQuery({
    queryKey: ['lifecycle-detail', kind, selected],
    queryFn: () =>
      kind === 'merchants' ? getLifecycleMerchant(selected!) : getLifecycleCreator(selected!),
    enabled: Boolean(selected),
  })
  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['lifecycle', kind] })
    if (selected) await detail.refetch()
  }
  const inputModal = (
    title: string,
    placeholder: string,
    submit: (value: string) => Promise<unknown>,
  ) =>
    reasonModal.confirm({
      title,
      content: <Input.TextArea id="lifecycle-action-input" placeholder={placeholder} />,
      onOk: async () => {
        const value = (
          document.getElementById('lifecycle-action-input') as HTMLTextAreaElement | null
        )?.value?.trim()
        if (!value) throw new Error('请填写必填内容')
        await submit(value)
        message.success('操作已提交')
        await refresh()
      },
    })
  const notifyModal = (id: string) =>
    reasonModal.confirm({
      title: '发送站内通知',
      content: (
        <Space direction="vertical" style={{ width: '100%' }}>
          <Input id="lifecycle-notify-title" placeholder="通知标题" />
          <Input.TextArea id="lifecycle-notify-body" placeholder="通知内容" />
        </Space>
      ),
      onOk: async () => {
        const title = (
          document.getElementById('lifecycle-notify-title') as HTMLInputElement | null
        )?.value.trim()
        const body = (
          document.getElementById('lifecycle-notify-body') as HTMLTextAreaElement | null
        )?.value.trim()
        if (!title || !body) throw new Error('请填写标题和内容')
        await notifyLifecycleSubject(kind, id, title, body)
        message.success('通知已发送')
        await refresh()
      },
    })
  const rows = list.data?.items ?? []
  const isMerchant = kind === 'merchants'
  const canManageAccount = !isMerchant || merchantAuditScope === 'approved'
  const columns: ColumnsType<Row> = isMerchant
    ? [
        {
          title: '商户',
          key: 'name',
          render: (_, row) => (
            <Space direction="vertical" size={0}>
              <Typography.Text strong>{(row as MerchantLifecycle).businessName}</Typography.Text>
              <Typography.Text type="secondary">{row.phone}</Typography.Text>
            </Space>
          ),
        },
        {
          title: '订阅',
          dataIndex: 'subscriptionStatus',
          render: (value: string) => <Tag>{value}</Tag>,
        },
        {
          title: '账号状态',
          dataIndex: 'status',
          render: (value: string) => <StatusTag value={value} />,
        },
        {
          title: 'Campaign',
          key: 'campaign',
          render: (_, row) =>
            `${(row as MerchantLifecycle).summary.activity.activeCampaigns}/${(row as MerchantLifecycle).summary.activity.campaigns} 活跃`,
        },
        {
          title: '预算 / 结算',
          key: 'economy',
          render: (_, row) => (
            <Space direction="vertical" size={0}>
              <span>¥{(row as MerchantLifecycle).summary.budget.spent.toFixed(2)} 已花费</span>
              <Typography.Text type="secondary">
                GMV ¥{(row as MerchantLifecycle).summary.settlement.gmv.toFixed(2)}
              </Typography.Text>
            </Space>
          ),
        },
        {
          title: '运营标签',
          dataIndex: 'tags',
          render: (tags: string[]) =>
            tags.length ? tags.map((tag) => <Tag key={tag}>{tag}</Tag>) : '—',
        },
      ]
    : [
        {
          title: '分享员',
          key: 'name',
          render: (_, row) => (
            <Space direction="vertical" size={0}>
              <Typography.Text strong>
                {(row as CreatorLifecycle).nickname || '未命名分享员'}
              </Typography.Text>
              <Typography.Text type="secondary">
                微信 { (row as CreatorLifecycle).wechatOpenidMasked || '未绑定' } · {row.phone}
              </Typography.Text>
            </Space>
          ),
        },
        {
          title: '微信小程序身份',
          key: 'wechatIdentity',
          render: (_, row) => (row as CreatorLifecycle).wechatOpenidMasked || <Tag color="orange">未绑定</Tag>,
        },
        {
          title: '身份类型',
          dataIndex: 'agentType',
          render: (value: CreatorLifecycle['agentType']) => (
            <Tag color={value === 'professional_creator' ? 'purple' : 'blue'}>
              {value === 'professional_creator' ? '专业达人' : '普通用户'}
            </Tag>
          ),
        },
        {
          title: '认证 / 等级',
          key: 'level',
          render: (_, row) => (
            <Space>
              <Tag color={(row as CreatorLifecycle).realNameVerified ? 'green' : 'default'}>
                {(row as CreatorLifecycle).realNameVerified ? '已认证' : '未认证'}
              </Tag>
              <Tag>L{(row as CreatorLifecycle).growthLevel}</Tag>
              <Tag>{(row as CreatorLifecycle).level}</Tag>
            </Space>
          ),
        },
        {
          title: '履约 / 转化',
          key: 'performance',
          render: (_, row) => (
            <Space direction="vertical" size={0}>
              <span>
                {(row as CreatorLifecycle).summary.taskPerformance.completed}/
                {(row as CreatorLifecycle).summary.taskPerformance.total} 履约
              </span>
              <Typography.Text type="secondary">
                核销 {(row as CreatorLifecycle).summary.conversion.redemptions} · 发布{' '}
                {(row as CreatorLifecycle).summary.publishing.published}
              </Typography.Text>
            </Space>
          ),
        },
        {
          title: '任务额度',
          key: 'taskLimit',
          render: (_, row) => {
            const creator = row as CreatorLifecycle
            return (
              <Space direction="vertical" size={0}>
                <span>
                  {creator.summary.taskPerformance.current}/
                  {creator.taskLimit === null ? '∞' : creator.taskLimit} 进行中
                </span>
                <Typography.Text type="secondary">
                  {creator.taskLimit === null ? '不限额度' : '并发上限'}
                </Typography.Text>
              </Space>
            )
          },
        },
        {
          title: '状态',
          dataIndex: 'status',
          render: (value: string) => <StatusTag value={value} />,
        },
        {
          title: '标签',
          dataIndex: 'tags',
          render: (tags: string[]) =>
            tags.length ? tags.map((tag) => <Tag key={tag}>{tag}</Tag>) : '—',
        },
      ]
  columns.push({
    title: '操作',
    key: 'action',
    fixed: 'right',
    render: (_, row) => (
      <Space wrap>
        <Button type="link" onClick={() => setSelected(row.id)}>
          详情
        </Button>
        {!isMerchant && (
          <>
            <Button
              type="link"
              onClick={() => {
                const creator = row as CreatorLifecycle
                setTaskLimitTarget(creator)
                setTaskLimit(creator.taskLimit)
              }}
            >
              任务额度
            </Button>
            <Button
              type="link"
              onClick={() =>
                void setCreatorType(
                  row.id,
                  (row as CreatorLifecycle).agentType === 'professional_creator'
                    ? 'ordinary_user'
                    : 'professional_creator',
                )
                  .then(refresh)
                  .then(() => message.success('分享员身份已更新'))
                  .catch((error: unknown) =>
                    message.error(error instanceof Error ? error.message : '更新失败'),
                  )
              }
            >
              {(row as CreatorLifecycle).agentType === 'professional_creator'
                ? '设为普通用户'
                : '设为专业达人'}
            </Button>
          </>
        )}
        {canManageAccount && row.status === 'active' ? (
          <Button
            danger
            type="link"
            onClick={() =>
              inputModal(`冻结${isMerchant ? '商户' : '分享员'}`, '请填写冻结原因', (reason) =>
                freezeLifecycleSubject(kind, row.id, reason),
              )
            }
          >
            冻结
          </Button>
        ) : canManageAccount ? (
          <Button
            type="link"
            onClick={() =>
              inputModal(`恢复${isMerchant ? '商户' : '分享员'}`, '请填写恢复说明', (reason) =>
                restoreLifecycleSubject(kind, row.id, reason),
              )
            }
          >
            恢复
          </Button>
        ) : null}
      </Space>
    ),
  })
  return (
    <>
      {contextHolder}
      <Card size="small" className="filter-card">
        <Space wrap>
          <Input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder={isMerchant ? '搜索商户名称或手机号' : '搜索昵称、手机号、微信 OpenID / UnionID'}
            allowClear
            className="scope-input"
          />
          {!isMerchant && (
            <Select
              value={agentType || undefined}
              onChange={(value) => setAgentType(value ?? '')}
              allowClear
              placeholder="全部分享员类型"
              className="scope-input"
              options={[
                { value: 'professional_creator', label: '专业达人' },
                { value: 'ordinary_user', label: '普通用户' },
              ]}
            />
          )}
          {canManageAccount && (
            <Select
              value={status || undefined}
              onChange={(value) => setStatus(value ?? '')}
              allowClear
              placeholder="全部账号状态"
              className="scope-input"
              options={
                isMerchant
                  ? [
                      { value: 'active', label: '正常' },
                      { value: 'frozen', label: '已冻结' },
                    ]
                  : [
                      { value: 'active', label: '正常' },
                      { value: 'frozen', label: '已冻结' },
                      { value: 'blacklisted', label: '黑名单' },
                    ]
              }
            />
          )}
          <Button onClick={() => void list.refetch()} loading={list.isFetching}>
            查询
          </Button>
        </Space>
      </Card>
      {list.isError ? (
        <Result status="error" title="无法加载生命周期档案" subTitle={list.error.message} />
      ) : (
        <Card>
          <Table
            rowKey="id"
            columns={columns}
            dataSource={rows}
            loading={list.isLoading}
            scroll={{ x: 980 }}
            pagination={{
              total: list.data?.pagination.total ?? 0,
              pageSize: list.data?.pagination.pageSize ?? 20,
              showSizeChanger: false,
            }}
          />
        </Card>
      )}
      <Modal
        open={Boolean(selected)}
        title={isMerchant ? '商户经营档案' : '分享员运营档案'}
        onCancel={() => setSelected(null)}
        footer={<Button onClick={() => setSelected(null)}>关闭</Button>}
        width={980}
      >
        {detail.isLoading ? (
          <Typography.Text>加载中…</Typography.Text>
        ) : detail.data ? (
          <LifecycleDetailPanel
            kind={kind}
            detail={detail.data}
            onTags={() =>
              inputModal('设置运营标签', '以逗号分隔多个标签', async (value) => {
                await setLifecycleTags(kind, selected!, value.split(/[,，]/))
              })
            }
            onNote={() =>
              inputModal('记录运营跟进', '填写风险、运营备注或跟进事项', async (value) => {
                await addLifecycleNote(kind, selected!, { category: 'operation', content: value })
              })
            }
            onNotify={() => notifyModal(selected!)}
          />
        ) : detail.isError ? (
          <Result status="error" title="无法加载详情" subTitle={detail.error.message} />
        ) : null}
      </Modal>
      <Modal
        open={Boolean(taskLimitTarget)}
        title="设置创作者任务额度"
        confirmLoading={taskLimitSaving}
        okText="保存额度"
        cancelText="取消"
        onCancel={() => setTaskLimitTarget(null)}
        onOk={async () => {
          if (!taskLimitTarget) return
          setTaskLimitSaving(true)
          try {
            await setCreatorTaskLimit(taskLimitTarget.id, taskLimit)
            message.success(
              taskLimit === null ? '已恢复为不限额度' : `已设置为最多 ${taskLimit} 个并发任务`,
            )
            setTaskLimitTarget(null)
            await refresh()
          } catch (error) {
            message.error(error instanceof Error ? error.message : '保存额度失败')
          } finally {
            setTaskLimitSaving(false)
          }
        }}
      >
        <Typography.Paragraph type="secondary">
          额度仅限制该创作者同时接收的进行中 Creator Task 数量；留空表示不限。
        </Typography.Paragraph>
        <InputNumber
          min={0}
          precision={0}
          value={taskLimit ?? undefined}
          onChange={(value) =>
            setTaskLimit(value === null || value === undefined ? null : Number(value))
          }
          addonAfter="个并发任务"
          style={{ width: '100%' }}
          placeholder="留空表示不限"
        />
      </Modal>
    </>
  )
}

function LifecycleDetailPanel({
  kind,
  detail,
  onTags,
  onNote,
  onNotify,
}: {
  kind: Kind
  detail: LifecycleDetail
  onTags: () => void
  onNote: () => void
  onNotify: () => void
}) {
  const profile = detail.profile
  const summary = detail.summary as any
  const isMerchant = kind === 'merchants'
  const metrics = isMerchant
    ? [
        <Statistic
          key="campaign"
          title="活跃 Campaign"
          value={summary.activity?.activeCampaigns ?? 0}
        />,
        <Statistic
          key="spent"
          title="累计预算花费"
          prefix="¥"
          value={summary.budget?.spent ?? 0}
          precision={2}
        />,
        <Statistic
          key="gmv"
          title="GMV"
          prefix="¥"
          value={summary.settlement?.gmv ?? 0}
          precision={2}
        />,
      ]
    : [
        <Statistic
          key="task"
          title="任务履约"
          value={summary.taskPerformance?.completed ?? 0}
          suffix={`/ ${summary.taskPerformance?.total ?? 0}`}
        />,
        <Statistic key="conversion" title="核销" value={summary.conversion?.redemptions ?? 0} />,
        <Statistic
          key="publish"
          title="已发布内容"
          value={summary.publishing?.published ?? 0}
          suffix={`/ ${summary.publishing?.total ?? 0}`}
        />,
        <Statistic key="impressions" title="内容曝光" value={summary.publishing?.impressions ?? 0} />,
        <Statistic key="clicks" title="内容点击" value={summary.publishing?.clicks ?? 0} />,
      ]
  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Space wrap>{metrics}</Space>
      <Descriptions bordered size="small" column={2}>
        <Descriptions.Item label={isMerchant ? '商户' : '达人'}>
          {isMerchant
            ? (profile as MerchantLifecycle).businessName
            : (profile as CreatorLifecycle).nickname || '未命名达人'}
        </Descriptions.Item>
        <Descriptions.Item label="状态">
          <StatusTag value={profile.status} />
        </Descriptions.Item>
        {isMerchant ? (
          <>
            <Descriptions.Item label="资质审核">
              <AuditStatusTag value={(profile as MerchantLifecycle).auditStatus} />
            </Descriptions.Item>
            <Descriptions.Item label="审核意见">
              {(profile as MerchantLifecycle).auditComment || '—'}
            </Descriptions.Item>
          </>
        ) : null}
        {!isMerchant ? (
          <>
            <Descriptions.Item label="微信小程序 OpenID">
              <Typography.Text copyable={{ text: (profile as CreatorLifecycle).wechatOpenid ?? '' }}>
                {(profile as CreatorLifecycle).wechatOpenid || '未绑定'}
              </Typography.Text>
            </Descriptions.Item>
            <Descriptions.Item label="微信 UnionID">
              <Typography.Text copyable={{ text: (profile as CreatorLifecycle).wechatUnionid ?? '' }}>
                {(profile as CreatorLifecycle).wechatUnionid || '微信未返回'}
              </Typography.Text>
            </Descriptions.Item>
            <Descriptions.Item label="任务额度">
              {(profile as CreatorLifecycle).taskLimit === null
                ? '不限'
                : `${(profile as CreatorLifecycle).taskLimit} 个并发任务`}
            </Descriptions.Item>
          </>
        ) : null}
        {isMerchant ? (
          <>
            <Descriptions.Item label="商户管理员">
              {(profile as MerchantLifecycle).administratorContact?.name || '—'}
            </Descriptions.Item>
            <Descriptions.Item label="联系电话">
              {(profile as MerchantLifecycle).administratorContact?.phone || '—'}
            </Descriptions.Item>
            <Descriptions.Item label="联系邮箱" span={2}>
              {(profile as MerchantLifecycle).administratorContact?.email || '—'}
            </Descriptions.Item>
          </>
        ) : null}
        <Descriptions.Item label="标签" span={2}>
          {profile.tags?.length ? profile.tags.map((tag) => <Tag key={tag}>{tag}</Tag>) : '—'}
        </Descriptions.Item>
      </Descriptions>
      <Space>
        <Button onClick={onTags}>设置标签</Button>
        <Button onClick={onNote}>记录跟进</Button>
        <Button onClick={onNotify}>发送通知</Button>
      </Space>
      {!isMerchant ? (
        <>
          <Typography.Title level={5}>内容发布与获客</Typography.Title>
          <Table
            size="small"
            pagination={{ pageSize: 5, hideOnSinglePage: true }}
            rowKey="id"
            dataSource={detail.contents ?? []}
            locale={{ emptyText: '暂无内容产出；达人发布后将在此沉淀内容与获客数据' }}
            columns={[
              {
                title: '内容',
                key: 'content',
                render: (_, item) => (
                  <Space direction="vertical" size={0}>
                    <span>{item.contentType}</span>
                    <Typography.Text type="secondary">{item.targetPlatform || '未指定平台'} · {item.status}</Typography.Text>
                  </Space>
                ),
              },
              {
                title: '发布',
                key: 'publication',
                render: (_, item) => item.publications.length
                  ? item.publications.map((publication) => (
                    <div key={publication.id}>
                      {publication.platform} · {publication.status}
                      {publication.platformPostUrl ? <a href={publication.platformPostUrl} target="_blank" rel="noreferrer"> 查看</a> : null}
                    </div>
                  ))
                  : '未发布',
              },
              {
                title: '获客表现',
                key: 'performance',
                render: (_, item) => (
                  <Space direction="vertical" size={0}>
                    <span>曝光 {item.performance.impressions} · 点击 {item.performance.clicks}</span>
                    <Typography.Text type="secondary">领券 {item.performance.claims}</Typography.Text>
                  </Space>
                ),
              },
              { title: '生成时间', dataIndex: 'createdAt', render: formatDate },
            ]}
          />
        </>
      ) : null}
      <Typography.Title level={5}>合作关系与质量</Typography.Title>
      <Table
        size="small"
        pagination={false}
        rowKey="id"
        dataSource={detail.relationships}
        columns={[
          { title: '商户', dataIndex: 'merchant', render: (value) => value.businessName },
          { title: '达人', dataIndex: 'creator', render: (value) => value?.nickname || '待绑定' },
          { title: '状态', dataIndex: 'bindingStatus' },
          {
            title: '合作质量',
            dataIndex: 'cooperationQuality',
            render: (value) =>
              value.score === null
                ? '暂无任务'
                : `${value.score} 分（${value.completed}/${value.total}）`,
          },
          { title: '限制', dataIndex: 'restrictionReason', render: (value) => value || '—' },
        ]}
      />
      <Typography.Title level={5}>运营备注与跟进</Typography.Title>
      <Table
        size="small"
        pagination={false}
        rowKey="id"
        dataSource={detail.notes}
        columns={[
          { title: '类别', dataIndex: 'category' },
          { title: '内容', dataIndex: 'content' },
          { title: '原因', dataIndex: 'reason', render: (value) => value || '—' },
          { title: '时间', dataIndex: 'createdAt', render: formatDate },
        ]}
      />
    </Space>
  )
}
function StatusTag({ value }: { value: string }) {
  return (
    <Tag color={value === 'active' ? 'green' : value === 'blacklisted' ? 'error' : 'orange'}>
      {value === 'active'
        ? '正常'
        : value === 'frozen'
          ? '已冻结'
          : value === 'blacklisted'
            ? '黑名单'
            : value}
    </Tag>
  )
}
function AuditStatusTag({ value }: { value: string }) {
  const labels: Record<string, string> = {
    pending: '待审核',
    approved: '已通过',
    rejected: '未通过',
    need_info: '待补充资料',
  }
  const colors: Record<string, string> = {
    pending: 'gold',
    approved: 'green',
    rejected: 'red',
    need_info: 'orange',
  }
  return <Tag color={colors[value]}>{labels[value] ?? value}</Tag>
}
function formatDate(value: string) {
  return value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '—'
}
