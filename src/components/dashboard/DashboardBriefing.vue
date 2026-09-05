<template>
  <section v-if="report" class="section af briefing">
    <div class="section-h">
      <h3>{{ isJournal ? 'Analyst Note' : '今日分析师简报' }}</h3>
      <span class="ch-meta">{{ sourceLabel }} · {{ report.items?.length || 0 }} 条</span>
    </div>
    <div class="section-body briefing-body">
      <header class="brief-mast">
        <p class="briefing-headline">{{ report.headline }}</p>
        <div v-if="hasProfile" class="profile-line">
          <span class="pl-k">按你的画像</span>
          <span v-if="snap.style">{{ snap.style }}</span>
          <span v-if="snap.risk" class="dot">·</span>
          <span v-if="snap.risk">{{ snap.risk }}</span>
          <span v-if="snap.horizon" class="dot">·</span>
          <span v-if="snap.horizon">{{ snap.horizon }}</span>
          <span v-if="topWeightLabel" class="dot">·</span>
          <span v-if="topWeightLabel">侧重{{ topWeightLabel }}</span>
        </div>
        <p v-if="!user.profile.onboardingDone" class="briefing-onboard">
          画像未填时按保守默认出简报。
          <router-link to="/settings#profile-scenario">校准后会更贴你</router-link>
        </p>
      </header>

      <ol class="brief-list">
        <li
          v-for="(item, idx) in report.items"
          :key="item.id"
          class="brief-row"
          :data-tone="item.tone"
        >
          <div class="brief-idx" aria-hidden="true">{{ String(idx + 1).padStart(2, '0') }}</div>
          <div class="brief-main">
            <div class="brief-title-row">
              <h4 class="brief-title">{{ item.title }}</h4>
              <div class="brief-links">
                <a
                  v-if="item.url"
                  class="brief-link"
                  :href="item.url"
                  target="_blank"
                  rel="noopener noreferrer"
                  @click.stop
                >来源 →</a>
                <button
                  v-if="item.code"
                  class="brief-link"
                  type="button"
                  @click="openStock(item)"
                >
                  个股 →
                </button>
              </div>
            </div>
            <p class="briefing-summary">{{ item.summary }}</p>
            <details v-if="item.logic?.length" class="briefing-logic">
              <summary>展开逻辑</summary>
              <ol>
                <li v-for="(step, i) in item.logic" :key="i">{{ step }}</li>
              </ol>
            </details>
            <p v-if="itemTrigger(item)" class="item-trigger">{{ itemTrigger(item) }}</p>
            <BriefingFeedbackButtons
              :value="feedback[item.id]"
              :position-suggestion="feedback[item.id] === 'adopt' ? positionByItem[item.id] : null"
              @mark="(a) => mark(item, a)"
            />
          </div>
        </li>
      </ol>
    </div>
  </section>
</template>

