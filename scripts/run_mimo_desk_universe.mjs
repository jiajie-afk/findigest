/**
 * Run the local value desk across ~1000 names, then ask MiMo Token Plan
 * for short research notes only (numbers stay engine-owned).
 *
 * Usage:
 *   $env:MIMO_API_KEY="tp-..."
 *   node scripts/run_mimo_desk_universe.mjs
 *   node scripts/run_mimo_desk_universe.mjs --limit 2
 *   node scripts/run_mimo_desk_universe.mjs --limit 6000 --tag 6k
 *   node scripts/run_mimo_desk_universe.mjs --engine-only
 *   node scripts/run_mimo_desk_universe.mjs --resume
 *
 * Env: MIMO_API_KEY (required unless --engine-only)
 *      MIMO_BASE_URL  default https://token-plan-cn.xiaomimimo.com/v1
 *      MIMO_MODEL     default mimo-v2.5 (cheaper credits than pro)
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { STOCK_FINANCIALS } from '../src/data/stock_financials.js'
import { CURRENT_PRICES } from '../src/data/current_prices.js'
import { STOCK_NAMES, getStockName } from '../src/data/stock_names.js'
import { VALUABLE_CODES } from '../src/data/valuableUniverse.js'
import { calculateValuation } from '../src/services/valuation.js'
import { sanitizeLlmBriefing } from '../src/services/llmBriefingGuard.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const OUT_DIR = path.join(ROOT, 'scripts', '.desk-run')
const KEY_FILE = path.join(OUT_DIR, '.mimo_key')
const CLUSTERS = [
  'https://token-plan-cn.xiaomimimo.com/v1',
  'https://token-plan-sgp.xiaomimimo.com/v1',
  'https://token-plan-ams.xiaomimimo.com/v1',
]

const SYSTEM = `研究台核对。禁止荐股/目标价/BUY/SELL/持有指令。禁止改数字。只输出JSON数组无markdown。
每项:{c,f,n,g} c=代码 f=GW|CN|FA|HD n=≤32字中文 g=0-2个:halt|cc|hard|mos
GW好生意等折扣 CN便宜无护城河 FA大致公允 HD难估。n只解释已给字段。`

function readApiKey() {
  if (process.env.MIMO_API_KEY) return process.env.MIMO_API_KEY.trim()
  if (fs.existsSync(KEY_FILE)) return fs.readFileSync(KEY_FILE, 'utf8').trim()
  const envPath = path.join(ROOT, '.env')
  if (fs.existsSync(envPath)) {
    const line = fs.readFileSync(envPath, 'utf8').split(/\r?\n/).find((l) => /^MIMO_API_KEY=/.test(l))
    if (line) return line.replace(/^MIMO_API_KEY=/, '').replace(/^["']|["']$/g, '').trim()
  }
  return ''
}

function arg(name, fallback) {
  const i = process.argv.indexOf(name)
  if (i < 0) return fallback
  const next = process.argv[i + 1]
  if (!next || next.startsWith('--')) return true
  return next
}

function round(v, d = 1) {
  if (v == null || !Number.isFinite(Number(v))) return null
  const p = 10 ** d
  return Math.round(Number(v) * p) / p
}

function localFork(v) {
  const d = v.desk || {}
  if (
    v.competence === 'hard' ||
    (d.mosNeed || 0) >= 90 ||
    v.valuability === 'search_only' ||
    d.recon?.halt
  ) {
    return 'HD'
  }
  if (d.fork === 'great_wait') return 'GW'
  if (d.fork === 'cheap_no_moat') return 'CN'
  return 'FA'
}

function compactCard(row) {
  return {
    c: row.code,
    n: row.name,
    a: row.archetype,
    q: row.quality,
    px: row.price,
    iv: row.ivModel,
    mos: row.mosModel,
    nd: row.mosNeed,
    pe: row.pe,
    roe: row.roe,
    cc: row.cc,
    h: row.halt ? 1 : 0,
    v: row.valuability,
    k: row.competence,
    f: row.forkEngine,
    $: row.dollar,
  }
}

let BOOKS = { ...STOCK_FINANCIALS }
const NAME_MAP = { ...STOCK_NAMES }

function loadBooks() {
  const overlay = path.join(OUT_DIR, 'financials-6k.json')
  if (fs.existsSync(overlay)) {
    BOOKS = JSON.parse(fs.readFileSync(overlay, 'utf8')) || BOOKS
  }
  const uniPath = path.join(ROOT, 'public', 'data', 'universe.json')
  let universe = []
  if (fs.existsSync(uniPath)) {
    universe = JSON.parse(fs.readFileSync(uniPath, 'utf8')) || []
    for (const row of universe) {
      if (row?.code && row?.name) NAME_MAP[String(row.code)] = row.name
    }
  }
  return universe
}

function nameOf(code) {
  return NAME_MAP[code] || getStockName(code) || STOCK_NAMES[code] || code
}

function pickUniverse(limit, universe = []) {
  const seen = new Set()
  const codes = []
  const push = (code) => {
    const c = String(code)
    if (!c || seen.has(c) || !BOOKS[c]) return
    seen.add(c)
    codes.push(c)
  }
  push('600519')
  for (const c of VALUABLE_CODES) push(c)
  for (const row of universe) {
    if (codes.length >= limit) break
    push(row.code)
  }
  if (codes.length < limit) {
    const extras = Object.keys(BOOKS)
      .filter((c) => !seen.has(c))
      .sort((a, b) => {
        const fa = BOOKS[a] || {}
        const fb = BOOKS[b] || {}
        const sa = (fa.ocf ? 2 : 0) + (fa.fcf ? 1 : 0) + (fa.roe > 0 ? 1 : 0)
        const sb = (fb.ocf ? 2 : 0) + (fb.fcf ? 1 : 0) + (fb.roe > 0 ? 1 : 0)
        return sb - sa || a.localeCompare(b)
      })
    for (const c of extras) {
      if (codes.length >= limit) break
      push(c)
    }
  }
  return codes.slice(0, limit)
}
function runEngine(code) {
  const base = BOOKS[code]
  if (!base) return null
  const name = nameOf(code)
  const fin = {
    ...base,
    price: base.price > 0 ? base.price : CURRENT_PRICES[code],
  }
  let v
  try {
    v = calculateValuation(fin, code, name)
  } catch (err) {
    return {
      code,
      name,
      error: String(err?.message || err).slice(0, 160),
      forkEngine: 'HD',
    }
  }
  const d = v.desk || {}
  return {
    code,
    name,
    industry: v.industry,
    archetype: v.archetype,
    quality: v.quality,
    price: round(v.price, 2),
    ivModel: round(v.ivModel, 2),
    mosModel: d.mosModel ?? v.mosModel ?? v.marginOfSafety,
    mosNeed: d.mosNeed ?? v.mosBuyMin,
    mosVsBear: d.mosVsBear ?? v.mosVsBear,
    pe: round(v.pe, 1),
    roe: round(fin.roe, 1),
    cc: d.oe?.cashConversion ?? null,
    halt: !!d.recon?.halt,
    recon: d.recon?.summary || null,
    valuability: v.valuability,
    competence: v.competence,
    forkEngine: localFork(v),
    dollar: d.dollar?.status || null,
    graham: d.graham?.applicable ? d.graham.score : null,
    posture: (d.posture || v.actionHint || '').slice(0, 80),
  }
}

function parseJsonArray(text) {
  if (!text) return null
  let s = String(text).trim()
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence) s = fence[1].trim()
  const start = s.indexOf('[')
  const end = s.lastIndexOf(']')
  if (start < 0 || end <= start) return null
  try {
    const arr = JSON.parse(s.slice(start, end + 1))
    return Array.isArray(arr) ? arr : null
  } catch {
    return null
  }
}

function applyNotes(rows, notes) {
  const by = new Map()
  for (const n of notes || []) {
    const c = String(n.c || n.code || '')
    if (!c) continue
    const f = String(n.f || '').toUpperCase()
    const fork = ['GW', 'CN', 'FA', 'HD'].includes(f) ? f : null
    const flags = Array.isArray(n.g)
      ? n.g.map(String).slice(0, 2)
      : n.g
        ? [String(n.g)]
        : []
    by.set(c, {
      forkLlm: fork,
      oneLine: sanitizeLlmBriefing(String(n.n || '').slice(0, 48)),
      flags,
    })
  }
  for (const row of rows) {
    const hit = by.get(row.code)
    if (!hit) continue
    row.forkLlm = hit.forkLlm
    row.oneLine = hit.oneLine
    row.flags = hit.flags
  }
}

async function mimoChat({ baseUrl, apiKey, model, messages, maxTokens, skipThinking, noThinking }) {
  const body = {
    model,
    messages,
    temperature: 0,
    max_completion_tokens: maxTokens,
  }
  if (!skipThinking && !noThinking) body.thinking = { type: 'disabled' }
  const headers = {
    'Content-Type': 'application/json',
    'api-key': apiKey,
    Authorization: `Bearer ${apiKey}`,
  }
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 120000)
  let res
  try {
    res = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: ctrl.signal,
    })
  } finally {
    clearTimeout(timer)
  }
  const raw = await res.text()
  let json = null
  try {
    json = JSON.parse(raw)
  } catch {
    json = { raw: raw.slice(0, 400) }
  }
  return { ok: res.ok, status: res.status, json, raw }
}

function contentOf(json) {
  const msg = json?.choices?.[0]?.message
  return msg?.content || msg?.reasoning_content || ''
}

function usageOf(json) {
  const u = json?.usage || {}
  return {
    prompt: Number(u.prompt_tokens || u.input_tokens || 0),
    completion: Number(u.completion_tokens || u.output_tokens || 0),
    total: Number(u.total_tokens || 0),
  }
}

async function ping(apiKey, model) {
  const envBase = process.env.MIMO_BASE_URL
  const bases = envBase ? [envBase, ...CLUSTERS.filter((x) => x !== envBase)] : CLUSTERS
  let last = null
  for (const baseUrl of bases) {
    const r = await mimoChat({
      baseUrl,
      apiKey,
      model,
      maxTokens: 24,
      messages: [
        { role: 'system', content: 'reply with the single word pong' },
        { role: 'user', content: 'ping' },
      ],
    })
    last = { ...r, baseUrl }
    if (r.ok) return { baseUrl, json: r.json }
    if (r.status === 400 && /thinking/i.test(JSON.stringify(r.json))) {
      const retry = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': apiKey,
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: 'reply with the single word pong' },
            { role: 'user', content: 'ping' },
          ],
          temperature: 0,
          max_completion_tokens: 24,
        }),
      })
      const json = JSON.parse(await retry.text())
      if (retry.ok) return { baseUrl, json, noThinking: true }
    }
    console.warn(`ping ${baseUrl} → ${r.status} ${JSON.stringify(r.json).slice(0, 180)}`)
  }
  throw new Error(`Token Plan ping failed (${last?.status}): ${JSON.stringify(last?.json).slice(0, 240)}`)
}

async function annotateBatch({ baseUrl, apiKey, model, noThinking, rows }) {
  const payload = rows.map(compactCard)
  const messages = [
    { role: 'system', content: SYSTEM },
    { role: 'user', content: JSON.stringify(payload) },
  ]
  const maxTokens = Math.min(8000, 200 + rows.length * 55)
  const body = {
    model,
    messages,
    temperature: 0,
    max_completion_tokens: maxTokens,
  }
  if (!noThinking) body.thinking = { type: 'disabled' }

  const send = () =>
    mimoChat({
      baseUrl,
      apiKey,
      model,
      maxTokens,
      messages,
      ...(noThinking ? { skipThinking: true } : {}),
    })

  let r = await send()
  if (!r.ok && r.status === 429) {
    await sleep(2500)
    r = await send()
  }
  if (!r.ok) {
    throw new Error(`batch ${r.status}: ${JSON.stringify(r.json).slice(0, 280)}`)
  }
  let notes = parseJsonArray(contentOf(r.json))
  if (!notes) {
    const retry = await mimoChat({
      baseUrl,
      apiKey,
      model,
      maxTokens,
      messages: [
        ...messages,
        { role: 'assistant', content: contentOf(r.json).slice(0, 200) },
        { role: 'user', content: '只输出JSON数组' },
      ],
      skipThinking: noThinking,
    })
    notes = parseJsonArray(contentOf(retry.json)) || []
    if (notes.length < Math.ceil(rows.length * 0.85)) {
      throw new Error(`short batch notes ${notes.length}/${rows.length}`)
    }
    return { notes, usage: addUsage(usageOf(r.json), usageOf(retry.json)) }
  }
  if (notes.length < Math.ceil(rows.length * 0.85)) {
    throw new Error(`short batch notes ${notes.length}/${rows.length}`)
  }
  return { notes, usage: usageOf(r.json) }
}

function addUsage(a, b) {
  return {
    prompt: (a.prompt || 0) + (b.prompt || 0),
    completion: (a.completion || 0) + (b.completion || 0),
    total: (a.total || 0) + (b.total || 0),
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

function summarize(rows, extra = {}) {
  const counts = { GW: 0, CN: 0, FA: 0, HD: 0, halt: 0, err: 0, llm: 0 }
  let mosCovered = 0
  let mosGap = 0
  for (const r of rows) {
    if (r.error) counts.err++
    const f = r.forkLlm || r.forkEngine
    if (counts[f] != null) counts[f]++
    if (r.halt) counts.halt++
    if (r.oneLine) counts.llm++
    if (r.mosModel != null && r.mosNeed > 0 && r.mosNeed < 90) {
      mosCovered++
      if (r.mosModel >= r.mosNeed) mosGap++
    }
  }
  return {
    n: rows.length,
    counts,
    mosCovered,
    mosMeetsNeed: mosGap,
    ...extra,
  }
}

function writeOutputs(rows, summary, tag = '1k') {
  fs.mkdirSync(OUT_DIR, { recursive: true })
  const jsonPath = path.join(OUT_DIR, `desk-${tag}.json`)
  const jsonlPath = path.join(OUT_DIR, `desk-${tag}.jsonl`)
  const sumPath = path.join(OUT_DIR, tag === '1k' ? 'summary.json' : `summary-${tag}.json`)
  fs.writeFileSync(jsonPath, JSON.stringify({ summary, rows }))
  fs.writeFileSync(jsonlPath, rows.map((r) => JSON.stringify(r)).join('\n') + '\n')
  fs.writeFileSync(sumPath, JSON.stringify(summary, null, 2))
  return { jsonPath, jsonlPath, sumPath }
}

function wantsLlm(row) {
  if (row.error) return false
  if (row.valuability === 'search_only' && !(row.price > 0)) return false
  return true
}

async function mapPool(items, n, fn) {
  const workers = Math.max(1, n)
  let i = 0
  async function worker() {
    while (true) {
      const idx = i++
      if (idx >= items.length) return
      await fn(items[idx], idx)
    }
  }
  await Promise.all(Array.from({ length: workers }, worker))
}

async function main() {
  const limit = Math.max(1, Number(arg('--limit', 1000)) || 1000)
  const batchSize = Math.max(4, Number(arg('--batch', 40)) || 40)
  const concurrency = Math.max(1, Number(arg('--concurrency', limit >= 4000 ? 2 : 1)) || 1)
  const engineOnly = !!arg('--engine-only', false)
  const resume = !!arg('--resume', false)
  const mergeNotes = !!arg('--merge-notes', false)
  const tag = String(arg('--tag', limit >= 4000 ? '6k' : '1k'))
  const model = process.env.MIMO_MODEL || 'mimo-v2.5'
  const apiKey = readApiKey()

  fs.mkdirSync(OUT_DIR, { recursive: true })
  const universe = loadBooks()
  const codes = pickUniverse(limit, universe)
  console.log(`universe ${codes.length} books ${Object.keys(BOOKS).length} · first ${codes[0]} ${nameOf(codes[0])}`)

  const t0 = Date.now()
  const rows = []
  for (const code of codes) {
    const row = runEngine(code)
    if (row) rows.push(row)
  }
  console.log(`engine ${rows.length} in ${Date.now() - t0}ms`)

  let done = new Set()
  const notePath = path.join(OUT_DIR, tag === '1k' ? 'notes.jsonl' : `notes-${tag}.jsonl`)
  if ((resume || mergeNotes) && fs.existsSync(notePath)) {
    for (const line of fs.readFileSync(notePath, 'utf8').split('\n')) {
      if (!line.trim()) continue
      try {
        const n = JSON.parse(line)
        applyNotes(rows, [n])
        done.add(String(n.c || n.code))
      } catch {
        /* skip */
      }
    }
    console.log(`resume notes ${done.size}`)
  }

  const fillPosture = () => {
    for (const row of rows) {
      if (!row.oneLine && row.posture) {
        row.oneLine = String(row.posture).slice(0, 40)
        row.flags = row.flags || ['no_llm']
      }
    }
  }

  const engineSummary = summarize(rows, { phase: 'engine', model, tag, engineMs: Date.now() - t0 })
  fs.writeFileSync(path.join(OUT_DIR, `engine-snapshot-${tag}.json`), JSON.stringify(engineSummary, null, 2))

  if (engineOnly || mergeNotes) {
    fillPosture()
    const summary = summarize(rows, {
      phase: mergeNotes ? 'merged' : 'engine',
      model,
      tag,
      engineMs: Date.now() - t0,
      note: '研究台普查，不是买入清单。MoS达标含大量周期/数据异常，不可当选股。',
    })
    writeOutputs(rows, summary, tag)
    console.log(JSON.stringify(summary, null, 2))
    return
  }
  if (!apiKey) {
    throw new Error('MIMO_API_KEY missing. Re-run with the key in env, or pass --engine-only.')
  }

  const pinged = await ping(apiKey, model)
  const baseUrl = pinged.baseUrl
  const noThinking = !!pinged.noThinking
  console.log(`mimo ok ${baseUrl} model=${model} thinking=${noThinking ? 'off-fallback' : 'disabled'}`)

  const pending = rows.filter((r) => !done.has(r.code) && wantsLlm(r))
  console.log(`llm pending ${pending.length}/${rows.length} concurrency ${concurrency}`)
  let usage = { prompt: 0, completion: 0, total: 0 }
  let requests = 0
  const noteFd = fs.openSync(notePath, resume ? 'a' : 'w')
  let gate = Promise.resolve()
  const locked = (fn) => {
    const run = gate.then(fn, fn)
    gate = run.catch(() => {})
    return run
  }
  const batches = []
  for (let i = 0; i < pending.length; i += batchSize) {
    batches.push(pending.slice(i, i + batchSize))
  }
  try {
    await mapPool(batches, concurrency, async (slice, idx) => {
      console.log(`llm batch ${idx + 1}/${batches.length} n=${slice.length}`)
      let attempt = 0
      while (true) {
        try {
          const { notes, usage: u } = await annotateBatch({
            baseUrl,
            apiKey,
            model,
            noThinking,
            rows: slice,
          })
          await locked(() => {
            usage = addUsage(usage, u)
            requests++
            applyNotes(slice, notes)
            for (const n of notes) fs.writeSync(noteFd, JSON.stringify(n) + '\n')
            writeOutputs(rows, summarize(rows, { phase: 'llm', model, baseUrl, usage, requests, tag }), tag)
            console.log(`llm req ${requests}/${batches.length} tok ${usage.total}`)
          })
          break
        } catch (err) {
          attempt++
          if (attempt >= 4) {
            console.warn(`batch ${idx + 1} failed: ${err.message}`)
            break
          }
          const wait = 800 * 2 ** attempt
          console.warn(`retry ${attempt} in ${wait}ms: ${err.message}`)
          await sleep(wait)
        }
      }
    })
  } finally {
    await gate
    fs.closeSync(noteFd)
  }

  fillPosture()
  const summary = summarize(rows, {
    phase: 'done',
    model,
    baseUrl,
    usage,
    requests,
    tag,
    elapsedMs: Date.now() - t0,
    out: 'scripts/.desk-run/',
  })
  const paths = writeOutputs(rows, summary, tag)
  console.log(JSON.stringify(summary, null, 2))
  console.log(`wrote ${paths.jsonPath}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
