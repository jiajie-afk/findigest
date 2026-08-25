<template>
  <div class="ev page">
    <header class="ev-mast">
      <div class="ev-mast-copy">
        <p class="ev-kicker">催化剂</p>
        <h1 class="ev-title">事件</h1>
        <p class="ev-lead">
          央视要闻、国际要闻仍是完整列表。对得上你持仓的会标「关我仓」，点名或同业，不是荐股。
        </p>
      </div>
      <div class="ev-mast-side">
        <button type="button" class="ev-ghost" :disabled="events.loading" @click="reload">
          {{ events.loading ? '同步中…' : isCctvTab ? '刷新要闻' : '刷新日历' }}
        </button>
        <button type="button" class="ev-cta" @click="openCompose">添加事件</button>
      </div>
    </header>

    <section class="ev-intel" :aria-label="isCctvTab ? (isCctvWorld ? '国际要闻概览' : '央视要闻概览') : '本周概览'">
      <template v-if="isCctvTab">
        <div class="ev-intel-cell">
          <span class="ev-intel-n">{{ cctvLaneToday || cctvLane.length }}</span>
          <span class="ev-intel-l">今日条目</span>
        </div>
        <div class="ev-intel-cell">
          <span class="ev-intel-n">{{ cctvLane.length }}</span>
          <span class="ev-intel-l">{{ isCctvWorld ? '国际' : '国内' }}</span>
        </div>
        <div class="ev-intel-cell">
          <span class="ev-intel-n">{{ cctvLaneRelated }}</span>
          <span class="ev-intel-l">关我仓</span>
        </div>
        <div class="ev-intel-cell ev-intel-meta">
          <span class="ev-intel-l">来源</span>
          <span class="ev-intel-s">{{ sourceLabel }}</span>
        </div>
      </template>
      <template v-else>
        <div class="ev-intel-cell">
          <span class="ev-intel-n">{{ events.weekStats.thisWeek }}</span>
          <span class="ev-intel-l">7 日内披露/催化</span>
        </div>
        <div class="ev-intel-cell">
          <span class="ev-intel-n">{{ events.weekStats.windowOpen }}</span>
          <span class="ev-intel-l">交易窗口进行中</span>
        </div>
        <div class="ev-intel-cell">
          <span class="ev-intel-n">{{ events.weekStats.tomorrow }}</span>
          <span class="ev-intel-l">明日披露</span>
        </div>
        <div class="ev-intel-cell ev-intel-meta">
          <span class="ev-intel-l">来源</span>
          <span class="ev-intel-s">{{ sourceLabel }}</span>
        </div>
      </template>
    </section>

    <div class="ev-toolbar">
      <div class="ev-modes" role="tablist" aria-label="事件范围">
        <button
          type="button"
          role="tab"
          class="ev-mode"
          :aria-selected="events.tab === 'cctv'"
          :class="{ on: events.tab === 'cctv' }"
          @click="events.tab = 'cctv'"
        >
          央视要闻
          <em>{{ events.cctvDomestic.length }}</em>
        </button>
        <button
          type="button"
          role="tab"
          class="ev-mode"
          :aria-selected="events.tab === 'cctvWorld'"
          :class="{ on: events.tab === 'cctvWorld' }"
          @click="events.tab = 'cctvWorld'"
        >
          国际要闻
          <em>{{ events.cctvWorldItems.length }}</em>
        </button>
        <button
          type="button"
          role="tab"
          class="ev-mode"
          :aria-selected="events.tab === 'market'"
          :class="{ on: events.tab === 'market' }"
          @click="events.tab = 'market'"
        >
          市场观察
          <em>{{ events.filteredMarket.length }}</em>
        </button>
        <button
          type="button"
          role="tab"
          class="ev-mode"
          :aria-selected="events.tab === 'mine'"
          :class="{ on: events.tab === 'mine' }"
          @click="events.tab = 'mine'"
        >
          我的持仓
          <em>{{ events.filteredMine.length }}</em>
        </button>
        <button
          type="button"
          role="tab"
          class="ev-mode"
          :aria-selected="events.tab === 'manual'"
          :class="{ on: events.tab === 'manual' }"
          @click="events.tab = 'manual'"
        >
          我添加的
          <em>{{ events.manualEvents.length }}</em>
        </button>
      </div>

      <div
        v-if="events.tab !== 'manual' && !isCctvTab"
        class="ev-filters"
        role="group"
        aria-label="筛选"
      >
        <button
          type="button"
          class="ev-filter"
          :class="{ on: timeScope === 'week' }"
          :aria-pressed="timeScope === 'week'"
          @click="timeScope = 'week'"
        >
          近7日
        </button>
        <button
          type="button"
          class="ev-filter"
          :class="{ on: timeScope === 'all' }"
          :aria-pressed="timeScope === 'all'"
          @click="timeScope = 'all'"
        >
          全部日期
        </button>
        <button
          v-for="f in filters"
          :key="f.id"
          type="button"
          class="ev-filter"
          :class="{ on: events.filter === f.id }"
          :aria-pressed="events.filter === f.id"
          @click="events.filter = f.id"
        >
          {{ f.label }}
        </button>
      </div>
    </div>

    <p v-if="events.tab === 'cctv'" class="ev-scope">
      含昨晚《新闻联播》官方分条以及央视网国内、财经。列表不裁剪。对上持仓的标「关我仓」，不是买入理由。
    </p>
    <p v-else-if="events.tab === 'cctvWorld'" class="ev-scope">
      含《新闻联播》国际段和央视网国际频道。完整列表保留；对上持仓的同样会标出来。
    </p>
    <p v-else-if="events.tab === 'market'" class="ev-scope">
      东方财富预约披露（近 14 天）+ 本地催化库。不是买卖指令，用来排交易窗口。
    </p>
    <p v-else-if="events.tab === 'mine' && !holdingCount" class="ev-scope warn">
      你还没有持仓，所以「我的持仓」为空。
      <router-link to="/portfolio?import=1">去导入持仓</router-link>
      后，会自动对齐日历里相关代码。
    </p>
    <p v-else-if="events.tab === 'mine'" class="ev-scope">
      已对齐你组合里的 {{ holdingCount }} 只。这里汇总日历、新闻催化，以及要闻里标过「关我仓」的条目。完整联播仍在上面两个标签。
    </p>

    <section v-if="events.tab === 'manual' && composing" class="ev-compose" aria-label="添加事件">
      <div class="ev-compose-head">
        <h2 class="ev-compose-title">写下一条催化</h2>
        <button type="button" class="ev-ghost" @click="composing = false">收起</button>
      </div>

      <div class="ev-form">
        <label class="ev-field ev-field-full">
          <span class="ev-lab">标题</span>
          <input v-model="form.title" type="text" placeholder="例：泡泡玛特世界杯广告投放" />
        </label>
        <label class="ev-field">
          <span class="ev-lab">事件日期</span>
          <input v-model="form.event_date" type="date" />
        </label>
        <label class="ev-field">
          <span class="ev-lab">类型</span>
          <div class="ev-select-wrap">
            <select v-model="form.catalyst_type" @change="onTypeChange">
              <option v-for="t in catalystTypes" :key="t.id" :value="t.id">{{ t.label }}</option>
            </select>
            <span class="ev-select-chev" aria-hidden="true" />
          </div>
        </label>
        <label class="ev-field">
          <span class="ev-lab">关联代码</span>
          <input v-model="form.related_stock_codes" type="text" placeholder="9992，多个用逗号" />
        </label>
        <label class="ev-field">
          <span class="ev-lab">来源链接</span>
          <input v-model="form.source_url" type="url" placeholder="公告 / 新闻原文" />
        </label>
        <label class="ev-field ev-field-full">
          <span class="ev-lab">为什么重要</span>
          <textarea v-model="form.description" rows="3" placeholder="预期如何兑现、你怎么交易" />
        </label>
      </div>

      <div v-if="previewHint" class="ev-window">
        <span class="ev-window-k">建议窗口</span>
        <p>{{ previewHint }}</p>
      </div>

      <div class="ev-compose-actions">
        <button type="button" class="btn bp sm" @click="add">确认添加</button>
        <button type="button" class="ev-ghost" @click="resetForm">清空</button>
      </div>
    </section>

    <div v-if="!list.length && !(events.tab === 'manual' && composing)" class="ev-empty">
      <p class="ev-empty-t">{{ emptyTitle }}</p>
      <p class="ev-empty-d">{{ emptyDesc }}</p>
      <div class="ev-empty-actions">
        <button
          v-if="isCctvTab"
          type="button"
          class="btn bp sm"
          :disabled="events.loading"
          @click="reload"
        >
          刷新要闻
        </button>
        <template v-else>
          <router-link v-if="!holdingCount" class="btn bp sm" to="/portfolio?import=1">导入持仓</router-link>
          <button v-else type="button" class="btn bp sm" :disabled="events.loading" @click="reload">刷新日历</button>
          <router-link v-if="holdingCount" class="ev-ghost" to="/portfolio">去持仓</router-link>
          <button type="button" class="ev-ghost" @click="openCompose">手动添加</button>
        </template>
      </div>
    </div>

    <ol v-else-if="isCctvTab" class="ev-list" :aria-label="isCctvWorld ? '国际要闻' : '央视要闻'">
      <li
        v-for="(e, idx) in list"
        :key="e.id || e.title + idx"
        class="ev-row"
        :class="{ 'ev-row--mine': e.relatedHoldings?.length }"
      >
        <div class="ev-date">
          <span class="ev-date-d">{{ String(e.rank || idx + 1).padStart(2, '0') }}</span>
          <span class="ev-date-m">{{ e.tierLabel || '简讯' }}</span>
          <span class="ev-eta" :data-soon="e.tier === 's' || e.tier === 'a' ? '1' : '0'">{{
            e.timeLabel || ''
          }}</span>
        </div>
        <div class="ev-body">
          <div class="ev-row-top">
            <div class="ev-tags">
              <span class="ev-badge" :data-kind="e.tier || 'c'">{{ e.tierLabel || '简讯' }}</span>
              <span v-if="e.relatedHoldings?.length" class="ev-badge" data-kind="mine">关我仓</span>
              <span v-if="e.catalyst_label" class="ev-cat">{{ e.catalyst_label }}</span>
            </div>
          </div>
          <h3 class="ev-row-title">
            <a
              v-if="sourceOf(e).url"
              class="ev-title-link"
              :href="sourceOf(e).url"
              target="_blank"
              rel="noopener noreferrer"
            >{{ e.title }}</a>
            <template v-else>{{ e.title }}</template>
          </h3>
          <div v-if="e.relatedHoldings?.length" class="ev-codes">
            <router-link
              v-for="h in e.relatedHoldings"
              :key="h.code"
              class="ev-code"
              :to="`/stock/${h.code}`"
            >{{ h.strength === 'strong' ? '点名' : '行业' }} · {{ h.name }}</router-link>
          </div>
          <p v-if="e.description" class="ev-desc">{{ e.description }}</p>
          <div class="ev-foot">
            <a
              v-if="sourceOf(e).url"
              class="ev-src"
              :href="sourceOf(e).url"
              target="_blank"
              rel="noopener noreferrer"
            >打开央视原文</a>
            <span v-else class="ev-src-miss">无来源</span>
          </div>
        </div>
      </li>
    </ol>

    <ol v-else class="ev-list" aria-label="事件列表">
      <li
        v-for="(e, idx) in list"
        :key="e.id || e.title + idx"
        class="ev-row"
      >
        <div class="ev-date">
          <span class="ev-date-d">{{ dateParts(e).day }}</span>
          <span class="ev-date-m">{{ dateParts(e).month }}</span>
          <span class="ev-eta" :data-soon="eta(e).soon ? '1' : '0'">{{ eta(e).label }}</span>
        </div>

        <div class="ev-body">
          <div class="ev-row-top">
            <div class="ev-tags">
              <span
                class="ev-badge"
                :data-kind="e.event_type === 'confirmed' ? 'confirmed' : 'potential'"
              >
                {{ e.event_type === 'confirmed' ? '确认' : '预期' }}
              </span>
              <span v-if="e.catalyst_label" class="ev-cat">{{ e.catalyst_label }}</span>
              <span class="ev-win" :data-st="win(e).id">{{ win(e).label }}</span>
            </div>
          </div>

          <h3 class="ev-row-title">{{ e.title }}</h3>

          <div v-if="codesOf(e).length" class="ev-codes">
            <router-link
              v-for="c in codesOf(e)"
              :key="c"
              class="ev-code"
              :to="`/stock/${c}`"
            >{{ nameOf(c, e) }}</router-link>
          </div>

          <p v-if="e.description" class="ev-desc">{{ e.description }}</p>
          <p v-if="e.trade_hint" class="ev-hint">{{ e.trade_hint }}</p>

          <div class="ev-foot">
            <a
              v-if="sourceOf(e).url"
              class="ev-src"
              :href="sourceOf(e).url"
              target="_blank"
              rel="noopener noreferrer"
            >{{ sourceOf(e).source || '查看来源' }}</a>
            <span v-else class="ev-src-miss">无来源</span>
            <button
              v-if="events.tab === 'manual' && e.id"
              type="button"
              class="ev-del"
              @click="events.removeManual(e.id)"
            >
              删除
            </button>
          </div>
        </div>
      </li>
    </ol>
    <p v-if="!isCctvTab && list.length && listHidden" class="ev-more">
      已显示 {{ list.length }} 条 · 另有 {{ listHidden }} 条未展开。
      <button v-if="timeScope === 'week'" type="button" class="ev-more-btn" @click="timeScope = 'all'">
        看全部日期
      </button>
    </p>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useEventStore } from '@/store/event'
