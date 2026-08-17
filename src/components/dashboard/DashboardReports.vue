<template>
  <div class="section af d3">
    <div class="section-h">
      <h3>最近报告</h3>
      <router-link to="/reports" class="link-quiet">查看全部</router-link>
    </div>
    <div class="section-body">
      <div
        v-for="r in events.reports.slice(0, 3)"
        :key="r.id"
        class="rpt-row"
        @click="$router.push('/reports')"
      >
        <div>
          <div class="rt">{{ r.title }}</div>
          <div class="rm">{{ formatDate(r.date) }}</div>
        </div>
        <span class="badge" :class="r.sent ? 'bg' : 'by'">{{ r.sent ? '已发送' : '未发送' }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useEventStore } from '@/store/event'

const events = useEventStore()

function formatDate(d) {
  try {
    return new Date(d).toLocaleString('zh-CN')
  } catch {
    return d
  }
}
</script>

<style scoped>
.rpt-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 0;
  border-bottom: 1px solid color-mix(in srgb, var(--sep) 70%, transparent);
  cursor: pointer;
}
.rpt-row:last-child {
  border-bottom: none;
}
.rpt-row:hover {
  background: var(--surface-2);
}
.rt {
  font-size: 14px;
  font-weight: 600;
}
.rm {
  font-size: 12px;
  color: var(--tt);
  margin-top: 3px;
}
.link-quiet {
  font-size: 12px;
  font-weight: 600;
  color: var(--accent);
  text-decoration: none;
}
</style>
