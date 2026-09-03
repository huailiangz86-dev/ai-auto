import { MinusCircleOutlined, PlusOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { Button, Card, Form, Input, InputNumber, Modal, Select, Space, Table, Tag, Typography, message } from 'antd'
import { useState } from 'react'
import { api } from './api'

type Sku = { skuId?: string; skuName: string; skuCode: string; attributes?: Record<string, string>; price: number; marketPrice?: number; stock?: number | null; status?: string }
type MarketingProduct = { productId: string; productName: string; category?: string; description?: string; productSource: 'managed' | 'external'; externalProductId?: string; status: 'draft' | 'on_sale' | 'off_shelf'; skus: Sku[] }

const statusMeta: Record<string, [string, string]> = { draft: ['草稿', 'default'], on_sale: ['已上架', 'success'], off_shelf: ['已下架', 'warning'] }
const productCategoryOptions = ['代金券', '团购套餐券', '单品兑换券', '次卡 / 多次券', '体验券', '储值 / 礼品卡', '其他'].map((value) => ({ value, label: value }))
const initialSku = { skuName: '默认规格', skuCode: '', price: 0, stock: null, status: 'on_sale' }

export default function MarketingProducts() {
  const [form] = Form.useForm()
  const productSource = Form.useWatch('productSource', form) ?? 'managed'
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<MarketingProduct | null>(null)
  const products = useQuery({ queryKey: ['merchant-products'], queryFn: () => api<{ items: MarketingProduct[] }>('/merchant/products?page=1&pageSize=100') })
  const items = products.data?.items ?? []

  const edit = (product?: MarketingProduct) => {
    setEditing(product ?? null)
    form.setFieldsValue(product ? { ...product, skus: product.skus.map((sku) => ({ ...sku, spec: sku.attributes?.spec })) } : { productSource: 'managed', status: 'draft', skus: [initialSku] })
    setOpen(true)
  }
  const save = async (values: any) => {
    if (values.productSource === 'external' && !values.externalProductId?.trim()) { message.error('外部映射营销商品必须填写外部商品 ID'); return }
    const payload = {
      ...values,
      externalProductId: values.productSource === 'external' ? values.externalProductId?.trim() || undefined : undefined,
      description: values.description?.trim() || undefined,
      category: values.category?.trim() || undefined,
      skus: values.skus.map((sku: any) => ({ ...sku, attributes: sku.spec?.trim() ? { spec: sku.spec.trim() } : {}, price: Number(sku.price), marketPrice: sku.marketPrice === undefined || sku.marketPrice === null ? undefined : Number(sku.marketPrice), stock: sku.stock === undefined || sku.stock === '' ? null : Number(sku.stock), status: sku.status ?? 'on_sale' })),
    }
    try { await api(editing ? `/merchant/products/${editing.productId}` : '/merchant/products', { method: editing ? 'PUT' : 'POST', body: JSON.stringify(payload) }); message.success(editing ? '营销商品已更新' : '营销商品已创建'); setOpen(false); products.refetch() } catch (error) { message.error(error instanceof Error ? error.message : '保存失败') }
  }
  const changeStatus = async (product: MarketingProduct, action: 'on-sale' | 'off-shelf') => { try { await api(`/merchant/products/${product.productId}/${action}`, { method: 'POST' }); message.success(action === 'on-sale' ? '营销商品已上架' : '营销商品已下架'); products.refetch() } catch (error) { message.error(error instanceof Error ? error.message : '操作失败') } }

  return <><div className="heading"><div><Typography.Title level={2}>营销商品</Typography.Title><Typography.Text type="secondary">维护套餐、次卡等券类营销商品的 SKU、价格和可售库存；不管理实物履约。</Typography.Text></div><Button type="primary" onClick={() => edit()} icon={<PlusOutlined />}>新建营销商品</Button></div><Card><Table rowKey="productId" loading={products.isLoading} dataSource={items} pagination={false} columns={[
    { title: '营销商品', dataIndex: 'productName', render: (name, product: MarketingProduct) => <><Typography.Text strong>{name}</Typography.Text><br /><Typography.Text type="secondary">{product.category || '未分类'}{product.productSource === 'external' && product.externalProductId ? ` · 外部 ID：${product.externalProductId}` : ''}</Typography.Text></> },
    { title: 'SKU / 价格', render: (_, product: MarketingProduct) => product.skus?.length ? <>{product.skus.length} 个 SKU<br /><Typography.Text type="secondary">¥{Math.min(...product.skus.map((sku) => Number(sku.price))).toFixed(2)} 起</Typography.Text></> : '—' },
    { title: '库存', render: (_, product: MarketingProduct) => product.skus?.some((sku) => sku.stock === null) ? '不限' : product.skus?.reduce((sum, sku) => sum + Number(sku.stock || 0), 0) },
    { title: '状态', dataIndex: 'status', render: (status) => { const [label, color] = statusMeta[status] ?? [status, 'default']; return <Tag color={color}>{label}</Tag> } },
    { title: '操作', render: (_, product: MarketingProduct) => <Space><Button type="link" onClick={() => edit(product)}>编辑 / 库存</Button><Button type="link" onClick={() => changeStatus(product, product.status === 'on_sale' ? 'off-shelf' : 'on-sale')}>{product.status === 'on_sale' ? '下架' : '上架'}</Button></Space> },
  ]} locale={{ emptyText: '暂无营销商品，请先创建套餐、次卡等券类商品。' }} /></Card>
  <Modal title={editing ? '编辑营销商品' : '新建营销商品'} open={open} width={900} onCancel={() => setOpen(false)} footer={null} destroyOnClose><Form form={form} layout="vertical" onFinish={save} initialValues={{ productSource: 'managed', status: 'draft', skus: [initialSku] }}><Space size="middle" className="full-width" align="start"><Form.Item name="productName" label="营销商品名称" rules={[{ required: true, message: '请输入名称' }]} className="grow"><Input placeholder="例如：双人套餐券" /></Form.Item><Form.Item name="category" label="商品类目" rules={[{ required: true, message: '请选择或填写商品类目' }]} className="grow"><Select showSearch allowClear options={productCategoryOptions} placeholder="例如：团购套餐券" /></Form.Item></Space><Form.Item name="description" label="说明"><Input.TextArea rows={2} placeholder="用于活动展示的券类商品说明" /></Form.Item><Space size="middle" className="full-width" align="start"><Form.Item name="productSource" label="来源" className="grow"><Select onChange={(value) => { if (value === 'managed') form.setFieldValue('externalProductId', undefined) }} options={[{ value: 'managed', label: '平台维护' }, { value: 'external', label: '外部系统映射' }]} /></Form.Item>{productSource === 'external' && <Form.Item name="externalProductId" label="外部商品 ID" rules={[{ required: true, whitespace: true, message: '请输入外部商品 ID' }]} className="grow"><Input placeholder="POS / ERP 商品 ID" /></Form.Item>}</Space><Typography.Title level={5}>SKU、价格与库存</Typography.Title><Form.List name="skus">{(fields, { add, remove }) => <>{fields.map((field) => <Card size="small" key={field.key} className="sku-card"><Space size="small" align="start" wrap><Form.Item {...field} name={[field.name, 'skuName']} label="SKU 名称" rules={[{ required: true }]}><Input /></Form.Item><Form.Item {...field} name={[field.name, 'skuCode']} label="SKU 编码" rules={[{ required: true }]}><Input /></Form.Item><Form.Item {...field} name={[field.name, 'spec']} label="规格"><Input placeholder="如：午市 / 双人" /></Form.Item><Form.Item {...field} name={[field.name, 'price']} label="售价" rules={[{ required: true }]}><InputNumber min={0} precision={2} /></Form.Item><Form.Item {...field} name={[field.name, 'marketPrice']} label="原价（门店日常价）"><InputNumber min={0} precision={2} /></Form.Item><Form.Item {...field} name={[field.name, 'stock']} label="库存"><InputNumber min={0} precision={0} placeholder="不限" /></Form.Item><Button danger type="text" icon={<MinusCircleOutlined />} onClick={() => remove(field.name)} disabled={fields.length === 1}>移除</Button></Space></Card>)}<Button type="dashed" icon={<PlusOutlined />} onClick={() => add(initialSku)}>添加 SKU</Button></>}</Form.List><Space className="modal-actions"><Button onClick={() => setOpen(false)}>取消</Button><Button type="primary" htmlType="submit">保存营销商品</Button></Space></Form></Modal></>
}
