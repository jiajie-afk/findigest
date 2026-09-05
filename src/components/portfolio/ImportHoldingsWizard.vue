<template>
  <div v-if="open" class="imp-root" role="dialog" aria-modal="true" aria-labelledby="imp-title">
    <button type="button" class="imp-scrim" aria-label="关闭" @click="close" />
    <div
      class="imp-panel"
      :data-drop="dropping ? '1' : '0'"
      @dragenter.prevent="dropping = true"
      @dragover.prevent="dropping = true"
      @dragleave="onDragLeave"
      @drop.prevent="onDrop"
    >
      <header class="imp-head">
        <div>
          <p class="imp-kicker">持仓导入</p>
          <h2 id="imp-title">把持仓表放进来</h2>
          <p class="imp-sub">
            {{
              tab === 'manual'
                ? '一只一只填：代码、名称、股数、成本。跟以前手动添加一样。'
                : '粘贴、上传或拍一张持仓截图。三种都能用，选最顺手的即可。'
            }}
          </p>
        </div>
        <button type="button" class="imp-ghost" @click="close">关闭</button>
      </header>

      <div class="imp-step">
        <label class="imp-label" for="imp-portfolio">写入组合</label>
        <div class="imp-dest" :data-single="portfolio.portfolios.length <= 1 ? '1' : '0'">
          <span class="imp-dest-mark" aria-hidden="true" />
          <div class="imp-dest-body">
            <span v-if="portfolio.portfolios.length <= 1" class="imp-dest-meta">目标</span>
            <select
              id="imp-portfolio"
              v-model="portfolioId"
              class="imp-select"
              :aria-label="'导入到 ' + targetName"
            >
              <option v-for="p in portfolio.portfolios" :key="p.id" :value="p.id">{{ p.name }}</option>
            </select>
          </div>
          <span class="imp-dest-chev" aria-hidden="true" />
        </div>
      </div>

      <div class="imp-tabs" role="tablist" aria-label="导入方式">
        <button type="button" role="tab" :aria-selected="tab === 'manual'" :class="{ on: tab === 'manual' }" @click="tab = 'manual'">
          手动录入
        </button>
        <button type="button" role="tab" :aria-selected="tab === 'paste'" :class="{ on: tab === 'paste' }" @click="tab = 'paste'">
          粘贴表格
        </button>
        <button type="button" role="tab" :aria-selected="tab === 'file'" :class="{ on: tab === 'file' }" @click="tab = 'file'">
          上传文件
        </button>
        <button type="button" role="tab" :aria-selected="tab === 'shot'" :class="{ on: tab === 'shot' }" @click="tab = 'shot'">
          截图 / 拍照
        </button>
      </div>

      <div v-if="tab === 'manual'" class="imp-body">
        <div class="imp-manual">
          <label class="imp-field" style="position: relative">
            <span>代码</span>
            <input
              v-model="manual.code"
              type="text"
              placeholder="600519 / 茅台"
              autocomplete="off"
              @input="onManualCode"
            />
            <ul v-if="manualSuggest.length" class="imp-suggest" role="listbox">
              <li
                v-for="s in manualSuggest"
                :key="s.code"
                role="option"
                @mousedown.prevent="pickManual(s)"
              >
                <strong>{{ s.code }}</strong>
                <span>{{ s.name }}</span>
                <em>{{ s.market }}</em>
              </li>
            </ul>
          </label>
          <label class="imp-field">
            <span>名称</span>
            <input v-model="manual.name" type="text" placeholder="贵州茅台" />
          </label>
          <label class="imp-field">
            <span>市场</span>
            <select v-model="manual.ex">
              <option value="SH">SH</option>
              <option value="SZ">SZ</option>
              <option value="HK">HK</option>
            </select>
          </label>
          <label class="imp-field">
            <span>股数</span>
            <input v-model.number="manual.shares" type="number" min="0" />
          </label>
          <label class="imp-field">
            <span>成本</span>
            <input v-model.number="manual.cost" type="number" min="0" step="0.01" />
          </label>
        </div>
        <div class="imp-manual-actions">
          <button class="btn bp sm" type="button" :disabled="busy" @click="addManualRow">
            确认添加
          </button>
          <button class="imp-ghost" type="button" @click="resetManual">清空</button>
        </div>
        <p class="imp-hint">加完一只还可以继续填。要一次导入整张表，换到旁边三个标签。</p>
      </div>

      <div v-else-if="tab === 'paste'" class="imp-body">
        <textarea
          v-model="pasteText"
          class="imp-ta"
          rows="8"
          placeholder="从券商持仓页复制表格，粘贴到这里。截图也可以直接 Ctrl+V。"
          @paste="onTextareaPaste"
        />
        <button class="btn bp sm" :disabled="busy || !pasteText.trim()" @click="runParseText()">
          {{ busy ? '解析中…' : '解析' }}
        </button>
      </div>

      <div v-else-if="tab === 'file'" class="imp-body">
        <label class="imp-drop">
          <input class="imp-file-hidden" type="file" accept=".csv,.txt,text/csv,text/plain,image/*" @change="onFile" />
          <strong>点这里选文件</strong>
          <span>CSV / TXT，或直接丢一张持仓截图。Excel 请另存为 CSV。</span>
        </label>
      </div>

      <div v-else-if="tab === 'shot'" class="imp-body">
        <div class="imp-shot-actions">
          <label class="btn bp sm imp-file-label">
            拍照
            <input class="imp-file-hidden" type="file" accept="image/*" capture="environment" @change="onImage" />
          </label>
          <label class="btn bs sm imp-file-label">
            相册 / 截图
            <input class="imp-file-hidden" type="file" accept="image/*" @change="onImage" />
          </label>
        </div>
        <p class="imp-hint">拍交易端持仓页，或 Ctrl+V 粘贴截图。认出股票名和代码后会直接写入持仓，可再校对。</p>
        <img v-if="shotPreview" class="imp-preview" :src="shotPreview" alt="待识别截图" />
        <p v-if="ocrStatus" class="imp-ocr">{{ ocrStatus }}</p>
      </div>

      <details v-if="tab !== 'manual'" class="imp-help">
        <summary>券商里怎么复制？</summary>
        <div class="imp-seg" role="group" aria-label="表格格式">
          <button
            v-for="t in formatChips"
            :key="t.id"
            type="button"
            class="imp-seg-btn"
            :class="{ on: templateId === t.id }"
            @click="templateId = t.id"
          >
            {{ t.label }}
          </button>
        </div>
        <ol class="imp-ol">
          <li v-for="(step, i) in activeGuide" :key="i">{{ step }}</li>
        </ol>
        <p v-if="connectPath" class="imp-hint">
          <router-link :to="connectPath">打开官方登录说明</router-link>
          （登录仍在券商完成，这里只负责把表读进来。）
        </p>
        <div v-if="localSync" class="imp-login-actions">
          <button type="button" class="imp-ghost" :disabled="busy" @click="syncDesktop(false)">本机同步剪贴板</button>
        </div>
      </details>

      <div v-if="parseAttempted && tab !== 'manual'" class="imp-report" role="status">
        <p>
          认出 <strong>{{ rows.length }}</strong> 条
          <template v-if="dropped.length">，丢掉 <strong>{{ dropped.length }}</strong> 条</template>
        </p>
        <ul v-if="dropped.length">
          <li v-for="(d, i) in dropped.slice(0, 12)" :key="i">
            <code>{{ d.preview }}</code>
            <span>{{ d.reason }}</span>
          </li>
        </ul>
        <p v-if="dropped.length > 12" class="imp-hint">其余 {{ dropped.length - 12 }} 条同理，未全部列出。</p>
      </div>

      <div v-if="warnings.length" class="imp-warn">
        <div v-for="(w, i) in warnings" :key="i">{{ w }}</div>
      </div>

      <div v-if="rows.length && tab !== 'manual'" class="imp-review">
        <div class="imp-review-head">
          <strong>校对（{{ selectedCount }} / {{ rows.length }}）</strong>
          <button type="button" class="imp-ghost" @click="toggleAll(true)">全选</button>
          <button type="button" class="imp-ghost" @click="toggleAll(false)">全不选</button>
        </div>
        <div class="imp-table-wrap">
          <table class="imp-table">
            <thead>
              <tr>
                <th></th>
                <th>代码</th>
                <th>市场</th>
                <th>名称</th>
                <th class="r">股数</th>
                <th class="r">成本</th>
                <th>置信</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(r, i) in rows" :key="r.code + '-' + i" :class="{ low: r.confidence === 'low' }">
                <td>
                  <input v-model="r.selected" type="checkbox" />
                </td>
                <td><input v-model="r.code" class="imp-cell" /></td>
                <td>
                  <select v-model="r.ex" class="imp-cell">
                    <option value="SH">SH</option>
                    <option value="SZ">SZ</option>
                    <option value="HK">HK</option>
                  </select>
                </td>
                <td><input v-model="r.name" class="imp-cell wide" /></td>
                <td class="r"><input v-model.number="r.shares" type="number" class="imp-cell num" /></td>
                <td class="r"><input v-model.number="r.cost" type="number" step="0.01" class="imp-cell num" /></td>
                <td>
                  <span class="imp-conf" :data-c="r.confidence">{{ confLabel(r.confidence) }}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <button class="btn bp" :disabled="!selectedCount || busy" @click="commit">
          确认导入到「{{ targetName }}」
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { usePortfolioStore } from '@/store/portfolio'
import { useUserStore } from '@/store/user'
import {
  IMPORT_TEMPLATES,
  parseHoldingsText,
  normalizeExtensionRows,
  rowsToCommit,
  htmlTableToText,
} from '@/services/holdingsImport.js'
import { STOCK_NAMES } from '@/data/stock_names.js'
import { recognizeHoldingsImage } from '@/services/ocrHoldings.js'
import { apiUrl } from '@/services/apiClient.js'
import { brokerById } from '@/data/brokerLogin.js'
import { isTrueLocalhost } from '@/services/localOwner.js'
import { searchUniverse } from '@/utils/universeSearch.js'
import { inferHoldingEx } from '@/services/quotesRefresh.js'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  startTab: { type: String, default: '' },
})
const emit = defineEmits(['update:modelValue'])

