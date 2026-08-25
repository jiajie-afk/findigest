<template>
  <div class="nav-root" :class="{ 'nav--mobile': isMobileNav }">
    <nav class="nav" aria-label="主导航">
      <div class="ni">
        <a class="nl" :href="toHref(homeTo)" @click="onNavClick($event, toHref(homeTo), router)">
          <span class="nl-mark" aria-hidden="true">F</span>
          <span class="nl-word">
            <span class="nl-brand">
              FinDigest
              <span v-if="editionBadge" class="nl-edition">{{ editionBadge }}</span>
            </span>
            <span class="nl-tag">{{ navTag }}</span>
          </span>
        </a>
        <div class="nlinks" :aria-hidden="isMobileNav ? 'true' : 'false'">
          <a
            v-for="l in links"
            :key="l.key || (typeof l.to === 'string' ? l.to : l.to?.path)"
            :href="toHref(l.to)"
            :class="{ on: isActive(l) }"
            :tabindex="isMobileNav ? -1 : undefined"
            @click="onNavClick($event, toHref(l.to), router)"
          >
            {{ l.label }}
          </a>
        </div>
        <a
          class="nu-chip"
          :href="toHref(accountTo)"
          :class="{ on: isActive({ path: '/more', key: 'account' }) }"
          :tabindex="isMobileNav ? -1 : undefined"
          :aria-hidden="isMobileNav ? 'true' : undefined"
          @click="onNavClick($event, toHref(accountTo), router)"
        >
          <PhUser v-if="!isJournal" :size="14" :weight="'bold'" />
          {{ shortName }}
        </a>
      </div>
    </nav>

    <div class="mtabs" role="navigation" aria-label="手机导航">
      <a
        v-for="l in mobileLinks"
        :key="'m-' + (l.key || (typeof l.to === 'string' ? l.to : l.to?.path))"
        :href="toHref(l.to)"
        class="mtab"
        :class="{ on: isActive(l) }"
        @click="onNavClick($event, toHref(l.to), router)"
      >
        <component :is="iconFor(l)" class="mtab-ico" :size="20" weight="bold" aria-hidden="true" />
        <span class="mtab-lab">{{ l.mobileLabel || l.label }}</span>
      </a>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { onNavClick, toHref } from '@/utils/navHref.js'
import {
  PhUser,
  PhNewspaper,
  PhChartLineUp,
  PhBriefcase,
  PhCalendarBlank,
  PhFiles,
} from '@/components/icons.js'
import { useUserStore } from '@/store/user'
import { useAuthStore } from '@/store/auth'
import { useBillingStore } from '@/store/billing'

const user = useUserStore()
const auth = useAuthStore()
const billing = useBillingStore()
const route = useRoute()
const router = useRouter()
const isJournal = computed(() => user.designStyle === 'journal')

/** Phone / coarse-pointer: force bottom tabs even if “桌面版网站” widens the viewport. */
const MOBILE_MQ =
  '(max-width: 900px), ((max-width: 1100px) and (hover: none) and (pointer: coarse))'
const isMobileNav = ref(
  typeof window !== 'undefined' ? window.matchMedia(MOBILE_MQ).matches : false,
)
let mobileMq = null
function syncMobileNav() {
  isMobileNav.value = !!(mobileMq?.matches ?? (typeof window !== 'undefined' && window.innerWidth <= 900))
}
onMounted(() => {
  mobileMq = window.matchMedia(MOBILE_MQ)
  syncMobileNav()
  mobileMq.addEventListener?.('change', syncMobileNav)
})
onUnmounted(() => {
  mobileMq?.removeEventListener?.('change', syncMobileNav)
})

const isPreviewPro = computed(() => route.name === 'preview-prodesk')
const isPreviewBasic = computed(() => route.name === 'preview-basic')
const isPreview = computed(() => isPreviewPro.value || isPreviewBasic.value)

const isPro = computed(() => billing.canSeeProNav || isPreviewPro.value)
const navTag = computed(() => {
  if (isPreviewBasic.value) return 'Museum Desk'
  if (isPro.value) return 'Pro Desk'
  if (user.designStyle === 'journal') return 'Private Desk'
  if (user.designStyle === 'luxury') return 'Museum Desk'
  return '私人台'
})

