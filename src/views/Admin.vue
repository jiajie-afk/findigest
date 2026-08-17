<template>
  <div class="ad">
    <header class="ad-top">
      <div>
        <h1 class="ad-h1">FinDigest 管理台</h1>
        <p class="ad-lead">
          {{ unlocked ? `已注册 ${accounts.length} 人。点名单即可看邮箱、开关 Pro。` : '进入后即可看到全部已注册邮箱。' }}
        </p>
      </div>
      <p class="ad-hint">仅你本机使用 · 勿分享密钥</p>
    </header>

    <section class="ad-card" v-if="!unlocked">
      <label class="ad-lab">管理密钥 ADMIN_SECRET</label>
      <div class="ad-row">
        <input
          v-model="secret"
          class="ad-input"
          type="password"
          autocomplete="off"
          placeholder="粘贴密钥"
          @keydown.enter="unlock"
        />
        <button class="ad-btn" type="button" @click="unlock">进入</button>
      </div>
      <p v-if="gateErr" class="ad-err">{{ gateErr }}</p>
    </section>

    <template v-else>
      <section class="ad-card">
        <div class="ad-row">
          <input
            v-model="email"
            class="ad-input"
            type="email"
            placeholder="用户邮箱"
            @keydown.enter="lookup"
          />
          <button class="ad-btn" type="button" :disabled="busy" @click="lookup">查询</button>
          <button class="ad-btn ad-ghost" type="button" :disabled="busy" @click="loadList">刷新名单</button>
        </div>
        <p v-if="msg" class="ad-ok">{{ msg }}</p>
        <p v-if="err" class="ad-err">{{ err }}</p>
      </section>

      <section class="ad-card ad-card-wide">
        <div class="ad-list-head">
          <h2 class="ad-h2">注册账号 {{ accounts.length ? `(${filteredAccounts.length}/${accounts.length})` : '' }}</h2>
          <input
            v-model="query"
            class="ad-input ad-search"
            type="search"
            placeholder="搜索邮箱 / 昵称"
          />
        </div>
        <p v-if="busy && !accounts.length" class="ad-empty">正在读取云端账号…</p>
        <p v-else-if="!accounts.length" class="ad-empty">还没有云端注册用户。有人在 findigest.cn 用邮箱注册并登录后，会出现在这里。</p>
        <div v-else class="ad-table-wrap">
          <table class="ad-table">
            <thead>
              <tr>
                <th>邮箱</th>
                <th>昵称</th>
                <th>会员</th>
                <th>Token</th>
                <th>封禁</th>
                <th>最近活跃</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="a in filteredAccounts"
                :key="a.email"
                :class="{ 'is-open': hit?.email === a.email }"
                @click="openRow(a.email)"
              >
                <td>{{ identityLabel(a.email) }}</td>
                <td>{{ a.displayName || '—' }}</td>
                <td>{{ rowPlan(a) }}</td>
                <td>{{ a.totalTokens || 0 }}</td>
                <td>{{ a.banned ? '是' : '否' }}</td>
                <td>{{ fmtTime(a.lastSeenAt || a.createdAt) }}</td>
                <td>
                  <button class="ad-link" type="button">打开</button>
                </td>
              </tr>
            </tbody>
          </table>
          <p v-if="accounts.length && !filteredAccounts.length" class="ad-empty">没有匹配的账号</p>
        </div>
      </section>

      <section v-if="hit" class="ad-card">
        <h2 class="ad-h2">{{ identityLabel(hit.email) }}</h2>
        <dl class="ad-dl">
          <div><dt>邮箱</dt><dd>{{ hit.email }}</dd></div>
          <div v-if="hit.meta?.displayName"><dt>昵称</dt><dd>{{ hit.meta.displayName }}</dd></div>
          <div><dt>账号 ID</dt><dd>{{ hit.meta?.accountId }}</dd></div>
          <div><dt>状态</dt><dd :class="hit.meta?.banned ? 'bad' : 'ok'">{{ hit.meta?.banned ? '已封禁' : '正常' }}</dd></div>
          <div><dt>会员</dt><dd>{{ planLabel }}</dd></div>
          <div><dt>Token</dt><dd>{{ tokenLabel }}</dd></div>
          <div><dt>调用次数</dt><dd>{{ hit.usage?.calls || 0 }}</dd></div>
          <div v-if="hit.usage?.lastModel"><dt>最近模型</dt><dd>{{ hit.usage.lastModel }}</dd></div>
          <div v-if="hit.meta?.createdAt"><dt>注册</dt><dd>{{ fmtTime(hit.meta.createdAt) }}</dd></div>
          <div v-if="hit.meta?.lastSeenAt"><dt>最近活跃</dt><dd>{{ fmtTime(hit.meta.lastSeenAt) }}</dd></div>
        </dl>

        <div class="ad-actions">
          <button class="ad-btn" type="button" :disabled="busy" @click="grant(30)">开 Pro · 30 天</button>
          <button class="ad-btn" type="button" :disabled="busy" @click="grant(90)">开 Pro · 90 天</button>
          <button class="ad-btn" type="button" :disabled="busy" @click="grant(365)">开 Pro · 1 年</button>
          <button class="ad-btn" type="button" :disabled="busy" @click="grant(null)">开 Pro · 永久</button>
          <button class="ad-btn ad-ghost" type="button" :disabled="busy" @click="revoke">取消 Pro</button>
          <button
            v-if="!hit.meta?.banned"
            class="ad-btn ad-danger"
            type="button"
            :disabled="busy"
            @click="ban"
          >
            封禁
          </button>
          <button v-else class="ad-btn" type="button" :disabled="busy" @click="unban">解封</button>
        </div>
      </section>

      <section class="ad-card">
        <h2 class="ad-h2">生成兑换码</h2>
        <p class="ad-lead">发给用户，让他们登录后在开通页粘贴兑换。明文只显示一次。</p>
        <div class="ad-actions">
          <button class="ad-btn" type="button" :disabled="busy" @click="issue(30)">30 天码</button>
          <button class="ad-btn" type="button" :disabled="busy" @click="issue(90)">90 天码</button>
          <button class="ad-btn" type="button" :disabled="busy" @click="issue(365)">1 年码</button>
          <button class="ad-btn ad-ghost" type="button" :disabled="busy" @click="issue(null)">永久码</button>
        </div>
        <ul v-if="issued.length" class="ad-codes">
          <li v-for="c in issued" :key="c.code">
            <code class="ad-code">{{ c.code }}</code>
            <span class="ad-code-meta">{{ c.days == null ? '永久' : c.days + ' 天' }}</span>
            <button class="ad-link" type="button" @click="copyCode(c.code)">{{ c.copied ? '已复制' : '复制' }}</button>
          </li>
        </ul>
      </section>

      <p class="ad-foot">
        <button class="ad-link" type="button" @click="lock">退出管理台</button>
      </p>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { apiUrl } from '@/services/apiClient.js'

