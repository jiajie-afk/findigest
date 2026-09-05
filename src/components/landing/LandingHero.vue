<template>
  <section id="top" class="ld-hero">
    <p class="ld-wordmark">FinDigest</p>
    <h1 class="ld-h1">{{ COPY.identity }}</h1>
    <p class="ld-lead">{{ COPY.heroLead }}</p>
    <div class="ld-cta-row">
      <a class="ld-cta" :href="enterHref" @click="onNavClick($event, enterHref)">{{ COPY.heroCta }}</a>
      <a class="ld-cta ld-cta-pro" :href="loginHref" @click="onNavClick($event, loginHref)">登录（可选）</a>
    </div>
  </section>
</template>

<script setup>
import { COPY } from '@/data/productStats.js'
import { onNavClick } from '@/utils/navHref.js'

defineProps({
  enterHref: { type: String, required: true },
  loginHref: { type: String, required: true },
})
</script>
