import { SendOutlined, UserOutlined, RobotOutlined, CheckCircleOutlined } from '@ant-design/icons'
import {
  Alert,
  Avatar,
  Button,
  Card,
  Descriptions,
  Input,
  List,
  Modal,
  Radio,
  Space,
  Spin,
  Tag,
  Typography,
  message,
} from 'antd'
import { useEffect, useMemo, useState } from 'react'
import { api } from './api'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface GrowthIntakeDraft {
  goalBrief?: string | null
  goalMetric?: string | null
  taskType?: 'customer_campaign' | 'creator_content' | null
  baselineValue?: number | null
  targetValue?: number | null
  budget?: number | null
  startAt?: string | null
  endAt?: string | null
  storeId?: string | null
  storeName?: string | null
  storeScope?: 'specific' | 'all' | null
  acceptableRoiBoundary?: number | null
  acceptableRiskBoundary?: string | null
}

interface IntakeResult {
  reply: string
  extracted: GrowthIntakeDraft
  missing: string[]
  ready: boolean
  summary?: Record<string, unknown>
}

const missingLabels: Record<string, string> = {
  goal_brief: '完整增长目标',
  goal_metric: '增长指标（新增客户、订单或 GMV）',
  target_value: '目标值',
  budget: '总预算',
  start_at: '开始时间',
  end_at: '结束时间',
  store_id: '适用门店（或说明全部门店）',
}

const initialMessage: ChatMessage = {
  role: 'assistant',
  content:
    '请直接告诉我想实现的业务目标，不用填写表格。比如：“国庆前，让望京店新增 200 位到店新客，预算 1 万元，活动做 7 天。”我会自动识别信息，缺什么再向你询问。',
}

