<template>
  <div v-if="items.length" class="pro-ticker" aria-label="组合摘要">
    <router-link
      v-for="h in items"
      :key="h.code"
      class="pro-ticker-item"
      :to="`/stock/${h.code}`"
    >
      <span class="pro-ticker-code">{{ h.code }}</span>
      <span class="pro-ticker-name">{{ h.name }}</span>
      <span class="pro-ticker-pl" :class="plClass(h)">{{ plText(h) }}</span>
    </router-link>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { usePortfolioStore } from '@/store/portfolio'

const portfolio = usePortfolioStore()

const items = computed(() => portfolio.allHoldings.slice(0, 12))

function plPct(h) {
  const price = portfolio.getPrice(h.code, h.cost)
  return h.cost ? ((price - h.cost) / h.cost) * 100 : 0
}
function plClass(h) {
  const p = plPct(h)
  if (p > 0.05) return 'up'
  if (p < -0.05) return 'down'
  return ''
}
function plText(h) {
  const p = plPct(h)
  const sign = p >= 0 ? '+' : ''
  return `${sign}${p.toFixed(1)}%`
}
</script>
