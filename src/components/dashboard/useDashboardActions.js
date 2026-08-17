import { computed } from 'vue'
import { usePortfolioStore } from '@/store/portfolio'
import { todayStr } from '@/utils/format'

export function useDashboardActions() {
  const portfolio = usePortfolioStore()

  const actions = computed(() => {
    const td = todayStr()
    const list = []
    portfolio.allHoldings.forEach((h) => {
      const sa = portfolio.stockAnalyses[h.code]
      if (!sa?.sent) {
        list.push({
          code: h.code,
          title: `${h.name} 待采集`,
          desc: '采集新闻与财务数据后生成信号',
          action: '去采集',
          pri: 3,
          tone: 'info',
        })
        return
      }
      const s = sa.sent
      const fin = portfolio.financialData[h.code]
      const pos = portfolio.positionFor(h.code)

      if (sa.futureEvents) {
        sa.futureEvents
          .filter((e) => e.date && e.date !== '待定' && e.date >= td)
          .forEach((e) => {
            const days = Math.ceil((new Date(e.date) - new Date()) / 864e5)
            if (days > 7) return
            const isCat = !!e.tradeHint || e.category !== 'general'
            if (!isCat && e.certainty !== 'confirmed') return
            const hint = e.tradeHint?.text
            list.push({
              code: h.code,
              title: `${days <= 1 ? '今日/明日' : days + '天后'} · ${(e.categoryLabel || e.reason || '事件').slice(0, 8)} · ${e.title.slice(0, 18)}`,
              desc: hint || `评分 ${s.total >= 0 ? '+' : ''}${s.total} · 建议仓位 ${pos?.pct ?? '—'}%`,
              action: e.tradeHint ? '交易窗口' : '查看',
              pri: days <= 2 ? 0 : 1,
              tone: 'urgent',
              url: e.url || '',
            })
          })
      }
      if (s.total >= 30) {
        list.push({
          code: h.code,
          title: `${h.name} 消息面偏强`,
          desc: `评分 +${s.total} · 建议仓位 ${pos?.pct ?? '—'}%`,
          action: '考虑加仓',
          pri: 1,
          tone: 'good',
        })
      } else if (s.total <= -20) {
        list.push({
          code: h.code,
          title: `${h.name} 消息面偏弱`,
          desc: `评分 ${s.total} · 止损 ${pos?.stopLoss ?? '—'}%`,
          action: '注意风险',
          pri: 1,
          tone: 'warn',
        })
      }
      if (fin?.marginOfSafety >= 30) {
        list.push({
          code: h.code,
          title: `${h.name} 安全边际充足`,
          desc: `折价约 ${fin.marginOfSafety}%`,
          action: '关注',
          pri: 2,
          tone: 'good',
        })
      }
    })
    list.sort((a, b) => a.pri - b.pri)
    const seen = {}
    return list
      .filter((a) => {
        if (seen[a.code] && a.pri > 1) return false
        seen[a.code] = true
        return true
      })
      .slice(0, 8)
  })

  return { actions }
}
