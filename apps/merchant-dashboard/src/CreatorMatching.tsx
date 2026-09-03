import { useQuery } from '@tanstack/react-query'
import {
  Alert,
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from 'antd'
import { useState } from 'react'
import { api } from './api'

type GrowthTask = { growthTaskId: string; status: string; endAt: string }

export default function CreatorMatching({
  growthTask,
  funded,
  onChanged,
}: {
  growthTask: GrowthTask
  funded: boolean
  onChanged: () => void
}) {
  const [channel, setChannel] = useState('douyin')
  const [contentType, setContentType] = useState('short_video')
  const [selected, setSelected] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const matches = useQuery({
    queryKey: ['creator-matches', growthTask.growthTaskId, channel, contentType],
    queryFn: () =>
      api<any>(
        `/merchant/growth-tasks/${growthTask.growthTaskId}/creator-matches?channel=${encodeURIComponent(channel)}&contentType=${encodeURIComponent(contentType)}`,
      ),
    enabled: funded && growthTask.status === 'active',
  })
  const activate = async () => {
    setBusy(true)
    try {
      await api(`/merchant/growth-tasks/${growthTask.growthTaskId}/activate`, { method: 'POST' })
      message.success('Growth Task 已启动，可以匹配创作者')
      onChanged()
    } catch (error) {
      message.error(error instanceof Error ? error.message : '启动失败')
    } finally {
      setBusy(false)
    }
  }
  const invite = async (values: any) => {
    if (!selected.length) {
      message.warning('请至少选择一位创作者')
      return
    }
    setBusy(true)
    try {
      const response = await api<any>(
        `/merchant/growth-tasks/${growthTask.growthTaskId}/creator-invitations`,
        {
          method: 'POST',
          body: JSON.stringify({
            ...values,
            creatorIds: selected,
            channel,
            contentType,
            deadline: new Date(values.deadline).toISOString(),
          }),
        },
      )
      message.success(`已向 ${response.invitedCount} 位创作者发出邀约`)
      setSelected([])
      matches.refetch()
      onChanged()
    } catch (error) {
      message.error(error instanceof Error ? error.message : '邀约发送失败')
    } finally {
      setBusy(false)
    }
  }
  if (!funded)
    return (
      <Alert
        className="section"
        type="info"
        showIcon
        message="确认并冻结资金后，即可启动创作者匹配与邀约。"
      />
    )
  if (growthTask.status !== 'active')
    return (
      <Card
        className="section"
        title="创作者匹配与邀约"
        extra={
          <Button type="primary" loading={busy} onClick={activate}>
            启动匹配
          </Button>
        }
      >
        <Typography.Text type="secondary">
          资金已确认。启动后，系统会仅展示通过治理、账号渠道和任务容量校验的创作者。
        </Typography.Text>
      </Card>
    )
  return (
    <Card
      className="section"
      title="创作者匹配与邀约"
      extra={<Tag color="success">Growth Task 进行中</Tag>}
    >
      <Space wrap className="section" style={{ marginTop: 0 }}>
        <Input
          value={channel}
          onChange={(event) => setChannel(event.target.value)}
          placeholder="渠道，例如 douyin"
        />
        <Input
          value={contentType}
          onChange={(event) => setContentType(event.target.value)}
          placeholder="内容形式，例如 short_video"
        />
        <Button onClick={() => matches.refetch()}>刷新匹配</Button>
      </Space>
      <Table
        className="section"
        rowKey="creatorId"
        size="small"
        loading={matches.isLoading}
        dataSource={matches.data?.items ?? []}
        rowSelection={{
          selectedRowKeys: selected,
          onChange: (keys) => setSelected(keys as string[]),
        }}
        columns={[
          {
            title: '创作者',
            render: (_, item: any) => item.nickname || `创作者 ${item.creatorId.slice(0, 8)}`,
          },
          {
            title: '匹配分',
            dataIndex: 'matchingScore',
            render: (value) => <Tag color="processing">{value}</Tag>,
          },
          { title: 'Growth Score', dataIndex: 'creatorGrowthScore' },
          {
            title: '区域 / 类目',
            render: (_, item: any) =>
              `${item.region || '未标注'} · ${(item.creatorCategories ?? []).join('、') || '未标注'}`,
          },
          {
            title: '解释',
            render: (_, item: any) => (
              <Typography.Text type="secondary">
                {item.explanation?.reasons?.join('；')}
              </Typography.Text>
            ),
          },
          {
            title: '在进行任务',
            render: (_, item: any) =>
              `${item.activeTaskCount}${item.taskLimit == null ? '' : ` / ${item.taskLimit}`}`,
          },
        ]}
        locale={{ emptyText: '当前没有符合全部治理、渠道与容量条件的创作者。' }}
      />
      <Form
        className="section"
        layout="vertical"
        onFinish={invite}
        initialValues={{ baseReward: 100, campaignCredits: 10 }}
      >
        <Typography.Text strong>向已选 {selected.length} 位创作者发送相同任务邀约</Typography.Text>
        <Form.Item
          name="brief"
          label="创作简报"
          rules={[{ required: true, message: '请说明推广内容与交付要求' }]}
        >
          <Input.TextArea
            rows={3}
            placeholder="例如：介绍门店双人套餐，突出到店核销规则与探店体验"
          />
        </Form.Item>
        <Space wrap align="start">
          <Form.Item name="deadline" label="提交截止时间" rules={[{ required: true }]}>
            <Input type="datetime-local" max={growthTask.endAt.slice(0, 16)} />
          </Form.Item>
          <Form.Item name="baseReward" label="每人基础报酬（元）" rules={[{ required: true }]}>
            <InputNumber min={0} precision={2} />
          </Form.Item>
          <Form.Item
            name="campaignCredits"
            label="每人 Campaign Credits"
            rules={[{ required: true }]}
          >
            <InputNumber min={0} precision={2} />
          </Form.Item>
        </Space>
        <Button type="primary" htmlType="submit" loading={busy} disabled={!selected.length}>
          发送邀约并预留预算
        </Button>
      </Form>
    </Card>
  )
}