const SECRET_KEY = 'fd_admin_secret'
const secret = ref('')
const unlocked = ref(false)
const email = ref('')
const busy = ref(false)
const err = ref('')
const msg = ref('')
const gateErr = ref('')
const hit = ref(null)
const accounts = ref([])
const issued = ref([])
const query = ref('')

const filteredAccounts = computed(() => {
  const s = query.value.trim().toLowerCase()
  if (!s) return accounts.value
  return accounts.value.filter((a) => {
    const email = String(a.email || '').toLowerCase()
    const name = String(a.displayName || '').toLowerCase()
    const phone = identityLabel(a.email).toLowerCase()
    return email.includes(s) || name.includes(s) || phone.includes(s)
  })
})

const planLabel = computed(() => {
  const ent = hit.value?.ent
  if (!ent || ent.plan !== 'pro') return 'Free'
  if (ent.proUntil == null) return 'Pro · 永久'
  const t = Number(ent.proUntil)
  if (!Number.isFinite(t) || t <= Date.now()) return 'Pro · 已过期'
  return `Pro · 至 ${new Date(t).toLocaleDateString('zh-CN')}`
})

const tokenLabel = computed(() => {
  const u = hit.value?.usage
  if (!u) return '0'
  const total = u.totalTokens || 0
  const p = u.promptTokens || 0
  const c = u.completionTokens || 0
  return `${total}（prompt ${p} · completion ${c}）`
})

onMounted(() => {
  const saved = sessionStorage.getItem(SECRET_KEY) || ''
  if (saved) {
    secret.value = saved
    unlocked.value = true
    loadList()
  }
})

