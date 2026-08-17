/**
 * Lightweight deterministic investor lenses (Vibe-Trading investor-lenses subset).
 * Analytical frameworks only — not named-person advice; never invent missing fields.
 */

const DISCLAIMER =
  '分析框架，非投资建议；结论仅在该透镜条件下成立，不可当作「某人会买/会卖」。'

/** @typedef {'pass'|'fail'|'missing'} SignalStatus */
/** @typedef {'triggered'|'not_triggered'|'unknown'} DisqStatus */
/** @typedef {'favorable'|'cautious'|'unfavorable'|'vetoed'|'inconclusive'} LensVerdict */

function num(v) {
  if (v == null || v === '' || Number.isNaN(Number(v))) return null
  return Number(v)
}

function has(v) {
  return num(v) != null
}

function sig(id, label, status, evidence) {
  return { id, label, status, evidence: evidence || (status === 'missing' ? 'missing' : '') }
}

function disq(id, label, status, evidence) {
  return { id, label, status, evidence: evidence || (status === 'unknown' ? 'missing' : '') }
}

/**
 * Pull a flat snapshot from FinDigest financials + valuation result.
 * Missing keys stay null — never invented.
 */
export function extractFacts(financials = {}, valuationResult = {}) {
  const f = financials || {}
  const v = valuationResult || {}
  const moat = v.moat || {}
  return {
    roe: num(f.roe),
    grossMargin: num(f.grossMargin),
    netMargin: num(f.netMargin),
    debtRatio: num(f.debtRatio),
    pe: num(f.pe_ttm) ?? num(v.pe),
    pb: num(f.pb),
    eps: num(f.eps) ?? num(v.currentEPS),
    bvps: num(f.bvps),
    fcf: num(f.fcf),
    fcfPerShare: num(f.fcfPerShare),
    ocf: num(f.ocf),
    ownerEarnings: num(f.ownerEarnings),
    profitGrowth: num(f.profitGrowth),
    revenueGrowth: num(f.revenueGrowth),
    dividendYield: num(f.dividendYield),
    price: num(f.price) ?? num(v.price),
    mos: num(v.marginOfSafety),
    quality: v.quality || null,
    qualityScore: num(v.qualityScore),
    moatScore: num(moat.score),
    moatEvidence: Array.isArray(moat.evidence) ? moat.evidence : [],
    competence: v.competence || null,
    pePercentile: num(v.pePercentile),
    verdictLabel: v.verdict || null,
    peLow: num(v.peLow),
    peHigh: num(v.peHigh),
    archetype: v.archetypeId || v.archetype || null,
  }
}

/** Lens registry — prioritySignals / hardDisqualifiers are ids evaluated in runLens */
export const LENS_REGISTRY = {
  buffett: {
    id: 'buffett',
    nameZh: '质量特许经营（巴菲特式程序）',
    optimizesFor: '十年后仍在的生意，用保守假设买到可接受结果；耐久性优先于增速与便宜。',
    archetypes: ['franchise_brand', 'utility_infra', 'capital_heavy'],
    prioritySignals: ['explainability', 'moat_named', 'roe_durable', 'cash_vs_earnings', 'mos_vs_conservative'],
    hardDisqualifiers: ['no_mos_optimistic_only', 'cash_persistently_below_earnings', 'narrowing_quality'],
    failureRegimes: ['快周期科技重置', '深度周期高峰盈利伪装特许经营', '用「好生意」为任意高价开脱'],
  },
  munger: {
    id: 'munger',
    nameZh: '逆向预演（芒格式程序）',
    optimizesFor: '避免永久性本金损失与可避免的愚蠢；输出否决路径而非买入信号。',
    archetypes: ['hard', 'biotech', 'platform', 'bank', 'insurance', 'franchise_brand', 'capital_heavy'],
    prioritySignals: ['thesis_falsifiable', 'leverage_risk', 'competence_gate', 'left_tail', 'bear_case_named'],
    hardDisqualifiers: ['unmonitorable_ruin', 'leverage_plus_exogenous', 'competence_hard_forced'],
    failureRegimes: ['单独当决策程序会一律否决', '把波动当成永久损失', '事后才做逆向'],
  },
  graham: {
    id: 'graham',
    nameZh: '统计深度价值（格雷厄姆式程序）',
    optimizesFor: '相对可核验资产价值支付显著折扣；拒绝对预测付费。',
    archetypes: ['cyclical', 'bank', 'insurance', 'broker', 'real_estate', 'capital_heavy'],
    prioritySignals: ['solvency', 'cheap_vs_book', 'earnings_stability_proxy', 'mos_quantified', 'not_forecast_driven'],
    hardDisqualifiers: ['refi_wall_leverage', 'asset_light_misapply', 'loss_year_proxy'],
    failureRegimes: ['轻资产复利生意', '单票当统计篮子', '价值陷阱当安全边际'],
  },
  marks: {
    id: 'marks',
    nameZh: '周期位置（马克斯式程序）',
    optimizesFor: '根据贪婪—恐惧温度校准激进度；读价格隐含预期，不做点位预测。',
    archetypes: ['cyclical', 'broker', 'real_estate', 'platform'],
    prioritySignals: ['second_level', 'cycle_proxy', 'price_implies', 'asymmetry', 'posture_not_timing'],
    hardDisqualifiers: ['timing_call', 'narrative_only_temp'],
    failureRegimes: ['当作择时扳机', '单票基本面误读成周期', '永久看空伪装成纪律'],
  },
  lynch: {
    id: 'lynch',
    nameZh: '分类GARP（林奇式程序）',
    optimizesFor: '先归类再估值；倍数须由可核对的增长兑现，而非故事标签。',
    archetypes: ['platform', 'franchise_brand', 'capital_heavy'],
    prioritySignals: ['category_assigned', 'peg_sanity', 'growth_funded_by_cash', 'two_minute_case'],
    hardDisqualifiers: ['category_ambiguous', 'peak_cycle_cheap_illusion', 'growth_by_leverage'],
    failureRegimes: ['金融与大宗商品', '主题标签当类别', '周期股用峰值盈利算便宜'],
  },
  chanos: {
    id: 'chanos',
    nameZh: '法证谨慎（查诺斯式程序）',
    optimizesFor: '识别报表利润与现金经济的裂缝；用作多头质量筛，而非下单做空。',
    archetypes: ['biotech', 'platform', 'hard', 'capital_heavy'],
    prioritySignals: ['cash_accrual_gap', 'structural_impairment_proxy', 'financing_dependence', 'valuation_is_sizing_only'],
    hardDisqualifiers: ['overvalued_only_thesis', 'no_mechanism'],
    failureRegimes: ['把成熟减速误当损伤', '会计稳健当欺诈', '确认偏误级联'],
  },
  duan: {
    id: 'duan',
    nameZh: '做对的生意（段永平式程序）',
    optimizesFor: '简单、真实需求、可信的人；默认否决，宁可错过。',
    archetypes: ['franchise_brand'],
    prioritySignals: ['demand_real_proxy', 'model_simple', 'self_funded_roc', 'concentrate_or_zero'],
    hardDisqualifiers: ['serial_dilution_proxy', 'complexity_opaque'],
    failureRegimes: ['无主事人的分散持股公司', '上市年限太短无法观察行为', '与巴菲特叠用几乎同向'],
  },
  fengliu: {
    id: 'fengliu',
    nameZh: '弱者体系（冯柳式程序）',
    optimizesFor: '承认无信息优势；买已知坏消息已充分定价的好生意地板。',
    archetypes: ['cyclical', 'franchise_brand', 'capital_heavy'],
    prioritySignals: ['admit_weakness', 'priced_pessimism', 'quality_floor', 'asymmetry_floor'],
    hardDisqualifiers: ['structural_decline_unknown', 'fragile_balance_sheet'],
    failureRegimes: ['动量行情', '未消化的新坏消息', '脆弱公司的下跌刀子'],
  },
  qiuguolu: {
    id: 'qiuguolu',
    nameZh: '三个问题（邱国鹭式程序）',
    optimizesFor: '好行业结构、好商业模式、好价格——缺一不可。',
    archetypes: ['franchise_brand', 'capital_heavy', 'cyclical', 'utility_infra'],
    prioritySignals: ['industry_structure_proxy', 'business_model_quality', 'price_ok'],
    hardDisqualifiers: ['bad_industry_structure', 'good_biz_bad_price'],
    failureRegimes: ['结构未成形的早期行业', '用叙事代替行业结构'],
  },
}

