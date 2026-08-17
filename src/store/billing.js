import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  readBilling,
  writeBilling,
  isProActive,
  redeemCode,
  emptyBilling,
  pullCloudBilling,
  PRO_PRICE_LABEL,
  PRO_BENEFITS,
  PRO_PLANS,
} from '@/services/billing.js'
import { getEntitlements } from '@/services/entitlements.js'
import { isLocalFreeProHost, freeProStatusLabel } from '@/services/localOwner.js'
import { getActiveAccountId } from '@/services/vault.js'
import { useUserStore } from '@/store/user'

export const useBillingStore = defineStore('billing', () => {
  const plan = ref('free')
  const proUntil = ref(null)
  const busy = ref(false)
  const lastError = ref('')
  const lastMessage = ref('')

  const localFreePro = computed(() => isLocalFreeProHost())
  // Remote: vault plan. Local: edition choice — do not treat host alone as always-Pro.
  const isPro = computed(() => {
    if (isProActive({ plan: plan.value, proUntil: proUntil.value })) return true
    if (!localFreePro.value) return false
    try {
      return useUserStore().profile?.productEdition === 'pro'
    } catch {
      return false
    }
  })
  const statusLabel = computed(() => {
    if (!isPro.value) return localFreePro.value ? `Free · 可切 Pro（${freeProStatusLabel()}）` : 'Free'
    if (localFreePro.value) return `Pro · ${freeProStatusLabel()}`
    if (!proUntil.value) return 'Pro'
    return `Pro · 至 ${new Date(proUntil.value).toLocaleDateString('zh-CN')}`
  })

  const entitlements = computed(() => {
    const user = useUserStore()
    return getEntitlements(
      { plan: plan.value, proUntil: proUntil.value },
      user.profile,
    )
  })
  const canUseProHud = computed(() => entitlements.value.canUseProHud)
  const canUseLlm = computed(() => entitlements.value.canUseLlm)
  const canSeeProNav = computed(() => entitlements.value.canSeeProNav)
  const canUseProdeskStyle = computed(() => entitlements.value.canUseProdeskStyle)
  const isBillingPro = computed(() => entitlements.value.isBillingPro)

  function applyState(state) {
    const s = state || emptyBilling()
    plan.value = s.plan || 'free'
    proUntil.value = s.proUntil ?? null
  }

  function syncUserEdition(opts = {}) {
    try {
      useUserStore().syncEditionFromEntitlements(opts)
    } catch {
      /* pinia may not be ready in rare bootstrap paths */
    }
  }

  /** Localhost: only stamp plan=pro when the owner actually chose Pro edition. */
  function ensureLocalOwnerPro() {
    if (!localFreePro.value || !getActiveAccountId()) return false
    let edition = 'basic'
    try {
      edition = useUserStore().profile?.productEdition || 'basic'
    } catch {
      edition = 'basic'
    }
    if (edition !== 'pro') return false
    const local = readBilling()
    if (isProActive(local) && local.plan === 'pro') return false
    const unlocked = {
      ...emptyBilling(),
      ...local,
      plan: 'pro',
      proUntil: null,
      localOwner: true,
      updatedAt: Date.now(),
    }
    writeBilling(unlocked)
    applyState(unlocked)
    return true
  }

  async function hydrate() {
    if (!getActiveAccountId()) {
      applyState(emptyBilling())
      syncUserEdition({ silent: true })
      return
    }
    // Prefer cloud entitlement (admin grant) when online
    try {
      await pullCloudBilling()
    } catch {
      /* local only */
    }
    const local = readBilling()
    // Local owner may stay on basic — never auto-force Pro on every hydrate
    if (localFreePro.value) {
      let edition = 'basic'
      try {
        edition = useUserStore().profile?.productEdition || 'basic'
      } catch {
        edition = 'basic'
      }
      if (edition === 'pro') {
        ensureLocalOwnerPro()
        syncUserEdition({ silent: true })
        return
      }
      // basic: keep vault, but clear sticky pro plan so shell can be Museum
      if (local.plan === 'pro' && local.localOwner) {
        const basic = { ...local, plan: 'free', proUntil: null, localOwner: true, updatedAt: Date.now() }
        writeBilling(basic)
        applyState(basic)
      } else {
        applyState(local)
      }
      syncUserEdition({ silent: true })
      return
    }
    if (local.plan === 'pro' && !isProActive(local)) {
      const expired = { ...local, plan: 'free' }
      writeBilling(expired)
      applyState(expired)
      syncUserEdition({ silent: false })
      return
    }
    applyState(local)
    syncUserEdition({ silent: false })
  }

  async function redeem(code) {
    lastError.value = ''
    lastMessage.value = ''
    busy.value = true
    try {
      const result = await redeemCode(code)
      if (!result.ok) {
        lastError.value = result.message || '开通失败'
        return false
      }
      applyState(result.billing)
      syncUserEdition({ activatePro: true, silent: true })
      lastMessage.value = result.message || 'Pro 已开通'
      return true
    } finally {
      busy.value = false
    }
  }

  function reset() {
    applyState(emptyBilling())
    lastError.value = ''
    lastMessage.value = ''
    syncUserEdition({ silent: true })
  }

  return {
    plan,
    proUntil,
    busy,
    lastError,
    lastMessage,
    isPro,
    localFreePro,
    statusLabel,
    entitlements,
    canUseProHud,
    canUseLlm,
    canSeeProNav,
    canUseProdeskStyle,
    isBillingPro,
    priceLabel: PRO_PRICE_LABEL,
    benefits: PRO_BENEFITS,
    plans: PRO_PLANS,
    hydrate,
    redeem,
    reset,
  }
})
