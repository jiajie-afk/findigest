<template>
  <div class="bh" :class="{ 'bh--pro': billing.canUseProHud }">
    <header class="bh-mast">
      <p class="bh-brand">FinDigest</p>
      <p class="bh-date">
        {{ dateLabel }} · {{ billing.canUseProHud ? '专业台' : '今天该看什么' }}
      </p>
    </header>

    <section v-if="isEmptyHoldings" class="bh-hero bh-empty">
      <h1 class="bh-h1">先把持仓<em>放进来</em></h1>
      <p class="bh-lead">
        今日简报只读你的股票。没有持仓，就没有该看的事。先导入，再出简报。
      </p>
      <div class="bh-actions">
        <button class="btn bp" type="button" @click="openImport('paste')">导入持仓</button>
        <button class="btn bs" type="button" @click="openImport('manual')">手动录入</button>
      </div>
      <p class="bh-empty-note">可手动填一只，或粘贴券商表格、上传 CSV、拍持仓截图。登录不是必须的。</p>
    </section>

    <template v-if="!isEmptyHoldings">
    <section v-if="billing.canUseProHud" class="pro-hud" aria-label="专业台指标">
      <a class="pro-hud-cell hud-panel" href="/workspace" @click="onNavClick($event, '/workspace', router)">
        <p class="pro-hud-lab">估值分</p>
        <p class="pro-hud-val">{{ hud.valuationLabel }}</p>
        <div class="pro-hud-meter" aria-hidden="true"><i :style="{ width: hud.valuationPct + '%' }" /></div>
        <p class="pro-hud-hint">{{ hud.valuationHint }}</p>
        <span class="pro-hud-go">看工作区</span>
      </a>
      <a class="pro-hud-cell hud-panel" href="/settings" @click="onNavClick($event, '/settings', router)">
        <p class="pro-hud-lab">建议仓位</p>
        <p class="pro-hud-val">{{ hud.positionLabel }}</p>
        <div class="pro-hud-meter" aria-hidden="true"><i :style="{ width: hud.positionPct + '%' }" /></div>
        <p class="pro-hud-hint">{{ hud.positionHint }}</p>
        <span class="pro-hud-go">调约束</span>
      </a>
      <a class="pro-hud-cell hud-panel" href="/portfolio" @click="onNavClick($event, '/portfolio', router)">
        <p class="pro-hud-lab">组合盈亏</p>
        <p class="pro-hud-val" :class="{ up: portfolio.totals.pl >= 0, down: portfolio.totals.pl < 0 }">
          {{ hud.plLabel }}
        </p>
        <div class="pro-hud-meter" aria-hidden="true">
          <i :style="{ width: hud.plMeter + '%', background: portfolio.totals.pl >= 0 ? 'var(--gain)' : 'var(--loss)' }" />
        </div>
        <p class="pro-hud-hint">市值 ¥{{ (portfolio.totals.mv / 10000).toFixed(1) }}万 · {{ portfolio.allHoldings.length }} 只</p>
        <span class="pro-hud-go">打开持仓</span>
      </a>
    </section>
    <p v-if="billing.canUseProHud" class="pro-hud-honest">{{ paradigmHonest }}</p>

    <section v-if="showRemind" class="bh-remind" role="status">
      <p>
        已过你设定的推送时刻，今日简报尚未更新。
        <button type="button" class="bh-link" @click="genReport(false)">立刻生成</button>
        ·
        <a class="bh-link" href="/settings" @click="onNavClick($event, '/settings', router)">提醒设置</a>
      </p>
      <button type="button" class="bh-remind-x" aria-label="关闭" @click="dismissRemind">×</button>
    </section>

    <section class="bh-hero">
      <div v-if="genLoading" class="bh-skel" aria-busy="true" aria-label="简报生成中">
        <div class="bh-skel-line bh-skel-w-70" />
        <div class="bh-skel-line bh-skel-w-90" />
        <div class="bh-skel-line bh-skel-w-55" />
      </div>
      <template v-else>
        <h1 class="bh-h1">
          <template v-if="headline">{{ headlineLead }}</template>
          <template v-else>今天只留<em>你该看的</em></template>
        </h1>
        <p class="bh-lead">
          <template v-if="headline">{{ headlineRest }}</template>
          <template v-else>
            按你的硬约束裁一版简报。话少一点，重点清楚一点。
          </template>
        </p>
      </template>

      <div v-if="briefingError" class="bh-error" role="alert">
        <span>{{ briefingError }}</span>
        <button type="button" class="bh-link" @click="genReport(wantLlmRetry)">重试</button>
      </div>

      <div class="bh-actions">
        <button
          class="btn bp"
          type="button"
          :disabled="genLoading"
          @click="genReport(false)"
        >
          {{ genLoading && !wantLlm ? '生成中…' : latestBriefing ? '刷新今日简报' : '生成今日简报' }}
        </button>
        <button
          v-if="canTryLlm"
          class="btn bs"
          type="button"
          :disabled="genLoading"
          @click="onAiEnhance"
        >
          {{ genLoading && wantLlm ? '重写中…' : '用人话重写' }}
        </button>
        <a
          v-if="!user.profile.onboardingDone"
          class="bh-more-link"
          href="/settings#profile-scenario"
          @click="onNavClick($event, '/settings#profile-scenario', router)"
        >
          校准画像（可选）
        </a>
        <a
          v-if="!billing.canSeeProNav"
          class="bh-more-link"
          href="/workspace"
          @click="onNavClick($event, '/workspace', router)"
        >工作区</a>
        <a
          v-else
          class="bh-more-link"
          href="/workspace"
          @click="onNavClick($event, '/workspace', router)"
        >进工作区</a>
      </div>
      <p v-if="feedbackNote" class="bh-cal">你标过的偏好：{{ feedbackNote }}</p>
    </section>

    <section class="bh-related" aria-label="跟仓有关的要闻">
      <h2 class="bh-sec">跟仓有关的要闻</h2>
      <p class="bh-related-lead">完整联播仍在事件页。这里只抽出对上你持仓的，不是买入理由。</p>
      <ol v-if="relatedCctv.length" class="bh-list">
        <li v-for="(e, i) in relatedCctv" :key="e.id || i">
          <span class="bh-idx">{{ String(i + 1).padStart(2, '0') }}</span>
          <div>
            <p class="bh-item-t">{{ e.title }}</p>
            <p class="bh-item-s">{{ relatedLabel(e) }}</p>
            <div class="bh-item-links">
              <a
                v-for="h in (e.relatedHoldings || []).slice(0, 3)"
                :key="h.code"
                class="bh-link"
                :href="`/stock/${h.code}`"
                @click="onNavClick($event, `/stock/${h.code}`, router)"
              >{{ h.name }}</a>
              <a
                v-if="e.source_url"
                class="bh-link"
                :href="e.source_url"
                target="_blank"
                rel="noopener noreferrer"
              >原文</a>
              <NewsAiBrief :item="e" variant="butler" />
            </div>
          </div>
        </li>
      </ol>
      <p v-else class="bh-related-empty">{{ relatedEmpty }}</p>
      <a class="bh-more-link" href="/events" @click="onNavClick($event, '/events', router)">看全部要闻</a>
    </section>

    <section v-if="showPaywall && !billing.localFreePro" class="bh-paywall" aria-live="polite">
      <h2 class="bh-sec">「用人话重写」需要 Pro</h2>
      <p class="bh-pay-lead">本地简报一直免费。开 Pro 后，模型会按你的硬约束把今天的话重说一遍。</p>
      <div class="bh-actions">
        <a class="btn bp" href="/app?edition=pro" @click="onNavClick($event, '/app?edition=pro', router)">免费进入 Pro</a>
        <button class="btn bs" type="button" @click="showPaywall = false">先用本地版</button>
      </div>
    </section>

    <section v-if="diffLines.length" class="bh-diff">
      <h2 class="bh-sec">较昨日</h2>
      <ul>
        <li v-for="(line, i) in diffLines" :key="i">{{ line }}</li>
      </ul>
    </section>

    <section v-if="topItems.length || mobileConstraint || mobileRisk" class="bh-focus">
      <h2 class="bh-sec">此刻只需关注</h2>
      <ol class="bh-list bh-list--focus">
        <li v-for="(item, i) in displayFocusItems" :key="item.id">
          <span class="bh-idx">{{ String(i + 1).padStart(2, '0') }}</span>
          <div>
            <p class="bh-item-t">{{ item.title }}</p>
            <p class="bh-item-s">{{ item.summary }}</p>
            <div class="bh-item-links">
              <a
                v-if="item.code"
                class="bh-link"
                :href="`/stock/${item.code}`"
                @click="onNavClick($event, `/stock/${item.code}`, router)"
              >
                查看个股
              </a>
              <a
                v-if="item.url"
                class="bh-link"
                :href="item.url"
                target="_blank"
                rel="noopener noreferrer"
              >查看来源</a>
            </div>
            <BriefingFeedbackButtons
              :value="fb[item.id]"
              :position-suggestion="fb[item.id] === 'adopt' ? positionByItem[item.id] : null"
              @mark="(a) => markItem(item, a)"
            />
          </div>
        </li>
      </ol>
      <div v-if="mobileConstraint || mobileRisk" class="bh-mobile-trio">
        <p v-if="mobileConstraint" class="bh-trio-line">
          <span class="bh-trio-k">硬约束</span>{{ mobileConstraint }}
        </p>
        <p v-if="mobileRisk" class="bh-trio-line">
          <span class="bh-trio-k">持仓风险</span>{{ mobileRisk }}
        </p>
      </div>
    </section>

    <details v-if="!billing.canUseProHud" class="fd-density-fold bh-secondary">
      <summary>组合概览</summary>
      <section class="bh-quiet">
        <div>
          <p class="bh-q-label">组合市值</p>
          <p class="bh-q-val">¥{{ (portfolio.totals.mv / 10000).toFixed(1) }}万</p>
        </div>
        <div>
          <p class="bh-q-label">今日盈亏</p>
          <p class="bh-q-val" :class="{ up: portfolio.totals.pl >= 0, down: portfolio.totals.pl < 0 }">
            {{ portfolio.totals.pl >= 0 ? '+' : '' }}{{ (portfolio.totals.pl / 10000).toFixed(2) }}万
          </p>
        </div>
        <div>
          <p class="bh-q-label">持仓</p>
          <p class="bh-q-val bh-q-sm">
            <a href="/portfolio" @click="onNavClick($event, '/portfolio', router)">{{ portfolio.allHoldings.length }} 只</a>
          </p>
        </div>
      </section>
    </details>

    <p class="bh-method-note">
      简报为研究整理，非投资建议 · {{ paradigmHonest }}
      <a href="/limits" @click="onNavClick($event, '/limits', router)">已知局限</a>
    </p>
    </template>

    <ImportHoldingsWizard v-model="showImport" :start-tab="importStartTab" />
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { onNavClick } from '@/utils/navHref.js'
import { useUserStore } from '@/store/user'
import { usePortfolioStore } from '@/store/portfolio'
import { useEventStore } from '@/store/event'
import { useAuthStore } from '@/store/auth'
import { useBillingStore } from '@/store/billing'
import { COPY } from '@/data/productStats.js'
import { generateDailyReport } from '@/services/ai.js'
import {
  loadLatestBriefing,
  loadPrevBriefing,
  saveBriefing,
  diffBriefings,
} from '@/services/briefingArchive.js'
import { loadFeedbackMemory, recordAdviceFeedback, extractConstraints } from '@/services/constraints.js'
import { needsRevisitHint, runRevisitPush } from '@/services/remind.js'
import {
  suggestPositionDelta,
  stashPositionSuggestion,
} from '@/services/decisionBridge.js'
import BriefingFeedbackButtons from '@/components/common/BriefingFeedbackButtons.vue'
import ImportHoldingsWizard from '@/components/portfolio/ImportHoldingsWizard.vue'
import NewsAiBrief from '@/components/events/NewsAiBrief.vue'