/** Default two-lens stacks by compute archetype (can disagree; never Buffett+Duan alone). */
export const ARCHETYPE_DEFAULT_LENSES = {
  franchise_brand: ['buffett', 'munger'],
  cyclical: ['marks', 'graham'],
  bank: ['graham', 'munger'],
  insurance: ['graham', 'munger'],
  broker: ['marks', 'graham'],
  biotech: ['munger', 'chanos'],
  platform: ['lynch', 'munger'],
  hard: ['munger', 'chanos'],
  capital_heavy: ['qiuguolu', 'munger'],
  real_estate: ['graham', 'munger'],
  utility_infra: ['buffett', 'graham'],
}

const STYLE_LENS_HINTS = {
  value: 'graham',
  deep_value: 'graham',
  quality: 'buffett',
  franchise: 'buffett',
  growth: 'lynch',
  garp: 'lynch',
  cycle: 'marks',
  cyclical: 'marks',
  contrarian: 'fengliu',
  forensic: 'chanos',
  short: 'chanos',
  inversion: 'munger',
  risk: 'munger',
  a_share: 'qiuguolu',
  structure: 'qiuguolu',
}

function normalizeStyleTags(styleTags) {
  if (!styleTags) return []
  const arr = Array.isArray(styleTags) ? styleTags : [styleTags]
  return arr
    .map((t) => String(t || '').toLowerCase().replace(/\s+/g, '_'))
    .filter(Boolean)
}

/**
 * Select 2 lenses that can disagree. Never >3. Never Buffett+Duan alone.
 * Archetype defaults win; styleTags only soft-nudge capital_heavy/hard/cyclical
 * or swap in forensic/contrarian/inversion as the second lens.
 * @returns {string[]}
 */
export function selectLenses(archetypeId, styleTags) {
  const arch = archetypeId && ARCHETYPE_DEFAULT_LENSES[archetypeId] ? archetypeId : 'hard'
  let picks = [...(ARCHETYPE_DEFAULT_LENSES[arch] || ARCHETYPE_DEFAULT_LENSES.hard)]

  const tags = normalizeStyleTags(styleTags)
  const softArch = arch === 'capital_heavy' || arch === 'hard' || arch === 'cyclical'
  for (const tag of tags) {
    const hint = STYLE_LENS_HINTS[tag]
    if (!hint || picks.includes(hint)) continue
    // Forensic / contrarian / inversion: strengthen disagreement as slot 2
    if (hint === 'chanos' || hint === 'fengliu' || hint === 'munger') {
      picks[1] = hint
      break
    }
    if (softArch) {
      picks[0] = hint
      break
    }
  }

  // Enforce disagreement: Buffett+Duan alone is decoration
  const set = new Set(picks.filter((id) => LENS_REGISTRY[id]))
  if (set.size === 2 && set.has('buffett') && set.has('duan')) {
    picks = ['buffett', 'munger']
  }

  // Cap at 2 for FinDigest UI (skill allows ≤3; product wants 2 cards)
  picks = [...new Set(picks)].filter((id) => LENS_REGISTRY[id]).slice(0, 2)
  if (picks.length < 2) {
    const fill = arch === 'hard' ? 'graham' : 'munger'
    if (!picks.includes(fill)) picks.push(fill)
    if (picks.length < 2 && !picks.includes('chanos')) picks.push('chanos')
  }
  return picks.slice(0, 2)
}

