import { normalizeStockCode, normalizeOcrStockCode, parseNumberLoose } from '../utils/stockCode.js'
import { STOCK_NAMES, getStockName } from '../data/stock_names.js'
import { inferHoldingEx } from './quotesRefresh.js'

export const IMPORT_TEMPLATES = [
  {
    id: 'eastmoney',
    label: '东方财富',
    guide: [
      '打开电脑端交易窗口 → 持仓 / 资金股份。',
      '全选表格复制，或导出 CSV。',
      '回到这里粘贴、上传，或截图导入。',
    ],
  },
  {
    id: 'ths',
    label: '同花顺',
    guide: [
      '电脑端点「交易」或 F12，登录后打开持仓。',
      '复制表格或另存 CSV。',
      '回到这里粘贴 / 上传 / 截图。',
    ],
  },
  {
    id: 'tiger',
    label: '老虎证券',
    guide: [
      '在 Tiger Trade 打开持仓页。',
      '导出 CSV，或复制表格 / 截图。',
      '港股代码会识别为 HK。',
    ],
  },
  {
    id: 'hk_generic',
    label: '港股通用',
    guide: [
      '表格里要有代码、数量、成本。',
      '可直接粘贴或上传 CSV。',
    ],
  },
  {
    id: 'generic',
    label: '通用',
    guide: [
      '任意含「代码、数量、成本」的表格。',
      '支持逗号、制表符或空格分隔。',
    ],
  },
]

const CODE_ALIASES = [
  '代码',
  '证券代码',
  '股票代码',
  '品种代码',
  '合约代码',
  'symbol',
  'ticker',
  'code',
  'stock code',
  '证券代码code',
]
const NAME_ALIASES = ['名称', '证券名称', '股票名称', '简称', 'name', 'stock name', '证券']
const SHARES_ALIASES = [
  '数量',
  '持股数量',
  '持仓数量',
  '股数',
  '股票余额',
  '证券余额',
  '实际数量',
  '持仓',
  '可用数量',
  'quantity',
  'qty',
  'shares',
  'position',
  '持仓股数',
]
const COST_ALIASES = [
  '成本',
  '成本价',
  '摊薄成本',
  '持仓成本',
  '成本价(元)',
  '平均成本',
  'cost',
  'avg cost',
  'average cost',
  'cost price',
  '成本价港币',
]
const EX_ALIASES = ['市场', '交易所', 'market', 'exchange', '币种市场']

function normHeader(h) {
  return String(h || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

function findCol(headers, aliases) {
  const normalized = headers.map(normHeader)
  for (const a of aliases) {
    const key = normHeader(a)
    const i = normalized.findIndex((h) => h === key || h.includes(key) || key.includes(h))
    if (i >= 0) return i
  }
  return -1
}

function splitLines(text) {
  return String(text || '')
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l.trim().length)
}

function detectDelimiter(line) {
  const counts = [
    ['\t', (line.match(/\t/g) || []).length],
    [',', (line.match(/,/g) || []).length],
    ['|', (line.match(/\|/g) || []).length],
    [';', (line.match(/;/g) || []).length],
  ]
  counts.sort((a, b) => b[1] - a[1])
  if (counts[0][1] > 0) return counts[0][0]
  // OCR / 券商截图常见：单空格分隔「代码 名称 数量 成本」
  if (line.trim().split(/\s+/).length >= 3) return 'spaces'
  if (/\s{2,}/.test(line)) return 'spaces'
  return '\t'
}

function parseRow(line, delim) {
  if (delim === 'spaces') return line.trim().split(/\s+/).map((c) => c.trim())
  if (delim === ',') {
    // simple CSV with quotes
    const out = []
    let cur = ''
    let inQ = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        if (inQ && line[i + 1] === '"') {
          cur += '"'
          i++
        } else inQ = !inQ
        continue
      }
      if (ch === ',' && !inQ) {
        out.push(cur.trim())
        cur = ''
        continue
      }
      cur += ch
    }
    out.push(cur.trim())
    return out
  }
  return line.split(delim).map((c) => c.trim())
}

