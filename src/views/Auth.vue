<template>
  <div class="auth">
    <div class="auth-card">
      <a class="auth-brand" href="/" @click="onNavClick($event, '/')">FinDigest</a>
      <h1 class="auth-h1">
        {{
          mode === 'login' ? '欢迎回来' : mode === 'reset' ? '重置密码' : '建一个只属于你的账号'
        }}
      </h1>
      <p class="auth-lead">
        {{
          mode === 'login'
            ? '邮箱加密码即可进入。还没有账号就先注册。'
            : mode === 'reset'
              ? '验证码通过后设新密码。忘记旧密码会清空云端持仓与画像，无法找回。'
              : '先验证邮箱，再设密码。空白账号，没有别人的演示股单。'
        }}
      </p>

      <p v-if="!otpReady" class="auth-warn" role="status">
        验证码服务暂不可用，请稍后再试或联系管理员。
      </p>

      <div class="channel-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          class="channel-tab"
          :aria-selected="channel === 'email'"
          :class="{ on: channel === 'email' }"
          @click="setChannel('email')"
        >
          邮箱
        </button>
        <button
          type="button"
          role="tab"
          class="channel-tab"
          :aria-selected="channel === 'sms'"
          :aria-disabled="!smsAvailable"
          :class="{ on: channel === 'sms', off: !smsAvailable }"
          :title="smsAvailable ? undefined : '手机注册暂未开放'"
          @click="setChannel('sms')"
        >
          手机短信<span v-if="!smsAvailable" class="channel-tag">暂未开放</span>
        </button>
      </div>
      <p v-if="!smsAvailable" class="auth-sms-note" :class="{ flash: smsTapHint }" role="status">
        手机注册/登录暂时还不能用，请先用<strong>邮箱</strong>完成注册与登录。
      </p>

      <form class="auth-form" @submit.prevent="submit">
        <label v-if="mode === 'register'" class="fld">
          <span>昵称</span>
          <input v-model="displayName" type="text" maxlength="24" placeholder="怎么称呼你" autocomplete="nickname" />
        </label>

        <p v-if="mode === 'reset'" class="auth-warn" role="status">
          重置会清空该账号云端与本机的持仓、简报与画像。记得密码请用设置里的「修改密码」。
        </p>

        <label v-if="channel === 'email'" class="fld">
          <span>邮箱</span>
          <input
            v-model="email"
            type="email"
            required
            placeholder="you@qq.com"
            autocomplete="username"
            @change="onIdentityChange"
          />
        </label>
        <label v-else class="fld">
          <span>手机号</span>
          <input
            v-model="phone"
            type="tel"
            required
            inputmode="numeric"
            maxlength="11"
            placeholder="11 位大陆手机号"
            autocomplete="tel"
            @change="onIdentityChange"
          />
        </label>

        <div v-if="mode !== 'login'" class="otp-row">
          <label class="fld otp-fld">
            <span>{{ channel === 'sms' ? '短信验证码' : '邮箱验证码' }}</span>
            <input
              v-model="code"
              type="text"
              inputmode="numeric"
              pattern="[0-9]*"
              maxlength="6"
              required
              placeholder="6 位数字"
              autocomplete="one-time-code"
              :disabled="auth.emailVerified && verifiedForMode"
            />
          </label>
          <button
            class="btn otp-send"
            type="button"
            :disabled="auth.busy || auth.codeCooldownSec > 0 || !identityLooksOk"
            @click="sendCode"
          >
            {{
              auth.codeCooldownSec > 0
                ? `${auth.codeCooldownSec}s`
                : codeSent
                  ? '重新获取'
                  : '获取验证码'
            }}
          </button>
        </div>

        <p v-if="mode !== 'login' && auth.lastDevCode" class="auth-dev">
          本地开发验证码：<strong>{{ auth.lastDevCode }}</strong>
          <span>（未配置阿里云发信时显示）</span>
        </p>
        <p v-else-if="mode !== 'login' && codeSent && !auth.emailVerified" class="auth-hint">
          {{ channel === 'sms' ? '验证码已发送，请查收短信' : '验证码已发送，请查收邮箱（含垃圾箱）' }}
        </p>
        <p v-if="mode !== 'login' && auth.emailVerified && verifiedForMode" class="auth-ok">
          {{ channel === 'sms' ? '手机' : '邮箱' }}已验证，可继续{{
            mode === 'reset' ? '重置' : '注册'
          }}
        </p>

        <label class="fld">
          <span>{{ mode === 'reset' ? '新密码' : '密码' }}</span>
          <input
            v-model="password"
            type="password"
            required
            :minlength="mode === 'login' ? 6 : 8"
            :placeholder="mode === 'login' ? '密码' : '至少 8 位，含字母和数字'"
            :autocomplete="mode === 'login' ? 'current-password' : 'new-password'"
          />
        </label>
        <div v-if="(mode === 'register' || mode === 'reset') && password" class="pw-meter" aria-live="polite">
          <div class="pw-meter-track">
            <div class="pw-meter-fill" :data-score="strength.score" :style="{ width: `${(strength.score / 4) * 100}%` }" />
          </div>
          <p class="pw-meter-label">
            强度：{{ strength.label }}
            <span v-if="strength.message"> · {{ strength.message }}</span>
          </p>
        </div>
        <p v-if="auth.lastError" class="auth-err">{{ auth.lastError }}</p>
        <button
          class="btn bp auth-submit"
          type="submit"
          :disabled="!canSubmit"
        >
          {{ submitLabel }}
        </button>
      </form>

      <p class="auth-switch">
        <template v-if="mode === 'login'">
          还没有账号？
          <button type="button" class="link" @click="switchMode('register')">注册</button>
          ·
          <button type="button" class="link" @click="switchMode('reset')">忘记密码</button>
        </template>
        <template v-else-if="mode === 'reset'">
          想起密码了？
          <button type="button" class="link" @click="switchMode('login')">去登录</button>
        </template>
        <template v-else>
          已有账号？
          <button type="button" class="link" @click="switchMode('login')">登录</button>
        </template>
      </p>
      <p v-if="mode === 'register'" class="auth-note">若以前注册没写进云端，再注册一次即可。</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/store/auth'
