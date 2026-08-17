<template>
  <div class="page" v-if="code">
    <div class="stock-back">
      <router-link class="stock-back-link" to="/portfolio">← 返回持仓</router-link>
    </div>

    <div v-if="pageLoading" class="hero af stock-hero skel-hero" aria-busy="true" aria-label="行情加载中">
      <div class="skel-line skel-w-40" />
      <div class="skel-line skel-w-60 skel-lg" />
      <div class="skel-line skel-w-30" />
    </div>

    <div v-else class="hero af stock-hero">
      <div class="stock-hero-row">
        <div>
          <div class="stock-code">{{ code }}{{ isHK ? ' 🇭🇰' : '' }}</div>
          <div class="stock-name">{{ stockName }}</div>
          <div class="stock-industry">{{ industry }}</div>
        </div>
        <div class="stock-quote">
          <div class="stock-price">{{ currency }}{{ Number(price || 0).toFixed(2) }}</div>
          <div
            v-if="changePct != null"
            class="stock-chg"
            :class="changePct >= 0 ? 'stock-chg--up' : 'stock-chg--down'"
          >
            {{ changePct >= 0 ? '+' : '' }}{{ Number(changePct).toFixed(2) }}%
          </div>
          <div v-if="quoteMetaLabel" class="stock-quote-meta">{{ quoteMetaLabel }}</div>
        </div>
      </div>
      <div v-if="quoteError" class="stock-error" role="alert">
        <span>{{ quoteError }}</span>
        <button type="button" class="btn bm" @click="retryQuote">重试行情</button>
      </div>
    </div>

    <section class="stock-decision" aria-label="主锚结论与下一步">
      <p class="sd-row">
        <span class="sd-k">主锚</span>
        <span>{{ fin?.dcf?.archetypeLabel || industry || '—' }} · {{ fin?.dcf?.verdict || '待估值' }}</span>
      </p>
      <p class="sd-row">
        <span class="sd-k">结论</span>
        <span>{{ fin?.dcf?.actionHint || '先看方法卡与安全边际' }}</span>
      </p>
      <p class="sd-row">
        <span class="sd-k">下一步</span>
        <router-link class="sd-link" :to="`/portfolio?symbol=${encodeURIComponent(code)}`">
          {{ portfolioMeaning || '查看持仓暴露 →' }}
        </router-link>
      </p>
    </section>

    <details class="fd-density-fold stock-analyze-fold" :open="!isNarrow">
      <summary>消息面采集{{ isNarrow ? ' · 默认折叠' : '' }}</summary>
    <div class="card af d1">
      <div class="analyze-bar">
        <div>
          <div class="analyze-title">消息面深度分析</div>
          <div class="analyze-sub">采集东方财富新闻 · 股吧 · 公告 · 研报</div>
        </div>
        <button class="btn bp" :disabled="loading" @click="runAnalyze">
          {{ loading ? '采集中…' : '开始采集' }}
        </button>
      </div>
      <div v-if="analyzeError" class="stock-error stock-error--pad" role="alert">
        <span>{{ analyzeError }}</span>
        <button type="button" class="btn bm" @click="runAnalyze">重试</button>
      </div>
    </div>
    </details>

    <StockValuation
      v-if="fin"
      :fin="fin"
      :price="price"
      :metrics="metrics"
      :paradigm-pick="paradigmPick"
      :paradigm-options="paradigmOptions"
      :active-paradigm="activeParadigm"
      :angle-extras="angleExtras"
      :mos-explain="mosExplain"
      :portfolio-meaning="portfolioMeaning"
      @focus-section="focusSection"
      @paradigm-pick="onParadigmPick"
    />

    <details class="fd-density-fold">
      <summary>管理层{{ billing.canUseProHud ? '' : ' · 默认折叠' }}</summary>
      <StockManagement
        :mgmt="mgmt"
        :loading="mgmtLoading"
        :error="mgmtError"
        :people="mgmtPeople"
        :display-people="displayPeople"
        :trades="mgmtTrades"
        :press="mgmtPress"
        :comments="mgmtComments"
        :comment-about-options="commentAboutOptions"
        v-model:cmt-about="cmtAbout"
        v-model:cmt-tone="cmtTone"
        v-model:cmt-text="cmtText"
        @focus-section="focusSection"
        @retry="loadManagement"
        @submit-comment="submitMgmtComment"
        @remove-comment="removeMgmtComment"
      />
    </details>

    <template v-if="showAnalysis && sent">
      <details class="fd-density-fold">
        <summary>情绪 / 交易建议{{ billing.canUseProHud ? '' : ' · 默认折叠' }}</summary>
        <StockSentiment :sent="sent" :pos="pos" @focus-section="focusSection" />
      </details>
      <details class="fd-density-fold">
        <summary>事件 / 资讯{{ billing.canUseProHud ? '' : ' · 默认折叠' }}</summary>
        <StockEvents :events="futureEvents" :news="news" @focus-section="focusSection" />
      </details>
    </template>

    <div v-else-if="loading" class="card af stock-status skel-block" aria-busy="true">
      <div class="skel-line skel-w-80" />
      <div class="skel-line skel-w-55" />
      <div class="skel-line skel-w-70" />
    </div>
    <div v-else class="card af stock-status">点击「开始采集」获取最新消息面与估值信号。</div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { usePortfolioStore } from '@/store/portfolio'
