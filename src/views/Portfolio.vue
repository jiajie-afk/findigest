<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h1 class="pt">持仓管理</h1>
        <p class="pt-sub">多组合追踪 · 盈亏与建议仓位一目了然</p>
      </div>
      <div class="page-actions">
        <button class="btn bs sm" @click="showImport = true">
          <PhUploadSimple :size="15" :weight="'bold'" />
          导入持仓
        </button>
        <button class="btn bp sm" :disabled="portfolio.autoFetching" @click="runFetch">
          <PhBroadcast :size="15" :weight="'bold'" />
          {{ portfolio.autoFetching ? '采集中…' : '一键采集' }}
        </button>
        <button class="btn bs sm" @click="showAdd = !showAdd">
          <PhPlus :size="15" :weight="'bold'" />
          {{ showAdd ? '取消' : '添加持仓' }}
        </button>
      </div>
    </div>

    <p class="import-hint">导入持仓 = 从券商 CSV / 粘贴 / 截图 / 扩展同步账户；一键采集 = 刷新已有持仓行情。</p>

    <div v-if="bridgeBanner" class="bridge-banner" role="status">
      <div>
        <p class="bridge-lab">来自今日 · 仓位含义</p>
        <p class="bridge-band">{{ bridgeBanner.targetWeightBand }}</p>
        <p class="bridge-reason">{{ bridgeBanner.reason }}</p>
        <p v-if="bridgeBanner.blockedByConstraint" class="bridge-block">
          建议被约束阻断：{{ bridgeBanner.blockedByConstraint }}
        </p>
      </div>
      <button type="button" class="btn bs sm" @click="dismissBridge">忽略</button>
    </div>

    <ImportHoldingsWizard v-model="showImport" />

    <div class="overview-grid">
      <div class="metric-tile af">
        <div class="ml">总成本</div>
        <div class="mv">¥{{ (portfolio.totals.cost / 10000).toFixed(1) }}万</div>
      </div>
      <div class="metric-tile af d1">
        <div class="ml">总市值</div>
        <div class="mv">¥{{ (portfolio.totals.mv / 10000).toFixed(1) }}万</div>
      </div>
      <div class="metric-tile af d2">
        <div class="ml">总盈亏</div>
        <div class="mv" :style="{ color: plColor }">
          {{ portfolio.totals.pl >= 0 ? '+' : '' }}{{ (portfolio.totals.pl / 10000).toFixed(1) }}万
        </div>
      </div>
      <div class="metric-tile af d3">
        <div class="ml">收益率</div>
        <div class="mv" :style="{ color: plColor }">{{ fmtPct(portfolio.totals.plPct) }}</div>
      </div>
    </div>

    <div v-if="showAdd" class="card af" style="padding: 20px 22px">
      <div class="add-grid">
        <div class="fld" style="margin: 0">
          <label>组合</label>
          <select v-model="form.portfolioId">
            <option v-for="p in portfolio.portfolios" :key="p.id" :value="p.id">{{ p.name }}</option>
          </select>
        </div>
        <div class="fld" style="margin: 0; position: relative">
          <label>代码</label>
          <input v-model="form.code" placeholder="600519 / 茅台" @input="onCodeInput" autocomplete="off" />
          <ul v-if="suggestions.length" class="code-suggest" role="listbox">
            <li
              v-for="s in suggestions"
              :key="s.code"
              role="option"
              @mousedown.prevent="pickSuggestion(s)"
            >
              <strong>{{ s.code }}</strong>
              <span>{{ s.name }}</span>
              <em>{{ s.market }}</em>
              <i class="valuab-badge" :class="s.valuability === 'valuable' ? 'valuab-ok' : 'valuab-search'">
                {{ s.valuabilityLabel || (s.valuability === 'valuable' ? '可估值' : '仅检索') }}
              </i>
            </li>
          </ul>
        </div>
        <div class="fld" style="margin: 0">
          <label>名称</label>
          <input v-model="form.name" placeholder="贵州茅台" />
        </div>
        <div class="fld" style="margin: 0">
          <label>市场</label>
          <select v-model="form.ex">
            <option value="SH">SH</option>
            <option value="SZ">SZ</option>
            <option value="HK">HK</option>
          </select>
        </div>
        <div class="fld" style="margin: 0">
          <label>股数</label>
          <input v-model.number="form.shares" type="number" />
        </div>
        <div class="fld" style="margin: 0">
          <label>成本</label>
          <input v-model.number="form.cost" type="number" step="0.01" />
        </div>
      </div>
      <button class="btn bp sm" style="margin-top: 14px" @click="add">确认添加</button>
    </div>

    <div v-for="p in portfolio.portfolios" :key="p.id" class="card af">
      <div class="ch">
        <div>
          <h3>{{ p.name }}</h3>
          <div class="ch-meta" style="margin-top: 2px">{{ p.holdings.length }} 只股票</div>
        </div>
      </div>
      <div style="overflow-x: auto">
        <table class="tbl">
          <thead>
            <tr>
              <th>股票</th>
              <th class="r">现价</th>
              <th class="r">盈亏</th>
              <th style="text-align: center">评分</th>
              <th class="r">建议仓位</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="h in p.holdings"
              :key="h.id"
              :class="{ 'row-hl': highlightSymbol && String(h.code) === highlightSymbol }"
              :data-symbol="h.code"
              @click="$router.push(`/stock/${h.code}`)"
            >
              <td>
                <div class="sn">{{ h.name }}</div>
                <div class="sc">{{ h.code }} · {{ h.shares }}股 · 成本¥{{ h.cost }}</div>
              </td>
              <td class="r mono">{{ fmtPrice(portfolio.getPrice(h.code, h.cost)) }}</td>
              <td class="r" :style="{ color: plOf(h) >= 0 ? 'var(--gain)' : 'var(--loss)' }">
                <div style="font-weight: 700">{{ plOf(h) >= 0 ? '+' : '' }}{{ plOf(h).toFixed(0) }}</div>
                <div style="font-size: 11px">{{ fmtPct(plPctOf(h)) }}</div>
              </td>
              <td style="text-align: center">
                <template v-if="portfolio.stockAnalyses[h.code]?.sent">
                  <div
                    class="mono"
                    style="font-size: 16px; font-weight: 700"
                    :style="{ color: scoreColor(portfolio.stockAnalyses[h.code].sent.total) }"
                  >
                    {{ fmtScore(portfolio.stockAnalyses[h.code].sent.total) }}
                  </div>
                </template>
                <span v-else style="color: var(--tt)">—</span>
              </td>
              <td class="r mono">
                {{ portfolio.positionFor(h.code)?.pct != null ? portfolio.positionFor(h.code).pct + '%' : '—' }}
              </td>
              <td @click.stop>
                <button class="btn bs sm" @click="remove(p.id, h.id)">删除</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { PhPlus, PhBroadcast, PhUploadSimple } from '@/components/icons'
