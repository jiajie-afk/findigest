/**
 * Email OTP + short-lived emailProof tokens for FinDigest auth.
 * Storage: in-memory (Vite / single instance) + optional Vercel Blob for multi-instance.
 */
import crypto from 'node:crypto'
import { putPrivateJson, readPrivateJson, deleteBlobPath } from './secureBlob.js'

const mem = new Map()
const OTP_TTL_MS = 10 * 60_000
const PROOF_TTL_MS = 15 * 60_000
const CODE_LEN = 6

function otpSecret() {
  const s =
    String(process.env.EMAIL_OTP_SECRET || '').trim() ||
    String(process.env.VAULT_SESSION_SECRET || '').trim()
  if (s) return s
  // Dev-only fallback — production must set EMAIL_OTP_SECRET (enforced in /api/auth).
  if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
    throw new Error('EMAIL_OTP_SECRET_required')
  }
  return 'findigest-dev-otp-change-me'
}

export function normalizeEmail(raw) {
  return String(raw || '')
    .trim()
    .toLowerCase()
}

export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

/** Mainland China mobile → 11 digits, or '' if invalid. */
export function normalizePhone(raw) {
  let d = String(raw || '').replace(/\D/g, '')
  if (d.startsWith('0086')) d = d.slice(4)
  else if (d.startsWith('86') && d.length === 13) d = d.slice(2)
  if (/^1\d{10}$/.test(d)) return d
  return ''
}

export function isValidPhone(phone) {
  return !!normalizePhone(phone)
}

/** Stable vault/cloud key for phone-only accounts (looks like an email). */
export function phoneVaultEmail(phone) {
  const p = normalizePhone(phone)
  return p ? `p${p}@sms.findigest.local` : ''
}

function safeKey(email) {
  return normalizeEmail(email).replace(/[^a-z0-9@._+-]/g, '_')
}

function memKey(purpose, email) {
  return `${purpose}:${normalizeEmail(email)}`
}

export function generateOtpCode() {
  const n = crypto.randomInt(0, 10 ** CODE_LEN)
  return String(n).padStart(CODE_LEN, '0')
}

export function hashOtp(email, code) {
  return crypto.createHmac('sha256', otpSecret()).update(`${normalizeEmail(email)}:${code}`).digest('hex')
}

function timingSafeEqualHex(a, b) {
  const ba = Buffer.from(String(a), 'utf8')
  const bb = Buffer.from(String(b), 'utf8')
  if (ba.length !== bb.length) return false
  return crypto.timingSafeEqual(ba, bb)
}

async function blobPath(purpose, email) {
  return `findigest-otp/${purpose}_${safeKey(email)}.json`
}

async function readBlobOtp(purpose, email) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return null
  try {
    const want = await blobPath(purpose, email)
    const data = await readPrivateJson(want)
    return data
  } catch {
    return null
  }
}

async function writeBlobOtp(purpose, email, rec) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return
  const pathname = await blobPath(purpose, email)
  await putPrivateJson(pathname, rec)
}

async function clearBlobOtp(purpose, email) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return
  try {
    const want = await blobPath(purpose, email)
    await deleteBlobPath(want)
  } catch {
    /* ignore */
  }
}

/**
 * @param {{ email: string, purpose: 'login'|'register', code: string }}
 */
export async function saveOtp({ email, purpose, code }) {
  const emailNorm = normalizeEmail(email)
  const rec = {
    email: emailNorm,
    purpose,
    codeHash: hashOtp(emailNorm, code),
    exp: Date.now() + OTP_TTL_MS,
    attempts: 0,
    createdAt: Date.now(),
  }
  mem.set(memKey(purpose, emailNorm), { ...rec })
  await writeBlobOtp(purpose, emailNorm, rec)
  return { exp: rec.exp, ttlSec: Math.floor(OTP_TTL_MS / 1000) }
}

async function loadOtp(purpose, email) {
  const emailNorm = normalizeEmail(email)
  const key = memKey(purpose, emailNorm)
  let rec = mem.get(key) || null
  if (!rec || Date.now() > rec.exp) {
    const fromBlob = await readBlobOtp(purpose, emailNorm)
    if (fromBlob && Date.now() <= Number(fromBlob.exp)) {
      rec = {
        email: fromBlob.email,
        purpose: fromBlob.purpose,
        codeHash: fromBlob.codeHash,
        exp: Number(fromBlob.exp),
        attempts: Number(fromBlob.attempts) || 0,
        createdAt: fromBlob.createdAt,
      }
      mem.set(key, rec)
    } else {
      rec = null
    }
  }
  return rec
}

/**
 * @returns {{ ok: true } | { ok: false, code: string, message: string }}
 */
export async function consumeOtp({ email, purpose, code }) {
  const emailNorm = normalizeEmail(email)
  const rec = await loadOtp(purpose, emailNorm)
  if (!rec) {
    return { ok: false, code: 'otp_missing', message: '验证码无效或已过期，请重新获取' }
  }
  if (Date.now() > rec.exp) {
    mem.delete(memKey(purpose, emailNorm))
    await clearBlobOtp(purpose, emailNorm)
    return { ok: false, code: 'otp_expired', message: '验证码已过期，请重新获取' }
  }
  if (rec.attempts >= 5) {
    mem.delete(memKey(purpose, emailNorm))
    await clearBlobOtp(purpose, emailNorm)
    return { ok: false, code: 'otp_locked', message: '验证码错误次数过多，请重新获取' }
  }
  const expect = rec.codeHash
  const got = hashOtp(emailNorm, String(code || '').trim())
  if (!timingSafeEqualHex(expect, got)) {
    rec.attempts += 1
    mem.set(memKey(purpose, emailNorm), rec)
    await writeBlobOtp(purpose, emailNorm, {
      email: rec.email,
      purpose: rec.purpose,
      codeHash: rec.codeHash,
      exp: rec.exp,
      attempts: rec.attempts,
      createdAt: rec.createdAt,
    })
    return { ok: false, code: 'otp_wrong', message: '验证码不正确' }
  }
  mem.delete(memKey(purpose, emailNorm))
  await clearBlobOtp(purpose, emailNorm)
  return { ok: true }
}