const user = useUserStore()
const portfolio = usePortfolioStore()
const events = useEventStore()
const auth = useAuthStore()
const billing = useBillingStore()
const router = useRouter()
const paradigmHonest = COPY.paradigmHonest

const genLoading = ref(false)
const wantLlm = ref(false)
const wantLlmRetry = ref(false)
const briefingError = ref('')
const showPaywall = ref(false)
const showImport = ref(false)
const importStartTab = ref('paste')
const isEmptyHoldings = computed(() => !(portfolio.allHoldings || []).length)

const relatedCctv = computed(() => (events.cctvRelated || []).slice(0, 6))

const relatedEmpty = computed(() => {
  if (events.cctvStatus?.error && !events.cctvItems.length) return events.cctvStatus.error
  if (!events.cctvItems.length) return '要闻还在同步。完整列表在事件页。'
  return '这批要闻还没对上你的股票名或行业。宏观条不自动当成买入理由。'
})

function relatedLabel(e) {
  const hits = e.relatedHoldings || []
  return hits.map((h) => h.why || h.name).join(' · ')
}

function openImport(which = 'paste') {
  importStartTab.value = which === 'manual' ? 'manual' : 'paste'
  showImport.value = true
}
const remindDismissed = ref(false)
const latestBriefing = ref(loadLatestBriefing())
const prevBriefing = ref(loadPrevBriefing())
const fb = reactive({})
const positionByItem = reactive({})

