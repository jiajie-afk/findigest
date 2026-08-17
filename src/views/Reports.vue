<template>
  <div class="page">
    <div class="page-head page-head--settings">
      <div>
        <h1 class="pt">报告历史</h1>
        <p class="pt-sub">每日财经简报存档</p>
      </div>
    </div>
    <div class="card">
      <div
        v-for="(r, i) in events.reports"
        :key="r.id"
        class="rpt"
        @click="active = active === i ? null : i"
      >
        <div class="rpt-top">
          <div>
            <div class="rt">{{ r.title }}</div>
            <div class="rm">{{ formatDate(r.date) }}</div>
          </div>
          <span class="badge" :class="r.sent ? 'bg' : 'by'">{{ r.sent ? '已发送' : '未发送' }}</span>
        </div>
        <div v-if="active === i && r.body" class="rpt-body">{{ r.body }}</div>
      </div>
      <div v-if="!events.reports.length" class="empty">暂无报告</div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useEventStore } from '@/store/event'

const events = useEventStore()
const active = ref(null)

function formatDate(d) {
  try {
    return new Date(d).toLocaleString('zh-CN')
  } catch {
    return d
  }
}
</script>

<style scoped>
.rpt {
  padding: 16px 20px;
  border-bottom: 1px solid color-mix(in srgb, var(--sep) 70%, transparent);
  cursor: pointer;
  transition: background 0.15s var(--ease);
}
.rpt:last-child { border-bottom: none; }
.rpt:hover { background: var(--surface-2); }
.rpt-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}
.rt { font-size: 14px; font-weight: 700; letter-spacing: -0.02em; }
.rm { font-size: 12px; color: var(--tt); margin-top: 3px; }
.rpt-body {
  margin-top: 12px;
  font-size: 13px;
  color: var(--ts);
  line-height: 1.7;
  padding: 12px 14px;
  background: var(--surface-2);
  border-radius: var(--rx);
}
.empty { padding: 48px; text-align: center; color: var(--tt); }
</style>
