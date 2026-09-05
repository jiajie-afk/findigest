<template>
  <section id="frame" class="ld-frame">
    <div class="ld-frame-visual" aria-hidden="true">
      <img src="/landing/ld-desk-geometry.png" alt="" width="1200" height="900" />
    </div>
    <div class="ld-sec-inner">
      <h2 class="ld-h2">一张台，两种密度</h2>
      <p class="ld-body ld-frame-lead">基础版收束日常。Pro 把工作区、事件、报告抬进主导航。不是两家公司。</p>

      <div class="ld-corridors">
        <a class="ld-corridor ld-corridor-basic" :href="enterHref" @click="onNavClick($event, enterHref)">
          <p class="ld-corridor-kicker">基础版</p>
          <ol class="ld-halls">
            <li v-for="m in modulesBasic" :key="m.k" class="ld-hall">
              <span class="ld-hall-k">{{ m.k }}</span>
              <div class="ld-hall-body">
                <strong>{{ m.name }}</strong>
                <p>{{ m.desc }}</p>
              </div>
            </li>
          </ol>
          <span class="ld-corridor-go">免费进入 Pro →</span>
        </a>
        <a
          class="ld-corridor ld-corridor-pro"
          :href="enterHref"
          @click="onNavClick($event, enterHref)"
        >
          <p class="ld-corridor-kicker">Pro</p>
          <ol class="ld-halls">
            <li v-for="m in modulesPro" :key="m.k" class="ld-hall">
              <span class="ld-hall-k">{{ m.k }}</span>
              <div class="ld-hall-body">
                <strong>{{ m.name }}</strong>
                <p>{{ m.desc }}</p>
              </div>
            </li>
          </ol>
          <span class="ld-corridor-go">免费进入 Pro →</span>
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
  basicHref: { type: String, required: true },
})
</script>
