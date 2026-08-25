/**
 * Smoke: membership ≠ shell. Paid Pro must still be able to sit on 基础版.
 * Usage: node scripts/smoke_entitlements.mjs
 */
import { getEntitlements, nextProductEdition } from '../src/services/entitlements.js'

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

const paidBasic = getEntitlements(active, { productEdition: 'basic' })
assert(paidBasic.isBillingPro, 'paid + basic: membership still active')
assert(
  !paidBasic.canSeeProNav &&
    !paidBasic.canUseProHud &&
    !paidBasic.canUseLlm &&
    !paidBasic.canUseProdeskStyle,
  'paid + basic: Pro HUD/nav/LLM follow the basic shell',
)
assert(paidBasic.editionProjected === 'basic', 'paid + basic: editionProjected basic')

const paidPro = getEntitlements(active, { productEdition: 'pro' })
assert(
  paidPro.isBillingPro &&
    paidPro.canSeeProNav &&
    paidPro.canUseProHud &&
    paidPro.canUseLlm &&
    paidPro.canUseProdeskStyle,
  'paid + pro: shell and membership both Pro',
)
assert(paidPro.editionProjected === 'pro', 'paid + pro: editionProjected pro')

const lifeBasic = getEntitlements(lifetime, { productEdition: 'basic' })
assert(lifeBasic.isBillingPro, 'lifetime + basic: membership still active')
assert(!lifeBasic.canSeeProNav, 'lifetime + basic: nav stays basic')

const lifePro = getEntitlements(lifetime, { productEdition: 'pro' })
assert(lifePro.isBillingPro && lifePro.canSeeProNav, 'lifetime + pro: flags true')

const skinBasic = getEntitlements(free, { productEdition: 'basic' })
assert(!skinBasic.isBillingPro && skinBasic.editionProjected === 'basic', 'free+basic stays basic')

// Landing「进入基础版」and Settings switch must not be snapped back to Pro.
assert(
  nextProductEdition({
    currentEdition: 'basic',
    isBillingPro: true,
    localFreePro: false,
  }) === 'basic',
  'paid user who picked basic stays basic',
)
assert(
  nextProductEdition({
    currentEdition: 'pro',
    isBillingPro: true,
    localFreePro: false,
  }) === 'pro',
  'paid user on pro stays pro until they switch',
)
assert(
  nextProductEdition({
    currentEdition: 'pro',
    isBillingPro: false,
    localFreePro: false,
  }) === 'basic',
  'expired Pro falls back to basic',
)
assert(
  nextProductEdition({
    currentEdition: 'basic',
    isBillingPro: true,
    localFreePro: false,
    activatePro: true,
  }) === 'pro',
  'redeem / activatePro may enter Pro',
)
assert(
  nextProductEdition({
    currentEdition: 'pro',
    isBillingPro: false,
    localFreePro: true,
  }) === 'pro',
  'local free-Pro host may keep explicit Pro',
)

if (failed) {
  console.error(`\n${failed} assertion(s) failed`)
  process.exit(1)
}
console.log('\nsmoke_entitlements: all passed')
