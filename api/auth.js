/**
 * Email / SMS OTP auth API.
 * POST {
 *   action: 'send'|'verify',
 *   channel?: 'email'|'sms',
 *   email?, phone?,
 *   purpose: 'login'|'register'|'reset',
 *   code?
 * }
 */
import { checkRateLimitAsync, getClientIp, rateLimitResponse } from '../lib/rateLimit.js'
import { applyVaultCors } from '../lib/vaultSession.js'
import { requireOtpSecretConfigured } from '../lib/apiAuth.js'
import {
  normalizeEmail,
  isValidEmail,
  normalizePhone,
  isValidPhone,
  phoneVaultEmail,
  generateOtpCode,
  saveOtp,
  consumeOtp,
  signEmailProof,
  sendOtpEmail,
  sendOtpSms,
  canRevealDevCode,
} from '../lib/emailOtp.js'

export const config = { runtime: 'nodejs', maxDuration: 15 }

function normalizePurpose(raw) {
  const p = String(raw || '').trim()
  if (p === 'register') return 'register'
  if (p === 'reset') return 'reset'
  return 'login'
}

function deliveryStatus() {
  const ak =
    !!String(process.env.ALIYUN_ACCESS_KEY_ID || '').trim() &&
    !!String(process.env.ALIYUN_ACCESS_KEY_SECRET || '').trim()
  const sms =
    ak &&
    !!String(process.env.ALIYUN_SMS_SIGN_NAME || '').trim() &&
    !!String(process.env.ALIYUN_SMS_TEMPLATE_CODE || '').trim()
  const mail = ak && !!String(process.env.ALIYUN_DM_ACCOUNT_NAME || '').trim()
  const resend = !!String(process.env.RESEND_API_KEY || '').trim()
  return {
    smsConfigured: sms,
    emailConfigured: mail || resend,
    aliyunMail: mail,
    resendMail: resend,
  }
}

export default async function handler(req, res) {
  applyVaultCors(req, res)
  if (req.method === 'OPTIONS') return res.status(204).end()

  if (req.method === 'GET') {
    const secretGate = requireOtpSecretConfigured()
    const delivery = deliveryStatus()
    return res.status(200).json({
      ok: secretGate.ok,
      otpSecret: secretGate.ok,
      ...delivery,
      message: !secretGate.ok
        ? secretGate.message
        : delivery.smsConfigured && delivery.emailConfigured
          ? '邮箱与短信通道已配置'
          : '部分通道未配置：本地开发可能显示开发码，生产需配齐阿里云',
    })
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' })

  const secretGate = requireOtpSecretConfigured()
  if (!secretGate.ok) {
    return res.status(secretGate.status).json({
      error: secretGate.error,
      message: secretGate.message,
    })
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}
    const action = String(body.action || '').trim()
    const channel = body.channel === 'sms' ? 'sms' : 'email'
    const purpose = normalizePurpose(body.purpose)
    const ip = getClientIp(req)

    let identity = ''
    let proofEmail = ''
    if (channel === 'sms') {
      const phone = normalizePhone(body.phone || body.email)
      if (!isValidPhone(phone)) {
        return res.status(400).json({ error: 'invalid_phone', message: '请填写有效的大陆手机号' })
      }
      identity = phone
      proofEmail = phoneVaultEmail(phone)
    } else {
      const email = normalizeEmail(body.email)
      if (!isValidEmail(email)) {
        return res.status(400).json({ error: 'invalid_email', message: '请填写有效邮箱' })
      }
      identity = email
      proofEmail = email
    }

    if (action === 'send') {
      if (channel === 'sms' && !deliveryStatus().smsConfigured) {
        return res.status(503).json({
          error: 'sms_disabled',
          message: '短信通道暂未开放，请使用邮箱注册或登录',
        })
      }
      const rlIp = await checkRateLimitAsync(`auth:otp:send:ip:${ip}`, {
        limit: 8,
        windowMs: 15 * 60_000,
      })
      if (!rlIp.ok) return rateLimitResponse(res, rlIp.retryAfterSec, '发送过于频繁，请稍后再试')
      const rlId = await checkRateLimitAsync(`auth:otp:send:id:${channel}:${identity}`, {
        limit: 5,
        windowMs: 15 * 60_000,
      })
      if (!rlId.ok) return rateLimitResponse(res, rlId.retryAfterSec, '该号码发送过多，请稍后再试')

      const code = generateOtpCode()
      // OTP store keys by identity string (email or phone digits)
      const meta = await saveOtp({ email: identity, purpose, code })
      const mail =
        channel === 'sms'
          ? await sendOtpSms({ phone: identity, code })
          : await sendOtpEmail({ email: identity, code, purpose })

      const payload = {
        ok: true,
        channel,
        email: proofEmail,
        phone: channel === 'sms' ? identity : undefined,
        purpose,
        ttlSec: meta.ttlSec,
        emailed: !!mail.sent,
        provider: mail.provider || undefined,
      }
      if (!mail.sent) {
        payload.message =
          channel === 'sms'
            ? '短信服务未配置：本地开发可直接使用下方验证码'
            : '邮件服务未配置：本地开发可直接使用下方验证码'
        if (canRevealDevCode(req)) {
          payload.devCode = code
          payload.devMode = true
        } else {
          payload.message =
            channel === 'sms'
              ? '短信发送失败，请检查阿里云短信签名/模板与 AccessKey'
              : '邮件发送失败，请检查阿里云邮件推送或 RESEND_API_KEY'
          return res.status(503).json({
            error: mail.reason || 'delivery_unconfigured',
            message: payload.message,
            detail: mail.detail || undefined,
          })
        }
      } else {
        payload.message =
          channel === 'sms' ? '验证码已发送，请查收短信' : '验证码已发送，请查收邮箱'
      }
      return res.status(200).json(payload)
    }

    if (action === 'verify') {
      const rlIp = await checkRateLimitAsync(`auth:otp:verify:ip:${ip}`, {
        limit: 40,
        windowMs: 15 * 60_000,
      })
      if (!rlIp.ok) return rateLimitResponse(res, rlIp.retryAfterSec, '验证过于频繁，请稍后再试')

      const code = String(body.code || '').trim()
      if (!/^\d{6}$/.test(code)) {
        return res.status(400).json({ error: 'invalid_code', message: '请输入 6 位验证码' })
      }

      const result = await consumeOtp({ email: identity, purpose, code })
      if (!result.ok) {
        return res.status(400).json({ error: result.code, message: result.message })
      }

      const proof = signEmailProof({ email: proofEmail, purpose })
      return res.status(200).json({
        ok: true,
        channel,
        email: proofEmail,
        phone: channel === 'sms' ? identity : undefined,
        purpose,
        emailProof: proof.emailProof,
        ttlSec: proof.ttlSec,
        message: channel === 'sms' ? '手机已验证' : '邮箱已验证',
      })
    }

    return res.status(400).json({ error: 'invalid_action', message: '未知操作' })
  } catch (e) {
    console.error('[api/auth]', e)
    return res.status(500).json({ error: 'server_error', message: String(e?.message || e) })
  }
}
