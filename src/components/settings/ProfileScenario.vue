<template>
  <div class="scenario">
    <!-- Basic：11 题已齐 → 完成基础定制（无补全 88 入口） -->
    <div v-if="showBasicDoneGate" class="scenario-gate">
      <p class="scenario-tip">基础版私人定制已完成（11 题）。可回今日生成观察简报。</p>
      <div class="scenario-nav">
        <button type="button" class="btn bp" @click="finishEssentials">完成基础定制</button>
      </div>
    </div>

    <template v-else>
      <div class="scenario-progress">
        <div class="scenario-bar" :style="{ width: `${progressPct}%` }" />
      </div>
      <p class="scenario-meta">
        <template v-if="!isProProfile">
          身份章 {{ essentialAnswered }} / {{ essentialTotal }} · 第 {{ essentialStepLabel }} 题
        </template>
        <template v-else>
          私人定制 {{ answeredCount }} / {{ activeQuestions.length }} · 第 {{ step + 1 }} 题
          <span v-if="sectionMeta"> · {{ sectionMeta.title }}</span>
        </template>
      </p>
      <p v-if="sectionMeta" class="scenario-blurb">{{ sectionMeta.blurb }}</p>

      <div class="scenario-chapters" role="tablist" aria-label="画像章节">
        <button
          v-for="sec in visibleSections"
          :key="sec.id"
          type="button"
          class="scenario-ch"
          :class="{
            on: current.section === sec.id,
            done: sectionDone(sec.id),
          }"
          @click="jumpSection(sec.id)"
        >
          {{ sec.title }}
          <small>{{ sectionAnswered(sec.id) }}/{{ questionsInSectionCount(sec.id) }}</small>
        </button>
      </div>

      <h3 class="scenario-q">{{ current.text }}</h3>
      <div class="scenario-opts">
        <button
          v-for="opt in current.options"
          :key="opt.key"
          type="button"
          class="scenario-opt"
          :class="{ on: answers[current.id] === opt.key }"
          @click="pick(opt.key)"
        >
          <span class="k">{{ opt.key }}</span>
          <span>{{ opt.label }}</span>
        </button>
      </div>
      <div class="scenario-nav">
        <button type="button" class="btn bs" :disabled="!canGoPrev" @click="goPrev">上一题</button>
        <button
          v-if="showNext"
          type="button"
          class="btn bp"
          :disabled="!answers[current.id]"
          @click="goNext"
        >
          下一题
        </button>
        <button
          v-else-if="isProProfile"
          type="button"
          class="btn bp"
          :disabled="unanswered > 0"
          @click="finish"
        >
          {{ unanswered ? `还差 ${unanswered} 题` : '完成私人定制' }}
        </button>
        <button
          v-else-if="identityDone"
          type="button"
          class="btn bp"
          @click="finishEssentials"
        >
          完成基础定制
        </button>
        <button type="button" class="btn bs" @click="saveProgress">暂存进度</button>
      </div>
      <p v-if="!isProProfile && !identityDone" class="scenario-tip">
        基础版共 {{ essentialTotal }} 题，答完即可生成观察简报。
      </p>
      <p v-else-if="isProProfile && !identityDone" class="scenario-tip">
        建议先答完「身份与资金」{{ essentialTotal }} 题，即可生成观察简报。
      </p>
      <p v-else-if="isProProfile && unanswered > 0" class="scenario-tip">
        核心题已完成。可先回今日生成简报，其余 {{ unanswered }} 题随时补。
      </p>
    </template>
  </div>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import {
  SCENARIO_QUESTIONS,
  PROFILE_SECTIONS,
  getSectionMeta,
  ESSENTIAL_QUESTION_COUNT,
  essentialsDone,
} from '@/services/profiling.js'
import { useUserStore } from '@/store/user'
import { useBillingStore } from '@/store/billing'

defineProps({
  /** Kept for Settings scroll deep-link; edition (not focus) gates mode */
  mode: { type: String, default: '' },
})

const emit = defineEmits(['done'])
const user = useUserStore()
const billing = useBillingStore()
billing.hydrate()

/** Same entitlement as Pro desk */
const isProProfile = computed(() => !!billing.canUseProHud)

const essentialTotal = ESSENTIAL_QUESTION_COUNT
const answers = reactive({ ...(user.profile.scenarioAnswers || {}) })

const identityQuestions = computed(() => SCENARIO_QUESTIONS.filter((q) => q.section === 'identity'))
const activeQuestions = computed(() =>
  isProProfile.value ? SCENARIO_QUESTIONS : identityQuestions.value,
)
const visibleSections = computed(() =>
  isProProfile.value ? PROFILE_SECTIONS : PROFILE_SECTIONS.filter((s) => s.id === 'identity'),
)

const identityDone = computed(() => essentialsDone(answers))
/** Basic + 11 齐：只展示完成闸门，不进入 88 */
const showBasicDoneGate = computed(() => !isProProfile.value && identityDone.value)

const essentialAnswered = computed(
  () => identityQuestions.value.filter((q) => answers[q.id]).length,
)

const step = ref(0)

function firstGapIndex(list) {
  return list.findIndex((q) => !answers[q.id])
}

function resumeStep() {
  const list = activeQuestions.value
  const gap = firstGapIndex(list)
  step.value = gap >= 0 ? gap : 0
}

resumeStep()

const current = computed(() => activeQuestions.value[step.value] || activeQuestions.value[0])
const sectionMeta = computed(() => getSectionMeta(current.value?.section))
const unanswered = computed(() => activeQuestions.value.filter((q) => !answers[q.id]).length)
const answeredCount = computed(() => activeQuestions.value.length - unanswered.value)

