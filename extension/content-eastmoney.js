/** East Money / 东方财富 — prefer site-specific selectors, fall back to table scan */

window.__fdExtractSite = function () {
  const rows = []

  // Common trade / position grids
  const selectors = [
    '#tabPos tbody tr',
    '#tblPosition tbody tr',
    '.table_pos tbody tr',
    '.position-table tbody tr',
    '.hold-table tbody tr',
    '#table_position tbody tr',
    '.datagrid-btable tbody tr',
    'table.table-stock tbody tr',
    '.zichan-table tbody tr',
  ]

  for (const sel of selectors) {
    const trs = document.querySelectorAll(sel)
    if (!trs.length) continue
    trs.forEach((tr) => {
      const tds = [...tr.querySelectorAll('td')].map((td) => td.innerText.trim())
      if (tds.length < 3) return
      // Heuristic: first cell often code or name+code
      let code = ''
      let name = ''
      const joined = tds.join(' ')
      const m = joined.match(/\b([0369]\d{5})\b/) || joined.match(/\b(\d{5,6})\b/)
      if (m) code = m[1]
      if (!code) return
      name = tds.find((t) => /[\u4e00-\u9fff]{2,}/.test(t) && !/^\d/.test(t)) || ''
      const nums = tds.map((t) => Number(String(t).replace(/,/g, ''))).filter((n) => Number.isFinite(n) && n > 0)
      // Prefer larger integer as shares, smaller decimal as cost
      let shares = 0
      let cost = 0
      const ints = nums.filter((n) => Number.isInteger(n) || n >= 10)
      const decs = nums.filter((n) => !Number.isInteger(n) && n < 100000)
      if (ints.length) shares = ints[0]
      if (decs.length) cost = decs[0]
      else if (ints.length > 1) cost = ints[1]
      rows.push({ code, name, shares, cost, confidence: shares && cost ? 'medium' : 'low' })
    })
    if (rows.length) break
  }

  return rows
}
