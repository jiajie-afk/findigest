/**
 * Aliyun SMS (Dysmsapi) — OTP delivery for China mobiles.
 */
import { aliyunCredentials, aliyunRpcCall } from './aliyunRpc.js'

export async function sendAliyunSms({ phone, code }) {
  const { accessKeyId, accessKeySecret } = aliyunCredentials()
  const signName = String(process.env.ALIYUN_SMS_SIGN_NAME || '').trim()
  const templateCode = String(process.env.ALIYUN_SMS_TEMPLATE_CODE || '').trim()
  if (!accessKeyId || !accessKeySecret || !signName || !templateCode) {
    return { sent: false, reason: 'sms_unconfigured' }
  }
  const phoneNorm = String(phone || '').replace(/\D/g, '')
  if (!/^1\d{10}$/.test(phoneNorm)) {
    return { sent: false, reason: 'invalid_phone', detail: '需要大陆 11 位手机号' }
  }

  const result = await aliyunRpcCall({
    endpoint: 'https://dysmsapi.aliyuncs.com/',
    accessKeyId,
    accessKeySecret,
    action: 'SendSms',
    version: '2017-05-25',
    params: {
      RegionId: 'cn-hangzhou',
      PhoneNumbers: phoneNorm,
      SignName: signName,
      TemplateCode: templateCode,
      TemplateParam: JSON.stringify({ code: String(code) }),
    },
  })
  if (!result.ok) {
    return { sent: false, reason: result.reason || 'sms_failed', detail: result.detail }
  }
  return { sent: true, provider: 'aliyun_sms', requestId: result.data?.RequestId }
}
