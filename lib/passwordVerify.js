/**
 * Match client WebCrypto PBKDF2 (SHA-256, 120000 iters, 32-byte key) for vault password login.
 */
import crypto from 'node:crypto'

export function verifyPasswordNode(password, saltB64, hashB64) {
  const pw = String(password || '')
  const saltB64s = String(saltB64 || '')
  const hashB64s = String(hashB64 || '')
  if (!pw || !saltB64s || !hashB64s) return false
  let salt
  try {
    salt = Buffer.from(saltB64s, 'base64')
  } catch {
    return false
  }
  if (!salt.length) return false
  const derived = crypto.pbkdf2Sync(pw, salt, 120000, 32, 'sha256')
  const got = derived.toString('base64')
  const a = Buffer.from(got)
  const b = Buffer.from(hashB64s)
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}
