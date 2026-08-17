/**
 * Smoke: not-pro billing => cannot have pro nav / HUD / LLM flags.
 * Usage: node scripts/smoke_entitlements.mjs
 */
import { getEntitlements } from '../src/services/entitlements.js'

let failed = 0
function assert(cond, msg) {
  if (!cond) {
    failed += 1
    console.error('FAIL:', msg)
  } else {
    console.log('OK  ', msg)
  }
}

const free = { plan: 'free', proUntil: null }
const expired = { plan: 'pro', proUntil: Date.now() - 60_000 }
const active = { plan: 'pro', proUntil: Date.now() + 86400000 }
const lifetime = { plan: 'pro', proUntil: null }

const skinPro = getEntitlements(free, { productEdition: 'pro' })
assert(!skinPro.isBillingPro, 'skin-only pro: isBillingPro false')
assert(!skinPro.canSeeProNav, 'skin-only pro: canSeeProNav false')
assert(!skinPro.canUseProHud, 'skin-only pro: canUseProHud false')
assert(!skinPro.canUseLlm, 'skin-only pro: canUseLlm false')
assert(!skinPro.canUseProdeskStyle, 'skin-only pro: canUseProdeskStyle false')
assert(skinPro.editionProjected === 'basic', 'skin-only pro: editionProjected basic')

const expiredEnt = getEntitlements(expired, { productEdition: 'pro' })
assert(
  !expiredEnt.canSeeProNav && !expiredEnt.canUseProHud && !expiredEnt.canUseLlm,
  'expired: all pro flags false',
)

const paid = getEntitlements(active, { productEdition: 'basic' })
assert(paid.isBillingPro, 'active billing: isBillingPro')
assert(
  paid.canSeeProNav && paid.canUseProHud && paid.canUseLlm && paid.canUseProdeskStyle,
  'active billing: all can* true',
)
assert(paid.editionProjected === 'pro', 'active billing: editionProjected pro')

const life = getEntitlements(lifetime, { productEdition: 'basic' })
assert(life.isBillingPro && life.canSeeProNav, 'lifetime pro: flags true')

// Skin-only edition must never unlock remote Pro (Node has no window → not local host)
const skinBasic = getEntitlements(free, { productEdition: 'basic' })
assert(!skinBasic.isBillingPro && skinBasic.editionProjected === 'basic', 'free+basic stays basic')

if (failed) {
  console.error(`\n${failed} assertion(s) failed`)
  process.exit(1)
}
console.log('\nsmoke_entitlements: all passed')
