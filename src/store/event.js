import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { vaultGet, vaultSet, getActiveAccountId } from '@/services/vault.js'
import { usePortfolioStore } from '@/store/portfolio'
import { apiUrl } from '@/services/apiClient.js'
import {
  fetchEarningsAppointments,
  daysUntil,
  windowStatus,
} from '@/services/earningsCalendar.js'
import { fetchCctvNews } from '@/services/cctvNews.js'
import { annotateNewsItems } from '@/services/holdingsNewsMatch.js'

const MANUAL_BASE = 'fd_manual_events'

function codesOf(e) {
  return String(e.related_stock_codes || '')
    .split(/[,，\s]+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

function eventKey(e) {
  return `${e.title || ''}|${e.event_date || ''}|${codesOf(e).join(',')}`
}

function mergeUnique(lists) {
  const seen = new Set()
  const out = []
  for (const list of lists) {
    for (const e of list || []) {
      const k = eventKey(e)
      if (seen.has(k)) continue
      seen.add(k)
      out.push(e)
    }
  }
  out.sort((a, b) => {
    const da = a.event_date || '9999'
    const db = b.event_date || '9999'
    if (da !== db) return da.localeCompare(db)
    return (b.importance || 0) - (a.importance || 0)
  })
  return out
}

function fromNewsAnalyses(portfolio) {
  const out = []
  for (const h of portfolio.allHoldings || []) {
    const fe = portfolio.stockAnalyses?.[h.code]?.futureEvents || []
    for (const e of fe) {
      out.push({
        id: `news-${h.code}-${(e.title || '').slice(0, 24)}-${e.date}`,
        title: e.title,
        event_date: e.date === '待定' ? '' : e.date,
        event_type: e.certainty === 'confirmed' ? 'confirmed' : 'potential',
        importance: e.importance || 3,
        catalyst_type: e.category || 'general',
        catalyst_label: e.categoryLabel || '新闻催化',
        description: e.desc || e.reason || '',
        related_stock_codes: h.code,
        related_stock_name: h.name,
        source_url: e.url || '',
        trade_hint: e.tradeHint?.text || '',
        buy_from: e.tradeHint?.buyFrom || '',
        sell_by: e.tradeHint?.sellBy || '',
        _source: 'news',
      })
    }
  }
  return out
}

export const useEventStore = defineStore('event', () => {
  const catalogEvents = ref([])
  const liveEarnings = ref([])
  const autoEvents = ref([])
  const manualEvents = ref([])
  const notifications = ref([])
  const reports = ref([])
  const filter = ref('all')
  /** cctv | cctvWorld | market | mine | manual */
  const tab = ref('cctv')
  const loading = ref(false)
  const liveStatus = ref({ source: '', asOf: '', error: '', count: 0 })
  const cctvItems = ref([])
  const cctvStatus = ref({
    asOf: '',
    error: '',
    counts: { s: 0, a: 0, b: 0, c: 0, today: 0, world: 0, jingji: 0, economy: 0, finance: 0, china: 0, domestic: 0, xwlb: 0 },
  })

  const holdingBook = computed(() => {
    const portfolio = usePortfolioStore()
    return (portfolio.allHoldings || []).map((h) => ({
      code: String(h.code),
      name: h.name || '',
    }))
  })

  const cctvAnnotated = computed(() =>
    annotateNewsItems(cctvItems.value, holdingBook.value),
  )

  const cctvDomestic = computed(() =>
    cctvAnnotated.value.filter((e) => e.lane !== 'world' && e.channel !== 'world'),
  )
  const cctvWorldItems = computed(() =>
    cctvAnnotated.value.filter((e) => e.lane === 'world' || e.channel === 'world'),
  )

  const cctvRelated = computed(() =>
    cctvAnnotated.value.filter((e) => (e.relatedHoldings || []).length),
  )

  const marketEvents = computed(() =>
    mergeUnique([liveEarnings.value, catalogEvents.value]),
  )

  const mineEvents = computed(() => {
    const portfolio = usePortfolioStore()
    const codes = new Set((portfolio.allHoldings || []).map((h) => String(h.code)))
    if (!codes.size) return []
    const matched = marketEvents.value.filter((e) => codesOf(e).some((c) => codes.has(c)))
    const fromNews = fromNewsAnalyses(portfolio)
    return mergeUnique([matched, fromNews, autoEvents.value, fromCctvMatches(cctvRelated.value)])
  })

  const filteredMarket = computed(() => {
    if (filter.value === 'all') return marketEvents.value
    return marketEvents.value.filter((e) => e.event_type === filter.value)
  })

  const filteredMine = computed(() => {
    if (filter.value === 'all') return mineEvents.value
    return mineEvents.value.filter((e) => e.event_type === filter.value)
  })

  /** Back-compat for Stock.vue / older callers */
  const filteredAuto = computed(() => filteredMine.value)

  const weekStats = computed(() => {
    const list = marketEvents.value
    let thisWeek = 0
    let windowOpen = 0
    let tomorrow = 0
    const today = new Date().toISOString().slice(0, 10)
    for (const e of list) {
      const d = daysUntil(e.event_date)
      if (d != null && d >= 0 && d <= 7) thisWeek += 1
      if (d === 1) tomorrow += 1
      const st = windowStatus(e, today)
      if (st.id === 'open' || st.id === 'after') windowOpen += 1
    }
    return { thisWeek, windowOpen, tomorrow, total: list.length }
  })

  async function loadCatalog() {
    try {
      const catalog = await fetch(apiUrl('/data/auto_events.json')).then((r) => r.json())
      catalogEvents.value = Array.isArray(catalog)
        ? catalog.map((e, i) => ({ ...e, id: e.id || `cat-${i}`, _source: e._source || 'catalog' }))
        : []
    } catch {
      catalogEvents.value = []
    }
  }

  async function loadLiveEarnings() {
    try {
      const res = await fetchEarningsAppointments({ daysAhead: 14 })
      liveEarnings.value = res.events || []
      liveStatus.value = {
        source: res.source,
        asOf: res.asOf || '',
        error: res.error || '',
        count: liveEarnings.value.length,
      }
    } catch (e) {
      liveEarnings.value = []
      liveStatus.value = {
        source: 'empty',
        asOf: '',
        error: e?.message || '财报日历失败',
        count: 0,
      }
    }
  }

  function fromCctvMatches(items) {
    return (items || []).map((e) => {
      const hits = e.relatedHoldings || []
      const strong = hits.some((h) => h.strength === 'strong')
      return {
        ...e,
        event_type: 'confirmed',
        importance: e.tier === 's' ? 5 : e.tier === 'a' ? 4 : 3,
        catalyst_type: 'policy_macro',
        catalyst_label: strong ? '关我仓·点名' : '关我仓·行业',
        related_stock_codes: hits.map((h) => h.code).join(','),
        related_stock_name: hits.map((h) => h.name).join('、'),
        trade_hint: '',
        _source: 'cctv',
      }
    })
  }

  function syncMineFromHoldings() {
    const portfolio = usePortfolioStore()
    const codes = new Set((portfolio.allHoldings || []).map((h) => String(h.code)))
    if (!codes.size) {
      autoEvents.value = []
      return
    }
    autoEvents.value = marketEvents.value.filter((e) => codesOf(e).some((c) => codes.has(c)))
  }

  async function load() {
    if (!getActiveAccountId()) {
      catalogEvents.value = []
      liveEarnings.value = []
      autoEvents.value = []
      manualEvents.value = []
      notifications.value = []
      reports.value = []
      cctvItems.value = []
      return
    }

    const savedManual = vaultGet(MANUAL_BASE, null)
    manualEvents.value = Array.isArray(savedManual) ? savedManual : []

    const portfolio = usePortfolioStore()
    if (tab.value === 'mine' && !(portfolio.allHoldings || []).length) {
      tab.value = 'cctv'
    }

    // Catalog first (instant UI), live calendar in background — never block app shell
    loading.value = true
    await loadCatalog()
    syncMineFromHoldings()
    loading.value = false

    notifications.value = []
    const savedReports = vaultGet('fd_reports', null)
    reports.value = Array.isArray(savedReports) ? savedReports : []

    // Fire-and-forget live feed
    loadLiveEarnings()
      .then(() => syncMineFromHoldings())
      .catch(() => {})
    loadCctvNews().catch(() => {})
  }

  async function loadCctvNews() {
    try {
      const res = await fetchCctvNews()
      cctvItems.value = (res.items || []).map((it) => ({
        id: `cctv-${it.id}`,
        title: it.title,
        description: it.brief,
        source_url: it.url,
        source: '央视网',
        event_date: it.date,
        catalyst_label: it.channelLabel,
        channel: it.channel,
        lane: it.lane || (it.channel === 'world' ? 'world' : 'domestic'),
        event_type: 'confirmed',
        rank: it.rank,
        score: it.score,
        tier: it.tier,
        tierLabel: it.tierLabel,
        timeLabel: it.clock,
        _source: 'cctv',
      }))
      cctvStatus.value = {
        asOf: res.asOf || '',
        error: res.error || '',
        counts: res.counts || {
          s: 0,
          a: 0,
          b: 0,
          c: 0,
          today: 0,
          world: 0,
          jingji: 0,
          economy: 0,
          finance: 0,
          china: 0,
          domestic: 0,
          xwlb: 0,
        },
      }
    } catch (e) {
      cctvItems.value = []
      cctvStatus.value = {
        asOf: '',
        error: e?.message || '央视要闻暂时拉不到',
        counts: {
          s: 0,
          a: 0,
          b: 0,
          c: 0,
          today: 0,
          world: 0,
          jingji: 0,
          economy: 0,
          finance: 0,
          china: 0,
          domestic: 0,
          xwlb: 0,
        },
      }
    }
  }

  async function refreshLive() {
    loading.value = true
    if (tab.value === 'cctv' || tab.value === 'cctvWorld') {
      await loadCctvNews()
    } else {
      await loadLiveEarnings()
      syncMineFromHoldings()
    }
    loading.value = false
  }

  function persistManual() {
    vaultSet(MANUAL_BASE, manualEvents.value)
  }

  function addManual(event) {
    manualEvents.value.unshift({
      id: Date.now(),
      event_type: 'potential',
      importance: 3,
      source_url: '',
      ...event,
    })
    persistManual()
  }

  function removeManual(id) {
    manualEvents.value = manualEvents.value.filter((e) => e.id !== id)
    persistManual()
  }

  function markAllRead() {
    notifications.value = notifications.value.map((n) => ({ ...n, is_read: true }))
  }

  const unreadCount = computed(() => notifications.value.filter((n) => !n.is_read).length)

  function generateReport(_user, holdingsSummary) {
    const now = new Date()
    const title = `${now.toISOString().slice(0, 10)} 每日财经报告`
    const report = {
      id: Date.now(),
      title,
      date: now.toISOString(),
      sent: false,
      body: holdingsSummary,
    }
    reports.value.unshift(report)
    vaultSet('fd_reports', reports.value)
    notifications.value.unshift({
      id: Date.now() + 1,
      title,
      body: holdingsSummary,
      notif_type: 'report',
      is_read: false,
      created_at: now.toISOString(),
    })
    return report
  }

  return {
    catalogEvents,
    liveEarnings,
    marketEvents,
    mineEvents,
    autoEvents,
    manualEvents,
    cctvItems,
    cctvAnnotated,
    cctvDomestic,
    cctvWorldItems,
    cctvRelated,
    cctvStatus,
    notifications,
    reports,
    filter,
    tab,
    loading,
    liveStatus,
    weekStats,
    filteredMarket,
    filteredMine,
    filteredAuto,
    unreadCount,
    load,
    refreshLive,
    loadCctvNews,
    addManual,
    removeManual,
    markAllRead,
    generateReport,
    daysUntil,
    windowStatus,
  }
})
