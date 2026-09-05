<template>
  <div
    v-if="active"
    class="ld-overlay"
    role="dialog"
    aria-modal="true"
    :aria-labelledby="'story-title-' + active.id"
  >
    <button type="button" class="ld-overlay-scrim" aria-label="关闭" @click="$emit('close')" />
    <article class="ld-story" :data-story="active.id">
      <header class="ld-story-top">
        <p class="ld-story-k">{{ active.kicker }}</p>
        <button type="button" class="ld-story-x" @click="$emit('close')">关闭</button>
      </header>

      <p class="ld-story-hook">{{ active.hook }}</p>
      <h2 :id="'story-title-' + active.id" class="ld-story-title">{{ active.title }}</h2>
      <p class="ld-story-lead">{{ active.lead }}</p>

      <div class="ld-demo" :data-demo="active.demo" aria-hidden="true">
        <div v-if="active.demo === 'briefing'" class="demo demo-brief">
          <div class="demo-noise">
            <span v-for="n in 8" :key="n" class="demo-noise-line" :class="'demo-noise-i-' + n" />
          </div>
          <div class="demo-focus">
            <div class="demo-chip demo-d-0">01 · 持仓风险窗</div>
            <div class="demo-chip demo-d-1">02 · 低估候选</div>
            <div class="demo-chip demo-d-2">03 · 今日勿动</div>
          </div>
        </div>

        <div v-else-if="active.demo === 'swing'" class="demo demo-swing">
          <div class="demo-event">
            <span class="demo-event-tag">事件窗</span>
            <strong>业绩预告窗口</strong>
            <p>与你的持仓相关 · 来源可追溯</p>
          </div>
          <div class="demo-timer">
            <div class="demo-timer-bar" />
            <span class="demo-timer-lab">窗口剩余</span>
            <span class="demo-timer-num">T-36h</span>
          </div>
          <div class="demo-pulse" />
        </div>

        <div v-else-if="active.demo === 'value'" class="demo demo-value">
          <div class="demo-meter">
            <span>叙事热度</span>
            <div class="demo-bar demo-bar-dim"><i /></div>
          </div>
          <div class="demo-meter">
            <span>安全边际</span>
            <div class="demo-bar demo-bar-gold"><i /></div>
          </div>
          <div class="demo-gate">进入今日 · 已通过硬约束</div>
        </div>

        <div v-else-if="active.demo === 'valuation'" class="demo demo-val">
          <div class="demo-arch demo-d-0">特许经营</div>
          <div class="demo-arch is-on demo-d-1">银行</div>
          <div class="demo-arch demo-d-2">强周期</div>
          <div class="demo-arch-note">先识企业，再谈价格</div>
        </div>

        <div v-else class="demo demo-mgmt">
          <div class="demo-quote demo-d-0">「资本配置优先于扩张叙事」</div>
          <div class="demo-quote demo-d-1">公开评价 · 关键高管</div>
          <div class="demo-quote is-you demo-d-2">你的本机备注已并入</div>
        </div>
      </div>

      <h3 class="ld-story-h3">AI 具体帮你做什么</h3>
      <ul class="ld-story-helps">
        <li v-for="(h, i) in active.helps" :key="i">
          <span class="ld-help-n">{{ String(i + 1).padStart(2, '0') }}</span>
          <div>
            <strong>{{ h.t }}</strong>
            <p>{{ h.d }}</p>
          </div>
        </li>
      </ul>

      <div class="ld-story-cta">
        <a class="ld-cta" :href="enterHref" @click="onEnter">{{ COPY.heroCta }}</a>
        <button type="button" class="ld-cta-ghost" @click="$emit('close')">继续浏览</button>
      </div>
    </article>
  </div>
</template>

<script setup>
import { COPY } from '@/data/productStats.js'
import { onNavClick } from '@/utils/navHref.js'

const props = defineProps({
  active: { type: Object, default: null },
  enterHref: { type: String, required: true },
})
const emit = defineEmits(['close'])

function onEnter(e) {
  emit('close')
  onNavClick(e, props.enterHref)
}
</script>
