import { INDUSTRY_MODELS } from '../data/industry_models.js'
import { PE_RANGES } from '../data/pe_ranges.js'
import { getParadigmById, primaryParadigmForModel } from '../data/valuation_paradigms.js'
import { peekConsensus, assessValuability } from '../data/loader.js'
import { getIndustry } from './industry.js'
import { resolveStockAngles } from './paradigmResolver.js'
import {
  ARCHETYPE_META,
  assessQuality,
  getArchetype,
  invertRisks,
} from './valuationTaxonomy.js'
import { runLensStack } from './investorLenses.js'

function dcfSum(eps, g1, g2, dr, tg, years1 = 5, years2 = 10) {
  let sumPV = 0
  let cur = eps
  for (let y = 1; y <= years1; y++) {
    cur *= 1 + g1
    sumPV += cur / Math.pow(1 + dr, y)
  }
  for (let y = years1 + 1; y <= years2; y++) {
    cur *= 1 + g2
    sumPV += cur / Math.pow(1 + dr, y)
  }
  const tv = (cur * (1 + tg)) / (dr - tg)
  return { dcf: sumPV + tv / Math.pow(1 + dr, years2), cur }
}

const strategies = {
  bank(fin, model, ctx) {
    const { eps, details } = ctx
    let fairPE = Math.max(4, Math.min((fin.roe || 0) * 0.6, 12))
    const intrinsicValue = eps * fairPE
    details.push('PE估值: ' + intrinsicValue.toFixed(2) + ' (合理PE=' + fairPE.toFixed(1) + 'x)')
    return intrinsicValue
  },

  insurance_life(fin, model, ctx) {
    const { bvps, details } = ctx
    const ev = bvps * 2.5
    const pev = ev * 0.8
    details.push('内含价值EV: ' + ev.toFixed(2))
    details.push('PEV估值: ' + pev.toFixed(2))
    return pev
  },

  insurance_composite(fin, model, ctx) {
    const { bvps, details } = ctx
    const ev = bvps * 2.0
    const investAdj = (fin.investYield || 0.05) * bvps * 5
    details.push('寿险EV: ' + ev.toFixed(2))
    details.push('投资调整: ' + investAdj.toFixed(2))
    return ev * 0.5 + investAdj * 0.5
  },

  consumer_brand(fin, model, ctx) {
    // Buffett: wonderful brand ≠ license to inflate IV. No automatic premium in base path.
    const { eps, dr, tg, details } = ctx
    const rawG = (fin.profitGrowth || 8) / 100
    // Haircut reported growth 30% (errors & mean-reversion); cap mature brands at 12%
    const g1 = Math.max(0.03, Math.min(0.12, rawG * 0.7))
    const { dcf } = dcfSum(eps, g1, Math.min(g1 * 0.4, 0.04), dr + 0.01, Math.min(tg, 0.025))
    details.push(`保守DCF: ${dcf.toFixed(2)}（增速${(g1 * 100).toFixed(1)}%已打折，无品牌溢价）`)
    return dcf
  },

  manufacturing(fin, model, ctx) {
    const { eps, dr, tg, details } = ctx
    const utilRate = Math.min(0.95, Math.max(0.5, fin.capacityUtil || 0.7))
    const g1 = Math.max(0.08, Math.min(0.25, (fin.profitGrowth || 15) / 100))
    const { dcf } = dcfSum(eps, g1, g1 * 0.35, dr, tg)
    const capacityAdj = utilRate >= 0.85 ? 1.1 : utilRate >= 0.7 ? 1.0 : 0.9
    details.push('DCF基础: ' + dcf.toFixed(2))
    details.push('产能利用率: ' + (utilRate * 100).toFixed(0) + '% (调整系数=' + capacityAdj.toFixed(2) + ')')
    return dcf * capacityAdj
  },

  infrastructure(fin, model, ctx) {
    const { eps, dr, tg, details } = ctx
    const g1 = Math.max(0.03, Math.min(0.12, (fin.profitGrowth || 5) / 100))
    const { dcf } = dcfSum(eps, g1, g1 * 0.5, dr, tg)
    details.push('DCF估值: ' + dcf.toFixed(2))
    return dcf
  },

  cyclical(fin, model, ctx) {
    const { eps, dr, tg, details } = ctx
    const cyclePos =
      fin.profitGrowth > 20 ? 0.8 : fin.profitGrowth > 5 ? 0.5 : fin.profitGrowth > -5 ? 0.3 : 0.2
    const g1 = Math.max(-0.05, Math.min(0.15, (fin.profitGrowth || 0) / 100))
    const { dcf } = dcfSum(eps, g1, 0.02, dr, tg)
    const cycleAdj = 0.8 + cyclePos * 0.4
    details.push('DCF基础: ' + dcf.toFixed(2))
    details.push('周期调整: 位置=' + cyclePos.toFixed(2) + ' 系数=' + cycleAdj.toFixed(2))
    return dcf * cycleAdj
  },

  semiconductor(fin, model, ctx) {
    const { eps, bvps, price, roe, details } = ctx
    let peFair = roe >= 10 ? 55 : roe >= 5 ? 85 : 120
    peFair = Math.min(peFair, 60)
    const peVal = eps > 0 ? eps * peFair : 0
    const psVal = fin.revenueGrowth ? (price / (fin.revenueGrowth / 100)) * 0.2 : price * 0.8
    details.push('PE估值: ' + peVal.toFixed(2) + ' (合理PE=' + peFair + ')')
    details.push('PS估值: ' + psVal.toFixed(2))
    if (eps <= 0) return psVal * 0.8 + bvps * (fin.pb || 2) * 0.2
    return peVal * 0.35 + psVal * 0.65
  },

  medtech_growth(fin, model, ctx) {
    const { eps, dr, tg, details } = ctx
    const g1 = Math.max(0.1, Math.min(0.3, (fin.profitGrowth || 20) / 100))
    const { dcf } = dcfSum(eps, g1, g1 * 0.4, dr, tg)
    const pipelineAdj = 1 + (fin.pipelineCount || 3) * 0.02
    details.push('DCF基础: ' + dcf.toFixed(2))
    details.push('管线调整: ' + pipelineAdj.toFixed(2))
    return dcf * pipelineAdj
  },

  semi_equipment(fin, model, ctx) {
    const { eps, price, dr, tg, details } = ctx
    const g1 = Math.max(0.15, Math.min(0.45, (fin.profitGrowth || 35) / 100))
    const { dcf } = dcfSum(eps, g1, g1 * 0.4, dr, tg)
    const orderRatio = (fin.order_backlog || 0) / (eps * 10 || 1)
    const orderPremium = price * Math.min(0.3, orderRatio * 0.05)
    details.push('DCF基础: ' + dcf.toFixed(2))
    details.push('订单溢价: +' + orderPremium.toFixed(2))
    return dcf + orderPremium
  },

  biotech(fin, model, ctx) {
    const { eps, details } = ctx
    let pipelineValue = 0
    const stages = [
      { count: fin.phase3 || 2, prob: 0.6, value: eps * 50 },
      { count: fin.phase2 || 3, prob: 0.3, value: eps * 30 },
      { count: fin.phase1 || 2, prob: 0.15, value: eps * 15 },
    ]
    stages.forEach((s) => {
      pipelineValue += s.count * s.prob * s.value
    })
    const baseVal = eps * 20
    details.push('现有业务: ' + baseVal.toFixed(2))
    details.push('管线价值: ' + pipelineValue.toFixed(2))
    return baseVal * 0.4 + pipelineValue * 0.6
  },

  real_estate(fin, model, ctx) {
    const { bvps, dr, details } = ctx
    const nav = bvps * (fin.navDiscount || 0.15)
    const rentalYield = ((fin.rentalYield || 0.04) * bvps) / dr
    details.push('NAV净资产: ' + nav.toFixed(2))
    details.push('租金收益: ' + rentalYield.toFixed(2))
    return nav * 0.3 + rentalYield * 0.7
  },

  internet(fin, model, ctx) {
    const { eps, price, dr, tg, details } = ctx
    const arpu = fin.arpu || (price * 1e8) / (fin.users || 1e6)
    const g1 = Math.max(0.05, Math.min(0.25, (fin.profitGrowth || 15) / 100))
    const { dcf } = dcfSum(eps, g1, g1 * 0.4, dr, tg)
    details.push('DCF估值: ' + dcf.toFixed(2))
    details.push('用户ARPU: ' + arpu.toFixed(2))
    return dcf
  },

  auto_parts_logistics(fin, model, ctx) {
    const { eps, roe, details } = ctx
    const ebitda = eps * 1.5
    const evEbitda = ebitda * (roe >= 15 ? 12 : roe >= 10 ? 10 : 8)
    const volume = fin.express_volume || fin.monthly_volume || 100
    const volumeAdj = volume > 1000 ? 1.1 : volume > 500 ? 1.0 : 0.9
    details.push('EV/EBITDA: ' + evEbitda.toFixed(2))
    details.push('件量调整: ' + volumeAdj.toFixed(2))
    return evEbitda * volumeAdj
  },

  default(fin, model, ctx) {
    const { eps, dr, tg, details } = ctx
    const g1 = Math.max(0.05, Math.min(0.15, (fin.profitGrowth || 8) / 100))
    const { dcf } = dcfSum(eps, g1, g1 * 0.4, dr, tg)
    details.push('DCF估值: ' + dcf.toFixed(2))
    return dcf
  },
}

