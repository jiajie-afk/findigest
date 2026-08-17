/**
 * Supabase Auth Hook: Send SMS via Aliyun Dysmsapi.
 *
 * Deploy:
 *   npx supabase functions deploy send-sms --no-verify-jwt
 *
 * Dashboard → Authentication → Hooks → Send SMS → HTTPS
 *   URL: https://<project>.supabase.co/functions/v1/send-sms
 *
 * Secrets (supabase secrets set ...):
 *   SEND_SMS_HOOK_SECRET, ALIYUN_ACCESS_KEY_ID, ALIYUN_ACCESS_KEY_SECRET,
 *   ALIYUN_SMS_SIGN_NAME, ALIYUN_SMS_TEMPLATE_CODE
 *
 * Template variable must be named `code` (阿里云控制台模板：您的验证码为 ${code} …).
 */
import { Webhook } from 'https://esm.sh/standardwebhooks@1.0.0'

const ENDPOINT = 'https://dysmsapi.aliyuncs.com/'

function percentEncode(s: string) {
  return encodeURIComponent(s)
    .replace(/!/g, '%21')
    .replace(/'/g, '%27')
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29')
    .replace(/\*/g, '%2A')
}

async function aliyunSendSms(phone: string, code: string) {
  const accessKeyId = Deno.env.get('ALIYUN_ACCESS_KEY_ID') || ''
  const accessKeySecret = Deno.env.get('ALIYUN_ACCESS_KEY_SECRET') || ''
  const signName = Deno.env.get('ALIYUN_SMS_SIGN_NAME') || ''
  const templateCode = Deno.env.get('ALIYUN_SMS_TEMPLATE_CODE') || ''
  if (!accessKeyId || !accessKeySecret || !signName || !templateCode) {
    throw new Error('Aliyun SMS env missing')
  }

  let digits = phone.replace(/\D/g, '')
  if (digits.startsWith('86') && digits.length === 13) digits = digits.slice(2)

  const params: Record<string, string> = {
    Format: 'JSON',
    Version: '2017-05-25',
    AccessKeyId: accessKeyId,
    SignatureMethod: 'HMAC-SHA1',
    Timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    SignatureVersion: '1.0',
    SignatureNonce: crypto.randomUUID(),
    Action: 'SendSms',
    RegionId: 'cn-hangzhou',
    PhoneNumbers: digits,
    SignName: signName,
    TemplateCode: templateCode,
    TemplateParam: JSON.stringify({ code }),
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

  const res = await fetch(ENDPOINT, {
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
  const secret = (Deno.env.get('SEND_SMS_HOOK_SECRET') || '').replace('v1,whsec_', '')
  const wh = new Webhook(secret)
  try {
    const headers = Object.fromEntries(req.headers)
    const { user, sms } = wh.verify(payload, headers) as {
      user: { phone?: string }
      sms: { otp: string }
    }
    const phone = user.phone || ''
    await aliyunSendSms(phone, sms.otp)
    return new Response(JSON.stringify({}), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (e) {
    console.error('[send-sms]', e)
    return new Response(JSON.stringify({ error: String((e as Error)?.message || e) }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
