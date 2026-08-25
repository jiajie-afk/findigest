/**
 * CCTV News (央视网) public CMS lists → ranked headlines.
 * Uses the same JSONP the news.cctv.com / jingji.cctv.com frontends load.
 * No article-body scrape.
 */

export const CCTV_CHANNELS = [
  { id: 'china', jsonp: 'china', label: '国内', weight: 10 },
  { id: 'jingji', jsonp: 'economy_zixun', label: '财经', weight: 9 },
  { id: 'economy', jsonp: 'economy', label: '经济', weight: 8 },
  { id: 'news', jsonp: 'news', label: '要闻', weight: 6 },
  { id: 'law', jsonp: 'law', label: '法治', weight: 5 },
  { id: 'world', jsonp: 'world', label: '国际', weight: 7 },
]

/** Same-title keep: 国内优先于国际；财经专表优先于国内转载。 */
const CHANNEL_KEEP = {
  xwlb: 80,
  jingji: 50,
  economy: 40,
  china: 35,
  law: 25,
  news: 20,
  world: 10,
}

/** Domestic lane still keeps a 财经 floor so县域时政不会把央视财经挤光。 */
export const CHANNEL_FLOORS = { world: 0, finance: 8 }

export function isWorldChannel(channel) {
  return channel === 'world'
}

export function itemLane(item) {
  if (item?.lane === 'world' || item?.lane === 'domestic') return item.lane
  return laneOf(item?.channel)
}

export function laneOf(channel) {
  return isWorldChannel(channel) ? 'world' : 'domestic'
}

/** 国内 / 国际分栏独立取条，不再互相挤占。 */
export const LANE_LIMITS = { domestic: 40, world: 32 }

export function splitLaneLimits(_total = 40) {
  return { domestic: LANE_LIMITS.domestic, world: LANE_LIMITS.world }
}

export const CCTV_JSONP_URL = (jsonp, page = 1) =>
  `https://news.cctv.com/2019/07/gaiban/cmsdatainterface/page/${jsonp}_${page}.jsonp?cb=${jsonp}`

export const XWLB_CHANNEL = { id: 'xwlb', label: '新闻联播', weight: 12 }

export const XWLB_DAY_URL = (ymd) => `https://tv.cctv.com/lm/xwlb/day/${ymd}.shtml`

export function xwlbDayKeys(now = Date.now(), count = 3) {
  const out = []
  for (let i = 0; i < count; i++) {
    const d = new Date(now - i * 86400_000)
    out.push(d.toLocaleDateString('en-CA', { timeZone: 'Asia/Shanghai' }).replace(/-/g, ''))
  }
  return out
}

