/**
 * Account registry + usage paths for admin console.
 */
import { putPrivateJson, readPrivateJson } from './secureBlob.js'
import { normalizeEmail } from './emailOtp.js'

export function safeEmailKey(email) {
  return String(normalizeEmail(email) || '')
    .replace(/[^a-z0-9@._+-]/g, '_')
}

export function safeIdKey(id) {
  return String(id || '')
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(0, 120)
}

export function accountMetaPath(email) {
  return `findigest-accounts/${safeEmailKey(email)}.json`
}

export function usagePath(accountId) {
  return `findigest-usage/${safeIdKey(accountId)}.json`
}

export function entitlementPath(accountId) {
  return `findigest-billing/entitlements/${safeIdKey(accountId)}.json`
}

export async function readAccountMeta(email) {
  const e = normalizeEmail(email)
  if (!e) return null
  return readPrivateJson(accountMetaPath(e))
}

export async function upsertAccountMeta(partial) {
  const email = normalizeEmail(partial.email)
  if (!email || !partial.accountId) return null
  const prev = (await readAccountMeta(email)) || {}
  const next = {
    email,
    accountId: String(partial.accountId),
    displayName: partial.displayName ?? prev.displayName ?? '',
    createdAt: prev.createdAt || partial.createdAt || Date.now(),
    updatedAt: Date.now(),
    banned: typeof partial.banned === 'boolean' ? partial.banned : !!prev.banned,
    bannedAt: partial.bannedAt ?? prev.bannedAt ?? null,
    banReason: partial.banReason ?? prev.banReason ?? '',
    lastSeenAt: partial.lastSeenAt ?? Date.now(),
  }
  await putPrivateJson(accountMetaPath(email), next)
  return next
}

export async function isAccountBanned(email) {
  const meta = await readAccountMeta(email)
  return !!(meta && meta.banned)
}

export async function readUsage(accountId) {
  if (!accountId) return emptyUsage(accountId)
  const raw = await readPrivateJson(usagePath(accountId))
  if (!raw || typeof raw !== 'object') return emptyUsage(accountId)
  return {
    ...emptyUsage(accountId),
    ...raw,
  }
}

export function emptyUsage(accountId) {
  return {
    accountId: accountId || '',
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    calls: 0,
    lastModel: '',
    lastAt: null,
    updatedAt: null,
  }
}

export async function addUsage(accountId, delta = {}) {
  const prev = await readUsage(accountId)
  const prompt = Math.max(0, Number(delta.promptTokens) || 0)
  const completion = Math.max(0, Number(delta.completionTokens) || 0)
  const total =
    Math.max(0, Number(delta.totalTokens) || 0) || prompt + completion
  const next = {
    accountId: String(accountId),
    promptTokens: (prev.promptTokens || 0) + prompt,
    completionTokens: (prev.completionTokens || 0) + completion,
    totalTokens: (prev.totalTokens || 0) + total,
    calls: (prev.calls || 0) + 1,
    lastModel: String(delta.model || prev.lastModel || ''),
    lastAt: Date.now(),
    updatedAt: Date.now(),
  }
  await putPrivateJson(usagePath(accountId), next)
  return next
}
