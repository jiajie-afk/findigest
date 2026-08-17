/** Lazy loaders for large static market datasets */

let _allFinancials = null
let _allPrices = null
let _allConsensus = null

/**
 * Classify whether a financials object can support a full primary-anchor valuation.
 * @param {object|null|undefined} fin
 * @returns {'search_only'|'structure_only'|'full'}
 */
export function assessValuability(fin) {
  if (!fin || typeof fin !== 'object') return 'search_only'
  const price = Number(fin.price) || 0
  const eps = Number(fin.eps) || Number(fin.epsReported) || 0
  const bvps = Number(fin.bvps) || 0
  const pe = fin.pe_ttm != null && Number.isFinite(Number(fin.pe_ttm)) ? Number(fin.pe_ttm) : null
  const hasCore = eps !== 0 || bvps > 0 || (pe != null && pe !== 0)
  if (!hasCore && !(price > 0)) return 'search_only'
  if (!hasCore) return 'search_only'
  const hasCash =
    Number(fin.fcfPerShare) > 0 ||
    Number(fin.ownerEarnings) > 0 ||
    Number(fin.ocf) > 0 ||
    Number(fin.fcf) > 0
  const hasQuality = Number(fin.roe) > 0 && bvps > 0
  // Thin PE/EPS books still allow a structural PE band; missing both cash and quality → structure-only.
  if (!hasCash && !hasQuality && !(eps !== 0 && pe != null)) return 'structure_only'
  if (!(price > 0) && !(eps !== 0 || bvps > 0)) return 'structure_only'
  return 'full'
}

async function ensureFinancials() {
  if (!_allFinancials) {
    _allFinancials = (await import('./stock_financials.js')).STOCK_FINANCIALS
  }
  return _allFinancials
}

async function ensurePrices() {
  if (!_allPrices) {
    _allPrices = (await import('./current_prices.js')).CURRENT_PRICES
  }
  return _allPrices
}

async function ensureConsensus() {
  if (!_allConsensus) {
    _allConsensus = (await import('./consensus_data.js')).CONSENSUS_DATA
  }
  return _allConsensus
}

export async function getFinancials(codes = []) {
  const all = await ensureFinancials()
  if (!codes.length) return { ...all }
  const result = {}
  codes.forEach((c) => {
    if (all[c]) result[c] = all[c]
  })
  return result
}

export async function getFinancial(code) {
  const all = await ensureFinancials()
  return all[code] || null
}

export async function getPrices(codes = []) {
  const all = await ensurePrices()
  if (!codes.length) return { ...all }
  const result = {}
  codes.forEach((c) => {
    if (all[c] != null) result[c] = all[c]
  })
  return result
}

export async function getPrice(code) {
  const all = await ensurePrices()
  return all[code] != null ? all[code] : null
}

export async function getConsensus(codes = []) {
  const all = await ensureConsensus()
  if (!codes.length) return { ...all }
  const result = {}
  codes.forEach((c) => {
    if (all[c]) result[c] = all[c]
  })
  return result
}

export async function getConsensusOne(code) {
  const all = await ensureConsensus()
  return all[code] || null
}

/** Sync accessors after data has been warmed (used by hydrate paths) */
export function peekFinancial(code) {
  return _allFinancials?.[code] || null
}

export function peekPrice(code) {
  return _allPrices?.[code] != null ? _allPrices[code] : null
}

export function peekConsensus(code) {
  return _allConsensus?.[code] || null
}

export async function warmStockData(codes = []) {
  await Promise.all([ensureFinancials(), ensurePrices(), ensureConsensus()])
  return {
    financials: await getFinancials(codes),
    prices: await getPrices(codes),
    consensus: await getConsensus(codes),
  }
}
