/** Lightweight sentiment / news analysis ported from legacy FinDigest */

import { ANALYSIS_DIMS } from '@/data/analysis_dims.js'

const GW = {
  涨停: 2, 大涨: 2, 暴涨: 2, 新高: 2, 超预期: 2, 大幅增长: 2, 连板: 2,
  涨: 1, 增长: 1, 买入: 1, 上调: 1, 增持: 1, 回购: 1, 分红: 1, 提价: 1, 涨价: 1,
  看好: 1, 受益: 1, 突破: 1, 加仓: 1, 净买入: 1, 中标: 1, 反弹: 1, 走强: 1,
  预增: 1, 扭亏: 1, 放量: 1, 利好: 1, 景气: 1, 订单: 1, 合同: 1,
}
const BW = {
  暴跌: 2, 跌停: 2, 大跌: 2, 暴雷: 2, 退市: 2, 重大亏损: 2, 违规: 2, 处罚: 2,
  下跌: 1, 卖出: 1, 减持: 1, 下调: 1, 亏损: 1, 减少: 1, 萎缩: 1, 走低: 1,
  下挫: 1, 利空: 1, 承压: 1, 疲软: 1, 清仓: 1, 破位: 1, 跌破: 1, 罚: 1,
  诉讼: 1, 债务: 1, 违约: 1,
}

const NEGATION_WORDS = ['不', '未', '没', '非', '无', '难', '缺乏', '不足', '尚未', '并非', '难以']

function hasNegation(text, keywordPos) {
  const before = text.slice(Math.max(0, keywordPos - 6), keywordPos)
  return NEGATION_WORDS.some((neg) => before.includes(neg))
}

function sc(t) {
  let s = 0
  const text = t || ''
  for (const k in GW) {
    let from = 0
    while (true) {
      const pos = text.indexOf(k, from)
      if (pos < 0) break
      s += hasNegation(text, pos) ? -GW[k] : GW[k]
      from = pos + k.length
    }
  }
  for (const k in BW) {
    let from = 0
    while (true) {
      const pos = text.indexOf(k, from)
      if (pos < 0) break
      s += hasNegation(text, pos) ? BW[k] : -BW[k]
      from = pos + k.length
    }
  }
  return s
}

function isRecent(t, d = 7) {
  if (!t || t.length < 10) return true
  try {
    return (Date.now() - new Date(t.slice(0, 10))) / 864e5 <= d
  } catch {
    return true
  }
}

function parseDates(text) {
  const dates = []
  const m1 = text.matchAll(/(\d{4})[年/-](\d{1,2})[月/-](\d{1,2})/g)
  for (const m of m1) {
    const y = m[1]
    const mo = String(m[2]).padStart(2, '0')
    const da = String(m[3]).padStart(2, '0')
    dates.push(`${y}-${mo}-${da}`)
  }
  // 月日无年份：默认当年，若已过则明年
  const year = new Date().getFullYear()
  const m2 = text.matchAll(/(?<!\d)(\d{1,2})月(\d{1,2})日/g)
  for (const m of m2) {
    const mo = String(m[1]).padStart(2, '0')
    const da = String(m[2]).padStart(2, '0')
    let d = `${year}-${mo}-${da}`
    const today = new Date().toISOString().slice(0, 10)
    if (d < today) d = `${year + 1}-${mo}-${da}`
    dates.push(d)
  }
  return dates
}

function parseRelativeDate(text) {
  const now = new Date()
  const iso = (d) => d.toISOString().slice(0, 10)
  if (/明天|明日/.test(text)) {
    const d = new Date(now)
    d.setDate(d.getDate() + 1)
    return iso(d)
  }
  if (/后天/.test(text)) {
    const d = new Date(now)
    d.setDate(d.getDate() + 2)
    return iso(d)
  }
  if (/大后天/.test(text)) {
    const d = new Date(now)
    d.setDate(d.getDate() + 3)
    return iso(d)
  }
  const afterDays = text.match(/(\d+)\s*天(?:后|内)/)
  if (afterDays) {
    const d = new Date(now)
    d.setDate(d.getDate() + Math.min(90, +afterDays[1]))
    return iso(d)
  }
  if (/本周|这周/.test(text)) {
    const d = new Date(now)
    const day = d.getDay() || 7
    d.setDate(d.getDate() + (5 - day)) // 本周五
    return iso(d)
  }
  if (/下周/.test(text)) {
    const d = new Date(now)
    const day = d.getDay() || 7
    d.setDate(d.getDate() + (7 - day + 3)) // 下周三附近
    return iso(d)
  }
  if (/本月/.test(text)) {
    const d = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    return iso(d)
  }
  if (/下月|下个月/.test(text)) {
    const d = new Date(now.getFullYear(), now.getMonth() + 2, 0)
    return iso(d)
  }
  if (/年内/.test(text)) return `${now.getFullYear()}-12-31`
  const q = text.match(/Q([1-4])|第([一二三四1234])季度/)
  if (q) {
    const map = { 一: 1, 二: 2, 三: 3, 四: 4, 1: 1, 2: 2, 3: 3, 4: 4 }
    const n = +(q[1] || map[q[2]] || 4)
    return `${now.getFullYear()}-${String(n * 3).padStart(2, '0')}-28`
  }
  return null
}

