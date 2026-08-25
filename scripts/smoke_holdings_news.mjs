/**
 * Holdings ↔ CCTV headline matching. Not a buy signal.
 * Usage: node scripts/smoke_holdings_news.mjs
 */
import {
  nameTokens,
  keywordsForIndustry,
  matchItemToHoldings,
  annotateNewsItems,
} from '../src/services/holdingsNewsMatch.js'

let failed = 0
function assert(cond, msg) {
  if (!cond) {
    failed += 1
    console.error('FAIL:', msg)
  } else {
    console.log('OK  ', msg)
  }
}

const maotai = { code: '600519', name: '贵州茅台', industry: '高端白酒' }
const cosco = { code: '600026', name: '中远海能', industry: '航运' }
const sat = { code: '600118', name: '中国卫星', industry: '航天装备' }
const cmb = { code: '600036', name: '招商银行', industry: '股份制银行' }
const book = [maotai, cosco, sat, cmb]

assert(nameTokens('贵州茅台').includes('茅台'), 'geo strip 贵州茅台 → 茅台')
assert(nameTokens('贵州茅台').includes('贵州茅台'), 'keep full name')
assert(!nameTokens('中国卫星').includes('卫星'), 'do not tokenize 卫星 from 中国卫星')
assert(!nameTokens('招商银行').includes('银行'), 'stop token 银行')

assert(keywordsForIndustry('高端白酒').includes('白酒'), 'liquor keywords')
assert(keywordsForIndustry('航运').includes('霍尔木兹'), 'shipping keywords')

const named = matchItemToHoldings(
  { title: '贵州茅台集团董事长调研酱香产能', brief: '' },
  book,
)
assert(named.some((h) => h.code === '600519' && h.strength === 'strong'), '茅台点名 → strong')
assert(!named.some((h) => h.code === '600026'), '茅台新闻不误伤油运')

const liquor = matchItemToHoldings(
  { title: '白酒行业渠道库存继续去化', brief: '批价稳' },
  book,
)
assert(liquor.some((h) => h.code === '600519' && h.strength === 'weak'), '白酒行业 → weak 茅台')
assert(!liquor.some((h) => h.strength === 'strong'), '行业新闻不是点名')

const hormuz = matchItemToHoldings(
  { title: '霍尔木兹海峡通行受阻 油运费走强', brief: '' },
  book,
)
assert(hormuz.some((h) => h.code === '600026' && h.strength === 'weak'), '霍尔木兹 → 中远海能行业')
assert(!hormuz.some((h) => h.code === '600519'), '霍尔木兹不标茅台')

const xi = matchItemToHoldings(
  { title: '习近平会见外方代表团', brief: '会谈' },
  book,
)
assert(xi.length === 0, '外事会见不对齐任何持仓')

const sports = matchItemToHoldings(
  { title: '韩国足协曾不当招待中国足协工作人员？官方回应', brief: '白酒招待' },
  book,
)
assert(sports.length === 0, '足协新闻即使出现白酒也不标仓')

const space = matchItemToHoldings(
  { title: '载人航天工程取得新进展', brief: '' },
  book,
)
assert(space.some((h) => h.code === '600118' && h.strength === 'weak'), '载人航天 → 中国卫星行业')

const satChem = matchItemToHoldings(
  { title: '卫星化学产品价格上调', brief: '' },
  book,
)
assert(!satChem.some((h) => h.code === '600118'), '卫星化学 ≠ 中国卫星')

const namedShip = matchItemToHoldings(
  { title: '中远海能签署长期包运合同', brief: '' },
  book,
)
assert(namedShip.some((h) => h.code === '600026' && h.strength === 'strong'), '中远海能点名 → strong')

const rrr = matchItemToHoldings(
  { title: '央行宣布下调存款准备金率', brief: '' },
  book,
)
assert(rrr.some((h) => h.code === '600036' && h.strength === 'weak'), '降准 → 招行行业')
assert(!rrr.some((h) => h.code === '600519'), '降准不标茅台')

const annotated = annotateNewsItems(
  [
    { id: '1', title: '习近平会见外方代表团' },
    { id: '2', title: '贵州茅台召开经销商会议' },
  ],
  book,
)
assert(annotated.length === 2, 'annotate keeps unmatched items in the full list')
assert(annotated[0].relatedHoldings.length === 0, 'annotate: 外事空')
assert(annotated[1].relatedHoldings[0]?.code === '600519', 'annotate: 茅台点名')

if (failed) {
  console.error(`\n${failed} failed`)
  process.exit(1)
}
console.log('\nall passed')
