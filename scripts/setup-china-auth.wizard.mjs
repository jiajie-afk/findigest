#!/usr/bin/env node
/**
 * Aliyun email + SMS OTP setup (FinDigest).
 * Supabase is optional and skipped by default — login already uses /api/auth.
 *
 * Usage: npm run setup:china-auth
 */
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import readline from 'node:readline'
import { fileURLToPath } from 'node:url'
import { spawn, spawnSync } from 'node:child_process'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ENV_FILE = process.env.ENV_FILE || path.join(root, '.env')
const written = []

const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
const ask = (q, { secret = false, def = '' } = {}) =>
  new Promise((resolve) => {
    if (secret && process.stdin.isTTY) {
      process.stdout.write(q)
      let buf = ''
      const onData = (char) => {
        const c = char.toString('utf8')
        if (c === '\n' || c === '\r' || c === '\u0004') {
          process.stdin.setRawMode?.(false)
          process.stdin.removeListener('data', onData)
          process.stdout.write('\n')
          resolve(buf || def)
        } else if (c === '\u0003') process.exit(130)
        else if (c === '\u007f' || c === '\b') buf = buf.slice(0, -1)
        else {
          buf += c
          process.stdout.write('*')
        }
      }
      process.stdin.setRawMode?.(true)
      process.stdin.resume()
      process.stdin.on('data', onData)
      return
    }
    rl.question(q, (ans) => resolve((ans || '').trim() || def))
  })

function readEnv(key) {
  if (!fs.existsSync(ENV_FILE)) return ''
  const line = fs
    .readFileSync(ENV_FILE, 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.startsWith(`${key}=`))
    .pop()
  return line ? line.slice(key.length + 1) : ''
}

function writeEnv(key, value) {
  let text = fs.existsSync(ENV_FILE) ? fs.readFileSync(ENV_FILE, 'utf8') : ''
  const lines = text.split(/\r?\n/).filter((l) => l && !l.startsWith(`${key}=`))
  lines.push(`${key}=${value}`)
  fs.writeFileSync(ENV_FILE, `${lines.join('\n')}\n`, 'utf8')
  written.push(key)
  console.log(`  ✓ wrote ${key} → ${path.relative(root, ENV_FILE)}`)
}

function openUrl(url) {
  console.log(`  ↗ ${url}`)
  try {
    if (process.platform === 'win32') spawn('cmd', ['/c', 'start', '', url], { detached: true, stdio: 'ignore' })
    else if (process.platform === 'darwin') spawn('open', [url], { detached: true, stdio: 'ignore' })
    else spawn('xdg-open', [url], { detached: true, stdio: 'ignore' })
  } catch {
    /* ignore */
  }
}

async function pause(msg = '按 Enter 继续…') {
  await ask(`  ${msg} `)
}

function vercelEnvAdd(key, value, envName) {
  const r = spawnSync(
    'npx',
    ['vercel', 'env', 'add', key, envName, '--force', '--value', value],
    { cwd: root, encoding: 'utf8', shell: true },
  )
  if (r.status !== 0) {
    // Older CLI may not support --value; fall back to stdin pipe
    const r2 = spawnSync('npx', ['vercel', 'env', 'add', key, envName, '--force'], {
      cwd: root,
      encoding: 'utf8',
      shell: true,
      input: `${value}\n`,
    })
    return r2.status === 0
  }
  return true
}

