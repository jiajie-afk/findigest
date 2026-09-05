<template>
  <div class="page">
    <header class="page-head page-head--settings">
      <h1 class="pt">设置</h1>
      <p class="pt-sub">
        修改后自动保存
        <span v-if="autoSavedHint" class="auto-hint">· {{ autoSavedHint }}</span>
      </p>
    </header>

    <div class="card" style="padding: 22px">
      <h3 class="sec">私人账号</h3>
      <p class="hint">
        <template v-if="auth.isGuest">
          当前：<strong>未登录</strong>（本机专业台）· 登录可选，用来同步云端
        </template>
        <template v-else>
          当前：<strong>{{ auth.email || '已登录' }}</strong>
          · 持仓 / 事件 / 画像按账号隔离
        </template>
      </p>
      <div class="account-actions">
        <template v-if="auth.isGuest">
          <router-link class="btn bp sm" :to="{ path: '/auth', query: { redirect: '/settings' } }">登录</router-link>
        </template>
        <template v-else>
          <button type="button" class="btn bs sm" :disabled="auth.busy" @click="syncCloud">同步到云端</button>
          <button type="button" class="btn bs sm" @click="doLogout">退出登录</button>
        </template>
      </div>
      <div v-if="auth.isLoggedIn && !auth.isGuest" class="pw-change">
        <h4 class="sec-sub">修改密码</h4>
        <p class="hint">记得旧密码时可无损改密（本机与云端保险箱会用新密码重新加密）。</p>
        <label class="fld">
          <span>当前密码</span>
          <input v-model="pwOld" type="password" autocomplete="current-password" />
        </label>
        <label class="fld">
          <span>新密码</span>
          <input v-model="pwNew" type="password" autocomplete="new-password" placeholder="至少 8 位，含字母和数字" />
        </label>
        <p v-if="pwNew && !pwStrength.ok" class="hint">{{ pwStrength.message }}</p>
        <label class="fld">
          <span>确认新密码</span>
          <input v-model="pwNew2" type="password" autocomplete="new-password" />
        </label>
        <button type="button" class="btn bp sm" :disabled="auth.busy || !pwOld || !pwNew || !pwStrength.ok" @click="doChangePassword">
          保存新密码
        </button>
        <p class="hint" style="margin-top: 8px">
          忘记旧密码？
          <router-link :to="{ path: '/auth', query: { mode: 'reset' } }">验证码重置（会清空云端数据）</router-link>
        </p>
      </div>
      <p class="hint" style="margin-top: 10px">
        {{
          auth.cloudOk
            ? '云端记忆已连接：换电脑用同一邮箱密码即可找回。本页可随时「同步到云端」。'
            : '本机已隔离。登录后生成简报会自动尝试同步；也可点「同步到云端」。需配置 BLOB_READ_WRITE_TOKEN。'
        }}
      </p>
      <p class="hint" style="margin-top: 8px">
        会话硬化：明文密码不写进长期存储；本页会话内用内存解锁加密同步（刷新后需再输一次密码）。配置
        <code>VAULT_SESSION_SECRET</code> 后同步可写 httpOnly
        <code>fd_sess</code>。<router-link to="/limits">已知局限 →</router-link>
      </p>
    </div>

    <div class="card" style="padding: 22px">
      <h3 class="sec">产品版本</h3>
      <p class="hint">
        当前：<strong>{{ user.editionLabel }}版</strong>
        ·
        {{
          billing.localFreePro
            ? '专业台可直接进入，点「Pro 专业台」即可。登录不是必须的。'
            : '基础版免费；开通 Pro 后导航更密，今日简报可 AI 增强。'
        }}
      </p>
      <div class="edition-row">
        <button
          type="button"
          class="btn sm"
          :class="user.isBasicEdition ? 'bp' : 'bs'"
          @click="user.setProductEdition('basic')"
        >
          基础版（免费）
        </button>
        <button
          type="button"
          class="btn sm"
          :class="billing.canUseProHud && user.isProEdition ? 'bp' : 'bs'"
          @click="onPickProEdition"
        >
          {{ billing.isBillingPro || billing.localFreePro ? 'Pro 专业台' : '开通 Pro' }}
        </button>
      </div>
      <p v-if="user.isProEdition" class="hint" style="margin-top: 10px">
        Pro 台可补全画像，校准会更准。不挡今日。
      </p>
    </div>

    <div class="card style-panel" style="padding: 22px">
      <h3 class="sec">设计风格</h3>
      <p class="hint">当前：<strong>{{ currentLabel }}</strong> · 点击下方卡片即可切换全站外观</p>

      <div class="style-row" role="radiogroup" aria-label="设计风格">
        <button
          type="button"
          class="style-card"
          role="radio"
          :aria-checked="user.designStyle === 'luxury'"
          :class="{ on: user.designStyle === 'luxury' }"
          @click="user.setDesignStyle('luxury')"
        >
          <div class="style-preview luxury-preview" aria-hidden="true">
            <span class="pv-brand lux">FinDigest</span>
            <span class="pv-bar lux-bar" />
            <span class="pv-card lux-card" />
          </div>
          <strong>基础密度</strong>
          <span>阅读档 · 今日一屏</span>
          <em v-if="user.designStyle === 'luxury'" class="style-on">使用中</em>
        </button>

        <button
          type="button"
          class="style-card"
          role="radio"
          :aria-checked="user.designStyle === 'prodesk'"
          :class="{ on: user.designStyle === 'prodesk' }"
          @click="onPickProdesk"
        >
          <div class="style-preview prodesk-preview" aria-hidden="true">
            <span class="pv-brand prodesk">FinDigest</span>
            <span class="pv-bar prodesk-bar" />
            <span class="pv-card prodesk-card" />
          </div>
          <strong>Pro 密度</strong>
          <span>同台更高密度 · 估值仓位同屏</span>
          <em v-if="user.designStyle === 'prodesk'" class="style-on">使用中</em>
        </button>

        <button
          type="button"
          class="style-card"
          role="radio"
          :aria-checked="user.designStyle === 'soft'"
          :class="{ on: user.designStyle === 'soft' }"
          @click="user.setDesignStyle('soft')"
        >
          <div class="style-preview soft-preview" aria-hidden="true">
            <span class="pv-brand">FinDigest</span>
            <span class="pv-bar" />
            <span class="pv-card" />
          </div>
          <strong>浅色</strong>
          <span>浅底 · 适合亮环境</span>
          <em v-if="user.designStyle === 'soft'" class="style-on">使用中</em>
        </button>

        <button
          type="button"
          class="style-card"
          role="radio"
          :aria-checked="user.designStyle === 'journal'"
          :class="{ on: user.designStyle === 'journal' }"
          @click="user.setDesignStyle('journal')"
        >
          <div class="style-preview journal-preview" aria-hidden="true">
            <span class="pv-mast">FinDigest</span>
            <span class="pv-rule" />
            <span class="pv-cols" />
          </div>
          <strong>报纸</strong>
          <span>衬线报头 · 阅读纸色</span>
          <em v-if="user.designStyle === 'journal'" class="style-on">使用中</em>
        </button>
      </div>
    </div>

    <div v-if="user.designStyle === 'soft'" class="card" style="padding: 22px">
      <h3 class="sec">Soft 主题色</h3>
      <div class="theme-row">
        <button
          v-for="t in themes"
          :key="t.id"
          class="theme-btn"
          :class="{ on: user.uiTheme === t.id }"
          type="button"
          @click="user.setTheme(t.id)"
        >
          <span class="swatch" :style="{ background: t.swatch }" />
          {{ t.label }}
        </button>
      </div>
    </div>

    <div id="profile-scenario" class="card" style="padding: 22px">
      <h3 class="sec">投资画像</h3>
      <div class="profile-completeness">
        <div class="pc-ring" :aria-label="'完成度 ' + completeness + '%'">
          <svg viewBox="0 0 36 36">
            <path
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              fill="none"
              stroke="var(--sep)"
              stroke-width="3"
            />
            <path
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              fill="none"
              stroke="var(--accent)"
              stroke-width="3"
              :stroke-dasharray="`${completeness}, 100`"
            />
          </svg>
          <span>{{ completeness }}%</span>
        </div>
        <div class="pc-detail">
          <p>
            私人定制 {{ scenarioPct }} · 行业偏好 {{ checks.industry ? '✓' : '○' }} · 风险设定
            {{ checks.risk ? '✓' : '○' }}
          </p>
          <p class="pc-hint">{{ completenessHint }}</p>
        </div>
      </div>
      <ProfileScenario :mode="scenarioFocusMode" @done="onScenarioDone" />
    </div>

    <div class="card" style="padding: 22px">
      <h3 class="sec">基础信息 & 行业偏好</h3>
      <div class="fld"><label>股龄（年）</label><input v-model.number="basics.investExperience" type="number" min="0" max="50" /></div>
      <div class="fld">
        <label>经历过几次熊市</label>
        <select v-model="basics.bearMarketExperience">
          <option :value="0">0</option>
          <option :value="1">1</option>
          <option :value="2">2</option>
          <option :value="3">3+</option>
        </select>
      </div>
      <div class="fld">
        <label>资金规模</label>
        <select v-model="basics.totalCapital">
          <option value="">未填</option>
          <option value="<10万">&lt;10万</option>
          <option value="10-50万">10-50万</option>
          <option value="50-200万">50-200万</option>
          <option value=">200万">&gt;200万</option>
        </select>
      </div>
      <div class="fld">
        <label>资金来源</label>
        <select v-model="basics.incomeSource">
          <option value="">未填</option>
          <option>工资</option>
          <option>经营</option>
          <option>继承</option>
          <option>其他</option>
        </select>
      </div>
      <div class="fld">
        <label>关注行业（最多 5）</label>
        <input v-model="industrySearch" class="ind-search" type="search" placeholder="搜索或自定义行业…" />
        <div class="chip-grid">
          <button
            v-for="ind in filteredIndustries"
            :key="'p-' + ind"
            type="button"
            class="chip"
            :class="{ on: preferred.includes(ind) }"
            @click="togglePreferred(ind)"
          >
            {{ ind }}
          </button>
          <button
            v-if="canAddCustom"
            type="button"
            class="chip add"
            @click="addCustomIndustry(industrySearch.trim())"
          >
            + 自定义「{{ industrySearch.trim() }}」
          </button>
        </div>
      </div>
      <div class="fld">
        <label>回避行业</label>
        <div class="chip-grid">
          <button
            v-for="ind in filteredIndustries"
            :key="'a-' + ind"
            type="button"
            class="chip"
            :class="{ on: avoid.includes(ind) }"
            @click="toggleAvoid(ind)"
          >
            {{ ind }}
          </button>
        </div>
      </div>
    </div>

    <div class="card" style="padding: 22px">
      <h3 class="sec">个人信息</h3>
      <div class="fld"><label>昵称</label><input v-model="form.nickname" /></div>
      <div class="fld"><label>邮箱</label><input v-model="form.email" type="email" /></div>
      <div class="fld"><label>职业</label><input v-model="form.career" /></div>
      <div class="fld"><label>年龄</label><input v-model.number="form.age" type="number" /></div>
      <div class="fld">
        <label>风险偏好 / 策略</label>
        <select v-model="form.strategy">
          <option>保守型</option>
          <option>稳健型</option>
          <option>平衡型</option>
          <option>进取型</option>
          <option>激进型</option>
        </select>
      </div>
    </div>

    <div class="card" style="padding: 22px">
      <h3 class="sec">AI 增强日报</h3>
      <p class="hint">默认本地可解释引擎；开启后由 LLM 基于多维数据独立研判。密钥仅存本机。</p>
      <div class="fld check">
        <input id="ai-on" v-model="aiForm.enabled" type="checkbox" />
        <label for="ai-on">启用 LLM 增强日报</label>
      </div>
      <div v-if="aiForm.enabled" class="ai-tier">
        <label class="ai-prov-label">选择 AI 提供商</label>
        <div class="prov-row" role="radiogroup">
          <button
            v-for="p in providers"
            :key="p.id"
            type="button"
            class="prov"
            role="radio"
            :aria-checked="aiProvider === p.id"
            :class="{ on: aiProvider === p.id }"
            @click="selectProvider(p.id)"
          >
            <strong>{{ p.label }}</strong>
            <span>{{ p.hint }}</span>
          </button>
        </div>
        <div class="fld"><label>API Key</label><input v-model="aiForm.apiKey" type="password" autocomplete="off" placeholder="sk-…" /></div>
        <template v-if="aiProvider === 'custom'">
          <div class="fld"><label>Base URL</label><input v-model="aiForm.baseUrl" placeholder="https://api.example.com/v1" /></div>
          <div class="fld"><label>Model</label><input v-model="aiForm.model" placeholder="model-id" /></div>
        </template>
        <p v-else class="ai-meta">{{ aiForm.baseUrl }} · {{ aiForm.model }}</p>
        <button class="btn bs" type="button" :disabled="testingAi" @click="testAi">
          {{ testingAi ? '测试中…' : '测试连接' }}
        </button>
      </div>
    </div>

    <div class="card" style="padding: 22px">
      <h3 class="sec">回访提醒</h3>
      <p class="hint" style="margin-top: 0">到点仍未生成今日简报时，站内会提示；也可开浏览器通知或 Server酱推到微信。</p>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px">
        <div class="fld"><label>小时</label><input v-model.number="form.report_hour" type="number" min="0" max="23" /></div>
        <div class="fld"><label>分钟</label><input v-model.number="form.report_minute" type="number" min="0" max="59" /></div>
      </div>
      <div class="fld check">
        <input id="pe" v-model="form.push_email" type="checkbox" />
        <label for="pe">邮件推送（预留）</label>
      </div>
      <div class="fld check">
        <input id="pb" v-model="form.push_browser" type="checkbox" />
        <label for="pb">浏览器通知</label>
      </div>
      <div class="fld check">
        <input id="pw" v-model="form.push_wechat" type="checkbox" />
        <label for="pw">微信提醒（Server酱）</label>
      </div>
      <div v-if="form.push_wechat" class="fld">
        <label>Server酱 SendKey</label>
        <input v-model="form.serverchan_key" type="password" autocomplete="off" placeholder="SCT…" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, reactive, ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '@/store/user'
