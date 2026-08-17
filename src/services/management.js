/**
 * Buffett: buy businesses with able & honest management.
 * F10 executives + insider trades + public press (good/bad) on key officers.
 */
import { fEM } from './api.js'
import { ApiError, proxyFetch } from './apiClient.js'
import { vaultGet, vaultSet, getActiveAccountId } from '@/services/vault.js'

const cache = new Map()
const TTL = 6 * 60 * 60 * 1000
const COMMENT_KEY = 'fd_mgmt_comments'
const COMMENT_LEGACY = 'findigest_mgmt_comments_v1'

const ROLE_PRIORITY = [
  { re: /董事长|主席/, role: '董事长' },
  { re: /总经理|总裁(?!助理)|CEO|首席执行/, role: '总经理/总裁' },
  { re: /财务负责人|CFO|总会计师|财务总监/, role: '财务负责人' },
  { re: /副董事长/, role: '副董事长' },
  { re: /董秘|董事会秘书/, role: '董秘' },
]

const GOOD_RE =
  /增持|回购|连任|连任成功|表彰|获奖|功勋|稳健|长期主义|市值管理|高质量发展|股权激励落地|业绩超预期|实控人增持|高管增持/
const BAD_RE =
  /减持|辞职|落马|调查|违规|处罚|立案|造假|腐败|被查|失联|纠纷|诉讼|问询|警示|违规减持|内幕|渎职|免职/

function emCode(code) {
  const c = String(code || '')
  if (c.length === 5) return `HK${c}`
  if (c.startsWith('6') || c.startsWith('9')) return `SH${c}`
  return `SZ${c}`
}

