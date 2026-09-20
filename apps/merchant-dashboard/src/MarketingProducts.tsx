import { BulbOutlined, MinusCircleOutlined, PlusOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import {
  Alert,
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from 'antd'
import { useState } from 'react'
import { api } from './api'

interface Sku {
  skuId?: string
  skuName: string
  skuCode: string
  attributes?: Record<string, string>
  price: number
  marketPrice?: number | null
  stock?: number | null
  status?: string
}

interface MarketingProduct {
  productId: string
  productName: string
  category?: string
  description?: string
  productSource: 'managed' | 'external'
  externalProductId?: string
  status: 'draft' | 'on_sale' | 'off_shelf'
  linkedCampaigns?: { couponId: string; campaignId: string; campaignName: string }[]
  skus: Sku[]
}

type ProductFormSku = Omit<Sku, 'attributes'> & { spec?: string }

const statusMeta: Record<string, [string, string]> = {
  draft: ['草稿', 'default'],
  on_sale: ['已上架', 'success'],
  off_shelf: ['已下架', 'warning'],
}

const productCategoryValues = [
  '代金券',
  '团购套餐券',
  '单品兑换券',
  '次卡 / 多次券',
  '体验券',
  '储值 / 礼品卡',
  '其他',
]
const productCategoryOptions = productCategoryValues.map((value) => ({ value, label: value }))

const normalizeProductCategory = (category?: unknown) => {
  const value = typeof category === 'string' ? category.trim() : ''
  return productCategoryValues.includes(value) ? value : '其他'
}

const initialSku: ProductFormSku = {
  skuName: '默认规格',
  skuCode: '',
  price: 0,
  stock: null,
  status: 'on_sale',
}

export default function MarketingProducts() {
  const [form] = Form.useForm()
  const [aiForm] = Form.useForm()
  const productSource = Form.useWatch('productSource', form) ?? 'managed'
  const [open, setOpen] = useState(false)
  const [aiOpen, setAiOpen] = useState(false)
  const [editing, setEditing] = useState<MarketingProduct | null>(null)
  const [aiBusy, setAiBusy] = useState(false)
  const [saving, setSaving] = useState(false)
  const products = useQuery({
    queryKey: ['merchant-products'],
    queryFn: () => api<{ items: MarketingProduct[] }>('/merchant/products?page=1&pageSize=100'),
  })
  const items = products.data?.items ?? []

  const edit = (product?: MarketingProduct) => {
    setEditing(product ?? null)
    form.resetFields()
    form.setFieldsValue(
      product
        ? {
            ...product,
            skus: product.skus.map((sku) => ({
              ...sku,
              spec: sku.attributes?.spec,
            })),
          }
        : { productSource: 'managed', status: 'draft', skus: [initialSku] },
    )
    setOpen(true)
  }

  const generateProduct = async (values: { prompt: string; category?: string }) => {
    setAiBusy(true)
    try {
      const result = await api<any>('/merchant/ai/products/preview', {
        method: 'POST',
        body: JSON.stringify(values),
      })
      const draft = result.product ?? result.data?.product ?? result.data ?? result
      if (!draft?.productName || !Array.isArray(draft.skus) || draft.skus.length === 0) {
        throw new Error('AI 返回的商品草稿不完整')
      }
      setEditing(null)
      form.resetFields()
      form.setFieldsValue({
        productName: draft.productName,
        category: normalizeProductCategory(draft.category ?? values.category),
        description: draft.description || '',
        productSource: 'managed',
        status: 'draft',
        skus: draft.skus.map((sku: any, index: number) => ({
          skuName: sku.skuName ?? sku.sku_name ?? `规格 ${index + 1}`,
          skuCode: sku.skuCode ?? sku.sku_code ?? `AI-SKU-${index + 1}`,
          spec: sku.spec ?? sku.attributes?.spec,
          price: Number(sku.price ?? 0),
          marketPrice:
            sku.marketPrice == null && sku.market_price == null
              ? undefined
              : Number(sku.marketPrice ?? sku.market_price),
          stock: null,
          status: 'on_sale',
        })),
      })
      setAiOpen(false)
      aiForm.resetFields()
      setOpen(true)
      message.success(
        result.usage?.provider === 'fallback'
          ? 'AI 服务暂不可用，已生成可编辑草稿，请核对后保存'
          : 'AI 已生成商品草稿，请核对后保存',
      )
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'AI 商品生成失败')
    } finally {
      setAiBusy(false)
    }
  }

  const save = async (values: any) => {
    if (values.productSource === 'external' && !values.externalProductId?.trim()) {
      message.error('外部映射营销商品必须填写外部商品 ID')
      return
    }
    const payload = {
      ...values,
      externalProductId:
        values.productSource === 'external'
          ? values.externalProductId?.trim() || undefined
          : undefined,
      description: values.description?.trim() || undefined,
      category: values.category?.trim() || undefined,
      skus: values.skus.map((sku: any) => ({
        ...sku,
        attributes: sku.spec?.trim() ? { spec: sku.spec.trim() } : {},
        price: Number(sku.price),
        marketPrice:
          sku.marketPrice === undefined || sku.marketPrice === null
            ? undefined
            : Number(sku.marketPrice),
        stock: sku.stock === undefined || sku.stock === '' ? null : Number(sku.stock),
        status: sku.status ?? 'on_sale',
      })),
    }
    setSaving(true)
    try {
      await api(editing ? `/merchant/products/${editing.productId}` : '/merchant/products', {
        method: editing ? 'PUT' : 'POST',
        body: JSON.stringify(payload),
      })
      message.success(editing ? '营销商品已更新' : '营销商品已创建')
      setOpen(false)
      void products.refetch()
    } catch (error) {
      message.error(error instanceof Error ? error.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const changeStatus = async (product: MarketingProduct, action: 'on-sale' | 'off-shelf') => {
    try {
      await api(`/merchant/products/${product.productId}/${action}`, { method: 'POST' })
      message.success(action === 'on-sale' ? '营销商品已上架' : '营销商品已下架')
      void products.refetch()
    } catch (error) {
      message.error(error instanceof Error ? error.message : '操作失败')
    }
  }

  return (
    <>
      <div className="heading">
        <div>
          <Typography.Title level={2}>营销商品</Typography.Title>
          <Typography.Text type="secondary">
            维护套餐、次卡等券类营销商品的 SKU、价格和可售库存；不管理实物履约。
          </Typography.Text>
        </div>
        <Space>
          <Button icon={<BulbOutlined />} onClick={() => setAiOpen(true)}>
            AI 生成商品
          </Button>
          <Button type="primary" onClick={() => edit()} icon={<PlusOutlined />}>
            新建营销商品
          </Button>
        </Space>
      </div>
      <Card>
        <Table
          rowKey="productId"
          loading={products.isLoading}
          dataSource={items}
          pagination={false}
          columns={[
            {
              title: '营销商品',
              dataIndex: 'productName',
              render: (name, product: MarketingProduct) => (
                <>
                  <Typography.Text strong>{name}</Typography.Text>
                  <br />
                  <Typography.Text type="secondary">
                    {product.category || '未分类'}
                    {product.productSource === 'external' && product.externalProductId
                      ? ` · 外部 ID：${product.externalProductId}`
                      : ''}
                  </Typography.Text>
                </>
              ),
            },
            {
              title: 'SKU / 价格',
              render: (_, product: MarketingProduct) =>
                product.skus?.length ? (
                  <>
                    {product.skus.length} 个 SKU
                    <br />
                    <Typography.Text type="secondary">
                      ¥{Math.min(...product.skus.map((sku) => Number(sku.price))).toFixed(2)} 起
                    </Typography.Text>
                  </>
                ) : (
                  '—'
                ),
            },
            {
              title: '库存',
              render: (_, product: MarketingProduct) =>
                product.skus?.some((sku) => sku.stock === null)
                  ? '不限'
                  : product.skus?.reduce((sum, sku) => sum + Number(sku.stock || 0), 0),
            },
            {
              title: '状态',
              dataIndex: 'status',
              render: (status) => {
                const [label, color] = statusMeta[status] ?? [status, 'default']
                return <Tag color={color}>{label}</Tag>
              },
            },
            {
              title: '已关联活动 / 优惠券',
              render: (_, product: MarketingProduct) =>
                product.linkedCampaigns?.length ? (
                  <Typography.Text
                    ellipsis={{
                      tooltip: product.linkedCampaigns.map((item) => item.campaignName).join('、'),
                    }}
                    style={{ maxWidth: 220, display: 'inline-block' }}
                  >
                    {product.linkedCampaigns.map((item) => item.campaignName).join('、')}
                  </Typography.Text>
                ) : (
                  <Typography.Text type="secondary">暂未关联</Typography.Text>
                ),
            },
            {
              title: '操作',
              render: (_, product: MarketingProduct) => (
                <Space>
                  <Button type="link" onClick={() => edit(product)}>
                    编辑 / 库存
                  </Button>
                  <Button
                    type="link"
                    onClick={() =>
                      void changeStatus(
                        product,
                        product.status === 'on_sale' ? 'off-shelf' : 'on-sale',
                      )
                    }
                  >
                    {product.status === 'on_sale' ? '下架' : '上架'}
                  </Button>
                </Space>
              ),
            },
          ]}
          locale={{ emptyText: '暂无营销商品，请先创建套餐、次卡等券类商品。' }}
        />
      </Card>

      <Modal
        title="AI 生成营销商品"
        open={aiOpen}
        footer={null}
        onCancel={() => setAiOpen(false)}
        destroyOnHidden
      >
        <Alert
          className="section"
          type="info"
          showIcon
          message="AI 只生成待审核草稿"
          description="请描述套餐内容、规格和价格。生成后仍需你检查 SKU、价格和库存，再保存或上架。"
        />
        <Form form={aiForm} layout="vertical" onFinish={generateProduct}>
          <Form.Item
            name="prompt"
            label="商品描述"
            rules={[{ required: true, whitespace: true, message: '请描述要生成的营销商品' }]}
          >
            <Input.TextArea
              rows={5}
              placeholder="例如：生成一个双人火锅套餐，原价 298 元，售价 198 元，包含午市和晚市两种规格"
            />
          </Form.Item>
          <Form.Item name="category" label="类目提示">
            <Select
              showSearch
              allowClear
              options={productCategoryOptions}
              placeholder="可选，例如：团购套餐券"
            />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={aiBusy} block>
            生成商品草稿
          </Button>
        </Form>
      </Modal>

      <Modal
        title={editing ? '编辑营销商品' : '新建营销商品'}
        open={open}
        width={900}
        onCancel={() => setOpen(false)}
        footer={null}
        destroyOnHidden
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={save}
          initialValues={{ productSource: 'managed', status: 'draft', skus: [initialSku] }}
        >
          <Space size="middle" className="full-width" align="start">
            <Form.Item
              name="productName"
              label="营销商品名称"
              rules={[{ required: true, message: '请输入名称' }]}
              className="grow"
            >
              <Input placeholder="例如：双人套餐券" />
            </Form.Item>
            <Form.Item
              name="category"
              label="商品类目"
              rules={[{ required: true, message: '请选择或填写商品类目' }]}
              className="grow"
            >
              <Select
                showSearch
                allowClear
                options={productCategoryOptions}
                placeholder="例如：团购套餐券"
              />
            </Form.Item>
          </Space>
          <Form.Item name="description" label="说明">
            <Input.TextArea rows={2} placeholder="用于活动展示的券类商品说明" />
          </Form.Item>
          <Space size="middle" className="full-width" align="start">
            <Form.Item name="productSource" label="来源" className="grow">
              <Select
                onChange={(value) => {
                  if (value === 'managed') form.setFieldValue('externalProductId', undefined)
                }}
                options={[
                  { value: 'managed', label: '平台维护' },
                  { value: 'external', label: '外部系统映射' },
                ]}
              />
            </Form.Item>
            {productSource === 'external' && (
              <Form.Item
                name="externalProductId"
                label="外部商品 ID"
                rules={[{ required: true, whitespace: true, message: '请输入外部商品 ID' }]}
                className="grow"
              >
                <Input placeholder="POS / ERP 商品 ID" />
              </Form.Item>
            )}
          </Space>
          <Typography.Title level={5}>SKU、价格与库存</Typography.Title>
          <Form.List name="skus">
            {(fields, { add, remove }) => (
              <>
                {fields.map((field) => (
                  <Card size="small" key={field.key} className="sku-card">
                    <Space size="small" align="start" wrap>
                      <Form.Item
                        name={[field.name, 'skuName']}
                        label="SKU 名称"
                        rules={[{ required: true }]}
                      >
                        <Input />
                      </Form.Item>
                      <Form.Item
                        name={[field.name, 'skuCode']}
                        label="SKU 编码"
                        rules={[{ required: true }]}
                      >
                        <Input />
                      </Form.Item>
                      <Form.Item name={[field.name, 'spec']} label="规格">
                        <Input placeholder="如：午市 / 双人" />
                      </Form.Item>
                      <Form.Item
                        name={[field.name, 'price']}
                        label="售价"
                        rules={[{ required: true }]}
                      >
                        <InputNumber min={0} precision={2} />
                      </Form.Item>
                      <Form.Item name={[field.name, 'marketPrice']} label="原价（门店日常价）">
                        <InputNumber min={0} precision={2} />
                      </Form.Item>
                      <Form.Item name={[field.name, 'stock']} label="库存">
                        <InputNumber min={0} precision={0} placeholder="不限" />
                      </Form.Item>
                      <Button
                        danger
                        type="text"
                        icon={<MinusCircleOutlined />}
                        onClick={() => remove(field.name)}
                        disabled={fields.length === 1}
                      >
                        移除
                      </Button>
                    </Space>
                  </Card>
                ))}
                <Button type="dashed" icon={<PlusOutlined />} onClick={() => add(initialSku)}>
                  添加 SKU
                </Button>
              </>
            )}
          </Form.List>
          <Space className="modal-actions">
            <Button onClick={() => setOpen(false)}>取消</Button>
            <Button type="primary" htmlType="submit" loading={saving}>
              保存营销商品
            </Button>
          </Space>
        </Form>
      </Modal>
    </>
  )
}
