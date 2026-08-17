export function pad(n) {
  return n < 10 ? `0${n}` : `${n}`
}

export function fmtMoney(n, digits = 1) {
  if (n == null || Number.isNaN(n)) return '—'
  const abs = Math.abs(n)
  if (abs >= 1e8) return `${(n / 1e8).toFixed(digits)}亿`
  if (abs >= 1e4) return `${(n / 1e4).toFixed(digits)}万`
  return n.toFixed(digits)
}

export function fmtPct(n, digits = 2) {
  if (n == null || Number.isNaN(n)) return '—'
  return `${n >= 0 ? '+' : ''}${n.toFixed(digits)}%`
}

export function fmtPrice(n, currency = '¥') {
  if (n == null || Number.isNaN(n)) return '—'
  return `${currency}${Number(n).toFixed(2)}`
}

export function scoreColor(score) {
  if (score >= 15) return 'var(--gain)'
  if (score <= -15) return 'var(--loss)'
  if (score >= 8) return '#3aa88f'
  if (score <= -8) return 'var(--warn)'
  return 'var(--ts)'
}

export function todayStr() {
  return new Date().toISOString().slice(0, 10)
}
