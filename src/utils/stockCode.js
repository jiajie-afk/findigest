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
  // Pure digits / alnum ticker
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

export function parseNumberLoose(raw) {
  if (raw == null || raw === '') return NaN
  if (typeof raw === 'number') return raw
  let s = String(raw).trim()
  if (!s || s === '-' || s === '--') return NaN
  s = s.replace(/,/g, '').replace(/，/g, '').replace(/%/g, '')
  s = s.replace(/[^\d.\-]/g, '')
  const n = Number(s)
  return Number.isFinite(n) ? n : NaN
}
