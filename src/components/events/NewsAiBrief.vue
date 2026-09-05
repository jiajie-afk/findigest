<template>
  <div class="nab" :data-variant="variant">
    <button
      ref="btnEl"
      type="button"
      class="nab-btn"
      :disabled="busy"
      :aria-expanded="open"
      :aria-busy="busy"
      aria-label="AI摘要和梗概"
      @click.stop="onClick"
    >
      {{ buttonLabel }}
    </button>
    <Teleport to=".app-shell">
    <div
      v-if="open"
      ref="popEl"
      class="nab-pop"
      :style="popStyle"
      role="dialog"
      aria-label="AI摘要"
      @click.stop
    >
        <header class="nab-head">
          <div>
            <p class="nab-title">AI摘要</p>
            <p class="nab-sub">{{ statusLabel }}</p>
          </div>
          <button type="button" class="nab-x" aria-label="关闭" @click="close">×</button>
        </header>

        <div v-if="busy" class="nab-think-live" aria-live="polite">
          <span class="nab-pulse" aria-hidden="true" />
          <p class="nab-step">{{ thinkStep }}</p>
        </div>

        <p v-if="error" class="nab-err">{{ error }}</p>

        <template v-else-if="brief">
          <details v-if="brief.thinking" class="nab-think" :open="showThinking">
            <summary>思考过程</summary>
            <p>{{ brief.thinking }}</p>
          </details>
          <p class="nab-kicker">事实 · {{ brief.tone }} · 不是买入理由</p>
          <p class="nab-facts">{{ brief.facts }}</p>
          <ol class="nab-hz" aria-label="短期中期长期">
            <li v-for="h in horizons" :key="h.label">
              <div class="nab-hz-h">
                <span class="nab-hz-t">{{ h.label }}</span>
                <span class="nab-hz-w">{{ h.window }}</span>
                <span class="nab-chip" :data-fx="h.effect">{{ h.effect }}</span>
              </div>
              <p class="nab-hz-p">{{ h.text || '这条新闻还不够判断这一档。' }}</p>
            </li>
          </ol>
          <ul v-if="brief.sectors?.length" class="nab-sectors">
            <li v-for="s in brief.sectors" :key="s.name">
              <span class="nab-chip" :data-fx="s.effect">{{ s.effect }} {{ s.name }}</span>
              <span class="nab-why">{{ s.why }}</span>
            </li>
          </ul>
          <p v-if="brief.note" class="nab-note">{{ brief.note }}</p>
        </template>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import {
  newsBriefUi,
  readNewsBriefCache,
  summarizeNewsItem,
} from '@/services/newsBrief.js'

const THINK_STEPS = [
  '在拆这条新闻动了哪根经济变量…',
  '在看短资金、中盈利、长结构…',
  '在核对传导是不是硬凑的…',
]

const props = defineProps({
  item: { type: Object, required: true },
  variant: { type: String, default: 'events' },
})

const btnEl = ref(null)
const popEl = ref(null)
const brief = ref(null)
const open = ref(false)
const busy = ref(false)
const error = ref('')
const popStyle = ref({})
const thinkIdx = ref(0)
const showThinking = ref(true)
let thinkTimer = 0
let openedAt = 0

const thinkStep = computed(() => THINK_STEPS[thinkIdx.value % THINK_STEPS.length])
const buttonLabel = computed(() => (busy.value ? '思考中' : 'AI摘要'))
const horizons = computed(() => {
  const b = brief.value
  if (!b) return []
  return [
    { label: '短期', window: '数日–数周', ...(b.short || {}) },
    { label: '中期', window: '一季–一年', ...(b.medium || {}) },
    { label: '长期', window: '一年以上', ...(b.long || {}) },
  ].map((h) => ({
    label: h.label,
    window: h.window,
    effect: h.effect || '不确定',
    text: h.text || '',
  }))
})
const statusLabel = computed(() => {
  if (busy.value) return '深度思考中'
  if (error.value) return '没写成，可再试'
  if (brief.value?.source === 'llm') return '短中长期 · 经济传导'
  if (brief.value) return '短中长期 · 本地经济速读'
  return '摘要和梗概'
})

function placePop() {
  const btn = btnEl.value?.getBoundingClientRect()
  if (!btn) return
  const width = Math.min(440, Math.max(300, window.innerWidth - 24))
  const spaceRight = window.innerWidth - btn.right
  const left =
    spaceRight >= width + 14
      ? btn.right + 10
      : Math.max(12, Math.min(btn.left, window.innerWidth - width - 12))
  let top = spaceRight >= width + 14 ? btn.top - 8 : btn.bottom + 8
  const maxTop = window.innerHeight - 24
  if (top + 360 > maxTop) top = Math.max(12, maxTop - 360)
  popStyle.value = {
    position: 'fixed',
    left: `${Math.round(left)}px`,
    top: `${Math.round(top)}px`,
    width: `${Math.round(width)}px`,
    zIndex: 240,
  }
}

function stopThink() {
  if (thinkTimer) {
    clearInterval(thinkTimer)
    thinkTimer = 0
  }
}

function startThink() {
  stopThink()
  thinkIdx.value = 0
  thinkTimer = window.setInterval(() => {
    thinkIdx.value += 1
  }, 1100)
}

function close() {
  open.value = false
  busy.value = false
  stopThink()
}

function onDocDown(e) {
  if (!open.value || Date.now() - openedAt < 80) return
  const t = e.target
  if (popEl.value?.contains(t) || btnEl.value?.contains(t)) return
  close()
}

