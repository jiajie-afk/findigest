#!/usr/bin/env node
/**
 * Report which email/SMS OTP env vars are present (never prints secret values).
 * Usage: npm run doctor:auth
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const envPath = path.join(root, '.env')

function loadDotEnv() {
  const map = {}
  if (!fs.existsSync(envPath)) return map
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue
    const i = line.indexOf('=')
    if (i < 0) continue
    map[line.slice(0, i)] = line.slice(i + 1)
  }
  return map
}

const env = { ...loadDotEnv(), ...process.env }

function present(key) {
  return !!(String(env[key] || '').trim())
}

const rows = [
  ['ALIYUN_ACCESS_KEY_ID', '阿里云 AK'],
  ['ALIYUN_ACCESS_KEY_SECRET', '阿里云 SK'],
  ['ALIYUN_SMS_SIGN_NAME', '短信签名'],
  ['ALIYUN_SMS_TEMPLATE_CODE', '短信模板'],
  ['ALIYUN_DM_ACCOUNT_NAME', '发信地址'],
  ['ALIYUN_DM_FROM_ALIAS', '发件显示名'],
  ['EMAIL_OTP_SECRET', 'OTP HMAC'],
  ['VAULT_SESSION_SECRET', '会话 cookie'],
  ['RESEND_API_KEY', 'Resend 备选'],
  ['BLOB_READ_WRITE_TOKEN', '云端 vault'],
]

const smsOk =
  present('ALIYUN_ACCESS_KEY_ID') &&
  present('ALIYUN_ACCESS_KEY_SECRET') &&
  present('ALIYUN_SMS_SIGN_NAME') &&
  present('ALIYUN_SMS_TEMPLATE_CODE')
const mailOk =
  present('ALIYUN_ACCESS_KEY_ID') &&
  present('ALIYUN_ACCESS_KEY_SECRET') &&
  present('ALIYUN_DM_ACCOUNT_NAME')
const otpOk = present('EMAIL_OTP_SECRET')

console.log('\nFinDigest auth doctor (.env / process.env，不打印密钥)\n')
for (const [key, label] of rows) {
  console.log(`  ${present(key) ? '✓' : '·'}  ${label.padEnd(12)} ${key}`)
}
console.log('')
console.log(`  手机短信通道: ${smsOk ? '本地配置齐全' : '缺项 — npm run setup:china-auth'}`)
console.log(`  邮箱发信通道: ${mailOk ? '本地配置齐全' : '缺项（或仅靠 Resend）'}`)
console.log(`  OTP 密钥:     ${otpOk ? '已配置' : '缺 EMAIL_OTP_SECRET（生产会 503）'}`)
console.log('')
console.log('  下一步: npm run setup:china-auth  →  配完后 Redeploy Vercel\n')
process.exit(smsOk && mailOk && otpOk ? 0 : 1)
