let lastPayload = null

const statusEl = document.getElementById('status')
const previewEl = document.getElementById('preview')
const sendBtn = document.getElementById('send')
const copyBtn = document.getElementById('copy')

const LOGIN = {
  eastmoney: 'https://jywg.18.cn/Login',
  ths: 'https://eq.10jqka.com.cn/',
}

function setStatus(msg, isErr = true) {
  statusEl.textContent = msg || ''
  statusEl.className = isErr ? 'err' : 'ok'
}

function mergePayloads(parts) {
  const rows = []
  const seen = new Set()
  let site = ''
  let url = ''
  let loginHint = ''
  for (const part of parts) {
    if (!part) continue
    if (part.kind === 'login' && part.hint) loginHint = part.hint
    const p = part.payload
    if (!p) continue
    site = site || p.site
    url = url || p.url
    for (const r of p.rows || []) {
      const key = String(r.code || '').trim()
      if (!key || seen.has(key)) continue
      seen.add(key)
      rows.push(r)
    }
  }
  return {
    site,
    url,
    scrapedAt: new Date().toISOString(),
    rows,
    loginHint,
  }
}

document.getElementById('open-em').addEventListener('click', () => {
  chrome.tabs.create({ url: LOGIN.eastmoney })
})
document.getElementById('open-ths').addEventListener('click', () => {
  chrome.tabs.create({ url: LOGIN.ths })
})

document.getElementById('scrape').addEventListener('click', async () => {
  setStatus('')
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id) {
    setStatus('找不到当前标签页')
    return
  }
  const url = tab.url || ''
  const okHost =
    /eastmoney|18\.cn|10jqka|thsi\.cn|tiger|itiger/i.test(url)
  if (!okHost) {
    setStatus('请先点上方按钮打开东方财富或同花顺登录页，登录后再读取。')
    return
  }

  const files = ['content-shared.js']
  if (/eastmoney|18\.cn/i.test(url)) files.push('content-eastmoney.js')
  else if (/10jqka|thsi\.cn/i.test(url)) files.push('content-ths.js')
  else files.push('content-tiger.js')

  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id, allFrames: true },
      files,
    })
  } catch (e) {
    console.warn(e)
  }

  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id, allFrames: true },
      func: () => {
        const kind = typeof window.__fdPageKind === 'function' ? window.__fdPageKind() : { kind: 'other' }
        const payload =
          typeof window.__fdExtractHoldings === 'function'
            ? window.__fdExtractHoldings(location.href)
            : { rows: [] }
        return { kind: kind.kind, hint: kind.hint, payload, href: location.href }
      },
    })
    const parts = (results || []).map((r) => r?.result).filter(Boolean)
    const merged = mergePayloads(
      parts.map((p) => ({ kind: p.kind, hint: p.hint, payload: p.payload })),
    )
    lastPayload = merged
    const n = merged.rows.length
    previewEl.textContent = n
      ? JSON.stringify(merged.rows.slice(0, 12), null, 2) + (n > 12 ? `\n… 共 ${n} 行` : '')
      : '未识别到持仓表'
    sendBtn.disabled = !n
    copyBtn.disabled = !n
    if (n) setStatus(`已读取 ${n} 行`, false)
    else if (parts.some((p) => p.kind === 'login')) {
      setStatus(merged.loginHint || '请先登录交易账号，再打开持仓页后读取。')
    } else {
      setStatus('未读到持仓。确认已登录并打开「资金股份 / 持仓」，或复制表格回 FinDigest 粘贴。')
    }
  } catch (e) {
    setStatus('无法读取本页。请刷新券商页面后重试，或改用粘贴导入。')
    console.warn(e)
  }
})

copyBtn.addEventListener('click', async () => {
  if (!lastPayload) return
  try {
    await navigator.clipboard.writeText(JSON.stringify(lastPayload, null, 2))
    setStatus('已复制 JSON', false)
  } catch {
    setStatus('复制失败')
  }
})

sendBtn.addEventListener('click', () => {
  if (!lastPayload) return
  const targetUrl = document.getElementById('target').value
  chrome.runtime.sendMessage({ type: 'FD_OPEN_FINDIGEST', payload: lastPayload, targetUrl }, (res) => {
    if (chrome.runtime.lastError || !res?.ok) setStatus('打开发送失败')
    else {
      setStatus('已打开 FinDigest，请在校对表确认导入', false)
      window.close()
    }
  })
})
