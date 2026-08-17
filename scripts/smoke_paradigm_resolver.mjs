/**
 * Smoke: per-stock paradigm differentiation + override recompute.
 * Usage: node scripts/smoke_paradigm_resolver.mjs
 */
import { resolveStockAngles, archetypeForParadigm, describeParadigmComputeEffect } from '../src/services/paradigmResolver.js'
import { calculateValuation } from '../src/services/valuation.js'
import { getParadigmById } from '../src/data/valuation_paradigms.js'

let failed = 0
function assert(cond, msg) {
  if (!cond) {
    failed += 1
    console.error('FAIL:', msg)
  } else {
    console.log('OK  ', msg)
  }
}

// Real industry-mapped names (getIndustry keyword rules) + synthetic books
const industry = '基础化工'
const codeA = '601233'
const nameA = '桐昆股份'
const codeB = '600309'
const nameB = '万华化学'

const qualityCyclical = {
  price: 40,
  pe_ttm: 12,
  pb: 1.8,
  eps: 3.2,
  bvps: 22,
  roe: 18,
  grossMargin: 28,
  netMargin: 12,
  debtRatio: 35,
  profitGrowth: 8,
  revenueGrowth: 6,
  fcfPerShare: 3.0,
  ownerEarnings: 3.0,
  ocf: 80,
  capex: 20,
  total_mv: 800,
}

const peakCyclical = {
  price: 40,
  pe_ttm: 8,
  pb: 1.2,
  eps: 5.0,
  bvps: 33,
  roe: 6,
  grossMargin: 18,
  netMargin: 5,
  debtRatio: 55,
  profitGrowth: 85,
  revenueGrowth: 40,
  fcfPerShare: 0.4,
  ownerEarnings: 0.4,
  ocf: 30,
  capex: 45,
  total_mv: 800,
}

const a = resolveStockAngles({
  code: codeA,
  name: nameA,
  industry,
  fin: qualityCyclical,
})
const b = resolveStockAngles({
  code: codeB,
  name: nameB,
  industry,
  fin: peakCyclical,
})

console.log('\n--- same industry, different fundamentals ---')
console.log('A primary', a.primary.paradigmId, a.primary.archetype, a.secondary.map((s) => `${s.paradigmId}@${s.weight}`))
console.log('A angles', a.angles)
console.log('B primary', b.primary.paradigmId, b.primary.archetype, b.secondary.map((s) => `${s.paradigmId}@${s.weight}`))
console.log('B angles', b.angles)

const secDiff =
  JSON.stringify(a.secondary.map((s) => `${s.paradigmId}:${s.weight}`)) !==
  JSON.stringify(b.secondary.map((s) => `${s.paradigmId}:${s.weight}`))
const angleDiff = a.angles.join('|') !== b.angles.join('|')
assert(secDiff || angleDiff, 'same industry + different fundamentals → different secondary/weights OR angles')

const va = calculateValuation(qualityCyclical, codeA, nameA)
const vb = calculateValuation(peakCyclical, codeB, nameB)
assert(va.industry === industry && vb.industry === industry, 'both resolve to 基础化工')
assert(va.archetype === 'cyclical' && vb.archetype === 'cyclical', 'both stay cyclical primary archetype by industry')
assert(Array.isArray(va.angles) && va.angles.length > 0, 'valuation result exposes angles')
assert(va.primary?.paradigmId && Array.isArray(va.secondary), 'valuation result exposes primary/secondary')

// Override with engineHint paradigm that maps to a different archetype
const overrideId = 'dcf-utility'
const ovP = getParadigmById(overrideId)
const ovArch = archetypeForParadigm(ovP, 'cyclical')
assert(ovArch === 'utility_infra', 'dcf-utility engineHint maps to utility_infra')

const vOv = calculateValuation(qualityCyclical, codeA, nameA, { paradigmOverride: overrideId })
assert(vOv.overrideApplied === true, 'overrideApplied true when engineHint maps')
assert(vOv.archetype === 'utility_infra', 'override changes primary archetype to utility_infra')
assert(vOv.primary?.paradigmId === overrideId, 'override primary paradigmId matches pick')
assert(vOv.paradigmId === overrideId, 'result paradigmId reflects override')

// Thinking-only override must not invent archetype change OR change IV
const thinkId = 'roe-moat'
const vThink = calculateValuation(qualityCyclical, codeA, nameA, { paradigmOverride: thinkId })
assert(vThink.overrideThinkingOnly === true, 'catalog-only paradigm is thinking-only')
assert(vThink.archetype === 'cyclical', 'thinking-only override keeps industry archetype')
assert(
  (vThink.angles || []).some((x) => /roe-moat|高 ROE|思维角/.test(x)) ||
    (vThink.thinking || []).some((t) => t.paradigmId === thinkId),
  'thinking-only override appears in angles/thinking',
)
assert(
  vThink.intrinsicValue === va.intrinsicValue,
  'no-hint / angle-only path must not change IV vs default',
)
assert(vThink.methodVersion && vThink.archetypeId, 'angle-only result still exposes methodVersion/archetypeId')

const thinkP = getParadigmById(thinkId)
const effect = describeParadigmComputeEffect(thinkP, 'cyclical')
assert(effect.angleOnly === true && effect.recomputes === false, 'describeParadigmComputeEffect marks angle-only')

console.log('\n--- override ---')
console.log('default arch', va.archetype, 'IV', va.intrinsicValue)
console.log('utility override arch', vOv.archetype, 'IV', vOv.intrinsicValue)
console.log('thinking override arch', vThink.archetype, 'thinking', vThink.thinking?.[0])

if (failed) {
  console.error(`\n${failed} assertion(s) failed`)
  process.exit(1)
}
console.log('\nAll smoke checks passed')
