import { checkRateLimitAsync, getClientIp, rateLimitResponse } from '../lib/rateLimit.js'
import {
  applyVaultCors,
  buildClearVaultCookies,
  buildVaultSetCookies,
  readSessionFromRequest,
} from '../lib/vaultSession.js'
import { authorizeIdentity } from '../lib/apiAuth.js'
import { putPrivateJson, readPrivateJson } from '../lib/secureBlob.js'
import { normalizeEmail } from '../lib/emailOtp.js'
import { verifyPasswordNode } from '../lib/passwordVerify.js'
import { isAccountBanned, upsertAccountMeta } from '../lib/accountAdmin.js'

/**
 * Private encrypted vault store (cross-device account memory).
 * Requires BLOB_READ_WRITE_TOKEN on Vercel.
 *
 * Auth (GET/PUT):
 *   - httpOnly fd_sess cookie (HMAC), OR
 *   - X-Email-Proof header (OTP-verified short-lived token)
 *
 * Auth (POST login):
 *   - { login:true, email, password } — password verified against vault
 *     salt/passwordHash; sets fd_sess and returns encrypted vault (no OTP)
 *
 * PUT rules:
 *   - New email (no blob): emailProof register/login OK
 *   - Existing vault: session must match accountId, OR emailProof + matching
 *     passwordHash (same salt/hash) for same accountId — blocks OTP-only takeover
 *   - Optional baseUpdatedAt: if cloud updatedAt is newer → 409 conflict
 *     (clients may send force:true to overwrite after user confirm)
 *
 * Body size: enc.payload capped (~512KB decoded estimate via string length).
 */

export const config = { runtime: 'nodejs', maxDuration: 15 }

const MAX_ENC_CHARS = 700_000 // ~0.5MB base64-ish payload safety

function keyFor(email) {
  const safe = String(email || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9@._+-]/g, '_')
  return `findigest-vaults/${safe}.json`
}

function setCookies(res, cookies) {
  if (!cookies?.length) return
  res.setHeader('Set-Cookie', cookies)
}

function publicVaultView(data) {
  if (!data) return data
  // Clients need salt + passwordHash to verify local password before decrypt.
  // Do not add extra secrets; never include emailProof/session material.
  return {
    email: data.email,
    accountId: data.accountId,
    displayName: data.displayName || '',
    salt: data.salt,
    passwordHash: data.passwordHash,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
    enc: data.enc,
    sessionOk: data.sessionOk || false,
  }
}