const editionBadge = computed(() => {
  if (isPreviewBasic.value) return '基础'
  if (billing.canSeeProNav || isPreviewPro.value) return '专业'
  if (user.isBasicEdition || !billing.isBillingPro) return '基础'
  return ''
})

const shortName = computed(() => {
  const n = auth.displayName || user.nickname || '我'
  return n.length > 6 ? n.slice(0, 6) : n
})

const homeTo = computed(() => {
  if (isPreviewPro.value) return '/preview/prodesk'
  if (isPreviewBasic.value) return '/preview/basic'
  return '/app'
})

const accountTo = computed(() => {
  if (isPreview.value) {
    const dest = isPreviewPro.value ? '/app?edition=pro' : '/app?edition=basic'
    return { path: '/auth', query: { redirect: dest } }
  }
  return '/more'
})

const links = computed(() => {
  if (isPreviewBasic.value) {
    return [
      { key: 'pb-today', to: '/preview/basic', label: '今日' },
      { key: 'pb-more', to: { path: '/auth', query: { redirect: '/app?edition=basic' } }, label: '登录' },
    ]
  }
  if (isPreviewPro.value) {
    return [
      { key: 'pp-today', to: '/preview/prodesk', label: '今日' },
      { key: 'pp-login', to: { path: '/auth', query: { redirect: '/app?edition=pro' } }, label: '登录' },
    ]
  }
  if (isPro.value) {
    return [
      { key: 'today', to: '/app', label: '今日' },
      { key: 'portfolio', to: '/portfolio', label: '持仓' },
      { key: 'workspace', to: '/workspace', label: '工作区', mobileLabel: '工作' },
      { key: 'events', to: '/events', label: '事件' },
      { key: 'reports', to: '/reports', label: '报告' },
      { key: 'more', to: '/more', label: '我的' },
    ]
  }
  return [
    { key: 'today', to: '/app', label: '今日' },
    { key: 'portfolio', to: '/portfolio', label: '持仓' },
    { key: 'events', to: '/events', label: '事件' },
    { key: 'more', to: '/more', label: '我的' },
  ]
})

/** Same destinations as desktop; Pro keeps all six (compact). */
const mobileLinks = computed(() => links.value)

function iconFor(l) {
  const path = typeof l.to === 'string' ? l.to : l.to?.path || ''
  const label = l.label || ''
  if (path.includes('portfolio') || label === '持仓') return PhChartLineUp
  if (path.includes('workspace') || label === '工作区') return PhBriefcase
  if (path.includes('events') || label === '事件') return PhCalendarBlank
  if (path.includes('reports') || label === '报告') return PhFiles
  if (path.includes('more') || path.includes('auth') || label === '我的' || label === '登录') return PhUser
  return PhNewspaper
}

function isActive(link) {
  const l = typeof link === 'string' ? { to: link } : link || {}
  const rawTo = l.to ?? l.path ?? (typeof link === 'string' ? link : '')
  const path = typeof rawTo === 'string' ? rawTo : rawTo?.path || ''
  const key = l.key

  if (isPreviewBasic.value) {
    if (key === 'pb-today') return route.name === 'preview-basic'
    if (key === 'pb-more') return route.path.startsWith('/auth')
    return false
  }
  if (isPreviewPro.value) {
    if (key === 'pp-today') return route.name === 'preview-prodesk'
    if (key === 'pp-login') return route.path.startsWith('/auth')
    return false
  }

  if (path === '/app' || path === '/preview/basic' || path === '/preview/prodesk') {
    if (key === 'today' || !key) return route.path === '/app' || route.path === '/app/'
    return false
  }
  if (path === '/portfolio' || key === 'portfolio') {
    return route.path.startsWith('/portfolio') || route.path.startsWith('/stock')
  }
  if (path === '/workspace' || key === 'workspace') return route.path.startsWith('/workspace')
  if (path === '/events' || key === 'events') return route.path.startsWith('/events')
  if (path === '/reports' || key === 'reports') return route.path.startsWith('/reports')
  if (path === '/more' || key === 'more' || key === 'account') {
    if (
      isPro.value &&
      !isPreview.value &&
      (route.path.startsWith('/workspace') ||
        route.path.startsWith('/events') ||
        route.path.startsWith('/reports'))
    ) {
      return false
    }
    return (
      route.path.startsWith('/more') ||
      route.path.startsWith('/pricing') ||
      route.path.startsWith('/settings') ||
      route.path.startsWith('/passport') ||
      route.path.startsWith('/auth') ||
      (!isPro.value && route.path.startsWith('/workspace')) ||
      (!isPro.value && route.path.startsWith('/reports'))
    )
  }
  if (path === '/auth') return route.path.startsWith('/auth')
  if (!path) return false
  return route.path.startsWith(path)
}
</script>

