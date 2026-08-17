/**
 * Commercial entitlements — single source of truth.
 * When free-Pro launch (or localhost): Pro is free to choose; productEdition still controls the shell.
 * When charging: entitlements = f(billing).
 */

import { isLocalFreeProHost } from './localOwner.js'

/** Mirror of billing.isProActive — kept local so Node smoke needs no Vite aliases. */
function isBillingProActive(state = {}) {
  if (state.plan !== 'pro') return false
  if (state.proUntil == null) return true
  return Number(state.proUntil) > Date.now()
}

/**
 * @param {{ plan?: string, proUntil?: number|null }|null|undefined} billingState
 * @param {{ productEdition?: string }|null|undefined} profile
 * @returns {{
 *   canUseProHud: boolean,
 *   canUseLlm: boolean,
 *   canSeeProNav: boolean,
 *   canUseProdeskStyle: boolean,
 *   isBillingPro: boolean,
 *   editionProjected: 'basic'|'pro',
 *   localFreePro: boolean,
 * }}
 */
export function getEntitlements(billingState, profile) {
  const localFreePro = isLocalFreeProHost()
  const paid = isBillingProActive(billingState || {})
  const edition = profile?.productEdition
  // Free-Pro launch / localhost: follow explicit edition. Paid remote: plan only.
  const isPro = paid || (localFreePro && edition === 'pro')
  if (!isPro) {
    return {
      canUseProHud: false,
      canUseLlm: false,
      canSeeProNav: false,
      canUseProdeskStyle: false,
      isBillingPro: false,
      editionProjected: 'basic',
      localFreePro,
    }
  }
  return {
    canUseProHud: true,
    canUseLlm: true,
    canSeeProNav: true,
    canUseProdeskStyle: true,
    isBillingPro: true,
    editionProjected: 'pro',
    localFreePro,
  }
}

/** Alias used in solution doc */
export const deriveEntitlements = getEntitlements