import { useUserStore } from '@/store/user'
import { useBillingStore } from '@/store/billing'
import { getIndustry } from '@/services/industry.js'
import { fetchQuoteCached, hydrateFinancial } from '@/services/api.js'
import {
  fetchManagement,
  loadMgmtComments,
  saveMgmtComment,
  deleteMgmtComment,
} from '@/services/management.js'
import { getFinancial, peekFinancial } from '@/data/loader.js'
import { useEventStore } from '@/store/event'
import { resolveEventSource } from '@/utils/eventSource'
import {
  VALUATION_PARADIGMS,
  getParadigmById,
  paradigmsForEngineModel,
} from '@/data/valuation_paradigms.js'
import { extractConstraints } from '@/services/constraints.js'
import { portfolioMeaningLine } from '@/services/decisionBridge.js'
import StockValuation from '@/components/stock/StockValuation.vue'
import StockManagement from '@/components/stock/StockManagement.vue'
import StockSentiment from '@/components/stock/StockSentiment.vue'
import StockEvents from '@/components/stock/StockEvents.vue'

const route = useRoute()
const portfolio = usePortfolioStore()
const user = useUserStore()
const billing = useBillingStore()
const eventStore = useEventStore()
const liveQuote = ref(null)
const showAnalysis = ref(false)
const mgmt = ref(null)
const mgmtLoading = ref(false)
const mgmtError = ref('')
const mgmtComments = ref([])
const cmtText = ref('')
const cmtTone = ref('mixed')
const cmtAbout = ref('管理层')
const paradigmPick = ref('')
const quoteError = ref('')
const analyzeError = ref('')
const pageLoading = ref(true)
const isNarrow = ref(false)
let narrowMq = null
const syncNarrow = () => {
  isNarrow.value = !!narrowMq?.matches
}
const mgmtPeople = computed(() => mgmt.value?.people || [])
const displayPeople = computed(() => mgmt.value?.keyPeople?.length ? mgmt.value.keyPeople : mgmtPeople.value.slice(0, 6))
const mgmtTrades = computed(() => mgmt.value?.trades || [])
const mgmtPress = computed(() => mgmt.value?.press || [])
const commentAboutOptions = computed(() => {
  const opts = ['管理层', '董事长', '总经理/总裁', '财务负责人']
  for (const p of displayPeople.value) {
    const label = `${p.role}·${p.name}`
    if (!opts.includes(label)) opts.push(label)
  }
  return opts
})
let pageEnteredAt = 0
let pageMeta = { code: '', name: '', industry: '' }
let maxScroll = 0
const viewedCodes = new Set()
const focusedSections = new Set()
let scrollMarks = new Set()

