/**
 * Holdings vanish on login: guest desk and account desk are different
 * namespaces; stamping sync clocks before pickVaultWinner keeps a stale
 * local starter and then push overwrites the cloud desk.
 *
 * Usage: node scripts/smoke_vault_sync.mjs
 */
const store = new Map()
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  key: (i) => [...store.keys()][i] ?? null,
  get length() {
    return store.size
  },
}

const { adoptGuestHoldings, GUEST_ACCOUNT_ID, pickVaultWinner, writeSyncMeta } = await import(
  '../src/services/vault.js'
)

let failed = 0
function assert(cond, msg) {
  if (!cond) {
    failed += 1
    console.error('FAIL:', msg)
  } else {
    console.log('OK  ', msg)
  }
}

const guestKey = `fd_v1:${GUEST_ACCOUNT_ID}:fd_portfolios`
const acct = 'acct-real'
const acctKey = `fd_v1:${acct}:fd_portfolios`
const starter = [
  { id: 1, name: '我的持仓', holdings: [{ id: 1, code: '600519', name: '贵州茅台', shares: 100, cost: 1296 }] },
]
const imported = [
  {
    id: 1,
    name: '我的持仓',
    holdings: [
      { id: 2, code: '000001', name: '平安银行', shares: 800, cost: 12.3 },
      { id: 3, code: '600519', name: '贵州茅台', shares: 10, cost: 1400 },
    ],
  },
]

store.set(guestKey, JSON.stringify(imported))
store.set(acctKey, JSON.stringify(starter))
const adopted = adoptGuestHoldings(acct)
assert(adopted.replaced === true && adopted.adopted === 2, 'login adopts guest imports over starter 茅台')
const after = JSON.parse(store.get(acctKey))
assert(
  after[0].holdings.some((h) => h.code === '000001' && h.shares === 800),
  'adopted 平安银行 lot is on the account vault',
)

store.clear()
store.set(guestKey, JSON.stringify(imported))
const merge = adoptGuestHoldings(acct)
assert(merge.adopted === 2, 'empty account takes guest lots')

store.clear()
store.set(guestKey, JSON.stringify(imported))
store.set(acctKey, JSON.stringify(starter))
const again = adoptGuestHoldings(acct)
assert(again.replaced === true, 'refresh/hydrate still adopts leftover guest lots')

store.clear()
store.set(guestKey, JSON.stringify(starter))
store.set(acctKey, JSON.stringify(imported))
const skip = adoptGuestHoldings(acct)
assert(skip.adopted === 0, 'starter guest does not overwrite a real account desk')

// Clock stamp before pick: local starter older than cloud, but premature
// write makes clocks equal → keep stale local (user symptom).
store.clear()
store.set(acctKey, JSON.stringify(starter))
writeSyncMeta({ localUpdatedAt: 100, cloudUpdatedAt: 100 }, acct)
assert(pickVaultWinner(acct, 200) === 'remote', 'newer cloud wins when clocks are honest')
writeSyncMeta({ localUpdatedAt: 200, cloudUpdatedAt: 200 }, acct)
assert(pickVaultWinner(acct, 200) === 'equal', 'repro: premature stamp hides the newer cloud')

if (failed) {
  console.error(`\n${failed} vault sync check(s) failed`)
  process.exit(1)
}
console.log('\nvault sync ok')
