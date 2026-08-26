<template>
  <div
    v-if="fin"
    class="card af d2"
    data-section="financial"
    @mouseenter="$emit('focus-section', 'financial')"
  >
    <div class="ch"><h3>财务与估值</h3></div>
    <div class="metric-grid">
      <div v-for="m in metrics" :key="m.label" class="metric">
        <div class="ml">{{ m.label }}</div>
        <div class="mv" :class="metricTone(m)">{{ m.value }}</div>
      </div>
    </div>
    <div
      v-if="fin.dcf"
      class="dcf-box"
      data-section="valuation"
      @mouseenter="$emit('focus-section', 'valuation')"
    >
      <div class="dcf-title">
        {{ fin.dcf?.archetypeLabel || '保守估值' }} · {{ fin.dcf?.verdict || '—' }}
        <span v-if="fin.dcf?.quality" class="dcf-title-muted"> · 质量 {{ fin.dcf.quality }}</span>
        <span v-if="fin.dcf?.primaryAnchor" class="dcf-title-anchor"> · 主锚 {{ fin.dcf.primaryAnchor }}</span>
      </div>
      <div v-if="fin.dcf?.paradigmName" class="paradigm-chip">
        <div class="paradigm-chip-head">
          <span>主锚原型 / 思维角度</span>
          <select :value="paradigmPick" class="paradigm-select" @change="onPick">
            <option v-for="p in labeledParadigmOptions" :key="p.id" :value="p.id">
              {{ p.optionLabel }}
            </option>
          </select>
        </div>
        <p class="paradigm-chip-honest">{{ paradigmHonestLine }}</p>
        <p class="paradigm-chip-desc">{{ activeParadigm?.desc || fin.dcf.paradigmDesc }}</p>
        <p class="paradigm-chip-when">适用：{{ activeParadigm?.when || fin.dcf.paradigmWhen }}</p>
        <div v-if="fin.dcf?.primary || fin.dcf?.angles?.length" class="paradigm-angles">
          <p v-if="fin.dcf.primary?.reason" class="paradigm-angle-line">
            主：{{ fin.dcf.primary.paradigmName || fin.dcf.paradigmName }}
            <span v-if="fin.dcf.archetypeLabel"> · {{ fin.dcf.archetypeLabel }}</span>
            — {{ fin.dcf.primary.reason }}
          </p>
          <p
            v-for="s in (fin.dcf.secondary || []).slice(0, 2)"
            :key="s.paradigmId"
            class="paradigm-angle-line secondary"
          >
            辅：{{ s.paradigmName }}{{ s.weight != null ? ` · ${(s.weight * 100) | 0}%` : '' }} — {{ s.reason }}
          </p>
          <p v-if="fin.dcf?.ensemble?.blended" class="paradigm-angle-line blend">
            已按主辅权重重算区间
          </p>
          <p
            v-for="(a, i) in angleExtras"
            :key="'a' + i"
            class="paradigm-angle-line extra"
          >
            {{ a }}
          </p>
        </div>
      </div>
      <div v-if="methodCardSummary" class="method-card">
        <p class="method-card-title">
          方法卡 · {{ fin.dcf.archetypeLabel || fin.dcf.archetypeId || '主锚' }}
          <span v-if="fin.dcf.methodVersion" class="method-card-ver">{{ fin.dcf.methodVersion }}</span>
        </p>
        <p v-if="methodCardSummary.inputs" class="method-card-line">输入：{{ methodCardSummary.inputs }}</p>
        <p v-if="methodCardSummary.assumptions" class="method-card-line">假设：{{ methodCardSummary.assumptions }}</p>
        <p v-if="methodCardSummary.doesNotDo" class="method-card-line">不做什么：{{ methodCardSummary.doesNotDo }}</p>
        <p v-if="fin.dcf.asOf" class="method-card-line">数据时点：{{ formatAsOf(fin.dcf.asOf) }}</p>
        <p v-if="dataSourceLabel" class="method-card-line">
          行情来源：<span class="source-badge" :class="'source-' + (fin.quoteSource || fin.dcf.quoteSource || '')">{{ dataSourceLabel }}</span>
        </p>
      </div>
      <div v-if="desk" class="desk-audit">
        <p class="desk-title">
          研究台核对
          <span v-if="desk.five?.overall" class="desk-overall">综合 {{ starBar(desk.five.overall) }}</span>
        </p>
        <p class="desk-posture">{{ desk.posture }}</p>
        <p
          class="desk-recon"
          :class="desk.recon?.pass ? 'desk-recon--ok' : 'desk-recon--bad'"
        >
          {{ desk.recon?.summary }}
        </p>
        <div v-if="desk.five?.dims?.length" class="desk-stars">
          <div v-for="d in desk.five.dims" :key="d.id" class="desk-star-row">
            <span class="desk-star-name">{{ d.name }}</span>
            <span class="desk-star-bar">{{ starBar(d.stars) }}</span>
            <span class="desk-star-ev">{{ d.evidence }}</span>
          </div>
        </div>
        <p v-if="desk.five?.holdYears" class="desk-line">
          框架持有期 {{ desk.five.holdYears }} ·
          <template v-if="desk.fork === 'great_wait'">好生意等价格</template>
          <template v-else-if="desk.fork === 'cheap_no_moat'">便宜但护城河弱（烟蒂口径）</template>
          <template v-else>质量与价格未走极端</template>
        </p>
        <p v-if="desk.aesop?.line" class="desk-line">伊索三问：{{ desk.aesop.line }}</p>
        <p class="desk-line">
          模型MoS
          <strong>{{ fmtNum(desk.mosModel) }}%</strong>
          · 相对熊档缓冲
          <strong>{{ fmtNum(desk.mosVsBear) }}%</strong>
          · 要求
          <strong>{{ desk.mosNeed }}%</strong>
          （巴菲特 {{ desk.mosTier?.band }}）
        </p>
        <p v-if="desk.oe" class="desk-line">
          所有者盈余 {{ desk.oe.blendedOe != null ? '¥' + desk.oe.blendedOe + '/股' : '—' }}
          <span v-if="desk.oe.rawFcfPerShare != null"> · 原始FCF/股 ¥{{ desk.oe.rawFcfPerShare }}</span>
          <span v-if="desk.oe.cashConversion != null"> · 现金转化 {{ desk.oe.cashConversion }}</span>
          · {{ desk.oe.ebitdaTrap }}
        </p>
        <p v-if="desk.dollar?.note" class="desk-line">留存$1测试：{{ desk.dollar.note }}</p>
        <details v-if="desk.graham" class="desk-fold">
          <summary>
            格雷厄姆六维
            {{ desk.graham.applicable ? (desk.graham.score + '分') : '不适用' }}
            <span v-if="desk.graham.trap"> · 价值陷阱嫌疑</span>
          </summary>
          <p v-if="!desk.graham.applicable" class="desk-line">{{ desk.graham.reason }}</p>
          <ul v-else class="desk-list">
            <li v-for="g in desk.graham.dims" :key="g.id">
              {{ g.label }}：{{ g.pts == null ? '跳过' : g.pts + '/' + g.max }} · {{ g.note }}
            </li>
          </ul>
          <p v-if="desk.graham.ncavLine" class="desk-line">
            清算参考 NCAV/股 ¥{{ desk.graham.ncavLine.ncavPerShare }} · 格雷厄姆买线 ¥{{ desk.graham.ncavLine.grahamBuy }}（×0.67）
          </p>
        </details>
        <details v-if="desk.hold?.items" class="desk-fold">
          <summary>持仓复盘 · 四条卖出条件（不是下单）</summary>
          <ul class="desk-list">
            <li v-for="h in desk.hold.items" :key="h.id">
              {{ h.label }} — {{ reviewLabel(h.verdict) }}。{{ h.basis }}
            </li>
          </ul>
          <p class="desk-line">不应仅因这些卖：{{ (desk.hold.doNotSellFor || []).join('、') }}</p>
        </details>
        <details v-if="desk.sources?.rows?.length" class="desk-fold">
          <summary>数据附录 · {{ desk.sources.rows.length }} 项可追溯</summary>
          <ul class="desk-list">
            <li v-for="r in desk.sources.rows" :key="r.field">
              {{ r.field }}={{ r.value }} · {{ r.source }}{{ r.period ? ' · ' + formatAsOf(r.period) : '' }}
            </li>
          </ul>
        </details>
        <p class="desk-disclaimer">{{ desk.disclaimer }}</p>
      </div>
      <div v-if="lensStack?.lenses?.length" class="lens-section">
        <p class="lens-section-title">两副眼镜怎么看</p>
        <p v-if="lensStack.disagreement" class="lens-disagree">
          两边对不上（{{ disagreementRootLabel }}），我不合成一个「综合结论」
          <span v-if="lensStack.losingStrongestPoint">。对方最硬的一句：{{ lensStack.losingStrongestPoint }}</span>
        </p>
        <div class="lens-stack">
          <details
            v-for="(L, idx) in lensStack.lenses"
            :key="L.lensId"
            class="lens-row"
            :open="idx === 0"
          >
            <summary class="lens-sum">
              <span class="lens-name">{{ L.nameZh }}</span>
              <span class="lens-verdict" :class="'lv-' + (L.verdict || '')">{{ shortLensVerdict(L) }}</span>
            </summary>
            <p class="lens-opt">{{ L.optimizesFor }}</p>
            <p class="lens-verdict-full">{{ L.verdictText }}</p>
            <p v-if="L.triggeredVeto" class="lens-veto">
              卡住了：{{ L.triggeredVeto.label }}
              <span v-if="L.triggeredVeto.evidence">（{{ L.triggeredVeto.evidence }}）</span>
            </p>
            <ul v-if="L.falsifiers?.length" class="lens-falsifiers">
              <li v-for="(f, i) in L.falsifiers.slice(0, 3)" :key="i">若出现：{{ f }}</li>
            </ul>
            <p class="lens-conf">
              把握 {{ L.confidence?.level || '未知' }}
              <span v-if="L.confidence?.limit">，卡在：{{ L.confidence.limit }}</span>
            </p>
          </details>
        </div>
        <p class="lens-disclaimer">{{ lensStack.disclaimer || '这是分析程序，不是某人的意见；也不是下单建议。' }}</p>
      </div>
      <div class="disclosure-bar" role="note">
        <span>{{ fin.dcf?.archetypeLabel || '主锚原型' }}</span>
        <span aria-hidden="true">·</span>
        <span>非投资建议</span>
        <span aria-hidden="true">·</span>
        <span>{{ freshnessLabel }}</span>
      </div>
      <div v-if="fin.dcf?.structureOnly || fin.valuability === 'structure_only'" class="dcf-warn">
        仅供结构参考：财务输入不完整，不作高精度安全边际点估计。
      </div>
      <div class="dcf-grid">
        <div>
          <div class="ml ml-muted">{{ fin.dcf?.mosConfidence === 'low' ? '参考价值(低置信)' : '模型内在价值' }}</div>
          <div
            class="dcf-num"
            :class="fin.dcf?.mosConfidence === 'low' ? 'dcf-num--low' : 'dcf-num--ok'"
          >
            <template v-if="fin.dcf?.mosConfidence === 'low'">≈</template>¥{{ fin.dcf.intrinsicValue?.toFixed?.(2) ?? fin.dcf.intrinsicValue }}
          </div>
        </div>
        <div>
          <div class="ml ml-muted">当前价格</div>
          <div class="dcf-num">¥{{ Number(price || 0).toFixed(2) }}</div>
        </div>
        <div>
          <div class="ml ml-muted">安全边际(保守)</div>
          <div class="dcf-num" :class="mosTone">
            <template v-if="fin.marginOfSafety == null || (fin.dcf?.mosConfidence === 'low' && Math.abs(fin.marginOfSafety) < 3)">—</template>
            <template v-else>{{ fin.marginOfSafety >= 0 ? '+' : '' }}{{ fin.marginOfSafety }}%</template>
          </div>
        </div>
      </div>
      <div v-if="fin.dcf?.mosConfidence === 'low'" class="dcf-warn">
        数据稀疏或主锚降级：不展示戏剧性目标价，仅作方向参考。
      </div>
      <div v-if="fin.dcf?.ivBear && fin.dcf?.mosConfidence !== 'low'" class="band-row">
        <span>熊 ¥{{ Number(fin.dcf.ivBear).toFixed(0) }}</span>
        <span>基 ¥{{ Number(fin.dcf.ivBase).toFixed(0) }}</span>
        <span>牛 ¥{{ Number(fin.dcf.ivBull).toFixed(0) }}</span>
        <span v-if="fin.dcf.pePercentile != null">PE分位 {{ fin.dcf.pePercentile }}%</span>
      </div>
      <div v-else-if="fin.dcf?.ivBear && fin.dcf?.mosConfidence === 'low'" class="band-row band-row--dim">
        <span>区间仅供参考</span>
        <span>¥{{ Number(fin.dcf.ivBear).toFixed(0) }}–{{ Number(fin.dcf.ivBull).toFixed(0) }}</span>
      </div>
      <div v-if="fin.dcf?.moat?.evidence?.length" class="dcf-moat">
        护城河：{{ fin.dcf.moat.evidence.slice(0, 3).join('；') }}（分{{ fin.dcf.moat.score }}）
      </div>
      <div v-if="fin.dcf?.invertRisks?.length" class="dcf-invert">
        逆向：{{ fin.dcf.invertRisks.slice(0, 3).join('；') }}
      </div>
      <div v-if="fin.dcf?.actionHint" class="dcf-hint">
        {{ fin.dcf.actionHint }}
      </div>
      <div v-if="fin.dcf.details?.length" class="dcf-details">
        {{ fin.dcf.details.slice(0, 4).join(' · ') }}
      </div>
      <div v-if="mosExplain" class="dcf-explain">
        {{ mosExplain }}
      </div>
      <p v-if="portfolioMeaning" class="portfolio-meaning">{{ portfolioMeaning }}</p>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { COPY } from '@/data/productStats.js'
