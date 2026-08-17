<template>
  <div v-if="open" class="imp-root" role="dialog" aria-modal="true" aria-labelledby="imp-title">
    <button type="button" class="imp-scrim" aria-label="关闭" @click="close" />
    <div class="imp-panel">
      <header class="imp-head">
        <div>
          <p class="imp-kicker">持仓导入</p>
          <h2 id="imp-title">从券商同步到 FinDigest</h2>
          <p class="imp-sub">
            本机可从已登录的东方财富证券交易窗口同步持仓，也会扫剪贴板和桌面上的导出 CSV。请先在软件里打开持仓表。
          </p>
        </div>
        <button type="button" class="imp-ghost" @click="close">关闭</button>
      </header>

      <div class="imp-step">
        <label class="imp-label" for="imp-portfolio">目标组合</label>
        <div class="imp-dest" :data-single="portfolio.portfolios.length <= 1 ? '1' : '0'">
          <span class="imp-dest-mark" aria-hidden="true" />
          <div class="imp-dest-body">
            <span v-if="portfolio.portfolios.length <= 1" class="imp-dest-meta">写入目标</span>
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
        <p class="imp-dest-hint">解析后的持仓会写入这个组合</p>
      </div>

      <div class="imp-step">
        <label class="imp-label">来源</label>
        <div class="imp-seg" role="group" aria-label="券商">
          <button
            v-for="t in loginBrokers"
            :key="t.id"
            type="button"
            class="imp-seg-btn"
            :class="{ on: templateId === t.id }"
            :aria-pressed="templateId === t.id"
            @click="pickBroker(t.id)"
          >
            {{ t.label }}
          </button>
        </div>
      </div>

      <div class="imp-seg imp-seg-channel" role="group" aria-label="同步方式">
        <button
          type="button"
          class="imp-seg-btn"
          :class="{ on: channel === 'web' }"
          :aria-pressed="channel === 'web'"
          @click="channel = 'web'"
        >
          网页登录采集
        </button>
        <button
          type="button"
          class="imp-seg-btn"
          :class="{ on: channel === 'desktop' }"
          :aria-pressed="channel === 'desktop'"
          @click="channel = 'desktop'"
        >
          电脑软件同步
        </button>
      </div>

      <div v-if="channel === 'web'" class="imp-login">
        <p class="imp-login-lead">{{ activeBroker.hint }}</p>
        <div class="imp-login-actions">
          <button type="button" class="btn bp sm" @click="openBrokerLogin">打开{{ activeBroker.label }}登录页</button>
          <button type="button" class="imp-ghost" @click="openBrokerHoldings">打开持仓页</button>
        </div>
        <ol class="imp-ol">
          <li>安装浏览器扩展：Chrome/Edge → 开发者模式 → 加载 <code>extension/</code></li>
          <li>在刚打开的页面用<strong>交易账号</strong>登录</li>
          <li>点扩展「读取本页持仓」→「发送到 FinDigest」</li>
        </ol>
        <p class="imp-honest">读得到取决于网页表格是否暴露；登录页或客户端内嵌页可能读空，那时改用复制粘贴。</p>
        <button type="button" class="imp-ghost" @click="loadExtensionPayload">已发送？读取扩展数据</button>
      </div>

      <div v-else class="imp-login">
        <p class="imp-login-lead">
          本机有东方财富终端。登录请先等它自己升级完。扫码必须用「东方财富证券」App，不能用看行情的「东方财富」或微信。登录过程中不要点复制窗口。不会读取密码文件。
        </p>
        <div class="imp-login-actions">
          <button type="button" class="btn bp sm" :disabled="busy" @click="syncDesktop(false)">
            {{ busy ? '同步中…' : '同步剪贴板 / CSV' }}
          </button>
          <button type="button" class="imp-ghost" :disabled="busy" @click="syncDesktop(true)">
            复制交易窗口
          </button>
          <button type="button" class="imp-ghost" @click="tab = 'paste'">改粘贴</button>
          <button type="button" class="imp-ghost" @click="tab = 'file'">改上传 CSV</button>
        </div>
        <ol class="imp-ol">
          <li>等东方财富更新结束，用资金账号登录（或证券 App 扫码）</li>
          <li>点到持仓表，自己 Ctrl+A / Ctrl+C</li>
          <li>回到这里点「同步剪贴板 / CSV」。登录页不要点「复制交易窗口」</li>
        </ol>
      </div>

      <div class="imp-tabs" role="tablist" aria-label="手动导入方式">
        <button type="button" role="tab" :aria-selected="tab === 'paste'" :class="{ on: tab === 'paste' }" @click="tab = 'paste'">粘贴表格</button>
        <button type="button" role="tab" :aria-selected="tab === 'file'" :class="{ on: tab === 'file' }" @click="tab = 'file'">上传 CSV</button>
        <button type="button" role="tab" :aria-selected="tab === 'shot'" :class="{ on: tab === 'shot' }" @click="tab = 'shot'">截图 OCR</button>
      </div>

      <div v-if="tab === 'paste'" class="imp-body">
        <textarea
          v-model="pasteText"
          class="imp-ta"
          rows="8"
          placeholder="从券商网页复制持仓表，粘贴到这里…"
        />
        <button class="btn bp sm" :disabled="busy" @click="runParseText">解析粘贴内容</button>
      </div>

      <div v-else-if="tab === 'file'" class="imp-body">
        <input type="file" accept=".csv,.txt,text/csv,text/plain" @change="onFile" />
        <p class="imp-hint">第一期请用 CSV / TXT（Excel 请另存为 CSV）。</p>
      </div>

      <div v-else-if="tab === 'shot'" class="imp-body">
        <input type="file" accept="image/*" @change="onImage" />
        <p class="imp-hint">上传或粘贴持仓截图；OCR 有误差，请在下方校对后再导入。</p>
        <p v-if="ocrStatus" class="imp-ocr">{{ ocrStatus }}</p>
      </div>

      <div v-if="warnings.length" class="imp-warn">
        <div v-for="(w, i) in warnings" :key="i">{{ w }}</div>
      </div>

      <div v-if="rows.length" class="imp-review">
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
  parseHoldingsText,
  parseOcrText,
  normalizeExtensionRows,
  rowsToCommit,
} from '@/services/holdingsImport.js'
import { apiUrl } from '@/services/apiClient.js'
import { BROKER_LOGINS, brokerById } from '@/data/brokerLogin.js'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
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