billing.hydrate()

const dateLabel = computed(() =>
  new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' }),
)

const canTryLlm = computed(() => user.aiConfig?.enabled && !!user.aiConfig?.apiKey)

const headline = computed(() => latestBriefing.value?.headline || '')
const headlineLead = computed(() => {
  const h = headline.value
  if (!h) return ''
  const cut = h.slice(0, 42)
  return cut.length < h.length ? `${cut}…` : cut
})
const headlineRest = computed(() => {
  const h = headline.value
  if (h.length <= 42) return '以下为按你约束整理的要点。点反馈可影响下次排序。'
  return h.slice(42, 120) + (h.length > 120 ? '…' : '')
})

const topItems = computed(() => (latestBriefing.value?.items || []).slice(0, 3))
const displayFocusItems = computed(() => {
  // ≤390: one focus item; wider keeps up to 3
  if (typeof window !== 'undefined' && window.matchMedia?.('(max-width: 390px)').matches) {
    return topItems.value.slice(0, 1)
  }
  return topItems.value
})
const mobileConstraint = computed(() => {
  const profile = user.getUserProfile?.() || user
  const c = extractConstraints(profile, user.profile)
  if (!c) return ''
  if (c.mode === 'locked') return `观察模式 · 定制 ${c.answered}/${c.total}`
  const parts = []
  if (c.maxDrawdownPct != null) parts.push(`回撤容忍 ${c.maxDrawdownPct}%`)
  if (c.singleStockMaxPct != null) parts.push(`单票上限 ${c.singleStockMaxPct}%`)
  return parts.length ? parts.join(' · ') : ''
})
const mobileRisk = computed(() => {
  const riskItem = (latestBriefing.value?.items || []).find(
    (i) => i.type === 'risk' || i.type === 'overvalued' || i.type === 'constraint',
  )
  if (riskItem) return riskItem.title || riskItem.summary || ''
  const holdings = portfolio.allHoldings || []
  let worst = null
  for (const h of holdings) {
    const v = portfolio.valuationFor?.(h.code)
    const mos = v?.marginOfSafety ?? portfolio.financialData?.[h.code]?.marginOfSafety
    if (mos == null) continue
    if (!worst || mos < worst.mos) worst = { name: h.name || h.code, mos }
  }
  if (!worst) return holdings.length ? '持仓风险待估值刷新' : ''
  return `${worst.name} MoS ${worst.mos >= 0 ? '+' : ''}${Number(worst.mos).toFixed(0)}%`
})
const diffLines = computed(() => diffBriefings(latestBriefing.value, prevBriefing.value).lines)
const feedbackNote = computed(() => loadFeedbackMemory().lastNote || '')
const showRemind = computed(() => !remindDismissed.value && needsRevisitHint(user))

