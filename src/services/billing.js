/**
 * Soft Pro entitlement — only gates LLM enhance, never local briefing.
 * Localhost / Vite DEV: auto-unlock Pro (owner machine, no paywall).
 */
import { vaultGet, vaultSet, getActiveAccountId } from '@/services/vault.js'
import { apiUrl, fetchTimed } from '@/services/apiClient.js'
import { isLocalFreeProHost, freeProStatusLabel } from '@/services/localOwner.js'

export const BILLING_KEY = 'fd_billing'

/** Public catalog — payment checkout later; redeem codes unlock for now. */
export const PRO_PLANS = [
  {
    id: 'monthly',
    label: '月付',
    price: 18.8,
    priceLabel: '¥18.8',
    per: '/ 月',
    days: 30,
    hint: '灵活试用',
    featured: false,
  },
  {
    id: 'quarterly',
    label: '季付',
    price: 48,
    priceLabel: '¥48',
    per: '/ 季',
    days: 90,
    hint: '约 ¥16 / 月',
    featured: false,
  },
  {
    id: 'yearly',
    label: '年付',
    price: 128,
    priceLabel: '¥128',
    per: '/ 年',
    days: 365,
    hint: '约 ¥10.7 / 月 · 最划算',
    featured: true,
  },
]

export const PRO_PRICE_LABEL = isLocalFreeProHost()
  ? freeProStatusLabel()
  : '¥18.8 起 / 月 · 年付 ¥128'

export const PRO_BENEFITS = [
  'Pro Desk：近黑工作台 + 电青读数',
  '主导航直达工作区、事件、报告',
  '可用模型按你的约束重写今日简报',
  '88 题可慢慢补，不挡日常使用',
  '云端已开时，权益可跨设备跟账号',
]

/** Local/dev redeem — map to plan lengths until WeChat/Alipay is wired. */
const LOCAL_CODES = {
  'FINDIGEST-PRO-DEMO': 365,
  'FINDIGEST-PRO-30D': 30,
  'FINDIGEST-PRO-90D': 90,
  'FINDIGEST-PRO-YEAR': 365,
  'FINDIGEST-PRO-MONTH': 30,
  'FINDIGEST-PRO-QUARTER': 90,
}

function emptyBilling() {
  return { plan: 'free', proUntil: null, redeemedHashes: [], updatedAt: Date.now() }
}

export function normalizeCode(raw) {
  return String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
}

async function hashCode(code) {
  const data = new TextEncoder().encode(normalizeCode(code))
  const buf = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export function readBilling() {
  if (!getActiveAccountId()) return emptyBilling()
  const raw = vaultGet(BILLING_KEY, null)
  if (!raw || typeof raw !== 'object') return emptyBilling()
  return { ...emptyBilling(), ...raw }
}

export function writeBilling(state) {
  if (!getActiveAccountId()) return
  vaultSet(BILLING_KEY, { ...state, updatedAt: Date.now() })
}

export function isProActive(state = readBilling()) {
  if (state.plan !== 'pro') return false
  if (state.proUntil == null) return true
  return Number(state.proUntil) > Date.now()
}

/** Pull cloud entitlement (admin grant / redeem) into local vault billing. */
export async function pullCloudBilling() {
  const accountId = getActiveAccountId()
  if (!accountId) return readBilling()
  try {
    const res = await fetchTimed(
      apiUrl(`/api/billing?accountId=${encodeURIComponent(accountId)}`),
      {
        method: 'GET',
        credentials: 'include',
      },
      8000,
    )
    if (!res.ok) return readBilling()
    const data = await res.json().catch(() => null)
    if (!data || typeof data !== 'object' || data.plan == null) return readBilling()
    const local = readBilling()
    const cloud = {
      ...local,
      plan: data.plan === 'pro' ? 'pro' : 'free',
      proUntil: data.proUntil ?? null,
      updatedAt: data.updatedAt || Date.now(),
      cloudSynced: true,
    }
    writeBilling(cloud)
    return cloud
  } catch {
    return readBilling()
  }
}

function applyPro(state, days) {
  const now = Date.now()
  let base = now
  if (isProActive(state) && state.proUntil) base = Math.max(now, Number(state.proUntil))
  return {
    ...state,
    plan: 'pro',
    proUntil: days == null ? null : base + days * 86400000,
    updatedAt: now,
  }
}

export async function redeemCode(rawCode) {
  const code = normalizeCode(rawCode)
  if (!code) return { ok: false, message: '请输入兑换码' }
  if (!getActiveAccountId()) return { ok: false, message: '请先登录后再兑换' }

  try {
    const res = await fetch(apiUrl('/api/billing'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ action: 'redeem', accountId: getActiveAccountId(), code }),
    })
    if (res.status !== 503 && res.status !== 404) {
      const data = await res.json().catch(() => ({}))
      if (res.status === 429) {
        return { ok: false, message: data.message || '兑换尝试过于频繁，请稍后再试' }
      }
      if (!res.ok) return { ok: false, message: data.message || '开通失败' }
      const billing = {
        plan: 'pro',
        proUntil: data.proUntil ?? null,
        redeemedHashes: readBilling().redeemedHashes || [],
        updatedAt: Date.now(),
      }
      writeBilling(billing)
      return { ok: true, billing, message: 'Pro 已开通' }
    }
  } catch {
    /* local fallback */
  }

  const days = LOCAL_CODES[code]
  if (days == null) return { ok: false, message: '兑换码无效或已失效' }
  const state = readBilling()
  const h = await hashCode(code)
  if ((state.redeemedHashes || []).includes(h)) {
    return { ok: false, message: '该兑换码已在本账号使用过' }
  }
  const next = applyPro(state, days)
  next.redeemedHashes = [...(state.redeemedHashes || []), h]
  writeBilling(next)
  return { ok: true, billing: next, message: `Pro 已开通（${days} 天）` }
}

export { emptyBilling, LOCAL_CODES }
