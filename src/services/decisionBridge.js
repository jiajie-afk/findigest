/**
 * Decision bridge: briefing adopt → position meaning (no trade execution).
 * Reuses hard constraints from constraints.js.
 */
import { getIndustry } from './industry.js'
import { extractConstraints, evaluateHoldings } from './constraints.js'

export const POSITION_SUGGESTION_KEY = 'fd_position_suggestion_v1'

const BULLISH = new Set(['opportunity', 'undervalued', 'catalyst'])
const BEARISH = new Set(['risk', 'overvalued', 'constraint'])

/**
 * @param {object} opts
 * @param {object} opts.focusItem - briefing item { type, code, title, blockedByConstraint? }
 * @param {array} opts.holdings
 * @param {object} [opts.constraints] - from extractConstraints; optional raw profile instead via opts.profile
 * @param {object} [opts.profile]
 * @param {number} [opts.totalMv]
 * @param {(code:string, fallback?:number)=>number} [opts.getPrice]
 * @returns {{
 *   action: 'add'|'trim'|'watch'|'hold'|'blocked',
 *   targetWeightBand: string,
 *   reason: string,
 *   blockedByConstraint?: string|null,
 *   code?: string|null,
 *   label?: string
 * }}
 */
export function suggestPositionDelta({
  focusItem,
  holdings = [],
  constraints: constraintsIn,
  profile,
  totalMv = 0,
  getPrice,
} = {}) {
  const item = focusItem || {}
  const code = item.code ? String(item.code) : null
  const constraints = constraintsIn || extractConstraints(profile || {}, profile || {})
  const type = item.type || 'other'

  const holding = code
    ? (holdings || []).find((h) => String(h.code) === code)
    : null

  let currentWeight = 0
  if (holding && totalMv > 0 && typeof getPrice === 'function') {
    const px = getPrice(holding.code, holding.cost)
    currentWeight = ((holding.shares || 0) * (px || 0) / totalMv) * 100
  } else if (holding && totalMv > 0) {
    currentWeight = ((holding.shares || 0) * (holding.cost || 0) / totalMv) * 100
  }

  const singleMax = constraints.singleStockMaxPct
  const industry = code ? getIndustry(code, holding?.name || item.title) : null

  if (item.blockedByConstraint) {
    return {
      action: 'blocked',
      targetWeightBand: holding ? `维持 ≤${fmtBand(currentWeight)}` : '不加仓',
      reason: '该条已因硬约束取消加仓倾向，默认先复盘。',
      blockedByConstraint: '硬约束优先于乐观信号',
      code,
      label: actionLabel('blocked'),
    }
  }

  if (code && industry && (constraints.avoidIndustries || []).includes(industry)) {
    return {
      action: 'blocked',
      targetWeightBand: holding ? `优先降至 0–${fmtBand(Math.min(currentWeight, 5))}` : '不新建仓',
      reason: `落在回避行业「${industry}」，建议不加仓。`,
      blockedByConstraint: `回避行业：${industry}`,
      code,
      label: actionLabel('blocked'),
    }
  }

  if (code && singleMax != null && currentWeight > singleMax + 0.5) {
    return {
      action: 'blocked',
      targetWeightBand: `压至 ≤${singleMax}%`,
      reason: `当前约 ${currentWeight.toFixed(1)}%，已超过单票上限 ${singleMax}%。`,
      blockedByConstraint: `单票上限 ${singleMax}%`,
      code,
      label: actionLabel('blocked'),
    }
  }

  if (BULLISH.has(type)) {
    if (!holding) {
      const cap = singleMax != null ? Math.min(8, singleMax) : 5
      return {
        action: 'watch',
        targetWeightBand: `观察 / 首次试探 0–${cap}%`,
        reason: '未持有该标的：可进观察名单；若建仓，先落在试探带并受单票上限约束。',
        blockedByConstraint: null,
        code,
        label: actionLabel('watch'),
      }
    }
    const room = singleMax != null ? Math.max(0, singleMax - currentWeight) : 5
    if (room < 1) {
      return {
        action: 'blocked',
        targetWeightBand: `维持 ≤${singleMax}%`,
        reason: '已接近单票上限，乐观信号不转化为加仓。',
        blockedByConstraint: `单票上限 ${singleMax}%`,
        code,
        label: actionLabel('blocked'),
      }
    }
    const high = Math.min(singleMax ?? currentWeight + room, currentWeight + Math.min(room, 5))
    return {
      action: 'add',
      targetWeightBand: `${fmtBand(currentWeight)} → ${fmtBand(currentWeight)}–${fmtBand(high)}`,
      reason: '采纳偏乐观信号：在硬约束内小幅抬升权重，而非追满。',
      blockedByConstraint: null,
      code,
      label: actionLabel('add'),
    }
  }

  if (BEARISH.has(type)) {
    if (!holding && !code) {
      return {
        action: 'hold',
        targetWeightBand: '组合风控优先',
        reason: '风险/约束提醒：优先复核敞口，不据此开新仓。',
        blockedByConstraint: null,
        code,
        label: actionLabel('hold'),
      }
    }
    if (!holding) {
      return {
        action: 'watch',
        targetWeightBand: '不新建仓',
        reason: '风险类信号且未持有：保持观察，避免借机开仓。',
        blockedByConstraint: null,
        code,
        label: actionLabel('watch'),
      }
    }
    const low = Math.max(0, currentWeight * 0.6)
    return {
      action: 'trim',
      targetWeightBand: `${fmtBand(currentWeight)} → ${fmtBand(low)}–${fmtBand(currentWeight)}`,
      reason: '采纳风险/高估提醒：倾向减仓或压低权重，仍须你自行确认。',
      blockedByConstraint: null,
      code,
      label: actionLabel('trim'),
    }
  }

  return {
    action: 'hold',
    targetWeightBand: holding ? `维持约 ${fmtBand(currentWeight)}` : '无仓位动作',
    reason: '信息型条目：记录偏好即可，默认不改变仓位带。',
    blockedByConstraint: null,
    code,
    label: actionLabel('hold'),
  }
}

