<template>
  <div class="ops" data-ops>
    <template v-if="!unlocked">
      <section class="ops-gate">
        <h1>FinDigest 控制台</h1>
        <p>本机是控制端。粘贴 ADMIN_SECRET 后管理账号、会员、兑换码与系统状态。密钥只留在本页会话，关标签即失效。</p>
        <label class="ops-muted" for="ops-secret">管理密钥</label>
        <div class="ops-row">
          <input
            id="ops-secret"
            v-model="secret"
            class="ops-input"
            type="password"
            autocomplete="off"
            placeholder="至少 16 位"
            @keydown.enter="unlock"
          />
          <button class="ops-btn" type="button" :disabled="busy" @click="unlock">进入</button>
        </div>
        <p v-if="gateErr" class="ops-flash is-err">{{ gateErr }}</p>
      </section>
    </template>

    <template v-else>
      <header class="ops-top">
        <p class="ops-brand">
          FinDigest 控制台
          <span>单操作员 · 本机会话</span>
        </p>
        <nav class="ops-tabs" aria-label="控制台分区">
          <button
            v-for="t in tabs"
            :key="t.id"
            type="button"
            class="ops-tab"
            :class="{ 'is-on': tab === t.id }"
            @click="setTab(t.id)"
          >
            {{ t.label }}
          </button>
        </nav>
        <div class="ops-top-actions">
          <button class="ops-btn ops-ghost" type="button" :disabled="busy" @click="refreshCurrent">刷新</button>
          <button class="ops-link" type="button" @click="lock">退出</button>
        </div>
      </header>

      <div class="ops-body">
        <p v-if="msg" class="ops-flash is-ok">{{ msg }}</p>
        <p v-if="err" class="ops-flash is-err">{{ err }}</p>

        <OpsOverview
          v-if="tab === 'overview'"
          :kpis="kpis"
          :health="health"
          :accounts="accounts"
          @open-account="openAccount"
        />
        <OpsAccounts
          v-else-if="tab === 'accounts'"
          :accounts="accounts"
          :hit="hit"
          :busy="busy"
          :selected="selectedEmail"
          @open-account="openAccount"
          @refresh="loadOverview"
          @grant="grant"
          @revoke="revoke"
          @ban="ban"
          @unban="unban"
        />
        <OpsCodes
          v-else-if="tab === 'codes'"
          :codes="codes"
          :fresh="freshCodes"
          :busy="busy"
          @issue="issue"
          @copy="copyCode"
          @refresh="loadCodes"
        />
        <OpsSystem v-else-if="tab === 'system'" :health="health" />
        <OpsAudit
          v-else-if="tab === 'audit'"
          :events="events"
          :busy="busy"
          @refresh="loadAudit"
        />
      </div>
    </template>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  ADMIN_SECRET_KEY,
  adminGet,
  adminPost,
} from '@/services/adminApi.js'
import OpsOverview from '@/components/ops/OpsOverview.vue'
import OpsAccounts from '@/components/ops/OpsAccounts.vue'
import OpsCodes from '@/components/ops/OpsCodes.vue'
import OpsSystem from '@/components/ops/OpsSystem.vue'
import OpsAudit from '@/components/ops/OpsAudit.vue'
import '@/assets/styles/ops.css'

const emptyKpis = () => ({
  registered: 0,
  pro: 0,
  expired: 0,
  banned: 0,
  tokens: 0,
  calls: 0,
  new7: 0,
  active7: 0,
})

const tabs = [
  { id: 'overview', label: '总览' },
  { id: 'accounts', label: '账号' },
  { id: 'codes', label: '兑换码' },
  { id: 'system', label: '系统' },
  { id: 'audit', label: '记录' },
]

const route = useRoute()
const router = useRouter()
const secret = ref('')
const unlocked = ref(false)
const busy = ref(false)
const gateErr = ref('')
const err = ref('')
const msg = ref('')
const tab = ref('overview')
const accounts = ref([])
const kpis = reactive(emptyKpis())
const health = reactive({})
const hit = ref(null)
const selectedEmail = ref('')
const codes = ref([])
const freshCodes = ref([])
const events = ref([])

onMounted(() => {
  const q = String(route.query.tab || '')
  if (tabs.some((t) => t.id === q)) tab.value = q
  const saved = sessionStorage.getItem(ADMIN_SECRET_KEY) || ''
  if (saved) {
    secret.value = saved
    unlocked.value = true
    loadOverview()
  }
})

function applyKpis(next) {
  Object.assign(kpis, emptyKpis(), next || {})
}