const portfolio = usePortfolioStore()
const user = useUserStore()
const route = useRoute()
const router = useRouter()

const open = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
})

const formatChips = IMPORT_TEMPLATES.filter((t) => ['eastmoney', 'ths', 'tiger', 'generic'].includes(t.id))
const templateId = ref('eastmoney')
const portfolioId = ref(null)
const tab = ref('paste')
const pasteText = ref('')
const rows = ref([])
const warnings = ref([])
const dropped = ref([])
const parseAttempted = ref(false)
const busy = ref(false)
const ocrStatus = ref('')
const shotPreview = ref('')
const dropping = ref(false)
const localSync = isTrueLocalhost()
const manualSuggest = ref([])
const manual = ref({
  code: '',
  name: '',
  ex: 'SH',
  shares: 100,
  cost: 0,
})
let pasteTimer = 0

const activeGuide = computed(() => {
  const t = IMPORT_TEMPLATES.find((x) => x.id === templateId.value)
  return t?.guide || brokerById(templateId.value).desktop
})
const connectPath = computed(() =>
  ['eastmoney', 'ths'].includes(templateId.value) ? `/connect/${templateId.value}` : '',
)
const selectedCount = computed(() => rows.value.filter((r) => r.selected).length)
const targetName = computed(() => portfolio.portfolios.find((p) => p.id === portfolioId.value)?.name || '组合')

