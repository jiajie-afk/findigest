import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  DEFAULT_PROFILE,
  DEFAULT_FEATURES,
  EVENT_TYPES,
  createEvent,
  saveEvent,
  loadEvents,
  getRecentEventsSnapshot,
  hydrateRecentEvents,
  updateFeatures,
  inferPersonality,
  identifyDecisionPatterns,
  calibrateRiskTolerance,
  generatePersonalWeights,
  detectPreferenceDrift,
  explainWeightAdjustments,
  buildPersonalizedPrompt,
  recordIgnoredSuggestion,
  verifyPendingSuggestions,
  applyScenarioAnswers,
  migrateLegacyProfile,
  loadFeaturesFromStorage,
  saveFeaturesToStorage,
  loadPersonalityFromStorage,
  savePersonalityToStorage,
  summarizeForReport,
  SCENARIO_QUESTION_COUNT,
  ESSENTIAL_QUESTION_COUNT,
  ESSENTIAL_QUESTION_IDS,
  essentialsDone,
} from '@/services/profiling.js'
import { vaultGet, vaultSet, getActiveAccountId } from '@/services/vault.js'
import { getEntitlements, nextProductEdition } from '@/services/entitlements.js'
import { readBilling, isProActive } from '@/services/billing.js'
import { useBillingStore } from '@/store/billing'

/**
 * Post-login landing: always prefer /app.
 * Honors a safe same-origin relative `redirect` query; never forces Settings or a comparison picker.
 * Accepts values like `/app?edition=pro` (encoded or plain).
 */
export function resolvePostAuthPath(redirect) {
  if (typeof redirect !== 'string' || !redirect) return '/app?edition=pro'
  let path = redirect.trim()
  try {
    path = decodeURIComponent(path)
  } catch {
    /* keep raw */
  }
  if (!path.startsWith('/') || path.startsWith('//')) return '/app?edition=pro'
  if (path.startsWith('/auth')) return '/app?edition=pro'
  if (path.startsWith('/onboarding/edition') || path.startsWith('/pricing') || path.startsWith('/preview/')) {
    return '/app?edition=pro'
  }
  // Strip query for router path; edition applied separately
  const q = path.indexOf('?')
  if (q >= 0) path = path.slice(0, q) || '/app'
  return path
}

/** Parse ?edition=basic|pro from redirect query string. */
export function editionFromRedirect(redirect) {
  if (typeof redirect !== 'string' || !redirect) return null
  let raw = redirect.trim()
  try {
    raw = decodeURIComponent(raw)
  } catch {
    /* keep */
  }
  const m = raw.match(/[?&]edition=(basic|pro)\b/i)
  return m ? m[1].toLowerCase() : null
}

const THEME_KEY = 'fd_theme'
const STYLE_KEY = 'fd_style'
const USER_KEY = 'fd_user'
const PROFILE_KEY = 'fd_user_profile'
const AI_KEY = 'fd_ai'

function storageGet(base) {
  if (getActiveAccountId()) {
    const v = vaultGet(base, null)
    return v == null ? null : typeof v === 'string' ? v : JSON.stringify(v)
  }
  return localStorage.getItem(base)
}

function storageSet(base, value) {
  const raw = typeof value === 'string' ? value : JSON.stringify(value)
  if (getActiveAccountId()) {
    try {
      vaultSet(base, JSON.parse(raw))
    } catch {
      vaultSet(base, raw)
    }
    return
  }
  localStorage.setItem(base, raw)
}

