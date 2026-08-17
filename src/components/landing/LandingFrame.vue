<template>
  <section id="frame" class="ld-frame">
    <div class="ld-frame-visual" aria-hidden="true">
      <img src="/landing/ld-desk-geometry.png" alt="" width="1200" height="900" />
    </div>
    <div class="ld-sec-inner">
      <h2 class="ld-h2">两条工作台走廊</h2>
      <p class="ld-body ld-frame-lead">基础版收束日常；Pro 把工作区、事件、报告抬进主导航。</p>

      <div class="ld-corridors">
        <a class="ld-corridor ld-corridor-basic" :href="enterHref" @click="onNavClick($event, enterHref)">
          <p class="ld-corridor-kicker">基础版 · Museum</p>
          <ol class="ld-halls">
            <li v-for="m in modulesBasic" :key="m.k" class="ld-hall">
              <span class="ld-hall-k">{{ m.k }}</span>
              <div class="ld-hall-body">
                <strong>{{ m.name }}</strong>
                <p>{{ m.desc }}</p>
              </div>
            </li>
          </ol>
          <span class="ld-corridor-go">进入基础版 →</span>
        </a>
        <a
          class="ld-corridor ld-corridor-pro"
          href="/preview/prodesk"
          @click="onNavClick($event, '/preview/prodesk')"
        >
          <p class="ld-corridor-kicker">Pro Desk · HUD</p>
          <ol class="ld-halls">
            <li v-for="m in modulesPro" :key="m.k" class="ld-hall">
              <span class="ld-hall-k">{{ m.k }}</span>
              <div class="ld-hall-body">
                <strong>{{ m.name }}</strong>
                <p>{{ m.desc }}</p>
              </div>
            </li>
          </ol>
          <span class="ld-corridor-go">打开 Pro 预览 →</span>
        </a>
      </div>
    </div>
  </section>
</template>

<script setup>
import { onNavClick } from '@/utils/navHref.js'

defineProps({
  modulesBasic: { type: Array, required: true },
  modulesPro: { type: Array, required: true },
  enterHref: { type: String, required: true },
})
</script>
