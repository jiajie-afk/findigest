<template>
  <div class="stats">
    <div
      v-for="(s, i) in stats"
      :key="s.label"
      class="st"
      :class="`d${i + 1}`"
      @click="$router.push(s.to)"
    >
      <div class="si" :class="s.cls">
        <component :is="s.icon" :size="18" :weight="'bold'" />
      </div>
      <div class="sl">{{ s.label }}</div>
      <div class="sv">{{ s.value }}</div>
      <div v-if="s.sub" class="st-sub">{{ s.sub }}</div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import {
  PhBriefcase,
  PhChartLineUp,
  PhCalendarBlank,
  PhFiles,
} from '@/components/icons'
import { usePortfolioStore } from '@/store/portfolio'
import { useEventStore } from '@/store/event'
import { useDashboardActions } from './useDashboardActions'

const portfolio = usePortfolioStore()
const events = useEventStore()
const { actions } = useDashboardActions()

const stats = computed(() => [
  {
    icon: PhBriefcase,
    label: '持仓组合',
    value: portfolio.portfolios.length,
    cls: 'bl',
    to: '/portfolio',
    sub: portfolio.portfolios.map((p) => p.name).join('、').slice(0, 20),
  },
  {
    icon: PhChartLineUp,
    label: '追踪股票',
    value: portfolio.allHoldings.length,
    cls: 'gr',
    to: '/portfolio',
    sub: portfolio.allHoldings.map((h) => h.name).join('、').slice(0, 20),
  },
  {
    icon: PhCalendarBlank,
    label: '关注事件',
    value: events.autoEvents.length + events.manualEvents.length,
    cls: 'or',
    to: '/events',
    sub: actions.value.length ? `${actions.value.length}项待办` : '暂无待办',
  },
  {
    icon: PhFiles,
    label: '历史报告',
    value: events.reports.length,
    cls: 'pu',
    to: '/reports',
    sub: events.reports[0]?.date?.slice(5, 10) || '',
  },
])
</script>
