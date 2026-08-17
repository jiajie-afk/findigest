<template>
  <section id="caps" class="ld-caps">
    <div class="ld-sec-inner">
      <h2 class="ld-h2">能力展厅</h2>
      <p class="ld-body">四间展厅，同一套私人约束。点开任意一项——先抓人，再看动效与 AI 职责。</p>
      <p class="ld-body ld-honest-line">{{ paradigmHonest }}</p>

      <div class="ld-acts">
        <a
          v-for="c in capCards"
          :key="c.id"
          class="ld-act"
          :class="{ 'ld-act-pro': c.id === 'swing' }"
          :href="'#story-' + c.id"
        >
          <span class="ld-act-num">{{ c.num }}</span>
          <div class="ld-act-main">
            <p class="ld-hook ld-hook-sm" :class="{ 'ld-hook-cyan': c.id === 'swing' }">{{ c.hook }}</p>
            <h3 class="ld-act-title">{{ c.title }}</h3>
            <p class="ld-act-teaser">{{ c.teaser }}</p>
            <span v-if="c.id === 'swing'" class="ld-act-timer" aria-hidden="true">CATALYST · T-36h</span>
          </div>
          <span class="ld-act-go">详解 →</span>
        </a>
      </div>
    </div>
  </section>
</template>

<script setup>
import { COPY } from '@/data/productStats.js'

defineProps({
  capCards: { type: Array, required: true },
})

const paradigmHonest = COPY.paradigmHonest
</script>
