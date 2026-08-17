/** Mainland China mobile → 11 digits, or '' if invalid. Mirrors server normalizePhone. */
export function normalizeMainlandPhone(raw) {
  let d = String(raw || '').replace(/\D/g, '')
  if (d.startsWith('0086')) d = d.slice(4)
  else if (d.startsWith('86') && d.length === 13) d = d.slice(2)
  if (/^1\d{10}$/.test(d)) return d
  return ''
}

export function smsVaultEmail(rawPhone) {
  const phone = normalizeMainlandPhone(rawPhone)
  return phone ? `p${phone}@sms.findigest.local` : ''
}
