/**
 * Local Windows holdings pickup: clipboard, recent CSV exports, visible trade window.
 * Never reads broker credential stores. Localhost / Vite only.
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SCRIPT = path.join(root, 'scripts', 'read-desktop-holdings.ps1')

const NOTE_ZH = {
  LAUNCHED: '已打开东方财富证券交易。请用交易账号登录并打开持仓表，再点一次同步。',
  NO_TRADE: '未找到正在运行的交易软件。请先打开并登录东方财富证券交易或同花顺下单。',
  ON_LOGIN:
    '还在登录页，已避开窗口（不会按 Ctrl+A/C）。扫码请用「东方财富证券」App 的扫一扫，不能用看行情的「东方财富」，也不能用微信。',
  UPDATING: '东方财富正在升级交易组件。请等更新完成、二维码稳定后再登录；升级期间扫码经常无反应。',
  SKIP_COPY: '已避开交易窗口，避免打断扫码/登录。登录并打开持仓后，可用「复制交易窗口」或自己全选复制。',
  COPY_EMPTY: '已切到交易窗口并尝试复制，剪贴板为空。请在软件里点开持仓后再同步。',
  COPY_OK: '已从交易窗口复制当前选中内容。',
  NO_WINDOW: '交易软件在运行，但没有可前置的窗口。请把持仓表露出来后再同步。',
}

function translateNotes(notes) {
  return (notes || []).map((n) => NOTE_ZH[n] || n)
}

function looksLikeHoldings(text) {
  const t = String(text || '')
  if (t.trim().length < 8) return false
  const hasCodeCol = /代码|证券代码|股票代码|symbol|ticker/i.test(t)
  const hasQty = /数量|持股|持仓|股数|余额|quantity|shares/i.test(t)
  const hasDigits = /\d{5,6}/.test(t)
  return hasDigits && (hasCodeCol || hasQty || /成本/.test(t))
}

function parsePsJson(out) {
  const s = String(out || '')
  const i = s.indexOf('{')
  const j = s.lastIndexOf('}')
  if (i < 0 || j <= i) throw new Error('本机扫描结果无法解析')
  return JSON.parse(s.slice(i, j + 1))
}

function scanExportFiles() {
  const dirs = [
    path.join(os.homedir(), 'Desktop'),
    path.join(os.homedir(), 'Downloads'),
    path.join(os.homedir(), 'Documents', 'FinDigest-holdings'),
  ]
  const cutoff = Date.now() - 21 * 86400_000
  const files = []
  for (const d of dirs) {
    let names = []
    try {
      names = fs.readdirSync(d)
    } catch {
      continue
    }
    for (const name of names) {
      if (!/\.(csv|txt|tsv)$/i.test(name)) continue
      const full = path.join(d, name)
      let st
      try {
        st = fs.statSync(full)
      } catch {
        continue
      }
      if (!st.isFile() || st.mtimeMs < cutoff || st.size > 400000 || st.size < 8) continue
      let text = ''
      try {
        text = fs.readFileSync(full, 'utf8')
      } catch {
        continue
      }
      if (text.length > 200000) text = text.slice(0, 200000)
      files.push({ name, path: full, text })
      if (files.length >= 8) return files
    }
  }
  return files
}

export function runDesktopHoldingsScan({ timeoutMs = 20000, launch = false, copyWindow = false } = {}) {
  return new Promise((resolve, reject) => {
    const args = ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', SCRIPT]
    if (launch) args.push('-Launch')
    if (copyWindow) args.push('-CopyWindow')
    const ps = spawn('powershell.exe', args, {
      windowsHide: true,
      cwd: root,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let out = ''
    let err = ''
    const timer = setTimeout(() => {
      ps.kill()
      reject(new Error('本机扫描超时'))
    }, timeoutMs)
    ps.stdout.setEncoding('utf8')
    ps.stderr.setEncoding('utf8')
    ps.stdout.on('data', (d) => {
      out += d
    })
    ps.stderr.on('data', (d) => {
      err += d
    })
    ps.on('error', (e) => {
      clearTimeout(timer)
      reject(e)
    })
    ps.on('close', (code) => {
      clearTimeout(timer)
      try {
        const scan = parsePsJson(out)
        scan.files = [...(scan.files || []), ...scanExportFiles()]
        resolve(scan)
      } catch (e) {
        reject(new Error(err.trim() || e.message || `PowerShell 退出 ${code}`))
      }
    })
  })
}

/**
 * Pick the first blob that looks like a holdings table.
 */
export function pickHoldingsText(scan) {
  const notes = translateNotes(scan.notes || [])
  const candidates = [
    { source: 'trade_window', text: scan.windowCopy },
    { source: 'clipboard', text: scan.clipboard },
    ...(scan.files || []).map((f) => ({ source: `file:${f.name}`, text: f.text })),
  ]
  for (const c of candidates) {
    if (looksLikeHoldings(c.text)) {
      return { text: c.text, source: c.source, notes }
    }
  }
  return {
    text: '',
    source: '',
    notes: notes.length
      ? notes
      : ['没有识别到持仓表。请登录交易软件并打开持仓，或复制表格 / 把 CSV 放到桌面后再试。'],
  }
}

export { looksLikeHoldings }