import { describeParadigmComputeEffect } from '@/services/paradigmResolver.js'

const props = defineProps({
  fin: { type: Object, default: null },
  price: { type: Number, default: 0 },
  metrics: { type: Array, default: () => [] },
  paradigmPick: { type: String, default: '' },
  paradigmOptions: { type: Array, default: () => [] },
  activeParadigm: { type: Object, default: null },
  angleExtras: { type: Array, default: () => [] },
  mosExplain: { type: String, default: '' },
  portfolioMeaning: { type: String, default: '' },
})

const emit = defineEmits(['focus-section', 'paradigm-pick'])

const paradigmHonestLine = COPY.paradigmHonest

const industryArchetype = computed(
  () => props.fin?.dcf?.archetypeId || props.fin?.dcf?.archetype || 'capital_heavy',
)

const labeledParadigmOptions = computed(() => {
  const arch = industryArchetype.value
  return (props.paradigmOptions || []).map((p) => {
    const effect = describeParadigmComputeEffect(p, arch)
    const suffix = effect.recomputes
      ? `重算→${effect.label}`
      : '角度·不改主锚'
    return {
      ...p,
      optionLabel: `${p.name} · ${suffix}`,
    }
  })
})

const methodCardSummary = computed(() => {
  const d = props.fin?.dcf
  if (!d) return null
  const join = (arr) => (Array.isArray(arr) && arr.length ? arr.slice(0, 3).join('；') : '')
  const inputs = join(d.inputsUsed)
  const assumptions = join(d.assumptions)
  const doesNotDo = join(d.doesNotDo)
  if (!d.methodVersion && !inputs && !assumptions && !doesNotDo && !d.asOf) return null
  return { inputs, assumptions, doesNotDo }
})

