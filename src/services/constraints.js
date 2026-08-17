/**
 * 私人定制硬约束引擎
 * 问卷/手动覆盖 → 可执行规则 → 建议过滤与持仓点名
 */

import { getIndustry } from './industry.js'
import { SCENARIO_QUESTION_COUNT, essentialsDone } from '../data/profileQuestions.js'
import { vaultGet, vaultSet, getActiveAccountId } from './vault.js'

const FEEDBACK_KEY = 'fd_advice_feedback_v1'
const FEEDBACK_VAULT = 'fd_feedback_memory'

export function loadFeedbackMemory() {
  try {
    if (getActiveAccountId()) {
      const v = vaultGet(FEEDBACK_VAULT, null)
      if (v && typeof v === 'object') return v
      return {}
    }
    return JSON.parse(localStorage.getItem(FEEDBACK_KEY) || '{}')
  } catch {
    return {}
  }
}

export function saveFeedbackMemory(mem) {
  if (getActiveAccountId()) {
    vaultSet(FEEDBACK_VAULT, mem)
    try {
      localStorage.removeItem(FEEDBACK_KEY)
    } catch {
      /* ignore */
    }
    return
  }
  localStorage.setItem(FEEDBACK_KEY, JSON.stringify(mem))
}

/** 记录简报反馈，供次日建议调权 */
export function recordAdviceFeedback(item, action) {
  const mem = loadFeedbackMemory()
  const recent = Array.isArray(mem.recent) ? mem.recent : []
  recent.unshift({
    id: item?.id,
    type: item?.type,
    code: item?.code,
    action,
    title: item?.title,
    at: Date.now(),
  })
  mem.recent = recent.slice(0, 80)

  const counts = mem.counts || {}
  const key = `${action}:${item?.type || 'other'}`
  counts[key] = (counts[key] || 0) + 1
  mem.counts = counts

  if (action === 'disagree' && (item?.type === 'opportunity' || item?.type === 'undervalued' || item?.type === 'catalyst')) {
    mem.suppressBullish = (mem.suppressBullish || 0) + 1
  }
  if (action === 'adopt' && (item?.type === 'risk' || item?.type === 'overvalued' || item?.type === 'constraint')) {
    mem.boostRisk = (mem.boostRisk || 0) + 1
  }
  if (action === 'ignore') {
    mem.ignoreNoise = (mem.ignoreNoise || 0) + 1
  }

  mem.lastNote = buildFeedbackNote(mem)
  saveFeedbackMemory(mem)
  return mem
}

function buildFeedbackNote(mem) {
  const parts = []
  if ((mem.suppressBullish || 0) >= 2) parts.push('你近期多次否决偏乐观/加仓类建议，已降低此类优先级')
  if ((mem.boostRisk || 0) >= 2) parts.push('你近期认可风控提醒，已提高风险类建议权重')
  if ((mem.ignoreNoise || 0) >= 4) parts.push('你常跳过一般提示，已压缩低优先级噪音')
  return parts.join('；') || ''
}

/**
 * @param {object} profile summarizeForReport 或 raw profile
 * @param {object} [raw] 完整 profile（含 life / manualOverrides）
 */
export function extractConstraints(profile, raw) {
  const p = raw || profile || {}
  const risk = p.risk || {}
  const ov = p.manualOverrides || {}
  const life = p.life || {}

  let maxDd = parsePct(ov.maxDrawdown ?? risk.maxDrawdown ?? profile?.maxDrawdown)
  let singleMax = parsePct(ov.singleStockMax ?? risk.singleStockMax ?? profile?.singleStockMax)
  const avoid = [...(ov.avoidIndustries || p.avoidIndustries || profile?.avoidIndustries || [])]
  const preferred = [...(p.preferredIndustries || profile?.preferredIndustries || profile?.industries || [])]

  // 人生现金流：用钱近 → 强制更严
  if (life.moneyNeedHorizon === '<1y' || life.moneyNeedHorizon === '1-3y') {
    maxDd = Math.min(maxDd ?? 20, life.moneyNeedHorizon === '<1y' ? 10 : 15)
    singleMax = Math.min(singleMax ?? 25, 15)
  }
  if (life.emergencyMonths === '0-3') {
    maxDd = Math.min(maxDd ?? 20, 12)
  }
  if (life.hasMortgage === true || life.hasMortgage === 'yes') {
    maxDd = Math.min(maxDd ?? 20, maxDd == null ? 15 : maxDd)
  }
  if ((life.dependents || 0) >= 2 || life.dependents === '2+') {
    singleMax = Math.min(singleMax ?? 25, 20)
  }

  const answered = p.scenarioProgress || profile?.scenarioProgress || Object.keys(p.scenarioAnswers || {}).length || 0
  const complete = !!(p.onboardingDone || profile?.onboardingDone)
  const essentials = !!(p.essentialsDone || essentialsDone(p.scenarioAnswers || {}))
  const mode = complete ? 'full' : essentials || answered >= 10 ? 'partial' : 'locked'

  return {
    maxDrawdownPct: maxDd,
    singleStockMaxPct: singleMax,
    avoidIndustries: avoid,
    preferredIndustries: preferred,
    leverageForbidden: (ov.leverageUsage || risk.leverageUsage) === 'none',
    lossAversion: Number(ov.lossAversion ?? risk.lossAversion ?? 3),
    stopLossDiscipline: Number(risk.stopLossDiscipline ?? 3),
    style: profile?.style || null,
    riskLabel: profile?.risk || null,
    horizon: profile?.horizon || null,
    life,
    answered,
    total: SCENARIO_QUESTION_COUNT,
    complete,
    essentialsDone: essentials,
    mode,
  }
}

