/**
 * Nightshift value-investing regression: industry gates + archetype + MoS cap honesty.
 * Usage: node scripts/smoke_value_story.mjs
 */
import { getIndustry } from '../src/services/industry.js'
import { getArchetype } from '../src/services/valuationTaxonomy.js'
import { calculateValuation } from '../src/services/valuation.js'

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

// —— Classification: short geo tokens must not invent banks/brokers ——
assert(getIndustry('300660', '江苏雷利') !== '城商行', '江苏雷利 must not be 城商行')
assert(getIndustry('600919', '江苏银行') === '城商行', '江苏银行 stays 城商行')
assert(!/券商/.test(getIndustry('600900', '长江电力')), `长江电力 not broker, got ${getIndustry('600900', '长江电力')}`)
assert(/券商/.test(getIndustry('000783', '长江证券')), '长江证券 stays broker')
assert(getIndustry('600036', '招商银行') === '股份制银行', '招商银行')
assert(/券商/.test(getIndustry('601881', '中国银河')), `中国银河 broker, got ${getIndustry('601881', '中国银河')}`)
assert(/券商/.test(getIndustry('000166', '申万宏源')), `申万宏源 broker`)
assert(/券商/.test(getIndustry('601066', '中信建投')), `中信建投 broker`)
assert(/银行|大行/.test(getIndustry('02388', '中银香港')), `中银香港 bank, got ${getIndustry('02388', '中银香港')}`)
assert(getIndustry('600054', '黄山旅游') === '景区' || getIndustry('600054', '黄山旅游').includes('景'), `黄山 industry ${getIndustry('600054', '黄山旅游')}`)

// —— Archetype: scenic/hotel are cyclical occupancy businesses ——
assert(getArchetype('景区', '黄山旅游') === 'cyclical', '景区 → cyclical')
assert(getArchetype('酒店', '锦江酒店') === 'cyclical', '酒店 → cyclical')
assert(getArchetype('高端白酒', '贵州茅台') === 'franchise_brand', '白酒 stays franchise')

// —— Bank book salvage: absurd PB → rebuild BVPS from EPS/ROE ——
const bankSalvage = calculateValuation(
  {
    price: 40,
    eps: 4,
    pe: 10,
    bvps: 0.5,
    pb: 80,
    roe: 12,
    pe_ttm: 10,
    valuability: 'full',
  },
  '600036',
  '招商银行',
)
assert(bankSalvage.archetype === 'bank' || bankSalvage.archetypeId === 'bank', '招商 as bank')
const bankDetails = (bankSalvage.details || []).join('|')
assert(
  /账面重建|pb_roe|PB-ROE|合理PB/.test(bankDetails) || bankSalvage.primaryAnchor === 'pb_roe',
  `bank should prefer PB-ROE after salvage, got anchor=${bankSalvage.primaryAnchor} details=${bankDetails.slice(0, 200)}`,
)
console.log('OK   bank book salvage → pb_roe')

// —— MoS hard cap survives low-confidence soft converge ——
const theatrical = calculateValuation(
  {
    price: 100,
    eps: 1,
    pe: 100,
    bvps: 0,
    pb: 0,
    roe: 5,
    grossMargin: 20,
    netMargin: 5,
    valuability: 'partial',
  },
  '000001',
  '测试偏贵',
)
assert(theatrical.marginOfSafety != null, 'MoS present')
assert(
  Math.abs(theatrical.marginOfSafety) <= 40.5,
  `MoS must stay within hard cap, got ${theatrical.marginOfSafety}`,
)
const details = theatrical.details || theatrical.dcf?.details || []
const joined = (Array.isArray(details) ? details : []).join('|')
if (/最终克制: MoS封顶至-40%/.test(joined)) {
  assert(
    Math.abs(theatrical.marginOfSafety - -40) < 0.6,
    `details claim -40% but MoS=${theatrical.marginOfSafety}`,
  )
}
assert(
  !/低置信：目标价向现价收敛/.test(joined) ||
    !/最终克制: MoS封顶/.test(joined) ||
    joined.lastIndexOf('最终克制') > joined.lastIndexOf('低置信'),
  'hard cap must be applied after soft converge',
)

console.log('OK   industry bank/broker gates')
console.log('OK   scenic/hotel cyclical archetype')
console.log(`OK   MoS cap honesty (MoS=${theatrical.marginOfSafety?.toFixed?.(1) ?? theatrical.marginOfSafety})`)
console.log('smoke_value_story: all passed')