function evaluateSignal(signalId, facts, industry) {
  const {
    roe,
    grossMargin,
    debtRatio,
    pe,
    pb,
    eps,
    fcf,
    ocf,
    profitGrowth,
    revenueGrowth,
    mos,
    quality,
    qualityScore,
    moatScore,
    moatEvidence,
    competence,
    pePercentile,
    peLow,
    peHigh,
  } = facts

  switch (signalId) {
    case 'explainability': {
      // Archetype assigned + industry string → proxy for circle gate
      if (!facts.archetype && !industry) return sig(signalId, '商业模式可陈述', 'missing')
      const hard = competence === 'hard'
      return sig(
        signalId,
        '商业模式可陈述（能力圈代理）',
        hard ? 'fail' : 'pass',
        hard ? `competence=${competence}` : `archetype=${facts.archetype || '—'} · ${industry || '—'}`,
      )
    }
    case 'moat_named': {
      if (moatScore == null && !moatEvidence.length) return sig(signalId, '护城河机制有证据', 'missing')
      const ok = (moatScore != null && moatScore >= 5) || moatEvidence.length > 0
      return sig(
        signalId,
        '护城河机制有证据',
        ok ? 'pass' : 'fail',
        moatScore != null ? `moatScore=${moatScore}` : moatEvidence.slice(0, 2).join('；'),
      )
    }
    case 'roe_durable': {
      if (roe == null) return sig(signalId, 'ROE耐久性', 'missing')
      return sig(signalId, 'ROE耐久性', roe >= 12 ? 'pass' : roe >= 8 ? 'pass' : 'fail', `ROE=${roe}%`)
    }
    case 'cash_vs_earnings': {
      if (fcf == null && ocf == null) return sig(signalId, '现金相对利润', 'missing')
      const cash = fcf != null ? fcf : ocf
      const profit = num(facts.netMargin) // weak proxy if no absolute profit
      if (eps != null && eps > 0 && cash != null) {
        // fcf in 亿元 vs eps — directionally: negative FCF with positive eps is a yellow flag
        const ok = cash >= 0 || (profitGrowth != null && profitGrowth < -10)
        return sig(
          signalId,
          '现金相对利润',
          cash >= 0 ? 'pass' : 'fail',
          `FCF/OCF=${cash}${fcf != null ? '（FCF）' : '（OCF）'} · EPS=${eps}`,
        )
      }
      return sig(signalId, '现金相对利润', cash >= 0 ? 'pass' : 'fail', `cash=${cash}`)
    }
    case 'mos_vs_conservative': {
      if (mos == null) return sig(signalId, '相对保守价值的安全边际', 'missing')
      return sig(
        signalId,
        '相对保守价值的安全边际',
        mos >= 20 ? 'pass' : mos >= 0 ? 'fail' : 'fail',
        `MoS=${mos}%`,
      )
    }
    case 'thesis_falsifiable': {
      if (!facts.verdictLabel && mos == null) return sig(signalId, '论点可证伪', 'missing')
      return sig(
        signalId,
        '论点可证伪',
        'pass',
        `引擎结论「${facts.verdictLabel || '—'}」· MoS=${mos ?? 'missing'}%`,
      )
    }
    case 'leverage_risk': {
      if (debtRatio == null) return sig(signalId, '杠杆风险', 'missing')
      const finLike = ['bank', 'insurance', 'broker'].includes(facts.archetype)
      const thr = finLike ? 92 : 70
      return sig(
        signalId,
        '杠杆风险',
        debtRatio <= thr ? 'pass' : 'fail',
        `debtRatio=${debtRatio}%（阈值${thr}%）`,
      )
    }
    case 'competence_gate': {
      if (!competence) return sig(signalId, '能力圈门', 'missing')
      return sig(
        signalId,
        '能力圈门',
        competence === 'hard' ? 'fail' : 'pass',
        `competence=${competence}`,
      )
    }
    case 'left_tail': {
      if (mos == null && debtRatio == null) return sig(signalId, '左尾损失空间', 'missing')
      const badMos = mos != null && mos < -25
      const highDebt = debtRatio != null && debtRatio > 75 && !['bank', 'insurance'].includes(facts.archetype)
      return sig(
        signalId,
        '左尾损失空间',
        badMos || highDebt ? 'fail' : 'pass',
        `MoS=${mos ?? 'missing'}% · debt=${debtRatio ?? 'missing'}%`,
      )
    }
    case 'bear_case_named': {
      // Valuation invertRisks are attached later; presence of pe/mos is enough to force a bear frame
      if (pe == null && mos == null) return sig(signalId, '熊论据可陈述', 'missing')
      return sig(signalId, '熊论据可陈述', 'pass', '可用估值偏贵/周期高峰/现金裂缝陈述熊论据')
    }
    case 'solvency': {
      if (debtRatio == null && eps == null) return sig(signalId, '偿债/存活优先于便宜', 'missing')
      const okDebt = debtRatio == null || debtRatio < 80 || ['bank', 'insurance'].includes(facts.archetype)
      const okEps = eps == null || eps > 0
      return sig(
        signalId,
        '偿债/存活优先于便宜',
        okDebt && okEps ? 'pass' : 'fail',
        `debt=${debtRatio ?? 'missing'}% · eps=${eps ?? 'missing'}`,
      )
    }
    case 'cheap_vs_book': {
      if (pb == null) return sig(signalId, '相对账面便宜', 'missing')
      return sig(signalId, '相对账面便宜', pb <= 1.2 ? 'pass' : pb <= 2 ? 'fail' : 'fail', `PB=${pb}`)
    }
    case 'earnings_stability_proxy': {
      if (eps == null && profitGrowth == null) return sig(signalId, '盈利稳定性代理', 'missing')
      const ok = (eps == null || eps > 0) && (profitGrowth == null || profitGrowth > -30)
      return sig(
        signalId,
        '盈利稳定性代理',
        ok ? 'pass' : 'fail',
        `eps=${eps ?? 'missing'} · profitGrowth=${profitGrowth ?? 'missing'}%`,
      )
    }
    case 'mos_quantified': {
      if (mos == null) return sig(signalId, '安全边际可量化', 'missing')
      return sig(signalId, '安全边际可量化', mos >= 30 ? 'pass' : 'fail', `MoS=${mos}%`)
    }
    case 'not_forecast_driven': {
      // If MoS only looks good with high growth, we can't prove it — mark missing/fail gently
      if (profitGrowth == null && mos == null) return sig(signalId, '价值不依赖增长预测', 'missing')
      if (profitGrowth != null && profitGrowth > 40 && mos != null && mos > 0) {
        return sig(signalId, '价值不依赖增长预测', 'fail', `高增速${profitGrowth}%下才现折扣，需警惕`)
      }
      return sig(signalId, '价值不依赖增长预测', 'pass', `profitGrowth=${profitGrowth ?? 'missing'}%`)
    }
    case 'second_level': {
      if (pePercentile == null && pe == null) return sig(signalId, '二阶问题（定价了什么）', 'missing')
      return sig(
        signalId,
        '二阶问题（定价了什么）',
        'pass',
        `PE分位=${pePercentile ?? 'missing'}% · PE=${pe ?? 'missing'}`,
      )
    }
    case 'cycle_proxy': {
      if (profitGrowth == null && pePercentile == null) return sig(signalId, '周期温度代理', 'missing')
      let reading = 'neutral'
      if (profitGrowth != null && profitGrowth > 40) reading = 'optimism/euphoria-proxy'
      else if (profitGrowth != null && profitGrowth < -10) reading = 'pessimism-proxy'
      else if (pePercentile != null && pePercentile > 80) reading = 'optimism-proxy'
      else if (pePercentile != null && pePercentile < 25) reading = 'pessimism-proxy'
      return sig(signalId, '周期温度代理', 'pass', `reading=${reading}`)
    }
    case 'price_implies': {
      if (pe == null && peLow == null) return sig(signalId, '价格隐含预期', 'missing')
      return sig(
        signalId,
        '价格隐含预期',
        'pass',
        `现PE=${pe ?? 'missing'} vs 行业带 ${peLow ?? '—'}–${peHigh ?? '—'}`,
      )
    }
    case 'asymmetry': {
      if (mos == null) return sig(signalId, '对错不对称', 'missing')
      // Late-cycle cheapness on peak growth is hostile asymmetry
      const hostile = profitGrowth != null && profitGrowth > 35 && mos < 10
      return sig(signalId, '对错不对称', hostile ? 'fail' : 'pass', `MoS=${mos}% · g=${profitGrowth ?? 'missing'}%`)
    }
    case 'posture_not_timing': {
      return sig(signalId, '输出姿态而非择时', 'pass', '本引擎只给姿态代理，不含点位/日期')
    }
    case 'category_assigned': {
      if (!facts.archetype) return sig(signalId, '增长类别已指定', 'missing')
      return sig(signalId, '增长类别已指定', 'pass', `archetype=${facts.archetype}`)
    }
    case 'peg_sanity': {
      if (pe == null || profitGrowth == null || profitGrowth <= 0) return sig(signalId, 'PEG合理性', 'missing')
      const peg = pe / profitGrowth
      return sig(signalId, 'PEG合理性', peg <= 1.5 ? 'pass' : peg <= 2.5 ? 'fail' : 'fail', `PEG≈${peg.toFixed(2)}`)
    }
    case 'growth_funded_by_cash': {
      if (fcf == null && ocf == null) return sig(signalId, '增长由经营现金资助', 'missing')
      const cash = fcf != null ? fcf : ocf
      const leveragedGrowth = debtRatio != null && debtRatio > 65 && (revenueGrowth || 0) > 15 && cash < 0
      return sig(
        signalId,
        '增长由经营现金资助',
        leveragedGrowth ? 'fail' : cash >= 0 ? 'pass' : 'fail',
        `cash=${cash} · debt=${debtRatio ?? 'missing'}%`,
      )
    }
    case 'two_minute_case': {
      if (!facts.archetype || mos == null) return sig(signalId, '两分钟陈述', 'missing')
      return sig(signalId, '两分钟陈述', 'pass', '可用「类别+MoS+能力圈」压缩陈述')
    }
    case 'cash_accrual_gap': {
      if (fcf == null && ocf == null) return sig(signalId, '现金—应计裂缝', 'missing')
      const cash = fcf != null ? fcf : ocf
      const gap = eps != null && eps > 0 && cash < 0
      return sig(signalId, '现金—应计裂缝', gap ? 'fail' : 'pass', `cash=${cash} · eps=${eps ?? 'missing'}`)
    }
    case 'structural_impairment_proxy': {
      if (revenueGrowth == null && profitGrowth == null && qualityScore == null) {
        return sig(signalId, '结构损伤代理', 'missing')
      }
      const impaired =
        (revenueGrowth != null && revenueGrowth < -15 && profitGrowth != null && profitGrowth < -20) ||
        (qualityScore != null && qualityScore <= 3)
      return sig(
        signalId,
        '结构损伤代理',
        impaired ? 'fail' : 'pass',
        `revG=${revenueGrowth ?? 'missing'}% · profitG=${profitGrowth ?? 'missing'}% · q=${qualityScore ?? 'missing'}`,
      )
    }
    case 'financing_dependence': {
      if (fcf == null && debtRatio == null) return sig(signalId, '外部融资依赖', 'missing')
      const dep = (fcf != null && fcf < 0 && debtRatio != null && debtRatio > 60) || (fcf != null && fcf < 0 && eps != null && eps <= 0)
      return sig(signalId, '外部融资依赖', dep ? 'fail' : 'pass', `fcf=${fcf ?? 'missing'} · debt=${debtRatio ?? 'missing'}%`)
    }
    case 'valuation_is_sizing_only': {
      return sig(signalId, '估值仅用于规模而非论题', 'pass', '法证透镜不以「贵」代替机制')
    }
    case 'demand_real_proxy': {
      if (grossMargin == null && quality == null) return sig(signalId, '需求真实性代理', 'missing')
      const ok = (grossMargin != null && grossMargin >= 25) || quality === 'wonderful' || quality === 'good'
      return sig(signalId, '需求真实性代理', ok ? 'pass' : 'fail', `GM=${grossMargin ?? 'missing'}% · quality=${quality || 'missing'}`)
    }
    case 'model_simple': {
      if (!competence && !facts.archetype) return sig(signalId, '模式足够简单', 'missing')
      return sig(signalId, '模式足够简单', competence === 'hard' ? 'fail' : 'pass', `competence=${competence || 'missing'}`)
    }
    case 'self_funded_roc': {
      if (roe == null && fcf == null) return sig(signalId, '自我造血回报', 'missing')
      const ok = (roe != null && roe >= 12) && (fcf == null || fcf >= 0)
      return sig(signalId, '自我造血回报', ok ? 'pass' : 'fail', `ROE=${roe ?? 'missing'}% · fcf=${fcf ?? 'missing'}`)
    }
    case 'concentrate_or_zero': {
      if (quality == null && mos == null) return sig(signalId, '能进前三否则为零', 'missing')
      const ok = (quality === 'wonderful' || quality === 'good') && mos != null && mos >= 15
      return sig(signalId, '能进前三否则为零', ok ? 'pass' : 'fail', `quality=${quality || 'missing'} · MoS=${mos ?? 'missing'}%`)
    }
    case 'admit_weakness': {
      return sig(signalId, '显式承认信息弱势', 'pass', '弱者体系默认无信息优势')
    }
    case 'priced_pessimism': {
      if (pePercentile == null && mos == null) return sig(signalId, '悲观已定价', 'missing')
      const ok = (pePercentile != null && pePercentile <= 30) || (mos != null && mos >= 25)
      return sig(signalId, '悲观已定价', ok ? 'pass' : 'fail', `PE分位=${pePercentile ?? 'missing'}% · MoS=${mos ?? 'missing'}%`)
    }
    case 'quality_floor': {
      if (grossMargin == null && qualityScore == null && debtRatio == null) {
        return sig(signalId, '质量地板', 'missing')
      }
      const ok =
        (grossMargin == null || grossMargin >= 18) &&
        (qualityScore == null || qualityScore >= 5) &&
        (debtRatio == null || debtRatio < 75 || ['bank', 'insurance'].includes(facts.archetype))
      return sig(
        signalId,
        '质量地板',
        ok ? 'pass' : 'fail',
        `GM=${grossMargin ?? 'missing'}% · q=${qualityScore ?? 'missing'} · debt=${debtRatio ?? 'missing'}%`,
      )
    }
    case 'asymmetry_floor': {
      if (mos == null && pb == null) return sig(signalId, '下行有界不对称', 'missing')
      const ok = (mos != null && mos >= 20) || (pb != null && pb <= 1.5)
      return sig(signalId, '下行有界不对称', ok ? 'pass' : 'fail', `MoS=${mos ?? 'missing'}% · PB=${pb ?? 'missing'}`)
    }
    case 'industry_structure_proxy': {
      if (!facts.archetype && !industry) return sig(signalId, '行业结构代理', 'missing')
      const weak = facts.archetype === 'cyclical' || facts.archetype === 'hard'
      return sig(
        signalId,
        '行业结构代理',
        weak ? 'fail' : 'pass',
        `archetype=${facts.archetype || 'missing'} · ${industry || '—'}（周期/困难业态偏弱结构）`,
      )
    }
    case 'business_model_quality': {
      if (quality == null && roe == null) return sig(signalId, '商业模式质量', 'missing')
      const ok = quality === 'wonderful' || quality === 'good' || (roe != null && roe >= 12)
      return sig(signalId, '商业模式质量', ok ? 'pass' : 'fail', `quality=${quality || 'missing'} · ROE=${roe ?? 'missing'}%`)
    }
    case 'price_ok': {
      if (mos == null && pePercentile == null) return sig(signalId, '价格可接受', 'missing')
      const ok = (mos != null && mos >= 15) || (pePercentile != null && pePercentile <= 40)
      return sig(signalId, '价格可接受', ok ? 'pass' : 'fail', `MoS=${mos ?? 'missing'}% · PE分位=${pePercentile ?? 'missing'}%`)
    }
    default:
      return sig(signalId, signalId, 'missing')
  }
}