import { useUserStore } from '@/store/user'
import { usePortfolioStore } from '@/store/portfolio'
import { resolveEventSource } from '@/utils/eventSource'
import { daysUntil, windowStatus } from '@/services/earningsCalendar.js'

const events = useEventStore()
const user = useUserStore()
const portfolio = usePortfolioStore()
const composing = ref(false)
/** week | all — market list density */
const timeScope = ref('week')

const filters = [
  { id: 'all', label: '全部' },
  { id: 'confirmed', label: '确认' },
  { id: 'potential', label: '预期' },
]

const catalystTypes = [
  { id: 'ad_sponsor', label: '广告/赞助', buy: 1, sell: 1, importance: 4 },
  { id: 'film_ip', label: '影视/IP', buy: 2, sell: 3, importance: 4 },
  { id: 'product_launch', label: '发布会/新品', buy: 1, sell: 2, importance: 4 },
  { id: 'earnings', label: '财报/业绩', buy: 3, sell: 1, importance: 5 },
  { id: 'policy_macro', label: '政策/宏观', buy: 2, sell: 1, importance: 3 },
  { id: 'contract_bid', label: '订单/中标', buy: 0, sell: 2, importance: 3 },
  { id: 'general', label: '其他', buy: 1, sell: 1, importance: 3 },
]