function headers(withJson = true) {
  const h = { 'X-Admin-Secret': secret.value.trim() }
  if (withJson) h['Content-Type'] = 'application/json'
  return h
}

async function applyAccounts(rows) {
  accounts.value = Array.isArray(rows) ? rows : []
  if (!hit.value && accounts.value[0]?.email) {
    email.value = accounts.value[0].email
    await lookup()
  }
}

async function unlock() {
  gateErr.value = ''
  if (!secret.value.trim() || secret.value.trim().length < 16) {
    gateErr.value = '密钥至少 16 位'
    return
  }
  busy.value = true
  try {
    const res = await fetch(apiUrl('/api/admin'), { headers: headers(false) })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      gateErr.value = data.message || '密钥无效'
      return
    }
    sessionStorage.setItem(SECRET_KEY, secret.value.trim())
    unlocked.value = true
    await applyAccounts(data.accounts || [])
  } catch (e) {
    gateErr.value = e?.message || '无法连接'
  } finally {
    busy.value = false
  }
}

function lock() {
  sessionStorage.removeItem(SECRET_KEY)
  unlocked.value = false
  secret.value = ''
  hit.value = null
  accounts.value = []
}

async function api(action, body = {}) {
  busy.value = true
  err.value = ''
  msg.value = ''
  try {
    const res = await fetch(apiUrl('/api/admin'), {
      method: 'POST',
      headers: headers(true),
      body: JSON.stringify({ action, email: email.value.trim(), ...body }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      err.value = data.message || '操作失败'
      return null
    }
    msg.value = data.message || '完成'
    if (data.meta || data.ent || data.usage) {
      hit.value = {
        email: data.email || email.value.trim(),
        meta: data.meta || hit.value?.meta,
        ent: data.ent || hit.value?.ent,
        usage: data.usage || hit.value?.usage,
        vault: hit.value?.vault,
      }
    }
    return data
  } catch (e) {
    err.value = e?.message || '网络错误'
    return null
  } finally {
    busy.value = false
  }
}

async function lookup() {
  if (!email.value.trim()) {
    err.value = '请输入邮箱'
    return
  }
  const data = await api('lookup')
  if (data?.ok !== false && data?.meta) {
    hit.value = data
  }
}

async function loadList() {
  busy.value = true
  err.value = ''
  try {
    const res = await fetch(apiUrl('/api/admin'), { headers: headers(false) })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      err.value = data.message || '列表失败'
      return
    }
    await applyAccounts(data.accounts || [])
  } catch (e) {
    err.value = e?.message || '网络错误'
  } finally {
    busy.value = false
  }
}

function openRow(e) {
  email.value = e
  lookup()
}

async function grant(days) {
  const data = await api('grant_pro', { days })
  if (data?.ent) hit.value = { ...hit.value, ent: data.ent, meta: data.meta || hit.value.meta }
  loadList()
}

async function revoke() {
  const data = await api('revoke_pro')
  if (data?.ent) hit.value = { ...hit.value, ent: data.ent }
  loadList()
}

async function ban() {
  const reason = window.prompt('封禁原因（可选）', '') ?? ''
  const data = await api('ban', { reason })
  if (data?.meta) hit.value = { ...hit.value, meta: data.meta }
  loadList()
}

async function unban() {
  const data = await api('unban')
  if (data?.meta) hit.value = { ...hit.value, meta: data.meta }
  loadList()
}

function identityLabel(email) {
  const m = String(email || '').match(/^p(1\d{10})@sms\.findigest\.local$/i)
  if (m) return `手机 ${m[1]}`
  return email || '—'
}

function rowPlan(a) {
  if (!a || a.plan !== 'pro') return 'Free'
  if (a.proUntil == null) return 'Pro · 永久'
  const t = Number(a.proUntil)
  if (!Number.isFinite(t) || t <= Date.now()) return 'Pro · 已过期'
  return `Pro · 至 ${new Date(t).toLocaleDateString('zh-CN')}`
}

function fmtTime(t) {
  const n = Number(t)
  if (!Number.isFinite(n) || n <= 0) return '—'
  return new Date(n).toLocaleString('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

async function issue(days) {
  const data = await api('issue_code', { days, email: '' })
  if (data?.code) {
    issued.value.unshift({
      code: data.code,
      days: data.days,
      copied: false,
    })
  }
}

async function copyCode(code) {
  try {
    await navigator.clipboard.writeText(code)
    issued.value = issued.value.map((c) => (c.code === code ? { ...c, copied: true } : c))
    msg.value = '已复制兑换码'
  } catch {
    err.value = '复制失败，请手动选中'
  }
}
</script>

<style scoped>
.ad {
  --ink: #0b0d10;
  --panel: #12161c;
  --line: rgba(255, 255, 255, 0.1);
  --paper: #e8eef2;
  --mist: #8a97a3;
  --accent: #00e8c8;
  --danger: #ff6b6b;
  min-height: 100dvh;
  background: radial-gradient(ellipse 60% 40% at 80% 0%, rgba(0, 232, 200, 0.08), transparent 50%), var(--ink);
  color: var(--paper);
  padding: 28px clamp(16px, 4vw, 40px) 64px;
  font-family: 'Plus Jakarta Sans', 'PingFang SC', sans-serif;
}
.ad-top {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: 24px;
}
.ad-h1 {
  margin: 0 0 6px;
  font-size: 1.5rem;
  letter-spacing: -0.03em;
}
.ad-lead,
.ad-hint {
  margin: 0;
  color: var(--mist);
  font-size: 13px;
}
.ad-card {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 18px;
  margin-bottom: 16px;
  max-width: 920px;
}
.ad-card-wide {
  max-width: 1080px;
}
.ad-list-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}
.ad-list-head .ad-h2 {
  margin: 0;
}
.ad-search {
  flex: 1 1 200px;
  max-width: 280px;
}
.ad-empty {
  margin: 8px 0 0;
  color: var(--mist);
  font-size: 13px;
}
.ad-table-wrap {
  overflow-x: auto;
}
.ad-table tr {
  cursor: pointer;
}
.ad-table tbody tr:hover {
  background: rgba(255, 255, 255, 0.03);
}
.ad-table tbody tr.is-open {
  background: rgba(0, 232, 200, 0.08);
}
.ad-lab {
  display: block;
  font-size: 12px;
  color: var(--mist);
  margin-bottom: 8px;
}
.ad-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.ad-input {
  flex: 1 1 220px;
  min-height: 44px;
  border-radius: 8px;
  border: 1px solid var(--line);
  background: #0a0c0f;
  color: var(--paper);
  padding: 0 12px;
}
.ad-btn {
  min-height: 44px;
  padding: 0 14px;
  border: none;
  border-radius: 8px;
  background: var(--accent);
  color: #04120f;
  font-weight: 700;
  cursor: pointer;
}
.ad-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.ad-ghost {
  background: transparent;
  color: var(--paper);
  border: 1px solid var(--line);
}
.ad-danger {
  background: var(--danger);
  color: #1a0505;
}
.ad-h2 {
  margin: 0 0 12px;
  font-size: 1.1rem;
}
.ad-dl {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 10px 16px;
  margin: 0 0 16px;
}
.ad-dl dt {
  font-size: 11px;
  color: var(--mist);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.ad-dl dd {
  margin: 2px 0 0;
  font-size: 14px;
  word-break: break-all;
}
.ad-dl .bad {
  color: var(--danger);
}
.ad-dl .ok {
  color: var(--accent);
}
.ad-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.ad-err {
  color: var(--danger);
  font-size: 13px;
  margin: 10px 0 0;
}
.ad-ok {
  color: var(--accent);
  font-size: 13px;
  margin: 10px 0 0;
}
.ad-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.ad-table th,
.ad-table td {
  text-align: left;
  padding: 10px 8px;
  border-bottom: 1px solid var(--line);
}
.ad-link {
  background: none;
  border: none;
  color: var(--accent);
  cursor: pointer;
  padding: 0;
  font-weight: 600;
}
.ad-foot {
  margin-top: 20px;
}
.ad-codes {
  list-style: none;
  margin: 14px 0 0;
  padding: 0;
  display: grid;
  gap: 10px;
}
.ad-codes li {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: #0a0c0f;
}
.ad-code {
  font-family: ui-monospace, 'JetBrains Mono', monospace;
  font-size: 15px;
  letter-spacing: 0.04em;
  color: var(--accent);
}
.ad-code-meta {
  color: var(--mist);
  font-size: 12px;
}
</style>