function evaluateDisqualifier(id, facts, signals) {
  const { mos, fcf, ocf, eps, debtRatio, competence, profitGrowth, pe, qualityScore, revenueGrowth, fcf: fcfVal } = facts
  const cash = fcf != null ? fcf : ocf

  switch (id) {
    case 'no_mos_optimistic_only': {
      if (mos == null) return disq(id, '仅乐观情形才覆盖价格', 'unknown')
      return disq(id, '仅乐观情形才覆盖价格', mos < 0 ? 'triggered' : 'not_triggered', `MoS=${mos}%`)
    }
    case 'cash_persistently_below_earnings': {
      if (cash == null || eps == null) return disq(id, '现金持续低于报表利润', 'unknown')
      const trig = eps > 0 && cash < 0
      return disq(id, '现金持续低于报表利润', trig ? 'triggered' : 'not_triggered', `cash=${cash} · eps=${eps}`)
    }
    case 'narrowing_quality': {
      if (qualityScore == null && profitGrowth == null) return disq(id, '质量/回报收窄', 'unknown')
      const trig = (qualityScore != null && qualityScore <= 4) || (profitGrowth != null && profitGrowth < -25 && facts.roe != null && facts.roe < 8)
      return disq(id, '质量/回报收窄', trig ? 'triggered' : 'not_triggered', `q=${qualityScore ?? 'missing'} · g=${profitGrowth ?? 'missing'}%`)
    }
    case 'unmonitorable_ruin': {
      if (competence === 'hard' && debtRatio != null && debtRatio > 80) {
        return disq(id, '不可监测的毁灭路径', 'triggered', `hard + debt=${debtRatio}%`)
      }
      if (competence == null && debtRatio == null) return disq(id, '不可监测的毁灭路径', 'unknown')
      return disq(id, '不可监测的毁灭路径', 'not_triggered', '未见「难理解+高杠杆」同现')
    }
    case 'leverage_plus_exogenous': {
      if (debtRatio == null) return disq(id, '杠杆叠加不可控变量', 'unknown')
      const finLike = ['bank', 'insurance', 'broker'].includes(facts.archetype)
      const trig = !finLike && debtRatio > 75 && (profitGrowth == null || Math.abs(profitGrowth) > 25)
      return disq(id, '杠杆叠加不可控变量', trig ? 'triggered' : 'not_triggered', `debt=${debtRatio}%`)
    }
    case 'competence_hard_forced': {
      if (!competence) return disq(id, '能力圈外强行定价', 'unknown')
      return disq(id, '能力圈外强行定价', competence === 'hard' ? 'triggered' : 'not_triggered', `competence=${competence}`)
    }
    case 'refi_wall_leverage': {
      if (debtRatio == null) return disq(id, '再融资墙式杠杆', 'unknown')
      const finLike = ['bank', 'insurance'].includes(facts.archetype)
      return disq(id, '再融资墙式杠杆', !finLike && debtRatio > 85 ? 'triggered' : 'not_triggered', `debt=${debtRatio}%`)
    }
    case 'asset_light_misapply': {
      const light = facts.archetype === 'platform' || facts.archetype === 'franchise_brand' || facts.archetype === 'biotech'
      // Soft: not a hard stop if we're only using graham as secondary — still flag when PB missing on light assets
      if (!light) return disq(id, '轻资产误用账面透镜', 'not_triggered')
      if (facts.pb == null) return disq(id, '轻资产误用账面透镜', 'unknown')
      return disq(id, '轻资产误用账面透镜', 'triggered', `archetype=${facts.archetype} 不适合主打有形账面`)
    }
    case 'loss_year_proxy': {
      if (eps == null) return disq(id, '近期亏损（稳定性格）', 'unknown')
      return disq(id, '近期亏损（稳定性格）', eps <= 0 ? 'triggered' : 'not_triggered', `eps=${eps}`)
    }
    case 'timing_call': {
      return disq(id, '输出含点位/日期择时', 'not_triggered', '引擎禁止择时输出')
    }
    case 'narrative_only_temp': {
      if (pe == null && facts.pePercentile == null && profitGrowth == null) {
        return disq(id, '仅叙事无温度证据', 'unknown')
      }
      return disq(id, '仅叙事无温度证据', 'not_triggered', '至少有PE/增速/分位之一')
    }
    case 'category_ambiguous': {
      if (!facts.archetype) return disq(id, '类别无法唯一指定', 'triggered', 'missing archetype')
      return disq(id, '类别无法唯一指定', 'not_triggered', `archetype=${facts.archetype}`)
    }
    case 'peak_cycle_cheap_illusion': {
      if (profitGrowth == null || pe == null) return disq(id, '峰值盈利低倍数幻觉', 'unknown')
      const trig = profitGrowth > 40 && pe > 0 && pe < (facts.peLow || 12)
      return disq(id, '峰值盈利低倍数幻觉', trig ? 'triggered' : 'not_triggered', `g=${profitGrowth}% · PE=${pe}`)
    }
    case 'growth_by_leverage': {
      if (debtRatio == null || cash == null) return disq(id, '杠杆资助的增长', 'unknown')
      const trig = debtRatio > 65 && cash < 0 && (revenueGrowth || 0) > 10
      return disq(id, '杠杆资助的增长', trig ? 'triggered' : 'not_triggered', `debt=${debtRatio}% · cash=${cash}`)
    }
    case 'overvalued_only_thesis': {
      // If the only negative is rich PE with no cash gap — for chanos as veto of weak short thesis when used as long screen we don't veto longs
      return disq(id, '「只是贵」当作法证论题', 'not_triggered', '多头筛用途：不以贵否决')
    }
    case 'no_mechanism': {
      const cashSig = (signals || []).find((s) => s.id === 'cash_accrual_gap')
      if (!cashSig || cashSig.status === 'missing') return disq(id, '无线索机制', 'unknown')
      // Mechanism missing only if we claimed impairment with no cash signal
      return disq(id, '无线索机制', 'not_triggered', cashSig.evidence)
    }
    case 'serial_dilution_proxy': {
      // No share-count series in FinDigest → unknown, never invent
      return disq(id, '抑郁价格下连环稀释', 'unknown', 'missing share-count / dilution series')
    }
    case 'complexity_opaque': {
      if (!competence) return disq(id, '模式复杂不透明', 'unknown')
      return disq(id, '模式复杂不透明', competence === 'hard' ? 'triggered' : 'not_triggered', `competence=${competence}`)
    }
    case 'structural_decline_unknown': {
      if (revenueGrowth == null) return disq(id, '结构衰退未排除', 'unknown')
      return disq(id, '结构衰退未排除', revenueGrowth < -20 ? 'triggered' : 'not_triggered', `revG=${revenueGrowth}%`)
    }
    case 'fragile_balance_sheet': {
      if (debtRatio == null) return disq(id, '脆弱资产负债表', 'unknown')
      const finLike = ['bank', 'insurance'].includes(facts.archetype)
      return disq(id, '脆弱资产负债表', !finLike && debtRatio > 80 ? 'triggered' : 'not_triggered', `debt=${debtRatio}%`)
    }
    case 'bad_industry_structure': {
      if (!facts.archetype) return disq(id, '差行业结构', 'unknown')
      return disq(id, '差行业结构', facts.archetype === 'hard' ? 'triggered' : 'not_triggered', `archetype=${facts.archetype}`)
    }
    case 'good_biz_bad_price': {
      if (mos == null || qualityScore == null) return disq(id, '好生意坏价格', 'unknown')
      const trig = qualityScore >= 7 && mos < 0
      return disq(id, '好生意坏价格', trig ? 'triggered' : 'not_triggered', `q=${qualityScore} · MoS=${mos}%`)
    }
    default:
      return disq(id, id, 'unknown')
  }
}

