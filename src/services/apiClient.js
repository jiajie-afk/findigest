/**
 * Same-origin / remote API helpers.
 * VITE_API_BASE defaults to '' (same origin). Set when SPA is hosted elsewhere.
 *
 * Quote / proxy responses should surface `{ asOf, source }` where practical.
 * source ∈ 'proxy' | 'jsonp-fallback' | 'cache'
 */

const API_BASE = String(import.meta.env?.VITE_API_BASE ?? '').replace(/\/$/, '')

/**
 * Production default: JSONP fallback off (set VITE_ALLOW_JSONP=true for local/dev if proxy unavailable).
 * In non-PROD builds, default true so local vite without /api still works.
 */
export function allowJsonpFallback() {
  const raw = import.meta.env.VITE_ALLOW_JSONP
  if (raw === 'true' || raw === '1') return true
  if (raw === 'false' || raw === '0') return false
  return !import.meta.env.PROD
}

/** @typedef {'proxy'|'jsonp-fallback'|'cache'} DataSource */

/**
 * @param {unknown} data
 * @param {DataSource} source
 * @param {string|null} [asOf]
 */
export function withDataMeta(data, source, asOf = null) {
  return {
    data,
    asOf: asOf || new Date().toISOString(),
    source,
  }
}

/**
 * Structured API / proxy error for UI retry.
 */
export class ApiError extends Error {
  /**
   * @param {{ status?: number, code?: string, message?: string, cause?: unknown }} opts
   */
  constructor({ status = 0, code = 'unknown', message = '请求失败', cause } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    if (cause !== undefined) this.cause = cause
  }

  toJSON() {
    return { status: this.status, code: this.code, message: this.message }
  }
}

export function getApiBase() {
  return API_BASE
}

/**
 * @param {string} path absolute path starting with /
 */
export function apiUrl(path) {
  const p = path.startsWith('/') ? path : `/${path}`
  return `${API_BASE}${p}`
}

/**
 * fetch with timeout — avoids auth/register hanging forever on slow vault.
 * @param {string} url
 * @param {RequestInit} [init]
 * @param {number} [timeoutMs]
 */
export async function fetchTimed(url, init = {}, timeoutMs = 15000) {
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: ac.signal })
  } catch (e) {
    if (e?.name === 'AbortError') {
      throw new ApiError({ status: 0, code: 'timeout', message: '请求超时，请检查网络后重试' })
    }
    throw e
  } finally {
    clearTimeout(timer)
  }
}

/**
 * @param {string} path
 * @param {RequestInit} [init]
 */
export async function apiFetch(path, init = {}) {
  const url = apiUrl(path)
  let res
  try {
    res = await fetch(url, init)
  } catch (e) {
    throw new ApiError({
      status: 0,
      code: 'network_error',
      message: e?.message || '网络错误',
      cause: e,
    })
  }

  const ct = res.headers.get('content-type') || ''
  let data = null
  if (ct.includes('application/json')) {
    data = await res.json().catch(() => null)
  } else {
    const text = await res.text().catch(() => '')
    data = text ? { text } : null
  }

  if (!res.ok) {
    throw new ApiError({
      status: res.status,
      code: data?.code || `http_${res.status}`,
      message: data?.message || `HTTP ${res.status}`,
    })
  }

  return data
}

/**
 * Fetch an allowlisted upstream URL via /api/proxy (returns parsed JSON).
 * @param {string} upstreamUrl full https URL
 * @param {{ signal?: AbortSignal, timeoutMs?: number }} [opts]
 */
export async function proxyFetch(upstreamUrl, opts = {}) {
  const qs = new URLSearchParams({ url: upstreamUrl })
  const path = `/api/proxy?${qs.toString()}`
  const { timeoutMs = 12000, signal } = opts

  let timer
  const ac = new AbortController()
  const onAbort = () => ac.abort()
  if (signal) {
    if (signal.aborted) ac.abort()
    else signal.addEventListener('abort', onAbort, { once: true })
  }
  if (timeoutMs > 0) {
    timer = setTimeout(() => ac.abort(), timeoutMs)
  }

  try {
    return await apiFetch(path, { method: 'GET', signal: ac.signal })
  } catch (e) {
    if (e instanceof ApiError) throw e
    if (e?.name === 'AbortError') {
      throw new ApiError({ status: 0, code: 'timeout', message: '请求超时' })
    }
    throw new ApiError({
      status: 0,
      code: 'proxy_failed',
      message: e?.message || '代理请求失败',
      cause: e,
    })
  } finally {
    if (timer) clearTimeout(timer)
    if (signal) signal.removeEventListener('abort', onAbort)
  }
}