const financialMap = computed(() => portfolio.financialData || {})

const hud = computed(() => {
  const holdings = portfolio.allHoldings
  let qSum = 0
  let qN = 0
  let posSum = 0
  let posN = 0
  for (const h of holdings) {
    const v = portfolio.valuationFor(h.code)
    if (v?.qualityScore != null && Number.isFinite(v.qualityScore)) {
      qSum += v.qualityScore
      qN += 1
    }
    const pos = portfolio.positionFor(h.code)
    if (pos?.pct != null && Number.isFinite(pos.pct)) {
      posSum += pos.pct
      posN += 1
    }
  }
  const qAvg = qN ? qSum / qN : null
  const posAvg = posN ? posSum / posN : null
  const plPct = portfolio.totals.plPct || 0
  return {
    valuationLabel: qAvg == null ? '—' : qAvg.toFixed(0),
    valuationPct: qAvg == null ? 0 : Math.max(4, Math.min(100, qAvg)),
    valuationHint: qN ? `持仓均值 · ${qN} 只有分` : '导入持仓并刷新后显示',
    positionLabel: posAvg == null ? '—' : `${posAvg.toFixed(0)}%`,
    positionPct: posAvg == null ? 0 : Math.max(4, Math.min(100, posAvg)),
    positionHint: posN ? '情绪+基本面建议仓位均值' : '分析未就绪',
    plLabel: `${plPct >= 0 ? '+' : ''}${plPct.toFixed(2)}%`,
    plMeter: Math.max(4, Math.min(100, Math.abs(plPct) * 4)),
  }
})

