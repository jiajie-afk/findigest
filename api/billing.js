/**
 * Soft billing API — optional when Blob configured.
 * Without token returns 503 so client uses local demo codes.
 *
 * Auth: fd_sess cookie MUST match accountId (no emailProof IDOR on accountId).
 * Demo seed codes only when BILLING_ALLOW_DEMO_SEEDS=1.
 * Redeem uses Upstash lock when available to blunt double-spend races.
 */
import { createHash } from 'node:crypto'
import {
  checkRateLimitAsync,
  getClientIp,
  rateLimitResponse,
  tryAcquireLock,
} from '../lib/rateLimit.js'
import { applyStrictCors } from '../lib/apiAuth.js'
import { putPrivateJson, readPrivateJson } from '../lib/secureBlob.js'
import { readSessionFromRequest } from '../lib/vaultSession.js'

export const config = { runtime: 'nodejs', maxDuration: 15 }

function hashCode(code) {
  return createHash('sha256')
    .update(String(code || '').trim().toUpperCase().replace(/\s+/g, ''))
    .digest('hex')
}

function codePath(hash) {
  return `findigest-billing/codes/${hash}.json`
}
function entPath(accountId) {
  return `findigest-billing/entitlements/${String(accountId)}.json`
}

function seedMap() {
  if (String(process.env.BILLING_ALLOW_DEMO_SEEDS || '') !== '1') return {}
  return {
    'FINDIGEST-PRO-DEMO': 365,
    'FINDIGEST-PRO-30D': 30,
    'FINDIGEST-PRO-YEAR': 365,
  }
}

function authorizeBilling(req, accountId) {
  const sess = readSessionFromRequest(req)
  if (!sess?.accountId) {
    return {
      ok: false,
      status: 401,
      error: 'unauthorized',
      message: '请先登录后再操作会员',
    }
  }
  if (sess.accountId !== accountId) {
    return {
      ok: false,
      status: 403,
      error: 'session_mismatch',
      message: '会话与账号不匹配',
    }
  }
  return { ok: true, via: 'session', session: sess }
}

export default async function handler(req, res) {
  applyStrictCors(req, res)
  if (req.method === 'OPTIONS') return res.status(204).end()

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return res.status(503).json({ error: 'cloud_unconfigured', message: '计费云端未配置' })
  }

  try {
    if (req.method === 'GET') {
      const accountId = String(req.query.accountId || '').trim()
      if (!accountId) return res.status(400).json({ error: 'account_required' })
      const authz = authorizeBilling(req, accountId)
      if (!authz.ok) {
        return res.status(authz.status).json({ error: authz.error, message: authz.message })
      }
      const ent = (await readPrivateJson(entPath(accountId))) || { plan: 'free', proUntil: null }
      return res.status(200).json(ent)
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}
      if (body.action !== 'redeem') return res.status(400).json({ error: 'unknown_action' })

      const ip = getClientIp(req)
      const rl = await checkRateLimitAsync(`billing:redeem:${ip}`, {
        limit: 12,
        windowMs: 15 * 60_000,
      })
      if (!rl.ok) {
        return rateLimitResponse(res, rl.retryAfterSec, '兑换尝试过于频繁，请稍后再试')
      }

      const accountId = String(body.accountId || '').trim()
      const code = String(body.code || '')
        .trim()
        .toUpperCase()
        .replace(/\s+/g, '')
      if (!accountId || !code) {
        return res.status(400).json({ error: 'invalid_body', message: '缺少账号或兑换码' })
      }

      const authz = authorizeBilling(req, accountId)
      if (!authz.ok) {
        return res.status(authz.status).json({ error: authz.error, message: authz.message })
      }

      const h = hashCode(code)
      const lock = await tryAcquireLock(`billing:redeem:${h}`, accountId, 45)
      if (!lock.ok) {
        return res.status(409).json({
          error: 'redeem_in_progress',
          message: '兑换处理中，请稍后再试',
        })
      }

      let record = await readPrivateJson(codePath(h))
      if (!record) {
        const seeds = seedMap()
        if (Object.prototype.hasOwnProperty.call(seeds, code)) {
          record = { status: 'unused', days: seeds[code], createdAt: Date.now() }
        }
      }
      if (!record) return res.status(400).json({ error: 'invalid', message: '兑换码无效' })
      if (record.status === 'redeemed') {
        if (record.redeemedBy === accountId) {
          const ent = (await readPrivateJson(entPath(accountId))) || {
            plan: 'pro',
            proUntil: record.proUntil ?? null,
          }
          return res.status(200).json({ ok: true, ...ent, message: 'Pro 已开通', idempotent: true })
        }
        return res.status(400).json({ error: 'used', message: '兑换码已被使用' })
      }

      // Claim first — reduces double-redeem window under concurrency
      const now = Date.now()
      const claim = {
        ...record,
        status: 'redeemed',
        redeemedBy: accountId,
        redeemedAt: now,
        claimStartedAt: now,
      }
      await putPrivateJson(codePath(h), claim)

      const claimed = await readPrivateJson(codePath(h))
      if (!claimed || claimed.redeemedBy !== accountId) {
        return res.status(409).json({
          error: 'redeem_conflict',
          message: '兑换冲突，请重试或更换兑换码',
        })
      }

      const existing = (await readPrivateJson(entPath(accountId))) || { plan: 'free', proUntil: null }
      let base = now
      if (existing.plan === 'pro' && existing.proUntil && Number(existing.proUntil) > now) {
        base = Number(existing.proUntil)
      }
      const next = {
        plan: 'pro',
        proUntil: record.days == null ? null : base + record.days * 86400000,
        updatedAt: now,
        accountId,
      }
      await putPrivateJson(entPath(accountId), next)
      await putPrivateJson(codePath(h), {
        ...claim,
        proUntil: next.proUntil,
      })
      return res.status(200).json({ ok: true, ...next, message: 'Pro 已开通' })
    }

    return res.status(405).json({ error: 'method_not_allowed' })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ error: 'server_error', message: String(e?.message || e) })
  }
}
