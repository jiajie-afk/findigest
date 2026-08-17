<template>
  <div
    class="card af mgmt-card"
    data-section="management"
    @mouseenter="$emit('focus-section', 'management')"
  >
    <div class="ch">
      <h3>管理层</h3>
      <span class="ch-meta">
        <template v-if="loading">加载中…</template>
        <template v-else-if="mgmt?.assessment">巴菲特维度 · {{ mgmt.assessment.label }}</template>
        <template v-else>高管 · 舆论 · 评论</template>
      </span>
    </div>

    <div v-if="loading && !mgmt" class="skel-block" aria-busy="true" aria-label="管理层加载中">
      <div class="skel-line skel-w-90" />
      <div class="skel-line skel-w-70" />
      <div class="skel-grid">
        <div class="skel-card" />
        <div class="skel-card" />
      </div>
    </div>

    <div v-else class="mgmt-body">
      <p class="mgmt-buffett">巴菲特要「能干且诚实的管理层」——不只看董事长，总经理/财务负责人同等重要。下面分：名录、公开评价（正负）、你的评论。</p>
      <div v-if="mgmt?.assessment?.notes?.length" class="mgmt-notes">
        <span v-for="(n, i) in mgmt.assessment.notes" :key="i">{{ n }}</span>
      </div>
      <div v-if="error" class="mgmt-error" role="alert">
        <p>{{ error }}</p>
        <button type="button" class="btn bm" @click="$emit('retry')">重试</button>
      </div>
      <div v-else-if="!loading && !people.length" class="mgmt-empty">暂无高管名录（港股或接口暂不可用）</div>
      <div v-else class="mgmt-grid">
        <article v-for="(p, i) in displayPeople" :key="i" class="mgmt-person">
          <div class="mgmt-role">{{ p.role }}</div>
          <div class="mgmt-name">{{ p.name }}</div>
          <div class="mgmt-pos">{{ p.position }}</div>
          <div class="mgmt-meta">
            <span v-if="p.age">{{ p.age }}岁</span>
            <span v-if="p.degree">{{ p.degree }}</span>
            <span v-if="p.tenureYears != null">任职约{{ p.tenureYears }}年</span>
          </div>
          <div class="mgmt-hold">持股 {{ p.holdLabel }} · 薪酬 {{ p.salaryLabel }}</div>
          <p v-if="p.resume" class="mgmt-resume">{{ p.resume }}</p>
        </article>
      </div>

      <div v-if="trades.length" class="mgmt-trades">
        <div class="mgmt-trades-h">近期持股变动</div>
        <div v-for="(t, i) in trades.slice(0, 6)" :key="i" class="mgmt-trade">
          <span class="mt-date">{{ t.date }}</span>
          <span class="mt-who">{{ t.holder }}</span>
          <span class="mt-chg" :class="{ down: (t.changeNum || 0) < 0, up: (t.changeNum || 0) > 0 }">{{ t.changeLabel }}</span>
          <span class="mt-way">{{ t.way || t.relation }}</span>
        </div>
      </div>

      <div class="mgmt-press">
        <div class="mgmt-trades-h">公开评价（好的 / 坏的）</div>
        <p class="mgmt-press-hint">检索关键高管姓名的公开报道，按语气粗分正面/负面，供交叉验证，非投资建议。</p>
        <div v-if="loading" class="mgmt-empty">正在抓取相关报道…</div>
        <div v-else-if="!press.length" class="mgmt-empty">暂无匹配到带姓名的公开评论</div>
        <a
          v-for="(n, i) in press"
          :key="i"
          class="mgmt-press-row"
          :data-tone="n.tone"
          :href="n.url || '#'"
          target="_blank"
          rel="noopener"
        >
          <span class="mp-tone">{{ toneLabel(n.tone) }}</span>
          <span class="mp-who">{{ n.role }}·{{ n.person }}</span>
          <span class="mp-title">{{ n.title }}</span>
          <span class="mp-meta">{{ n.source }} · {{ n.date }}</span>
        </a>
      </div>

      <div class="mgmt-comments">
        <div class="mgmt-trades-h">你的管理层评论</div>
        <p class="mgmt-press-hint">本机保存，可写董事长/总经理/财务负责人等任何人。鼓励正反都写。</p>
        <form class="mgmt-form" @submit.prevent="$emit('submit-comment')">
          <div class="mgmt-form-row">
            <select :value="cmtAbout" class="mgmt-select" @change="$emit('update:cmtAbout', $event.target.value)">
              <option v-for="opt in commentAboutOptions" :key="opt" :value="opt">{{ opt }}</option>
            </select>
            <select :value="cmtTone" class="mgmt-select" @change="$emit('update:cmtTone', $event.target.value)">
              <option value="good">偏正面</option>
              <option value="bad">偏负面</option>
              <option value="mixed">中性/复杂</option>
            </select>
          </div>
          <textarea
            :value="cmtText"
            class="mgmt-textarea"
            rows="3"
            maxlength="500"
            placeholder="例如：长期主义 / 激励对齐；或：减持节奏、战略摇摆、资本开支纪律…"
            @input="$emit('update:cmtText', $event.target.value)"
          />
          <div class="mgmt-form-actions">
            <button class="btn bm" type="submit" :disabled="!cmtText.trim()">发表评论</button>
            <span class="mgmt-cmt-count">{{ comments.length }} 条</span>
          </div>
        </form>
        <div v-if="!comments.length" class="mgmt-empty">还没有评论，写第一条吧。</div>
        <article v-for="c in comments" :key="c.id" class="mgmt-cmt" :data-tone="c.tone">
          <div class="mgmt-cmt-top">
            <strong>{{ c.about }}</strong>
            <span class="mp-tone">{{ toneLabel(c.tone) }}</span>
            <span class="mp-meta">{{ formatCmtTime(c.at) }}</span>
            <button type="button" class="mgmt-cmt-del" @click="$emit('remove-comment', c.id)">删除</button>
          </div>
          <p>{{ c.text }}</p>
        </article>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  mgmt: { type: Object, default: null },
  loading: { type: Boolean, default: false },
  error: { type: String, default: '' },
  people: { type: Array, default: () => [] },
  displayPeople: { type: Array, default: () => [] },
  trades: { type: Array, default: () => [] },
  press: { type: Array, default: () => [] },
  comments: { type: Array, default: () => [] },
  commentAboutOptions: { type: Array, default: () => [] },
  cmtAbout: { type: String, default: '管理层' },
  cmtTone: { type: String, default: 'mixed' },
  cmtText: { type: String, default: '' },
})