import { useAuthStore } from '@/store/auth'
import { useBillingStore } from '@/store/billing'
import ProfileScenario from '@/components/settings/ProfileScenario.vue'
import { SCENARIO_QUESTION_COUNT, ESSENTIAL_QUESTION_COUNT, ESSENTIAL_QUESTION_IDS, essentialsDone } from '@/services/profiling.js'
import { validatePasswordStrength } from '@/services/crypto.js'

const route = useRoute()
const router = useRouter()
const user = useUserStore()
const auth = useAuthStore()
const billing = useBillingStore()
billing.hydrate()

/** Edition gates questionnaire mode; focus query only scrolls to #profile-scenario */
const isProProfile = computed(() => !!billing.canUseProHud)

const scenarioFocusMode = computed(() => (isProProfile.value ? 'full' : 'essentials'))

const essentialsComplete = computed(
  () =>
    !!user.profile.essentialsDone ||
    essentialsDone(user.profile.scenarioAnswers || {}),
)

const completenessHint = computed(() => {
  if (!isProProfile.value) {
    if (!essentialsComplete.value) return '可选。不填也能生成今日简报'
    return '基础画像已填'
  }
  if (!essentialsComplete.value) return '可选。不填也能生成今日简报'
  if (!user.profile.onboardingDone) return '可随时补全其余题，不挡今日'
  return '画像已完成，简报会按你的约束裁'
})
const form = reactive({
  nickname: user.nickname,
  email: user.email,
  career: user.career,
  age: user.age,
  strategy: user.strategy || user.risk || '平衡型',
  report_hour: user.report_hour,
  report_minute: user.report_minute,
  push_email: user.push_email,
  push_wechat: user.push_wechat,
  push_browser: user.push_browser,
  serverchan_key: user.serverchan_key,
})