function templateHintEx(templateId) {
  if (templateId === 'hk_generic' || templateId === 'tiger') return null // tiger mixed
  return null
}

function previewLine(raw, max = 42) {
  const s = String(raw || '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!s) return '（空行）'
  return s.length > max ? `${s.slice(0, max)}…` : s
}

function isTotalOrCashLine(raw) {
  return /合计|小计|total|资产账号|市值合计/i.test(String(raw || ''))
}

/**
 * Parse CSV / pasted table text into holding rows.
 * @returns {{ rows: Array, warnings: string[], dropped: Array<{ preview: string, reason: string }> }}
 */
export function parseHoldingsText(text, templateId = 'generic') {
  const warnings = []
  const dropped = []
  const lines = splitLines(text)
  if (!lines.length) return { rows: [], warnings: ['没有可解析的内容'], dropped }

  const delim = detectDelimiter(lines[0])
  const matrix = lines.map((l) => parseRow(l, delim)).filter((r) => r.some((c) => c))

  if (!matrix.length) return { rows: [], warnings: ['表格为空'], dropped }

  // Detect header row
  let headerIdx = 0
  let headers = matrix[0]
  const codeColGuess = findCol(headers, CODE_ALIASES)
  if (codeColGuess < 0) {
    // maybe no header — try to detect code-like first column
    const sample = matrix[0]
    const maybeCode = normalizeStockCode(sample[0], templateHintEx(templateId))
    if (maybeCode) {
      warnings.push('未识别表头，按「代码 / 名称 / 数量 / 成本」列序猜测')
      headers = ['代码', '名称', '数量', '成本']
      headerIdx = -1
    } else {
      // scan first few rows for a header
      for (let i = 0; i < Math.min(5, matrix.length); i++) {
        if (findCol(matrix[i], CODE_ALIASES) >= 0) {
          headers = matrix[i]
          headerIdx = i
          break
        }
      }
    }
  }

  let iCode = findCol(headers, CODE_ALIASES)
  let iName = findCol(headers, NAME_ALIASES)
  let iShares = findCol(headers, SHARES_ALIASES)
  let iCost = findCol(headers, COST_ALIASES)
  let iEx = findCol(headers, EX_ALIASES)

  if (headerIdx === -1) {
    iCode = 0
    iName = 1
    iShares = 2
    iCost = 3
  }

  // Template-specific tweaks: prefer cost over market value
  if (templateId === 'eastmoney' && iCost < 0) {
    iCost = findCol(headers, ['成本价', '买入均价', '保本价'])
  }
  if (templateId === 'ths' && iShares < 0) {
    iShares = findCol(headers, ['实际数量', '股票余额'])
  }

  if (iCode < 0) {
    return { rows: [], warnings: ['找不到「代码」列，请换模板或改用通用粘贴'], dropped }
  }
  if (iShares < 0) warnings.push('未找到数量列，股数将留空供校对')
  if (iCost < 0) warnings.push('未找到成本列，成本将留空供校对')

  const start = headerIdx < 0 ? 0 : headerIdx + 1
  const rows = []
  for (let r = start; r < matrix.length; r++) {
    const cells = matrix[r]
    const rawCode = cells[iCode]
    const linePreview = previewLine(cells.filter(Boolean).join(' '))
    if (!String(rawCode || '').trim()) {
      dropped.push({ preview: linePreview, reason: '这一行没有代码' })
      continue
    }
    if (isTotalOrCashLine(rawCode) || isTotalOrCashLine(linePreview)) {
      dropped.push({ preview: linePreview, reason: '合计 / 资产行，不是持仓' })
      continue
    }

    let hintEx = null
    if (iEx >= 0) {
      const exRaw = String(cells[iEx] || '').toUpperCase()
      if (exRaw.includes('HK') || exRaw.includes('港')) hintEx = 'HK'
      else if (exRaw.includes('SH') || exRaw.includes('沪')) hintEx = 'SH'
      else if (exRaw.includes('SZ') || exRaw.includes('深')) hintEx = 'SZ'
    }
    if (templateId === 'hk_generic') hintEx = hintEx || 'HK'

    const norm = normalizeStockCode(rawCode, hintEx)
    if (!norm) {
      dropped.push({ preview: previewLine(String(rawCode)), reason: '无法识别股票代码' })
      continue
    }

    const name = iName >= 0 ? String(cells[iName] || '').trim() : ''
    const shares = iShares >= 0 ? parseNumberLoose(cells[iShares]) : NaN
    const cost = iCost >= 0 ? parseNumberLoose(cells[iCost]) : NaN

    rows.push({
      code: norm.code,
      ex: norm.ex,
      name: name || getStockName(norm.code) || norm.code,
      shares: Number.isFinite(shares) ? shares : 0,
      cost: Number.isFinite(cost) ? cost : 0,
      selected: true,
      confidence: Number.isFinite(shares) && Number.isFinite(cost) ? 'high' : 'medium',
      source: 'text',
    })
  }

  if (!rows.length) warnings.push('解析结果为空，请检查分隔符或列名')
  return { rows: enrichImportRows(dedupeRows(rows)), warnings, dropped }
}

function dedupeRows(rows) {
  const map = new Map()
  rows.forEach((r) => {
    const prev = map.get(r.code)
    if (!prev) map.set(r.code, r)
    else {
      // keep later row (usually fresher)
      map.set(r.code, { ...r, shares: r.shares || prev.shares, cost: r.cost || prev.cost })
    }
  })
  return [...map.values()]
}

function looksLikeCodeNumber(n) {
  if (!Number.isFinite(n) || n < 0 || n !== Math.trunc(n)) return false
  const s = String(Math.trunc(n))
  if (s.length === 6 && /^[0369]/.test(s)) return true
  if (s.length === 5) return true
  return false
}

function pickSharesAndCost(nums) {
  const cleaned = (nums || []).filter((n) => Number.isFinite(n) && !looksLikeCodeNumber(n))
  let shares = NaN
  let cost = NaN
  for (let i = 0; i < cleaned.length; i++) {
    const n = cleaned[i]
    const intish = n >= 1 && n < 1e8 && Math.abs(n - Math.round(n)) < 0.051
    if (!intish) continue
    shares = Math.round(n)
    let k = i + 1
    const next = cleaned[k]
    if (next != null && Math.abs(next - n) < 0.051) k += 1
    for (; k < cleaned.length; k++) {
      const p = cleaned[k]
      if (p > 0.05 && p < 20000) {
        cost = p
        break
      }
    }
    break
  }
  if (!Number.isFinite(shares) && cleaned.length) {
    const first = cleaned.find((n) => n >= 1 && n < 1e8)
    if (first != null) shares = first
  }
  if (!Number.isFinite(cost)) {
    const priceLike = cleaned.find((n) => n > 0.05 && n < 20000 && n !== shares)
    if (priceLike != null) cost = priceLike
  }
  return { shares, cost }
}

let nameIndex = null
function getNameIndex() {
  if (nameIndex) return nameIndex
  nameIndex = new Map()
  for (const [code, name] of Object.entries(STOCK_NAMES)) {
    const n = String(name || '').replace(/\s+/g, '')
    if (!n) continue
    if (!nameIndex.has(n)) nameIndex.set(n, code)
    const stripped = n.replace(/^\*?ST/, '').replace(/^-U$/, '').replace(/-W$/, '').replace(/-S$/, '')
    if (stripped && stripped !== n && !nameIndex.has(stripped)) nameIndex.set(stripped, code)
  }
  return nameIndex
}

function lookupCodeByName(name) {
  const n = String(name || '').replace(/\s+/g, '').replace(/[^\u4e00-\u9fffA-Za-z0-9*]/g, '')
  if (n.length < 2) return null
  const idx = getNameIndex()
  if (idx.has(n)) return idx.get(n)
  if (n.length >= 3) {
    for (const [key, code] of idx) {
      if (key.includes(n) || n.includes(key)) return code
    }
  }
  return null
}

let nameEntries = null
function getNameEntries() {
  if (nameEntries) return nameEntries
  nameEntries = Object.entries(STOCK_NAMES)
    .map(([code, name]) => ({ code, name: String(name || '').replace(/\s+/g, '') }))
    .filter((x) => x.name.length >= 2)
    .sort((a, b) => b.name.length - a.name.length)
  return nameEntries
}

function confidenceRank(c) {
  if (c === 'high') return 3
  if (c === 'medium') return 2
  return 1
}

function locateKnownCodes(text) {
  const raw = String(text || '')
  const hits = []
  const seen = new Set()
  const add = (via, at, end) => {
    if (!via?.code || !STOCK_NAMES[via.code] || at == null) return
    const key = `${via.code}@${at}`
    if (seen.has(key)) return
    seen.add(key)
    hits.push({ at, end, code: via })
  }
  for (const m of raw.matchAll(/[0-9A-Za-z]{5,8}/g)) {
    add(normalizeOcrStockCode(m[0]), m.index, m.index + m[0].length)
  }
  for (const m of raw.matchAll(/\d{5,6}/g)) {
    add(normalizeStockCode(m[0]) || normalizeOcrStockCode(m[0]), m.index, m.index + m[0].length)
  }
  hits.sort((a, b) => a.at - b.at)
  return hits
}

function collectKnownCodes(text) {
  const seen = new Set()
  return locateKnownCodes(text)
    .map((h) => h.code)
    .filter((c) => {
      if (seen.has(c.code)) return false
      seen.add(c.code)
      return true
    })
}

function windowsForCodes(line, hits) {
  if (!hits.length) return []
  return hits.map((h, i) => {
    const prevEnd = i === 0 ? 0 : hits[i - 1].end
    const nextAt = i === hits.length - 1 ? line.length : hits[i + 1].at
    return {
      code: h.code,
      nameText: line.slice(prevEnd === 0 && i === 0 ? 0 : prevEnd, nextAt),
      numText: line.slice(h.at, nextAt),
    }
  })
}

function collectKnownNames(text) {
  const compact = String(text || '').replace(/\s+/g, '')
  const hits = []
  const used = new Array(compact.length).fill(false)
  for (const { code, name } of getNameEntries()) {
    let from = 0
    while (from < compact.length) {
      const i = compact.indexOf(name, from)
      if (i < 0) break
      let overlap = false
      for (let k = i; k < i + name.length; k++) {
        if (used[k]) {
          overlap = true
          break
        }
      }
      if (!overlap) {
        for (let k = i; k < i + name.length; k++) used[k] = true
        hits.push({ code, name })
      }
      from = i + name.length
    }
  }
  return hits
}

function stripKnownCodeTokens(text) {
  return String(text || '').replace(/[0-9A-Za-z]{5,8}/g, (tok) => {
    const via = normalizeOcrStockCode(tok) || normalizeStockCode(tok)
    return via && STOCK_NAMES[via.code] ? ' ' : tok
  })
}

function numbersFromText(text) {
  const nums = []
  for (const m of stripKnownCodeTokens(text).matchAll(/-?\d[\d,]*(?:\.\d+)?\s*[万亿]?/g)) {
    const n = parseNumberLoose(m[0])
    if (Number.isFinite(n)) nums.push(n)
  }
  return pickSharesAndCost(nums)
}

function mergeKnownRow(map, row) {
  const prev = map.get(row.code)
  if (!prev) {
    map.set(row.code, { ...row })
    return
  }
  const next = { ...prev }
  if (confidenceRank(row.confidence) > confidenceRank(prev.confidence)) next.confidence = row.confidence
  if (row.shares > 0 && (!(prev.shares > 0) || confidenceRank(row.confidence) >= confidenceRank(prev.confidence))) {
    next.shares = row.shares
  }
  if (row.cost > 0 && (!(prev.cost > 0) || confidenceRank(row.confidence) >= confidenceRank(prev.confidence))) {
    next.cost = row.cost
  }
  if (STOCK_NAMES[row.code]) next.name = STOCK_NAMES[row.code]
  map.set(row.code, next)
}

/**
 * Walk OCR / messy text and keep only names + codes that exist in the universe.
 */
export function extractHoldingsByNameAndCode(text) {
  const dropped = []
  const map = new Map()

  const add = ({ code, ex, shares, cost, confidence, name }) => {
    if (!code || !STOCK_NAMES[code]) return
    const via = normalizeStockCode(code, ex) || normalizeOcrStockCode(code, ex)
    if (!via || !STOCK_NAMES[via.code]) return
    mergeKnownRow(map, {
      code: via.code,
      ex: via.ex,
      name: STOCK_NAMES[via.code] || name || via.code,
      shares: Number.isFinite(shares) ? shares : 0,
      cost: Number.isFinite(cost) ? cost : 0,
      selected: true,
      confidence: confidence || 'medium',
      source: 'ocr',
    })
  }

  splitLines(text).forEach((line) => {
    if (isTotalOrCashLine(line) && !/\d{5,6}/.test(line)) {
      dropped.push({ preview: previewLine(line), reason: '合计 / 资产行，不是持仓' })
      return
    }
    const hits = locateKnownCodes(line)
    const names = collectKnownNames(line)
    const windows = windowsForCodes(line, hits)
    const paired = new Set()

    if (windows.length) {
      windows.forEach((w) => {
        const localNames = collectKnownNames(w.nameText)
        const selfName = localNames.find((n) => n.code === w.code.code) || names.find((n) => n.code === w.code.code)
        const picked = numbersFromText(w.numText)
        paired.add(w.code.code)
        add({
          code: w.code.code,
          ex: w.code.ex,
          shares: picked.shares,
          cost: picked.cost,
          confidence: selfName ? 'high' : 'medium',
          name: selfName?.name || STOCK_NAMES[w.code.code],
        })
      })
    } else {
      const picked = numbersFromText(line)
      names.forEach((n) => {
        add({
          code: n.code,
          shares: picked.shares,
          cost: picked.cost,
          confidence: 'medium',
          name: n.name,
        })
      })
    }
    names.forEach((n) => {
      if (paired.has(n.code) || map.has(n.code)) return
      const picked = numbersFromText(line)
      add({
        code: n.code,
        shares: picked.shares,
        cost: picked.cost,
        confidence: 'medium',
        name: n.name,
      })
    })
  })

  if (!map.size) {
    const codes = collectKnownCodes(text)
    const names = collectKnownNames(text)
    const picked = numbersFromText(text)
    const paired = new Set()
    names.forEach((n) => {
      const via = codes.find((c) => c.code === n.code)
      if (!via) return
      paired.add(n.code)
      add({
        code: via.code,
        ex: via.ex,
        shares: picked.shares,
        cost: picked.cost,
        confidence: 'high',
        name: n.name,
      })
    })
    codes.forEach((c) => {
      if (paired.has(c.code)) return
      add({
        code: c.code,
        ex: c.ex,
        shares: picked.shares,
        cost: picked.cost,
        confidence: 'medium',
        name: STOCK_NAMES[c.code],
      })
    })
    names.forEach((n) => {
      if (paired.has(n.code) || map.has(n.code)) return
      add({
        code: n.code,
        shares: picked.shares,
        cost: picked.cost,
        confidence: 'medium',
        name: n.name,
      })
    })
  }

  return { rows: [...map.values()], warnings: [], dropped }
}

function mergeImportRows(...lists) {
  const map = new Map()
  lists.forEach((list) => {
    ;(list || []).forEach((row) => {
      if (!row?.code) return
      mergeKnownRow(map, row)
    })
  })
  return [...map.values()]
}

const SKIP_NAME_TOKEN =
  /^(证券|代码|名称|数量|成本|市值|盈亏|持仓|可用|最新|现价|股票|余额|比例|浮动|盈亏比|市值合计|合计|小计|资产|账号)$/

function explodeMixedToken(token) {
  const t = String(token || '').trim()
  if (!t) return []
  const parts = t.split(/(\d{5,6})/).filter(Boolean)
  return parts.length > 1 ? parts : [t]
}

function isPlausibleTicker(via, rawToken) {
  if (!via) return false
  if (STOCK_NAMES[via.code]) return true
  if (/[.\/%]/.test(String(rawToken))) return false
  const rawDigits = String(rawToken).replace(/\D/g, '')
  if (/^[0369]\d{5}$/.test(via.code) && rawDigits.length >= 5) return true
  if (via.ex === 'HK' && /^\d{5}$/.test(via.code) && rawDigits.length >= 4) return true
  return false
}

function extractOcrLineRows(text, dropped = []) {
  const extra = []
  splitLines(text).forEach((line) => {
    if (/合计|小计|市值合计|资产账号/.test(line) && !/\d{5,6}/.test(line)) {
      dropped.push({ preview: previewLine(line), reason: '合计 / 资产行，不是持仓' })
      return
    }
    if (/证券代码|股票代码/.test(line) && /证券名称|股票名称/.test(line)) return
    const tokens = line.trim().split(/\s+/).flatMap(explodeMixedToken).filter(Boolean)
    if (!tokens.length) return

    let norm = null
    let name = ''
    const leftover = []
    tokens.forEach((t) => {
      if (/[.\/%]/.test(t) && /\d/.test(t)) {
        leftover.push(t)
        return
      }
      const via = normalizeOcrStockCode(t)
      if (!norm && isPlausibleTicker(via, t)) {
        norm = via
        return
      }
      if (!name && /[\u4e00-\u9fff]{2,}/.test(t) && !SKIP_NAME_TOKEN.test(t)) {
        name = t.replace(/[^\u4e00-\u9fffA-Za-z0-9*]/g, '')
        return
      }
      leftover.push(t)
    })

    if (!norm && name) {
      const byName = lookupCodeByName(name)
      if (byName) norm = normalizeStockCode(byName)
    }
    if (!norm) {
      const glued = line.match(/(\d{5,6})/)
      if (glued) {
        const via = normalizeOcrStockCode(glued[1])
        if (isPlausibleTicker(via, glued[1])) norm = via
      }
    }
    if (!norm) {
      if (line.trim().length >= 4) {
        dropped.push({ preview: previewLine(line), reason: '这一行没有认出股票代码' })
      }
      return
    }
    if (!name) name = getStockName(norm.code)

    const nums = []
    leftover.forEach((p) => {
      const n = parseNumberLoose(p)
      if (Number.isFinite(n) && /[\d.]/.test(p)) nums.push(n)
    })
    const picked = pickSharesAndCost(nums)
    extra.push({
      code: norm.code,
      ex: norm.ex,
      name: name || getStockName(norm.code) || norm.code,
      shares: Number.isFinite(picked.shares) ? picked.shares : 0,
      cost: Number.isFinite(picked.cost) ? picked.cost : 0,
      selected: true,
      confidence: 'low',
      source: 'ocr',
    })
  })
  return extra
}

export function enrichImportRows(rows) {
  return (rows || []).map((r) => {
    let code = String(r.code || '').trim()
    let ex = r.ex
    let name = String(r.name || '').trim()
    const repaired = normalizeOcrStockCode(code, ex)
    if (repaired) {
      code = repaired.code
      ex = repaired.ex
    }
    const byName = lookupCodeByName(name)
    if (byName && !STOCK_NAMES[code]) {
      const n = normalizeStockCode(byName)
      if (n) {
        code = n.code
        ex = n.ex
      }
    }
    if (STOCK_NAMES[code] && (!name || name === code || name.length < 2)) {
      name = STOCK_NAMES[code]
    }
    const known = !!STOCK_NAMES[code]
    let confidence = r.confidence || 'low'
    if (known && r.shares > 0 && r.cost > 0 && confidence === 'low') confidence = 'medium'
    if (known && r.source !== 'ocr' && confidence === 'medium') confidence = r.confidence
    return { ...r, code, ex: ex || r.ex, name: name || STOCK_NAMES[code] || code, confidence }
  })
}

export function scoreImportRows(rows) {
  return (rows || []).reduce((sum, r) => {
    let s = 1
    if (STOCK_NAMES[r.code]) s += 3
    if (Number(r.shares) > 0) s += 1
    if (Number(r.cost) > 0) s += 1
    return sum + s
  }, 0)
}

export function htmlTableToText(html) {
  if (!html || typeof html !== 'string') return ''
  if (typeof DOMParser === 'undefined') return ''
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html')
    const table = doc.querySelector('table')
    if (!table) return ''
    return [...table.querySelectorAll('tr')]
      .map((tr) =>
        [...tr.children]
          .map((td) => String(td.textContent || '').replace(/\s+/g, ' ').trim())
          .join('\t'),
      )
      .filter((line) => line.trim())
      .join('\n')
  } catch {
    return ''
  }
}

