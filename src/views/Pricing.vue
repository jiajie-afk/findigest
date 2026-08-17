<template>
  <div class="page pricing">
    <header class="page-head">
      <div>
        <h1 class="pt">{{ billing.localFreePro ? 'Pro 限时免费' : '开通 Pro' }}</h1>
        <p class="pt-sub">
          <template v-if="billing.localFreePro">
            现在可直接进入专业台，无需付费或兑换码
          </template>
          <template v-else>
            基础版一直免费。Pro：专业台、直达导航、「用人话重写」简报
          </template>
          <template v-if="auth.isLoggedIn"> · 当前 {{ billing.statusLabel }}</template>
        </p>
      </div>
    </header>

    <section v-if="justUnlocked" class="pr-success">
      <p class="pr-success-t">Pro 开好了</p>
      <a class="btn bp" href="/app" @click="onNavClick($event, '/app', router)">回今日看台面</a>
    </section>

    <template v-else-if="billing.localFreePro">
      <section class="pr-contact" aria-label="限时免费">
        <p class="pr-contact-kicker">限时免费</p>
        <p class="pr-contact-lead">登录后点下方按钮即可进入 Pro Desk（HUD、工作区导航、AI 增强）。</p>
        <button
          v-if="auth.isLoggedIn"
          class="btn bp"
          type="button"
          @click="unlockFreePro"
        >
          免费进入 Pro
        </button>
        <a
          v-else
          class="btn bp"
          href="/auth?redirect=/pricing%3Fgo%3D1"
          @click="onNavClick($event, '/auth?redirect=/pricing%3Fgo%3D1', router)"
        >
          登录后免费开通
        </a>
      </section>

      <ul class="pr-list">
        <li v-for="(b, i) in billing.benefits" :key="i">{{ b }}</li>
      </ul>
    </template>

    <template v-else>
      <section class="pr-contact" aria-label="联系开通">
        <p class="pr-contact-kicker">人工开通</p>
        <p class="pr-contact-lead">加博主微信，对话码私发。</p>
        <div class="pr-wx">
          <span class="pr-wx-label">微信</span>
          <code class="pr-wx-id">z2j1j1</code>
          <button type="button" class="pr-copy" @click="copyWx">
            {{ copied ? '已复制' : '复制' }}
          </button>
        </div>
        <p class="pr-contact-note">备注「FinDigest Pro」更好认。参考档位如下，以私聊为准。</p>
      </section>

      <section class="pr-tiers" aria-label="参考档位">
        <div
          v-for="p in billing.plans"
          :key="p.id"
          class="pr-tier"
          :class="{ featured: p.featured }"
        >
          <span v-if="p.featured" class="pr-badge">最划算</span>
          <span class="pr-tier-label">{{ p.label }}</span>
          <span class="pr-tier-price"
            >{{ p.priceLabel }}<span class="pr-tier-per">{{ p.per }}</span></span
          >
          <span class="pr-tier-hint">{{ p.hint }}</span>
        </div>
      </section>

      <ul class="pr-list">
        <li v-for="(b, i) in billing.benefits" :key="i">{{ b }}</li>
      </ul>

      <details class="pr-redeem">
        <summary class="pr-h2">已有兑换码？</summary>
        <template v-if="!auth.isLoggedIn">
          <a
            class="btn bp"
            :href="toHref({ path: '/auth', query: { redirect: pricingRedirect } })"
            @click="onNavClick($event, toHref({ path: '/auth', query: { redirect: pricingRedirect } }), router)"
            >先登录再兑换</a
          >
        </template>
        <form v-else class="pr-form" @submit.prevent="onRedeem">
          <input
            v-model="code"
            class="pr-input"
            type="text"
            placeholder="粘贴兑换码"
            spellcheck="false"
            autocomplete="off"
          />
          <button class="btn bp" type="submit" :disabled="billing.busy || !code.trim()">
            {{ billing.busy ? '开通中…' : '兑换' }}
          </button>
        </form>
        <p v-if="billing.lastError" class="pr-err">{{ billing.lastError }}</p>
        <p v-else-if="billing.lastMessage" class="pr-ok">{{ billing.lastMessage }}</p>
      </details>
    </template>

    <p class="pr-back"><a href="/app" @click="onNavClick($event, '/app', router)">返回今日</a></p>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/store/auth'
import { useBillingStore } from '@/store/billing'
import { useUserStore } from '@/store/user'
import { onNavClick, toHref } from '@/utils/navHref.js'

const WX_ID = 'z2j1j1'

const auth = useAuthStore()
const billing = useBillingStore()
const user = useUserStore()
const route = useRoute()
const router = useRouter()
const code = ref('')
const justUnlocked = ref(false)
const copied = ref(false)
billing.hydrate()

const pricingRedirect = computed(() => {
  const c = String(route.query.code || '')
  return c ? `/pricing?code=${encodeURIComponent(c)}&go=1` : '/pricing'
})

async function copyWx() {
  try {
    await navigator.clipboard.writeText(WX_ID)
    copied.value = true
    user.toast('已复制微信号')
    setTimeout(() => {
      copied.value = false
    }, 1600)
  } catch {
    user.toast('复制失败，请手动添加 z2j1j1')
  }
}

function unlockFreePro() {
  billing.hydrate()
  user.setProductEdition('pro', { silent: true })
  justUnlocked.value = true
  router.replace('/app')
}

