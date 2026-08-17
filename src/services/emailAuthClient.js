/**
 * Client helpers for /api/auth email / SMS OTP.
 */
import { apiUrl, fetchTimed } from '@/services/apiClient.js'

/**
 * @param {{
 *   action: 'send'|'verify',
 *   channel?: 'email'|'sms',
 *   email?: string,
 *   phone?: string,
 *   purpose: 'login'|'register',
 *   code?: string,
 * }}
 */
export async function postEmailAuth(body) {
  const res = await fetchTimed(
    apiUrl('/api/auth'),
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body),
    },
    20000,
  )
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(data.message || data.error || `HTTP ${res.status}`)
    err.status = res.status
    err.code = data.error || data.code
    err.data = data
    throw err
  }
  return data
}