const loginBrokers = BROKER_LOGINS
const templateId = ref('eastmoney')
const portfolioId = ref(null)
const tab = ref('paste')
const channel = ref('desktop')
const pasteText = ref('')
const rows = ref([])
const warnings = ref([])
const busy = ref(false)
const ocrStatus = ref('')

const activeBroker = computed(() => brokerById(templateId.value))
const selectedCount = computed(() => rows.value.filter((r) => r.selected).length)
const targetName = computed(() => portfolio.portfolios.find((p) => p.id === portfolioId.value)?.name || '组合')

function pickBroker(id) {
  templateId.value = id
}

function openBrokerLogin() {
  window.open(activeBroker.value.loginUrl, '_blank', 'noopener,noreferrer')
  user.toast(`已打开${activeBroker.value.label}登录页，请用交易账号登录`)
}

function openBrokerHoldings() {
  window.open(activeBroker.value.holdingsUrl, '_blank', 'noopener,noreferrer')
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
      user.toast(data.message || '本机同步失败（需在本地 Vite 运行）')
      return
    }
    if (data.notes?.length) warnings.value = data.notes
    if (data.rows?.length) {
      rows.value = data.rows
      if (data.warnings?.length) warnings.value = [...warnings.value, ...data.warnings]
      user.toast(`同步到 ${data.rows.length} 行，请校对`)
    } else {
      user.toast(data.notes?.[0] || '未读到持仓。请打开持仓表后再试，或改粘贴 / CSV。')
    }
  } catch (e) {
    user.toast(e?.message || '本机同步失败')
  } finally {
    busy.value = false
  }
}

watch(
  () => portfolio.portfolios,
  (list) => {
    if (!portfolioId.value && list[0]) portfolioId.value = list[0].id
  },
  { immediate: true },
)