export function cleanXwlbTitle(title) {
  return String(title || '')
    .replace(/^完整版/, '')
    .replace(/^\[视频\]/, '')
    .replace(/^视频/, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function isXwlbFullEpisodeTitle(title) {
  const t = cleanXwlbTitle(title)
  return /^《新闻联播》/.test(t) && !/\[视频\]/.test(String(title || ''))
}

/**
 * Official 新闻联播 day rundown (tv.cctv.com/lm/xwlb/day/YYYYMMDD.shtml).
 * Titles + program URLs only — no transcript, no audio.
 */
export function parseXwlbDayHtml(html, ymd) {
  const raw = String(html || '')
  const byUrl = new Map()
  const re =
    /href="(https:\/\/tv\.cctv\.com\/\d{4}\/\d{2}\/\d{2}\/VIDE[^"]+\.s?html?)"[^>]*title="([^"]*)"/gi
  let m
  while ((m = re.exec(raw))) {
    const url = m[1]
    const title = cleanXwlbTitle(m[2])
    if (!title || !isAllowedCctvArticleUrl(url)) continue
    if (isXwlbFullEpisodeTitle(m[2]) || isXwlbFullEpisodeTitle(title)) continue
    if (!byUrl.has(url)) byUrl.set(url, title)
  }

  const date = String(ymd || '').replace(/^(\d{4})(\d{2})(\d{2})$/, '$1-$2-$3')
  const focus = date ? `${date} 19:00:00` : ''
  const rows = []
  let seenDomesticBrief = false
  let i = 0
  for (const [url, title] of byUrl) {
    if (/国内联播快讯/.test(title)) seenDomesticBrief = true
    const world = /国际联播快讯/.test(title) || (seenDomesticBrief && !/国内联播快讯/.test(title))
    rows.push({
      id: url,
      title,
      brief: '',
      url,
      keywords: world ? '新闻联播 国际' : '新闻联播',
      focus_date: focus,
      channel: XWLB_CHANNEL.id,
      channelLabel: XWLB_CHANNEL.label,
      channelWeight: XWLB_CHANNEL.weight,
      index: i,
      lane: world ? 'world' : 'domestic',
    })
    i += 1
  }
  return rows
}

const ARTICLE_HOSTS = new Set([
  'news.cctv.com',
  'news.cctv.cn',
  'china.cctv.com',
  'world.cctv.com',
  'tv.cctv.com',
  'jingji.cctv.com',
  'jingji.cctv.cn',
  'economy.cctv.com',
  'military.cctv.com',
  'people.cctv.com',
  'sports.cctv.com',
  'english.cctv.com',
])

const RULES = [
  { re: /习近平|中共中央总书记/, pts: 48 },
  { re: /中共中央政治局|中央军委|全国人大常委会|全国政协/, pts: 36 },
  { re: /国务院常务会议|国常会/, pts: 32 },
  { re: /中国人民银行|央行|降准|降息|MLF|LPR/, pts: 28 },
  { re: /证监会|国家金融监督管理总局|银保监会|证券交易所/, pts: 22 },
  { re: /国务院|外交部|国防部|财政部|国家发展改革委|发改委|商务部|市场监管总局/, pts: 22 },
  { re: /关税|制裁|停火|开战|核武器|北约|霍尔木兹/, pts: 20 },
  { re: /特朗普|白宫|美联储|国际原子能机构/, pts: 14 },
  { re: /\bCPI\b|\bPPI\b|\bGDP\b|\bPMI\b|社融|新增信贷|特别国债|居民贷款|提前还贷/, pts: 16 },
  { re: /\bIPO\b|科创板|创业板|港股|A股|打新/, pts: 12 },
  { re: /台风登陆|洪涝|山火|矿难|溃坝/, pts: 16 },
  { re: /纪委监委|立案调查|开除党籍/, pts: 12 },
]

const DOWNRANK = /足协|世界杯|演唱会|综艺|明星情侣|追剧|美食节|换装开市|烟火气/

export function isFinanceChannel(channel) {
  return channel === 'jingji' || channel === 'economy'
}

export function parseCctvJsonp(text) {
  const raw = String(text || '').trim()
  if (!raw) return []
  const start = raw.indexOf('(')
  const end = raw.lastIndexOf(')')
  if (start < 0 || end <= start) return []
  let data
  try {
    data = JSON.parse(raw.slice(start + 1, end))
  } catch {
    return []
  }
  const list = data?.data?.list
  return Array.isArray(list) ? list : []
}

export function isAllowedCctvArticleUrl(url) {
  if (!url || typeof url !== 'string') return false
  let parsed
  try {
    parsed = new URL(url.trim())
  } catch {
    return false
  }
  if (parsed.protocol !== 'https:') return false
  if (!ARTICLE_HOSTS.has(parsed.hostname.replace(/^www\./, ''))) return false
  const path = parsed.pathname || ''
  if (path === '/' || path === '') return false
  return /\.s?html?$/i.test(path) || /\/\d{4}\/\d{2}\/\d{2}\//.test(path)
}

function blob(item) {
  return `${item.title || ''} ${item.keywords || ''} ${item.brief || ''}`
}

function quakeBoost(text) {
  const m = String(text).match(/(\d+(?:\.\d+)?)级地震/)
  if (!m) return 0
  const mag = Number(m[1])
  if (mag >= 7) return 22
  if (mag >= 6) return 14
  if (mag >= 5) return 6
  return 0
}

export function tierOfScore(score) {
  if (score >= 70) return { id: 's', label: '特要' }
  if (score >= 52) return { id: 'a', label: '要闻' }
  if (score >= 32) return { id: 'b', label: '关注' }
  return { id: 'c', label: '简讯' }
}

export function scoreCctvItem(item, { now = Date.now(), channelWeight = 0, index = 99 } = {}) {
  const text = blob(item)
  let score = channelWeight
  for (const rule of RULES) {
    if (rule.re.test(text)) score += rule.pts
  }
  score += quakeBoost(text)
  if (item.channel === 'xwlb') score += 40
  if (DOWNRANK.test(text) && score < 52 && item.channel !== 'xwlb') score -= 22
  score += Math.max(0, 6 - Number(index) || 0)

  const ts = Date.parse(String(item.focus_date || item.time || '').replace(/-/g, '/'))
  if (Number.isFinite(ts)) {
    const ageH = (now - ts) / 3600_000
    if (ageH > 72 && score < 70) return { score: -1, ageH }
    if (ageH > 36) score -= 12
    if (ageH > 18) score -= 4
  }
  return { score: Math.max(0, Math.min(100, score)), ageH: 0 }
}

function normalizeTitle(title) {
  return String(title || '')
    .replace(/\s+/g, '')
    .slice(0, 80)
}

function keepScore(item) {
  return CHANNEL_KEEP[item.channel] || 0
}

export function hydrateChannelItems(list, channel) {
  const out = []
  for (let i = 0; i < list.length; i++) {
    const row = list[i] || {}
    const url = String(row.url || '').trim()
    const title = String(row.title || '').trim()
    if (!title || !isAllowedCctvArticleUrl(url)) continue
    out.push({
      id: String(row.id || url).slice(0, 80),
      title,
      brief: String(row.brief || '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 160),
      url,
      keywords: String(row.keywords || '').trim(),
      focus_date: String(row.focus_date || '').trim(),
      channel: channel.id,
      channelLabel: channel.label,
      channelWeight: channel.weight,
      index: i,
    })
  }
  return out
}

function emptyCounts() {
  return {
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
  }
}

function tally(items, now) {
  const counts = emptyCounts()
  const today = new Date(now).toLocaleDateString('en-CA', { timeZone: 'Asia/Shanghai' })
  for (const it of items) {
    counts[it.tier] += 1
    if (it.date === today) counts.today += 1
    if (it.channel === 'world') counts.world += 1
    if (it.channel === 'jingji') counts.jingji += 1
    if (it.channel === 'economy') counts.economy += 1
    if (it.channel === 'china') counts.china += 1
    if (it.channel === 'xwlb') counts.xwlb += 1
    if (isFinanceChannel(it.channel)) counts.finance += 1
    if (itemLane(it) === 'domestic') counts.domestic += 1
  }
  return counts
}

/**
 * Keep 特要/要闻, then fill 国际 / 财经 floors, then the rest by score.
 */
export function applyChannelFloors(scored, { limit = 40, floors = CHANNEL_FLOORS } = {}) {
  const picked = []
  const used = new Set()
  const keyOf = (it) => it.id || normalizeTitle(it.title)

  const take = (pred, n) => {
    let got = 0
    for (const it of scored) {
      if (picked.length >= limit) break
      if (n != null && got >= n) break
      const k = keyOf(it)
      if (used.has(k)) continue
      if (!pred(it)) continue
      picked.push(it)
      used.add(k)
      got += 1
    }
    return got
  }

  take((it) => it.channel === 'xwlb', null)
  take((it) => it.tier === 's' || it.tier === 'a', null)
  const worldHave = picked.filter((it) => it.channel === 'world').length
  take((it) => it.channel === 'world', Math.max(0, (floors.world || 0) - worldHave))
  const finHave = picked.filter((it) => isFinanceChannel(it.channel)).length
  take((it) => isFinanceChannel(it.channel), Math.max(0, (floors.finance || 0) - finHave))
  take(() => true, null)

  picked.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    return (b._ts || 0) - (a._ts || 0)
  })
  return picked.slice(0, limit)
}

function stampLane(list, lane) {
  return list.map((item, i) => {
    const { _ts, ...rest } = item
    return { ...rest, lane, rank: i + 1 }
  })
}

export function rankCctvItems(rawItems, { now = Date.now(), limit = 40 } = {}) {
  const byKey = new Map()
  for (const item of rawItems || []) {
    const key = `${itemLane(item)}:${normalizeTitle(item.title) || item.id}`
    const prev = byKey.get(key)
    if (!prev) {
      byKey.set(key, item)
      continue
    }
    const betterKeep = keepScore(item) > keepScore(prev)
    const heavier = keepScore(item) === keepScore(prev) && item.channelWeight > prev.channelWeight
    if (betterKeep || heavier) {
      byKey.set(key, { ...item, index: Math.min(item.index, prev.index) })
    } else {
      prev.index = Math.min(item.index ?? 99, prev.index ?? 99)
    }
  }

  const scored = []
  for (const item of byKey.values()) {
    const { score } = scoreCctvItem(item, {
      now,
      channelWeight: item.channelWeight,
      index: item.index,
    })
    if (score < 0) continue
    const tier = tierOfScore(score)
    const ts = Date.parse(String(item.focus_date || '').replace(/-/g, '/'))
    scored.push({
      id: item.id,
      title: item.title,
      brief: item.brief,
      url: item.url,
      channel: item.channel,
      channelLabel: item.channelLabel,
      lane: itemLane(item),
      time: item.focus_date,
      date: item.focus_date ? item.focus_date.slice(0, 10) : '',
      clock: clockOf(item.focus_date),
      score,
      tier: tier.id,
      tierLabel: tier.label,
      _ts: Number.isFinite(ts) ? ts : 0,
    })
  }

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    return b._ts - a._ts
  })

  const lanes = splitLaneLimits(limit)
  const domestic = applyChannelFloors(
    scored.filter((it) => itemLane(it) !== 'world'),
    { limit: lanes.domestic, floors: CHANNEL_FLOORS },
  )
  const worldScored = scored.filter((it) => itemLane(it) === 'world')
  const world = [
    ...worldScored.filter((it) => it.channel === 'xwlb'),
    ...worldScored.filter((it) => it.channel !== 'xwlb'),
  ].slice(0, lanes.world)
  return [...stampLane(domestic, 'domestic'), ...stampLane(world, 'world')]
}

