/**
 * Value-desk: reconciliation, Buffett MOS tier, no tape-hug on full books.
 * Usage: node scripts/smoke_value_desk.mjs
 */
import { calculateValuation } from '../src/services/valuation.js'
import {
  reconcileStatements,
  grahamStaticScore,
  pickMosTier,
  MOS_TIER,
  stripTradeLanguage,
} from '../src/services/valueDesk.js'

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

const franchise = {
  price: 100,
  pe_ttm: 20,
  pb: 8,
  eps: 5,
  bvps: 12.5,
  roe: 40,
  grossMargin: 91,
  netMargin: 48,
  debtRatio: 18,
  profitGrowth: 6,
  revenueGrowth: 5,
  dividendYield: 3.2,
  revenue: 500,
  profit: 250,
  total_mv: 2000,
  ocf: 240,
  capex: 20,
  fcf: 220,
  fcfPerShare: 11,
  ownerEarnings: 11,
  valuability: 'full',
}

const recon = reconcileStatements(franchise, { eps: 5, source: 'reported' })
assert(recon.pass, `franchise recon should pass, got ${recon.summary}`)
assert(!recon.halt, 'franchise recon should not halt')
console.log('OK   recon pass:', recon.summary)

const v = calculateValuation(franchise, '600519', '贵州茅台')
assert(v.desk, 'desk attached')
assert(v.ivModel > 0, 'ivModel present')
assert(v.desk.mosNeed >= 25, `Buffett floor ≥25, got ${v.desk.mosNeed}`)
assert(v.mosBuyMin === v.desk.mosNeed, 'mosBuyMin tracks desk')
assert(
  Math.abs(v.marginOfSafety) > 40.5,
  `full-data franchise must be allowed to disagree with tape, MoS=${v.marginOfSafety}`,
)
assert(
  !/最终克制: MoS封顶/.test((v.details || []).join('|')),
  'full books must not hit the 40% display cap',
)
assert(!/可考虑分批|建议买入|立即买入/.test(v.actionHint || ''), `posture is not a ticket: ${v.actionHint}`)
assert(v.desk.five?.dims?.length === 5, 'five Buffett dimensions')
assert(v.desk.aesop?.certain, 'aesop filled')
assert(v.desk.oe?.cashConversion >= 0.9, `cash conversion ${v.desk.oe?.cashConversion}`)
assert(v.desk.hold?.items?.length === 4, 'four sell tests')
console.log(
  `OK   茅台口径 desk MoS=${v.marginOfSafety}% need=${v.mosBuyMin}% IV=${v.intrinsicValue} model=${v.ivModel} · ${v.actionHint}`,
)

const gBank = grahamStaticScore({ pe_ttm: 6, pb: 0.7 }, 'bank')
assert(gBank.applicable === false, 'Graham NCAV skipped for banks')
const gFr = grahamStaticScore(franchise, 'franchise_brand')
assert(gFr.applicable, 'Graham applies to franchise')
assert(gFr.score != null, 'Graham score numeric')
console.log('OK   graham skip-bank / score franchise', gFr.score)

assert(pickMosTier({ quality: 'wonderful', competence: 'easy' }).id === 'high', 'wonderful → high tier')
assert(pickMosTier({ hard: true }).id === 'unestimable', 'hard → unestimable')
assert(MOS_TIER.high.need === 25, 'high tier 25%')

assert(
  stripTradeLanguage('具备该类所需保守安全边际（门槛≈20%），可考虑分批').includes('非下单指令'),
  'strip 分批',
)

const bank = calculateValuation(
  {
    price: 40,
    eps: 4,
    pe_ttm: 10,
    bvps: 33,
    pb: 1.21,
    roe: 12,
    valuability: 'full',
  },
  '600036',
  '招商银行',
)
assert(bank.desk.graham.applicable === false, 'bank desk marks graham N/A')
console.log('OK   bank graham N/A')

console.log('smoke_value_desk: all passed')
