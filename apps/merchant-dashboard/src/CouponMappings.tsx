import { LinkOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Typography,
  message,
} from 'antd'
import { useEffect, useState } from 'react'
import { api } from './api'

interface Coupon {
  couponId: string
  couponName: string
  couponCode: string
}
interface Campaign {
  coupons: Coupon[]
}
interface Product {
  productId: string
  productName: string
  status: 'draft' | 'on_sale' | 'off_shelf'
  skus: { skuId: string; skuName: string; price: number; status?: 'on_sale' | 'off_shelf' }[]
}
interface Mapping {
  mappingId: string
  type: 'catalogue' | 'legacy_external'
  productId?: string | null
  skuId?: string | null
  externalProductId?: string | null
  externalProductName?: string | null
  callbackUrl?: string | null
}

export default function CouponMappings({
  campaignId,
  open,
  onClose,
}: {
  campaignId: string | null
  open: boolean
  onClose: () => void
}) {
  const [couponId, setCouponId] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [externalForm] = Form.useForm()
  const campaign = useQuery({
    queryKey: ['merchant-campaign', campaignId],
    queryFn: () => api<Campaign>(`/merchant/campaigns/${campaignId}`),
    enabled: open && Boolean(campaignId),
  })
  const products = useQuery({
    queryKey: ['merchant-products-for-coupon'],
    queryFn: () => api<{ items: Product[] }>('/merchant/products?page=1&pageSize=100'),
    enabled: open,
  })
  const mappings = useQuery({
    queryKey: ['coupon-product-mappings', couponId],
    queryFn: () => api<{ items: Mapping[] }>(`/merchant/campaigns/coupons/${couponId}/products`),
    enabled: open && Boolean(couponId),
  })

  useEffect(() => {
    setCouponId('')
    setSelected([])
  }, [campaignId, open])
  useEffect(() => {
    const first = campaign.data?.coupons?.[0]?.couponId
    setCouponId(first ?? '')
  }, [campaign.data])
  useEffect(() => {
    if (mappings.data?.items)
      setSelected(
        mappings.data.items
          .filter((item) => item.type === 'catalogue' && item.productId)
          .map((item) =>
            item.skuId ? `${item.productId}::${item.skuId}` : `${item.productId}::all`,
          ),
      )
  }, [mappings.data])

  const saveCatalogue = async () => {
    const grouped = new Map<string, { full: boolean; skuIds: string[] }>()
    selected.forEach((value) => {
      const [productId, skuId] = value.split('::')
      const item = grouped.get(productId) ?? { full: false, skuIds: [] }
      if (skuId === 'all') item.full = true
      else item.skuIds.push(skuId)
      grouped.set(productId, item)
    })
    const productSelections = [...grouped.entries()].map(([productId, item]) =>
      item.full ? { productId } : { productId, skuIds: item.skuIds },
    )
    if (!productSelections.length) {
      message.error('至少选择一个营销商品或 SKU')
      return
    }
    try {
      await api(`/merchant/campaigns/coupons/${couponId}/products`, {
        method: 'PUT',
        body: JSON.stringify({ productSelections }),
      })
      message.success('优惠券营销商品已保存')
      void mappings.refetch()
    } catch (error) {
      message.error(error instanceof Error ? error.message : '保存失败')
    }
  }
  const addExternal = async (values: any) => {
    try {
      await api(`/merchant/campaigns/coupons/${couponId}/external-products`, {
        method: 'POST',
        body: JSON.stringify(values),
      })
      externalForm.resetFields()
      message.success('外部 API 商品映射已保存')
      void mappings.refetch()
    } catch (error) {
      message.error(error instanceof Error ? error.message : '保存失败')
    }
  }
  const removeExternal = async (mappingId: string) => {
    try {
      await api(`/merchant/campaigns/coupons/${couponId}/external-products/${mappingId}`, {
        method: 'DELETE',
      })
      message.success('外部映射已删除')
      void mappings.refetch()
    } catch (error) {
      message.error(error instanceof Error ? error.message : '删除失败')
    }
  }

  const availableProducts = (products.data?.items ?? []).filter(
    (product) => product.status !== 'off_shelf',
  )
  const productStatusLabel = (status: Product['status']) =>
    status === 'on_sale' ? '已上架' : status === 'draft' ? '草稿' : '已下架'
  const options = availableProducts.flatMap((product) => [
    {
      label: `${product.productName}（整款营销商品 · ${productStatusLabel(product.status)}）`,
      value: `${product.productId}::all`,
    },
    ...product.skus.map((sku) => ({
      label: `${product.productName} · ${sku.skuName}（¥${Number(sku.price).toFixed(2)} · ${productStatusLabel(product.status)}）`,
      value: `${product.productId}::${sku.skuId}`,
      disabled: sku.status === 'off_shelf',
    })),
  ])
  const external = mappings.data?.items?.filter((item) => item.type === 'legacy_external') ?? []
  return (
    <Modal
      title="优惠券商品与外部 API 映射"
      open={open}
      onCancel={onClose}
      footer={null}
      width={900}
      destroyOnClose
    >
      <Typography.Paragraph type="secondary">
        营销商品是统一商品目录，活动优惠券只保存优惠规则并通过这里关联商品；同一外部商品不能重复建立旧映射。修改仅允许在活动草稿阶段进行。
      </Typography.Paragraph>
      {campaign.isLoading ? (
        <Typography.Text>正在加载活动…</Typography.Text>
      ) : (
        <Select
          className="full-width"
          value={couponId || undefined}
          onChange={setCouponId}
          placeholder="选择优惠券"
          options={(campaign.data?.coupons ?? []).map((coupon) => ({
            value: coupon.couponId,
            label: `${coupon.couponName} · ${coupon.couponCode}`,
          }))}
        />
      )}
      {couponId && (
        <>
          <Card size="small" title="适用营销商品与 SKU" className="section">
            {products.isLoading ? (
              <Typography.Text type="secondary">正在加载营销商品…</Typography.Text>
            ) : products.error ? (
              <Alert
                type="error"
                showIcon
                message="营销商品加载失败"
                description={
                  products.error instanceof Error ? products.error.message : '请刷新后重试'
                }
              />
            ) : options.length === 0 ? (
              <Alert
                type="warning"
                showIcon
                message={products.data?.items?.length ? '暂无可关联的营销商品' : '还没有营销商品'}
                description={
                  products.data?.items?.length
                    ? '当前商品均已下架，请先在“营销商品”中重新上架。'
                    : '请先在“营销商品”中创建并保存商品，再回到这里建立优惠券关联。'
                }
              />
            ) : (
              <>
                <Checkbox.Group
                  className="mapping-options"
                  value={selected}
                  onChange={(values) => setSelected(values)}
                  options={options}
                />
                <Typography.Paragraph type="secondary" className="mapping-hint">
                  草稿商品可以先关联到草稿活动；活动正式发布前，请先将商品上架。
                </Typography.Paragraph>
              </>
            )}
            <div className="mapping-actions">
              <Button type="primary" onClick={saveCatalogue} disabled={!options.length}>
                保存营销商品关联
              </Button>
            </div>
          </Card>
          <Card
            size="small"
            title={
              <>
                <LinkOutlined /> 商家业务系统 API 映射
              </>
            }
            className="section"
          >
            <Alert
              type="info"
              showIcon
              message="避免重复映射"
              description="如果外部商品已经建立为营销商品，请直接选择上面的营销商品；同一外部商品不能同时建立旧映射。"
            />
            <Table
              className="section"
              size="small"
              rowKey="mappingId"
              pagination={false}
              dataSource={external}
              columns={[
                {
                  title: '外部商品',
                  render: (_, item: Mapping) => item.externalProductName || item.externalProductId,
                },
                { title: '外部 ID', dataIndex: 'externalProductId' },
                {
                  title: '核销回调 API',
                  dataIndex: 'callbackUrl',
                  render: (value) => value || '未配置',
                },
                {
                  title: '操作',
                  render: (_, item: Mapping) => (
                    <Button type="link" danger onClick={() => removeExternal(item.mappingId)}>
                      删除
                    </Button>
                  ),
                },
              ]}
              locale={{ emptyText: '暂无外部商品映射。' }}
            />
            <Form form={externalForm} layout="vertical" onFinish={addExternal} className="section">
              <Space wrap align="start">
                <Form.Item
                  name="externalProductId"
                  label="外部商品 ID"
                  rules={[{ required: true }]}
                >
                  <Input placeholder="POS / ERP 商品 ID" />
                </Form.Item>
                <Form.Item name="externalProductName" label="外部商品名称">
                  <Input placeholder="例如：双人套餐" />
                </Form.Item>
                <Form.Item name="externalCategory" label="类目">
                  <Input placeholder="餐饮" />
                </Form.Item>
                <Form.Item
                  name="callbackUrl"
                  label="核销回调 API"
                  rules={[{ type: 'url', message: '请输入完整 URL' }]}
                >
                  <Input placeholder="https://merchant.example.com/redeem" />
                </Form.Item>
                <Button htmlType="submit" icon={<LinkOutlined />}>
                  添加 API 映射
                </Button>
              </Space>
            </Form>
          </Card>
        </>
      )}
    </Modal>
  )
}
