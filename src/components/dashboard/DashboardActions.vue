<template>
  <div v-if="actions.length" class="section af">
    <div class="section-h">
      <h3>今日行动</h3>
      <span class="ch-meta">{{ actions.length }} 项 · 按优先级</span>
    </div>
    <div class="section-body action-list">
      <div
        v-for="a in actions"
        :key="a.code + a.title"
        class="action-row"
        :data-tone="a.tone"
        @click="$router.push(`/stock/${a.code}`)"
      >
        <div class="action-main">
          <div class="action-title">{{ a.title }}</div>
          <div v-if="a.desc" class="action-desc">{{ a.desc }}</div>
          <a
            v-if="a.url"
            class="action-src"
            :href="a.url"
            target="_blank"
            rel="noopener noreferrer"
            @click.stop
          >查看来源 →</a>
        </div>
        <span class="action-pill">{{ a.action }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useDashboardActions } from './useDashboardActions'

const { actions } = useDashboardActions()
</script>

<style scoped>
.action-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  border-top: none;
  padding-top: 4px;
}
.action-row {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 14px 14px 16px;
  border: 1px solid var(--sep);
  border-left: 3px solid var(--sep);
  border-radius: var(--rb);
  background: var(--surface);
  cursor: pointer;
  transition: background 0.15s var(--ease), border-color 0.15s var(--ease);
}
.action-row:hover {
  background: var(--surface-2);
  border-color: color-mix(in srgb, var(--accent) 25%, var(--sep));
}
.action-row[data-tone='urgent'] {
  border-left-color: var(--loss);
  background: var(--loss-soft);
}
.action-row[data-tone='warn'] {
  border-left-color: var(--warn);
  background: var(--warn-soft);
}
.action-row[data-tone='good'] {
  border-left-color: var(--gain);
  background: var(--gain-soft);
}
.action-row[data-tone='info'] {
  border-left-color: var(--accent);
  background: var(--accent-soft);
}
.action-main {
  flex: 1;
  min-width: 0;
}
.action-title {
  font-size: 13px;
  font-weight: 600;
  letter-spacing: -0.01em;
}
.action-desc {
  font-size: 12px;
  color: var(--ts);
  margin-top: 3px;
}
.action-src {
  display: inline-block;
  margin-top: 6px;
  font-size: 11px;
  font-weight: 600;
  color: var(--accent);
  text-decoration: none;
}
.action-src:hover {
  text-decoration: underline;
}
.action-pill {
  font-size: 11px;
  font-weight: 600;
  padding: 5px 10px;
  border-radius: 8px;
  background: var(--surface);
  border: 1px solid var(--sep);
  color: var(--tp);
  flex-shrink: 0;
}
.action-row[data-tone='urgent'] .action-pill {
  border-color: color-mix(in srgb, var(--loss) 35%, var(--sep));
  color: var(--loss);
}
.action-row[data-tone='warn'] .action-pill {
  border-color: color-mix(in srgb, var(--warn) 35%, var(--sep));
  color: var(--warn);
}
.action-row[data-tone='good'] .action-pill {
  border-color: color-mix(in srgb, var(--gain) 35%, var(--sep));
  color: var(--gain);
}
.action-row[data-tone='info'] .action-pill {
  border-color: color-mix(in srgb, var(--accent) 35%, var(--sep));
  color: var(--accent);
}
</style>
