<template>
  <div class="page passport">
    <div class="page-head">
      <div>
        <h2 class="pt">画像说明书</h2>
        <p class="pt-sub">系统认为你是谁 · 可纠错 · 纠错后立刻重算硬约束</p>
      </div>
      <router-link class="btn bs" :to="continueScenarioTo">{{ continueScenarioLabel }}</router-link>
    </div>

    <div class="card pass-hero">
      <div class="pass-mode" :data-mode="summary.modeLabel">{{ summary.modeLabel }}</div>
      <h3>FinDigest 对你的理解</h3>
      <p class="pass-line">
        {{ summary.style || '风格待定' }} · {{ summary.risk || '风险待定' }} · {{ summary.horizon || '周期待定' }}
        · 进度 {{ summary.progress }}
      </p>
      <div v-if="summary.personality?.length" class="pass-tags">
        <span v-for="(t, i) in summary.personality" :key="i" class="tag">{{ t.tag || t }}</span>
      </div>
      <p v-if="summary.feedbackNote" class="pass-fb">校准：{{ summary.feedbackNote }}</p>
    </div>

    <div id="weight-contract" class="card">
      <h3 class="sec">调权契约</h3>
      <p v-if="weightContract.sampleInsufficient" class="hint">
        样本不足：尚无足够 ADOPT / REJECT / IGNORE 信号解释调权。完成几次简报反馈后再来看。
      </p>
      <template v-else>
        <p class="pass-fb">{{ weightContract.sentence }}</p>
        <ul v-if="weightContract.items.length" class="pass-life-read">
          <li v-for="(it, i) in weightContract.items" :key="i">{{ it.text }}</li>
        </ul>
        <p v-if="weightContract.weightDeltas?.length" class="hint">
          相对默认权重差：
          <span v-for="(d, i) in weightContract.weightDeltas.slice(0, 4)" :key="d.key">
            {{ d.label }} {{ d.delta > 0 ? '+' : '' }}{{ d.delta }}<template v-if="i < Math.min(3, weightContract.weightDeltas.length - 1)"> · </template>
          </span>
        </p>
      </template>
      <p v-if="driftReasons.length" class="hint" style="margin-top: 10px">
        偏好漂移：{{ driftReasons.map((r) => r.text).join('；') }}
      </p>
      <router-link class="btn bs" to="/app" style="margin-top: 10px">回今日简报反馈</router-link>
    </div>

    <div class="card">
      <h3 class="sec">硬约束（生效中）</h3>
      <div class="pass-grid">
        <label>
          回撤容忍 %
          <input v-model.number="overrides.maxDrawdown" type="number" min="5" max="60" placeholder="如 20" />
        </label>
        <label>
          单票上限 %
          <input v-model.number="overrides.singleStockMax" type="number" min="5" max="60" placeholder="如 25" />
        </label>
      </div>
      <p class="hint">留空则沿用 88 题聚合结果。保存后覆盖问卷推导值。</p>
      <button class="btn bp" type="button" @click="saveOverrides">保存纠错并重算</button>
    </div>

    <div class="card">
      <h3 class="sec">人生现金流</h3>
      <div class="pass-grid">
        <label>
          这笔钱大概何时要用
          <select v-model="life.moneyNeedHorizon">
            <option :value="null">未填</option>
            <option value="<1y">1 年内</option>
            <option value="1-3y">1–3 年</option>
            <option value="3-5y">3–5 年</option>
            <option value="5y+">5 年以上</option>
          </select>
        </label>
        <label>
          是否有房贷/重大负债
          <select v-model="life.hasMortgage">
            <option :value="null">未填</option>
            <option value="yes">有</option>
            <option value="no">无</option>
          </select>
        </label>
        <label>
          赡养/抚养人数
          <select v-model="life.dependents">
            <option :value="null">未填</option>
            <option value="0">0</option>
            <option value="1">1</option>
            <option value="2+">2+</option>
          </select>
        </label>
        <label>
          应急备用金（月支出倍数）
          <select v-model="life.emergencyMonths">
            <option :value="null">未填</option>
            <option value="0-3">不足 3 个月</option>
            <option value="3-6">3–6 个月</option>
            <option value="6-12">6–12 个月</option>
            <option value="12+">12 个月以上</option>
          </select>
        </label>
      </div>
      <button class="btn bp" type="button" @click="saveLife">保存现金流层</button>
      <ul class="pass-life-read">
        <li>用钱时间：{{ summary.life.moneyNeedHorizon }}</li>
        <li>负债：{{ summary.life.hasMortgage }}</li>
        <li>赡养：{{ summary.life.dependents }}</li>
        <li>备用金：{{ summary.life.emergencyMonths }}</li>
      </ul>
    </div>

    <div class="card">
      <h3 class="sec">行业名单</h3>
      <p><strong>关注</strong>：{{ summary.preferred.join('、') || '未设' }}</p>
      <p><strong>回避</strong>：{{ summary.avoid.join('、') || '未设' }}</p>
      <router-link class="btn bs" to="/settings">去设置改行业</router-link>
    </div>

    <div v-if="holdingHits.length" class="card">
      <h3 class="sec">对着你的持仓</h3>
      <div v-for="r in holdingHits" :key="r.code" class="pass-hit">
        <strong>{{ r.name }}</strong>
        <span>{{ r.weight.toFixed(1) }}% · {{ r.industry }}</span>
        <p v-for="(iss, i) in r.issues" :key="i" class="pass-iss">{{ iss.message }}</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, reactive } from 'vue'