const form = reactive({
  title: '',
  event_date: '',
  related_stock_codes: '',
  description: '',
  source_url: '',
  importance: 4,
  event_type: 'potential',
  catalyst_type: 'ad_sponsor',
  catalyst_label: '广告/赞助',
})

const holdingCount = computed(() => portfolio.allHoldings?.length || 0)

const isCctvWorld = computed(() => events.tab === 'cctvWorld')
const isCctvTab = computed(() => events.tab === 'cctv' || isCctvWorld.value)

const cctvLane = computed(() =>
  isCctvWorld.value ? events.cctvWorldItems : events.cctvDomestic,
)

const cctvLaneRelated = computed(
  () => cctvLane.value.filter((e) => (e.relatedHoldings || []).length).length,
)

const cctvLaneToday = computed(() => {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Shanghai' })
  return cctvLane.value.filter((e) => String(e.event_date || '').slice(0, 10) === today).length
})

const scopedRows = computed(() => {
  if (isCctvTab.value) return cctvLane.value
  let rows =
    events.tab === 'manual'
      ? events.manualEvents
      : events.tab === 'mine'
        ? events.filteredMine
        : events.filteredMarket

  if (events.tab !== 'manual' && timeScope.value === 'week') {
    rows = rows.filter((e) => {
      const d = daysUntil(e.event_date)
      return d != null && d >= -1 && d <= 7
    })
  }
  return rows
})

