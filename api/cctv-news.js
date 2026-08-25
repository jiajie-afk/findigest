/**
 * GET /api/cctv-news — ranked CCTV headlines (title + brief + official URL).
 */
import { applyStrictCors } from '../lib/apiAuth.js'
import { checkRateLimitAsync, getClientIp, rateLimitResponse } from '../lib/rateLimit.js'
import { collectCctvNews } from '../lib/cctvNews.js'

export const config = { runtime: 'nodejs', maxDuration: 20 }

const CACHE_MS = 10 * 60 * 1000
let cache = { at: 0, payload: null }

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

async function fetchText(url) {
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), 9000)
  try {
    const res = await fetch(url, {
      signal: ac.signal,
      headers: {
        Accept: '*/*',
        Referer: url.includes('tv.cctv.com') ? 'https://tv.cctv.com/lm/xwlb/' : 'https://news.cctv.com/',
        'User-Agent': UA,
      },
    })
    if (!res.ok) throw new Error(`upstream_${res.status}`)
    return await res.text()
  } finally {
    clearTimeout(timer)
  }
}

export default async function handler(req, res) {
  applyStrictCors(req, res)
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'method_not_allowed', message: '仅支持 GET' })
  }

  const ip = getClientIp(req)
  const rl = await checkRateLimitAsync(`cctv-news:${ip}`, { limit: 20, windowMs: 60_000 })
  if (!rl.ok) return rateLimitResponse(res, rl.retryAfterSec, '要闻刷新过于频繁')

  const now = Date.now()
  if (cache.payload && now - cache.at < CACHE_MS) {
    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=600')
    return res.status(200).json({ ...cache.payload, cache: 'hit' })
  }

  try {
    const collected = await collectCctvNews({ fetchText, now, limit: 40 })
    if (!collected.items.length) {
      return res.status(502).json({
        error: 'empty',
        message: '央视网列表暂时为空，请稍后重试',
        errors: collected.errors,
      })
    }
    const payload = {
      ok: true,
      source: 'cctv',
      asOf: collected.asOf,
      counts: collected.counts,
      items: collected.items,
      groups: collected.groups,
      errors: collected.errors,
    }
    cache = { at: now, payload }
    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=600')
    return res.status(200).json({ ...payload, cache: 'miss' })
  } catch (e) {
    console.error('[api/cctv-news]', e?.message || e)
    if (cache.payload) {
      return res.status(200).json({ ...cache.payload, cache: 'stale', warning: e?.message || 'upstream' })
    }
    return res.status(502).json({
      error: 'upstream',
      message: '央视网暂时不可达',
    })
  }
}
