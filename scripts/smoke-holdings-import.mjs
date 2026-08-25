import { normalizeStockCode } from '../src/utils/stockCode.js'
import { BROKER_LOGINS } from '../src/data/brokerLogin.js'
import { parseHoldingsText, rowsToCommit, normalizeExtensionRows } from '../src/services/holdingsImport.js'

const cases = [
  ['600519', null, '600519', 'SH'],
  ['SH600519', null, '600519', 'SH'],
  ['00700.HK', null, '00700', 'HK'],
  ['700', 'HK', '00700', 'HK'],
  ['sz000001', null, '000001', 'SZ'],
]

let failed = 0
for (const [raw, hint, code, ex] of cases) {
  const n = normalizeStockCode(raw, hint)
  if (!n || n.code !== code || n.ex !== ex) {
    console.error('FAIL', raw, n, 'expected', code, ex)
    failed++
  }
}

const csv = [
  '证券代码,证券名称,股票余额,成本价',
  '600519,贵州茅台,100,1680.5',
  '000001,平安银行,2000,11.2',
  '00700.HK,腾讯控股,100,320.0',
].join('\n')

const r = parseHoldingsText(csv, 'eastmoney')
if (r.rows.length !== 3) {
  console.error('FAIL csv rows', r)
  failed++
}
const commit = rowsToCommit(r.rows)
if (commit[0].code !== '600519' || commit[0].shares !== 100) {
  console.error('FAIL commit', commit[0])
  failed++
}

const paste = '代码\t名称\t数量\t成本\nSH600519\t茅台\t50\t1700'
const p = parseHoldingsText(paste, 'generic')
if (p.rows.length !== 1 || p.rows[0].shares !== 50) {
  console.error('FAIL paste', p)
  failed++
}

const ext = normalizeExtensionRows({
  rows: [{ code: '600519', name: '茅台', shares: 10, cost: 1600 }],
})
if (ext.rows.length !== 1) {
  console.error('FAIL ext', ext)
  failed++
}

const em = BROKER_LOGINS.find((b) => b.id === 'eastmoney')
const ths = BROKER_LOGINS.find((b) => b.id === 'ths')
const tiger = BROKER_LOGINS.find((b) => b.id === 'tiger')
if (!em?.webOpens || em.qrOnWeb) {
  console.error('FAIL eastmoney flags', em)
  failed++
}
if (
  em?.loginUrl !==
  'https://passport2.eastmoney.com/pub/login?backurl=https%3A%2F%2Fwww.eastmoney.com%2F'
) {
  console.error('FAIL eastmoney personal-center login URL', em?.loginUrl)
  failed++
}
if (em?.holdingsUrl) {
  console.error('FAIL eastmoney must not redirect to a securities holdings URL', em.holdingsUrl)
  failed++
}
if (ths?.webOpens || tiger?.webOpens) {
  console.error('FAIL ths/tiger should not open dead web trade')
  failed++
}
if (ths?.loginUrl || tiger?.loginUrl) {
  console.error('FAIL should not deep-link to personal login centers')
  failed++
}

if (failed) {
  console.error('failed', failed)
  process.exit(1)
}
console.log('holdingsImport smoke OK')