<script setup>
import { computed, reactive, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/store/user'
import { usePortfolioStore } from '@/store/portfolio'
import { recordAdviceFeedback, extractConstraints } from '@/services/constraints.js'
import {
  suggestPositionDelta,
  stashPositionSuggestion,
} from '@/services/decisionBridge.js'
import BriefingFeedbackButtons from '@/components/common/BriefingFeedbackButtons.vue'

const WEIGHT_LABELS = {
  ratings: '机构评级',
  fundamental: '基本面',
  valuation: '估值',
  risk: '风险',
  growth: '成长',
  technical: '技术面',
  sentiment: '情绪',
  macro: '宏观',
  industry: '行业',
  event: '事件',
}

const props = defineProps({
  report: { type: Object, default: null },
})

const user = useUserStore()
const portfolio = usePortfolioStore()
const router = useRouter()
const feedback = reactive({})
const shownAt = reactive({})
const positionByItem = reactive({})
const isJournal = computed(() => user.designStyle === 'journal')

const snap = computed(() => props.report?.profileSnapshot || {})
const hasProfile = computed(() => !!(snap.value.style || snap.value.risk || snap.value.horizon))

const topWeightLabel = computed(() => {
  const w = snap.value.weights
  if (!w || typeof w !== 'object') return snap.value.valuationWeight || ''
  let best = null
  let bestV = -Infinity
  for (const [k, v] of Object.entries(w)) {
    if (typeof v === 'number' && v > bestV) {
      bestV = v
      best = k
    }
  }
  return best ? WEIGHT_LABELS[best] || best : snap.value.valuationWeight || ''
})

const sourceLabel = computed(() => {
  const s = props.report?.source
  if (s === 'llm') return 'LLM 增强'
  if (s === 'local+llm_fallback') return '本地引擎（LLM 回退）'
  return '本地可解释引擎'
})

function itemTrigger(item) {
  if (item.trigger) return item.trigger
  const s = snap.value
  if (item.type === 'risk' && s.risk) return `阈值来自：${s.risk}偏好`
  if (item.type === 'undervalued' || item.type === 'overvalued') {
    return `估值判定来自：${s.valuationWeight || '综合'}模型`
  }
  if (item.type === 'watchlist') return '来自画像：关注行业'
  if (item.priority === 0 && s.industries?.length) return '优先级来自：关注行业命中'
  return ''
}

watch(
  () => props.report?.id,
  (id) => {
    Object.keys(feedback).forEach((k) => delete feedback[k])
    Object.keys(shownAt).forEach((k) => delete shownAt[k])
    Object.keys(positionByItem).forEach((k) => delete positionByItem[k])
    if (id && props.report?.items) {
      const now = Date.now()
      props.report.items.forEach((item) => {
        shownAt[item.id] = now
        user.track(user.EVENT_TYPES.SUGGESTION_VIEW, {
          stockCode: item.code,
          suggestionType: item.type,
          suggestionContent: item.title,
          currentPrice: item.code ? portfolio.getPrice(item.code, null) : null,
          section: 'briefing',
        })
      })
    }
  },
  { immediate: true },
)

function openStock(item) {
  if (!item.code) return
  user.track(user.EVENT_TYPES.SUGGESTION_VIEW, {
    stockCode: item.code,
    suggestionType: item.type,
    suggestionContent: item.title,
    section: 'briefing',
    currentPrice: portfolio.getPrice(item.code, null),
  })
  router.push(`/stock/${item.code}`)
}

function mark(item, action) {
  feedback[item.id] = action
  const type =
    action === 'adopt'
      ? user.EVENT_TYPES.SUGGESTION_ADOPT
      : action === 'disagree'
        ? user.EVENT_TYPES.SUGGESTION_REJECT
        : user.EVENT_TYPES.SUGGESTION_IGNORE
  const price = item.code ? portfolio.getPrice(item.code, null) : null
  const suggestedAction =
    item.type === 'risk' || item.type === 'overvalued' || item.type === 'constraint'
      ? 'sell'
      : item.type === 'undervalued' || item.type === 'opportunity'
        ? 'buy'
        : 'hold'

  let positionSuggestion = null
  if (action === 'adopt') {
    const profile = user.getUserProfile()
    const constraints = extractConstraints(profile, user.profile)
    positionSuggestion = suggestPositionDelta({
      focusItem: item,
      holdings: portfolio.allHoldings,
      constraints,
      totalMv: portfolio.totals.mv,
      getPrice: (c, fbPrice) => portfolio.getPrice(c, fbPrice),
    })
    positionByItem[item.id] = positionSuggestion
    stashPositionSuggestion(positionSuggestion, { title: item.title })
  }

  user.track(type, {
    stockCode: item.code,
    suggestionType: item.type,
    suggestionContent: action === 'disagree' ? 'reject' : suggestedAction,
    currentPrice: price,
    suggestionShownAt: shownAt[item.id] || Date.now(),
    positionSuggestion: positionSuggestion || undefined,
    section: 'briefing',
  })
  const mem = recordAdviceFeedback(item, action)
  if (action === 'adopt' && positionSuggestion) {
    user.toast(`仓位含义：${positionSuggestion.targetWeightBand}`)
  } else if (mem.lastNote) {
    user.toast(mem.lastNote.slice(0, 42) + (mem.lastNote.length > 42 ? '…' : ''))
  } else {
    user.toast(action === 'adopt' ? '已记录：有用' : action === 'disagree' ? '已记录：不同意' : '已记录：跳过')
  }
}
</script>

<style scoped>
.briefing-body {
  padding-top: 4px;
}
.brief-mast {
  margin-bottom: 22px;
  padding-bottom: 18px;
  border-bottom: 1px solid color-mix(in srgb, var(--sep) 85%, transparent);
}
.briefing-headline {
  font-family: var(--font-display, inherit);
  font-size: clamp(1.15rem, 2.2vw, 1.45rem);
  font-weight: 600;
  letter-spacing: -0.03em;
  line-height: 1.45;
  color: var(--tp);
  margin: 0;
  white-space: pre-wrap;
}
.profile-line {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 6px 8px;
  margin-top: 12px;
  font-size: 12px;
  color: var(--ts);
  line-height: 1.5;
}
.pl-k {
  color: var(--tt);
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  font-size: 10px;
  margin-right: 4px;
}
.dot {
  color: var(--tt);
  opacity: 0.5;
}
.briefing-onboard {
  margin: 12px 0 0;
  font-size: 13px;
  color: var(--ts);
  line-height: 1.55;
}
.briefing-onboard a {
  color: var(--accent);
  font-weight: 600;
  text-decoration: none;
  border-bottom: 1px solid color-mix(in srgb, var(--accent) 40%, transparent);
}
.brief-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0;
}
.brief-row {
  display: grid;
  grid-template-columns: 2.4rem 1fr;
  gap: 10px 14px;
  padding: 18px 0;
  border-bottom: 1px solid color-mix(in srgb, var(--sep) 75%, transparent);
}
.brief-row:last-child {
  border-bottom: none;
  padding-bottom: 4px;
}
.brief-idx {
  font-family: var(--mono, ui-monospace, monospace);
  font-size: 12px;
  font-weight: 600;
  color: var(--tt);
  padding-top: 4px;
  letter-spacing: 0.02em;
}
.brief-row[data-tone='warn'] .brief-idx {
  color: var(--loss);
}
.brief-row[data-tone='good'] .brief-idx {
  color: var(--gain);
}
.brief-row[data-tone='info'] .brief-idx {
  color: var(--accent);
}
.brief-title-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}
.brief-title {
  margin: 0;
  font-size: 15px;
  font-weight: 650;
  letter-spacing: -0.02em;
  line-height: 1.4;
  color: var(--tp);
}
.brief-link {
  flex-shrink: 0;
  border: none;
  background: transparent;
  color: var(--accent);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  padding: 2px 0;
  white-space: nowrap;
  text-decoration: none;
  font-family: inherit;
}
.brief-links {
  display: flex;
  flex-shrink: 0;
  gap: 10px;
  align-items: center;
}
.brief-link:hover {
  text-decoration: underline;
}
.briefing-summary {
  margin: 8px 0 0;
  font-size: 13.5px;
  color: var(--ts);
  line-height: 1.65;
  max-width: 62ch;
}
.briefing-logic {
  margin-top: 10px;
  font-size: 12.5px;
  color: var(--tt);
}
.briefing-logic summary {
  cursor: pointer;
  font-weight: 600;
  color: var(--ts);
  list-style: none;
}
.briefing-logic summary::-webkit-details-marker {
  display: none;
}
.briefing-logic summary::before {
  content: '+ ';
  font-family: var(--mono, monospace);
  color: var(--tt);
}
.briefing-logic[open] summary::before {
  content: '− ';
}
.briefing-logic ol {
  margin: 8px 0 0;
  padding-left: 1.1rem;
  line-height: 1.65;
  color: var(--ts);
}
.item-trigger {
  font-size: 11px;
  color: var(--tt);
  margin: 8px 0 0;
  line-height: 1.45;
}
@media (max-width: 640px) {
  .brief-row {
    grid-template-columns: 1.8rem 1fr;
    gap: 8px 10px;
  }
  .briefing-summary {
    max-width: none;
  }
}
</style>
