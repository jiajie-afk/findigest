import { getIndustry } from './industry.js'
import { ANALYSIS_DIMS } from '../data/analysis_dims.js'
import {
  extractConstraints,
  evaluateHoldings,
  applyHardConstraints,
  loadFeedbackMemory,
} from './constraints.js'
import { resolveEventSource } from '../utils/eventSource.js'
import { apiUrl } from './apiClient.js'
import { ANALYST_SYSTEM, sanitizeLlmBriefing } from './llmBriefingGuard.js'

export { ANALYST_SYSTEM, sanitizeLlmBriefing }

/** Risk thresholds tuned by user appetite */
function riskThresholds(risk) {
  const r = String(risk || '')
  // Buffett discipline: undervalued only when conservative MoS is meaningful
  if (r === '保守' || r.includes('保守')) return { strong: 35, weak: -12, mos: 28, peHigh: 0.75 }
  if (r === '激进' || r.includes('激进')) return { strong: 22, weak: -28, mos: 18, peHigh: 0.92 }
  if (r === '进取' || r.includes('进取')) return { strong: 25, weak: -24, mos: 22, peHigh: 0.88 }
  return { strong: 28, weak: -20, mos: 25, peHigh: 0.85 }
}

/** Pull causal scraps from valuation details for briefing prose. */
function dcfStoryBits(dcf) {
  if (!dcf) return { evidence: [], risk: '', method: '' }
  const details = Array.isArray(dcf.details) ? dcf.details : []
  const evidence = details
    .filter((d) => /主锚|质量|PE|PB|周期|账面|克制|封顶|收敛|逆向|勾稽|研究台|所有者盈余|巴菲特安全边际/.test(String(d)))
    .slice(0, 4)
  const risk =
    details.find((d) => /风险|失效|警示|能力圈|假精度|亏损|勾稽失败/.test(String(d))) ||
    dcf.desk?.posture ||
    dcf.actionHint ||
    ''
  return {
    evidence,
    risk: String(risk).slice(0, 120),
    method: dcf.method || dcf.modelName || dcf.archetypeLabel || '',
  }
}

function valuePlotLine(dcf, mos, name) {
  const bits = dcfStoryBits(dcf)
  const arch = dcf?.archetypeLabel || '分类估值'
  const paradigm = dcf?.primary?.paradigmName
  const quality = dcf?.quality
  const parts = [`【${arch}】`]
  if (paradigm) parts.push(`用「${paradigm}」看`)
  if (quality) parts.push(`质量判为${quality}`)
  if (mos != null) {
    parts.push(
      mos >= 0
        ? `现价相对保守内在价值大约便宜 ${mos}%`
        : `现价相对保守内在价值大约贵 ${Math.abs(mos)}%`,
    )
  }
  if (bits.risk) parts.push(`逆向注意：${bits.risk}`)
  return `${name}：${parts.join('；')}。`
}

