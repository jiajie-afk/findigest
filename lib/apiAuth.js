/**
 * Shared API auth helpers: CORS allowlist + vault access (session | emailProof).
 */
import { normalizeEmail, verifyEmailProof } from './emailOtp.js'
import { readSessionFromRequest } from './vaultSession.js'

function isProd() {
  return !!(process.env.VERCEL || process.env.NODE_ENV === 'production')
}

/** Local / preview origins always allowed when not locked down. */
const DEV_ORIGINS = [
  'http://127.0.0.1:5173',
  'http://localhost:5173',
  'http://127.0.0.1:4173',
  'http://localhost:4173',
]

/**
 * @returns {string[]}
 */
export function allowedCorsOrigins() {
  const fromEnv = String(process.env.CORS_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  if (fromEnv.length) return fromEnv
  if (!isProd()) return DEV_ORIGINS
  // Production without CORS_ORIGINS: same-origin only (no reflected Origin)
  return []
}

/**
 * @param {string} origin
 */
export function isAllowedOrigin(origin) {
  if (!origin) return false
  const list = allowedCorsOrigins()
  if (list.includes(origin)) return true
  // Allow Vercel preview of this project if CORS_ORIGINS contains a pattern host
  try {
    const u = new URL(origin)
    if (!isProd() && (u.hostname === 'localhost' || u.hostname === '127.0.0.1')) return true
  } catch {
    return false
  }
  return false
}

/**
 * Credentialed CORS. Does NOT reflect arbitrary Origin.
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 */
export function applyStrictCors(req, res) {
  const origin = req.headers?.origin || req.headers?.Origin || ''
  if (origin && isAllowedOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Access-Control-Allow-Credentials', 'true')
    res.setHeader('Vary', 'Origin')
  }
  // If Origin present but not allowed: omit ACAO (browser blocks credentialed XHR)
  res.setHeader('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, X-Email-Proof, X-Admin-Secret, Authorization',
  )
}

/**
 * @param {import('http').IncomingMessage} req
 * @param {object} [body]
 */
export function readEmailProofHeader(req, body) {
  const h =
    req.headers?.['x-email-proof'] ||
    req.headers?.['X-Email-Proof'] ||
    body?.emailProof ||
    ''
  return String(h || '').trim()
}

/**
 * Authorize vault/billing access for an email (or session-only).
 * @param {import('http').IncomingMessage} req
 * @param {{ email?: string, allowPurposes?: string[], body?: object }} opts
 * @returns {{ ok: true, via: 'session'|'emailProof', session?: object, proof?: object } | { ok: false, status: number, error: string, message: string }}
 */
export function authorizeIdentity(req, opts = {}) {
  const allowPurposes = opts.allowPurposes || ['login', 'register']
  const emailNorm = normalizeEmail(opts.email || '')
  const sess = readSessionFromRequest(req)

  if (sess?.email) {
    if (!emailNorm || sess.email === emailNorm) {
      return { ok: true, via: 'session', session: sess }
    }
    return {
      ok: false,
      status: 403,
      error: 'session_mismatch',
      message: '会话与账号不匹配，请重新登录',
    }
  }

  const proofTok = readEmailProofHeader(req, opts.body)
  const proof = verifyEmailProof(proofTok, null)
  if (!proof.ok) {
    return {
      ok: false,
      status: 401,
      error: 'unauthorized',
      message: proof.message || '请先完成验证码验证',
    }
  }
  if (!allowPurposes.includes(proof.purpose)) {
    return {
      ok: false,
      status: 403,
      error: 'proof_purpose',
      message: '验证用途不匹配，请重新获取验证码',
    }
  }
  if (emailNorm && proof.email !== emailNorm) {
    return {
      ok: false,
      status: 403,
      error: 'proof_mismatch',
      message: '验证邮箱与请求不一致',
    }
  }
  return { ok: true, via: 'emailProof', proof }
}

export function requireOtpSecretConfigured() {
  const s =
    String(process.env.EMAIL_OTP_SECRET || '').trim() ||
    String(process.env.VAULT_SESSION_SECRET || '').trim()
  if (s) return { ok: true, secret: s }
  if (isProd()) {
    return {
      ok: false,
      status: 503,
      error: 'otp_unconfigured',
      message: '服务端未配置 EMAIL_OTP_SECRET，无法安全验证',
    }
  }
  return { ok: true, secret: 'findigest-dev-otp-change-me' }
}