export const useUserStore = defineStore('user', () => {
  const nickname = ref('投资者')
  const email = ref('demo@findigest.com')
  const career = ref('')
  const risk = ref('平衡型')
  const age = ref(35)
  const report_hour = ref(8)
  const report_minute = ref(0)
  const strategy = ref('平衡型')
  const push_email = ref(true)
  const push_wechat = ref(false)
  const push_browser = ref(false)
  const serverchan_key = ref('')
  const uiTheme = ref('dark')
  const designStyle = ref('luxury')
  const toastMsg = ref('')
  let toastTimer = null

  const profile = ref(migrateLegacyProfile(null))
  const features = ref({ ...DEFAULT_FEATURES })
  const personality = ref([])
  const riskCalibration = ref({ declared: null, behavioral: null, actual: 0.5, confidence: 0 })
  const personalWeights = ref(null)
  const driftAnalysis = ref({
    drift: null,
    confidence: 0,
    msg: '数据不足，无法判断偏好变化',
    reasons: [],
    sampleInsufficient: true,
  })

  const weightExplanation = computed(() =>
    explainWeightAdjustments({
      events: getRecentEventsSnapshot(),
      weights: personalWeights.value,
      drift: driftAnalysis.value,
    }),
  )
  const decisionPatterns = ref({ buyPatterns: [], sellPatterns: [] })
  const verificationStats = ref({ totalVerified: 0, correctRate: null, pending: 0 })

  const aiConfig = ref({
    enabled: false,
    baseUrl: 'https://api.deepseek.com/v1',
    apiKey: '',
    model: 'deepseek-chat',
  })

  const reportTimeLabel = computed(
    () => `${String(report_hour.value).padStart(2, '0')}:${String(report_minute.value).padStart(2, '0')}`,
  )

  function persist() {
    storageSet(
      USER_KEY,
      JSON.stringify({
        nickname: nickname.value,
        email: email.value,
        career: career.value,
        risk: risk.value,
        age: age.value,
        report_hour: report_hour.value,
        report_minute: report_minute.value,
        strategy: strategy.value,
        push_email: push_email.value,
        push_wechat: push_wechat.value,
        push_browser: push_browser.value,
        serverchan_key: serverchan_key.value,
        designStyle: designStyle.value,
      }),
    )
  }

  function persistProfile() {
    storageSet(PROFILE_KEY, JSON.stringify(profile.value))
  }

  function persistAi() {
    storageSet(AI_KEY, JSON.stringify(aiConfig.value))
  }

  function syncDerived() {
    personality.value = inferPersonality(features.value, profile.value)
    savePersonalityToStorage(personality.value)
    riskCalibration.value = calibrateRiskTolerance(features.value, profile.value)
    personalWeights.value = generatePersonalWeights(features.value, personality.value, profile.value)
  }

  async function recalibrate() {
    const events = await loadEvents({ since: Date.now() - 180 * 24 * 3600 * 1000, limit: 800 })
    hydrateRecentEvents(events)
    decisionPatterns.value = identifyDecisionPatterns(events)
    driftAnalysis.value = detectPreferenceDrift(events)
    syncDerived()
    profile.value = { ...profile.value, lastCalibration: Date.now() }
    persistProfile()
  }

  function hydrate() {
    try {
      if (!getActiveAccountId()) {
        profile.value = migrateLegacyProfile(null)
        return
      }

      const migrated = vaultGet('fd_desk_theme_v5', null)
      const tRaw = storageGet(THEME_KEY)
      const t = tRaw ? (tRaw.startsWith('"') ? JSON.parse(tRaw) : tRaw) : null
      if (!migrated) {
        uiTheme.value = 'dark'
        designStyle.value = 'luxury'
        storageSet(THEME_KEY, JSON.stringify('dark'))
        storageSet(STYLE_KEY, JSON.stringify('luxury'))
        vaultSet('fd_desk_theme_v5', '1')
      } else if (t) {
        uiTheme.value = t
      }
      const sRaw = storageGet(STYLE_KEY)
      const s = sRaw ? (sRaw.startsWith('"') ? JSON.parse(sRaw) : sRaw) : null
      if (s === 'soft' || s === 'journal' || s === 'luxury') {
        designStyle.value = s
      } else if (s === 'prodesk') {
        // Gate on vault billing snapshot — pinia billing may not be hydrated yet
        designStyle.value = isProActive(readBilling()) ? 'prodesk' : 'luxury'
      }

      const u = storageGet(USER_KEY)
      if (u) {
        const parsed = JSON.parse(u)
        if (parsed.nickname != null) nickname.value = parsed.nickname
        if (parsed.email != null) email.value = parsed.email
        if (parsed.career != null) career.value = parsed.career
        if (parsed.risk != null) risk.value = parsed.risk
        if (parsed.age != null) age.value = parsed.age
        if (parsed.report_hour != null) report_hour.value = parsed.report_hour
        if (parsed.report_minute != null) report_minute.value = parsed.report_minute
        if (parsed.strategy != null) strategy.value = parsed.strategy
        if (parsed.push_email != null) push_email.value = parsed.push_email
        if (parsed.push_wechat != null) push_wechat.value = parsed.push_wechat
        if (parsed.push_browser != null) push_browser.value = parsed.push_browser
        if (parsed.serverchan_key != null) serverchan_key.value = parsed.serverchan_key
        if (
          parsed.designStyle === 'soft' ||
          parsed.designStyle === 'journal' ||
          parsed.designStyle === 'luxury' ||
          parsed.designStyle === 'prodesk'
        ) {
          designStyle.value = parsed.designStyle
        }
      }

      const raw = storageGet(PROFILE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        profile.value = migrateLegacyProfile(parsed)
        if (profile.value.age == null && age.value) profile.value.age = age.value
        if (!profile.value.career && career.value) profile.value.career = career.value
        // Persist migrated productEdition (legacy → basic) so vault gate stays consistent
        if (parsed.productEdition !== profile.value.productEdition) {
          persistProfile()
        }
      } else {
        profile.value = migrateLegacyProfile(null)
      }

      // Sync shell to product edition (prodesk vs luxury) when edition is set
      syncEditionStyle({ silent: true })
      reconcileOnboardingForEdition()

      features.value = loadFeaturesFromStorage()
      personality.value = loadPersonalityFromStorage()
      const a = storageGet(AI_KEY)
      if (a) aiConfig.value = { ...aiConfig.value, ...JSON.parse(a) }
      syncDerived()
    } catch {
      /* ignore */
    }
  }

  function setTheme(theme) {
    uiTheme.value = theme
    storageSet(THEME_KEY, JSON.stringify(theme))
  }

  function setDesignStyle(style) {
    const billing = useBillingStore()
    const ent = getEntitlements(
      { plan: billing.plan, proUntil: billing.proUntil },
      profile.value,
    )
    // Pro Desk skin requires active entitlement (paid or local free)
    if (style === 'prodesk' && !ent.canUseProdeskStyle) {
      toast('当前环境不可用专业密度')
      return
    }
    // Active Pro locks denser desk — don't silently strip via soft/journal/luxury
    if (ent.canUseProdeskStyle && profile.value?.productEdition === 'pro' && style !== 'prodesk') {
      designStyle.value = 'prodesk'
      storageSet(STYLE_KEY, JSON.stringify('prodesk'))
      uiTheme.value = 'dark'
      storageSet(THEME_KEY, JSON.stringify('dark'))
      persist()
      toast('Pro 版锁定专业密度')
      return
    }
    designStyle.value = style
    storageSet(STYLE_KEY, JSON.stringify(style))
    if (style === 'luxury' || style === 'prodesk') {
      uiTheme.value = 'dark'
      storageSet(THEME_KEY, JSON.stringify('dark'))
    }
    persist()
    const labels = {
      luxury: '已切换：基础密度',
      journal: '已切换：报纸外观',
      soft: '已切换：浅色外观',
      prodesk: '已切换：专业密度',
    }
    toast(labels[style] || '已切换外观')
  }

  const isBasicEdition = computed(() => profile.value?.productEdition === 'basic')
  const isProEdition = computed(() => profile.value?.productEdition === 'pro')
  const needsEditionPick = computed(() => {
    const ed = profile.value?.productEdition
    return ed !== 'basic' && ed !== 'pro'
  })
  const editionLabel = computed(() => {
    if (isProEdition.value) return '专业'
    if (isBasicEdition.value) return '基础'
    return '未选'
  })

  function syncEditionStyle(opts = {}) {
    const billing = useBillingStore()
    const ent = getEntitlements(
      { plan: billing.plan, proUntil: billing.proUntil },
      profile.value,
    )
    const ed = profile.value?.productEdition
    // Pro Desk requires active billing entitlement — never flash from sticky edition alone
    if (ed === 'pro' && ent.canUseProdeskStyle && designStyle.value !== 'prodesk') {
      designStyle.value = 'prodesk'
      storageSet(STYLE_KEY, JSON.stringify('prodesk'))
      uiTheme.value = 'dark'
      storageSet(THEME_KEY, JSON.stringify('dark'))
      persist()
    } else if (
      designStyle.value === 'prodesk' &&
      (ed === 'basic' || !ent.canUseProdeskStyle)
    ) {
      designStyle.value = 'luxury'
      storageSet(STYLE_KEY, JSON.stringify('luxury'))
      uiTheme.value = 'dark'
      storageSet(THEME_KEY, JSON.stringify('dark'))
      persist()
    }
    if (!opts.silent && ed === 'pro') {
      /* no toast on hydrate */
    }
  }

  function setProductEdition(edition, opts = {}) {
    if (edition !== 'basic' && edition !== 'pro') return false
    const billing = useBillingStore()
    // Remote: pro requires paid plan. Localhost / DEV: free to switch either way.
    if (edition === 'pro') {
      if (!billing.isPro && !billing.localFreePro) {
        if (!opts.silent) toast('请先开通 Pro')
        return false
      }
    }
    profile.value = { ...profile.value, productEdition: edition }
    persistProfile()
    if (edition === 'pro') {
      designStyle.value = 'prodesk'
      storageSet(STYLE_KEY, JSON.stringify('prodesk'))
      uiTheme.value = 'dark'
      storageSet(THEME_KEY, JSON.stringify('dark'))
      // Persist local free Pro stamp so reload stays Pro until user picks basic
      try {
        billing.hydrate()
      } catch {
        /* ignore */
      }
    } else if (designStyle.value === 'prodesk') {
      designStyle.value = 'luxury'
      storageSet(STYLE_KEY, JSON.stringify('luxury'))
    }
    persist()
    // Re-sync billing vault when switching basic on local (drops sticky pro plan)
    if (edition === 'basic' && billing.localFreePro) {
      try {
        billing.hydrate()
      } catch {
        /* ignore */
      }
    }
    if (!opts.silent) {
      toast(edition === 'pro' ? '已进入专业台' : '已进入基础版')
    }
    return true
  }

  /**
   * Align productEdition with billing. Membership unlocks Pro; it never traps the user in Pro.
   * Explicit basic (landing「进入基础版」、设置切换) must survive hydrate.
   */
  function syncEditionFromEntitlements(opts = {}) {
    const billing = useBillingStore()
    const ent = getEntitlements(
      { plan: billing.plan, proUntil: billing.proUntil },
      profile.value,
    )
    const ed = profile.value?.productEdition
    const next = nextProductEdition({
      currentEdition: ed,
      isBillingPro: ent.isBillingPro,
      localFreePro: ent.localFreePro,
      activatePro: !!opts.activatePro,
    })
    if (next && next !== ed) {
      setProductEdition(next, { silent: true })
      if (!opts.silent && next === 'basic' && ed === 'pro') {
        toast('Pro 已过期或未开通，已回落基础版')
      }
      reconcileOnboardingForEdition()
      return
    }
    syncEditionStyle({ silent: true })
    if (!ent.canUseProdeskStyle && designStyle.value === 'prodesk') {
      designStyle.value = 'luxury'
      storageSet(STYLE_KEY, JSON.stringify('luxury'))
      persist()
    }
    reconcileOnboardingForEdition()
  }

  function toast(msg) {
    toastMsg.value = msg
    clearTimeout(toastTimer)
    toastTimer = setTimeout(() => {
      toastMsg.value = ''
    }, 2500)
  }

  function saveSettings(payload, opts = {}) {
    if (payload.nickname != null) nickname.value = payload.nickname
    if (payload.email != null) email.value = payload.email
    if (payload.career != null) {
      career.value = payload.career
      profile.value = { ...profile.value, career: payload.career }
    }
    if (payload.risk != null) risk.value = payload.risk
    if (payload.age != null) {
      age.value = payload.age
      profile.value = { ...profile.value, age: payload.age }
    }
    if (payload.report_hour != null) report_hour.value = payload.report_hour
    if (payload.report_minute != null) report_minute.value = payload.report_minute
    if (payload.strategy != null) {
      strategy.value = payload.strategy
      // Sync strategy dropdown → profile risk calibration used by AI
      const map = {
        保守型: { maxDrawdown: '10%', lossAversion: 5 },
        稳健型: { maxDrawdown: '15%', lossAversion: 4 },
        平衡型: { maxDrawdown: '20%', lossAversion: 3 },
        进取型: { maxDrawdown: '30%', lossAversion: 2 },
        激进型: { maxDrawdown: '50%', lossAversion: 1 },
      }
      const m = map[payload.strategy]
      if (m) {
        profile.value = {
          ...profile.value,
          risk: { ...profile.value.risk, ...m },
        }
      }
    }
    if (payload.push_email != null) push_email.value = payload.push_email
    if (payload.push_wechat != null) push_wechat.value = payload.push_wechat
    if (payload.push_browser != null) push_browser.value = payload.push_browser
    if (payload.serverchan_key != null) serverchan_key.value = payload.serverchan_key
    if (
      payload.designStyle === 'soft' ||
      payload.designStyle === 'journal' ||
      payload.designStyle === 'luxury' ||
      payload.designStyle === 'prodesk'
    ) {
      const billing = useBillingStore()
      const ent = getEntitlements(
        { plan: billing.plan, proUntil: billing.proUntil },
        profile.value,
      )
      const nextStyle =
        ent.canUseProdeskStyle && profile.value?.productEdition === 'pro'
          ? 'prodesk'
          : payload.designStyle === 'prodesk' && !ent.canUseProdeskStyle
            ? designStyle.value
            : payload.designStyle
      designStyle.value = nextStyle
      storageSet(STYLE_KEY, JSON.stringify(nextStyle))
    }
    persist()
    persistProfile()
    syncDerived()
    if (!opts.silent) toast('设置已保存')
  }

  function saveProfile(payload, opts = {}) {
    profile.value = migrateLegacyProfile({ ...profile.value, ...payload, profileVersion: 2 })
    if (payload.age != null) age.value = payload.age
    if (payload.career != null) career.value = payload.career
    persistProfile()
    persist()
    syncDerived()
    if (!opts.silent) toast('投资画像已保存')
  }

  function saveScenarioAnswers(answers, opts = {}) {
    const billing = useBillingStore()
    const isPro = !!billing.canUseProHud
    profile.value = applyScenarioAnswers(profile.value, answers, { isPro })
    // seed features from explicit philosophy
    const p = profile.value.philosophy
    features.value = {
      ...features.value,
      fundamentalFocus: emaSeed(features.value.fundamentalFocus, (6 - (p.fundamentalVsTechnical || 3)) / 5),
      technicalFocus: emaSeed(features.value.technicalFocus, (p.fundamentalVsTechnical || 3) / 5),
      contrarianIndex: emaSeed(features.value.contrarianIndex, (6 - (p.contrarianVsMomentum || 3)) / 5),
      momentumFollowing: emaSeed(features.value.momentumFollowing, (p.contrarianVsMomentum || 3) / 5),
      holdingPatience: emaSeed(features.value.holdingPatience, (6 - (p.activeVsPassive || 3)) / 5),
      diversificationTendency: emaSeed(features.value.diversificationTendency, (p.集中Vs分散 || 3) / 5),
      decisionSpeed:
        profile.value.decisionSpeed === 'fast' ? 0.25 : profile.value.decisionSpeed === 'slow' ? 0.75 : 0.5,
      lossAversionActual: emaSeed(features.value.lossAversionActual, ((profile.value.risk?.lossAversion || 3) - 1) / 4),
      actualRiskTolerance: (() => {
        const dd = parseInt(String(profile.value.risk?.maxDrawdown || '20').replace('%', ''), 10)
        return Number.isNaN(dd) ? 0.5 : Math.min(dd / 50, 1)
      })(),
    }
    saveFeaturesToStorage(features.value)
    persistProfile()
    syncDerived()
    if (!opts.silent) {
      if (!isPro) {
        const n = ESSENTIAL_QUESTION_IDS.filter((id) => answers?.[id] || profile.value.scenarioAnswers?.[id]).length
        toast(
          profile.value.onboardingDone
            ? '基础定制已完成（11/11），建议将按你的画像生成'
            : `已保存进度 ${n}/${ESSENTIAL_QUESTION_COUNT}`,
        )
      } else {
        toast(
          profile.value.onboardingDone
            ? '私人定制已完成（88/88），建议将按你的画像生成'
            : profile.value.essentialsDone
              ? `核心题已齐 · 进度 ${profile.value.scenarioProgress}/${SCENARIO_QUESTION_COUNT}，可先回今日`
              : `已保存进度 ${profile.value.scenarioProgress}/${SCENARIO_QUESTION_COUNT}`,
        )
      }
    }
  }

  /** Keep onboardingDone aligned with edition (Basic=11 / Pro=88) after hydrate or plan change */
  function reconcileOnboardingForEdition() {
    const billing = useBillingStore()
    const isPro = !!billing.canUseProHud
    const answers = profile.value?.scenarioAnswers || {}
    const essentials = !!profile.value?.essentialsDone || essentialsDone(answers)
    const answered = profile.value?.scenarioProgress || Object.keys(answers).filter((id) => answers[id]).length || 0
    const nextDone = isPro ? answered >= SCENARIO_QUESTION_COUNT : essentials
    if (
      profile.value.onboardingDone !== nextDone ||
      profile.value.essentialsDone !== essentials
    ) {
      profile.value = {
        ...profile.value,
        onboardingDone: nextDone,
        essentialsDone: essentials,
      }
      persistProfile()
    }
  }

  function emaSeed(cur, target) {
    return cur * 0.4 + target * 0.6
  }

  function saveIndustries({ preferred = [], avoid = [] }) {
    profile.value = {
      ...profile.value,
      preferredIndustries: preferred.slice(0, 5),
      avoidIndustries: avoid.slice(0, 5),
    }
    persistProfile()
    toast('行业偏好已保存')
  }

  function saveAiConfig(payload, opts = {}) {
    aiConfig.value = { ...aiConfig.value, ...payload }
    persistAi()
    if (!opts.silent) toast('AI 接口设置已保存')
  }

  /** 精密行为事件入口（替代简单 logBehavior） */
  async function track(type, payload = {}) {
    const event = createEvent(type, payload)
    await saveEvent(event)
    const recent = getRecentEventsSnapshot()
    features.value = updateFeatures(features.value, event, recent)
    saveFeaturesToStorage(features.value)

    if (type === EVENT_TYPES.SUGGESTION_IGNORE || type === EVENT_TYPES.FEEDBACK_NEGATIVE) {
      recordIgnoredSuggestion(event)
    }

    if (
      type === EVENT_TYPES.SUGGESTION_ADOPT ||
      type === EVENT_TYPES.SUGGESTION_REJECT ||
      type === EVENT_TYPES.SUGGESTION_IGNORE
    ) {
      syncDerived()
      driftAnalysis.value = detectPreferenceDrift(getRecentEventsSnapshot())
    }

    // throttle personality refresh
    if (recent.length % 8 === 0) syncDerived()
    return event
  }

  /** 兼容旧 API */
  function logBehavior(action, target, metadata = {}) {
    const map = {
      view: EVENT_TYPES.PAGE_VIEW,
      click: EVENT_TYPES.SECTION_FOCUS,
      adopt: EVENT_TYPES.SUGGESTION_ADOPT,
      ignore: EVENT_TYPES.SUGGESTION_IGNORE,
      disagree: EVENT_TYPES.SUGGESTION_REJECT,
    }
    const type = map[action] || EVENT_TYPES.FEEDBACK_COMMENT
    track(type, {
      stockCode: typeof target === 'string' && /^\d/.test(target) ? target : metadata.code || null,
      stockName: metadata.name,
      section: metadata.from || action,
      suggestionType: metadata.type,
      suggestionContent: metadata.feedback || metadata.title,
      currentPrice: metadata.price,
      sentimentScore: metadata.sentiment,
    })
  }

  function getUserProfile() {
    return summarizeForReport(
      profile.value,
      features.value,
      personality.value,
      riskCalibration.value,
      personalWeights.value,
      driftAnalysis.value,
    )
  }

  function getPersonalizedPrompt() {
    return buildPersonalizedPrompt(
      features.value,
      personality.value,
      decisionPatterns.value,
      riskCalibration.value,
      driftAnalysis.value,
      profile.value,
    )
  }

  async function runVerification(getPriceFn) {
    verificationStats.value = await verifyPendingSuggestions(getPriceFn)
    return verificationStats.value
  }

  return {
    nickname,
    email,
    career,
    risk,
    age,
    report_hour,
    report_minute,
    strategy,
    push_email,
    push_wechat,
    push_browser,
    serverchan_key,
    uiTheme,
    designStyle,
    toastMsg,
    profile,
    features,
    personality,
    riskCalibration,
    personalWeights,
    weightExplanation,
    driftAnalysis,
    decisionPatterns,
    verificationStats,
    aiConfig,
    reportTimeLabel,
    isBasicEdition,
    isProEdition,
    needsEditionPick,
    editionLabel,
    EVENT_TYPES,
    hydrate,
    persist,
    setTheme,
    setDesignStyle,
    setProductEdition,
    syncEditionFromEntitlements,
    syncEditionStyle,
    toast,
    saveSettings,
    saveProfile,
    saveScenarioAnswers,
    saveIndustries,
    saveAiConfig,
    track,
    logBehavior,
    getUserProfile,
    getPersonalizedPrompt,
    recalibrate,
    runVerification,
  }
})
