/**
 * Owner ops API — accounts, entitlements, redeem codes, system health, audit.
 * Auth: header X-Admin-Secret or Authorization: Bearer <ADMIN_SECRET>
 *
 * Set ADMIN_SECRET on Vercel (and .env.local for Vite).
 * Never returns vault holdings.
 */
import { createHash, randomInt } from 'node:crypto'
import { list } from '@vercel/blob'
import { checkRateLimitAsync, getClientIp, rateLimitResponse } from '../lib/rateLimit.js'
import { applyStrictCors } from '../lib/apiAuth.js'
import { normalizeEmail, isValidEmail } from '../lib/emailOtp.js'
import { putPrivateJson, readPrivateJson } from '../lib/secureBlob.js'
import {
  addUsage,
  emptyUsage,
  entitlementPath,
  readAccountMeta,
  readUsage,
  safeEmailKey,
  upsertAccountMeta,
} from '../lib/accountAdmin.js'
import {
  appendAudit,
  computeKpis,
  listCodeRecords,
  readAudit,
  systemHealth,
} from '../lib/adminOps.js'

export const config = { runtime: 'nodejs', maxDuration: 30 }

function blobToken() {
  return String(process.env.BLOB_READ_WRITE_TOKEN || '').trim()
}

function adminSecret() {
  return String(process.env.ADMIN_SECRET || '').trim()
}

function authorizeAdmin(req) {
  const expected = adminSecret()
  if (!expected || expected.length < 16) {
    return { ok: false, status: 503, error: 'admin_unconfigured', message: '未配置 ADMIN_SECRET' }
  }
  const header =
    req.headers?.['x-admin-secret'] ||
    req.headers?.['X-Admin-Secret'] ||
    ''
  let bearer = ''
  const auth = String(req.headers?.authorization || req.headers?.Authorization || '')
  if (auth.toLowerCase().startsWith('bearer ')) bearer = auth.slice(7).trim()
  const got = String(header || bearer || '').trim()
  if (!got || got !== expected) {
    return { ok: false, status: 401, error: 'unauthorized', message: '管理密钥错误' }
  }
  return { ok: true }
}

async function resolveAccount(email) {
  const e = normalizeEmail(email)
  if (!e || !isValidEmail(e)) return { ok: false, message: '邮箱无效' }
  let meta = await readAccountMeta(e)
  const vaultKey = `findigest-vaults/${safeEmailKey(e)}.json`
  const vault = await readPrivateJson(vaultKey)
  if (!vault?.accountId) {
    return { ok: false, message: '云端无此账号（用户需先注册并同步）' }
  }
  if (!meta) {
    meta = await upsertAccountMeta({
      email: e,
      accountId: vault.accountId,
      displayName: vault.displayName || '',
      createdAt: vault.createdAt,
    })
  }
  const ent = (await readPrivateJson(entitlementPath(meta.accountId))) || {
    plan: 'free',
    proUntil: null,
  }
  const usage = await readUsage(meta.accountId)
  return { ok: true, email: e, meta, vault: { accountId: vault.accountId, updatedAt: vault.updatedAt }, ent, usage }
}

function codePath(hash) {
  return `findigest-billing/codes/${hash}.json`
}

function hashCode(code) {
  return createHash('sha256')
    .update(
      String(code || '')
        .trim()
        .toUpperCase()
        .replace(/\s+/g, ''),
    )
    .digest('hex')
}

function mintPlainCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const chunk = (n) => Array.from({ length: n }, () => alphabet[randomInt(alphabet.length)]).join('')
  return `FD-${chunk(4)}-${chunk(4)}-${chunk(4)}`
}

async function listBlobs(prefix, max = 200) {
  const all = []
  let cursor
  for (;;) {
    const page = await list({
      token: blobToken(),
      prefix,
      limit: Math.min(100, max - all.length),
      cursor,
    })
    all.push(...(page.blobs || []))
    if (!page.hasMore || !page.cursor || all.length >= max) break
    cursor = page.cursor
  }
  return all.slice(0, max)
}

