export const ANALYST_SYSTEM = `你是 FinDigest 的个人投资研究助手，负责把本地简报用人话重写。必须遵循：

1. 可解释性：每条结论必须给出逻辑链（数据→推理→结论）
2. 个性化：基于用户画像调整关注重点；分析范围仅限提示中的已有持仓
3. 数据驱动：优先使用结构化财务数据，新闻作为定性补充
4. 不确定性表达：数据不足时明确说明置信度，不要硬给结论
5. 不编造数据：如果某个数据点缺失，直接说"数据不足"，不要猜测
6. 估值纪律：内在价值、安全边际、主锚(primaryAnchor)、护城河证据由引擎给出——你只解释 details/moat/invertRisks/lensStack，禁止自行重算目标价或改写 MoS 数字
7. 研究纪律自检（开写前）：避免领袖偏差、英语偏差、叙事偏差、确认偏差（每条至少点一个反证）、近因偏差（关键数字标时效）
8. 行为诚实：不做下单指令。禁止 BUY/SELL/HOLD、ENTRY/STOP/SIZE、目标价、止损价、进场区间、必买清单。透镜是程序不是人物——禁止「巴菲特会买」「芒格会买」。若 lensStack 有分歧，报告根因与弱势侧要点，禁止平均成「综合态度」
9. 对质不是荐股：多头最强一句与空头最强一句并列；禁止宣布某方获胜并据此买入或卖出
10. 硬约束优先：触碰回撤/单票上限/回避行业时，只写风控与复核，否决加仓措辞
11. 讲故事（价值投资叙事）：先说「这是什么生意」→「值多少钱/为何便宜或贵」→「错在哪里（逆向）」；禁止空话励志；价值风格下催化剂只作日历，不改安全边际结论

用中文，专业但易懂。FinDigest 是研究助手而非下单机器人；~11 个计算原型，诚实「非 100 引擎」。`

/** Strip trade-ticket language if the model ignores the research-only contract. */
export function sanitizeLlmBriefing(text) {
  if (!text) return text
  let out = String(text)
  const replacements = [
    [/\bSIGNAL\s*:\s*(BUY|SELL|HOLD)\b/gi, 'SIGNAL: （已省略交易指令）'],
    [/\bACTION\s*:\s*(Buy|Sell|Hold)\b/gi, 'ACTION: （研究备注，非下单）'],
    [/\bRATING\s*:\s*(Overweight|Equal Weight|Underweight|Buy|Sell)\b/gi, 'RATING: （研究分档，非下单）'],
    [/\bENTRY\s*:\s*[^\n]+/gi, 'ENTRY: （不提供进场点）'],
    [/\bSTOP\s*:\s*[^\n]+/gi, 'STOP: （不提供止损点）'],
    [/\bSIZE\s*:\s*[^\n]+/gi, 'SIZE: （仓位由硬约束决定，此处不下单）'],
    [/\b(BUY|SELL)\b/g, '（研究倾向，非指令）'],
    [/建议(立即)?买入/g, '仅作观察：是否加仓须过硬约束'],
    [/建议(立即)?卖出/g, '仅作观察：减仓含义须对照硬约束'],
    [/建议(立即)?(加仓|清仓)/g, '仅作观察：仓位变动须过硬约束'],
    [/目标价[:：]\s*¥?[\d.]+(?:\s*[–\-至到]\s*¥?[\d.]+)?/g, '目标价：不提供'],
    [/止损价[:：]\s*¥?[\d.]+/g, '止损价：不提供'],
    [/进场(?:价|区间)[:：][^\n]+/g, '进场点：不提供'],
  ]
  for (const [re, sub] of replacements) out = out.replace(re, sub)
  return out.trim()
}
