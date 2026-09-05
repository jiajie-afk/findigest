import { apiUrl, fetchTimed, ApiError } from './apiClient.js'
import {
  NEWS_BRIEF_SYSTEM,
  localNewsBrief,
  newsBriefCacheKey,
  parseNewsBrief,
} from '../../lib/newsBriefCore.js'

export { NEWS_BRIEF_SYSTEM, localNewsBrief, newsBriefCacheKey, parseNewsBrief }

const CACHE_KEY = 'fd_news_brief_v2'
const CACHE_MAX = 40
const TONES = new Set(['利好', '利空', '中性', '不确定'])

const memory = new Map()
const inflight = new Map()

export const newsBriefUi = typeof window === 'undefined' ? { addEventListener() {}, removeEventListener() {}, dispatchEvent() {} } : new EventTarget()

function loadStore() {
  if (typeof sessionStorage === 'undefined') return {}
  try {
    const parsed = JSON.parse(sessionStorage.getItem(CACHE_KEY) || '{}')
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function persist(key, brief) {
  memory.set(key, brief)
  if (typeof sessionStorage === 'undefined') return
  try {
    const store = loadStore()
    store[key] = { ...brief, at: Date.now() }
    const keys = Object.keys(store)
    if (keys.length > CACHE_MAX) {
      keys
        .sort((a, b) => (store[a].at || 0) - (store[b].at || 0))
        .slice(0, keys.length - CACHE_MAX)
        .forEach((k) => delete store[k])
    }
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(store))
  } catch {
    /* quota / private mode */
  }
}

function asHorizon(row, label) {
  if (row && typeof row === 'object') {
    return {
      label: row.label || label,
      effect: TONES.has(row.effect) ? row.effect : '不确定',
      text: String(row.text || ''),
    }
  }
  return { label, effect: '不确定', text: '' }
}

function packBrief(parsed, source) {
  return {
    thinking: String(parsed.thinking || ''),
    facts: String(parsed.facts || ''),
    tone: TONES.has(parsed.tone) ? parsed.tone : '不确定',
    sectors: Array.isArray(parsed.sectors) ? parsed.sectors.slice(0, 4) : [],
    short: asHorizon(parsed.short, '短期'),
    medium: asHorizon(parsed.medium, '中期'),
    long: asHorizon(parsed.long, '长期'),
    note: String(parsed.note || ''),
    raw: String(parsed.raw || ''),
    source: source === 'llm' ? 'llm' : 'local',
  }
}

export function readNewsBriefCache(itemOrKey) {
  const key = typeof itemOrKey === 'string' ? itemOrKey : newsBriefCacheKey(itemOrKey)
  if (!key) return null
  if (memory.has(key)) return memory.get(key)
  const row = loadStore()[key]
  if (!row || typeof row !== 'object') return null
  const brief = packBrief(row, row.source)
  if (!brief.facts) return null
  memory.set(key, brief)
  return brief
}

function payloadOf(item) {
  return {
    id: item?.id || '',
    title: item?.title || '',
    description: item?.description || '',
    event_date: item?.event_date || '',
    source_url: item?.source_url || '',
    channel: item?.channel || item?.lane || item?.catalyst_label || '',
    related: (item?.relatedHoldings || []).slice(0, 6).map((h) => ({
      name: h.name || h.code,
      strength: h.strength,
    })),
  }
}

export async function summarizeNewsItem(item) {
  const key = newsBriefCacheKey(item)
  if (!key || key === '|' || key === 'v2:|') throw new Error('没有可摘要的标题')
  const cached = readNewsBriefCache(key)
  if (cached?.facts) return cached
  if (inflight.has(key)) return inflight.get(key)

  const job = (async () => {
    try {
      const res = await fetchTimed(
        apiUrl('/api/news-brief'),
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payloadOf(item)),
        },
        28000,
      )
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        throw new ApiError({
          status: res.status,
          message: data?.message || `HTTP ${res.status}`,
        })
      }
      const parsed = data?.brief?.facts ? data.brief : parseNewsBrief(data?.raw || '')
      const fallback = localNewsBrief(item)
      const brief = packBrief(
        {
          ...fallback,
          ...parsed,
          short: parsed.short?.text ? parsed.short : fallback.short,
          medium: parsed.medium?.text ? parsed.medium : fallback.medium,
          long: parsed.long?.text ? parsed.long : fallback.long,
          thinking: parsed.thinking || fallback.thinking,
        },
        data?.source,
      )
      if (!brief.facts) throw new Error('empty')
      persist(key, brief)
      return brief
    } catch {
      const local = packBrief(localNewsBrief(item), 'local')
      persist(key, local)
      return local
    }
  })()

  inflight.set(key, job)
  try {
    return await job
  } finally {
    inflight.delete(key)
  }
}