const code = computed(() => route.params.code)
const holding = computed(() => portfolio.findHolding(code.value))
const stockName = computed(() => portfolio.nameOf(code.value))
const isHK = computed(() => holding.value?.ex === 'HK' || (code.value && code.value.length <= 5 && !code.value.startsWith('6') && !code.value.startsWith('0') && !code.value.startsWith('3')))
const currency = computed(() => (isHK.value ? 'HK$' : '¥'))
const industry = computed(() => getIndustry(code.value, stockName.value))
const analysis = computed(() => portfolio.stockAnalyses[code.value])
const sent = computed(() => analysis.value?.sent || null)
const news = computed(() => analysis.value?.news || [])
const futureEvents = computed(() => {
  const fromAnalysis = analysis.value?.futureEvents || analysis.value?.sent?.futureEvents || []
  const fromStore = [
    ...(eventStore.autoEvents || []),
    ...(eventStore.manualEvents || []),
  ]
    .filter((e) => String(e.related_stock_codes || '').includes(String(code.value || '')))
    .map((e) => {
      const src = resolveEventSource(e, code.value)
      return {
        title: e.title,
        date: e.event_date || '待定',
        certainty: e.event_type === 'confirmed' ? 'confirmed' : 'likely',
        importance: e.importance || 3,
        category: e.catalyst_type || 'general',
        categoryLabel: e.catalyst_label || (e.catalyst_type ? '催化剂' : '日历事件'),
        reason: e.catalyst_label || '事件库',
        desc: e.description || '',
        source: src.source,
        url: src.url,
        tradeHint: e.trade_hint
          ? { text: e.trade_hint, label: e.catalyst_label, buyFrom: e.buy_from, sellBy: e.sell_by }
          : null,
      }
    })
  const fromNews = (fromAnalysis || []).map((e) => {
    const src = resolveEventSource(e, code.value)
    return {
      ...e,
      url: e.url || src.url,
      source: e.source || src.source,
    }
  })
  const merged = [...fromStore, ...fromNews]
  const seen = new Set()
  return merged.filter((e) => {
    const k = `${e.title}|${e.date}`
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
})

const mosExplain = computed(() => {
  const d = fin.value?.dcf
  const m = fin.value?.marginOfSafety
  if (m == null || !d) return ''
  const conf =
    d.mosConfidence === 'low' ? '置信度低' : d.mosConfidence === 'medium' ? '置信度中' : '置信度尚可'
  const anchor = d.primaryAnchor ? `主锚 ${d.primaryAnchor}。` : ''
  if (d.mosConfidence === 'low') {
    return `${anchor}${conf}：缺关键账面/现金流时不作精确目标价。巴菲特：不确定时缩小承诺，而不是放大折现戏剧性。`
  }
  return `安全边际按「保守内在价值」计算（非乐观DCF）。${anchor}现价对熊/基/牛：¥${d.ivBear ?? '—'} / ¥${d.ivBase ?? '—'} / ¥${d.ivBull ?? '—'}。${conf}。巴菲特：只有价格显著低于保守估值才叫有安全边际；好公司卖在公允价 ≠ 深度低估。`
})

const loading = computed(() => !!analysis.value?.loading)
const fin = computed(() => {
  const existing = portfolio.financialData[code.value]
  if (existing) return existing
  return portfolio.getFin(code.value, stockName.value)
})

const portfolioMeaning = computed(() => {
  if (!code.value) return ''
  const profile = user.getUserProfile()
  const constraints = extractConstraints(profile, user.profile)
  return portfolioMeaningLine({
    code: code.value,
    holdings: portfolio.allHoldings,
    constraints,
    totalMv: portfolio.totals.mv,
    getPrice: (c, fb) => portfolio.getPrice(c, fb),
    mos: fin.value?.marginOfSafety,
    fin: fin.value,
  })
})

const paradigmOptions = computed(() => {
  const model = fin.value?.dcf?.industryModel
  const related = model ? paradigmsForEngineModel(model) : []
  const base = related.length ? related : VALUATION_PARADIGMS.slice(0, 12)
  const seen = new Set(base.map((p) => p.id))
  const rest = VALUATION_PARADIGMS.filter((p) => !seen.has(p.id))
  return [...base, ...rest]
})

const activeParadigm = computed(() => getParadigmById(paradigmPick.value) || getParadigmById(fin.value?.dcf?.paradigmId))

const angleExtras = computed(() => {
  const d = fin.value?.dcf
  if (!d?.angles?.length) return []
  return d.angles.filter((a) => !/^主视角：|^辅视角：/.test(a)).slice(0, 2)
})

watch(
  () => fin.value?.dcf?.paradigmId,
  (id) => {
    if (id) paradigmPick.value = id
  },
  { immediate: true },
)

function onParadigmPick(id) {
  paradigmPick.value = id
  const p = getParadigmById(id)
  if (!id || !code.value) return
  const dcf = portfolio.revalueStock(code.value, { paradigmOverride: id })
  if (!dcf) return
  if (dcf.overrideApplied) {
    user.toast?.(`已按「${p?.name || id}」重算主锚（${dcf.archetypeLabel || dcf.archetype}）`)
  } else if (dcf.overrideThinkingOnly || !p?.engineHint) {
    user.toast?.(`「${p?.name || id}」为思维框架：角度已更新，IV仍按可计算主锚`)
  } else {
    user.toast?.(`已切换「${p?.name || id}」并刷新估值`)
  }
}

const price = computed(() => liveQuote.value?.price ?? portfolio.getPrice(code.value, holding.value?.cost || fin.value?.price || 0))
const changePct = computed(() => liveQuote.value?.change_pct ?? fin.value?.change_pct)
const quoteMetaLabel = computed(() => {
  const src = liveQuote.value?.source || fin.value?.quoteSource || ''
  const asOf = liveQuote.value?.asOf || fin.value?.quoteAsOf || fin.value?.dcf?.asOf || ''
  if (!src && !asOf) return ''
  const srcLabel =
    src === 'jsonp-fallback' ? 'jsonp-fallback' : src === 'cache' ? 'cache' : src === 'proxy' ? 'proxy' : src
  let when = ''
  if (asOf) {
    try {
      const d = new Date(asOf)
      when = Number.isNaN(d.getTime())
        ? String(asOf).slice(0, 16)
        : d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
    } catch {
      when = String(asOf).slice(0, 16)
    }
  }
  return [when && `asOf ${when}`, srcLabel].filter(Boolean).join(' · ')
})
const pos = computed(() => portfolio.positionFor(code.value))

const metrics = computed(() => {
  const f = fin.value || {}
  const modelEps = f.dcf?.currentEPS
  return [
    { label: 'ROE', value: f.roe != null ? f.roe + '%' : '—' },
    { label: 'PE(TTM)', value: f.pe_ttm != null ? Number(f.pe_ttm).toFixed(1) : '—' },
    { label: 'PB', value: f.pb != null ? Number(f.pb).toFixed(2) : '—' },
    { label: '毛利率', value: f.grossMargin != null ? f.grossMargin + '%' : '—' },
    { label: '净利率', value: f.netMargin != null ? f.netMargin + '%' : '—' },
    { label: '资产负债率', value: f.debtRatio != null ? f.debtRatio + '%' : '—' },
    { label: '利润增速', value: f.profitGrowth != null ? f.profitGrowth + '%' : '—', color: f.profitGrowth >= 0 ? 'var(--green)' : 'var(--red)' },
    {
      label: '估值EPS',
      value: modelEps != null ? '¥' + Number(modelEps).toFixed(2) : f.eps != null ? '¥' + Number(f.eps).toFixed(2) : '—',
    },
  ]
})

function focusSection(section) {
  if (!code.value) return
  const key = `${code.value}:${section}`
  if (focusedSections.has(key)) return
  focusedSections.add(key)
  user.track(user.EVENT_TYPES.SECTION_FOCUS, {
    stockCode: code.value,
    stockName: stockName.value,
    industry: industry.value,
    section,
    sentimentScore: sent.value?.total,
  })
}

function onScroll() {
  const el = document.documentElement
  const total = el.scrollHeight - el.clientHeight
  if (total <= 0) return
  const pct = Math.round((el.scrollTop / total) * 100)
  if (pct > maxScroll) maxScroll = pct
  for (const mark of [25, 50, 75, 90]) {
    if (pct >= mark && !scrollMarks.has(mark)) {
      scrollMarks.add(mark)
      user.track(user.EVENT_TYPES.SCROLL_DEPTH, {
        stockCode: code.value,
        stockName: stockName.value,
        scrollPercent: mark,
      })
    }
  }
}

async function refreshQuote() {
  const reqCode = code.value
  if (!reqCode) return
  const ex = holding.value?.ex || (reqCode.startsWith('6') ? 'SH' : 'SZ')
  quoteError.value = ''
  try {
    const q = await fetchQuoteCached(reqCode, ex)
    if (!q || reqCode !== code.value) return
    liveQuote.value = q
    const staticFin = peekFinancial(reqCode) || (await getFinancial(reqCode)) || {}
    if (reqCode !== code.value) return
    const base = {
      ...staticFin,
      ...(portfolio.financialData[reqCode] || {}),
      price: q.price,
      change_pct: q.change_pct,
      asOf: q.asOf || null,
      source: q.source || null,
      quoteAsOf: q.asOf || null,
      quoteSource: q.source || null,
    }
    portfolio.setFinancial(reqCode, hydrateFinancial(base, reqCode, stockName.value))
  } catch (e) {
    if (reqCode === code.value) {
      quoteError.value = e?.message || '行情刷新失败，可稍后重试'
    }
  }
}

function retryQuote() {
  refreshQuote()
}

async function loadManagement() {
  const reqCode = code.value
  if (!reqCode) return
  mgmtLoading.value = true
  mgmtError.value = ''
  mgmt.value = null
  mgmtComments.value = loadMgmtComments(reqCode)
  cmtAbout.value = '管理层'
  try {
    const data = await fetchManagement(reqCode, { name: stockName.value })
    if (reqCode !== code.value) return
    mgmt.value = data
    if (data.error && !data.people?.length) {
      mgmtError.value = '管理层数据暂不可用（网络或标的未覆盖）'
    }
    if (data.assessment && portfolio.financialData[reqCode]) {
      const base = {
        ...portfolio.financialData[reqCode],
        managementScore: data.assessment.score,
        managementNotes: data.assessment.notes,
      }
      portfolio.setFinancial(reqCode, hydrateFinancial(base, reqCode, stockName.value))
    }
  } catch {
    if (reqCode === code.value) mgmtError.value = '管理层信息加载失败'
  } finally {
    if (reqCode === code.value) mgmtLoading.value = false
  }
}

function submitMgmtComment() {
  try {
    saveMgmtComment(code.value, {
      text: cmtText.value,
      tone: cmtTone.value,
      about: cmtAbout.value,
      author: user.profile?.name || '本机投资者',
    })
    mgmtComments.value = loadMgmtComments(code.value)
    cmtText.value = ''
    user.toast('评论已保存到本机')
  } catch (e) {
    user.toast(e?.message || '评论失败')
  }
}

function removeMgmtComment(id) {
  deleteMgmtComment(code.value, id)
  mgmtComments.value = loadMgmtComments(code.value)
}

async function runAnalyze() {
  showAnalysis.value = true
  analyzeError.value = ''
  const reqCode = code.value
  user.track(user.EVENT_TYPES.ANALYSIS_TRIGGER, {
    stockCode: reqCode,
    stockName: stockName.value,
    industry: industry.value,
  })
  try {
    await portfolio.analyzeStock(reqCode)
    if (reqCode !== code.value) return
    user.track(user.EVENT_TYPES.ANALYSIS_COMPLETE, {
      stockCode: reqCode,
      stockName: stockName.value,
      sentimentScore: portfolio.stockAnalyses[reqCode]?.sent?.total,
    })
    user.toast('分析完成')
  } catch {
    analyzeError.value = '采集失败，请稍后重试'
    user.toast('采集失败，可稍后重试')
  }
}

function leavePage(meta, enteredAt, scroll) {
  if (!meta?.code || !enteredAt) return
  user.track(user.EVENT_TYPES.PAGE_LEAVE, {
    stockCode: meta.code,
    stockName: meta.name,
    industry: meta.industry,
    duration: Date.now() - enteredAt,
    scrollPercent: scroll,
  })
}

watch(
  code,
  async (c, prev) => {
    if (prev) leavePage(pageMeta, pageEnteredAt, maxScroll)
    if (!c) return
    liveQuote.value = null
    mgmt.value = null
    mgmtError.value = ''
    quoteError.value = ''
    analyzeError.value = ''
    pageLoading.value = true
    showAnalysis.value = !!portfolio.stockAnalyses[c]?.sent
    pageEnteredAt = Date.now()
    maxScroll = 0
    scrollMarks = new Set()
    focusedSections.clear()
    pageMeta = {
      code: c,
      name: portfolio.nameOf(c),
      industry: getIndustry(c, portfolio.nameOf(c)),
    }
    const type = viewedCodes.has(c) ? user.EVENT_TYPES.REVISIT : user.EVENT_TYPES.PAGE_VIEW
    viewedCodes.add(c)
    user.track(type, {
      stockCode: c,
      stockName: pageMeta.name,
      industry: pageMeta.industry,
    })
    try {
      await getFinancial(c).catch(() => null)
      if (c !== code.value) return
      await refreshQuote()
      if (c !== code.value) return
      await loadManagement()
    } finally {
      if (c === code.value) pageLoading.value = false
    }
  },
  { immediate: true },
)

onMounted(() => {
  window.addEventListener('scroll', onScroll, { passive: true })
  if (typeof window.matchMedia === 'function') {
    narrowMq = window.matchMedia('(max-width: 390px)')
    syncNarrow()
    narrowMq.addEventListener?.('change', syncNarrow)
  }
})

onBeforeUnmount(() => {
  leavePage(pageMeta, pageEnteredAt, maxScroll)
  window.removeEventListener('scroll', onScroll)
  narrowMq?.removeEventListener?.('change', syncNarrow)
})
</script>

<style scoped>
.stock-back { margin-bottom: 24px; }
.stock-back-link {
  color: var(--blue, var(--accent));
  font-size: 14px;
  text-decoration: none;
}
.stock-hero {
  padding: 36px 32px;
  margin-bottom: 24px;
}
.stock-hero-row {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  position: relative;
  z-index: 1;
  flex-wrap: wrap;
}
.stock-code {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.5);
}
.stock-name {
  font-size: 28px;
  font-weight: 600;
  letter-spacing: -0.03em;
}
.stock-industry {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.45);
  margin-top: 6px;
}
.stock-quote { text-align: right; }
.stock-price {
  font-size: 32px;
  font-weight: 600;
}
.stock-chg {
  font-size: 15px;
  margin-top: 4px;
  font-weight: 600;
}
.stock-chg--up { color: #ff8a96; }
.stock-chg--down { color: #6ee0c8; }
.stock-quote-meta {
  margin-top: 6px;
  font-size: 10px;
  color: rgba(255, 255, 255, 0.45);
  font-family: var(--mono, ui-monospace, monospace);
}
.stock-decision {
  margin: 0 0 16px;
  padding: 14px 16px;
  border: 1px solid var(--sep);
  border-radius: 10px;
  background: var(--card);
}
.sd-row {
  display: grid;
  grid-template-columns: 3.5rem 1fr;
  gap: 10px;
  margin: 0 0 8px;
  font-size: 13px;
  line-height: 1.45;
  color: var(--tp);
}
.sd-row:last-child { margin-bottom: 0; }
.sd-k {
  font-size: 11px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--tt);
  padding-top: 2px;
}
.sd-link {
  color: var(--accent);
  text-decoration: none;
  font-weight: 600;
  min-height: 44px;
  display: inline-flex;
  align-items: center;
}
.stock-analyze-fold {
  margin-bottom: 12px;
}
.analyze-bar {
  padding: 20px 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}
.analyze-title {
  font-size: 15px;
  font-weight: 600;
}
.analyze-sub {
  font-size: 13px;
  color: var(--ts);
  margin-top: 4px;
}
.stock-error {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-top: 14px;
  font-size: 13px;
  color: #ff8a96;
}
.stock-error--pad {
  margin: 0;
  padding: 0 24px 16px;
  color: var(--loss);
}
.stock-status {
  padding: 24px;
  color: var(--ts);
}
.skel-hero .skel-line { background: rgba(255, 255, 255, 0.12); }
.skel-block { padding: 24px; }
.skel-line {
  height: 12px;
  border-radius: 4px;
  margin-bottom: 12px;
  background: linear-gradient(90deg, var(--sep), color-mix(in srgb, var(--sep) 40%, transparent), var(--sep));
  background-size: 200% 100%;
  animation: skel-shimmer 1.2s ease-in-out infinite;
}
.skel-lg { height: 22px; }
.skel-w-30 { width: 30%; }
.skel-w-40 { width: 40%; }
.skel-w-55 { width: 55%; }
.skel-w-60 { width: 60%; }
.skel-w-70 { width: 70%; }
.skel-w-80 { width: 80%; }
@keyframes skel-shimmer {
  0% { background-position: 100% 0; }
  100% { background-position: -100% 0; }
}
@media (prefers-reduced-motion: reduce) {
  .skel-line { animation: none; }
}
@media (max-width: 520px) {
  .stock-hero {
    padding: 24px 16px;
  }
  .stock-name {
    font-size: 22px;
  }
  .stock-price {
    font-size: 26px;
  }
  .analyze-bar {
    padding: 16px;
  }
}
</style>
