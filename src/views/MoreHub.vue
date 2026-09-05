<template>
  <div class="page more">
    <header class="page-head">
      <div>
        <h1 class="pt">我的</h1>
        <p class="pt-sub">
          {{ auth.isGuest ? '未登录 · 登录可选' : auth.email || user.nickname }} · {{ billing.statusLabel }} ·
          {{
            isEmptyHoldings
              ? '先导入持仓。登录不是必须的。'
              : billing.canSeeProNav
                ? '专业台次要入口'
                : '次要能力都在这里'
          }}
        </p>
      </div>
    </header>

    <section v-if="!isEmptyHoldings || canEnterPro" class="sys-switch" aria-label="系统切换">
      <div class="sys-head">
        <h2 class="sys-title">系统切换</h2>
        <p class="sys-sub">
          当前：<strong>{{ user.editionLabel }}版</strong>
          <template v-if="user.isProEdition"> · 可随时回到基础版</template>
          <template v-else-if="canEnterPro"> · 可直接进专业台</template>
          <template v-else> · 进专业台需会员账号</template>
        </p>
      </div>
      <div class="sys-seg" role="group" aria-label="基础版或专业台">
        <button
          type="button"
          class="sys-seg-btn"
          :class="{ on: user.isBasicEdition }"
          :aria-pressed="user.isBasicEdition"
          @click="switchEdition('basic')"
        >
          基础版
        </button>
        <button
          type="button"
          class="sys-seg-btn"
          :class="{ on: user.isProEdition && canEnterPro }"
          :aria-pressed="user.isProEdition && canEnterPro"
          @click="switchEdition('pro')"
        >
          {{ canEnterPro ? '专业台' : '会员 / 专业台' }}
        </button>
      </div>
      <p class="sys-hint">
        {{
          canEnterPro
            ? '基础版与专业台可随时切换。登录只为同步云端，不是必须的。'
            : '切换到专业台前需登录且账号为会员，否则会打开会员开通页。'
        }}
      </p>
    </section>

    <nav class="more-list" aria-label="更多功能">
      <a
        v-for="item in items"
        :key="item.to"
        class="more-row"
        :href="item.to"
        @click="onNavClick($event, item.to, router)"
      >
        <div>
          <p class="more-t">{{ item.title }}</p>
          <p class="more-d">{{ item.desc }}</p>
        </div>
        <span class="more-arrow" aria-hidden="true">→</span>
      </a>
    </nav>

    <button
      v-if="auth.isGuest"
      type="button"
      class="btn bp more-out"
      @click="router.push({ path: '/auth', query: { redirect: '/more' } })"
    >
      登录（可选）
    </button>
    <button v-else type="button" class="btn bs more-out" @click="onLogout">退出登录</button>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { onNavClick } from '@/utils/navHref.js'
import { useUserStore } from '@/store/user'
import { useAuthStore } from '@/store/auth'
import { useBillingStore } from '@/store/billing'
import { usePortfolioStore } from '@/store/portfolio'

const user = useUserStore()
const auth = useAuthStore()
const billing = useBillingStore()
const portfolio = usePortfolioStore()
const router = useRouter()
billing.hydrate()

const canEnterPro = computed(() => !!(billing.isBillingPro || billing.localFreePro))
const isEmptyHoldings = computed(() => !(portfolio.allHoldings || []).length)

const items = computed(() => {
  const essentialsOk =
    !!user.profile.essentialsDone || !!user.profile.onboardingDone
  const base = []
  if (isEmptyHoldings.value) {
    base.push({
      to: '/portfolio?import=1',
      title: '导入持仓',
      desc: '先把股票放进来，今日和事件才有东西可看',
    })
  }
  base.push({
    to: '/settings',
    title: '私人定制与偏好',
    desc: billing.canUseProHud
      ? user.profile.onboardingDone
        ? '画像已齐 · 版本与提醒'
        : '可补全画像校准 · 版本与提醒'
      : essentialsOk
        ? '基础画像已填 · 提醒与云同步'
        : '画像可选 · 提醒与云同步',
  })
  if (!billing.canSeeProNav && !isEmptyHoldings.value) {
    base.push({
      to: billing.localFreePro ? '/settings' : '/pricing',
      title: billing.localFreePro ? '切换 Pro 专业台' : '开通 Pro',
      desc: billing.localFreePro
        ? '设置里可直接切专业台'
        : '专业台 + AI 增强；基础版仍免费',
    })
  }
  if (!isEmptyHoldings.value) {
    base.push(
      {
        to: '/passport',
        title: '画像说明书',
        desc: '纠错覆盖、现金流层、你的约束摘要',
      },
      {
        to: '/events',
        title: '事件与催化剂',
        desc: '只看与你持仓相关的，或手动添加',
      },
    )
  }
  if (!billing.canSeeProNav && !isEmptyHoldings.value) {
    base.push({
      to: '/workspace',
      title: '工作区',
      desc: '简报、行动、统计与持仓明细（进阶）',
    })
  }
  if (!isEmptyHoldings.value) {
    base.push({
      to: '/reports',
      title: '历史报告',
      desc: '已生成的每日简报存档',
    })
  }
  return base
})