watch(open, (v) => {
  if (v) tryConsumeQuery()
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

function applyParsed(result) {
  rows.value = result.rows || []
  warnings.value = result.warnings || []
}

function runParseText() {
  applyParsed(parseHoldingsText(pasteText.value, templateId.value))
  if (!rows.value.length) user.toast('未解析到持仓行')
  else user.toast(`解析到 ${rows.value.length} 行，请校对`)
}

async function onFile(e) {
  const file = e.target.files?.[0]
  if (!file) return
  const text = await file.text()
  applyParsed(parseHoldingsText(text, templateId.value))
  user.toast(rows.value.length ? `解析到 ${rows.value.length} 行` : '文件未解析出持仓')
  e.target.value = ''
}

async function onImage(e) {
  const file = e.target.files?.[0]
  if (!file) return
  await runOcr(file)
  e.target.value = ''
}

async function runOcr(fileOrBlob) {
  busy.value = true
  ocrStatus.value = 'OCR 识别中…'
  try {
    const { createWorker } = await import('tesseract.js')
    const worker = await createWorker('chi_sim+eng')
    const { data } = await worker.recognize(fileOrBlob)
    await worker.terminate()
    ocrStatus.value = '识别完成，请校对黄色低置信行'
    applyParsed(parseOcrText(data?.text || ''))
    if (!rows.value.length) user.toast('OCR 未识别到持仓，请改用粘贴或 CSV')
  } catch (err) {
    console.error(err)
    ocrStatus.value = 'OCR 失败'
    user.toast('OCR 失败，请改用粘贴表格')
  } finally {
    busy.value = false
  }
}

function onPasteImage(e) {
  if (!open.value || tab.value !== 'shot') return
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

function loadExtensionPayload() {
  try {
    const raw = localStorage.getItem('fd_extension_import_v1')
    if (!raw) {
      user.toast('暂无扩展数据，请先在券商页读取并发送')
      return
    }
    const data = JSON.parse(raw)
    applyParsed(normalizeExtensionRows(data))
    tab.value = 'paste'
    user.toast(rows.value.length ? `扩展带回 ${rows.value.length} 行` : '扩展数据无效')
  } catch {
    user.toast('扩展数据解析失败')
  }
}

function tryConsumeQuery() {
  if (route.query.import === 'extension') {
    tab.value = 'paste'
    loadExtensionPayload()
  }
}

function toggleAll(v) {
  rows.value.forEach((r) => {
    r.selected = v
  })
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
  transition: border-color 0.2s var(--ease, cubic-bezier(0.22, 1, 0.36, 1)),
    box-shadow 0.2s var(--ease, cubic-bezier(0.22, 1, 0.36, 1));
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
  border-radius: 0;
  background: transparent;
  color: var(--tp, #ece6d8);
  font: inherit;
  font-size: 15px;
  font-weight: 600;
  letter-spacing: -0.01em;
  line-height: 1.3;
  cursor: pointer;
  outline: none;
}
.imp-dest[data-single='0'] .imp-select {
  padding-top: 4px;
  padding-bottom: 4px;
}
.imp-dest[data-single='1'] .imp-select {
  cursor: default;
  pointer-events: none;
}
.imp-dest[data-single='1'] .imp-dest-chev {
  display: none;
}
.imp-select option {
  background: #121416;
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
  opacity: 0.9;
}
.imp-dest-hint {
  margin: 8px 0 0;
  font-size: 12px;
  line-height: 1.4;
  color: var(--tt, #6e6960);
}
.imp-seg {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 2px;
  padding: 3px;
  background: rgba(8, 9, 10, 0.55);
  border: 1px solid var(--sep, rgba(236, 230, 216, 0.1));
  border-radius: 2px;
}
.imp-seg-channel {
  display: flex;
  width: 100%;
  max-width: 420px;
  margin-bottom: 12px;
}
.imp-seg-channel .imp-seg-btn {
  flex: 1;
  justify-content: center;
}
.imp-seg-btn {
  appearance: none;
  border: 0;
  background: transparent;
  color: var(--ts, #9a9488);
  font: inherit;
  font-size: 12px;
  font-weight: 650;
  letter-spacing: 0.01em;
  padding: 9px 12px;
  border-radius: 1px;
  cursor: pointer;
  transition:
    color 0.18s var(--ease, cubic-bezier(0.22, 1, 0.36, 1)),
    background 0.18s var(--ease, cubic-bezier(0.22, 1, 0.36, 1)),
    transform 0.12s var(--ease, cubic-bezier(0.22, 1, 0.36, 1)),
    box-shadow 0.18s var(--ease, cubic-bezier(0.22, 1, 0.36, 1));
}
.imp-seg-btn:hover:not(.on) {
  color: var(--tp, #ece6d8);
  background: rgba(236, 230, 216, 0.05);
}
.imp-seg-btn:active {
  transform: scale(0.98);
}
.imp-seg-btn.on {
  color: #1a1610;
  background: var(--accent, #c5a059);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.18);
}
.imp-seg-btn.on:hover {
  background: var(--accent-hover, #a8843f);
  color: #1a1610;
}
.imp-ghost {
  appearance: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 34px;
  height: 34px;
  padding: 0 14px;
  border: 1px solid color-mix(in srgb, var(--accent, #c5a059) 32%, var(--sep, rgba(236, 230, 216, 0.1)));
  border-radius: 2px;
  background: transparent;
  color: var(--tp, #ece6d8);
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: -0.01em;
  cursor: pointer;
  white-space: nowrap;
  transition:
    transform 0.12s var(--ease, cubic-bezier(0.22, 1, 0.36, 1)),
    background 0.18s var(--ease, cubic-bezier(0.22, 1, 0.36, 1)),
    border-color 0.18s var(--ease, cubic-bezier(0.22, 1, 0.36, 1)),
    color 0.18s var(--ease, cubic-bezier(0.22, 1, 0.36, 1)),
    box-shadow 0.18s var(--ease, cubic-bezier(0.22, 1, 0.36, 1));
}
.imp-ghost:hover:not(:disabled) {
  color: var(--accent, #c5a059);
  background: var(--accent-soft, rgba(197, 160, 89, 0.12));
  border-color: color-mix(in srgb, var(--accent, #c5a059) 55%, transparent);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--accent, #c5a059) 18%, transparent);
}
.imp-ghost:active:not(:disabled) {
  transform: translateY(1px) scale(0.98);
}
.imp-ghost:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.imp-honest {
  margin: 0 0 10px;
  font-size: 12px;
  line-height: 1.45;
  color: var(--ts, #9a9488);
}
.imp-login {
  margin-bottom: 16px;
  padding: 14px 14px 12px;
  border: 1px solid color-mix(in srgb, var(--accent, #c5a059) 22%, var(--sep, rgba(236, 230, 216, 0.1)));
  background:
    linear-gradient(135deg, rgba(197, 160, 89, 0.07), transparent 42%),
    rgba(12, 13, 14, 0.55);
  border-radius: 2px;
}
.imp-login-lead {
  margin: 0 0 12px;
  font-size: 13px;
  line-height: 1.55;
  color: var(--tp, #ece6d8);
}
.imp-login-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}
.imp-ol {
  margin: 0 0 12px;
  padding-left: 1.2rem;
  font-size: 12px;
  line-height: 1.55;
  color: var(--ts, #9a9488);
}
.imp-ol code {
  font-size: 11px;
}
.imp-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin: 12px 0;
  border-bottom: 1px solid var(--sep, rgba(255, 255, 255, 0.08));
  padding-bottom: 0;
}
.imp-tabs button {
  appearance: none;
  position: relative;
  border: 0;
  background: transparent;
  color: var(--ts, #9a9488);
  font: inherit;
  font-size: 13px;
  font-weight: 650;
  padding: 10px 12px 12px;
  cursor: pointer;
  transition: color 0.18s var(--ease, cubic-bezier(0.22, 1, 0.36, 1));
}
.imp-tabs button::after {
  content: '';
  position: absolute;
  left: 12px;
  right: 12px;
  bottom: 0;
  height: 2px;
  background: transparent;
  transition: background 0.18s var(--ease, cubic-bezier(0.22, 1, 0.36, 1));
}
.imp-tabs button:hover {
  color: var(--tp, #ece6d8);
}
.imp-tabs button.on {
  color: var(--accent, #c5a059);
}
.imp-tabs button.on::after {
  background: var(--accent, #c5a059);
}
.imp-body {
  margin-bottom: 14px;
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
.imp-ocr {
  margin: 8px 0 0;
  font-size: 12px;
  color: var(--accent, #c5a059);
}
.imp-warn {
  margin-bottom: 12px;
  padding: 10px 12px;
  border: 1px solid rgba(197, 160, 89, 0.35);
  background: rgba(197, 160, 89, 0.06);
  font-size: 12px;
  color: var(--tp, #ece6d8);
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
  max-width: 100%;
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