import { usePortfolioStore } from '@/store/portfolio'
import { useUserStore } from '@/store/user'
import { fmtPct, fmtPrice, scoreColor } from '@/utils/format'
import { searchUniverse } from '@/utils/universeSearch.js'
import { readPositionSuggestion, clearPositionSuggestion } from '@/services/decisionBridge.js'
import ImportHoldingsWizard from '@/components/portfolio/ImportHoldingsWizard.vue'

const portfolio = usePortfolioStore()
const user = useUserStore()
const route = useRoute()
const showAdd = ref(false)
const showImport = ref(false)
const suggestions = ref([])
const bridgeBanner = ref(null)
const form = reactive({
  portfolioId: null,
  code: '',
  name: '',
  ex: 'SH',
  shares: 100,
  cost: 0,
})

const highlightSymbol = computed(() => {
  const q = route.query.symbol
  return q ? String(q) : bridgeBanner.value?.code ? String(bridgeBanner.value.code) : ''
})

function syncBridgeFromRoute() {
  const fromStore = readPositionSuggestion()
  const sym = route.query.symbol ? String(route.query.symbol) : ''
  if (fromStore && (!sym || String(fromStore.code) === sym)) {
    bridgeBanner.value = fromStore
  } else if (sym && fromStore && String(fromStore.code) !== sym) {
    bridgeBanner.value = {
      action: 'watch',
      targetWeightBand: '查看该标的暴露',
      reason: `从今日跳转到 ${sym}`,
      code: sym,
      label: '仓位含义',
    }
  } else if (sym) {
    bridgeBanner.value = {
      action: 'watch',
      targetWeightBand: '查看该标的暴露',
      reason: `高亮持仓 ${sym}（无今日建议快照时可忽略）`,
      code: sym,
      label: '仓位含义',
    }
  }
}