function num(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function fmtShares(n) {
  if (n == null) return '—'
  if (Math.abs(n) >= 1e8) return `${(n / 1e8).toFixed(2)}亿股`
  if (Math.abs(n) >= 1e4) return `${(n / 1e4).toFixed(1)}万股`
  return `${Math.round(n)}股`
}

function fmtMoney(n) {
  if (n == null || !(n > 0)) return '—'
  if (n >= 1e4) return `${(n / 1e4).toFixed(1)}万`
  return `${Math.round(n)}`
}

function pickRole(position) {
  const p = String(position || '')
  for (const r of ROLE_PRIORITY) {
    if (r.re.test(p)) return r.role
  }
  return '高管'
}

function scoreManagement(people, trades, press) {
  const notes = []
  let score = 0
  const chair = people.find((p) => p.role === '董事长') || people[0]
  const ceo = people.find((p) => p.role === '总经理/总裁')
  const cfo = people.find((p) => p.role === '财务负责人')

  for (const exec of [chair, ceo, cfo].filter(Boolean)) {
    if (exec.tenureYears != null) {
      if (exec.tenureYears >= 10) {
        score += exec.role === '董事长' ? 2 : 1
        notes.push(`${exec.role}${exec.name}任职约${exec.tenureYears}年`)
      } else if (exec.tenureYears >= 5) {
        score += 1
      } else if (exec.tenureYears < 2 && exec.role === '董事长') {
        score -= 1
        notes.push('董事长任职较短')
      }
    }
  }

  const holders = people.filter((p) => (p.holdNum || 0) > 0)
  if (holders.length >= 2) {
    score += 1
    notes.push(`${holders.length}名高管持股`)
  }

  const recent = (trades || []).slice(0, 8)
  const sells = recent.filter((t) => (t.changeNum || 0) < 0)
  const buys = recent.filter((t) => (t.changeNum || 0) > 0)
  if (sells.length >= 3 && buys.length === 0) {
    score -= 2
    notes.push('近期高管/关联方减持偏多')
  } else if (buys.length > sells.length) {
    score += 1
    notes.push('近期增持多于减持')
  } else if (sells.length > 0) {
    score -= 1
    notes.push('存在高管减持记录，需核对原因')
  }

  const badN = (press || []).filter((x) => x.tone === 'bad').length
  const goodN = (press || []).filter((x) => x.tone === 'good').length
  if (badN >= 3 && badN > goodN) {
    score -= 1
    notes.push(`公开报道负面偏多（${badN}条）`)
  } else if (goodN >= 2 && goodN > badN) {
    score += 1
    notes.push(`公开报道偏正面（${goodN}条）`)
  }

  let label = '一般'
  if (score >= 3) label = '稳健偏强'
  else if (score >= 1) label = '尚可'
  else if (score <= -2) label = '需警惕'
  return { score, label, notes }
}

function mapPerson(row) {
  const hold = num(row.HOLD_NUM)
  const salary = num(row.SALARY)
  const incumbent = String(row.INCUMBENT_TIME || '')
  let tenureYears = null
  const m = incumbent.match(/(\d{4})-(\d{2})-(\d{2})/)
  if (m) {
    const start = new Date(+m[1], +m[2] - 1, +m[3])
    tenureYears = Math.max(0, Math.round(((Date.now() - start.getTime()) / (365.25 * 864e5)) * 10) / 10)
  }
  const position = row.POSITION || '—'
  return {
    name: row.PERSON_NAME || '—',
    position,
    role: pickRole(position),
    sex: row.SEX || '',
    age: row.AGE || '',
    degree: row.HIGH_DEGREE || '',
    resume: (row.RESUME || '').slice(0, 280),
    holdNum: hold,
    holdLabel: fmtShares(hold),
    salary,
    salaryLabel: salary != null ? `${fmtMoney(salary)}元/年` : '—',
    incumbent,
    tenureYears,
  }
}

function mapTrade(row) {
  const change = num(row.CHANGE_NUM)
  return {
    holder: row.HOLDER_NAME || row.EXECUTIVE_NAME || '—',
    position: row.POSITION || '',
    relation: row.EXECUTIVE_RELATION || '',
    changeNum: change,
    changeLabel: fmtShares(change),
    after: num(row.CHANGE_AFTER_HOLDNUM),
    afterLabel: fmtShares(num(row.CHANGE_AFTER_HOLDNUM)),
    price: num(row.AVERAGE_PRICE),
    way: row.TRADE_WAY || '',
    date: String(row.END_DATE || '').slice(0, 10),
  }
}

function toneOf(text) {
  const t = String(text || '')
  const g = GOOD_RE.test(t)
  const b = BAD_RE.test(t)
  if (g && !b) return 'good'
  if (b && !g) return 'bad'
  if (g && b) return 'mixed'
  return 'neutral'
}

function keyPeople(people) {
  const out = []
  const seen = new Set()
  for (const role of ['董事长', '总经理/总裁', '财务负责人', '副董事长', '董秘']) {
    const p = people.find((x) => x.role === role && !seen.has(x.name))
    if (p) {
      seen.add(p.name)
      out.push(p)
    }
  }
  for (const p of people) {
    if (out.length >= 5) break
    if (!seen.has(p.name)) {
      seen.add(p.name)
      out.push(p)
    }
  }
  return out
}

async function fetchPressForPeople(stockName, people) {
  const targets = keyPeople(people).slice(0, 4)
  const items = []
  const seen = new Set()
  for (const p of targets) {
    const kw = `${stockName || ''} ${p.name}`.trim()
    if (kw.length < 2) continue
    const cb = `mgmt_${Math.random().toString(36).slice(2, 9)}`
    try {
      const rows = await fEM(kw, cb)
      for (const n of (rows || []).slice(0, 4)) {
        const id = `${n.t}|${n.d}`
        if (seen.has(id)) continue
        seen.add(id)
        const blob = `${n.t} ${n.c || ''}`
        items.push({
          title: n.t,
          summary: (n.c || '').slice(0, 120),
          date: n.d,
          source: n.s,
          url: n.url,
          person: p.name,
          role: p.role,
          tone: toneOf(blob),
        })
      }
    } catch {
      /* ignore one person */
    }
  }
  // Prefer polarized items first, then by date
  const rank = { bad: 0, good: 1, mixed: 2, neutral: 3 }
  items.sort((a, b) => (rank[a.tone] ?? 9) - (rank[b.tone] ?? 9) || String(b.date).localeCompare(String(a.date)))
  return items.slice(0, 16)
}

/** Local investor notes on management (per stock), stored in vault when logged in */
function readAllComments() {
  try {
    if (getActiveAccountId()) {
      const v = vaultGet(COMMENT_KEY, null)
      if (v && typeof v === 'object') return v
      return {}
    }
    return JSON.parse(localStorage.getItem(COMMENT_LEGACY) || localStorage.getItem(COMMENT_KEY) || '{}')
  } catch {
    return {}
  }
}

function writeAllComments(all) {
  if (getActiveAccountId()) {
    vaultSet(COMMENT_KEY, all)
    try {
      localStorage.removeItem(COMMENT_LEGACY)
      localStorage.removeItem(COMMENT_KEY)
    } catch {
      /* ignore */
    }
    return
  }
  localStorage.setItem(COMMENT_LEGACY, JSON.stringify(all))
}

export function loadMgmtComments(code) {
  const all = readAllComments()
  return Array.isArray(all[code]) ? all[code] : []
}

export function saveMgmtComment(code, { text, tone, about, author }) {
  const body = String(text || '').trim()
  if (!body || body.length < 2) throw new Error('请填写评论')
  const entry = {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    text: body.slice(0, 500),
    tone: ['good', 'bad', 'mixed'].includes(tone) ? tone : 'mixed',
    about: String(about || '管理层').slice(0, 40),
    author: String(author || '本机投资者').slice(0, 20),
    at: new Date().toISOString(),
  }
  const all = readAllComments()
  const list = Array.isArray(all[code]) ? all[code] : []
  list.unshift(entry)
  all[code] = list.slice(0, 80)
  writeAllComments(all)
  return entry
}

export function deleteMgmtComment(code, id) {
  const all = readAllComments()
  const list = Array.isArray(all[code]) ? all[code] : []
  all[code] = list.filter((x) => x.id !== id)
  writeAllComments(all)
}

/**
 * @param {string} code
 * @param {{ name?: string }} [opts]
 */
export async function fetchManagement(code, opts = {}) {
  const key = String(code)
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < TTL) return hit.data

  const upstream = `https://emweb.securities.eastmoney.com/PC_HSF10/CompanyManagement/PageAjax?code=${emCode(key)}`
  try {
    const raw = await proxyFetch(upstream, { timeoutMs: 12000 })
    const people = (raw.gglb || []).map(mapPerson)
    const trades = (raw.cgbd || []).map(mapTrade)
    const press = await fetchPressForPeople(opts.name || '', people)
    const assessment = scoreManagement(people, trades, press)
    const data = {
      people,
      keyPeople: keyPeople(people),
      trades: trades.slice(0, 12),
      press,
      assessment,
      source: 'eastmoney_f10',
      fetchedAt: new Date().toISOString(),
    }
    cache.set(key, { at: Date.now(), data })
    return data
  } catch (e) {
    const structured =
      e instanceof ApiError
        ? e.toJSON()
        : { status: 0, code: 'mgmt_fetch_failed', message: e?.message || String(e) }
    const data = {
      people: [],
      keyPeople: [],
      trades: [],
      press: [],
      assessment: { score: 0, label: '暂无', notes: ['管理层数据暂不可用'] },
      source: 'none',
      error: structured.message,
      errorDetail: structured,
    }
    cache.set(key, { at: Date.now(), data })
    return data
  }
}
