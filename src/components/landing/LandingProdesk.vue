<template>
  <section id="prodesk" class="ld-prodesk" aria-label="Pro Desk 预览">
    <div class="ld-prodesk-glow" aria-hidden="true" />
    <div class="ld-sec-inner">
      <p class="ld-prodesk-lab">PRO DESK PREVIEW</p>
      <h2 class="ld-prodesk-h2">训练台先于叙事</h2>
      <p class="ld-prodesk-lead">分数、仓位、风险同屏。工作区 / 事件 / 报告从主导航直达。</p>
      <p class="ld-prodesk-honest">{{ paradigmHonest }}</p>

      <a
        ref="proDeskRef"
        class="ld-hud"
        :class="{ 'is-inview': proDeskInView }"
        href="/preview/prodesk"
        @click="onNavClick($event, '/preview/prodesk')"
        aria-label="打开 Pro Desk 预览"
      >
        <div class="ld-hud-ticker" aria-hidden="true">
          <span>600519 <em class="up">+1.2%</em></span>
          <span>00700 <em class="down">−0.6%</em></span>
          <span>VAL <em class="up">72</em></span>
          <span>RISK <em>MED</em></span>
          <span>POS <em>38%</em></span>
          <span>CATALYST <em class="pulse">T−36h</em></span>
        </div>
        <div class="ld-hud-board">
          <div class="ld-hud-cell ld-hud-m-72">
            <span class="ld-hud-k">估值分</span>
            <strong class="ld-hud-v">72</strong>
            <div class="ld-hud-meter" aria-hidden="true"><i /></div>
            <span class="ld-hud-h">保守口径 · 可行动余量</span>
          </div>
          <div class="ld-hud-cell ld-hud-cell-wide ld-hud-m-38">
            <span class="ld-hud-k">仓位</span>
            <strong class="ld-hud-v">38%</strong>
            <div class="ld-hud-meter" aria-hidden="true"><i /></div>
            <span class="ld-hud-h">建议上限内 · 纪律护栏开</span>
          </div>
          <div class="ld-hud-cell ld-hud-m-54">
            <span class="ld-hud-k">风险</span>
            <strong class="ld-hud-v">MED</strong>
            <div class="ld-hud-meter ld-hud-meter-warn" aria-hidden="true"><i /></div>
            <span class="ld-hud-h">回撤线未触 · 继续监控</span>
          </div>
        </div>
        <div class="ld-hud-foot">
          <span>NAV · 工作区</span>
          <span>NAV · 事件</span>
          <span>NAV · 报告</span>
          <span class="ld-hud-ai">点开预览 →</span>
        </div>
      </a>
    </div>
  </section>
</template>

<script setup>
import { onMounted, onUnmounted, ref } from 'vue'
import { COPY } from '@/data/productStats.js'
import { onNavClick } from '@/utils/navHref.js'

const paradigmHonest = COPY.paradigmHonest
const proDeskRef = ref(null)
const proDeskInView = ref(false)
let proDeskObserver = null

onMounted(() => {
  const reduce =
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (reduce) {
    proDeskInView.value = true
  } else if (proDeskRef.value && typeof IntersectionObserver !== 'undefined') {
    proDeskObserver = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          proDeskInView.value = true
          proDeskObserver?.disconnect()
        }
      },
      { threshold: 0.35 },
    )
    proDeskObserver.observe(proDeskRef.value)
  } else {
    proDeskInView.value = true
  }
})

onUnmounted(() => {
  proDeskObserver?.disconnect()
  proDeskObserver = null
})
</script>