const CATALYST_RULES = [
  {
    type: 'ad_sponsor',
    label: '广告/赞助',
    re: /广告|赞助|冠名|代言|联名|世界杯|奥运会|春晚|植入|品牌合作/,
    importance: 4,
    buyDaysBefore: 1,
    sellDaysAfter: 1,
  },
  {
    type: 'film_ip',
    label: '影视/IP',
    re: /上映|首映|定档|票房|剧集|爆款|档期|联名周边|电影/,
    importance: 4,
    buyDaysBefore: 2,
    sellDaysAfter: 3,
  },
  {
    type: 'product_launch',
    label: '发布会/新品',
    re: /发布会|新品发布|亮相|首发|上市发布|产品发布|发售/,
    importance: 4,
    buyDaysBefore: 1,
    sellDaysAfter: 2,
  },
  {
    type: 'earnings',
    label: '财报/业绩',
    re: /财报|年报|半年报|季报|业绩会|业绩预告|业绩说明会|股东大会/,
    importance: 5,
    buyDaysBefore: 3,
    sellDaysAfter: 1,
  },
  {
    type: 'policy_macro',
    label: '政策/宏观',
    re: /降准|降息|议息|政策|工作会议|两会|关税/,
    importance: 3,
    buyDaysBefore: 2,
    sellDaysAfter: 1,
  },
  {
    type: 'contract_bid',
    label: '订单/中标',
    re: /中标|签约|大单|合同|订单/,
    importance: 3,
    buyDaysBefore: 0,
    sellDaysAfter: 2,
  },
]

function detectCatalyst(text) {
  for (const rule of CATALYST_RULES) {
    if (rule.re.test(text)) return rule
  }
  return null
}