import { useUserStore } from '@/store/user'
import { usePortfolioStore } from '@/store/portfolio'
import {
  extractConstraints,
  evaluateHoldings,
  buildPassportSummary,
} from '@/services/constraints.js'
import { essentialsDone } from '@/services/profiling.js'
import { useBillingStore } from '@/store/billing'

const user = useUserStore()
const portfolio = usePortfolioStore()
const billing = useBillingStore()
billing.hydrate()

const essentialsComplete = computed(
  () =>
    !!user.profile.essentialsDone ||
    essentialsDone(user.profile.scenarioAnswers || {}),
)

const continueScenarioTo = computed(() => {
  if (!essentialsComplete.value) return '/settings?focus=essentials#profile-scenario'
  if (billing.canUseProHud && !user.profile.onboardingDone) return '/settings?focus=full#profile-scenario'
  return '/settings#profile-scenario'
})

const continueScenarioLabel = computed(() => {
  if (!essentialsComplete.value) return '继续答核心题'
  if (billing.canUseProHud && !user.profile.onboardingDone) return '继续补全 88 题'
  return '查看私人定制'
})

const overrides = reactive({
  maxDrawdown: user.profile.manualOverrides?.maxDrawdown
    ? parseFloat(String(user.profile.manualOverrides.maxDrawdown).replace('%', ''))
    : null,
  singleStockMax: user.profile.manualOverrides?.singleStockMax
    ? parseFloat(String(user.profile.manualOverrides.singleStockMax).replace('%', ''))
    : null,
})

const life = reactive({
  moneyNeedHorizon: user.profile.life?.moneyNeedHorizon ?? null,
  hasMortgage: user.profile.life?.hasMortgage ?? null,
  dependents: user.profile.life?.dependents ?? null,
  emergencyMonths: user.profile.life?.emergencyMonths ?? null,
})

const summary = computed(() => {
  const profile = user.getUserProfile()
  const constraints = extractConstraints(profile, user.profile)
  return buildPassportSummary(user.profile, constraints, user.personality)
})

const holdingHits = computed(() => {
  const profile = user.getUserProfile()
  const constraints = extractConstraints(profile, user.profile)
  const { rows } = evaluateHoldings(
    portfolio.allHoldings,
    portfolio.totals.mv,
    (c, fb) => portfolio.getPrice(c, fb),
    constraints,
  )
  return rows.filter((r) => r.issues.length)
})

const weightContract = computed(() => user.weightExplanation || {
  sampleInsufficient: true,
  items: [],
  sentence: '样本不足',
  weightDeltas: [],
})

const driftReasons = computed(() => user.driftAnalysis?.reasons || [])

function saveOverrides() {
  const manualOverrides = { ...(user.profile.manualOverrides || {}) }
  if (overrides.maxDrawdown != null && overrides.maxDrawdown !== '') {
    manualOverrides.maxDrawdown = `${overrides.maxDrawdown}%`
  } else {
    delete manualOverrides.maxDrawdown
  }
  if (overrides.singleStockMax != null && overrides.singleStockMax !== '') {
    manualOverrides.singleStockMax = `${overrides.singleStockMax}%`
  } else {
    delete manualOverrides.singleStockMax
  }
  user.saveProfile({ manualOverrides }, { silent: true })
  user.toast('硬约束已更新，重新生成简报即可生效')
}

function saveLife() {
  user.saveProfile(
    {
      life: {
        ...(user.profile.life || {}),
        moneyNeedHorizon: life.moneyNeedHorizon,
        hasMortgage: life.hasMortgage,
        dependents: life.dependents,
        emergencyMonths: life.emergencyMonths,
      },
    },
    { silent: true },
  )
  user.toast('人生现金流已写入约束引擎')
}
</script>

<style scoped>
.pass-hero {
  padding: 22px;
  margin-bottom: 14px;
}
.pass-mode {
  display: inline-block;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  padding: 4px 8px;
  border-radius: 6px;
  background: var(--accent-soft);
  color: var(--accent);
  margin-bottom: 10px;
}
.pass-mode[data-mode='观察模式'] {
  background: var(--loss-soft);
  color: var(--loss);
}
.pass-line {
  color: var(--ts);
  margin: 8px 0 12px;
}
.pass-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.pass-tags .tag {
  font-size: 12px;
  padding: 4px 8px;
  border-radius: 99px;
  background: var(--surface-2);
  border: 1px solid var(--sep);
}
.pass-fb {
  margin-top: 12px;
  font-size: 13px;
  color: var(--tt);
}
.card {
  padding: 20px 22px;
  margin-bottom: 14px;
}
.sec {
  margin: 0 0 12px;
  font-size: 15px;
}
.pass-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 12px;
}
.pass-grid label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 12px;
  color: var(--ts);
}
.pass-grid input,
.pass-grid select {
  height: 36px;
  padding: 0 10px;
  border: 1px solid var(--sep);
  border-radius: var(--rb);
  background: var(--surface);
  color: var(--tp);
}
.hint {
  font-size: 12px;
  color: var(--tt);
  margin: 0 0 12px;
}
.pass-life-read {
  margin: 14px 0 0;
  padding-left: 18px;
  color: var(--ts);
  font-size: 13px;
}
.pass-hit {
  padding: 10px 0;
  border-bottom: 1px solid var(--sep);
  display: grid;
  gap: 4px;
}
.pass-hit span {
  font-size: 12px;
  color: var(--tt);
}
.pass-iss {
  margin: 0;
  font-size: 13px;
  color: var(--loss);
}
@media (max-width: 640px) {
  .pass-grid {
    grid-template-columns: 1fr;
  }
}
</style>