export default async function handler(req, res) {
  applyVaultCors(req, res)
  if (req.method === 'OPTIONS') return res.status(204).end()

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return res.status(503).json({
      error: 'cloud_unconfigured',
      message: '云端账号记忆未配置（缺少 BLOB_READ_WRITE_TOKEN）。本机私人隔离仍可用。',
    })
  }

  try {
    if (req.method === 'DELETE') {
      setCookies(res, buildClearVaultCookies())
      return res.status(200).json({ ok: true, cleared: true })
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}
      if (body.login !== true) {
        return res.status(400).json({ error: 'invalid_action', message: '未知操作' })
      }
      const email = normalizeEmail(body.email || '')
      const password = String(body.password || '')
      if (!email || !password) {
        return res.status(400).json({ error: 'invalid_body', message: '请填写账号和密码' })
      }
      const ip = getClientIp(req)
      const rlIp = await checkRateLimitAsync(`vault:pwlogin:${ip}`, {
        limit: 30,
        windowMs: 15 * 60_000,
      })
      if (!rlIp.ok) {
        return rateLimitResponse(res, rlIp.retryAfterSec, '登录尝试过于频繁，请稍后再试')
      }
      const rlEmail = await checkRateLimitAsync(`vault:pwlogin:email:${email}`, {
        limit: 12,
        windowMs: 15 * 60_000,
      })
      if (!rlEmail.ok) {
        return rateLimitResponse(res, rlEmail.retryAfterSec, '该账号登录尝试过多，请稍后再试')
      }

      const data = await readPrivateJson(keyFor(email))
      if (!data?.salt || !data?.passwordHash || !data?.enc) {
        return res.status(404).json({ error: 'not_found', message: '云端无此账号，请先注册' })
      }
      if (await isAccountBanned(email)) {
        return res.status(403).json({ error: 'banned', message: '账号已封禁，请联系客服' })
      }
      const ok = verifyPasswordNode(password, data.salt, data.passwordHash)
      if (!ok) {
        return res.status(401).json({ error: 'bad_password', message: '密码错误' })
      }
      setCookies(res, buildVaultSetCookies({ accountId: data.accountId, email }))
      data.sessionOk = true
      upsertAccountMeta({
        email,
        accountId: data.accountId,
        displayName: data.displayName || '',
        createdAt: data.createdAt,
        lastSeenAt: Date.now(),
      }).catch(() => {})
      return res.status(200).json(publicVaultView(data))
    }

    if (req.method === 'GET') {
      const sess = readSessionFromRequest(req)
      const emailQ = normalizeEmail(req.query.email || '')
      let email = emailQ
      if (sess?.email && (!emailQ || emailQ === sess.email)) {
        email = sess.email
      }

      const ip = getClientIp(req)
      const rlIp = await checkRateLimitAsync(`vault:login:${ip}`, {
        limit: 40,
        windowMs: 15 * 60_000,
      })
      if (!rlIp.ok) {
        return rateLimitResponse(res, rlIp.retryAfterSec, '登录尝试过于频繁，请稍后再试')
      }
      if (email) {
        const rlEmail = await checkRateLimitAsync(`vault:login:email:${email}`, {
          limit: 20,
          windowMs: 15 * 60_000,
        })
        if (!rlEmail.ok) {
          return rateLimitResponse(res, rlEmail.retryAfterSec, '该账号登录尝试过多，请稍后再试')
        }
      }
      if (!email) return res.status(400).json({ error: 'email_required' })

      if (String(req.query.session || '') === '1') {
        if (sess?.email === email) {
          return res.status(200).json({
            session: true,
            accountId: sess.accountId,
            email: sess.email,
            exp: sess.exp,
          })
        }
        return res.status(401).json({ session: false, error: 'no_session' })
      }

      const authz = authorizeIdentity(req, {
        email,
        allowPurposes: ['login', 'register', 'reset'],
      })
      if (!authz.ok) {
        return res.status(authz.status).json({
          error: authz.error,
          message: authz.message,
        })
      }

      const pathname = keyFor(email)
      const data = await readPrivateJson(pathname)
      if (!data) return res.status(404).json({ error: 'not_found' })
      if (await isAccountBanned(email)) {
        return res.status(403).json({ error: 'banned', message: '账号已封禁，请联系客服' })
      }

      if (sess?.email === email && sess.accountId === data.accountId) {
        data.sessionOk = true
      }
      return res.status(200).json(publicVaultView(data))
    }

    if (req.method === 'PUT') {
      const ip = getClientIp(req)
      const rl = await checkRateLimitAsync(`vault:put:${ip}`, { limit: 40, windowMs: 15 * 60_000 })
      if (!rl.ok) {
        return rateLimitResponse(res, rl.retryAfterSec, '同步过于频繁，请稍后再试')
      }
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}
      if (body.logout === true) {
        setCookies(res, buildClearVaultCookies())
        return res.status(200).json({ ok: true, cleared: true })
      }
      const email = normalizeEmail(body.email || '')
      if (!email || !body.accountId || !body.enc?.iv || !body.enc?.payload) {
        return res.status(400).json({ error: 'invalid_body' })
      }
      const payloadLen = String(body.enc.payload || '').length
      if (payloadLen > MAX_ENC_CHARS) {
        return res.status(413).json({
          error: 'payload_too_large',
          message: '云端保险箱内容过大，请精简后再同步',
        })
      }

      const authz = authorizeIdentity(req, {
        email,
        allowPurposes: ['login', 'register', 'reset'],
        body,
      })
      if (!authz.ok) {
        return res.status(authz.status).json({
          error: authz.error,
          message: authz.message,
        })
      }

      const pathname = keyFor(email)
      const existing = await readPrivateJson(pathname)
      const isReset = authz.via === 'emailProof' && authz.proof?.purpose === 'reset'

      if (existing) {
        // Existing cloud vault: block OTP-only account replacement
        if (authz.via === 'session') {
          if (authz.session.accountId !== String(body.accountId)) {
            return res.status(403).json({
              error: 'account_mismatch',
              message: '会话账号不匹配',
            })
          }
          if (String(existing.accountId) !== String(body.accountId)) {
            return res.status(403).json({
              error: 'vault_account_mismatch',
              message: '云端账号与会话不一致，请重新登录',
            })
          }
        } else if (isReset) {
          // Forgot-password: OTP proves email; must keep same accountId; may rotate credentials
          if (String(existing.accountId) !== String(body.accountId)) {
            return res.status(409).json({
              error: 'account_mismatch',
              message: '重置须沿用原账号，请刷新后重试',
            })
          }
        } else {
          // emailProof login/register path: must keep same accountId + password credentials
          if (String(existing.accountId) !== String(body.accountId)) {
            return res.status(409).json({
              error: 'account_exists',
              message: '该邮箱已有云端账号，请使用原密码登录后再同步',
            })
          }
          if (
            String(existing.salt || '') !== String(body.salt || '') ||
            String(existing.passwordHash || '') !== String(body.passwordHash || '')
          ) {
            return res.status(403).json({
              error: 'credential_mismatch',
              message: '凭证不匹配，无法覆盖云端保险箱',
            })
          }
        }
      } else if (isReset) {
        return res.status(404).json({
          error: 'not_found',
          message: '云端无此账号，请先注册',
        })
      } else if (authz.via === 'session' && authz.session.accountId !== String(body.accountId)) {
        return res.status(403).json({
          error: 'account_mismatch',
          message: '会话账号不匹配',
        })
      }

      // Password reset / rotate: always overwrite (new enc + credentials)
      const skipConflict = isReset || body.force === true
      if (
        existing &&
        !skipConflict &&
        body.baseUpdatedAt != null &&
        existing.updatedAt != null
      ) {
        const base = Number(body.baseUpdatedAt)
        const cur = Number(existing.updatedAt)
        if (Number.isFinite(base) && Number.isFinite(cur) && cur > base) {
          return res.status(409).json({
            error: 'conflict',
            message: '云端有更新版本，请先拉取再同步',
            updatedAt: cur,
          })
        }
      }

      const now = Date.now()
      const payload = {
        email,
        accountId: body.accountId,
        displayName: body.displayName || existing?.displayName || '',
        salt: body.salt,
        passwordHash: body.passwordHash,
        createdAt: body.createdAt || existing?.createdAt || now,
        updatedAt: now,
        enc: body.enc,
        rotatedAt: isReset || body.rotateCredentials ? now : existing?.rotatedAt,
      }
      await putPrivateJson(pathname, payload)
      upsertAccountMeta({
        email,
        accountId: body.accountId,
        displayName: payload.displayName || '',
        createdAt: payload.createdAt,
        lastSeenAt: now,
      }).catch(() => {})
      setCookies(res, buildVaultSetCookies({ accountId: body.accountId, email }))
      return res.status(200).json({
        ok: true,
        updatedAt: now,
        reset: !!isReset,
        sessionCookie: !!process.env.VAULT_SESSION_SECRET,
      })
    }

    return res.status(405).json({ error: 'method_not_allowed' })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ error: 'server_error', message: String(e?.message || e) })
  }
}