function fmtBand(n) {
  if (n == null || Number.isNaN(n)) return '—'
  return `${Math.round(n * 10) / 10}%`
}

function actionLabel(action) {
  const map = {
    add: '加仓含义',
    trim: '减仓含义',
    watch: '观察含义',
    hold: '维持观察',
    blocked: '约束阻断',
  }
  return map[action] || '仓位含义'
}

/** Persist suggestion for Portfolio deep-link. */
export function stashPositionSuggestion(suggestion, meta = {}) {
  if (typeof sessionStorage === 'undefined') return
  try {
    sessionStorage.setItem(
      POSITION_SUGGESTION_KEY,
      JSON.stringify({
        ...suggestion,
        title: meta.title || null,
        at: Date.now(),
      }),
    )
  } catch {
    /* ignore */
  }
}

export function readPositionSuggestion() {
  if (typeof sessionStorage === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(POSITION_SUGGESTION_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function clearPositionSuggestion() {
  if (typeof sessionStorage === 'undefined') return
  try {
    sessionStorage.removeItem(POSITION_SUGGESTION_KEY)
  } catch {
    /* ignore */
  }
}

/**
 * One-line portfolio meaning for stock valuation conclusion.
 */
export function portfolioMeaningLine({ code, holdings, constraints, totalMv, getPrice, mos, fin }) {
  const holding = (holdings || []).find((h) => String(h.code) === String(code))
  const singleMax = constraints?.singleStockMaxPct
  let weight = 0
  if (holding && totalMv > 0) {
    const px = typeof getPrice === 'function' ? getPrice(holding.code, holding.cost) : holding.cost
    weight = ((holding.shares || 0) * (px || 0) / totalMv) * 100
  }

  if (!holding) {
    const cap = singleMax != null ? Math.min(8, singleMax) : 5
    return `对组合意味着什么：未持有 → 观察名单 / 首次仓位建议上限约 0–${cap}%（非下单指令）。`
  }

  if (singleMax != null && weight > singleMax + 0.5) {
    return `对组合意味着什么：已持有约 ${weight.toFixed(1)}%，触及单票上限 ${singleMax}% → 优先复盘而非加仓。`
  }

  const mosVal = mos ?? fin?.marginOfSafety
  if (mosVal != null && mosVal >= 15) {
    return `对组合意味着什么：已持有约 ${weight.toFixed(1)}%；保守安全边际偏正 → 可在上限内复核是否小幅加仓（研究含义，非荐股）。`
  }
  if (mosVal != null && mosVal < 0) {
    return `对组合意味着什么：已持有约 ${weight.toFixed(1)}%；安全边际偏负 → 倾向观察或压低权重。`
  }
  return `对组合意味着什么：已持有约 ${weight.toFixed(1)}%${singleMax != null ? `（单票上限 ${singleMax}%）` : ''} → 对照今日简报决定维持 / 微调。`
}

/** Convenience: evaluate holding rows with constraints (re-export pattern). */
export function holdingConstraintHits(holdings, totalMv, getPrice, constraints) {
  return evaluateHoldings(holdings, totalMv, getPrice, constraints)
}
