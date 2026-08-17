<template>
  <section class="section af personality">
    <div class="section-h">
      <h3>{{ isJournal ? 'Investor Profile' : '你的投资性格' }}</h3>
      <span class="ch-meta">{{ confidenceLabel }}</span>
    </div>
    <div class="section-body">
      <div v-if="!user.profile.onboardingDone" class="empty">
        <template v-if="billing.canUseProHud">
          私人定制未完成（{{ user.profile.scenarioProgress || 0 }}/88）。答完细分题后，管家才能按你的约束给建议。
        </template>
        <template v-else>
          基础定制未完成。答完 11 题身份章后即可生成观察简报。
        </template>
        <router-link :to="billing.canUseProHud ? '/settings' : '/settings?focus=essentials#profile-scenario'">
          去完善画像 →
        </router-link>
      </div>
      <template v-else>
        <div class="tags">
          <span v-for="p in tags" :key="p.tag" class="tag" :title="p.desc">
            {{ p.tag }}
            <em>{{ Math.round(p.confidence * 100) }}%</em>
          </span>
          <span v-if="!tags.length" class="muted">行为数据累积中，标签将随使用自动生成</span>
        </div>
        <div class="grid">
          <div>
            <div class="lbl">风险校准</div>
            <div class="val">{{ riskPct }}</div>
            <div class="sub">综合判定 · 置信 {{ Math.round((user.riskCalibration.confidence || 0) * 100) }}%</div>
          </div>
          <div>
            <div class="lbl">分析深度</div>
            <div class="val">{{ featPct('analysisDepth') }}</div>
            <div class="sub">停留与滚动推断</div>
          </div>
          <div>
            <div class="lbl">估值敏感</div>
            <div class="val">{{ featPct('valuationSensitivity') }}</div>
            <div class="sub">对低估/高估建议的反应</div>
          </div>
          <div>
            <div class="lbl">偏好状态</div>
            <div class="val sm">{{ user.driftAnalysis.msg || '—' }}</div>
            <div class="sub">近 30 天 vs 历史</div>
          </div>
        </div>
        <p v-if="topWeights" class="weights">个性化权重侧重：{{ topWeights }}</p>
      </template>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import { useUserStore } from '@/store/user'
import { useBillingStore } from '@/store/billing'
import { ESSENTIAL_QUESTION_COUNT, ESSENTIAL_QUESTION_IDS } from '@/services/profiling.js'

const user = useUserStore()
const billing = useBillingStore()
const isJournal = computed(() => user.designStyle === 'journal')
const tags = computed(() => (user.personality || []).slice(0, 4))
const essentialAnswered = computed(() => {
  const a = user.profile.scenarioAnswers || {}
  return ESSENTIAL_QUESTION_IDS.filter((id) => !!a[id]).length
})
const confidenceLabel = computed(() => {
  if (billing.canUseProHud) {
    return user.profile.onboardingDone
      ? `私人定制 ${user.profile.scenarioProgress || 88}/88`
      : '待完成 88 题定制'
  }
  return user.profile.onboardingDone
    ? `基础定制 ${ESSENTIAL_QUESTION_COUNT}/${ESSENTIAL_QUESTION_COUNT}`
    : `待完成基础定制 ${essentialAnswered.value}/${ESSENTIAL_QUESTION_COUNT}`
})
const riskPct = computed(() => `${Math.round((user.riskCalibration.actual ?? 0.5) * 100)}%`)

function featPct(key) {
  return `${Math.round((user.features?.[key] ?? 0.5) * 100)}%`
}

const topWeights = computed(() => {
  const w = user.personalWeights
  if (!w) return ''
  return Object.entries(w)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([k, v]) => `${k} ${v}`)
    .join(' · ')
})
</script>

<style scoped>
.empty {
  font-size: 13px;
  color: var(--ts);
  line-height: 1.6;
}
.empty a {
  color: var(--accent);
  font-weight: 600;
  margin-left: 6px;
}
.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 14px;
}
.tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-radius: var(--rb);
  border: 1px solid var(--sep);
  background: var(--surface);
  font-size: 12px;
  font-weight: 700;
}
.tag em {
  font-style: normal;
  color: var(--tt);
  font-weight: 600;
}
.muted {
  font-size: 13px;
  color: var(--tt);
}
.grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}
.lbl {
  font-size: 11px;
  color: var(--tt);
  font-weight: 600;
}
.val {
  font-size: 20px;
  font-weight: 700;
  letter-spacing: -0.03em;
  margin-top: 4px;
  font-family: var(--mono);
}
.val.sm {
  font-size: 13px;
  font-family: var(--font);
  line-height: 1.4;
}
.sub {
  font-size: 11px;
  color: var(--tt);
  margin-top: 4px;
}
.weights {
  margin: 14px 0 0;
  font-size: 12px;
  color: var(--ts);
}
@media (max-width: 720px) {
  .grid {
    grid-template-columns: 1fr 1fr;
  }
}
</style>
