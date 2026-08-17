/**
 * Per-stock valuation angle resolver
 *
 * Maps ~100 thinking paradigms onto the existing ~11 archetypes.
 * Catalog-only paradigms (no engineHint) may appear as angles but never invent IV math.
 *
 * Scoring (deterministic):
 * 1. Industry → default archetype + industry-model paradigms (base score)
 * 2. Fundamentals adjust scores (FCF quality, growth/cyclicality, ROE, leverage, earnings sign)
 * 3. Prefer paradigms with engineHint → real archetype for primary/secondary compute
 * 4. Same industry + different fundamentals → different secondary / weights / angles
 */

import { INDUSTRY_MODELS } from '../data/industry_models.js'
import {
  VALUATION_PARADIGMS,
  getParadigmById,
  primaryParadigmForModel,
  paradigmsForEngineModel,
} from '../data/valuation_paradigms.js'
import { ARCHETYPE_META, assessQuality, getArchetype } from './valuationTaxonomy.js'

/** engineHint → compute archetype (null = resolve from industry financial type) */
export const ENGINE_HINT_TO_ARCHETYPE = {
  'PE+ROE估值': null, // bank / broker / insurance from industry
  'PEV内含价值': 'insurance',
  'SOTP分部估值': 'insurance',
  'DCF+品牌溢价': 'franchise_brand',
  'DCF+用户价值': 'platform',
  'DCF+产能': 'capital_heavy',
  'DCF+周期调整': 'cyclical',
  'DCF+稳定现金流': null, // utility_infra if industry matches; else keep industry archetype (conservative DCF)
  'DCF+管线': 'biotech',
  'DCF+订单管线': 'capital_heavy',
  'EV/EBITDA+件量': 'capital_heavy',
  'NAV净资产价值': 'real_estate',
  'PE+PS估值': null,
  'rNPV管线价值': 'biotech',
}

/** Frozen key set — paradigms.engineHint must ⊆ this map (see scripts/check_engine_hints.mjs) */
export const ENGINE_HINT_KEYS = Object.freeze(Object.keys(ENGINE_HINT_TO_ARCHETYPE))

/** Default paradigm id per archetype when industry model list is thin */
const ARCHETYPE_DEFAULT_PARADIGM = {
  franchise_brand: 'dcf-brand',
  bank: 'pb-roe-bank',
  insurance: 'pev-life',
  broker: 'broker-pb',
  cyclical: 'mid-cycle-earnings',
  capital_heavy: 'dcf-capacity',
  platform: 'dcf-user',
  biotech: 'rnpv',
  real_estate: 'nav-dev',
  utility_infra: 'dcf-utility',
  hard: 'competence-circle',
}

/**
 * Resolve which archetype a paradigm actually drives in the band engine.
 * Returns null when the paradigm is thinking-only (no engineHint).
 */
export function archetypeForParadigm(paradigm, industryArchetype) {
  if (!paradigm?.engineHint) return null
  const mapped = ENGINE_HINT_TO_ARCHETYPE[paradigm.engineHint]
  if (mapped) return mapped
  if (paradigm.engineHint === 'PE+ROE估值') {
    if (industryArchetype === 'bank' || industryArchetype === 'insurance' || industryArchetype === 'broker') {
      return industryArchetype
    }
    return 'bank'
  }
  if (paradigm.engineHint === 'PE+PS估值') {
    return industryArchetype === 'capital_heavy' || industryArchetype === 'cyclical'
      ? 'capital_heavy'
      : 'platform'
  }
  if (paradigm.engineHint === 'DCF+稳定现金流') {
    // Explicit utility paradigms (dcf-utility / power-tariff) still want utility bands when user overrides
    if (paradigm.id === 'dcf-utility' || paradigm.id === 'power-tariff' || paradigm.id === 'property-mgmt-dcf') {
      return 'utility_infra'
    }
    if (industryArchetype === 'utility_infra') return 'utility_infra'
    // dcf-conservative / dcf-2stage: recompute on the stock's industry archetype, not fake utility math
    return industryArchetype
  }
  return industryArchetype
}