const list = computed(() => {
  const cap = events.tab === 'market' ? 80 : 120
  return scopedRows.value.slice(0, cap)
})

const listTotal = computed(() => scopedRows.value.length)

const listHidden = computed(() => Math.max(0, listTotal.value - list.value.length))

const sourceLabel = computed(() => {
  if (isCctvTab.value) {
    if (events.cctvStatus.error && !cctvLane.value.length) return events.cctvStatus.error
    const n = cctvLane.value.length
    if (!n) return '央视网公开接口'
    return isCctvWorld.value ? `央视国际 ${n} 条` : `新闻联播+国内 ${n} 条`
  }
  const n = events.liveStatus.count || 0
  if (n > 0) return `东财预约 ${n} 条 · 已混本地库`
  if (events.liveStatus.error) return `日历暂不可用 · 显示本地库 ${events.catalogEvents.length}`
  return `本地催化库 ${events.catalogEvents.length} 条`
})

const emptyTitle = computed(() => {
  if (isCctvWorld.value) return events.cctvStatus.error ? '国际要闻暂时拉不到' : '还没有拉到国际要闻'
  if (events.tab === 'cctv') return events.cctvStatus.error ? '央视要闻暂时拉不到' : '还没有拉到要闻'
  if (events.tab === 'mine') return holdingCount.value ? '持仓还没对上日历' : '先导入持仓'
  if (events.tab === 'manual') return '还没有手记事件'
  return '日历暂时拉不到'
})

