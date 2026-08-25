/**
 * Research-desk analytics distilled from:
 * - longbridge-value-investing (勾稽校验, Graham 六维, Buffett 五维)
 * - buffett skill refs 05/06/07 (owner earnings, MOS tiers, four sell tests)
 * - buffett-letters: aesop, margin-of-safety, look-through, $1 test, cigar vs great
 *
 * Outputs are reviewable facts for a holding — never a buy/sell ticket.
 */

const FINANCIAL = new Set(['bank', 'insurance', 'broker'])

/** Buffett 2000 / skill 06: required discount rises with uncertainty. */
export const MOS_TIER = {
  high: { id: 'high', need: 25, label: '高确定性', band: '20–30%' },
  medium: { id: 'medium', need: 35, label: '一般优秀', band: '30–40%' },
  low: { id: 'low', need: 45, label: '有不确定因素', band: '40–50%' },
  unestimable: { id: 'unestimable', need: 99, label: '无法可靠估计', band: '不估' },
}

function n(v) {
  const x = Number(v)
  return Number.isFinite(x) ? x : null
}

function round(v, d = 2) {
  if (v == null || !Number.isFinite(v)) return null
  const p = 10 ** d
  return Math.round(v * p) / p
}

function pctGap(a, b) {
  if (a == null || b == null) return null
  const den = Math.max(Math.abs(a), Math.abs(b), 1e-9)
  return ((a - b) / den) * 100
}

function check(id, label, a, b, tol, unit = '') {
  if (a == null || b == null) {
    return { id, label, a, b, gap: null, tol, unit, status: 'missing' }
  }
  const gap = pctGap(a, b)
  const abs = Math.abs(gap)
  const status = abs <= tol ? 'pass' : abs <= tol * 2 ? 'warn' : 'fail'
  return { id, label, a: round(a, 4), b: round(b, 4), gap: round(gap, 1), tol, unit, status }
}

/**
 * Cross-statement identity checks (Longbridge 勾稽). Missing fields are skipped, not failed.
 */
export function reconcileStatements(fin = {}, earned = {}) {
  const price = n(fin.price)
  const pe = n(fin.pe_ttm)
  const eps = n(earned.eps) ?? n(fin.eps)
  const pb = n(fin.pb)
  const bvps = n(fin.bvps)
  const roe = n(fin.roe)
  const ocf = n(fin.ocf)
  const capex = n(fin.capex)
  const fcf = n(fin.fcf)
  const fcfps = n(fin.fcfPerShare)
  const oe = n(fin.ownerEarnings)
  const profit = n(fin.profit)
  const mv = n(fin.total_mv)

  const checks = []
  if (price > 0 && pe > 0 && eps != null && Math.abs(eps) > 0) {
    checks.push(check('pe_identity', '价格÷PE ≈ 估值EPS', eps, price / pe, 8, '元/股'))
  }
  if (price > 0 && pb > 0 && bvps > 0) {
    checks.push(check('pb_identity', '价格÷PB ≈ BVPS', bvps, price / pb, 10, '元/股'))
  }
  if (eps > 0 && bvps > 0 && roe > 0) {
    const impliedRoe = (eps / bvps) * 100
    // Quarterly ROE in the dump is common — wide tolerance, warn not halt
    checks.push(check('roe_identity', 'EPS/BVPS ≈ 报表ROE', impliedRoe, roe, 6, 'pp'))
  }
  if (ocf != null && capex != null && fcf != null) {
    checks.push(check('fcf_identity', '经营现金流−资本开支 ≈ FCF', ocf - capex, fcf, 5, '亿'))
  }
  if (fcf != null && price > 0 && mv > 0 && fcfps != null) {
    const sharesYi = mv / price
    if (sharesYi > 0) {
      checks.push(check('fcfps_identity', 'FCF/股本 ≈ FCF/股', fcf / sharesYi, fcfps, 8, '元/股'))
    }
  }
  if (oe != null && fcfps != null && Math.abs(fcfps) > 0) {
    checks.push(check('oe_vs_fcf', '所有者盈余/股 ≈ FCF/股', oe, fcfps, 8, '元/股'))
  }
  if (ocf != null && profit != null && Math.abs(profit) > 0.05) {
    // Both typically 亿元. Conversion is a ratio, compared as percent of 1.0
    const conv = ocf / profit
    checks.push({
      id: 'cash_conversion',
      label: '经营现金流/净利润（现金转化）',
      a: round(ocf, 2),
      b: round(profit, 2),
      gap: round((conv - 1) * 100, 1),
      ratio: round(conv, 2),
      tol: 30,
      unit: '亿',
      // Quality signal, not a three-statement identity. Liquor/channel WC often lags profit.
      status: conv >= 0.7 ? 'pass' : 'warn',
    })
  }

  const scored = checks.filter((c) => c.status !== 'missing')
  const fails = scored.filter((c) => c.status === 'fail')
  const warns = scored.filter((c) => c.status === 'warn')
  const pass = fails.length === 0
  const halt = fails.some((c) => c.id === 'pe_identity' || c.id === 'fcf_identity')
  let summary
  if (!scored.length) summary = '勾稽：可用科目不足，未做三表核对'
  else if (pass && !warns.length) summary = `勾稽通过（${scored.length}项，容差内）`
  else if (pass) summary = `勾稽通过，有残差：${warns.map((c) => `${c.label} ${c.gap}%`).join('；')}`
  else summary = `勾稽失败：${fails.map((c) => `${c.label} 差${c.gap}%`).join('；')}`

  return { checks: scored, pass, halt, failCount: fails.length, warnCount: warns.length, summary }
}