onMounted(() => {
  portfolio.refreshQuotesQuiet().catch(() => {})
  if (!events.cctvItems.length) events.loadCctvNews?.().catch(() => {})
  runRevisitPush(
    {
      report_hour: user.report_hour,
      report_minute: user.report_minute,
      push_wechat: user.push_wechat,
      push_browser: user.push_browser,
      serverchan_key: user.serverchan_key,
    },
    latestBriefing.value,
  ).catch(() => {})
})

function dismissRemind() {
  remindDismissed.value = true
}

function onAiEnhance() {
  if (!billing.canUseLlm) {
    showPaywall.value = true
    return
  }
  genReport(true)
}

async function genReport(useLlm) {
  wantLlm.value = !!useLlm
  wantLlmRetry.value = !!useLlm
  briefingError.value = ''
  genLoading.value = true
  user.track(user.EVENT_TYPES.SUGGESTION_VIEW, {
    suggestionType: 'daily_report',
    section: 'butler_home',
  })
  try {
    await portfolio.autoFetchAll()
    await user.recalibrate()
    const profile = user.getUserProfile()
    const aiConfig =
      useLlm && billing.canUseLlm
        ? user.aiConfig
        : { ...user.aiConfig, enabled: false }

    const report = await generateDailyReport({
      holdings: portfolio.allHoldings,
      analyses: portfolio.stockAnalyses,
      financials: financialMap.value,
      userProfile: profile,
      aiConfig,
      personalizedPrompt: user.getPersonalizedPrompt(),
      rawProfile: user.profile,
      portfolioMv: portfolio.totals.mv,
      portfolioPlPct: portfolio.totals.plPct,
      getPrice: (code, fbPrice) => portfolio.getPrice(code, fbPrice),
    })
    prevBriefing.value = loadLatestBriefing()
    saveBriefing(report)
    latestBriefing.value = report
    prevBriefing.value = loadPrevBriefing()

    const summary = `${report.headline}\n\n` + report.items.map((i) => `· ${i.title}`).join('\n')
    events.generateReport(user, summary)

    const note = loadFeedbackMemory().lastNote
    if (report.constraints?.mode === 'locked') user.toast('观察模式简报已生成')
    else if (report.source === 'llm') user.toast('AI 增强简报已就绪')
    else if (note) user.toast('今日简报已就绪 · 已参考你的反馈')
    else user.toast('今日简报已就绪')

    auth.pushCloud().catch(() => {})
  } catch (e) {
    console.error(e)
    briefingError.value = e?.message || '生成失败，请稍后重试'
    user.toast('生成失败，请稍后重试')
  } finally {
    genLoading.value = false
    wantLlm.value = false
  }
}

