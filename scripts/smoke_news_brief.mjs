/**
 * News AI brief: facts + short/medium/long economic transmission, never a buy ticket.
 */
import { NEWS_BRIEF_SYSTEM, parseNewsBrief, newsBriefCacheKey, localNewsBrief } from '../lib/newsBriefCore.js'

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

assert(/不是荐股/.test(NEWS_BRIEF_SYSTEM), 'system must reject stock picking')
assert(/禁止 BUY\/SELL\/HOLD/.test(NEWS_BRIEF_SYSTEM), 'system forbids tickets')
assert(/只输出一个 JSON/.test(NEWS_BRIEF_SYSTEM), 'system asks for JSON only')
assert(/短期/.test(NEWS_BRIEF_SYSTEM) && /中期/.test(NEWS_BRIEF_SYSTEM) && /长期/.test(NEWS_BRIEF_SYSTEM), 'system requires three horizons')
assert(/经济变量/.test(NEWS_BRIEF_SYSTEM), 'system requires economic variables')

const fenced = parseNewsBrief(`废话
\`\`\`json
{"thinking":"降准先打银行负债和短端利率，再看信贷是否起来。","facts":"央行宣布降准0.5个百分点。","tone":"利好","short":{"effect":"利好","text":"资金面先松。"},"medium":{"effect":"中性","text":"要看贷款结构。"},"long":{"effect":"不确定","text":"不自动修复需求。"},"sectors":[{"name":"银行","effect":"利好","why":"负债成本下降。"},{"name":"地产","effect":"中性","why":"政策未直接放松需求。"}],"note":""}
\`\`\`
`)
assert(fenced.facts.includes('降准'), `facts missing: ${fenced.facts}`)
assert(fenced.thinking.includes('银行'), fenced.thinking)
assert(fenced.tone === '利好', fenced.tone)
assert(fenced.short.text.includes('资金'), fenced.short.text)
assert(fenced.medium.effect === '中性', fenced.medium.effect)
assert(fenced.long.effect === '不确定', fenced.long.effect)
assert(fenced.sectors[0]?.name === '银行', 'sector name')

const fallback = parseNewsBrief('只给了一段没有 JSON 的话。')
assert(fallback.facts.includes('没有 JSON'), fallback.facts)
assert(fallback.tone === '不确定', fallback.tone)

const dirty = parseNewsBrief(
  JSON.stringify({
    facts: '建议立即买入茅台。目标价：1800',
    tone: '利好',
    short: { effect: '利好', text: '情绪' },
    medium: { effect: '中性', text: '报表' },
    long: { effect: '不确定', text: '结构' },
    sectors: [{ name: '白酒', effect: '利好', why: '联播点名消费' }],
  }),
)
assert(!/建议立即买入/.test(dirty.facts + dirty.note + dirty.raw), `ticket leaked: ${dirty.raw}`)
assert(!/目标价：1800/.test(dirty.facts + dirty.raw), 'target price leaked')

assert(newsBriefCacheKey({ id: 'cctv-1', title: 'x' }) === 'v2:cctv-1', 'id key')
assert(newsBriefCacheKey({ title: '降准', event_date: '2026-09-01' }) === 'v2:降准|2026-09-01', 'title key')

const local = localNewsBrief({ title: '央行宣布降准 0.5 个百分点' })
assert(local.tone === '利好', local.tone)
assert(local.sectors.some((s) => s.name === '银行'), 'local bank sector')
assert(local.short.text.includes('利率') || local.short.text.includes('资金'), local.short.text)
assert(local.medium.text.length > 20, 'medium too thin')
assert(local.long.text.length > 20, 'long too thin')
assert(/信贷|净息差|加杠杆/.test(local.thinking), local.thinking)

console.log('OK   news brief system forbids tickets and requires horizons')
console.log('OK   parse JSON fence + short/medium/long + local economy')
console.log('smoke_news_brief: all passed')
