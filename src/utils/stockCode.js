/**
 * Normalize broker-style stock codes to FinDigest { code, ex }.
 * Accepts: 600519, SH600519, sz000001, 00700, 00700.HK, HK00700, 700.HK
 */
export function normalizeStockCode(raw, hintEx) {
  if (raw == null) return null
  let s = String(raw).trim().toUpperCase().replace(/\s+/g, '')
  if (!s) return null

  let ex = hintEx || null

  const prefix = s.match(/^(SH|SZ|HK)[\.\-_]?(.+)$/)
  if (prefix) {
    ex = prefix[1]
    s = prefix[2]
  }

  const suffix = s.match(/^(.+?)[\.\-_](SH|SZ|HK)$/)
  if (suffix) {
    s = suffix[1]
    ex = suffix[2]
  }

  // Strip leading market letters stuck to digits: SH600519 already handled
  s = s.replace(/[^0-9A-Z]/g, '')
  const digits = s.replace(/\D/g, '')

  if (!ex) {
    if (hintEx) ex = hintEx
    else if (/^\d{5}$/.test(digits) || digits.length <= 5) ex = 'HK'
    else if (digits.startsWith('6') || digits.startsWith('9')) ex = 'SH'
    else if (digits.startsWith('0') || digits.startsWith('3')) ex = 'SZ'
    else ex = 'SH'
  }

  let code = digits
  if (ex === 'HK') {
    // HK: keep up to 5 digits, pad to 5 commonly used form when short
    if (code.length && code.length < 5) code = code.padStart(5, '0')
    if (!code) return null
  } else {
    if (code.length > 6) code = code.slice(-6)
    if (code.length < 6 && code.length > 0) code = code.padStart(6, '0')
    if (!code) return null
  }

  return { code, ex }
}

/**
 * OCR often reads 0 as O, 1 as I/l, 5 as S, 8 as B.
 * Repair those letters only in the ticker body (not SH/SZ/HK prefixes).
 */
export function normalizeOcrStockCode(raw, hintEx) {
  const direct = normalizeStockCode(raw, hintEx)
  let s = String(raw || '').trim()
  if (!s) return direct
  s = s.replace(/^(SH|SZ|HK)[\.\-_]*/i, '').replace(/[\.\-_](SH|SZ|HK)$/i, '')
  const repaired = s
    .replace(/[Oo]/g, '0')
    .replace(/[Il|]/g, '1')
    .replace(/[Ss]/g, '5')
    .replace(/[Bb]/g, '8')
    .replace(/[Zz]/g, '2')
    .replace(/[Gg]/g, '6')
  const via = normalizeStockCode(repaired, hintEx)
  const directDigits = direct?.code || ''
  const viaDigits = via?.code || ''
  if (via && viaDigits.length >= directDigits.replace(/^0+/, '').length) return via
  return via || direct
}

export function parseNumberLoose(raw) {
  if (raw == null || raw === '') return NaN
  if (typeof raw === 'number') return raw
  let s = String(raw).trim()
  if (!s || s === '-' || s === '--') return NaN
  let mul = 1
  if (/亿/.test(s)) mul = 1e8
  else if (/万/.test(s)) mul = 1e4
  s = s.replace(/,/g, '').replace(/，/g, '').replace(/%/g, '')
  s = s.replace(/[^\d.\-]/g, '')
  const n = Number(s)
  return Number.isFinite(n) ? n * mul : NaN
}
