<template>
  <div class="ld" data-landing>
    <header class="ld-top">
      <a class="ld-mark" href="#top">FinDigest</a>
      <nav class="ld-nav" aria-label="落地导航">
        <a href="#editions">版本对比</a>
        <a href="#paths">路径</a>
        <a href="#caps">能力</a>
        <a href="#frame">工作台</a>
      </nav>
      <div class="ld-top-actions">
        <a class="ld-top-pro" href="/pricing" @click="onNavClick($event, '/pricing')">开通 Pro</a>
        <a class="ld-top-cta" :href="enterHref" @click="onNavClick($event, enterHref)">进入</a>
      </div>
    </header>

    <div class="ld-ticker">
      <template v-for="(t, i) in ticks" :key="t.id">
        <span v-if="i" class="ld-tick-d" aria-hidden="true">◆</span>
        <a class="ld-tick-btn" :href="'#story-' + t.id">{{ t.label }}</a>
      </template>
      <span class="ld-tick-d" aria-hidden="true">◆</span>
      <span>私人定制</span>
    </div>

    <LandingHero :enter-href="enterHref" />
    <LandingEditions :product-stats="productStats" :enter-href="enterHref" />
    <LandingProdesk />
    <LandingPaths />
    <LandingCaps :cap-cards="capCards" />
    <LandingFrame :modules-basic="modulesBasic" :modules-pro="modulesPro" :enter-href="enterHref" />
    <LandingClose :enter-href="enterHref" />

    <footer class="ld-foot">
      <span>© {{ year }} FinDigest</span>
      <span>仅供研究参考，不构成投资建议</span>
    </footer>

    <LandingStory :active="active" :enter-href="enterHref" @close="closeStory" />
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { PRODUCT_STATS, COPY } from '@/data/productStats.js'
import { onNavClick } from '@/utils/navHref.js'
import LandingHero from '@/components/landing/LandingHero.vue'
import LandingEditions from '@/components/landing/LandingEditions.vue'
import LandingProdesk from '@/components/landing/LandingProdesk.vue'
import LandingPaths from '@/components/landing/LandingPaths.vue'
import LandingCaps from '@/components/landing/LandingCaps.vue'
import LandingFrame from '@/components/landing/LandingFrame.vue'
import LandingClose from '@/components/landing/LandingClose.vue'
import LandingStory from '@/components/landing/LandingStory.vue'
import '@/assets/styles/landing.css'

const year = new Date().getFullYear()
const productStats = PRODUCT_STATS
const ticks = [
  { id: 'briefing', label: '今日简报' },
  { id: 'value', label: '价值投资' },
  { id: 'swing', label: '短线催化' },
  { id: 'valuation', label: '保守估值' },
  { id: 'management', label: '管理层洞察' },
]

const storyId = ref(null)

const enterTo = computed(() => {
  try {
    const s = JSON.parse(localStorage.getItem('fd_session_v1') || 'null')
    if (s?.accountId) return { path: '/app', query: { edition: 'basic' } }
  } catch {
    /* ignore */
  }
  return { path: '/auth', query: { redirect: '/app?edition=basic' } }
})

const enterHref = computed(() => {
  const to = enterTo.value
  if (typeof to === 'string') return to
  const q = new URLSearchParams(to.query || {}).toString()
  return q ? `${to.path}?${q}` : to.path
})

const modulesBasic = [
  { k: '01', name: '今日', desc: '一屏说清今天该看什么' },
  { k: '02', name: '持仓', desc: '组合成本、盈亏与个股入口' },
  { k: '03', name: '我的', desc: '定制、画像、事件与完整分析' },
]
const modulesPro = [
  { k: '01', name: '工作区', desc: '完整分析与专业工具台' },
  { k: '02', name: '事件', desc: '催化窗口与来源可追溯' },
  { k: '03', name: '报告', desc: '历史简报与日差对照' },
]

