/**
 * Local desktop holdings pickup. Vite/localhost only.
 * POST {} → scan clipboard / trade window / recent CSV
 */
import { runDesktopHoldingsScan, pickHoldingsText } from '../lib/localHoldings.js'
import { parseHoldingsText } from '../src/services/holdingsImport.js'

export const config = { runtime: 'nodejs', maxDuration: 20 }

function isLocal(req) {
  const host = String(req?.headers?.host || '')
  return host.includes('127.0.0.1') || host.includes('localhost')
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'method_not_allowed' })
  }
  if (!isLocal(req)) {
    return res.status(403).json({
      error: 'local_only',
      message: '电脑端同步只能在本机 Vite 开发环境使用',
    })
  }

  try {
    const body = req.body || {}
    const launch = body.launch === true
    const copyWindow = body.copyWindow === true
    const scan = await runDesktopHoldingsScan({ launch, copyWindow })
    const picked = pickHoldingsText(scan)
    if (!picked.text) {
      return res.status(200).json({
        ok: false,
        launched: !!scan.launched,
        tradeRunning: !!scan.tradeRunning,
        processName: scan.processName || '',
        notes: picked.notes,
        rows: [],
        warnings: picked.notes,
      })
    }
    const parsed = parseHoldingsText(picked.text, 'generic')
    return res.status(200).json({
      ok: parsed.rows.length > 0,
      source: picked.source,
      launched: !!scan.launched,
      tradeRunning: !!scan.tradeRunning,
      processName: scan.processName || '',
      notes: picked.notes,
      rows: parsed.rows,
      warnings: parsed.warnings,
    })
  } catch (e) {
    console.error('[api/holdings-local]', e)
    return res.status(500).json({
      error: 'scan_failed',
      message: String(e?.message || e),
    })
  }
}