function parsePct(v) {
  if (v == null || v === '') return null
  const n = parseFloat(String(v).replace('%', ''))
  return Number.isFinite(n) ? n : null
}

/** 点名检查每只持仓 */
export function evaluateHoldings(holdings, totalMv, getPrice, constraints) {
  const violations = []
  const rows = []
  const mv = totalMv > 0 ? totalMv : 0

  ;(holdings || []).forEach((h) => {
    const price = typeof getPrice === 'function' ? getPrice(h.code, h.cost) : h.price || h.cost
    const lineMv = (h.shares || 0) * (price || 0)
    const weight = mv > 0 ? (lineMv / mv) * 100 : 0
    const industry = getIndustry(h.code, h.name)
    const issues = []

    if (constraints.singleStockMaxPct != null && weight > constraints.singleStockMaxPct + 0.5) {
      issues.push({
        kind: 'single_cap',
        severity: 'high',
        message: `仓位约 ${weight.toFixed(1)}%，超过你的单票上限 ${constraints.singleStockMaxPct}%`,
      })
    }
    if (constraints.avoidIndustries.includes(industry)) {
      issues.push({
        kind: 'avoid_industry',
        severity: 'high',
        message: `落在回避行业「${industry}」`,
      })
    }

    const row = {
      code: h.code,
      name: h.name,
      weight,
      industry,
      lineMv,
      issues,
    }
    rows.push(row)
    issues.forEach((iss) => {
      violations.push({
        ...iss,
        code: h.code,
        name: h.name,
        industry,
        weight,
      })
    })
  })

  // 组合回撤：用未实现盈亏近似「已发生回撤」提示（非真实峰值回撤）
  return { rows, violations }
}

/**
 * 将硬约束写入建议列表：超限生成 constraint 项；加仓类降权/删除
 */
export function applyHardConstraints(items, { violations, constraints, portfolioPlPct, feedback }) {
  const out = [...(items || [])]
  const fb = feedback || loadFeedbackMemory()
  const mode = constraints.mode

  // P3：未完成定制 → 锁完整机会建议
  if (mode === 'locked') {
    const kept = out.filter((i) => i.type === 'pending' || i.type === 'constraint' || i.type === 'risk')
    kept.unshift({
      id: 'gate-locked',
      type: 'gate',
      tone: 'warn',
      code: null,
      title: '私人定制未完成 · 观察模式',
      summary: `已答 ${constraints.answered}/${constraints.total} 题。完整加仓/低估建议已锁定，请先完成设置中的细分问卷。`,
      logic: ['冷启动门禁', '仅保留风险与数据缺口提示', '完成 88 题后解锁完整管家建议'],
      trigger: '来自：私人定制门禁',
      priority: -1,
      locked: true,
    })
    return finalize(kept, fb, constraints, true)
  }

  if (mode === 'partial') {
    out.unshift({
      id: 'gate-partial',
      type: 'gate',
      tone: 'info',
      code: null,
      title: '定制进行中 · 建议偏保守',
      summary: `进度 ${constraints.answered}/${constraints.total}。机会类建议已降权，风控类保留。`,
      logic: ['部分定制生效', '完成全部题目后解除降权'],
      trigger: '来自：私人定制进度',
      priority: -1,
    })
  }

  // P1+P4：持仓点名违规
  violations.forEach((v, idx) => {
    out.unshift({
      id: `constraint-${v.kind}-${v.code}-${idx}`,
      type: 'constraint',
      tone: 'warn',
      code: v.code,
      title: `${v.name} 触碰你的硬约束`,
      summary: v.message + '。按私人定制规则，默认不建议继续加仓。',
      logic: [
        v.kind === 'single_cap' ? `单票上限 ${constraints.singleStockMaxPct}%` : `回避行业名单`,
        `当前权重约 ${v.weight?.toFixed?.(1) ?? '—'}%`,
        '硬约束优先于情绪/估值乐观信号',
      ],
      trigger: `硬约束：${v.kind}`,
      priority: -1,
      constraintKind: v.kind,
    })
  })

  // 组合浮亏接近回撤容忍
  if (constraints.maxDrawdownPct != null && portfolioPlPct != null && portfolioPlPct < 0) {
    const dd = Math.abs(portfolioPlPct)
    if (dd >= constraints.maxDrawdownPct * 0.7) {
      out.unshift({
        id: 'constraint-drawdown',
        type: 'constraint',
        tone: dd >= constraints.maxDrawdownPct ? 'warn' : 'info',
        code: null,
        title:
          dd >= constraints.maxDrawdownPct
            ? `组合浮亏 ${dd.toFixed(1)}% 已触及回撤容忍 ${constraints.maxDrawdownPct}%`
            : `组合浮亏 ${dd.toFixed(1)}%，接近回撤容忍 ${constraints.maxDrawdownPct}%`,
        summary: '按你的画像，此时优先风控与复核，而不是寻找加仓理由。',
        logic: [`回撤容忍 ${constraints.maxDrawdownPct}%`, `当前浮亏 ${dd.toFixed(1)}%`, '硬约束：抑制新开仓建议'],
        trigger: '硬约束：maxDrawdown',
        priority: -1,
      })
    }
  }

  const violateCodes = new Set(violations.map((v) => v.code))
  const drawdownHot =
    constraints.maxDrawdownPct != null &&
    portfolioPlPct != null &&
    portfolioPlPct < 0 &&
    Math.abs(portfolioPlPct) >= constraints.maxDrawdownPct * 0.7

  const mapped = out.map((item) => {
    let next = { ...item }
    const bullish = ['opportunity', 'undervalued', 'catalyst'].includes(item.type)

    if (mode === 'partial' && bullish) {
      next.priority = (next.priority ?? 2) + 2
      next.summary = `${next.summary || ''}（定制未完成，已降权）`
      next.gated = true
    }

    if (bullish && item.code && violateCodes.has(item.code)) {
      next = {
        ...next,
        type: 'risk',
        tone: 'warn',
        title: `${item.title} · 已因硬约束取消加仓倾向`,
        summary: `原乐观信号保留作参考，但该标的已触碰你的仓位/行业约束，默认动作改为「不加仓、先复盘」。`,
        priority: -1,
        blockedByConstraint: true,
      }
    }

    if (bullish && drawdownHot) {
      next.priority = (next.priority ?? 2) + 3
      next.summary = `${next.summary || ''}（回撤约束生效：暂缓加仓）`
      next.blockedByConstraint = true
    }

    return next
  })

  return finalize(mapped, fb, constraints, false)
}

