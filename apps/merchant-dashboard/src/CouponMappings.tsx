import { LinkOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { Alert, Button, Card, Checkbox, Form, Input, Modal, Select, Space, Table, Typography, message } from 'antd'
import { useEffect, useState } from 'react'
import { api } from './api'

type Coupon = { couponId: string; couponName: string; couponCode: string }
type Campaign = { coupons: Coupon[] }
type Product = { productId: string; productName: string; skus: { skuId: string; skuName: string; price: number }[] }
type Mapping = { mappingId: string; type: 'catalogue' | 'legacy_external'; productId?: string | null; skuId?: string | null; externalProductId?: string | null; externalProductName?: string | null; callbackUrl?: string | null }

export default function CouponMappings({ campaignId, open, onClose }: { campaignId: string | null; open: boolean; onClose: () => void }) {
  const [couponId, setCouponId] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [externalForm] = Form.useForm()
  const campaign = useQuery({ queryKey: ['merchant-campaign', campaignId], queryFn: () => api<Campaign>(`/merchant/campaigns/${campaignId}`), enabled: open && Boolean(campaignId) })
  const products = useQuery({ queryKey: ['merchant-products-for-coupon'], queryFn: () => api<{ items: Product[] }>('/merchant/products?status=on_sale&page=1&pageSize=100'), enabled: open })
  const mappings = useQuery({ queryKey: ['coupon-product-mappings', couponId], queryFn: () => api<{ items: Mapping[] }>(`/merchant/campaigns/coupons/${couponId}/products`), enabled: open && Boolean(couponId) })

  useEffect(() => { const first = campaign.data?.coupons?.[0]?.couponId; if (first) setCouponId((value) => value || first) }, [campaign.data])
  useEffect(() => { if (mappings.data?.items) setSelected(mappings.data.items.filter((item) => item.type === 'catalogue' && item.productId).map((item) => item.skuId ? `${item.productId}::${item.skuId}` : `${item.productId}::all`)) }, [mappings.data])

  const saveCatalogue = async () => {
    const grouped = new Map<string, { full: boolean; skuIds: string[] }>()
    selected.forEach((value) => { const [productId, skuId] = value.split('::'); const item = grouped.get(productId) ?? { full: false, skuIds: [] }; if (skuId === 'all') item.full = true; else item.skuIds.push(skuId); grouped.set(productId, item) })
    const productSelections = [...grouped.entries()].map(([productId, item]) => item.full ? { productId } : { productId, skuIds: item.skuIds })
    if (!productSelections.length) { message.error('至少选择一个营销商品或 SKU'); return }
    try { await api(`/merchant/campaigns/coupons/${couponId}/products`, { method: 'PUT', body: JSON.stringify({ productSelections }) }); message.success('优惠券营销商品已保存'); mappings.refetch() } catch (error) { message.error(error instanceof Error ? error.message : '保存失败') }
  }
  const addExternal = async (values: any) => { try { await api(`/merchant/campaigns/coupons/${couponId}/external-products`, { method: 'POST', body: JSON.stringify(values) }); externalForm.resetFields(); message.success('外部 API 商品映射已保存'); mappings.refetch() } catch (error) { message.error(error instanceof Error ? error.message : '保存失败') } }
  const removeExternal = async (mappingId: string) => { try { await api(`/merchant/campaigns/coupons/${couponId}/external-products/${mappingId}`, { method: 'DELETE' }); message.success('外部映射已删除'); mappings.refetch() } catch (error) { message.error(error instanceof Error ? error.message : '删除失败') } }

  const options = (products.data?.items ?? []).flatMap((product) => [{ label: `${product.productName}（整款营销商品）`, value: `${product.productId}::all` }, ...product.skus.map((sku) => ({ label: `${product.productName} · ${sku.skuName}（¥${Number(sku.price).toFixed(2)}）`, value: `${product.productId}::${sku.skuId}` }))])
  const external = mappings.data?.items?.filter((item) => item.type === 'legacy_external') ?? []
  return <Modal title="优惠券商品与外部 API 映射" open={open} onCancel={onClose} footer={null} width={900} destroyOnClose><Typography.Paragraph type="secondary">平台营销商品与商家 POS/ERP 商品可同时关联；修改仅允许在活动草稿阶段进行。</Typography.Paragraph>{campaign.isLoading ? <Typography.Text>正在加载活动…</Typography.Text> : <Select className="full-width" value={couponId || undefined} onChange={setCouponId} placeholder="选择优惠券" options={(campaign.data?.coupons ?? []).map((coupon) => ({ value: coupon.couponId, label: `${coupon.couponName} · ${coupon.couponCode}` }))} />}{couponId && <><Card size="small" title="适用营销商品与 SKU" className="section"><Checkbox.Group className="mapping-options" value={selected} onChange={(values) => setSelected(values as string[])} options={options} /><div className="mapping-actions"><Button type="primary" onClick={saveCatalogue}>保存营销商品关联</Button></div></Card><Card size="small" title={<><LinkOutlined /> 商家业务系统 API 映射</>} className="section"><Alert type="info" showIcon message="外部映射会保留" description="保存平台营销商品时不会覆盖已有的 POS/ERP 商品 ID 和核销回调地址。" /><Table className="section" size="small" rowKey="mappingId" pagination={false} dataSource={external} columns={[{ title: '外部商品', render: (_, item: Mapping) => item.externalProductName || item.externalProductId }, { title: '外部 ID', dataIndex: 'externalProductId' }, { title: '核销回调 API', dataIndex: 'callbackUrl', render: (value) => value || '未配置' }, { title: '操作', render: (_, item: Mapping) => <Button type="link" danger onClick={() => removeExternal(item.mappingId)}>删除</Button> }]} locale={{ emptyText: '暂无外部商品映射。' }} /><Form form={externalForm} layout="vertical" onFinish={addExternal} className="section"><Space wrap align="start"><Form.Item name="externalProductId" label="外部商品 ID" rules={[{ required: true }]}><Input placeholder="POS / ERP 商品 ID" /></Form.Item><Form.Item name="externalProductName" label="外部商品名称"><Input placeholder="例如：双人套餐" /></Form.Item><Form.Item name="externalCategory" label="类目"><Input placeholder="餐饮" /></Form.Item><Form.Item name="callbackUrl" label="核销回调 API" rules={[{ type: 'url', message: '请输入完整 URL' }]}><Input placeholder="https://merchant.example.com/redeem" /></Form.Item><Button htmlType="submit" icon={<LinkOutlined />}>添加 API 映射</Button></Space></Form></Card></>}</Modal>
}