function shiftDate(iso, days) {
  if (!iso || iso === '待定' || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return null
  const d = new Date(iso.slice(0, 10) + 'T12:00:00')
  if (Number.isNaN(d.getTime())) return null
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function classifyCertainty(n, isCatalyst) {
  const t = `${n.t || ''}${n.c || ''}`
  if (/确定|正式|公告|披露|召开|发布|定档|官宣/.test(t) || n.tp === 'ann') return 'confirmed'
  if (isCatalyst || /有望|或将|计划|预计|可能|拟|传闻|据悉/.test(t)) return 'likely'
  return 'unlikely'
}

function buildTradeHint(rule, eventDate) {
  if (!rule) return null
  const buyFrom = shiftDate(eventDate, -Math.max(1, rule.buyDaysBefore || 1))
  const sellBy = shiftDate(eventDate, rule.sellDaysAfter || 1)
  if (!buyFrom || !sellBy) {
    return {
      type: rule.type,
      label: rule.label,
      text: `事件日前约${rule.buyDaysBefore}天关注布局，事件后约${rule.sellDaysAfter}天评估兑现`,
    }
  }
  return {
    type: rule.type,
    label: rule.label,
    buyFrom,
    sellBy,
    text: `交易窗口：建议 ${buyFrom} 前布局，事件后至 ${sellBy} 评估兑现/减仓`,
  }
}

export function extractFutureEvents(news) {
  const today = new Date().toISOString().slice(0, 10)
  const events = []
  const seen = new Set()

  news.forEach((n) => {
    const raw = `${n.t || ''} ${n.c || ''}`
    const dates = parseDates(raw)
    const relative = parseRelativeDate(raw)
    const future = dates.filter((d) => d >= today)
    const catalyst = detectCatalyst(raw)
    const softFuture = /即将|下周|本月|下月|年内|Q[1-4]|半年报|年报|发布会|上映|定档|世界杯|广告|赞助/.test(
      n.t || '',
    )
    if (!future.length && !relative && !softFuture && !catalyst) return

    const date = future[0] || relative || '待定'
    const key = `${(n.t || '').slice(0, 40)}|${date}`
    if (seen.has(key)) return
    seen.add(key)

    const trade = buildTradeHint(catalyst, date)
    const certainty = classifyCertainty(n, !!catalyst)
    events.push({
      title: (n.t || '').slice(0, 80),
      date,
      certainty,
      importance: catalyst ? catalyst.importance : n.tp === 'ann' ? 4 : 3,
      category: catalyst?.type || 'general',
      categoryLabel: catalyst?.label || '一般事件',
      desc: (n.c || '').slice(0, 160),
      source: n.s,
      url: n.url,
      reason: catalyst
        ? catalyst.label
        : n.tp === 'ann'
          ? '公告'
          : n.tp === 'research'
            ? '研报'
            : '新闻',
      tradeHint: trade,
    })
  })

  events.sort((a, b) => {
    const ai = b.importance - a.importance
    if (ai) return ai
    if (a.date === '待定') return 1
    if (b.date === '待定') return -1
    return String(a.date).localeCompare(String(b.date))
  })
  return events.slice(0, 24)
}

export function categorizeNews(news) {
  const cats = {
    业绩: { items: [] },
    研报: { items: [] },
    公告: { items: [] },
    资金: { items: [] },
    行业: { items: [] },
    其他: { items: [] },
  }
  news.forEach((n) => {
    const t = n.t || ''
    if (n.tp === 'ann' || /公告|披露/.test(t)) cats['公告'].items.push(n)
    else if (n.tp === 'research' || /研报|评级|目标价/.test(t)) cats['研报'].items.push(n)
    else if (/营收|净利|业绩|预增|预减/.test(t)) cats['业绩'].items.push(n)
    else if (/资金|主力|北向|流入|流出/.test(t)) cats['资金'].items.push(n)
    else if (/行业|板块|景气/.test(t)) cats['行业'].items.push(n)
    else cats['其他'].items.push(n)
  })
  return { cats, uncategorized: [] }
}

function assessDataQuality(news, fin) {
  const q = { score: 0, issues: [], level: '低' }
  if (news.length >= 10) q.score += 2
  else if (news.length >= 5) q.score += 1
  else q.issues.push('新闻数据不足')
  const recent7 = news.filter((n) => isRecent(n.d, 7))
  if (recent7.length >= 5) q.score += 2
  else if (recent7.length >= 2) q.score += 1
  else q.issues.push('近期新闻偏少')
  const sources = {}
  news.forEach((n) => {
    sources[n.s || n.tp] = 1
  })
  const srcCount = Object.keys(sources).length
  if (srcCount >= 3) q.score += 2
  else if (srcCount >= 2) q.score += 1
  else q.issues.push('数据来源单一')
  if (fin && fin.roe && fin.eps) q.score += 3
  else q.issues.push('缺少财报数据')
  if (q.score >= 7) q.level = '高'
  else if (q.score >= 4) q.level = '中'
  else q.level = '低'
  return q
}

export function analyzeNews(news, code, fin) {
  let total = 0
  const bull = []
  const bear = []
  const sigs = []
  const nums = []
  const watches = []
  const risks = []
  const forum = news.filter((n) => n.tp === 'forum')
  const others = news.filter((n) => n.tp !== 'forum')

  others.forEach((n) => {
    const score = sc(`${n.t}${n.c}`)
    total += score
    if (score > 0) {
      bull.push(n)
      sigs.push({ tp: 'g', tx: n.t.slice(0, 60), url: n.url })
    } else if (score < 0) {
      bear.push(n)
      sigs.push({ tp: 'b', tx: n.t.slice(0, 60), url: n.url })
      if (/违规|处罚|诉讼|暴雷/.test(n.t)) risks.push(n.t.slice(0, 40))
    }
  })

  let rs = 0
  const rt = []
  forum.forEach((n) => {
    const s = sc(n.t)
    rs += s
    if (s !== 0) rt.push(n.t.slice(0, 16))
  })
  rs = Math.max(-100, Math.min(100, rs * 3))

  const dimScores = {}
  if (ANALYSIS_DIMS) {
    Object.keys(ANALYSIS_DIMS).forEach((k) => {
      const dim = ANALYSIS_DIMS[k]
      if (typeof dim.evaluate === 'function') {
        try {
          dimScores[k] = dim.evaluate(news, fin)
        } catch {
          dimScores[k] = { score: 0, evidence: [] }
        }
      } else {
        dimScores[k] = { score: 0, evidence: [] }
      }
    })
  }

  total = Math.max(-50, Math.min(50, total))
  const mood = total >= 15 ? '偏多' : total <= -15 ? '偏空' : '中性'
  const rm = rs >= 20 ? '偏乐观' : rs <= -20 ? '偏悲观' : '分歧'
  const confidence = Math.min(
    95,
    30 + news.length * 2 + (fin?.roe ? 15 : 0) + (bull.length + bear.length) * 2,
  )

  let narrative = `综合 ${news.length} 条信息，情绪评分 ${total >= 0 ? '+' : ''}${total}（${mood}）。`
  if (bull.length) narrative += ` 正面信号 ${bull.length} 条。`
  if (bear.length) narrative += ` 负面信号 ${bear.length} 条。`
  if (fin?.roe) narrative += ` ROE ${fin.roe}%，PE ${fin.pe_ttm || '—'}。`

  if (total >= 15) watches.push('关注放量与板块联动')
  if (total <= -15) risks.push('消息面转弱，注意止损')

  const futureEvents = extractFutureEvents(news)
  const dataQuality = assessDataQuality(news, fin)

  return {
    total,
    mood,
    rm,
    rs,
    rt: rt.slice(0, 5),
    bull,
    bear,
    sigs: sigs.slice(0, 12),
    nums,
    watches,
    risks,
    narrative,
    confidence,
    dimScores,
    dataQuality,
    futureEvents,
    nc: news.length,
    code,
  }
}