watch(
  () => portfolio.portfolios,
  (list) => {
    if (!portfolioId.value && list[0]) portfolioId.value = list[0].id
  },
  { immediate: true },
)

watch(open, (v) => {
  if (!v) return
  if (props.startTab === 'manual' || route.query.import === 'manual') tab.value = 'manual'
  else if (props.startTab === 'paste' || props.startTab === 'file' || props.startTab === 'shot') {
    tab.value = props.startTab
  }
  tryConsumeQuery()
})

watch(pasteText, () => {
  clearTimeout(pasteTimer)
  if (tab.value !== 'paste' || pasteText.value.trim().length < 8) return
  pasteTimer = window.setTimeout(() => runParseText({ silent: true }), 360)
})

function close() {
  open.value = false
  if (route.query.import) {
    const q = { ...route.query }
    delete q.import
    router.replace({ path: route.path, query: q }).catch(() => {})
  }
}

function confLabel(c) {
  if (c === 'high') return '高'
  if (c === 'medium') return '中'
  return '低·请核'
}

function applyParsed(result, okToast) {
  rows.value = result.rows || []
  warnings.value = result.warnings || []
  dropped.value = result.dropped || []
  parseAttempted.value = true
  if (!rows.value.length) {
    if (!okToast?.silent) {
      user.toast(
        dropped.value.length
          ? `未导入持仓：丢掉 ${dropped.value.length} 条，见下方原因`
          : '未解析到持仓行',
      )
    }
    return
  }
  if (!okToast?.silent) {
    const extra = dropped.value.length ? `，丢掉 ${dropped.value.length} 条` : ''
    user.toast(`认出 ${rows.value.length} 行${extra}，请校对`)
  }
}

