import { normalizeStockCode, parseNumberLoose } from '../utils/stockCode.js'

export const IMPORT_TEMPLATES = [
  {
    id: 'eastmoney',
    label: '东方财富',
    guide: [
      '打开东方财富网上交易 https://jywg.18.cn/Login 。资金账号登录；若有二维码，必须用「东方财富证券」App 扫，不能用看行情的「东方财富」或微信。',
      '进入「查询 → 资金股份」。',
      '用扩展读取，或复制表格 / 导出 CSV 回到 FinDigest。',
    ],
  },
  {
    id: 'ths',
    label: '同花顺',
    guide: [
      '打开同花顺网页交易 https://eq.10jqka.com.cn/ ，用交易账号登录。',
      '打开持仓 / 股份页。',
      '用扩展读取；读不到则复制表格粘贴导入。',
    ],
  },
  {
    id: 'tiger',
    label: '老虎证券',
    guide: [
      '登录老虎证券网页版，进入 Portfolio / 持仓。',
      '导出 CSV，或复制持仓表。',
      '港股代码会自动识别为 HK。',
    ],
  },
  {
    id: 'hk_generic',
    label: '港股通用',
    guide: [
      '适用于港股券商英文/中文持仓表。',
      '需含 Symbol/代码、Quantity/数量、Cost/成本 等列。',
      '也可直接粘贴表格。',
    ],
  },
  {
    id: 'generic',
    label: '自定义 / 通用',
    guide: [
      '任意含「代码、数量、成本」列的表格。',
      '支持逗号/制表符/竖线分隔。',
      '首行建议为表头。',
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
  // Chinese space-separated fallback: multiple spaces
  if (/\s{2,}/.test(line)) return 'spaces'
  return '\t'
}

function parseRow(line, delim) {
  if (delim === 'spaces') return line.trim().split(/\s{2,}|\t+/).map((c) => c.trim())
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

/**
 * Parse CSV / pasted table text into holding rows.
 * @returns {{ rows: Array, warnings: string[] }}
 */
export function parseHoldingsText(text, templateId = 'generic') {
  const warnings = []
  const lines = splitLines(text)
  if (!lines.length) return { rows: [], warnings: ['没有可解析的内容'] }

  const delim = detectDelimiter(lines[0])
  const matrix = lines.map((l) => parseRow(l, delim)).filter((r) => r.some((c) => c))

  if (!matrix.length) return { rows: [], warnings: ['表格为空'] }

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
    return { rows: [], warnings: ['找不到「代码」列，请换模板或改用通用粘贴'] }
  }
  if (iShares < 0) warnings.push('未找到数量列，股数将留空供校对')
  if (iCost < 0) warnings.push('未找到成本列，成本将留空供校对')

  const start = headerIdx < 0 ? 0 : headerIdx + 1
  const rows = []
  for (let r = start; r < matrix.length; r++) {
    const cells = matrix[r]
    const rawCode = cells[iCode]
    if (!rawCode || /合计|小计|total|资产|现金/i.test(String(rawCode))) continue

    let hintEx = null
    if (iEx >= 0) {
      const exRaw = String(cells[iEx] || '').toUpperCase()
      if (exRaw.includes('HK') || exRaw.includes('港')) hintEx = 'HK'
      else if (exRaw.includes('SH') || exRaw.includes('沪')) hintEx = 'SH'
      else if (exRaw.includes('SZ') || exRaw.includes('深')) hintEx = 'SZ'
    }
    if (templateId === 'hk_generic') hintEx = hintEx || 'HK'

    const norm = normalizeStockCode(rawCode, hintEx)
    if (!norm) continue

    const name = iName >= 0 ? String(cells[iName] || '').trim() : ''
    const shares = iShares >= 0 ? parseNumberLoose(cells[iShares]) : NaN
    const cost = iCost >= 0 ? parseNumberLoose(cells[iCost]) : NaN

    rows.push({
      code: norm.code,
      ex: norm.ex,
      name: name || norm.code,
      shares: Number.isFinite(shares) ? shares : 0,
      cost: Number.isFinite(cost) ? cost : 0,
      selected: true,
      confidence: Number.isFinite(shares) && Number.isFinite(cost) ? 'high' : 'medium',
      source: 'text',
    })
  }

  if (!rows.length) warnings.push('解析结果为空，请检查分隔符或列名')
  return { rows: dedupeRows(rows), warnings }
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

/**
 * Parse OCR plain text (often space-messy) into candidate rows.
 */
export function parseOcrText(text) {
  const { rows, warnings } = parseHoldingsText(text, 'generic')
  const marked = rows.map((r) => ({
    ...r,
    confidence: 'low',
    source: 'ocr',
  }))
  if (!marked.length) {
    // Line-by-line heuristic: CODE NAME SHARES COST
    const extra = []
    splitLines(text).forEach((line) => {
      const parts = line.trim().split(/\s+/)
      if (parts.length < 2) return
      const norm = normalizeStockCode(parts[0])
      if (!norm) return
      let shares = NaN
      let cost = NaN
      let name = ''
      const nums = []
      parts.slice(1).forEach((p) => {
        const n = parseNumberLoose(p)
        if (Number.isFinite(n) && /[\d.]/.test(p)) nums.push(n)
        else if (!name && /[\u4e00-\u9fffA-Za-z]/.test(p)) name = p
      })
      if (nums.length >= 1) shares = nums[0]
      if (nums.length >= 2) cost = nums[nums.length - 1]
      extra.push({
        code: norm.code,
        ex: norm.ex,
        name: name || norm.code,
        shares: Number.isFinite(shares) ? shares : 0,
        cost: Number.isFinite(cost) ? cost : 0,
        selected: true,
        confidence: 'low',
        source: 'ocr',
      })
    })
    return { rows: dedupeRows(extra), warnings: warnings.concat(extra.length ? [] : ['OCR 未识别到持仓行']) }
  }
  return { rows: marked, warnings }
}

/** Normalize rows coming from browser extension */
export function normalizeExtensionRows(payload) {
  const list = Array.isArray(payload) ? payload : payload?.rows || []
  const rows = []
  list.forEach((item) => {
    const norm = normalizeStockCode(item.code || item.symbol, item.ex)
    if (!norm) return
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
  return { rows: dedupeRows(rows), warnings: rows.length ? [] : ['扩展未返回有效持仓'] }
}

export function rowsToCommit(rows) {
  return (rows || [])
    .filter((r) => r.selected !== false && r.code)
    .map((r) => ({
      code: String(r.code).trim(),
      name: r.name || r.code,
      ex: r.ex || 'SH',
      shares: Number(r.shares) || 0,
      cost: Number(r.cost) || 0,
    }))
}
