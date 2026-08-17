<template>
  <div class="bfb-wrap">
    <div class="bfb" role="group" aria-label="反馈">
      <button type="button" class="fb" :class="{ on: value === 'adopt' }" @click="$emit('mark', 'adopt')">有用</button>
      <button type="button" class="fb" :class="{ on: value === 'ignore' }" @click="$emit('mark', 'ignore')">跳过</button>
      <button type="button" class="fb" :class="{ on: value === 'disagree' }" @click="$emit('mark', 'disagree')">不同意</button>
    </div>
    <div v-if="value === 'adopt' && positionSuggestion" class="bfb-bridge" role="status">
      <p class="bfb-bridge-lab">仓位含义 · {{ positionSuggestion.label || '建议' }}</p>
      <p class="bfb-bridge-band">{{ positionSuggestion.targetWeightBand }}</p>
      <p class="bfb-bridge-reason">{{ positionSuggestion.reason }}</p>
      <p v-if="positionSuggestion.blockedByConstraint" class="bfb-bridge-block">
        建议被约束阻断：{{ positionSuggestion.blockedByConstraint }}
      </p>
      <router-link
        v-if="positionSuggestion.code"
        class="bfb-bridge-link"
        :to="`/portfolio?symbol=${encodeURIComponent(positionSuggestion.code)}`"
      >
        查看持仓暴露 →
      </router-link>
    </div>
  </div>
</template>

<script setup>
defineProps({
  value: { type: String, default: '' },
  positionSuggestion: { type: Object, default: null },
})
defineEmits(['mark'])
</script>

<style scoped>
.bfb-wrap {
  margin-top: 10px;
}
.bfb {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.fb {
  padding: 4px 10px;
  border-radius: 6px;
  border: 1px solid var(--sep);
  background: transparent;
  color: var(--ts);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  min-height: 32px;
}
.fb:hover {
  border-color: color-mix(in srgb, var(--accent) 40%, var(--sep));
  color: var(--accent);
}
.fb.on {
  border-color: color-mix(in srgb, var(--accent) 50%, var(--sep));
  background: var(--accent-soft);
  color: var(--accent);
}
.bfb-bridge {
  margin-top: 10px;
  padding: 10px 12px;
  border: 1px solid color-mix(in srgb, var(--accent) 30%, var(--sep));
  border-radius: var(--rb, 8px);
  background: var(--accent-soft);
}
.bfb-bridge-lab {
  margin: 0 0 4px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--accent);
}
.bfb-bridge-band {
  margin: 0 0 4px;
  font-size: 14px;
  font-weight: 700;
  color: var(--tp);
}
.bfb-bridge-reason,
.bfb-bridge-block {
  margin: 0;
  font-size: 12px;
  line-height: 1.45;
  color: var(--ts);
}
.bfb-bridge-block {
  margin-top: 6px;
  color: var(--loss);
}
.bfb-bridge-link {
  display: inline-block;
  margin-top: 8px;
  font-size: 12px;
  font-weight: 650;
  color: var(--accent);
  text-decoration: none;
}
.bfb-bridge-link:hover {
  text-decoration: underline;
}
</style>
