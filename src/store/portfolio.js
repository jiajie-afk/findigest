import { defineStore } from 'pinia'
import { shallowRef, ref, computed, triggerRef } from 'vue'
import { warmStockData, peekFinancial, peekPrice, getFinancial } from '@/data/loader.js'
import { calculateValuation } from '@/services/valuation.js'
import { calculatePosition } from '@/services/position.js'
import { fetchAllDeep, fetchQuoteCached, hydrateFinancial } from '@/services/api.js'
import { analyzeNews } from '@/services/analysis.js'
import { vaultGet, vaultSet, emptyPortfolio, starterPortfolio, getActiveAccountId } from '@/services/vault.js'
import { apiUrl } from '@/services/apiClient.js'
import { inferHoldingEx } from '@/services/quotesRefresh.js'

export const usePortfolioStore = defineStore('portfolio', () => {
  const portfolios = ref([])
  const financialData = shallowRef({})
  const stockAnalyses = shallowRef({})
  const db = ref({})
  const autoFetching = ref(false)
  const fetchProgress = ref({ done: 0, total: 0, current: '' })
  const fetchDebug = shallowRef({})
  const priceCache = shallowRef({})

  const allHoldings = computed(() => {
    const list = []
    portfolios.value.forEach((p) =>
      p.holdings.forEach((h) => list.push({ ...h, portfolioId: p.id, portfolioName: p.name })),
    )
    return list
  })

  const totals = computed(() => {
    let cost = 0
    let mv = 0
    allHoldings.value.forEach((h) => {
      const price = getPrice(h.code, h.cost)
      cost += h.shares * h.cost
      mv += h.shares * price
    })
    const pl = mv - cost
    return {
      cost,
      mv,
      pl,
      plPct: cost ? (pl / cost) * 100 : 0,
    }
  })

  function setFinancial(code, data) {
    financialData.value[code] = data
    triggerRef(financialData)
  }

  function setAnalysis(code, data) {
    stockAnalyses.value[code] = data
    triggerRef(stockAnalyses)
  }

  function setFetchDebug(code, data) {
    fetchDebug.value[code] = data
    triggerRef(fetchDebug)
  }

  function getPrice(code, fallback = 0) {
    const fin = financialData.value[code]
    if (fin?.price != null && Number.isFinite(fin.price) && fin.price > 0) return fin.price
    if (priceCache.value[code] != null && Number.isFinite(priceCache.value[code])) return priceCache.value[code]
    const p = peekPrice(code)
    if (p != null && Number.isFinite(p)) return p
    const sf = peekFinancial(code)
    if (sf?.price != null && Number.isFinite(sf.price) && sf.price > 0) return sf.price
    return fallback
  }

  function getFin(code, name) {
    if (financialData.value[code]) return financialData.value[code]
    const base = peekFinancial(code)
    if (!base) return null
    return hydrateFinancial({ ...base, price: getPrice(code, base.price) }, code, name)
  }

  async function load() {
    try {
      const database = await fetch(apiUrl('/data/db.json')).then((r) => r.json())
      db.value = database

      if (!getActiveAccountId()) {
        portfolios.value = emptyPortfolio()
        stockAnalyses.value = {}
        triggerRef(stockAnalyses)
        return
      }

      // Private vault only — never fall back to shared demo portfolios.json
      const saved = vaultGet('fd_portfolios', null)
      if (Array.isArray(saved) && saved.length) {
        portfolios.value = saved
      } else {
        portfolios.value = starterPortfolio()
        persistPortfolios()
      }

      const savedAnalyses = vaultGet('fd_analyses', null)
      if (savedAnalyses && typeof savedAnalyses === 'object') {
        stockAnalyses.value = savedAnalyses
        triggerRef(stockAnalyses)
      } else {
        stockAnalyses.value = {}
        triggerRef(stockAnalyses)
      }

      const codes = allHoldings.value.map((h) => h.code)
      if (!codes.length) {
        financialData.value = {}
        triggerRef(financialData)
        return
      }

      const warmed = await warmStockData(codes)
      priceCache.value = { ...warmed.prices }
      triggerRef(priceCache)

      const nextFin = { ...financialData.value }
      allHoldings.value.forEach((h) => {
        const base = warmed.financials[h.code] || peekFinancial(h.code)
        if (!base) return
        nextFin[h.code] = hydrateFinancial(
          { ...base, price: getPrice(h.code, base.price) },
          h.code,
          h.name,
        )
      })
      financialData.value = nextFin
      triggerRef(financialData)
    } catch (e) {
      console.error('portfolio load failed', e)
      portfolios.value = emptyPortfolio()
    }
  }

  function persistPortfolios() {
    if (!getActiveAccountId()) return
    vaultSet('fd_portfolios', portfolios.value)
  }

  function persistAnalyses() {
    if (!getActiveAccountId()) return
    vaultSet('fd_analyses', stockAnalyses.value)
  }

  function findHolding(code) {
    return allHoldings.value.find((h) => h.code === code) || null
  }

  function nameOf(code) {
    const h = findHolding(code)
    return h?.name || db.value[code] || code
  }

  function holdingEx(holding, code) {
    return inferHoldingEx(code || holding?.code, holding?.ex)
  }

  function applyLiveQuote(code, quote, name) {
    if (!quote || !(Number(quote.price) > 0)) return false
    priceCache.value = { ...priceCache.value, [code]: quote.price }
    triggerRef(priceCache)
    const staticFin = peekFinancial(code) || financialData.value[code] || {}
    setFinancial(
      code,
      hydrateFinancial(
        {
          ...staticFin,
          ...(financialData.value[code] || {}),
          price: quote.price,
          change_pct: quote.change_pct,
          asOf: quote.asOf || null,
          source: quote.source || null,
          quoteAsOf: quote.asOf || null,
          quoteSource: quote.source || null,
        },
        code,
        name,
      ),
    )
    return true
  }

  async function refreshHoldingQuote(holding) {
    const code = holding?.code
    if (!code) return false
    const quote = await fetchQuoteCached(code, holdingEx(holding, code))
    return applyLiveQuote(code, quote, nameOf(code))
  }

  async function analyzeStock(code) {
    const name = nameOf(code)
    const holding = findHolding(code)
    const ex = holdingEx(holding, code)

    setAnalysis(code, { ...(stockAnalyses.value[code] || {}), loading: true })
    try {
      const staticFin = peekFinancial(code) || (await getFinancial(code)) || {}
      let liveQuote = null
      const news = await fetchAllDeep(code, name, ex, (dbg) => {
        liveQuote = dbg?.quote || null
        setFetchDebug(code, dbg)
      })
      applyLiveQuote(code, liveQuote, name)
      const fin = hydrateFinancial(
        {
          ...staticFin,
          ...(financialData.value[code] || {}),
          price: getPrice(code, holding?.cost || 0),
        },
        code,
        name,
      )
      if (fin) setFinancial(code, fin)
      const sent = analyzeNews(news, code, fin)
      setAnalysis(code, {
        news,
        sent,
        futureEvents: sent.futureEvents || [],
        loading: false,
        updatedAt: new Date().toISOString(),
      })
      persistAnalyses()
      return stockAnalyses.value[code]
    } catch (e) {
      setAnalysis(code, { ...(stockAnalyses.value[code] || {}), loading: false, error: String(e) })
      throw e
    }
  }

  async function runBatch(items, worker) {
    const BATCH = 3
    for (let i = 0; i < items.length; i += BATCH) {
      const batch = items.slice(i, i + BATCH)
      await Promise.allSettled(
        batch.map(async (item) => {
          fetchProgress.value.current = item.name || item.code || ''
          try {
            await worker(item)
          } catch {
            /* continue */
          }
          fetchProgress.value.done += 1
        }),
      )
    }
  }

  async function autoFetchAll() {
    if (autoFetching.value) return { skipped: true, reason: 'busy', quotes: 0, analyzed: 0 }
    const holdings = allHoldings.value
    if (!holdings.length) return { skipped: true, reason: 'empty', quotes: 0, analyzed: 0 }

    autoFetching.value = true
    let quotes = 0
    let analyzed = 0
    try {
      fetchProgress.value = { done: 0, total: holdings.length, current: '' }
      await runBatch(holdings, async (h) => {
        if (await refreshHoldingQuote(h)) quotes += 1
      })

      const pending = holdings.filter((h) => !stockAnalyses.value[h.code]?.sent)
      if (pending.length) {
        fetchProgress.value = { done: 0, total: pending.length, current: '' }
        await runBatch(pending, async (h) => {
          await analyzeStock(h.code)
          analyzed += 1
        })
      }
      return { skipped: false, reason: 'ok', quotes, analyzed }
    } finally {
      autoFetching.value = false
    }
  }

  function positionFor(code) {
    const sa = stockAnalyses.value[code]
    if (!sa?.sent) return null
    return calculatePosition(sa.sent, financialData.value[code] || getFin(code, nameOf(code)))
  }

  function valuationFor(code, opts = {}) {
    const name = nameOf(code)
    const fin = financialData.value[code] || getFin(code, name)
    if (!fin) return null
    return calculateValuation(fin, code, name, opts)
  }

  /** Recompute valuation with optional paradigm override and persist into financialData */
  function revalueStock(code, opts = {}) {
    const name = nameOf(code)
    const existing = financialData.value[code] || getFin(code, name)
    if (!existing) return null
    const base = { ...existing }
    delete base.dcf
    delete base.marginOfSafety
    const next = hydrateFinancial(base, code, name, opts)
    setFinancial(code, next)
    return next.dcf || null
  }

  function updateHolding(portfolioId, holdingId, patch) {
    const p = portfolios.value.find((x) => x.id === portfolioId)
    if (!p) return
    const h = p.holdings.find((x) => x.id === holdingId)
    if (!h) return
    Object.assign(h, patch)
    persistPortfolios()
  }

  function removeHolding(portfolioId, holdingId) {
    const p = portfolios.value.find((x) => x.id === portfolioId)
    if (!p) return
    p.holdings = p.holdings.filter((x) => x.id !== holdingId)
    persistPortfolios()
  }

  function addHolding(portfolioId, holding) {
    const p = portfolios.value.find((x) => x.id === portfolioId)
    if (!p) return
    const id = Date.now() + Math.floor(Math.random() * 1000)
    p.holdings.push({
      id,
      ...holding,
      ex: inferHoldingEx(holding.code, holding.ex),
    })
    persistPortfolios()
  }

  /**
   * Upsert holdings by code within a portfolio.
   * Same code → update shares/cost/(name/ex); new code → add.
   * @returns {{ added: number, updated: number }}
   */
  function upsertHoldings(portfolioId, rows) {
    const p = portfolios.value.find((x) => x.id === portfolioId)
    if (!p || !Array.isArray(rows)) return { added: 0, updated: 0 }
    let added = 0
    let updated = 0
    const now = Date.now()
    rows.forEach((row, i) => {
      if (!row?.code) return
      const code = String(row.code).trim()
      const shares = Number(row.shares)
      const cost = Number(row.cost)
      if (!Number.isFinite(shares) || shares < 0) return
      const existing = p.holdings.find((h) => String(h.code) === code)
      if (existing) {
        existing.shares = shares
        if (Number.isFinite(cost)) existing.cost = cost
        if (row.name) existing.name = row.name
        if (row.ex) existing.ex = inferHoldingEx(code, row.ex)
        updated += 1
      } else {
        p.holdings.push({
          id: now + i,
          code,
          name: row.name || code,
          ex: inferHoldingEx(code, row.ex),
          shares,
          cost: Number.isFinite(cost) ? cost : 0,
        })
        added += 1
      }
    })
    persistPortfolios()
    return { added, updated }
  }

  return {
    portfolios,
    financialData,
    stockAnalyses,
    db,
    autoFetching,
    fetchProgress,
    fetchDebug,
    allHoldings,
    totals,
    getPrice,
    getFin,
    load,
    findHolding,
    nameOf,
    analyzeStock,
    autoFetchAll,
    positionFor,
    valuationFor,
    revalueStock,
    updateHolding,
    removeHolding,
    addHolding,
    upsertHoldings,
    persistPortfolios,
    setFinancial,
  }
})
