/**
 * Search / filter helpers over the A/H universe map (code → name)
 * and optional rich list from /data/universe.json.
 *
 * 「可估值」prefers the static valuable-universe set (build:valuable-universe)
 * so Portfolio search badges work before financials are warmed.
 */

import { peekFinancial, assessValuability } from '@/data/loader.js'
import { isValuableCode } from '@/data/valuableUniverse.js'

export function inferMarket(code) {
  const c = String(code || '')
  if (c.length <= 5) return 'HK'
  if (c.startsWith('6') || c.startsWith('9')) return 'SH'
  return 'SZ'
}

/**
 * @param {string} code
 * @returns {'valuable'|'search_only'}
 */
export function valuabilityBadgeForCode(code) {
  if (isValuableCode(code)) return 'valuable'
  // Fallback when financials already warmed (e.g. new codes not yet in static set)
  const fin = peekFinancial(code)
  if (!fin) return 'search_only'
  const v = assessValuability(fin)
  return v === 'full' || v === 'structure_only' ? 'valuable' : 'search_only'
}

/**
 * @param {Record<string,string>|Map} db code→name
 * @param {string} query
 * @param {{ limit?: number, market?: 'SH'|'SZ'|'HK'|null }} opts
 */
export function searchUniverse(db, query, opts = {}) {
  const limit = opts.limit ?? 12
  const market = opts.market || null
  const q = String(query || '')
    .trim()
    .toLowerCase()
  if (!db || !q) return []

  const entries = db instanceof Map ? [...db.entries()] : Object.entries(db)
  const out = []
  for (const [code, name] of entries) {
    const m = inferMarket(code)
    if (market && m !== market) continue
    const codeL = String(code).toLowerCase()
    const nameL = String(name || '').toLowerCase()
    if (codeL.includes(q) || nameL.includes(q)) {
      const badge = valuabilityBadgeForCode(code)
      out.push({
        code,
        name,
        market: m,
        valuability: badge,
        valuabilityLabel: badge === 'valuable' ? '可估值' : '仅检索',
      })
      if (out.length >= limit) break
    }
  }
  // Prefer exact code prefix matches first
  out.sort((a, b) => {
    const aExact = a.code.toLowerCase().startsWith(q) ? 0 : 1
    const bExact = b.code.toLowerCase().startsWith(q) ? 0 : 1
    if (aExact !== bExact) return aExact - bExact
    return a.code.localeCompare(b.code)
  })
  return out.slice(0, limit)
}

export function universeSize(db) {
  if (!db) return 0
  return db instanceof Map ? db.size : Object.keys(db).length
}
