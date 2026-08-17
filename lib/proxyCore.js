/**
 * Shared allowlisted upstream proxy core (Vite middleware + Vercel /api/proxy).
 * Not an open proxy: host + path must match ALLOWLIST.
 */

import { checkRateLimitAsync, getClientIp, rateLimitResponse } from './rateLimit.js'
import { applyStrictCors } from './apiAuth.js'

/** @typedef {{ host: string, paths: RegExp[], referer: string }} AllowEntry */

/** @type {AllowEntry[]} */
export const ALLOWLIST = [
  {
    host: 'search-api-web.eastmoney.com',
    paths: [/^\/search\//],
    referer: 'https://www.eastmoney.com/',
  },
  {
    host: 'guba.eastmoney.com',
    paths: [/^\/interface\//],
    referer: 'https://guba.eastmoney.com/',
  },
  {
    host: 'np-anotice-stock.eastmoney.com',
    paths: [/^\/api\//],
    referer: 'https://data.eastmoney.com/',
  },
  {
    host: 'push2.eastmoney.com',
    paths: [/^\/api\//],
    referer: 'https://quote.eastmoney.com/',
  },
  {
    host: 'emweb.securities.eastmoney.com',
    paths: [/^\/PC_HSF10\//],
    referer: 'https://emweb.securities.eastmoney.com/',
  },
  {
    host: 'datacenter-web.eastmoney.com',
    paths: [/^\/api\/data\//],
    referer: 'https://data.eastmoney.com/',
  },
  {
    host: 'hq.sinajs.cn',
    paths: [/^\/list/, /^\/rn=/],
    referer: 'https://finance.sina.com.cn/',
  },
]

const MAX_BYTES = Number(process.env.PROXY_MAX_BYTES || 1024 * 1024) // 1MB default
const FETCH_TIMEOUT_MS = Number(process.env.PROXY_TIMEOUT_MS || 10_000)
const MAX_INFLIGHT = Number(process.env.PROXY_MAX_INFLIGHT || 48)
const PROXY_IP_LIMIT = Number(process.env.PROXY_IP_LIMIT || 90)
const PROXY_IP_WINDOW_MS = Number(process.env.PROXY_IP_WINDOW_MS || 60_000)

/** Per-isolate concurrency gate — prevents memory pile-up under fan-out. */
let inflight = 0

async function readBodyLimited(res, maxBytes) {
  const cl = Number(res.headers.get('content-length') || 0)
  if (cl > maxBytes) {
    const err = new Error('upstream_too_large')
    err.code = 'upstream_too_large'
    throw err
  }
  const reader = res.body?.getReader?.()
  if (!reader) {
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length > maxBytes) {
      const err = new Error('upstream_too_large')
      err.code = 'upstream_too_large'
      throw err
    }
    return buf
  }
  const chunks = []
  let total = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > maxBytes) {
      try {
        await reader.cancel()
      } catch {
        /* ignore */
      }
      const err = new Error('upstream_too_large')
      err.code = 'upstream_too_large'
      throw err
    }
    chunks.push(Buffer.from(value))
  }
  return Buffer.concat(chunks)
}

/**
 * @param {string} rawUrl
 * @returns {{ ok: true, url: URL, entry: AllowEntry } | { ok: false, status: number, code: string, message: string }}
 */
export function validateUpstreamUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return { ok: false, status: 400, code: 'url_required', message: '缺少 url 参数' }
  }
  let parsed
  try {
    parsed = new URL(rawUrl)
  } catch {
    return { ok: false, status: 400, code: 'url_invalid', message: 'url 无效' }
  }
  if (parsed.protocol !== 'https:') {
    return { ok: false, status: 400, code: 'https_only', message: '仅允许 https 上游' }
  }
  const entry = ALLOWLIST.find((e) => e.host === parsed.hostname)
  if (!entry) {
    return { ok: false, status: 403, code: 'host_not_allowed', message: '上游主机未在白名单' }
  }
  const pathOk = entry.paths.some((re) => re.test(parsed.pathname + (parsed.search || ''))) ||
    entry.paths.some((re) => re.test(parsed.pathname))
  if (!pathOk) {
    return { ok: false, status: 403, code: 'path_not_allowed', message: '上游路径未在白名单' }
  }
  return { ok: true, url: parsed, entry }
}

/**
 * Strip JSONP wrapper `cbName(...)` → inner payload text.
 * @param {string} text
 */
export function unwrapJsonp(text) {
  const t = String(text || '').trim()
  const m = t.match(/^[a-zA-Z_$][\w$.]*\s*\(([\s\S]*)\)\s*;?\s*$/)
  if (m) return m[1]
  return t
}

/**
 * @param {string} rawUrl
 * @param {number} [redirectHops=0]
 * @returns {Promise<{ status: number, headers: Record<string, string>, body: string, json: any | null, error?: { status: number, code: string, message: string } }>}
 */
export async function fetchUpstream(rawUrl, redirectHops = 0) {
  const checked = validateUpstreamUrl(rawUrl)
  if (!checked.ok) {
    return {
      status: checked.status,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        status: checked.status,
        code: checked.code,
        message: checked.message,
      }),
      json: null,
      error: { status: checked.status, code: checked.code, message: checked.message },
    }
  }

  const { url, entry } = checked
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS)
  try {
    const upstream = await fetch(url.toString(), {
      method: 'GET',
      redirect: 'manual',
      signal: ac.signal,
      headers: {
        Accept: 'application/json, text/javascript, */*',
        'User-Agent':
          'Mozilla/5.0 (compatible; FinDigestProxy/1.0; +https://findigest.local)',
        Referer: entry.referer,
      },
    })

    // Do not follow redirects off-allowlist (SSRF via Location)
    if (upstream.status >= 300 && upstream.status < 400) {
      if (redirectHops >= 3) {
        const err = {
          status: 502,
          code: 'redirect_loop',
          message: '上游重定向次数过多',
        }
        return {
          status: 502,
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
          body: JSON.stringify(err),
          json: null,
          error: err,
        }
      }
      const loc = upstream.headers.get('location') || ''
      let nextUrl = null
      try {
        nextUrl = new URL(loc, url)
      } catch {
        nextUrl = null
      }
      const recheck = nextUrl ? validateUpstreamUrl(nextUrl.toString()) : { ok: false }
      if (!recheck.ok) {
        const err = {
          status: 502,
          code: 'redirect_blocked',
          message: '上游重定向目标未在白名单',
        }
        return {
          status: 502,
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
          body: JSON.stringify(err),
          json: null,
          error: err,
        }
      }
      return fetchUpstream(nextUrl.toString(), redirectHops + 1)
    }

    let buf
    try {
      buf = await readBodyLimited(upstream, MAX_BYTES)
    } catch (e) {
      if (e?.code === 'upstream_too_large' || e?.message === 'upstream_too_large') {
        const err = {
          status: 502,
          code: 'upstream_too_large',
          message: '上游响应过大',
        }
        return {
          status: 502,
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
          body: JSON.stringify(err),
          json: null,
          error: err,
        }
      }
      throw e
    }

    const text = buf.toString('utf8')
    if (!upstream.ok) {
      const err = {
        status: upstream.status,
        code: 'upstream_http_error',
        message: `上游返回 HTTP ${upstream.status}`,
      }
      return {
        status: upstream.status >= 400 && upstream.status < 600 ? upstream.status : 502,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify(err),
        json: null,
        error: err,
      }
    }

    const inner = unwrapJsonp(text)
    let json = null
    try {
      json = JSON.parse(inner)
    } catch {
      // plain text (e.g. Sina quote) — return as { text }
      json = { text: inner }
    }

    return {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'public, max-age=30',
        'X-Proxy-Upstream-Status': String(upstream.status),
      },
      body: JSON.stringify(json),
      json,
    }
  } catch (e) {
    const aborted = e?.name === 'AbortError'
    const err = {
      status: 502,
      code: aborted ? 'upstream_timeout' : 'upstream_fetch_failed',
      message: aborted ? '上游请求超时' : e?.message || '上游请求失败',
    }
    return {
      status: 502,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify(err),
      json: null,
      error: err,
    }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Node/Connect-style handler for GET /api/proxy?url=
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 * @param {{ method?: string, url?: string, query?: Record<string, string | string[]> }} [opts]
 */
export async function handleProxyHttp(req, res, opts = {}) {
  const method = opts.method || req.method || 'GET'
  applyStrictCors(req, res)
  // Same-origin SPA needs no CORS; allowlisted Origin only (no * amplifier)

  if (method === 'OPTIONS') {
    res.statusCode = 204
    res.end()
    return
  }

  if (method !== 'GET') {
    res.statusCode = 405
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.end(JSON.stringify({ status: 405, code: 'method_not_allowed', message: '仅支持 GET' }))
    return
  }

  const ip = getClientIp(req)
  const rl = await checkRateLimitAsync(`proxy:${ip}`, {
    limit: PROXY_IP_LIMIT,
    windowMs: PROXY_IP_WINDOW_MS,
  })
  if (!rl.ok) {
    if (typeof res.status === 'function' && typeof res.json === 'function') {
      return rateLimitResponse(res, rl.retryAfterSec, '代理请求过于频繁，请稍后再试')
    }
    res.statusCode = 429
    res.setHeader('Retry-After', String(rl.retryAfterSec))
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.end(
      JSON.stringify({
        error: 'rate_limited',
        message: '代理请求过于频繁，请稍后再试',
        retryAfterSec: rl.retryAfterSec,
      }),
    )
    return
  }

  if (inflight >= MAX_INFLIGHT) {
    res.statusCode = 503
    res.setHeader('Retry-After', '2')
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.end(
      JSON.stringify({
        error: 'proxy_overloaded',
        message: '行情代理繁忙，请稍后再试',
      }),
    )
    return
  }

  let rawUrl = ''
  if (opts.query?.url != null) {
    rawUrl = Array.isArray(opts.query.url) ? opts.query.url[0] : opts.query.url
  } else {
    try {
      const u = new URL(opts.url || req.url || '', 'http://localhost')
      rawUrl = u.searchParams.get('url') || ''
    } catch {
      rawUrl = ''
    }
  }

  inflight += 1
  let result
  try {
    result = await fetchUpstream(rawUrl)
  } finally {
    inflight -= 1
  }
  if (result.error) {
    console.warn(
      JSON.stringify({
        type: 'proxy_upstream_fail',
        code: result.error.code,
        status: result.status,
        host: (() => {
          try {
            return new URL(rawUrl).hostname
          } catch {
            return null
          }
        })(),
      }),
    )
  }
  res.statusCode = result.status
  for (const [k, v] of Object.entries(result.headers)) {
    res.setHeader(k, v)
  }
  res.end(result.body)
}