function misuseNote(lens, facts, industry) {
  const regimes = lens.failureRegimes || []
  const hits = []
  if (lens.id === 'buffett' && (facts.archetype === 'cyclical' || facts.archetype === 'biotech' || facts.archetype === 'platform')) {
    hits.push(regimes[0] || '可能处于透镜失灵业态')
  }
  if (lens.id === 'graham' && (facts.archetype === 'platform' || facts.archetype === 'franchise_brand' || facts.archetype === 'biotech')) {
    hits.push(regimes[0] || '轻资产业态')
  }
  if (lens.id === 'marks' && industry) {
    hits.push('单票基本面≠周期读数：姿态仅供参考')
  }
  if (lens.id === 'lynch' && (facts.archetype === 'bank' || facts.archetype === 'cyclical')) {
    hits.push(regimes[0] || '金融/周期上GARP易误用')
  }
  if (lens.id === 'munger') {
    hits.push(regimes[0] || '逆向层不能单独当买入程序')
  }
  if (!hits.length && regimes[0]) hits.push(`留意失灵域：${regimes[0]}`)
  return hits
}

function buildFalsifiers(lensId, facts, verdict) {
  const list = []
  if (lensId === 'buffett') {
    list.push('毛利率连续两年下滑而销量仍稳 → 定价权假设失效')
    list.push('留存收益增量回报跌破资本成本 → 复利假设作废')
  } else if (lensId === 'munger') {
    list.push('列出的触发器触发但后果未现 → 该死亡路径因果模型错误')
    list.push('熊论据关键事实可核查且为假 → 该路径退役并记录证据')
  } else if (lensId === 'graham') {
    list.push('扣减过时存货/应收后有形价值跌破市值 → 折扣是算术幻觉')
    list.push('低于账面增发 → 管理层否定你的资产锚')
  } else if (lensId === 'marks') {
    list.push('风险溢价显著走阔而读数仍是狂热 → 温度已过时')
    list.push('弱资质借款人失去融资 → 晚周期读数被确认')
  } else if (lensId === 'lynch') {
    list.push('存货增速持续高于收入 → 最早且最便宜的警告')
    list.push('类别被财报证伪（如「快增长」变周期）→ 整套倍数规则作废')
  } else if (lensId === 'chanos') {
    list.push('经营现金流累计追上净利润 → 现金裂缝闭合')
    list.push('单位经济在规模上转正且不靠便宜资本 → 结构损伤论题减弱')
  } else if (lensId === 'duan') {
    list.push('核心需求可被一周内无痛替代 → 真实需求门失败')
    list.push('抑郁价连环稀释 → 治理否决')
  } else if (lensId === 'fengliu') {
    list.push('新坏消息尚未被市场消化 → 不在弱者射程')
    list.push('质量地板被证伪（毛利崩/资产负债表裂）→ 停止')
  } else if (lensId === 'qiuguolu') {
    list.push('行业格局恶化（份额战/政策天花板）→ 好问题失败')
    list.push('好模式但价格失去安全边际 → 第三问失败')
  }
  if (facts.mos != null && verdict === 'favorable') {
    list.push(`若保守MoS由 ${facts.mos}% 转为显著为负 → 价格门翻转`)
  }
  return list.slice(0, 3)
}

