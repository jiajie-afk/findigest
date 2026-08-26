/** Eastmoney data fetch via /api/proxy (JSONP fallback) + financial hydration */

import { calculateValuation, resolveEarnings } from './valuation.js'
import { getStockName } from '@/data/stock_names.js'
import { peekFinancial, assessValuability } from '@/data/loader.js'
import { allowJsonpFallback, proxyFetch, withDataMeta } from './apiClient.js'
import { eastmoneySecid, parseSinaQuote, scaleEastmoneyPrice, sinaSymbol } from './quotesRefresh.js'

const MAX_CONCURRENT = 3
let activeCount = 0
const waitQueue = []

async function withConcurrency(fn) {
  if (activeCount >= MAX_CONCURRENT) {
    await new Promise((resolve) => waitQueue.push(resolve))
  }
  activeCount++
  try {
    return await fn()
  } finally {
    activeCount--
    if (waitQueue.length) waitQueue.shift()()
  }
}

const quoteCache = new Map()
const QUOTE_TTL = 30_000

/** Fixed JSONP callback name for server-side unwrap via /api/proxy */
const PROXY_CB = 'findigest'

/**
 * Prefer same-origin /api/proxy; fall back to browser JSONP only if allowed + proxy fails.
 * Always returns `{ data, asOf, source }` so UI can badge freshness / degradation.
 * @param {(cbName: string) => string} buildUrl
 * @param {string} cbName
 * @param {number} [timeout]
 * @returns {Promise<{ data: any, asOf: string|null, source: 'proxy'|'jsonp-fallback'|null }>}
 */
async function fetchPreferProxy(buildUrl, cbName, timeout = 10000) {
  try {
    const data = await proxyFetch(buildUrl(PROXY_CB), { timeoutMs: timeout })
    if (data != null) return withDataMeta(data, 'proxy')
  } catch {
    /* optional JSONP */
  }
  if (!allowJsonpFallback()) {
    return { data: null, asOf: null, source: null }
  }
  const data = await fJSONP(buildUrl(cbName), cbName, timeout)
  if (data == null) return { data: null, asOf: null, source: null }
  return withDataMeta(data, 'jsonp-fallback')
}

/** Unwrap legacy callers that expect bare payload */
function metaData(meta) {
  return meta?.data ?? null
}

export function fJSONP(url, cbName, timeout = 10000) {
  return new Promise((resolve) => {
    const s = document.createElement('script')
    window[cbName] = (d) => {
      delete window[cbName]
      try {
        document.head.removeChild(s)
      } catch {
        /* ignore */
      }
      resolve(d)
    }
    s.src = url
    s.onerror = () => resolve(null)
    document.head.appendChild(s)
    setTimeout(() => {
      if (window[cbName]) {
        delete window[cbName]
        try {
          document.head.removeChild(s)
        } catch {
          /* ignore */
        }
        resolve(null)
      }
    }, timeout)
  })
}

function stripHtml(s) {
  return (s || '').replace(/<[^>]+>/g, '')
}

export function fEM(kw, cb) {
  const p = JSON.stringify({
    uid: '',
    keyword: kw,
    type: ['cmsArticleWebOld'],
    client: 'web',
    clientType: 'web',
    clientVersion: 'curr',
    param: {
      cmsArticleWebOld: {
        searchScope: 'default',
        sort: 'default',
        pageIndex: 1,
        pageSize: 12,
        preTag: '',
        postTag: '',
      },
    },
  })
  const buildUrl = (cbName) =>
    `https://search-api-web.eastmoney.com/search/jsonp?cb=${cbName}&param=${encodeURIComponent(p)}`
  return fetchPreferProxy(buildUrl, cb, 10000)
    .then((meta) => {
      const d = metaData(meta)
      if (!d?.result?.cmsArticleWebOld) return []
      return d.result.cmsArticleWebOld
        .map((a) => {
          let url = a.articleUrl || ''
          if (!url && a.articleId) url = `https://finance.eastmoney.com/a/${a.articleId}.html`
          if (!url) url = `https://so.eastmoney.com/news/s?keyword=${encodeURIComponent((a.title || '').slice(0, 20))}`
          return {
            t: stripHtml(a.title),
            c: stripHtml(a.content).slice(0, 500),
            s: a.mediaName || '东方财富',
            d: a.date ? new Date(a.date).toISOString().slice(0, 10) : '',
            tp: 'news',
            url,
          }
        })
        .filter((n) => n.t.length > 4)
    })
    .catch(() => [])
}