defineEmits([
  'focus-section',
  'retry',
  'submit-comment',
  'remove-comment',
  'update:cmtAbout',
  'update:cmtTone',
  'update:cmtText',
])

function toneLabel(t) {
  if (t === 'good') return '正面'
  if (t === 'bad') return '负面'
  if (t === 'mixed') return '复杂'
  return '中性'
}

function formatCmtTime(iso) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
  } catch {
    return String(iso).slice(0, 16)
  }
}
</script>

<style scoped>
.ch-meta { font-size: 12px; color: var(--ts); }
.skel-block { padding: 16px 24px 22px; }
.skel-line {
  height: 12px;
  border-radius: 4px;
  margin-bottom: 10px;
  background: linear-gradient(90deg, var(--sep), color-mix(in srgb, var(--sep) 40%, transparent), var(--sep));
  background-size: 200% 100%;
  animation: skel-shimmer 1.2s ease-in-out infinite;
}
.skel-w-90 { width: 90%; }
.skel-w-70 { width: 70%; }
.skel-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-top: 12px;
}
.skel-card {
  height: 88px;
  border-radius: var(--rb, 8px);
  background: linear-gradient(90deg, var(--sep), color-mix(in srgb, var(--sep) 40%, transparent), var(--sep));
  background-size: 200% 100%;
  animation: skel-shimmer 1.2s ease-in-out infinite;
}
@keyframes skel-shimmer {
  0% { background-position: 100% 0; }
  100% { background-position: -100% 0; }
}
.mgmt-body { padding: 16px 24px 22px; }
.mgmt-buffett {
  margin: 0 0 12px;
  font-size: 12.5px;
  color: var(--ts);
  line-height: 1.55;
}
.mgmt-notes {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 14px;
  font-size: 12px;
  color: var(--accent);
  line-height: 1.45;
}
.mgmt-empty {
  font-size: 13px;
  color: var(--tt);
  padding: 8px 0 4px;
}
.mgmt-error {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  padding: 8px 0 4px;
  font-size: 13px;
  color: var(--loss);
}
.mgmt-error p { margin: 0; }
.mgmt-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}
.mgmt-person {
  padding: 12px 14px;
  border: 1px solid color-mix(in srgb, var(--sep) 85%, transparent);
  border-radius: var(--rb, 8px);
  background: color-mix(in srgb, var(--bg) 55%, var(--surface));
}
.mgmt-name {
  font-size: 14px;
  font-weight: 650;
  color: var(--tp);
}
.mgmt-pos {
  margin-top: 4px;
  font-size: 12px;
  color: var(--ts);
  line-height: 1.4;
}
.mgmt-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
  font-size: 11px;
  color: var(--tt);
}
.mgmt-hold {
  margin-top: 8px;
  font-size: 11px;
  color: var(--ts);
  font-family: var(--mono);
}
.mgmt-resume {
  margin: 8px 0 0;
  font-size: 11.5px;
  color: var(--tt);
  line-height: 1.55;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.mgmt-trades {
  margin-top: 16px;
  border-top: 1px solid color-mix(in srgb, var(--sep) 80%, transparent);
  padding-top: 12px;
}
.mgmt-trades-h {
  font-size: 12px;
  font-weight: 650;
  color: var(--tp);
  margin-bottom: 8px;
}
.mgmt-trade {
  display: grid;
  grid-template-columns: 5.5rem 1fr auto minmax(4rem, auto);
  gap: 8px;
  align-items: baseline;
  padding: 6px 0;
  font-size: 12px;
  border-bottom: 1px dashed color-mix(in srgb, var(--sep) 70%, transparent);
}
.mt-date { color: var(--tt); font-family: var(--mono); }
.mt-who { color: var(--tp); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mt-chg { font-family: var(--mono); font-weight: 600; }
.mt-chg.down { color: var(--loss); }
.mt-chg.up { color: var(--gain); }
.mt-way { color: var(--tt); font-size: 11px; text-align: right; }
.mgmt-role {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--accent);
  margin-bottom: 4px;
}
.mgmt-press,
.mgmt-comments {
  margin-top: 18px;
  border-top: 1px solid color-mix(in srgb, var(--sep) 80%, transparent);
  padding-top: 14px;
}
.mgmt-press-hint {
  margin: 0 0 10px;
  font-size: 12px;
  color: var(--tt);
  line-height: 1.5;
}
.mgmt-press-row {
  display: grid;
  grid-template-columns: 2.6rem 5.5rem 1fr auto;
  gap: 8px;
  align-items: baseline;
  padding: 8px 0;
  border-bottom: 1px dashed color-mix(in srgb, var(--sep) 65%, transparent);
  text-decoration: none;
  color: inherit;
}
.mgmt-press-row:hover .mp-title { color: var(--accent); }
.mp-tone {
  font-size: 10px;
  font-weight: 700;
  padding: 1px 5px;
  border-radius: 2px;
  background: var(--sep);
  color: var(--ts);
  width: fit-content;
}
.mgmt-press-row[data-tone='good'] .mp-tone,
.mgmt-cmt[data-tone='good'] .mp-tone {
  background: color-mix(in srgb, var(--gain) 18%, transparent);
  color: var(--gain);
}
.mgmt-press-row[data-tone='bad'] .mp-tone,
.mgmt-cmt[data-tone='bad'] .mp-tone {
  background: color-mix(in srgb, var(--loss) 18%, transparent);
  color: var(--loss);
}
.mp-who {
  font-size: 11px;
  color: var(--tt);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.mp-title {
  font-size: 12.5px;
  color: var(--tp);
  line-height: 1.4;
}
.mp-meta {
  font-size: 11px;
  color: var(--tt);
  white-space: nowrap;
}
.mgmt-form {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 14px;
}
.mgmt-form-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.mgmt-select {
  height: 32px;
  padding: 0 10px;
  border: 1px solid var(--sep);
  border-radius: var(--rb, 6px);
  background: var(--surface);
  color: var(--tp);
  font-size: 12px;
}
.mgmt-textarea {
  width: 100%;
  box-sizing: border-box;
  padding: 10px 12px;
  border: 1px solid var(--sep);
  border-radius: var(--rb, 6px);
  background: var(--surface);
  color: var(--tp);
  font-size: 13px;
  line-height: 1.5;
  resize: vertical;
  font-family: inherit;
}
.mgmt-form-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}
.mgmt-cmt-count {
  font-size: 12px;
  color: var(--tt);
}
.mgmt-cmt {
  padding: 10px 0;
  border-bottom: 1px solid color-mix(in srgb, var(--sep) 70%, transparent);
}
.mgmt-cmt-top {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
  font-size: 12px;
}
.mgmt-cmt p {
  margin: 0;
  font-size: 13px;
  color: var(--ts);
  line-height: 1.55;
}
.mgmt-cmt-del {
  margin-left: auto;
  border: none;
  background: transparent;
  color: var(--tt);
  font-size: 11px;
  cursor: pointer;
}
.mgmt-cmt-del:hover { color: var(--loss); }
@media (max-width: 640px) {
  .mgmt-grid { grid-template-columns: 1fr; }
  .mgmt-trade { grid-template-columns: 1fr 1fr; }
  .mt-way { grid-column: 1 / -1; text-align: left; }
  .mgmt-press-row { grid-template-columns: auto 1fr; min-height: 44px; }
  .mp-who, .mp-meta { grid-column: 1 / -1; }
  .skel-grid { grid-template-columns: 1fr; }
}
@media (max-width: 400px) {
  .mgmt-trade { grid-template-columns: 1fr; }
  .mgmt-press-row { grid-template-columns: 1fr; }
}
@media (prefers-reduced-motion: reduce) {
  .skel-line, .skel-card { animation: none; }
}
</style>