import { useBillingStore } from '@/store/billing'
import { useUserStore, resolvePostAuthPath, editionFromRedirect } from '@/store/user'
import { usePortfolioStore } from '@/store/portfolio'
import { useEventStore } from '@/store/event'
import { validatePasswordStrength } from '@/services/crypto.js'
import { apiUrl, fetchTimed } from '@/services/apiClient.js'
import { normalizeMainlandPhone, smsVaultEmail } from '@/utils/phone.js'
import { onNavClick } from '@/utils/navHref.js'

const auth = useAuthStore()
const billing = useBillingStore()
const user = useUserStore()
const portfolio = usePortfolioStore()
const events = useEventStore()
const router = useRouter()
const route = useRoute()

const mode = ref(
  route.query.mode === 'register' ? 'register' : route.query.mode === 'reset' ? 'reset' : 'login',
)
const channel = ref(route.query.channel === 'sms' ? 'sms' : 'email')
const email = ref('')
const phone = ref('')
const password = ref('')
const displayName = ref('')
const code = ref('')
const codeSent = ref(false)
const submitting = ref(false)
const smsAvailable = ref(false)
const otpReady = ref(true)
const smsTapHint = ref(false)

onMounted(async () => {
  try {
    const res = await fetchTimed(apiUrl('/api/auth'), { method: 'GET' }, 8000)
    const data = await res.json()
    smsAvailable.value = !!data?.smsConfigured
    otpReady.value = !!(data?.ok && data?.otpSecret)
    if (!smsAvailable.value && channel.value === 'sms') channel.value = 'email'
  } catch {
    smsAvailable.value = false
  }
})