<style scoped>
.mtabs {
  display: none;
}

.nav--mobile .nlinks,
.nav--mobile .nu-chip {
  display: none !important;
}

.nav--mobile .mtabs {
  display: flex !important;
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 200;
  align-items: stretch;
  justify-content: space-around;
  gap: 0;
  min-height: 56px;
  padding: 4px 4px calc(4px + env(safe-area-inset-bottom, 0px));
  background: color-mix(in srgb, var(--bg) 94%, transparent);
  backdrop-filter: saturate(140%) blur(16px);
  -webkit-backdrop-filter: saturate(140%) blur(16px);
  border-top: 1px solid var(--sep);
  box-shadow: 0 -8px 24px rgba(0, 0, 0, 0.08);
}

.nav--mobile .mtab {
  flex: 1 1 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  min-height: 48px;
  min-width: 0;
  padding: 6px 2px;
  text-decoration: none;
  color: var(--ts);
  font-size: 10px;
  font-weight: 550;
  letter-spacing: 0.02em;
  border-radius: var(--rb, 6px);
  box-sizing: border-box;
  touch-action: manipulation;
  -webkit-tap-highlight-color: color-mix(in srgb, var(--accent) 28%, transparent);
  transition:
    color 0.15s ease,
    background 0.15s ease;
}

.nav--mobile .mtab-ico {
  flex-shrink: 0;
  opacity: 0.85;
}

.nav--mobile .mtab-lab {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.15;
}

.nav--mobile .mtab.on {
  color: var(--tp);
  font-weight: 700;
  box-shadow: inset 0 2px 0 var(--accent);
}

.nav--mobile .mtab.on .mtab-ico {
  opacity: 1;
  color: var(--accent);
}

.nav--mobile .mtabs:has(.mtab:nth-child(6)) .mtab-lab {
  font-size: 9px;
  letter-spacing: 0;
}

.nav--mobile .mtab:active {
  background: var(--accent-soft);
}

:global(.app-shell:not(.is-landing):has(.nav--mobile)) {
  padding-bottom: calc(60px + env(safe-area-inset-bottom, 0px));
}

/* Fallback when JS not yet hydrated: CSS-only ≤900px */
@media (max-width: 900px) {
  .mtabs {
    display: flex;
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 200;
    align-items: stretch;
    justify-content: space-around;
    min-height: 56px;
    padding: 4px 4px calc(4px + env(safe-area-inset-bottom, 0px));
    background: color-mix(in srgb, var(--bg) 94%, transparent);
    backdrop-filter: saturate(140%) blur(16px);
    -webkit-backdrop-filter: saturate(140%) blur(16px);
    border-top: 1px solid var(--sep);
    box-shadow: 0 -8px 24px rgba(0, 0, 0, 0.08);
  }

  .mtab {
    flex: 1 1 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    min-height: 48px;
    min-width: 0;
    padding: 6px 2px;
    text-decoration: none;
    color: var(--ts);
    font-size: 10px;
    font-weight: 550;
    border-radius: var(--rb, 6px);
    box-sizing: border-box;
  }

  .mtab.on {
    color: var(--tp);
    font-weight: 700;
  }

  .mtab.on .mtab-ico {
    color: var(--accent);
  }

  .nu-chip {
    display: none;
  }

  :global(.app-shell:not(.is-landing)) {
    padding-bottom: calc(60px + env(safe-area-inset-bottom, 0px));
  }
}

@media (prefers-reduced-motion: reduce) {
  .mtab {
    transition: none;
  }
}
</style>