const emptyDesc = computed(() => {
  if (isCctvWorld.value) {
    return '点刷新重试。国际段来自新闻联播和央视国际频道，不接东财快讯。'
  }
  if (events.tab === 'cctv') {
    return '点刷新重试。先看新闻联播当晚分条，再补央视网国内与财经。不转写电视全文。'
  }
  if (events.tab === 'mine') {
    return holdingCount.value
      ? '日历没对上时，联播里标过「关我仓」的也会出现在这里。完整要闻仍在上面两个标签。'
      : '导入持仓后，「我的持仓」会汇总相关财报、催化和关我仓的要闻。'
  }
  if (events.tab === 'manual') return '写清日期、代码和交易窗口。'
  return '点刷新重试代理；或先看本地催化库（刷新后仍空再反馈）。'
})

function codesOf(e) {
  return String(e.related_stock_codes || '')
    .split(/[,，\s]+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

function nameOf(code, e) {
  const n = e.related_stock_name || portfolio.nameOf?.(code) || ''
  if (n && n !== code) return `${n} · ${code}`
  return code
}

function sourceOf(e) {
  if (e?._source === 'cctv' && e.source_url) {
    return { url: e.source_url, source: '央视网' }
  }
  return resolveEventSource(e, codesOf(e)[0] || '')
}

function dateParts(e) {
  const iso = e.event_date
  if (!iso) return { day: '—', month: '待定' }
  const d = new Date(String(iso).slice(0, 10) + 'T12:00:00')
  if (Number.isNaN(d.getTime())) return { day: '—', month: '待定' }
  return {
    day: String(d.getDate()).padStart(2, '0'),
    month: `${d.getMonth() + 1}月`,
  }
}

function eta(e) {
  const d = daysUntil(e.event_date)
  if (d == null) return { label: '', soon: false }
  if (d < 0) return { label: `${Math.abs(d)}日前`, soon: false }
  if (d === 0) return { label: '今天', soon: true }
  if (d === 1) return { label: '明天', soon: true }
  if (d <= 7) return { label: `${d}天后`, soon: true }
  return { label: `${d}天后`, soon: false }
}

function win(e) {
  return windowStatus(e)
}

function shift(iso, days) {
  if (!iso) return ''
  const d = new Date(iso + 'T12:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

const previewHint = computed(() => {
  const t = catalystTypes.find((x) => x.id === form.catalyst_type) || catalystTypes[0]
  if (!form.event_date) return `选定日期后，将按「事前约 ${t.buy} 天布局 / 事后约 ${t.sell} 天兑现」生成窗口`
  const buyFrom = shift(form.event_date, -Math.max(1, t.buy || 1))
  const sellBy = shift(form.event_date, t.sell || 1)
  return `建议 ${buyFrom} 前布局，事件后至 ${sellBy} 评估兑现/减仓`
})

function onTypeChange() {
  const t = catalystTypes.find((x) => x.id === form.catalyst_type)
  if (!t) return
  form.catalyst_label = t.label
  form.importance = t.importance
}

function openCompose() {
  events.tab = 'manual'
  composing.value = true
}

function resetForm() {
  form.title = ''
  form.description = ''
  form.related_stock_codes = ''
  form.source_url = ''
  form.event_date = ''
}

function add() {
  if (!form.title) {
    user.toast('请填写标题')
    return
  }
  const t = catalystTypes.find((x) => x.id === form.catalyst_type) || catalystTypes[0]
  const buy_from = form.event_date ? shift(form.event_date, -Math.max(1, t.buy || 1)) : ''
  const sell_by = form.event_date ? shift(form.event_date, t.sell || 1) : ''
  events.addManual({
    ...form,
    catalyst_label: t.label,
    importance: t.importance,
    buy_from,
    sell_by,
    trade_hint: previewHint.value,
  })
  resetForm()
  composing.value = false
  user.toast('事件已添加')
}

async function reload() {
  await events.refreshLive()
  if (isCctvTab.value) {
    const n = cctvLane.value.length
    const label = isCctvWorld.value ? '国际要闻' : '央视要闻'
    if (n) user.toast(`已同步${label} ${n} 条`)
    else user.toast(events.cctvStatus.error || `暂无${label}`)
    return
  }
  if (!events.liveStatus.count && events.catalogEvents.length) {
    user.toast(`直播日历暂无，已显示本地库 ${events.catalogEvents.length} 条`)
  } else if (events.liveStatus.count) {
    user.toast(`已同步 ${events.liveStatus.count} 条预约披露`)
  } else {
    user.toast(events.liveStatus.error || '暂无新数据')
  }
}

onMounted(async () => {
  if (!events.marketEvents.length && !events.cctvItems.length && !events.loading) {
    await events.load()
  } else if (!events.cctvItems.length) {
    events.loadCctvNews?.().catch(() => {})
  }
})
</script>

<style scoped>
.ev {
  padding-bottom: 120px;
}

.ev-mast {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 24px;
  flex-wrap: wrap;
  margin-bottom: 20px;
  padding-bottom: 22px;
  border-bottom: 1px solid var(--sep);
}

.ev-kicker {
  margin: 0 0 10px;
  font-size: 11px;
  font-weight: 650;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--accent);
}

.ev-title {
  margin: 0 0 10px;
  font-family: var(--font-display);
  font-size: clamp(2rem, 4.5vw, 2.75rem);
  font-weight: 600;
  letter-spacing: -0.04em;
  line-height: 1.05;
  color: var(--tp);
}

.ev-lead {
  margin: 0;
  max-width: 40ch;
  font-size: 14px;
  line-height: 1.55;
  color: var(--ts);
}

.ev-mast-side {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
}

.ev-cta,
.ev-ghost {
  appearance: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 36px;
  padding: 0 14px;
  border-radius: 2px;
  font: inherit;
  font-size: 13px;
  font-weight: 650;
  cursor: pointer;
  text-decoration: none;
  transition:
    transform 0.12s var(--ease),
    background 0.18s var(--ease),
    border-color 0.18s var(--ease),
    color 0.18s var(--ease),
    opacity 0.18s var(--ease);
}

.ev-cta {
  border: 0;
  background: var(--accent);
  color: #1a1610;
}

.ev-cta:hover {
  background: var(--accent-hover);
}

.ev-cta:active,
.ev-ghost:active:not(:disabled) {
  transform: translateY(1px) scale(0.98);
}

.ev-ghost {
  border: 1px solid color-mix(in srgb, var(--accent) 32%, var(--sep));
  background: transparent;
  color: var(--tp);
}

.ev-ghost:hover:not(:disabled) {
  color: var(--accent);
  background: var(--accent-soft);
}

.ev-ghost:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.ev-intel {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0;
  margin-bottom: 22px;
  background: transparent;
  border: 0;
  border-top: 1px solid var(--sep);
  border-bottom: 1px solid var(--sep);
}

.ev-intel-cell {
  background: transparent;
  padding: 14px 12px 14px 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-height: 72px;
  border-right: 1px solid var(--sep);
}

.ev-intel-cell:last-child {
  border-right: none;
  padding-right: 0;
}

.ev-intel-n {
  font-family: var(--font-display);
  font-size: 1.75rem;
  font-weight: 600;
  letter-spacing: -0.04em;
  line-height: 1;
  color: var(--tp);
}

.ev-intel-l {
  font-size: 11px;
  font-weight: 650;
  letter-spacing: 0.04em;
  color: var(--tt);
}

.ev-intel-s {
  font-size: 12px;
  line-height: 1.4;
  color: var(--ts);
}

.ev-intel-meta {
  justify-content: center;
}

.ev-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px 20px;
  margin-bottom: 10px;
}

.ev-modes {
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
  border-bottom: 1px solid var(--sep);
}

.ev-mode {
  appearance: none;
  position: relative;
  border: 0;
  background: transparent;
  color: var(--ts);
  font: inherit;
  font-size: 14px;
  font-weight: 650;
  padding: 10px 12px 12px;
  cursor: pointer;
}

.ev-mode em {
  margin-left: 6px;
  font-style: normal;
  font-size: 11px;
  font-weight: 700;
  color: var(--tt);
}

.ev-mode::after {
  content: '';
  position: absolute;
  left: 12px;
  right: 12px;
  bottom: 0;
  height: 2px;
  background: transparent;
}

.ev-mode:hover {
  color: var(--tp);
}

.ev-mode.on {
  color: var(--accent);
}

.ev-mode.on::after {
  background: var(--accent);
}

.ev-mode.on em {
  color: var(--accent);
}

.ev-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.ev-filter {
  appearance: none;
  border: 0;
  background: transparent;
  color: var(--tt);
  font: inherit;
  font-size: 12px;
  font-weight: 650;
  letter-spacing: 0.04em;
  padding: 8px 10px;
  cursor: pointer;
  border-radius: 2px;
}

.ev-filter:hover {
  color: var(--tp);
  background: rgba(236, 230, 216, 0.05);
}

.ev-filter.on {
  color: var(--accent);
  background: var(--accent-soft);
}

.ev-scope {
  margin: 0 0 18px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--tt);
}

.ev-scope.warn {
  color: var(--ts);
}

.ev-scope a {
  color: var(--accent);
  font-weight: 650;
  text-decoration: none;
}

.ev-scope a:hover {
  text-decoration: underline;
}

.ev-desk + .ev-desk {
  margin-top: 36px;
  padding-top: 22px;
  border-top: 1px solid var(--sep);
}

.ev-desk-h {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 8px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--sep);
}