function buildAdviceItems(holdings, analyses, financials, profile) {
  const th = riskThresholds(profile.risk)
  const items = []
  const industryMood = {}
  const preferred = profile.industries || profile.preferredIndustries || []
  const avoid = profile.avoidIndustries || []
  const weights = profile.personalWeights || {}

  holdings.forEach((h) => {
    const sa = analyses[h.code]
    const fin = financials[h.code]
    const industry = getIndustry(h.code, h.name)
    const inFocus = preferred.includes(industry)
    const isAvoid = avoid.includes(industry)

    if (!industryMood[industry]) industryMood[industry] = { sum: 0, n: 0, codes: [] }
    if (sa?.sent) {
      industryMood[industry].sum += sa.sent.total
      industryMood[industry].n += 1
      industryMood[industry].codes.push(h.code)
    }

    if (!sa?.sent) {
      items.push({
        id: `pending-${h.code}`,
        type: 'pending',
        tone: 'info',
        code: h.code,
        title: `${h.name} 尚无消息面`,
        summary: '还没有新闻/情绪数据。刷新行情后，才能谈仓位含义。',
        logic: ['持仓已记录', '未完成消息面刷新', '无法给出可解释信号'],
        trigger: '数据缺口 · 先刷新',
        priority: inFocus ? 1 : 2,
      })
      return
    }

    const s = sa.sent
    const mos = fin?.marginOfSafety
    const riskBoost = (weights.risk || 10) >= 15 ? -1 : 0

    if (isAvoid && (s.total < 0 || (mos != null && mos < 0))) {
      items.push({
        id: `avoid-${h.code}`,
        type: 'risk',
        tone: 'warn',
        code: h.code,
        title: `${h.name} 落在你的回避行业（${industry}）`,
        summary: '画像中你标记了回避该行业，当前信号偏弱，建议优先复核仓位必要性。',
        logic: ['回避行业命中', `情绪 ${s.total}`, mos != null ? `安全边际 ${mos}%` : '估值数据不足'],
        trigger: `触发来自：回避行业「${industry}」`,
        priority: 0,
      })
    }

    if (s.total <= th.weak) {
      items.push({
        id: `risk-${h.code}`,
        type: 'risk',
        tone: 'warn',
        code: h.code,
        title: `${h.name} 触发风险提醒`,
        summary: `情绪评分 ${s.total}（${s.mood}），按你的「${profile.risk}」偏好已越过偏弱阈值。`,
        logic: [
          `10 维情绪总分 ${s.total} ≤ 阈值 ${th.weak}`,
          `置信度 ${s.confidence}% · 散户情绪 ${s.rm}`,
          profile.horizon === '短线' ? '短线偏好下建议优先控仓' : '可结合基本面决定是否继续持有',
        ],
        trigger: `阈值来自：${profile.risk || '风险'}偏好`,
        priority: Math.max(0, 0 + riskBoost),
      })
    } else if (s.total >= th.strong) {
      items.push({
        id: `strong-${h.code}`,
        type: 'opportunity',
        tone: 'good',
        code: h.code,
        title: `${h.name} 消息面偏强`,
        summary: `评分 +${s.total}（${s.mood}）。${profile.style === '价值' ? '价值风格下仍需核对安全边际。' : '成长/混合风格下可关注加仓窗口。'}`,
        logic: [
          `情绪总分 ${s.total} ≥ 阈值 ${th.strong}`,
          `叙事：${(s.narrative || '').slice(0, 80) || '暂无摘要'}`,
          `估值权重偏好：${profile.valuationWeight}`,
        ],
        trigger: `阈值来自：${profile.risk || '风险'}偏好 · ${profile.style || '风格'}`,
        priority: 1,
      })
    }

    if (
      mos != null &&
      mos >= (fin?.dcf?.mosBuyMin || th.mos) &&
      (!fin?.dcf?.pePercentile || fin.dcf.pePercentile <= 45) &&
      fin?.dcf?.competence !== 'hard'
    ) {
      const bits = dcfStoryBits(fin?.dcf)
      items.push({
        id: `mos-${h.code}`,
        type: 'undervalued',
        tone: 'good',
        code: h.code,
        title: `${h.name} 进入相对低估区间`,
        summary:
          profile.style === '价值'
            ? valuePlotLine(fin?.dcf, mos, h.name)
            : `【${fin?.dcf?.archetypeLabel || '分类估值'}】保守MoS ${mos}%（门槛 ${fin?.dcf?.mosBuyMin || th.mos}%）${fin?.dcf?.verdict ? ' · ' + fin.dcf.verdict : ''}。${fin?.dcf?.primary?.paradigmName ? ' 主视角 ' + fin.dcf.primary.paradigmName + '。' : ''}`,
        logic: [
          `方法: ${bits.method || fin?.dcf?.method || fin?.dcf?.modelName || industry}`,
          `质量 ${fin?.dcf?.quality || '—'} · PE分位 ${fin?.dcf?.pePercentile ?? '—'}%`,
          ...bits.evidence,
          ...(fin?.dcf?.invertRisks || []).slice(0, 2).map((r) => `逆向: ${r}`),
          ...(fin?.dcf?.angles || []).slice(0, 2),
          fin?.dcf?.actionHint || '按分类保守估值决策',
        ].filter(Boolean),
        trigger: `低估判定来自：${fin?.dcf?.archetypeLabel || '分类'} · ${fin?.dcf?.primary?.paradigmName || '保守安全边际'}`,
        priority: mos >= 35 ? 0 : 1,
      })
    } else if (mos != null && mos < 0) {
      const bits = dcfStoryBits(fin?.dcf)
      items.push({
        id: `over-${h.code}`,
        type: 'overvalued',
        tone: 'warn',
        code: h.code,
        title: `${h.name} 相对估值偏贵`,
        summary:
          profile.style === '价值'
            ? valuePlotLine(fin?.dcf, mos, h.name)
            : `现价高于模型内在价值约 ${Math.abs(mos)}%。${bits.risk ? ' ' + bits.risk : ''}`,
        logic: [
          `安全边际 ${mos}%`,
          `行业：${industry}${bits.method ? ` · ${bits.method}` : ''}`,
          ...bits.evidence.slice(0, 2),
          profile.risk === '保守' || String(profile.risk || '').includes('保守')
            ? '保守偏好下建议降低仓位敏感度'
            : '可用止盈纪律管理',
        ].filter(Boolean),
        trigger: `估值判定来自：${profile.valuationWeight || '综合'}模型`,
        priority: 1,
      })
    }

    const vetoLens = (fin?.dcf?.lensStack?.lenses || []).find((L) => L.triggeredVeto)
    if (vetoLens?.triggeredVeto) {
      items.push({
        id: `lens-veto-${h.code}`,
        type: 'lens_veto',
        tone: 'warn',
        code: h.code,
        title: `${h.name} 透镜硬否决`,
        summary: `【${vetoLens.nameZh}】触发：${vetoLens.triggeredVeto.label}${vetoLens.triggeredVeto.evidence ? '（' + vetoLens.triggeredVeto.evidence + '）' : ''}。框架条件结论，非「某人会卖」。`,
        logic: [
          vetoLens.verdictText,
          fin?.dcf?.lensStack?.disagreement
            ? `透镜分歧根因：${fin.dcf.lensStack.disagreementRoot || '—'}（未平均）`
            : '两透镜独立运行',
        ].filter(Boolean),
        trigger: '投资者透镜硬否决',
        priority: 1,
      })
    } else if (fin?.dcf?.lensStack?.disagreement && fin.dcf.lensStack.losingStrongestPoint) {
      items.push({
        id: `lens-split-${h.code}`,
        type: 'lens_disagreement',
        tone: 'info',
        code: h.code,
        title: `${h.name} 透镜分歧`,
        summary: `根因 ${fin.dcf.lensStack.disagreementRoot || '—'}；弱势侧要点：${fin.dcf.lensStack.losingStrongestPoint}`,
        logic: (fin.dcf.lensStack.lenses || []).map((L) => `${L.nameZh}→${L.verdict}`),
        trigger: '投资者透镜堆叠（不平均判决）',
        priority: 2,
      })
    }

    // 催化剂交易窗口：价值风格降权（不当主叙事）
    const events = sa.futureEvents || sa.sent?.futureEvents || []
    const valueStyle = profile.style === '价值'
    events
      .filter((e) => e.tradeHint && e.date && e.date !== '待定')
      .slice(0, valueStyle ? 1 : 3)
      .forEach((e, idx) => {
        const days = Math.ceil((new Date(e.date) - new Date()) / 864e5)
        if (days < -2 || days > 21) return
        const thHint = e.tradeHint
        const src = resolveEventSource(e, h.code)
        items.push({
          id: `cat-${h.code}-${idx}-${e.date}`,
          type: 'catalyst',
          tone: days <= 3 ? 'urgent' : 'info',
          code: h.code,
          title: valueStyle
            ? `${h.name} · 日历提醒：${(e.title || '').slice(0, 28)}`
            : `${h.name} · ${thHint.label || '催化剂'}：${(e.title || '').slice(0, 28)}`,
          summary: valueStyle
            ? `事件日 ${e.date}。价值框架下只作日历提醒，不改安全边际结论；仍以分类保守估值为主。`
            : thHint.text || `事件日 ${e.date}，可按事件驱动节奏交易。`,
          logic: [
            `事件日 ${e.date}（${days <= 0 ? '今日/已到' : days + '天后'}）`,
            `确定性 ${e.certainty || '—'} · 重要度 ${e.importance || '—'}`,
            valueStyle
              ? '价值风格：事件≠内在价值变化'
              : thHint.buyFrom
                ? `建议布局截止 ${thHint.buyFrom}`
                : '关注事件前布局',
            valueStyle
              ? '事件后复核基本面与价格是否背离'
              : thHint.sellBy
                ? `事件后评估至 ${thHint.sellBy}`
                : '事件后评估兑现',
            (e.source || src.source) ? `来源：${e.source || src.source}` : null,
          ].filter(Boolean),
          trigger: valueStyle
            ? '价值风格日历提醒'
            : `催化剂类型：${thHint.label || e.categoryLabel || '事件驱动'}`,
          url: e.url || src.url || '',
          source: e.source || src.source || '',
          priority: valueStyle ? 3 : days <= 2 ? 0 : 1,
        })
      })
  })

  Object.entries(industryMood).forEach(([industry, m]) => {
    if (m.n < 1) return
    const avg = m.sum / m.n
    if (avg > 8) {
      items.push({
        id: `ind-up-${industry}`,
        type: 'industry',
        tone: 'good',
        code: m.codes[0],
        title: `${industry} 情绪偏暖`,
        summary: `持仓内该行业均分 ${avg.toFixed(0)}，可留意同业观察标的。`,
        logic: [`样本 ${m.n} 只`, `均分 ${avg.toFixed(1)}`, preferred.includes(industry) ? '属于你关注行业' : '非关注行业，权重较低'],
        trigger: preferred.includes(industry) ? '优先级来自：关注行业命中' : '持仓行业情绪汇总',
        priority: preferred.includes(industry) ? 1 : 3,
      })
    } else if (avg < -8) {
      items.push({
        id: `ind-down-${industry}`,
        type: 'industry',
        tone: 'warn',
        code: m.codes[0],
        title: `${industry} 情绪偏冷`,
        summary: `持仓内该行业均分 ${avg.toFixed(0)}，注意联动风险。`,
        logic: [`样本 ${m.n} 只`, `均分 ${avg.toFixed(1)}`],
        trigger: '持仓行业情绪汇总',
        priority: 1,
      })
    }
  })

  preferred.forEach((ind) => {
    if (!industryMood[ind] || industryMood[ind].n === 0) {
      items.push({
        id: `watch-${ind}`,
        type: 'watchlist',
        tone: 'info',
        code: null,
        title: `观察名单：${ind}`,
        summary: '你标记了该行业，但当前持仓中暂无已分析样本。',
        logic: ['来自投资画像·关注行业', '导入该行业持仓后会出现在今日'],
        trigger: '来自画像：关注行业',
        priority: 3,
      })
    }
  })

  items.sort((a, b) => a.priority - b.priority)
  return items.slice(0, 12)
}