const strength = computed(() => validatePasswordStrength(password.value))
const emailLooksOk = computed(() => /.+@.+\..+/.test(String(email.value || '').trim()))
const phoneLooksOk = computed(() => !!normalizeMainlandPhone(phone.value))
const identityLooksOk = computed(() => (channel.value === 'sms' ? phoneLooksOk.value : emailLooksOk.value))

function proofIdentity() {
  if (channel.value === 'sms') return smsVaultEmail(phone.value)
  return String(email.value || '')
    .trim()
    .toLowerCase()
}

const verifiedForMode = computed(
  () =>
    auth.emailVerified &&
    String(auth.emailProofEmail || '') === proofIdentity() &&
    auth.emailProofPurpose === mode.value,
)

const submitLabel = computed(() => {
  if (auth.busy || submitting.value) return '请稍候…'
  if (mode.value === 'login') return '登录'
  const needVerify = !auth.emailVerified || !verifiedForMode.value
  if (mode.value === 'reset') return needVerify ? '验证并重置' : '重置并进入'
  return needVerify ? '验证并注册' : '注册并进入'
})

const canSubmit = computed(() => {
  if (auth.busy || submitting.value) return false
  if (mode.value === 'login') return true
  if (!otpReady.value) return false
  if ((mode.value === 'register' || mode.value === 'reset') && !strength.ok) return false
  return true
})

function resetOtpState() {
  code.value = ''
  codeSent.value = false
  if (typeof auth.clearEmailProof === 'function') auth.clearEmailProof()
  else {
    auth.emailProof = ''
    auth.emailProofEmail = ''
    auth.emailProofPurpose = ''
    auth.lastDevCode = ''
  }
  auth.lastError = ''
}

watch(mode, () => {
  resetOtpState()
})

function switchMode(next) {
  mode.value = next
  const q = { ...route.query, mode: next }
  router.replace({ query: q }).catch(() => {})
}

watch(
  () => route.query.mode,
  (m) => {
    const next = m === 'register' ? 'register' : m === 'reset' ? 'reset' : 'login'
    if (mode.value !== next) mode.value = next
  },
)

function setChannel(next) {
  if (next === 'sms' && !smsAvailable.value) {
    smsTapHint.value = true
    return
  }
  if (channel.value === next) return
  channel.value = next
  resetOtpState()
}

function onIdentityChange() {
  resetOtpState()
}

async function sendCode() {
  const ok = await auth.sendEmailCode({
    channel: channel.value,
    email: email.value,
    phone: phone.value,
    purpose: mode.value,
  })
  if (ok) {
    codeSent.value = true
    if (auth.lastDevCode) code.value = auth.lastDevCode
  }
}

