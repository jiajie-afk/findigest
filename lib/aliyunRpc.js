/**
 * Minimal Aliyun RPC (POP) signer for Dysmsapi / Dm (DirectMail).
 */
import crypto from 'node:crypto'

function percentEncode(s) {
  return encodeURIComponent(String(s))
    .replace(/!/g, '%21')
    .replace(/'/g, '%27')
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29')
    .replace(/\*/g, '%2A')
}

function isoTimestamp() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')
}

/**
 * @param {{
 *   endpoint: string,
 *   accessKeyId: string,
 *   accessKeySecret: string,
 *   action: string,
 *   version: string,
 *   params?: Record<string, string|number|boolean|undefined|null>,
 * }} opts
 */
export async function aliyunRpcCall(opts) {
  const {
    endpoint,
    accessKeyId,
    accessKeySecret,
    action,
    version,
    params = {},
  } = opts
  if (!accessKeyId || !accessKeySecret) {
    return { ok: false, reason: 'aliyun_unconfigured', detail: 'missing AccessKey' }
  }

  const common = {
    Format: 'JSON',
    Version: version,
    AccessKeyId: accessKeyId,
    SignatureMethod: 'HMAC-SHA1',
    Timestamp: isoTimestamp(),
    SignatureVersion: '1.0',
    SignatureNonce: crypto.randomUUID(),
    Action: action,
  }
  const all = { ...common }
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue
    all[k] = String(v)
  }

  const sorted = Object.keys(all).sort()
  const canonical = sorted.map((k) => `${percentEncode(k)}=${percentEncode(all[k])}`).join('&')
  const stringToSign = `POST&${percentEncode('/')}&${percentEncode(canonical)}`
  const signature = crypto.createHmac('sha1', `${accessKeySecret}&`).update(stringToSign).digest('base64')
  all.Signature = signature

  const body = new URLSearchParams(all).toString()
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), 10_000)
  let res
  try {
    res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      signal: ac.signal,
    })
  } catch (e) {
    clearTimeout(timer)
    return {
      ok: false,
      reason: e?.name === 'AbortError' ? 'aliyun_timeout' : 'aliyun_fetch_failed',
      detail: String(e?.message || e),
    }
  }
  clearTimeout(timer)
  const text = await res.text().catch(() => '')
  let json = null
  try {
    json = JSON.parse(text)
  } catch {
    /* ignore */
  }
  if (!res.ok || (json && json.Code && json.Code !== 'OK')) {
    return {
      ok: false,
      reason: 'aliyun_api_error',
      detail: json?.Message || json?.Code || text.slice(0, 300) || `HTTP ${res.status}`,
      code: json?.Code,
    }
  }
  return { ok: true, data: json }
}

export function aliyunCredentials() {
  return {
    accessKeyId: String(process.env.ALIYUN_ACCESS_KEY_ID || '').trim(),
    accessKeySecret: String(process.env.ALIYUN_ACCESS_KEY_SECRET || '').trim(),
  }
}