const lensStack = computed(() => props.fin?.dcf?.lensStack || null)
const desk = computed(() => props.fin?.dcf?.desk || null)

function starBar(n) {
  const s = Math.max(0, Math.min(5, Math.round(Number(n) || 0)))
  return '★'.repeat(s) + '☆'.repeat(5 - s)
}

function fmtNum(v) {
  if (v == null || Number.isNaN(Number(v))) return '—'
  return Number(v).toFixed(1)
}

function reviewLabel(v) {
  const map = { yes: '是', no: '否', watch: '观察', unknown: '未知', 'n/a': '不适用' }
  return map[v] || v || '—'
}

const disagreementRootLabel = computed(() => {
  const root = lensStack.value?.disagreementRoot
  const map = {
    horizon: '持有期',
    caliber: '口径',
    risk: '风险偏好',
    information: '信息',
  }
  return map[root] || root || '未分类'
})

const dataSourceLabel = computed(() => {
  const src = props.fin?.quoteSource || props.fin?.dcf?.quoteSource || ''
  if (src === 'proxy') return 'proxy'
  if (src === 'jsonp-fallback') return 'jsonp-fallback'
  if (src === 'cache') return 'cache'
  if (src === 'sina') return 'sina 备用源'
  return ''
})

const freshnessLabel = computed(() => {
  const asOf = props.fin?.dcf?.asOf || props.fin?.quoteAsOf || props.fin?.asOf
  if (!asOf) return '新鲜度未知'
  return `输入新鲜度 ${formatAsOf(asOf)}`
})

