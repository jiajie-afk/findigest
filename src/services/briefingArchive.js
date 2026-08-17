/**
 * Briefing archive + day-over-day retention hook.
 * Prefer per-account vault; avoid dual-writing sensitive briefings to root localStorage when logged in.
 */
import { vaultGet, vaultSet, getActiveAccountId } from '@/services/vault.js'

export const LATEST_KEY = 'fd_latest_briefing'
export const PREV_KEY = 'fd_briefing_prev'

function dayKey(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return String(iso).slice(0, 10)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function itemKey(item) {
  return `${item?.code || ''}|${item?.type || ''}|${String(item?.title || '').slice(0, 24)}`
}

export function loadLatestBriefing() {
  try {
    if (getActiveAccountId()) {
      const v = vaultGet(LATEST_KEY, null)
      if (v && typeof v === 'object') return v
      return null
    }
    const raw = localStorage.getItem(LATEST_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function loadPrevBriefing() {
  try {
    if (getActiveAccountId()) {
      const v = vaultGet(PREV_KEY, null)
      if (v && typeof v === 'object') return v
      return null
    }
    const raw = localStorage.getItem(PREV_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

/** Persist new report; archive prior day snapshot for DoD. */
export function saveBriefing(report) {
  if (!report) return
  const prev = loadLatestBriefing()
  const loggedIn = !!getActiveAccountId()
  if (prev?.date && dayKey(prev.date) !== dayKey(report.date)) {
    if (loggedIn) {
      vaultSet(PREV_KEY, prev)
    } else {
      localStorage.setItem(PREV_KEY, JSON.stringify(prev))
    }
  }
  if (loggedIn) {
    vaultSet(LATEST_KEY, report)
    try {
      localStorage.removeItem(LATEST_KEY)
      localStorage.removeItem(PREV_KEY)
    } catch {
      /* ignore */
    }
  } else {
    localStorage.setItem(LATEST_KEY, JSON.stringify(report))
  }
}

/**
 * @returns {{ lines: string[], hasChange: boolean }}
 */
export function diffBriefings(current, previous) {
  if (!current?.items?.length || !previous?.items?.length) {
    return { lines: [], hasChange: false }
  }
  if (dayKey(current.date) === dayKey(previous.date)) {
    return { lines: [], hasChange: false }
  }

  const cur = current.items.slice(0, 5)
  const prev = previous.items.slice(0, 5)
  const prevMap = new Map(prev.map((i) => [itemKey(i), i]))
  const curMap = new Map(cur.map((i) => [itemKey(i), i]))

  const lines = []
  cur.forEach((item) => {
    if (!prevMap.has(itemKey(item))) {
      lines.push(`新上榜：${item.title}`)
    }
  })
  prev.forEach((item) => {
    if (!curMap.has(itemKey(item))) {
      lines.push(`已淡出：${item.title}`)
    }
  })

  // Same key but priority/type shift
  cur.forEach((item) => {
    const old = prevMap.get(itemKey(item))
    if (old && old.type !== item.type) {
      lines.push(`变化：${item.title}（${old.type} → ${item.type}）`)
    }
  })

  return { lines: lines.slice(0, 4), hasChange: lines.length > 0 }
}

export function isBriefingFromToday(report) {
  if (!report?.date) return false
  return dayKey(report.date) === dayKey(new Date().toISOString())
}
