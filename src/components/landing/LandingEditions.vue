<template>
  <section id="editions" class="ld-editions">
    <div class="ld-sec-inner">
      <h2 class="ld-h2">{{ editionsTitle }}</h2>
      <p class="ld-body">{{ editionsLead }}</p>

      <div class="ld-stats ld-stats--editions" aria-label="产品规模">
        <div v-for="s in productStats" :key="s.label" class="ld-stat">
          <strong>{{ s.value }}</strong>
          <span>{{ s.label }}</span>
          <span v-if="s.sublabel" class="ld-stat-sub">{{ s.sublabel }}</span>
        </div>
      </div>
      <p class="ld-body ld-honest-line">{{ paradigmHonest }}</p>

      <div class="ld-edition-grid">
        <a class="ld-edition ld-edition-basic" :href="enterHref" @click="onNavClick($event, enterHref)">
          <p class="ld-edition-kicker">基础版 · 免费</p>
          <p class="ld-edition-hook">每天一屏，该看的事。</p>
          <h3>Museum Desk</h3>
          <p class="ld-edition-lead">Cipher Museum 墨黑与金：羊皮纸字色、今日简报优先。适合新手与想少看噪音的人。</p>
          <ul class="ld-edition-list">
            <li>今日 · 持仓 · 我的</li>
            <li>核心题即可生成简报</li>
            <li>工作区 / 事件收在「我的」</li>
            <li>本地简报永久免费</li>
          </ul>
          <span class="ld-cta">进入基础版</span>
        </a>
        <a class="ld-edition ld-edition-pro" href="/pricing" @click="onNavClick($event, '/pricing')">
          <p class="ld-edition-kicker">{{ proKicker }}</p>
          <p class="ld-edition-hook">Desk · Nav · AI</p>
          <h3>Pro Desk</h3>
          <p class="ld-edition-lead">
            Aimlabs 近黑 HUD，电青 #00e8c8。诚实三件：Pro Desk HUD、工作区/事件/报告导航、AI 增强叙述。
          </p>
          <ul class="ld-edition-list">
            <li>Pro Desk HUD：估值分 / 仓位 / 风险</li>
            <li>导航直达：工作区 · 事件 · 报告</li>
            <li>AI 增强今日简报叙述</li>
            <li>引导校准 88 题（非独家锁死）</li>
          </ul>
          <span class="ld-cta ld-cta-pro">{{ proLink }}</span>
        </a>
      </div>

      <div class="ld-diff-table" role="table" aria-label="版本差异">
        <div class="ld-diff-row ld-diff-head" role="row">
          <span role="columnheader">能力</span>
          <span role="columnheader">基础版</span>
          <span role="columnheader">Pro 版</span>
        </div>
        <div class="ld-diff-row" role="row">
          <span>今日简报（本地）</span>
          <span>有</span>
          <span>有</span>
        </div>
        <div class="ld-diff-row" role="row">
          <span>Pro Desk HUD</span>
          <span>无</span>
          <span>有</span>
        </div>
        <div class="ld-diff-row" role="row">
          <span>工作区 · 事件 · 报告导航</span>
          <span>收在「我的」</span>
          <span>主导航直达</span>
        </div>
        <div class="ld-diff-row" role="row">
          <span>AI 增强叙述</span>
          <span>无</span>
          <span>有</span>
        </div>
        <div class="ld-diff-row" role="row">
          <span>88 题深度校准</span>
          <span>可选</span>
          <span>引导校准</span>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import { PRODUCT_STATS, COPY } from '@/data/productStats.js'
import { isLocalFreeProHost } from '@/services/localOwner.js'
import { onNavClick } from '@/utils/navHref.js'

defineProps({
  productStats: { type: Array, default: () => PRODUCT_STATS },
  enterHref: { type: String, required: true },
})

const paradigmHonest = COPY.paradigmHonest
const proFree = isLocalFreeProHost()
const editionsTitle = computed(() => (proFree ? '基础版免费 · Pro 限时免费' : '基础版免费 · Pro 需开通'))
const editionsLead = computed(() =>
  proFree
    ? '开头先选对台面。日常用基础版；需要专业密度与 AI 增强时直接进 Pro（限时免费）。'
    : '开头先选对台面。日常用基础版；需要专业密度、直达导航和 AI 增强时再开通 Pro。',
)
const proKicker = computed(() => (proFree ? 'Pro 版 · 限时免费' : 'Pro 版 · 付费开通'))
const proLink = computed(() => (proFree ? '免费进 Pro' : '开通 Pro'))
</script>
