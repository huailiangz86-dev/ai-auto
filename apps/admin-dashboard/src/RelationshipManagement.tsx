import { useQuery } from '@tanstack/react-query'
import { Button, Card, Input, Modal, Result, Space, Table, Tag, Typography, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useState } from 'react'
import {
  getLifecycleRelationships,
  releaseLifecycleRelationship,
  restrictLifecycleRelationship,
  unbindLifecycleRelationship,
  type LifecycleRelationship,
} from './api/lifecycle'

type Action = 'restrict' | 'release' | 'unbind'

export function RelationshipManagement() {
  const [merchantId, setMerchantId] = useState('')
  const [creatorId, setCreatorId] = useState('')
  const [actionTarget, setActionTarget] = useState<{
    relationship: LifecycleRelationship
    action: Action
  } | null>(null)
  const [reason, setReason] = useState('')
  const query = useQuery({
    queryKey: ['lifecycle-relationships', merchantId, creatorId],
    queryFn: () =>
      getLifecycleRelationships({
        merchantId: merchantId || undefined,
        creatorId: creatorId || undefined,
      }),
  })
  const actionLabel: Record<Action, string> = {
    restrict: '限制合作',
    release: '解除限制',
    unbind: '解绑合作',
  }
  const submit = async () => {
    if (!actionTarget) return
    if (actionTarget.action !== 'release' && !reason.trim()) {
      message.error('请填写操作原因')
      return
    }
    try {
      if (actionTarget.action === 'restrict')
        await restrictLifecycleRelationship(actionTarget.relationship.id, reason.trim())
      if (actionTarget.action === 'release')
        await releaseLifecycleRelationship(actionTarget.relationship.id, reason.trim() || undefined)
      if (actionTarget.action === 'unbind')
        await unbindLifecycleRelationship(actionTarget.relationship.id, reason.trim())
      message.success(`${actionLabel[actionTarget.action]}已完成`)
      setActionTarget(null)
      setReason('')
      await query.refetch()
    } catch (error) {
      message.error(error instanceof Error ? error.message : '合作关系操作失败')
    }
  }
  const columns: ColumnsType<LifecycleRelationship> = [
    {
      title: '商户',
      dataIndex: 'merchant',
      render: (merchant: LifecycleRelationship['merchant']) => (
        <Space direction="vertical" size={0}>
          <Typography.Text strong>{merchant.businessName}</Typography.Text>
          <Typography.Text type="secondary" code>
            {merchant.id}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: '创作者',
      dataIndex: 'creator',
      render: (creator: LifecycleRelationship['creator']) =>
        creator ? (
          <Space direction="vertical" size={0}>
            <Typography.Text>{creator.nickname || '未命名创作者'}</Typography.Text>
            <Typography.Text type="secondary">{creator.phone || creator.id}</Typography.Text>
          </Space>
        ) : (
          <Tag>待绑定</Tag>
        ),
    },
    {
      title: '合作状态',
      dataIndex: 'bindingStatus',
      render: (value: LifecycleRelationship['bindingStatus']) => (
        <Tag
          color={value === 'active' ? 'success' : value === 'unbound' ? 'default' : 'processing'}
        >
          {relationshipStatus(value)}
        </Tag>
      ),
    },
    {
      title: '限制状态',
      key: 'restriction',
      render: (_, row) =>
        row.restrictedAt ? (
          <Space direction="vertical" size={0}>
            <Tag color="warning">已限制</Tag>
            <Typography.Text type="secondary">
              {row.restrictionReason || '未填写原因'}
            </Typography.Text>
          </Space>
        ) : (
          <Tag color="success">未限制</Tag>
        ),
    },
    {
      title: '合作质量',
      dataIndex: 'cooperationQuality',
      render: (quality: LifecycleRelationship['cooperationQuality']) =>
        quality.score === null
          ? '暂无任务'
          : `${quality.score} 分（${quality.completed}/${quality.total}）`,
    },
    { title: '最近绑定', dataIndex: 'boundAt', render: formatDate },
    {
      title: '操作',
      key: 'action',
      fixed: 'right',
      render: (_, row) =>
        row.bindingStatus === 'unbound' ? (
          <Typography.Text type="secondary">已解绑</Typography.Text>
        ) : (
          <Space wrap>
            {row.restrictedAt ? (
              <Button type="link" onClick={() => openAction(row, 'release')}>
                解除限制
              </Button>
            ) : (
              <Button type="link" onClick={() => openAction(row, 'restrict')}>
                限制合作
              </Button>
            )}
            <Button danger type="link" onClick={() => openAction(row, 'unbind')}>
              解绑
            </Button>
          </Space>
        ),
    },
  ]
  const openAction = (relationship: LifecycleRelationship, action: Action) => {
    setActionTarget({ relationship, action })
    setReason('')
  }
  return (
    <>
      <Card className="filter-card" size="small">
        <Space wrap>
          <Input
            allowClear
            value={merchantId}
            onChange={(event) => setMerchantId(event.target.value)}
            placeholder="商户 ID（可选）"
            className="scope-input"
          />
          <Input
            allowClear
            value={creatorId}
            onChange={(event) => setCreatorId(event.target.value)}
            placeholder="创作者 ID（可选）"
            className="scope-input"
          />
          <Button onClick={() => void query.refetch()} loading={query.isFetching}>
            刷新关系
          </Button>
        </Space>
      </Card>
      {query.isError ? (
        <Result
          status="error"
          title="无法加载合作关系"
          subTitle={query.error.message}
          extra={<Button onClick={() => void query.refetch()}>重试</Button>}
        />
      ) : (
        <Card title={`合作关系（${query.data?.length ?? 0}）`}>
          <Table
            rowKey="id"
            columns={columns}
            dataSource={query.data ?? []}
            loading={query.isLoading}
            scroll={{ x: 1100 }}
            pagination={{ pageSize: 20, showSizeChanger: false }}
            locale={{ emptyText: '暂无合作关系记录' }}
          />
        </Card>
      )}
      <Modal
        open={Boolean(actionTarget)}
        title={actionTarget ? actionLabel[actionTarget.action] : ''}
        onCancel={() => setActionTarget(null)}
        onOk={() => void submit()}
        okText="确认操作"
        cancelText="取消"
      >
        {actionTarget ? (
          <>
            <Typography.Paragraph type="secondary">
              {actionTarget.relationship.merchant.businessName} 与{' '}
              {actionTarget.relationship.creator?.nickname || '待绑定创作者'} 的合作关系将
              {actionTarget.action === 'restrict'
                ? '被限制，限制期间不应继续分配合作任务'
                : actionTarget.action === 'release'
                  ? '恢复为可合作状态'
                  : '被解除，后续新任务不再分配给该关系'}
              。
            </Typography.Paragraph>
            <Input.TextArea
              autoFocus
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder={
                actionTarget.action === 'release' ? '可填写解除说明' : '请填写操作原因（必填）'
              }
              rows={4}
              maxLength={500}
              showCount
            />
          </>
        ) : null}
      </Modal>
    </>
  )
}

function relationshipStatus(value: string) {
  return (
    (
      {
        pending: '待接受',
        registered: '待审核',
        active: '合作中',
        rejected: '已拒绝',
        unbound: '已解绑',
      } as Record<string, string>
    )[value] ?? value
  )
}
function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '—'
}
