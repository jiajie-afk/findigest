/**
 * Smoke: paste / CSV / OCR-text parsers, plus production CSP for tesseract WASM.
 * Usage: node scripts/smoke_holdings_import.mjs
 */
import { readFileSync } from 'node:fs'
import { parseHoldingsText, parseOcrText, rowsToCommit } from '../src/services/holdingsImport.js'
import { parseNumberLoose } from '../src/utils/stockCode.js'
import {
  eastmoneySecid,
  inferHoldingEx,
  parseSinaQuote,
  scaleEastmoneyPrice,
  sinaSymbol,
  summarizeFetchResult,
} from '../src/services/quotesRefresh.js'

let failed = 0
function assert(cond, msg) {
  if (!cond) {
    failed += 1
    console.error('FAIL:', msg)
  } else {
    console.log('OK  ', msg)
  }
}

const paste = parseHoldingsText(
  ['代码\t名称\t数量\t成本', '600519\t贵州茅台\t100\t1400.00', '000858\t五粮液\t200\t150.5'].join('\n'),
  'eastmoney',
)
assert(paste.rows.length === 2, `paste: 2 rows, got ${paste.rows.length}`)
assert(paste.rows[0].code === '600519' && paste.rows[0].shares === 100, 'paste: 600519 shares')
assert(paste.rows[1].code === '000858' && paste.rows[1].ex === 'SZ', 'paste: 000858 SZ')

const wan = parseHoldingsText(
  ['代码\t名称\t数量\t成本', '600519\t贵州茅台\t1.2万\t1400'].join('\n'),
  'generic',
)
assert(wan.rows[0]?.code === '600519' && wan.rows[0]?.shares === 12000, 'paste: 1.2万 shares')

const csv = parseHoldingsText(
  ['代码,名称,数量,成本', '00700,腾讯控股,200,320.5', '600519,贵州茅台,50,1680'].join('\n'),
  'tiger',
)
assert(csv.rows.length === 2, `csv: 2 rows, got ${csv.rows.length}`)
assert(csv.rows[0].code === '00700' && csv.rows[0].ex === 'HK', 'csv: 00700 HK')
assert(csv.rows[1].cost === 1680, 'csv: 600519 cost')
assert(
  rowsToCommit(csv.rows).some((r) => r.code === '00700' && r.ex === 'HK'),
  'commit infers HK for 00700',
)

const ocr = parseOcrText('600519 贵州茅台 100 1400.00\n000858 五粮液 200 150.5\n')
assert(ocr.rows.length >= 2, `ocr text: >=2 rows, got ${ocr.rows.length}`)
assert(
  ocr.rows.some((r) => r.code === '600519' && r.shares === 100),
  'ocr text: 600519',
)
const ocrGlued = parseOcrText('600519贵州茅台 100 1400\n')
assert(
  ocrGlued.rows.some((r) => r.code === '600519' && r.shares === 100),
  'ocr glued code+name: 600519',
)
assert(
  ocr.rows.every((r) => r.source === 'ocr'),
  'ocr text: source=ocr',
)

const emShot = parseOcrText(
  [
    '证券代码 证券名称 股票余额 可用余额 成本价 最新价 市值 浮动盈亏 盈亏比',
    '600519 贵州茅台 100 100 1400.00 1450.00 145000.00 5000.00 3.57%',
    '000858 五粮液 200 200 150.50 155.00 31000.00 900.00 2.90%',
  ].join('\n'),
)
const maotai = emShot.rows.find((r) => r.code === '600519')
assert(!!maotai, 'eastmoney shot: found 600519')
assert(maotai && maotai.shares === 100, `eastmoney shot: shares 100, got ${maotai?.shares}`)
assert(maotai && maotai.cost === 1400, `eastmoney shot: cost 1400 not 市值/盈亏比, got ${maotai?.cost}`)
assert(maotai && maotai.name.includes('茅台'), 'eastmoney shot: name 茅台')

const ocrLetters = parseOcrText('6OO519 贵州茅台 100 1400.00\n')
assert(
  ocrLetters.rows.some((r) => r.code === '600519' && r.shares === 100),
  'ocr O→0 / name lookup: 6OO519 → 600519',
)

const nameFirst = parseOcrText('贵州茅台 600519 100 1400\n')
assert(
  nameFirst.rows.some((r) => r.code === '600519' && r.shares === 100 && r.cost === 1400),
  'ocr name-first line',
)

const mixed = parseHoldingsText(
  ['代码\t名称\t数量\t成本', '600519\t贵州茅台\t100\t1400', '合计\t\t300\t', 'ABCDEF\t不是股票\t1\t1'].join('\n'),
  'generic',
)
assert(mixed.rows.some((r) => r.code === '600519'), 'drop report: kept 600519')
assert(
  mixed.dropped.some((d) => /合计/.test(d.preview) || /合计/.test(d.reason)),
  'drop report: 合计 row explained',
)
assert(
  mixed.dropped.some((d) => /代码/.test(d.reason)),
  'drop report: bad ticker explained',
)