function scoreToVerdict(lens, signalWalk, triggeredDisq) {
  if (triggeredDisq) {
    return {
      verdict: /** @type {LensVerdict} */ ('vetoed'),
      verdictText: `在该框架下，因硬否决「${triggeredDisq.label}」停止评分：不宜继续用本透镜为多头辩护。`,
    }
  }
  const scored = signalWalk.filter((s) => s.status !== 'missing')
  if (!scored.length) {
    return {
      verdict: /** @type {LensVerdict} */ ('inconclusive'),
      verdictText: '在该框架下，关键信号字段不足，结论不确定（missing ≠ 推断通过）。',
    }
  }
  const passes = scored.filter((s) => s.status === 'pass').length
  const fails = scored.filter((s) => s.status === 'fail').length
  const ratio = passes / scored.length

  // Munger is a veto layer: survivable / monitor / decline
  if (lens.id === 'munger') {
    if (fails >= 2) {
      return {
        verdict: /** @type {LensVerdict} */ ('unfavorable'),
        verdictText: '在逆向框架下，多条失败路径仍活跃：仅可在可监测触发器下讨论，默认偏防守。',
      }
    }
    if (fails === 1) {
      return {
        verdict: /** @type {LensVerdict} */ ('cautious'),
        verdictText: '在逆向框架下，可存活但必须盯住所列触发器；这不是买入信号。',
      }
    }
    return {
      verdict: /** @type {LensVerdict} */ ('cautious'),
      verdictText: '在逆向框架下，未见即时硬否决；逆向层从不单独给出「买」。',
    }
  }

  if (ratio >= 0.7 && fails === 0) {
    return {
      verdict: /** @type {LensVerdict} */ ('favorable'),
      verdictText: '在该框架下，优先信号大体通过且无硬否决（仍须看价格与失灵域）。',
    }
  }
  if (ratio >= 0.45) {
    return {
      verdict: /** @type {LensVerdict} */ ('cautious'),
      verdictText: '在该框架下，信号混杂：有通过项也有失败/缺失，不宜单边解读。',
    }
  }
  return {
    verdict: /** @type {LensVerdict} */ ('unfavorable'),
    verdictText: '在该框架下，多项优先信号未通过；框架内态度偏否定或高度保留。',
  }
}

