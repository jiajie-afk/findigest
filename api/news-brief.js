/**
 * POST /api/news-brief — 要闻 AI 摘要（服务端模型，不要求用户填写 API Key）。
 */
import { applyStrictCors } from '../lib/apiAuth.js'
import { checkRateLimitAsync, getClientIp, rateLimitResponse } from '../lib/rateLimit.js'
import { readSessionFromRequest } from '../lib/vaultSession.js'
import { addUsage, isAccountBanned } from '../lib/accountAdmin.js'
import { localNewsBrief } from '../lib/newsBriefCore.js'
import { callNewsLlm, resolveNewsLlmConfig } from '../lib/newsBriefLlm.js'

export const config = { runtime: 'nodejs', maxDuration: 30 }

function isProd() {
  return !!(process.env.VERCEL || process.env.NODE_ENV === 'production')
}

function readItem(body) {
  const related = Array.isArray(body?.related)
    ? body.related.slice(0, 6).map((h) => ({
        name: String(h?.name || h?.code || '').slice(0, 40),
        strength: h?.strength === 'strong' ? 'strong' : 'weak',
      }))
    : []
  return {
    id: String(body?.id || '').slice(0, 180),
    title: String(body?.title || '').slice(0, 240),
    description: String(body?.description || '').slice(0, 800),
    event_date: String(body?.event_date || '').slice(0, 10),
    source_url: String(body?.source_url || '').slice(0, 400),
    channel: String(body?.channel || body?.lane || '').slice(0, 40),
    related,
  }
}

export default async function handler(req, res) {
  applyStrictCors(req, res)
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method_not_allowed', message: '仅支持 POST' })
  }

  const ip = getClientIp(req)
  const rl = await checkRateLimitAsync(`news-brief:${ip}`, { limit: 12, windowMs: 10 * 60_000 })
  if (!rl.ok) return rateLimitResponse(res, rl.retryAfterSec, '摘要过于频繁，请稍后再试')

  let body = req.body || {}
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body || '{}')
    } catch {
      return res.status(400).json({ error: 'bad_json', message: '请求格式不对' })
    }
  }
  const item = readItem(body)
  if (!item.title) {
    return res.status(400).json({ error: 'empty', message: '没有可摘要的标题' })
  }

  const sess = readSessionFromRequest(req)
  try {
    if (sess?.email && (await isAccountBanned(sess.email))) {
      return res.status(403).json({ error: 'banned', message: '账号已封禁' })
    }
  } catch {
    /* blob 未配置时放行 */
  }

  const cfg = resolveNewsLlmConfig()
  const allowLlm = !!(cfg && (!isProd() || sess?.accountId))

  if (allowLlm) {
    try {
      const { brief, usage, model } = await callNewsLlm(item, cfg)
      if (sess?.accountId && process.env.BLOB_READ_WRITE_TOKEN) {
        addUsage(sess.accountId, {
          promptTokens: usage?.prompt_tokens,
          completionTokens: usage?.completion_tokens,
          totalTokens: usage?.total_tokens,
          model,
        }).catch(() => {})
      }
      return res.status(200).json({
        ok: true,
        source: 'llm',
        brief,
      })
    } catch (e) {
      console.error('[api/news-brief]', e?.message || e)
      const local = localNewsBrief(item)
      return res.status(200).json({
        ok: true,
        source: 'local',
        warning: '模型暂时不可用，已改成本地速读',
        brief: local,
      })
    }
  }

  return res.status(200).json({
    ok: true,
    source: 'local',
    brief: localNewsBrief(item),
  })
}
