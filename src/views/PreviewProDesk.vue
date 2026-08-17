<template>
  <div class="preview-pro" data-style="prodesk" data-edition="pro">
    <header class="bh-mast">
      <p class="bh-brand">FinDigest</p>
      <p class="bh-date">Pro Desk 预览 · 本地演示台面</p>
    </header>

    <section class="pro-hud" aria-label="专业台指标">
      <a
        class="pro-hud-cell hud-panel"
        href="/auth?redirect=/app%3Fedition%3Dpro"
        @click="onNavClick($event, '/auth?redirect=/app%3Fedition%3Dpro')"
      >
        <p class="pro-hud-lab">估值分</p>
        <p class="pro-hud-val">72</p>
        <div class="pro-hud-meter" aria-hidden="true"><i style="width: 72%" /></div>
        <p class="pro-hud-hint">主锚偏谨慎，安全边际还不够</p>
        <span class="pro-hud-go">登录后看工作区</span>
      </a>
      <a
        class="pro-hud-cell hud-panel"
        href="/auth?redirect=/settings"
        @click="onNavClick($event, '/auth?redirect=/settings')"
      >
        <p class="pro-hud-lab">建议仓位</p>
        <p class="pro-hud-val">中</p>
        <div class="pro-hud-meter" aria-hidden="true"><i style="width: 48%" /></div>
        <p class="pro-hud-hint">按你回撤上限收过一档</p>
        <span class="pro-hud-go">登录后调约束</span>
      </a>
      <a
        class="pro-hud-cell hud-panel"
        href="/auth?redirect=/portfolio"
        @click="onNavClick($event, '/auth?redirect=/portfolio')"
      >
        <p class="pro-hud-lab">组合盈亏</p>
        <p class="pro-hud-val up">+1.2万</p>
        <div class="pro-hud-meter" aria-hidden="true"><i style="width: 58%" /></div>
        <p class="pro-hud-hint">市值 ¥86.4万 · 6 只</p>
        <span class="pro-hud-go">登录后打开持仓</span>
      </a>
    </section>

    <p class="pro-hud-honest">约 11 类可计算主锚 · 100+ 思维角度（非 100 套独立 IV）</p>

    <section class="bh-hero">
      <h1 class="bh-h1">今天只留<em>你该看的</em></h1>
      <p class="bh-lead">按你的硬约束裁一版简报。话少一点，重点清楚一点。</p>
      <div class="bh-actions">
        <a
          class="btn bp"
          href="/auth?redirect=/app%3Fedition%3Dpro"
          @click="onNavClick($event, '/auth?redirect=/app%3Fedition%3Dpro')"
        >登录后生成简报</a>
        <a
          class="btn bs"
          href="/auth?mode=register&redirect=/app%3Fedition%3Dpro"
          @click="onNavClick($event, '/auth?mode=register&redirect=/app%3Fedition%3Dpro')"
        >注册进 Pro</a>
      </div>
    </section>

    <section class="bh-focus">
      <h2 class="bh-sec">此刻只需关注</h2>
      <ol class="bh-list bh-list--focus">
        <li>
          <span class="bh-idx">01</span>
          <div>
            <p class="bh-item-t">茅台：两副眼镜对不上</p>
            <p class="bh-item-s">质量透镜嫌贵，逆向透镜说先别急。我不合成一个「综合态度」。</p>
          </div>
        </li>
        <li>
          <span class="bh-idx">02</span>
          <div>
            <p class="bh-item-t">回撤上限还在生效</p>
            <p class="bh-item-s">单票建议仓位已按你的硬约束压过一档。</p>
          </div>
        </li>
      </ol>
    </section>

    <p class="preview-note">
      这是 Pro Desk 外观预览。
      <a href="/auth?mode=register&redirect=/app%3Fedition%3Dpro" @click="onNavClick($event, '/auth?mode=register&redirect=/app%3Fedition%3Dpro')">注册</a>
      或
      <a href="/auth?redirect=/app%3Fedition%3Dpro" @click="onNavClick($event, '/auth?redirect=/app%3Fedition%3Dpro')">登录</a>
      后进入真实台面。
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
  el.dataset.style = 'prodesk'
  el.dataset.edition = 'pro'
  el.dataset.previewPro = '1'
})

onUnmounted(() => {
  const el = shell()
  if (!el || el.dataset.previewPro !== '1') return
  delete el.dataset.previewPro
  // leave style restoration to user store on next real route
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
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--accent, #00e8c8);
}
.bh-date {
  margin: 0;
  color: var(--ts);
  font-size: 12px;
}
.bh-hero {
  margin: 8px 0 28px;
}
.bh-h1 {
  margin: 0 0 10px;
  font-size: clamp(1.25rem, 2.8vw, 1.65rem);
  font-weight: 700;
  line-height: 1.25;
}
.bh-h1 em {
  font-style: normal;
  color: var(--accent, #00e8c8);
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
.bh-actions .btn {
  text-decoration: none;
}
.pro-hud-cell {
  text-decoration: none;
  color: inherit;
  text-align: left;
  cursor: pointer;
}
.bh-more-link {
  color: var(--accent, #00e8c8);
  font-size: 13px;
  text-decoration: none;
}
.bh-sec {
  margin: 0 0 12px;
  font-family: var(--mono);
  font-size: 10px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--accent, #00e8c8);
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
  font-family: var(--mono);
  color: var(--accent, #00e8c8);
  font-weight: 700;
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
.preview-note a {
  color: var(--accent, #00e8c8);
}
</style>
