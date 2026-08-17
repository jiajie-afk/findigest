/** Bridge: when FinDigest page loads with import=extension, inject storage payload */

async function injectFromStorage() {
  try {
    const { fdHoldingsPayload } = await chrome.storage.local.get('fdHoldingsPayload')
    if (!fdHoldingsPayload) return
    localStorage.setItem('fd_extension_import_v1', JSON.stringify(fdHoldingsPayload))
    window.postMessage({ type: 'FD_HOLDINGS_IMPORT', payload: fdHoldingsPayload }, window.location.origin)
  } catch (e) {
    console.warn('[FinDigest] bridge failed', e)
  }
}

if (location.search.includes('import=extension') || location.pathname.includes('portfolio')) {
  injectFromStorage()
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === 'FD_PUSH_PAYLOAD' && msg.payload) {
    try {
      localStorage.setItem('fd_extension_import_v1', JSON.stringify(msg.payload))
      window.postMessage({ type: 'FD_HOLDINGS_IMPORT', payload: msg.payload }, window.location.origin)
    } catch (e) {
      console.warn(e)
    }
  }
})