.ev-desk-copy {
  min-width: 0;
}

.ev-desk-k {
  margin: 0 0 4px;
  font-size: 11px;
  font-weight: 650;
  letter-spacing: 0.08em;
  color: var(--tt);
}

.ev-desk-t {
  margin: 0;
  font-family: var(--font-display);
  font-size: clamp(1.35rem, 2.6vw, 1.7rem);
  font-weight: 600;
  letter-spacing: -0.03em;
  color: var(--tp);
}

.ev-desk-n {
  font-family: var(--font-display);
  font-size: 1.35rem;
  font-weight: 600;
  letter-spacing: -0.04em;
  color: var(--accent);
  line-height: 1;
  padding-bottom: 4px;
}

.ev-compose {
  margin-bottom: 28px;
  padding: 18px 0 22px;
  border-top: 1px solid var(--sep);
  border-bottom: 1px solid var(--sep);
}

.ev-compose-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
}

.ev-compose-title {
  margin: 0;
  font-family: var(--font-display);
  font-size: 1.25rem;
  font-weight: 600;
  letter-spacing: -0.02em;
  color: var(--tp);
}

.ev-form {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px 16px;
}

.ev-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.ev-field-full {
  grid-column: 1 / -1;
}

.ev-lab {
  font-size: 11px;
  font-weight: 650;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--tt);
}

