/**
 * Revisit reminder: in-app banner + optional browser notification + Server酱.
 */
import { isBriefingFromToday, loadLatestBriefing } from '@/services/briefingArchive.js'

const NOTIFY_ASKED = 'fd_notify_asked_v1'
const LAST_PUSH_DAY = 'fd_last_push_day_v1'

function todayKey() {
  const d = new Date()
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
}

/** Past configured report hour and no briefing dated today */
export function needsRevisitHint(userLike) {
  const hour = Number(userLike?.report_hour ?? 8)
  const minute = Number(userLike?.report_minute ?? 0)
  const now = new Date()
  const due = now.getHours() > hour || (now.getHours() === hour && now.getMinutes() >= minute)
  if (!due) return false
  return !isBriefingFromToday(loadLatestBriefing())
}

export async function ensureBrowserNotifyPermission() {
  if (typeof Notification === 'undefined') return 'unsupported'
  if (Notification.permission === 'granted') return 'granted'
  if (Notification.permission === 'denied') return 'denied'
  if (localStorage.getItem(NOTIFY_ASKED)) return Notification.permission
  localStorage.setItem(NOTIFY_ASKED, '1')
  try {
    return await Notification.requestPermission()
  } catch {
    return 'denied'
  }
}

export function showBrowserReminder(title, body) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return false
  try {
    new Notification(title, { body, tag: 'findigest-daily' })
    return true
  } catch {
    return false
  }
}

/** Server酱 Turbo: https://sctapi.ftqq.com/{sendkey}.send */
export async function sendServerChan(sendkey, title, desp) {
  const key = String(sendkey || '').trim()
  if (!key) return { ok: false, error: 'no_key' }
  if (localStorage.getItem(LAST_PUSH_DAY) === todayKey()) {
    return { ok: false, error: 'already_today' }
  }
  try {
    const url = `https://sctapi.ftqq.com/${encodeURIComponent(key)}.send`
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: String(title).slice(0, 32), desp: String(desp || '').slice(0, 2000) }),
    })
    const data = await res.json().catch(() => ({}))
    if (res.ok && (data.code === 0 || data.data?.errno === 0 || data.errno === 0)) {
      localStorage.setItem(LAST_PUSH_DAY, todayKey())
      return { ok: true }
    }
    return { ok: false, error: data.message || 'send_failed' }
  } catch (e) {
    return { ok: false, error: String(e?.message || e) }
  }
}

/** Run once per app open: browser notify + optional Server酱 */
export async function runRevisitPush(userLike, briefing) {
  if (!needsRevisitHint(userLike)) return { skipped: true }
  const title = 'FinDigest · 今日简报待更新'
  const body = briefing?.headline
    ? `昨日要点仍在。打开今日刷新：${String(briefing.headline).slice(0, 40)}`
    : '开盘时段已到，打开今日生成你的私人简报。'

  if (userLike?.push_wechat && userLike?.serverchan_key) {
    await sendServerChan(userLike.serverchan_key, title, body)
  }

  if (userLike?.push_browser) {
    const perm = await ensureBrowserNotifyPermission()
    if (perm === 'granted') showBrowserReminder(title, body)
  }

  return { skipped: false }
}
