import { Empty } from 'antd'

import type { TrendPoint } from '../api/dashboard'

type TrendChartProps = {
  title: string
  color: string
  suffix?: string
  points: TrendPoint[]
}

export function TrendChart({ title, color, suffix = '', points }: TrendChartProps) {
  if (points.length === 0) {
    return (
      <section className="trend-card" aria-label={title}>
        <h3>{title}</h3>
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无趋势数据" />
      </section>
    )
  }

  const values = points.map((point) => point.value)
  const max = Math.max(...values)
  const min = Math.min(...values)
  const range = max - min || 1
  const width = 360
  const height = 150
  const padding = 18
  const path = points
    .map((point, index) => {
      const x = padding + (index * (width - padding * 2)) / Math.max(points.length - 1, 1)
      const y = padding + (1 - (point.value - min) / range) * (height - padding * 2)
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`
    })
    .join(' ')

  return (
    <section className="trend-card" aria-label={title}>
      <div className="trend-heading">
        <h3>{title}</h3>
        <span>
          最新 {formatValue(points.at(-1)?.value ?? 0)}
          {suffix}
        </span>
      </div>
      <svg className="trend-svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${title}折线图`}>
        <defs>
          <linearGradient id={`gradient-${title}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.22" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((line) => (
          <line key={line} x1={padding} x2={width - padding} y1={height * line} y2={height * line} className="grid-line" />
        ))}
        <path d={`${path} L ${width - padding} ${height - padding} L ${padding} ${height - padding} Z`} fill={`url(#gradient-${title})`} />
        <path d={path} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div className="chart-labels">
        <span>{formatDate(points[0].date)}</span>
        <span>{formatDate(points.at(-1)?.date ?? '')}</span>
      </div>
    </section>
  )
}

function formatDate(value: string) {
  return value.slice(5).replace('-', '/')
}

function formatValue(value: number) {
  return new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 1 }).format(value)
}