/**
 * Parse OCR plain text (often space-messy) into candidate rows.
 */
export function parseOcrText(text) {
  const dropped = []
  const dicted = extractHoldingsByNameAndCode(text)
  const lined = enrichImportRows(extractOcrLineRows(text, dropped))
  const merged = enrichImportRows(dedupeRows(mergeImportRows(dicted.rows, lined)))
  const allDropped = [...dropped, ...(dicted.dropped || [])].filter((d) => {
    const preview = String(d.preview || '')
    return !merged.some((r) => preview.includes(r.code) || (r.name && preview.includes(r.name)))
  })
  if (merged.length) {
    return { rows: merged, warnings: dicted.warnings || [], dropped: allDropped }
  }
  const parsed = parseHoldingsText(text, 'generic')
  const marked = enrichImportRows(
    parsed.rows.map((r) => ({
      ...r,
      confidence: 'low',
      source: 'ocr',
    })),
  )
  const fallbackDropped = [...allDropped, ...(parsed.dropped || [])]
  if (!marked.length) {
    return {
      rows: [],
      warnings: (parsed.warnings || []).concat(['OCR 未识别到持仓行']),
      dropped: fallbackDropped,
    }
  }
  return { rows: dedupeRows(marked), warnings: parsed.warnings || [], dropped: fallbackDropped }
}

