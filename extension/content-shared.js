/** Shared DOM helpers for broker content scripts */

function fdNormHeader(h) {
  return String(h || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
}

function fdFindCol(headers, aliases) {
  const hs = headers.map(fdNormHeader)
  for (const a of aliases) {
    const key = fdNormHeader(a)
    const i = hs.findIndex((h) => h === key || h.includes(key))
    if (i >= 0) return i
  }
  return -1
}

function fdParseNum(s) {
  if (s == null) return NaN
  const n = Number(String(s).replace(/,/g, '').replace(/[^\d.\-]/g, ''))
  return Number.isFinite(n) ? n : NaN
}

function fdScanTables() {
  const CODE_A = ['代码', '证券代码', '股票代码', 'symbol', 'ticker', 'code']
  const NAME_A = ['名称', '证券名称', '股票名称', 'name']
  const SHARES_A = ['数量', '持股数量', '持仓数量', '股数', 'quantity', 'qty', 'shares']
  const COST_A = ['成本', '成本价', '摊薄成本', '平均成本', 'cost', 'avgcost', 'averagecost']

  const out = []
  document.querySelectorAll('table').forEach((table) => {
    const rows = [...table.querySelectorAll('tr')]
    if (rows.length < 2) return
    let headerCells = [...(rows[0].querySelectorAll('th,td'))].map((c) => c.innerText)
    let start = 1
    let iCode = fdFindCol(headerCells, CODE_A)
    if (iCode < 0 && rows[1]) {
      headerCells = [...rows[1].querySelectorAll('th,td')].map((c) => c.innerText)
      iCode = fdFindCol(headerCells, CODE_A)
      start = 2
    }
    if (iCode < 0) return
    const iName = fdFindCol(headerCells, NAME_A)
    const iShares = fdFindCol(headerCells, SHARES_A)
    const iCost = fdFindCol(headerCells, COST_A)
    for (let r = start; r < rows.length; r++) {
      const cells = [...rows[r].querySelectorAll('td,th')].map((c) => c.innerText.trim())
      if (!cells[iCode] || /合计|小计|total/i.test(cells[iCode])) continue
      const shares = iShares >= 0 ? fdParseNum(cells[iShares]) : NaN
      const cost = iCost >= 0 ? fdParseNum(cells[iCost]) : NaN
      out.push({
        code: cells[iCode],
        name: iName >= 0 ? cells[iName] : '',
        shares: Number.isFinite(shares) ? shares : 0,
        cost: Number.isFinite(cost) ? cost : 0,
        confidence: Number.isFinite(shares) && Number.isFinite(cost) ? 'high' : 'medium',
      })
    }
  })
  return out
}

function fdDedupe(rows) {
  const map = new Map()
  rows.forEach((r) => {
    const key = String(r.code || '').trim()
    if (!key) return
    map.set(key, r)
  })
  return [...map.values()]
}

window.__fdPageKind = function fdPageKind() {
  const href = String(location.href || '').toLowerCase()
  const text = String(document.body?.innerText || '').slice(0, 8000)
  const hasPwd = !!document.querySelector('input[type="password"]')
  if (
    /\/login|\/signin|upass\.10jqka|passport/.test(href) ||
    (hasPwd && /登录|密碼|密码|验证码/.test(text))
  ) {
    return { kind: 'login', hint: '当前是登录页。请先登录交易账号，再打开「持仓 / 资金股份」。' }
  }
  if (/持仓|资金股份|证券代码|成本价|可用余额|股份余额/.test(text)) {
    return { kind: 'holdings' }
  }
  return { kind: 'other', hint: '请打开持仓或「查询 → 资金股份」后再读取。' }
}

window.__fdExtractHoldings = function fdExtractHoldings(site) {
  let rows = []
  if (typeof window.__fdExtractSite === 'function') {
    try {
      rows = window.__fdExtractSite() || []
    } catch (e) {
      console.warn('[FinDigest] site extract failed', e)
    }
  }
  if (!rows.length) rows = fdScanTables()
  return {
    site: site || location.hostname,
    url: location.href,
    scrapedAt: new Date().toISOString(),
    rows: fdDedupe(rows),
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === 'FD_SCRAPE') {
    try {
      sendResponse({ ok: true, payload: window.__fdExtractHoldings(msg.site) })
    } catch (e) {
      sendResponse({ ok: false, error: String(e) })
    }
    return true
  }
  return false
})
