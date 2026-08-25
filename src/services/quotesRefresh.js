/** Honest copy + East Money secid for bulk quote refresh. */

export function summarizeFetchResult(result) {
  if (!result || result.reason === 'busy') return ''
  if (result.reason === 'empty') return '先导入持仓，才能刷新行情'
  const quotes = Number(result.quotes) || 0
  if (quotes > 0) return `已刷新 ${quotes} 只行情`
  return '行情暂时拉不到，可稍后重试'
}

/** Map A/H share codes to East Money push2 secid. */
export function eastmoneySecid(code, ex = 'SH') {
  const digits = String(code || '').replace(/\D/g, '')
  if (!digits) return ''
  if (String(ex).toUpperCase() === 'HK') return `116.${digits.padStart(5, '0')}`
  if (digits.startsWith('6') || digits.startsWith('9')) return `1.${digits}`
  return `0.${digits}`
}

/** Infer SH/SZ/HK when the row did not carry an exchange. */
export function inferHoldingEx(code, hinted) {
  const hint = String(hinted || '').toUpperCase()
  if (hint === 'HK' || hint === 'SH' || hint === 'SZ') return hint
  const c = String(code || '').replace(/\D/g, '')
  if (c.length > 0 && c.length <= 5) return 'HK'
  if (c.startsWith('6') || c.startsWith('9')) return 'SH'
  return 'SZ'
}

/** East Money push2 stores price as integer × 10^decimal (f59 / f152). */
export function scaleEastmoneyPrice(raw, decimalPlaces) {
  const n = Number(raw)
  if (!Number.isFinite(n)) return 0
  const d = Number(decimalPlaces)
  const places = Number.isFinite(d) && d >= 0 && d <= 4 ? d : 2
  return n / 10 ** places
}