function runParseText(opts = {}) {
  applyParsed(parseHoldingsText(pasteText.value, templateId.value), { silent: !!opts.silent })
}

function onTextareaPaste(e) {
  const html = e.clipboardData?.getData('text/html')
  const tableText = htmlTableToText(html)
  if (tableText.split('\n').length >= 2) {
    e.preventDefault()
    pasteText.value = tableText
  }
}

async function ingestFile(file) {
  if (!file) return
  if (file.type.startsWith('image/')) {
    tab.value = 'shot'
    await runOcr(file)
    return
  }
  tab.value = 'file'
  const text = await file.text()
  pasteText.value = text
  applyParsed(parseHoldingsText(text, templateId.value))
}

async function onFile(e) {
  const file = e.target.files?.[0]
  await ingestFile(file)
  e.target.value = ''
}

async function onImage(e) {
  const file = e.target.files?.[0]
  if (!file) return
  await runOcr(file)
  e.target.value = ''
}

function setPreview(fileOrBlob) {
  if (shotPreview.value) URL.revokeObjectURL(shotPreview.value)
  try {
    shotPreview.value = URL.createObjectURL(fileOrBlob)
  } catch {
    shotPreview.value = ''
  }
}

async function runOcr(fileOrBlob) {
  busy.value = true
  tab.value = 'shot'
  setPreview(fileOrBlob)
  ocrStatus.value = '准备识别…'
  try {
    const result = await recognizeHoldingsImage(fileOrBlob, {
      onStatus: (msg) => {
        ocrStatus.value = msg
      },
    })
    applyParsed(result, { silent: true })
    const written = autoWriteKnownHoldings()
    if (written) {
      ocrStatus.value = `已对照股票名和代码写入持仓：新增 ${written.added} · 更新 ${written.updated}${
        dropped.value.length ? `，丢掉 ${dropped.value.length} 条` : ''
      }`
    } else {
      ocrStatus.value = rows.value.length
        ? `认出 ${rows.value.length} 条${dropped.value.length ? `，丢掉 ${dropped.value.length} 条` : ''}。黄色行为低置信，请校对`
        : dropped.value.length
          ? `没认出持仓，丢掉 ${dropped.value.length} 条，见下方原因`
          : '没认出持仓，请换清晰截图或改粘贴'
    }
  } catch (err) {
    console.error(err)
    const detail = err?.message ? String(err.message).slice(0, 80) : ''
    ocrStatus.value = detail ? `识别失败：${detail}` : '识别失败'
    user.toast('截图识别失败，请改用粘贴或 CSV')
  } finally {
    busy.value = false
  }
}

function onPasteImage(e) {
  if (!open.value) return
  const items = e.clipboardData?.items
  if (!items) return
  for (const item of items) {
    if (item.type.startsWith('image/')) {
      const blob = item.getAsFile()
      if (blob) {
        e.preventDefault()
        runOcr(blob)
      }
      break
    }
  }
}

function onDragLeave() {
  dropping.value = false
}

function onDrop(e) {
  dropping.value = false
  const file = e.dataTransfer?.files?.[0]
  if (file) ingestFile(file)
}

