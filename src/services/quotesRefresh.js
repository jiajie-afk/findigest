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

/** Sina hq list symbol (fallback source when East Money refuses our egress). */
export function sinaSymbol(code, ex = 'SH') {
  const digits = String(code || '').replace(/\D/g, '')
  if (!digits) return ''
  const market = inferHoldingEx(digits, ex)
  if (market === 'HK') return `hk${digits.padStart(5, '0')}`
  return `${market.toLowerCase()}${digits.padStart(6, '0')}`
}

function num(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

/** Sina reports Beijing time without an offset; pin it so asOf is not read as UTC. */
function beijingIso(date, time) {
  const d = String(date || '').replace(/\//g, '-').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return null
  const t = String(time || '').trim()
  const hms = /^\d{2}:\d{2}:\d{2}$/.test(t) ? t : /^\d{2}:\d{2}$/.test(t) ? `${t}:00` : '00:00:00'
  const parsed = new Date(`${d}T${hms}+08:00`)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

/**
 * Parse one `var hq_str_xxx="..."` record.
 * A-share: name,open,prevClose,price,high,low,... ,date,time
 * HK: nameEn,nameCn,open,prevClose,high,low,price,change,changePct,... ,date,time
 * @returns {{price:number,change_pct:number,high:number,low:number,open:number,asOf:string|null}|null}
 */
export function parseSinaQuote(text, code, ex = 'SH') {
  const symbol = sinaSymbol(code, ex)
  if (!symbol) return null
  const raw = String(text || '')
  const matched = raw.match(new RegExp(`hq_str_${symbol}="([^"]*)"`))
  if (!matched) return null
  const f = matched[1].split(',')
  if (f.length < 10) return null

  if (symbol.startsWith('hk')) {
    const price = num(f[6])
    if (!(price > 0)) return null
    return {
      price,
      change_pct: num(f[8]),
      high: num(f[4]),
      low: num(f[5]),
      open: num(f[2]),
      asOf: beijingIso(f[17], f[18]),
    }
  }

  const price = num(f[3])
  const prevClose = num(f[2])
  if (!(price > 0)) return null
  return {
    price,
    change_pct: prevClose > 0 ? ((price - prevClose) / prevClose) * 100 : 0,
    high: num(f[4]),
    low: num(f[5]),
    open: num(f[1]),
    asOf: beijingIso(f[30], f[31]),
  }
}
