<template>
  <div class="page kl">
    <h1 class="kl-h1">已知局限</h1>
    <p class="kl-lead">
      FinDigest 是纪律化研究助手，不是荐股系统，也不提供点位神谕。以下边界与估值输出旁的方法卡一致。
    </p>

    <section class="kl-sec">
      <h2>约 11 类可计算主锚</h2>
      <p>
        真正重算内在价值的是 taxonomy 里的 archetype（特许经营、银行、周期等）。目录里另有 100+
        思维角度；无 <code>engineHint</code> 的范式只改思考角度，不发明新的 IV 数学。
      </p>
      <p class="kl-meta">{{ paradigmHonest }}</p>
    </section>

    <section class="kl-sec">
      <h2>可搜索宇宙 vs 可估值子集</h2>
      <p>
        宇宙检索覆盖面远大于深度财务覆盖。搜索角标优先读静态
        <code>universe_valuable</code>（<code>npm run build:valuable-universe</code>），无需先 warm 财务书；
        财务不完整时估值降为「仅供结构参考」，<code>mosConfidence</code> 强制为低。
      </p>
    </section>

    <section class="kl-sec">
      <h2>数据新鲜度与降级</h2>
      <p>
        行情优先走同域 <code>/api/proxy</code>。若出现浏览器 JSONP 兜底，界面会显示
        <code>source=jsonp-fallback</code>，请勿当作实时权威价。
      </p>
    </section>

    <section class="kl-sec">
      <h2>CSP 与会话</h2>
      <p>
        <code>script-src</code> 无 <code>unsafe-inline</code>（Vite 外链 module）。
        <code>style-src</code> 仍需 <code>unsafe-inline</code>（Vue scoped），不宜再收紧。
        配置 <code>VAULT_SESSION_SECRET</code> 后云端同步可发 httpOnly <code>fd_sess</code>；
        SPA 路由与离线解锁仍用本机 session / 密码，XSS 仍可能触及 localStorage 密文与会话快照。
        同步用内存解锁（刷新后需再输密码）；云端带 <code>updatedAt</code> 乐观锁，避免无脑覆盖。
      </p>
    </section>

    <section class="kl-sec">
      <h2>非投资建议</h2>
      <p>
        输出供研究与自我复核。采纳建议最多落到「仓位含义」，不会代你下单。记得旧密码请在设置里改密；忘记密码只能验证码重置并清空端到端保险箱。
      </p>
    </section>

    <p class="kl-foot">
      <router-link to="/settings">设置</router-link>
      ·
      <router-link to="/app">回今日</router-link>
    </p>
  </div>
</template>

<script setup>
import { COPY } from '@/data/productStats.js'
const paradigmHonest = COPY.paradigmHonest
</script>

<style scoped>
.kl {
  max-width: 40rem;
  margin: 0 auto;
  padding: 24px 16px 48px;
}
.kl-h1 {
  margin: 0 0 8px;
  font-size: 1.6rem;
  letter-spacing: -0.02em;
}
.kl-lead {
  margin: 0 0 24px;
  color: var(--ts);
  line-height: 1.55;
}
.kl-sec {
  margin-bottom: 22px;
  padding-top: 14px;
  border-top: 1px solid var(--sep);
}
.kl-sec h2 {
  margin: 0 0 8px;
  font-size: 1rem;
}
.kl-sec p {
  margin: 0 0 8px;
  font-size: 14px;
  line-height: 1.55;
  color: var(--ts);
}
.kl-meta {
  font-size: 12px !important;
  color: var(--tt) !important;
}
.kl-foot {
  margin-top: 28px;
  font-size: 13px;
}
.kl-foot a {
  color: var(--accent);
  text-decoration: none;
  min-height: 44px;
  display: inline-flex;
  align-items: center;
}
</style>
