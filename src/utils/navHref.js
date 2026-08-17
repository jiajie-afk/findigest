/** Resolve a Vue Router `to` value into a real href string. */
export function toHref(to) {
  if (to == null || to === '') return '/'
  if (typeof to === 'string') return to
  const path = to.path || '/'
  const query = to.query
  let search = ''
  if (query && typeof query === 'object') {
    const params = new URLSearchParams()
    for (const [k, v] of Object.entries(query)) {
      if (v == null || v === '') continue
      params.set(k, String(v))
    }
    const s = params.toString()
    if (s) search = `?${s}`
  }
  const hash = to.hash ? (to.hash.startsWith('#') ? to.hash : `#${to.hash}`) : ''
  return `${path}${search}${hash}`
}

function shouldLeaveToBrowser(event) {
  if (!event) return true
  if (event.defaultPrevented) return true
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return true
  if (typeof event.button === 'number' && event.button !== 0) return true
  const el = event.currentTarget
  const target = el?.getAttribute?.('target')
  if (target && target !== '_self') return true
  return false
}

function needsHardNav() {
  if (typeof window === 'undefined') return false
  const ua = navigator.userAgent || ''
  const coarse = window.matchMedia?.('(pointer: coarse)')?.matches
  return !!(coarse || /MicroMessenger|miniProgram|QQ\//i.test(ua))
}

/**
 * Same-origin taps: on WeChat / phones, force a real navigation so the first
 * tap is not eaten by :hover / Vue Router preventDefault. Hash links stay native.
 */
export function onNavClick(event, href, router) {
  if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return
  if (shouldLeaveToBrowser(event)) return
  event.preventDefault()
  const dest = new URL(href, window.location.origin)
  const here = window.location
  if (dest.pathname === here.pathname && dest.search === here.search && dest.hash === here.hash) {
    return
  }
  const next = `${dest.pathname}${dest.search}${dest.hash}`
  if (needsHardNav() || !router) {
    window.location.assign(next)
    return
  }
  router.push(next).catch(() => {
    window.location.assign(next)
  })
}