const industryStrategy = {
  国有大行: 'bank',
  股份制银行: 'bank',
  城商行: 'bank',
  农商行: 'bank',
  头部券商: 'bank',
  中型券商: 'bank',
  中小券商: 'bank',
  财险: 'bank',
  寿险: 'insurance_life',
  综合保险: 'insurance_composite',
  高端白酒: 'consumer_brand',
  次高端白酒: 'consumer_brand',
  区域白酒: 'consumer_brand',
  液态奶: 'consumer_brand',
  奶粉及奶酪: 'consumer_brand',
  酱油醋: 'consumer_brand',
  复合调味品: 'consumer_brand',
  休闲食品: 'consumer_brand',
  速冻食品: 'consumer_brand',
  饮料: 'consumer_brand',
  烘焙及调味: 'consumer_brand',
  啤酒: 'consumer_brand',
  中药创新: 'consumer_brand',
  景区: 'consumer_brand',
  酒店: 'consumer_brand',
  免税及旅行社: 'consumer_brand',
  运动服饰: 'consumer_brand',
  休闲服饰: 'consumer_brand',
  家纺: 'consumer_brand',
  百货: 'consumer_brand',
  超市便利店: 'consumer_brand',
  传统车企: 'manufacturing',
  新能源车企: 'manufacturing',
  商用车: 'manufacturing',
  白电: 'manufacturing',
  小家电: 'manufacturing',
  厨电: 'manufacturing',
  照明电工: 'manufacturing',
  医疗设备: 'manufacturing',
  低值耗材: 'manufacturing',
  硅片: 'manufacturing',
  电池片: 'manufacturing',
  组件: 'manufacturing',
  逆变器储能: 'manufacturing',
  动力电池: 'manufacturing',
  电池材料: 'manufacturing',
  新材料: 'manufacturing',
  工程机械: 'manufacturing',
  通用设备: 'manufacturing',
  专用设备: 'manufacturing',
  纺织制造: 'manufacturing',
  其他建材: 'manufacturing',
  通信设备: 'manufacturing',
  航空制造: 'infrastructure',
  航天装备: 'infrastructure',
  兵器船舶: 'infrastructure',
  军工电子: 'infrastructure',
  房建: 'infrastructure',
  基建: 'infrastructure',
  装饰园林: 'infrastructure',
  专业工程: 'infrastructure',
  火电: 'infrastructure',
  水电: 'infrastructure',
  核电: 'infrastructure',
  新能源发电: 'infrastructure',
  港口: 'infrastructure',
  港口服务: 'infrastructure',
  出版: 'infrastructure',
  固废处理: 'infrastructure',
  水处理: 'infrastructure',
  燃气: 'infrastructure',
  水务及其他: 'infrastructure',
  物业管理: 'infrastructure',
  运营商: 'infrastructure',
  港股其他: 'infrastructure',
  其他: 'infrastructure',
  基础化工: 'cyclical',
  精细化工: 'cyclical',
  农化: 'cyclical',
  贵金属: 'cyclical',
  工业金属: 'cyclical',
  稀有金属: 'cyclical',
  小金属: 'cyclical',
  动力煤: 'cyclical',
  焦煤: 'cyclical',
  无烟煤及其他: 'cyclical',
  特钢: 'cyclical',
  普钢: 'cyclical',
  钢管: 'cyclical',
  航运: 'cyclical',
  客运航空: 'cyclical',
  养殖: 'cyclical',
  种植: 'cyclical',
  饲料: 'cyclical',
  水泥: 'cyclical',
  玻璃: 'cyclical',
  芯片设计: 'semiconductor',
  晶圆制造: 'semiconductor',
  封测: 'semiconductor',
  半导体材料: 'semiconductor',
  高值耗材: 'medtech_growth',
  体外诊断: 'medtech_growth',
  CXO服务: 'medtech_growth',
  半导体设备: 'semi_equipment',
  化学创新药: 'biotech',
  生物创新药: 'biotech',
  住宅开发: 'real_estate',
  商业地产: 'real_estate',
  产业地产: 'real_estate',
  电商: 'internet',
  社交内容: 'internet',
  游戏: 'internet',
  SaaS云计算: 'internet',
  本地生活: 'internet',
  电商零售: 'internet',
  影视: 'internet',
  广告营销: 'internet',
  K12教育: 'internet',
  职业教育: 'internet',
  动力系统: 'auto_parts_logistics',
  底盘系统: 'auto_parts_logistics',
  汽车电子: 'auto_parts_logistics',
  车身内外饰: 'auto_parts_logistics',
  快递: 'auto_parts_logistics',
  仓储物流: 'auto_parts_logistics',
  航空货运: 'auto_parts_logistics',
}

/**
 * Resolve usable EPS for DCF / display.
 * Many static rows historically stored Q1 EPS as if annual (update script bug).
 * Prefer: consistent reported → consensus FY1 → PE-implied TTM.
 */
export function resolveEarnings(fin, code, details = []) {
  const price = +(fin.price || 0)
  const pe = +(fin.pe_ttm || 0)
  const stored = +(fin.eps || 0)
  const consensus = peekConsensus(code)
  const fy1 = consensus?.fy1 > 0 ? +consensus.fy1 : null
  const peImplied = pe > 0 && price > 0 ? price / pe : null

  // Already sanitized offline?
  if (fin.epsQuality === 'corrected' && stored > 0) {
    if (details) details.push(`EPS来源: 已纠偏 ${stored}（${fin.epsSource || 'sanitized'}）`)
    return { eps: stored, source: fin.epsSource || 'sanitized', peImplied, stored: +(fin.epsReported || stored), quality: 'corrected' }
  }

  if (consensus?.analysts && details) {
    details.push(`一致预期: ${consensus.analysts} 位分析师`)
  }

  if (peImplied != null && stored > 0 && stored / peImplied >= 0.5 && stored / peImplied <= 1.5) {
    if (details) details.push(`EPS来源: 财报EPS=${stored}`)
    return { eps: stored, source: 'reported', peImplied, stored, quality: 'ok' }
  }

  if (fy1 != null && (peImplied == null || Math.abs(fy1 - peImplied) / peImplied <= 0.35)) {
    if (details) {
      if (stored > 0 && peImplied != null && stored / peImplied < 0.5) {
        details.push(`库内EPS ${stored} 与PE隐含 ${peImplied.toFixed(2)} 严重不符，已改用一致预期FY1=${fy1}`)
      } else {
        details.push(`EPS来源: 一致预期FY1=${fy1}`)
      }
    }
    return { eps: fy1, source: 'consensus_fy1', peImplied, stored, quality: 'corrected' }
  }

  if (peImplied != null) {
    if (details) {
      details.push(
        `EPS来源: PE隐含TTM=${peImplied.toFixed(2)}（库内EPS=${stored || '—'}不可信，已纠偏）`,
      )
    }
    return { eps: peImplied, source: 'pe_implied', peImplied, stored, quality: 'corrected' }
  }

  if (fy1 != null) {
    if (details) details.push(`EPS来源: 一致预期FY1=${fy1}`)
    return { eps: fy1, source: 'consensus_fy1', peImplied, stored, quality: 'corrected' }
  }

  if (details) details.push(`EPS来源: 财报EPS=${stored || 0}`)
  return { eps: stored, source: 'reported', peImplied, stored, quality: stored ? 'unverified' : 'missing' }
}

function getPeBand(industry) {
  const custom = PE_RANGES[industry]
  if (custom?.pe) return { peLow: custom.pe[0], peHigh: custom.pe[1], peMid: (custom.pe[0] + custom.pe[1]) / 2 }
  const model = INDUSTRY_MODELS[industry] || INDUSTRY_MODELS['其他']
  const base = 1 / (model.dr || 0.1)
  const peLow = Math.round(base * 0.6)
  const peHigh = Math.round(base * 1.8)
  return { peLow, peHigh, peMid: (peLow + peHigh) / 2 }
}

function peVerdict(pe, peLow, peHigh) {
  if (!(pe > 0) || !(peHigh > peLow)) return { label: '数据不足', tone: 'info', percentile: null }
  const pct = ((pe - peLow) / (peHigh - peLow)) * 100
  const clipped = Math.max(0, Math.min(100, pct))
  if (clipped <= 15) return { label: '显著偏低', tone: 'good', percentile: clipped }
  if (clipped <= 35) return { label: '合理偏下', tone: 'good', percentile: clipped }
  if (clipped <= 65) return { label: '估值合理', tone: 'info', percentile: clipped }
  if (clipped <= 85) return { label: '合理偏上', tone: 'warn', percentile: clipped }
  return { label: '显著偏高', tone: 'warn', percentile: clipped }
}

/**
 * Owner-earnings (Buffett 1986).
 * Prefer reported fcfPerShare / ownerEarnings / (ocf-capex)/shares; else EPS haircut.
 * When FCF≪EPS (growth capex / period mismatch) or FCF≫EPS (one-off), blend toward
 * maintenance OE so PE-band multiples are not systematically wrong across archetypes.
 */
function blendOeWithEarnings(oe, eps, archetype) {
  if (!(oe > 0) || !(eps > 0)) return { oe, source: null, rawFcf: null }
  const ratio = oe / eps
  // Skip banks/insurers/brokers/realty — they don't use OE×PE as primary
  if (
    archetype === 'bank' ||
    archetype === 'insurance' ||
    archetype === 'broker' ||
    archetype === 'real_estate'
  ) {
    return { oe, source: null, rawFcf: null }
  }
  // Franchise brands (白酒等): inventory / channel WC often depresses FCF without
  // destroying owner earnings. Do not treat that gap like maintenance-capex hell.
  if (archetype === 'franchise_brand' && ratio < 0.9) {
    const epsFloor = eps * 0.97
    const wOe = ratio < 0.45 ? 0.18 : 0.28
    return {
      oe: oe * wOe + epsFloor * (1 - wOe),
      source: 'oe_eps_blend',
      rawFcf: oe,
    }
  }
  if (ratio < 0.55) {
    // Model would UNDERSTATE IV if raw FCF × earnings PE
    const epsFloor =
      archetype === 'capital_heavy'
        ? eps * 0.72
        : archetype === 'cyclical'
          ? eps * 0.7
          : archetype === 'utility_infra'
            ? eps * 0.85
            : archetype === 'biotech'
              ? eps * 0.8
              : eps * 0.85
    const wOe = archetype === 'capital_heavy' || archetype === 'cyclical' ? 0.5 : 0.35
    return {
      oe: oe * wOe + epsFloor * (1 - wOe),
      source: 'oe_eps_blend',
      rawFcf: oe,
    }
  }
  if (ratio > 1.45) {
    // Model would OVERSTATE IV on one-off FCF
    const cap = eps * (archetype === 'capital_heavy' ? 1.15 : 1.08)
    return {
      oe: oe * 0.35 + cap * 0.65,
      source: 'oe_eps_cap',
      rawFcf: oe,
    }
  }
  return { oe, source: null, rawFcf: null }
}

function resolveOwnerEarnings(eps, archetype, fin) {
  const direct = +(fin.ownerEarnings || fin.fcfPerShare || 0)
  if (direct > 0) {
    const b = blendOeWithEarnings(direct, eps, archetype)
    if (b.source) {
      return { oe: b.oe, source: b.source, sparseCash: false, rawFcf: b.rawFcf }
    }
    return { oe: direct, source: fin.ownerEarnings ? 'oe_field' : 'fcf', sparseCash: false }
  }
  const ocf = +(fin.ocf || 0)
  const capex = +(fin.capex || 0)
  const price = +(fin.price || 0)
  const mv = +(fin.total_mv || 0)
  if (ocf > 0 && price > 0 && mv > 0) {
    const sharesYi = mv / price
    if (sharesYi > 0) {
      const maint = capex > 0 ? Math.min(capex, ocf * 0.45) : ocf * 0.25
      const fcfYi = ocf - maint
      const perShare = fcfYi / sharesYi
      if (perShare > 0) {
        const b = blendOeWithEarnings(perShare, eps, archetype)
        if (b.source) {
          return { oe: b.oe, source: b.source, sparseCash: false, rawFcf: b.rawFcf }
        }
        return { oe: perShare, source: 'ocf_capex', sparseCash: false }
      }
    }
  }
  if (!(eps > 0)) return { oe: 0, source: 'none', sparseCash: true }
  let hair = 1
  if (archetype === 'franchise_brand' || archetype === 'platform') hair = 1.05
  else if (archetype === 'capital_heavy') hair = 0.82
  else if (archetype === 'utility_infra') hair = 0.92
  else if (archetype === 'cyclical') {
    const g = +(fin.profitGrowth || 0)
    hair = g > 40 ? 0.55 : g > 20 ? 0.7 : 0.85
  }
  return { oe: eps * hair, source: 'eps_proxy', sparseCash: true }
}

/** @deprecated use resolveOwnerEarnings */
function ownerEarningsProxy(eps, archetype, fin) {
  return resolveOwnerEarnings(eps, archetype, fin).oe
}

/** Annualized bank/insurance ROE (dataset often stores quarterly ROE) */
function annualizeFinancialRoe(fin) {
  const raw = +(fin.roe || 0)
  const bvps = +(fin.bvps || 0)
  const eps = +(fin.eps || 0)
  const price = +(fin.price || 0)
  // If book looks broken (price/bvps absurd), never invent a 30%+ ROE from eps/bvps
  const bookLooksBroken = bvps > 0 && price > 0 && price / bvps > 4
  if (bvps > 0 && eps > 0 && !bookLooksBroken) {
    const implied = (eps / bvps) * 100
    if (raw > 0 && raw < 6 && implied > raw * 1.5 && implied < 25) return implied
    if (!(raw > 0) && implied < 25) return implied
  }
  if (raw > 0 && raw < 5 && +(fin.debtRatio || 0) > 85) return raw * 4
  return raw
}

