/**
 * FinDigest AI 用户画像引擎 — Layer 2/3/4
 * 精密行为事件 · 20 维特征 · 性格推断 · 反事实 · 个性化权重
 */

export {
  SCENARIO_QUESTIONS,
  SCENARIO_QUESTION_COUNT,
  ESSENTIAL_QUESTION_IDS,
  ESSENTIAL_QUESTION_COUNT,
  essentialsDone,
  PROFILE_SECTIONS,
  getSectionMeta,
  questionsInSection,
} from '@/data/profileQuestions.js'
import { SCENARIO_QUESTIONS, SCENARIO_QUESTION_COUNT, essentialsDone } from '@/data/profileQuestions.js'
import { vaultGet, vaultSet, getActiveAccountId } from '@/services/vault.js'

export const EVENT_TYPES = {
  PAGE_VIEW: 'page_view',
  PAGE_LEAVE: 'page_leave',
  SCROLL_DEPTH: 'scroll_depth',
  SECTION_FOCUS: 'section_focus',
  REVISIT: 'revisit',
  ANALYSIS_TRIGGER: 'analysis_trigger',
  ANALYSIS_COMPLETE: 'analysis_complete',
  DETAIL_EXPAND: 'detail_expand',
  DETAIL_COLLAPSE: 'detail_collapse',
  CHART_INTERACT: 'chart_interact',
  DIMENSION_CLICK: 'dimension_click',
  SUGGESTION_VIEW: 'suggestion_view',
  SUGGESTION_ADOPT: 'suggestion_adopt',
  SUGGESTION_IGNORE: 'suggestion_ignore',
  SUGGESTION_DEFER: 'suggestion_defer',
  SUGGESTION_REJECT: 'suggestion_reject',
  TRADE_BUY: 'trade_buy',
  TRADE_SELL: 'trade_sell',
  TRADE_ADD: 'trade_add',
  TRADE_REDUCE: 'trade_reduce',
  STOP_LOSS_SET: 'stop_loss_set',
  STOP_LOSS_HIT: 'stop_loss_hit',
  STOP_LOSS_IGNORE: 'stop_loss_ignore',
  PARAM_MODIFY: 'param_modify',
  WEIGHT_ADJUST: 'weight_adjust',
  THRESHOLD_CHANGE: 'threshold_change',
  FEEDBACK_POSITIVE: 'feedback_positive',
  FEEDBACK_NEGATIVE: 'feedback_negative',
  FEEDBACK_COMMENT: 'feedback_comment',
}

export const DEFAULT_FEATURES = {
  analysisDepth: 0.5,
  dataOrientedness: 0.5,
  newsEngagement: 0.5,
  decisionSpeed: 0.5,
  consistencyScore: 0.5,
  contrarianIndex: 0.5,
  momentumFollowing: 0.5,
  actualRiskTolerance: 0.5,
  stopLossAdherence: 0.5,
  panicSellFrequency: 0.5,
  lossAversionActual: 0.5,
  valuationSensitivity: 0.5,
  sentimentSensitivity: 0.5,
  catalystSensitivity: 0.5,
  riskSensitivity: 0.5,
  growthSensitivity: 0.5,
  fundamentalFocus: 0.5,
  technicalFocus: 0.5,
  tradingFrequency: 0.5,
  holdingPatience: 0.5,
  diversificationTendency: 0.5,
  sectorRotationActivity: 0.5,
}

export const DEFAULT_PROFILE = {
  age: null,
  career: '',
  investExperience: null,
  bearMarketExperience: null,
  totalCapital: null,
  incomeSource: '',
  capitalRole: null,
  cashFlow: null,
  incomeStability: null,
  knowledgeEdge: null,
  socialPressure: null,
  timeBudget: null,
  taxSensitivity: null,
  trustAi: null,
  cashBias: null,
  avoidCyclical: null,
  tradingFrequencyHint: null,
  endowmentBias: null,
  FOMO: null,
  overconfidence: null,
  profileDepthWanted: null,
  philosophy: {
    valueVsGrowth: 3,
    fundamentalVsTechnical: 3,
    activeVsPassive: 3,
    contrarianVsMomentum: 3,
    集中Vs分散: 3,
  },
  risk: {
    maxDrawdown: null,
    singleStockMax: null,
    leverageUsage: 'none',
    stopLossDiscipline: 3,
    panicSellHistory: null,
    lossAversion: 3,
  },
  preferredIndustries: [],
  avoidIndustries: [],
  marketCapPreference: 'all',
  exchangePreference: 'all',
  dimensionWeights: {
    ratings: null,
    fundamental: null,
    valuation: null,
    moat: null,
    growth: null,
    capital: null,
    catalyst: null,
    risk: null,
    sentiment: null,
    macro: null,
  },
  valuationPreferred: 'auto',
  newsSourcePreference: [],
  decisionSpeed: 'moderate',
  confirmationBias: null,
  anchorEffect: null,
  herdTendency: null,
  onboardingDone: false,
  essentialsDone: false,
  profileVersion: 3,
  scenarioProgress: 0,
  lastCalibration: null,
  /**
   * 产品版本：basic=免费基础版（Museum Desk，新用户默认）；pro=Pro Desk（开通付费 Pro 后启用）
   */
  productEdition: 'basic',
  /** 情景题答案记录 */
  scenarioAnswers: {},
  /** 用户在画像说明书中的手动纠错 */
  manualOverrides: {},
  /** 人生现金流层 */
  life: {
    moneyNeedHorizon: null,
    hasMortgage: null,
    dependents: null,
    emergencyMonths: null,
    monthlySurplus: null,
  },
}

const EMA_ALPHA = 0.1
const DB_NAME = 'findigest_profiling'
const DB_VERSION = 1
const EVENTS_STORE = 'events'
const VERIFICATIONS_KEY = 'fd_verifications'
const VERIFICATIONS_LEGACY = 'fd_suggestion_verifications'
const FEATURES_KEY = 'fd_features'
const FEATURES_LEGACY = 'fd_user_features'
const PERSONALITY_KEY = 'fd_personality_tags'
const PERSONALITY_LEGACY = 'fd_user_personality'
const EVENTS_FALLBACK_KEY = 'fd_behavior_events_fallback'

