<template>
  <div class="section af d2">
    <div class="section-h">
      <h3>我的持仓</h3>
      <span class="ch-meta">{{ analyzedCount }}/{{ portfolio.allHoldings.length }} 已分析</span>
    </div>
    <div class="section-body holdings-wrap">
      <div
        v-for="h in visibleHoldings"
        :key="h.code"
        class="stock-card"
        @click="$router.push(`/stock/${h.code}`)"
      >
        <div class="hold-name">{{ h.name }}</div>
        <div class="hold-code">{{ h.code }} · {{ h.ex }}</div>
        <div v-if="portfolio.stockAnalyses[h.code]?.sent" class="hold-score">
          <span :style="{ color: scoreColor(portfolio.stockAnalyses[h.code].sent.total) }">
            {{ portfolio.stockAnalyses[h.code].sent.mood }}
          </span>
          <strong :style="{ color: scoreColor(portfolio.stockAnalyses[h.code].sent.total) }">
            {{ fmtScore(portfolio.stockAnalyses[h.code].sent.total) }}
          </strong>
        </div>
        <div v-else class="hold-pending">待采集</div>
      </div>
      <button
        v-if="portfolio.allHoldings.length > HOLDINGS_WINDOW"
        class="btn bs holdings-more"
        type="button"
        @click="showAll = !showAll"
      >
        {{ showAll ? '收起' : `显示全部 ${portfolio.allHoldings.length} 只` }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { usePortfolioStore } from '@/store/portfolio'
import { scoreColor } from '@/utils/format'

const HOLDINGS_WINDOW = 20
const portfolio = usePortfolioStore()
const showAll = ref(false)

const analyzedCount = computed(
  () => Object.values(portfolio.stockAnalyses).filter((a) => a?.sent).length,
)

const visibleHoldings = computed(() => {
  const all = portfolio.allHoldings
  if (showAll.value || all.length <= HOLDINGS_WINDOW) return all
  return all.slice(0, HOLDINGS_WINDOW)
})

function fmtScore(n) {
  return `${n >= 0 ? '+' : ''}${n}`
}
</script>

<style scoped>
.holdings-wrap {
  display: flex;
  flex-wrap: wrap;
}
.hold-name {
  font-size: 14px;
  font-weight: 600;
  letter-spacing: -0.02em;
}
.hold-code {
  font-size: 12px;
  color: var(--tt);
  margin-top: 3px;
}
.hold-score {
  margin-top: 10px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  font-weight: 600;
}
.hold-score strong {
  font-family: var(--mono);
  font-size: 14px;
}
.hold-pending {
  margin-top: 10px;
  font-size: 12px;
  color: var(--tt);
  font-weight: 500;
}
.holdings-more {
  flex: 1 1 100%;
  margin: 12px 0 4px;
}
</style>