/**
 * Buffett bank: Justified P/B ≈ ROE / r (r≈11%).
 * Demand discount to justified PB; PB is primary, PE is cross-check.
 */
function bankValuationBands(fin, eps, peBand, details) {
  const { peLow, peMid } = peBand
  const bvps = +(fin.bvps || 0)
  const price = +(fin.price || 0)
  const pb = +(fin.pb || 0) || (bvps > 0 && price > 0 ? price / bvps : 0)
  const roeA = annualizeFinancialRoe(fin)

  // HK dual-lists often lack BVPS/PB — fall back to conservative PE (no fake 100% PB discount)
  if (!(bvps > 0) && !(pb > 0)) {
    details.push('类型: 银行 — 缺账面数据，退化为保守PE（不作PB折价幻觉）')
    if (!(eps > 0)) {
      return { ivBear: 0, ivBase: 0, ivBull: 0, primary: 'hard', hard: true }
    }
    return {
      ivBear: eps * peLow * 0.9,
      ivBase: eps * ((peLow + peMid) / 2) * 0.85,
      ivBull: eps * peMid * 0.8,
      primary: 'pe_sparse',
      bankMeta: null,
    }
  }

  const r = 0.11
  let justifiedPb = roeA > 0 ? roeA / 100 / r : 0.7
  justifiedPb = Math.max(0.45, Math.min(1.35, justifiedPb))

  details.push('类型: 银行 — PB-ROE（常态化ROE + 账面折扣；金融要求更大安全边际）')
  details.push(
    `年化ROE≈${roeA.toFixed(1)}%（库内=${fin.roe ?? '—'}）→ 合理PB≈${justifiedPb.toFixed(2)}x · 现价PB=${pb ? pb.toFixed(2) : '—'}x`,
  )

  let ivBear = bvps > 0 ? bvps * justifiedPb * 0.72 : eps * peLow
  let ivBase = bvps > 0 ? bvps * justifiedPb * 0.9 : eps * ((peLow + peMid) / 2)
  const ivBull = bvps > 0 ? bvps * justifiedPb * 1.05 : eps * peMid

  if (eps > 0 && peLow > 0) {
    const peBear = eps * peLow
    if (peBear < ivBear * 0.7) {
      details.push(`PE交叉验证偏弱（PE下限IV¥${peBear.toFixed(2)}），下调熊档`)
      ivBear = (ivBear + peBear) / 2
      ivBase = (ivBase + eps * ((peLow + peMid) / 2)) / 2
    }
  }

  return { ivBear, ivBase, ivBull, primary: 'pb_roe', bankMeta: { roeA, justifiedPb, pb } }
}

/**
 * Insurance: P/EV proxy. Book × capped ROE multiple ≈ rough EV; demand deep discount.
 * Buffett: float + underwriting discipline; never capitalize peak investment gains.
 */
function insuranceValuationBands(fin, eps, peBand, details) {
  const { peLow, peMid } = peBand
  const bvps = +(fin.bvps || 0)
  const price = +(fin.price || 0)
  const pb = +(fin.pb || 0) || (bvps > 0 && price > 0 ? price / bvps : 0)
  let roeA = annualizeFinancialRoe(fin)
  const roeRaw = roeA
  const evPerShare = +(fin.evPerShare || fin.embeddedValue || 0)

  if (!(bvps > 0) && !(pb > 0) && !(evPerShare > 0)) {
    details.push('类型: 保险 — 缺账面/EV数据，退化为保守PE')
    if (!(eps > 0)) return { ivBear: 0, ivBase: 0, ivBull: 0, primary: 'hard', hard: true }
    return {
      ivBear: eps * peLow * 0.85,
      ivBase: eps * ((peLow + peMid) / 2) * 0.8,
      ivBull: eps * peMid * 0.75,
      primary: 'pe_sparse',
      insuranceMeta: null,
      dataSparse: true,
    }
  }

  if (roeA > 18) {
    details.push(`保险年化ROE${roeRaw.toFixed(1)}%含投资端波动 → 估值封顶18%`)
    roeA = 18
  }

  // Real EV preferred; else book × capped-ROE multiple (proxy, lower confidence)
  let evProxy
  let justifiedPb
  let primary = 'pev_proxy'
  if (evPerShare > 0) {
    evProxy = evPerShare
    justifiedPb = bvps > 0 ? (evPerShare / bvps) * 0.75 : 1.0
    justifiedPb = Math.max(0.65, Math.min(1.45, justifiedPb))
    primary = 'pev'
    details.push('类型: 保险 — 真实内含价值EV（P/EV）')
    details.push(
      `EV/股=${evPerShare.toFixed(2)} · 合理交易PB≈${justifiedPb.toFixed(2)}x · 现价PB=${pb ? pb.toFixed(2) : '—'}x`,
    )
  } else {
    let evMult = 1.05 + roeA / 30
    evMult = Math.max(1.05, Math.min(1.65, evMult))
    evProxy = bvps > 0 ? bvps * evMult : 0
    justifiedPb = evMult * 0.75
    justifiedPb = Math.max(0.65, Math.min(1.35, justifiedPb))
    details.push('类型: 保险 — P/EV代理（账面×ROE封顶）；忌投资收益幻觉')
    details.push(
      `EV代理≈${evMult.toFixed(2)}x账面 · 合理交易PB≈${justifiedPb.toFixed(2)}x · 现价PB=${pb ? pb.toFixed(2) : '—'}x`,
    )
  }

  let ivBear = evProxy > 0 ? evProxy * 0.55 : eps * peLow
  let ivBase = evProxy > 0 ? evProxy * 0.7 : eps * ((peLow + peMid) / 2)
  const ivBull = evProxy > 0 ? evProxy * 0.9 : eps * peMid

  if (bvps > 0 && pb > justifiedPb * 1.25) {
    ivBear = Math.min(ivBear, bvps * justifiedPb * 0.7)
    ivBase = Math.min(ivBase, bvps * justifiedPb * 0.9)
    details.push('相对合理PB溢价较大 → 熊/基档压向合理折扣')
  }

  return {
    ivBear,
    ivBase,
    ivBull,
    primary,
    insuranceMeta: { roeA, roeRaw, justifiedPb, pb, evProxy, realEv: evPerShare > 0 },
    dataSparse: !(evPerShare > 0),
  }
}

/**
 * Brokers: strong cyclical financials. Mid-cycle PB shrinks in bull markets (Munger: psychology).
 */
function brokerValuationBands(fin, eps, peBand, details) {
  const { peLow, peMid } = peBand
  const bvps = +(fin.bvps || 0)
  const price = +(fin.price || 0)
  const pb = +(fin.pb || 0) || (bvps > 0 && price > 0 ? price / bvps : 0)
  const g = +(fin.profitGrowth || 0)
  const roeA = annualizeFinancialRoe(fin)

  if (!(bvps > 0) && !(pb > 0)) {
    details.push('类型: 券商 — 缺PB，保守PE（牛市仍忌外推）')
    if (!(eps > 0)) return { ivBear: 0, ivBase: 0, ivBull: 0, primary: 'hard', hard: true }
    const hair = g >= 50 ? 0.7 : g >= 25 ? 0.8 : 0.9
    return {
      ivBear: eps * peLow * hair * 0.85,
      ivBase: eps * ((peLow + peMid) / 2) * hair * 0.8,
      ivBull: eps * peMid * hair * 0.75,
      primary: 'pe_sparse',
      brokerMeta: null,
    }
  }

  // Mid-cycle fair PB — compress in bull, relax in trough.
  // A-share leaders mid-cycle historically ~1.3–1.6x; 1.1x was systematically cheap-shaming.
  let midPb = 1.35
  let cycleTag = '常态'
  if (g >= 100) {
    midPb = 0.9
    cycleTag = '极端牛市→中枢PB 0.9x'
  } else if (g >= 50) {
    midPb = 1.05
    cycleTag = '牛市高潮→中枢PB 1.05x'
  } else if (g >= 25) {
    midPb = 1.2
    cycleTag = '偏热→中枢PB 1.2x'
  } else if (g <= -40) {
    midPb = 1.55
    cycleTag = '深谷→中枢PB 1.55x'
  } else if (g <= -15) {
    midPb = 1.45
    cycleTag = '偏冷→中枢PB 1.45x'
  }

  if (roeA >= 12) midPb += 0.1
  else if (roeA >= 8) midPb += 0.05
  else if (roeA > 0 && roeA < 5) midPb -= 0.1
  midPb = Math.max(0.75, Math.min(1.75, midPb))

  details.push('类型: 券商 — 周期PB中枢（牛市去泡沫；忌高峰PE）')
  details.push(
    `年化ROE≈${roeA.toFixed(1)}% · 增速${g}% · ${cycleTag} · 合理PB≈${midPb.toFixed(2)}x · 现价PB=${pb ? pb.toFixed(2) : '—'}x`,
  )

  let ivBear = bvps > 0 ? bvps * midPb * 0.78 : eps * peLow
  let ivBase = bvps > 0 ? bvps * midPb * 0.95 : eps * ((peLow + peMid) / 2) * 0.85
  let ivBull = bvps > 0 ? bvps * midPb * 1.12 : eps * peMid * 0.85

  // Peak earnings PE would look "cheap" — invert: ignore as primary
  if (eps > 0 && g >= 25) {
    const peakPeIv = eps * peMid
    if (peakPeIv > ivBase * 1.25) {
      details.push(
        `逆向: 高峰盈利×PE(¥${peakPeIv.toFixed(0)})远超周期PB → 已忽略PE幻觉`,
      )
    }
  }

  return {
    ivBear,
    ivBase,
    ivBull,
    primary: 'pb_cycle',
    brokerMeta: { midPb, pb, roeA, g },
  }
}

/**
 * Platforms: Munger competence — loss-making = hard; profitable = conservative PE only.
 * Never growth-story DCF on sparse HK fundamentals.
 */
function platformValuationBands(fin, eps, peBand, details, price) {
  const { peLow, peMid, peHigh } = peBand
  const pe = +(fin.pe_ttm || 0) || (eps > 0 && price > 0 ? price / eps : 0)

  details.push('类型: 平台 — 有稳定利润才估；保守PE；忌增长叙事DCF')

  if (!(eps > 0) || pe <= 0) {
    details.push('无正EPS/负PE：默认能力圈外，不给精确买入IV（IV=0）')
    return {
      ivBear: 0,
      ivBase: 0,
      ivBull: 0,
      primary: 'hard',
      hard: true,
      platformMeta: { pe, fairPe: null, hard: true },
    }
  }

  // Cap fair PE — platforms rarely deserve mid-band in our conservative frame
  const fairPe = Math.min(peLow + (peMid - peLow) * 0.35, Math.max(10, peLow))
  details.push(`盈利平台保守公允PE≈${fairPe.toFixed(1)}x（行业带${peLow}–${peHigh}）· 现价PE=${pe.toFixed(1)}x`)

  let ivBear = eps * Math.min(peLow, fairPe) * 0.85
  let ivBase = eps * fairPe * 0.92
  let ivBull = eps * Math.min(peMid, fairPe * 1.25) * 0.9

  if (pe > fairPe * 1.35) {
    details.push('现价PE高于保守公允 → 熊/基档进一步折扣')
    ivBear *= 0.9
    ivBase *= 0.88
  }

  return {
    ivBear,
    ivBase,
    ivBull,
    primary: 'pe_conservative',
    platformMeta: { pe, fairPe, hard: false },
  }
}

