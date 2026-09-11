import { useQuery } from '@tanstack/react-query'
import { Alert, Button, Card, Descriptions, Drawer, Form, Input, Space, Table, Tag, Typography, message } from 'antd'
import { useEffect, useState } from 'react'
import { api } from './api'

const money = (value: number) =>
  new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' }).format(Number(value ?? 0))

const actionLabels: Record<string, string> = {
  accepted: '接受任务',
  declined: '拒绝邀约',
  creating: '开始创作',
  submitted: '提交审核',
  published: '登记发布链接',
  tracking: '开始效果追踪',
  completed: '标记任务完成',
}
const actionsByStatus: Record<string, Array<keyof typeof actionLabels>> = {
  invited: ['accepted', 'declined'],
  accepted: ['creating'],
  creating: ['submitted'],
  approved: ['published'],
  published: ['tracking'],
  tracking: ['completed'],
}

const decisionLabel: Record<string, string> = {
  uphold: '维持原结算',
  adjust_payout: '调整报酬',
  reverse_settlement: '撤销/追回结算',
  accepted: '申诉受理',
  rejected: '申诉驳回',
}

export function CreatorWorkspace({
  initialTaskId,
  initialAppealId,
  onTaskOpened,
  onAppealOpened,
}: {
  initialTaskId: string | null
  initialAppealId: string | null
  onTaskOpened: () => void
  onAppealOpened: () => void
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [profileOpen, setProfileOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [publishedUrl, setPublishedUrl] = useState('')
  const [appealTarget, setAppealTarget] = useState<'task' | 'payout'>('task')
  const [appealReason, setAppealReason] = useState('')
  const home = useQuery({ queryKey: ['creator-today'], queryFn: () => api<any>('/creator/today') })
  const profile = useQuery({ queryKey: ['creator-profile'], queryFn: () => api<any>('/creator/profile') })
  const earnings = useQuery({ queryKey: ['creator-earnings'], queryFn: () => api<any>('/creator/earnings') })
  const detail = useQuery({
    queryKey: ['creator-task', selectedId],
    queryFn: () => api<any>(`/creator/tasks/${selectedId}`),
    enabled: Boolean(selectedId),
  })
  const appeals = useQuery({
    queryKey: ['creator-task-appeals'],
    queryFn: () => api<{ items: any[] }>('/creator/appeals'),
  })
  const [detailAppealId, setDetailAppealId] = useState<string | null>(null)
  useEffect(() => {
    if (initialTaskId) {
      setSelectedId(initialTaskId)
      onTaskOpened()
    }
  }, [initialTaskId, onTaskOpened])
  useEffect(() => {
    if (initialAppealId) {
      setDetailAppealId(initialAppealId)
      onAppealOpened()
    }
  }, [initialAppealId, onAppealOpened])
  const appealDetail = useQuery({
    queryKey: ['creator-task-appeal-detail', detailAppealId],
    queryFn: () => api<any>(`/creator/appeals/${detailAppealId}`),
    enabled: Boolean(detailAppealId),
  })
  const refresh = () => {
    void home.refetch()
    void earnings.refetch()
    void detail.refetch()
  }
  const transition = async (target: keyof typeof actionLabels) => {
    if (!selectedId) return
    if (target === 'published' && !publishedUrl.trim()) {
      message.warning('请填写已发布内容的链接')
      return
    }
    if (target === 'declined' && !reason.trim()) {
      message.warning('请说明拒绝邀约的原因')
      return
    }
    try {
      const body = target === 'published' ? { publishedUrl: publishedUrl.trim() } : target === 'declined' ? { reason: reason.trim() } : undefined
      await api(`/creator/tasks/${selectedId}/${target === 'declined' ? 'decline' : target === 'accepted' ? 'accept' : target}`, {
        method: 'POST',
        ...(body ? { body: JSON.stringify(body) } : {}),
      })
      message.success(`${actionLabels[target]}成功`)
      if (target === 'declined') setReason('')
      refresh()
    } catch (error) {
      message.error(error instanceof Error ? error.message : '任务操作失败')
    }
  }
  const appeal = async () => {
    if (!selectedId || !appealReason.trim()) {
      message.warning('请填写申诉说明')
      return
    }
    try {
      await api(`/creator/tasks/${selectedId}/appeals`, {
        method: 'POST',
        body: JSON.stringify({ target: appealTarget, reason: appealReason.trim() }),
      })
      message.success('申诉已提交，运营会在审核队列中处理')
      setAppealReason('')
      void earnings.refetch()
      void appeals.refetch()
    } catch (error) {
      message.error(error instanceof Error ? error.message : '申诉提交失败')
    }
  }
  const tasks = [...(home.data?.invitations ?? []), ...(home.data?.activeTasks ?? [])]
  const task = detail.data
  const taskAppeals = (appeals.data?.items ?? []).filter((item) => item.creatorTaskId === selectedId)
  const growth = profile.data?.growth
  const nextLevelScore = [20, 40, 60, 80][Math.max(0, Number(growth?.level ?? 1) - 1)] ?? null
  const taskActions = task ? actionsByStatus[String(task.status)] ?? [] : []
  const saveProfile = async (values: { nickname?: string; region?: string; categories?: string; preferences?: string }) => {
    try {
      await api('/creator/profile', {
        method: 'PATCH',
        body: JSON.stringify({
          nickname: values.nickname,
          region: values.region,
          creatorCategories: values.categories?.split(/[,，]/).map((item) => item.trim()).filter(Boolean),
          taskPreferences: values.preferences ? { notes: values.preferences } : {},
        }),
      })
      message.success('创作者资料已更新')
      setProfileOpen(false)
      void profile.refetch()
    } catch (error) {
      message.error(error instanceof Error ? error.message : '资料保存失败')
    }
  }
  const verifyIdentity = async (values: { realName: string; idCardNo: string }) => {
    try {
      await api('/creator/verification', { method: 'POST', body: JSON.stringify(values) })
      message.success('实名认证资料已提交，等待运营审核')
      void profile.refetch()
    } catch (error) {
      message.error(error instanceof Error ? error.message : '实名提交失败')
    }
  }

  return <>
    <div className="heading"><div><Typography.Title level={2}>创作者任务中心</Typography.Title><Typography.Text type="secondary">只展示商户资金已确认的商业任务；报酬、Campaign Credits 和每次状态变更都会留痕。</Typography.Text></div><Tag color={profile.data?.eligibility?.eligible ? 'success' : 'warning'}>{profile.data?.eligibility?.eligible ? '已准入' : '待准入'}</Tag></div>
    {!profile.data?.eligibility?.eligible ? <Alert className="section" type="warning" showIcon message="暂不能接受商业任务" description={(profile.data?.eligibility?.reasons ?? ['请完成实名及审核']).join('；')} /> : null}
    <Card className="section" title="账户与成长分" extra={<Button type="link" onClick={() => setProfileOpen(true)}>完善资料与认证</Button>}><Descriptions size="small" column={{ xs: 1, sm: 2, md: 4 }} items={[{ key: 'audit', label: '审核状态', children: profile.data?.verification?.auditStatus ?? '—' }, { key: 'real', label: '实名', children: profile.data?.verification?.realNameVerified ? '已核验' : '待核验' }, { key: 'score', label: '成长分', children: growth?.score ?? 0 }, { key: 'level', label: '成长等级', children: `L${growth?.level ?? 1}` }]} /><Space wrap className="section">{Object.entries(growth?.breakdown ?? {}).map(([name, value]) => <Tag key={name}>{name} {Number(value)} 分</Tag>)}</Space><Typography.Text type="secondary">{nextLevelScore == null ? '你已达到最高 L5。' : `距离下一等级还差 ${Math.max(0, nextLevelScore - Number(growth?.score ?? 0))} 分；可通过优质交付、当地相关性、验证转化和合规记录提升。`}</Typography.Text></Card>
    <Card className="section" title="今日任务与匹配理由"><Table rowKey="creatorTaskId" loading={home.isLoading} dataSource={tasks} pagination={false} columns={[{ title: '任务', render: (_, row: any) => <><div>{row.contentType} · {row.channel}</div><Typography.Text type="secondary">{row.brief}</Typography.Text></> }, { title: '匹配理由', render: (_, row: any) => row.matchingReason?.reasons?.join('；') ?? '已通过渠道和准入匹配' }, { title: '预计报酬', dataIndex: 'expectedPayout', render: money }, { title: '状态', dataIndex: 'status', render: (value) => <Tag>{value}</Tag> }, { title: '操作', render: (_, row: any) => <Button type="link" onClick={() => setSelectedId(row.creatorTaskId)}>查看详情</Button> }]} /></Card>
    <Card title="报酬、T+3 与申诉"><Descriptions size="small" column={{ xs: 1, sm: 4 }} items={[{ key: 'expected', label: '预计报酬', children: money(earnings.data?.expected) }, { key: 'verified', label: '核验金额', children: money(earnings.data?.verified) }, { key: 'pending', label: '待结算（T+3）', children: money(earnings.data?.settlement?.pending) }, { key: 'recovery', label: '待追回款', children: money(earnings.data?.settlement?.wallet?.recoveryReceivable) }]} /><Typography.Text type="secondary">实际到账金额会扣除已裁决的待追回款；从任务详情可查看每笔核验、抵扣、结算及申诉历史。</Typography.Text></Card>
    <Drawer title="任务详情与操作" width={680} open={Boolean(selectedId)} onClose={() => setSelectedId(null)}>
      {detail.isLoading ? '加载中…' : task ? <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Descriptions bordered column={1} size="small" items={[{ key: 'brief', label: '任务简述', children: task.brief }, { key: 'channel', label: '渠道与内容', children: `${task.channel} · ${task.contentType}` }, { key: 'deadline', label: '截止时间', children: new Date(task.deadline).toLocaleString('zh-CN') }, { key: 'status', label: '当前状态', children: <Tag>{task.status}</Tag> }, { key: 'reward', label: '报酬规则', children: `${money(task.expectedPayout)} 基础报酬；${JSON.stringify(task.performanceReward ?? {})}` }, { key: 'credits', label: 'Campaign Credits', children: `${task.campaignCredits?.consumed ?? 0} / ${task.campaignCredits?.allocated ?? 0} 已使用` }, { key: 'payout', label: '核验与结算', children: task.payout ? `${task.payout.status}；核验金额 ${task.payout.verifiedAmount == null ? '待核验' : money(task.payout.verifiedAmount)}；结算日 ${task.payout.settleAt ? new Date(task.payout.settleAt).toLocaleDateString('zh-CN') : '待定'}` : '待创建' }]} />
        <Card size="small" title="本任务账务明细"><Descriptions size="small" column={{ xs: 1, sm: 2 }} items={[
          { key: 'verified', label: '核验金额', children: task.payout?.verifiedAmount == null ? '待核验' : money(task.payout.verifiedAmount) },
          { key: 'offset', label: '自动抵扣', children: money(task.payout?.recoveryOffsetAmount) },
          { key: 'settled', label: '实际结算净额', children: task.payout?.status === 'settled' ? money(task.payout?.settledAmount) : '待结算' },
          { key: 'recovery', label: '待追回款', children: money(earnings.data?.settlement?.wallet?.recoveryReceivable) },
        ]} /><Typography.Text type="secondary">自动抵扣仅发生在结算时；待追回款会在后续已核验报酬中优先抵扣。</Typography.Text></Card>
        {task.reviewReason ? <Alert type="warning" showIcon message="审核说明" description={task.reviewReason} /> : null}
        {task.riskHoldReason ? <Alert type="error" showIcon message="风控暂停" description={task.riskHoldReason} /> : null}
        {task.status === 'invited' ? <Input.TextArea value={reason} onChange={(event) => setReason(event.target.value)} rows={2} placeholder="如需拒绝邀约，请说明原因" /> : null}
        {task.status === 'approved' ? <Input value={publishedUrl} onChange={(event) => setPublishedUrl(event.target.value)} placeholder="填写已发布内容的公开链接" /> : null}
        <Space wrap>{taskActions.map((action) => <Button key={action} type={action === 'accepted' ? 'primary' : 'default'} danger={action === 'declined'} onClick={() => void transition(action)}>{actionLabels[action]}</Button>)}</Space>
        <Card size="small" title="申诉历史与裁决"><Table size="small" rowKey="appealId" loading={appeals.isLoading} dataSource={taskAppeals} pagination={false} columns={[{ title: '类型', dataIndex: 'target', render: (value) => value === 'payout' ? '报酬' : '任务履约' }, { title: '状态', dataIndex: 'status', render: (value) => <Tag>{value}</Tag> }, { title: '裁决', dataIndex: 'adjudicationDecision', render: (value) => decisionLabel[value] ?? '待处理' }, { title: '操作', render: (_, item) => <Button type="link" onClick={() => setDetailAppealId(item.appealId)}>查看详情</Button> }]} locale={{ emptyText: '该任务暂无申诉记录' }} /></Card>
        <Card size="small" title="任务/报酬申诉"><Space direction="vertical" style={{ width: '100%' }}><select value={appealTarget} onChange={(event) => setAppealTarget(event.target.value as 'task' | 'payout')}><option value="task">任务申诉</option><option value="payout">报酬申诉</option></select><Input.TextArea value={appealReason} onChange={(event) => setAppealReason(event.target.value)} rows={3} placeholder="描述问题及可提供的证据" /><Button onClick={() => void appeal()}>提交申诉</Button></Space></Card>
      </Space> : <Alert type="error" message="无法加载任务详情" />}
    </Drawer>
    <Drawer title="申诉裁决与账务详情" width={640} open={Boolean(detailAppealId)} onClose={() => setDetailAppealId(null)}>
      {appealDetail.isLoading ? '加载中…' : appealDetail.data ? <CreatorAppealDetail appeal={appealDetail.data} /> : <Alert type="error" message="无法加载申诉详情" />}
    </Drawer>
    <Drawer title="创作者资料与实名认证" width={520} open={profileOpen} onClose={() => setProfileOpen(false)}>
      <Typography.Title level={5}>资料与接单偏好</Typography.Title>
      <Form key={profile.data?.creatorId ?? 'profile'} layout="vertical" initialValues={{ nickname: profile.data?.nickname, region: profile.data?.region, categories: (profile.data?.categories ?? []).join('，'), preferences: profile.data?.taskPreferences?.notes }} onFinish={saveProfile}>
        <Form.Item name="nickname" label="昵称"><Input /></Form.Item>
        <Form.Item name="region" label="常驻地区"><Input placeholder="例如：北京·朝阳" /></Form.Item>
        <Form.Item name="categories" label="擅长类目"><Input placeholder="用逗号分隔，例如：餐饮，美妆，本地生活" /></Form.Item>
        <Form.Item name="preferences" label="接单偏好"><Input.TextArea rows={3} placeholder="例如：仅周末接单，偏好短视频" /></Form.Item>
        <Button type="primary" htmlType="submit">保存资料</Button>
      </Form>
      <Typography.Title level={5}>实名认证</Typography.Title>
      <Typography.Paragraph type="secondary">实名信息仅用于平台准入审核，不会展示给商户或消费者。</Typography.Paragraph>
      <Form layout="vertical" onFinish={verifyIdentity}>
        <Form.Item name="realName" label="真实姓名" rules={[{ required: true }]}><Input /></Form.Item>
        <Form.Item name="idCardNo" label="身份证号" rules={[{ required: true }]}><Input /></Form.Item>
        <Button htmlType="submit">提交实名认证</Button>
      </Form>
    </Drawer>
  </>
}

function CreatorAppealDetail({ appeal }: { appeal: any }) {
  const recovery = appeal.recovery ?? {
    amount: Math.max(0, Number(appeal.amountBefore ?? 0) - Number(appeal.amountAfter ?? 0)),
    recovered: 0,
    remaining: Math.max(0, Number(appeal.amountBefore ?? 0) - Number(appeal.amountAfter ?? 0)),
    status: Math.max(0, Number(appeal.amountBefore ?? 0) - Number(appeal.amountAfter ?? 0)) ? 'recovering' : 'not_applicable',
  }
  const payout = appeal.payout
  const settlement = payout?.status === 'reversed'
    ? Number(recovery.remaining) ? '已撤销；不足部分将在后续报酬中自动抵扣' : '已撤销；追回已完成'
    : payout?.status === 'settled'
      ? `实际到账 ${money(payout.settledAmount)}${Number(payout.recoveryOffsetAmount ?? 0) ? `（自动抵扣 ${money(payout.recoveryOffsetAmount)}）` : ''}`
      : payout?.status ? `结算状态：${payout.status}` : '暂无关联结算'
  return <Space direction="vertical" size="large" style={{ width: '100%' }}>
    <Descriptions bordered size="small" column={1} items={[
      { key: 'decision', label: '裁决结论', children: <Tag color={appeal.adjudicationDecision ? 'processing' : 'default'}>{decisionLabel[appeal.adjudicationDecision] ?? '待运营裁决'}</Tag> },
      { key: 'amount', label: '金额变化', children: appeal.amountBefore == null ? '未产生金额调整' : `${money(appeal.amountBefore)} → ${money(appeal.amountAfter)}` },
      { key: 'recovery', label: '应追回', children: Number(recovery.amount) ? money(recovery.amount) : '无' },
      { key: 'recovered', label: '已追回', children: money(recovery.recovered) },
      { key: 'remaining', label: '剩余待追回', children: money(recovery.remaining) },
      { key: 'recoveryStatus', label: '追回状态', children: recovery.status === 'completed' ? <Tag color="success">已完成</Tag> : recovery.status === 'recovering' ? <Tag color="processing">追回中</Tag> : '不适用' },
      { key: 'settlement', label: '到账/追回状态', children: settlement },
      { key: 'resolution', label: '处理说明', children: appeal.resolution || '待运营处理' },
      { key: 'resolvedAt', label: '处理时间', children: appeal.resolvedAt ? new Date(appeal.resolvedAt).toLocaleString('zh-CN') : '待处理' },
      { key: 'evidence', label: '申诉证据', children: Object.keys(appeal.evidence ?? {}).length ? <Typography.Text code>{JSON.stringify(appeal.evidence)}</Typography.Text> : '未提交附件或结构化证据' },
    ]} />
    <Card size="small" title="每次自动抵扣明细"><Table size="small" rowKey="id" pagination={false} dataSource={(appeal.financialLedgerEntries ?? []).filter((item: any) => item.entryType === 'recovery_auto_offset')} columns={[
      { title: '后续结算流水', render: (_, item: any) => item.metadata?.settlementPayoutId ?? '—', ellipsis: true },
      { title: '本次抵扣', dataIndex: 'amount', render: (value) => money(Math.abs(Number(value))) },
      { title: '抵扣后剩余', render: (_, item: any) => money(item.metadata?.remainingRecoveryAmount) },
      { title: '发生时间', dataIndex: 'occurredAt', render: (value) => new Date(value).toLocaleString('zh-CN') },
    ]} locale={{ emptyText: '暂无后续结算抵扣记录' }} /></Card>
    <Card size="small" title="关联账务流水"><Table size="small" rowKey="id" pagination={false} dataSource={appeal.financialLedgerEntries ?? []} columns={[
      { title: '流水 ID', dataIndex: 'id', ellipsis: true },
      { title: '类型', dataIndex: 'entryType' },
      { title: '金额', dataIndex: 'amount', render: money },
      { title: '发生时间', dataIndex: 'occurredAt', render: (value) => new Date(value).toLocaleString('zh-CN') },
    ]} locale={{ emptyText: (appeal.financialLedgerEntryIds ?? []).length ? `流水 ${appeal.financialLedgerEntryIds.join('、')} 暂不可用` : '本次裁决未产生账务流水' }} /></Card>
  </Space>
}
