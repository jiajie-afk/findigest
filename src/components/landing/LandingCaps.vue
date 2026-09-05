<template>
  <section id="caps" class="ld-caps">
    <div class="ld-sec-inner">
      <h2 class="ld-h2">能力</h2>
      <p class="ld-body">四件事，同一套私人约束。点开看 AI 具体帮你做什么。</p>

      <div class="ld-acts">
        <a
          v-for="c in capCards"
          :key="c.id"
          class="ld-act"
          :href="'#story-' + c.id"
        >
          <span class="ld-act-num">{{ c.num }}</span>
          <div class="ld-act-main">
            <p class="ld-hook ld-hook-sm">{{ c.hook }}</p>
            <h3 class="ld-act-title">{{ c.title }}</h3>
            <p class="ld-act-teaser">{{ c.teaser }}</p>
          </div>
          <span class="ld-act-go">详解 →</span>
        </a>
      </div>
    </div>
  </section>
</template>

<script setup>
defineProps({
  capCards: { type: Array, required: true },
})
</script>
