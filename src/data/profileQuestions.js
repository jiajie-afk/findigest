/**
 * FinDigest 私人定制画像 — 88 道细分情景题
 * 8 章 × 11 题；选项 patch 由 applyScenarioAnswers 聚合（数值取均值）
 */

function opt(key, label, patch) {
  return { key, label, patch }
}

function q(id, section, text, options) {
  return { id, section, text, options }
}

export const PROFILE_SECTIONS = [
  { id: 'identity', title: '身份与资金', blurb: '你的钱从哪来、能承受什么约束' },
  { id: 'risk', title: '风险与回撤', blurb: '真正亏钱时你会怎么做' },
  { id: 'horizon', title: '时间与仓位', blurb: '你愿意等多久、集中还是分散' },
  { id: 'philosophy', title: '哲学与风格', blurb: '价值、成长、主动还是被动' },
  { id: 'info', title: '信息与决策', blurb: '你信什么信号、决策有多快' },
  { id: 'bias', title: '情绪与偏差', blurb: '锚定、从众、确认偏误等' },
  { id: 'trigger', title: '买卖触发', blurb: '什么消息真正让你动手' },
  { id: 'discipline', title: '纪律与偏好', blurb: '市场、市值、规则与禁忌' },
]

/** @type {Array<{id:string,section:string,text:string,options:Array}>} */
export const SCENARIO_QUESTIONS = [
  // ── 01 身份与资金 (11) ──
  q('s1q01', 'identity', '这笔股票资金对你意味着？', [
    opt('A', '绝对不能大亏的生活备用金', { risk: { maxDrawdown: '8%', lossAversion: 5 }, capitalRole: 'emergency' }),
    opt('B', '3–5 年内用得上的目标储蓄', { risk: { maxDrawdown: '15%', lossAversion: 4 }, capitalRole: 'goal' }),
    opt('C', '可长期锁定的增值资金', { risk: { maxDrawdown: '25%', lossAversion: 2 }, capitalRole: 'growth' }),
    opt('D', '可承受大幅波动的风险预算', { risk: { maxDrawdown: '40%', lossAversion: 1 }, capitalRole: 'risk_budget' }),
  ]),
  q('s1q02', 'identity', '未来 12 个月，你大概率还会往股市加钱吗？', [
    opt('A', '几乎每月定投', { cashFlow: 'monthly_in', philosophy: { activeVsPassive: 2 } }),
    opt('B', '有奖金/结余就加', { cashFlow: 'irregular_in' }),
    opt('C', '基本不加，只用存量', { cashFlow: 'static' }),
    opt('D', '可能要取出一部分应急', { cashFlow: 'likely_out', risk: { lossAversion: 4 } }),
  ]),
  q('s1q03', 'identity', '你的主要收入稳定性更接近？', [
    opt('A', '稳定工资/编制', { incomeStability: 5, risk: { maxDrawdown: '25%' } }),
    opt('B', '稳定但有业绩浮动', { incomeStability: 4 }),
    opt('C', '经营/自由职业，波动大', { incomeStability: 2, risk: { maxDrawdown: '15%', lossAversion: 4 } }),
    opt('D', '阶段性无主动收入', { incomeStability: 1, risk: { maxDrawdown: '10%', lossAversion: 5 } }),
  ]),
  q('s1q04', 'identity', '若股市亏 20%，对你日常生活的影响？', [
    opt('A', '几乎无感，不动生活预算', { risk: { maxDrawdown: '35%', lossAversion: 1 } }),
    opt('B', '有心理压力，但能正常生活', { risk: { maxDrawdown: '20%', lossAversion: 3 } }),
    opt('C', '会明显压缩消费/旅行', { risk: { maxDrawdown: '12%', lossAversion: 4 } }),
    opt('D', '可能影响刚需支出', { risk: { maxDrawdown: '8%', lossAversion: 5 } }),
  ]),
  q('s1q05', 'identity', '你更希望管家优先保护什么？', [
    opt('A', '本金安全，少犯错', { risk: { lossAversion: 5 }, philosophy: { valueVsGrowth: 1 } }),
    opt('B', '收益与回撤的平衡', { risk: { lossAversion: 3 }, philosophy: { valueVsGrowth: 3 } }),
    opt('C', '抓住上行机会，容忍波动', { risk: { lossAversion: 2 }, philosophy: { valueVsGrowth: 4 } }),
    opt('D', '尽量不跑输强势赛道', { risk: { lossAversion: 2 }, philosophy: { valueVsGrowth: 5, contrarianVsMomentum: 5 } }),
  ]),
  q('s1q06', 'identity', '你有多少「真正懂」的行业/生意？', [
    opt('A', '几乎没有，主要看公开信息', { knowledgeEdge: 1, philosophy: { 集中Vs分散: 4 } }),
    opt('B', '1–2 个相关领域', { knowledgeEdge: 3, philosophy: { 集中Vs分散: 2 } }),
    opt('C', '本职相关，有信息优势', { knowledgeEdge: 4, philosophy: { 集中Vs分散: 1 } }),
    opt('D', '跨多个领域都敢深挖', { knowledgeEdge: 5, philosophy: { fundamentalVsTechnical: 1 } }),
  ]),
  q('s1q07', 'identity', '家人/伴侣对你炒股的态度？', [
    opt('A', '支持且不怎么干预', { socialPressure: 1 }),
    opt('B', '中性，亏多了会问', { socialPressure: 3, risk: { lossAversion: 3 } }),
    opt('C', '偏反对，希望稳健', { socialPressure: 4, risk: { maxDrawdown: '12%', lossAversion: 4 } }),
    opt('D', '无所谓/不知情', { socialPressure: 2 }),
  ]),
  q('s1q08', 'identity', '你每晚愿意为投资花多少时间？', [
    opt('A', '几乎不看，靠系统提醒', { philosophy: { activeVsPassive: 1 }, decisionSpeed: 'slow', timeBudget: 'minimal' }),
    opt('B', '15–30 分钟扫一眼', { timeBudget: 'light', decisionSpeed: 'moderate' }),
    opt('C', '1 小时深度研究', { timeBudget: 'deep', philosophy: { fundamentalVsTechnical: 1 } }),
    opt('D', '随时盯盘，可交易', { timeBudget: 'full', philosophy: { activeVsPassive: 5 }, decisionSpeed: 'fast' }),
  ]),
  q('s1q09', 'identity', '税务/账户约束对你重要吗？', [
    opt('A', '很重要，少做短线', { taxSensitivity: 5, philosophy: { activeVsPassive: 1 } }),
    opt('B', '有点在意', { taxSensitivity: 3 }),
    opt('C', '几乎不考虑', { taxSensitivity: 1 }),
    opt('D', '有额度/通道限制', { taxSensitivity: 4, exchangePreference: 'A' }),
  ]),
  q('s1q10', 'identity', '你更认同哪句自我描述？', [
    opt('A', '我是长期所有者', { philosophy: { activeVsPassive: 1, valueVsGrowth: 2 } }),
    opt('B', '我是机会主义者', { philosophy: { activeVsPassive: 4, contrarianVsMomentum: 3 } }),
    opt('C', '我是风控优先者', { risk: { lossAversion: 5, stopLossDiscipline: 5 } }),
    opt('D', '我是学习型选手，边做边改', { decisionSpeed: 'moderate', confirmationBias: 2 }),
  ]),
  q('s1q11', 'identity', '若 AI 管家与你直觉冲突，你更信？', [
    opt('A', '先信系统，再复盘直觉', { trustAi: 5, confirmationBias: 2 }),
    opt('B', '各半，要求解释清楚', { trustAi: 3 }),
    opt('C', '直觉优先，系统作参考', { trustAi: 2, confirmationBias: 4 }),
    opt('D', '冲突就先不动', { trustAi: 3, decisionSpeed: 'slow' }),
  ]),

  // ── 02 风险与回撤 (11) ──
  q('s2q01', 'risk', '单只股票从买入到浮亏 10%，你通常？', [
    opt('A', '加仓摊薄，若逻辑仍在', { risk: { lossAversion: 1 }, philosophy: { contrarianVsMomentum: 1 } }),
    opt('B', '持有观察，设更紧止损', { risk: { stopLossDiscipline: 4, lossAversion: 3 } }),
    opt('C', '减仓一半控制风险', { risk: { lossAversion: 4, stopLossDiscipline: 4 } }),
    opt('D', '接近止损线就清掉', { risk: { lossAversion: 5, stopLossDiscipline: 5 } }),
  ]),
  q('s2q02', 'risk', '组合最大回撤到多少你会「睡不着」？', [
    opt('A', '5% 以内就开始难受', { risk: { maxDrawdown: '8%', lossAversion: 5 } }),
    opt('B', '约 10–15%', { risk: { maxDrawdown: '15%', lossAversion: 4 } }),
    opt('C', '约 20–25%', { risk: { maxDrawdown: '25%', lossAversion: 2 } }),
    opt('D', '30%+ 仍能按计划执行', { risk: { maxDrawdown: '40%', lossAversion: 1 } }),
  ]),
  q('s2q03', 'risk', '你用过杠杆/融资吗？', [
    opt('A', '从不，也不打算', { risk: { leverageUsage: 'none', lossAversion: 4 } }),
    opt('B', '偶尔极低杠杆', { risk: { leverageUsage: 'rare' } }),
    opt('C', '牛市会提高杠杆', { risk: { leverageUsage: 'bull', maxDrawdown: '30%' } }),
    opt('D', '经常用，追求效率', { risk: { leverageUsage: 'frequent', lossAversion: 1 } }),
  ]),
  q('s2q04', 'risk', '黑天鹅式急跌（单日 -7% 指数），你会？', [
    opt('A', '按清单机械加仓', { philosophy: { contrarianVsMomentum: 1 }, decisionSpeed: 'fast' }),
    opt('B', '先看现金与仓位再定', { decisionSpeed: 'moderate', risk: { stopLossDiscipline: 3 } }),
    opt('C', '减仓避险，等波动过去', { risk: { lossAversion: 4 }, philosophy: { contrarianVsMomentum: 5 } }),
    opt('D', '可能清仓或接近清仓', { risk: { lossAversion: 5, panicSellHistory: true } }),
  ]),
  q('s2q05', 'risk', '止损对你而言更像？', [
    opt('A', '铁律，触发必执行', { risk: { stopLossDiscipline: 5 } }),
    opt('B', '默认遵守，重大逻辑可变通', { risk: { stopLossDiscipline: 4 } }),
    opt('C', '参考线，经常主观改', { risk: { stopLossDiscipline: 2 } }),
    opt('D', '几乎不止损，靠选股', { risk: { stopLossDiscipline: 1 }, philosophy: { fundamentalVsTechnical: 1 } }),
  ]),
  q('s2q06', 'risk', '浮盈 30% 后回撤一半（仍赚 15%），你会？', [
    opt('A', '无感，目标价未到', { risk: { lossAversion: 1 }, philosophy: { activeVsPassive: 1 } }),
    opt('B', '先锁一部分利润', { risk: { stopLossDiscipline: 4 }, philosophy: { activeVsPassive: 3 } }),
    opt('C', '后悔没卖高点，倾向清仓', { risk: { lossAversion: 5 }, anchorEffect: 5 }),
    opt('D', '加仓，当二次确认', { philosophy: { contrarianVsMomentum: 5 } }),
  ]),
  q('s2q07', 'risk', '你更能接受哪种「错」？', [
    opt('A', '踏空大牛（没买到）', { risk: { lossAversion: 2 }, philosophy: { contrarianVsMomentum: 2 } }),
    opt('B', '套牢深度回撤（买早了）', { risk: { lossAversion: 4 } }),
    opt('C', '两者都难受，更怕回撤', { risk: { lossAversion: 5 } }),
    opt('D', '两者都可，用规则消化', { risk: { lossAversion: 2, stopLossDiscipline: 5 } }),
  ]),
  q('s2q08', 'risk', '单票最大仓位你心理上限是？', [
    opt('A', '≤10%', { risk: { singleStockMax: '10%' }, philosophy: { 集中Vs分散: 5 } }),
    opt('B', '约 15–20%', { risk: { singleStockMax: '20%' }, philosophy: { 集中Vs分散: 3 } }),
    opt('C', '约 25–35%', { risk: { singleStockMax: '30%' }, philosophy: { 集中Vs分散: 2 } }),
    opt('D', '可以到 40%+', { risk: { singleStockMax: '50%' }, philosophy: { 集中Vs分散: 1 } }),
  ]),
  q('s2q09', 'risk', '「高确定性低赔率」vs「低确定性高赔率」，你选？', [
    opt('A', '几乎总选前者', { philosophy: { valueVsGrowth: 1 }, risk: { lossAversion: 4 } }),
    opt('B', '组合里以前者为主', { philosophy: { valueVsGrowth: 2 } }),
    opt('C', '愿意留一小部分高赔率', { philosophy: { valueVsGrowth: 4 } }),
    opt('D', '更爱不对称上行', { philosophy: { valueVsGrowth: 5 }, risk: { lossAversion: 1 } }),
  ]),
  q('s2q10', 'risk', '现金仓位对你意味着？', [
    opt('A', '机会弹药，主动保留', { cashBias: 4, philosophy: { activeVsPassive: 3 } }),
    opt('B', '默认接近满仓更安心', { cashBias: 1 }),
    opt('C', '按估值水位调节', { cashBias: 3, philosophy: { valueVsGrowth: 1 }, valuationPreferred: 'DCF' }),
    opt('D', '害怕踏空，现金越少越好', { cashBias: 1, philosophy: { contrarianVsMomentum: 5 } }),
  ]),
  q('s2q11', 'risk', '你经历过「一夜改观」的大亏吗？', [
    opt('A', '有，从此更纪律', { risk: { panicSellHistory: true, stopLossDiscipline: 5, lossAversion: 4 } }),
    opt('B', '有，但仍偏激进', { risk: { panicSellHistory: true, lossAversion: 2 } }),
    opt('C', '没有，但怕发生', { risk: { lossAversion: 4 } }),
    opt('D', '没有，也不太担心', { risk: { lossAversion: 1, maxDrawdown: '35%' } }),
  ]),

  // ── 03 时间与仓位 (11) ──
  q('s3q01', 'horizon', '你理想的主仓持有周期？', [
    opt('A', '数天到两周', { philosophy: { activeVsPassive: 5 }, decisionSpeed: 'fast' }),
    opt('B', '1–3 个月', { philosophy: { activeVsPassive: 4 } }),
    opt('C', '半年到一年半', { philosophy: { activeVsPassive: 2 }, decisionSpeed: 'moderate' }),
    opt('D', '三年视角，少动', { philosophy: { activeVsPassive: 1 }, decisionSpeed: 'slow' }),
  ]),
  q('s3q02', 'horizon', '同时持有多少只股票最舒服？', [
    opt('A', '1–3 只', { philosophy: { 集中Vs分散: 1 }, risk: { singleStockMax: '40%' } }),
    opt('B', '4–8 只', { philosophy: { 集中Vs分散: 2 }, risk: { singleStockMax: '25%' } }),
    opt('C', '9–15 只', { philosophy: { 集中Vs分散: 3 }, risk: { singleStockMax: '15%' } }),
    opt('D', '15 只以上', { philosophy: { 集中Vs分散: 5 }, risk: { singleStockMax: '10%' } }),
  ]),
  q('s3q03', 'horizon', '建仓方式你更偏好？', [
    opt('A', '一次性重仓', { decisionSpeed: 'fast', philosophy: { 集中Vs分散: 1 } }),
    opt('B', '分 2–3 批', { decisionSpeed: 'moderate' }),
    opt('C', '网格/定投式摊入', { decisionSpeed: 'slow', philosophy: { activeVsPassive: 2 } }),
    opt('D', '等极端错杀再一把买入', { philosophy: { contrarianVsMomentum: 1 }, decisionSpeed: 'slow' }),
  ]),
  q('s3q04', 'horizon', '减仓/换仓频率你更接近？', [
    opt('A', '每周都可能调', { philosophy: { activeVsPassive: 5 }, tradingFrequencyHint: 'high' }),
    opt('B', '每月检视一次', { philosophy: { activeVsPassive: 3 } }),
    opt('C', '每季大检', { philosophy: { activeVsPassive: 2 } }),
    opt('D', '极少主动换，除非逻辑坏', { philosophy: { activeVsPassive: 1 } }),
  ]),
  q('s3q05', 'horizon', '「核心仓 + 卫星仓」结构你？', [
    opt('A', '就是这样配置', { philosophy: { 集中Vs分散: 2 }, risk: { singleStockMax: '30%' } }),
    opt('B', '想学，但还没做到', { philosophy: { 集中Vs分散: 3 } }),
    opt('C', '不喜欢，仓位尽量均匀', { philosophy: { 集中Vs分散: 4 } }),
    opt('D', '几乎全是主题博弈仓', { philosophy: { valueVsGrowth: 5, 集中Vs分散: 2 } }),
  ]),
  q('s3q06', 'horizon', '对「拿不住牛股」你怎么看？', [
    opt('A', '我的老问题，需要纪律', { philosophy: { activeVsPassive: 2 }, risk: { lossAversion: 4 } }),
    opt('B', '落袋为安也没错', { philosophy: { activeVsPassive: 4 } }),
    opt('C', '我通常能拿很久', { philosophy: { activeVsPassive: 1 } }),
    opt('D', '更怕拿成接盘侠', { risk: { stopLossDiscipline: 5 }, philosophy: { activeVsPassive: 4 } }),
  ]),
  q('s3q07', 'horizon', '假期/出差无法看盘时你会？', [
    opt('A', '提前降仓或设好条件单', { risk: { stopLossDiscipline: 5 }, philosophy: { activeVsPassive: 3 } }),
    opt('B', '信任长期逻辑，不动', { philosophy: { activeVsPassive: 1 } }),
    opt('C', '让家人/朋友代看', { decisionSpeed: 'moderate' }),
    opt('D', '焦虑，尽量不离场期持仓', { risk: { lossAversion: 4 }, philosophy: { activeVsPassive: 5 } }),
  ]),
  q('s3q08', 'horizon', '你愿意为「确定性」牺牲多少年化？', [
    opt('A', '很多，宁稳勿躁', { risk: { lossAversion: 5 }, philosophy: { valueVsGrowth: 1 } }),
    opt('B', '一点可以', { risk: { lossAversion: 3 } }),
    opt('C', '很少，收益优先', { risk: { lossAversion: 2 }, philosophy: { valueVsGrowth: 4 } }),
    opt('D', '几乎不愿牺牲', { risk: { lossAversion: 1 }, philosophy: { valueVsGrowth: 5 } }),
  ]),
  q('s3q09', 'horizon', '组合里债券/货币基金占比心态？', [
    opt('A', '需要压舱石', { cashBias: 4, risk: { maxDrawdown: '15%' } }),
    opt('B', '少量即可', { cashBias: 2 }),
    opt('C', '几乎全权益', { cashBias: 1, risk: { maxDrawdown: '30%' } }),
    opt('D', '按年龄目标比例', { cashBias: 3, risk: { lossAversion: 3 } }),
  ]),
  q('s3q10', 'horizon', '发现更好标的但已满仓，你？', [
    opt('A', '卖最弱的换仓', { philosophy: { activeVsPassive: 4 }, decisionSpeed: 'fast' }),
    opt('B', '等有现金再买', { decisionSpeed: 'slow', cashBias: 3 }),
    opt('C', '提高总仓，短暂超配', { risk: { lossAversion: 2 }, philosophy: { 集中Vs分散: 1 } }),
    opt('D', '放弃新机会，避免折腾', { philosophy: { activeVsPassive: 1 } }),
  ]),
  q('s3q11', 'horizon', '对「长期持股」最大障碍是？', [
    opt('A', '波动折磨', { risk: { lossAversion: 4 } }),
    opt('B', '总觉得有更好的', { philosophy: { activeVsPassive: 4 }, confirmationBias: 3 }),
    opt('C', '基本面变化太快', { philosophy: { fundamentalVsTechnical: 1 }, decisionSpeed: 'moderate' }),
    opt('D', '没什么障碍', { philosophy: { activeVsPassive: 1 } }),
  ]),

  // ── 04 哲学与风格 (11) ──
  q('s4q01', 'philosophy', '选股时你第一眼看？', [
    opt('A', '便宜与安全边际', { philosophy: { valueVsGrowth: 1 }, valuationPreferred: 'DCF', dimensionWeights: { valuation: 22 } }),
    opt('B', '成长空间与赛道', { philosophy: { valueVsGrowth: 5 }, dimensionWeights: { growth: 22 } }),
    opt('C', '质量/护城河', { philosophy: { valueVsGrowth: 2 }, dimensionWeights: { moat: 22, fundamental: 18 } }),
    opt('D', '资金与情绪温度', { philosophy: { fundamentalVsTechnical: 4 }, dimensionWeights: { capital: 20, sentiment: 18 } }),
  ]),
  q('s4q02', 'philosophy', '你更愿意花时间研究？', [
    opt('A', '财报与商业模式', { philosophy: { fundamentalVsTechnical: 1 }, valuationPreferred: 'DCF' }),
    opt('B', '行业格局与壁垒', { philosophy: { valueVsGrowth: 3 }, dimensionWeights: { moat: 20, growth: 16 } }),
    opt('C', 'K 线与量价', { philosophy: { fundamentalVsTechnical: 5 } }),
    opt('D', '研报与机构持仓', { dimensionWeights: { ratings: 24, capital: 16 } }),
  ]),
  q('s4q03', 'philosophy', '「好公司贵一点」你能接受吗？', [
    opt('A', '很难，价格纪律第一', { philosophy: { valueVsGrowth: 1 }, valuationPreferred: 'PE' }),
    opt('B', '质量溢价可以给一点', { philosophy: { valueVsGrowth: 2 }, dimensionWeights: { moat: 18 } }),
    opt('C', '成长故事成立就给高估值', { philosophy: { valueVsGrowth: 5 } }),
    opt('D', '看相对赛道谁更贵', { philosophy: { valueVsGrowth: 4 }, dimensionWeights: { valuation: 16 } }),
  ]),
  q('s4q04', 'philosophy', '逆向买入让你兴奋还是不安？', [
    opt('A', '兴奋，这是我的优势', { philosophy: { contrarianVsMomentum: 1 } }),
    opt('B', '可以，但要证据充分', { philosophy: { contrarianVsMomentum: 2 }, decisionSpeed: 'moderate' }),
    opt('C', '更爱顺势确认', { philosophy: { contrarianVsMomentum: 5 } }),
    opt('D', '两者都做，看环境', { philosophy: { contrarianVsMomentum: 3 } }),
  ]),
  q('s4q05', 'philosophy', '巴菲特式「能力圈」你执行得怎样？', [
    opt('A', '严格，不懂不碰', { philosophy: { 集中Vs分散: 1, fundamentalVsTechnical: 1 }, knowledgeEdge: 4 }),
    opt('B', '大致遵守', { philosophy: { 集中Vs分散: 2 } }),
    opt('C', '经常越界追热点', { philosophy: { valueVsGrowth: 5, contrarianVsMomentum: 5 } }),
    opt('D', '用分散代替能力圈', { philosophy: { 集中Vs分散: 5 } }),
  ]),
  q('s4q06', 'philosophy', '分红分红对你？', [
    opt('A', '很重要，现金流友好', { philosophy: { valueVsGrowth: 1 }, dimensionWeights: { fundamental: 18 } }),
    opt('B', '加分项', { philosophy: { valueVsGrowth: 2 } }),
    opt('C', '无所谓，看总回报', { philosophy: { valueVsGrowth: 3 } }),
    opt('D', '更爱回购/再投资增长', { philosophy: { valueVsGrowth: 4 } }),
  ]),
  q('s4q07', 'philosophy', '周期股（强周期制造/资源）你？', [
    opt('A', '会做，吃周期位置', { philosophy: { contrarianVsMomentum: 2 }, dimensionWeights: { macro: 16, valuation: 16 } }),
    opt('B', '少量配置', { philosophy: { 集中Vs分散: 3 } }),
    opt('C', '尽量回避', { avoidCyclical: true, philosophy: { valueVsGrowth: 2 } }),
    opt('D', '只在景气确认后追', { philosophy: { contrarianVsMomentum: 5 } }),
  ]),
  q('s4q08', 'philosophy', '对「故事股/主题投资」态度？', [
    opt('A', '基本不碰', { philosophy: { valueVsGrowth: 1, fundamentalVsTechnical: 1 } }),
    opt('B', '卫星仓玩玩', { philosophy: { valueVsGrowth: 3 }, risk: { singleStockMax: '15%' } }),
    opt('C', '主战场之一', { philosophy: { valueVsGrowth: 5 }, dimensionWeights: { catalyst: 20, sentiment: 16 } }),
    opt('D', '只做有财报验证的主题', { philosophy: { valueVsGrowth: 4, fundamentalVsTechnical: 2 } }),
  ]),
  q('s4q09', 'philosophy', '指数/宽基 ETF 在你体系中？', [
    opt('A', '核心底仓', { philosophy: { activeVsPassive: 1, 集中Vs分散: 4 } }),
    opt('B', '有一些', { philosophy: { activeVsPassive: 2 } }),
    opt('C', '几乎全主动选股', { philosophy: { activeVsPassive: 4 } }),
    opt('D', '只用行业 ETF 表达观点', { philosophy: { activeVsPassive: 3 }, dimensionWeights: { macro: 14 } }),
  ]),
  q('s4q10', 'philosophy', '管理层「诚信与能力」权重？', [
    opt('A', '一票否决级重要', { dimensionWeights: { moat: 16, risk: 18, fundamental: 16 } }),
    opt('B', '重要参考', { dimensionWeights: { fundamental: 14 } }),
    opt('C', '看财报数字就够', { dimensionWeights: { fundamental: 20 } }),
    opt('D', '短线可忽略治理', { philosophy: { fundamentalVsTechnical: 5 }, dimensionWeights: { sentiment: 14 } }),
  ]),
  q('s4q11', 'philosophy', '你更接近哪种「胜率观」？', [
    opt('A', '少即是多，高胜率慢钱', { philosophy: { valueVsGrowth: 1, 集中Vs分散: 2 }, risk: { lossAversion: 3 } }),
    opt('B', '用分散提高组合胜率', { philosophy: { 集中Vs分散: 5 } }),
    opt('C', '赔率优先，容忍低胜率', { philosophy: { valueVsGrowth: 5 }, risk: { lossAversion: 1 } }),
    opt('D', '看市场状态切换', { philosophy: { contrarianVsMomentum: 3 }, decisionSpeed: 'moderate' }),
  ]),

  // ── 05 信息与决策 (11) ──
  q('s5q01', 'info', '日常信息第一来源？', [
    opt('A', '公告/财报原文', { newsSourcePreference: ['announcement'], philosophy: { fundamentalVsTechnical: 1 } }),
    opt('B', '专业媒体/深度稿', { newsSourcePreference: ['media'] }),
    opt('C', '社群/大V/股吧', { newsSourcePreference: ['social'], dimensionWeights: { sentiment: 16 } }),
    opt('D', '行情软件推送', { newsSourcePreference: ['terminal'], philosophy: { fundamentalVsTechnical: 4 } }),
  ]),
  q('s5q02', 'info', '看到重磅利好，你通常？', [
    opt('A', '先核实再行动', { decisionSpeed: 'moderate', confirmationBias: 2 }),
    opt('B', '快速跟进一部分', { decisionSpeed: 'fast', philosophy: { contrarianVsMomentum: 4 } }),
    opt('C', '利好出尽就警惕', { philosophy: { contrarianVsMomentum: 1 }, decisionSpeed: 'moderate' }),
    opt('D', '不看短消息，等财报', { decisionSpeed: 'slow', philosophy: { fundamentalVsTechnical: 1 } }),
  ]),
  q('s5q03', 'info', '研报评级上调对你？', [
    opt('A', '很有分量', { dimensionWeights: { ratings: 24 } }),
    opt('B', '参考逻辑不参考目标价', { dimensionWeights: { ratings: 14, fundamental: 16 } }),
    opt('C', '常常反向思考', { philosophy: { contrarianVsMomentum: 1 }, dimensionWeights: { ratings: 8 } }),
    opt('D', '几乎不看', { dimensionWeights: { ratings: 4 }, philosophy: { fundamentalVsTechnical: 1 } }),
  ]),
  q('s5q04', 'info', '北向/主力资金连续流入，你？', [
    opt('A', '当作重要确认', { dimensionWeights: { capital: 22 } }),
    opt('B', '辅助指标', { dimensionWeights: { capital: 14 } }),
    opt('C', '滞后指标，谨慎', { dimensionWeights: { capital: 8 }, philosophy: { contrarianVsMomentum: 2 } }),
    opt('D', '不纳入决策', { dimensionWeights: { capital: 2 } }),
  ]),
  q('s5q05', 'info', '做决策前你需要多少「证据」？', [
    opt('A', '一两项关键信号就够', { decisionSpeed: 'fast', confirmationBias: 3 }),
    opt('B', '清单上多数打勾', { decisionSpeed: 'moderate' }),
    opt('C', '要写投资备忘录', { decisionSpeed: 'slow', philosophy: { fundamentalVsTechnical: 1 } }),
    opt('D', '总觉得证据不够', { decisionSpeed: 'slow', confirmationBias: 4, risk: { lossAversion: 4 } }),
  ]),
  q('s5q06', 'info', '宏观点评（降准/地缘）对交易影响？', [
    opt('A', '显著改变仓位', { dimensionWeights: { macro: 22 } }),
    opt('B', '影响风险预算', { dimensionWeights: { macro: 14 }, risk: { lossAversion: 3 } }),
    opt('C', '噪音居多', { dimensionWeights: { macro: 6 }, philosophy: { fundamentalVsTechnical: 1 } }),
    opt('D', '只影响行业选择', { dimensionWeights: { macro: 12, catalyst: 12 } }),
  ]),
  q('s5q07', 'info', '技术指标在你体系的权重？', [
    opt('A', '几乎决定进出', { philosophy: { fundamentalVsTechnical: 5 }, dimensionWeights: { sentiment: 12 } }),
    opt('B', '择时辅助', { philosophy: { fundamentalVsTechnical: 4 } }),
    opt('C', '很少用', { philosophy: { fundamentalVsTechnical: 2 } }),
    opt('D', '基本不用', { philosophy: { fundamentalVsTechnical: 1 } }),
  ]),
  q('s5q08', 'info', '你多久复盘一次完整持仓？', [
    opt('A', '每天', { philosophy: { activeVsPassive: 4 }, decisionSpeed: 'fast' }),
    opt('B', '每周', { philosophy: { activeVsPassive: 3 } }),
    opt('C', '每月', { philosophy: { activeVsPassive: 2 }, decisionSpeed: 'moderate' }),
    opt('D', '有事件才复盘', { philosophy: { activeVsPassive: 1 }, decisionSpeed: 'slow' }),
  ]),
  q('s5q09', 'info', 'AI 摘要与原始材料，你更信？', [
    opt('A', '摘要够用，省时间', { trustAi: 5, timeBudget: 'light' }),
    opt('B', '摘要导航，关键处点原文', { trustAi: 4 }),
    opt('C', '必须自己读原文', { trustAi: 2, philosophy: { fundamentalVsTechnical: 1 } }),
    opt('D', '两者交叉验证', { trustAi: 3, confirmationBias: 2 }),
  ]),
  q('s5q10', 'info', '「信息过载」时你怎么处理？', [
    opt('A', '砍信息源，守清单', { decisionSpeed: 'moderate', confirmationBias: 2 }),
    opt('B', '只看持仓相关', { philosophy: { 集中Vs分散: 2 } }),
    opt('C', '暂停交易冷静', { decisionSpeed: 'slow', risk: { lossAversion: 3 } }),
    opt('D', '继续刷，生怕错过', { decisionSpeed: 'fast', herdTendency: 4 }),
  ]),
  q('s5q11', 'info', '朋友推荐股票，你通常？', [
    opt('A', '独立研究后才考虑', { herdTendency: 1, confirmationBias: 2 }),
    opt('B', '给一点仓位试错', { herdTendency: 3 }),
    opt('C', '容易跟风', { herdTendency: 5, philosophy: { contrarianVsMomentum: 5 } }),
    opt('D', '直接忽略', { herdTendency: 1, philosophy: { 集中Vs分散: 1 } }),
  ]),

  // ── 06 情绪与偏差 (11) ──
  q('s6q01', 'bias', '成本价对你卖出决策影响？', [
    opt('A', '几乎决定是否卖', { anchorEffect: 5, risk: { lossAversion: 5 } }),
    opt('B', '有影响但能克服', { anchorEffect: 3 }),
    opt('C', '更看未来价值', { anchorEffect: 1, philosophy: { fundamentalVsTechnical: 1 } }),
    opt('D', '用规则强制忽略成本', { anchorEffect: 1, risk: { stopLossDiscipline: 5 } }),
  ]),
  q('s6q02', 'bias', '涨了的票你是否更「有感情」？', [
    opt('A', '是，舍不得卖', { endowmentBias: 5, philosophy: { activeVsPassive: 2 } }),
    opt('B', '有一点', { endowmentBias: 3 }),
    opt('C', '涨跌一视同仁', { endowmentBias: 1 }),
    opt('D', '涨了反而更想兑现', { endowmentBias: 2, risk: { lossAversion: 4 } }),
  ]),
  q('s6q03', 'bias', '你是否只搜「支持自己观点」的信息？', [
    opt('A', '经常这样', { confirmationBias: 5 }),
    opt('B', '有时', { confirmationBias: 3 }),
    opt('C', '刻意找反方', { confirmationBias: 1 }),
    opt('D', '用清单强制正反都看', { confirmationBias: 1, decisionSpeed: 'moderate' }),
  ]),
  q('s6q04', 'bias', '群聊里都在骂某行业，你会？', [
    opt('A', '跟着减仓/回避', { herdTendency: 5 }),
    opt('B', '警惕但独立判断', { herdTendency: 2 }),
    opt('C', '可能逆向关注', { herdTendency: 1, philosophy: { contrarianVsMomentum: 1 } }),
    opt('D', '不看群聊情绪', { herdTendency: 1 }),
  ]),
  q('s6q05', 'bias', '刚错过一波大涨后，你容易？', [
    opt('A', '追高弥补', { FOMO: 5, philosophy: { contrarianVsMomentum: 5 } }),
    opt('B', '懊恼但忍住', { FOMO: 3, risk: { lossAversion: 3 } }),
    opt('C', '复盘规则，不追', { FOMO: 1, risk: { stopLossDiscipline: 4 } }),
    opt('D', '转向别的机会', { FOMO: 2, philosophy: { activeVsPassive: 3 } }),
  ]),
  q('s6q06', 'bias', '连续几次做对后，你会？', [
    opt('A', '提高仓位与频率', { overconfidence: 5, risk: { lossAversion: 1 } }),
    opt('B', '保持原仓位纪律', { overconfidence: 2, risk: { stopLossDiscipline: 4 } }),
    opt('C', '反而更小心', { overconfidence: 1, risk: { lossAversion: 4 } }),
    opt('D', '把运气当能力', { overconfidence: 5, confirmationBias: 4 }),
  ]),
  q('s6q07', 'bias', '亏损单你是否「扳本心理」更强？', [
    opt('A', '明显，容易加仓赌', { risk: { lossAversion: 5, panicSellHistory: true }, philosophy: { contrarianVsMomentum: 1 } }),
    opt('B', '有一点', { risk: { lossAversion: 4 } }),
    opt('C', '能分开看待每笔', { risk: { lossAversion: 2, stopLossDiscipline: 4 } }),
    opt('D', '亏损后降低风险', { risk: { lossAversion: 3, maxDrawdown: '15%' } }),
  ]),
  q('s6q08', 'bias', '新闻标题党对你情绪影响？', [
    opt('A', '很大，常被带节奏', { dimensionWeights: { sentiment: 18 }, herdTendency: 4 }),
    opt('B', '中等', { dimensionWeights: { sentiment: 12 } }),
    opt('C', '较小，先看数据', { philosophy: { fundamentalVsTechnical: 1 }, dimensionWeights: { sentiment: 6 } }),
    opt('D', '刻意延迟阅读标题', { decisionSpeed: 'slow', confirmationBias: 1 }),
  ]),
  q('s6q09', 'bias', '你有没有「特殊情结股」？', [
    opt('A', '有，怎么都不卖', { endowmentBias: 5, anchorEffect: 4 }),
    opt('B', '有，但设了纪律上限', { endowmentBias: 3, risk: { singleStockMax: '20%' } }),
    opt('C', '尽量避免', { endowmentBias: 1 }),
    opt('D', '没有', { endowmentBias: 1 }),
  ]),
  q('s6q10', 'bias', '压力大的工作日，交易质量？', [
    opt('A', '明显变差，易冲动', { decisionSpeed: 'fast', risk: { lossAversion: 4 } }),
    opt('B', '略差', { decisionSpeed: 'moderate' }),
    opt('C', '用规则减少裁量', { risk: { stopLossDiscipline: 5 } }),
    opt('D', '压力日不交易', { decisionSpeed: 'slow', philosophy: { activeVsPassive: 2 } }),
  ]),
  q('s6q11', 'bias', '你希望管家在你冲动时？', [
    opt('A', '强提醒甚至劝阻', { trustAi: 5, risk: { stopLossDiscipline: 5 } }),
    opt('B', '列出代价让我选', { trustAi: 4 }),
    opt('C', '少干涉', { trustAi: 2 }),
    opt('D', '只在重大风险时出现', { trustAi: 3, risk: { lossAversion: 3 } }),
  ]),

  // ── 07 买卖触发 (11) ──
  q('s7q01', 'trigger', '最能让你买入的「好消息」？', [
    opt('A', '利润超预期大增', { dimensionWeights: { fundamental: 22, growth: 18 }, valuationPreferred: 'PE' }),
    opt('B', '重大政策/订单催化', { dimensionWeights: { catalyst: 22, macro: 14 } }),
    opt('C', '资金连续流入', { dimensionWeights: { capital: 22, ratings: 14 } }),
    opt('D', '突破关键阻力放量', { philosophy: { fundamentalVsTechnical: 5 }, dimensionWeights: { sentiment: 14 } }),
  ]),
  q('s7q02', 'trigger', '最会让你卖出的「坏消息」？', [
    opt('A', '业绩暴雷/不及预期', { dimensionWeights: { fundamental: 24 } }),
    opt('B', '负面政策/监管', { dimensionWeights: { macro: 18, catalyst: 16 } }),
    opt('C', '大股东减持/质押危机', { dimensionWeights: { risk: 24 } }),
    opt('D', '跌破成本或技术位', { risk: { lossAversion: 5, stopLossDiscipline: 5 }, philosophy: { fundamentalVsTechnical: 4 } }),
  ]),
  q('s7q03', 'trigger', '关注半年的股票跌 20%，你会？', [
    opt('A', '立刻加仓当黄金坑', { philosophy: { contrarianVsMomentum: 1 }, decisionSpeed: 'fast', risk: { lossAversion: 1 } }),
    opt('B', '先查原因，基本面在再买', { philosophy: { fundamentalVsTechnical: 1 }, decisionSpeed: 'moderate' }),
    opt('C', '等技术企稳再进', { philosophy: { fundamentalVsTechnical: 5 }, decisionSpeed: 'moderate' }),
    opt('D', '不碰了，趋势坏了', { philosophy: { contrarianVsMomentum: 5 }, risk: { lossAversion: 5 } }),
  ]),
  q('s7q04', 'trigger', '持仓连涨 3 天 +15%，你会？', [
    opt('A', '继续拿，目标未到', { philosophy: { activeVsPassive: 1 } }),
    opt('B', '卖一半锁定', { philosophy: { activeVsPassive: 3 }, risk: { stopLossDiscipline: 4 } }),
    opt('C', '全卖落袋', { philosophy: { activeVsPassive: 5 }, risk: { lossAversion: 5 } }),
    opt('D', '加仓追确认', { philosophy: { contrarianVsMomentum: 5 } }),
  ]),
  q('s7q05', 'trigger', '财报前你通常？', [
    opt('A', '减仓回避波动', { risk: { lossAversion: 4 }, dimensionWeights: { catalyst: 12 } }),
    opt('B', '不动，逻辑在就拿', { philosophy: { activeVsPassive: 1 } }),
    opt('C', '按预期差布局', { dimensionWeights: { fundamental: 18, catalyst: 14 }, decisionSpeed: 'fast' }),
    opt('D', '专做财报博弈', { philosophy: { activeVsPassive: 5 }, dimensionWeights: { catalyst: 20 } }),
  ]),
  q('s7q06', 'trigger', '停牌/异常波动提示出现，你？', [
    opt('A', '优先降低风险', { dimensionWeights: { risk: 22 }, risk: { lossAversion: 4 } }),
    opt('B', '查清再定', { decisionSpeed: 'moderate' }),
    opt('C', '可能当作博弈机会', { risk: { lossAversion: 1 }, philosophy: { contrarianVsMomentum: 3 } }),
    opt('D', '规则触发则卖', { risk: { stopLossDiscipline: 5 } }),
  ]),
  q('s7q07', 'trigger', '目标价已到，但仍有上修空间传闻？', [
    opt('A', '按纪律先减', { risk: { stopLossDiscipline: 5 }, philosophy: { activeVsPassive: 2 } }),
    opt('B', '上移目标，继续拿', { philosophy: { activeVsPassive: 1 }, anchorEffect: 3 }),
    opt('C', '卖出换更低估', { philosophy: { valueVsGrowth: 1 }, valuationPreferred: 'DCF' }),
    opt('D', '看资金再决定', { dimensionWeights: { capital: 16 } }),
  ]),
  q('s7q08', 'trigger', '行业景气下行但公司仍优秀，你？', [
    opt('A', '坚持质量，低估加仓', { philosophy: { valueVsGrowth: 1, contrarianVsMomentum: 1 }, dimensionWeights: { moat: 18 } }),
    opt('B', '降权等待', { philosophy: { activeVsPassive: 3 } }),
    opt('C', '切到景气上行行业', { philosophy: { valueVsGrowth: 4 }, dimensionWeights: { macro: 14, growth: 14 } }),
    opt('D', '看估值是否够折价', { valuationPreferred: 'DCF', dimensionWeights: { valuation: 20 } }),
  ]),
  q('s7q09', 'trigger', '你买入更常发生在？', [
    opt('A', '大盘恐慌日', { philosophy: { contrarianVsMomentum: 1 } }),
    opt('B', '个股独立错杀', { philosophy: { fundamentalVsTechnical: 1 }, dimensionWeights: { valuation: 16 } }),
    opt('C', '突破创新高时', { philosophy: { contrarianVsMomentum: 5 } }),
    opt('D', '平静无大事的日子', { decisionSpeed: 'slow', philosophy: { activeVsPassive: 2 } }),
  ]),
  q('s7q10', 'trigger', '卖出更常因为？', [
    opt('A', '逻辑证伪', { philosophy: { fundamentalVsTechnical: 1 }, dimensionWeights: { fundamental: 18 } }),
    opt('B', '触及止损/风控', { risk: { stopLossDiscipline: 5 } }),
    opt('C', '有更好标的', { philosophy: { activeVsPassive: 4 } }),
    opt('D', '情绪受不了波动', { risk: { lossAversion: 5, panicSellHistory: true } }),
  ]),
  q('s7q11', 'trigger', '「再等等看」最常耽误你？', [
    opt('A', '买入（怕买早）', { decisionSpeed: 'slow', FOMO: 2 }),
    opt('B', '卖出（怕卖飞）', { philosophy: { activeVsPassive: 2 }, risk: { lossAversion: 3 } }),
    opt('C', '两者都耽误', { decisionSpeed: 'slow', confirmationBias: 3 }),
    opt('D', '很少犹豫', { decisionSpeed: 'fast' }),
  ]),

  // ── 08 纪律与偏好 (11) ──
  q('s8q01', 'discipline', '交易市场偏好？', [
    opt('A', '以 A 股为主', { exchangePreference: 'A' }),
    opt('B', 'A + 港股', { exchangePreference: 'AH' }),
    opt('C', '偏港股/海外映射', { exchangePreference: 'HK' }),
    opt('D', '不限，看机会', { exchangePreference: 'all' }),
  ]),
  q('s8q02', 'discipline', '市值偏好？', [
    opt('A', '大盘蓝筹', { marketCapPreference: 'large', risk: { lossAversion: 3 } }),
    opt('B', '中盘优质', { marketCapPreference: 'mid' }),
    opt('C', '小盘弹性', { marketCapPreference: 'small', risk: { lossAversion: 2 }, philosophy: { valueVsGrowth: 4 } }),
    opt('D', '不限市值', { marketCapPreference: 'all' }),
  ]),
  q('s8q03', 'discipline', '你是否写投资纪律清单？', [
    opt('A', '有，且执行', { risk: { stopLossDiscipline: 5 }, confirmationBias: 1 }),
    opt('B', '有，但常破例', { risk: { stopLossDiscipline: 3 } }),
    opt('C', '想建立，请管家监督', { trustAi: 5, risk: { stopLossDiscipline: 4 } }),
    opt('D', '没有，靠感觉', { risk: { stopLossDiscipline: 1 }, decisionSpeed: 'fast' }),
  ]),
  q('s8q04', 'discipline', '对「禁止清单」（雷区行业）？', [
    opt('A', '明确且严格执行', { philosophy: { 集中Vs分散: 2 }, dimensionWeights: { risk: 16 } }),
    opt('B', '有几条软性规则', { dimensionWeights: { risk: 12 } }),
    opt('C', '几乎无禁区', { philosophy: { valueVsGrowth: 4 } }),
    opt('D', '只禁杠杆与传闻股', { risk: { leverageUsage: 'none' }, dimensionWeights: { risk: 14 } }),
  ]),
  q('s8q05', 'discipline', '分红再投资/分红股你？', [
    opt('A', '优先纳入收息组合', { philosophy: { valueVsGrowth: 1 } }),
    opt('B', '看总回报', { philosophy: { valueVsGrowth: 3 } }),
    opt('C', '不喜欢低增长高分红', { philosophy: { valueVsGrowth: 5 } }),
    opt('D', '用分红降低成本心理锚', { anchorEffect: 3, philosophy: { valueVsGrowth: 2 } }),
  ]),
  q('s8q06', 'discipline', '你希望日报语气？', [
    opt('A', '严厉风控，少鼓励加仓', { risk: { lossAversion: 5 }, trustAi: 4 }),
    opt('B', '平衡陈述利弊', { risk: { lossAversion: 3 } }),
    opt('C', '偏机会导向', { risk: { lossAversion: 2 }, philosophy: { valueVsGrowth: 4 } }),
    opt('D', '数据冷静，少形容词', { philosophy: { fundamentalVsTechnical: 1 }, confirmationBias: 1 }),
  ]),
  q('s8q07', 'discipline', '建议与你画像冲突时，管家应？', [
    opt('A', '明确标出冲突并降级建议', { trustAi: 5 }),
    opt('B', '给两种路径对比', { trustAi: 4, confirmationBias: 2 }),
    opt('C', '仍给最优，由我否决', { trustAi: 3 }),
    opt('D', '尽量不给冲突建议', { trustAi: 2, confirmationBias: 4 }),
  ]),
  q('s8q08', 'discipline', '对「小道消息」政策？', [
    opt('A', '零容忍', { newsSourcePreference: ['announcement'], dimensionWeights: { risk: 14 } }),
    opt('B', '仅作线索去验证', { confirmationBias: 2 }),
    opt('C', '可小仓博弈', { risk: { lossAversion: 2 }, philosophy: { activeVsPassive: 4 } }),
    opt('D', '经常据此交易', { herdTendency: 4, philosophy: { fundamentalVsTechnical: 4 } }),
  ]),
  q('s8q09', 'discipline', '年度目标你更在意？', [
    opt('A', '回撤可控', { risk: { maxDrawdown: '12%', lossAversion: 5 } }),
    opt('B', '跑赢通胀/理财', { risk: { maxDrawdown: '20%' }, philosophy: { valueVsGrowth: 2 } }),
    opt('C', '尽量靠近强势指数', { philosophy: { contrarianVsMomentum: 4 }, dimensionWeights: { growth: 14 } }),
    opt('D', '绝对收益冲刺', { risk: { maxDrawdown: '35%', lossAversion: 1 }, philosophy: { valueVsGrowth: 5 } }),
  ]),
  q('s8q10', 'discipline', '你希望定制深度达到？', [
    opt('A', '每条建议都引用我的答案', { trustAi: 5, profileDepthWanted: 'max' }),
    opt('B', '关键决策引用即可', { trustAi: 4, profileDepthWanted: 'high' }),
    opt('C', '风格对上就行', { trustAi: 3, profileDepthWanted: 'medium' }),
    opt('D', '别太啰嗦', { trustAi: 2, profileDepthWanted: 'light' }),
  ]),
  q('s8q11', 'discipline', '完成 88 题后，你希望系统？', [
    opt('A', '立刻按新画像重写建议阈值', { trustAi: 5, decisionSpeed: 'fast' }),
    opt('B', '先给画像摘要再确认', { trustAi: 4, decisionSpeed: 'moderate' }),
    opt('C', '与行为数据磨合几周', { trustAi: 3, decisionSpeed: 'slow' }),
    opt('D', '允许我随时重测章节', { trustAi: 4, confirmationBias: 1 }),
  ]),
]

export const SCENARIO_QUESTION_COUNT = SCENARIO_QUESTIONS.length

/** 冷启动核心题：先答完身份章即可生成有用的观察/部分简报 */
export const ESSENTIAL_QUESTION_IDS = SCENARIO_QUESTIONS.filter((q) => q.section === 'identity').map((q) => q.id)

export const ESSENTIAL_QUESTION_COUNT = ESSENTIAL_QUESTION_IDS.length

export function essentialsDone(answers = {}) {
  return ESSENTIAL_QUESTION_IDS.every((id) => !!answers[id])
}

export function getSectionMeta(sectionId) {
  return PROFILE_SECTIONS.find((s) => s.id === sectionId) || { id: sectionId, title: sectionId, blurb: '' }
}

export function questionsInSection(sectionId) {
  return SCENARIO_QUESTIONS.filter((q) => q.section === sectionId)
}
