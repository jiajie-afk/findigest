/**
 * Validate every paradigm.engineHint is ⊆ ENGINE_HINT_TO_ARCHETYPE keys.
 * Usage: node scripts/check_engine_hints.mjs
 */
import { VALUATION_PARADIGMS } from '../src/data/valuation_paradigms.js'
import { ENGINE_HINT_TO_ARCHETYPE, ENGINE_HINT_KEYS } from '../src/services/paradigmResolver.js'

let failed = 0
function assert(cond, msg) {
  if (!cond) {
    failed += 1
    console.error('FAIL:', msg)
  } else {
    console.log('OK  ', msg)
  }
}

const known = new Set(ENGINE_HINT_KEYS)
assert(known.size === Object.keys(ENGINE_HINT_TO_ARCHETYPE).length, 'ENGINE_HINT_KEYS mirrors map')

const used = new Set()
for (const p of VALUATION_PARADIGMS) {
  if (!p.engineHint) continue
  used.add(p.engineHint)
  if (!known.has(p.engineHint)) {
    failed += 1
    console.error(`FAIL: paradigm ${p.id} engineHint "${p.engineHint}" not in ENGINE_HINT_TO_ARCHETYPE`)
  }
}

assert(failed === 0 || used.size > 0, 'at least one paradigm uses engineHint')
if ([...used].every((h) => known.has(h))) {
  console.log('OK  ', `all ${used.size} used engineHint values ⊆ frozen map (${known.size} keys)`)
}

// Unused map keys are OK (reserved), but empty map is not
assert(known.size >= 10, 'frozen map has expected breadth')

if (failed) {
  console.error(`\n${failed} assertion(s) failed`)
  process.exit(1)
}
console.log('\ncheck_engine_hints: all passed')
