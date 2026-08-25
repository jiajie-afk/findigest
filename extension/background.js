const FINDIGEST_URLS = [
  'https://findigest.cn/portfolio?import=extension',
  'https://www.findigest.cn/portfolio?import=extension',
  'http://127.0.0.1:5173/portfolio?import=extension',
  'http://localhost:5173/portfolio?import=extension',
  'https://findigest-three.vercel.app/portfolio?import=extension',
]

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === 'FD_OPEN_FINDIGEST') {
    const payload = msg.payload
    chrome.storage.local.set({ fdHoldingsPayload: payload }, () => {
      const target = msg.targetUrl || FINDIGEST_URLS[0]
      chrome.tabs.create({ url: target }, (tab) => {
        // Retry push after tab loads
        const tabId = tab.id
        const tryPush = (attempt) => {
          if (attempt > 8) return
          setTimeout(() => {
            chrome.tabs.sendMessage(tabId, { type: 'FD_PUSH_PAYLOAD', payload }, () => {
              if (chrome.runtime.lastError) tryPush(attempt + 1)
            })
          }, 400 * attempt)
        }
        tryPush(1)
      })
      sendResponse({ ok: true })
    })
    return true
  }
  return false
})