/** Normalize rows coming from browser extension */
export function normalizeExtensionRows(payload) {
  const list = Array.isArray(payload) ? payload : payload?.rows || []
  const rows = []
  const dropped = []
  list.forEach((item) => {
    const raw = item.code || item.symbol
    const norm = normalizeStockCode(raw, item.ex)
    if (!norm) {
      dropped.push({
        preview: previewLine(String(raw || item.name || '')),
        reason: '扩展行无法识别股票代码',
      })
      return
    }
    rows.push({
      code: norm.code,
      ex: item.ex || norm.ex,
      name: item.name || item.symbolName || norm.code,
      shares: Number.isFinite(Number(item.shares)) ? Number(item.shares) : parseNumberLoose(item.shares) || 0,
      cost: Number.isFinite(Number(item.cost)) ? Number(item.cost) : parseNumberLoose(item.cost) || 0,
      selected: true,
      confidence: item.confidence || 'high',
      source: 'extension',
    })
  })
  return {
    rows: dedupeRows(rows),
    warnings: rows.length ? [] : ['扩展未返回有效持仓'],
    dropped,
  }
}

export function rowsToCommit(rows) {
  return (rows || [])
    .filter((r) => r.selected !== false && r.code)
    .map((r) => ({
      code: String(r.code).trim(),
      name: r.name || r.code,
      ex: inferHoldingEx(r.code, r.ex),
      shares: Number(r.shares) || 0,
      cost: Number(r.cost) || 0,
    }))
}
