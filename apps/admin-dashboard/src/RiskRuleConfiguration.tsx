import { useQuery } from '@tanstack/react-query'
import { DeleteOutlined, EditOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons'
import {
  Button,
  Card,
  Checkbox,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Result,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
  message,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useState } from 'react'
import {
  RISK_RULE_ACTIONS,
  RISK_RULE_TRIGGER_TYPES,
  createRiskRule,
  deleteRiskRule,
  getRiskRules,
  updateRiskRule,
  type RiskRule,
} from './api/operations'

const triggerLabels: Record<RiskRule['triggerType'], string> = {
  redemption_frequency: '高频核销',
  redemption_rate: '核销率异常',
  self_redemption: '疑似自核销',
  ip_clustering: 'IP 聚集',
  device_clustering: '设备聚集',
  commission_anomaly: '佣金异常',
  content_violation: '内容违规',
}
const actionLabels: Record<(typeof RISK_RULE_ACTIONS)[number], string> = {
  create_alert: '发送告警',
  manual_review: '人工审核',
  freeze_commission: '冻结佣金',
  pause_campaign: '暂停活动',
  restrict_relationship: '限制合作',
}
const severityLabels: Record<RiskRule['severity'], string> = {
  critical: '严重',
  warning: '警告',
  notice: '注意',
}
const severityColors: Record<RiskRule['severity'], string> = {
  critical: 'error',
  warning: 'warning',
  notice: 'gold',
}

interface RuleFormValues {
  name: string
  ruleKey: string
  triggerType: RiskRule['triggerType']
  severity: RiskRule['severity']
  conditionConfig: RiskRule['conditionConfig']
  actions: RiskRule['actions']
  description?: string
  enabled: boolean
}

const emptyForm: RuleFormValues = {
  name: '',
  ruleKey: '',
  triggerType: 'redemption_frequency',
  severity: 'warning',
  conditionConfig: { windowMinutes: 15, threshold: 10 },
  actions: ['create_alert', 'manual_review'],
  description: '',
  enabled: true,
}

export function RiskRuleConfiguration() {
  const [status, setStatus] = useState<'all' | 'enabled' | 'disabled'>('all')
  const [triggerType, setTriggerType] = useState<RiskRule['triggerType'] | ''>('')
  const [editor, setEditor] = useState<{ rule?: RiskRule } | null>(null)
  const [saving, setSaving] = useState(false)
  const query = useQuery({
    queryKey: ['risk-rules', status, triggerType],
    queryFn: () =>
      getRiskRules({
        enabled: status === 'all' ? undefined : status === 'enabled',
        triggerType: triggerType || undefined,
      }),
  })
  const rules = query.data?.items ?? []
  const submit = async (values: RuleFormValues) => {
    setSaving(true)
    try {
      const payload = {
        ...values,
        ruleKey: values.ruleKey.trim().toLowerCase(),
        name: values.name.trim(),
        conditionConfig: Object.fromEntries(
          Object.entries(values.conditionConfig ?? {}).filter(
            ([, value]) => value !== undefined && value !== null && value !== '',
          ),
        ),
        actions: values.actions,
        description: values.description?.trim() || undefined,
      }
      if (editor?.rule) await updateRiskRule(editor.rule.id, payload)
      else await createRiskRule(payload)
      message.success(editor?.rule ? '风控规则已更新' : '风控规则已创建')
      setEditor(null)
      await query.refetch()
    } catch (error) {
      message.error(error instanceof Error ? error.message : '保存规则失败')
    } finally {
      setSaving(false)
    }
  }
  const toggle = async (rule: RiskRule, enabled: boolean) => {
    try {
      await updateRiskRule(rule.id, { enabled })
      message.success(enabled ? '规则已启用' : '规则已停用')
      await query.refetch()
    } catch (error) {
      message.error(error instanceof Error ? error.message : '更新规则状态失败')
    }
  }
  const remove = async (rule: RiskRule) => {
    try {
      await deleteRiskRule(rule.id)
      message.success('规则已删除')
      await query.refetch()
    } catch (error) {
      message.error(error instanceof Error ? error.message : '删除规则失败')
    }
  }
  const columns: ColumnsType<RiskRule> = [
    {
      title: '规则',
      key: 'rule',
      render: (_, rule) => (
        <Space direction="vertical" size={0}>
          <Typography.Text strong>{rule.name}</Typography.Text>
          <Typography.Text type="secondary" code>
            {rule.ruleKey}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: '触发类型',
      dataIndex: 'triggerType',
      render: (value: RiskRule['triggerType']) => triggerLabels[value],
    },
    {
      title: '级别',
      dataIndex: 'severity',
      render: (value: RiskRule['severity']) => (
        <Tag color={severityColors[value]}>{severityLabels[value]}</Tag>
      ),
    },
    {
      title: '条件',
      dataIndex: 'conditionConfig',
      render: (value: RiskRule['conditionConfig']) => formatCondition(value),
    },
    {
      title: '自动操作',
      dataIndex: 'actions',
      render: (values: RiskRule['actions']) => (
        <Space wrap>
          {values.map((value) => (
            <Tag key={value}>{actionLabels[value]}</Tag>
          ))}
        </Space>
      ),
    },
    { title: '版本', dataIndex: 'version', render: (value) => `v${value}` },
    {
      title: '状态',
      dataIndex: 'enabled',
      render: (enabled: boolean, rule) => (
        <Switch
          checked={enabled}
          checkedChildren="启用"
          unCheckedChildren="停用"
          onChange={(value) => void toggle(rule, value)}
        />
      ),
    },
    {
      title: '操作',
      key: 'action',
      fixed: 'right',
      render: (_, rule) => (
        <Space>
          <Button type="link" icon={<EditOutlined />} onClick={() => setEditor({ rule })}>
            编辑
          </Button>
          <Popconfirm
            title="确认删除这条风控规则？"
            description="删除后不再参与后续风险评估，历史告警不受影响。"
            okText="删除"
            cancelText="取消"
            okButtonProps={{ danger: true }}
            onConfirm={() => void remove(rule)}
          >
            <Button danger type="link" icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]
  return (
    <>
      <Card className="filter-card" size="small">
        <Space wrap>
          <Select
            value={status}
            onChange={setStatus}
            options={[
              { value: 'all', label: '全部状态' },
              { value: 'enabled', label: '仅启用' },
              { value: 'disabled', label: '仅停用' },
            ]}
          />
          <Select
            allowClear
            value={triggerType || undefined}
            onChange={(value) => setTriggerType(value ?? '')}
            placeholder="全部触发类型"
            options={RISK_RULE_TRIGGER_TYPES.map((value) => ({
              value,
              label: triggerLabels[value],
            }))}
            className="scope-input"
          />
          <Button
            icon={<ReloadOutlined spin={query.isFetching} />}
            onClick={() => void query.refetch()}
            loading={query.isFetching}
          >
            刷新
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setEditor({})}>
            新增规则
          </Button>
        </Space>
      </Card>
      <AlertSummary
        total={query.data?.summary.total ?? 0}
        enabled={query.data?.summary.enabled ?? 0}
        disabled={query.data?.summary.disabled ?? 0}
      />
      {query.isError ? (
        <Result
          status="error"
          title="无法加载风控规则"
          subTitle={query.error.message}
          extra={<Button onClick={() => void query.refetch()}>重试</Button>}
        />
      ) : (
        <Card title="规则清单">
          <Table
            rowKey="id"
            columns={columns}
            dataSource={rules.filter((rule) => status !== 'disabled' || !rule.enabled)}
            loading={query.isLoading}
            scroll={{ x: 1180 }}
            pagination={{ pageSize: 10, showSizeChanger: false }}
            locale={{ emptyText: '还没有配置风控规则' }}
          />
        </Card>
      )}
      <RuleEditor
        open={Boolean(editor)}
        rule={editor?.rule}
        saving={saving}
        onCancel={() => setEditor(null)}
        onSubmit={submit}
      />
    </>
  )
}

function AlertSummary({
  total,
  enabled,
  disabled,
}: {
  total: number
  enabled: number
  disabled: number
}) {
  return (
    <div className="risk-rule-summary">
      <Card size="small">
        <Typography.Text type="secondary">规则总数</Typography.Text>
        <Typography.Title level={3}>{total}</Typography.Title>
      </Card>
      <Card size="small">
        <Typography.Text type="secondary">启用中</Typography.Text>
        <Typography.Title level={3} className="positive">
          {enabled}
        </Typography.Title>
      </Card>
      <Card size="small">
        <Typography.Text type="secondary">已停用</Typography.Text>
        <Typography.Title level={3} className="negative">
          {disabled}
        </Typography.Title>
      </Card>
    </div>
  )
}

function RuleEditor({
  open,
  rule,
  saving,
  onCancel,
  onSubmit,
}: {
  open: boolean
  rule?: RiskRule
  saving: boolean
  onCancel: () => void
  onSubmit: (values: RuleFormValues) => Promise<void>
}) {
  const [form] = Form.useForm<RuleFormValues>()
  const trigger = Form.useWatch('triggerType', form)
  const initial = rule
    ? {
        name: rule.name,
        ruleKey: rule.ruleKey,
        triggerType: rule.triggerType,
        severity: rule.severity,
        conditionConfig: rule.conditionConfig,
        actions: rule.actions,
        description: rule.description ?? '',
        enabled: rule.enabled,
      }
    : emptyForm
  return (
    <Modal
      open={open}
      title={rule ? '编辑风控规则' : '新增风控规则'}
      width={680}
      destroyOnClose
      confirmLoading={saving}
      okText="保存规则"
      cancelText="取消"
      onCancel={onCancel}
      onOk={() => void form.submit()}
      afterOpenChange={(visible) => {
        if (visible) form.setFieldsValue(initial)
      }}
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={initial}
        onFinish={(values) => void onSubmit(values)}
      >
        <Space size="middle" style={{ display: 'flex' }}>
          <Form.Item
            name="name"
            label="规则名称"
            rules={[{ required: true, message: '请输入规则名称' }]}
            style={{ flex: 1 }}
          >
            <Input placeholder="例如：同一分享员高频核销" />
          </Form.Item>
          <Form.Item
            name="ruleKey"
            label="规则标识"
            rules={[
              {
                required: true,
                pattern: /^[a-z][a-z0-9_]{2,79}$/,
                message: '使用小写字母、数字和下划线（3-80 位）',
              },
            ]}
            style={{ flex: 1 }}
          >
            <Input placeholder="high_frequency_redemption" />
          </Form.Item>
        </Space>
        <Space size="middle" style={{ display: 'flex' }}>
          <Form.Item
            name="triggerType"
            label="触发类型"
            rules={[{ required: true }]}
            style={{ flex: 1 }}
          >
            <Select
              options={RISK_RULE_TRIGGER_TYPES.map((value) => ({
                value,
                label: triggerLabels[value],
              }))}
            />
          </Form.Item>
          <Form.Item
            name="severity"
            label="告警级别"
            rules={[{ required: true }]}
            style={{ flex: 1 }}
          >
            <Select
              options={(Object.keys(severityLabels) as RiskRule['severity'][]).map((value) => ({
                value,
                label: severityLabels[value],
              }))}
            />
          </Form.Item>
          <Form.Item name="enabled" label="状态" valuePropName="checked">
            <Switch checkedChildren="启用" unCheckedChildren="停用" />
          </Form.Item>
        </Space>
        <Typography.Text type="secondary">触发条件</Typography.Text>
        <Space size="middle" style={{ display: 'flex', marginTop: 8 }}>
          <Form.Item
            name={['conditionConfig', 'windowMinutes']}
            label="时间窗口（分钟）"
            rules={[{ type: 'number', min: 1 }]}
            style={{ flex: 1 }}
          >
            <InputNumber min={1} max={525600} style={{ width: '100%' }} placeholder="滚动窗口" />
          </Form.Item>
          <Form.Item
            name={['conditionConfig', 'threshold']}
            label={trigger === 'redemption_rate' ? '阈值（可选）' : '数量阈值'}
            style={{ flex: 1 }}
          >
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name={['conditionConfig', 'multiplier']} label="均值倍数" style={{ flex: 1 }}>
            <InputNumber min={0} step={0.1} style={{ width: '100%' }} />
          </Form.Item>
        </Space>
        <Form.Item
          name="actions"
          label="自动操作"
          rules={[{ required: true, type: 'array', min: 1, message: '至少选择一个自动操作' }]}
        >
          <Checkbox.Group
            options={RISK_RULE_ACTIONS.map((value) => ({ value, label: actionLabels[value] }))}
          />
        </Form.Item>
        <Form.Item name="description" label="规则说明">
          <Input.TextArea
            rows={3}
            maxLength={2000}
            showCount
            placeholder="说明适用范围和人工处置注意事项"
          />
        </Form.Item>
      </Form>
    </Modal>
  )
}

function formatCondition(condition: RiskRule['conditionConfig']) {
  const parts: string[] = []
  if (condition.windowMinutes !== undefined) parts.push(`滚动 ${condition.windowMinutes} 分钟`)
  if (condition.threshold !== undefined) parts.push(`超过 ${condition.threshold}`)
  if (condition.multiplier !== undefined) parts.push(`${condition.multiplier} 倍均值`)
  if (condition.metric) parts.push(condition.metric)
  return parts.length ? parts.join(' · ') : '按事件条件'
}
