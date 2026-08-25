<template>
  <main class="bc">
    <header class="bc-head">
      <router-link class="bc-brand" to="/">FinDigest</router-link>
      <span>官方登录中转</span>
    </header>

    <section class="bc-hero" aria-labelledby="bc-title">
      <p class="bc-kicker">持仓导入</p>
      <h1 id="bc-title">{{ config.title }}</h1>
      <p class="bc-lead">{{ config.lead }}</p>

      <div class="bc-safety">
        <strong>FinDigest 不会显示或收集券商密码、验证码、二维码。</strong>
        <p>{{ config.notice }}</p>
      </div>

      <div class="bc-actions">
        <a
          class="btn bp"
          :href="config.primary.href"
          target="_blank"
          rel="noopener noreferrer"
        >
          {{ config.primary.label }}
        </a>
        <a
          v-if="config.secondary"
          class="btn bs"
          :href="config.secondary.href"
          target="_blank"
          rel="noopener noreferrer"
        >
          {{ config.secondary.label }}
        </a>
      </div>
    </section>

    <section class="bc-steps" aria-label="登录后导入步骤">
      <h2>登录后这样导入</h2>
      <ol>
        <li v-for="step in config.steps" :key="step">{{ step }}</li>
      </ol>
      <router-link class="bc-return" to="/portfolio?import=broker">我已登录，回 FinDigest 导入持仓</router-link>
    </section>

    <p class="bc-foot">
      请确认地址栏域名属于 {{ config.domain }}。本页只负责跳转到券商官方站点，不代你登录或下单。
    </p>
  </main>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  broker: { type: String, required: true },
})

const CONFIG = {
  eastmoney: {
    title: '登录东方财富个人中心',
    lead: '此入口会按指定地址进入东方财富个人中心，登录后返回东方财富网站。',
    notice: '个人中心登录不等于证券交易账户。它不会向 FinDigest 授权或自动传回证券持仓。',
    domain: 'eastmoney.com',
    primary: {
      label: '打开东方财富个人中心',
      href: 'https://passport2.eastmoney.com/pub/login?backurl=https%3A%2F%2Fwww.eastmoney.com%2F',
    },
    secondary: null,
    steps: [
      '打开东方财富个人中心并完成登录。',
      '登录完成后会回到东方财富网站，不会自动进入证券持仓页。',
      '需要导入证券持仓时，请回 FinDigest 使用粘贴、CSV 或截图导入。',
    ],
  },
  ths: {
    title: '在同花顺电脑交易端登录',
    lead: '同花顺通行证个人中心不是券商持仓同步页。请在电脑客户端的交易入口登录。',
    notice: '扫码方式由你开户券商的交易端决定。FinDigest 不会生成同花顺或券商的登录二维码。',
    domain: '10jqka.com.cn',
    primary: {
      label: '下载同花顺官方客户端',
      href: 'https://download.10jqka.com.cn/free/',
    },
    secondary: null,
    steps: [
      '从同花顺官网下载并打开电脑客户端。',
      '点击「交易」或按 F12，选择你的开户券商。',
      '按交易端提供的扫码或资金账号方式登录，复制持仓表或导出 CSV 后回 FinDigest 导入。',
    ],
  },
}

const config = computed(() => CONFIG[props.broker] || CONFIG.eastmoney)
</script>

<style scoped>
.bc {
  width: min(100% - 32px, 680px);
  margin: 0 auto;
  padding: clamp(22px, 7vh, 72px) 0 52px;
}
.bc-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: clamp(44px, 10vh, 86px);
  color: var(--tt);
  font-size: 12px;
}
.bc-brand {
  color: var(--tp);
  font-family: var(--font-display, var(--font));
  font-size: 1.15rem;
  font-weight: 650;
  letter-spacing: 0.04em;
  text-decoration: none;
}
.bc-kicker {
  margin: 0 0 10px;
  color: var(--accent);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.1em;
}
.bc h1 {
  max-width: 14ch;
  margin: 0;
  color: var(--tp);
  font-family: var(--font-display, var(--font));
  font-size: clamp(1.8rem, 6vw, 2.7rem);
  font-weight: 600;
  letter-spacing: -0.03em;
  line-height: 1.15;
}
.bc-lead {
  max-width: 38rem;
  margin: 16px 0 0;
  color: var(--ts);
  font-size: 15px;
  line-height: 1.7;
}
.bc-safety {
  margin-top: 28px;
  padding: 16px 0;
  border-top: 1px solid var(--sep);
  border-bottom: 1px solid var(--sep);
}
.bc-safety strong {
  color: var(--tp);
  font-size: 14px;
}
.bc-safety p {
  margin: 7px 0 0;
  color: var(--ts);
  font-size: 13px;
  line-height: 1.6;
}
.bc-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 22px;
}
.bc-actions .btn {
  min-height: 44px;
  text-decoration: none;
}
.bc-steps {
  margin-top: 52px;
}
.bc-steps h2 {
  margin: 0 0 14px;
  color: var(--tp);
  font-size: 1rem;
}
.bc-steps ol {
  display: grid;
  gap: 12px;
  margin: 0;
  padding: 0;
  list-style-position: inside;
  color: var(--ts);
  font-size: 14px;
  line-height: 1.6;
}
.bc-steps li::marker {
  color: var(--accent);
  font-weight: 700;
}
.bc-return {
  display: inline-flex;
  min-height: 44px;
  align-items: center;
  margin-top: 22px;
  color: var(--accent);
  font-size: 14px;
  font-weight: 650;
  text-decoration: none;
}
.bc-return:hover {
  text-decoration: underline;
}
.bc-foot {
  margin: 44px 0 0;
  color: var(--tt);
  font-size: 12px;
  line-height: 1.65;
}
@media (max-width: 560px) {
  .bc {
    width: min(100% - 28px, 680px);
  }
  .bc-head {
    margin-bottom: 46px;
  }
  .bc-actions {
    display: grid;
  }
  .bc-actions .btn {
    justify-content: center;
  }
}
</style>
