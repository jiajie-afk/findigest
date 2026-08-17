/**
 * Allowlisted upstream proxy for Eastmoney / Sina (etc).
 * GET /api/proxy?url=<encoded https URL>
 */
import { handleProxyHttp } from '../lib/proxyCore.js'

export const config = { runtime: 'nodejs', maxDuration: 15 }

export default async function handler(req, res) {
  await handleProxyHttp(req, res, {
    method: req.method,
    url: req.url,
    query: req.query,
  })
}