const stories = {
  briefing: {
    id: 'briefing',
    demo: 'briefing',
    kicker: '能力 01 · 今日简报',
    hook: '今天该拍板的三件事，已经替你排好了。',
    title: '把洪流压成一页分析师笔记',
    lead: '不是再给你一个资讯瀑布。FinDigest 读你的持仓、约束与估值信号，只留下能改变行动的条目——默认不超过三条。',
    helps: [
      { t: '按你的组合裁切', d: '与持仓、观察名单无关的噪音直接出局；相关事件抬到顶层。' },
      { t: '日差对照', d: '相对昨日简报标出「新出现 / 已淡出」，避免每天重读同一段。' },
      { t: '硬约束优先', d: '触及回撤、单票上限、禁买行业时，风险条强制置顶。' },
      { t: '可反馈调权', d: '点「有用 / 没用」会写进下次排序——助手会记住你的口味。' },
    ],
  },
  swing: {
    id: 'swing',
    demo: 'swing',
    kicker: '路径乙 · 短线交易',
    hook: '催化剂窗口一关，机会就死。AI 替你盯着到期日。',
    title: '快变量进今日，过期即淡出',
    lead: '短线拼的是时间窗与纪律，不是多看十条研报。AI 帮你盯事件、控仓位建议权重，并把「过期催化」从今日里清掉。',
    helps: [
      { t: '事件雷达', d: '扫描与持仓相关的公告、业绩窗、解禁与政策节点，标出可行动窗口。' },
      { t: '倒计时淡出', d: '窗口关闭或催化失效后，自动从今日焦点降权，避免事后叙事。' },
      { t: '纪律护栏', d: '按你的止盈、回撤与仓位上限过滤冲动建议——快，但不失控。' },
      { t: '来源可点开', d: '每条催化带来源链接，方便你二次核验，而不是盲信摘要。' },
      { t: '反馈闭环', d: '你标记的有效/无效交易信号，会调整下次短线排序权重。' },
    ],
  },
  value: {
    id: 'value',
    demo: 'value',
    kicker: '路径甲 · 价值投资',
    hook: '叙事再热闹，也不进今日——除非安全边际先亮灯。',
    title: '慢变量优先，拒绝叙事型加仓',
    lead: '价值路径把护城河、管理层与安全边际当作门禁。热度再高，过不了硬约束就不进你的决策台。',
    helps: [
      { t: '分行业主锚', d: `${COPY.paradigmHonest}，避免用同一把尺量银行与周期股。` },
      { t: '安全边际门禁', d: '只有相对保守估值仍有余量的标的，才有资格进入今日。' },
      { t: '硬回撤护栏', d: '触及你设定的组合/单票回撤线时，风险条强制打断乐观叙事。' },
      { t: '今日极简', d: '默认只留「低估候选」与「必须处理的风险」，其余沉入完整分析。' },
    ],
  },
  valuation: {
    id: 'valuation',
    demo: 'valuation',
    kicker: '能力 02 · 保守估值',
    hook: '先回答它是什么企业，再谈贵不贵。',
    title: '巴菲特–芒格式分类，再谈价格',
    lead: '特许经营、银行、周期、平台……类型错了，再精的数字也是幻觉。FinDigest 先识企业，再用保守口径估。',
    helps: [
      { t: '范式识别', d: `对照行业与财务特征，在 ${COPY.paradigmHonest} 中选主辅视角；无引擎映射的项只改思考角度。` },
      { t: '保守口径', d: '偏向安全边际，而不是卖方乐观假设下的「目标价」。' },
      { t: '风险反转', d: '按范式列出典型杀伤点（如周期高点、地产杠杆），避免只看亮点。' },
      { t: '与今日联动', d: '估值信号可进入简报排序，但必须先过你的私人约束。' },
    ],
  },
  management: {
    id: 'management',
    demo: 'management',
    kicker: '能力 03 · 管理层洞察',
    hook: '数字会说谎，人也会。把「谁在掌舵」摆上桌。',
    title: '补齐「人」这一环',
    lead: '关键高管、公开评价与你的本机评论并排出现——让管理层质量进入决策，而不是事后复盘才想起。',
    helps: [
      { t: '关键人画像', d: '整理与标的相关的高管与公开评价线索，降低信息碎片感。' },
      { t: '本机备注', d: '你的私人评论只存在你的账户库中，可与公开信息对照。' },
      { t: '决策权重', d: '在价值路径下，管理层质量会影响是否值得深入与加仓。' },
      { t: '不替代尽调', d: '洞察是提醒与结构化，不是替你签字的尽调报告。' },
    ],
  },
}

const capCards = [
  {
    id: 'briefing',
    num: '01',
    title: '今日简报',
    hook: '今天该拍板的三件事，已经替你排好了。',
    teaser: '组合 × 事件 × 估值 → 一页可拍板的笔记。',
  },
  {
    id: 'swing',
    num: '02',
    title: '短线交易',
    hook: '催化剂窗口一关，机会就死。',
    teaser: 'CATALYST 计时、倒计时淡出、纪律护栏。',
  },
  {
    id: 'valuation',
    num: '03',
    title: '保守估值',
    hook: '先回答它是什么企业，再谈贵不贵。',
    teaser: `${COPY.paradigmHonest}，再用保守口径估价格。`,
  },
  {
    id: 'management',
    num: '04',
    title: '管理层洞察',
    hook: '数字会说谎，人也会。',
    teaser: '关键高管、公开评价与你的本机评论。',
  },
]

const active = computed(() => (storyId.value ? stories[storyId.value] : null))

function closeStory() {
  storyId.value = null
  document.body.style.overflow = ''
  if (typeof window !== 'undefined' && window.location.hash.startsWith('#story-')) {
    history.replaceState(history.state, '', `${window.location.pathname}${window.location.search}`)
  }
}

function applyLocationHash() {
  const h = typeof window !== 'undefined' ? window.location.hash || '' : ''
  const m = h.match(/^#story-([a-z]+)$/)
  if (m && stories[m[1]]) {
    storyId.value = m[1]
    document.body.style.overflow = 'hidden'
    return
  }
  if (storyId.value) {
    storyId.value = null
    document.body.style.overflow = ''
  }
}

onMounted(() => {
  applyLocationHash()
  window.addEventListener('hashchange', applyLocationHash)
  window.addEventListener('keydown', onKey)
})

onUnmounted(() => {
  document.body.style.overflow = ''
  window.removeEventListener('hashchange', applyLocationHash)
  window.removeEventListener('keydown', onKey)
})

function onKey(e) {
  if (e.key === 'Escape' && storyId.value) closeStory()
}
</script>