async function syncDesktop(copyWindow = false) {
  busy.value = true
  warnings.value = []
  try {
    const res = await fetch(apiUrl('/api/holdings-local'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ launch: false, copyWindow: !!copyWindow }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      user.toast(data.message || '本机同步失败')
      return
    }
    if (data.notes?.length) warnings.value = data.notes
    if (data.rows?.length) {
      rows.value = data.rows
      if (data.warnings?.length) warnings.value = [...warnings.value, ...data.warnings]
      user.toast(`同步到 ${data.rows.length} 行，请校对`)
    } else {
      user.toast(data.notes?.[0] || '未读到持仓，请改粘贴或截图')
    }
  } catch (err) {
    user.toast(err?.message || '本机同步失败')
  } finally {
    busy.value = false
  }
}

function loadExtensionPayload() {
  try {
    const raw = localStorage.getItem('fd_extension_import_v1')
    if (!raw) {
      user.toast('暂无扩展数据')
      return
    }
    const data = JSON.parse(raw)
    applyParsed(normalizeExtensionRows(data))
    tab.value = 'paste'
  } catch {
    user.toast('扩展数据解析失败')
  }
}

function tryConsumeQuery() {
  if (route.query.import === 'manual') {
    tab.value = 'manual'
    return
  }
  if (route.query.import === 'extension') {
    tab.value = 'paste'
    loadExtensionPayload()
  }
}

function resetManual() {
  manual.value = { code: '', name: '', ex: 'SH', shares: 100, cost: 0 }
  manualSuggest.value = []
}

function onManualCode() {
  const q = String(manual.value.code || '').trim()
  const name = portfolio.db?.[q]
  if (name) {
    manual.value.name = name
    manual.value.ex = inferHoldingEx(q, manual.value.ex)
    manualSuggest.value = []
    return
  }
  manualSuggest.value = q ? searchUniverse(portfolio.db, q, { limit: 8 }) : []
  if (/^\d/.test(q)) manual.value.ex = inferHoldingEx(q)
}

function pickManual(s) {
  manual.value.code = s.code
  manual.value.name = s.name
  manual.value.ex = s.market || inferHoldingEx(s.code)
  manualSuggest.value = []
}

function addManualRow() {
  if (!portfolioId.value) portfolioId.value = portfolio.portfolios[0]?.id
  const code = String(manual.value.code || '').trim()
  const name = String(manual.value.name || '').trim()
  if (!code || !name) {
    user.toast('请填写代码和名称')
    return
  }
  const shares = Number(manual.value.shares)
  const cost = Number(manual.value.cost)
  if (!Number.isFinite(shares) || shares < 0) {
    user.toast('请填写股数')
    return
  }
  const { added, updated } = portfolio.upsertHoldings(portfolioId.value, [
    {
      code,
      name,
      ex: inferHoldingEx(code, manual.value.ex),
      shares,
      cost: Number.isFinite(cost) ? cost : 0,
    },
  ])
  user.track?.(user.EVENT_TYPES?.TRADE_BUY, {
    stockCode: code,
    stockName: name,
    tradePrice: Number.isFinite(cost) ? cost : 0,
    tradeAmount: shares * (Number.isFinite(cost) ? cost : 0),
  })
  user.toast(added ? `已添加 ${name}` : updated ? `已更新 ${name}` : '没有写入')
  resetManual()
}

function toggleAll(v) {
  rows.value.forEach((r) => {
    r.selected = v
  })
}

function autoWriteKnownHoldings() {
  const known = rows.value.filter((r) => r.selected !== false && r.code && STOCK_NAMES[r.code])
  if (!known.length) return null
  if (!portfolioId.value) portfolioId.value = portfolio.portfolios[0]?.id
  const dest = portfolio.portfolios.find((p) => p.id === portfolioId.value)
  if (!dest) return null
  const payload = rowsToCommit(known).map((row) => {
    const existing = dest.holdings.find((h) => String(h.code) === row.code)
    if (!existing) return row
    return {
      ...row,
      shares: row.shares > 0 ? row.shares : existing.shares,
      cost: row.cost > 0 ? row.cost : existing.cost,
    }
  })
  if (!payload.length) return null
  const result = portfolio.upsertHoldings(portfolioId.value, payload)
  user.toast(`已对照股票名和代码写入持仓：新增 ${result.added} · 更新 ${result.updated}`)
  portfolio.autoFetchAll().catch(() => {})
  return result
}

