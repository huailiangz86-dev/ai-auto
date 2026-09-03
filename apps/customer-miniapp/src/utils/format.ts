export function formatMoney(value?: number | null): string {
  return Number(value ?? 0).toFixed(0)
}

export function formatDate(value?: string | null): string {
  if (!value) return '以商家公告为准'
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? value
    : `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`
}
