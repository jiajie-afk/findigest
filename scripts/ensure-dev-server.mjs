/**
 * Ensure FinDigest Vite is up on 127.0.0.1:5173.
 * Windows: Start-Process minimized keepalive CMD (auto-restarts).
 * Hidden unref() children were dying → repeated ERR_CONNECTION_REFUSED.
 */
import net from 'node:net'
import fs from 'node:fs'
import path from 'node:path'
import { spawn, execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const HOST = process.env.FD_DEV_HOST || '127.0.0.1'
const PORT = Number(process.env.FD_DEV_PORT || 5173)
const pidFile = path.join(root, '.vite-dev.pid')
const logFile = path.join(root, '.vite-dev.log')
const keepaliveCmd = path.join(root, 'scripts', 'run-vite-keepalive.cmd')

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

function psQuote(s) {
  return `'${String(s).replace(/'/g, "''")}'`
}

function isPortOpen(host, port) {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port }, () => {
      socket.end()
      resolve(true)
    })
    socket.setTimeout(800, () => {
      socket.destroy()
      resolve(false)
    })
    socket.on('error', () => resolve(false))
  })
}

function keepaliveAlreadyRunning() {
  if (process.platform !== 'win32') return false
  try {
    const out = execSync(
      'powershell -NoProfile -Command "(Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match \'run-vite-keepalive\\.cmd\' }).ProcessId"',
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    )
    return String(out)
      .split(/\r?\n/)
      .map((s) => s.trim())
      .some((s) => /^\d+$/.test(s))
  } catch {
    return false
  }
}

function startWindowsKeepalive() {
  fs.appendFileSync(logFile, `\n---- ensure-dev-server ${new Date().toISOString()} ----\n`)
  // PowerShell Start-Process handles spaces in "FINANCIAL INFORMATION COLLECTION".
  const ps = [
    'Start-Process',
    '-FilePath',
    psQuote(keepaliveCmd),
    '-WorkingDirectory',
    psQuote(root),
    '-WindowStyle',
    'Minimized',
  ].join(' ')

  execSync(`powershell -NoProfile -ExecutionPolicy Bypass -Command ${psQuote(ps)}`, {
    cwd: root,
    stdio: 'ignore',
  })
  fs.writeFileSync(pidFile, `keepalive:${Date.now()}`, 'utf8')
  return 'powershell-start'
}

function startUnixDetached() {
  fs.appendFileSync(logFile, `\n---- ensure-dev-server ${new Date().toISOString()} ----\n`)
  const out = fs.openSync(logFile, 'a')
  const viteJs = path.join(root, 'node_modules', 'vite', 'bin', 'vite.js')
  const child = spawn(process.execPath, [viteJs, '--host', HOST, '--port', String(PORT)], {
    cwd: root,
    detached: true,
    stdio: ['ignore', out, out],
    env: { ...process.env },
  })
  if (child.pid) fs.writeFileSync(pidFile, String(child.pid), 'utf8')
  child.unref()
  return child.pid
}

async function main() {
  if (await isPortOpen(HOST, PORT)) {
    console.log(`FinDigest already up → http://${HOST}:${PORT}/`)
    return
  }

  if (process.platform === 'win32' && keepaliveAlreadyRunning()) {
    console.log('Keepalive window already running; waiting for port…')
  } else {
    console.log(`Starting keepalive Vite on http://${HOST}:${PORT}/ …`)
    const id =
      process.platform === 'win32' ? startWindowsKeepalive() : startUnixDetached()
    console.log(`Started via ${id} (log: .vite-dev.log)`)
  }

  for (let i = 0; i < 80; i++) {
    await sleep(250)
    if (await isPortOpen(HOST, PORT)) {
      console.log(`Ready → http://${HOST}:${PORT}/`)
      console.log(`Pro → http://${HOST}:${PORT}/preview/prodesk`)
      return
    }
  }

  console.error('Port still closed. Double-click start-dev.cmd or check .vite-dev.log')
  process.exitCode = 1
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