async function markItem(item, action) {
  fb[item.id] = action
  const type =
    action === 'adopt'
      ? user.EVENT_TYPES.SUGGESTION_ADOPT
      : action === 'disagree'
        ? user.EVENT_TYPES.SUGGESTION_REJECT
        : user.EVENT_TYPES.SUGGESTION_IGNORE

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

  await user.track(type, {
    stockCode: item.code,
    suggestionType: item.type,
    suggestionContent: item.title,
    section: 'butler_home',
    positionSuggestion: positionSuggestion || undefined,
  })
  const mem = recordAdviceFeedback(item, action)
  const explain = user.weightExplanation?.sentence
  const hasExplain = explain && !user.weightExplanation?.sampleInsufficient
  if (action === 'adopt' && positionSuggestion) {
    const band = positionSuggestion.targetWeightBand
    user.toast(
      hasExplain
        ? `仓位含义：${band} · ${explain.slice(0, 28)}${explain.length > 28 ? '…' : ''}`
        : `仓位含义：${band}`,
    )
  } else if (hasExplain && (action === 'disagree' || action === 'ignore')) {
    user.toast(`已记录 · ${explain.slice(0, 36)}${explain.length > 36 ? '…' : ''}`)
  } else if (mem.lastNote) {
    user.toast(`已记录 · ${mem.lastNote.slice(0, 36)}${mem.lastNote.length > 36 ? '…' : ''}`)
  } else {
    user.toast(action === 'adopt' ? '已记录：有用' : action === 'disagree' ? '已记录：不同意' : '已记录：跳过')
  }
}
</script>

<style scoped>
.bh {
  max-width: 720px;
  margin: 0 auto;
  padding: clamp(40px, 7vh, 72px) 28px 96px;
  animation: bh-in 0.85s cubic-bezier(0.22, 1, 0.36, 1) both;
}