/**
 * Real estate: stress NAV/PB. Losses + low PB ≠ margin of safety (classic value trap).
 */
function realEstateValuationBands(fin, eps, peBand, details) {
  const { peLow, peMid } = peBand
  const bvps = +(fin.bvps || 0)
  const price = +(fin.price || 0)
  const pb = +(fin.pb || 0) || (bvps > 0 && price > 0 ? price / bvps : 0)
  const debt = +(fin.debtRatio || 0)
  const roe = annualizeFinancialRoe(fin)
  const pe = +(fin.pe_ttm || 0)
  const g = +(fin.profitGrowth || 0)
  const loss = !(eps > 0) || pe <= 0 || roe < 0

  if (!(bvps > 0) && !(pb > 0)) {
    details.push('类型: 地产 — 缺NAV/账面，保守处理（港股开发商常见）')
    if (loss || !(eps > 0)) {
      details.push('无账面且亏损/无EPS → 不给买入型IV')
      return {
        ivBear: price * 0.4,
        ivBase: price * 0.55,
        ivBull: price * 0.7,
        primary: 'hard',
        hard: true,
        realEstateMeta: null,
      }
    }
    return {
      ivBear: eps * peLow * 0.7,
      ivBase: eps * ((peLow + peMid) / 2) * 0.65,
      ivBull: eps * peMid * 0.6,
      primary: 'pe_sparse',
      realEstateMeta: null,
    }
  }

  // Stressed mid-cycle PB for Chinese developers
  let midPb = 0.55
  let tag = '常态压力NAV'
  if (loss) {
    midPb = debt >= 80 ? 0.22 : 0.3
    tag = '亏损/负ROE → 深折账面'
  } else if (roe < 3 || (pe > 40 && eps > 0 && eps < price / 40)) {
    midPb = 0.4
    tag = '微利/失真PE → 低PB中枢'
  } else if (roe >= 8 && debt < 70) {
    midPb = 0.65
    tag = '尚可盈利 → 温和折价'
  }
  if (g < -50 && !loss) {
    midPb = Math.min(midPb, 0.38)
    tag += '；利润骤降加压'
  }

  details.push('类型: 地产 — 压力NAV/PB（破净≠安全；忌把清算幻觉当MoS）')
  details.push(
    `${tag} · 合理PB≈${midPb.toFixed(2)}x · 现价PB=${pb ? pb.toFixed(2) : '—'}x · 负债率${debt || '—'}%`,
  )

  let ivBear = bvps > 0 ? bvps * midPb * 0.75 : 0
  let ivBase = bvps > 0 ? bvps * midPb * 0.92 : 0
  let ivBull = bvps > 0 ? bvps * midPb * 1.1 : 0

  if (loss && pb > 0 && pb < midPb) {
    details.push('亏损且破净：仅按压力中枢给有限折价，不作烟蒂暴利')
  }
  if (loss && pb >= midPb) {
    details.push('亏损且PB不低于压力中枢 → 账面不构成安全边际')
    ivBear = Math.min(ivBear, price * 0.7)
    ivBase = Math.min(ivBase, price * 0.85)
  }

  return {
    ivBear,
    ivBase,
    ivBull,
    primary: 'nav',
    realEstateMeta: { midPb, pb, loss, debt, roe },
  }
}

/** Mid-cycle EPS — never capitalize peak (Buffett); lift trough, don't haircut flat years */
function midcycleEarnings(eps, fin, details) {
  if (!(eps > 0)) return 0
  const g = +(fin.profitGrowth || 0)
  let mid = eps
  let tag = '常态'
  if (g >= 60) {
    mid = eps * 0.5
    tag = '景气高峰→0.5x中枢'
  } else if (g >= 30) {
    mid = eps * 0.65
    tag = '偏热→0.65x'
  } else if (g >= 15) {
    mid = eps * 0.85
    tag = '略热→0.85x'
  } else if (g <= -40) {
    mid = eps * 1.45
    tag = '深谷→1.45x回升'
  } else if (g <= -20) {
    mid = eps * 1.25
    tag = '偏冷→1.25x'
  } else if (g <= -5) {
    mid = eps * 1.12
    tag = '浅谷→1.12x'
  } else {
    mid = eps
    tag = '平缓→1.0x（不无故打折）'
  }
  details.push(`周期中枢EPS: ${mid.toFixed(2)}（报表${eps.toFixed(2)}，增速${g}% · ${tag}）`)
  return mid
}

function cyclicalValuationBands(fin, eps, peBand, details) {
  const { peLow, peMid } = peBand
  const bvps = +(fin.bvps || 0)
  const price = +(fin.price || 0)
  const pb = +(fin.pb || 0) || (bvps > 0 && price > 0 ? price / bvps : 0)
  const mid = midcycleEarnings(eps, fin, details)
  const g = +(fin.profitGrowth || 0)

  details.push('类型: 强周期 — 中枢盈利×低PE；资沉辅以PB（禁峰值DCF）')

  let ivBear = mid * peLow
  let ivBase = mid * ((peLow + peMid) / 2) * (g <= -5 ? 0.95 : 0.9)
  let ivBull = mid * peMid * (g <= -5 ? 0.95 : 0.85)

  if (bvps > 0 && pb > 0) {
    const pbBear = bvps * 0.7
    const pbBase = bvps * 1.0
    if (g > 25 && ivBase > pbBase * 1.5) {
      details.push(`逆向: 高增速盈利估值远超账面 → PB锚定（熊¥${pbBear.toFixed(1)}）`)
      ivBear = Math.min(ivBear, pbBear)
      ivBase = Math.min(ivBase, (ivBase + pbBase) / 2)
    } else if (g < -5) {
      // Trough: don't let depressed earnings IV sit far below tangible book
      if (ivBear < pbBear * 0.85) {
        details.push('浅/深谷: 熊档托底约0.7x账面')
        ivBear = Math.max(ivBear, pbBear * 0.85)
      }
      if (ivBase < pbBase * 0.8) {
        details.push('浅/深谷: 基档托底约0.8x账面（报表利润暂失真）')
        ivBase = Math.max(ivBase, pbBase * 0.8)
      }
    }
  }

  return { ivBear, ivBase, ivBull, primary: 'midcycle_pe' }
}

/**
 * Biotech / pharma / CXO — stratified (Buffett: only when understandable cash).
 * - Pipeline / loss: hard
 * - CXO: capital-light services, still cyclical demand → conservative PE
 * - Profitable innovator: earnings-only, no pipeline DCF, high MoS
 */
function biotechValuationBands(fin, eps, peBand, details, industry = '') {
  const { peLow, peMid, peHigh } = peBand
  const price = +(fin.price || 0)
  const pe = +(fin.pe_ttm || 0) || (eps > 0 && price > 0 ? price / eps : 0)
  const ind = String(industry || '')
  const isCxo = /CXO|cxo/.test(ind)
  const isVaccine = /疫苗|血液/.test(ind)

  details.push(
    isCxo
      ? '类型: CXO — 订单周期+客户集中；保守PE，忌把产能故事当永续'
      : isVaccine
        ? '类型: 疫苗/血液制品 — 批次与集采风险；盈利才估'
        : '类型: 创新药/生物 — 管线失败率高；只信报表利润',
  )

  if (!(eps > 0) || pe <= 0) {
    details.push('无正EPS/负PE：管线叙事默认能力圈外，不给买入型IV（IV=0）')
    return {
      ivBear: 0,
      ivBase: 0,
      ivBull: 0,
      primary: 'hard',
      hard: true,
      biotechMeta: { tier: 'pipeline', pe, fairPe: null, hard: true },
    }
  }

  // Extreme PE = growth/pipeline fantasy still in price
  if (pe > 80) {
    details.push(`PE=${pe.toFixed(0)}x 过高：视为叙事定价，能力圈外`)
    return {
      ivBear: eps * Math.min(peLow, 15) * 0.5,
      ivBase: eps * Math.min(peLow, 18) * 0.6,
      ivBull: eps * Math.min(peMid, 25) * 0.55,
      primary: 'hard',
      hard: true,
      biotechMeta: { tier: 'narrative', pe, fairPe: Math.min(peLow, 18), hard: true },
    }
  }

  let fairPe
  let hair = 0.85
  let tier = 'innovator'
  if (isCxo) {
    // CXO: mid-cycle PE below sector mid; haircut for customer concentration
    fairPe = Math.min(peLow + (peMid - peLow) * 0.4, Math.max(12, peLow))
    hair = 0.88
    tier = 'cxo'
    details.push(`CXO保守公允PE≈${fairPe.toFixed(1)}x（带${peLow}–${peHigh}）· 现价PE=${pe.toFixed(1)}x`)
  } else if (isVaccine) {
    fairPe = Math.min(peLow + (peMid - peLow) * 0.3, Math.max(10, peLow * 0.9))
    hair = 0.82
    tier = 'vaccine'
    details.push(`疫苗/血液公允PE≈${fairPe.toFixed(1)}x · 现价PE=${pe.toFixed(1)}x`)
  } else {
    // Innovator: never use bull-case PE; pay only for proven earnings
    fairPe = Math.min(peLow + (peMid - peLow) * 0.25, Math.max(12, peLow))
    hair = 0.8
    details.push(`盈利创新药公允PE≈${fairPe.toFixed(1)}x（禁管线DCF）· 现价PE=${pe.toFixed(1)}x`)
  }

  let ivBear = eps * Math.min(peLow, fairPe) * hair * 0.9
  let ivBase = eps * fairPe * hair
  let ivBull = eps * Math.min(peMid, fairPe * 1.2) * hair * 0.95

  if (pe > fairPe * 1.4) {
    details.push('现价PE相对公允溢价大 → 进一步折扣')
    ivBear *= 0.9
    ivBase *= 0.88
  }

  return {
    ivBear,
    ivBase,
    ivBull,
    primary: isCxo ? 'cxo_pe' : 'earnings_only',
    biotechMeta: { tier, pe, fairPe, hard: false },
  }
}

