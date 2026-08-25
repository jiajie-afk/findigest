/**
 * Per-account private vault.
 * All personal FinDigest data is namespaced by accountId — never shared demo JSON.
 *
 * Session hardening path (Wave3 best-effort toward httpOnly):
 * 1. With VAULT_SESSION_SECRET: vault PUT sets httpOnly Secure SameSite=Lax `fd_sess`
 *    (HMAC accountId+email+exp) plus `fd_aid` hint. Frontend uses credentials: 'include'
 *    and prefers cookie-bound vault GET when present.
 * 2. Without secret: behavior falls back to fd_aid hint only (previous Wave).
 * 3. Client session snapshot in localStorage remains for SPA routing + offline unlock.
 * 4. Vault unlock password is cleared from sessionStorage ASAP after cloud push.
 *    Tab-scoped in-memory unlock (not persisted) keeps encrypt+push working until logout/refresh.
 * 5. Logged-in writes go to vault namespace only (no root dual-write of sensitive keys).
 * 6. fd_sync_meta.localUpdatedAt bumps on vaultSet; login/push use it vs cloud updatedAt
 *    to avoid blind last-write-wins wipes.
 * Remaining XSS surface: localStorage session + vault ciphertext/keys still readable to
 * script on this origin; cookie alone cannot decrypt the vault without the password.
 * In-memory unlock is also XSS-readable while the tab is open.
 */

const ACCOUNTS_KEY = 'fd_accounts_v1'
const SESSION_KEY = 'fd_session_v1'
const SESSION_PW_KEY = 'fd_session_pw'
const SYNC_META_KEY = 'fd_sync_meta'
const LEGACY_HINT = 'fd_legacy_offer_v1'

let activeAccountId = null
/** Tab-only unlock secret for AES encrypt/decrypt — never written to storage. */
let unlockPassword = null

const VAULT_KEYS = [
  'fd_portfolios',
  'fd_analyses',
  'fd_manual_events',
  'fd_user',
  'fd_user_profile',
  'fd_profile',
  'fd_ai',
  'fd_theme',
  'fd_style',
  'fd_latest_briefing',
  'fd_briefing_prev',
  'fd_feedback_memory',
  'fd_billing',
  'fd_features',
  'fd_personality_tags',
  'fd_behavior_events_fallback',
  'fd_mgmt_comments',
  'fd_verifications',
]

/** Root-level plaintext keys that must not linger after logout (vault copies stay). */
const SENSITIVE_PLAINTEXT_KEYS = [
  SESSION_KEY,
  ...VAULT_KEYS,
  'fd_user_features',
  'fd_user_personality',
  'fd_suggestion_verifications',
  'fd_advice_feedback_v1',
  'fd_extension_import_v1',
  'findigest_mgmt_comments_v1',
  'fd_behavior_events_fallback',
]

export function emptyPortfolio() {
  return [{ id: 1, name: '我的持仓', holdings: [] }]
}

/** New account starter — one lot of 贵州茅台. Logged-out / error paths stay empty. */
export function starterPortfolio() {
  return [
    {
      id: 1,
      name: '我的持仓',
      holdings: [
        {
          id: 1,
          code: '600519',
          name: '贵州茅台',
          ex: 'SH',
          shares: 100,
          cost: 1296,
        },
      ],
    },
  ]
}

export function listAccounts() {
  try {
    return JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || '[]')
  } catch {
    return []
  }
}

export function saveAccounts(list) {
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(list))
}

export function getSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null')
  } catch {
    return null
  }
}

export function setSession(session) {
  if (!session) localStorage.removeItem(SESSION_KEY)
  else localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  activeAccountId = session?.accountId || null
}

/** Drop tab-scoped vault password as soon as unlock / sync no longer needs it. */
export function clearSessionPassword() {
  try {
    sessionStorage.removeItem(SESSION_PW_KEY)
  } catch {
    /* ignore */
  }
}

/** Keep password in RAM for this tab so silent pushCloud works after sessionStorage clear. */
export function setVaultUnlock(password) {
  unlockPassword = password ? String(password) : null
}

export function getVaultUnlock() {
  return unlockPassword
}

export function clearVaultUnlock() {
  unlockPassword = null
}

/** Clear session token + tab password + any root plaintext sensitive copies. */
export function clearSessionArtifacts() {
  setSession(null)
  clearSessionPassword()
  clearVaultUnlock()
  SENSITIVE_PLAINTEXT_KEYS.forEach((k) => {
    try {
      localStorage.removeItem(k)
    } catch {
      /* ignore */
    }
  })
}

export function getActiveAccountId() {
  if (activeAccountId) return activeAccountId
  const s = getSession()
  activeAccountId = s?.accountId || null
  return activeAccountId
}

function vaultPrefix(accountId) {
  return `fd_v1:${accountId}:`
}

export function vaultKey(base, accountId = getActiveAccountId()) {
  if (!accountId) throw new Error('未登录，无法读写私人数据')
  return `${vaultPrefix(accountId)}${base}`
}

export function vaultGet(base, fallback = null) {
  const id = getActiveAccountId()
  if (!id) return fallback
  const raw = localStorage.getItem(vaultKey(base, id))
  if (raw == null) return fallback
  try {
    return JSON.parse(raw)
  } catch {
    return raw
  }
}

export function readSyncMeta(accountId = getActiveAccountId()) {
  if (!accountId) return { localUpdatedAt: 0, cloudUpdatedAt: 0 }
  try {
    const raw = localStorage.getItem(vaultKey(SYNC_META_KEY, accountId))
    const m = raw ? JSON.parse(raw) : {}
    return {
      localUpdatedAt: Number(m.localUpdatedAt) || 0,
      cloudUpdatedAt: Number(m.cloudUpdatedAt) || 0,
    }
  } catch {
    return { localUpdatedAt: 0, cloudUpdatedAt: 0 }
  }
}

