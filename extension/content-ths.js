/** 同花顺 web — table scan first; copy JSON fallback messaging via shared */

window.__fdExtractSite = function () {
  // Rely mostly on shared table scanner; light heuristic for THS grids
  const rows = []
  document.querySelectorAll('.table-body tr, .holding-list tr, table tbody tr').forEach((tr) => {
    const tds = [...tr.querySelectorAll('td')].map((td) => td.innerText.trim())
    if (tds.length < 3) return
    const m = tds.join(' ').match(/\b([0369]\d{5})\b/)
    if (!m) return
    const nums = tds.map((t) => Number(String(t).replace(/,/g, ''))).filter((n) => Number.isFinite(n) && n > 0)
    rows.push({
      code: m[1],
      name: tds.find((t) => /[\u4e00-\u9fff]{2,}/.test(t)) || '',
      shares: nums[0] || 0,
      cost: nums.find((n) => n < 10000 && !Number.isInteger(n)) || nums[1] || 0,
      confidence: 'medium',
    })
  })
  return rows
}
