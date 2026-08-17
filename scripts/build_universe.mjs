/**
 * Build A/H stock universe from Sina Market Center API (Eastmoney often blocked).
 * Writes public/data/db.json (code→name) and public/data/universe.json (rich list).
 *
 * Usage: node scripts/build_universe.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const outDb = path.join(root, 'public', 'data', 'db.json')
const outUniverse = path.join(root, 'public', 'data', 'universe.json')

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  Referer: 'https://finance.sina.com.cn',
}

async function fetchJson(url, attempt = 1) {
  try {
    const r = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(25000) })
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    const text = await r.text()
    // Sina sometimes returns bare JSON array / quoted count
    return JSON.parse(text)
  } catch (e) {
    if (attempt >= 6) throw e
    console.warn(`retry ${attempt}: ${e.message || e}`)
    await new Promise((r) => setTimeout(r, 350 * attempt))
    return fetchJson(url, attempt + 1)
  }
}

async function fetchNodeCount(node) {
  const url = `https://vip.stock.finance.sina.com.cn/quotes_service/api/json_v2.php/Market_Center.getHQNodeStockCount?node=${node}`
  const n = await fetchJson(url)
  return Number(String(n).replace(/"/g, '')) || 0
}

async function fetchNodePage(node, page, num = 80) {
  const url =
    'https://vip.stock.finance.sina.com.cn/quotes_service/api/json_v2.php/Market_Center.getHQNodeData' +
    `?page=${page}&num=${num}&sort=symbol&asc=1&node=${node}&symbol=&_s_r_a=page`
  const data = await fetchJson(url)
  return Array.isArray(data) ? data : []
}

async function fetchNodeAll(node, label) {
  const total = await fetchNodeCount(node)
  const num = 80
  const pages = Math.ceil(total / num) || 1
  console.log(`${label} (${node}): ${total} symbols, ${pages} pages`)
  const rows = []
  for (let page = 1; page <= pages; page++) {
    const chunk = await fetchNodePage(node, page, num)
    for (const x of chunk) {
      if (x?.code && x?.name) rows.push({ code: String(x.code), name: String(x.name).trim(), symbol: x.symbol })
    }
    if (page % 10 === 0 || page === pages) console.log(`  ${label} page ${page}/${pages} → ${rows.length}`)
    await new Promise((r) => setTimeout(r, 50))
  }
  return rows
}

function marketFromSymbol(symbol, code) {
  const s = String(symbol || '')
  if (s.startsWith('sh') || code.startsWith('6') || code.startsWith('9')) return 'SH'
  if (s.startsWith('sz') || code.startsWith('0') || code.startsWith('3')) return 'SZ'
  if (s.startsWith('hk') || s.startsWith('rt_hk')) return 'HK'
  if (code.length <= 5) return 'HK'
  return 'SZ'
}

function padA(code) {
  const digits = String(code).replace(/\D/g, '')
  if (!digits) return null
  return digits.padStart(6, '0').slice(-6)
}

function padHk(code) {
  const digits = String(code).replace(/\D/g, '')
  if (!digits) return null
  return digits.padStart(5, '0').slice(-5)
}

function isJunkName(name) {
  return /(-WR|-R|-SWR|购回|牛熊|认购|认沽|窝轮|杠杆)$/i.test(name) || /窝轮|牛熊证|界内证/.test(name)
}

async function main() {
  const byCode = new Map()

  // A-shares (includes STAR / ChiNext under hs_a on Sina)
  const aRows = await fetchNodeAll('hs_a', 'A')
  for (const row of aRows) {
    const code = padA(row.code)
    if (!code) continue
    if (code.startsWith('900') || code.startsWith('200')) continue // B-shares
    // Beijing Exchange 8xxxxx / 4xxxxx / 92xxxx — keep if present (still A-share style CN)
    const market = marketFromSymbol(row.symbol, code)
    // Map BJ to SZ for FinDigest ex picker compatibility (or keep as SZ-like)
    const m = market === 'SH' ? 'SH' : 'SZ'
    byCode.set(code, { code, name: row.name, market: m })
  }

  // Hong Kong — try common sina nodes
  const hkNodes = ['hangseng', 'hk_main', 'qbgg_hk', 'hkzs']
  let hkRows = []
  for (const node of hkNodes) {
    try {
      const count = await fetchNodeCount(node)
      console.log(`probe HK node ${node}: ${count}`)
      if (count > 50) {
        hkRows = await fetchNodeAll(node, `HK:${node}`)
        if (hkRows.length > 50) break
      }
    } catch (e) {
      console.warn(`HK node ${node} failed:`, e.message || e)
    }
  }

  // Fallback: known liquid HK names from previous db + a curated mega-cap seed
  const hkSeed = [
    ['00700', '腾讯控股'],
    ['09988', '阿里巴巴-W'],
    ['03690', '美团-W'],
    ['01810', '小米集团-W'],
    ['00941', '中国移动'],
    ['00939', '建设银行'],
    ['01398', '工商银行'],
    ['03988', '中国银行'],
    ['01288', '农业银行'],
    ['02318', '中国平安'],
    ['00388', '香港交易所'],
    ['00005', '汇丰控股'],
    ['01211', '比亚迪股份'],
    ['02015', '理想汽车-W'],
    ['09868', '小鹏汽车-W'],
    ['09866', '蔚来-SW'],
    ['09618', '京东集团'],
    ['09888', '百度集团'],
    ['09999', '网易-S'],
    ['01024', '快手-W'],
    ['06618', '京东健康'],
    ['02020', '安踏体育'],
    ['02331', '李宁'],
    ['00883', '中国海洋石油'],
    ['00857', '中国石油股份'],
    ['00386', '中国石化'],
    ['00981', '中芯国际'],
    ['01088', '中国神华'],
    ['02628', '中国人寿'],
    ['02328', '中国财险'],
    ['01299', '友邦保险'],
    ['01919', '中远海控'],
    ['01109', '华润置地'],
    ['01658', '邮储银行'],
    ['03968', '招商银行'],
    ['02388', '中银香港'],
    ['00688', '中国海外发展'],
    ['01186', '中国铁建'],
    ['00390', '中国中铁'],
    ['01800', '中国交建'],
    ['00762', '中国联通'],
    ['00728', '中国电信'],
    ['02269', '药明生物'],
    ['06160', '百济神州'],
    ['01801', '信达生物'],
    ['09626', '哔哩哔哩-W'],
    ['09961', '携程集团-S'],
    ['02057', '中通快递-W'],
    ['01519', '极兔速递-W'],
    ['02319', '蒙牛乳业'],
    ['09633', '农夫山泉'],
    ['00175', '吉利汽车'],
    ['02333', '长城汽车'],
    ['02238', '广汽集团'],
    ['01797', '东方甄选'],
    ['06690', '海尔智家'],
    ['06862', '海底捞'],
    ['09922', '九毛九'],
    ['01398', '工商银行'],
  ]

  for (const row of hkRows) {
    if (isJunkName(row.name)) continue
    const code = padHk(row.code)
    if (!code) continue
    byCode.set(code, { code, name: row.name, market: 'HK' })
  }
  for (const [code, name] of hkSeed) {
    if (!byCode.has(code)) byCode.set(code, { code, name, market: 'HK' })
  }

  // Merge previous db (prefer live names; keep missing curated)
  try {
    const prev = JSON.parse(fs.readFileSync(outDb, 'utf8'))
    for (const [code, name] of Object.entries(prev)) {
      if (!byCode.has(code) && name && typeof name === 'string') {
        // Skip obvious synthetic placeholders from older filler data
        if (/^(川|粤|鲁|湘|鄂|桂|浙|苏|皖|闽|赣|辽|吉|黑|晋|冀|豫|陕|甘|青|宁|新|藏|滇|黔|琼|渝|京|津|沪|深|温|甬|厦|藏)(华|达)?/.test(name) && /[\u4e00-\u9fff]{2,6}$/.test(name)) {
          // Heuristic: keep only if looks like a real known pattern — skip short synthetic province-prefixed fillers
          if (/华牧业|达工业|华寿险|部件|农商行\d|置业\d|房产\d/.test(name) || /达|华/.test(name) && name.length <= 6 && !/银行|证券|保险|集团|股份|科技|能源|电力|汽车|医药|地产|白酒|啤酒/.test(name)) {
            // still might false-positive; only skip clearly synthetic from prior filler batch
          }
        }
        const market = code.length <= 5 ? 'HK' : code.startsWith('6') || code.startsWith('9') ? 'SH' : 'SZ'
        byCode.set(code, { code, name, market })
      } else if (byCode.has(code)) {
        // Prefer non-synthetic previous name if new is worse — keep live
      }
    }
  } catch {
    /* no previous */
  }

  // Drop leftover synthetic filler names if we already have ≥3500 real rows
  const syntheticRe =
    /^(川|粤|鲁|湘|鄂|桂|浙|苏|皖|闽|赣|辽|吉|黑|晋|冀|豫|陕|甘|青|宁|新|藏|滇|黔|琼|渝|京|津|沪|深|温|甬|厦|藏达|宁达|青华|甘达|黑达|辽达|冀华|豫华|湘达|鄂达|皖达|闽达|赣达|浙达|苏达|鲁达|粤达|北达|南达|东达|西达|中达|华达|华华)/
  if (byCode.size >= 3500) {
    for (const [code, row] of [...byCode.entries()]) {
      if (syntheticRe.test(row.name) && /^(川|粤|鲁|湘|鄂|桂|浙|苏|皖|闽|赣|辽|吉|黑|晋|冀|豫|陕|甘|青|宁|新|藏|滇|黔|琼|渝|京|津|沪|深)/.test(row.name)) {
        // Only remove if name looks like the generated filler set (province + short industry)
        if (row.name.length <= 8 && !/茅台|腾讯|平安|银行|白酒/.test(row.name)) {
          // Keep real A shares from sina — those won't match weird patterns like 川华牧业 as often
          // Actually sina names are real; synthetic only from old db merge. Remove only if NOT from sina A list.
          // Safer: remove entries whose name matches filler pattern AND code was in old filler ranges — skip for now if sina filled.
        }
      }
    }
  }

  // Explicitly purge known synthetic-looking leftovers that weren't refreshed
  for (const [code, row] of [...byCode.entries()]) {
    if (
      /^(川|粤|鲁|湘|鄂|桂|浙|苏|皖|闽|赣|辽|吉|黑|晋|冀|豫|陕|甘|青|宁|新|藏|滇|黔|琼|渝)(华|达)/.test(row.name) &&
      row.name.length <= 7 &&
      !aRows.some((r) => padA(r.code) === code)
    ) {
      byCode.delete(code)
    }
  }

  const universe = [...byCode.values()].sort((a, b) => a.code.localeCompare(b.code))
  const db = Object.fromEntries(universe.map((u) => [u.code, u.name]))

  fs.mkdirSync(path.dirname(outDb), { recursive: true })
  fs.writeFileSync(outDb, JSON.stringify(db))
  fs.writeFileSync(outUniverse, JSON.stringify(universe))

  const sh = universe.filter((u) => u.market === 'SH').length
  const sz = universe.filter((u) => u.market === 'SZ').length
  const hk = universe.filter((u) => u.market === 'HK').length
  console.log(`Wrote ${universe.length} symbols → db.json + universe.json`)
  console.log(`  SH ${sh} · SZ ${sz} · HK ${hk}`)
  if (universe.length < 3500) {
    console.warn('WARNING: universe < 3500 — marketing floor not met')
    process.exitCode = 2
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
