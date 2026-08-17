<template>
  <div>
    <div class="card af" data-section="sentiment" @mouseenter="$emit('focus-section', 'sentiment')">
      <div class="ch">
        <h3>信号概览</h3>
        <span class="sent-score" :style="{ color: scoreColor(sent.total) }">
          {{ sent.total >= 0 ? '+' : '' }}{{ sent.total }}
        </span>
      </div>
      <div class="sent-body">
        <div class="sent-badges">
          <span class="badge bb">{{ sent.mood }}</span>
          <span class="badge" :class="sent.confidence >= 70 ? 'bg' : 'by'">置信度 {{ sent.confidence }}%</span>
          <span class="badge">散户 {{ sent.rm }}</span>
        </div>
        <div v-if="sent.narrative" class="sent-narrative">
          {{ sent.narrative }}
        </div>
      </div>
    </div>

    <div v-if="pos" class="card af">
      <div class="ch">
        <h3>交易建议</h3>
        <span class="ch-meta">{{ pos.rationale }}</span>
      </div>
      <div class="pos-grid">
        <div class="pos-item"><div class="ml">建议仓位</div><div class="big">{{ pos.pct }}%</div></div>
        <div class="pos-item"><div class="ml">止损位</div><div class="big big-loss">{{ pos.stopLoss }}%</div></div>
        <div class="pos-item"><div class="ml">止盈位</div><div class="big big-gain">+{{ pos.takeProfit }}%</div></div>
        <div class="pos-item"><div class="ml">持有周期</div><div class="hold-period">{{ pos.holdPeriod }}</div></div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { scoreColor } from '@/utils/format'

defineProps({
  sent: { type: Object, required: true },
  pos: { type: Object, default: null },
})
defineEmits(['focus-section'])
</script>

<style scoped>
.sent-score {
  font-size: 22px;
  font-weight: 700;
}
.ch-meta { font-size: 12px; color: var(--ts); }
.sent-body { padding: 20px 24px; }
.sent-badges {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}
.sent-narrative {
  background: var(--bg);
  border-radius: 10px;
  padding: 16px;
  font-size: 13px;
  line-height: 1.8;
  border-left: 3px solid var(--blue, var(--accent));
}
.pos-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  padding: 20px 24px;
}
.pos-item {
  background: var(--bg);
  border-radius: 10px;
  padding: 14px;
  text-align: center;
}
.ml { font-size: 12px; color: var(--ts); }
.big { font-size: 24px; font-weight: 700; margin-top: 4px; }
.big-loss { color: var(--loss); }
.big-gain { color: var(--gain); }
.hold-period {
  font-size: 14px;
  font-weight: 600;
  margin-top: 8px;
}
@media (max-width: 640px) {
  .pos-grid { grid-template-columns: 1fr; }
}
</style>