function clockOf(focusDate) {
  const m = String(focusDate || '').match(/(\d{1,2}:\d{2})/)
  return m ? m[1] : ''
}

/**
 * @param {{ fetchText?: (url: string) => Promise<string>, now?: number, limit?: number }} [opts]
 */
export async function collectCctvNews(opts = {}) {
  const fetchText = opts.fetchText
  if (typeof fetchText !== 'function') {
    throw new Error('fetchText required')
  }
  const now = opts.now ?? Date.now()
  const raw = []
  const errors = []
  await Promise.all(
    CCTV_CHANNELS.map(async (ch) => {
      try {
        const text = await fetchText(CCTV_JSONP_URL(ch.jsonp))
        const list = parseCctvJsonp(text)
        raw.push(...hydrateChannelItems(list, ch))
      } catch (e) {
        errors.push({ channel: ch.id, message: e?.message || 'fetch_failed' })
      }
    }),
  )
  await Promise.all(
    xwlbDayKeys(now).map(async (ymd) => {
      try {
        const text = await fetchText(XWLB_DAY_URL(ymd))
        raw.push(...parseXwlbDayHtml(text, ymd))
      } catch (e) {
        errors.push({ channel: 'xwlb', day: ymd, message: e?.message || 'fetch_failed' })
      }
    }),
  )
  const items = rankCctvItems(raw, { now, limit: opts.limit ?? 40 })
  return {
    items,
    groups: {
      domestic: items.filter((it) => it.lane === 'domestic'),
      world: items.filter((it) => it.lane === 'world'),
    },
    counts: tally(items, now),
    errors,
    asOf: new Date(now).toISOString(),
  }
}