function bandsByArchetype(archetype, fin, eps, peBand, model, details, industry = '') {
  const { peLow, peMid } = peBand
  const price = +(fin.price || 0)
  const bvps = +(fin.bvps || 0)
  const oeRes = resolveOwnerEarnings(eps, archetype, fin)
  const oe = oeRes.oe

  if (archetype === 'franchise_brand') {
    details.push('类型: 特许经营权 — Owner Earnings×保守PE（喜诗/可口可乐逻辑）')
    if (oeRes.source === 'oe_eps_blend' && oeRes.rawFcf != null) {
      details.push(
        `Owner Earnings≈${oe.toFixed(2)}（报表FCF/股${oeRes.rawFcf.toFixed(2)}低于EPS：特许经营按存货/渠道营运资本口径调和，不作资本开支式永久折损）`,
      )
    } else if (oeRes.source === 'oe_eps_cap' && oeRes.rawFcf != null) {
      details.push(
        `Owner Earnings≈${oe.toFixed(2)}（报表FCF/股${oeRes.rawFcf.toFixed(2)}异常高于EPS，已封顶防一次性现金流高估）`,
      )
    } else {
      details.push(
        `Owner Earnings≈${oe.toFixed(2)}（来源:${oeRes.source}${oeRes.sparseCash ? '·缺现金流' : ''}）`,
      )
    }
    // Mid-band tilt + light haircut: wonderful brand ≠ free pass, but don't stack 熊档+0.92
    const fairMul = peLow * 0.28 + peMid * 0.72
    return {
      ivBear: oe * peLow,
      ivBase: oe * fairMul * 0.96,
      ivBull: oe * peMid,
      primary: oeRes.sparseCash ? 'oe_pe_proxy' : 'oe_pe',
      cashSparse: oeRes.sparseCash,
    }
  }
  if (archetype === 'bank') {
    return bankValuationBands(fin, eps, peBand, details)
  }
  if (archetype === 'insurance') {
    return insuranceValuationBands(fin, eps, peBand, details)
  }
  if (archetype === 'broker') {
    return brokerValuationBands(fin, eps, peBand, details)
  }
  if (archetype === 'cyclical') {
    return cyclicalValuationBands(fin, eps, peBand, details)
  }
  if (archetype === 'capital_heavy') {
    const tag = oeRes.sparseCash ? 'EPS折损代理' : '报表FCF/OE'
    details.push(`类型: 资本密集 — ${tag}×PE带`)
    if (oeRes.source === 'oe_eps_blend' && oeRes.rawFcf != null) {
      details.push(
        `OE≈${oe.toFixed(2)}（报表FCF/股${oeRes.rawFcf.toFixed(2)}偏低，已与维保口径盈利折损调和）`,
      )
    } else if (oeRes.source === 'oe_eps_cap' && oeRes.rawFcf != null) {
      details.push(`OE≈${oe.toFixed(2)}（报表FCF/股${oeRes.rawFcf.toFixed(2)}偏高，已封顶）`)
    } else {
      details.push(`OE≈${oe.toFixed(2)}（来源:${oeRes.source}）`)
    }
    const baseMul = oeRes.sparseCash ? 0.88 : 0.95
    return {
      ivBear: oe * peLow,
      ivBase: oe * peMid * baseMul,
      ivBull: oe * peMid,
      primary: oeRes.sparseCash ? 'oe_haircut_pe' : 'fcf_pe',
      cashSparse: oeRes.sparseCash,
    }
  }
  if (archetype === 'platform') {
    return platformValuationBands(fin, eps, peBand, details, price)
  }
  if (archetype === 'biotech') {
    return biotechValuationBands(fin, eps, peBand, details, industry)
  }
  if (archetype === 'real_estate') {
    return realEstateValuationBands(fin, eps, peBand, details)
  }
  if (archetype === 'utility_infra') {
    details.push('类型: 公用/基建/稳定现金流')
    const cashEps = oe > 0 ? oe : eps
    const g1 = Math.max(0.02, Math.min(0.06, (+(fin.profitGrowth || 4) / 100) * 0.7))
    const dr = Math.max(0.07, (model.dr || 0.09) - 0.005)
    const { dcf } = dcfSum(cashEps, g1, 0.02, dr, Math.min(model.tg || 0.025, 0.025))
    details.push(
      `稳定DCF≈${dcf.toFixed(0)}（OE来源:${oeRes.source}${oeRes.sparseCash ? '·缺现金流' : ''}）`,
    )
    // Regulated cash earners: PE mid is a first-class anchor alongside DCF
    const peBase = (cashEps || eps) * peMid
    return {
      ivBear: Math.min(dcf * 0.88, (cashEps || eps) * peLow),
      ivBase: dcf * 0.45 + peBase * 0.55,
      ivBull: Math.max(dcf * 1.05, (cashEps || eps) * peMid),
      primary: oeRes.sparseCash ? 'stable_dcf_proxy' : 'stable_dcf',
      cashSparse: oeRes.sparseCash,
    }
  }
  details.push('类型: 默认 — PE下限锚定')
  if (!(eps > 0)) return { ivBear: 0, ivBase: 0, ivBull: 0, primary: 'hard', hard: true }
  return {
    ivBear: eps * peLow,
    ivBase: eps * peMid * 0.8,
    ivBull: eps * peMid,
    primary: 'pe_fallback',
  }
}

/**
 * Buffett × Munger: classify → quality → invert → conservative bands → MoS
 * @param {object} [opts]
 * @param {string|null} [opts.paradigmOverride] user-picked paradigm id (recomputes when engineHint maps)
 */
