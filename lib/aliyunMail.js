/**
 * Aliyun DirectMail — OTP to QQ / 163 / etc.
 * Requires a verified sender domain + AccountName in DirectMail console.
 */
import { aliyunCredentials, aliyunRpcCall } from './aliyunRpc.js'

function purposeLabel(purpose) {
  if (purpose === 'register') return '注册'
  if (purpose === 'reset') return '重置密码'
  return '登录'
}

export async function sendAliyunMail({ email, code, purpose }) {
  const { accessKeyId, accessKeySecret } = aliyunCredentials()
  const accountName = String(process.env.ALIYUN_DM_ACCOUNT_NAME || '').trim()
  const fromAlias = String(process.env.ALIYUN_DM_FROM_ALIAS || 'FinDigest').trim()
  const region = String(process.env.ALIYUN_DM_REGION || 'cn-hangzhou').trim()
  if (!accessKeyId || !accessKeySecret || !accountName) {
    return { sent: false, reason: 'mail_unconfigured' }
  }

  const label = purposeLabel(purpose)
  const subject = `FinDigest ${label}验证码`
  const textBody = `你的 FinDigest ${label}验证码是：${code}\n\n10 分钟内有效。如非本人操作请忽略。`

  const endpoint =
    region === 'ap-southeast-1'
      ? 'https://dm.ap-southeast-1.aliyuncs.com/'
      : 'https://dm.aliyuncs.com/'

  const result = await aliyunRpcCall({
    endpoint,
    accessKeyId,
    accessKeySecret,
    action: 'SingleSendMail',
    version: '2015-11-23',
    params: {
      AccountName: accountName,
      AddressType: 1,
      ReplyToAddress: 'true',
      ToAddress: String(email || '').trim().toLowerCase(),
      FromAlias: fromAlias,
      Subject: subject,
      TextBody: textBody,
    },
  })
  if (!result.ok) {
    return { sent: false, reason: result.reason || 'mail_failed', detail: result.detail }
  }
  return { sent: true, provider: 'aliyun_dm', requestId: result.data?.RequestId }
}