.ev-field input,
.ev-field textarea,
.ev-field select {
  width: 100%;
  min-height: 42px;
  padding: 10px 12px;
  border: 1px solid color-mix(in srgb, var(--accent) 22%, var(--sep));
  border-radius: 2px;
  background:
    linear-gradient(180deg, rgba(236, 230, 216, 0.03), transparent 45%),
    var(--surface-2);
  color: var(--tp);
  font: inherit;
  font-size: 14px;
  outline: none;
}

.ev-field textarea {
  min-height: 88px;
  resize: vertical;
  line-height: 1.5;
}

.ev-field input:focus,
.ev-field textarea:focus,
.ev-field select:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-ring);
}

.ev-select-wrap {
  position: relative;
}

.ev-select-wrap select {
  appearance: none;
  -webkit-appearance: none;
  padding-right: 36px;
  cursor: pointer;
}

.ev-select-chev {
  position: absolute;
  right: 14px;
  top: 50%;
  width: 7px;
  height: 7px;
  border-right: 1.5px solid var(--accent);
  border-bottom: 1.5px solid var(--accent);
  transform: translateY(-65%) rotate(45deg);
  pointer-events: none;
}

.ev-window {
  margin-top: 14px;
  padding: 12px 14px;
  border-left: 2px solid var(--accent);
  background: var(--accent-soft);
}

.ev-window-k {
  display: block;
  margin-bottom: 4px;
  font-size: 11px;
  font-weight: 650;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--accent);
}

.ev-window p {
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
  color: var(--tp);
}

.ev-compose-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 16px;
}

.ev-empty {
  padding: 48px 8px;
  border-top: 1px solid var(--sep);
}

.ev-empty-t {
  margin: 0 0 10px;
  font-family: var(--font-display);
  font-size: clamp(1.35rem, 3vw, 1.75rem);
  font-weight: 600;
  letter-spacing: -0.03em;
  color: var(--tp);
}

.ev-empty-d {
  margin: 0 0 22px;
  max-width: 42ch;
  font-size: 14px;
  line-height: 1.55;
  color: var(--ts);
}

.ev-empty-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}

.ev-list {
  list-style: none;
  margin: 0;
  padding: 0;
  border-top: 1px solid var(--sep);
}

.ev-row {
  display: grid;
  grid-template-columns: 72px 1fr;
  gap: 16px 20px;
  padding: 20px 0;
  border-bottom: 1px solid var(--sep);
}

.ev-row--mine {
  background: color-mix(in srgb, var(--accent) 6%, transparent);
  margin: 0 -12px;
  padding-left: 12px;
  padding-right: 12px;
}

.ev-date {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding-top: 2px;
}

