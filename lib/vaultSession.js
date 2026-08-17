/**
 * Best-effort signed vault session cookie (httpOnly).
 * Requires VAULT_SESSION_SECRET. Without it, callers skip signing (fd_aid-only hint).
 */
import crypto from 'node:crypto'
import { applyStrictCors } from './apiAuth.js'

export const FD_SESS_COOKIE = 'fd_sess'
export const FD_AID_COOKIE = 'fd_aid'
/** Short-lived relative to fd_aid hint (30d) — refresh on each successful vault PUT. */
export const FD_SESS_MAX_AGE_SEC = 7 * 24 * 60 * 60

export function getSessionSecret() {
  return String(process.env.VAULT_SESSION_SECRET || '').trim()
}

export function parseCookies(req) {
  const raw = req?.headers?.cookie || req?.headers?.Cookie || ''
  const out = {}
  String(raw)
    .split(';')
    .forEach((part) => {
      const i = part.indexOf('=')
      if (i < 0) return
      const k = part.slice(0, i).trim()
      const v = part.slice(i + 1).trim()
      if (!k) return
      try {
        out[k] = decodeURIComponent(v)
      } catch {
        out[k] = v
      }
    })
  return out
}

function timingSafeEqualStr(a, b) {
  const ba = Buffer.from(String(a))
  const bb = Buffer.from(String(b))
  if (ba.length !== bb.length) return false
  return crypto.timingSafeEqual(ba, bb)
}

/**
 * @param {{ accountId: string, email: string, exp?: number }} claims
 * @returns {string|null}
 */
export function signSession(claims) {
  const secret = getSessionSecret()
  if (!secret) return null
  const accountId = String(claims.accountId || '').trim()
  const email = String(claims.email || '')
    .trim()
    .toLowerCase()
  if (!accountId || !email) return null
  const exp = claims.exp || Date.now() + FD_SESS_MAX_AGE_SEC * 1000
  const payload = Buffer.from(JSON.stringify({ accountId, email, exp }), 'utf8').toString('base64url')
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('base64url')
  return `${payload}.${sig}`
}

/**
 * @param {string} token
 * @returns {{ accountId: string, email: string, exp: number }|null}
 */
export function verifySession(token) {
  const secret = getSessionSecret()
  if (!secret || !token) return null
  const parts = String(token).split('.')
  if (parts.length !== 2) return null
  const [payload, sig] = parts
  if (!payload || !sig) return null
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('base64url')
  if (!timingSafeEqualStr(sig, expected)) return null
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    if (!data?.accountId || !data?.email || !data?.exp) return null
    if (Number(data.exp) < Date.now()) return null
    return {
      accountId: String(data.accountId),
      email: String(data.email).toLowerCase(),
      exp: Number(data.exp),
    }
  } catch {
    return null
  }
}

export function readSessionFromRequest(req) {
  const cookies = parseCookies(req)
  return verifySession(cookies[FD_SESS_COOKIE] || '')
}

function cookieSecureFlag() {
  return process.env.VERCEL || process.env.NODE_ENV === 'production' ? '; Secure' : ''
}

/**
 * Build Set-Cookie values for successful vault sync.
 * Always sets fd_aid hint; sets fd_sess only when VAULT_SESSION_SECRET is configured.
 */
export function buildVaultSetCookies({ accountId, email }) {
  const secure = cookieSecureFlag()
  const cookies = [
    `${FD_AID_COOKIE}=${encodeURIComponent(accountId)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000${secure}`,
  ]
  const token = signSession({ accountId, email })
  if (token) {
    cookies.push(
      `${FD_SESS_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${FD_SESS_MAX_AGE_SEC}${secure}`,
    )
  }
  return cookies
}

/** Expire session cookies (logout / best-effort clear). */
export function buildClearVaultCookies() {
  const secure = cookieSecureFlag()
  return [
    `${FD_AID_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`,
    `${FD_SESS_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`,
  ]
}

/**
 * CORS for credentialed vault/auth calls — allowlist only (see CORS_ORIGINS).
 */
export function applyVaultCors(req, res) {
  applyStrictCors(req, res)
}