export function writeSyncMeta(partial, accountId = getActiveAccountId()) {
  if (!accountId) return
  const prev = readSyncMeta(accountId)
  const next = {
    localUpdatedAt: partial.localUpdatedAt ?? prev.localUpdatedAt,
    cloudUpdatedAt: partial.cloudUpdatedAt ?? prev.cloudUpdatedAt,
  }
  localStorage.setItem(vaultKey(SYNC_META_KEY, accountId), JSON.stringify(next))
}

function touchLocalUpdatedAt(accountId = getActiveAccountId()) {
  if (!accountId) return
  writeSyncMeta({ localUpdatedAt: Date.now() }, accountId)
}

export function vaultSet(base, value) {
  const id = getActiveAccountId()
  if (!id) return
  localStorage.setItem(vaultKey(base, id), typeof value === 'string' ? value : JSON.stringify(value))
  if (base !== SYNC_META_KEY) touchLocalUpdatedAt(id)
}

export function vaultRemove(base) {
  const id = getActiveAccountId()
  if (!id) return
  localStorage.removeItem(vaultKey(base, id))
}

/** Snapshot entire personal vault for cloud sync / backup */
export function exportVault(accountId = getActiveAccountId()) {
  if (!accountId) return {}
  const out = {}
  const prefix = vaultPrefix(accountId)
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (k && k.startsWith(prefix)) {
      out[k.slice(prefix.length)] = localStorage.getItem(k)
    }
  }
  return out
}

export function importVault(accountId, data, opts = {}) {
  if (!accountId || !data || typeof data !== 'object') return
  const prefix = vaultPrefix(accountId)
  Object.entries(data).forEach(([k, v]) => {
    if (typeof v === 'string') localStorage.setItem(prefix + k, v)
  })
  const cloudAt = Number(opts.cloudUpdatedAt) || 0
  if (cloudAt) {
    writeSyncMeta({ localUpdatedAt: cloudAt, cloudUpdatedAt: cloudAt }, accountId)
  }
}

/** True when this account already has private desk data on this device. */
export function hasVaultData(accountId = getActiveAccountId()) {
  if (!accountId) return false
  return !!localStorage.getItem(vaultKey('fd_portfolios', accountId))
}

/**
 * Decide whether cloud vault should replace local on login.
 * remote → import; local → keep + force push; equal → keep local, soft push.
 */
export function pickVaultWinner(accountId, remoteUpdatedAt) {
  const remoteAt = Number(remoteUpdatedAt) || 0
  const local = readSyncMeta(accountId)
  const hasLocal = hasVaultData(accountId)
  if (!hasLocal) return 'remote'
  if (!remoteAt) return 'local'
  // First sync after upgrade (no clock yet): don't wipe local blindly
  if (!local.localUpdatedAt && !local.cloudUpdatedAt) return 'equal'
  if (remoteAt > local.localUpdatedAt) return 'remote'
  if (local.localUpdatedAt > remoteAt) return 'local'
  return 'equal'
}

/** Wipe vault keys and seed a new desk (default holding: 贵州茅台) */
export function initFreshVault(accountId) {
  const prefix = vaultPrefix(accountId)
  const toRemove = []
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (k && k.startsWith(prefix)) toRemove.push(k)
  }
  toRemove.forEach((k) => localStorage.removeItem(k))

  localStorage.setItem(prefix + 'fd_portfolios', JSON.stringify(starterPortfolio()))
  localStorage.setItem(prefix + 'fd_analyses', JSON.stringify({}))
  localStorage.setItem(prefix + 'fd_manual_events', JSON.stringify([]))
  localStorage.setItem(
    prefix + 'fd_user_profile',
    JSON.stringify({
      onboardingDone: false,
      scenarioProgress: 0,
      scenarioAnswers: {},
      preferredIndustries: [],
      avoidIndustries: [],
      productEdition: 'basic',
    }),
  )
  localStorage.setItem(prefix + 'fd_theme', JSON.stringify('dark'))
  localStorage.setItem(prefix + 'fd_style', JSON.stringify('luxury'))
}

/** Snapshot all vault keys for an account (reset rollback). */
export function snapshotVaultKeys(accountId) {
  const prefix = vaultPrefix(accountId)
  const snap = {}
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (k && k.startsWith(prefix)) snap[k] = localStorage.getItem(k)
  }
  return snap
}

export function restoreVaultSnapshot(snap) {
  if (!snap || typeof snap !== 'object') return
  Object.entries(snap).forEach(([k, v]) => {
    if (v == null) localStorage.removeItem(k)
    else localStorage.setItem(k, v)
  })
}

export function hasLegacyLocalData() {
  return !!(localStorage.getItem('fd_portfolios') || localStorage.getItem('fd_user_profile'))
}

export function shouldOfferLegacyImport() {
  return hasLegacyLocalData() && !localStorage.getItem(LEGACY_HINT)
}

export function markLegacyOffered() {
  localStorage.setItem(LEGACY_HINT, '1')
}

/** One-shot: copy old global keys into current account vault */
export function importLegacyIntoActive() {
  const id = getActiveAccountId()
  if (!id) return false
  const prefix = vaultPrefix(id)
  let n = 0
  VAULT_KEYS.forEach((base) => {
    const raw = localStorage.getItem(base)
    if (raw != null) {
      localStorage.setItem(prefix + base, raw)
      n++
    }
  })
  markLegacyOffered()
  return n > 0
}

export {
  VAULT_KEYS,
  ACCOUNTS_KEY,
  SESSION_KEY,
  SESSION_PW_KEY,
  SYNC_META_KEY,
  SENSITIVE_PLAINTEXT_KEYS,
}