export function cashConversion(fin = {}) {
  const ocf = n(fin.ocf)
  const profit = n(fin.profit)
  if (ocf == null || profit == null || Math.abs(profit) < 0.05) return null
  return round(ocf / profit, 2)
}

export function pickMosTier({
  quality,
  competence,
  reconHalt,
  sparseCash,
  hard,
  peakCycle,
} = {}) {
  if (hard || competence === 'hard' || reconHalt) return MOS_TIER.unestimable
  if (peakCycle) return MOS_TIER.low
  if (quality === 'wonderful' && !sparseCash) return MOS_TIER.high
  if (quality === 'wonderful' && sparseCash) return MOS_TIER.medium
  if (quality === 'good') return MOS_TIER.medium
  return MOS_TIER.low
}

function starClamp(x) {
  return Math.max(1, Math.min(5, Math.round(x)))
}

export function buffettFiveDimensions({
  fin = {},
  quality,
  moat,
  mosModel,
  mosNeed,
  competence,
  archetype,
} = {}) {
  const roe = n(quality?.roeUsed) ?? n(fin.roe) ?? 0
  const conv = cashConversion(fin)
  const debt = n(fin.debtRatio) ?? 0
  const gm = n(fin.grossMargin) ?? 0
  const mgmt = n(fin.managementScore)
  const g = n(fin.profitGrowth)

  const moatScore = n(moat?.score) ?? 0
  const moatStars = starClamp(1 + moatScore / 2.2)

  let finPts = 1
  if (roe >= 15) finPts += 1.5
  else if (roe >= 10) finPts += 1
  else if (roe >= 6) finPts += 0.4
  if (conv != null && conv >= 0.9) finPts += 1.2
  else if (conv != null && conv >= 0.7) finPts += 0.5
  else if (conv != null && conv < 0.5) finPts -= 0.8
  if (!FINANCIAL.has(archetype) && debt < 50) finPts += 0.6
  else if (!FINANCIAL.has(archetype) && debt > 70) finPts -= 0.8
  if (gm >= 40) finPts += 0.4
  const financialStars = starClamp(finPts)

  let mgmtStars = 3
  if (mgmt != null) {
    if (mgmt >= 3) mgmtStars = 4
    else if (mgmt <= -2) mgmtStars = 1
    else if (mgmt <= 0) mgmtStars = 2
  } else {
    mgmtStars = 2
  }

  let valStars = 2
  if (mosModel == null || !(mosNeed > 0) || mosNeed >= 90) valStars = 2
  else if (mosModel >= mosNeed) valStars = 5
  else if (mosModel >= mosNeed * 0.5) valStars = 4
  else if (mosModel >= 0) valStars = 3
  else if (mosModel > -mosNeed) valStars = 2
  else valStars = 1

  let visStars = 3
  if (competence === 'hard') visStars = 1
  else if (archetype === 'cyclical' && g != null && g >= 40) visStars = 2
  else if (g != null && g < -25 && archetype !== 'cyclical') visStars = 2
  else if (quality?.quality === 'wonderful') visStars = 4
  else if (archetype === 'biotech' || archetype === 'platform') visStars = 2

  const dims = [
    {
      id: 'moat',
      name: '生意与护城河',
      stars: moatStars,
      evidence: (moat?.evidence || []).slice(0, 3).join('；') || '缺多年序列，仅用利润率/模式先验',
    },
    {
      id: 'financial',
      name: '财务健康',
      stars: financialStars,
      evidence: [
        roe ? `ROE ${round(roe, 1)}%` : null,
        conv != null ? `现金转化 ${conv}` : '缺OCF',
        debt ? `负债率 ${debt}%` : null,
      ]
        .filter(Boolean)
        .join(' · '),
    },
    {
      id: 'management',
      name: '管理层与资本配置',
      stars: mgmtStars,
      evidence:
        mgmt != null
          ? `管理层评分 ${mgmt}${(fin.managementNotes || []).slice(0, 1).join('') ? ' · ' + fin.managementNotes[0] : ''}`
          : '缺减持/回购/分红时间序列，按中性处理',
    },
    {
      id: 'valuation',
      name: '价格与安全边际',
      stars: valStars,
      evidence:
        mosModel == null
          ? '无价格或无模型IV'
          : `模型MoS ${round(mosModel, 1)}% · 要求 ${mosNeed}%`,
    },
    {
      id: 'visibility',
      name: '长期可见度',
      stars: visStars,
      evidence:
        competence === 'hard'
          ? '能力圈外：不假装十年可预见'
          : g != null
            ? `报表利润增速 ${g}%（单年，不是十年）`
            : '缺增速',
    },
  ]
  const avg = dims.reduce((s, d) => s + d.stars, 0) / dims.length
  const overall = starClamp(avg)
  const holdYears =
    moatStars >= 5 ? '5年+（理想永不）' : moatStars >= 4 ? '3–5年' : moatStars >= 3 ? '1–3年' : '不是巴菲特性候选（可改用格雷厄姆口径复核）'
  const fork =
    overall >= 4 && valStars <= 2
      ? 'great_wait'
      : overall <= 2 && (mosModel != null && mosModel >= 15)
        ? 'cheap_no_moat'
        : 'neither'
  return { dims, overall, holdYears, fork, avg: round(avg, 2) }
}

