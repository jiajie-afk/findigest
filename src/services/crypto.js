/** WebCrypto helpers for account passwords + vault encryption */
// Next phase: migrate session token to httpOnly Secure cookies (XSS-resistant).

/**
 * Register password policy: min 8 chars, at least one letter + one number.
 * @returns {{ ok: boolean, score: number, label: string, message: string }}
 */
export function validatePasswordStrength(password) {
  const pw = String(password || '')
  let score = 0
  if (pw.length >= 8) score += 1
  if (pw.length >= 12) score += 1
  if (/[a-zA-Z]/.test(pw)) score += 1
  if (/\d/.test(pw)) score += 1
  if (/[^a-zA-Z0-9]/.test(pw)) score += 1
  score = Math.min(4, score)

  if (pw.length < 8) {
    return { ok: false, score: Math.min(score, 1), label: '太短', message: '密码至少 8 位' }
  }
  if (!/[a-zA-Z]/.test(pw) || !/\d/.test(pw)) {
    return { ok: false, score: Math.min(score, 2), label: '较弱', message: '密码需同时包含字母和数字' }
  }
  const labels = ['太短', '较弱', '一般', '较强', '很强']
  return { ok: true, score, label: labels[score] || '较强', message: '' }
}


const te = new TextEncoder()
const td = new TextDecoder()

function bufToB64(buf) {
  const bytes = buf instanceof ArrayBuffer ? new Uint8Array(buf) : buf
  let s = ''
  bytes.forEach((b) => {
    s += String.fromCharCode(b)
  })
  return btoa(s)
}

function b64ToBuf(b64) {
  const s = atob(b64)
  const bytes = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i)
  return bytes.buffer
}

export function uid() {
  if (crypto.randomUUID) return crypto.randomUUID()
  return `u_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

export async function hashPassword(password, saltB64) {
  const salt = saltB64 ? new Uint8Array(b64ToBuf(saltB64)) : crypto.getRandomValues(new Uint8Array(16))
  const keyMaterial = await crypto.subtle.importKey('raw', te.encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 120000, hash: 'SHA-256' },
    keyMaterial,
    256,
  )
  return { hash: bufToB64(bits), salt: bufToB64(salt) }
}

export async function verifyPassword(password, saltB64, hashB64) {
  const { hash } = await hashPassword(password, saltB64)
  return hash === hashB64
}

async function deriveAesKey(password, saltB64) {
  const salt = new Uint8Array(b64ToBuf(saltB64))
  const keyMaterial = await crypto.subtle.importKey('raw', te.encode(password), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 120000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export async function encryptJson(password, saltB64, data) {
  const key = await deriveAesKey(password, saltB64)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, te.encode(JSON.stringify(data)))
  return { iv: bufToB64(iv), payload: bufToB64(cipher) }
}

export async function decryptJson(password, saltB64, ivB64, payloadB64) {
  const key = await deriveAesKey(password, saltB64)
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: new Uint8Array(b64ToBuf(ivB64)) },
    key,
    b64ToBuf(payloadB64),
  )
  return JSON.parse(td.decode(plain))
}
