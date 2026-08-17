/**
 * Free-Pro gate (no paywall when choosing Pro edition).
 *
 * - Localhost / loopback: always free (owner machine).
 * - Production: PRO_FREE_LAUNCH unlocks free Pro for everyone.
 *   Keep false when using admin console to grant after payment.
 */

/** Temporary: Pro free on live site. Prefer admin grant (semi-auto) when false. */
export const PRO_FREE_LAUNCH = false

export function isTrueLocalhost() {
  if (typeof window === 'undefined' || !window.location) return false
  const host = String(window.location.hostname || '').toLowerCase()
  return host === 'localhost' || host === '127.0.0.1' || host === '::1'
}

/** True when user may pick Pro without redeem / payment. */
export function isLocalFreeProHost() {
  return PRO_FREE_LAUNCH || isTrueLocalhost()
}

/** Short status / price copy for free-Pro mode. */
export function freeProStatusLabel() {
  if (PRO_FREE_LAUNCH) return '限时免费'
  if (isTrueLocalhost()) return '本地免费'
  return '免费'
}
