import { Features } from 'lightningcss'

/**
 * Vite 8 CSS minify calls LightningCSS with `targets: convertTargets(build.cssTarget)`
 * and overwrites `css.lightningcss.targets`. Default cssTarget is Baseline 2025
 * (chrome111+), which *supports* #RRGGBBAA — so minify rewrites rgba() to hex8.
 *
 * Quark / UC kernels often reject #RRGGBBAA. A parse abort on `:root` / `.ld`
 * drops every token; `background: var(--bg)` then paints nothing. Safari is fine.
 *
 * `include` is spread through and is NOT overwritten — that is the reliable switch.
 */
export const CSS_TARGET = ['chrome90', 'edge90', 'firefox90', 'safari14', 'ios14']

export const LIGHTNINGCSS_INCLUDE =
  Features.HexAlphaColors |
  Features.OklabColors |
  Features.LabColors |
  Features.P3Colors |
  Features.ColorFunction

export const lightningcssCompat = {
  include: LIGHTNINGCSS_INCLUDE,
}

/** Packed versions matching CSS_TARGET — used by smoke to mimic Vite minify. */
export const LIGHTNINGCSS_TARGETS = {
  chrome: 90 << 16,
  edge: 90 << 16,
  firefox: 90 << 16,
  safari: 14 << 16,
  ios_saf: 14 << 16,
}
