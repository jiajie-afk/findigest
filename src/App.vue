<template>
  <div
    class="app-shell"
    :data-theme="theme"
    :data-style="style"
    :data-edition="edition"
    :class="{ 'is-landing': hideNav }"
  >
    <template v-if="fatalError">
      <div class="app-fatal" role="alert">
        <p class="app-fatal-brand">FinDigest</p>
        <h1 class="app-fatal-title">页面出错了</h1>
        <p class="app-fatal-msg">{{ fatalError }}</p>
        <button type="button" class="btn bp" @click="retryApp">重试</button>
      </div>
    </template>
    <template v-else>
      <AppNav v-if="!hideNav && (auth.isLoggedIn || isPreviewRoute)" />
      <ProTickerStrip v-if="!hideNav && auth.isLoggedIn && billing.canUseProHud" />
      <router-view v-slot="{ Component }">
        <transition name="fade" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
      <Toast />
    </template>
  </div>
</template>

<script setup>
import { computed, onErrorCaptured, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import AppNav from '@/components/common/AppNav.vue'
import ProTickerStrip from '@/components/common/ProTickerStrip.vue'
import Toast from '@/components/common/Toast.vue'
import { useUserStore } from '@/store/user'
import { usePortfolioStore } from '@/store/portfolio'
import { useEventStore } from '@/store/event'
import { useAuthStore } from '@/store/auth'
import { useBillingStore } from '@/store/billing'
import { getActiveAccountId } from '@/services/vault.js'

const route = useRoute()
const user = useUserStore()
const portfolio = usePortfolioStore()
const events = useEventStore()
const auth = useAuthStore()
const billing = useBillingStore()

const hideNav = computed(() => !!route.meta.hideNav)
const isPreviewRoute = computed(
  () => route.name === 'preview-prodesk' || route.name === 'preview-basic',
)
const theme = computed(() => user.uiTheme || 'dark')
const style = computed(() => {
  if (route.name === 'preview-prodesk') return 'prodesk'
  if (route.name === 'preview-basic') return 'luxury'
  return user.designStyle || 'luxury'
})
const edition = computed(() => {
  if (route.name === 'preview-prodesk') return 'pro'
  if (route.name === 'preview-basic') return 'basic'
  return user.profile?.productEdition || billing.entitlements.editionProjected || ''
})
const fatalError = ref('')

onErrorCaptured((err) => {
  console.error('[App]', err)
  const msg = err?.message || '未知错误'
  // Handler / HMR stale-method noise: log only — do not blank the whole shell
  if (/is not a function|Cannot read propert/i.test(msg)) {
    return false
  }
  fatalError.value = msg
  return false
})

function retryApp() {
  fatalError.value = ''
}

// Leaving a broken view must restore the shell (e.g. auth error → open landing)
watch(
  () => route.fullPath,
  () => {
    if (fatalError.value) fatalError.value = ''
  },
)

let journalCssLoaded = false
async function ensureStyleCss() {
  if (style.value === 'journal' && !journalCssLoaded) {
    await import('./assets/styles/journal.css')
    journalCssLoaded = true
  }
}

watch(style, () => ensureStyleCss(), { immediate: true })

watch(
  () => route.query.edition,
  (want) => {
    if (!getActiveAccountId()) return
    const ed = String(want || '').toLowerCase()
    if (ed === 'basic' || ed === 'pro') {
      user.setProductEdition(ed, { silent: true })
    }
  },
)

watch(
  () => [billing.plan, billing.proUntil],
  () => {
    if (getActiveAccountId()) user.syncEditionFromEntitlements({ silent: true })
  },
)

onMounted(async () => {
  auth.hydrate()
  if (getActiveAccountId()) {
    // Load profile first, then billing — syncEditionFromEntitlements needs both.
    // user.hydrate's syncEditionStyle is entitlement-gated so Free won't flash Pro Desk.
    user.hydrate()
    // Deep-link: /app?edition=basic|pro (local switch, no paywall)
    const want = String(route.query.edition || '').toLowerCase()
    if (want === 'basic' || want === 'pro') {
      user.setProductEdition(want, { silent: true })
    }
    billing.hydrate()
    user.syncEditionFromEntitlements({ silent: true })
    await Promise.all([portfolio.load(), events.load(), ensureStyleCss()])
    user.recalibrate().catch(() => {})
  } else {
    billing.reset()
    await ensureStyleCss()
  }
})
</script>

<style scoped>
.app-fatal {
  max-width: 28rem;
  margin: 12vh auto;
  padding: 32px 24px;
  text-align: center;
}
.app-fatal-brand {
  margin: 0 0 12px;
  font-family: var(--font-display, var(--font));
  font-size: 1.25rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--tp);
}
.app-fatal-title {
  margin: 0 0 10px;
  font-size: 1.35rem;
  color: var(--tp);
}
.app-fatal-msg {
  margin: 0 0 20px;
  font-size: 14px;
  line-height: 1.5;
  color: var(--ts);
  word-break: break-word;
}
</style>