async function submit() {
  if (submitting.value || auth.busy) return
  submitting.value = true
  try {
    if (mode.value !== 'login') {
      if (!auth.emailVerified || !verifiedForMode.value) {
        const verified = await auth.verifyEmailCode({
          channel: channel.value,
          email: email.value,
          phone: phone.value,
          purpose: mode.value,
          code: code.value,
        })
        if (!verified) return
      }
    }

    let ok = false
    if (mode.value === 'login') {
      ok = await auth.login({
        channel: channel.value,
        email: email.value,
        phone: phone.value,
        password: password.value,
      })
    } else if (mode.value === 'reset') {
      ok = await auth.resetPassword({
        channel: channel.value,
        email: email.value,
        phone: phone.value,
        password: password.value,
      })
    } else {
      ok = await auth.register({
        channel: channel.value,
        email: email.value,
        phone: phone.value,
        password: password.value,
        displayName: displayName.value,
      })
    }
    if (!ok) return

    user.hydrate()
    await billing.hydrate()
    user.syncEditionFromEntitlements({ silent: true })
    const ed = editionFromRedirect(route.query.redirect)
    if (ed === 'basic' || ed === 'pro') {
      user.setProductEdition(ed, { silent: true })
    }
    if (auth.lastError && (mode.value === 'register' || mode.value === 'login')) {
      user.toast(auth.lastError)
    }
    const dest = resolvePostAuthPath(route.query.redirect)
    await router.replace(dest)
    void Promise.all([portfolio.load(), events.load()])
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
/* Hallmark · component: auth-card · genre: editorial · theme: museum-desk
 * states: default · hover · focus · active · disabled · loading · error · success
 * contrast: pass
 */
.auth {
  min-height: 100dvh;
  display: grid;
  place-items: start center;
  padding: max(32px, env(safe-area-inset-top, 0px)) 20px max(32px, env(safe-area-inset-bottom, 0px));
  background: var(--bg, #0a0b0c);
  color: var(--tp, #ece6d8);
  font-family: var(--font);
}
.auth-card {
  width: min(420px, 100%);
  margin-top: min(8vh, 56px);
  animation: rise 0.7s cubic-bezier(0.22, 1, 0.36, 1) both;
}
@media (hover: none) and (pointer: coarse) {
  .auth-card {
    animation: none;
  }
}
.auth-brand {
  display: inline-block;
  margin: 0 0 1rem;
  font-size: 1.2rem;
  font-weight: 700;
  letter-spacing: -0.03em;
  color: inherit;
  text-decoration: none;
}
.auth-brand:hover,
.auth-brand:focus-visible {
  color: var(--accent, #c5a059);
}
.auth-h1 {
  margin: 0 0 0.6rem;
  font-size: clamp(1.45rem, 5vw, 1.75rem);
  font-weight: 650;
  font-style: normal;
  letter-spacing: -0.035em;
  line-height: 1.25;
  overflow-wrap: anywhere;
}
.auth-lead {
  margin: 0 0 1.1rem;
  font-size: 0.92rem;
  line-height: 1.55;
  color: var(--ts, #9a9488);
  max-width: 36em;
}
.auth-warn {
  margin: 0 0 1rem;
  padding: 10px 12px;
  font-size: 0.85rem;
  line-height: 1.5;
  color: #e8c48a;
  background: var(--warn-soft, rgba(197, 160, 89, 0.12));
  border: 1px solid var(--accent-ring, rgba(197, 160, 89, 0.28));
  border-radius: var(--rb, 2px);
}
.channel-tabs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0;
  margin: 0 0 1rem;
  border: 1px solid var(--sep, rgba(236, 230, 216, 0.12));
  border-radius: var(--rb, 2px);
  overflow: hidden;
}
.channel-tab {
  min-height: 44px;
  height: 44px;
  border: 0;
  background: transparent;
  color: var(--ts, #9a9488);
  font: inherit;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
}
.channel-tab:hover:not(:disabled) {
  color: var(--tp, #ece6d8);
  background: rgba(236, 230, 216, 0.04);
}
.channel-tab:focus-visible {
  outline: 2px solid var(--accent, #c5a059);
  outline-offset: -2px;
}
.channel-tab:active:not(:disabled) {
  transform: scale(0.98);
}
.channel-tab.on {
  background: var(--accent-soft, rgba(197, 160, 89, 0.16));
  color: var(--tp, #ece6d8);
}
.channel-tab.off {
  opacity: 0.45;
  cursor: not-allowed;
}
.channel-tag {
  margin-left: 4px;
  font-size: 0.72rem;
  font-weight: 600;
  opacity: 0.85;
}
.auth-sms-note {
  margin: 0 0 1.1rem;
  padding: 10px 12px;
  font-size: 0.88rem;
  line-height: 1.5;
  color: #e8c48a;
  background: var(--warn-soft, rgba(197, 160, 89, 0.1));
  border: 1px solid var(--accent-ring, rgba(197, 160, 89, 0.28));
  border-radius: var(--rb, 2px);
}
.auth-sms-note.flash {
  border-color: var(--accent, #c5a059);
  background: rgba(197, 160, 89, 0.2);
}
.auth-sms-note strong {
  color: var(--tp, #ece6d8);
  font-weight: 650;
}
.auth-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.fld {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.fld span {
  font-size: 12px;
  font-weight: 600;
  color: var(--ts, #9a9488);
  letter-spacing: 0.04em;
}
.fld input {
  height: 48px;
  padding: 0 14px;
  border-radius: var(--rb, 2px);
  border: 1px solid var(--sep, rgba(236, 230, 216, 0.12));
  background: rgba(255, 255, 255, 0.04);
  color: var(--tp, #ece6d8);
  font: inherit;
}
.fld input:focus {
  outline: none;
  border-color: var(--accent, #c5a059);
  box-shadow: 0 0 0 3px var(--accent-ring, rgba(197, 160, 89, 0.18));
}
.fld input:disabled {
  opacity: 0.7;
}
.otp-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10px;
  align-items: end;
}
.otp-fld {
  min-width: 0;
}
.otp-send {
  height: 48px;
  padding: 0 14px;
  border-radius: var(--rb, 2px);
  border: 1px solid var(--accent, #c5a059);
  background: transparent;
  color: var(--accent, #c5a059);
  font: inherit;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
}
.otp-send:hover:not(:disabled) {
  background: var(--accent-soft, rgba(197, 160, 89, 0.12));
}
.otp-send:focus-visible {
  outline: 2px solid var(--accent, #c5a059);
  outline-offset: 2px;
}
.otp-send:active:not(:disabled) {
  transform: scale(0.98);
}
.otp-send:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.auth-submit {
  margin-top: 6px;
  min-height: 48px;
  height: 48px;
  border: 0;
  border-radius: var(--rb, 2px);
  background: var(--accent, #c5a059);
  color: var(--on-accent, #0a0b0c);
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}
.auth-submit:hover:not(:disabled) {
  background: var(--accent-hover, #a8843f);
}
.auth-submit:focus-visible {
  outline: 2px solid var(--tp, #ece6d8);
  outline-offset: 2px;
}
.auth-submit:active:not(:disabled) {
  transform: scale(0.98);
}
.auth-submit:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.auth-err {
  margin: 0;
  color: var(--loss, #e07a6a);
  font-size: 0.88rem;
}
.auth-hint,
.auth-ok,
.auth-dev {
  margin: 0;
  font-size: 0.85rem;
  color: var(--ts, #9a9488);
}
.auth-ok {
  color: #7dba8a;
}
.auth-dev strong {
  color: var(--accent, #c5a059);
  letter-spacing: 0.08em;
}
.auth-switch {
  margin: 1.5rem 0 0;
  font-size: 0.9rem;
  color: var(--ts, #9a9488);
}
.auth-note {
  margin: 0.75rem 0 0;
  font-size: 0.78rem;
  line-height: 1.5;
  color: var(--tt, #6e6a62);
}
.link {
  border: 0;
  background: none;
  color: var(--accent, #c5a059);
  font: inherit;
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 3px;
}
.link:focus-visible {
  outline: 2px solid var(--accent, #c5a059);
  outline-offset: 2px;
}
.pw-meter {
  margin: -4px 0 0;
}
.pw-meter-track {
  height: 3px;
  background: rgba(236, 230, 216, 0.1);
  border-radius: 1px;
  overflow: hidden;
}
.pw-meter-fill {
  height: 100%;
  background: var(--accent, #c5a059);
  transition: width 0.2s ease;
}
.pw-meter-fill[data-score='1'] {
  background: var(--loss, #e07a6a);
}
.pw-meter-fill[data-score='2'] {
  background: #d4a017;
}
.pw-meter-fill[data-score='3'],
.pw-meter-fill[data-score='4'] {
  background: #7dba8a;
}
.pw-meter-label {
  margin: 6px 0 0;
  font-size: 0.78rem;
  color: var(--ts, #9a9488);
}
@keyframes rise {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
@media (max-width: 420px) {
  .otp-row {
    grid-template-columns: 1fr;
  }
  .otp-send {
    width: 100%;
  }
  .auth-h1 {
    font-size: 1.4rem;
  }
}
@media (prefers-reduced-motion: reduce) {
  .auth-card {
    animation: none;
  }
}
</style>
