<template>
  <section>
    <div class="ops-kpis">
      <div class="ops-kpi"><b>{{ kpis.registered }}</b><span>注册账号</span></div>
      <div class="ops-kpi"><b>{{ kpis.pro }}</b><span>有效 Pro</span></div>
      <div class="ops-kpi"><b>{{ kpis.expired }}</b><span>Pro 过期</span></div>
      <div class="ops-kpi"><b>{{ kpis.banned }}</b><span>封禁</span></div>
      <div class="ops-kpi"><b>{{ kpis.new7 }}</b><span>近 7 日新注册</span></div>
      <div class="ops-kpi"><b>{{ kpis.active7 }}</b><span>近 7 日活跃</span></div>
      <div class="ops-kpi"><b>{{ kpis.calls }}</b><span>LLM 调用次数</span></div>
      <div class="ops-kpi"><b>{{ tokensLabel }}</b><span>累计 Token</span></div>
    </div>

    <div class="ops-card">
      <h2 class="ops-h2">系统灯</h2>
      <div class="ops-lamps">
        <div v-for="row in lamps" :key="row.key" class="ops-lamp">
          <i class="ops-dot" :class="{ 'is-on': row.on }" />
          {{ row.label }}
        </div>
      </div>
    </div>

    <div class="ops-card">
      <h2 class="ops-h2">Token 用量前 8</h2>
      <p v-if="!topUsage.length" class="ops-empty">还没有上报用量。</p>
      <div v-else class="ops-table-wrap">
        <table class="ops-table">
          <thead>
            <tr>
              <th>账号</th>
              <th>Token</th>
              <th>调用</th>
              <th>会员</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="a in topUsage" :key="a.email" @click="$emit('open-account', a.email)">
              <td>{{ identityLabel(a.email) }}</td>
              <td>{{ a.totalTokens || 0 }}</td>
              <td>{{ a.calls || 0 }}</td>
              <td>{{ planLabel(a.plan, a.proUntil) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import { HEALTH_LABELS, identityLabel, planLabel } from '@/services/adminApi.js'

const props = defineProps({
  kpis: { type: Object, required: true },
  health: { type: Object, default: () => ({}) },
  accounts: { type: Array, default: () => [] },
})

defineEmits(['open-account'])

const tokensLabel = computed(() => {
  const n = Number(props.kpis.tokens) || 0
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}k`
  return String(n)
})

const lamps = computed(() =>
  Object.keys(HEALTH_LABELS).map((key) => ({
    key,
    label: HEALTH_LABELS[key],
    on: !!props.health[key],
  })),
)

const topUsage = computed(() =>
  [...props.accounts]
    .sort((a, b) => (b.totalTokens || 0) - (a.totalTokens || 0))
    .slice(0, 8)
    .filter((a) => (a.totalTokens || 0) > 0 || (a.calls || 0) > 0),
)
</script>
