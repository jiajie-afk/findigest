<template>
  <section id="top" class="ld-hero">
    <p class="ld-est">{{ kicker }}</p>
    <h1 class="ld-h1">FinDigest</h1>
    <p class="ld-lead">每天一屏该看的事。读懂风险与持仓，压成可决策顺序。</p>
    <p class="ld-honest">{{ paradigmHonest }}</p>
    <div class="ld-cta-row">
      <a class="ld-cta" :href="enterHref" @click="onNavClick($event, enterHref)">进入基础版</a>
      <a class="ld-cta ld-cta-pro" href="/pricing" @click="onNavClick($event, '/pricing')">{{ proCta }}</a>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import { COPY } from '@/data/productStats.js'
import { isLocalFreeProHost } from '@/services/localOwner.js'
import { onNavClick } from '@/utils/navHref.js'

defineProps({
  enterHref: { type: String, required: true },
})

const paradigmHonest = COPY.paradigmHonest
const proFree = isLocalFreeProHost()
const kicker = computed(() =>
  proFree ? '私人决策助手 · 基础版免费 · Pro 限时免费' : '私人决策助手 · 基础版免费 · Pro 需开通',
)
const proCta = computed(() => (proFree ? '免费进 Pro' : '开通 Pro'))
</script>