export function fGuba(code, cb) {
  const buildUrl = () =>
    `https://guba.eastmoney.com/interface/GetData.aspx?path=newtopic/api&param=ps%3D12%26code%3D${code}%26type%3D0`
  return fetchPreferProxy(buildUrl, cb, 10000)
    .then((meta) => {
      const d = metaData(meta)
      if (!d?.Data) return []
      return d.Data.map((a) => {
        const postId = a.PostId || ''
        const url = postId
          ? `https://guba.eastmoney.com/news,${code},${postId}.html`
          : `https://guba.eastmoney.com/list,${code}.html`
        return {
          t: a.PostTitle || '',
          c: stripHtml(a.PostContent).slice(0, 300),
          s: '股吧',
          d: a.PostPublishTime ? a.PostPublishTime.slice(0, 10) : '',
          tp: 'forum',
          url,
        }
      }).filter((n) => n.t.length > 4)
    })
    .catch(() => [])
}

export function fAnn(code, cb) {
  const buildUrl = (cbName) =>
    `https://np-anotice-stock.eastmoney.com/api/security/ann?cb=${cbName}&sr=-1&page_size=15&page_index=1&ann_type=A&stock_list=${code}&f_node=0&s_node=0`
  return fetchPreferProxy(buildUrl, cb, 12000)
    .then((meta) => {
      const d = metaData(meta)
      if (!d?.data?.list) return []
      return d.data.list
        .map((a) => {
          let url = `https://data.eastmoney.com/notices/stock/${code}.html`
          if (a.art_code) url = `https://data.eastmoney.com/notices/detail/${code}/${a.art_code}.html`
          return {
            t: stripHtml(a.title || a.notice_title),
            c: (a.columns || []).map((c) => c.column_name).join(' '),
            s: '公告',
            d: a.notice_date ? a.notice_date.slice(0, 10) : '',
            tp: 'ann',
            url,
          }
        })
        .filter((n) => n.t.length > 4)
    })
    .catch(() => [])
}

export function fResearch(name, cb) {
  const p = JSON.stringify({
    uid: '',
    keyword: `${name} 研报`,
    type: ['cmsArticleWebOld'],
    client: 'web',
    clientType: 'web',
    clientVersion: 'curr',
    param: {
      cmsArticleWebOld: {
        searchScope: 'default',
        sort: 'default',
        pageIndex: 1,
        pageSize: 8,
        preTag: '',
        postTag: '',
      },
    },
  })
  const buildUrl = (cbName) =>
    `https://search-api-web.eastmoney.com/search/jsonp?cb=${cbName}&param=${encodeURIComponent(p)}`
  return fetchPreferProxy(buildUrl, cb, 10000)
    .then((meta) => {
      const d = metaData(meta)
      if (!d?.result?.cmsArticleWebOld) return []
      return d.result.cmsArticleWebOld
        .map((a) => {
          let url = a.articleUrl || ''
          if (!url && a.articleId) url = `https://finance.eastmoney.com/a/${a.articleId}.html`
          return {
            t: stripHtml(a.title),
            c: stripHtml(a.content).slice(0, 400),
            s: a.mediaName || '研报',
            d: a.date ? new Date(a.date).toISOString().slice(0, 10) : '',
            tp: 'research',
            url,
          }
        })
        .filter((n) => n.t.length > 4)
    })
    .catch(() => [])
}

/**
 * Sina hq list — proxy-only fallback. East Money refuses some hosting egress IPs,
 * and without this the app silently serves the bundled price snapshot forever.
 */
async function fetchQuoteSina(code, ex = 'SH') {
  const symbol = sinaSymbol(code, ex)
  if (!symbol) return null
  const payload = await proxyFetch(`https://hq.sinajs.cn/list=${symbol}`, { timeoutMs: 8000 })
  const parsed = parseSinaQuote(payload?.text, code, ex)
  if (!parsed) return null
  return {
    price: parsed.price,
    change_pct: parsed.change_pct,
    name: '',
    high: parsed.high,
    low: parsed.low,
    open: parsed.open,
    asOf: parsed.asOf || new Date().toISOString(),
    source: 'sina',
  }
}

