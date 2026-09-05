<template>
  <div class="preview-pro" data-style="prodesk" data-edition="pro">
    <header class="bh-mast">
      <p class="bh-brand">FinDigest</p>
      <p class="bh-date">Pro 预览</p>
    </header>

    <section class="bh-hero bh-empty">
      <h1 class="bh-h1">先把持仓<em>放进来</em></h1>
      <p class="bh-lead">同一张台，更深导航。没有持仓，就没有该看的事。登录后导入，再出简报。</p>
      <div class="bh-actions">
        <a class="btn bp" :href="authHref" @click="onNavClick($event, authHref)">登录后导入</a>
      </div>
    </section>
  </div>
</template>

<script setup>
import { onMounted, onUnmounted } from 'vue'
import { onNavClick } from '@/utils/navHref.js'

const authHref = '/auth?redirect=/app%3Fedition%3Dpro'
const shell = () => document.querySelector('.app-shell')

onMounted(() => {
  const el = shell()
  if (!el) return
  el.dataset.style = 'prodesk'
  el.dataset.edition = 'pro'
  el.dataset.previewPro = '1'
})

onUnmounted(() => {
  const el = shell()
  if (!el || el.dataset.previewPro !== '1') return
  delete el.dataset.previewPro
})
</script>

<style scoped>
.preview-pro {
  max-width: 880px;
  margin: 0 auto;
  padding: clamp(20px, 4vh, 36px) 20px 48px;
}
.bh-mast {
  margin-bottom: 18px;
}
.bh-brand {
  margin: 0 0 4px;
  font-family: var(--mono);
  font-size: clamp(1.1rem, 2.4vw, 1.35rem);
  letter-spacing: -0.02em;
  color: var(--accent, #00e8c8);
}
.bh-date {
  margin: 0;
  color: var(--ts);
  font-size: 12px;
}
.bh-h1 {
  margin: 0 0 10px;
  font-size: clamp(1.85rem, 4vw, 2.55rem);
  font-weight: 700;
  line-height: 1.25;
  word-break: keep-all;
}
.bh-h1 em {
  font-style: normal;
  color: var(--accent, #00e8c8);
}
.bh-lead {
  margin: 0 0 16px;
  color: var(--ts);
  font-size: 16px;
  line-height: 1.5;
  max-width: 22em;
}
.bh-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 16px;
}
.bh-actions .btn {
  text-decoration: none;
  min-height: 44px;
}
</style>
