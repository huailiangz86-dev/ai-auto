import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, Card, Descriptions, Input, Modal, Result, Select, Space, Statistic, Table, Tag, Typography, message } from 'antd'
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
  setLifecycleTags,
  type CreatorLifecycle,
  type LifecycleDetail,
  type MerchantLifecycle,
} from './api/lifecycle'

type Kind = 'merchants' | 'creators'
type Row = MerchantLifecycle | CreatorLifecycle

export function LifecycleManagement({ kind }: { kind: Kind }) {
  const [keyword, setKeyword] = useState('')
  const [status, setStatus] = useState('')
  const [agentType, setAgentType] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [reasonModal, contextHolder] = Modal.useModal()
  const queryClient = useQueryClient()
  const list = useQuery({ queryKey: ['lifecycle', kind, keyword, status, agentType], queryFn: async (): Promise<{ items: Row[]; pagination: { page: number; pageSize: number; total: number; totalPages: number } }> => kind === 'merchants' ? getLifecycleMerchants({ keyword, status }) : getLifecycleCreators({ keyword, status, agentType }) })
  const detail = useQuery({ queryKey: ['lifecycle-detail', kind, selected], queryFn: () => kind === 'merchants' ? getLifecycleMerchant(selected!) : getLifecycleCreator(selected!), enabled: Boolean(selected) })
  const refresh = async () => { await queryClient.invalidateQueries({ queryKey: ['lifecycle', kind] }); if (selected) await detail.refetch() }
  const inputModal = (title: string, placeholder: string, submit: (value: string) => Promise<unknown>) => reasonModal.confirm({ title, content: <Input.TextArea id="lifecycle-action-input" placeholder={placeholder} />, onOk: async () => { const value = (document.getElementById('lifecycle-action-input') as HTMLTextAreaElement | null)?.value?.trim(); if (!value) throw new Error('请填写必填内容'); await submit(value); message.success('操作已提交'); await refresh() } })
  const notifyModal = (id: string) => reasonModal.confirm({ title: '发送站内通知', content: <Space direction="vertical" style={{ width: '100%' }}><Input id="lifecycle-notify-title" placeholder="通知标题" /><Input.TextArea id="lifecycle-notify-body" placeholder="通知内容" /></Space>, onOk: async () => { const title = (document.getElementById('lifecycle-notify-title') as HTMLInputElement | null)?.value.trim(); const body = (document.getElementById('lifecycle-notify-body') as HTMLTextAreaElement | null)?.value.trim(); if (!title || !body) throw new Error('请填写标题和内容'); await notifyLifecycleSubject(kind, id, title, body); message.success('通知已发送'); await refresh() } })
  const rows = list.data?.items ?? []
  const isMerchant = kind === 'merchants'
  const columns: ColumnsType<Row> = isMerchant
    ? [
      { title: '商户', key: 'name', render: (_, row) => <Space direction="vertical" size={0}><Typography.Text strong>{(row as MerchantLifecycle).businessName}</Typography.Text><Typography.Text type="secondary">{row.phone}</Typography.Text></Space> },
      { title: '订阅 / 状态', key: 'status', render: (_, row) => <Space><Tag>{(row as MerchantLifecycle).subscriptionStatus}</Tag><StatusTag value={row.status} /></Space> },
      { title: 'Campaign', key: 'campaign', render: (_, row) => `${(row as MerchantLifecycle).summary.activity.activeCampaigns}/${(row as MerchantLifecycle).summary.activity.campaigns} 活跃` },
      { title: '预算 / 结算', key: 'economy', render: (_, row) => <Space direction="vertical" size={0}><span>¥{(row as MerchantLifecycle).summary.budget.spent.toFixed(2)} 已花费</span><Typography.Text type="secondary">GMV ¥{(row as MerchantLifecycle).summary.settlement.gmv.toFixed(2)}</Typography.Text></Space> },
      { title: '运营标签', dataIndex: 'tags', render: (tags: string[]) => tags.length ? tags.map((tag) => <Tag key={tag}>{tag}</Tag>) : '—' },
    ]
    : [
      { title: '分享员', key: 'name', render: (_, row) => <Space direction="vertical" size={0}><Typography.Text strong>{(row as CreatorLifecycle).nickname || '未命名分享员'}</Typography.Text><Typography.Text type="secondary">{row.phone}</Typography.Text></Space> },
      { title: '身份类型', dataIndex: 'agentType', render: (value: CreatorLifecycle['agentType']) => <Tag color={value === 'professional_creator' ? 'purple' : 'blue'}>{value === 'professional_creator' ? '专业达人' : '普通用户'}</Tag> },
      { title: '认证 / 等级', key: 'level', render: (_, row) => <Space><Tag color={(row as CreatorLifecycle).realNameVerified ? 'green' : 'default'}>{(row as CreatorLifecycle).realNameVerified ? '已认证' : '未认证'}</Tag><Tag>L{(row as CreatorLifecycle).growthLevel}</Tag><Tag>{(row as CreatorLifecycle).level}</Tag></Space> },
      { title: '履约 / 转化', key: 'performance', render: (_, row) => <Space direction="vertical" size={0}><span>{(row as CreatorLifecycle).summary.taskPerformance.completed}/{(row as CreatorLifecycle).summary.taskPerformance.total} 履约</span><Typography.Text type="secondary">核销 {(row as CreatorLifecycle).summary.conversion.redemptions} · 发布 {(row as CreatorLifecycle).summary.publishing.published}</Typography.Text></Space> },
      { title: '状态', dataIndex: 'status', render: (value: string) => <StatusTag value={value} /> },
      { title: '标签', dataIndex: 'tags', render: (tags: string[]) => tags.length ? tags.map((tag) => <Tag key={tag}>{tag}</Tag>) : '—' },
    ]
  columns.push({ title: '操作', key: 'action', fixed: 'right', render: (_, row) => <Space wrap><Button type="link" onClick={() => setSelected(row.id)}>详情</Button>{!isMerchant && <Button type="link" onClick={() => void setCreatorType(row.id, (row as CreatorLifecycle).agentType === 'professional_creator' ? 'ordinary_user' : 'professional_creator').then(refresh).then(() => message.success('分享员身份已更新')).catch((error: unknown) => message.error(error instanceof Error ? error.message : '更新失败'))}>{(row as CreatorLifecycle).agentType === 'professional_creator' ? '设为普通用户' : '设为专业达人'}</Button>}{row.status === 'active' ? <Button danger type="link" onClick={() => inputModal(`冻结${isMerchant ? '商户' : '分享员'}`, '请填写冻结原因', (reason) => freezeLifecycleSubject(kind, row.id, reason))}>冻结</Button> : <Button type="link" onClick={() => inputModal(`恢复${isMerchant ? '商户' : '分享员'}`, '请填写恢复说明', (reason) => restoreLifecycleSubject(kind, row.id, reason))}>恢复</Button>}</Space> })
  return <>
    {contextHolder}
    <Card size="small" className="filter-card"><Space wrap><Input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder={isMerchant ? '搜索商户名称或手机号' : '搜索分享员昵称或手机号'} allowClear className="scope-input" />{!isMerchant && <Select value={agentType || undefined} onChange={(value) => setAgentType(value ?? '')} allowClear placeholder="全部分享员类型" className="scope-input" options={[{ value: 'professional_creator', label: '专业达人' }, { value: 'ordinary_user', label: '普通用户' }]} />}<Input value={status} onChange={(event) => setStatus(event.target.value)} placeholder="状态：active / frozen / blacklisted" allowClear className="scope-input" /><Button onClick={() => void list.refetch()} loading={list.isFetching}>查询</Button></Space></Card>
    {list.isError ? <Result status="error" title="无法加载生命周期档案" subTitle={list.error.message} /> : <Card><Table rowKey="id" columns={columns} dataSource={rows} loading={list.isLoading} scroll={{ x: 980 }} pagination={{ total: list.data?.pagination.total ?? 0, pageSize: list.data?.pagination.pageSize ?? 20, showSizeChanger: false }} /></Card>}
    <Modal open={Boolean(selected)} title={isMerchant ? '商户经营档案' : '分享员运营档案'} onCancel={() => setSelected(null)} footer={<Button onClick={() => setSelected(null)}>关闭</Button>} width={980}>{detail.isLoading ? <Typography.Text>加载中…</Typography.Text> : detail.data ? <LifecycleDetailPanel kind={kind} detail={detail.data} onTags={() => inputModal('设置运营标签', '以逗号分隔多个标签', async (value) => { await setLifecycleTags(kind, selected!, value.split(/[,，]/)); })} onNote={() => inputModal('记录运营跟进', '填写风险、运营备注或跟进事项', async (value) => { await addLifecycleNote(kind, selected!, { category: 'operation', content: value }); })} onNotify={() => notifyModal(selected!)} /> : detail.isError ? <Result status="error" title="无法加载详情" subTitle={detail.error.message} /> : null}</Modal>
  </>
}

