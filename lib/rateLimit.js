/**
 * Rate limiting: in-memory (always) + optional Upstash Redis (cross-instance).
 *
 * Set UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN on Vercel for global caps.
 * Without Upstash, limits are per serverless isolate (still useful under mild load).
 */

const buckets = new Map()
const MAX_LOCAL_KEYS = 12_000

function isProd() {
  return !!(process.env.VERCEL || process.env.NODE_ENV === 'production')
}

/**
 * Prefer platform-trusted client IP (Vercel) over spoofable X-Forwarded-For[0].
 * @param {import('http').IncomingMessage} req
 */
export function getClientIp(req) {
  const headers = req?.headers || {}
  const vercel =
    headers['x-vercel-forwarded-for'] ||
    headers['x-real-ip'] ||
    headers['cf-connecting-ip']
  if (typeof vercel === 'string' && vercel.trim()) {
    // x-vercel-forwarded-for may be a list; leftmost is the client on Vercel
    return vercel.split(',')[0].trim()
  }
  const xf = headers['x-forwarded-for']
  if (typeof xf === 'string' && xf.trim()) {
    const parts = xf.split(',').map((s) => s.trim()).filter(Boolean)
    // Prefer rightmost when not on Vercel (proxy appends); on Vercel we already returned above
    if (parts.length) return parts[isProd() ? parts.length - 1 : 0]
  }
  return req?.socket?.remoteAddress || req?.connection?.remoteAddress || 'unknown'
}

function upstashConfigured() {
  return !!(
    String(process.env.UPSTASH_REDIS_REST_URL || '').trim() &&
    String(process.env.UPSTASH_REDIS_REST_TOKEN || '').trim()
  )
}

/**
 * @param {string[]} command
 * @returns {Promise<unknown>}
 */
async function upstashCommand(command) {
  const base = String(process.env.UPSTASH_REDIS_REST_URL || '').replace(/\/$/, '')
  const token = String(process.env.UPSTASH_REDIS_REST_TOKEN || '').trim()
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), 2500)
  try {
    const res = await fetch(`${base}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(command),
      signal: ac.signal,
    })
    if (!res.ok) throw new Error(`upstash_http_${res.status}`)
    const data = await res.json()
    return data?.result
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Local fixed-window counter (sync).
 * @param {string} key
 * @param {{ limit?: number, windowMs?: number }} [opts]
 */
export function checkRateLimit(key, opts = {}) {
  const limit = opts.limit ?? 10
  const windowMs = opts.windowMs ?? 60_000
  const now = Date.now()

  if (buckets.size > MAX_LOCAL_KEYS) {
    for (const [k, v] of buckets) {
      if (now > v.resetAt) buckets.delete(k)
    }
    if (buckets.size > MAX_LOCAL_KEYS) {
      // Drop oldest half if still oversized (cold-start storm protection)
      let i = 0
      for (const k of buckets.keys()) {
        if (i++ % 2 === 0) buckets.delete(k)
      }
    }
  }

  let b = buckets.get(key)
  if (!b || now > b.resetAt) {
    b = { count: 0, resetAt: now + windowMs }
    buckets.set(key, b)
  }
  b.count += 1
  if (b.count > limit) {
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((b.resetAt - now) / 1000)) }
  }
  return { ok: true }
}

/**
 * Async limiter: Upstash when configured, else local memory.
 * Always applies local as a fast per-isolate backstop.
 * @param {string} key
 * @param {{ limit?: number, windowMs?: number }} [opts]
 */
export async function checkRateLimitAsync(key, opts = {}) {
  const limit = opts.limit ?? 10
  const windowMs = opts.windowMs ?? 60_000
  const local = checkRateLimit(key, opts)
  if (!local.ok) return local

  if (!upstashConfigured()) return { ok: true }

  const windowSec = Math.max(1, Math.ceil(windowMs / 1000))
  const bucket = Math.floor(Date.now() / windowMs)
  const redisKey = `fd:rl:${key}:${bucket}`
  try {
    const count = Number(await upstashCommand(['INCR', redisKey]))
    if (count === 1) {
      await upstashCommand(['EXPIRE', redisKey, String(windowSec + 2)])
    }
    if (count > limit) {
      return { ok: false, retryAfterSec: windowSec }
    }
    return { ok: true }
  } catch (e) {
    console.warn('[rateLimit] upstash fallback', e?.message || e)
    return { ok: true }
  }
}

/**
 * Distributed single-flight lock (Upstash SET NX). No-op success if Upstash missing.
 * @param {string} lockKey
 * @param {string} owner
 * @param {number} [ttlSec=30]
 */
export async function tryAcquireLock(lockKey, owner, ttlSec = 30) {
  if (!upstashConfigured()) return { ok: true, via: 'local' }
  const redisKey = `fd:lock:${lockKey}`
  try {
    const result = await upstashCommand([
      'SET',
      redisKey,
      String(owner),
      'NX',
      'EX',
      String(Math.max(1, ttlSec)),
    ])
    if (result === 'OK' || result === true) return { ok: true, via: 'upstash' }
    return { ok: false, via: 'upstash' }
  } catch (e) {
    console.warn('[rateLimit] lock fallback', e?.message || e)
    return { ok: true, via: 'local' }
  }
}

export function rateLimitResponse(res, retryAfterSec, message) {
  res.setHeader('Retry-After', String(retryAfterSec))
  return res.status(429).json({
    error: 'rate_limited',
    message: message || '尝试过于频繁，请稍后再试',
    retryAfterSec,
  })
}

export function upstashReady() {
  return upstashConfigured()
}