export function calculateValuation(fin, code, name, opts = {}) {
  const industry = getIndustry(code, name)
  const model = INDUSTRY_MODELS[industry] || INDUSTRY_MODELS['其他']
  const price = +(fin.price || 0)
  const details = []

  const earlyVal = fin.valuability || assessValuability(fin)
  if (earlyVal === 'search_only') {
    details.push('数据空洞：无价格/盈利/账面，不作内在价值点估计')
    return {
      intrinsicValue: 0,
      ivBear: 0,
      ivBase: 0,
      ivBull: 0,
      currentEPS: 0,
      industry,
      archetype: 'hard',
      archetypeId: 'hard',
      archetypeLabel: ARCHETYPE_META.hard.label,
      method: ARCHETYPE_META.hard.method,
      marginOfSafety: null,
      mosConfidence: 'low',
      competence: 'hard',
      actionHint: '能力圈警示：缺财务输入，默认「太难理解」',
      verdict: '数据不足',
      details,
      valuability: 'search_only',
      structureOnly: true,
      primaryAnchor: 'hard',
    }
  }

  // Sanitize absurd book metrics (common in sparse Eastmoney dumps: bvps off by 50–100×)
  const rawBvps = +(fin.bvps || 0)
  const rawPb = +(fin.pb || 0)
  const impliedPb = rawBvps > 0 && price > 0 ? price / rawBvps : 0
  const pbProbe = rawPb || impliedPb
  const finIndustry =
    /银行|券商|保险|农商|城商|寿险|财险/.test(industry) ||
    /银行|证券|保险/.test(String(name || ''))
  // Banks/brokers: PB>4 on A-share books is almost always a unit error, not a bubble
  const bookBroken =
    pbProbe > 25 ||
    impliedPb > 25 ||
    (rawBvps > 0 && price > 0 && rawBvps < price / 40) ||
    (finIndustry && pbProbe > 4)
  if (bookBroken) {
    const roe = +(fin.roe || 0)
    const epsGuess = +(fin.eps || 0)
    let salvaged = false
    // Banks: absurd Eastmoney PB is common — rebuild book from EPS/ROE so PB-ROE can run
    if (finIndustry && roe > 3 && roe < 25 && epsGuess > 0 && price > 0) {
      const salvageBvps = epsGuess / (roe / 100)
      const salvagePb = price / salvageBvps
      if (salvageBvps > 0 && salvagePb >= 0.25 && salvagePb <= 3.5) {
        fin = { ...fin, bvps: salvageBvps, pb: salvagePb }
        details.push(
          `账面重建: 原PB=${Number(pbProbe).toFixed(1)}荒谬 → BVPS≈EPS/ROE=${salvageBvps.toFixed(2)}（PB≈${salvagePb.toFixed(2)}），保留银行PB-ROE主锚`,
        )
        salvaged = true
      }
    }
    if (!salvaged) {
      details.push(
        `账面数据异常已忽略（PB=${Number(pbProbe).toFixed(1)} / BVPS=${rawBvps}）：改走盈利/现金流主锚`,
      )
      fin = { ...fin, bvps: 0, pb: 0 }
    }
  }

  const anglesResolved = resolveStockAngles({
    code,
    name,
    industry,
    fin,
    userOverride: opts.paradigmOverride || null,
  })
  const archetype = anglesResolved.primary.archetype || getArchetype(industry, name)
  const meta = { ...(ARCHETYPE_META[archetype] || ARCHETYPE_META.hard) }
  const computeParadigm =
    getParadigmById(anglesResolved.primary.paradigmId) || primaryParadigmForModel(model.model)
  // Display paradigm: honor user pick even when thinking-only (IV still uses computeParadigm)
  const displayOverride =
    anglesResolved.overrideThinkingOnly && opts.paradigmOverride
      ? getParadigmById(opts.paradigmOverride)
      : null
  const paradigm = displayOverride || computeParadigm

  details.push(`分类: ${meta.label}｜方法: ${meta.method}`)
  details.push(`估值范式: ${paradigm.name}（${paradigm.when}）`)
  if (anglesResolved.overrideApplied) {
    details.push(`用户覆盖范式: ${paradigm.name} → 主锚按 ${meta.label} 重算`)
  } else if (anglesResolved.overrideThinkingOnly) {
    details.push(
      `用户所选「${paradigm.name}」为思维框架：IV主锚仍为 ${computeParadigm.name}（${meta.label}）`,
    )
  }
  details.push(`巴菲特: ${meta.buffett}`)
  details.push(`芒格: ${meta.munger}`)
  if (anglesResolved.angles?.length) {
    details.push(`多视角: ${anglesResolved.angles.slice(0, 2).join('；')}`)
  }

  const earned = resolveEarnings(fin, code, details)
  const eps = earned.eps || 0
  const pe = +(fin.pe_ttm || 0) || (eps > 0 && price > 0 ? price / eps : 0)
  const peBand = getPeBand(industry)
  const { peLow, peHigh } = peBand

  // Platforms: loss-making → hard competence; profitable cash earnings → moderate
  if (archetype === 'platform') {
    if (!(eps > 0) || pe <= 0) {
      meta.competenceDefault = 'hard'
      meta.mosBuyMin = 99
      details.push('能力圈: 亏损/负PE平台 → 默认太难理解')
    } else {
      meta.competenceDefault = 'moderate'
      details.push('能力圈: 有正利润 → 可进边缘（仍要大折扣）')
    }
  }

  // Biotech: pipeline/narrative hard; profitable CXO/innovator → moderate edge
  if (archetype === 'biotech') {
    const isCxo = /CXO/.test(industry)
    if (!(eps > 0) || pe <= 0 || pe > 80) {
      meta.competenceDefault = 'hard'
      meta.mosBuyMin = Math.max(meta.mosBuyMin, 50)
      details.push('能力圈: 管线/叙事定价 → 默认太难理解')
    } else if (isCxo) {
      meta.competenceDefault = 'moderate'
      meta.mosBuyMin = Math.max(meta.mosBuyMin, 28)
      details.push('能力圈: 盈利CXO → 可进边缘（订单周期仍要折扣）')
    } else {
      meta.competenceDefault = 'moderate'
      meta.mosBuyMin = Math.max(meta.mosBuyMin, 32)
      details.push('能力圈: 有报表利润的药企 → 边缘可理解（仍忌管线外推）')
    }
  }

  // Small-cap / microcap: demand more MoS; penny + absurd PE = data trap
  const mv = +(fin.total_mv || 0)
  const isSmall = mv > 0 && mv < 150
  const isMicro = mv > 0 && mv < 30
  const junkPe = pe > 0 && pe < 2.5 && price > 0 && price < 1
  if (junkPe || (isMicro && pe > 0 && pe < 4)) {
    meta.competenceDefault = 'hard'
    meta.mosBuyMin = Math.max(meta.mosBuyMin, 50)
    details.push('仙股/异常低PE：数据或清算幻觉，能力圈外')
  } else if (isSmall) {
    meta.mosBuyMin = Math.round(meta.mosBuyMin * (isMicro ? 1.45 : 1.25))
    details.push(`小盘加码安全边际（市值≈${mv.toFixed(0)}亿 → 门槛${meta.mosBuyMin}%）`)
  }

  const quality = assessQuality(fin, archetype, name)
  details.push(
    `质量判定: ${quality.quality}（分${quality.score}）${quality.notes.length ? ' — ' + quality.notes.join('、') : ''}`,
  )

  const risks = invertRisks(archetype, fin, industry)
  details.push(`逆向风险: ${risks.join('；')}`)

  const bands = bandsByArchetype(archetype, fin, eps, peBand, model, details, industry)
  let { ivBear, ivBase, ivBull } = bands

  // Ensemble: optional secondary archetype band when data allows
  const ensemble = {
    blended: false,
    primaryWeight: 1,
    primary: {
      paradigmId: anglesResolved.primary.paradigmId,
      archetype,
      ivBear: bands.ivBear,
      ivBase: bands.ivBase,
      ivBull: bands.ivBull,
      anchor: bands.primary,
    },
    secondary: null,
  }
  const secCand = (anglesResolved.secondary || []).find(
    (s) => s.archetype && s.archetype !== archetype && (s.weight || 0) >= 0.15,
  )
  if (secCand && !bands.hard) {
    const secDetails = []
    const secBands = bandsByArchetype(
      secCand.archetype,
      fin,
      eps,
      peBand,
      model,
      secDetails,
      industry,
    )
    if (!secBands.hard && secBands.ivBase > 0 && (bands.ivBase > 0 || eps > 0)) {
      const wSec = Math.min(0.35, Math.max(0.15, +secCand.weight || 0.2))
      const wPri = 1 - wSec
      ivBear = bands.ivBear * wPri + secBands.ivBear * wSec
      ivBase = bands.ivBase * wPri + secBands.ivBase * wSec
      ivBull = bands.ivBull * wPri + secBands.ivBull * wSec
      ensemble.blended = true
      ensemble.primaryWeight = Math.round(wPri * 100) / 100
      ensemble.secondary = {
        paradigmId: secCand.paradigmId,
        paradigmName: secCand.paradigmName,
        archetype: secCand.archetype,
        weight: Math.round(wSec * 100) / 100,
        reason: secCand.reason,
        ivBear: Math.round(secBands.ivBear * 100) / 100,
        ivBase: Math.round(secBands.ivBase * 100) / 100,
        ivBull: Math.round(secBands.ivBull * 100) / 100,
        anchor: secBands.primary,
      }
      details.push(
        `多视角校准: 主${meta.label}${(wPri * 100) | 0}% + 辅${ARCHETYPE_META[secCand.archetype]?.label || secCand.archetype}${(wSec * 100) | 0}%`,
      )
    }
  }

  let wBear = 0.58
  let wBase = 0.42
  if (quality.quality === 'wonderful') {
    wBear = 0.35
    wBase = 0.65
  } else if (quality.quality === 'good') {
    wBear = 0.45
    wBase = 0.55
  } else if (quality.quality === 'cigar') {
    wBear = 0.75
    wBase = 0.25
  }
  // Banks: slightly more base weight when ROE healthy (franchise-like deposit franchise)
  if (archetype === 'bank' && quality.roeUsed >= 10) {
    wBear = 0.48
    wBase = 0.52
  }
  // Brokers / insurers: gross-margin scorecard mislabels them cigar — don't 75% bear-crush PB anchors
  if (archetype === 'broker' || archetype === 'insurance') {
    const roeA = quality.roeUsed || +(fin.roe || 0)
    if (roeA >= 8) {
      wBear = 0.42
      wBase = 0.58
    } else if (roeA >= 5) {
      wBear = 0.5
      wBase = 0.5
    } else {
      wBear = 0.58
      wBase = 0.42
    }
  }
  // Cyclical trough: lift base weight so mid-cycle EPS actually shows up
  if (archetype === 'cyclical' && +(fin.profitGrowth || 0) <= -5) {
    wBear = Math.min(wBear, 0.5)
    wBase = Math.max(wBase, 0.5)
  }
  // Cyclical with PE already inside band: don't let cigar 75% bear invent theatrical cheapness/expensiveness
  if (archetype === 'cyclical' && pe > 0 && pe >= peLow && pe <= peHigh && wBear > 0.55) {
    wBear = 0.55
    wBase = 0.45
  }

  let intrinsicValue = ivBear * wBear + ivBase * wBase
  details.push(
    `三档 熊¥${ivBear.toFixed(0)} / 基¥${ivBase.toFixed(0)} / 牛¥${ivBull.toFixed(0)}（权重 熊${(wBear * 100) | 0}/基${(wBase * 100) | 0}）`,
  )
  details.push(`行业PE带 ${peLow}–${peHigh}x · 现价PE ${pe ? pe.toFixed(1) : '—'}x`)

  let verdict = peVerdict(pe, peLow, peHigh)
  // Banks / insurance / brokers / realty: PB (or P/EV / NAV) is the honest verdict
  const pbMeta = bands.bankMeta || bands.insuranceMeta || bands.brokerMeta || bands.realEstateMeta
  if (
    pbMeta &&
    pbMeta.pb > 0 &&
    (archetype === 'bank' ||
      archetype === 'insurance' ||
      archetype === 'broker' ||
      archetype === 'real_estate')
  ) {
    const justified = pbMeta.justifiedPb ?? pbMeta.midPb
    const { pb } = pbMeta
    if (pb > 0 && justified > 0) {
      const disc = ((justified - pb) / justified) * 100
      if (disc >= 25) verdict = { label: '显著偏低', tone: 'good', percentile: Math.max(0, 30 - disc) }
      else if (disc >= 10) verdict = { label: '合理偏下', tone: 'good', percentile: 35 }
      else if (disc >= -10) verdict = { label: '估值合理', tone: 'info', percentile: 50 }
      else if (disc >= -40) verdict = { label: '合理偏上', tone: 'warn', percentile: 70 }
      else verdict = { label: '显著偏高', tone: 'warn', percentile: 90 }
      const tag =
        archetype === 'bank'
          ? '银行主锚PB'
          : archetype === 'insurance'
            ? '保险主锚P/EV代理'
            : archetype === 'broker'
              ? '券商主锚周期PB'
              : '地产主锚压力NAV'
      details.push(
        `${tag}: 现价${pb.toFixed(2)} vs 合理${justified.toFixed(2)}（折价${disc.toFixed(0)}%）→ ${verdict.label}`,
      )
    }
  }
  // Platforms: PE vs conservative fair PE
  if (archetype === 'platform' && bands.platformMeta && bands.platformMeta.fairPe) {
    const { pe: pPe, fairPe } = bands.platformMeta
    const disc = ((fairPe - pPe) / fairPe) * 100
    if (disc >= 25) verdict = { label: '显著偏低', tone: 'good', percentile: Math.max(0, 30 - disc) }
    else if (disc >= 10) verdict = { label: '合理偏下', tone: 'good', percentile: 35 }
    else if (disc >= -10) verdict = { label: '估值合理', tone: 'info', percentile: 50 }
    else if (disc >= -40) verdict = { label: '合理偏上', tone: 'warn', percentile: 70 }
    else verdict = { label: '显著偏高', tone: 'warn', percentile: 90 }
    details.push(
      `平台主锚保守PE: 现价${pPe.toFixed(1)} vs 公允${fairPe.toFixed(1)}（折价${disc.toFixed(0)}%）→ ${verdict.label}`,
    )
  }
  // Biotech: same PE-anchor when fairPe known
  if (archetype === 'biotech' && bands.biotechMeta && bands.biotechMeta.fairPe) {
    const { pe: pPe, fairPe, tier } = bands.biotechMeta
    const disc = ((fairPe - pPe) / fairPe) * 100
    if (disc >= 25) verdict = { label: '显著偏低', tone: 'good', percentile: Math.max(0, 30 - disc) }
    else if (disc >= 10) verdict = { label: '合理偏下', tone: 'good', percentile: 35 }
    else if (disc >= -10) verdict = { label: '估值合理', tone: 'info', percentile: 50 }
    else if (disc >= -40) verdict = { label: '合理偏上', tone: 'warn', percentile: 70 }
    else verdict = { label: '显著偏高', tone: 'warn', percentile: 90 }
    details.push(
      `医药主锚(${tier}): 现价PE${pPe.toFixed(1)} vs 公允${fairPe.toFixed(1)}（折价${disc.toFixed(0)}%）→ ${verdict.label}`,
    )
  }
  if (
    verdict.percentile != null &&
    archetype !== 'bank' &&
    archetype !== 'insurance' &&
    archetype !== 'broker' &&
    archetype !== 'real_estate' &&
    archetype !== 'platform' &&
    archetype !== 'biotech'
  ) {
    details.push(`PE分位约 ${verdict.percentile.toFixed(0)}% → ${verdict.label}`)
  }

  let marginOfSafety = price > 0 && intrinsicValue > 0 ? ((intrinsicValue - price) / price) * 100 : null

  if (
    marginOfSafety != null &&
    Math.abs(marginOfSafety) > 40 &&
    pe > 0 &&
    pe >= peLow &&
    pe <= peHigh &&
    archetype !== 'bank' &&
    archetype !== 'insurance' &&
    archetype !== 'broker' &&
    archetype !== 'real_estate' &&
    archetype !== 'cyclical'
  ) {
    // Utilities / wonderful franchises: PE already in-band means DCF was too harsh —
    // converge toward mid-band PE, not peLow (那会把长江电力类标的系统性压穿).
    const anchorPe =
      archetype === 'utility_infra' ||
      archetype === 'franchise_brand' ||
      archetype === 'biotech' ||
      archetype === 'capital_heavy' ||
      quality.quality === 'wonderful' ||
      quality.quality === 'good' ||
      quality.quality === 'fair'
        ? (peLow + peHigh) / 2
        : peLow
    const peAnchorIv = eps > 0 ? eps * anchorPe : intrinsicValue
    intrinsicValue = peAnchorIv * 0.55 + intrinsicValue * 0.45
    marginOfSafety = ((intrinsicValue - price) / price) * 100
    details.push(
      `克制: PE在带内仍夸张MoS → 向PE${anchorPe === peLow ? '下限' : '中枢'}(${anchorPe.toFixed(0)}x)收敛`,
    )
  }

  let mosConfidence = bands.hard ? 'low' : earned.quality === 'corrected' ? 'medium' : 'high'
  const primaryAnchor = bands.primary || 'unknown'
  const valuability = fin.valuability || assessValuability(fin)
  const sparseFinData =
    bands.dataSparse ||
    bands.cashSparse ||
    primaryAnchor === 'pe_sparse' ||
    /_proxy$/.test(String(primaryAnchor)) ||
    primaryAnchor === 'oe_haircut_pe'
  if (sparseFinData) {
    mosConfidence = mosConfidence === 'high' ? 'medium' : mosConfidence
    if (primaryAnchor === 'pe_sparse' || bands.hard) mosConfidence = 'low'
  }
  if (archetype === 'insurance' && bands.insuranceMeta && !bands.insuranceMeta.realEv) {
    mosConfidence = mosConfidence === 'high' ? 'medium' : mosConfidence
  }
  // Incomplete financials: never pretend high-precision MoS
  if (valuability !== 'full') {
    mosConfidence = 'low'
    details.push('仅供结构参考：财务输入不完整，不作高精度安全边际点估计')
  }

  // Munger: |MoS|>50% almost always means bad assumptions stacked — clamp toward price
  if (marginOfSafety != null && Math.abs(marginOfSafety) > 50 && price > 0) {
    // Loss-making realty: heroic positive MoS on book is a trap — clamp harder
    const lossRealty = archetype === 'real_estate' && bands.realEstateMeta?.loss
    const absurd = Math.abs(marginOfSafety) > 100
    const clampIv = absurd
      ? marginOfSafety > 0
        ? price * 1.08
        : price * 0.88
      : marginOfSafety > 0
        ? price * (lossRealty ? 1.05 : 1.35)
        : price * 0.7
    intrinsicValue = absurd
      ? clampIv
      : intrinsicValue * 0.25 + clampIv * 0.75
    marginOfSafety = ((intrinsicValue - price) / price) * 100
    details.push(
      absurd
        ? '芒格克制: |MoS|>100%视为数据/模型失效，强制贴近现价'
        : lossRealty
          ? '芒格克制: 亏损地产账面MoS视为假精度，已强收敛'
          : '芒格克制: |安全边际|>50%视为假精度，已向现价收敛',
    )
    mosConfidence = 'low'
  }

  // Cyclicals: mid-cycle MoS overrides raw PE percentile (peak earnings look "cheap" on PE)
  if (archetype === 'cyclical' && marginOfSafety != null) {
    if (marginOfSafety <= -38) {
      verdict = { label: '显著偏高', tone: 'warn', percentile: 85 }
      details.push(`周期主锚: 中枢盈利后MoS=${marginOfSafety.toFixed(0)}% → ${verdict.label}`)
    } else if (marginOfSafety <= -12) {
      verdict = { label: '合理偏上', tone: 'warn', percentile: 70 }
      details.push(`周期主锚: 中枢盈利后MoS=${marginOfSafety.toFixed(0)}% → ${verdict.label}`)
    } else if (marginOfSafety >= 20) {
      verdict = { label: '合理偏下', tone: 'good', percentile: 35 }
      details.push(`周期主锚: 中枢盈利后MoS=${marginOfSafety.toFixed(0)}% → ${verdict.label}`)
    }
  }

  // Financials / realty: never keep PE「显著偏低」when MoS says expensive (HK sparse PB trap)
  const finLike =
    archetype === 'bank' ||
    archetype === 'insurance' ||
    archetype === 'broker' ||
    archetype === 'real_estate'
  const finMeta = bands.bankMeta || bands.insuranceMeta || bands.brokerMeta || bands.realEstateMeta
  const sparseFin = finLike && !(finMeta && finMeta.pb > 0)
  if (finLike && marginOfSafety != null) {
    if (sparseFin) {
      if (marginOfSafety <= -38) verdict = { label: '显著偏高', tone: 'warn', percentile: 85 }
      else if (marginOfSafety <= -12) verdict = { label: '合理偏上', tone: 'warn', percentile: 70 }
      else if (marginOfSafety >= 18) verdict = { label: '合理偏下', tone: 'good', percentile: 35 }
      else if (marginOfSafety >= 5) verdict = { label: '估值合理', tone: 'info', percentile: 50 }
      else verdict = { label: '估值合理', tone: 'info', percentile: 55 }
      details.push(`缺PB时以MoS主锚: ${marginOfSafety.toFixed(0)}% → ${verdict.label}`)
    } else if (bands.realEstateMeta?.loss && /偏低|偏下/.test(verdict.label)) {
      // Book discount on loss-making developers is not a value signal
      verdict = { label: '估值合理', tone: 'warn', percentile: 60 }
      details.push('亏损地产: 破净不作「偏低」标签（清算幻觉）')
    } else if (/显著偏低/.test(verdict.label) && marginOfSafety < 0) {
      // PB折价但保守IV仍低于现价：不是「显著低估」，只是折价未够重仓
      verdict = { label: '合理偏下', tone: 'good', percentile: 35 }
      details.push(
        `调和: PB折价但MoS=${marginOfSafety.toFixed(0)}%<0 → 降为合理偏下（未达买入线）`,
      )
    } else if (/偏低|偏下/.test(verdict.label) && marginOfSafety <= -20) {
      verdict = { label: '合理偏上', tone: 'warn', percentile: 70 }
      details.push(`调和: 标签偏低但MoS=${marginOfSafety.toFixed(0)}% → ${verdict.label}`)
    }
  }

  // Capital-heavy / utility / franchise / etc.: PE band can look「偏低」while
  // OE-haircut or DCF IV is clearly below price — MoS wins over raw PE percentile.
  // Franchise wonderful: require deeper MoS damage before flipping PE「偏下」→「偏上」
  // (mild premium to conservative IV ≠ expensive on a brand-PE basis).
  if (!finLike && archetype !== 'cyclical' && marginOfSafety != null) {
    const flipUp =
      archetype === 'franchise_brand' && quality.quality === 'wonderful' ? -28 : -12
    const flipAbsurd =
      archetype === 'franchise_brand' && quality.quality === 'wonderful' ? -45 : -38
    if (/偏低|偏下/.test(verdict.label)) {
      if (marginOfSafety <= flipAbsurd) {
        verdict = { label: '显著偏高', tone: 'warn', percentile: 85 }
        details.push(
          `调和: PE分位偏低但保守IV的MoS=${marginOfSafety.toFixed(0)}% → ${verdict.label}`,
        )
      } else if (marginOfSafety <= flipUp) {
        verdict = { label: '合理偏上', tone: 'warn', percentile: 70 }
        details.push(
          `调和: PE分位偏低但保守IV的MoS=${marginOfSafety.toFixed(0)}% → ${verdict.label}`,
        )
      } else if (/显著偏低/.test(verdict.label) && marginOfSafety < 8) {
        verdict = { label: '估值合理', tone: 'info', percentile: 50 }
        details.push(
          `调和: PE「显著偏低」但保守MoS仅${marginOfSafety.toFixed(0)}% → ${verdict.label}`,
        )
      }
    } else if (
      /估值合理/.test(verdict.label) &&
      marginOfSafety <= -28 &&
      archetype !== 'platform' &&
      archetype !== 'biotech'
    ) {
      verdict =
        marginOfSafety <= -38
          ? { label: '显著偏高', tone: 'warn', percentile: 85 }
          : { label: '合理偏上', tone: 'warn', percentile: 70 }
      details.push(
        `调和: PE分位合理但保守IV的MoS=${marginOfSafety.toFixed(0)}% → ${verdict.label}`,
      )
    }
  }

  // Mild premium ≠「显著偏高」: reserve that label for deep MoS damage
  if (
    /显著偏高/.test(verdict.label) &&
    marginOfSafety != null &&
    marginOfSafety > -28
  ) {
    verdict = { label: '合理偏上', tone: 'warn', percentile: 72 }
    details.push(
      `调和: 「显著偏高」但MoS仅${marginOfSafety.toFixed(0)}% → ${verdict.label}`,
    )
  }

  if (marginOfSafety != null && Math.abs(marginOfSafety) > 45) mosConfidence = 'low'
  if (meta.competenceDefault === 'hard') mosConfidence = 'low'

  const mosNeedAdj =
    quality.quality === 'wonderful'
      ? meta.mosBuyMin * 0.7
      : quality.quality === 'cigar'
        ? meta.mosBuyMin * 1.3
        : meta.mosBuyMin

  let actionHint = '观望'
  if (bands.hard || meta.competenceDefault === 'hard') {
    actionHint = '能力圈警示：默认「太难理解」，除非你真懂商业模式'
  } else if (
    archetype === 'real_estate' &&
    bands.realEstateMeta?.loss &&
    (marginOfSafety == null || marginOfSafety < mosNeedAdj)
  ) {
    actionHint = '亏损地产：账面折价≠安全边际，忌当烟蒂'
  } else if (
    // Sparse HK financials: meta is null — drive hint from MoS, not PE「偏低」
    (archetype === 'bank' ||
      archetype === 'insurance' ||
      archetype === 'broker' ||
      archetype === 'real_estate') &&
    !(bands.bankMeta || bands.insuranceMeta || bands.brokerMeta || bands.realEstateMeta)
  ) {
    if (marginOfSafety != null && marginOfSafety >= mosNeedAdj) {
      actionHint = `具备该类所需保守安全边际（门槛≈${mosNeedAdj.toFixed(0)}%），可考虑分批`
    } else if (marginOfSafety != null && marginOfSafety < -15) {
      actionHint = '偏贵：好公司≠好价格（缺PB，按保守PE）'
    } else if (marginOfSafety != null && marginOfSafety >= 5) {
      actionHint = '略便宜：宜定投，未到重仓线'
    } else {
      actionHint = '缺PB数据：观望，不作折价幻觉'
    }
  } else if (
    marginOfSafety != null &&
    marginOfSafety >= mosNeedAdj &&
    (verdict.percentile == null || verdict.percentile <= 45) &&
    !(archetype === 'real_estate' && bands.realEstateMeta?.loss)
  ) {
    actionHint = `具备该类所需保守安全边际（门槛≈${mosNeedAdj.toFixed(0)}%），可考虑分批`
  } else if (
    quality.quality === 'wonderful' &&
    verdict.percentile != null &&
    verdict.percentile <= 50 &&
    (marginOfSafety == null || marginOfSafety > -5)
  ) {
    actionHint = '伟大企业落在公允偏下：可持有/定投（不是烟蒂式暴利）'
  } else if (
    (archetype === 'bank' ||
      archetype === 'insurance' ||
      archetype === 'broker' ||
      archetype === 'real_estate') &&
    (bands.bankMeta || bands.insuranceMeta || bands.brokerMeta || bands.realEstateMeta)
  ) {
    const metaPb = bands.bankMeta || bands.insuranceMeta || bands.brokerMeta || bands.realEstateMeta
    const justified = metaPb.justifiedPb ?? metaPb.midPb
    const { pb } = metaPb
    if (!(pb > 0) || !(justified > 0)) {
      if (marginOfSafety != null && marginOfSafety >= mosNeedAdj) {
        actionHint = `具备该类所需保守安全边际（门槛≈${mosNeedAdj.toFixed(0)}%），可考虑分批`
      } else if (marginOfSafety != null && marginOfSafety < -15) {
        actionHint = '偏贵：好公司≠好价格（缺PB，按保守PE）'
      } else if (marginOfSafety != null && marginOfSafety >= 5) {
        actionHint = '略便宜：宜定投，未到重仓线'
      } else {
        actionHint = '缺PB数据：观望，不作折价幻觉'
      }
    } else {
      const disc = ((justified - pb) / justified) * 100
      const kind =
        archetype === 'bank'
          ? '银行'
          : archetype === 'insurance'
            ? '保险'
            : archetype === 'broker'
              ? '券商'
              : '地产'
      if (disc >= 25 && (marginOfSafety == null || marginOfSafety < mosNeedAdj)) {
        actionHint = `PB已显著折价（约${disc.toFixed(0)}%），未达${kind}重仓线（需MoS≥${mosNeedAdj.toFixed(0)}%）`
      } else if (disc >= 10) {
        actionHint = `PB合理偏下：可小仓/定投，${kind}要求更大折扣`
      } else if (disc >= -10) {
        actionHint = 'PB大致公允：观望为主'
      } else {
        actionHint = '偏贵：好公司≠好价格（相对合理PB溢价）'
      }
    }
  } else if (archetype === 'platform' && bands.platformMeta && !bands.platformMeta.hard) {
    const { pe: pPe, fairPe } = bands.platformMeta
    const disc = fairPe > 0 ? ((fairPe - pPe) / fairPe) * 100 : 0
    if (disc >= 20 && (marginOfSafety == null || marginOfSafety < mosNeedAdj)) {
      actionHint = `PE已偏低，未达平台重仓线（需MoS≥${mosNeedAdj.toFixed(0)}%）`
    } else if (disc >= 5) {
      actionHint = 'PE合理偏下：小仓观察，平台要能力圈确认'
    } else if (disc >= -15) {
      actionHint = 'PE大致公允：观望为主'
    } else {
      actionHint = '偏贵：好公司≠好价格（相对保守公允PE溢价）'
    }
  } else if (archetype === 'biotech' && bands.biotechMeta && !bands.biotechMeta.hard) {
    const { pe: pPe, fairPe, tier } = bands.biotechMeta
    const disc = fairPe > 0 ? ((fairPe - pPe) / fairPe) * 100 : 0
    if (disc >= 20 && (marginOfSafety == null || marginOfSafety < mosNeedAdj)) {
      actionHint = `PE已偏低，未达医药重仓线（需MoS≥${mosNeedAdj.toFixed(0)}%，${tier}）`
    } else if (disc >= 5) {
      actionHint = `PE合理偏下：小仓观察（${tier}仍要管线/订单逆向）`
    } else if (disc >= -15) {
      actionHint = 'PE大致公允：观望为主'
    } else {
      actionHint = '偏贵：好公司≠好价格（相对医药公允PE溢价）'
    }
  } else if (verdict.label.includes('偏高') || (marginOfSafety != null && marginOfSafety < -15)) {
    actionHint = '偏贵：好公司≠好价格'
  } else if (/偏低|偏下/.test(verdict.label) && marginOfSafety != null && marginOfSafety >= 5) {
    actionHint = '略便宜：宜定投，未到重仓线'
  } else if (verdict.label === '估值合理') {
    actionHint = '价格大致公允'
  }

  details.push(`操作提示: ${actionHint}`)
  details.push(`主锚:${primaryAnchor} · 置信:${mosConfidence}`)

  // Low confidence first: pin toward price — then hard-cap so we never claim −40% and show −18%
  let displayIV = intrinsicValue
  if (mosConfidence === 'low' && price > 0 && intrinsicValue > 0) {
    const soft = price * 0.55 + intrinsicValue * 0.45
    if (Math.abs(soft - price) < Math.abs(intrinsicValue - price)) {
      displayIV = soft
      marginOfSafety = ((displayIV - price) / price) * 100
      details.push('低置信：目标价向现价收敛，避免假精度')
    }
  }

  // Absolute last: hard MoS cap (must run after soft converge)
  if (marginOfSafety != null && Math.abs(marginOfSafety) > 40 && price > 0) {
    const cap = marginOfSafety > 0 ? 0.35 : -0.4
    displayIV = price * (1 + cap)
    intrinsicValue = displayIV
    marginOfSafety = cap * 100
    details.push(`最终克制: MoS封顶至${(cap * 100).toFixed(0)}%`)
    mosConfidence = 'low'
  }

  // Final label sync: after MoS clamps / low-confidence soft converge, labels must match
  // the MoS we actually show (fixes 显著偏高 + MoS仅-17% 这类冲突).
  if (marginOfSafety != null) {
    if (/显著偏高/.test(verdict.label) && marginOfSafety > -28) {
      verdict = { label: '合理偏上', tone: 'warn', percentile: 72 }
      details.push(`标签同步: 展示MoS=${marginOfSafety.toFixed(0)}% → ${verdict.label}`)
    } else if (/显著偏低/.test(verdict.label) && marginOfSafety < 8) {
      verdict = {
        label: marginOfSafety >= 0 ? '合理偏下' : '估值合理',
        tone: marginOfSafety >= 0 ? 'good' : 'info',
        percentile: marginOfSafety >= 0 ? 35 : 50,
      }
      details.push(`标签同步: 展示MoS=${marginOfSafety.toFixed(0)}% → ${verdict.label}`)
    } else if (/显著偏低/.test(verdict.label) && marginOfSafety < 20) {
      // Mild positive MoS ≠「显著偏低」— reserve that for deep discount
      verdict = { label: '合理偏下', tone: 'good', percentile: 35 }
      details.push(`标签同步: 展示MoS仅${marginOfSafety.toFixed(0)}% → ${verdict.label}`)
    }
  }

  const secondaryUi = (anglesResolved.secondary || []).map((s) => ({
    paradigmId: s.paradigmId,
    paradigmName: s.paradigmName,
    archetype: s.archetype,
    weight: s.weight,
    reason: s.reason,
  }))

  const inputsUsed = Array.isArray(meta.inputs) ? [...meta.inputs] : []
  const assumptions = Array.isArray(meta.assumptions) ? [...meta.assumptions] : []
  const doesNotDo = Array.isArray(meta.doesNotDo)
    ? [...meta.doesNotDo]
    : meta.doesNotDo
      ? [meta.doesNotDo]
      : []
  const failureModes = Array.isArray(meta.failureModes) ? [...meta.failureModes] : []
  const asOf =
    fin.asOf ||
    fin.quoteAsOf ||
    fin.financialAsOf ||
    fin.updatedAt ||
    fin.dataAsOf ||
    null

  // Investor lenses (Vibe-Trading subset): after bands/ensemble — never average verdicts
  const valuationSnapshot = {
    marginOfSafety: marginOfSafety == null ? null : Math.round(marginOfSafety * 10) / 10,
    quality: quality.quality,
    qualityScore: quality.score,
    moat: quality.moat || null,
    pe,
    peLow,
    peHigh,
    pePercentile: verdict.percentile == null ? null : Math.round(verdict.percentile),
    verdict: verdict.label,
    competence: meta.competenceDefault,
    price,
    currentEPS: Math.round(eps * 100) / 100,
    archetype,
    archetypeId: archetype,
    invertRisks: risks,
  }
  const lensStack = runLensStack({
    archetypeId: archetype,
    styleTags: anglesResolved.style || [],
    financials: fin,
    valuationResult: valuationSnapshot,
    industry,
  })
  if (lensStack.disagreement) {
    details.push(
      `透镜分歧: ${lensStack.disagreementRoot || '—'}${lensStack.losingStrongestPoint ? ' · 弱势侧要点: ' + lensStack.losingStrongestPoint : ''}`,
    )
  } else if (lensStack.lenses?.length) {
    details.push(
      `投资者透镜: ${lensStack.lenses.map((l) => `${l.nameZh}→${l.verdict}`).join('；')}`,
    )
  }

  return {
    intrinsicValue: Math.round(displayIV * 100) / 100,
    ivBear: Math.round(ivBear * 100) / 100,
    ivBase: Math.round(ivBase * 100) / 100,
    ivBull: Math.round(ivBull * 100) / 100,
    currentEPS: Math.round(eps * 100) / 100,
    epsSource: earned.source,
    epsQuality: earned.quality,
    industry,
    archetype,
    archetypeId: archetype,
    archetypeLabel: meta.label,
    method: meta.method,
    methodVersion: `v1-${archetype}`,
    inputsUsed,
    assumptions,
    doesNotDo,
    failureModes,
    asOf,
    quoteSource: fin.quoteSource || fin.source || null,
    valuability,
    structureOnly: valuability !== 'full',
    paradigmId: paradigm.id,
    paradigmName: paradigm.name,
    paradigmDesc: paradigm.desc,
    paradigmWhen: paradigm.when,
    paradigmFamily: paradigm.family,
    primary: {
      paradigmId: anglesResolved.primary.paradigmId,
      paradigmName: anglesResolved.primary.paradigmName || paradigm.name,
      archetype,
      reason: anglesResolved.primary.reason,
    },
    secondary: secondaryUi,
    ensemble,
    angles: anglesResolved.angles || [],
    style: anglesResolved.style || [],
    thinking: anglesResolved.thinking || [],
    overrideApplied: !!anglesResolved.overrideApplied,
    overrideThinkingOnly: !!anglesResolved.overrideThinkingOnly,
    quality: quality.quality,
    qualityScore: quality.score,
    moat: quality.moat || null,
    invertRisks: risks,
    competence: meta.competenceDefault,
    modelName: meta.method,
    modelDesc: `${meta.label} | ${meta.method}`,
    industryModel: model.model,
    details,
    marginOfSafety: marginOfSafety == null ? null : Math.round(marginOfSafety * 10) / 10,
    mosBuyMin: Math.round(mosNeedAdj),
    pe,
    peLow,
    peHigh,
    pePercentile: verdict.percentile == null ? null : Math.round(verdict.percentile),
    verdict: verdict.label,
    verdictTone: verdict.tone,
    mosConfidence,
    primaryAnchor,
    actionHint,
    price,
    lensStack,
  }
}