const basics = reactive({
  investExperience: user.profile.investExperience,
  bearMarketExperience: user.profile.bearMarketExperience ?? 0,
  totalCapital: user.profile.totalCapital || '',
  incomeSource: user.profile.incomeSource || '',
})

const preferred = ref([...(user.profile.preferredIndustries || [])])
const avoid = ref([...(user.profile.avoidIndustries || [])])
const industrySearch = ref('')
const autoSavedHint = ref('')
const testingAi = ref(false)
const pwOld = ref('')
const pwNew = ref('')
const pwNew2 = ref('')
const pwStrength = computed(() => validatePasswordStrength(pwNew.value))
let saveTimer = null
let hintTimer = null
let ready = false

const providers = [
  { id: 'deepseek', label: 'DeepSeek', hint: '推荐 · 性价比高', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
  { id: 'openai', label: 'OpenAI', hint: 'ChatGPT 兼容', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  { id: 'custom', label: '自定义', hint: '兼容 OpenAI 协议', baseUrl: '', model: '' },
]

function detectProvider(cfg) {
  const url = (cfg.baseUrl || '').replace(/\/$/, '')
  if (url.includes('deepseek')) return 'deepseek'
  if (url.includes('openai.com')) return 'openai'
  if (cfg.baseUrl || cfg.model) return 'custom'
  return 'deepseek'
}

const aiForm = reactive({
  enabled: !!user.aiConfig.enabled,
  baseUrl: user.aiConfig.baseUrl || providers[0].baseUrl,
  apiKey: user.aiConfig.apiKey,
  model: user.aiConfig.model || providers[0].model,
})
const aiProvider = ref(detectProvider(user.aiConfig))

const industryOptions = [
  '高端白酒',
  '新能源车企',
  '动力电池',
  '芯片设计',
  '半导体设备',
  '化学创新药',
  '医药',
  'CXO服务',
  '军工',
  '地产',
  '电商',
  '国有大行',
  '寿险',
  '白电',
  '组件',
  '光伏',
  '游戏',
  '工程机械',
  '消费电子',
  '新能源汽车产业链',
  '互联网',
  '云计算',
  '人工智能',
  '机器人',
  '有色金属',
  '煤炭',
  '石油石化',
  '电力',
  '银行',
  '券商',
  '保险',
  '食品饮料',
  '农业',
  '航运',
]

const customIndustries = ref([])
const allIndustries = computed(() => {
  const set = new Set([...industryOptions, ...customIndustries.value, ...preferred.value, ...avoid.value])
  return [...set]
})

const filteredIndustries = computed(() => {
  const q = industrySearch.value.trim()
  if (!q) return allIndustries.value
  return allIndustries.value.filter((ind) => ind.includes(q))
})

const canAddCustom = computed(() => {
  const q = industrySearch.value.trim()
  if (!q) return false
  return !allIndustries.value.some((ind) => ind === q)
})

const currentLabel = computed(() => {
  if (user.designStyle === 'prodesk') return 'Pro 密度'
  if (user.designStyle === 'luxury') return '基础密度'
  if (user.designStyle === 'journal') return '报纸'
  return '浅色'
})

const themes = [
  { id: 'dark', label: 'Ink', swatch: 'linear-gradient(135deg,#0a0b0c,#c5a059)' },
  { id: 'white', label: 'Paper', swatch: 'linear-gradient(135deg,#f7f9fa,#0f7a6e)' },
  { id: 'mist', label: 'Mist', swatch: 'linear-gradient(135deg,#e8eef2,#0f7a6e)' },
  { id: 'sand', label: 'Soft', swatch: 'linear-gradient(135deg,#eef0f2,#0f7a6e)' },
]

const checks = computed(() => ({
  scenario: !!user.profile.onboardingDone,
  industry: (preferred.value.length || 0) > 0,
  risk: !!(form.strategy || user.profile.risk),
  basics: !!(basics.investExperience || basics.totalCapital || basics.incomeSource),
  identity: !!(form.age || form.career || (form.nickname && form.nickname !== '投资者')),
  ai: !!(aiForm.enabled && aiForm.apiKey),
}))

const scenarioAnswered = computed(
  () => user.profile.scenarioProgress || Object.keys(user.profile.scenarioAnswers || {}).length || 0,
)
const answeredEssentials = computed(() => {
  const a = user.profile.scenarioAnswers || {}
  return ESSENTIAL_QUESTION_IDS.filter((id) => !!a[id]).length
})
const scenarioPct = computed(() =>
  isProProfile.value
    ? `${scenarioAnswered.value}/${SCENARIO_QUESTION_COUNT}`
    : `${answeredEssentials.value}/${ESSENTIAL_QUESTION_COUNT}`,
)

const completeness = computed(() => {
  let score = 0
  // Basic weight 11; Pro weight 88 — max 45 pts for questionnaire
  if (isProProfile.value) {
    score += Math.round(
      (Math.min(scenarioAnswered.value, SCENARIO_QUESTION_COUNT) / SCENARIO_QUESTION_COUNT) * 45,
    )
  } else {
    score += Math.round(
      (Math.min(answeredEssentials.value, ESSENTIAL_QUESTION_COUNT) / ESSENTIAL_QUESTION_COUNT) * 45,
    )
  }
  if (checks.value.industry) score += 15
  if (checks.value.risk) score += 10
  if (form.age || form.career) score += 8
  if (basics.investExperience || basics.bearMarketExperience) score += 8
  if (basics.totalCapital) score += 8
  if (checks.value.ai) score += 6
  return Math.min(100, score)
})

function selectProvider(id) {
  aiProvider.value = id
  const p = providers.find((x) => x.id === id)
  if (!p || id === 'custom') return
  aiForm.baseUrl = p.baseUrl
  aiForm.model = p.model
}

function togglePreferred(ind) {
  const i = preferred.value.indexOf(ind)
  if (i >= 0) preferred.value.splice(i, 1)
  else if (preferred.value.length < 5) preferred.value.push(ind)
  else user.toast('最多选择 5 个关注行业')
}

function toggleAvoid(ind) {
  const i = avoid.value.indexOf(ind)
  if (i >= 0) avoid.value.splice(i, 1)
  else avoid.value.push(ind)
}

function addCustomIndustry(name) {
  if (!name) return
  if (!customIndustries.value.includes(name)) customIndustries.value.push(name)
  togglePreferred(name)
  industrySearch.value = ''
}

function onScenarioDone() {
  user.toast('私人定制完成 — 正在进入管家')
  markAutoSaved()
  router.push('/app')
}

async function syncCloud() {
  let result = await auth.syncNow()
  if (result.message === 'need_password') {
    const pw = window.prompt('为加密同步，请再输入一次账号密码（仅本页会话使用，不写入长期存储）')
    if (!pw) {
      user.toast('已取消同步')
      return
    }
    result = await auth.syncNow(pw)
  }
  user.toast(result.message || (result.ok ? '已同步到云端' : '同步失败'))
}

async function doChangePassword() {
  if (pwNew.value !== pwNew2.value) {
    user.toast('两次新密码不一致')
    return
  }
  if (!pwStrength.value.ok) {
    user.toast(pwStrength.value.message || '新密码太弱')
    return
  }
  const ok = await auth.changePassword({ oldPassword: pwOld.value, newPassword: pwNew.value })
  if (ok) {
    pwOld.value = ''
    pwNew.value = ''
    pwNew2.value = ''
    user.toast('密码已更新')
  } else {
    user.toast(auth.lastError || '改密失败')
  }
}

function doLogout() {
  auth.logout()
  router.push('/app')
}

function onPickProEdition() {
  if (billing.isBillingPro || billing.localFreePro) {
    user.setProductEdition('pro')
    return
  }
  user.toast('当前账号还不是会员，请先开通')
  router.push({ path: '/pricing', query: { redirect: '/settings' } })
}

function onPickProdesk() {
  if (!billing.canUseProdeskStyle) {
    if (billing.localFreePro) {
      user.setProductEdition('pro', { silent: true })
      user.setDesignStyle('prodesk')
      return
    }
    router.push({ path: '/pricing', query: { redirect: '/settings' } })
    return
  }
  user.setProductEdition('pro', { silent: true })
  user.setDesignStyle('prodesk')
}

function markAutoSaved() {
  autoSavedHint.value = '已自动保存'
  clearTimeout(hintTimer)
  hintTimer = setTimeout(() => {
    autoSavedHint.value = ''
  }, 2000)
}

function persistAll() {
  user.saveSettings({ ...form, risk: form.strategy, designStyle: user.designStyle }, { silent: true })
  user.saveProfile(
    {
      ...user.profile,
      ...basics,
      preferredIndustries: preferred.value,
      avoidIndustries: avoid.value,
      age: form.age,
      career: form.career,
    },
    { silent: true },
  )
  user.saveAiConfig({ ...aiForm }, { silent: true })
  markAutoSaved()
}

function scheduleSave() {
  if (!ready) return
  clearTimeout(saveTimer)
  saveTimer = setTimeout(persistAll, 500)
}

async function testAi() {
  if (!aiForm.apiKey) {
    user.toast('请先填写 API Key')
    return
  }
  testingAi.value = true
  try {
    const url = `${String(aiForm.baseUrl || '').replace(/\/$/, '')}/models`
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${aiForm.apiKey}` },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    user.toast('连接成功')
  } catch (e) {
    user.toast(`连接失败：${e.message || e}`)
  } finally {
    testingAi.value = false
  }
}

watch([form, basics, preferred, avoid, aiForm, aiProvider], scheduleSave, { deep: true })

queueMicrotask(() => {
  ready = true
})

onMounted(() => {
  if (route.query.focus === 'essentials' || route.hash === '#profile-scenario') {
    nextTick(() => {
      document.getElementById('profile-scenario')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }
})

onBeforeUnmount(() => {
  clearTimeout(saveTimer)
  clearTimeout(hintTimer)
  if (ready) persistAll()
})
</script>

<style scoped>
.auto-hint {
  color: var(--accent);
  font-weight: 600;
}
.sec {
  font-size: 15px;
  font-weight: 700;
  letter-spacing: -0.02em;
  margin-bottom: 12px;
}
.hint {
  font-size: 13px;
  color: var(--ts);
  margin-bottom: 14px;
}
.account-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 4px;
}
.pw-change {
  margin-top: 18px;
  padding-top: 16px;
  border-top: 1px solid var(--sep);
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.sec-sub {
  margin: 0;
  font-size: 13px;
  font-weight: 700;
}
.pw-change .fld {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.pw-change .fld span {
  font-size: 12px;
  color: var(--ts);
}
.pw-change .fld input {
  height: 40px;
  padding: 0 12px;
  border: 1px solid var(--sep);
  border-radius: var(--rb, 6px);
  background: var(--bg);
  color: var(--tp);
  font: inherit;
}
.hint strong {
  color: var(--tp);
}
.profile-completeness {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 16px;
  padding: 12px 14px;
  border: 1px dashed color-mix(in srgb, var(--accent) 28%, transparent);
  border-radius: var(--rb);
  background: var(--accent-soft);
}
.pc-ring {
  position: relative;
  width: 52px;
  height: 52px;
  flex-shrink: 0;
}
.pc-ring svg {
  width: 52px;
  height: 52px;
  transform: rotate(-90deg);
}
.pc-ring span {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  font-size: 12px;
  font-weight: 700;
  color: var(--accent);
}
.pc-detail p {
  margin: 0;
  font-size: 13px;
  color: var(--tp);
}
.pc-hint {
  margin-top: 4px !important;
  font-size: 12px !important;
  color: var(--tt) !important;
}
.ind-search {
  width: 100%;
  margin-bottom: 10px;
}
.style-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}
.style-card {
  position: relative;
  text-align: left;
  padding: 14px;
  border: 1.5px solid var(--sep);
  border-radius: var(--rb);
  background: var(--surface);
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 6px;
  transition: border-color 0.2s, background 0.2s;
}
.style-card strong {
  font-size: 14px;
  letter-spacing: -0.02em;
  margin-top: 4px;
}
.style-card > span {
  font-size: 12px;
  color: var(--ts);
  line-height: 1.4;
  font-style: normal;
}
.style-card.on {
  border-color: var(--accent);
  background: var(--accent-soft);
}
.style-on {
  position: absolute;
  top: 12px;
  right: 12px;
  font-size: 11px;
  font-style: normal;
  font-weight: 700;
  color: var(--accent);
}
.style-preview {
  height: 72px;
  border: 1px solid var(--sep);
  background: #f4f7f8;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 8px;
  padding: 12px;
  overflow: hidden;
}
.soft-preview {
  border-radius: 10px;
  background: linear-gradient(180deg, #eef4f6, #e4eef1);
}
.soft-preview .pv-brand {
  font-size: 12px;
  font-weight: 700;
  color: #1a9b8e;
}
.soft-preview .pv-bar {
  height: 6px;
  width: 55%;
  border-radius: 999px;
  background: rgba(26, 155, 142, 0.35);
}
.soft-preview .pv-card {
  height: 18px;
  border-radius: 8px;
  background: #fff;
  border: 1px solid #dde7ec;
}
.journal-preview {
  background: #f4f1e8;
  border-color: #1a1814;
}
.journal-preview .pv-mast {
  font-family: Georgia, 'Times New Roman', serif;
  font-size: 16px;
  font-weight: 700;
  text-align: center;
  color: #121212;
  letter-spacing: -0.02em;
}
.journal-preview .pv-rule {
  height: 3px;
  border-top: 1px solid #121212;
  border-bottom: 1px solid #121212;
}
.journal-preview .pv-cols {
  height: 14px;
  background: repeating-linear-gradient(
    90deg,
    #e8e8e4 0 28%,
    transparent 28% 32%,
    #e8e8e4 32% 60%,
    transparent 60% 64%,
    #e8e8e4 64% 100%
  );
}
.luxury-preview {
  background: #0a0b0c;
  border-color: rgba(197, 160, 89, 0.4);
  border-radius: 2px;
}
.luxury-preview .pv-brand.lux {
  font-size: 12px;
  font-weight: 600;
  color: #ece6d8;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  font-family: Georgia, serif;
}
.luxury-preview .lux-bar {
  height: 5px;
  width: 48%;
  border-radius: 2px;
  background: #c5a059;
}
.luxury-preview .lux-card {
  height: 16px;
  border-radius: 2px;
  background: rgba(197, 160, 89, 0.14);
  border: 1px solid rgba(197, 160, 89, 0.35);
}
.edition-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 4px;
}
.prodesk-preview {
  background: #050607;
  border-color: rgba(0, 232, 200, 0.4);
  border-radius: 2px;
}
.prodesk-preview .pv-brand.prodesk {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #e8f0f2;
  font-family: ui-monospace, monospace;
}
.prodesk-preview .prodesk-bar {
  height: 4px;
  width: 52%;
  background: #00e8c8;
}
.prodesk-preview .prodesk-card {
  height: 14px;
  background: rgba(0, 232, 200, 0.12);
  border: 1px solid rgba(0, 232, 200, 0.35);
}
.check {
  display: flex;
  align-items: center;
  gap: 10px;
}
.check label {
  margin: 0;
  font-size: 14px;
  font-weight: 500;
}
.ai-tier {
  margin-top: 8px;
}
.ai-prov-label {
  display: block;
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 8px;
  color: var(--ts);
}
.prov-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-bottom: 14px;
}
.prov {
  text-align: left;
  padding: 10px 12px;
  border: 1px solid var(--sep);
  border-radius: var(--rb);
  background: var(--surface);
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.prov strong {
  font-size: 13px;
}
.prov span {
  font-size: 11px;
  color: var(--tt);
}
.prov.on {
  border-color: var(--accent);
  background: var(--accent-soft);
}
.ai-meta {
  font-size: 12px;
  color: var(--tt);
  margin: 0 0 12px;
}
.chip-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.chip {
  height: 32px;
  padding: 0 12px;
  border-radius: var(--rb);
  border: 1px solid var(--sep);
  background: var(--surface);
  color: var(--ts);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}
.chip.on {
  border-color: var(--accent);
  background: var(--accent-soft);
  color: var(--accent);
}
.chip.add {
  border-style: dashed;
  color: var(--accent);
}
.theme-row {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}
.theme-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 38px;
  padding: 0 14px;
  border-radius: var(--rb);
  border: 1px solid var(--sep);
  background: var(--surface);
  color: var(--tp);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}
.theme-btn.on {
  border-color: var(--accent);
  background: var(--accent-soft);
  color: var(--accent);
}
.swatch {
  width: 16px;
  height: 16px;
  border-radius: 5px;
  border: 1px solid rgba(0, 0, 0, 0.06);
}
@media (max-width: 900px) {
  .style-row {
    grid-template-columns: 1fr;
  }
  .chip {
    min-height: 44px;
    height: 44px;
    padding: 0 14px;
    font-size: 13px;
  }
  .theme-btn {
    min-height: 44px;
    height: 44px;
  }
  .pw-change .fld input,
  .fld input,
  .fld select {
    min-height: 44px;
  }
}
@media (max-width: 640px) {
  .style-row,
  .prov-row {
    grid-template-columns: 1fr;
  }
}
</style>