function formatAsOf(v) {
  if (!v) return '—'
  try {
    const d = new Date(v)
    if (Number.isNaN(d.getTime())) return String(v).slice(0, 19)
    return d.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return String(v).slice(0, 19)
  }
}

const mosTone = computed(() => {
  const m = props.fin?.marginOfSafety
  if (m == null) return 'mos-neutral'
  if (m >= 20) return 'mos-good'
  if (m >= 0) return 'mos-mid'
  return 'mos-bad'
})

function metricTone(m) {
  if (!m?.color) return ''
  if (m.color === 'var(--green)' || m.color === 'var(--gain)') return 'mv-up'
  if (m.color === 'var(--red)' || m.color === 'var(--loss)') return 'mv-down'
  return ''
}

function onPick(e) {
  emit('paradigm-pick', e.target.value)
}

function shortLensVerdict(L) {
  const map = {
    favorable: '偏通过',
    cautious: '谨慎',
    unfavorable: '偏不过',
    vetoed: '硬否决',
    inconclusive: '证据不够',
  }
  return map[L?.verdict] || L?.verdict || '待定'
}
</script>

<style scoped>
.metric-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  gap: 1px;
  background: var(--sep);
}
@media (max-width: 400px) {
  .metric-grid {
    grid-template-columns: 1fr;
  }
}
.metric {
  background: transparent;
  padding: 12px 14px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  contain: layout style paint;
}
.ml { font-size: 12px; color: var(--ts); }
.ml-muted { color: rgba(255, 255, 255, 0.5); }
.mv { font-size: 13px; font-weight: 600; color: var(--tp); }
.mv-up { color: var(--gain); }
.mv-down { color: var(--loss); }
.dcf-box {
  margin: 16px 20px 20px;
  padding: 16px;
  background: linear-gradient(135deg, #1d1d1f, #2c2c2e);
  border-radius: 12px;
  color: #fff;
}
.dcf-title {
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 12px;
}
.dcf-title-muted { opacity: 0.7; font-weight: 500; }
.dcf-title-anchor { opacity: 0.55; font-weight: 500; font-size: 11px; }
.paradigm-chip {
  margin: 0 0 14px;
  padding: 10px 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.04);
}
.paradigm-chip-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 12px;
  font-weight: 600;
  opacity: 0.7;
  margin-bottom: 6px;
}
.paradigm-select {
  max-width: min(280px, 68vw);
  background: rgba(0, 0, 0, 0.35);
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 6px;
  padding: 4px 8px;
  font-size: 12px;
}
.paradigm-chip-honest {
  margin: 0 0 6px;
  font-size: 10px;
  line-height: 1.4;
  color: rgba(255, 255, 255, 0.45);
}
.paradigm-chip-desc {
  margin: 0;
  font-size: 12px;
  line-height: 1.45;
  color: rgba(255, 255, 255, 0.82);
}
.paradigm-chip-when {
  margin: 4px 0 0;
  font-size: 11px;
  line-height: 1.4;
  color: rgba(255, 255, 255, 0.5);
}
.paradigm-angles {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.paradigm-angle-line {
  margin: 0;
  font-size: 11px;
  line-height: 1.45;
  color: rgba(180, 220, 255, 0.78);
}
.paradigm-angle-line.secondary { color: rgba(200, 210, 230, 0.7); }
.paradigm-angle-line.blend { color: rgba(110, 224, 200, 0.75); }
.paradigm-angle-line.extra { color: rgba(255, 255, 255, 0.48); }
.method-card {
  margin: 0 0 14px;
  padding: 10px 12px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  background: rgba(0, 0, 0, 0.22);
}
.method-card-title {
  margin: 0 0 6px;
  font-size: 12px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.85);
}
.method-card-ver {
  margin-left: 6px;
  font-family: var(--mono, ui-monospace, monospace);
  font-size: 10px;
  font-weight: 500;
  opacity: 0.55;
}
.method-card-line {
  margin: 0 0 4px;
  font-size: 11px;
  line-height: 1.45;
  color: rgba(255, 255, 255, 0.58);
}
.desk-audit {
  margin: 0 0 14px;
  padding: 10px 12px;
  border: 1px solid rgba(110, 224, 200, 0.18);
  border-radius: 10px;
  background: rgba(0, 20, 16, 0.28);
}
.desk-title {
  margin: 0 0 6px;
  font-size: 13px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.92);
  display: flex;
  justify-content: space-between;
  gap: 8px;
  align-items: baseline;
}
.desk-overall {
  font-family: var(--mono, ui-monospace, monospace);
  font-size: 12px;
  color: #6ee0c8;
  font-weight: 500;
}
.desk-posture {
  margin: 0 0 8px;
  font-size: 12px;
  line-height: 1.5;
  color: rgba(230, 220, 180, 0.92);
}
.desk-recon {
  margin: 0 0 10px;
  font-size: 11px;
  line-height: 1.45;
}
.desk-recon--ok { color: #6ee0c8; }
.desk-recon--bad { color: #ff8a96; }
.desk-stars {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 0 0 10px;
}
.desk-star-row {
  display: grid;
  grid-template-columns: 7.5em 5.5em 1fr;
  gap: 8px;
  align-items: start;
  font-size: 11px;
}
.desk-star-name { color: rgba(255, 255, 255, 0.7); }
.desk-star-bar {
  font-family: var(--mono, ui-monospace, monospace);
  color: #e6c35c;
  letter-spacing: 0.04em;
}
.desk-star-ev {
  color: rgba(255, 255, 255, 0.48);
  line-height: 1.4;
}
.desk-line {
  margin: 0 0 6px;
  font-size: 11px;
  line-height: 1.5;
  color: rgba(255, 255, 255, 0.62);
}
.desk-fold {
  margin: 6px 0 0;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.78);
}
.desk-fold summary {
  cursor: pointer;
  list-style: none;
}
.desk-fold summary::-webkit-details-marker { display: none; }
.desk-list {
  margin: 6px 0 0;
  padding: 0 0 4px 18px;
  font-size: 11px;
  line-height: 1.5;
  color: rgba(255, 255, 255, 0.55);
}
.desk-disclaimer {
  margin: 10px 0 0;
  font-size: 10px;
  line-height: 1.45;
  color: rgba(255, 255, 255, 0.4);
}
@media (max-width: 640px) {
  .desk-star-row {
    grid-template-columns: 1fr;
    gap: 2px;
  }
}
.method-card-disclaimer {
  margin: 6px 0 0;
  font-size: 10px;
  color: rgba(255, 255, 255, 0.4);
}
.lens-section {
  margin: 0 0 14px;
  padding: 0;
  border: none;
  background: transparent;
}
.lens-section-title {
  margin: 0 0 8px;
  font-size: 13px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
}
.lens-disagree {
  margin: 0 0 10px;
  font-size: 12px;
  line-height: 1.5;
  color: #e6c35c;
}
.lens-stack {
  display: flex;
  flex-direction: column;
  gap: 1px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.1);
}
.lens-row {
  background: rgba(0, 0, 0, 0.28);
  padding: 0;
}
.lens-sum {
  list-style: none;
  cursor: pointer;
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  user-select: none;
}
.lens-sum::-webkit-details-marker { display: none; }
.lens-name {
  margin: 0;
  font-size: 12px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.92);
}
.lens-opt {
  margin: 0;
  padding: 0 12px 6px;
  font-size: 11px;
  line-height: 1.45;
  color: rgba(255, 255, 255, 0.48);
}
.lens-verdict {
  margin: 0;
  font-family: var(--mono, ui-monospace, monospace);
  font-size: 11px;
  font-weight: 650;
  letter-spacing: 0.02em;
  color: rgba(200, 220, 255, 0.85);
  white-space: nowrap;
}
.lens-verdict-full {
  margin: 0;
  padding: 0 12px 8px;
  font-size: 12px;
  line-height: 1.5;
  color: rgba(220, 230, 240, 0.82);
}
.lv-favorable { color: #6ee0c8; }
.lv-cautious { color: #e6c35c; }
.lv-unfavorable,
.lv-vetoed { color: #ff8a96; }
.lv-inconclusive { color: rgba(255, 255, 255, 0.55); }
.lens-veto {
  margin: 0;
  padding: 0 12px 8px;
  font-size: 12px;
  line-height: 1.45;
  color: #ff8a96;
}
.lens-falsifiers {
  margin: 0;
  padding: 0 12px 8px 28px;
  font-size: 11px;
  line-height: 1.45;
  color: rgba(255, 255, 255, 0.52);
}
.lens-conf {
  margin: 0;
  padding: 0 12px 12px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.42);
}
.lens-disclaimer {
  margin: 10px 0 0;
  font-size: 11px;
  line-height: 1.45;
  color: rgba(255, 255, 255, 0.4);
}
.disclosure-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 8px;
  align-items: center;
  margin: 0 0 12px;
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.05);
  font-size: 11px;
  line-height: 1.4;
  color: rgba(255, 255, 255, 0.72);
}
.source-badge {
  display: inline-block;
  padding: 1px 6px;
  border-radius: 4px;
  font-family: var(--mono, ui-monospace, monospace);
  font-size: 10px;
  background: rgba(255, 255, 255, 0.08);
}
.source-jsonp-fallback {
  color: #e6c35c;
  background: rgba(230, 195, 92, 0.15);
}
.source-proxy {
  color: #6ee0c8;
}
.source-cache {
  color: rgba(255, 255, 255, 0.55);
}
.source-sina {
  color: #e6c35c;
  background: rgba(230, 195, 92, 0.15);
}
.band-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 12px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.55);
  font-family: var(--mono);
}
.band-row--dim { opacity: 0.55; }
.dcf-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}
.dcf-num {
  font-size: 22px;
  font-weight: 700;
  margin-top: 4px;
}
.dcf-num--ok {
  color: #6ee0c8;
  font-family: var(--mono);
}
.dcf-num--low {
  color: #e6c35c;
  opacity: 0.75;
  font-family: var(--mono);
}
.mos-neutral { color: #fff; }
.mos-good { color: #6ee0c8; }
.mos-mid { color: #e6c35c; }
.mos-bad { color: #ff8a96; }
.dcf-warn {
  margin-top: 8px;
  font-size: 11px;
  color: #e6c35c;
  line-height: 1.45;
}
.dcf-moat {
  margin-top: 8px;
  font-size: 11px;
  color: rgba(180, 220, 255, 0.7);
  line-height: 1.5;
}
.dcf-invert {
  margin-top: 8px;
  font-size: 11px;
  color: rgba(255, 180, 180, 0.75);
  line-height: 1.5;
}
.dcf-hint {
  margin-top: 10px;
  font-size: 12px;
  color: #e6c35c;
}
.dcf-details {
  margin-top: 12px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.45);
}
.dcf-explain {
  margin-top: 8px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.55);
  line-height: 1.5;
}
.portfolio-meaning {
  margin: 12px 0 0;
  padding-top: 10px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  font-size: 12px;
  line-height: 1.5;
  color: var(--tp, #ece6d8);
}
@media (max-width: 640px) {
  .dcf-grid { grid-template-columns: 1fr; }
}
@media (max-width: 400px) {
  .metric {
    padding: 10px 12px;
  }
  .dcf-box {
    margin: 12px;
    padding: 12px;
  }
  .dcf-num {
    font-size: 18px;
  }
}
</style>
