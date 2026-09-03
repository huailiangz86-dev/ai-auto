import { ArrowDownOutlined, ArrowUpOutlined } from '@ant-design/icons'

type KpiCardProps = {
  label: string
  value: string
  description: string
  positive?: boolean
}

export function KpiCard({ label, value, description, positive = true }: KpiCardProps) {
  return (
    <section className="kpi-card">
      <span className="kpi-label">{label}</span>
      <strong>{value}</strong>
      <span className={positive ? 'kpi-change positive' : 'kpi-change negative'}>
        {positive ? <ArrowUpOutlined /> : <ArrowDownOutlined />} {description}
      </span>
    </section>
  )
}
