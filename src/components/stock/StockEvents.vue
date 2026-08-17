<template>
  <div>
    <div v-if="events.length" class="card af">
      <div class="ch">
        <h3>相关事件 / 催化剂</h3>
        <span class="ch-meta">{{ events.length }} 个</span>
      </div>
      <component
        :is="e.url ? 'a' : 'div'"
        v-for="(e, i) in events.slice(0, 12)"
        :key="i"
        class="evt"
        :class="['evt--' + certClass(e.certainty), { 'evt--link': !!e.url }]"
        v-bind="e.url ? { href: e.url, target: '_blank', rel: 'noopener noreferrer' } : {}"
      >
        <div class="evt-title">
          <span v-if="e.categoryLabel && e.categoryLabel !== '一般事件'" class="cat-tag">{{ e.categoryLabel }}</span>
          {{ e.title }}
        </div>
        <div class="evt-meta">
          <span>{{ e.date }}</span>
          <span v-if="e.source">· {{ e.source }}</span>
          <span v-else-if="e.reason">· {{ e.reason }}</span>
          <span>· {{ certLabel(e.certainty) }}</span>
          <span v-if="e.url" class="evt-src">查看来源 →</span>
        </div>
        <div v-if="e.tradeHint?.text" class="trade-hint">{{ e.tradeHint.text }}</div>
      </component>
    </div>

    <div v-if="news.length" class="card af" data-section="news" @mouseenter="$emit('focus-section', 'news')">
      <div class="ch">
        <h3>最新资讯</h3>
        <span class="ch-meta">{{ news.length }} 条</span>
      </div>
      <component
        :is="n.url ? 'a' : 'div'"
        v-for="(n, i) in news.slice(0, 12)"
        :key="i"
        class="news-row"
        :class="{ 'news-row--link': !!n.url }"
        v-bind="n.url ? { href: n.url, target: '_blank', rel: 'noopener noreferrer' } : {}"
      >
        <div class="news-title">{{ n.t }}</div>
        <div class="news-meta">
          {{ n.s }} · {{ n.d }} · {{ n.tp }}
          <span v-if="n.url" class="evt-src"> 原文 →</span>
        </div>
      </component>
    </div>
  </div>
</template>

<script setup>
defineProps({
  events: { type: Array, default: () => [] },
  news: { type: Array, default: () => [] },
})
defineEmits(['focus-section'])

function certClass(c) {
  return c === 'confirmed' ? 'confirmed' : c === 'likely' ? 'likely' : 'maybe'
}
function certLabel(c) {
  return c === 'confirmed' ? '确定' : c === 'likely' ? '可能' : '小概率'
}
</script>

<style scoped>
.ch-meta { font-size: 12px; color: var(--ts); }
.evt {
  display: block;
  padding: 12px 20px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.03);
  border-left: 3px solid var(--tt);
  text-decoration: none;
  color: inherit;
}
.evt--confirmed { border-left-color: var(--loss); }
.evt--likely { border-left-color: var(--gain); }
.evt--maybe { border-left-color: var(--tt); }
.evt--link {
  cursor: pointer;
  transition: background 0.15s var(--ease);
}
.evt--link:hover { background: var(--accent-soft); }
.evt-title {
  font-size: 13px;
  font-weight: 500;
}
.evt-meta {
  font-size: 11px;
  color: var(--ts);
  margin-top: 4px;
  line-height: 1.5;
}
.evt-src {
  margin-left: 6px;
  color: var(--accent);
  font-weight: 600;
}
.cat-tag {
  display: inline-block;
  margin-right: 6px;
  padding: 1px 6px;
  border-radius: 4px;
  background: var(--accent-soft);
  color: var(--accent);
  font-size: 11px;
  font-weight: 600;
}
.trade-hint {
  margin-top: 6px;
  font-size: 12px;
  color: var(--accent);
  line-height: 1.5;
}
.news-row {
  display: block;
  padding: 12px 20px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.03);
  text-decoration: none;
  color: inherit;
}
.news-row--link { cursor: pointer; }
.news-row--link:hover { background: var(--accent-soft); }
.news-title {
  font-size: 13px;
  font-weight: 500;
}
.news-meta {
  font-size: 11px;
  color: var(--ts);
  margin-top: 4px;
}
</style>