export function signEmailProof({ email, purpose }) {
  const emailNorm = normalizeEmail(email)
  const exp = Date.now() + PROOF_TTL_MS
  const payload = Buffer.from(JSON.stringify({ email: emailNorm, purpose, exp }), 'utf8').toString('base64url')
  const sig = crypto.createHmac('sha256', otpSecret()).update(payload).digest('base64url')
  return { emailProof: `${payload}.${sig}`, exp, ttlSec: Math.floor(PROOF_TTL_MS / 1000) }
}

/**
 * @returns {{ ok: true, email: string, purpose: string } | { ok: false, message: string }}
 */
export function verifyEmailProof(token, expectedPurpose) {
  if (!token) return { ok: false, message: '请先完成邮箱验证' }
  const parts = String(token).split('.')
  if (parts.length !== 2) return { ok: false, message: '邮箱验证已失效，请重新验证' }
  const [payload, sig] = parts
  const expected = crypto.createHmac('sha256', otpSecret()).update(payload).digest('base64url')
  if (!timingSafeEqualHex(expected, sig)) return { ok: false, message: '邮箱验证无效' }
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    if (!data?.email || !data?.purpose || !data?.exp) return { ok: false, message: '邮箱验证无效' }
    if (Number(data.exp) < Date.now()) return { ok: false, message: '邮箱验证已过期，请重新验证' }
    if (expectedPurpose && data.purpose !== expectedPurpose) {
      return { ok: false, message: '验证用途不匹配，请重新获取验证码' }
    }
    return { ok: true, email: normalizeEmail(data.email), purpose: data.purpose }
  } catch {
    return { ok: false, message: '邮箱验证无效' }
  }
}

export function canRevealDevCode(req) {
  // Never leak OTP in production-shaped deploys
  if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
    if (String(process.env.EMAIL_DEV_REVEAL || '') === '1') {
      console.warn('[otp] EMAIL_DEV_REVEAL ignored in production')
    }
    return false
  }
  if (String(process.env.EMAIL_DEV_REVEAL || '') === '1') return true
  const hasMail =
    !!String(process.env.ALIYUN_DM_ACCOUNT_NAME || '').trim() ||
    !!String(process.env.RESEND_API_KEY || '').trim()
  const hasSms =
    !!String(process.env.ALIYUN_SMS_SIGN_NAME || '').trim() &&
    !!String(process.env.ALIYUN_SMS_TEMPLATE_CODE || '').trim()
  if (hasMail || hasSms) return false
  const host = String(req?.headers?.host || '')
  return host.includes('127.0.0.1') || host.includes('localhost')
}

/**
 * Send OTP email: Aliyun DirectMail first, then Resend fallback.
 */
export async function sendOtpEmail({ email, code, purpose }) {
  try {
    const { sendAliyunMail } = await import('./aliyunMail.js')
    const aliyun = await sendAliyunMail({ email, code, purpose })
    if (aliyun.sent) return aliyun
    if (aliyun.reason && aliyun.reason !== 'mail_unconfigured') return aliyun
  } catch (e) {
    console.error('[otp] aliyun mail', e)
  }

  const key = String(process.env.RESEND_API_KEY || '').trim()
  const from = String(process.env.EMAIL_FROM || 'FinDigest <onboarding@resend.dev>').trim()
  if (!key) {
    return { sent: false, reason: 'email_unconfigured' }
  }
  const purposeLabel =
    purpose === 'register' ? '注册' : purpose === 'reset' ? '重置密码' : '登录'
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), 10_000)
  let res
  try {
    res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [normalizeEmail(email)],
        subject: `FinDigest ${purposeLabel}验证码`,
        text: `你的 FinDigest ${purposeLabel}验证码是：${code}\n\n${Math.floor(OTP_TTL_MS / 60000)} 分钟内有效。如非本人操作请忽略。`,
      }),
      signal: ac.signal,
    })
  } catch (e) {
    clearTimeout(timer)
    return {
      sent: false,
      reason: e?.name === 'AbortError' ? 'send_timeout' : 'send_failed',
      detail: String(e?.message || e).slice(0, 200),
    }
  }
  clearTimeout(timer)
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    return { sent: false, reason: 'send_failed', detail: text.slice(0, 200) }
  }
  return { sent: true, provider: 'resend' }
}

/** Send OTP SMS via Aliyun Dysmsapi. */
export async function sendOtpSms({ phone, code }) {
  try {
    const { sendAliyunSms } = await import('./aliyunSms.js')
    return await sendAliyunSms({ phone, code })
  } catch (e) {
    console.error('[otp] aliyun sms', e)
    return { sent: false, reason: 'sms_failed', detail: String(e?.message || e) }
  }
}