function commit() {
  if (!portfolioId.value) {
    user.toast('请选择组合')
    return
  }
  const payload = rowsToCommit(rows.value)
  if (!payload.length) {
    user.toast('请至少勾选一行')
    return
  }
  const { added, updated } = portfolio.upsertHoldings(portfolioId.value, payload)
  user.toast(`导入完成：新增 ${added} · 更新 ${updated}`)
  try {
    localStorage.removeItem('fd_extension_import_v1')
  } catch {
    /* ignore */
  }
  close()
  portfolio.autoFetchAll().catch(() => {})
}

function onExtMessage(event) {
  if (event.origin !== window.location.origin) return
  const data = event.data
  if (!data || data.type !== 'FD_HOLDINGS_IMPORT') return
  applyParsed(normalizeExtensionRows(data.payload))
  open.value = true
  tab.value = 'paste'
  try {
    localStorage.setItem('fd_extension_import_v1', JSON.stringify(data.payload))
  } catch {
    /* ignore */
  }
}

onMounted(() => {
  window.addEventListener('paste', onPasteImage)
  window.addEventListener('message', onExtMessage)
  if (props.modelValue) tryConsumeQuery()
})

onUnmounted(() => {
  window.removeEventListener('paste', onPasteImage)
  window.removeEventListener('message', onExtMessage)
  clearTimeout(pasteTimer)
  if (shotPreview.value) URL.revokeObjectURL(shotPreview.value)
})
</script>

