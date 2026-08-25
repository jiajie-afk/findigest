<template>
  <section class="ops-split">
    <div class="ops-card">
      <div class="ops-row">
        <input
          v-model="query"
          class="ops-input"
          type="search"
          placeholder="搜索邮箱 / 手机 / 昵称"
        />
        <button class="ops-btn ops-ghost" type="button" :disabled="busy" @click="$emit('refresh')">
          刷新
        </button>
      </div>
      <div class="ops-chips" role="tablist" aria-label="账号筛选">
        <button
          v-for="c in chips"
          :key="c.id"
          type="button"
          class="ops-chip"
          :class="{ 'is-on': filter === c.id }"
          @click="filter = c.id"
        >
          {{ c.label }}
        </button>
      </div>
      <p v-if="busy && !accounts.length" class="ops-empty">正在读取云端账号…</p>
      <p v-else-if="!accounts.length" class="ops-empty">还没有云端注册用户。</p>
      <div v-else class="ops-table-wrap">
        <table class="ops-table">
          <thead>
            <tr>
              <th>账号</th>
              <th>会员</th>
              <th>Token</th>
              <th>状态</th>
              <th>最近活跃</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="a in visible"
              :key="a.email"
              :class="{ 'is-on': selected === a.email }"
              @click="$emit('open-account', a.email)"
            >
              <td>
                {{ identityLabel(a.email) }}
                <span v-if="a.displayName" class="ops-muted"> · {{ a.displayName }}</span>
              </td>
              <td>{{ planLabel(a.plan, a.proUntil) }}</td>
              <td>{{ a.totalTokens || 0 }}</td>
              <td>{{ a.banned ? '封禁' : '正常' }}</td>
              <td>{{ fmtTime(a.lastSeenAt || a.createdAt) }}</td>
            </tr>
          </tbody>
        </table>
        <p v-if="accounts.length && !visible.length" class="ops-empty">没有匹配的账号</p>
      </div>
    </div>

    <div class="ops-card">
      <h2 class="ops-h2">账号详情</h2>
      <p v-if="!hit" class="ops-empty">从左侧点一行，或输入邮箱查询。</p>
      <template v-else>
        <dl class="ops-dl">
          <div>
            <dt>账号</dt>
            <dd>{{ identityLabel(hit.email) }}</dd>
          </div>
          <div>
            <dt>邮箱</dt>
            <dd>{{ hit.email }}</dd>
          </div>
          <div>
            <dt>状态</dt>
            <dd :class="hit.meta?.banned ? 'bad' : 'ok'">{{ hit.meta?.banned ? '已封禁' : '正常' }}</dd>
          </div>
          <div>
            <dt>会员</dt>
            <dd>{{ planLabel(hit.ent?.plan, hit.ent?.proUntil) }}</dd>
          </div>
          <div>
            <dt>Token</dt>
            <dd>{{ tokenLine }}</dd>
          </div>
          <div>
            <dt>调用</dt>
            <dd>{{ hit.usage?.calls || 0 }}</dd>
          </div>
          <div v-if="hit.usage?.lastModel">
            <dt>最近模型</dt>
            <dd>{{ hit.usage.lastModel }}</dd>
          </div>
          <div>
            <dt>注册</dt>
            <dd>{{ fmtTime(hit.meta?.createdAt) }}</dd>
          </div>
          <div>
            <dt>最近活跃</dt>
            <dd>{{ fmtTime(hit.meta?.lastSeenAt) }}</dd>
          </div>
          <div v-if="hit.meta?.banReason">
            <dt>封禁原因</dt>
            <dd>{{ hit.meta.banReason }}</dd>
          </div>
        </dl>

        <div class="ops-row">
          <button class="ops-btn" type="button" :disabled="busy" @click="$emit('grant', 30)">30 天</button>
          <button class="ops-btn" type="button" :disabled="busy" @click="$emit('grant', 90)">90 天</button>
          <button class="ops-btn" type="button" :disabled="busy" @click="$emit('grant', 365)">1 年</button>
          <button class="ops-btn ops-ghost" type="button" :disabled="busy" @click="askLifetime">永久</button>
          <button class="ops-btn ops-ghost" type="button" :disabled="busy" @click="$emit('revoke')">取消 Pro</button>
        </div>
        <div class="ops-row">
          <input v-model="reason" class="ops-input" placeholder="封禁原因（可选）" />
          <button
            v-if="!hit.meta?.banned"
            class="ops-btn ops-danger"
            type="button"
            :disabled="busy"
            @click="askBan"
          >
            封禁
          </button>
          <button v-else class="ops-btn" type="button" :disabled="busy" @click="$emit('unban')">解封</button>
        </div>
        <p class="ops-muted">不会读取该账号持仓或画像明文。</p>
      </template>
    </div>
  </section>
</template>

<script setup>
import { computed, ref } from 'vue'
import { fmtTime, identityLabel, planLabel } from '@/services/adminApi.js'

const props = defineProps({
  accounts: { type: Array, default: () => [] },
  hit: { type: Object, default: null },
  busy: { type: Boolean, default: false },
  selected: { type: String, default: '' },
})

const emit = defineEmits(['open-account', 'refresh', 'grant', 'revoke', 'ban', 'unban'])

const query = ref('')
const filter = ref('all')
const reason = ref('')

const chips = [
  { id: 'all', label: '全部' },
  { id: 'pro', label: '有效 Pro' },
  { id: 'expired', label: '过期' },
  { id: 'free', label: 'Free' },
  { id: 'banned', label: '封禁' },
]

const visible = computed(() => {
  const now = Date.now()
  const s = query.value.trim().toLowerCase()
  return props.accounts.filter((a) => {
    if (filter.value === 'banned' && !a.banned) return false
    if (filter.value === 'free' && a.plan === 'pro') return false
    if (filter.value === 'pro') {
      if (a.plan !== 'pro') return false
      if (a.proUntil != null && Number(a.proUntil) <= now) return false
    }
    if (filter.value === 'expired') {
      if (a.plan !== 'pro' || a.proUntil == null || Number(a.proUntil) > now) return false
    }
    if (!s) return true
    const email = String(a.email || '').toLowerCase()
    const name = String(a.displayName || '').toLowerCase()
    const phone = identityLabel(a.email).toLowerCase()
    return email.includes(s) || name.includes(s) || phone.includes(s)
  })
})

const tokenLine = computed(() => {
  const u = props.hit?.usage
  if (!u) return '0'
  return `${u.totalTokens || 0}（prompt ${u.promptTokens || 0} · completion ${u.completionTokens || 0}）`
})

function askLifetime() {
  if (window.confirm(`确认给 ${identityLabel(props.hit?.email)} 开通永久 Pro？`)) {
    emit('grant', null)
  }
}

function askBan() {
  if (window.confirm(`确认封禁 ${identityLabel(props.hit?.email)}？`)) {
    emit('ban', reason.value)
  }
}
</script>
