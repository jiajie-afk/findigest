/**
 * Pull quote-level financials for public/data/universe.json (~6k).
 * Merges onto existing STOCK_FINANCIALS (keeps OCF/FCF/EPS corrections).
 * Writes scripts/.desk-run/financials-6k.json — not the app bundle.
 *
 * Usage: node scripts/fetch_universe_financials.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { STOCK_FINANCIALS } from '../src/data/stock_financials.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const OUT = path.join(ROOT, 'scripts', '.desk-run', 'financials-6k.json')
const UNI = path.join(ROOT, 'public', 'data', 'universe.json')

function n(v) {
  if (v == null || v === '-' || v === '') return 0
  const x = Number(v)
  return Number.isFinite(x) ? x : 0
}

function secid(code, market) {
  const c = String(code)
  if (market === 'HK' || c.length <= 5) return `116.${c.replace(/\D/g, '').padStart(5, '0')}`
  if (c.startsWith('6') || c.startsWith('9')) return `1.${c}`
  return `0.${c}`
}

function rowFrom(item) {
  const price = n(item.f43)
  const pe = n(item.f162)
  const pb = n(item.f167)
  const mv = n(item.f116)
  const revenue = n(item.f187)
  const profit = n(item.f188)
  return {
    price: price > 0 ? Math.round(price * 100) / 100 : 0,
    pe_ttm: Math.round(pe * 100) / 100,
    pb: Math.round(pb * 100) / 100,
    eps: pe > 0 && price > 0 ? Math.round((price / pe) * 10000) / 10000 : 0,
    bvps: pb > 0 && price > 0 ? Math.round((price / pb) * 10000) / 10000 : 0,
    roe: Math.round(n(item.f183) * 10) / 10,
    grossMargin: Math.round(n(item.f184) * 10) / 10,
    netMargin: Math.round(n(item.f185) * 10) / 10,
    debtRatio: Math.round(n(item.f186) * 10) / 10,
    revenueGrowth: Math.round(n(item.f191) * 10) / 10,
    profitGrowth: Math.round(n(item.f173) * 10) / 10,
    dividendYield: Math.round(n(item.f164) * 100) / 100,
    revenue: revenue ? Math.round((revenue / 1e8) * 10) / 10 : 0,
    profit: profit ? Math.round((profit / 1e8) * 10) / 10 : 0,
    total_mv: mv ? Math.round((mv / 1e8) * 10) / 10 : 0,
  }
}

function codeFrom(item, fallback) {
  const raw = String(item.f12 || item.f57 || fallback || '')
  const mkt = item.f13
  if (mkt === 116 || String(fallback || '').length <= 5) return raw.replace(/\D/g, '').padStart(5, '0')
  return raw.replace(/\D/g, '').padStart(6, '0') || fallback
}

function mergeFin(old, neu) {
  const livePx = neu?.price > 0 && neu.price < 10000 ? neu.price : 0
  const oldPx = old?.price > 0 && old.price < 10000 ? old.price : 0
  const price = livePx || oldPx
  if (!old) {
    if (!price) return { ...neu, price: 0 }
    return { ...neu, price }
  }
  return {
    ...neu,
    ...old,
    price,
    pe_ttm: neu.pe_ttm || old.pe_ttm,
    pb: neu.pb > 0 && neu.pb < 80 ? neu.pb : old.pb,
    roe: neu.roe || old.roe,
    total_mv: neu.total_mv || old.total_mv,
    eps: old.epsSource ? old.eps : neu.eps || old.eps,
    bvps: old.bvps > 0 && old.epsSource ? old.bvps : neu.bvps || old.bvps,
    ocf: old.ocf,
    capex: old.capex,
    fcf: old.fcf,
    fcfPerShare: old.fcfPerShare,
    ownerEarnings: old.ownerEarnings,
    epsSource: old.epsSource,
    epsQuality: old.epsQuality,
    epsReported: old.epsReported,
    grossMargin: old.grossMargin || neu.grossMargin,
    netMargin: old.netMargin || neu.netMargin,
    debtRatio: old.debtRatio || neu.debtRatio,
  }
}

function tencentSym(code, market) {
  const c = String(code)
  if (market === 'HK' || c.length <= 5) return `hk${c.replace(/\D/g, '').padStart(5, '0')}`
  if (c.startsWith('6') || c.startsWith('9')) return `sh${c}`
  return `sz${c}`
}

function rowFromTencent(fields) {
  const price = n(fields[3])
  const pe = n(fields[39])
  const mv = n(fields[45])
  const roe = n(fields[51])
  const pb = n(fields[58])
  const name = String(fields[1] || '').trim()
  return {
    price: price > 0 ? Math.round(price * 100) / 100 : 0,
    pe_ttm: Math.round(pe * 100) / 100,
    pb: Math.round(pb * 100) / 100,
    eps: pe > 0 && price > 0 ? Math.round((price / pe) * 10000) / 10000 : 0,
    bvps: pb > 0 && price > 0 ? Math.round((price / pb) * 10000) / 10000 : 0,
    roe: roe && roe > -50 && roe < 80 ? Math.round(roe * 10) / 10 : 0,
    grossMargin: 0,
    netMargin: 0,
    debtRatio: 0,
    revenueGrowth: 0,
    profitGrowth: 0,
    dividendYield: 0,
    revenue: 0,
    profit: 0,
    total_mv: mv ? Math.round(mv * 10) / 10 : 0,
    name,
  }
}

async function fetchTencent(rows) {
  const q = rows.map((r) => tencentSym(r.code, r.market)).join(',')
  const url = `https://qt.gtimg.cn/q=${q}`
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    signal: AbortSignal.timeout(20000),
  })
  if (!res.ok) throw new Error(`tencent HTTP ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())
  const raw = buf.toString('utf8')
  const out = {}
  for (const line of raw.split(';')) {
    if (!line.includes('="') || line.includes('pv_none')) continue
    const inner = line.split('="', 2)[1]?.replace(/";?\s*$/, '') || ''
    const fields = inner.split('~')
    if (fields.length < 59) continue
    const code = String(fields[2] || '')
    if (!code) continue
    const padded = code.length <= 5 ? code.padStart(5, '0') : code.padStart(6, '0')
    out[padded] = rowFromTencent(fields)
    out[code] = out[padded]
  }
  const mapped = {}
  for (const r of rows) {
    const hit = out[r.code] || out[String(r.code).replace(/^0+/, '')]
    if (hit) mapped[r.code] = hit
  }
  return mapped
}

async function fetchBatch(rows) {
  return fetchTencent(rows)
}

async function fetchEastmoney(rows) {
  const secids = rows.map((r) => secid(r.code, r.market)).join(',')
  const url =
    'https://push2.eastmoney.com/api/qt/ulist.np/get?fltt=2&invt=2&fields=' +
    'f12,f13,f57,f58,f43,f162,f163,f167,f116,f117,f183,f184,f185,f186,f187,f188,f164,f170,f173,f191' +
    `&secids=${secids}`
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0',
      Referer: 'https://quote.eastmoney.com',
    },
    signal: AbortSignal.timeout(25000),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const json = await res.json()
  const diff = json?.data?.diff || []
  const bySec = new Map()
  for (const item of diff) {
    const sid = `${item.f13}.${item.f12}`
    bySec.set(sid, item)
    bySec.set(String(item.f12), item)
    bySec.set(String(item.f57), item)
  }
  const out = {}
  for (const r of rows) {
    const sid = secid(r.code, r.market)
    const [mkt, raw] = sid.split('.')
    const item =
      bySec.get(`${Number(mkt)}.${raw}`) ||
      bySec.get(r.code) ||
      bySec.get(raw) ||
      bySec.get(String(Number(raw)))
    if (!item) continue
    const code = codeFrom(item, r.code)
    out[code] = rowFrom(item)
  }
  return out
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function main() {
  const universe = JSON.parse(fs.readFileSync(UNI, 'utf8'))
  if (!Array.isArray(universe)) throw new Error('universe.json must be an array')
  fs.mkdirSync(path.dirname(OUT), { recursive: true })

  const merged = { ...STOCK_FINANCIALS }
  const missing = universe
  console.log(`overlay ${Object.keys(merged).length} missing ${missing.length}/${universe.length}`)
  if (!missing.length) {
    fs.writeFileSync(OUT, JSON.stringify(merged))
    console.log('nothing to fetch')
    return
  }

  const size = 40
  let got = 0
  let fail = 0
  for (let i = 0; i < missing.length; i += size) {
    const slice = missing.slice(i, i + size)
    let attempt = 0
    while (true) {
      try {
        const batch = await fetchBatch(slice)
        got += Object.keys(batch).length
        for (const [code, fin] of Object.entries(batch)) {
          merged[code] = mergeFin(merged[code], fin)
        }
        break
      } catch (err) {
        attempt++
        if (attempt >= 5) {
          fail += slice.length
          console.warn(`batch ${i} failed: ${err.message}`)
          break
        }
        await sleep(800 * attempt)
      }
    }
    const done = Math.min(i + size, missing.length)
    if (done % 300 === 0 || done === missing.length) {
      console.log(`retry ${done}/${missing.length} hits ${got} fail~${fail} merged ${Object.keys(merged).length}`)
      fs.writeFileSync(OUT, JSON.stringify(merged))
    }
    await sleep(80)
  }

  fs.writeFileSync(OUT, JSON.stringify(merged))
  const withPx = Object.values(merged).filter((f) => f.price > 0).length
  const withRoe = Object.values(merged).filter((f) => f.roe).length
  const covered = universe.filter((r) => merged[r.code]).length
  console.log(JSON.stringify({ wrote: OUT, n: Object.keys(merged).length, covered, withPx, withRoe, universe: universe.length }, null, 2))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