function onKey(e) {
  if (e.key === 'Escape' && open.value) close()
}

async function onClick() {
  if (busy.value) return
  if (open.value) {
    close()
    return
  }
  newsBriefUi.dispatchEvent(new Event('nab-close'))
  openedAt = Date.now()
  open.value = true
  error.value = ''
  await nextTick()
  placePop()
  const cached = readNewsBriefCache(props.item)
  if (cached?.facts) {
    brief.value = cached
    showThinking.value = false
    return
  }
  busy.value = true
  showThinking.value = true
  startThink()
  try {
    brief.value = await summarizeNewsItem(props.item)
  } catch (e) {
    error.value = e?.message || '摘要失败，可稍后重试'
  } finally {
    busy.value = false
    stopThink()
    await nextTick()
    placePop()
  }
}

function onOtherClose() {
  if (open.value) close()
}

onMounted(() => {
  newsBriefUi.addEventListener('nab-close', onOtherClose)
  window.addEventListener('pointerdown', onDocDown, true)
  window.addEventListener('keydown', onKey)
  window.addEventListener('resize', placePop)
  window.addEventListener('scroll', placePop, true)
})

onBeforeUnmount(() => {
  newsBriefUi.removeEventListener('nab-close', onOtherClose)
  window.removeEventListener('pointerdown', onDocDown, true)
  window.removeEventListener('keydown', onKey)
  window.removeEventListener('resize', placePop)
  window.removeEventListener('scroll', placePop, true)
  stopThink()
})
</script>

<style scoped>
.nab {
  display: inline-flex;
  align-items: center;
}

.nab-btn {
  appearance: none;
  border: 0;
  background: transparent;
  color: var(--accent);
  font: inherit;
  font-size: 12px;
  font-weight: 650;
  cursor: pointer;
  padding: 4px 0;
}

.nab[data-variant='butler'] .nab-btn {
  min-height: 44px;
}

.nab-btn:hover:not(:disabled) {
  text-decoration: underline;
}

.nab-btn:disabled {
  opacity: 0.65;
  cursor: wait;
}

.nab-pop {
  box-sizing: border-box;
  max-height: min(78vh, 640px);
  overflow: auto;
  padding: 14px 14px 16px;
  border: 1px solid var(--sep);
  border-radius: 12px;
  background: var(--bg);
  color: var(--tp);
  box-shadow: 0 18px 40px color-mix(in srgb, #000 28%, transparent);
}

.nab-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 12px;
}

.nab-title {
  margin: 0;
  font-size: 14px;
  font-weight: 700;
}

.nab-sub {
  margin: 2px 0 0;
  font-size: 11px;
  color: var(--tt);
}

.nab-x {
  appearance: none;
  border: 0;
  background: transparent;
  color: var(--tt);
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
  padding: 0 2px;
}

.nab-think-live {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin-bottom: 4px;
}

.nab-pulse {
  width: 8px;
  height: 8px;
  margin-top: 6px;
  border-radius: 50%;
  background: var(--accent);
  animation: nab-pulse 1.1s ease-in-out infinite;
}

.nab-step {
  margin: 0;
  font-size: 13px;
  line-height: 1.55;
  color: var(--ts);
}

.nab-think {
  margin: 0 0 12px;
  padding: 8px 10px;
  border-left: 2px solid color-mix(in srgb, var(--accent) 55%, var(--sep));
  background: color-mix(in srgb, var(--accent) 7%, transparent);
  border-radius: 0 8px 8px 0;
}

.nab-think summary {
  cursor: pointer;
  font-size: 11px;
  font-weight: 700;
  color: var(--tt);
  list-style: none;
}

.nab-think summary::-webkit-details-marker {
  display: none;
}

.nab-think p {
  margin: 8px 0 0;
  font-size: 12px;
  line-height: 1.6;
  color: var(--ts);
}

.nab-kicker,
.nab-empty,
.nab-note,
.nab-err {
  margin: 0 0 8px;
  font-size: 11px;
  font-weight: 650;
  color: var(--tt);
}

.nab-err {
  color: var(--loss, #c45c5c);
}

.nab-facts {
  margin: 0 0 12px;
  font-size: 13px;
  line-height: 1.6;
  color: var(--tp);
}

.nab-hz {
  margin: 0 0 12px;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.nab-hz li {
  padding: 10px 0 0;
  border-top: 1px solid var(--sep);
}

.nab-hz li:first-child {
  padding-top: 0;
  border-top: 0;
}

.nab-hz-h {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 4px;
}

.nab-hz-t {
  font-size: 12px;
  font-weight: 700;
  color: var(--tp);
}

.nab-hz-w {
  font-size: 11px;
  color: var(--tt);
}

.nab-hz-p {
  margin: 0;
  font-size: 12px;
  line-height: 1.6;
  color: var(--ts);
}

.nab-sectors {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.nab-chip {
  font-size: 11px;
  font-weight: 700;
  color: var(--ts);
}

.nab-chip[data-fx='利好'] {
  color: var(--gain, var(--accent));
}

.nab-chip[data-fx='利空'] {
  color: var(--loss, #c45c5c);
}

.nab-chip[data-fx='不确定'] {
  color: var(--tt);
}

.nab-why {
  display: block;
  font-size: 12px;
  line-height: 1.5;
  color: var(--ts);
}

.nab-note {
  margin-top: 10px;
  font-weight: 500;
}

@keyframes nab-pulse {
  0%,
  100% {
    opacity: 0.35;
    transform: scale(0.85);
  }
  50% {
    opacity: 1;
    transform: scale(1.15);
  }
}
</style>