export function grahamStaticScore(fin = {}, archetype) {
  if (FINANCIAL.has(archetype) || archetype === 'real_estate') {
    return {
      applicable: false,
      reason: 'NCAV/烟蒂模型不适用于银行、保险、券商、地产',
      score: null,
      dims: [],
    }
  }
  const pe = n(fin.pe_ttm)
  const pb = n(fin.pb)
  const dy = n(fin.dividendYield) || 0
  const debt = n(fin.debtRatio)
  const eps = n(fin.eps)
  const g = n(fin.profitGrowth)
  const ocf = n(fin.ocf)
  const currentAssets = n(fin.currentAssets)
  const totalLiab = n(fin.totalLiabilities) ?? n(fin.liabilities)
  const mv = n(fin.total_mv)
  const price = n(fin.price)

  const dims = []
  let pts = 0
  let max = 0

  if (currentAssets != null && totalLiab != null && mv > 0) {
    max += 25
    const ncav = currentAssets - totalLiab
    const ratio = mv / Math.max(ncav, 0.01)
    const part = ratio <= 0.67 ? 25 : ratio <= 1 ? 16 : ratio <= 1.5 ? 8 : 0
    pts += part
    dims.push({ id: 'ncav', label: 'NCAV', pts: part, max: 25, note: `市值/净流动资产≈${round(ratio, 2)}` })
  } else {
    dims.push({ id: 'ncav', label: 'NCAV', pts: null, max: 25, note: '缺流动资产/负债科目，跳过（不编造清算值）' })
  }

  max += 20
  if (pe != null && pe > 0) {
    const part = pe < 8 ? 20 : pe < 12 ? 14 : pe < 15 ? 8 : 0
    pts += part
    dims.push({ id: 'pe', label: 'PE', pts: part, max: 20, note: `${round(pe, 1)}x（防御型投资者<15）` })
  } else {
    dims.push({ id: 'pe', label: 'PE', pts: 0, max: 20, note: '无正PE' })
  }

  max += 15
  if (pb != null && pb > 0) {
    const part = pb < 1 ? 15 : pb < 1.5 ? 10 : pb < 2.5 ? 5 : 0
    pts += part
    dims.push({ id: 'pb', label: 'PB', pts: part, max: 15, note: `${round(pb, 2)}x` })
  } else {
    dims.push({ id: 'pb', label: 'PB', pts: 0, max: 15, note: '缺PB' })
  }

  max += 15
  const divPart = dy >= 4 ? 15 : dy >= 3 ? 10 : dy >= 1.5 ? 5 : 0
  pts += divPart
  dims.push({ id: 'dividend', label: '股息', pts: divPart, max: 15, note: `${round(dy, 2)}%（等待成本补偿）` })

  max += 15
  if (debt != null) {
    const part = debt < 40 ? 15 : debt < 55 ? 8 : 0
    pts += part
    dims.push({ id: 'debt', label: '负债覆盖', pts: part, max: 15, note: `资产负债率 ${debt}%` })
  } else {
    dims.push({ id: 'debt', label: '负债覆盖', pts: 0, max: 15, note: '缺负债率' })
  }

  max += 10
  const stable = eps > 0 && (g == null || g > -15)
  const stabPart = stable ? 10 : 0
  pts += stabPart
  dims.push({
    id: 'stability',
    label: '盈利稳定',
    pts: stabPart,
    max: 10,
    note: eps > 0 ? `EPS>0 · 增速${g ?? '—'}%` : '无正EPS',
  })

  const score = max > 0 ? Math.round((pts / max) * 100) : null

  const traps = []
  if (ocf != null && ocf < 0) traps.push('经营现金流为负')
  if (g != null && g < -30) traps.push('利润大幅下滑')
  if (debt != null && debt > 70) traps.push('负债率>70%')
  if (pe != null && pe > 0 && pe < 8 && (ocf == null || ocf < 0)) traps.push('低PE但现金弱（价值陷阱嫌疑）')
  const mgmt = n(fin.managementScore)
  if (mgmt != null && mgmt <= -2) traps.push('管理层减持等负面信号')
  const trap = traps.length >= 2

  let ncavLine = null
  if (currentAssets != null && totalLiab != null && price > 0 && mv > 0) {
    const sharesYi = mv / price
    const ncavPs = sharesYi > 0 ? (currentAssets - totalLiab) / sharesYi : null
    if (ncavPs != null) {
      ncavLine = {
        ncavPerShare: round(ncavPs, 2),
        grahamBuy: round(ncavPs * 0.67, 2),
      }
    }
  }

  return {
    applicable: true,
    score,
    pts,
    max,
    dims,
    traps,
    trap,
    ncavLine,
    holdingHint: trap ? '价值陷阱嫌疑：NCAV若在缩，格雷厄姆口径应退出等待' : '烟蒂是耐心套利，不是抄底信号',
  }
}