function dismissBridge() {
  bridgeBanner.value = null
  clearPositionSuggestion()
}

function scrollToHighlight() {
  if (!highlightSymbol.value) return
  nextTick(() => {
    const el = document.querySelector(`tr[data-symbol="${CSS.escape(highlightSymbol.value)}"]`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  })
}

watch(
  () => portfolio.portfolios,
  (list) => {
    if (!form.portfolioId && list[0]) form.portfolioId = list[0].id
  },
  { immediate: true },
)

onMounted(() => {
  if (route.query.import) showImport.value = true
  syncBridgeFromRoute()
  scrollToHighlight()
})

watch(
  () => route.query.import,
  (v) => {
    if (v) showImport.value = true
  },
)

watch(
  () => route.query.symbol,
  () => {
    syncBridgeFromRoute()
    scrollToHighlight()
  },
)

// Holdings may load after mount — re-scroll when rows exist for highlightSymbol
watch(
  () => [highlightSymbol.value, portfolio.portfolios, portfolio.allHoldings?.length],
  () => {
    if (!highlightSymbol.value) return
    const hasRow = (portfolio.portfolios || []).some((p) =>
      (p.holdings || []).some((h) => String(h.code) === highlightSymbol.value),
    )
    if (hasRow) scrollToHighlight()
  },
  { deep: true },
)

const plColor = computed(() => (portfolio.totals.pl >= 0 ? 'var(--gain)' : 'var(--loss)'))

function plOf(h) {
  const price = portfolio.getPrice(h.code, h.cost)
  return h.shares * (price - h.cost)
}
function plPctOf(h) {
  const price = portfolio.getPrice(h.code, h.cost)
  return h.cost ? ((price - h.cost) / h.cost) * 100 : 0
}
function fmtScore(n) {
  return `${n >= 0 ? '+' : ''}${n}`
}
function onCodeInput() {
  const q = form.code
  const name = portfolio.db[q]
  if (name) {
    form.name = name
    suggestions.value = []
  } else {
    suggestions.value = searchUniverse(portfolio.db, q, { limit: 8 })
  }
  if (form.code.startsWith('6') || form.code.startsWith('9')) form.ex = 'SH'
  else if (form.code.length <= 5 && /^\d+$/.test(form.code)) form.ex = 'HK'
  else if (form.code.length >= 6) form.ex = 'SZ'
}
function pickSuggestion(s) {
  form.code = s.code
  form.name = s.name
  form.ex = s.market
  suggestions.value = []
}
function add() {
  if (!form.portfolioId) form.portfolioId = portfolio.portfolios[0]?.id
  if (!form.code || !form.name) {
    user.toast('请填写代码和名称')
    return
  }
  portfolio.addHolding(form.portfolioId, {
    code: form.code,
    name: form.name,
    ex: form.ex,
    shares: form.shares || 0,
    cost: form.cost || 0,
  })
  user.track(user.EVENT_TYPES.TRADE_BUY, {
    stockCode: form.code,
    stockName: form.name,
    tradePrice: form.cost || 0,
    tradeAmount: (form.shares || 0) * (form.cost || 0),
  })
  showAdd.value = false
  user.toast('已添加持仓')
}
function remove(pid, hid) {
  const p = portfolio.portfolios.find((x) => x.id === pid)
  const h = p?.holdings?.find((x) => x.id === hid)
  portfolio.removeHolding(pid, hid)
  if (h) {
    user.track(user.EVENT_TYPES.TRADE_SELL, {
      stockCode: h.code,
      stockName: h.name,
      tradePrice: portfolio.getPrice(h.code, h.cost),
      tradeAmount: h.shares * (portfolio.getPrice(h.code, h.cost) - h.cost),
    })
  }
  user.toast('已删除')
}
async function runFetch() {
  await portfolio.autoFetchAll()
  user.toast('采集完成')
}
</script>

<style scoped>
.page-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: 24px;
}
.page-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.import-hint {
  margin: -8px 0 18px;
  font-size: 12px;
  color: var(--ts);
  line-height: 1.45;
}
.bridge-banner {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin: 0 0 16px;
  padding: 12px 14px;
  border: 1px solid color-mix(in srgb, var(--accent) 35%, var(--sep));
  border-radius: var(--rb, 8px);
  background: var(--accent-soft);
}
.bridge-lab {
  margin: 0 0 4px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--accent);
}
.bridge-band {
  margin: 0 0 4px;
  font-size: 14px;
  font-weight: 700;
  color: var(--tp);
}
.bridge-reason,
.bridge-block {
  margin: 0;
  font-size: 12px;
  line-height: 1.45;
  color: var(--ts);
}
.bridge-block {
  margin-top: 6px;
  color: var(--loss);
}
.row-hl {
  outline: 1px solid color-mix(in srgb, var(--accent) 55%, transparent);
  background: var(--accent-soft);
}
.code-suggest {
  position: absolute;
  z-index: 20;
  left: 0;
  right: 0;
  top: calc(100% + 4px);
  margin: 0;
  padding: 6px 0;
  list-style: none;
  background: var(--card, #141618);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  max-height: 240px;
  overflow: auto;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.35);
}
.code-suggest li {
  display: grid;
  grid-template-columns: 72px 1fr auto auto;
  gap: 8px;
  align-items: center;
  padding: 8px 12px;
  cursor: pointer;
  font-size: 12px;
  min-height: 44px;
}
.code-suggest li:hover {
  background: rgba(255, 255, 255, 0.06);
}
.code-suggest strong {
  font-family: var(--mono);
  font-weight: 600;
}
.code-suggest em {
  font-style: normal;
  opacity: 0.45;
  font-size: 11px;
}
.valuab-badge {
  font-style: normal;
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
  white-space: nowrap;
}
.valuab-ok {
  color: var(--accent, #6ee0c8);
  background: color-mix(in srgb, var(--accent, #6ee0c8) 14%, transparent);
}
.valuab-search {
  color: var(--tt);
  background: rgba(128, 128, 128, 0.12);
}
.overview-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0 24px;
  margin-bottom: 18px;
  border-bottom: 1px solid var(--sep);
}
.metric-tile {
  background: transparent;
  border: none;
  border-top: 1px solid var(--sep);
  border-radius: 0;
  box-shadow: none;
  padding: 16px 4px 14px;
}
.ml {
  font-size: 12px;
  font-weight: 600;
  color: var(--ts);
  margin-bottom: 8px;
}
.mv {
  font-family: var(--mono);
  font-size: 24px;
  font-weight: 700;
  letter-spacing: -0.04em;
}
.add-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
  gap: 12px;
}
.r { text-align: right; }
.sn { font-weight: 600; letter-spacing: -0.02em; }
.sc { font-size: 12px; color: var(--tt); margin-top: 2px; }
.tbl tbody tr {
  min-height: 44px;
}
.tbl tbody td {
  padding-top: 12px;
  padding-bottom: 12px;
  vertical-align: middle;
}
.code-suggest li {
  min-height: 44px;
  box-sizing: border-box;
}
@media (min-width: 720px) {
  .overview-grid { grid-template-columns: repeat(4, 1fr); }
}
@media (max-width: 900px) {
  .page-head {
    flex-direction: column;
    align-items: stretch;
  }
  .page-actions {
    width: 100%;
  }
  .page-actions .btn {
    flex: 1 1 auto;
    min-height: 44px;
  }
}
@media (max-width: 520px) {
  .add-grid {
    grid-template-columns: 1fr;
  }
}
@media (max-width: 400px) {
  .overview-grid {
    grid-template-columns: 1fr;
  }
  .mv {
    font-size: 20px;
  }
}
</style>
