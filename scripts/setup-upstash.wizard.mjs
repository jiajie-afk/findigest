#!/usr/bin/env node
/**
 * Windows-friendly Upstash Redis setup for FinDigest capacity (global rate limits).
 * Writes UPSTASH_* to .env and prints Vercel env steps.
 *
 * Usage: node scripts/setup-upstash.wizard.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import readline from 'node:readline'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'

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

async function main() {
  const total = 4
  console.log('\n  FinDigest · Upstash Redis（全局限流 / 兑换锁）')
  console.log(`  ${total} stages — 免费档即可。Ctrl-C 可中断，重跑保留已有值。\n`)
  await pause('准备好了按 Enter 开始')

  console.log(`\n▸ Stage 1/${total} · 注册 / 登录 Upstash`)
  openUrl('https://console.upstash.com/')
  console.log('  • 用 GitHub / 邮箱注册（免费）')
  await pause()

  console.log(`\n▸ Stage 2/${total} · 创建 Redis 数据库`)
  openUrl('https://console.upstash.com/?tab=redis')
  console.log('  • Redis 页 → Create Database')
  console.log('  • Name: findigest-rl（随意）')
  console.log('  • Region: 选离 Vercel 近的（如 us-east-1 / ap-southeast-1）')
  console.log('  • Plan: Free / Pay as you go')
  await pause('库创建好后按 Enter')

  console.log(`\n▸ Stage 3/${total} · 复制 REST 凭证`)
  console.log('  • 打开该库 → Details / REST API')
  console.log('  • 复制 UPSTASH_REDIS_REST_URL 与 UPSTASH_REDIS_REST_TOKEN')
  const url = await ask('  UPSTASH_REDIS_REST_URL: ', { def: readEnv('UPSTASH_REDIS_REST_URL') })
  const token = await ask('  UPSTASH_REDIS_REST_TOKEN: ', {
    secret: true,
    def: readEnv('UPSTASH_REDIS_REST_TOKEN'),
  })
  if (!url || !token) {
    console.error('  ✗ 两项都需要，未写入')
    rl.close()
    process.exit(1)
  }
  writeEnv('UPSTASH_REDIS_REST_URL', url)
  writeEnv('UPSTASH_REDIS_REST_TOKEN', token)

  console.log(`\n▸ Stage 4/${total} · 写入 Vercel（生产生效）`)
  openUrl('https://vercel.com/dashboard')
  console.log('  • 项目 → Settings → Environment Variables')
  console.log('  • 添加（Production + Preview）:')
  console.log('      UPSTASH_REDIS_REST_URL')
  console.log('      UPSTASH_REDIS_REST_TOKEN')
  console.log('  • 保存后 Redeploy 一次（否则旧实例读不到）')
  console.log('')
  console.log('  若已装 Vercel CLI，也可在项目根执行:')
  console.log('    npx vercel env add UPSTASH_REDIS_REST_URL production')
  console.log('    npx vercel env add UPSTASH_REDIS_REST_TOKEN production')
  await pause('Vercel 配好后按 Enter 结束')

  console.log(`\n  ✓ 完成。已写入: ${written.join(', ') || '(无新写入)'}`)
  console.log('  本地: npm run dev 即可用（限流会走 Upstash）')
  console.log('  生产: Redeploy 后全局限流 / 兑换锁生效\n')
  rl.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