<style scoped>
.imp-root {
  position: fixed;
  inset: 0;
  z-index: 250;
  display: grid;
  place-items: end center;
}
@media (min-width: 720px) {
  .imp-root {
    place-items: center;
    padding: 24px;
  }
}
.imp-scrim {
  position: absolute;
  inset: 0;
  border: 0;
  background: rgba(8, 10, 12, 0.65);
  cursor: pointer;
}
.imp-panel {
  position: relative;
  z-index: 1;
  width: min(720px, 100%);
  max-height: min(92dvh, 900px);
  overflow: auto;
  padding: 20px 18px 28px;
  background: var(--bg, #0f1214);
  border: 1px solid var(--sep, rgba(255, 255, 255, 0.1));
  border-radius: 12px 12px 0 0;
  color: var(--tp, #ece6d8);
}
.imp-panel[data-drop='1'] {
  outline: 2px dashed var(--accent, #c5a059);
  outline-offset: -6px;
}
@media (min-width: 720px) {
  .imp-panel {
    border-radius: 8px;
  }
}
.imp-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
  margin-bottom: 16px;
}
.imp-kicker {
  margin: 0 0 4px;
  font-size: 11px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--accent, #c5a059);
}
.imp-head h2 {
  margin: 0 0 8px;
  font-size: 1.25rem;
}
.imp-sub {
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
  color: var(--ts, #9a9488);
  max-width: 52ch;
}
.imp-step {
  margin-bottom: 16px;
}
.imp-label {
  display: block;
  margin-bottom: 8px;
  font-size: 11px;
  font-weight: 650;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--tt, #6e6960);
}
.imp-dest {
  position: relative;
  display: flex;
  align-items: stretch;
  max-width: 320px;
  min-height: 48px;
  background:
    linear-gradient(180deg, rgba(236, 230, 216, 0.04), transparent 40%),
    var(--surface-2, rgba(21, 23, 26, 0.92));
  border: 1px solid color-mix(in srgb, var(--accent, #c5a059) 28%, var(--sep, rgba(236, 230, 216, 0.1)));
  border-radius: 2px;
}
.imp-dest:focus-within {
  border-color: var(--accent, #c5a059);
  box-shadow: 0 0 0 3px var(--accent-ring, rgba(197, 160, 89, 0.28));
}
.imp-dest-mark {
  width: 3px;
  flex: 0 0 3px;
  background: var(--accent, #c5a059);
  opacity: 0.85;
}
.imp-dest-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 8px 36px 8px 0;
}
.imp-dest[data-single='1'] .imp-dest-body {
  padding-right: 14px;
}
.imp-dest-meta {
  display: block;
  padding: 0 0 2px 14px;
  font-size: 10px;
  font-weight: 650;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--accent, #c5a059);
}
.imp-select {
  appearance: none;
  -webkit-appearance: none;
  width: 100%;
  max-width: none;
  height: auto;
  margin: 0;
  padding: 2px 0 2px 14px;
  border: 0;
  background: transparent;
  color: var(--tp, #ece6d8);
  font: inherit;
  font-size: 15px;
  font-weight: 600;
  outline: none;
  cursor: pointer;
}
.imp-dest[data-single='1'] .imp-select {
  cursor: default;
  pointer-events: none;
}
.imp-dest[data-single='1'] .imp-dest-chev {
  display: none;
}
.imp-select option {
  background: var(--bg, #0a0b0c);
  color: var(--tp, #ece6d8);
}
.imp-dest-chev {
  position: absolute;
  right: 14px;
  top: 50%;
  width: 8px;
  height: 8px;
  border-right: 1.5px solid var(--accent, #c5a059);
  border-bottom: 1.5px solid var(--accent, #c5a059);
  transform: translateY(-65%) rotate(45deg);
  pointer-events: none;
}
.imp-seg {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 2px;
  padding: 3px;
  margin: 10px 0 8px;
  background: rgba(8, 9, 10, 0.55);
  border: 1px solid var(--sep, rgba(236, 230, 216, 0.1));
  border-radius: 2px;
}
.imp-seg-btn {
  appearance: none;
  border: 0;
  background: transparent;
  color: var(--ts, #9a9488);
  font: inherit;
  font-size: 12px;
  font-weight: 650;
  padding: 8px 12px;
  cursor: pointer;
}
.imp-seg-btn.on {
  color: #1a1610;
  background: var(--accent, #c5a059);
}
.imp-ghost {
  appearance: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 34px;
  padding: 0 14px;
  border: 1px solid color-mix(in srgb, var(--accent, #c5a059) 32%, var(--sep, rgba(236, 230, 216, 0.1)));
  border-radius: 2px;
  background: transparent;
  color: var(--tp, #ece6d8);
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  text-decoration: none;
  cursor: pointer;
}
.imp-ghost:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.imp-ol {
  margin: 0 0 8px;
  padding-left: 1.2rem;
  font-size: 12px;
  line-height: 1.55;
  color: var(--ts, #9a9488);
}
.imp-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin: 4px 0 12px;
  border-bottom: 1px solid var(--sep, rgba(255, 255, 255, 0.08));
}
.imp-tabs button {
  appearance: none;
  position: relative;
  border: 0;
  background: transparent;
  color: var(--ts, #9a9488);
  font: inherit;
  font-size: 14px;
  font-weight: 650;
  padding: 10px 14px 12px;
  cursor: pointer;
}
.imp-tabs button.on {
  color: var(--accent, #c5a059);
}
.imp-tabs button.on::after {
  content: '';
  position: absolute;
  left: 14px;
  right: 14px;
  bottom: 0;
  height: 2px;
  background: var(--accent, #c5a059);
}
.imp-body {
  margin-bottom: 14px;
}
.imp-manual {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 12px;
  margin-bottom: 14px;
}
.imp-field {
  display: grid;
  gap: 6px;
  font-size: 12px;
  font-weight: 650;
  letter-spacing: 0.04em;
  color: var(--ts, #9a9488);
}
.imp-field input,
.imp-field select {
  width: 100%;
  height: 42px;
  padding: 0 12px;
  border: 1px solid var(--sep, rgba(236, 230, 216, 0.12));
  border-radius: 2px;
  background: transparent;
  color: var(--tp, #ece6d8);
  font: inherit;
  font-size: 14px;
  font-weight: 500;
}
.imp-manual-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  margin-bottom: 8px;
}
.imp-suggest {
  position: absolute;
  z-index: 4;
  left: 0;
  right: 0;
  top: calc(100% + 4px);
  margin: 0;
  padding: 6px 0;
  list-style: none;
  background: var(--bg, #0a0b0c);
  border: 1px solid var(--sep, rgba(236, 230, 216, 0.12));
  border-radius: 2px;
  max-height: 240px;
  overflow: auto;
}
.imp-suggest li {
  display: grid;
  grid-template-columns: 72px 1fr auto;
  gap: 8px;
  align-items: center;
  padding: 8px 12px;
  cursor: pointer;
  font-size: 12px;
  min-height: 44px;
  color: var(--tp, #ece6d8);
}
.imp-suggest li:hover {
  background: var(--accent-soft, rgba(197, 160, 89, 0.12));
}
.imp-suggest em {
  font-style: normal;
  color: var(--tt, #6e6960);
}
.imp-drop {
  display: grid;
  gap: 6px;
  padding: 22px 16px;
  border: 1px dashed color-mix(in srgb, var(--accent, #c5a059) 40%, var(--sep, rgba(236, 230, 216, 0.12)));
  border-radius: 4px;
  text-align: center;
  cursor: pointer;
  color: var(--ts, #9a9488);
  font-size: 13px;
  line-height: 1.45;
}
.imp-drop strong {
  color: var(--tp, #ece6d8);
  font-size: 14px;
}
.imp-shot-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.imp-file-label {
  position: relative;
  cursor: pointer;
}
.imp-file-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
}
.imp-preview {
  display: block;
  margin-top: 10px;
  max-width: 100%;
  max-height: 180px;
  object-fit: contain;
  border: 1px solid var(--sep, rgba(255, 255, 255, 0.08));
  background: #000;
}
.imp-ta {
  width: 100%;
  margin-bottom: 10px;
  font-family: var(--mono, ui-monospace, monospace);
  font-size: 12px;
  line-height: 1.45;
  resize: vertical;
}
.imp-hint {
  margin: 8px 0 0;
  font-size: 12px;
  color: var(--ts, #9a9488);
  line-height: 1.5;
}
.imp-hint a {
  color: var(--accent, #c5a059);
}
.imp-ocr {
  margin: 8px 0 0;
  font-size: 12px;
  color: var(--accent, #c5a059);
}
.imp-help {
  margin: 0 0 14px;
  padding: 10px 12px;
  border: 1px solid var(--sep, rgba(236, 230, 216, 0.1));
  border-radius: 2px;
  font-size: 13px;
  color: var(--ts, #9a9488);
}
.imp-help summary {
  cursor: pointer;
  color: var(--tp, #ece6d8);
  font-weight: 650;
}
.imp-login-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
}
.imp-warn {
  margin-bottom: 12px;
  padding: 10px 12px;
  border: 1px solid rgba(197, 160, 89, 0.35);
  background: rgba(197, 160, 89, 0.06);
  font-size: 12px;
}
.imp-report {
  margin-bottom: 12px;
  padding: 10px 12px;
  border: 1px solid var(--sep, rgba(236, 230, 216, 0.12));
  background: rgba(8, 10, 12, 0.35);
  font-size: 13px;
  line-height: 1.45;
}
.imp-report p {
  margin: 0;
}
.imp-report ul {
  margin: 8px 0 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 6px;
}
.imp-report li {
  display: grid;
  gap: 2px;
  font-size: 12px;
  color: var(--ts, #9a9488);
}
.imp-report code {
  color: var(--tp, #ece6d8);
  font-family: var(--mono, ui-monospace, monospace);
  font-size: 12px;
  word-break: break-all;
}
.imp-review-head {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  margin-bottom: 10px;
}
.imp-table-wrap {
  overflow-x: auto;
  margin-bottom: 14px;
  border: 1px solid var(--sep, rgba(255, 255, 255, 0.08));
}
.imp-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}
.imp-table th,
.imp-table td {
  padding: 8px 6px;
  border-bottom: 1px solid var(--sep, rgba(255, 255, 255, 0.06));
  vertical-align: middle;
}
.imp-table th {
  text-align: left;
  color: var(--ts, #9a9488);
  font-weight: 650;
}
.imp-table .r {
  text-align: right;
}
.imp-table tr.low {
  background: rgba(197, 160, 89, 0.08);
}
.imp-cell {
  width: 72px;
  font: inherit;
  font-size: 12px;
}
.imp-cell.wide {
  width: 110px;
}
.imp-cell.num {
  width: 80px;
  text-align: right;
}
.imp-conf {
  font-size: 11px;
  font-weight: 650;
}
.imp-conf[data-c='high'] {
  color: var(--gain, #3d9a6a);
}
.imp-conf[data-c='medium'] {
  color: var(--ts, #9a9488);
}
.imp-conf[data-c='low'] {
  color: var(--accent, #c5a059);
}
</style>
