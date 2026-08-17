<template>
  <div v-if="portfolio.autoFetching" class="section af">
    <div class="progress-row" style="padding-left: 0; padding-right: 0">
      <span>采集 {{ portfolio.fetchProgress.current }}</span>
      <div class="progress-track">
        <div class="progress-bar" :style="{ width: progressPct + '%' }" />
      </div>
      <span class="ch-meta">{{ portfolio.fetchProgress.done }}/{{ portfolio.fetchProgress.total }}</span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { usePortfolioStore } from '@/store/portfolio'

const portfolio = usePortfolioStore()

const progressPct = computed(() => {
  const { done, total } = portfolio.fetchProgress
  return total ? Math.round((done / total) * 100) : 0
})
</script>

<style scoped>
.progress-row {
  padding: 14px 20px;
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 13px;
  font-weight: 500;
}
.progress-track {
  flex: 1;
  height: 6px;
  border-radius: 999px;
  background: var(--sep);
  overflow: hidden;
}
.progress-bar {
  height: 100%;
  border-radius: 999px;
  background: var(--accent);
  transition: width 0.3s var(--ease);
}
</style>
