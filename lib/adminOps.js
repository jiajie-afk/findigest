/**
 * Owner ops console — health, KPIs, redeem-code inventory, audit log.
 * Never stores plaintext codes after mint; never reads user vault holdings.
 */
import { putPrivateJson, readPrivateJson } from './secureBlob.js'

const AUDIT_PATH = 'findigest-admin/audit.json'
const CODE_PREFIX = 'findigest-billing/codes/'
const AUDIT_CAP = 200
const CODE_CAP = 200

export function systemHealth() {
  const ak =
    !!String(process.env.ALIYUN_ACCESS_KEY_ID || '').trim() &&
    !!String(process.env.ALIYUN_ACCESS_KEY_SECRET || '').trim()
  const sms =
    ak &&
    !!String(process.env.ALIYUN_SMS_SIGN_NAME || '').trim() &&
    !!String(process.env.ALIYUN_SMS_TEMPLATE_CODE || '').trim()
  const mail = ak && !!String(process.env.ALIYUN_DM_ACCOUNT_NAME || '').trim()
  const resend = !!String(process.env.RESEND_API_KEY || '').trim()
  const upstash =
    !!String(process.env.UPSTASH_REDIS_REST_URL || '').trim() &&
    !!String(process.env.UPSTASH_REDIS_REST_TOKEN || '').trim()
  return {
    blob: !!String(process.env.BLOB_READ_WRITE_TOKEN || '').trim(),
    adminSecret: String(process.env.ADMIN_SECRET || '').trim().length >= 16,
    otp: !!String(process.env.EMAIL_OTP_SECRET || '').trim(),
    sms,
    email: mail || resend,
    session: !!String(process.env.VAULT_SESSION_SECRET || '').trim(),
    upstash,
    cors: !!String(process.env.CORS_ORIGINS || '').trim(),
  }
}

export function computeKpis(accounts = []) {
  const now = Date.now()
  const week = now - 7 * 86400000
  let pro = 0
  let expired = 0
  let banned = 0
  let tokens = 0
  let calls = 0
  let new7 = 0
  let active7 = 0
  for (const a of accounts) {
    if (a.banned) banned += 1
    tokens += Number(a.totalTokens) || 0
    calls += Number(a.calls) || 0
    if (a.plan === 'pro') {
      if (a.proUntil == null || Number(a.proUntil) > now) pro += 1
      else expired += 1
    }
    if (Number(a.createdAt) >= week) new7 += 1
    if (Number(a.lastSeenAt || a.createdAt) >= week) active7 += 1
  }
  return {
    registered: accounts.length,
    pro,
    expired,
    banned,
    tokens,
    calls,
    new7,
    active7,
  }
}

export async function readAudit() {
  const raw = await readPrivateJson(AUDIT_PATH)
  return Array.isArray(raw?.events) ? raw.events : []
}

export async function appendAudit(entry = {}) {
  const events = await readAudit()
  events.unshift({
    at: Date.now(),
    action: String(entry.action || '').slice(0, 40),
    email: String(entry.email || '').slice(0, 120),
    detail: String(entry.detail || '').slice(0, 200),
    ip: String(entry.ip || '').slice(0, 64),
  })
  await putPrivateJson(AUDIT_PATH, {
    events: events.slice(0, AUDIT_CAP),
    updatedAt: Date.now(),
  })
}

function hashFromCodePath(pathname) {
  const p = String(pathname || '')
  if (!p.startsWith(CODE_PREFIX) || !p.endsWith('.json')) return ''
  return p.slice(CODE_PREFIX.length, -'.json'.length)
}

/**
 * @param {(prefix: string, max: number) => Promise<Array<{ pathname: string }>>} listBlobs
 */
export async function listCodeRecords(listBlobs) {
  const blobs = await listBlobs(CODE_PREFIX, CODE_CAP)
  const rows = []
  const batch = 8
  for (let i = 0; i < blobs.length; i += batch) {
    const chunk = blobs.slice(i, i + batch)
    const part = await Promise.all(
      chunk.map(async (b) => {
        const rec = await readPrivateJson(b.pathname)
        if (!rec || typeof rec !== 'object') return null
        const hash = hashFromCodePath(b.pathname)
        return {
          id: hash.slice(0, 10),
          last4: String(rec.last4 || '').slice(-4),
          status: rec.status === 'redeemed' ? 'redeemed' : 'unused',
          days: rec.days ?? null,
          note: String(rec.note || '').slice(0, 80),
          createdAt: rec.createdAt || null,
          redeemedAt: rec.redeemedAt || null,
        }
      }),
    )
    rows.push(...part.filter(Boolean))
  }
  rows.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
  return rows
}
