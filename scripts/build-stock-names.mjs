/**
 * Fetch Eastmoney names for all STOCK_FINANCIALS codes → src/data/stock_names.js
 * Also merges scripts/calibrate_names.json (valid UTF-8 entries only).
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { STOCK_FINANCIALS } from '../src/data/stock_financials.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outPath = path.join(__dirname, '../src/data/stock_names.js')
const calPath = path.join(__dirname, 'calibrate_names.json')

function secidsFor(code) {
  const c = String(code)
  if (c.length <= 5) {
    const p = c.padStart(5, '0')
    return [`116.${p}`, `128.${p}`]
  }
  // STAR 科创板 688/689/301 are Shanghai (1.), not Shenzhen (0.)
  if (c.startsWith('688') || c.startsWith('689') || c.startsWith('301')) return [`1.${c}`]
  if (c.startsWith('6') || c.startsWith('9')) return [`1.${c}`]
  if (c.startsWith('0') || c.startsWith('3')) return [`0.${c}`, `1.${c}`]
  return [`1.${c}`, `0.${c}`]
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function fetchSecids(secids) {
  const em = `https://push2.eastmoney.com/api/qt/ulist.np/get?fltt=2&fields=f12,f14,f13&secids=${secids.join(',')}`
  const url = `http://127.0.0.1:5173/api/proxy?url=${encodeURIComponent(em)}`
  const r = await fetch(url)
  const j = await r.json()
  return j?.data?.diff || []
}

const names = {}
try {
  const { STOCK_NAMES: prev } = await import('../src/data/stock_names.js')
  Object.assign(names, prev || {})
} catch {
  /* first run */
}

try {
  const cal = JSON.parse(fs.readFileSync(calPath, 'utf8'))
  for (const [k, v] of Object.entries(cal)) {
    if (v && !/\uFFFD|�/.test(String(v))) names[k] = String(v).replace(/\s+/g, '')
  }
} catch {
  /* optional */
}

const codes = Object.keys(STOCK_FINANCIALS)
const missing = codes.filter((c) => !names[c])
console.log('have', Object.keys(names).length, 'missing', missing.length)

const chunk = 40
for (let i = 0; i < missing.length; i += chunk) {
  const part = missing.slice(i, i + chunk)
  try {
    const diff = await fetchSecids(part.map((c) => secidsFor(c)[0]))
    for (const row of diff) {
      if (row.f12 && row.f14) names[String(row.f12)] = String(row.f14).replace(/\s+/g, '')
    }
  } catch {
    /* continue */
  }
  const still = part.filter((c) => !names[c])
  if (still.length) {
    try {
      const diff = await fetchSecids(still.map((c) => secidsFor(c)[1] || secidsFor(c)[0]))
      for (const row of diff) {
        if (row.f12 && row.f14) names[String(row.f12)] = String(row.f14).replace(/\s+/g, '')
      }
    } catch {
      /* continue */
    }
  }
  process.stdout.write(`\rretry ${Math.min(i + chunk, missing.length)}/${missing.length} names=${Object.keys(names).length}`)
  await sleep(50)
}

const left = codes.filter((c) => !names[c])
console.log(`\nfinal names ${Object.keys(names).length} still missing ${left.length}`)
if (left.length) console.log('sample left', left.slice(0, 20).join(','))

const body = `/** Auto-generated code → name map for industry/valuation. Do not edit by hand. */
export const STOCK_NAMES = ${JSON.stringify(names)}

export function getStockName(code) {
  return STOCK_NAMES[String(code || '')] || ''
}
`
fs.writeFileSync(outPath, body, 'utf8')
console.log('wrote', outPath)