function LifecycleDetailPanel({ kind, detail, onTags, onNote, onNotify }: { kind: Kind; detail: LifecycleDetail; onTags: () => void; onNote: () => void; onNotify: () => void }) {
  const profile = detail.profile as Row
  const summary = detail.summary as any
  const isMerchant = kind === 'merchants'
  const metrics = isMerchant ? [<Statistic key="campaign" title="活跃 Campaign" value={summary.activity?.activeCampaigns ?? 0} />, <Statistic key="spent" title="累计预算花费" prefix="¥" value={summary.budget?.spent ?? 0} precision={2} />, <Statistic key="gmv" title="GMV" prefix="¥" value={summary.settlement?.gmv ?? 0} precision={2} />] : [<Statistic key="task" title="任务履约" value={summary.taskPerformance?.completed ?? 0} suffix={`/ ${summary.taskPerformance?.total ?? 0}`} />, <Statistic key="conversion" title="核销" value={summary.conversion?.redemptions ?? 0} />, <Statistic key="publish" title="发布" value={summary.publishing?.published ?? 0} suffix={`/ ${summary.publishing?.total ?? 0}`} />]
  return <Space direction="vertical" size="middle" style={{ width: '100%' }}><Space wrap>{metrics}</Space><Descriptions bordered size="small" column={2}><Descriptions.Item label={isMerchant ? '商户' : '达人'}>{isMerchant ? (profile as MerchantLifecycle).businessName : (profile as CreatorLifecycle).nickname || '未命名达人'}</Descriptions.Item><Descriptions.Item label="状态"><StatusTag value={profile.status} /></Descriptions.Item>{isMerchant ? <><Descriptions.Item label="商户管理员">{(profile as MerchantLifecycle).administratorContact?.name || '—'}</Descriptions.Item><Descriptions.Item label="联系电话">{(profile as MerchantLifecycle).administratorContact?.phone || '—'}</Descriptions.Item><Descriptions.Item label="联系邮箱" span={2}>{(profile as MerchantLifecycle).administratorContact?.email || '—'}</Descriptions.Item></> : null}<Descriptions.Item label="标签" span={2}>{profile.tags?.length ? profile.tags.map((tag) => <Tag key={tag}>{tag}</Tag>) : '—'}</Descriptions.Item></Descriptions><Space><Button onClick={onTags}>设置标签</Button><Button onClick={onNote}>记录跟进</Button><Button onClick={onNotify}>发送通知</Button></Space><Typography.Title level={5}>合作关系与质量</Typography.Title><Table size="small" pagination={false} rowKey="id" dataSource={detail.relationships} columns={[{ title: '商户', dataIndex: 'merchant', render: (value) => value.businessName }, { title: '达人', dataIndex: 'creator', render: (value) => value?.nickname || '待绑定' }, { title: '状态', dataIndex: 'bindingStatus' }, { title: '合作质量', dataIndex: 'cooperationQuality', render: (value) => value.score === null ? '暂无任务' : `${value.score} 分（${value.completed}/${value.total}）` }, { title: '限制', dataIndex: 'restrictionReason', render: (value) => value || '—' }]} /><Typography.Title level={5}>运营备注与跟进</Typography.Title><Table size="small" pagination={false} rowKey="id" dataSource={detail.notes} columns={[{ title: '类别', dataIndex: 'category' }, { title: '内容', dataIndex: 'content' }, { title: '原因', dataIndex: 'reason', render: (value) => value || '—' }, { title: '时间', dataIndex: 'createdAt', render: formatDate }]} /></Space>
}
function StatusTag({ value }: { value: string }) { return <Tag color={value === 'active' ? 'green' : value === 'blacklisted' ? 'error' : 'orange'}>{value === 'active' ? '正常' : value === 'frozen' ? '已冻结' : value === 'blacklisted' ? '黑名单' : value}</Tag> }
function formatDate(value: string) { return value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '—' }

