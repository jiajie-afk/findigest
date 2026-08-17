<template>
  <div class="preview-basic" data-style="luxury" data-edition="basic">
    <header class="bh-mast">
      <p class="bh-brand">FinDigest</p>
      <p class="bh-date">基础版预览 · Museum Desk</p>
    </header>

    <section class="bh-hero">
      <h1 class="bh-h1">今天只留<em>你该看的</em></h1>
      <p class="bh-lead">按你的硬约束裁一版简报。话少一点，重点清楚一点。</p>
      <div class="bh-actions">
        <a
          class="btn bp"
          href="/auth?redirect=/app%3Fedition%3Dbasic"
          @click="onNavClick($event, '/auth?redirect=/app%3Fedition%3Dbasic')"
        >登录后生成简报</a>
        <a
          class="btn bs"
          href="/auth?mode=register&redirect=/app%3Fedition%3Dbasic"
          @click="onNavClick($event, '/auth?mode=register&redirect=/app%3Fedition%3Dbasic')"
        >注册进基础版</a>
      </div>
    </section>

    <details class="fd-density-fold bh-secondary" open>
      <summary>组合概览</summary>
      <section class="bh-quiet">
        <div>
          <p class="bh-q-label">组合市值</p>
          <p class="bh-q-val">¥0.0万</p>
        </div>
        <div>
          <p class="bh-q-label">今日盈亏</p>
          <p class="bh-q-val">+0.00万</p>
        </div>
        <div>
          <p class="bh-q-label">持仓</p>
          <p class="bh-q-val bh-q-sm">0 只</p>
        </div>
      </section>
    </details>

    <section class="bh-focus">
      <h2 class="bh-sec">此刻只需关注</h2>
      <ol class="bh-list bh-list--focus">
        <li>
          <span class="bh-idx">01</span>
          <div>
            <p class="bh-item-t">先答 11 道身份题</p>
            <p class="bh-item-s">基础版只跑核心题就能出简报；完整 88 题留给 Pro。</p>
          </div>
        </li>
        <li>
          <span class="bh-idx">02</span>
          <div>
            <p class="bh-item-t">导航保持轻</p>
            <p class="bh-item-s">今日 · 持仓 · 我的。工作区与事件收在次要入口。</p>
          </div>
        </li>
      </ol>
    </section>

    <p class="preview-note">
      这是 Museum Desk 基础版外观。正式用：
      <a href="/auth?mode=register&redirect=/app%3Fedition%3Dbasic" @click="onNavClick($event, '/auth?mode=register&redirect=/app%3Fedition%3Dbasic')">注册后进基础版</a>
      ，或已登录打开
      <a href="/app?edition=basic" @click="onNavClick($event, '/app?edition=basic')">/app?edition=basic</a>。
    </p>
  </div>
</template>

<script setup>
import { onMounted, onUnmounted } from 'vue'
import { onNavClick } from '@/utils/navHref.js'

const shell = () => document.querySelector('.app-shell')

onMounted(() => {
  const el = shell()
  if (!el) return
  el.dataset.style = 'luxury'
  el.dataset.edition = 'basic'
  el.dataset.previewBasic = '1'
})

onUnmounted(() => {
  const el = shell()
  if (!el || el.dataset.previewBasic !== '1') return
  delete el.dataset.previewBasic
})
</script>

<style scoped>
.preview-basic {
  max-width: 880px;
  margin: 0 auto;
  padding: clamp(20px, 4vh, 36px) 20px 48px;
}
.bh-mast { margin-bottom: 18px; }
.bh-brand {
  margin: 0 0 4px;
  font-family: var(--font-display, Georgia, serif);
  font-size: clamp(1.35rem, 3vw, 1.7rem);
  letter-spacing: 0.04em;
  color: var(--accent, #c5a059);
}
.bh-date {
  margin: 0;
  color: var(--ts);
  font-size: 12px;
}
.bh-hero { margin: 8px 0 28px; }
.bh-actions .btn {
  text-decoration: none;
}
.bh-h1 {
  margin: 0 0 10px;
  font-family: var(--font-display, Georgia, serif);
  font-size: clamp(1.4rem, 3.2vw, 1.85rem);
  font-weight: 600;
  line-height: 1.25;
}
.bh-h1 em {
  font-style: normal;
  color: var(--accent, #c5a059);
}
.bh-lead {
  margin: 0 0 16px;
  color: var(--ts);
  font-size: 14px;
  line-height: 1.55;
  max-width: 36em;
}
.bh-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
}
.bh-more-link {
  color: var(--accent, #c5a059);
  font-size: 13px;
  text-decoration: none;
}
.bh-sec {
  margin: 0 0 12px;
  font-size: 12px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--accent, #c5a059);
}
.bh-quiet {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  padding: 12px 0;
}
.bh-q-label {
  margin: 0 0 4px;
  font-size: 11px;
  color: var(--ts);
}
.bh-q-val {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 650;
}
.bh-list {
  margin: 0;
  padding: 0;
  list-style: none;
}
.bh-list--focus > li {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 12px;
  padding: 12px 0;
  border-top: 1px solid var(--sep);
}
.bh-idx {
  color: var(--accent, #c5a059);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.bh-item-t {
  margin: 0 0 4px;
  font-weight: 650;
}
.bh-item-s {
  margin: 0;
  color: var(--ts);
  font-size: 13px;
  line-height: 1.5;
}
.preview-note {
  margin-top: 28px;
  padding-top: 16px;
  border-top: 1px solid var(--sep);
  font-size: 12px;
  color: var(--ts);
  line-height: 1.55;
}
.preview-note a { color: var(--accent, #c5a059); }
.fd-density-fold {
  margin: 0 0 22px;
  border-top: 1px solid var(--sep);
  padding-top: 8px;
}
.fd-density-fold > summary {
  cursor: pointer;
  list-style: none;
  font-size: 12px;
  color: var(--accent, #c5a059);
  padding: 6px 0;
}
.fd-density-fold > summary::-webkit-details-marker { display: none; }
</style>
