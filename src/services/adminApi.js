/**
 * Owner ops console client. Secret stays in sessionStorage, never in the vault.
 */
import { apiUrl } from '@/services/apiClient.js'

export const ADMIN_SECRET_KEY = 'fd_admin_secret'

export const HEALTH_LABELS = {
  blob: '云端保险箱',
  adminSecret: '管理密钥',
  otp: '验证码 HMAC',
  sms: '短信通道',
  email: '邮件通道',
  session: 'httpOnly 会话',
  upstash: '全局限流',
  cors: 'CORS 白名单',
}

export function identityLabel(email) {
  const m = String(email || '').match(/^p(1\d{10})@sms\.findigest\.local$/i)
  if (m) return `手机 ${m[1]}`
  return email || '—'
}

export function planLabel(plan, proUntil) {
  if (plan !== 'pro') return 'Free'
  if (proUntil == null) return 'Pro · 永久'
  const t = Number(proUntil)
  if (!Number.isFinite(t) || t <= Date.now()) return 'Pro · 已过期'
  return `Pro · 至 ${new Date(t).toLocaleDateString('zh-CN')}`
}

export function fmtTime(t) {
  const n = Number(t)
  if (!Number.isFinite(n) || n <= 0) return '—'
  return new Date(n).toLocaleString('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function fmtDaySpan(days) {
  if (days == null) return '永久'
  return `${days} 天`
}

export function auditActionLabel(action) {
  const map = {
    grant_pro: '开通 Pro',
    revoke_pro: '取消 Pro',
    ban: '封禁',
    unban: '解封',
    issue_code: '生成兑换码',
  }
  return map[action] || action || '—'
}

function headers(secret, withJson = false) {
  const h = { 'X-Admin-Secret': String(secret || '').trim() }
  if (withJson) h['Content-Type'] = 'application/json'
  return h
}

export async function adminGet(secret, query = {}) {
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(query)) {
    if (v != null && v !== '') q.set(k, String(v))
  }
  const suffix = q.toString() ? `?${q}` : ''
  const res = await fetch(apiUrl(`/api/admin${suffix}`), { headers: headers(secret) })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(data.message || '请求失败')
    err.status = res.status
    err.data = data
    throw err
  }
  return data
}

export async function adminPost(secret, body = {}) {
  const res = await fetch(apiUrl('/api/admin'), {
    method: 'POST',
    headers: headers(secret, true),
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(data.message || '操作失败')
    err.status = res.status
    err.data = data
    throw err
  }
  return data
}
