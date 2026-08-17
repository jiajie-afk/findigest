/**
 * Scan calibrate_report + live recalculation for valuation bugs.
 * Usage: node scripts/audit_valuation.mjs
 */
import report from './calibrate_report.json' with { type: 'json' }
import { STOCK_FINANCIALS } from '../src/data/stock_financials.js'
import { getIndustry } from '../src/services/industry.js'
import { getArchetype } from '../src/services/valuationTaxonomy.js'
import { calculateValuation } from '../src/services/valuation.js'
import { warmStockData } from '../src/data/loader.js'

const rows = report.results
await warmStockData(rows.map((x) => x.code))

const issues = []
const push = (sev, type, msg, extra = {}) => issues.push({ sev, type, msg, ...extra })

for (const x of rows) {
  const fin = STOCK_FINANCIALS[x.code] || {}
  const ind = getIndustry(x.code, x.name)
  const arch = getArchetype(ind, x.name)
  const v = calculateValuation({ ...fin }, x.code, x.name)

  if (ind === '其他' || ind === '港股其他') {
    push('med', 'industry_fallback', `${x.name}(${x.code}) → ${ind} / ${v.archetype}`)
  }

  if (/偏高/.test(v.verdict) && /分批|小仓/.test(v.actionHint || '')) {
    push('high', 'contradict_high_buy', `${x.name}: ${v.verdict} / ${v.actionHint}`)
  }
  if (
    /偏低|偏下/.test(v.verdict) &&
    /偏贵/.test(v.actionHint || '')
  ) {
    push(
      'high',
      'contradict_low_expensive',
      `${x.name}: MoS=${v.marginOfSafety} ${v.verdict} / ${v.actionHint}`,
    )
  }

  if (
    v.competence === 'hard' &&
    /分批|小仓/.test(v.actionHint || '') &&
    !/能力圈/.test(v.actionHint || '')
  ) {
    push('high', 'buy_while_hard', `${x.name}: ${v.actionHint}`)
  }

  if (v.marginOfSafety != null && Math.abs(v.marginOfSafety) > 45.01) {
    push('high', 'mos_cap_fail', `${x.name}: MoS=${v.marginOfSafety}`)
  }

  if (
    /显著偏低/.test(v.verdict) &&
    v.marginOfSafety != null &&
    v.marginOfSafety < -15
  ) {
    push(
      'high',
      'low_verdict_neg_mos',
      `${x.name} [${v.archetype}] MoS=${v.marginOfSafety}% pe=${v.pe} pb=${fin.pb} → ${v.verdict} / ${v.actionHint}`,
      { code: x.code, arch: v.archetype, details: v.details?.filter((d) => /主锚|类型|缺/.test(d)).slice(0, 4) },
    )
  }

  if (
    /显著偏高/.test(v.verdict) &&
    v.marginOfSafety != null &&
    v.marginOfSafety > 15
  ) {
    push(
      'high',
      'high_verdict_pos_mos',
      `${x.name} MoS=${v.marginOfSafety}% → ${v.verdict} / ${v.actionHint}`,
    )
  }

  if (v.archetype === 'real_estate' && (fin.pe_ttm <= 0 || fin.eps < 0) && /分批|小仓/.test(v.actionHint || '')) {
    push('high', 'loss_realty_buy', `${x.name} pe=${fin.pe_ttm} ${v.actionHint}`)
  }
  if (
    v.archetype === 'real_estate' &&
    (fin.pe_ttm <= 0 || fin.eps < 0 || fin.roe < 0) &&
    /偏低|偏下/.test(v.verdict)
  ) {
    push('high', 'loss_realty_cheap_label', `${x.name}: ${v.verdict} / ${v.actionHint}`)
  }

  // Misclassification heuristics
  if (/神华|煤炭|焦煤/.test(x.name) && v.archetype === 'utility_infra') {
    push('high', 'misclass_coal_utility', `${x.name} → ${v.archetype}`)
  }
  if (/建筑|中铁|铁建|交建/.test(x.name) && v.archetype === 'utility_infra') {
    push('med', 'misclass_construction_utility', `${x.name} → ${ind}/${v.archetype}`)
  }
  if (/饲料|海大/.test(x.name) && v.archetype === 'capital_heavy') {
    push('med', 'misclass_feed', `${x.name} → ${ind}/${v.archetype}`)
  }
  if (/顺丰|快递|中通/.test(x.name) && v.archetype === 'utility_infra' && (v.pe || 0) > 30) {
    // not necessarily wrong, note only
  }

  // PB-based verdict vs MoS for banks when we have PB
  if (v.archetype === 'bank' && fin.pb > 0 && /显著偏低/.test(v.verdict) && v.marginOfSafety < -10) {
    push(
      'med',
      'bank_pb_vs_mos',
      `${x.name} pb=${fin.pb} MoS=${v.marginOfSafety}% ${v.verdict} (PB折价但IV仍低于现价=需更大折扣，可能OK)`,
    )
  }

  // Platform 港股其他
  if (v.archetype === 'platform' && ind === '港股其他') {
    push('med', 'platform_hk_other', `${x.name}`)
  }

  // Quality cigar + wonderful brand name?
  if (v.archetype === 'franchise_brand' && v.quality === 'cigar' && /茅台|五粮|海天|格力|美的/.test(x.name)) {
    push('med', 'brand_cigar_quality', `${x.name} quality=${v.quality} notes check`)
  }
}