function emailFromBlobPath(pathname, prefix) {
  const p = String(pathname || '')
  if (!p.startsWith(prefix) || !p.endsWith('.json')) return ''
  return normalizeEmail(p.slice(prefix.length, -'.json'.length))
}

async function listRegisteredAccounts() {
  const vaults = await listBlobs('findigest-vaults/', 200)
  const metas = await listBlobs('findigest-accounts/', 200)
  const emails = new Map()
  for (const b of vaults) {
    const e = emailFromBlobPath(b.pathname, 'findigest-vaults/')
    if (e && isValidEmail(e)) emails.set(e, { email: e })
  }
  for (const b of metas) {
    const e = emailFromBlobPath(b.pathname, 'findigest-accounts/')
    if (e && isValidEmail(e) && !emails.has(e)) emails.set(e, { email: e })
  }

  const items = [...emails.values()]
  const rows = []
  const batch = 8
  for (let i = 0; i < items.length; i += batch) {
    const chunk = items.slice(i, i + batch)
    const part = await Promise.all(
      chunk.map(async (item) => {
        const meta = await readAccountMeta(item.email)
        const accountId = meta?.accountId || ''
        const ent = accountId ? (await readPrivateJson(entitlementPath(accountId))) : null
        const usage = accountId ? await readUsage(accountId) : emptyUsage('')
        return {
          email: item.email,
          displayName: meta?.displayName || '',
          accountId: accountId || '',
          banned: !!meta?.banned,
          plan: ent?.plan || 'free',
          proUntil: ent?.proUntil ?? null,
          totalTokens: usage.totalTokens || 0,
          calls: usage.calls || 0,
          createdAt: meta?.createdAt || null,
          lastSeenAt: meta?.lastSeenAt || meta?.updatedAt || null,
        }
      }),
    )
    rows.push(...part)
  }
  rows.sort((a, b) => (b.lastSeenAt || b.createdAt || 0) - (a.lastSeenAt || a.createdAt || 0))
  return { accounts: rows, total: rows.length }
}