export default function GrowthPlanIntake({
  open,
  onClose,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  onCreated: (plan: any) => void
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([initialMessage])
  const [draft, setDraft] = useState<GrowthIntakeDraft>({})
  const [missing, setMissing] = useState<string[]>([])
  const [ready, setReady] = useState(false)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    if (open) {
      setMessages([initialMessage])
      setDraft({})
      setMissing([])
      setReady(false)
      setInput('')
    }
  }, [open])

  const canSend = input.trim().length > 0 && !sending && !creating
  const extractedSummary = useMemo(
    () => [
      { label: '完整目标', value: draft.goalBrief || '待识别' },
      {
        label: '任务类型',
        value: draft.taskType === 'creator_content' ? '达人内容引流任务' : '客户优惠活动',
      },
      { label: '增长指标', value: draft.goalMetric || '待识别' },
      {
        label: '当前基线',
        value: draft.baselineValue == null ? '未提供（可选）' : `${draft.baselineValue}`,
      },
      { label: '目标值', value: draft.targetValue == null ? '待补充' : `${draft.targetValue}` },
      {
        label: '本期目标增量',
        value:
          draft.targetValue == null || draft.baselineValue == null
            ? '待结合当前基线计算'
            : `${Math.max(draft.targetValue - draft.baselineValue, 0)}`,
      },
      { label: '总预算', value: draft.budget == null ? '待补充' : `¥${draft.budget}` },
      {
        label: '适用门店',
        value: draft.storeScope === 'all' ? '全部门店' : draft.storeName || '待确认',
      },
      { label: '开始时间', value: draft.startAt ? formatDate(draft.startAt) : '待补充' },
      { label: '结束时间', value: draft.endAt ? formatDate(draft.endAt) : '待补充' },
      ...(draft.acceptableRoiBoundary != null
        ? [{ label: '最低 ROI', value: `${draft.acceptableRoiBoundary}` }]
        : []),
      ...(draft.acceptableRiskBoundary
        ? [{ label: '风险边界', value: draft.acceptableRiskBoundary }]
        : []),
    ],
    [draft],
  )

  const send = async () => {
    const content = input.trim()
    if (!content || sending) return
    const nextMessages = [...messages, { role: 'user' as const, content }]
    setMessages(nextMessages)
    setInput('')
    setSending(true)
    try {
      const result = await api<IntakeResult>('/merchant/growth-plans/intake', {
        method: 'POST',
        body: JSON.stringify({ message: content, history: nextMessages, current: draft }),
      })
      setDraft(result.extracted ?? {})
      setMissing(result.missing ?? [])
      setReady(Boolean(result.ready))
      setMessages((current) => [...current, { role: 'assistant', content: result.reply }])
    } catch {
      const local = parseLocalIntake(content, draft)
      setDraft(local.draft)
      setMissing(local.missing)
      setReady(local.ready)
      setMessages((current) => [...current, { role: 'assistant', content: local.reply }])
    } finally {
      setSending(false)
    }
  }

  const createPlan = async () => {
    if (
      !ready ||
      !draft.goalMetric ||
      !draft.goalBrief ||
      draft.targetValue == null ||
      draft.budget == null ||
      !draft.startAt ||
      !draft.endAt
    )
      return
    setCreating(true)
    try {
      const plan = await api<any>('/merchant/growth-plans', {
        method: 'POST',
        body: JSON.stringify({
          goalBrief: draft.goalBrief,
          goalMetric: draft.goalMetric,
          taskType: draft.taskType ?? 'customer_campaign',
          baselineValue: draft.baselineValue ?? undefined,
          targetValue: Number(draft.targetValue),
          budget: Number(draft.budget),
          startAt: new Date(draft.startAt).toISOString(),
          endAt: new Date(draft.endAt).toISOString(),
          storeId: draft.storeId ?? undefined,
          acceptableRoiBoundary: draft.acceptableRoiBoundary ?? undefined,
          acceptableRiskBoundary: draft.acceptableRiskBoundary ?? undefined,
        }),
      })
      message.success('已根据对话内容生成 3 套可审阅增长方案')
      onCreated(plan)
    } catch (error) {
      message.error(error instanceof Error ? error.message : '生成增长方案失败')
    } finally {
      setCreating(false)
    }
  }

  return (
    <Modal
      title="AI 增长目标对话"
      open={open}
      onCancel={onClose}
      footer={null}
      width={760}
      destroyOnClose
    >
      <div className="growth-chat">
        <div className="growth-chat-messages">
          <List
            split={false}
            dataSource={messages}
            renderItem={(item) => (
              <List.Item className={`growth-chat-message growth-chat-message-${item.role}`}>
                <Space align="start" size={10}>
                  <Avatar
                    size="small"
                    icon={item.role === 'assistant' ? <RobotOutlined /> : <UserOutlined />}
                  />
                  <div className="growth-chat-bubble">{item.content}</div>
                </Space>
              </List.Item>
            )}
          />
          {sending && (
            <div className="growth-chat-thinking">
              <Spin size="small" /> AI 正在整理你的目标…
            </div>
          )}
        </div>
        {missing.length > 0 && (
          <Alert
            className="growth-chat-missing"
            type="warning"
            showIcon
            message="还需要补充"
            description={missing.map((item) => missingLabels[item] || item).join('、')}
          />
        )}
        {ready && (
          <Card
            size="small"
            className="growth-chat-result"
            title={
              <Space size={6}>
                <CheckCircleOutlined /> 最终填写结果
              </Space>
            }
            extra={<Tag color="success">信息完整</Tag>}
          >
            <Descriptions
              size="small"
              column={2}
              items={extractedSummary.map((item) => ({ label: item.label, children: item.value }))}
            />
            <div className="growth-task-type-picker">
              <Typography.Text strong>这次增长要服务谁？</Typography.Text>
              <Radio.Group
                value={draft.taskType ?? 'customer_campaign'}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, taskType: event.target.value }))
                }
              >
                <Radio value="customer_campaign">普通客户优惠活动</Radio>
                <Radio value="creator_content">达人内容引流任务</Radio>
              </Radio.Group>
              <Typography.Text type="secondary">
                达人任务会生成图文/短视频
                Brief、专属引流链路、活动转化券和达人报酬；用户从内容入口领取后进入券包。
              </Typography.Text>
            </div>
            <Typography.Paragraph type="secondary" className="growth-chat-result-note">
              目标值按活动结束时的累计结果理解；总预算是整个增长任务的投入上限，不是单个创作者的报酬。当前基线可选，仅用于计算本期目标增量。
            </Typography.Paragraph>
            <Button
              type="primary"
              block
              loading={creating}
              onClick={createPlan}
              className="growth-chat-create"
            >
              根据以上内容生成 3 套增长方案
            </Button>
          </Card>
        )}
        <div className="growth-chat-input">
          <Input.TextArea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onPressEnter={(event) => {
              if (!event.shiftKey) {
                event.preventDefault()
                void send()
              }
            }}
            autoSize={{ minRows: 2, maxRows: 5 }}
            placeholder="继续告诉 AI，例如：预算 1 万，10 月 1 日到 7 日，全部门店"
            disabled={sending || creating}
          />
          <Button
            type="primary"
            icon={<SendOutlined />}
            onClick={() => void send()}
            disabled={!canSend}
            loading={sending}
          >
            发送
          </Button>
        </div>
        <Typography.Text type="secondary" className="growth-chat-hint">
          AI 会自动提取目标、指标、数值、预算、时间和门店；你只需要用自然语言补充信息。
        </Typography.Text>
      </div>
    </Modal>
  )
}

function formatDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('zh-CN')
}

function missingFieldsForDraft(draft: GrowthIntakeDraft) {
  const missing: string[] = []
  if (!draft.goalBrief) missing.push('goal_brief')
  if (!draft.goalMetric) missing.push('goal_metric')
  if (draft.targetValue == null) missing.push('target_value')
  if (draft.budget == null) missing.push('budget')
  if (!draft.startAt) missing.push('start_at')
  if (!draft.endAt) missing.push('end_at')
  if (draft.storeScope !== 'all' && !draft.storeId) missing.push('store_id')
  return missing
}

function parseLocalIntake(message: string, current: GrowthIntakeDraft) {
  const text = message.trim()
  const next: GrowthIntakeDraft = { ...current }
  const recognized: string[] = []
  const hasGoalSignal = /目标|增长|新增|拉新|复购|订单|GMV|核销|新客|客流|营收|销售额|活动/i.test(
    text,
  )

  if (!next.goalBrief && hasGoalSignal) {
    next.goalBrief = text
    recognized.push('完整增长目标')
  }

  if (/达人|创作者|图文|短视频|内容发布|内容引流|种草|探店/.test(text)) {
    if (next.taskType !== 'creator_content') recognized.push('达人内容任务')
    next.taskType = 'creator_content'
  } else if (/优惠券|发券|满减|折扣|领券|券活动/.test(text)) {
    if (next.taskType !== 'customer_campaign') recognized.push('客户优惠活动')
    next.taskType = 'customer_campaign'
  }

  const metric = localMetric(text)
  if (metric && next.goalMetric !== metric) {
    next.goalMetric = metric
    recognized.push('增长指标')
  }

  const budget = localAmount(
    text,
    localAmountPattern('总预算|预算|投入|花费|成本|最多|花|用|拿|准备', '万|千|百|亿|元'),
  )
  if (budget != null && next.budget !== budget) {
    next.budget = budget
    recognized.push('总预算')
  }

  const target = localTarget(text, metric || next.goalMetric || null)
  if (target != null && next.targetValue !== target) {
    next.targetValue = target
    recognized.push('目标值')
  }

  const dates = localDates(text)
  if (dates.length >= 2) {
    if (next.startAt !== dates[0].start) {
      next.startAt = dates[0].start
      recognized.push('开始时间')
    }
    if (next.endAt !== dates[1].end) {
      next.endAt = dates[1].end
      recognized.push('结束时间')
    }
  } else if (dates.length === 1) {
    const isEnd = /结束|截止|到期|到\s*$/.test(text) && !/开始|起始|从/.test(text)
    if (isEnd) {
      if (next.endAt !== dates[0].end) {
        next.endAt = dates[0].end
        recognized.push('结束时间')
      }
    } else if (next.startAt !== dates[0].start) {
      next.startAt = dates[0].start
      recognized.push('开始时间')
    }
  }

  if (/全部门店|所有门店|全店|各门店|全门店/.test(text)) {
    if (next.storeScope !== 'all') recognized.push('适用门店')
    next.storeScope = 'all'
    next.storeId = null
    next.storeName = '全部门店'
  }

  const missing = missingFieldsForDraft(next)
  const missingText = missing.map((item) => missingLabels[item] || item).join('、')
  if (missing.length === 0) {
    return { draft: next, missing, ready: true, reply: localCompleteReply(next) }
  }

  const prefix = recognized.length
    ? `已识别并保留：${recognized.join('、')}。`
    : Object.keys(current).length > 0
      ? '已保留之前识别的内容，本轮没有新增可确认信息。'
      : '我已读取这段描述。'
  return {
    draft: next,
    missing,
    ready: false,
    reply: `${prefix}还需要补充：${missingText}。你可以只补充缺少的内容，不需要重新开始。`,
  }
}

function localMetric(text: string): string | null {
  if (/新客|新增客户|拉新|到店新客/.test(text)) return '新增到店核销数'
  if (/复购|回购/.test(text)) return '复购订单数'
  if (/GMV|销售额|营收|订单额|成交额/.test(text)) return '新增 GMV'
  if (/订单|下单/.test(text)) return '新增订单数'
  if (/核销/.test(text)) return '新增到店核销数'
  return null
}