function readPrefVault(base, legacyKey, fallback) {
  try {
    if (getActiveAccountId()) {
      const v = vaultGet(base, null)
      if (v != null) return v
    }
    const raw = localStorage.getItem(legacyKey) || localStorage.getItem(base)
    if (raw == null) return fallback
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

function writePrefVault(base, legacyKey, value) {
  if (getActiveAccountId()) {
    vaultSet(base, value)
    try {
      localStorage.removeItem(legacyKey)
      localStorage.removeItem(base)
    } catch {
      /* ignore */
    }
    return
  }
  localStorage.setItem(legacyKey, JSON.stringify(value))
}

function ema(current, target, alpha) {
  return current * (1 - alpha) + target * alpha
}

function clamp01(n) {
  return Math.max(0, Math.min(1, n))
}

function uuid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `e_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

export function createEvent(type, payload = {}) {
  return {
    id: uuid(),
    type,
    ts: Date.now(),
    stockCode: payload.stockCode || null,
    stockName: payload.stockName || null,
    industry: payload.industry || null,
    duration: payload.duration ?? null,
    scrollPercent: payload.scrollPercent ?? null,
    section: payload.section || null,
    suggestionType: payload.suggestionType || null,
    suggestionContent: payload.suggestionContent || null,
    suggestionShownAt: payload.suggestionShownAt ?? null,
    currentPrice: payload.currentPrice ?? null,
    targetPrice: payload.targetPrice ?? null,
    tradeAmount: payload.tradeAmount ?? null,
    tradePrice: payload.tradePrice ?? null,
    portfolioImpact: payload.portfolioImpact ?? null,
    paramName: payload.paramName || null,
    oldValue: payload.oldValue ?? null,
    newValue: payload.newValue ?? null,
    marketState: payload.marketState || null,
    sentimentScore: payload.sentimentScore ?? null,
  }
}

let _dbPromise = null
/** In-memory ring buffer so feature updates don't re-scan IndexedDB every event */
const _recentEvents = []
const RECENT_CAP = 800

function rememberEvent(event) {
  _recentEvents.push(event)
  if (_recentEvents.length > RECENT_CAP) _recentEvents.splice(0, _recentEvents.length - RECENT_CAP)
}

export function getRecentEventsSnapshot() {
  return _recentEvents.slice()
}

/** Warm the in-memory ring from IndexedDB (call on app start / recalibrate) */
export function hydrateRecentEvents(events = []) {
  _recentEvents.length = 0
  const sorted = events.slice().sort((a, b) => a.ts - b.ts)
  for (const e of sorted.slice(-RECENT_CAP)) _recentEvents.push(e)
  return _recentEvents.length
}

function openDB() {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null)
  if (_dbPromise) return _dbPromise
  _dbPromise = new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION)
      req.onupgradeneeded = (e) => {
        const db = e.target.result
        if (!db.objectStoreNames.contains(EVENTS_STORE)) {
          const store = db.createObjectStore(EVENTS_STORE, { keyPath: 'id' })
          store.createIndex('ts', 'ts')
          store.createIndex('type', 'type')
          store.createIndex('stockCode', 'stockCode')
        }
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => {
        _dbPromise = null
        resolve(null)
      }
    } catch {
      _dbPromise = null
      resolve(null)
    }
  })
  return _dbPromise
}

export async function saveEvent(event) {
  rememberEvent(event)
  try {
    const db = await openDB()
    if (!db) {
      const existing = readPrefVault(EVENTS_FALLBACK_KEY, EVENTS_FALLBACK_KEY, [])
      const list = Array.isArray(existing) ? existing.slice() : []
      list.push(event)
      writePrefVault(EVENTS_FALLBACK_KEY, EVENTS_FALLBACK_KEY, list.slice(-400))
      return event
    }
    await new Promise((resolve, reject) => {
      const tx = db.transaction(EVENTS_STORE, 'readwrite')
      tx.objectStore(EVENTS_STORE).put(event)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch {
    /* ignore storage errors */
  }
  return event
}

export async function loadEvents({ since = 0, limit = 2000 } = {}) {
  try {
    const db = await openDB()
    if (!db) {
      const fallback = Array.isArray(readPrefVault(EVENTS_FALLBACK_KEY, EVENTS_FALLBACK_KEY, []))
        ? readPrefVault(EVENTS_FALLBACK_KEY, EVENTS_FALLBACK_KEY, [])
        : []
      return fallback.filter((e) => e.ts >= since).slice(-limit)
    }
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(EVENTS_STORE, 'readonly')
      const store = tx.objectStore(EVENTS_STORE)
      const idx = store.index('ts')
      const range = IDBKeyRange.lowerBound(since)
      const req = idx.openCursor(range, 'prev')
      const out = []
      req.onsuccess = () => {
        const cursor = req.result
        if (!cursor || out.length >= limit) {
          resolve(out.reverse())
          return
        }
        out.push(cursor.value)
        cursor.continue()
      }
      req.onerror = () => reject(req.error)
    })
  } catch {
    return []
  }
}

function suggestionToDimension(type) {
  const map = {
    valuation: 'valuation',
    undervalued: 'valuation',
    overvalued: 'valuation',
    sentiment: 'sentiment',
    opportunity: 'sentiment',
    catalyst: 'catalyst',
    risk: 'risk',
    growth: 'growth',
    industry: 'sentiment',
  }
  return map[type] || null
}

function countFrequency(arr) {
  const m = {}
  arr.forEach((x) => {
    m[x] = (m[x] || 0) + 1
  })
  return m
}

function calculateAvgHoldingDays(trades) {
  const buys = {}
  const holds = []
  trades
    .slice()
    .sort((a, b) => a.ts - b.ts)
    .forEach((t) => {
      if (!t.stockCode) return
      if (t.type === EVENT_TYPES.TRADE_BUY || t.type === EVENT_TYPES.TRADE_ADD) {
        buys[t.stockCode] = t.ts
      }
      if (t.type === EVENT_TYPES.TRADE_SELL || t.type === EVENT_TYPES.TRADE_REDUCE) {
        if (buys[t.stockCode]) {
          holds.push((t.ts - buys[t.stockCode]) / (24 * 3600 * 1000))
          delete buys[t.stockCode]
        }
      }
    })
  if (!holds.length) return 90
  return holds.reduce((a, b) => a + b, 0) / holds.length
}

export function updateFeatures(features, event, allEvents) {
  const f = { ...DEFAULT_FEATURES, ...features }

  switch (event.type) {
    case EVENT_TYPES.SCROLL_DEPTH:
      if (event.scrollPercent != null) {
        f.analysisDepth = ema(f.analysisDepth, event.scrollPercent / 100, EMA_ALPHA)
      }
      break
    case EVENT_TYPES.SECTION_FOCUS:
      if (event.section === 'valuation' || event.section === 'dcf') {
        f.valuationSensitivity = ema(f.valuationSensitivity, 1, EMA_ALPHA)
      }
      if (event.section === 'sentiment' || event.section === 'news') {
        f.sentimentSensitivity = ema(f.sentimentSensitivity, 1, EMA_ALPHA)
        f.newsEngagement = ema(f.newsEngagement, 1, EMA_ALPHA)
      }
      if (event.section === 'metrics' || event.section === 'financial') {
        f.fundamentalFocus = ema(f.fundamentalFocus, 1, EMA_ALPHA)
        f.dataOrientedness = ema(f.dataOrientedness, 1, EMA_ALPHA)
      }
      if (event.section === 'logic' || event.section === 'narrative') {
        f.dataOrientedness = ema(f.dataOrientedness, 0, EMA_ALPHA)
      }
      break
    case EVENT_TYPES.SUGGESTION_ADOPT:
    case EVENT_TYPES.FEEDBACK_POSITIVE: {
      const dim = suggestionToDimension(event.suggestionType)
      if (dim && f[`${dim}Sensitivity`] !== undefined) {
        f[`${dim}Sensitivity`] = ema(f[`${dim}Sensitivity`], 1, EMA_ALPHA)
      }
      if (event.suggestionShownAt) {
        const normalizedSpeed = Math.min((event.ts - event.suggestionShownAt) / (24 * 3600 * 1000), 1)
        f.decisionSpeed = ema(f.decisionSpeed, normalizedSpeed, EMA_ALPHA)
      }
      break
    }
    case EVENT_TYPES.SUGGESTION_IGNORE:
    case EVENT_TYPES.FEEDBACK_NEGATIVE: {
      const dim = suggestionToDimension(event.suggestionType)
      if (dim && f[`${dim}Sensitivity`] !== undefined) {
        f[`${dim}Sensitivity`] = ema(f[`${dim}Sensitivity`], 0, EMA_ALPHA)
      }
      break
    }
    case EVENT_TYPES.SUGGESTION_REJECT:
      f.consistencyScore = ema(f.consistencyScore, 0, 0.2)
      break
    case EVENT_TYPES.TRADE_BUY:
    case EVENT_TYPES.TRADE_ADD: {
      if (event.sentimentScore != null && event.sentimentScore < -20) {
        f.contrarianIndex = ema(f.contrarianIndex, 1, EMA_ALPHA)
      } else if (event.sentimentScore != null && event.sentimentScore > 20) {
        f.momentumFollowing = ema(f.momentumFollowing, 1, EMA_ALPHA)
      }
      if (event.currentPrice && event.targetPrice) {
        const premium = (event.currentPrice - event.targetPrice) / event.targetPrice
        if (premium > 0.1) f.momentumFollowing = ema(f.momentumFollowing, 1, EMA_ALPHA)
      }
      break
    }
    case EVENT_TYPES.STOP_LOSS_HIT:
      f.stopLossAdherence = ema(f.stopLossAdherence, 1, EMA_ALPHA)
      break
    case EVENT_TYPES.STOP_LOSS_IGNORE:
      f.stopLossAdherence = ema(f.stopLossAdherence, 0, 0.2)
      f.lossAversionActual = ema(f.lossAversionActual, 1, EMA_ALPHA)
      break
    case EVENT_TYPES.PAGE_LEAVE:
      if (event.duration) {
        const normalizedDuration = Math.min(event.duration / 120000, 1)
        f.analysisDepth = ema(f.analysisDepth, normalizedDuration, EMA_ALPHA)
      }
      break
    default:
      break
  }

  const trades = allEvents.filter((e) =>
    [EVENT_TYPES.TRADE_BUY, EVENT_TYPES.TRADE_SELL, EVENT_TYPES.TRADE_ADD, EVENT_TYPES.TRADE_REDUCE].includes(e.type),
  )
  if (trades.length >= 4) {
    f.holdingPatience = clamp01(calculateAvgHoldingDays(trades) / 365)
  }
  const recentTrades = trades.filter((e) => e.ts > Date.now() - 30 * 24 * 3600 * 1000)
  f.tradingFrequency = clamp01(recentTrades.length / 30)
  const buyCodes = new Set(allEvents.filter((e) => e.type === EVENT_TYPES.TRADE_BUY).map((e) => e.stockCode).filter(Boolean))
  f.diversificationTendency = clamp01(buyCodes.size / 30)

  return f
}

export function inferPersonality(features, explicitProfile) {
  const tags = []
  const f = { ...DEFAULT_FEATURES, ...features }

  if (f.fundamentalFocus > 0.7 && f.dataOrientedness > 0.6) {
    tags.push({ tag: '深度研究型', confidence: 0.8, desc: '偏好阅读财报和数据，较少受情绪影响' })
  }
  if (f.sentimentSensitivity > 0.7 && f.newsEngagement > 0.6) {
    tags.push({ tag: '信息驱动型', confidence: 0.7, desc: '对新闻和市场情绪高度敏感' })
  }
  if (f.technicalFocus > 0.7) {
    tags.push({ tag: '图表交易型', confidence: 0.8, desc: '主要依据技术分析做决策' })
  }
  if (f.valuationSensitivity > 0.7 && f.analysisDepth > 0.6) {
    tags.push({ tag: '估值锚定型', confidence: 0.8, desc: '决策高度依赖估值计算' })
  }
  if (f.decisionSpeed < 0.3) {
    tags.push({ tag: '冲动决策者', confidence: 0.7, desc: '看到机会会快速行动，需要提醒风险' })
  }
  if (f.decisionSpeed > 0.7) {
    tags.push({ tag: '谨慎决策者', confidence: 0.7, desc: '需要充分信息才会行动，适合深度报告' })
  }
  if (f.contrarianIndex > 0.7) {
    tags.push({ tag: '逆向投资者', confidence: 0.8, desc: '喜欢在恐慌中买入，需要关注估值底部' })
  }
  if (f.momentumFollowing > 0.7) {
    tags.push({ tag: '趋势跟随者', confidence: 0.8, desc: '跟随趋势操作，需要关注突破信号' })
  }
  if (f.panicSellFrequency > 0.5) {
    tags.push({ tag: '易恐慌型', confidence: 0.9, desc: '在大跌时容易做出非理性决策，需要冷静提醒' })
  }
  if (f.lossAversionActual > 0.7 && f.stopLossAdherence < 0.3) {
    tags.push({ tag: '深度套牢型', confidence: 0.8, desc: '不愿止损，倾向于死扛亏损股' })
  }
  if (f.actualRiskTolerance > 0.7 && f.holdingPatience > 0.6) {
    tags.push({ tag: '耐心猎手型', confidence: 0.8, desc: '能承受大幅波动，等待最佳时机' })
  }

  const claimedStyle = explicitProfile?.philosophy?.valueVsGrowth
  if (claimedStyle != null && claimedStyle <= 2 && f.momentumFollowing > 0.6) {
    tags.push({ tag: '认知偏差警告', confidence: 0.9, desc: '自称偏价值，但行为显示追涨倾向' })
  }
  if (claimedStyle != null && claimedStyle >= 4 && f.contrarianIndex > 0.6) {
    tags.push({ tag: '认知偏差警告', confidence: 0.9, desc: '自称偏成长，但行为显示逆势倾向' })
  }

  // Seed from explicit philosophy when behavior sparse
  if (tags.length < 2 && explicitProfile?.philosophy) {
    const p = explicitProfile.philosophy
    if (p.valueVsGrowth <= 2) tags.push({ tag: '价值声明型', confidence: 0.55, desc: '问卷显示偏价值投资' })
    if (p.valueVsGrowth >= 4) tags.push({ tag: '成长声明型', confidence: 0.55, desc: '问卷显示偏成长投资' })
    if (p.fundamentalVsTechnical <= 2) tags.push({ tag: '基本面声明型', confidence: 0.55, desc: '问卷显示偏基本面研究' })
    if (p.contrarianVsMomentum <= 2) tags.push({ tag: '逆向声明型', confidence: 0.55, desc: '问卷显示偏逆向抄底' })
  }

  return tags.sort((a, b) => b.confidence - a.confidence)
}

export function identifyDecisionPatterns(events) {
  const patterns = { buyPatterns: [], sellPatterns: [] }
  const buyEvents = events.filter((e) => e.type === EVENT_TYPES.TRADE_BUY)
  const sellEvents = events.filter((e) => e.type === EVENT_TYPES.TRADE_SELL)

  for (const buy of buyEvents) {
    const priorViews = events.filter(
      (e) =>
        e.type === EVENT_TYPES.PAGE_VIEW &&
        e.stockCode === buy.stockCode &&
        e.ts < buy.ts &&
        e.ts > buy.ts - 7 * 24 * 3600 * 1000,
    )
    const priorSections = events
      .filter(
        (e) =>
          e.type === EVENT_TYPES.SECTION_FOCUS &&
          e.stockCode === buy.stockCode &&
          e.ts < buy.ts &&
          e.ts > buy.ts - 7 * 24 * 3600 * 1000,
      )
      .map((v) => v.section)
      .filter(Boolean)
    patterns.buyPatterns.push({
      stockCode: buy.stockCode,
      priorSections: countFrequency(priorSections),
      sentimentAtBuy: buy.sentimentScore,
      daysSinceFirstView: priorViews.length
        ? (buy.ts - Math.min(...priorViews.map((v) => v.ts))) / (24 * 3600 * 1000)
        : 0,
    })
  }

  for (const sell of sellEvents) {
    const priorSuggestion = events.find(
      (e) =>
        e.type === EVENT_TYPES.SUGGESTION_VIEW &&
        e.stockCode === sell.stockCode &&
        e.ts < sell.ts &&
        e.ts > sell.ts - 3 * 24 * 3600 * 1000,
    )
    patterns.sellPatterns.push({
      stockCode: sell.stockCode,
      triggeredBySuggestion: !!priorSuggestion,
      suggestionType: priorSuggestion?.suggestionType || null,
      sentimentAtSell: sell.sentimentScore,
      profitOrLoss: sell.tradeAmount,
    })
  }
  return patterns
}

function maxDrawdownDepthToRisk(depth) {
  // depth 0.1 → low risk tol as number; map to 0-1 scale (higher = can take more risk)
  if (depth == null) return null
  return clamp01(depth / 0.5)
}

export function calibrateRiskTolerance(features, explicitProfile, portfolioSnapshot = null) {
  const calibration = {
    declared: null,
    behavioral: null,
    actual: null,
    confidence: 0,
  }

  const dd = explicitProfile?.risk?.maxDrawdown
  if (dd) {
    const n = parseInt(String(dd).replace('%', ''), 10)
    if (!Number.isNaN(n)) calibration.declared = clamp01(n / 50)
  }

  // From features when no portfolio history
  calibration.behavioral = features.actualRiskTolerance
  if (explicitProfile?.risk?.lossAversion != null) {
    const la = explicitProfile.risk.lossAversion
    calibration.behavioral = ema(calibration.behavioral, 1 - (la - 1) / 4, 0.3)
  }
  if (explicitProfile?.risk?.panicSellHistory) {
    calibration.behavioral = ema(calibration.behavioral, 0.25, 0.2)
  }

  if (portfolioSnapshot?.maxWeight != null && portfolioSnapshot.maxWeight > 0.3) {
    calibration.behavioral = Math.max(calibration.behavioral || 0, 0.7)
    calibration.confidence = Math.max(calibration.confidence, 0.4)
  }

  calibration.confidence = Math.max(calibration.confidence, features.analysisDepth > 0.5 ? 0.35 : 0.2)
  calibration.actual =
    calibration.behavioral != null
      ? calibration.behavioral * 0.7 + (calibration.declared ?? 0.5) * 0.3
      : calibration.declared ?? 0.5

  void maxDrawdownDepthToRisk
  return calibration
}

function calculateFeatureSnapshot(events) {
  let f = { ...DEFAULT_FEATURES }
  events.forEach((e) => {
    f = updateFeatures(f, e, events)
  })
  return f
}

export function detectPreferenceDrift(events) {
  const now = Date.now()
  const recent30d = events.filter((e) => e.ts > now - 30 * 24 * 3600 * 1000)
  const prior90d = events.filter(
    (e) => e.ts > now - 120 * 24 * 3600 * 1000 && e.ts <= now - 30 * 24 * 3600 * 1000,
  )

  if (recent30d.length < 10 || prior90d.length < 10) {
    return {
      drift: null,
      confidence: 0,
      msg: '数据不足，无法判断偏好变化',
      reasons: [],
      sampleInsufficient: true,
    }
  }

  const recentFeatures = calculateFeatureSnapshot(recent30d)
  const priorFeatures = calculateFeatureSnapshot(prior90d)
  const drifts = []
  const reasons = []
  const dimLabel = {
    valuationSensitivity: '估值敏感',
    sentimentSensitivity: '情绪敏感',
    catalystSensitivity: '催化敏感',
    riskSensitivity: '风险敏感',
    growthSensitivity: '成长敏感',
    fundamentalFocus: '基本面关注',
    panicSellFrequency: '恐慌卖出倾向',
    holdingPatience: '持有耐心',
  }
  for (const key of Object.keys(recentFeatures)) {
    const diff = recentFeatures[key] - priorFeatures[key]
    if (Math.abs(diff) > 0.15) {
      const entry = {
        dimension: key,
        direction: diff > 0 ? 'increased' : 'decreased',
        magnitude: Math.abs(diff),
        recent: recentFeatures[key],
        prior: priorFeatures[key],
      }
      drifts.push(entry)
      const label = dimLabel[key] || key
      reasons.push({
        dimension: key,
        text: `${label}${diff > 0 ? '上升' : '下降'}（近30日 vs 前90日）`,
        direction: entry.direction,
        magnitude: entry.magnitude,
      })
    }
  }

  if (!drifts.length) {
    return { drift: null, confidence: 0.8, msg: '偏好稳定', reasons: [], sampleInsufficient: false }
  }
  return {
    drift: drifts.sort((a, b) => b.magnitude - a.magnitude),
    confidence: Math.min(recent30d.length / 50, 0.9),
    msg: `检测到 ${drifts.length} 个维度的偏好变化`,
    reasons,
    sampleInsufficient: false,
  }
}

const WEIGHT_DIM_LABEL = {
  ratings: '评级',
  fundamental: '基本面',
  valuation: '估值',
  moat: '护城河',
  growth: '成长',
  capital: '资金',
  catalyst: '催化',
  risk: '风险',
  sentiment: '情绪',
  macro: '宏观',
}

/**
 * Human-readable weight-adjustment contract for passport / toasts.
 * @returns {{
 *   sampleInsufficient: boolean,
 *   items: Array<{ text: string, source: string }>,
 *   sentence: string,
 *   weightDeltas: Array<{ key: string, label: string, delta: number }>
 * }}
 */
export function explainWeightAdjustments({ events = [], weights = null, drift = null } = {}) {
  const items = []
  const list = Array.isArray(events) ? events : []
  const recent = list.filter((e) => e && e.ts > Date.now() - 45 * 24 * 3600 * 1000)

  const adopt = recent.filter((e) => e.type === EVENT_TYPES.SUGGESTION_ADOPT)
  const reject = recent.filter((e) => e.type === EVENT_TYPES.SUGGESTION_REJECT)
  const ignore = recent.filter((e) => e.type === EVENT_TYPES.SUGGESTION_IGNORE)

  const countBySuggestion = (arr) => {
    const m = {}
    arr.forEach((e) => {
      const k = e.suggestionType || e.payload?.suggestionType || 'other'
      m[k] = (m[k] || 0) + 1
    })
    return m
  }

  const rejectMap = countBySuggestion(reject)
  Object.entries(rejectMap).forEach(([k, n]) => {
    if (n < 2) return
    if (['opportunity', 'undervalued', 'catalyst'].includes(k)) {
      items.push({
        source: 'reject',
        text: `因 REJECT 偏乐观/加仓类建议 ×${n}，已降低成长/催化相关排序权重`,
      })
    } else {
      items.push({ source: 'reject', text: `因 REJECT「${k}」类建议 ×${n}，同类优先级下调` })
    }
  })

  const adoptMap = countBySuggestion(adopt)
  Object.entries(adoptMap).forEach(([k, n]) => {
    if (n < 2) return
    if (['risk', 'overvalued', 'constraint'].includes(k)) {
      items.push({
        source: 'adopt',
        text: `因 ADOPT 风控/约束提醒 ×${n}，已提高风险类建议权重`,
      })
    }
  })

  if (ignore.length >= 4) {
    items.push({
      source: 'ignore',
      text: `因 IGNORE 一般提示 ×${ignore.length}，已压缩低优先级噪音`,
    })
  }

  const driftReasons = drift?.reasons || []
  driftReasons.slice(0, 3).forEach((r) => {
    items.push({ source: 'drift', text: r.text || String(r) })
  })

  const base = {
    ratings: 20,
    fundamental: 15,
    valuation: 15,
    moat: 10,
    growth: 10,
    capital: 10,
    catalyst: 10,
    risk: 10,
    sentiment: 5,
    macro: 5,
  }
  const weightDeltas = []
  if (weights && typeof weights === 'object') {
    for (const key of Object.keys(base)) {
      if (weights[key] == null) continue
      const delta = weights[key] - base[key]
      if (Math.abs(delta) >= 3) {
        weightDeltas.push({
          key,
          label: WEIGHT_DIM_LABEL[key] || key,
          delta,
        })
      }
    }
    weightDeltas.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    weightDeltas.slice(0, 4).forEach((d) => {
      items.push({
        source: 'weight',
        text: `当前「${d.label}」权重相对默认 ${d.delta > 0 ? '+' : ''}${d.delta}`,
      })
    })
  }

  const sampleInsufficient = items.length === 0 && recent.length < 6
  let sentence = ''
  if (sampleInsufficient) {
    sentence = '样本不足：尚无足够 ADOPT/REJECT 信号解释调权'
  } else if (items.length) {
    sentence = items[0].text
  } else {
    sentence = '近期反馈未形成显著调权；权重仍接近默认'
  }

  return { sampleInsufficient, items: items.slice(0, 8), sentence, weightDeltas }
}

export function generatePersonalWeights(features, personality, explicitProfile) {
  const base = {
    ratings: 20,
    fundamental: 15,
    valuation: 15,
    moat: 10,
    growth: 10,
    capital: 10,
    catalyst: 10,
    risk: 10,
    sentiment: 5,
    macro: 5,
  }

  const userWeights = explicitProfile?.dimensionWeights || {}
  for (const key of Object.keys(userWeights)) {
    if (userWeights[key] != null) base[key] = userWeights[key]
  }

  const f = { ...DEFAULT_FEATURES, ...features }
  if (f.valuationSensitivity > 0.7) base.valuation += 5
  if (f.sentimentSensitivity > 0.7) base.sentiment += 5
  if (f.fundamentalFocus > 0.7) base.fundamental += 5
  if (f.catalystSensitivity > 0.7) base.catalyst += 5

  for (const p of personality || []) {
    if (p.tag === '深度研究型' && p.confidence > 0.7) {
      base.fundamental += 5
      base.moat += 3
    }
    if (p.tag === '信息驱动型' && p.confidence > 0.7) {
      base.sentiment += 5
      base.catalyst += 3
    }
    if (p.tag === '易恐慌型' && p.confidence > 0.7) base.risk += 10
    if (p.tag === '深度套牢型' && p.confidence > 0.7) {
      base.risk += 8
      base.valuation += 5
    }
    if (p.tag === '趋势跟随者' && p.confidence > 0.7) {
      base.capital += 5
      base.sentiment += 3
    }
  }

  const total = Object.values(base).reduce((a, b) => a + b, 0) || 1
  for (const key of Object.keys(base)) {
    base[key] = Math.round((base[key] / total) * 100)
  }
  return base
}

function topSections(buyPatterns) {
  const all = {}
  buyPatterns.forEach((p) => {
    Object.entries(p.priorSections || {}).forEach(([k, v]) => {
      all[k] = (all[k] || 0) + v
    })
  })
  return (
    Object.entries(all)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([k]) => k)
      .join('、') || '综合信息'
  )
}

export function buildPersonalizedPrompt(features, personality, patterns, riskCalibration, driftAnalysis, explicitProfile) {
  const f = { ...DEFAULT_FEATURES, ...features }
  const xp = explicitProfile || {}
  const answered = xp.scenarioProgress || Object.keys(xp.scenarioAnswers || {}).length || 0
  const ph = xp.philosophy || {}
  const rk = xp.risk || {}
  const personalityDesc = (personality || [])
    .filter((p) => p.confidence > 0.6)
    .map((p) => `- ${p.tag}（置信度 ${Math.round(p.confidence * 100)}%）：${p.desc}`)
    .join('\n')

  const driftWarning = driftAnalysis?.drift
    ? `\n⚠️ 偏好漂移检测：\n${driftAnalysis.drift
        .map((d) => `  - ${d.dimension}: 从 ${d.prior.toFixed(2)} → ${d.recent.toFixed(2)}（${d.direction}）`)
        .join('\n')}`
    : ''

  return `你是一个顶级的私人投资管家，正在为一位深度定制用户生成今日分析报告。

## 用户画像（请严格基于此画像调整你的分析风格和建议）

### 私人定制进度
- 情景题 ${answered}/${SCENARIO_QUESTION_COUNT}${xp.onboardingDone ? '（已完成）' : '（未完成：建议偏保守，并提示去设置补全）'}
- 资金角色：${xp.capitalRole || '未标注'} · 现金流：${xp.cashFlow || '未标注'} · 时间预算：${xp.timeBudget || '未标注'}
- 信任管家：${xp.trustAi ?? '—'} · 期望深度：${xp.profileDepthWanted || '—'}

### 显式哲学（1–5）
- 价值↔成长 ${ph.valueVsGrowth ?? 3} · 基本面↔技术 ${ph.fundamentalVsTechnical ?? 3}
- 长持↔交易 ${ph.activeVsPassive ?? 3} · 逆向↔动量 ${ph.contrarianVsMomentum ?? 3} · 集中↔分散 ${ph.集中Vs分散 ?? 3}
- 回撤容忍 ${rk.maxDrawdown || '—'} · 单票上限 ${rk.singleStockMax || '—'} · 止损纪律 ${rk.stopLossDiscipline ?? '—'} · 损失厌恶 ${rk.lossAversion ?? '—'}
- 估值偏好 ${xp.valuationPreferred || 'auto'} · 决策速度 ${xp.decisionSpeed || 'moderate'}
- 锚定 ${xp.anchorEffect ?? '—'} · 确认偏误 ${xp.confirmationBias ?? '—'} · 从众 ${xp.herdTendency ?? '—'} · FOMO ${xp.FOMO ?? '—'}

### 投资性格
${personalityDesc || '（数据不足，暂无性格标签）'}

### 行为特征（20维向量摘要）
- 分析深度：${(f.analysisDepth * 100).toFixed(0)}%（越高越喜欢深入研究）
- 决策速度：${(f.decisionSpeed * 100).toFixed(0)}%（越高越谨慎）
- 逆向倾向：${(f.contrarianIndex * 100).toFixed(0)}%
- 追涨倾向：${(f.momentumFollowing * 100).toFixed(0)}%
- 止损纪律：${(f.stopLossAdherence * 100).toFixed(0)}%
- 估值敏感度：${(f.valuationSensitivity * 100).toFixed(0)}%
- 情绪敏感度：${(f.sentimentSensitivity * 100).toFixed(0)}%

### 风险承受力（动态校准）
- 用户自评：${riskCalibration?.declared ?? '未填写'}
- 行为推断：${riskCalibration?.behavioral?.toFixed?.(2) ?? riskCalibration?.behavioral ?? '数据不足'}
- 综合判定：${riskCalibration?.actual?.toFixed?.(2) ?? riskCalibration?.actual ?? '默认中等'}
- 校准置信度：${((riskCalibration?.confidence || 0) * 100).toFixed(0)}%
${driftWarning}

### 决策模式
${
  patterns?.buyPatterns?.length > 0
    ? `买入前行为：通常在查看 ${topSections(patterns.buyPatterns)} 后 ${patterns.buyPatterns[0]?.daysSinceFirstView?.toFixed?.(0) || '?'} 天内做出决策`
    : '（数据不足）'
}

## 分析要求

1. **语言风格**：${f.analysisDepth > 0.6 ? '详细、数据密集、附上完整逻辑链' : '简洁、重点突出、给出明确结论'}
2. **风险提示强度**：${(riskCalibration?.actual ?? 0.5) > 0.7 ? '弱化风险提示，用户风险承受力强' : (riskCalibration?.actual ?? 0.5) < 0.3 ? '强化风险提示，用户风险承受力弱' : '标准风险提示'}
3. **估值方法偏好**：${f.valuationSensitivity > 0.6 ? '重点展示估值推导过程' : '简要提及估值结论'}
4. **情绪分析权重**：${f.sentimentSensitivity > 0.6 ? '详细展示情绪面分析' : '仅在情绪异常时提及'}
5. **建议确认度**：${f.decisionSpeed < 0.3 ? '给出明确的买入/卖出建议' : '给出建议但强调需要用户自行验证'}
6. **私人定制**：重要建议须引用用户约束（回撤/单票/风格）；与画像冲突时标明「与画像冲突」。

请基于以上用户画像，为以下持仓生成个性化分析报告。
`
}

function loadVerifications() {
  const list = readPrefVault(VERIFICATIONS_KEY, VERIFICATIONS_LEGACY, [])
  return Array.isArray(list) ? list : []
}

function saveVerifications(list) {
  writePrefVault(VERIFICATIONS_KEY, VERIFICATIONS_LEGACY, list.slice(-200))
}

export function recordIgnoredSuggestion(event) {
  const list = loadVerifications()
  list.push({
    id: event.id,
    stockCode: event.stockCode,
    suggestionType: event.suggestionType,
    suggestedAction: event.suggestionContent,
    priceAtSuggestion: event.currentPrice,
    priceAtTarget: event.targetPrice,
    ignoredAt: event.ts,
    checkAt7d: event.ts + 7 * 24 * 3600 * 1000,
    checkAt30d: event.ts + 30 * 24 * 3600 * 1000,
    result7d: null,
    result30d: null,
  })
  saveVerifications(list)
}

function isSuggestionCorrect(action, priceAtSuggestion, priceNow) {
  if (priceAtSuggestion == null || priceNow == null || !priceAtSuggestion) return false
  const change = (priceNow - priceAtSuggestion) / priceAtSuggestion
  if (action === 'buy' || action === 'add' || action === 'opportunity' || action === 'undervalued') return change > 0.03
  if (action === 'sell' || action === 'reduce' || action === 'risk' || action === 'overvalued') return change < -0.03
  if (action === 'hold') return Math.abs(change) < 0.05
  return false
}

export async function verifyPendingSuggestions(getPriceFn) {
  const list = loadVerifications()
  const now = Date.now()
  for (const v of list) {
    if (!v.result7d && now >= v.checkAt7d && typeof getPriceFn === 'function') {
      const currentPrice = await getPriceFn(v.stockCode)
      if (currentPrice != null) {
        v.result7d = {
          price: currentPrice,
          change: (currentPrice - v.priceAtSuggestion) / (v.priceAtSuggestion || 1),
          suggestionWasCorrect: isSuggestionCorrect(v.suggestedAction || v.suggestionType, v.priceAtSuggestion, currentPrice),
        }
      }
    }
    if (!v.result30d && now >= v.checkAt30d && typeof getPriceFn === 'function') {
      const currentPrice = await getPriceFn(v.stockCode)
      if (currentPrice != null) {
        v.result30d = {
          price: currentPrice,
          change: (currentPrice - v.priceAtSuggestion) / (v.priceAtSuggestion || 1),
          suggestionWasCorrect: isSuggestionCorrect(v.suggestedAction || v.suggestionType, v.priceAtSuggestion, currentPrice),
        }
      }
    }
  }
  saveVerifications(list)
  const verified = list.filter((v) => v.result7d)
  const correctRate = verified.length
    ? verified.filter((v) => v.result7d.suggestionWasCorrect).length / verified.length
    : null
  return {
    totalVerified: verified.length,
    correctRate,
    pending: list.filter((v) => !v.result30d).length,
  }
}

/** 情景题已迁移至 src/data/profileQuestions.js（88 题） */

function deepMerge(base, patch) {
  const out = { ...base }
  for (const [k, v] of Object.entries(patch || {})) {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      out[k] = deepMerge(base[k] || {}, v)
    } else {
      out[k] = v
    }
  }
  return out
}

function avg(nums) {
  if (!nums.length) return null
  return nums.reduce((a, b) => a + b, 0) / nums.length
}

function mode(vals) {
  if (!vals.length) return null
  const freq = new Map()
  for (const v of vals) freq.set(v, (freq.get(v) || 0) + 1)
  let best = vals[0]
  let n = 0
  for (const [v, c] of freq) {
    if (c >= n) {
      best = v
      n = c
    }
  }
  return best
}

function parseDrawdown(v) {
  const n = parseInt(String(v).replace('%', ''), 10)
  return Number.isFinite(n) ? n : null
}

/**
 * 将情景题答案聚合进显式画像
 * - 1–5 量表：均值
 * - maxDrawdown / singleStockMax：均值后再格式化
 * - 枚举字符串：众数
 * - dimensionWeights：求和后按比例归一（总和约 100）
 * - newsSourcePreference：去重合并
 */
/**
 * @param {object} profile
 * @param {Record<string, string>} answers
 * @param {{ isPro?: boolean }} [opts] — Basic: onboardingDone = essentials (11); Pro: answered >= 88
 */
export function applyScenarioAnswers(profile, answers, opts = {}) {
  const kept = {
    age: profile?.age ?? DEFAULT_PROFILE.age,
    career: profile?.career ?? '',
    investExperience: profile?.investExperience ?? null,
    bearMarketExperience: profile?.bearMarketExperience ?? null,
    totalCapital: profile?.totalCapital ?? null,
    incomeSource: profile?.incomeSource ?? '',
    preferredIndustries: [...(profile?.preferredIndustries || [])],
    avoidIndustries: [...(profile?.avoidIndustries || [])],
    marketCapPreference: profile?.marketCapPreference || 'all',
    exchangePreference: profile?.exchangePreference || 'all',
    manualOverrides: { ...(profile?.manualOverrides || {}) },
    life: { ...DEFAULT_PROFILE.life, ...(profile?.life || {}) },
  }

  const bags = {
    philosophy: {},
    riskNum: {},
    riskStr: {},
    dim: {},
    scalarNum: {},
    scalarStr: {},
    news: [],
    flags: {},
  }

  const pushNum = (bag, key, val) => {
    if (typeof val !== 'number' || Number.isNaN(val)) return
    if (!bag[key]) bag[key] = []
    bag[key].push(val)
  }
  const pushStr = (bag, key, val) => {
    if (val == null || val === '') return
    if (!bag[key]) bag[key] = []
    bag[key].push(val)
  }

  SCENARIO_QUESTIONS.forEach((q) => {
    const key = answers?.[q.id]
    const opt = q.options.find((o) => o.key === key)
    if (!opt?.patch) return
    const p = opt.patch

    if (p.philosophy) {
      for (const [k, v] of Object.entries(p.philosophy)) pushNum(bags.philosophy, k, v)
    }
    if (p.risk) {
      for (const [k, v] of Object.entries(p.risk)) {
        if (k === 'maxDrawdown' || k === 'singleStockMax') {
          const n = parseDrawdown(v)
          if (n != null) pushNum(bags.riskNum, k, n)
        } else if (k === 'panicSellHistory') {
          bags.flags.panicSellHistory = bags.flags.panicSellHistory || !!v
        } else if (typeof v === 'number') {
          pushNum(bags.riskNum, k, v)
        } else {
          pushStr(bags.riskStr, k, v)
        }
      }
    }
    if (p.dimensionWeights) {
      for (const [k, v] of Object.entries(p.dimensionWeights)) pushNum(bags.dim, k, v)
    }
    if (Array.isArray(p.newsSourcePreference)) bags.news.push(...p.newsSourcePreference)

    for (const [k, v] of Object.entries(p)) {
      if (['philosophy', 'risk', 'dimensionWeights', 'newsSourcePreference'].includes(k)) continue
      if (typeof v === 'boolean') bags.flags[k] = bags.flags[k] || v
      else if (typeof v === 'number') pushNum(bags.scalarNum, k, v)
      else pushStr(bags.scalarStr, k, v)
    }
  })

  const philosophy = { ...DEFAULT_PROFILE.philosophy }
  for (const [k, arr] of Object.entries(bags.philosophy)) {
    const a = avg(arr)
    if (a != null) philosophy[k] = Math.round(a * 10) / 10
  }

  const risk = { ...DEFAULT_PROFILE.risk }
  for (const [k, arr] of Object.entries(bags.riskNum)) {
    const a = avg(arr)
    if (a == null) continue
    if (k === 'maxDrawdown' || k === 'singleStockMax') risk[k] = `${Math.round(a)}%`
    else risk[k] = Math.round(a * 10) / 10
  }
  for (const [k, arr] of Object.entries(bags.riskStr)) {
    risk[k] = mode(arr)
  }
  if (bags.flags.panicSellHistory) risk.panicSellHistory = true

  const dimensionWeights = { ...DEFAULT_PROFILE.dimensionWeights }
  const dimSum = {}
  let totalDim = 0
  for (const [k, arr] of Object.entries(bags.dim)) {
    const s = arr.reduce((a, b) => a + b, 0)
    dimSum[k] = s
    totalDim += s
  }
  if (totalDim > 0) {
    for (const [k, s] of Object.entries(dimSum)) {
      dimensionWeights[k] = Math.round((s / totalDim) * 100)
    }
  }

  const answered = Object.keys(answers || {}).filter((id) =>
    SCENARIO_QUESTIONS.some((q) => q.id === id && answers[id]),
  ).length

  let next = {
    ...DEFAULT_PROFILE,
    ...kept,
    philosophy,
    risk,
    dimensionWeights,
    scenarioAnswers: { ...(answers || {}) },
    scenarioProgress: answered,
    newsSourcePreference: [...new Set(bags.news)],
    marketCapPreference: kept.marketCapPreference || mode(bags.scalarStr.marketCapPreference || []) || 'all',
    exchangePreference: mode(bags.scalarStr.exchangePreference || []) || profile?.exchangePreference || 'all',
    valuationPreferred: mode(bags.scalarStr.valuationPreferred || []) || profile?.valuationPreferred || 'auto',
    decisionSpeed: mode(bags.scalarStr.decisionSpeed || []) || 'moderate',
    manualOverrides: kept.manualOverrides,
    life: kept.life,
  }

  for (const [k, arr] of Object.entries(bags.scalarNum)) {
    const a = avg(arr)
    if (a != null) next[k] = Math.round(a * 10) / 10
  }
  for (const [k, arr] of Object.entries(bags.scalarStr)) {
    if (['marketCapPreference', 'exchangePreference', 'valuationPreferred', 'decisionSpeed'].includes(k)) continue
    next[k] = mode(arr)
  }
  for (const [k, v] of Object.entries(bags.flags)) {
    if (k === 'panicSellHistory') continue
    next[k] = v
  }

  // Prefer kept industries if user set them in settings
  next.preferredIndustries = kept.preferredIndustries
  next.avoidIndustries = kept.avoidIndustries
  if (profile?.marketCapPreference && profile.marketCapPreference !== 'all' && !bags.scalarStr.marketCapPreference?.length) {
    next.marketCapPreference = profile.marketCapPreference
  }

  const essentials = essentialsDone(answers || next.scenarioAnswers || {})
  next.essentialsDone = essentials
  // Hard product rule: Basic = 11 onboarded; Pro = full 88
  const isPro = opts.isPro === true
  next.onboardingDone = isPro ? answered >= SCENARIO_QUESTION_COUNT : essentials
  next.profileVersion = 3
  next.lastCalibration = Date.now()
  return next
}

function normalizeProductEdition(ed) {
  if (ed === 'basic' || ed === 'pro') return ed
  // 缺字段 / null → 基础版（不再强制版本选择闸门）
  return 'basic'
}

/** 从旧 v1/v2 画像迁移 */
export function migrateLegacyProfile(old) {
  if (!old) return deepMerge({}, DEFAULT_PROFILE)
  let next
  if (old.profileVersion >= 3 && old.philosophy) {
    next = deepMerge(DEFAULT_PROFILE, old)
  } else if (old.profileVersion >= 2 && old.philosophy) {
    next = deepMerge(DEFAULT_PROFILE, { ...old, profileVersion: 3 })
  } else {
    const style = old.investStyle || '混合'
    const risk = old.riskAppetite || '平衡'
    const horizon = old.horizon || '中线'
    const val = old.valuationWeight || 'DCF'
    next = deepMerge(DEFAULT_PROFILE, {
      preferredIndustries: old.industries || old.preferredIndustries || [],
      valuationPreferred: val === '情绪' ? 'auto' : val,
      philosophy: {
        valueVsGrowth: style === '价值' ? 1 : style === '成长' ? 5 : 3,
        activeVsPassive: horizon === '短线' ? 5 : horizon === '长线' ? 1 : 3,
      },
      risk: {
        maxDrawdown: risk === '保守' ? '10%' : risk === '激进' ? '50%' : '20%',
        lossAversion: risk === '保守' ? 5 : risk === '激进' ? 1 : 3,
      },
      decisionSpeed: horizon === '短线' ? 'fast' : horizon === '长线' ? 'slow' : 'moderate',
      onboardingDone: !!old.onboardingDone,
      profileVersion: 3,
    })
  }
  next.productEdition = normalizeProductEdition(old.productEdition ?? next.productEdition)
  return next
}

export function loadFeaturesFromStorage() {
  const raw = readPrefVault(FEATURES_KEY, FEATURES_LEGACY, {})
  return { ...DEFAULT_FEATURES, ...(raw && typeof raw === 'object' ? raw : {}) }
}

export function saveFeaturesToStorage(features) {
  writePrefVault(FEATURES_KEY, FEATURES_LEGACY, features)
}

export function loadPersonalityFromStorage() {
  const tags = readPrefVault(PERSONALITY_KEY, PERSONALITY_LEGACY, [])
  return Array.isArray(tags) ? tags : []
}

export function savePersonalityToStorage(tags) {
  writePrefVault(PERSONALITY_KEY, PERSONALITY_LEGACY, tags)
}

/** 导出给日报用的兼容摘要 */
export function summarizeForReport(explicitProfile, features, personality, riskCal, weights, drift) {
  const p = explicitProfile || DEFAULT_PROFILE
  const vvg = p.philosophy?.valueVsGrowth ?? 3
  const style = vvg <= 2 ? '价值' : vvg >= 4 ? '成长' : '混合'
  const ddRaw = p.risk?.maxDrawdown || '20%'
  const dd = parseInt(String(ddRaw).replace('%', ''), 10)
  let riskLabel = '平衡'
  if (!Number.isNaN(dd)) {
    if (dd <= 12) riskLabel = '保守'
    else if (dd >= 40) riskLabel = '激进'
    else if (dd >= 25) riskLabel = '进取'
    else riskLabel = '平衡'
  }
  const horizon =
    p.decisionSpeed === 'fast' || (p.philosophy?.activeVsPassive ?? 3) >= 4
      ? '短线'
      : (p.philosophy?.activeVsPassive ?? 3) <= 2
        ? '长线'
        : '中线'

  return {
    style,
    risk: riskLabel,
    industries: p.preferredIndustries || [],
    preferredIndustries: p.preferredIndustries || [],
    avoidIndustries: p.avoidIndustries || [],
    horizon,
    valuationWeight: p.valuationPreferred === 'auto' ? 'DCF' : p.valuationPreferred,
    features,
    personality,
    riskCalibration: riskCal,
    personalWeights: weights,
    drift,
    adoptPattern: personality?.[0] ? `主导性格：${personality[0].tag}` : '尚无足够反馈',
    scenarioProgress: p.scenarioProgress || Object.keys(p.scenarioAnswers || {}).length || 0,
    scenarioTotal: SCENARIO_QUESTION_COUNT,
    onboardingDone: !!p.onboardingDone,
    maxDrawdown: p.risk?.maxDrawdown || null,
    singleStockMax: p.risk?.singleStockMax || null,
    capitalRole: p.capitalRole || null,
    profileDepthWanted: p.profileDepthWanted || null,
  }
}