export async function fetchQuote(code, ex = 'SH') {
  const secid = eastmoneySecid(code, ex)
  if (!secid) return null
  const cb = `cb_q_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
  const buildUrl = (cbName) =>
    `https://push2.eastmoney.com/api/qt/stock/get?secid=${secid}&fields=f43,f44,f45,f46,f47,f48,f57,f58,f59,f152,f169,f170,f60,f168&cb=${cbName}`
  let meta = { data: null }
  try {
    meta = await fetchPreferProxy(buildUrl, cb, 8000)
  } catch {
    /* fall through to Sina */
  }
  const d = metaData(meta)
  if (!d?.data) {
    return fetchQuoteSina(code, ex).catch(() => null)
  }
  const x = d.data
  const places = x.f59 ?? x.f152
  const price = scaleEastmoneyPrice(x.f43, places)
  if (!(price > 0)) return fetchQuoteSina(code, ex).catch(() => null)
  const change_pct = (x.f170 ?? 0) / 100
  const asOf = meta.asOf || new Date().toISOString()
  return {
    price,
    change_pct,
    name: x.f58 || '',
    high: scaleEastmoneyPrice(x.f44, places),
    low: scaleEastmoneyPrice(x.f45, places),
    open: scaleEastmoneyPrice(x.f46, places),
    asOf,
    source: meta.source || 'proxy',
  }
}

export async function fetchQuoteCached(code, ex = 'SH') {
  const key = eastmoneySecid(code, ex) || `${code}_${ex}`
  const cached = quoteCache.get(key)
  if (cached && Date.now() - cached.ts < QUOTE_TTL) {
    return { ...cached.data, source: 'cache', asOf: cached.data.asOf || new Date(cached.ts).toISOString() }
  }
  const data = await fetchQuote(code, ex)
  if (data) quoteCache.set(key, { data, ts: Date.now() })
  return data
}

export function hydrateFinancial(base, code, name, opts = {}) {
  const resolvedName = name || getStockName(code) || ''
  const fin = { ...(peekFinancial(code) || {}), ...base }
  if (!fin.price && base.price) fin.price = base.price
  if (base.asOf) fin.quoteAsOf = base.asOf
  if (base.source) fin.quoteSource = base.source
  fin.valuability = assessValuability(fin)
  if (!fin.asOf && (fin.quoteAsOf || fin.financialAsOf)) {
    fin.asOf = fin.quoteAsOf || fin.financialAsOf
  }

  // Always sanitize EPS before valuation / UI consume it
  try {
    const earned = resolveEarnings(fin, code)
    if (earned.quality === 'corrected' || earned.quality === 'ok') {
      if (earned.quality === 'corrected' && fin.eps !== earned.eps) {
        fin.epsReported = fin.epsReported ?? fin.eps
      }
      fin.eps = Math.round(earned.eps * 10000) / 10000
      fin.epsSource = earned.source
      fin.epsQuality = earned.quality
    }
  } catch {
    /* ignore */
  }

  try {
    const dcf = calculateValuation(fin, code, resolvedName, opts)
    if (dcf) {
      fin.dcf = dcf
      if (dcf.marginOfSafety != null) {
        fin.marginOfSafety = Math.round(dcf.marginOfSafety * 10) / 10
      }
      if (dcf.currentEPS != null) fin.eps = dcf.currentEPS
      if (dcf.epsSource) fin.epsSource = dcf.epsSource
      if (dcf.epsQuality) fin.epsQuality = dcf.epsQuality
      if (dcf.valuability) fin.valuability = dcf.valuability
    }
  } catch {
    /* ignore */
  }
  return fin
}

async function _fetchAllDeep(code, name, ex = 'SH', onDebug) {
  const t = Date.now()
  const [em, guba, ann, research, quote] = await Promise.all([
    fEM(`${name} ${code}`, `cb_${t}_1`).catch(() => []),
    fGuba(code, `cb_${t}_2`).catch(() => []),
    fAnn(code, `cb_${t}_3`).catch(() => []),
    fResearch(name, `cb_${t}_4`).catch(() => []),
    fetchQuoteCached(code, ex).catch(() => null),
  ])
  if (typeof onDebug === 'function') {
    onDebug({
      em: em.length,
      guba: guba.length,
      ann: ann.length,
      research: research.length,
      hasFinancial: !!quote,
      time: new Date().toLocaleTimeString(),
      quote,
    })
  }
  const all = [...em, ...guba, ...ann, ...research]
  const seen = {}
  return all.filter((n) => {
    if (seen[n.t]) return false
    seen[n.t] = true
    return true
  })
}

export async function fetchAllDeep(code, name, ex = 'SH', onDebug) {
  return withConcurrency(() => _fetchAllDeep(code, name, ex, onDebug))
}
