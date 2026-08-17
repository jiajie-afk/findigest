/**
 * One-shot repair: fix STOCK_FINANCIALS EPS corrupted by quarterly overwrite.
 * Rule: if |stored EPS / PE-implied| outside [0.5, 1.5], replace with
 * consensus FY1 (when close to PE-implied) else PE-implied TTM.
 *
 * Usage: node scripts/fix_eps.mjs
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dataDir = path.join(__dirname, '..', 'src', 'data')

function readExport(file, varName) {
  const content = fs.readFileSync(path.join(dataDir, file), 'utf8')
  const m = content.match(new RegExp(`export const ${varName} = (\\{[\\s\\S]*?\\});`))
  if (!m) throw new Error(`Cannot parse ${varName} from ${file}`)
  return JSON.parse(m[1])
}

function writeExport(file, varName, data) {
  const json = JSON.stringify(data)
  fs.writeFileSync(path.join(dataDir, file), `export const ${varName} = ${json};\n`, 'utf8')
}

const fin = readExport('stock_financials.js', 'STOCK_FINANCIALS')
let consensus = {}
try {
  consensus = readExport('consensus_data.js', 'CONSENSUS_DATA')
} catch {
  consensus = {}
}

let fixed = 0
let ok = 0
let skipped = 0
const samples = []

for (const [code, row] of Object.entries(fin)) {
  const price = +(row.price || 0)
  const pe = +(row.pe_ttm || 0)
  const stored = +(row.eps || 0)
  if (!(price > 0 && pe > 0)) {
    skipped++
    continue
  }
  const peImplied = price / pe
  const ratio = stored > 0 ? stored / peImplied : 0
  if (ratio >= 0.5 && ratio <= 1.5) {
    row.epsQuality = 'ok'
    ok++
    continue
  }

  const fy1 = consensus[code]?.fy1 > 0 ? +consensus[code].fy1 : null
  row.epsReported = stored || 0
  if (fy1 != null && Math.abs(fy1 - peImplied) / peImplied <= 0.35) {
    row.eps = Math.round(fy1 * 10000) / 10000
    row.epsSource = 'consensus_fy1'
  } else {
    row.eps = Math.round(peImplied * 10000) / 10000
    row.epsSource = 'pe_implied'
  }
  row.epsQuality = 'corrected'
  fixed++
  if (samples.length < 8) {
    samples.push({
      code,
      from: stored,
      to: row.eps,
      peImplied: +peImplied.toFixed(2),
      source: row.epsSource,
    })
  }
}

writeExport('stock_financials.js', 'STOCK_FINANCIALS', fin)
console.log(JSON.stringify({ fixed, ok, skipped, samples }, null, 2))
console.log('Wrote src/data/stock_financials.js')
