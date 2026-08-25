<template>
  <section class="ops-card">
    <div class="ops-row">
      <h2 class="ops-h2">操作记录</h2>
      <button class="ops-btn ops-ghost" type="button" :disabled="busy" @click="$emit('refresh')">刷新</button>
    </div>
    <p class="ops-muted">开通、取消、封禁、发码会写在这里。查账号不算操作。</p>
    <p v-if="!events.length" class="ops-empty">还没有记录。</p>
    <div v-else class="ops-table-wrap">
      <table class="ops-table">
        <thead>
          <tr>
            <th>时间</th>
            <th>动作</th>
            <th>账号</th>
            <th>说明</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(e, i) in events" :key="e.at + '-' + i">
            <td>{{ fmtTime(e.at) }}</td>
            <td>{{ auditActionLabel(e.action) }}</td>
            <td>{{ identityLabel(e.email) }}</td>
            <td>{{ e.detail || '—' }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<script setup>
import { auditActionLabel, fmtTime, identityLabel } from '@/services/adminApi.js'

defineProps({
  events: { type: Array, default: () => [] },
  busy: { type: Boolean, default: false },
})

defineEmits(['refresh'])
</script>
