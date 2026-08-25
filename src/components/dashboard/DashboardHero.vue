<template>
  <section class="welcome">
    <div class="welcome-copy">
      <p class="welcome-brand">FinDigest</p>
      <div class="welcome-kicker">{{ isJournal ? 'Private Desk' : `私人管家 · ${user.reportTimeLabel}` }}</div>
      <h1 class="welcome-title">
        <template v-if="isJournal">Good morning, {{ user.nickname }}</template>
        <template v-else>你好，{{ user.nickname }}<br /><em>今日帮你决策</em></template>
      </h1>
      <p class="welcome-desc">
        {{
          isJournal
            ? 'Portfolio moves, catalysts and valuation signals — constrained by your profile.'
            : '按你的硬约束整理可执行简报：该看什么、为什么、安全边际在哪。'
        }}
      </p>
      <div class="welcome-actions">
        <button class="btn bp" :disabled="genLoading || isEmpty" @click="$emit('gen-report')">
          <PhNewspaper :size="16" :weight="'bold'" />
          {{ genLoading ? '生成中…' : '生成今日分析' }}
        </button>
        <router-link class="btn bs" to="/portfolio?import=1">
          <PhUploadSimple :size="16" :weight="'bold'" />
          导入持仓
        </router-link>
        <button
          v-if="!isEmpty"
          class="btn bs"
          :disabled="portfolio.autoFetching"
          @click="runFetch"
        >
          <PhBroadcast :size="16" :weight="'bold'" />
          {{ portfolio.autoFetching ? '刷新中…' : '刷新行情' }}
        </button>
      </div>
    </div>
    <aside class="welcome-panel">
      <div>
        <div class="welcome-panel-label">组合市值</div>
        <div class="welcome-panel-value">
          {{ isEmpty ? '尚无持仓' : `¥${(portfolio.totals.mv / 10000).toFixed(1)}万` }}
        </div>
      </div>
      <div v-if="!isEmpty" class="welcome-panel-meta">
        今日盈亏
        <strong :style="{ color: portfolio.totals.pl >= 0 ? 'var(--gain)' : 'var(--loss)', marginLeft: '6px' }">
          {{ portfolio.totals.pl >= 0 ? '+' : '' }}{{ (portfolio.totals.pl / 10000).toFixed(2) }}万
          · {{ fmtPct(portfolio.totals.plPct) }}
        </strong>
      </div>
      <div v-else class="welcome-panel-meta">先导入，再生成分析。</div>
    </aside>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import { PhNewspaper, PhBroadcast, PhUploadSimple } from '@/components/icons'
import { useUserStore } from '@/store/user'
import { usePortfolioStore } from '@/store/portfolio'
import { fmtPct } from '@/utils/format'
import { summarizeFetchResult } from '@/services/quotesRefresh.js'

defineProps({
  genLoading: { type: Boolean, default: false },
})

defineEmits(['gen-report'])

const user = useUserStore()
const portfolio = usePortfolioStore()
const isJournal = computed(() => user.designStyle === 'journal')
const isEmpty = computed(() => !(portfolio.allHoldings || []).length)

async function runFetch() {
  if (isEmpty.value) {
    user.toast('先导入持仓，才能刷新行情')
    return
  }
  const result = await portfolio.autoFetchAll()
  const msg = summarizeFetchResult(result)
  if (msg) user.toast(msg)
}
</script>

<style scoped>
a.btn {
  text-decoration: none;
  color: inherit;
  box-sizing: border-box;
}
</style>