function applyHealth(next) {
  Object.keys(health).forEach((k) => delete health[k])
  Object.assign(health, next || {})
}

function setTab(id) {
  tab.value = id
  router.replace({ query: { ...route.query, tab: id } }).catch(() => {})
  if (id === 'codes' && !codes.value.length) loadCodes()
  if (id === 'audit' && !events.value.length) loadAudit()
  if (id === 'overview' || id === 'accounts' || id === 'system') {
    if (!accounts.value.length) loadOverview()
  }
}

function refreshCurrent() {
  if (tab.value === 'codes') return loadCodes()
  if (tab.value === 'audit') return loadAudit()
  return loadOverview()
}

function lock() {
  sessionStorage.removeItem(ADMIN_SECRET_KEY)
  unlocked.value = false
  secret.value = ''
  accounts.value = []
  hit.value = null
  codes.value = []
  freshCodes.value = []
  events.value = []
  applyKpis({})
  applyHealth({})
}

async function unlock() {
  gateErr.value = ''
  if (!secret.value.trim() || secret.value.trim().length < 16) {
    gateErr.value = '密钥至少 16 位'
    return
  }
  busy.value = true
  try {
    const data = await adminGet(secret.value, {})
    sessionStorage.setItem(ADMIN_SECRET_KEY, secret.value.trim())
    unlocked.value = true
    accounts.value = data.accounts || []
    applyKpis(data.kpis)
    applyHealth(data.health)
  } catch (e) {
    gateErr.value = e?.message || '密钥无效'
  } finally {
    busy.value = false
  }
}

async function loadOverview() {
  busy.value = true
  err.value = ''
  try {
    const data = await adminGet(secret.value, {})
    accounts.value = data.accounts || []
    applyKpis(data.kpis)
    applyHealth(data.health)
  } catch (e) {
    err.value = e?.message || '列表失败'
  } finally {
    busy.value = false
  }
}

async function loadCodes() {
  busy.value = true
  err.value = ''
  try {
    const data = await adminGet(secret.value, { view: 'codes' })
    codes.value = data.codes || []
  } catch (e) {
    err.value = e?.message || '兑换码列表失败'
  } finally {
    busy.value = false
  }
}

async function loadAudit() {
  busy.value = true
  err.value = ''
  try {
    const data = await adminGet(secret.value, { view: 'audit' })
    events.value = data.events || []
  } catch (e) {
    err.value = e?.message || '记录读取失败'
  } finally {
    busy.value = false
  }
}

async function openAccount(email) {
  selectedEmail.value = email
  tab.value = 'accounts'
  router.replace({ query: { ...route.query, tab: 'accounts' } }).catch(() => {})
  busy.value = true
  err.value = ''
  try {
    hit.value = await adminGet(secret.value, { email })
  } catch (e) {
    err.value = e?.message || '查询失败'
    hit.value = null
  } finally {
    busy.value = false
  }
}

async function act(action, body = {}) {
  busy.value = true
  err.value = ''
  msg.value = ''
  try {
    const data = await adminPost(secret.value, {
      action,
      email: selectedEmail.value,
      ...body,
    })
    msg.value = data.message || '完成'
    if (data.meta || data.ent || data.usage) {
      hit.value = {
        email: data.email || hit.value?.email || selectedEmail.value,
        meta: data.meta || hit.value?.meta,
        ent: data.ent || hit.value?.ent,
        usage: data.usage || hit.value?.usage,
        vault: hit.value?.vault,
      }
    }
    if (data.code) {
      freshCodes.value.unshift({
        code: data.code,
        days: data.days,
        note: data.note || '',
        copied: false,
      })
    }
    if (action !== 'issue_code') await loadOverview()
    return data
  } catch (e) {
    err.value = e?.message || '操作失败'
    return null
  } finally {
    busy.value = false
  }
}

function grant(days) {
  return act('grant_pro', { days })
}
function revoke() {
  return act('revoke_pro')
}
function ban(reason) {
  return act('ban', { reason: reason || '' })
}
function unban() {
  return act('unban')
}

async function issue(days, note) {
  const data = await act('issue_code', { days, note: note || '', email: '' })
  if (data?.code) loadCodes()
}

async function copyCode(code) {
  try {
    await navigator.clipboard.writeText(code)
    freshCodes.value = freshCodes.value.map((c) => (c.code === code ? { ...c, copied: true } : c))
    msg.value = '已复制兑换码'
  } catch {
    err.value = '复制失败，请手动选中'
  }
}
</script>
