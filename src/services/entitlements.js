/**
 * Commercial entitlements — single source of truth.
 * Free-launch / local host can pick Pro without payment. productEdition is the chosen desk.
 * Paid + basic still stays Museum Desk. Login is optional.
 */

import { isLocalFreeProHost } from './localOwner.js'

/** Mirror of billing.isProActive — kept local so Node smoke needs no Vite aliases. */
function isBillingProActive(state = {}) {
  if (state.plan !== 'pro') return false
  if (state.proUntil == null) return true
  return Number(state.proUntil) > Date.now()
}

/**
 * @param {{
 *   currentEdition?: string | null,
 *   isBillingPro?: boolean,
 *   localFreePro?: boolean,
 *   activatePro?: boolean,
 * }} input
 * @returns {'basic'|'pro'|string|null}
 */
export function nextProductEdition({
  currentEdition,
  isBillingPro = false,
  localFreePro = false,
  activatePro = false,
} = {}) {
  if (activatePro && (isBillingPro || localFreePro)) return 'pro'
  if (currentEdition === 'pro' && !isBillingPro && !localFreePro) return 'basic'
  if (currentEdition === 'basic' || currentEdition === 'pro') return currentEdition
  return currentEdition || null
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
 *   canChoosePro: boolean,
 * }}
 */
export function getEntitlements(billingState, profile) {
  const localFreePro = isLocalFreeProHost()
  const paid = isBillingProActive(billingState || {})
  const edition = profile?.productEdition
  const canChoosePro = paid || localFreePro
  const shellPro = canChoosePro && edition === 'pro'
  return {
    canUseProHud: shellPro,
    canUseLlm: shellPro,
    canSeeProNav: shellPro,
    canUseProdeskStyle: shellPro,
    isBillingPro: paid,
    editionProjected: shellPro ? 'pro' : 'basic',
    localFreePro,
    canChoosePro,
  }
}

/** Alias used in solution doc */
export const deriveEntitlements = getEntitlements