function confidenceFor(signalWalk, disqualifiers) {
  const missingSig = signalWalk.filter((s) => s.status === 'missing').length
  const unknownDisq = disqualifiers.filter((d) => d.status === 'unknown').length
  if (missingSig >= 3 || unknownDisq >= 2) {
    return { level: 'low', limit: `关键字段缺失 ${missingSig} 项、否决未知 ${unknownDisq} 项` }
  }
  if (missingSig >= 1 || unknownDisq >= 1) {
    return { level: 'medium', limit: `部分字段 missing（信号缺失 ${missingSig}，否决未知 ${unknownDisq}）` }
  }
  return { level: 'medium-high', limit: '字段较全，但仍受模型代理与非100引擎限制' }
}

/**
 * Run one lens independently.
 * @returns {object} output contract fields 1–8
 */
export function runLens({ lensId, financials, valuationResult, industry }) {
  const lens = LENS_REGISTRY[lensId]
  if (!lens) {
    return {
      lensId,
      nameZh: lensId,
      optimizesFor: '',
      verdict: 'inconclusive',
      verdictText: '未知透镜',
      signalWalk: [],
      disqualifiers: [],
      triggeredVeto: null,
      misuse: [],
      falsifiers: [],
      confidence: { level: 'low', limit: '未知透镜' },
      disclaimer: DISCLAIMER,
    }
  }

  const facts = extractFacts(financials, valuationResult)
  const signalWalk = []
  let triggeredVeto = null

  // Walk priority signals in order; stop scoring signals after hard veto (still list remaining as skipped)
  let halted = false
  for (const sid of lens.prioritySignals) {
    if (halted) {
      signalWalk.push(sig(sid, sid, 'missing', '硬否决后停止评分'))
      continue
    }
    // Evaluate disqualifiers interleaved: check after each signal? Spec: hit hard DQ → stop.
    // We evaluate all DQs first briefly for early stop, but also after signals for ones depending on walk.
    signalWalk.push(evaluateSignal(sid, facts, industry))
  }

  const disqualifiers = lens.hardDisqualifiers.map((id) => evaluateDisqualifier(id, facts, signalWalk))
  triggeredVeto = disqualifiers.find((d) => d.status === 'triggered') || null

  // If veto, truncate further interpretation: mark post-veto signals
  if (triggeredVeto) {
    // Keep walked signals for audit, but verdict stops
  }

  const { verdict, verdictText } = scoreToVerdict(lens, signalWalk, triggeredVeto)
  const misuse = misuseNote(lens, facts, industry)
  const falsifiers = buildFalsifiers(lens.id, facts, verdict)
  const confidence = confidenceFor(signalWalk, disqualifiers)

  return {
    lensId: lens.id,
    nameZh: lens.nameZh,
    optimizesFor: lens.optimizesFor,
    verdict,
    verdictText,
    signalWalk,
    disqualifiers,
    triggeredVeto: triggeredVeto
      ? { id: triggeredVeto.id, label: triggeredVeto.label, evidence: triggeredVeto.evidence }
      : null,
    misuse,
    falsifiers,
    confidence,
    disclaimer: DISCLAIMER,
    failureRegimes: lens.failureRegimes,
  }
}

