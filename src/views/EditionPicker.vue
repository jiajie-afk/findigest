<template>
  <div class="ed">
    <header class="ed-top">
      <span class="ed-mark">FinDigest</span>
      <span class="ed-note">{{ billing.localFreePro ? '专业版限时免费' : '基础版免费 · 开通 Pro 用专业台' }}</span>
    </header>

    <section class="ed-hero">
      <h1 class="ed-h1">选择你的版本</h1>
      <p class="ed-lead">
        {{
          billing.localFreePro
            ? '专业版限时免费：直接进 Pro Desk，不用付费。'
            : '先用免费基础版跑通今日简报；需要专业密度与 AI 时再开通 Pro。'
        }}
      </p>
    </section>

    <div class="ed-grid">
      <a class="ed-card ed-basic" href="/app?edition=basic" @click="pickBasic">
        <p class="ed-kicker">基础版 · 免费</p>
        <p class="ed-hook">每天一屏，该看的事。</p>
        <h2>Museum Desk</h2>
        <p class="ed-body">Cipher Museum 墨黑与金：羊皮纸字色、今日简报优先。适合新手与想少看噪音的人。</p>
        <ul>
          <li>今日 · 持仓 · 我的</li>
          <li>核心题即可生成简报</li>
          <li>工作区 / 事件收在「我的」</li>
        </ul>
        <span class="ed-cta">免费进入基础版 →</span>
      </a>

      <a class="ed-card ed-pro" :href="proHref" @click="pickPro">
        <p class="ed-kicker">{{ billing.localFreePro ? 'Pro 版 · 限时免费' : 'Pro 版 · 付费' }}</p>
        <p class="ed-hook">Desk · Nav · AI</p>
        <h2>Pro Desk</h2>
        <p class="ed-body">
          Aimlabs 近黑 HUD，电青 #00e8c8。卖点诚实三件：Pro Desk HUD、工作区/事件/报告导航、AI 增强叙述。88 题是引导校准。
        </p>
        <ul>
          <li>Pro Desk HUD：估值分 / 仓位 / 风险</li>
          <li>导航直达：工作区 · 事件 · 报告</li>
          <li>AI 增强今日简报叙述</li>
          <li>引导校准 88 题（非独家锁死）</li>
        </ul>
        <span class="ed-cta">{{ billing.isBillingPro || billing.localFreePro ? '进入 Pro Desk →' : '开通 Pro Desk →' }}</span>
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
  billing.isBillingPro || billing.localFreePro || billing.isPro ? '/app?edition=pro' : '/pricing',
)

function destOr(fallback) {
  const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : ''
  return redirect && !redirect.includes('/onboarding/edition') ? redirect : fallback
}

function pickBasic(e) {
  user.setProductEdition('basic')
  onNavClick(e, destOr('/app?edition=basic'))
}

function pickPro(e) {
  billing.hydrate()
  if (billing.isBillingPro || billing.localFreePro || billing.isPro) {
    user.setProductEdition('pro')
    onNavClick(e, destOr('/app?edition=pro'))
    return
  }
  onNavClick(e, '/pricing')
}
</script>

<style scoped>
.ed {
  --ed-ink: #050607;
  --ed-gold: #c5a059;
  --ed-cyan: #00e8c8;
  --ed-paper: #e8f0f2;
  --ed-mist: #7a8b94;
  --ed-panel: #0c0f12;
  min-height: 100dvh;
  background:
    radial-gradient(ellipse 50% 35% at 88% 0%, rgba(0, 232, 200, 0.08), transparent 55%),
    var(--ed-ink);
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
  letter-spacing: 0.08em;
  text-transform: uppercase;
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
  border-color: rgba(0, 232, 200, 0.55);
  background:
    linear-gradient(180deg, rgba(0, 232, 200, 0.08), transparent 42%),
    #050607;
  box-shadow: inset 0 0 0 1px rgba(0, 232, 200, 0.12);
}
.ed-pro:hover {
  border-color: var(--ed-cyan);
}
.ed-kicker {
  margin: 0 0 10px;
  font-size: 10px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--ed-mist);
}
.ed-basic .ed-kicker {
  color: var(--ed-gold);
}
.ed-pro .ed-kicker {
  color: var(--ed-cyan);
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
  font-family: 'JetBrains Mono Variable', 'JetBrains Mono', ui-monospace, monospace;
  font-size: 1rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--ed-cyan);
}
.ed-pro h2 {
  font-family: 'Plus Jakarta Sans Variable', 'Plus Jakarta Sans', sans-serif;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--ed-cyan);
}
.ed-card h2 {
  margin: 0 0 10px;
  font-size: 1.35rem;
}
.ed-pro li {
  font-family: 'JetBrains Mono Variable', 'JetBrains Mono', ui-monospace, monospace;
  font-size: 12px;
  letter-spacing: 0.02em;
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
  color: var(--ed-cyan);
}
</style>
