<template>
  <section class="ld-close">
    <div class="ld-sec-inner ld-close-inner">
      <p class="ld-brand-foot">FinDigest</p>
      <h2 class="ld-h2 ld-h2-close">打开研究台</h2>
      <div class="ld-close-ctas">
        <a class="ld-cta" :href="enterHref" @click="onNavClick($event, enterHref)">{{ COPY.heroCta }}</a>
        <a class="ld-cta ld-cta-pro" :href="loginHref" @click="onNavClick($event, loginHref)">登录（可选）</a>
      </div>

      <div class="ld-refusals" aria-label="我们拒绝什么">
        <h3 class="ld-refusals-title">我们拒绝什么</h3>
        <ul class="ld-refusals-list">
          <li>不荐股：不做排行榜式「必买清单」</li>
          <li>不点位神谕：不承诺目标价兑现或买卖时机</li>
          <li>不把角度当引擎：思维角度 ≠ 独立 IV 定价函数</li>
        </ul>
        <p class="ld-refusals-note">我们是纪律化研究助手，止于仓位含义与硬约束，不下单。</p>
      </div>
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
