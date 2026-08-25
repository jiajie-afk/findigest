<template>
  <section>
    <div class="ops-card">
      <h2 class="ops-h2">运行状态</h2>
      <div class="ops-lamps">
        <div v-for="row in lamps" :key="row.key" class="ops-lamp">
          <i class="ops-dot" :class="{ 'is-on': row.on }" />
          <span>{{ row.label }} · {{ row.on ? '已接' : '未接' }}</span>
        </div>
      </div>
    </div>
    <div class="ops-card">
      <h2 class="ops-h2">这台电脑怎么管站</h2>
      <p class="ops-muted">
        FinDigest 的控制端就是打开本页的这台机器。用
        <code>ADMIN_SECRET</code>
        进控制台，不要把密钥写进用户保险箱，也不要分享这个地址。
        生产站走 <a href="https://findigest.cn/ops">findigest.cn/ops</a>；本机开发走
        <code>/ops</code>。
      </p>
      <p class="ops-muted">
        控制台可以开/关 Pro、封禁、发兑换码、看用量。不能、也不会解密用户持仓或画像。
        完整会话改 httpOnly cookie 仍是下一阶段。
      </p>
      <p class="ops-muted">
        红灯优先修：云端保险箱、管理密钥、验证码 HMAC。短信/邮件未接时注册会走邮箱或失败，属预期。
      </p>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import { HEALTH_LABELS } from '@/services/adminApi.js'

const props = defineProps({
  health: { type: Object, default: () => ({}) },
})

const lamps = computed(() =>
  Object.keys(HEALTH_LABELS).map((key) => ({
    key,
    label: HEALTH_LABELS[key],
    on: !!props.health[key],
  })),
)
</script>
