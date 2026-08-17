import { chromium } from 'playwright-core'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.join(__dirname, 'assets', 'ui')
await mkdir(outDir, { recursive: true })

const base = 'http://127.0.0.1:5173'
const shots = [
  { name: 'briefing.png', url: `${base}/preview/basic`, wait: 2500 },
  { name: 'landing.png', url: `${base}/`, wait: 2000 },
  { name: 'limits.png', url: `${base}/limits`, wait: 2000 },
]

const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
})
const page = await browser.newPage({
  viewport: { width: 1080, height: 1920 },
  deviceScaleFactor: 1,
})

for (const shot of shots) {
  try {
    await page.goto(shot.url, { waitUntil: 'networkidle', timeout: 60000 })
    await page.waitForTimeout(shot.wait)
    const file = path.join(outDir, shot.name)
    await page.screenshot({ path: file, fullPage: false })
    console.log('ok', shot.name)
  } catch (err) {
    console.error('fail', shot.name, err.message)
  }
}

await browser.close()