export function aesopThreeQuestions({ fin = {}, earned = {}, oe = {}, modelDr, quality } = {}) {
  const conv = cashConversion(fin)
  const g = n(fin.profitGrowth)
  const source = earned.source || 'unknown'
  const certain =
    conv != null && conv >= 0.9 && source !== 'pe_implied'
      ? '高'
      : conv != null && conv >= 0.7
        ? '中'
        : source === 'pe_implied' || source === 'eps_proxy'
          ? '低'
          : conv == null
            ? '未知（缺现金流）'
            : '低'
  const gHair = g == null ? null : Math.max(-5, Math.min(12, g * 0.7))
  const birds =
    oe.oe > 0
      ? `近端所有者盈余约 ¥${round(oe.oe, 2)}/股（来源 ${oe.source || '—'}）`
      : earned.eps > 0
        ? `仅有报表EPS ¥${round(earned.eps, 2)}/股，未独立核实维保资本开支`
        : '灌木丛里还看不到鸟（无正盈余）'
  const when =
    gHair == null
      ? '未给出增速，不当永续高增'
      : `报表增速 ${g}% 已按均值回归折到约 ${round(gHair, 1)}%，不作峰值外推`
  const rf = modelDr != null ? `${round(modelDr * 100, 1)}%（行业模型折现，不是无风险利率本身）` : '未给折现率'
  return {
    certain,
    birds,
    when,
    rf,
    line: `确定性${certain}。${birds}。${when}。折现参考：${rf}。质量先验 ${quality || '—'}。`,
  }
}