/* Pro Desk: scoped styles must not wash out prodesk.css mono/cyan brand */
.bh--pro {
  max-width: 880px;
  padding: clamp(20px, 4vh, 36px) 14px 56px;
}
.bh--pro .bh-mast {
  margin-bottom: 18px;
}
.bh--pro .bh-brand {
  font-family: var(--mono, ui-monospace, monospace);
  font-size: clamp(1.1rem, 2.4vw, 1.35rem);
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--accent, #00e8c8);
}
.bh--pro .bh-date {
  font-family: var(--mono, ui-monospace, monospace);
  font-size: 11px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--ts);
}
.bh--pro .bh-hero {
  margin-bottom: 28px;
}
.bh--pro .bh-h1 {
  font-size: clamp(1.25rem, 2.8vw, 1.65rem);
  font-weight: 700;
}
.bh--pro .bh-h1 em {
  font-style: normal;
  color: var(--accent, #00e8c8);
}
.bh--pro .bh-sec {
  font-family: var(--mono, ui-monospace, monospace);
  font-size: 10px;
  letter-spacing: 0.14em;
  color: var(--accent, #00e8c8);
}
.bh--pro .bh-pro-strip {
  margin-bottom: 18px;
  background: transparent;
}
.bh--pro .bh-pro-edition {
  font-family: var(--mono, ui-monospace, monospace);
  font-size: 12px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--accent, #00e8c8);
}
.bh--pro .bh-quiet {
  gap: 10px;
  padding: 12px 0 0;
}

.bh-mast {
  margin-bottom: clamp(28px, 5vh, 48px);
}

.bh-brand {
  margin: 0 0 10px;
  font-family: var(--font);
  font-size: clamp(1.85rem, 3.8vw, 2.45rem);
  font-weight: 700;
  letter-spacing: -0.03em;
  line-height: 1.1;
  color: var(--tp);
}

.bh-date {
  margin: 0;
  font-size: 13px;
  color: var(--ts);
}

.bh-remind {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 24px;
  padding: 12px 14px;
  border: 1px solid color-mix(in srgb, var(--accent) 35%, var(--sep));
  border-radius: var(--rb, 10px);
  background: var(--accent-soft);
  font-size: 13px;
  color: var(--tp);
}
.bh-remind p {
  margin: 0;
  line-height: 1.5;
}
.bh-remind-x {
  border: 0;
  background: none;
  color: var(--ts);
  cursor: pointer;
  font-size: 18px;
  line-height: 1;
}

.bh-hero {
  margin-bottom: clamp(32px, 6vh, 48px);
}

.bh-h1 {
  margin: 0 0 14px;
  font-size: clamp(1.45rem, 3.2vw, 1.85rem);
  font-weight: 650;
  letter-spacing: -0.025em;
  line-height: 1.25;
  color: var(--tp);
}
.bh-h1 em {
  font-style: italic;
  font-weight: 600;
  color: var(--accent);
}

.bh-lead {
  margin: 0 0 22px;
  max-width: 36rem;
  font-size: 15px;
  line-height: 1.55;
  color: var(--ts);
}

.bh-empty-note {
  margin: 14px 0 0;
  max-width: 36rem;
  font-size: 13px;
  line-height: 1.5;
  color: var(--tt);
}

.bh-pro-strip {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0;
  margin: 0 0 20px;
  border: 1px solid var(--sep);
}
@media (min-width: 640px) {
  .bh-pro-strip {
    grid-template-columns: repeat(4, 1fr);
  }
}
.bh-pro-cell {
  padding: 12px 14px;
  border-right: 1px solid var(--sep);
  border-bottom: 1px solid var(--sep);
}
.bh-pro-cell:nth-child(2n) {
  border-right: 0;
}
@media (min-width: 640px) {
  .bh-pro-cell {
    border-bottom: 0;
  }
  .bh-pro-cell:nth-child(2n) {
    border-right: 1px solid var(--sep);
  }
  .bh-pro-cell:last-child {
    border-right: 0;
  }
}
.bh-pro-k {
  display: block;
  margin-bottom: 4px;
  font-family: var(--mono);
  font-size: 10px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--ts);
}
.bh-pro-cell strong {
  font-size: 15px;
  font-weight: 700;
}
.bh-cal {
  margin: 12px 0 0;
  font-size: 12px;
  color: var(--tt);
}
.bh-error {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin: 0 0 14px;
  padding: 10px 12px;
  border: 1px solid color-mix(in srgb, var(--loss) 35%, var(--sep));
  border-radius: var(--rb, 8px);
  background: color-mix(in srgb, var(--loss) 10%, transparent);
  font-size: 13px;
  color: var(--loss);
}
.bh-skel {
  margin-bottom: 18px;
}
.bh-skel-line {
  height: 14px;
  border-radius: 4px;
  margin-bottom: 10px;
  background: linear-gradient(90deg, var(--sep), color-mix(in srgb, var(--sep) 40%, transparent), var(--sep));
  background-size: 200% 100%;
  animation: bh-skel 1.2s ease-in-out infinite;
}
.bh-skel-w-55 { width: 55%; }
.bh-skel-w-70 { width: 70%; height: 22px; }
.bh-skel-w-90 { width: 90%; }
@keyframes bh-skel {
  0% { background-position: 100% 0; }
  100% { background-position: -100% 0; }
}
@media (prefers-reduced-motion: reduce) {
  .bh-skel-line { animation: none; }
}

.bh-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 16px;
}

.bh-more-link {
  font-size: 13px;
  font-weight: 600;
  color: var(--ts);
  text-decoration: none;
}
.bh-more-link:hover {
  color: var(--accent);
}

.bh-paywall,
.bh-diff,
.bh-focus {
  margin-bottom: clamp(28px, 5vh, 44px);
}
.bh-paywall {
  padding-top: 16px;
  border-top: 1px solid var(--sep);
}
.bh-pay-lead {
  margin: 0 0 14px;
  font-size: 14px;
  color: var(--ts);
  line-height: 1.5;
}

.bh-sec {
  margin: 0 0 12px;
  font-size: 12px;
  font-weight: 650;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--tt);
}