/**
 * UI / briefing: does picking this paradigm recompute IV, or only change the thinking angle?
 * @param {object|null} paradigm
 * @param {string} [industryArchetype='capital_heavy']
 * @returns {{ recomputes: boolean, angleOnly: boolean, targetArchetype: string|null, label: string|null }}
 */
export function describeParadigmComputeEffect(paradigm, industryArchetype = 'capital_heavy') {
  const targetArchetype = archetypeForParadigm(paradigm, industryArchetype)
  if (!targetArchetype) {
    return {
      recomputes: false,
      angleOnly: true,
      targetArchetype: null,
      label: null,
    }
  }
  const label = ARCHETYPE_META[targetArchetype]?.label || targetArchetype
  return {
    recomputes: true,
    angleOnly: false,
    targetArchetype,
    label,
  }
}

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n))
}

/** Extract cheap fundamental features used by scoring */
export function extractFeatures(fin = {}) {
  const eps = +(fin.eps || 0)
  const oe = +(fin.ownerEarnings || fin.fcfPerShare || 0)
  const ocf = +(fin.ocf || 0)
  const capex = +(fin.capex || 0)
  const growth = +(fin.profitGrowth || 0)
  const revG = +(fin.revenueGrowth || 0)
  const roe = +(fin.roe || 0)
  const debt = +(fin.debtRatio || 0)
  const gm = +(fin.grossMargin || 0)
  const nm = +(fin.netMargin || 0)
  const pe = +(fin.pe_ttm || 0)
  const fcfRatio = eps > 0 && oe > 0 ? oe / eps : oe < 0 && eps > 0 ? oe / eps : null
  const cashConversion =
    ocf > 0 && +(fin.profit || 0) > 0 ? ocf / +(fin.profit || 1) : fcfRatio != null ? fcfRatio : null
  const peakCycle = growth >= 40
  const troughCycle = growth <= -25
  const cyclicality = peakCycle || troughCycle || Math.abs(growth - revG) > 35
  const highQualityCash = (fcfRatio != null && fcfRatio >= 0.85) || (cashConversion != null && cashConversion >= 1.1)
  const sparseCash = !(oe > 0) && !(ocf > 0)
  const lossMaking = !(eps > 0) || pe <= 0
  const highLeverage = debt > 70
  const thickMargin = gm >= 45 || nm >= 18

  return {
    eps,
    oe,
    growth,
    revG,
    roe,
    debt,
    gm,
    nm,
    pe,
    fcfRatio,
    cashConversion,
    peakCycle,
    troughCycle,
    cyclicality,
    highQualityCash,
    sparseCash,
    lossMaking,
    highLeverage,
    thickMargin,
    capexHeavy: capex > 0 && ocf > 0 && capex > ocf * 0.55,
  }
}

function bump(scores, id, delta, reason, reasons) {
  if (!id || !getParadigmById(id)) return
  scores[id] = (scores[id] || 0) + delta
  if (reason && delta !== 0) {
    ;(reasons[id] || (reasons[id] = [])).push(reason)
  }
}

function styleTags(industryArchetype, feat, quality) {
  const tags = new Set()
  if (industryArchetype === 'bank' || industryArchetype === 'insurance' || industryArchetype === 'broker') {
    tags.add('financial')
  }
  if (industryArchetype === 'platform') tags.add('platform')
  if (industryArchetype === 'biotech') tags.add('biotech')
  if (industryArchetype === 'utility_infra') tags.add('utility')
  if (industryArchetype === 'cyclical' || feat.cyclicality) tags.add('cyclical')
  if (industryArchetype === 'hard' || (feat.lossMaking && industryArchetype === 'biotech')) tags.add('hard')
  if (
    quality.quality === 'wonderful' ||
    quality.quality === 'good' ||
    (feat.highQualityCash && feat.roe >= 12 && feat.thickMargin)
  ) {
    tags.add('quality')
  }
  if (industryArchetype === 'capital_heavy' || feat.capexHeavy) tags.add('hard')
  // "hard" as style for capital intensity is noisy — only keep for competence-hard cases
  if (industryArchetype !== 'hard' && !(feat.lossMaking && industryArchetype === 'biotech')) {
    tags.delete('hard')
  }
  if (feat.capexHeavy) tags.add('capital')
  return [...tags]
}