.ev-date-d {
  font-family: var(--font-display);
  font-size: 1.65rem;
  font-weight: 600;
  letter-spacing: -0.04em;
  line-height: 1;
  color: var(--tp);
}

.ev-date-m {
  margin-top: 4px;
  font-size: 11px;
  font-weight: 650;
  letter-spacing: 0.06em;
  color: var(--tt);
}

.ev-eta {
  margin-top: 8px;
  font-size: 11px;
  font-weight: 700;
  color: var(--tt);
}

.ev-eta[data-soon='1'] {
  color: var(--accent);
}

.ev-row-top {
  margin-bottom: 8px;
}

.ev-tags {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.ev-badge {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  padding: 3px 7px;
  border-radius: 2px;
  border: 1px solid transparent;
}

.ev-badge[data-kind='confirmed'] {
  color: #1a1610;
  background: var(--accent);
}

.ev-badge[data-kind='potential'] {
  color: var(--accent);
  border-color: color-mix(in srgb, var(--accent) 45%, transparent);
}

.ev-badge[data-kind='s'] {
  color: #1a1610;
  background: var(--accent);
}

.ev-badge[data-kind='a'] {
  color: var(--accent);
  border-color: color-mix(in srgb, var(--accent) 55%, transparent);
}

.ev-badge[data-kind='b'],
.ev-badge[data-kind='c'] {
  color: var(--ts);
  border-color: var(--sep);
}

.ev-badge[data-kind='mine'] {
  color: #1a1610;
  background: var(--accent);
  text-transform: none;
  letter-spacing: 0.04em;
}

.ev-title-link {
  color: inherit;
  text-decoration: none;
}

.ev-title-link:hover {
  color: var(--accent);
}

.ev-cat {
  font-size: 11px;
  font-weight: 650;
  color: var(--ts);
}

.ev-win {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.04em;
  padding: 3px 7px;
  border-radius: 2px;
  color: var(--tt);
  background: rgba(236, 230, 216, 0.06);
}

.ev-win[data-st='open'] {
  color: #1a1610;
  background: var(--accent);
}

.ev-win[data-st='after'],
.ev-win[data-st='soon'] {
  color: var(--accent);
  background: var(--accent-soft);
}

.ev-row-title {
  margin: 0 0 10px;
  font-size: 16px;
  font-weight: 650;
  letter-spacing: -0.015em;
  line-height: 1.35;
  color: var(--tp);
}

.ev-codes {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 10px;
}

.ev-code {
  font-family: var(--mono);
  font-size: 12px;
  font-weight: 600;
  color: var(--accent);
  text-decoration: none;
  border-bottom: 1px solid color-mix(in srgb, var(--accent) 40%, transparent);
}

.ev-code:hover {
  border-bottom-color: var(--accent);
}

.ev-hint {
  margin: 0 0 8px;
  font-size: 13px;
  line-height: 1.5;
  color: var(--accent);
}

.ev-desc {
  margin: 0 0 10px;
  font-size: 13px;
  line-height: 1.55;
  color: var(--ts);
  max-width: 68ch;
}

.ev-foot {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}

.ev-src {
  font-size: 12px;
  font-weight: 650;
  color: var(--accent);
  text-decoration: none;
}

.ev-src:hover {
  text-decoration: underline;
}

.ev-src-miss {
  font-size: 11px;
  color: var(--tt);
}

.ev-del {
  appearance: none;
  margin-left: auto;
  border: 0;
  background: transparent;
  color: var(--tt);
  font: inherit;
  font-size: 12px;
  font-weight: 650;
  cursor: pointer;
  padding: 4px 0;
}

.ev-del:hover {
  color: var(--loss);
}

.ev-more {
  margin: 16px 0 0;
  font-size: 12px;
  color: var(--tt);
  line-height: 1.5;
}

.ev-more-btn {
  appearance: none;
  border: 0;
  background: transparent;
  color: var(--accent);
  font: inherit;
  font-size: 12px;
  font-weight: 650;
  cursor: pointer;
  padding: 0;
  text-decoration: underline;
}

@media (max-width: 900px) {
  .ev {
    padding-bottom: 32px;
  }
  .ev-intel {
    grid-template-columns: 1fr;
  }
  .ev-intel-cell {
    border-right: none;
    border-bottom: 1px solid var(--sep);
    padding-right: 0;
  }
  .ev-intel-cell:last-child {
    border-bottom: none;
  }
}

@media (max-width: 720px) {
  .ev-form {
    grid-template-columns: 1fr;
  }
  .ev-row {
    grid-template-columns: 56px 1fr;
    gap: 12px;
  }
}
</style>