const progressPct = computed(() => {
  const total = isProProfile.value ? activeQuestions.value.length : essentialTotal
  const answered = isProProfile.value ? answeredCount.value : essentialAnswered.value
  return total ? (answered / total) * 100 : 0
})

const essentialStepLabel = computed(() => {
  const idx = identityQuestions.value.findIndex((q) => q.id === current.value?.id)
  return idx >= 0 ? idx + 1 : step.value + 1
})

const canGoPrev = computed(() => step.value > 0)

const showNext = computed(() => step.value < activeQuestions.value.length - 1)

function questionsInSectionCount(id) {
  return SCENARIO_QUESTIONS.filter((q) => q.section === id).length
}
function sectionAnswered(id) {
  return SCENARIO_QUESTIONS.filter((q) => q.section === id && answers[q.id]).length
}
function sectionDone(id) {
  return sectionAnswered(id) >= questionsInSectionCount(id)
}
function jumpSection(id) {
  if (!isProProfile.value && id !== 'identity') return
  const list = activeQuestions.value
  const gapIdx = list.findIndex((q) => q.section === id && !answers[q.id])
  if (gapIdx >= 0) {
    step.value = gapIdx
    return
  }
  const firstIdx = list.findIndex((q) => q.section === id)
  if (firstIdx >= 0) step.value = firstIdx
}

function goPrev() {
  if (step.value > 0) step.value -= 1
}

function goNext() {
  if (step.value < activeQuestions.value.length - 1) step.value += 1
}

function pick(key) {
  answers[current.value.id] = key
  user.saveScenarioAnswers({ ...answers }, { silent: true })

  const list = activeQuestions.value
  const idx = list.findIndex((q) => q.id === current.value.id)
  const nowDone = !isProProfile.value && essentialsDone(answers)

  if (nowDone) {
    user.toast('基础定制已齐，可生成观察简报')
    return
  }

  // Never auto-advance outside activeQuestions (Basic stays in identity)
  if (idx >= 0 && idx < list.length - 1) {
    setTimeout(() => {
      step.value = idx + 1
    }, 160)
  } else if (isProProfile.value && essentialsDone(answers) && idx === list.length - 1) {
    /* last of full set — stay */
  } else if (isProProfile.value && current.value?.section === 'identity' && essentialsDone(answers)) {
    user.toast('核心题已齐，可生成观察简报')
  }
}

function saveProgress() {
  user.saveScenarioAnswers({ ...answers })
}

function finishEssentials() {
  user.saveScenarioAnswers({ ...answers })
  user.toast(isProProfile.value ? '核心题已保存，可生成观察简报' : '基础定制已完成')
  emit('done')
}

function finish() {
  if (!isProProfile.value) {
    finishEssentials()
    return
  }
  if (unanswered.value) {
    const idx = activeQuestions.value.findIndex((q) => !answers[q.id])
    if (idx >= 0) step.value = idx
    user.toast(`还差 ${unanswered.value} 题，已跳到未答题`)
    return
  }
  user.saveScenarioAnswers({ ...answers })
  emit('done')
}

watch(
  () => user.profile.scenarioAnswers,
  (v) => {
    if (!v) return
    Object.assign(answers, v)
  },
)

watch(isProProfile, () => {
  resumeStep()
})
</script>

<style scoped>
.scenario-progress {
  height: 4px;
  background: var(--sep);
  border-radius: 99px;
  overflow: hidden;
  margin-bottom: 12px;
}
.scenario-bar {
  height: 100%;
  background: var(--accent);
  transition: width 0.25s ease;
}
.scenario-meta {
  font-size: 12px;
  color: var(--tt);
  margin: 0 0 4px;
}
.scenario-blurb {
  font-size: 12px;
  color: var(--ts);
  margin: 0 0 12px;
}
.scenario-chapters {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 14px;
}
.scenario-ch {
  border: 1px solid var(--sep);
  background: var(--surface);
  color: var(--ts);
  font-size: 11px;
  padding: 6px 8px;
  border-radius: 8px;
  cursor: pointer;
  display: inline-flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  line-height: 1.2;
}
.scenario-ch small {
  opacity: 0.75;
  font-variant-numeric: tabular-nums;
}
.scenario-ch.on {
  border-color: var(--accent);
  color: var(--tp);
  background: var(--accent-soft);
}
.scenario-ch.done {
  border-color: color-mix(in srgb, var(--accent) 45%, var(--sep));
}
.scenario-q {
  font-size: 16px;
  font-weight: 700;
  letter-spacing: -0.02em;
  margin: 0 0 14px;
  line-height: 1.45;
}
.scenario-opts {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.scenario-opt {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  text-align: left;
  padding: 12px 14px;
  border: 1.5px solid var(--sep);
  border-radius: var(--rb);
  background: var(--surface);
  color: var(--tp);
  font-size: 13px;
  line-height: 1.45;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}
.scenario-opt.on {
  border-color: var(--accent);
  background: var(--accent-soft);
}
.scenario-opt .k {
  flex: 0 0 auto;
  width: 22px;
  height: 22px;
  border-radius: 6px;
  display: grid;
  place-items: center;
  font-size: 11px;
  font-weight: 700;
  background: var(--bg);
  color: var(--ts);
}
.scenario-opt.on .k {
  background: var(--accent);
  color: #fff;
}
.scenario-nav {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 16px;
}
.scenario-tip {
  margin: 14px 0 0;
  font-size: 12px;
  color: var(--ts);
  line-height: 1.45;
}
.scenario-gate {
  padding: 4px 0 2px;
}
.scenario-gate .scenario-tip {
  margin-top: 0;
  margin-bottom: 4px;
}
</style>