.bh-related {
  margin: 8px 0 28px;
}
.bh-related-lead,
.bh-related-empty {
  margin: 0 0 12px;
  font-size: 13px;
  line-height: 1.55;
  color: var(--ts);
}
.bh-related .bh-more-link {
  display: inline-block;
  margin-top: 4px;
}

.bh-diff ul {
  margin: 0;
  padding: 0;
  list-style: none;
}
.bh-diff li {
  padding: 8px 0;
  border-bottom: 1px solid var(--sep);
  font-size: 13px;
  color: var(--ts);
  line-height: 1.45;
}

.bh-list {
  margin: 0;
  padding: 0;
  list-style: none;
  border-top: 1px solid var(--sep);
}

.bh-list li {
  display: grid;
  grid-template-columns: 2.5rem 1fr;
  gap: 12px;
  padding: 16px 0;
  border-bottom: 1px solid var(--sep);
}

.bh-idx {
  font-family: var(--mono, ui-monospace, monospace);
  font-size: 12px;
  color: var(--accent);
  padding-top: 3px;
}

.bh-item-t {
  margin: 0 0 4px;
  font-size: 15px;
  font-weight: 650;
  color: var(--tp);
}

.bh-item-s {
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
  color: var(--ts);
}

.bh-item-links {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 8px;
}

.bh-link {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  padding: 0;
  border: 0;
  background: none;
  font-size: 12px;
  font-weight: 600;
  color: var(--accent);
  cursor: pointer;
  text-decoration: none;
  box-sizing: border-box;
}

.bh-quiet {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  padding-top: 8px;
}

.bh-q-label {
  margin: 0 0 4px;
  font-size: 11px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--tt);
}

.bh-q-val {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 650;
  color: var(--tp);
  font-variant-numeric: tabular-nums;
}
.bh-q-val.up {
  color: var(--gain, var(--accent));
}
.bh-q-val.down {
  color: var(--down, #e85d5d);
}
.bh-q-sm {
  font-size: 1rem;
}
.bh-q-sm a {
  color: inherit;
  text-decoration: none;
}
.bh-q-sm a:hover {
  color: var(--accent);
}

@keyframes bh-in {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

@media (max-width: 900px) {
  .bh {
    padding: 24px 16px 32px;
  }
  .bh--pro {
    padding: 16px 12px 28px;
  }
  .bh-mast {
    margin-bottom: 18px;
  }
  .bh-brand {
    font-size: clamp(1.2rem, 5vw, 1.4rem);
    margin-bottom: 6px;
  }
  .bh-hero {
    margin-bottom: 24px;
  }
  .bh-h1 {
    font-size: clamp(1.25rem, 5vw, 1.45rem);
    margin-bottom: 10px;
  }
  .bh-lead {
    font-size: 14px;
    margin-bottom: 16px;
  }
  .bh-actions {
    gap: 10px;
  }
  .bh-actions .btn {
    flex: 1 1 auto;
    min-width: min(100%, 10rem);
  }
  .bh-paywall,
  .bh-diff,
  .bh-focus {
    margin-bottom: 24px;
  }
}

@media (max-width: 560px) {
  .bh-quiet {
    grid-template-columns: 1fr;
  }
  .bh-list li {
    padding: 14px 0;
    min-height: 44px;
  }
  .bh-item-links {
    gap: 4px 8px;
  }
}
@media (max-width: 390px) {
  .bh-list--focus > li:nth-child(n + 2) {
    display: none;
  }
  .bh-mobile-trio {
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid var(--sep);
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .bh-trio-line {
    margin: 0;
    font-size: 13px;
    line-height: 1.45;
    color: var(--ts);
  }
  .bh-trio-k {
    display: inline-block;
    min-width: 3.5rem;
    margin-right: 8px;
    font-size: 11px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--tt);
  }
  .bh-actions .btn,
  .bh-actions .bh-link {
    min-height: 44px;
    min-width: 44px;
  }
}
.bh-method-note {
  margin: 28px 0 8px;
  font-size: 11px;
  line-height: 1.5;
  color: var(--tt);
}
.bh-method-note a {
  color: var(--accent);
  text-decoration: none;
  margin-left: 6px;
}
</style>