function buildLocalNarrative(profile, items, holdings, constraints) {
  const riskItems = items.filter((i) => i.type === 'risk' || i.type === 'overvalued' || i.type === 'constraint')
  const oppItems = items.filter((i) => i.type === 'undervalued' || i.type === 'opportunity')
  const lensItems = items.filter((i) => i.type === 'lens_veto' || i.type === 'lens_disagreement')
  const parts = []
  const isValue = profile.style === '价值'

  if (constraints?.mode === 'locked') {
    return `观察模式：私人定制 ${constraints.answered}/${constraints.total} 未完成，完整管家建议已锁定。请先完成设置中的 88 道细分题。`
  }

  if (isValue) {
    parts.push(
      `价值框架下，今日从 ${holdings.length} 只持仓先问「是什么生意、值多少钱、错在哪里」，整理出 ${items.length} 条可解释建议（侧重安全边际与能力圈，而非短线催化剂）。`,
    )
  } else {
    parts.push(
      `按你的画像（${profile.style}·${profile.risk}·${profile.horizon}，估值侧重${profile.valuationWeight}），今日从 ${holdings.length} 只持仓中整理出 ${items.length} 条可解释建议。`,
    )
  }
  if (constraints && !constraints.complete) {
    parts.push(
      `私人定制进度 ${constraints.answered}/${constraints.total}，未完成前建议偏保守。`,
    )
  } else if (constraints?.maxDrawdownPct != null || constraints?.singleStockMaxPct != null) {
    parts.push(
      `硬约束生效：回撤容忍 ${constraints.maxDrawdownPct ?? '—'}% · 单票上限 ${constraints.singleStockMaxPct ?? '—'}%。`,
    )
  }
  if (lensItems.length) {
    parts.push(
      `透镜先讲清楚：${lensItems
        .slice(0, 2)
        .map((i) => i.title)
        .join('；')}。`,
    )
  }
  if (riskItems.length) {
    parts.push(
      isValue
        ? `先逆向：${riskItems
            .slice(0, 2)
            .map((i) => i.summary || i.title)
            .join(' ')}`
        : `风险/约束优先：${riskItems
            .slice(0, 2)
            .map((i) => i.title.replace(/触发.*/, '').trim())
            .join('、')}。`,
    )
  }
  if (oppItems.length) {
    parts.push(
      isValue
        ? `再看折扣是否够厚：${oppItems
            .slice(0, 2)
            .map((i) => i.summary || i.title)
            .join(' ')}`
        : `机会侧：${oppItems
            .slice(0, 2)
            .map((i) => i.title)
            .join('；')}。`,
    )
  }
  if (profile.adoptPattern) {
    parts.push(`历史反馈：${profile.adoptPattern}。`)
  }
  if (!riskItems.length && !oppItems.length) {
    parts.push(
      isValue
        ? '当前持仓暂无明显「够厚的折扣」或「硬否决」，建议先补齐财务数据，再谈仓位含义。'
        : '当前持仓信号整体中性，建议先刷新待补行情的标的，再看今日。',
    )
  }

  return parts.join('')
}

