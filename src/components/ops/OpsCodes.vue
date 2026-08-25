<template>
  <section>
    <div class="ops-card">
      <h2 class="ops-h2">生成兑换码</h2>
      <p class="ops-muted">明文只在这一次显示。关掉标签页就无法再找回，请立刻复制发给用户。</p>
      <div class="ops-row">
        <input v-model="note" class="ops-input" maxlength="80" placeholder="备注（可选，例如发给谁）" />
      </div>
      <div class="ops-row">
        <button class="ops-btn" type="button" :disabled="busy" @click="$emit('issue', 30, note)">30 天</button>
        <button class="ops-btn" type="button" :disabled="busy" @click="$emit('issue', 90, note)">90 天</button>
        <button class="ops-btn" type="button" :disabled="busy" @click="$emit('issue', 365, note)">1 年</button>
        <button class="ops-btn ops-ghost" type="button" :disabled="busy" @click="$emit('issue', null, note)">永久</button>
        <button class="ops-btn ops-ghost" type="button" :disabled="busy" @click="$emit('refresh')">刷新库存</button>
      </div>
      <ul v-if="fresh.length" class="ops-fresh-list">
        <li v-for="c in fresh" :key="c.code">
          <code class="ops-code">{{ c.code }}</code>
          <span class="ops-muted">{{ fmtDaySpan(c.days) }}</span>
          <span v-if="c.note" class="ops-muted">{{ c.note }}</span>
          <button class="ops-link" type="button" @click="$emit('copy', c.code)">
            {{ c.copied ? '已复制' : '复制' }}
          </button>
        </li>
      </ul>
    </div>

    <div class="ops-card">
      <h2 class="ops-h2">库存（不含明文）</h2>
      <p v-if="!codes.length" class="ops-empty">还没有生成过兑换码，或尚未刷新。</p>
      <div v-else class="ops-table-wrap">
        <table class="ops-table">
          <thead>
            <tr>
              <th>尾号</th>
              <th>状态</th>
              <th>时长</th>
              <th>备注</th>
              <th>生成</th>
              <th>兑换</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="c in codes" :key="c.id">
              <td class="ops-code">{{ c.last4 ? '····' + c.last4 : c.id }}</td>
              <td>{{ c.status === 'redeemed' ? '已兑' : '未用' }}</td>
              <td>{{ fmtDaySpan(c.days) }}</td>
              <td>{{ c.note || '—' }}</td>
              <td>{{ fmtTime(c.createdAt) }}</td>
              <td>{{ fmtTime(c.redeemedAt) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref } from 'vue'
import { fmtDaySpan, fmtTime } from '@/services/adminApi.js'

defineProps({
  codes: { type: Array, default: () => [] },
  fresh: { type: Array, default: () => [] },
  busy: { type: Boolean, default: false },
})

defineEmits(['issue', 'copy', 'refresh'])

const note = ref('')
</script>

<style scoped>
.ops-fresh-list {
  list-style: none;
  margin: 8px 0 0;
  padding: 0;
  display: grid;
  gap: 8px;
}
.ops-fresh-list li {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  min-height: 44px;
  padding: 8px 10px;
  border: 1px solid var(--ops-line);
  background: var(--ops-ink);
}
</style>
