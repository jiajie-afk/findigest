/**
 * Local nightshift smoke. No East Money SendKeys, no real SMS.
 * Usage: node scripts/smoke_nightshift.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { looksLikeHoldings, pickHoldingsText, runDesktopHoldingsScan } from '../lib/localHoldings.js'
import { parseHoldingsText } from '../src/services/holdingsImport.js'
import { normalizePhone, isValidPhone, phoneVaultEmail, isValidEmail } from '../lib/emailOtp.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const statePath = path.join(root, 'scripts', 'nightshift-state.json')
const fixturePath = path.join(root, 'scripts', 'fixtures', 'holdings-sample.csv')

function fail(name, detail) {
  throw new Error(`${name}: ${detail}`)
}

function loadState() {
  try {
    return JSON.parse(fs.readFileSync(statePath, 'utf8'))
  } catch {
    return { checks: [] }
  }
}

function saveState(patch) {
  const prev = loadState()
  const next = {
    ...prev,
    ...patch,
    updatedAt: new Date().toISOString(),
  }
  fs.writeFileSync(statePath, JSON.stringify(next, null, 2), 'utf8')
  return next
}

async function ping(url) {
  const ac = new AbortController()
  const t = setTimeout(() => ac.abort(), 8000)
  try {
    const r = await fetch(url, { signal: ac.signal })
    return { ok: r.ok, status: r.status }
  } catch (e) {
    return { ok: false, status: 0, error: String(e?.message || e) }
  } finally {
    clearTimeout(t)
  }
}

async function postJson(url, body) {
  const ac = new AbortController()
  const t = setTimeout(() => ac.abort(), 25000)
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ac.signal,
    })
    const text = await r.text()
    let json = {}
    try {
      json = JSON.parse(text)
    } catch {
      json = { raw: text.slice(0, 300) }
    }
    return { ok: r.ok, status: r.status, json }
  } finally {
    clearTimeout(t)
  }
}

const checks = []

function check(name, fn) {
  try {
    fn()
    checks.push({ name, ok: true })
    console.log(`ok  ${name}`)
  } catch (e) {
    checks.push({ name, ok: false, error: String(e?.message || e) })
    console.error(`FAIL ${name}: ${e?.message || e}`)
  }
}

async function checkAsync(name, fn) {
  try {
    await fn()
    checks.push({ name, ok: true })
    console.log(`ok  ${name}`)
  } catch (e) {
    checks.push({ name, ok: false, error: String(e?.message || e) })
    console.error(`FAIL ${name}: ${e?.message || e}`)
  }
}

check('phone vault key', () => {
  if (!isValidPhone('13800138000')) fail('phone', 'valid sample rejected')
  if (normalizePhone('+86 138-0013-8000') !== '13800138000') fail('phone', 'normalize')
  if (phoneVaultEmail('13800138000') !== 'p13800138000@sms.findigest.local') fail('phone', 'vault email')
  if (isValidPhone('12345')) fail('phone', 'short accepted')
})

check('email shape', () => {
  if (!isValidEmail('you@qq.com')) fail('email', 'qq rejected')
})

check('fixture parse', () => {
  const csv = fs.readFileSync(fixturePath, 'utf8')
  if (!looksLikeHoldings(csv)) fail('fixture', 'looksLikeHoldings false')
  const parsed = parseHoldingsText(csv, 'generic')
  if (parsed.rows.length !== 3) fail('fixture', `rows ${parsed.rows.length}`)
  if (!parsed.rows.some((r) => String(r.code).includes('600519'))) fail('fixture', 'missing 600519')
})

check('pickHoldingsText prefers table', () => {
  const csv = fs.readFileSync(fixturePath, 'utf8')
  const picked = pickHoldingsText({
    notes: ['SKIP_COPY'],
    windowCopy: '',
    clipboard: 'hello',
    files: [{ name: 'holdings-sample.csv', text: csv }],
  })
  if (picked.source !== 'file:holdings-sample.csv') fail('pick', picked.source)
})

await checkAsync('ps1 no CopyWindow', async () => {
  const scan = await runDesktopHoldingsScan({ timeoutMs: 15000, launch: false, copyWindow: false })
  const notes = scan.notes || []
  if (notes.includes('COPY_OK') || notes.includes('COPY_EMPTY')) {
    fail('ps1', `unexpected copy notes ${notes.join(',')}`)
  }
  if (scan.launched) fail('ps1', 'launched trade app')
})

const origin = 'http://127.0.0.1:5173'
await checkAsync('vite home', async () => {
  const r = await ping(`${origin}/`)
  if (!r.ok) fail('vite', r.error || `status ${r.status}`)
})

await checkAsync('pricing page', async () => {
  const r = await ping(`${origin}/pricing`)
  if (!r.ok) fail('pricing', r.error || `status ${r.status}`)
})

await checkAsync('holdings-local no keys', async () => {
  const r = await postJson(`${origin}/api/holdings-local`, { launch: false, copyWindow: false })
  if (r.status === 500) fail('holdings-local', r.json.message || JSON.stringify(r.json))
  if (!r.ok && r.status !== 200) fail('holdings-local', `status ${r.status}`)
  const notes = r.json.notes || []
  if (notes.some((n) => /已切到交易窗口/.test(n))) fail('holdings-local', 'sent keys')
})

await checkAsync('auth email otp localhost', async () => {
  const r = await postJson(`${origin}/api/auth`, {
    action: 'send',
    channel: 'email',
    email: 'nightshift-dev@example.com',
    purpose: 'register',
  })
  if (!r.ok) fail('auth', r.json.message || JSON.stringify(r.json))
  if (!r.json.devMode && !r.json.emailed) fail('auth', 'neither sent nor devCode')
})

const failed = checks.filter((c) => !c.ok)
saveState({
  lastSmokeAt: new Date().toISOString(),
  smokeFailed: failed.length,
  checks,
})

if (failed.length) {
  console.error(`\n${failed.length} failed`)
  process.exitCode = 1
} else {
  console.log('\nall nightshift smokes passed')
}