export function getValuationRange(fin, code, name) {
  const industry = getIndustry(code, name)
  const earned = resolveEarnings(fin, code)
  const eps = earned.eps || 0
  const bvps = fin.bvps || 0
  const roe = fin.roe || 0
  const price = fin.price || 0
  const custom = PE_RANGES[industry]
  let peLow
  let peHigh
  let pbLow
  let pbHigh
  if (custom && custom.pe) {
    peLow = custom.pe[0]
    peHigh = custom.pe[1]
  } else {
    const model = INDUSTRY_MODELS[industry] || INDUSTRY_MODELS['其他']
    const basePE = 1 / model.dr
    peLow = Math.round(basePE * 0.6)
    peHigh = Math.round(basePE * 1.8)
  }
  if (eps > 0) {
    if (!pbLow) {
      pbLow = Math.round(((peLow * roe) / 100) * 10) / 10
      pbHigh = Math.round(((peHigh * roe) / 100) * 10) / 10
    }
    if (pbLow < 0.3) pbLow = 0.3
    if (pbHigh < 1) pbHigh = 1
    if (custom && custom.pb) {
      pbLow = custom.pb[0]
      pbHigh = custom.pb[1]
    }
    const currentPE = price / eps
    const pePosition = ((currentPE - peLow) / (peHigh - peLow)) * 100
    const peSignal = pePosition < 20 ? '低' : pePosition > 80 ? '高' : '中'
    const currentPB = price / bvps
    const pbPosition = bvps > 0 ? ((currentPB - pbLow) / (pbHigh - pbLow)) * 100 : -1
    const pbSignal = pbPosition < 0 ? '—' : pbPosition < 20 ? '低' : pbPosition > 80 ? '高' : '中'
    return {
      industry,
      eps,
      price,
      peRange: [peLow, peHigh],
      currentPE: Math.round(currentPE * 10) / 10,
      pePosition: Math.max(0, Math.min(100, pePosition)),
      peSignal,
      pbRange: [pbLow, pbHigh],
      currentPB: Math.round(currentPB * 10) / 10,
      pbPosition: pbPosition < 0 ? -1 : Math.max(0, Math.min(100, pbPosition)),
      pbSignal,
    }
  }
  if (!pbLow) {
    pbLow = 0.5
    pbHigh = 3
  }
  if (custom && custom.pb) {
    pbLow = custom.pb[0]
    pbHigh = custom.pb[1]
  }
  const currentPB = bvps > 0 ? price / bvps : -1
  const pbPosition = currentPB > 0 ? ((currentPB - pbLow) / (pbHigh - pbLow)) * 100 : -1
  return {
    industry,
    eps,
    price,
    peRange: [peLow, peHigh],
    currentPE: -1,
    pePosition: -1,
    peSignal: '—',
    pbRange: [pbLow, pbHigh],
    currentPB: Math.round(currentPB * 10) / 10,
    pbPosition: pbPosition < 0 ? -1 : Math.max(0, Math.min(100, pbPosition)),
    pbSignal: pbPosition < 0 ? '—' : pbPosition < 20 ? '低' : pbPosition > 80 ? '高' : '中',
  }
}