export default async function handler(req, res) {
  applyStrictCors(req, res)
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Email-Proof, X-Admin-Secret, Authorization')
  if (req.method === 'OPTIONS') return res.status(204).end()

  if (!blobToken()) {
    return res.status(503).json({ error: 'cloud_unconfigured', message: '缺少 BLOB_READ_WRITE_TOKEN' })
  }

  const authz = authorizeAdmin(req)
  if (!authz.ok) {
    return res.status(authz.status).json({ error: authz.error, message: authz.message })
  }

  const ip = getClientIp(req)
  const rl = await checkRateLimitAsync(`admin:${ip}`, { limit: 90, windowMs: 15 * 60_000 })
  if (!rl.ok) {
    return rateLimitResponse(res, rl.retryAfterSec, '操作过于频繁')
  }

  async function note(action, extra = {}) {
    try {
      await appendAudit({ action, ip, ...extra })
    } catch (e) {
      console.warn('[admin audit]', e?.message || e)
    }
  }

  try {
    if (req.method === 'GET') {
      const view = String(req.query.view || '').trim()
      const email = normalizeEmail(req.query.email || '')
      if (email) {
        const hit = await resolveAccount(email)
        if (!hit.ok) return res.status(404).json({ error: 'not_found', message: hit.message })
        return res.status(200).json(hit)
      }
      if (view === 'health') {
        return res.status(200).json({ health: systemHealth() })
      }
      if (view === 'codes') {
        const codes = await listCodeRecords(listBlobs)
        return res.status(200).json({ codes, total: codes.length })
      }
      if (view === 'audit') {
        const events = await readAudit()
        return res.status(200).json({ events })
      }
      const listed = await listRegisteredAccounts()
      return res.status(200).json({
        ...listed,
        kpis: computeKpis(listed.accounts),
        health: systemHealth(),
      })
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}
      const action = String(body.action || '').trim()

      if (action === 'issue_code') {
        const days = body.days == null || body.days === '' ? null : Number(body.days)
        if (days != null && (!Number.isFinite(days) || days < 1 || days > 3650)) {
          return res.status(400).json({ error: 'bad_days', message: '天数无效' })
        }
        const code = mintPlainCode()
        const rec = {
          status: 'unused',
          days: days == null || !Number.isFinite(days) ? null : days,
          createdAt: Date.now(),
          createdBy: 'admin',
          note: String(body.note || '').slice(0, 80),
          last4: code.slice(-4),
        }
        await putPrivateJson(codePath(hashCode(code)), rec)
        await note('issue_code', { detail: rec.days == null ? '永久' : `${rec.days}天` })
        return res.status(200).json({
          ok: true,
          message: '兑换码已生成，请立刻复制发给用户（明文只显示一次）',
          code,
          days: rec.days,
          last4: rec.last4,
          note: rec.note,
        })
      }

      const email = normalizeEmail(body.email || '')

      if (action === 'lookup') {
        const hit = await resolveAccount(email)
        if (!hit.ok) return res.status(404).json({ error: 'not_found', message: hit.message })
        return res.status(200).json(hit)
      }

      const hit = await resolveAccount(email)
      if (!hit.ok) return res.status(404).json({ error: 'not_found', message: hit.message })
      const { meta } = hit
      const accountId = meta.accountId
      const now = Date.now()

      if (action === 'grant_pro') {
        const days = body.days == null || body.days === '' ? null : Number(body.days)
        const existing = (await readPrivateJson(entitlementPath(accountId))) || {
          plan: 'free',
          proUntil: null,
        }
        let base = now
        if (existing.plan === 'pro' && existing.proUntil && Number(existing.proUntil) > now) {
          base = Number(existing.proUntil)
        }
        const next = {
          plan: 'pro',
          proUntil: days == null || !Number.isFinite(days) ? null : base + days * 86400000,
          updatedAt: now,
          accountId,
          grantedBy: 'admin',
          email,
        }
        await putPrivateJson(entitlementPath(accountId), next)
        await upsertAccountMeta({ ...meta, lastSeenAt: now })
        await note('grant_pro', {
          email,
          detail: next.proUntil == null ? '永久' : `${days}天`,
        })
        return res.status(200).json({ ok: true, message: '已开通 Pro', ent: next, meta, email })
      }

      if (action === 'revoke_pro') {
        const next = {
          plan: 'free',
          proUntil: null,
          updatedAt: now,
          accountId,
          revokedBy: 'admin',
          email,
        }
        await putPrivateJson(entitlementPath(accountId), next)
        await note('revoke_pro', { email })
        return res.status(200).json({ ok: true, message: '已取消 Pro', ent: next, meta, email })
      }

      if (action === 'ban') {
        const nextMeta = await upsertAccountMeta({
          ...meta,
          banned: true,
          bannedAt: now,
          banReason: String(body.reason || '').slice(0, 200),
        })
        await note('ban', { email, detail: nextMeta.banReason || '' })
        return res.status(200).json({ ok: true, message: '已封禁', meta: nextMeta, email })
      }

      if (action === 'unban') {
        const nextMeta = await upsertAccountMeta({
          ...meta,
          banned: false,
          bannedAt: null,
          banReason: '',
        })
        await note('unban', { email })
        return res.status(200).json({ ok: true, message: '已解封', meta: nextMeta, email })
      }

      if (action === 'add_usage_test') {
        const usage = await addUsage(accountId, {
          promptTokens: Number(body.promptTokens) || 0,
          completionTokens: Number(body.completionTokens) || 0,
          totalTokens: Number(body.totalTokens) || 0,
          model: body.model || 'admin-test',
        })
        return res.status(200).json({ ok: true, usage })
      }

      return res.status(400).json({ error: 'unknown_action', message: '未知操作' })
    }

    return res.status(405).json({ error: 'method_not_allowed' })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ error: 'server_error', message: String(e?.message || e) })
  }
}
