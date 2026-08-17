/**
 * Private JSON blob helpers (Vercel Blob).
 * Hot path: exact pathname put/get — no list() on every write.
 * Legacy public blobs: one-shot list fallback on miss only.
 */
import { put, list, del, get } from '@vercel/blob'

const EGRESS_TIMEOUT_MS = 8_000

function blobToken() {
  return String(process.env.BLOB_READ_WRITE_TOKEN || '').trim()
}

function withToken(opts = {}) {
  const token = blobToken()
  return token ? { ...opts, token } : opts
}

async function fetchWithTimeout(url, ms = EGRESS_TIMEOUT_MS) {
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), ms)
  try {
    return await fetch(url, { signal: ac.signal })
  } finally {
    clearTimeout(timer)
  }
}

/**
 * @param {string} pathname
 * @param {unknown} data
 */
export async function putPrivateJson(pathname, data) {
  await put(
    pathname,
    JSON.stringify(data),
    withToken({
      access: 'private',
      contentType: 'application/json',
      addRandomSuffix: false,
      allowOverwrite: true,
    }),
  )
}

/**
 * Claim-style write: only succeeds if pathname does not already exist as private blob.
 * Best-effort — race still possible without Redis; use tryAcquireLock for hard exclusivity.
 * @param {string} pathname
 * @param {unknown} data
 * @returns {Promise<{ ok: true } | { ok: false, reason: string, existing?: object }>}
 */
export async function putPrivateJsonIfAbsent(pathname, data) {
  const existing = await readPrivateJson(pathname)
  if (existing) return { ok: false, reason: 'exists', existing }
  await putPrivateJson(pathname, data)
  const again = await readPrivateJson(pathname)
  if (again && JSON.stringify(again) !== JSON.stringify(data)) {
    // Another writer may have won; treat as conflict if shape differs materially
    return { ok: false, reason: 'conflict', existing: again }
  }
  return { ok: true }
}

/**
 * @param {string} pathname
 * @returns {Promise<object|null>}
 */
export async function readPrivateJson(pathname) {
  try {
    const result = await get(pathname, withToken({ access: 'private' }))
    if (result?.stream) {
      const text = await new Response(result.stream).text()
      if (!text) return null
      return JSON.parse(text)
    }
  } catch {
    /* legacy public fallback below */
  }

  // Legacy: public blob URL (one list scan). Prefer migrating with putPrivateJson.
  if (String(process.env.BLOB_SKIP_PUBLIC_FALLBACK || '') === '1') return null
  try {
    const leaf = pathname.split('/').pop()
    const prefix = pathname.includes('/') ? pathname.replace(/[^/]+$/, '') : pathname
    const { blobs } = await list(withToken({ prefix, limit: 100 }))
    const hit = blobs.find(
      (b) => b.pathname === pathname || (leaf && b.pathname.endsWith(`/${leaf}`)),
    )
    if (!hit?.url) return null
    const r = await fetchWithTimeout(hit.url)
    if (!r.ok) return null
    return await r.json()
  } catch {
    return null
  }
}

/**
 * @param {string} pathname
 */
export async function deleteBlobPath(pathname) {
  try {
    const result = await get(pathname, withToken({ access: 'private' }))
    if (result?.blob?.url) {
      await del(result.blob.url, withToken())
      return
    }
  } catch {
    /* ignore */
  }
  if (String(process.env.BLOB_SKIP_PUBLIC_FALLBACK || '') === '1') return
  try {
    const leaf = pathname.split('/').pop()
    const prefix = pathname.includes('/') ? pathname.replace(/[^/]+$/, '') : pathname
    const { blobs } = await list(withToken({ prefix, limit: 100 }))
    const hit = blobs.find(
      (b) => b.pathname === pathname || (leaf && b.pathname.endsWith(`/${leaf}`)),
    )
    if (hit?.url) await del(hit.url, withToken())
  } catch {
    /* ignore */
  }
}
