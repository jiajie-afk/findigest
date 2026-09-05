<template>
  <div class="ed">
    <header class="ed-top">
      <span class="ed-mark">FinDigest</span>
      <span class="ed-note">{{ billing.localFreePro ? '免费进入 Pro' : '基础版免费 · 需要时再开通 Pro' }}</span>
    </header>

    <section class="ed-hero">
      <h1 class="ed-h1">同一张台，两种密度</h1>
      <p class="ed-lead">
        {{
          billing.localFreePro
            ? '点「免费进入 Pro」就进专业台。登录只为同步云端，不是必须的。'
            : '先用免费基础版跑通今日；需要更深导航与 AI 时再开通 Pro。'
        }}
      </p>
    </section>

    <div class="ed-grid">
      <a class="ed-card ed-basic" href="/app?edition=pro" @click="pickPro">
        <p class="ed-kicker">基础版 · 免费</p>
        <p class="ed-hook">每天一屏，该看的事。</p>
        <h2>基础版</h2>
        <p class="ed-body">同一张研究台，收束日常：今日简报优先，持仓与约束在手边。</p>
        <ul>
          <li>今日 · 持仓 · 我的</li>
          <li>打开就能看今日</li>
          <li>工作区 / 事件收在「我的」</li>
        </ul>
        <span class="ed-cta">免费进入 Pro →</span>
      </a>

      <a class="ed-card ed-pro" :href="proHref" @click="pickPro">
        <p class="ed-kicker">{{ billing.localFreePro ? 'Pro 版 · 免费进入' : 'Pro 版 · 付费' }}</p>
        <p class="ed-hook">更深导航，同一家公司</p>
        <h2>Pro</h2>
        <p class="ed-body">
          密度更高：估值、仓位、风险同屏；工作区、事件、报告从主导航打开；今日简报有 AI 叙述。
        </p>
        <ul>
          <li>估值分 / 仓位 / 风险同屏</li>
          <li>导航直达：工作区 · 事件 · 报告</li>
          <li>AI 增强今日简报叙述</li>
          <li>画像可慢慢补，不挡今日</li>
        </ul>
        <span class="ed-cta">{{ billing.isBillingPro || billing.localFreePro ? '免费进入 Pro →' : '开通 Pro →' }}</span>
      </a>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useUserStore } from '@/store/user'
import { useBillingStore } from '@/store/billing'
import { onNavClick } from '@/utils/navHref.js'

const user = useUserStore()
const billing = useBillingStore()
const route = useRoute()

onMounted(() => billing.hydrate())

const proHref = computed(() =>
  '/app?edition=pro',
)

function destOr(fallback) {
  const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : ''
  return redirect && !redirect.includes('/onboarding/edition') ? redirect : fallback
}

function pickPro(e) {
  billing.hydrate()
  user.setProductEdition('pro')
  onNavClick(e, destOr('/app?edition=pro'))
}
</script>

<style scoped>
.ed {
  --ed-ink: #050607;
  --ed-gold: #c5a059;
  --ed-paper: #e8f0f2;
  --ed-mist: #7a8b94;
  --ed-panel: #0c0f12;
  min-height: 100dvh;
  background: var(--ed-ink);
  color: var(--ed-paper);
  font-family: 'Plus Jakarta Sans Variable', 'Plus Jakarta Sans', 'PingFang SC', sans-serif;
  padding: 0 clamp(16px, 4vw, 40px) 48px;
}

.ed-top {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: baseline;
  justify-content: space-between;
  padding: 20px 0;
  border-bottom: 1px solid rgba(232, 240, 242, 0.1);
}
.ed-mark {
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.04em;
}
.ed-note {
  font-size: 11px;
  color: var(--ed-mist);
  letter-spacing: 0.04em;
}

.ed-hero {
  max-width: 40rem;
  padding: 36px 0 28px;
}
.ed-h1 {
  margin: 0 0 10px;
  font-size: clamp(1.75rem, 4vw, 2.4rem);
  font-weight: 700;
  letter-spacing: -0.03em;
}
.ed-lead {
  margin: 0;
  font-size: 14px;
  line-height: 1.55;
  color: var(--ed-mist);
  max-width: 46ch;
}

.ed-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 14px;
  max-width: 920px;
}
@media (min-width: 800px) {
  .ed-grid {
    grid-template-columns: 1fr 1fr;
  }
}

.ed-card {
  appearance: none;
  display: block;
  text-align: left;
  text-decoration: none;
  border: 1px solid rgba(232, 240, 242, 0.12);
  background: var(--ed-panel);
  color: inherit;
  font: inherit;
  padding: 22px 20px;
  cursor: pointer;
  border-radius: 2px;
  touch-action: manipulation;
  transition: border-color 0.15s ease, background 0.15s ease;
}
@media (hover: hover) and (pointer: fine) {
  .ed-card:hover {
    transform: translateY(-2px);
  }
}
.ed-basic {
  border-color: rgba(197, 160, 89, 0.35);
}
.ed-pro {
  border-color: rgba(232, 240, 242, 0.12);
  background: var(--ed-panel);
  box-shadow: none;
  opacity: 0.92;
}
.ed-pro:hover {
  border-color: rgba(197, 160, 89, 0.35);
}
.ed-kicker {
  margin: 0 0 10px;
  font-size: 11px;
  letter-spacing: 0.04em;
  color: var(--ed-mist);
}
.ed-basic .ed-kicker {
  color: var(--ed-gold);
}
.ed-pro .ed-kicker {
  color: var(--ed-mist);
}
.ed-hook {
  margin: 0 0 12px;
  font-size: 1.1rem;
  font-weight: 650;
  line-height: 1.35;
}
.ed-basic .ed-hook {
  font-family: 'Newsreader', Georgia, serif;
  font-style: italic;
  font-weight: 500;
  color: var(--ed-gold);
}
.ed-pro .ed-hook {
  font-family: 'Newsreader', Georgia, serif;
  font-style: italic;
  font-size: 1.05rem;
  font-weight: 500;
  letter-spacing: 0.01em;
  color: var(--ed-mist);
}
.ed-pro h2 {
  font-family: inherit;
  letter-spacing: -0.02em;
  color: var(--ed-paper);
}
.ed-card h2 {
  margin: 0 0 10px;
  font-size: 1.35rem;
}
.ed-pro li {
  font-size: 13px;
}
.ed-body {
  margin: 0 0 14px;
  font-size: 13px;
  line-height: 1.55;
  color: var(--ed-mist);
}
.ed-card ul {
  margin: 0 0 16px;
  padding: 0;
  list-style: none;
}
.ed-card li {
  padding: 7px 0;
  font-size: 13px;
  border-bottom: 1px solid rgba(232, 240, 242, 0.08);
}
.ed-cta {
  font-size: 13px;
  font-weight: 700;
  color: var(--ed-gold);
}
.ed-pro .ed-cta {
  font-weight: 550;
  color: var(--ed-mist);
}
</style>