function getActiveDimensions(analyses) {
  const active = {}
  for (const a of Object.values(analyses || {})) {
    if (!a?.sent?.dimScores) continue
    for (const [k, v] of Object.entries(a.sent.dimScores)) {
      if (v && v.score !== 0) active[k] = (active[k] || 0) + 1
    }
  }
  return active
}

function calcDataCompleteness(holdings, analyses, financials) {
  let total = 0
  let filled = 0
  ;(holdings || []).forEach((h) => {
    total += 3
    if (analyses?.[h.code]?.sent) filled++
    if (financials?.[h.code]?.roe) filled++
    if (analyses?.[h.code]?.sent?.dimScores) filled++
  })
  return total > 0 ? Math.round((filled / total) * 100) : 0
}

/** Full analyst prompt — LLM does independent judgment, not polish */
function buildAnalystPrompt({ holdings, analyses, financials, userProfile, items, constraints, violations }) {
  const sections = []
  const personalityTags = (userProfile.personality || [])
    .map((p) => p.tag || p)
    .filter(Boolean)
    .join('、')

  sections.push(`## 用户画像
- 风格：${userProfile.style || '未设定'}
- 风险偏好：${userProfile.risk || '未设定'}
- 持有周期：${userProfile.horizon || '未设定'}
- 估值侧重：${userProfile.valuationWeight || '综合'}
- 性格标签：${personalityTags || '数据积累中'}
- 关注行业：${(userProfile.industries || userProfile.preferredIndustries || []).join('、') || '未设定'}
- 回避行业：${(userProfile.avoidIndustries || []).join('、') || '无'}
- 个性化权重：${JSON.stringify(userProfile.personalWeights || userProfile.weights || {})}`)

  if (constraints) {
    sections.push(`## 硬约束（必须遵守）
- 模式：${constraints.mode}
- 回撤容忍：${constraints.maxDrawdownPct ?? '未设'}%
- 单票上限：${constraints.singleStockMaxPct ?? '未设'}%
- 触碰约束：${(violations || []).map((v) => `${v.name}:${v.message}`).join('；') || '无'}
- 规则：触碰单票/回避行业的标的禁止任何加仓或买入措辞；回撤接近上限时只写风控与复核。硬约束一票否决「机会」里的加仓语言。`)
  }

  const holdingLines = (holdings || []).slice(0, 12).map((h) => {
    const fin = financials?.[h.code] || {}
    const dcf = fin.dcf || {}
    const angles = (dcf.angles || []).slice(0, 3).join('；')
    const sec = (dcf.secondary || [])
      .slice(0, 2)
      .map((s) => s.paradigmName)
      .filter(Boolean)
      .join('、')
    const ls = dcf.lensStack
    let lensLine = '—'
    if (ls?.lenses?.length) {
      lensLine = ls.lenses
        .map((L) => `${L.nameZh}→${L.verdict}${L.triggeredVeto ? '(否决:' + L.triggeredVeto.label + ')' : ''}`)
        .join('；')
      if (ls.disagreement) {
        lensLine += `｜分歧=${ls.disagreementRoot || '—'}（勿平均）${ls.losingStrongestPoint ? '｜弱势侧:' + ls.losingStrongestPoint : ''}`
      }
    }
    return `### ${h.name}（${h.code}）
价格：¥${h.price ?? '—'} | PE(TTM)：${fin.pe_ttm ?? '—'} | PB：${fin.pb ?? '—'} | ROE：${fin.roe ?? '—'}% | EPS：${fin.eps ?? '—'} | 安全边际：${fin.marginOfSafety ?? '—'}%
估值视角：主 ${dcf.primary?.paradigmName || dcf.paradigmName || '—'}（${dcf.archetypeLabel || dcf.archetype || '—'}）${sec ? ` · 辅 ${sec}` : ''}
思维角度：${angles || '—'}
投资者透镜：${lensLine}`
  })
  const allow = (holdings || []).map((h) => `${h.name}（${h.code}）`).join('、')
  sections.push(`## 分析范围（强制）
只允许讨论这些已记录持仓：${allow || '无'}。禁止范围外股票、荐股清单、指数择时。`)
  sections.push(`## 持仓标的\n${holdingLines.join('\n\n') || '暂无持仓'}`)
  sections.push(`## 估值纪律（强制）
- 内在价值 / 安全边际 / 主锚由本地引擎给出；你只解释 angles、primary/secondary 名称与 details
- 禁止自行重算目标价、改写 MoS，或假装存在 100 套独立 DCF 引擎
- 若存在 lensStack：报告分歧与根因（horizon/caliber/risk/information），禁止平均两透镜判决；禁止写「巴菲特会买/芒格会买」等拟人权威句
- 硬否决只陈述框架条件，不升级为下单指令
- 禁止 BUY/SELL/HOLD、ENTRY/STOP/SIZE、进场价、止损价、仓位下单比例`)

  const dimLines = []
  for (const [code, a] of Object.entries(analyses || {})) {
    if (!a?.sent?.dimScores) continue
    const active = Object.entries(a.sent.dimScores)
      .filter(([, v]) => v && v.score !== 0)
      .map(([k, v]) => {
        const meta = ANALYSIS_DIMS[k]
        const w = meta?.weight != null ? Math.round(meta.weight * 100) : 0
        return `  ${meta?.icon || ''} ${meta?.label || k}(${w}%)：${v.score}分[${v.grade || ''}] ${(v.evidence || []).slice(0, 3).join('；')}`
      })
    if (active.length) dimLines.push(`### ${code}\n${active.join('\n')}`)
  }
  if (dimLines.length) sections.push(`## 10 维度评分（有信号）\n${dimLines.join('\n\n')}`)

  const sentLines = []
  for (const [code, a] of Object.entries(analyses || {})) {
    if (!a?.sent) continue
    const s = a.sent
    sentLines.push(
      `${code}：总分${s.total}(${s.mood}) | 置信${s.confidence}% | 散户${s.rm} | 正面${s.bull?.length || 0}条 负面${s.bear?.length || 0}条`,
    )
  }
  if (sentLines.length) sections.push(`## 情绪概览\n${sentLines.join('\n')}`)

  const eventLines = []
  const horizon = Date.now() + 30 * 24 * 3600 * 1000
  for (const [code, a] of Object.entries(analyses || {})) {
    ;(a?.sent?.futureEvents || []).forEach((e) => {
      const t = e.date ? Date.parse(e.date) : NaN
      if (!Number.isNaN(t) && t > horizon) return
      eventLines.push(`- [${e.certainty || '未知'}] ${code}: ${e.title}（${e.date || '日期未知'}）`)
    })
  }
  if (eventLines.length) sections.push(`## 未来事件（约30天内）\n${eventLines.slice(0, 20).join('\n')}`)

  const dqLines = []
  for (const [code, a] of Object.entries(analyses || {})) {
    if (!a?.sent?.dataQuality) continue
    const q = a.sent.dataQuality
    dqLines.push(
      `${code}：${q.level}（${q.score}/9）${q.issues?.length ? '—' + q.issues.join('；') : ''}`,
    )
  }
  if (dqLines.length) sections.push(`## 数据质量\n${dqLines.join('\n')}`)

  sections.push(`## 本地引擎初步建议（仅供参考，请独立判断）
${JSON.stringify((items || []).slice(0, 6), null, 2)}`)

  sections.push(`## 分析任务
你在「用人话重写」本地简报，不是交易员。只解释引擎已给出的条目与数字，不另开一套买卖系统。

内部按四层取证（层名不是买卖信号）：
1. 证据：技术结构 / 新闻情绪 / 基本面口径 / 宏观背景——只解释「这条为何出现在今日」
2. 对质：每只持仓各写多头最强一句、空头最强一句；禁止宣布某方获胜并据此买入
3. 风控：用上面的硬约束做压力测试；触碰则否决加仓措辞
4. 收束：对照「本地引擎初步建议」同序强调最多三条「今日该看」

要求：
1. 第一段必须是一句白话主题（不要 ###、不要 SIGNAL）；硬约束若触发必须出现在第一句
2. 价值风格按「生意→价格→逆向」写；催化剂只作日历，不改安全边际
3. 数据不足标「低置信度」；禁止空话和无主锚的「长期看好」
4. 禁止输出 BUY/SELL/HOLD、ENTRY/STOP/SIZE、目标价、止损价、进场区间、下单指令、必买清单
5. 仓位只写约束含义（如「已触及单票上限，默认不加仓」），不写「买 3%」

## 输出格式
（第一句主题）

### 对质（仅持仓）
**名称（代码）**
- 多头最强：
- 空头最强：
- 硬约束：通过门禁 / 否决加仓（写明哪条）
- 依据：引用 MoS、主锚、事件；不写点位
- 置信度：高/中/低

### 今日该看
1. [风险/观察/机会] …（与本地条目同序，最多 3 条；机会不得写成加仓指令）`)

  return sections.join('\n\n')
}