const ocrMiss = parseOcrText('今日大盘红了 不要追高\n合计 资产 888\n')
assert(ocrMiss.rows.length === 0, 'ocr miss: no fake rows')
assert(ocrMiss.dropped.length >= 1, 'ocr miss: dropped lines listed')

const vercel = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'))
const csp = vercel.headers
  ?.flatMap((h) => h.headers || [])
  ?.find((h) => h.key === 'Content-Security-Policy')?.value
assert(typeof csp === 'string' && csp.length > 0, 'vercel CSP present')
assert(
  /\bscript-src\b[^;]*wasm-unsafe-eval/.test(csp || ''),
  'CSP script-src allows wasm-unsafe-eval (tesseract OCR)',
)
assert(
  /\bworker-src\b[^;]*blob:/.test(csp || ''),
  'CSP worker-src allows blob workers',
)

assert(summarizeFetchResult({ reason: 'empty' }).includes('导入'), 'fetch toast: empty')
assert(summarizeFetchResult({ reason: 'busy' }) === '', 'fetch toast: busy silent')
assert(summarizeFetchResult({ reason: 'ok', quotes: 3 }).includes('3'), 'fetch toast: quotes')
assert(eastmoneySecid('700', 'HK') === '116.00700', 'HK 700 pads to 00700')
assert(eastmoneySecid('00700', 'HK') === '116.00700', 'HK 00700 stays 5 digits')
assert(eastmoneySecid('600519', 'SH') === '1.600519', 'SH 600519')
assert(eastmoneySecid('000858', 'SZ') === '0.000858', 'SZ 000858')
assert(inferHoldingEx('00700') === 'HK', 'infer HK from 5-digit code')
assert(inferHoldingEx('600519') === 'SH', 'infer SH from 6xxxxx')
assert(inferHoldingEx('000858', 'SZ') === 'SZ', 'keep hinted SZ')
assert(scaleEastmoneyPrice(150000, 2) === 1500, 'A-share 2dp')
assert(scaleEastmoneyPrice(320500, 3) === 320.5, 'HK 3dp')
assert(scaleEastmoneyPrice(150000) === 1500, 'default 2dp')
assert(sinaSymbol('600519', 'SH') === 'sh600519', 'sina sh symbol')
assert(sinaSymbol('000858', 'SZ') === 'sz000858', 'sina sz symbol')
assert(sinaSymbol('700', 'HK') === 'hk00700', 'sina hk symbol pads')

const sinaA = parseSinaQuote(
  'var hq_str_sh600519="贵州茅台,1300.000,1304.000,1302.800,1314.450,1295.000,1302.770,1302.800,2173083,2838763999.000,100,1302.770,200,1302.600,2200,1302.550,100,1302.500,100,1302.370,50,1302.800,100,1302.810,53,1302.880,300,1302.900,1000,1302.910,2026-08-26,15:34:59,00";',
  '600519',
  'SH',
)
assert(sinaA?.price === 1302.8, `sina A price 1302.8, got ${sinaA?.price}`)
assert(Math.abs(sinaA.change_pct + 0.092) < 0.01, `sina A change from prevClose, got ${sinaA.change_pct}`)
assert(sinaA.asOf === '2026-08-26T07:34:59.000Z', `sina A asOf is Beijing-pinned, got ${sinaA.asOf}`)

const sinaHk = parseSinaQuote(
  'var hq_str_hk00700="TENCENT,腾讯控股,445.000,442.000,450.000,443.200,446.200,4.200,0.950,444.60001,444.60001,6175912157,13821542,0.000,0.000,675.134,411.000,2026/08/26,16:02";',
  '00700',
  'HK',
)
assert(sinaHk?.price === 446.2, `sina HK price 446.2, got ${sinaHk?.price}`)
assert(sinaHk.change_pct === 0.95, `sina HK uses reported pct, got ${sinaHk.change_pct}`)
assert(sinaHk.asOf === '2026-08-26T08:02:00.000Z', `sina HK asOf, got ${sinaHk.asOf}`)

assert(parseSinaQuote('var hq_str_sh600519="";', '600519', 'SH') === null, 'sina empty payload → null')
assert(parseSinaQuote('var hq_str_sz000001="x,1,2,3";', '600519', 'SH') === null, 'sina wrong symbol → null')

assert(parseNumberLoose('1.2万') === 12000, 'parse 1.2万 shares')
assert(parseNumberLoose('1,400.00') === 1400, 'parse comma cost')
assert(parseNumberLoose('0.35亿') === 35000000, 'parse 0.35亿')

if (failed) {
  console.error(`\n${failed} assertion(s) failed`)
  process.exit(1)
}
console.log('\nsmoke_holdings_import: all passed')