function buildAngles(primary, secondary, feat, industryArchetype, quality, style) {
  const angles = []
  const pName = primary.paradigmName || primary.paradigmId
  angles.push(`主视角：${pName}（${ARCHETYPE_META[primary.archetype]?.label || primary.archetype}）`)

  for (const s of secondary) {
    const label = s.paradigmName || s.paradigmId
    const w = Math.round((s.weight || 0) * 100)
    angles.push(`辅视角：${label}${w ? ` · 权重约${w}%` : ''} — ${s.reason}`)
  }

  if (feat.cyclicality && (industryArchetype === 'cyclical' || style.includes('cyclical'))) {
    angles.push(
      feat.peakCycle
        ? '周期提示：利润高增，忌用峰值盈利外推永续'
        : '周期提示：利润承压，宜用中枢/谷底盈利而非谷底PE幻觉',
    )
  }
  if (feat.highQualityCash && style.includes('quality')) {
    angles.push('现金质量：FCF/所有者盈余转化偏强，可向质量/DCF倾斜')
  } else if (feat.capexHeavy || (feat.fcfRatio != null && feat.fcfRatio < 0.55)) {
    angles.push('现金质量：报表利润含成长/维保资本开支，宜折损后再估')
  }
  if (industryArchetype === 'biotech' && feat.lossMaking) {
    angles.push('医药提示：负盈利阶段不作精确IV，管线叙事进能力圈外')
  }
  if (industryArchetype === 'bank' || industryArchetype === 'broker') {
    angles.push('金融主锚：PB-ROE / 周期账面，而非成长DCF')
  }
  if (industryArchetype === 'utility_infra') {
    angles.push('公用视角：可预测现金流与股息锚定优先于增速故事')
  }
  if (quality.quality === 'wonderful') {
    angles.push('质量判定：wonderful — 伟大企业允许略小安全边际，仍忌叙事溢价')
  } else if (quality.quality === 'cigar') {
    angles.push('质量判定：偏烟蒂 — 要求更大折扣，警惕价值陷阱')
  }

  // Dedupe while preserving order
  const seen = new Set()
  return angles.filter((a) => {
    if (seen.has(a)) return false
    seen.add(a)
    return true
  }).slice(0, 5)
}

/**
 * @param {{ code?: string, name?: string, industry?: string, fin?: object, userOverride?: string|null }} input
 */