export async function callLLM(aiConfig, prompt, opts = {}) {
  const url = `${aiConfig.baseUrl.replace(/\/$/, '')}/chat/completions`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${aiConfig.apiKey}`,
    },
    body: JSON.stringify({
      model: aiConfig.model || 'deepseek-chat',
      temperature: opts.temperature ?? 0.6,
      max_tokens: opts.maxTokens ?? 1200,
      messages: [
        { role: 'system', content: opts.system || ANALYST_SYSTEM },
        { role: 'user', content: prompt },
      ],
    }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`LLM ${res.status}: ${text.slice(0, 160)}`)
  }
  const data = await res.json()
  const text = data.choices?.[0]?.message?.content?.trim() || ''
  const usage = data.usage || null
  reportUsageQuiet({
    promptTokens: usage?.prompt_tokens,
    completionTokens: usage?.completion_tokens,
    totalTokens: usage?.total_tokens,
    model: aiConfig.model || 'deepseek-chat',
    promptLen: prompt?.length || 0,
    replyLen: text.length,
  })
  return text
}

/** Best-effort token report for admin console (does not block briefing). */
function reportUsageQuiet(info) {
  try {
    let promptTokens = Number(info.promptTokens) || 0
    let completionTokens = Number(info.completionTokens) || 0
    let totalTokens = Number(info.totalTokens) || 0
    if (!totalTokens && !promptTokens && !completionTokens) {
      // Rough estimate when provider omits usage (~4 chars / token for CJK-ish mix)
      promptTokens = Math.ceil((Number(info.promptLen) || 0) / 4)
      completionTokens = Math.ceil((Number(info.replyLen) || 0) / 4)
      totalTokens = promptTokens + completionTokens
    }
    if (!totalTokens) return
    fetch(apiUrl('/api/usage'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        promptTokens,
        completionTokens,
        totalTokens,
        model: info.model || '',
      }),
    }).catch(() => {})
  } catch {
    /* ignore */
  }
}

/**
 * Generate personalized daily analyst report.
 * Default: fully local explainable engine.
 * Optional: OpenAI-compatible LLM as independent analyst (not polish layer).
 */
export async function generateDailyReport({
  holdings,
  analyses,
  financials,
  userProfile,
  aiConfig,
  personalizedPrompt,
  rawProfile,
  portfolioMv = 0,
  portfolioPlPct = 0,
  getPrice,
}) {
  const constraints = extractConstraints(userProfile, rawProfile)
  if (!(holdings || []).length) {
    return {
      id: Date.now(),
      date: new Date().toISOString(),
      source: 'local',
      headline: '先把持仓放进来。没有股票，就没有今日简报。',
      items: [],
      constraints,
      violations: [],
      profileSnapshot: {
        style: userProfile?.style,
        risk: userProfile?.risk,
        mode: constraints.mode,
        dataCompleteness: 0,
      },
    }
  }
  const { violations } = evaluateHoldings(holdings, portfolioMv, getPrice, constraints)
  let items = buildAdviceItems(holdings, analyses, financials, userProfile)
  items = applyHardConstraints(items, {
    violations,
    constraints,
    portfolioPlPct,
    feedback: loadFeedbackMemory(),
  })

  const headline = buildLocalNarrative(userProfile, items, holdings, constraints)
  let llmText = null
  let source = 'local'

  if (constraints.mode !== 'locked' && aiConfig?.enabled && aiConfig.apiKey) {
    try {
      const prompt = buildAnalystPrompt({
        holdings,
        analyses,
        financials,
        userProfile,
        items,
        constraints,
        violations,
      })
      const fullPrompt = personalizedPrompt
        ? `${prompt}\n\n## 补充画像上下文\n${personalizedPrompt}`
        : prompt
      llmText = sanitizeLlmBriefing(
        await callLLM(aiConfig, fullPrompt, { temperature: 0.6, maxTokens: 1400 }),
      )
      source = 'llm'
    } catch (e) {
      source = 'local+llm_fallback'
      llmText = null
      console.warn('[ai] LLM failed, using local report', e)
    }
  }

  return {
    id: Date.now(),
    date: new Date().toISOString(),
    source,
    headline: llmText || headline,
    items,
    constraints,
    violations,
    profileSnapshot: {
      style: userProfile.style,
      risk: userProfile.risk,
      industries: userProfile.industries || userProfile.preferredIndustries,
      horizon: userProfile.horizon,
      valuationWeight: userProfile.valuationWeight,
      personality: (userProfile.personality || []).slice(0, 3).map((p) => p.tag || p),
      weights: userProfile.personalWeights,
      activeDimensions: getActiveDimensions(analyses),
      dataCompleteness: calcDataCompleteness(holdings, analyses, financials),
      mode: constraints.mode,
      scenarioProgress: `${constraints.answered}/${constraints.total}`,
      maxDrawdown: constraints.maxDrawdownPct,
      singleStockMax: constraints.singleStockMaxPct,
    },
  }
}
