/**
 * Supabase Auth Hook: Send Email via Aliyun DirectMail.
 *
 * Deploy:
 *   npx supabase functions deploy send-email --no-verify-jwt
 *
 * Dashboard → Authentication → Hooks → Send Email
 *
 * Secrets:
 *   SEND_EMAIL_HOOK_SECRET, ALIYUN_ACCESS_KEY_ID, ALIYUN_ACCESS_KEY_SECRET,
 *   ALIYUN_DM_ACCOUNT_NAME, ALIYUN_DM_FROM_ALIAS (optional)
 */
import { Webhook } from 'https://esm.sh/standardwebhooks@1.0.0'

function percentEncode(s: string) {
  return encodeURIComponent(s)
    .replace(/!/g, '%21')
    .replace(/'/g, '%27')
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29')
    .replace(/\*/g, '%2A')
}

async function aliyunSendMail(to: string, subject: string, textBody: string) {
  const accessKeyId = Deno.env.get('ALIYUN_ACCESS_KEY_ID') || ''
  const accessKeySecret = Deno.env.get('ALIYUN_ACCESS_KEY_SECRET') || ''
  const accountName = Deno.env.get('ALIYUN_DM_ACCOUNT_NAME') || ''
  const fromAlias = Deno.env.get('ALIYUN_DM_FROM_ALIAS') || 'FinDigest'
  if (!accessKeyId || !accessKeySecret || !accountName) {
    throw new Error('Aliyun DirectMail env missing')
  }

  const params: Record<string, string> = {
    Format: 'JSON',
    Version: '2015-11-23',
    AccessKeyId: accessKeyId,
    SignatureMethod: 'HMAC-SHA1',
    Timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    SignatureVersion: '1.0',
    SignatureNonce: crypto.randomUUID(),
    Action: 'SingleSendMail',
    AccountName: accountName,
    AddressType: '1',
    ReplyToAddress: 'true',
    ToAddress: to,
    FromAlias: fromAlias,
    Subject: subject,
    TextBody: textBody,
  }
  const sorted = Object.keys(params).sort()
  const canonical = sorted.map((k) => `${percentEncode(k)}=${percentEncode(params[k])}`).join('&')
  const stringToSign = `POST&${percentEncode('/')}&${percentEncode(canonical)}`
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(`${accessKeySecret}&`),
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign'],
  )
  const sigBuf = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(stringToSign))
  const signature = btoa(String.fromCharCode(...new Uint8Array(sigBuf)))
  params.Signature = signature

  const res = await fetch('https://dm.aliyuncs.com/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params),
  })
  const json = await res.json()
  if (json.Code && json.Code !== 'OK') {
    throw new Error(json.Message || json.Code)
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('method', { status: 405 })
  const payload = await req.text()
  const secret = (Deno.env.get('SEND_EMAIL_HOOK_SECRET') || '').replace('v1,whsec_', '')
  const wh = new Webhook(secret)
  try {
    const headers = Object.fromEntries(req.headers)
    const data = wh.verify(payload, headers) as {
      user: { email?: string }
      email?: { otp?: string }
      email_data?: { token?: string; email_action_type?: string }
    }
    const to = data.user?.email || ''
    const otp = data.email?.otp || data.email_data?.token || ''
    const subject = 'FinDigest 验证码'
    const text = `你的 FinDigest 验证码是：${otp}\n\n10 分钟内有效。如非本人操作请忽略。`
    await aliyunSendMail(to, subject, text)
    return new Response(JSON.stringify({}), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (e) {
    console.error('[send-email]', e)
    return new Response(JSON.stringify({ error: String((e as Error)?.message || e) }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
