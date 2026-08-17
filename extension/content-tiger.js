/** Tiger Securities web portfolio */

window.__fdExtractSite = function () {
  const rows = []
  const trs = document.querySelectorAll(
    'table tbody tr, [class*="position"] tr, [class*="Position"] tr, [class*="holding"] tr',
  )
  trs.forEach((tr) => {
    const text = tr.innerText || ''
    if (!text || /symbol|ticker|代码|合计/i.test(text) && text.split('\n').length < 3) {
      /* continue scanning */
    }
    const tds = [...tr.querySelectorAll('td, [role="cell"]')].map((td) => td.innerText.trim())
    if (tds.length < 2) return
    const blob = tds.join(' | ')
    // HK 00700 / 700 / US AAPL / CN 600519
    let code = ''
    let ex = ''
    const hk = blob.match(/\b0?\d{4,5}\b/)
    const cn = blob.match(/\b([0369]\d{5})\b/)
    const us = blob.match(/\b([A-Z]{1,5})\b/)
    if (cn) {
      code = cn[1]
      ex = code.startsWith('6') ? 'SH' : 'SZ'
    } else if (hk && !/[A-Z]{2,}/.test(tds[0] || '')) {
      code = hk[0]
      ex = 'HK'
    } else if (us && /^[A-Z]+$/.test(tds[0] || '')) {
      // skip pure US for FinDigest A/H focus unless numeric
      return
    }
    if (!code && tds[0]) code = tds[0].replace(/[^0-9A-Za-z]/g, '')
    if (!code) return
    const nums = tds.map((t) => Number(String(t).replace(/,/g, ''))).filter((n) => Number.isFinite(n))
    const shares = nums.find((n) => n >= 1) || 0
    const cost = nums.find((n) => n > 0 && n < shares) || nums[nums.length - 1] || 0
    const name = tds.find((t) => /[\u4e00-\u9fff]/.test(t)) || ''
    rows.push({ code, name, shares, cost, ex, confidence: 'medium' })
  })
  return rows
}
