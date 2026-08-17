/**
 * A-share earnings appointment calendar via Eastmoney datacenter.
 * One range query + pagination (not per-day hammering).
 */

import { proxyFetch } from './apiClient.js'

const BUY_DAYS = 3
const SELL_DAYS = 1
/** Soft cap so Events UI stays interactive */
const MAX_EVENTS = 180
const PAGE_SIZE = 100
const MAX_PAGES = 3

function isoToday() {
  return new Date().toISOString().slice(0, 10)
}

function shiftIso(iso, days) {
  const d = new Date(iso + 'T12:00:00')
  if (Number.isNaN(d.getTime())) return ''
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function toIsoDate(raw) {
  if (!raw) return ''
  return String(raw).slice(0, 10)
}

function buildRangeUrl(fromIso, toIso, pageNumber) {
  const filter = `(APPOINT_PUBLISH_DATE>='${fromIso}')(APPOINT_PUBLISH_DATE<='${toIso}')`
  const qs = new URLSearchParams({
    reportName: 'RPT_PUBLIC_BS_APPOIN',
    columns:
      'SECURITY_CODE,SECURITY_NAME_ABBR,REPORT_DATE,REPORT_TYPE,REPORT_TYPE_NAME,APPOINT_PUBLISH_DATE,IS_PUBLISH,RESIDUAL_DAYS',
    filter,
    pageNumber: String(pageNumber),
    pageSize: String(PAGE_SIZE),
    sortColumns: 'APPOINT_PUBLISH_DATE,SECURITY_CODE',
    sortTypes: '1,1',
    source: 'WEB',
    client: 'WEB',
  })
  return `https://datacenter-web.eastmoney.com/api/data/v1/get?${qs.toString()}`
}

function mapRow(row) {
  const code = String(row.SECURITY_CODE || '').trim()
  const name = String(row.SECURITY_NAME_ABBR || '').trim()
  const date = toIsoDate(row.APPOINT_PUBLISH_DATE)
  const reportType = String(row.REPORT_TYPE_NAME || row.REPORT_TYPE || '财报').trim()
  if (!code || !date) return null
  const buy_from = shiftIso(date, -BUY_DAYS)
  const sell_by = shiftIso(date, SELL_DAYS)
  return {
    id: `earn-${code}-${date}`,
    title: `${name || code} ${reportType}披露`,
    event_date: date,
    event_type: 'confirmed',
    importance: 4,
    catalyst_type: 'earnings',
    catalyst_label: '财报/业绩',
    buy_from,
    sell_by,
    trade_hint: buy_from
      ? `交易窗口：建议 ${buy_from} 前布局，事件后至 ${sell_by} 评估兑现/减仓`
      : `财报日前约 ${BUY_DAYS} 天关注布局，披露后约 ${SELL_DAYS} 天评估兑现`,
    description: `${name || code}（${code}）预约于 ${date} 披露${reportType}。关注业绩与指引，不以交易信号替代研究。`,
    related_stock_codes: code,
    related_stock_name: name,
    report_type: reportType,
    source_url: `https://data.eastmoney.com/notices/stock/${code}.html`,
    _source: 'earnings_calendar',
  }
}

/**
 * @param {{ daysAhead?: number, signal?: AbortSignal }} [opts]
 * @returns {Promise<{ events: object[], asOf: string, source: 'live'|'empty', error?: string }>}
 */
export async function fetchEarningsAppointments(opts = {}) {
  const daysAhead = Math.min(14, Math.max(3, opts.daysAhead ?? 10))
  const fromIso = isoToday()
  const toIso = shiftIso(fromIso, daysAhead)
  const rows = []
  let error = ''

  try {
    for (let page = 1; page <= MAX_PAGES; page++) {
      if (opts.signal?.aborted) break
      const raw = await proxyFetch(buildRangeUrl(fromIso, toIso, page), {
        timeoutMs: 12000,
        signal: opts.signal,
      })
      if (raw?.success === false && !raw?.result?.data) {
        error = raw.message || '日历接口失败'
        break
      }
      const list = raw?.result?.data
      if (!Array.isArray(list) || !list.length) break
      for (const row of list) {
        const e = mapRow(row)
        if (e) rows.push(e)
      }
      if (list.length < PAGE_SIZE) break
      if (rows.length >= MAX_EVENTS) break
    }
  } catch (e) {
    error = e?.message || '日历拉取失败'
  }

  const seen = new Set()
  const events = []
  for (const e of rows) {
    const k = `${e.related_stock_codes}|${e.event_date}|${e.report_type}`
    if (seen.has(k)) continue
    seen.add(k)
    events.push(e)
    if (events.length >= MAX_EVENTS) break
  }
  events.sort((a, b) => String(a.event_date).localeCompare(String(b.event_date)))

  return {
    events,
    asOf: new Date().toISOString(),
    source: events.length ? 'live' : 'empty',
    error: events.length ? undefined : error || undefined,
  }
}

export function daysUntil(eventDate) {
  if (!eventDate || eventDate === '待定') return null
  const a = new Date(isoToday() + 'T12:00:00')
  const b = new Date(String(eventDate).slice(0, 10) + 'T12:00:00')
  if (Number.isNaN(b.getTime())) return null
  return Math.round((b - a) / 86400000)
}

export function windowStatus(e, today = isoToday()) {
  const date = e.event_date
  if (!date || date === '待定') return { id: 'tbd', label: '日期待定' }
  const buy = e.buy_from || shiftIso(date, -BUY_DAYS)
  const sell = e.sell_by || shiftIso(date, SELL_DAYS)
  if (today < buy) return { id: 'soon', label: '窗口未开' }
  if (today <= date) return { id: 'open', label: '窗口已开' }
  if (today <= sell) return { id: 'after', label: '兑现观察' }
  return { id: 'done', label: '已过窗' }
}