function localTarget(text: string, metric: string | null): number | null {
  const patterns =
    metric === '新增到店核销数'
      ? [
          localAmountPattern('新增客户|新客|客户|拉新|到店新客', '人|位|个'),
          localAmountPattern('新增|达到|目标|获取|带来'),
        ]
      : metric === '新增 GMV'
        ? [localAmountPattern('GMV|销售额|营收|订单额|成交额', '万|千|百|亿|元')]
        : [localAmountPattern('新增|订单|下单|达到|目标|获取|带来', '万|千|百|亿|单|笔|个')]
  for (const pattern of patterns) {
    const value = localAmount(text, pattern)
    if (value != null) return value
  }
  return localAmount(text, localAmountPattern('新增|达到|目标|获取|带来|提升至|做到'))
}

function localAmountPattern(prefixes: string, units = '万|千|百|亿|人|位|个|单|笔|元') {
  return new RegExp(
    `(?:${prefixes})[^0-9零〇一二两三四五六七八九十百千万亿]{0,12}(${numberToken()})\\s*(${units})?`,
    'i',
  )
}

function localAmount(text: string, pattern: RegExp): number | null {
  const match = text.match(pattern)
  if (!match) return null
  const value = parseLocalNumber(match[1])
  if (/[万亿千百]/.test(match[1])) return value
  return match[2] === '亿'
    ? value * 100000000
    : match[2] === '万'
      ? value * 10000
      : match[2] === '千'
        ? value * 1000
        : match[2] === '百'
          ? value * 100
          : value
}

function numberToken() {
  return '(?:\\d+(?:\\.\\d+)?|[零〇一二两三四五六七八九十百千万亿]+)'
}

function parseLocalNumber(value: string): number {
  if (/^\d+(?:\.\d+)?$/.test(value)) return Number(value)
  const digits: Record<string, number> = {
    零: 0,
    〇: 0,
    一: 1,
    二: 2,
    两: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9,
  }
  const smallUnits: Record<string, number> = { 十: 10, 百: 100, 千: 1000 }
  const largeUnits: Record<string, number> = { 万: 10000, 亿: 100000000 }
  let total = 0
  let section = 0
  let number = 0
  for (const char of value) {
    if (digits[char] !== undefined) number = digits[char]
    else if (smallUnits[char]) {
      section += (number || 1) * smallUnits[char]
      number = 0
    } else if (largeUnits[char]) {
      section += number
      total += (section || 1) * largeUnits[char]
      section = 0
      number = 0
    }
  }
  return total + section + number
}

function localDates(text: string): { start: string; end: string }[] {
  const token = '[0-9零〇一二两三四五六七八九十]{1,4}'
  const pattern = new RegExp(
    `(?:(20\\d{2})\\s*[年/-])?(${token})\\s*[月/-]\\s*(${token})\\s*日?号?(?:\\s*(${token})\\s*[点时](?:\\s*(${token})\\s*分?)?)?`,
    'g',
  )
  const year = new Date().getFullYear()
  return [...text.matchAll(pattern)].flatMap((match) => {
    const month = parseLocalNumber(match[2])
    const day = parseLocalNumber(match[3])
    if (!month || !day || month > 12 || day > 31) return []
    const hour = match[4] == null ? null : parseLocalNumber(match[4])
    const minute = match[5] == null ? 0 : parseLocalNumber(match[5])
    const base = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const start = `${base}T${String(hour ?? 0).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00+08:00`
    const end = `${base}T${String(hour ?? 23).padStart(2, '0')}:${String(hour == null ? 59 : minute).padStart(2, '0')}:${hour == null ? '59' : '00'}+08:00`
    return [{ start, end }]
  })
}

function localCompleteReply(draft: GrowthIntakeDraft) {
  const store = draft.storeScope === 'all' ? '全部门店' : draft.storeName || '待确认门店'
  const baseline = draft.baselineValue == null ? '未提供' : `${draft.baselineValue}`
  const delta =
    draft.baselineValue == null || draft.targetValue == null
      ? '待结合当前基线计算'
      : `${Math.max(draft.targetValue - draft.baselineValue, 0)}`
  const taskType = draft.taskType === 'creator_content' ? '达人内容引流任务' : '客户优惠活动'
  return `信息已经齐全。我识别到：任务类型 ${taskType}；目标“${draft.goalBrief || draft.goalMetric}”；增长指标 ${draft.goalMetric}；当前基线 ${baseline}；目标值 ${draft.targetValue}；本期目标增量 ${delta}；总预算 ¥${draft.budget}；适用门店 ${store}；时间 ${draft.startAt} 至 ${draft.endAt}。请确认后生成增长方案。`
}