export function oneDollarTest(fin = {}, quality) {
  const pe = n(fin.pe_ttm)
  const dy = (n(fin.dividendYield) || 0) / 100
  const roe = n(quality?.roeUsed) ?? n(fin.roe)
  const conv = cashConversion(fin)
  if (!(pe > 0) || !(roe > 0)) {
    return { status: 'unknown', ratio: null, payout: null, note: '缺PE或ROE，无法做留存$1测试' }
  }
  const earningsYield = 1 / pe
  const payout = earningsYield > 0 ? Math.max(0, Math.min(1.5, dy / earningsYield)) : null
  const retention = payout == null ? null : 1 - Math.min(1, payout)
  // Proxy: retained earnings earn at ROE. Pass if ROE comfortably above cost (~10%) and cash converts.
  let status = 'watch'
  const gm = n(fin.grossMargin)
  if (roe >= 15 && (conv == null || conv >= 0.7) && retention != null && retention > 0.2) status = 'pass'
  else if (roe < 8 && retention != null && retention > 0.5) status = 'fail'
  else if (conv != null && conv < 0.5 && !(gm >= 50)) status = 'fail'
  else if (conv != null && conv < 0.5 && gm >= 50) status = 'watch'
  const note =
    status === 'pass'
      ? `ROE ${round(roe, 1)}% 且现金转化尚可：留存更可能通过「每$1留存创造≥$1价值」的历史检验（仍是代理，不是多年市值增量）`
      : status === 'fail'
        ? `留存可疑：ROE ${round(roe, 1)}% / 现金转化 ${conv ?? '—'} / 分红率 ${payout == null ? '—' : round(payout * 100, 0) + '%'}`
        : conv != null && conv < 0.7 && gm >= 50
          ? `高毛利但当年OCF滞后（转化 ${conv}）：渠道/存货压货常见，不能单年判留存失败。ROE ${round(roe, 1)}%`
          : `证据不够做硬结论。ROE ${round(roe, 1)}%，分红率 ${payout == null ? '—' : round(payout * 100, 0) + '%'}`
  return {
    status,
    roe: round(roe, 1),
    payout: payout == null ? null : round(payout, 2),
    retention: retention == null ? null : round(retention, 2),
    cashConversion: conv,
    note,
  }
}

