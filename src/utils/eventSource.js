/** Resolve a clickable provenance URL for calendar / catalyst events. */

function firstCode(related) {
  if (!related) return ''
  return String(related)
    .split(/[,，\s]+/)
    .map((s) => s.trim())
    .find(Boolean) || ''
}

function hostLabel(url) {
  try {
    const h = new URL(url).hostname.replace(/^www\./, '')
    if (h.includes('eastmoney')) return '东方财富'
    if (h.includes('federalreserve')) return '美联储'
    if (h.includes('sina')) return '新浪财经'
    if (h.includes('cls.cn') || h.includes('cls')) return '财联社'
    return h
  } catch {
    return '来源'
  }
}

function isBarePortal(url) {
  if (!url) return true
  try {
    const u = new URL(url)
    const path = (u.pathname || '/').replace(/\/+$/, '') || '/'
    return path === '/' && !u.search
  } catch {
    return true
  }
}

/**
 * @param {object} event
 * @param {string} [fallbackCode]
 * @returns {{ url: string, source: string }}
 */
export function resolveEventSource(event, fallbackCode = '') {
  const raw = (event?.url || event?.source_url || '').trim()
  const code = fallbackCode || firstCode(event?.related_stock_codes)
  const titled = (event?.title || '').slice(0, 36)
  let source = (event?.source || '').trim()

  if (raw && !isBarePortal(raw)) {
    return { url: raw, source: source || hostLabel(raw) }
  }

  if (event?.catalyst_type === 'earnings' && code) {
    return {
      url: `https://data.eastmoney.com/notices/stock/${code}.html`,
      source: source || '东方财富公告',
    }
  }

  if (code && titled) {
    return {
      url: `https://so.eastmoney.com/news/s?keyword=${encodeURIComponent(titled)}`,
      source: source || '东方财富搜索',
    }
  }

  if (raw) {
    return { url: raw, source: source || hostLabel(raw) }
  }

  if (titled) {
    return {
      url: `https://so.eastmoney.com/news/s?keyword=${encodeURIComponent(titled)}`,
      source: source || event?.reason || '检索来源',
    }
  }

  return { url: '', source: source || event?.reason || '' }
}
