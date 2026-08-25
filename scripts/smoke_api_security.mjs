/**
 * Offline smoke: security + capacity guards (no live Blob/Upstash required).
 * Usage: node scripts/smoke_api_security.mjs
 */
import { checkRateLimit, getClientIp } from '../lib/rateLimit.js'
import { validateUpstreamUrl } from '../lib/proxyCore.js'
import { authorizeIdentity, isAllowedOrigin, requireOtpSecretConfigured } from '../lib/apiAuth.js'
import { canRevealDevCode } from '../lib/emailOtp.js'
import { computeKpis, systemHealth } from '../lib/adminOps.js'

let failed = 0
function assert(cond, msg) {
  if (!cond) {
    failed += 1
    console.error('FAIL:', msg)
  } else {
    console.log('OK  ', msg)
  }
}

// --- IP: prefer Vercel header over spoofed XFF ---
{
  const ip = getClientIp({
    headers: {
      'x-forwarded-for': '1.2.3.4, 9.9.9.9',
      'x-vercel-forwarded-for': '203.0.113.10',
    },
  })
  assert(ip === '203.0.113.10', 'getClientIp prefers x-vercel-forwarded-for')
}

// --- Local rate limit trips ---
{
  const key = `smoke:${Date.now()}`
  let blocked = false
  for (let i = 0; i < 6; i++) {
    const r = checkRateLimit(key, { limit: 5, windowMs: 60_000 })
    if (!r.ok) blocked = true
  }
  assert(blocked, 'checkRateLimit blocks after limit')
}

// --- Proxy allowlist ---
{
  const ok = validateUpstreamUrl(
    'https://push2.eastmoney.com/api/qt/stock/get?secid=1.600519',
  )
  assert(ok.ok === true, 'eastmoney quote allowlisted')
  const bad = validateUpstreamUrl('https://evil.example/steal')
  assert(bad.ok === false && bad.status === 403, 'non-allowlist host rejected')
  const http = validateUpstreamUrl('http://push2.eastmoney.com/api/qt/stock/get')
  assert(http.ok === false, 'http upstream rejected')
}

// --- CORS allowlist (no env → empty in fake prod) ---
{
  const prev = process.env.NODE_ENV
  process.env.NODE_ENV = 'production'
  delete process.env.CORS_ORIGINS
  delete process.env.VERCEL
  // isAllowedOrigin with empty list
  assert(!isAllowedOrigin('https://evil.com'), 'prod without CORS_ORIGINS rejects foreign origin')
  process.env.NODE_ENV = prev
}

// --- authorizeIdentity without session/proof ---
{
  const r = authorizeIdentity({ headers: {} }, { email: 'a@b.com' })
  assert(r.ok === false && r.status === 401, 'authorizeIdentity requires session or proof')
}

// --- OTP secret gate in prod ---
{
  const prevN = process.env.NODE_ENV
  const prevE = process.env.EMAIL_OTP_SECRET
  const prevV = process.env.VAULT_SESSION_SECRET
  const prevVer = process.env.VERCEL
  process.env.NODE_ENV = 'production'
  process.env.VERCEL = '1'
  delete process.env.EMAIL_OTP_SECRET
  delete process.env.VAULT_SESSION_SECRET
  const gate = requireOtpSecretConfigured()
  assert(gate.ok === false && gate.status === 503, 'prod refuses missing OTP secret')
  delete process.env.VERCEL
  process.env.NODE_ENV = prevN
  if (prevE != null) process.env.EMAIL_OTP_SECRET = prevE
  else delete process.env.EMAIL_OTP_SECRET
  if (prevV != null) process.env.VAULT_SESSION_SECRET = prevV
  else delete process.env.VAULT_SESSION_SECRET
  if (prevVer != null) process.env.VERCEL = prevVer
  else delete process.env.VERCEL
}

// --- Dev reveal never in production ---
{
  const prevN = process.env.NODE_ENV
  const prevR = process.env.EMAIL_DEV_REVEAL
  process.env.NODE_ENV = 'production'
  process.env.EMAIL_DEV_REVEAL = '1'
  assert(canRevealDevCode({ headers: { host: 'localhost' } }) === false, 'no OTP reveal in production')
  process.env.NODE_ENV = prevN
  if (prevR != null) process.env.EMAIL_DEV_REVEAL = prevR
  else delete process.env.EMAIL_DEV_REVEAL
}

// --- Ops console KPIs / health flags (no secrets leaked) ---
{
  const k = computeKpis([
    { plan: 'pro', proUntil: null, banned: false, totalTokens: 100, calls: 2, createdAt: Date.now(), lastSeenAt: Date.now() },
    { plan: 'pro', proUntil: Date.now() - 1000, banned: true, totalTokens: 50, calls: 1, createdAt: 1, lastSeenAt: 1 },
    { plan: 'free', banned: false, totalTokens: 0, calls: 0, createdAt: 1, lastSeenAt: 1 },
  ])
  assert(k.registered === 3, 'kpi registered')
  assert(k.pro === 1, 'kpi active pro')
  assert(k.expired === 1, 'kpi expired pro')
  assert(k.banned === 1, 'kpi banned')
  assert(k.tokens === 150, 'kpi tokens')
  const h = systemHealth()
  assert(typeof h.blob === 'boolean' && typeof h.otp === 'boolean', 'systemHealth booleans only')
}

if (failed) {
  console.error(`\n${failed} smoke check(s) failed`)
  process.exit(1)
}
console.log('\nAll api security smoke checks passed')