function finalize(items, fb, constraints, locked) {
  let list = items.filter(Boolean)

  // P5：反馈调权
  const suppress = fb.suppressBullish || 0
  const boostRisk = fb.boostRisk || 0
  const ignoreNoise = fb.ignoreNoise || 0

  list = list.map((item) => {
    const next = { ...item }
    if (suppress >= 2 && ['opportunity', 'undervalued', 'catalyst'].includes(item.type)) {
      next.priority = (next.priority ?? 2) + Math.min(suppress, 5)
      next.feedbackAdjusted = true
    }
    if (boostRisk >= 2 && ['risk', 'overvalued', 'constraint'].includes(item.type)) {
      next.priority = (next.priority ?? 1) - 1
      next.feedbackAdjusted = true
    }
    if (ignoreNoise >= 4 && (item.type === 'industry' || item.type === 'watchlist' || item.type === 'pending')) {
      next.priority = (next.priority ?? 3) + 2
    }
    return next
  })

  if (fb.lastNote && !locked) {
    list.unshift({
      id: 'feedback-memory',
      type: 'calibration',
      tone: 'info',
      code: null,
      title: '根据你的反馈已校准',
      summary: fb.lastNote,
      logic: ['来自近期「有用/跳过/不同意」', '将影响本次及后续简报排序'],
      trigger: '反馈校准环',
      priority: -2,
    })
  }

  list.sort((a, b) => (a.priority ?? 9) - (b.priority ?? 9))
  const cap = locked ? 8 : constraints.mode === 'partial' ? 10 : 14
  return list.slice(0, cap)
}

/** 画像说明书摘要 */
export function buildPassportSummary(profile, constraints, personality) {
  const life = profile?.life || {}
  return {
    complete: constraints.complete,
    progress: `${constraints.answered}/${constraints.total}`,
    modeLabel: constraints.mode === 'full' ? '完整管家' : constraints.mode === 'partial' ? '保守观察+' : '观察模式',
    style: constraints.style,
    risk: constraints.riskLabel,
    horizon: constraints.horizon,
    maxDrawdown: constraints.maxDrawdownPct != null ? `${constraints.maxDrawdownPct}%` : '未设',
    singleStockMax: constraints.singleStockMaxPct != null ? `${constraints.singleStockMaxPct}%` : '未设',
    avoid: constraints.avoidIndustries,
    preferred: constraints.preferredIndustries,
    personality: (personality || []).slice(0, 4),
    life: {
      moneyNeedHorizon: life.moneyNeedHorizon || '未填',
      hasMortgage: life.hasMortgage === true || life.hasMortgage === 'yes' ? '有房贷/负债压力' : life.hasMortgage === false || life.hasMortgage === 'no' ? '无重大房贷' : '未填',
      dependents: life.dependents ?? '未填',
      emergencyMonths: life.emergencyMonths || '未填',
    },
    overrides: profile?.manualOverrides || {},
    feedbackNote: loadFeedbackMemory().lastNote || '',
  }
}
