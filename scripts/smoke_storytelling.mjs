/**
 * Storytelling regression for value-style briefing prose.
 */
import { generateDailyReport } from '../src/services/ai.js'

const holdings = [
  { code: '600519', name: '贵州茅台', shares: 100, cost: 1400 },
  { code: '600036', name: '招商银行', shares: 500, cost: 35 },
]
const analyses = {
  '600519': {
    sent: {
      total: 5,
      mood: '中性',
      confidence: 60,
      rm: 0,
      bull: [],
      bear: [],
      narrative: '基本面稳健',
      futureEvents: [
        {
          date: new Date(Date.now() + 3 * 864e5).toISOString().slice(0, 10),
          title: '新品发布会',
          tradeHint: { label: '催化剂', text: '可按事件驱动节奏交易。' },
          certainty: '中',
          importance: '中',
        },
      ],
    },
  },
  '600036': {
    sent: { total: -5, mood: '偏弱', confidence: 55, rm: -1, bull: [], bear: ['情绪弱'], narrative: '' },
  },
}
const financials = {
  '600519': {
    marginOfSafety: 12,
    dcf: {
      archetypeLabel: '特许经营权',
      mosBuyMin: 20,
      verdict: '估值合理',
      primary: { paradigmName: '特许经营权' },
      quality: 'wonderful',
      method: 'OE×PE',
      pePercentile: 40,
      actionHint: '略便宜：宜定投，未到重仓线',
      details: ['主锚:oe_pe', '质量 wonderful', '逆向：提价节奏放缓'],
      competence: 'easy',
      angles: ['主视角：特许经营权'],
    },
  },
  '600036': {
    marginOfSafety: -18,
    dcf: {
      archetypeLabel: '银行',
      mosBuyMin: 25,
      verdict: '合理偏上',
      primary: { paradigmName: '银行 PB-ROE' },
      quality: 'fair',
      method: 'PB-ROE',
      pePercentile: 70,
      actionHint: '偏贵：好公司≠好价格',
      details: ['主锚:pb_roe', '账面重建', '年化ROE≈12%'],
      competence: 'moderate',
      angles: ['主视角：银行 PB-ROE'],
    },
  },
}

const userProfile = {
  style: '价值',
  risk: '保守',
  horizon: '长线',
  valuationWeight: '安全边际优先',
  industries: [],
  onboardingDone: true,
  essentialsDone: true,
  scenarioProgress: 88,
}

const report = await generateDailyReport({
  holdings,
  analyses,
  financials,
  userProfile,
  rawProfile: {
    style: '价值',
    risk: { label: '保守' },
    onboardingDone: true,
    essentialsDone: true,
    scenarioProgress: 88,
    scenarioAnswers: Object.fromEntries(Array.from({ length: 20 }, (_, i) => [`q${i}`, 'a'])),
  },
})

const narrative = report.headline || ''
const items = report.items || []
const cat = items.find((i) => i.type === 'catalyst')
if (cat && /可按事件驱动节奏交易/.test(cat.summary || '')) {
  throw new Error('value style still uses trading catalyst tone')
}
if (cat && cat.priority < 2) {
  throw new Error('value style catalyst should be deprioritized')
}
const over = items.find((i) => i.type === 'overvalued')
if (over && !/贵|便宜|生意|质量|逆向|银行|特许/.test(over.summary || '')) {
  throw new Error(`overvalued summary too thin: ${over.summary}`)
}
if (!/价值框架|安全边际|能力圈|折扣|逆向/.test(narrative)) {
  throw new Error(`value narrative missing plot: ${narrative}`)
}

console.log('OK   value narrative plot')
console.log('OK   catalyst deprioritized for value style')
console.log(`narrative: ${narrative.slice(0, 140)}…`)
console.log('smoke_storytelling: all passed')