export function holdReviewChecklist({ mosModel, mosNeed, quality, fin = {}, competence } = {}) {
  const g = n(fin.profitGrowth)
  const mgmt = n(fin.managementScore)
  const overvalued =
    mosModel != null && mosNeed < 90 && mosModel <= -Math.max(28, mosNeed)
      ? { verdict: 'yes', basis: `模型MoS ${round(mosModel, 0)}%，低于公允过深` }
      : mosModel != null && mosModel < -10
        ? { verdict: 'watch', basis: `相对保守IV偏贵（MoS ${round(mosModel, 0)}%），未必构成「严重高估」` }
        : { verdict: 'no', basis: mosModel == null ? '无MoS' : `MoS ${round(mosModel, 0)}%，未到严重高估线` }

  const moatBreak =
    g != null && g < -30 && quality === 'cigar'
      ? { verdict: 'watch', basis: '利润骤降且质量弱：需区分暂时困难与护城河永久性破坏' }
      : { verdict: 'unknown', basis: '缺多年护城河序列，单年增速不能当毁灭证据' }

  const integrity =
    mgmt != null && mgmt <= -2
      ? { verdict: 'yes', basis: '管理层评分显著为负（诚信问题在巴菲特框架里是立即复核项，不是自动下单）' }
      : { verdict: 'unknown', basis: '无足够公开诚信证据' }

  const betterOpp = {
    verdict: 'n/a',
    basis: '研究台只看这只持仓，不扫描全市场机会成本',
  }

  return {
    items: [
      { id: 'overvalued', label: '价格是否严重偏离保守内在价值？', ...overvalued },
      { id: 'moat', label: '护城河是否被结构性破坏？', ...moatBreak },
      { id: 'integrity', label: '管理层诚信是否出问题？', ...integrity },
      { id: 'opportunity', label: '是否存在明显更好的可理解机会？', ...betterOpp },
    ],
    doNotSellFor: ['股价跌了', '大盘跌了', '分析师下调', '宏观悲观预测'],
    competence,
  }
}

export function ownerEarningsBlock(fin = {}, oe = {}, eps) {
  const conv = cashConversion(fin)
  const raw = n(oe.rawFcf) ?? n(fin.fcfPerShare) ?? n(fin.ownerEarnings)
  const blended = n(oe.oe)
  const ebitdaTrap =
    conv != null && conv < 0.5
      ? '现金转化持续偏低：EBITDA/报表利润可能把维保资本开支当成「非现金」'
      : conv != null && conv >= 0.9
        ? '现金转化接近或高于利润：报表盈余较可信'
        : '维保 vs 扩张资本开支未单独披露，OE含估计'
  return {
    formula: '所有者盈余 ≈ 净利润 + 折旧摊销 − 维保资本开支 − 营运资本必要增加（此处用FCF/OCF代理）',
    eps: round(eps, 2),
    rawFcfPerShare: round(raw, 2),
    blendedOe: round(blended, 2),
    source: oe.source || 'none',
    sparseCash: !!oe.sparseCash,
    cashConversion: conv,
    ebitdaTrap,
  }
}

export function sourceAppendix(fin = {}, earned = {}, recon) {
  const rows = [
    { field: 'price', value: fin.price, source: fin.quoteSource || fin.source || 'financials', period: fin.quoteAsOf || fin.asOf || null },
    { field: 'eps', value: earned.eps, source: earned.source || fin.epsSource || 'financials', period: fin.financialAsOf || fin.asOf || null },
    { field: 'pe_ttm', value: fin.pe_ttm, source: 'financials', period: fin.asOf || null },
    { field: 'pb', value: fin.pb, source: 'financials', period: fin.asOf || null },
    { field: 'roe', value: fin.roe, source: 'financials', period: fin.asOf || null },
    { field: 'ocf', value: fin.ocf, source: fin.ocf != null ? 'financials' : 'missing', period: fin.asOf || null },
    { field: 'fcfPerShare', value: fin.fcfPerShare, source: fin.fcfPerShare != null ? 'financials' : 'missing', period: fin.asOf || null },
  ].filter((r) => r.value != null && r.value !== '')
  return { rows, reconSummary: recon?.summary || '未勾稽', asOf: fin.asOf || fin.quoteAsOf || null }
}

function stripTradeLanguage(hint) {
  if (!hint) return hint
  return String(hint)
    .replace(/可考虑分批/g, '出现可核验折扣（非下单指令）')
    .replace(/可持有\/定投（不是烟蒂式暴利）/g, '价格落在公允附近：用卖出四条复盘，不是加仓指令')
    .replace(/宜定投，未到重仓线/g, '略有折扣，未达该类门槛')
    .replace(/可小仓\/定投/g, '折价可见，未达重仓门槛')
    .replace(/小仓观察/g, '仅作观察，不是加仓')
}