onMounted(async () => {
  if (route.query.from === 'edition') {
    const q = { ...route.query }
    delete q.from
    router.replace({ path: '/pricing', query: q })
  }
  billing.hydrate()
  if (billing.localFreePro && auth.isLoggedIn && route.query.go === '1') {
    user.setProductEdition('pro', { silent: true })
    justUnlocked.value = true
    router.replace('/app')
    return
  }
  if (billing.localFreePro && auth.isLoggedIn && billing.canUseProHud) {
    justUnlocked.value = true
  }
  if (route.query.code) {
    code.value = String(route.query.code)
  }
  if (auth.isLoggedIn && billing.canUseProHud && !billing.localFreePro) {
    justUnlocked.value = true
    return
  }
  if (auth.isLoggedIn && route.query.go === '1' && code.value.trim() && !billing.localFreePro) {
    await onRedeem()
  }
})

async function onRedeem() {
  const ok = await billing.redeem(code.value)
  if (ok) {
    user.toast(billing.lastMessage || 'Pro 已开通')
    code.value = ''
    justUnlocked.value = true
    router.replace('/app')
  } else {
    user.toast(billing.lastError || '开通失败')
  }
}
</script>

<style scoped>
/* Reading: Pro paywall sheet — preserve Desk cyan, trust-first contact, no layout thrash */
.pricing {
  --pro-cyan: #00e8c8;
  --pro-cyan-hover: #00c4aa;
  --pro-cyan-soft: rgba(0, 232, 200, 0.12);
  --pro-cyan-ring: rgba(0, 232, 200, 0.35);
}
.pricing :deep(.bp),
.pricing .bp {
  background: var(--pro-cyan);
  color: #050607;
  border-color: var(--pro-cyan);
}
.pricing :deep(.bp:hover),
.pricing .bp:hover {
  background: var(--pro-cyan-hover);
  border-color: var(--pro-cyan-hover);
}
.page-head {
  margin-bottom: 22px;
}
.pt {
  margin: 0 0 6px;
  font-size: 1.5rem;
}
.pt-sub {
  margin: 0;
  color: var(--ts);
  font-size: 13px;
  line-height: 1.5;
}
.pr-contact {
  margin-bottom: 18px;
  padding: 18px 16px;
  border: 1px solid var(--pro-cyan-ring);
  background: linear-gradient(180deg, var(--pro-cyan-soft), transparent 70%), var(--panel, var(--card));
}
.pr-contact-kicker {
  margin: 0 0 6px;
  font-size: 11px;
  font-weight: 650;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--pro-cyan);
}
.pr-contact-lead {
  margin: 0 0 14px;
  font-size: 14px;
  line-height: 1.55;
  color: var(--tp);
}
.pr-wx {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.pr-wx-label {
  font-size: 12px;
  color: var(--ts);
}
.pr-wx-id {
  font-family: var(--mono, ui-monospace, monospace);
  font-size: 1.15rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: var(--pro-cyan);
  background: transparent;
}
.pr-copy {
  height: 32px;
  padding: 0 12px;
  border: 1px solid var(--pro-cyan-ring);
  background: transparent;
  color: var(--pro-cyan);
  font: inherit;
  font-size: 12px;
  font-weight: 650;
  cursor: pointer;
}
.pr-copy:hover {
  border-color: var(--pro-cyan);
  background: var(--pro-cyan-soft);
}
.pr-contact-note {
  margin: 12px 0 0;
  font-size: 12px;
  color: var(--ts);
  line-height: 1.45;
}
.pr-tiers {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  margin-bottom: 16px;
}
@media (max-width: 640px) {
  .pr-tiers {
    grid-template-columns: 1fr;
  }
}
.pr-tier {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  padding: 14px 12px;
  border: 1px solid var(--line);
  background: var(--surface, var(--card));
  border-radius: 2px;
}
.pr-tier.featured {
  border-color: var(--pro-cyan-ring);
}
.pr-badge {
  position: absolute;
  top: 8px;
  right: 8px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: #050607;
  background: var(--pro-cyan);
  padding: 2px 6px;
}
.pr-tier-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--ts);
}
.pr-tier-price {
  font-family: var(--mono, ui-monospace, monospace);
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--pro-cyan);
}
.pr-tier-per {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--ts);
  margin-left: 2px;
}
.pr-tier-hint {
  font-size: 11px;
  color: var(--ts);
  line-height: 1.35;
}
.pr-list {
  margin: 0 0 20px;
  padding-left: 18px;
  color: var(--ts);
  font-size: 13px;
  line-height: 1.65;
}
.pr-redeem {
  margin-bottom: 8px;
  padding: 12px 0 0;
  border-top: 1px solid var(--line);
}
.pr-redeem summary {
  cursor: pointer;
  list-style: none;
}
.pr-redeem summary::-webkit-details-marker {
  display: none;
}
.pr-h2 {
  margin: 0 0 12px;
  font-size: 13px;
  font-weight: 650;
  color: var(--ts);
}
.pr-form {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.pr-input {
  flex: 1 1 220px;
  min-width: 0;
  padding: 10px 12px;
  border: 1px solid var(--line);
  background: var(--surface, var(--card));
  color: var(--tp);
  font-family: var(--mono, ui-monospace, monospace);
  font-size: 13px;
}
.pr-input:focus {
  outline: 2px solid var(--pro-cyan-ring);
  border-color: var(--pro-cyan);
}
.pr-err {
  margin: 10px 0 0;
  color: var(--loss);
  font-size: 13px;
}
.pr-ok {
  margin: 10px 0 0;
  color: var(--pro-cyan);
  font-size: 13px;
}
.pr-success {
  padding: 20px;
  border: 1px solid var(--pro-cyan-ring);
  background: var(--pro-cyan-soft);
}
.pr-success-t {
  margin: 0 0 14px;
  font-size: 16px;
  font-weight: 650;
}
.pr-back {
  margin-top: 28px;
  font-size: 13px;
}
.pr-back a {
  color: var(--ts);
}
</style>