async function main() {
  const total = 6
  console.log('\n  FinDigest · 邮箱 + 手机验证码开通（阿里云）')
  console.log('  登录走 /api/auth，不依赖 Supabase。')
  console.log(`  ${total} stages — Ctrl-C 可中断，重跑会保留已有 .env。\n`)
  await pause('准备好了按 Enter 开始')

  console.log(`\n▸ Stage 1/${total} · 阿里云 AccessKey`)
  openUrl('https://ram.console.aliyun.com/manage/ak')
  console.log('  • 建议新建 RAM 用户，授权：AliyunDysmsFullAccess + AliyunDirectMailFullAccess')
  console.log('  • 创建 AccessKey → 复制 ID / Secret（只显示一次）')
  const akId = await ask('  ALIYUN_ACCESS_KEY_ID: ', { def: readEnv('ALIYUN_ACCESS_KEY_ID') })
  const akSecret = await ask('  ALIYUN_ACCESS_KEY_SECRET: ', {
    secret: true,
    def: readEnv('ALIYUN_ACCESS_KEY_SECRET'),
  })
  if (!akId || !akSecret) {
    console.error('  ✗ AccessKey 两项都要，中止')
    rl.close()
    process.exit(1)
  }
  writeEnv('ALIYUN_ACCESS_KEY_ID', akId)
  writeEnv('ALIYUN_ACCESS_KEY_SECRET', akSecret)

  console.log(`\n▸ Stage 2/${total} · 短信签名 + 模板`)
  openUrl('https://dysms.console.aliyun.com/domestic/text/sign')
  console.log('  • 申请签名（如 FinDigest / 网站名），个人主体经常审不过，企业更稳')
  console.log('  • 模板示例：您的验证码为 ${code}，10 分钟内有效。')
  console.log('  • 变量名必须是 code（与代码 TemplateParam 一致）')
  const sign = await ask('  ALIYUN_SMS_SIGN_NAME: ', { def: readEnv('ALIYUN_SMS_SIGN_NAME') })
  const tpl = await ask('  ALIYUN_SMS_TEMPLATE_CODE: ', { def: readEnv('ALIYUN_SMS_TEMPLATE_CODE') })
  if (sign) writeEnv('ALIYUN_SMS_SIGN_NAME', sign)
  if (tpl) writeEnv('ALIYUN_SMS_TEMPLATE_CODE', tpl)
  if (!sign || !tpl) console.log('  ⚠ 未填短信：手机通道暂不可用，邮箱仍可配')

  console.log(`\n▸ Stage 3/${total} · 邮件推送（DirectMail）`)
  openUrl('https://dm.console.aliyun.com/')
  console.log('  • 发信域名建议用 findigest.cn（或子域 mail.findigest.cn）')
  console.log('  • 按控制台加 DNS（MX/TXT/CNAME）→ 验证通过 → 创建发信地址')
  console.log('  • AccountName = 完整发信邮箱，如 noreply@mail.findigest.cn')
  const acc = await ask('  ALIYUN_DM_ACCOUNT_NAME: ', { def: readEnv('ALIYUN_DM_ACCOUNT_NAME') })
  const alias = await ask('  ALIYUN_DM_FROM_ALIAS: ', {
    def: readEnv('ALIYUN_DM_FROM_ALIAS') || 'FinDigest',
  })
  if (acc) writeEnv('ALIYUN_DM_ACCOUNT_NAME', acc)
  if (alias) writeEnv('ALIYUN_DM_FROM_ALIAS', alias)
  writeEnv('ALIYUN_DM_REGION', readEnv('ALIYUN_DM_REGION') || 'cn-hangzhou')
  if (!acc) console.log('  ⚠ 未填发信地址：生产邮箱发码会失败（本地仍可能显示开发码）')

  console.log(`\n▸ Stage 4/${total} · OTP / 会话密钥`)
  const genOtp = crypto.randomBytes(24).toString('hex')
  const genSess = crypto.randomBytes(24).toString('hex')
  const otp = await ask('  EMAIL_OTP_SECRET [Enter=自动生成]: ', {
    def: readEnv('EMAIL_OTP_SECRET') || genOtp,
  })
  const sess = await ask('  VAULT_SESSION_SECRET [Enter=自动生成]: ', {
    def: readEnv('VAULT_SESSION_SECRET') || genSess,
  })
  writeEnv('EMAIL_OTP_SECRET', otp)
  writeEnv('VAULT_SESSION_SECRET', sess)

  console.log(`\n▸ Stage 5/${total} · 写入 Vercel`)
  const push = (await ask('  用 CLI 推到 Vercel production/preview/development？[Y/n]: ', { def: 'Y' }))
    .toLowerCase()
    .startsWith('y')
  if (push) {
    const keys = [
      'ALIYUN_ACCESS_KEY_ID',
      'ALIYUN_ACCESS_KEY_SECRET',
      'ALIYUN_SMS_SIGN_NAME',
      'ALIYUN_SMS_TEMPLATE_CODE',
      'ALIYUN_DM_ACCOUNT_NAME',
      'ALIYUN_DM_FROM_ALIAS',
      'ALIYUN_DM_REGION',
      'EMAIL_OTP_SECRET',
      'VAULT_SESSION_SECRET',
    ]
    for (const key of keys) {
      const val = readEnv(key)
      if (!val) continue
      for (const envName of ['production', 'preview', 'development']) {
        const ok = vercelEnvAdd(key, val, envName)
        console.log(`  ${ok ? '✓' : '✗'} ${key} → ${envName}`)
      }
    }
    console.log('  • 推完后需要 Redeploy 一次才会生效')
  } else {
    openUrl('https://vercel.com/dashboard')
    console.log('  请把 .env 里 ALIYUN_* / EMAIL_OTP_SECRET / VAULT_SESSION_SECRET 贴到 Vercel 后 Redeploy')
  }
  await pause()

  console.log(`\n▸ Stage 6/${total} · 自检`)
  console.log('  跑: npm run doctor:auth')
  console.log('  本地: npm run dev → /auth 测邮箱与手机「获取验证码」')
  console.log('  生产: Redeploy 后在 findigest.cn / vercel.app 再测')
  await pause('按 Enter 结束')

  console.log(`\n  ✓ 完成。已写入: ${written.join(', ') || '(无新写入)'}\n`)
  rl.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
