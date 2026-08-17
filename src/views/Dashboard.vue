<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h2 class="pt">完整分析</h2>
        <p class="pt-sub">
          进阶工作区 · <router-link to="/app">返回今日</router-link>
          · <router-link to="/more">我的</router-link>
        </p>
      </div>
    </div>
    <div v-if="showOnboardingGate" class="gate-banner">
      <div>
        <strong>观察模式</strong>
        <span v-if="billing.canUseProHud">
          私人定制 {{ user.profile.scenarioProgress || 0 }}/88 — 完整建议已锁定
        </span>
        <span v-else>
          基础定制 {{ essentialProgress }}/{{ essentialTotal }} — 先答完身份章即可解锁
        </span>
      </div>
      <div class="gate-actions">
        <router-link class="btn bp" :to="continueScenarioTo">继续定制</router-link>
      </div>
    </div>

    <DashboardBriefing :report="latestBriefing" />
    <DashboardActions />
    <DashboardHoldings />

    <details class="ws-more">
      <summary>更多面板（统计 · 人格 · 进度 · 报告）</summary>
      <div class="ws-more-body">
        <DashboardHero :gen-loading="genLoading" @gen-report="genReport" />
        <DashboardStats />
        <DashboardPersonality />
        <DashboardProgress />
        <DashboardReports />
      </div>
    </details>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useUserStore } from '@/store/user'
import { usePortfolioStore } from '@/store/portfolio'
import { useEventStore } from '@/store/event'
import { useBillingStore } from '@/store/billing'
import { generateDailyReport } from '@/services/ai.js'
import { loadLatestBriefing, saveBriefing } from '@/services/briefingArchive.js'
import { essentialsDone, ESSENTIAL_QUESTION_IDS, ESSENTIAL_QUESTION_COUNT } from '@/services/profiling.js'
import DashboardHero from '@/components/dashboard/DashboardHero.vue'
import DashboardPersonality from '@/components/dashboard/DashboardPersonality.vue'
import DashboardBriefing from '@/components/dashboard/DashboardBriefing.vue'
import DashboardStats from '@/components/dashboard/DashboardStats.vue'
import DashboardActions from '@/components/dashboard/DashboardActions.vue'
import DashboardProgress from '@/components/dashboard/DashboardProgress.vue'
import DashboardHoldings from '@/components/dashboard/DashboardHoldings.vue'
import DashboardReports from '@/components/dashboard/DashboardReports.vue'

const user = useUserStore()
const portfolio = usePortfolioStore()
const events = useEventStore()
const billing = useBillingStore()
billing.hydrate()
const genLoading = ref(false)
const latestBriefing = ref(loadLatestBriefing())

const essentialsComplete = computed(
  () =>
    !!user.profile.essentialsDone ||
    essentialsDone(user.profile.scenarioAnswers || {}),
)

const essentialProgress = computed(() => {
  const a = user.profile.scenarioAnswers || {}
  return ESSENTIAL_QUESTION_IDS.filter((id) => !!a[id]).length
})
const essentialTotal = ESSENTIAL_QUESTION_COUNT

/** Basic: gate only until 11 done; Pro: until 88 */
const showOnboardingGate = computed(() => {
  if (billing.canUseProHud) return !user.profile.onboardingDone
  return !essentialsComplete.value
})

const continueScenarioTo = computed(() => {
  if (!billing.canUseProHud) return '/settings?focus=essentials#profile-scenario'
  return essentialsComplete.value
    ? '/settings?focus=full#profile-scenario'
    : '/settings?focus=essentials#profile-scenario'
})

const financialMap = computed(() => portfolio.financialData || {})

onMounted(async () => {
  await user.recalibrate()
  await user.runVerification((code) => portfolio.getPrice(code, null))
})

async function genReport() {
  // Mirror ButlerHome: Free + API key must not bypass Pro LLM paywall
  const wantLlm = !!(user.aiConfig?.enabled && user.aiConfig?.apiKey)
  if (wantLlm && !billing.canUseLlm) {
    user.toast('AI 增强需开通 Pro')
  }
  genLoading.value = true
  user.track(user.EVENT_TYPES.SUGGESTION_VIEW, { suggestionType: 'daily_report', section: 'dashboard' })
  try {
    await portfolio.autoFetchAll()
    await user.recalibrate()
    const profile = user.getUserProfile()
    const aiConfig = billing.canUseLlm
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
      getPrice: (code, fb) => portfolio.getPrice(code, fb),
    })
    latestBriefing.value = report
    saveBriefing(report)

    const summary = `${report.headline}\n\n` + report.items.map((i) => `· ${i.title}`).join('\n')
    events.generateReport(user, summary)
    user.toast(report.source === 'llm' ? 'AI 报告已生成（LLM）' : '今日分析报告已生成')
  } catch (e) {
    console.error(e)
    user.toast('报告生成失败，请稍后重试')
  } finally {
    genLoading.value = false
  }
}
</script>

<style scoped>
.gate-banner {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin: 0 0 16px;
  padding: 14px 16px;
  border-radius: var(--rb, 12px);
  border: 1px solid color-mix(in srgb, var(--warn) 35%, var(--sep));
  background: var(--warn-soft);
}
.gate-banner strong {
  display: block;
  margin-bottom: 2px;
}
.gate-banner span {
  font-size: 13px;
  color: var(--ts);
}
.gate-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.ws-more {
  margin-top: 28px;
  padding-top: 20px;
  border-top: 1px solid var(--sep);
}
.ws-more summary {
  cursor: pointer;
  font-size: 13px;
  font-weight: 650;
  letter-spacing: 0.04em;
  color: var(--ts);
  list-style: none;
  margin-bottom: 16px;
}
.ws-more summary::-webkit-details-marker {
  display: none;
}
.ws-more summary::before {
  content: '+ ';
  font-family: var(--mono, monospace);
  color: var(--tt);
}
.ws-more[open] summary::before {
  content: '− ';
}
.ws-more-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
</style>