export function resolveStockAngles(input = {}) {
  const { code = '', name = '', fin = {}, userOverride = null } = input
  const industry = input.industry || ''
  const industryArchetype = getArchetype(industry, name)
  const model = INDUSTRY_MODELS[industry] || INDUSTRY_MODELS['其他']
  const feat = extractFeatures(fin)
  const quality = assessQuality(fin, industryArchetype, name)
  const scores = Object.create(null)
  const reasons = Object.create(null)

  // 1) Industry model baselines
  const industryParadigms = paradigmsForEngineModel(model.model)
  const defaultParadigm =
    industryParadigms[0] ||
    getParadigmById(ARCHETYPE_DEFAULT_PARADIGM[industryArchetype]) ||
    primaryParadigmForModel(model.model)

  bump(scores, defaultParadigm.id, 40, `行业默认（${industry || '未分类'}→${model.model}）`, reasons)
  for (const p of industryParadigms.slice(0, 4)) {
    bump(scores, p.id, 12, '同行业模型候选', reasons)
  }
  bump(
    scores,
    ARCHETYPE_DEFAULT_PARADIGM[industryArchetype],
    18,
    `类型先验 ${ARCHETYPE_META[industryArchetype]?.label || industryArchetype}`,
    reasons,
  )

  // 2) Fundamental adjustments
  if (feat.highQualityCash && feat.roe >= 12) {
    bump(scores, 'franchise-buffett', 16, '高ROE+现金转化→质量倾斜', reasons)
    bump(scores, 'dcf-conservative', 10, '可贴现现金流质量尚可', reasons)
    bump(scores, 'cash-conversion', 8, '利润现金转化偏强（思维角）', reasons)
    bump(scores, 'owner-earnings-yield', 8, '所有者盈余视角', reasons)
    if (industryArchetype === 'franchise_brand' || industryArchetype === 'platform') {
      bump(scores, 'dcf-brand', 10, '品牌/平台+现金质量', reasons)
      bump(scores, 'capital-light', 6, '轻资产复利（思维角）', reasons)
    }
  }

  if (feat.cyclicality || industryArchetype === 'cyclical') {
    bump(scores, 'mid-cycle-earnings', 20, feat.peakCycle ? '景气高位→中枢盈利' : '周期波动→中枢盈利', reasons)
    bump(scores, 'dcf-cycle', 14, '周期位置DCF', reasons)
    if (feat.peakCycle) bump(scores, 'peak-pe-reject', 12, '拒绝峰值PE（思维角）', reasons)
    if (feat.troughCycle) bump(scores, 'trough-pe', 10, '谷底盈利框架（思维角）', reasons)
  }

  if (industryArchetype === 'bank') {
    bump(scores, 'pb-roe-bank', 28, '银行主锚PB-ROE', reasons)
    bump(scores, 'bank-ddm', feat.roe >= 10 ? 10 : 4, '分红/资本约束视角', reasons)
  }
  if (industryArchetype === 'insurance') {
    bump(scores, 'pev-life', 24, '保险P/EV', reasons)
    bump(scores, 'insurance-sotp', 10, '综合保险分部', reasons)
  }
  if (industryArchetype === 'broker') {
    bump(scores, 'broker-pb', 24, '券商周期PB', reasons)
  }
  if (industryArchetype === 'utility_infra') {
    bump(scores, 'dcf-utility', 24, '公用稳定DCF', reasons)
    bump(scores, 'dividend-yield', 8, '股息锚定（思维角）', reasons)
    bump(scores, 'power-tariff', 6, '电价/利用小时（思维角）', reasons)
  }
  if (industryArchetype === 'real_estate') {
    bump(scores, 'nav-dev', 24, '开发商NAV', reasons)
    if (feat.lossMaking) bump(scores, 'liquidation', 10, '亏损地产→清算/退出思维（思维角）', reasons)
  }
  if (industryArchetype === 'biotech') {
    if (feat.lossMaking || feat.pe > 80) {
      bump(scores, 'rnpv', 22, '负盈利/管线叙事→rNPV框架', reasons)
      bump(scores, 'competence-circle', 16, '能力圈过滤', reasons)
    } else if (/CXO/.test(industry)) {
      bump(scores, 'cxo-backlog', 22, '盈利CXO→订单簿', reasons)
      bump(scores, 'dcf-pipeline-rx', 12, '管线/订单DCF', reasons)
    } else {
      bump(scores, 'dcf-pipeline-rx', 16, '盈利药企保守管线DCF', reasons)
      bump(scores, 'rnpv', 8, '管线仍需概率折扣', reasons)
    }
  }
  if (industryArchetype === 'platform') {
    if (feat.lossMaking) {
      bump(scores, 'competence-circle', 18, '亏损平台→能力圈外', reasons)
      bump(scores, 'ps-growth', 10, '亏损阶段PS粗筛（思维角）', reasons)
    } else {
      bump(scores, 'dcf-user', 18, '正利润平台→用户价值DCF', reasons)
      bump(scores, 'platform-gm', 10, '取率/毛利路径', reasons)
    }
  }
  if (industryArchetype === 'capital_heavy' || feat.capexHeavy) {
    bump(scores, 'dcf-capacity', 14, '产能/资本开支路径', reasons)
    bump(scores, 'capital-heavy-disc', 12, '重资产折价（思维角）', reasons)
    if (feat.highLeverage) bump(scores, 'mos-cyclical', 8, '高杠杆加码边际（思维角）', reasons)
  }
  if (feat.thickMargin && feat.roe >= 15 && !feat.cyclicality) {
    bump(scores, 'roe-moat', 10, '厚毛利+高ROE护城河（思维角）', reasons)
    bump(scores, 'gross-margin-stability', 6, '毛利率质量（思维角）', reasons)
  }
  if (feat.highLeverage && industryArchetype !== 'bank' && industryArchetype !== 'insurance' && industryArchetype !== 'broker') {
    bump(scores, 'governance-haircut', 4, '高负债治理折价（思维角）', reasons)
  }

  // Soft archetype tilt candidates (secondary compute)
  if (
    (industryArchetype === 'capital_heavy' || industryArchetype === 'franchise_brand') &&
    quality.quality === 'wonderful' &&
    feat.highQualityCash
  ) {
    bump(scores, 'dcf-brand', 8, '优质现金牛可辅以特许经营口径', reasons)
  }
  if (industryArchetype === 'franchise_brand' && feat.cyclicality) {
    bump(scores, 'mid-cycle-earnings', 14, '品牌股利润波动→中枢校正', reasons)
  }
  if (industryArchetype === 'cyclical' && feat.highQualityCash && feat.roe >= 15 && !feat.peakCycle) {
    bump(scores, 'dcf-conservative', 10, '周期股现金尚可→保守DCF交叉', reasons)
  }

  // 3) User override
  let overrideApplied = false
  let overrideThinkingOnly = false
  const overrideParadigm = userOverride ? getParadigmById(userOverride) : null
  if (overrideParadigm) {
    const ovArch = archetypeForParadigm(overrideParadigm, industryArchetype)
    if (ovArch) {
      bump(scores, overrideParadigm.id, 100, '用户指定范式（可重算主锚）', reasons)
      overrideApplied = true
    } else {
      bump(scores, overrideParadigm.id, 30, '用户指定思维角（无独立IV引擎）', reasons)
      overrideThinkingOnly = true
    }
  }

  // Rank compute-capable vs thinking-only
  const ranked = Object.keys(scores)
    .map((id) => {
      const p = getParadigmById(id)
      const arch = archetypeForParadigm(p, industryArchetype)
      return {
        paradigmId: id,
        paradigmName: p?.name || id,
        family: p?.family,
        engineHint: p?.engineHint || null,
        archetype: arch,
        score: scores[id],
        reasons: reasons[id] || [],
        compute: !!arch,
      }
    })
    .sort((a, b) => b.score - a.score)

  const computeRanked = ranked.filter((r) => r.compute)
  let primaryRow = computeRanked[0]
  if (!primaryRow) {
    primaryRow = {
      paradigmId: defaultParadigm.id,
      paradigmName: defaultParadigm.name,
      family: defaultParadigm.family,
      engineHint: defaultParadigm.engineHint || null,
      archetype: industryArchetype,
      score: 1,
      reasons: ['回退行业默认'],
      compute: true,
    }
  }

  // Keep industry archetype unless override or strong fundamental tilt (≥+15 vs industry default)
  let primaryArchetype = industryArchetype
  if (overrideApplied && overrideParadigm) {
    primaryArchetype = archetypeForParadigm(overrideParadigm, industryArchetype) || industryArchetype
    primaryRow =
      computeRanked.find((r) => r.paradigmId === overrideParadigm.id) || {
        paradigmId: overrideParadigm.id,
        paradigmName: overrideParadigm.name,
        family: overrideParadigm.family,
        engineHint: overrideParadigm.engineHint || null,
        archetype: primaryArchetype,
        score: scores[overrideParadigm.id] || 100,
        reasons: reasons[overrideParadigm.id] || ['用户指定'],
        compute: true,
      }
  } else {
    const industryDefaultId =
      industryParadigms[0]?.id || ARCHETYPE_DEFAULT_PARADIGM[industryArchetype] || defaultParadigm.id
    const industryScore = scores[industryDefaultId] || 0
    if (
      primaryRow.archetype &&
      primaryRow.archetype !== industryArchetype &&
      primaryRow.score >= industryScore + 15
    ) {
      primaryArchetype = primaryRow.archetype
    } else {
      // Prefer best compute paradigm that matches industry archetype
      const same = computeRanked.find((r) => r.archetype === industryArchetype)
      if (same) {
        primaryRow = same
        primaryArchetype = industryArchetype
      }
    }
  }

  const primaryReason = (primaryRow.reasons && primaryRow.reasons[0]) || '行业+基本面综合'
  const primary = {
    paradigmId: primaryRow.paradigmId,
    paradigmName: primaryRow.paradigmName,
    archetype: primaryArchetype,
    reason: primaryReason,
    engineHint: primaryRow.engineHint,
  }

  // Secondary: up to 2, prefer different archetype or different paradigm family
  const secondary = []
  for (const row of computeRanked) {
    if (row.paradigmId === primary.paradigmId) continue
    if (secondary.length >= 2) break
    const differentArch = row.archetype && row.archetype !== primary.archetype
    const differentFamily = row.family && row.family !== primaryRow.family
    if (!differentArch && !differentFamily && secondary.length === 0) {
      // still allow one same-arch supporting paradigm with lower weight
    } else if (!differentArch && secondary.some((s) => s.archetype === row.archetype)) {
      continue
    }
    const rawW = row.score / (primaryRow.score + row.score + 1e-6)
    const weight = clamp(differentArch ? rawW * 0.9 : rawW * 0.55, 0.12, differentArch ? 0.35 : 0.22)
    secondary.push({
      paradigmId: row.paradigmId,
      paradigmName: row.paradigmName,
      archetype: row.archetype,
      weight: Math.round(weight * 100) / 100,
      reason: (row.reasons && row.reasons[0]) || '基本面交叉验证',
      engineHint: row.engineHint,
    })
  }

  // Thinking-only angles from high-scoring catalog paradigms
  const thinking = ranked
    .filter((r) => !r.compute && r.score >= 8)
    .slice(0, 3)
    .map((r) => ({
      paradigmId: r.paradigmId,
      paradigmName: r.paradigmName,
      reason: (r.reasons && r.reasons[0]) || '思维框架',
    }))

  if (overrideThinkingOnly && overrideParadigm) {
    thinking.unshift({
      paradigmId: overrideParadigm.id,
      paradigmName: overrideParadigm.name,
      reason: '用户指定思维角（不改IV主锚）',
    })
  }

  const style = styleTags(industryArchetype, feat, quality)
  const angles = buildAngles(primary, secondary, feat, industryArchetype, quality, style)
  for (const t of thinking.slice(0, 2)) {
    if (angles.length >= 5) break
    angles.push(`思维角：${t.paradigmName} — ${t.reason}`)
  }

  return {
    primary,
    secondary,
    thinking,
    style,
    angles,
    industryArchetype,
    quality: quality.quality,
    features: {
      cyclicality: feat.cyclicality,
      highQualityCash: feat.highQualityCash,
      lossMaking: feat.lossMaking,
      peakCycle: feat.peakCycle,
      troughCycle: feat.troughCycle,
      fcfRatio: feat.fcfRatio == null ? null : Math.round(feat.fcfRatio * 100) / 100,
    },
    overrideApplied,
    overrideThinkingOnly,
    code,
  }
}

/** Convenience: list paradigms that can drive a real archetype recompute */
export function computeCapableParadigms() {
  return VALUATION_PARADIGMS.filter((p) => !!archetypeForParadigm(p, 'capital_heavy'))
}
