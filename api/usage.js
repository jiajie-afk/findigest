/**
 * Client reports LLM token usage (session-auth). Aggregated for admin console.
 */
import { checkRateLimitAsync, getClientIp, rateLimitResponse } from '../lib/rateLimit.js'
import { applyStrictCors } from '../lib/apiAuth.js'
import { readSessionFromRequest } from '../lib/vaultSession.js'
import { addUsage, readUsage, isAccountBanned } from '../lib/accountAdmin.js'

export const config = { runtime: 'nodejs', maxDuration: 10 }

export default async function handler(req, res) {
  applyStrictCors(req, res)
  if (req.method === 'OPTIONS') return res.status(204).end()

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return res.status(503).json({ error: 'cloud_unconfigured' })
  }

  const sess = readSessionFromRequest(req)
  if (!sess?.accountId || !sess?.email) {
    return res.status(401).json({ error: 'unauthorized', message: '请先登录' })
  }

  if (await isAccountBanned(sess.email)) {
    return res.status(403).json({ error: 'banned', message: '账号已封禁' })
  }

  try {
    if (req.method === 'GET') {
      const usage = await readUsage(sess.accountId)
      return res.status(200).json(usage)
    }

    if (req.method === 'POST') {
      const ip = getClientIp(req)
      const rl = await checkRateLimitAsync(`usage:${sess.accountId}:${ip}`, {
        limit: 40,
        windowMs: 15 * 60_000,
      })
      if (!rl.ok) {
        return rateLimitResponse(res, rl.retryAfterSec, '上报过于频繁')
      }
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}
      const promptTokens = Math.min(200_000, Math.max(0, Number(body.promptTokens) || 0))
      const completionTokens = Math.min(100_000, Math.max(0, Number(body.completionTokens) || 0))
      let totalTokens = Math.min(300_000, Math.max(0, Number(body.totalTokens) || 0))
      if (!totalTokens) totalTokens = promptTokens + completionTokens
      if (!totalTokens && !promptTokens && !completionTokens) {
        return res.status(400).json({ error: 'empty', message: '无用量数据' })
      }
      const usage = await addUsage(sess.accountId, {
        promptTokens,
        completionTokens,
        totalTokens,
        model: String(body.model || '').slice(0, 80),
      })
      return res.status(200).json({ ok: true, usage })
    }

    return res.status(405).json({ error: 'method_not_allowed' })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ error: 'server_error', message: String(e?.message || e) })
  }
}