export function deskPosture({ quality, mosModel, mosNeed, fork, reconHalt, competence } = {}) {
  if (competence === 'hard' || mosNeed >= 90) {
    return '能力圈外或无法可靠估计：不输出精确承诺，只列假设与缺口'
  }
  if (reconHalt) return '勾稽未过：先修数据，再谈安全边际'
  if (fork === 'great_wait') return '好生意、价格未给够折扣——等价格，不是等叙事'
  if (fork === 'cheap_no_moat') return '统计上便宜但护城河弱：烟蒂口径，不是特许经营口径'
  if (mosModel != null && mosNeed > 0 && mosModel >= mosNeed) {
    return `相对巴菲特确定性门槛（${mosNeed}%）出现可核验折扣。这是持仓研究结论，不是下单建议`
  }
  if (mosModel != null && mosModel < -15) {
    return quality === 'wonderful'
      ? '质量过关但价格偏贵：好公司≠好价格'
      : '相对保守IV偏贵，且质量并非wonderful'
  }
  return '价格大致落在模型附近：用假设清单逐季核对，而不是寻找点位神谕'
}

/**
 * Assemble the desk object attached to calculateValuation().
 */
export function buildValueDesk(ctx = {}) {
  const {
    fin = {},
    earned = {},
    oe = {},
    quality = {},
    archetype,
    competence,
    hard,
    valuability,
    ivModel,
    ivBear,
    price,
    mosDisplayed,
    mosNeedAdj,
    modelDr,
    peakCycle,
  } = ctx

  const recon = reconcileStatements(fin, earned)
  const sparseCash = !!oe.sparseCash
  const tier = pickMosTier({
    quality: quality.quality,
    competence,
    reconHalt: recon.halt,
    sparseCash,
    hard,
    peakCycle,
  })
  const mosNeed = Math.max(Math.round(mosNeedAdj || 0), tier.need)
  const mosModel =
    price > 0 && ivModel > 0 ? round(((ivModel - price) / price) * 100, 1) : null
  const mosVsBear =
    price > 0 && ivBear > 0 ? round(((ivBear - price) / ivBear) * 100, 1) : null

  const five = buffettFiveDimensions({
    fin,
    quality,
    moat: quality.moat,
    mosModel,
    mosNeed,
    competence,
    archetype,
  })
  const graham = grahamStaticScore(fin, archetype)
  const aesop = aesopThreeQuestions({ fin, earned, oe, modelDr, quality: quality.quality })
  const dollar = oneDollarTest(fin, quality)
  const hold = holdReviewChecklist({
    mosModel,
    mosNeed,
    quality: quality.quality,
    fin,
    competence,
  })
  const oeBlock = ownerEarningsBlock(fin, oe, earned.eps)
  const sources = sourceAppendix(fin, earned, recon)
  const posture = deskPosture({
    quality: quality.quality,
    mosModel,
    mosNeed,
    fork: five.fork,
    reconHalt: recon.halt,
    competence,
  })

  const assumptions = [
    `内在价值用熊/基加权，不把现价当锚（除非数据损坏）`,
    `安全边际门槛取巴菲特确定性档 ${tier.need}%（${tier.band}）与行业门槛的较高者 → ${mosNeed}%`,
    oeBlock.sparseCash
      ? '缺现金流：所有者盈余用EPS折损代理，置信下调'
      : `所有者盈余来源 ${oeBlock.source}；现金转化 ${oeBlock.cashConversion ?? '—'}`,
    '不做品牌叙事溢价，不加管线概率精算',
  ]

  return {
    recon,
    mosTier: tier,
    mosNeed,
    mosModel,
    mosVsBear,
    mosDisplayed: mosDisplayed == null ? null : round(mosDisplayed, 1),
    five,
    graham,
    aesop,
    dollar,
    hold,
    oe: oeBlock,
    sources,
    posture,
    fork: five.fork,
    assumptions,
    valuability: valuability || null,
    disclaimer: '研究台核对清单，不是投资建议。四条卖出条件用于复盘持仓，不是下单。',
  }
}

export { stripTradeLanguage }
