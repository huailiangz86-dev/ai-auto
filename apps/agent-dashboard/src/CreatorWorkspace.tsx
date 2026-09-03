import { useQuery } from '@tanstack/react-query'
import { Alert, Button, Card, Descriptions, Space, Table, Tag, Typography, message } from 'antd'
import { api } from './api'

const money = (value: number) => new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' }).format(Number(value ?? 0))

export function CreatorWorkspace() {
  const home = useQuery({ queryKey: ['creator-today'], queryFn: () => api<any>('/creator/today') })
  const profile = useQuery({ queryKey: ['creator-profile'], queryFn: () => api<any>('/creator/profile') })
  const earnings = useQuery({ queryKey: ['creator-earnings'], queryFn: () => api<any>('/creator/earnings') })
  const accept = async (creatorTaskId: string) => { try { await api(`/creator/tasks/${creatorTaskId}/accept`, { method: 'POST' }); message.success('任务已接受，预计报酬已锁定'); home.refetch(); earnings.refetch() } catch (error) { message.error(error instanceof Error ? error.message : '接受任务失败') } }
  const tasks = [...(home.data?.invitations ?? []), ...(home.data?.activeTasks ?? [])]
  return <>
    <div className="heading"><div><Typography.Title level={2}>创作者任务中心</Typography.Title><Typography.Text type="secondary">只展示商户资金已确认的商业任务；接受后报酬与 Campaign Credits 会锁定到任务。</Typography.Text></div><Tag color={profile.data?.eligibility?.eligible ? 'success' : 'warning'}>{profile.data?.eligibility?.eligible ? '已准入' : '待准入'}</Tag></div>
    {!profile.data?.eligibility?.eligible ? <Alert className="section" type="warning" showIcon message="暂不能接受商业任务" description={(profile.data?.eligibility?.reasons ?? ['请完成实名及审核']).join('；')} /> : null}
    <Card className="section" title="账户与成长分"><Descriptions size="small" column={{ xs: 1, sm: 2, md: 4 }} items={[{ key: 'audit', label: '审核状态', children: profile.data?.verification?.auditStatus ?? '—' }, { key: 'real', label: '实名', children: profile.data?.verification?.realNameVerified ? '已核验' : '待核验' }, { key: 'score', label: '成长分', children: profile.data?.growth?.score ?? 0 }, { key: 'level', label: '成长等级', children: `L${profile.data?.growth?.level ?? 1}` }]} /></Card>
    <Card className="section" title="今日任务与匹配理由"><Table rowKey="creatorTaskId" loading={home.isLoading} dataSource={tasks} pagination={false} columns={[{ title: '任务', render: (_, row: any) => <><div>{row.contentType} · {row.channel}</div><Typography.Text type="secondary">{row.brief}</Typography.Text></> }, { title: '匹配理由', render: (_, row: any) => row.matchingReason?.reasons?.join('；') ?? '已通过渠道和准入匹配' }, { title: '预计报酬', dataIndex: 'expectedPayout', render: money }, { title: 'Credits', render: (_, row: any) => `${row.campaignCredits?.remaining ?? 0} / ${row.campaignCredits?.allocated ?? 0}` }, { title: '状态', dataIndex: 'status', render: (value) => <Tag>{value}</Tag> }, { title: '操作', render: (_, row: any) => row.status === 'invited' ? <Button type="primary" disabled={!row.funded || !profile.data?.eligibility?.eligible} onClick={() => accept(row.creatorTaskId)}>接受任务</Button> : '进行中' }]} /></Card>
    <Card title="报酬、T+3 与申诉"><Descriptions size="small" column={{ xs: 1, sm: 3 }} items={[{ key: 'expected', label: '预计报酬', children: money(earnings.data?.expected) }, { key: 'verified', label: '已验证报酬', children: money(earnings.data?.verified) }, { key: 'pending', label: '待结算（T+3）', children: money(earnings.data?.settlement?.pending) }]} /><Space className="section"><Tag>开放申诉 {earnings.data?.openAppealCount ?? 0}</Tag><Typography.Text type="secondary">申诉入口将在每条任务详情中提供；核验后按 3 个工作日进入可提现余额。</Typography.Text></Space></Card>
  </>
}