const by = {}
for (const i of issues) {
  if (!by[i.type]) by[i.type] = { sev: i.sev, n: 0, examples: [] }
  by[i.type].n++
  if (by[i.type].examples.length < 6) by[i.type].examples.push(i.msg)
}

console.log('=== AUDIT SUMMARY ===')
const order = Object.entries(by).sort((a, b) => {
  const rank = { high: 0, med: 1, low: 2 }
  return (rank[a[1].sev] ?? 9) - (rank[b[1].sev] ?? 9) || b[1].n - a[1].n
})
for (const [type, info] of order) {
  console.log(`\n[${info.sev}] ${type} ×${info.n}`)
  for (const e of info.examples) console.log('  -', e)
}
console.log('\nTOTAL issues:', issues.length)
console.log('HIGH:', issues.filter((i) => i.sev === 'high').length)

// Coverage spine metrics (P1)
const hk = rows.filter((x) => String(x.code).length === 5)
const finLikeArch = new Set(['bank', 'insurance', 'broker', 'real_estate'])
let hkPb = 0
let hkFinPb = 0
let hkFinN = 0
let missingFcfUsedPe = 0
let fcfAnchors = 0
for (const x of rows) {
  const fin = STOCK_FINANCIALS[x.code] || {}
  const v = calculateValuation({ ...fin }, x.code, x.name)
  const isHk = String(x.code).length === 5
  if (isHk && (fin.pb > 0 || fin.bvps > 0)) hkPb++
  if (finLikeArch.has(v.archetype)) {
    if (isHk) {
      hkFinN++
      if (fin.pb > 0 || fin.bvps > 0) hkFinPb++
    }
  }
  if (v.primaryAnchor === 'oe_haircut_pe' || v.primaryAnchor === 'stable_dcf_proxy' || v.primaryAnchor === 'oe_pe_proxy') {
    missingFcfUsedPe++
  }
  if (v.primaryAnchor === 'fcf_pe' || v.primaryAnchor === 'stable_dcf' || v.primaryAnchor === 'oe_pe') {
    fcfAnchors++
  }
}
console.log('\n=== COVERAGE ===')
console.log(`HK pb in sample: ${hkPb}/${hk.length}`)
console.log(`HK financial/realty pb: ${hkFinPb}/${hkFinN} (${hkFinN ? ((100 * hkFinPb) / hkFinN).toFixed(0) : 0}%)`)
console.log(`cashflow/OE anchors: ${fcfAnchors}`)
console.log(`missing_fcf_used_pe_proxy: ${missingFcfUsedPe}`)
if (hkFinN > 0 && hkFinPb / hkFinN < 0.8) {
  console.log('WARN: HK financial/realty pb coverage < 80%')
}

// Dump high issues with detail for fix targeting
const highs = issues.filter((i) => i.sev === 'high')
for (const h of highs) {
  if (h.details) console.log('\nDETAIL', h.msg, h.details)
}
