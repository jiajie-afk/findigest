/**
 * Guard: Pro「用人话重写」must not emit trade tickets.
 */
import { ANALYST_SYSTEM, sanitizeLlmBriefing } from '../src/services/llmBriefingGuard.js'

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

assert(/禁止 BUY\/SELL\/HOLD/.test(ANALYST_SYSTEM), 'system forbids trade tickets')
assert(/硬约束优先/.test(ANALYST_SYSTEM), 'system requires hard-constraint veto')
assert(/对质不是荐股/.test(ANALYST_SYSTEM), 'system keeps debate from becoming a buy')

const dirty = `TICKER: NVDA
SIGNAL: BUY
ACTION: Buy
ENTRY: $197–$199
STOP: $183
SIZE: 3% of portfolio
建议立即买入茅台。目标价：1800 止损价：1600
进场价：1700-1720
`
const clean = sanitizeLlmBriefing(dirty)
assert(!/\bBUY\b/.test(clean), `still has BUY: ${clean}`)
assert(!/\bSELL\b/.test(clean), 'still has SELL')
assert(!/ENTRY: \$/.test(clean), 'still has entry price')
assert(!/STOP: \$/.test(clean), 'still has stop price')
assert(!/建议立即买入/.test(clean), 'still has buy order Chinese')
assert(!/目标价：1800/.test(clean), 'still has target price')
assert(!/止损价：1600/.test(clean), 'still has stop Chinese')
assert(/硬约束/.test(clean) || /不提供/.test(clean) || /非指令/.test(clean), 'sanitizer should leave research framing')

console.log('OK   analyst system forbids tickets')
console.log('OK   sanitizer strips BUY/ENTRY/STOP/目标价')
console.log('smoke_llm_briefing_guard: all passed')