function switchEdition(edition) {
  if (edition !== 'basic' && edition !== 'pro') return

  if (edition === 'basic') {
    if (user.isBasicEdition) {
      user.toast('已在基础版')
      return
    }
    user.setProductEdition('basic')
    router.push('/app').catch(() => {})
    return
  }

  // → 专业台 / 会员
  if (canEnterPro.value) {
    if (user.isProEdition) {
      user.toast('已在专业台')
      return
    }
    user.setProductEdition('pro')
    router.push('/app').catch(() => {})
    return
  }

  user.toast('当前账号还不是会员，请先开通')
  router.push({ path: '/pricing', query: { redirect: '/more' } })
}

function onLogout() {
  auth.logout()
  router.push('/app')
}
</script>

<style scoped>
.sys-switch {
  margin-bottom: 28px;
  padding: 16px 0 20px;
  border-top: 1px solid var(--sep);
  border-bottom: 1px solid var(--sep);
}
.sys-head {
  margin-bottom: 12px;
}
.sys-title {
  margin: 0 0 6px;
  font-size: 15px;
  font-weight: 650;
  color: var(--tp);
  letter-spacing: -0.01em;
}
.sys-sub {
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
  color: var(--ts);
}
.sys-sub strong {
  color: var(--tp);
  font-weight: 650;
}
.sys-seg {
  display: flex;
  width: 100%;
  max-width: 360px;
  gap: 2px;
  padding: 3px;
  background: rgba(8, 9, 10, 0.55);
  border: 1px solid var(--sep);
  border-radius: 2px;
}
.sys-seg-btn {
  appearance: none;
  flex: 1;
  border: 0;
  background: transparent;
  color: var(--ts);
  font: inherit;
  font-size: 13px;
  font-weight: 650;
  min-height: 44px;
  padding: 11px 12px;
  border-radius: 1px;
  cursor: pointer;
  white-space: nowrap;
  transition:
    color 0.18s var(--ease),
    background 0.18s var(--ease),
    transform 0.12s var(--ease),
    box-shadow 0.18s var(--ease);
}
.sys-seg-btn:hover:not(.on) {
  color: var(--tp);
  background: rgba(236, 230, 216, 0.05);
}
.sys-seg-btn:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}
.sys-seg-btn.on {
  color: #1a1610;
  background: var(--accent);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.18);
}
.sys-seg-btn.on:hover {
  background: var(--accent-hover);
  color: #1a1610;
}
.sys-hint {
  margin: 10px 0 0;
  font-size: 12px;
  line-height: 1.45;
  color: var(--tt);
  max-width: 42ch;
}
.more-list {
  display: flex;
  flex-direction: column;
  border-top: 1px solid var(--sep);
  margin-bottom: 28px;
}
.more-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-height: 52px;
  padding: 16px 0;
  border-bottom: 1px solid var(--sep);
  text-decoration: none;
  color: inherit;
  touch-action: manipulation;
  -webkit-tap-highlight-color: color-mix(in srgb, var(--accent) 28%, transparent);
}
@media (hover: hover) and (pointer: fine) {
  .more-row:hover {
    background: var(--accent-soft);
  }
}
.more-row:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
.more-t {
  margin: 0 0 4px;
  font-size: 15px;
  font-weight: 650;
  color: var(--tp);
}
.more-d {
  margin: 0;
  font-size: 13px;
  color: var(--ts);
  line-height: 1.45;
}
.more-arrow {
  color: var(--accent);
  font-weight: 600;
}
.more-out {
  width: 100%;
  max-width: 220px;
}
</style>
