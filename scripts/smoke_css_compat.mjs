/**
 * Quark / UC "no color": Vite 8 LightningCSS minify rewrites rgba() → #RRGGBBAA.
 * Those kernels often abort the whole :root / .ld rule; Safari keeps the tokens.
 *
 * Usage: node scripts/smoke_css_compat.mjs
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { transform } from 'lightningcss'
import {
  CSS_TARGET,
  LIGHTNINGCSS_TARGETS,
  lightningcssCompat,
} from '../lib/cssCompat.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
let failed = 0
function assert(cond, msg) {
  if (!cond) {
    failed += 1
    console.error('FAIL:', msg)
  } else {
    console.log('OK  ', msg)
  }
}

const FIXTURE = `
:root {
  color-scheme: dark;
  --bg: #0a0b0c;
  --tp: #ece6d8;
  --accent: #c5a059;
  --accent-soft: rgba(197, 160, 89, 0.12);
  --sep: rgba(236, 230, 216, 0.1);
}
.ld {
  --ld-ink: #0a0b0c;
  --ld-line: rgba(197, 160, 89, 0.28);
  --ld-gold: #c5a059;
  --ld-cyan-soft: rgba(0, 232, 200, 0.12);
  --ld-paper: #ece6d8;
  background: var(--ld-ink);
  color: var(--ld-paper);
}
body { background: var(--bg); color: var(--tp); }
.bp { background: var(--accent); color: #0a0b0c; }
.ld-cta { background: var(--ld-gold); color: var(--ld-ink); }
`

function minify(opts) {
  const { code } = transform({
    filename: 'compat.css',
    code: Buffer.from(FIXTURE),
    minify: true,
    ...opts,
  })
  return code.toString()
}

const HEX8 = /#[0-9a-fA-F]{8}\b/

/** Quark-style abort: drop any rule that contains an 8-digit hex color. */
function dropRulesWithHex8(css) {
  return css.replace(/[^{}]+\{[^{}]*#[0-9a-fA-F]{8}\b[^{}]*\}/g, '')
}

const viteDefault = minify({
  targets: { chrome: 111 << 16, safari: (16 << 16) | (4 << 8) },
})
assert(HEX8.test(viteDefault), 'repro: Baseline chrome111 minify emits #RRGGBBAA')

const quarkDefault = dropRulesWithHex8(viteDefault)
assert(!/--bg:/.test(quarkDefault), 'repro: Quark drop of hex8 rules wipes --bg')
assert(!/--ld-gold:/.test(quarkDefault), 'repro: Quark drop of hex8 rules wipes --ld-gold')

const compat = minify({
  targets: LIGHTNINGCSS_TARGETS,
  ...lightningcssCompat,
})
assert(!HEX8.test(compat), 'fix: compat minify keeps rgba(), no #RRGGBBAA')
assert(/--accent-soft:rgba\(/.test(compat), 'fix: --accent-soft stays rgba')
assert(/--ld-line:rgba\(/.test(compat), 'fix: --ld-line stays rgba')

const quarkCompat = dropRulesWithHex8(compat)
assert(/--bg:#0a0b0c/.test(quarkCompat), 'fix: Quark-sim still has --bg')
assert(/--ld-gold:#c5a059/.test(quarkCompat), 'fix: Quark-sim still has gold')
assert(/--tp:#ece6d8/.test(quarkCompat), 'fix: Quark-sim still has parchment')

const viteCfg = readFileSync(join(root, 'vite.config.js'), 'utf8')
assert(viteCfg.includes('lightningcssCompat'), 'vite.config wires lightningcssCompat')
assert(viteCfg.includes('cssTarget: CSS_TARGET') || viteCfg.includes('cssTarget:CSS_TARGET'), 'vite.config sets cssTarget')
assert(CSS_TARGET.includes('chrome90'), 'cssTarget includes chrome90 (not chrome111)')

const main = readFileSync(join(root, 'src/assets/styles/main.css'), 'utf8')
assert(/background-color:\s*#0a0b0c/.test(main), 'main.css: html/body have hex paint fallback')
assert(/background:\s*var\(--bg,\s*#0a0b0c\)/.test(main), 'main.css: body uses var(--bg, #0a0b0c)')
assert(/background-color:\s*#c5a059/.test(main), 'main.css: .bp has gold fallback')
assert(/forced-color-adjust:\s*none/.test(main), 'main.css: forced-color-adjust none')
assert(/color-scheme:\s*only dark/.test(main), 'main.css: color-scheme only dark')

const landing = readFileSync(join(root, 'src/assets/styles/landing.css'), 'utf8')
assert(/background-color:\s*#0a0b0c/.test(landing), 'landing.css: .ld has ink fallback')
assert(/background-color:\s*#c5a059/.test(landing), 'landing.css: .ld-cta has gold fallback')
assert(/background-color:\s*#00e8c8/.test(landing), 'landing.css: .ld-cta-pro has cyan fallback')

const html = readFileSync(join(root, 'index.html'), 'utf8')
assert(html.includes('name="nightmode"') && html.includes('disable'), 'index.html disables UC/Quark nightmode')
assert(html.includes('name="color-scheme"'), 'index.html declares color-scheme')

if (failed) {
  console.error(`\n${failed} css compat check(s) failed`)
  process.exit(1)
}
console.log('\ncss compat ok')
