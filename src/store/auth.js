import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { hashPassword, verifyPassword, encryptJson, decryptJson, uid, validatePasswordStrength } from '@/services/crypto.js'
import {
  listAccounts,
  saveAccounts,
  getSession,
  setSession,
  ensureLocalGuestSession,
  isGuestSession,
  clearSessionArtifacts,
  initFreshVault,
  exportVault,
  importVault,
  getActiveAccountId,
  shouldOfferLegacyImport,
  importLegacyIntoActive,
  markLegacyOffered,
  SESSION_PW_KEY,
  clearSessionPassword,
  setVaultUnlock,
  getVaultUnlock,
  clearVaultUnlock,
  readSyncMeta,
  writeSyncMeta,
  pickVaultWinner,
  starterPortfolio,
  snapshotVaultKeys,
  restoreVaultSnapshot,
} from '@/services/vault.js'
import { apiUrl, fetchTimed } from '@/services/apiClient.js'
import { postEmailAuth } from '@/services/emailAuthClient.js'
import { normalizeMainlandPhone, smsVaultEmail } from '@/utils/phone.js'

export const useAuthStore = defineStore('auth', () => {
  const session = ref(getSession())
  const busy = ref(false)
  const lastError = ref('')
  const cloudOk = ref(false)
  /** Short-lived server proof after OTP verify */
  const emailProof = ref('')
  const emailProofEmail = ref('')
  const emailProofPurpose = ref('')
  const lastDevCode = ref('')
  const codeCooldownSec = ref(0)
  let cooldownTimer = null

  const isLoggedIn = computed(() => !!session.value?.accountId)
  const isGuest = computed(() => isGuestSession(session.value))
  const email = computed(() => session.value?.email || '')
  const displayName = computed(() => session.value?.displayName || '')
  const emailVerified = computed(
    () => !!emailProof.value && !!emailProofEmail.value && !!emailProofPurpose.value,
  )

  function hydrate() {
    const existing = getSession()
    session.value = existing?.accountId ? existing : ensureLocalGuestSession()
  }

  function clearEmailProof() {
    emailProof.value = ''
    emailProofEmail.value = ''
    emailProofPurpose.value = ''
    lastDevCode.value = ''
  }

  function normalizePurpose(raw) {
    const p = String(raw || '').trim()
    if (p === 'register') return 'register'
    if (p === 'reset') return 'reset'
    return 'login'
  }

  function startCooldown(sec = 60) {
    codeCooldownSec.value = sec
    clearInterval(cooldownTimer)
    cooldownTimer = setInterval(() => {
      codeCooldownSec.value = Math.max(0, codeCooldownSec.value - 1)
      if (codeCooldownSec.value <= 0) clearInterval(cooldownTimer)
    }, 1000)
  }

  function requireEmailProof(emailNorm, purpose) {
    if (
      !emailProof.value ||
      emailProofEmail.value !== emailNorm ||
      emailProofPurpose.value !== purpose
    ) {
      lastError.value = '请先获取并验证验证码'
      return false
    }
    return true
  }

  /**
   * @param {{ channel?: 'email'|'sms', email?: string, phone?: string, purpose: string }}
   */
  async function sendEmailCode({ channel = 'email', email: rawEmail, phone: rawPhone, purpose }) {
    lastError.value = ''
    lastDevCode.value = ''
    const ch = channel === 'sms' ? 'sms' : 'email'
    if (codeCooldownSec.value > 0) {
      lastError.value = `请 ${codeCooldownSec.value} 秒后再获取验证码`
      return false
    }
    busy.value = true
    try {
      const body = {
        action: 'send',
        channel: ch,
        purpose: normalizePurpose(purpose),
      }
      if (ch === 'sms') {
        const phone = normalizeMainlandPhone(rawPhone || rawEmail)
        if (!phone) {
          lastError.value = '请填写有效的大陆手机号'
          return false
        }
        body.phone = phone
      } else {
        body.email = String(rawEmail || '')
          .trim()
          .toLowerCase()
        if (!body.email.includes('@')) {
          lastError.value = '请填写有效邮箱'
          return false
        }
      }
      const data = await postEmailAuth(body)
      if (data.devCode) lastDevCode.value = String(data.devCode)
      startCooldown(60)
      return true
    } catch (e) {
      lastError.value = e?.message || '验证码发送失败'
      return false
    } finally {
      busy.value = false
    }
  }

  /**
   * @param {{ channel?: 'email'|'sms', email?: string, phone?: string, purpose: string, code: string }}
   */
  async function verifyEmailCode({ channel = 'email', email: rawEmail, phone: rawPhone, purpose, code }) {
    lastError.value = ''
    const ch = channel === 'sms' ? 'sms' : 'email'
    const purposeNorm = normalizePurpose(purpose)
    busy.value = true
    try {
      const body = {
        action: 'verify',
        channel: ch,
        purpose: purposeNorm,
        code: String(code || '').trim(),
      }
      if (ch === 'sms') body.phone = String(rawPhone || rawEmail || '').trim()
      else body.email = String(rawEmail || '').trim().toLowerCase()

      const data = await postEmailAuth(body)
      emailProof.value = data.emailProof || ''
      emailProofEmail.value = data.email || body.email || ''
      emailProofPurpose.value = purposeNorm
      lastDevCode.value = ''
      return true
    } catch (e) {
      clearEmailProof()
      lastError.value = e?.message || '验证码校验失败'
      return false
    } finally {
      busy.value = false
    }
  }

  async function register({
    email: rawEmail,
    phone: rawPhone,
    channel = 'email',
    password,
    displayName: name,
    emailProof: proofFromUi,
  }) {
    lastError.value = ''
    const ch = channel === 'sms' ? 'sms' : 'email'
    let emailNorm = ''
    let phoneNorm = ''
    if (ch === 'sms') {
      phoneNorm = normalizeMainlandPhone(rawPhone || rawEmail)
      if (!phoneNorm) {
        lastError.value = '请填写有效的大陆手机号'
        return false
      }
      emailNorm = smsVaultEmail(phoneNorm)
    } else {
      emailNorm = String(rawEmail || '')
        .trim()
        .toLowerCase()
      if (!emailNorm || !emailNorm.includes('@')) {
        lastError.value = '请填写有效邮箱'
        return false
      }
    }
    if (proofFromUi) {
      emailProof.value = proofFromUi
      emailProofEmail.value = emailNorm
      emailProofPurpose.value = 'register'
    }
    if (!requireEmailProof(emailNorm, 'register')) return false
    const strength = validatePasswordStrength(password)
    if (!strength.ok) {
      lastError.value = strength.message
      return false
    }
    const accounts = listAccounts()
    if (accounts.some((a) => a.email === emailNorm || (phoneNorm && a.phone === phoneNorm))) {
      lastError.value = ch === 'sms' ? '该手机号已注册，请直接登录' : '该邮箱已注册，请直接登录'
      return false
    }

    busy.value = true
    try {
      const accountId = uid()
      const { hash, salt } = await hashPassword(password)
      const account = {
        accountId,
        email: emailNorm,
        phone: phoneNorm || undefined,
        authChannel: ch,
        displayName: String(name || (phoneNorm ? phoneNorm.slice(-4) : emailNorm.split('@')[0])).slice(
          0,
          24,
        ),
        salt,
        passwordHash: hash,
        createdAt: Date.now(),
        emailVerifiedAt: Date.now(),
        authProvider: ch === 'sms' ? 'phone' : 'email',
      }
      accounts.push(account)
      saveAccounts(accounts)
      initFreshVault(accountId)
      localStorage.setItem(
        `fd_v1:${accountId}:fd_user`,
        JSON.stringify({
          nickname: account.displayName,
          email: ch === 'email' ? emailNorm : '',
          phone: phoneNorm || '',
          career: '',
          risk: '平衡型',
          age: null,
          report_hour: 8,
          report_minute: 0,
          strategy: '平衡型',
          push_email: false,
          push_wechat: false,
          serverchan_key: '',
          designStyle: 'luxury',
        }),
      )
      const sess = {
        accountId,
        email: emailNorm,
        phone: phoneNorm || undefined,
        displayName: account.displayName,
        at: Date.now(),
      }
      setSession(sess)
      session.value = sess

      sessionStorage.setItem(SESSION_PW_KEY, password)
      setVaultUnlock(password)
      const pushed = await pushCloud(password)
      clearSessionPassword()
      clearEmailProof()
      if (!pushed) {
        const rolled = listAccounts().filter((a) => a.accountId !== accountId)
        saveAccounts(rolled)
        clearSessionArtifacts()
        clearVaultUnlock()
        session.value = null
        lastError.value =
          lastError.value ||
          '注册失败：无法写入云端（该邮箱可能已注册）。请直接登录，或换邮箱重试。'
        return false
      }
      return true
    } catch (e) {
      console.error(e)
      lastError.value = '注册失败，请重试'
      return false
    } finally {
      busy.value = false
    }
  }

  async function login({
    email: rawEmail,
    phone: rawPhone,
    channel = 'email',
    password,
  }) {
    lastError.value = ''
    const ch = channel === 'sms' ? 'sms' : 'email'
    let emailNorm = ''
    let phoneNorm = ''
    if (ch === 'sms') {
      phoneNorm = normalizeMainlandPhone(rawPhone || rawEmail)
      if (!phoneNorm) {
        lastError.value = '请填写有效的大陆手机号'
        return false
      }
      emailNorm = smsVaultEmail(phoneNorm)
    } else {
      emailNorm = String(rawEmail || '')
        .trim()
        .toLowerCase()
    }
    if (!emailNorm || !password) {
      lastError.value = '请填写账号和密码'
      return false
    }
    busy.value = true
    try {
      let accounts = listAccounts()
      let account =
        accounts.find((a) => a.email === emailNorm) ||
        (phoneNorm ? accounts.find((a) => a.phone === phoneNorm) : null)

      // Password-only cloud unlock (no OTP). Fails soft if cloud down / no remote account.
      const remote = await pullCloudWithPassword(emailNorm, password)
      let preferLocalPush = false
      if (remote?.account) {
        if (!account) {
          accounts.push({ ...remote.account, phone: phoneNorm || remote.account.phone })
          saveAccounts(accounts)
          account = accounts.find((a) => a.email === emailNorm)
        } else {
          account = { ...account, ...remote.account }
          accounts = accounts.map((a) => (a.email === emailNorm ? account : a))
          saveAccounts(accounts)
        }
        if (remote.vault) {
          const winner = pickVaultWinner(account.accountId, remote.updatedAt)
          if (winner === 'remote') {
            importVault(account.accountId, remote.vault, { cloudUpdatedAt: remote.updatedAt })
          } else if (winner === 'local') {
            preferLocalPush = true
          }
        }
        cloudOk.value = true
      } else if (remote?.error === 'bad_password') {
        cloudOk.value = false
      } else if (remote?.error && !account) {
        // No local account and cloud failed — surface clear reason
        lastError.value = remote.error
        return false
      }

      if (!account) {
        lastError.value =
          remote === null
            ? '云端还没有这个账号。请先点「注册」并用验证码建号（以前云端未开通时注册的数据没存上）。'
            : remote?.error || '账号不存在。新设备请先注册，或确认账号密码正确。'
        return false
      }

      const ok = await verifyPassword(password, account.salt, account.passwordHash)
      if (!ok) {
        lastError.value = '密码错误'
        return false
      }

      const sess = {
        accountId: account.accountId,
        email: account.email,
        phone: account.phone,
        displayName: account.displayName,
        at: Date.now(),
      }
      setSession(sess)
      session.value = sess
      sessionStorage.setItem(SESSION_PW_KEY, password)
      setVaultUnlock(password)

      const hasPf = localStorage.getItem(`fd_v1:${account.accountId}:fd_portfolios`)
      if (!hasPf) {
        localStorage.setItem(
          `fd_v1:${account.accountId}:fd_portfolios`,
          JSON.stringify(starterPortfolio()),
        )
      }

      const pushed = await pushCloud(password, { force: preferLocalPush })
      if (!pushed && lastError.value === 'conflict' && remote?.vault) {
        importVault(account.accountId, remote.vault, { cloudUpdatedAt: remote.updatedAt })
        await pushCloud(password)
      }
      clearSessionPassword()
      clearEmailProof()
      return true
    } catch (e) {
      console.error(e)
      lastError.value = '登录失败，请重试'
      return false
    } finally {
      busy.value = false
    }
  }

  async function clearCloudSessionCookies() {
    try {
      await fetch(apiUrl('/api/vault'), { method: 'DELETE', credentials: 'include' })
    } catch {
      try {
        await fetch(apiUrl('/api/vault'), {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ logout: true }),
        })
      } catch {
        /* offline / unconfigured — local logout still proceeds */
      }
    }
  }

  function logout() {
    void clearCloudSessionCookies()
    clearSessionArtifacts()
    clearEmailProof()
    clearVaultUnlock()
    session.value = ensureLocalGuestSession()
    cloudOk.value = false
  }

  /**
   * Encrypt + upload local vault.
   * @param {string} [password]
   * @param {{ force?: boolean }} [opts] force skips optimistic concurrency (after user confirm)
   */
  async function pushCloud(password, opts = {}) {
    const id = getActiveAccountId()
    if (!id) return false
    const accounts = listAccounts()
    const account = accounts.find((a) => a.accountId === id)
    if (!account) return false
    const pw = password || getVaultUnlock() || sessionStorage.getItem(SESSION_PW_KEY)
    if (!pw) {
      lastError.value = 'need_password'
      return false
    }
    if (password) setVaultUnlock(password)
    try {
      const vault = exportVault(id)
      const enc = await encryptJson(pw, account.salt, vault)
      const meta = readSyncMeta(id)
      const headers = { 'Content-Type': 'application/json' }
      if (emailProof.value) headers['X-Email-Proof'] = emailProof.value
      const res = await fetchTimed(
        apiUrl('/api/vault'),
        {
          method: 'PUT',
          headers,
          credentials: 'include',
          body: JSON.stringify({
            email: account.email,
            accountId: account.accountId,
            displayName: account.displayName,
            salt: account.salt,
            passwordHash: account.passwordHash,
            createdAt: account.createdAt,
            enc,
            emailProof: emailProof.value || undefined,
            baseUpdatedAt: opts.force ? undefined : meta.cloudUpdatedAt || undefined,
            force: opts.force === true,
          }),
        },
        18000,
      )
      if (res.status === 409) {
        cloudOk.value = false
        lastError.value = 'conflict'
        return false
      }
      if (!res.ok) {
        cloudOk.value = false
        lastError.value = res.status === 401 || res.status === 403 ? 'auth' : 'push_failed'
        return false
      }
      const data = await res.json().catch(() => ({}))
      const cloudAt = Number(data.updatedAt) || Date.now()
      writeSyncMeta({ cloudUpdatedAt: cloudAt, localUpdatedAt: cloudAt }, id)
      cloudOk.value = true
      lastError.value = ''
      // Drop persisted tab password; keep in-memory unlock for this session
      clearSessionPassword()
      return true
    } catch (e) {
      cloudOk.value = false
      lastError.value =
        e?.code === 'timeout' ? '云端同步超时，本机已保存，可稍后在设置里重试' : 'push_failed'
      return false
    }
  }

  async function fetchVaultRecord(emailNorm) {
    const headers = {}
    if (emailProof.value) headers['X-Email-Proof'] = emailProof.value
    // Prefer ?email= when known — blind cookie GET returns 400 email_required (no fd_sess)
    // and still burns IP rate limit. Cookie is still sent via credentials; server annotates sessionOk.
    if (emailNorm) {
      const emailRes = await fetch(apiUrl(`/api/vault?email=${encodeURIComponent(emailNorm)}`), {
        credentials: 'include',
        headers,
      })
      if (!emailRes.ok) return emailRes
      return { ok: true, status: 200, data: await emailRes.json() }
    }
    // No email: cookie-bound GET only (fd_sess signed session)
    const cookieRes = await fetch(apiUrl('/api/vault'), { credentials: 'include', headers })
    if (cookieRes.status === 429) return cookieRes
    if (cookieRes.ok) {
      const data = await cookieRes.json()
      return { ok: true, status: 200, data }
    }
    return cookieRes
  }

  async function pullCloud(emailNorm, password) {
    try {
      const res = await fetchVaultRecord(emailNorm)
      if (res.status === 404) return null
      if (res.status === 429) {
        let data = res.data
        if (!data && typeof res.json === 'function') {
          data = await res.json().catch(() => ({}))
        }
        return { error: data?.message || '登录尝试过于频繁，请稍后再试' }
      }
      if (res.status === 503) {
        let data = res.data
        if (!data && typeof res.json === 'function') {
          data = await res.json().catch(() => ({}))
        }
        return {
          error: data?.message || '云端保险箱未配置（缺少 BLOB），本机已有账号仍可登录',
        }
      }
      if (!res.ok) {
        return { error: '暂时连不上云端，本机已有账号仍可登录；新设备请稍后重试' }
      }
      const data = res.data
      if (!data?.salt || !data?.passwordHash || !data?.enc) return null
      const ok = await verifyPassword(password, data.salt, data.passwordHash)
      if (!ok) return { error: 'bad_password' }
      const vault = await decryptJson(password, data.salt, data.enc.iv, data.enc.payload)
      return {
        account: {
          accountId: data.accountId,
          email: data.email,
          displayName: data.displayName,
          salt: data.salt,
          passwordHash: data.passwordHash,
          createdAt: data.createdAt,
        },
        vault,
        updatedAt: Number(data.updatedAt) || 0,
        sessionOk: !!data.sessionOk,
      }
    } catch {
      return { error: '暂时连不上云端，本机已有账号仍可登录' }
    }
  }

  /** Login without OTP: server verifies password, sets session cookie, returns enc vault. */
  async function pullCloudWithPassword(emailNorm, password) {
    try {
      const res = await fetch(apiUrl('/api/vault'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ login: true, email: emailNorm, password }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.status === 404) return null
      if (res.status === 401) return { error: 'bad_password' }
      if (res.status === 429) {
        return { error: data?.message || '登录尝试过于频繁，请稍后再试' }
      }
      if (res.status === 503) {
        return {
          error: data?.message || '云端保险箱未配置（缺少 BLOB），本机已有账号仍可登录',
        }
      }
      if (!res.ok) {
        return {
          error: data?.message || '暂时连不上云端，本机已有账号仍可登录；新设备请稍后重试',
        }
      }
      if (!data?.salt || !data?.passwordHash || !data?.enc) return null
      const vault = await decryptJson(password, data.salt, data.enc.iv, data.enc.payload)
      writeSyncMeta(
        { cloudUpdatedAt: Number(data.updatedAt) || Date.now(), localUpdatedAt: Number(data.updatedAt) || Date.now() },
        data.accountId,
      )
      return {
        account: {
          accountId: data.accountId,
          email: data.email,
          displayName: data.displayName,
          salt: data.salt,
          passwordHash: data.passwordHash,
          createdAt: data.createdAt,
        },
        vault,
        updatedAt: Number(data.updatedAt) || 0,
        sessionOk: !!data.sessionOk,
      }
    } catch {
      return { error: '暂时连不上云端，本机已有账号仍可登录' }
    }
  }

  /**
   * Manual sync: push; on conflict pull+import remote then optional force push of local.
   * @returns {{ ok: boolean, message: string }}
   */
  async function syncNow(password) {
    lastError.value = ''
    let ok = await pushCloud(password)
    if (ok) return { ok: true, message: '已同步到云端' }
    if (lastError.value === 'need_password') {
      return { ok: false, message: 'need_password' }
    }
    if (lastError.value === 'conflict') {
      const pw = password || getVaultUnlock()
      const emailNorm = session.value?.email
      if (!pw || !emailNorm) {
        return { ok: false, message: '云端有更新，请重新登录后同步' }
      }
      const remote = await pullCloud(emailNorm, pw)
      if (!remote?.vault) {
        return { ok: false, message: '拉取云端失败，请稍后重试' }
      }
      const id = getActiveAccountId()
      const winner = pickVaultWinner(id, remote.updatedAt)
      if (winner === 'local') {
        ok = await pushCloud(pw, { force: true })
        return {
          ok,
          message: ok ? '本机较新，已覆盖云端' : '覆盖云端失败',
        }
      }
      importVault(id, remote.vault, { cloudUpdatedAt: remote.updatedAt })
      cloudOk.value = true
      return { ok: true, message: '已拉取云端更新到本机' }
    }
    return {
      ok: false,
      message:
        lastError.value === 'auth'
          ? '会话失效，请重新登录后再同步'
          : '同步失败（网络或云端未配置）',
    }
  }

  /**
   * Logged-in change: re-encrypt vault with new password (no data loss).
   */
  async function changePassword({ oldPassword, newPassword }) {
    lastError.value = ''
    const id = getActiveAccountId()
    if (!id) {
      lastError.value = '请先登录'
      return false
    }
    const accounts = listAccounts()
    const idx = accounts.findIndex((a) => a.accountId === id)
    if (idx < 0) {
      lastError.value = '本地账号不存在'
      return false
    }
    const account = accounts[idx]
    const strength = validatePasswordStrength(newPassword)
    if (!strength.ok) {
      lastError.value = strength.message || '新密码不符合要求'
      return false
    }
    if (String(oldPassword) === String(newPassword)) {
      lastError.value = '新密码不能与当前密码相同'
      return false
    }
    busy.value = true
    try {
      const ok = await verifyPassword(oldPassword, account.salt, account.passwordHash)
      if (!ok) {
        lastError.value = '当前密码错误'
        return false
      }
      const { hash, salt } = await hashPassword(newPassword)
      accounts[idx] = { ...account, salt, passwordHash: hash }
      saveAccounts(accounts)
      setVaultUnlock(newPassword)
      sessionStorage.setItem(SESSION_PW_KEY, newPassword)
      const pushed = await pushCloud(newPassword, { force: true })
      clearSessionPassword()
      if (!pushed) {
        // Roll back local credentials if cloud refused
        accounts[idx] = account
        saveAccounts(accounts)
        setVaultUnlock(oldPassword)
        lastError.value = lastError.value || '云端改密失败，本机未改动'
        return false
      }
      lastError.value = ''
      return true
    } catch (e) {
      console.error(e)
      lastError.value = '改密失败，请重试'
      return false
    } finally {
      busy.value = false
    }
  }

  /**
   * Forgot password: OTP proves email. Vault is E2E — old ciphertext cannot be recovered.
   * Wipes local + cloud vault to a fresh desk under the same accountId.
   */
  async function resetPassword({
    email: rawEmail,
    phone: rawPhone,
    channel = 'email',
    password,
    emailProof: proofFromUi,
  }) {
    lastError.value = ''
    const ch = channel === 'sms' ? 'sms' : 'email'
    let emailNorm = ''
    let phoneNorm = ''
    if (ch === 'sms') {
      phoneNorm = normalizeMainlandPhone(rawPhone || rawEmail)
      if (!phoneNorm) {
        lastError.value = '请填写有效的大陆手机号'
        return false
      }
      emailNorm = smsVaultEmail(phoneNorm)
    } else {
      emailNorm = String(rawEmail || '')
        .trim()
        .toLowerCase()
    }
    if (proofFromUi) {
      emailProof.value = proofFromUi
      emailProofEmail.value = emailNorm
      emailProofPurpose.value = 'reset'
    }
    if (!requireEmailProof(emailNorm, 'reset')) return false
    const strength = validatePasswordStrength(password)
    if (!strength.ok) {
      lastError.value = strength.message || '密码不符合要求'
      return false
    }
    busy.value = true
    try {
      const res = await fetchVaultRecord(emailNorm)
      if (res.status === 404) {
        lastError.value = '云端无此账号，请先注册'
        return false
      }
      if (!res.ok) {
        lastError.value = '无法读取云端账号，请稍后重试'
        return false
      }
      const data = res.data
      if (!data?.accountId) {
        lastError.value = '云端账号数据不完整'
        return false
      }

      const { hash, salt } = await hashPassword(password)
      let accounts = listAccounts()
      let account = accounts.find((a) => a.email === emailNorm || a.accountId === data.accountId)
      const nextAccount = {
        accountId: data.accountId,
        email: emailNorm,
        phone: phoneNorm || account?.phone || undefined,
        displayName: data.displayName || account?.displayName || emailNorm.split('@')[0],
        salt,
        passwordHash: hash,
        createdAt: data.createdAt || account?.createdAt || Date.now(),
      }
      if (account) {
        accounts = accounts.map((a) =>
          a.accountId === data.accountId || a.email === emailNorm ? nextAccount : a,
        )
      } else {
        accounts.push(nextAccount)
      }
      saveAccounts(accounts)

      const vaultSnap = snapshotVaultKeys(data.accountId)
      const accountsSnap = listAccounts().map((a) => ({ ...a }))

      initFreshVault(data.accountId)
      localStorage.setItem(
        `fd_v1:${data.accountId}:fd_user`,
        JSON.stringify({
          nickname: nextAccount.displayName,
          email: ch === 'email' ? emailNorm : '',
          phone: phoneNorm || '',
          career: '',
          risk: '平衡型',
          age: null,
          report_hour: 8,
          report_minute: 0,
          strategy: '平衡型',
          push_email: false,
          push_wechat: false,
          serverchan_key: '',
          designStyle: 'luxury',
        }),
      )

      const sess = {
        accountId: data.accountId,
        email: emailNorm,
        phone: phoneNorm || undefined,
        displayName: nextAccount.displayName,
        at: Date.now(),
      }
      setSession(sess)
      session.value = sess
      setVaultUnlock(password)
      sessionStorage.setItem(SESSION_PW_KEY, password)

      const pushed = await pushCloud(password, { force: true })
      clearSessionPassword()
      if (!pushed) {
        restoreVaultSnapshot(vaultSnap)
        saveAccounts(accountsSnap)
        clearSessionArtifacts()
        clearVaultUnlock()
        session.value = null
        lastError.value = lastError.value || '重置失败：无法写入云端，请稍后重试'
        return false
      }
      clearEmailProof()
      cloudOk.value = true
      return true
    } catch (e) {
      console.error(e)
      lastError.value = '重置失败，请重试'
      return false
    } finally {
      busy.value = false
    }
  }

  function tryLegacyImport() {
    if (!shouldOfferLegacyImport()) return false
    const ok = importLegacyIntoActive()
    markLegacyOffered()
    return ok
  }

  return {
    session,
    busy,
    lastError,
    cloudOk,
    emailProof,
    emailProofEmail,
    emailProofPurpose,
    emailVerified,
    lastDevCode,
    codeCooldownSec,
    isLoggedIn,
    isGuest,
    email,
    displayName,
    hydrate,
    sendEmailCode,
    verifyEmailCode,
    clearEmailProof,
    register,
    login,
    logout,
    pushCloud,
    syncNow,
    changePassword,
    resetPassword,
    tryLegacyImport,
    shouldOfferLegacyImport,
  }
})
