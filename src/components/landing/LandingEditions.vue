<template>
  <section id="editions" class="ld-editions">
    <div class="ld-sec-inner">
      <h2 class="ld-h2">{{ editionsTitle }}</h2>
      <p class="ld-body">{{ editionsLead }}</p>

      <div class="ld-edition-grid">
        <a class="ld-edition ld-edition-basic" :href="enterHref" @click="onNavClick($event, enterHref)">
          <p class="ld-edition-kicker">基础版 · 免费</p>
          <p class="ld-edition-hook">每天一屏，该看的事。</p>
          <h3>基础版</h3>
          <p class="ld-edition-lead">同一张研究台，收束日常：今日简报优先，持仓与约束在手边。</p>
          <ul class="ld-edition-list">
            <li>今日 · 持仓 · 我的</li>
            <li>打开就能看今日</li>
            <li>工作区 / 事件收在「我的」</li>
            <li>本地简报永久免费</li>
          </ul>
          <span class="ld-cta">免费进入 Pro</span>
        </a>
        <a class="ld-edition ld-edition-pro" :href="enterHref" @click="onNavClick($event, enterHref)">
          <p class="ld-edition-kicker">{{ proKicker }}</p>
          <p class="ld-edition-hook">更深导航，同一家公司</p>
          <h3>Pro</h3>
          <p class="ld-edition-lead">
            密度更高：估值、仓位、风险同屏；工作区、事件、报告从主导航打开；今日简报有 AI 叙述。
          </p>
          <ul class="ld-edition-list">
            <li>估值分 / 仓位 / 风险同屏</li>
            <li>导航直达：工作区 · 事件 · 报告</li>
            <li>AI 增强今日简报叙述</li>
            <li>画像可慢慢补，不挡今日</li>
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
          <span>估值 / 仓位 / 风险同屏</span>
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
          <span>画像校准</span>
          <span>可选</span>
          <span>可选，不挡今日</span>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import { isLocalFreeProHost } from '@/services/localOwner.js'
import { onNavClick } from '@/utils/navHref.js'

defineProps({
  enterHref: { type: String, required: true },
  basicHref: { type: String, required: true },
})
const proFree = isLocalFreeProHost()
const editionsTitle = computed(() => (proFree ? '免费进入 Pro · 登录可选' : '基础版免费 · Pro 需开通'))
const editionsLead = computed(() =>
  proFree
    ? '同一张研究台。点「免费进入 Pro」就进专业台；登录只为同步云端，不是必须的。'
    : '同一张研究台。日常用基础版跑通今日；需要更深导航和 AI 叙述时再开通 Pro。',
)
const proKicker = computed(() => (proFree ? 'Pro 版 · 免费进入' : 'Pro 版 · 付费开通'))
const proLink = computed(() => (proFree ? '免费进入 Pro' : '开通 Pro'))
</script>