const VERDICT_POLARITY = {
  favorable: 1,
  cautious: 0,
  inconclusive: 0,
  unfavorable: -1,
  vetoed: -2,
}

function classifyDisagreement(a, b) {
  if (!a || !b) return null
  const pa = VERDICT_POLARITY[a.verdict] ?? 0
  const pb = VERDICT_POLARITY[b.verdict] ?? 0
  if (pa === pb) return null
  if (Math.abs(pa - pb) < 1 && a.verdict !== 'vetoed' && b.verdict !== 'vetoed') return null

  const ids = new Set([a.lensId, b.lensId])
  // Information: heavy missing on one side
  const missA = (a.signalWalk || []).filter((s) => s.status === 'missing').length
  const missB = (b.signalWalk || []).filter((s) => s.status === 'missing').length
  if (Math.abs(missA - missB) >= 2 || a.verdict === 'inconclusive' || b.verdict === 'inconclusive') {
    return {
      root: 'information',
      note: '分歧根因偏信息：一侧关键字段 missing 更多，或结论不确定。',
    }
  }
  if (ids.has('marks') && (ids.has('buffett') || ids.has('graham') || ids.has('lynch') || ids.has('qiuguolu'))) {
    return { root: 'horizon', note: '分歧根因偏持有期/周期姿态 vs 公司质量或账面价值。' }
  }
  if (ids.has('munger') && (ids.has('buffett') || ids.has('lynch') || ids.has('fengliu') || ids.has('duan'))) {
    return { root: 'risk', note: '分歧根因偏风险偏好：逆向否决层 vs 正向质量/增长透镜。' }
  }
  if (
    (ids.has('graham') && (ids.has('buffett') || ids.has('lynch') || ids.has('platform'))) ||
    (ids.has('chanos') && (ids.has('buffett') || ids.has('lynch') || ids.has('qiuguolu')))
  ) {
    return { root: 'caliber', note: '分歧根因偏口径：账面/现金裂缝 vs 特许经营或增长叙事。' }
  }
  if (ids.has('munger') || a.verdict === 'vetoed' || b.verdict === 'vetoed') {
    return { root: 'risk', note: '分歧根因偏风险：一侧硬否决或逆向层更严。' }
  }
  return { root: 'caliber', note: '分歧根因归为口径/度量差异（未对判决取平均）。' }
}

function strongestPoint(lensOut) {
  if (!lensOut) return null
  if (lensOut.triggeredVeto) {
    return `硬否决：${lensOut.triggeredVeto.label}${lensOut.triggeredVeto.evidence ? `（${lensOut.triggeredVeto.evidence}）` : ''}`
  }
  const fail = (lensOut.signalWalk || []).find((s) => s.status === 'fail')
  if (fail) return `失败信号：${fail.label}${fail.evidence ? ` — ${fail.evidence}` : ''}`
  const pass = (lensOut.signalWalk || []).find((s) => s.status === 'pass')
  if (pass) return `通过信号：${pass.label}${pass.evidence ? ` — ${pass.evidence}` : ''}`
  return lensOut.verdictText
}

/**
 * Stack 2 lenses independently; never average verdicts.
 */
export function runLensStack({ archetypeId, styleTags, financials, valuationResult, industry }) {
  const selected = selectLenses(archetypeId, styleTags)
  const lenses = selected.map((lensId) =>
    runLens({ lensId, financials, valuationResult, industry }),
  )

  let disagreement = false
  let disagreementRoot = null
  let disagreementNote = null
  let losingStrongestPoint = null

  if (lenses.length >= 2) {
    const [a, b] = lenses
    const pa = VERDICT_POLARITY[a.verdict] ?? 0
    const pb = VERDICT_POLARITY[b.verdict] ?? 0
    if (pa !== pb) {
      disagreement = true
      const cls = classifyDisagreement(a, b)
      disagreementRoot = cls?.root || 'caliber'
      disagreementNote = cls?.note || ''
      // Losing side = more negative polarity
      const loser = pa < pb ? a : b
      losingStrongestPoint = strongestPoint(loser)
    }
  }

  return {
    selected,
    lenses,
    disagreement,
    disagreementRoot,
    disagreementNote,
    losingStrongestPoint,
    disclaimer: DISCLAIMER,
  }
}
