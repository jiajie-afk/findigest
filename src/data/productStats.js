/**
 * Single source of truth for marketing / product scale numbers shown in UI.
 * Honesty rule: never present catalog breadth as “N independent IV engines”.
 */
import { VALUATION_PARADIGM_COUNT } from './valuation_paradigms.js'

/** Displayed A/H universe floor (~6106 actual; marketing uses stable 6,000+). */
export const UNIVERSE_DISPLAY = '6,000+'

/**
 * Catalog thinking-angle floor (~103; see VALUATION_PARADIGM_COUNT).
 * Must never appear alone as a hero “engine count”.
 */
export const PARADIGM_DISPLAY = '100+'

/** Computable primary-anchor archetypes in valuationTaxonomy (~11). */
export const ANCHOR_ARCHETYPE_DISPLAY = '约 11'

export const PARADIGM_CATALOG_COUNT = VALUATION_PARADIGM_COUNT

/** Private profiling dimensions */
export const PROFILE_QUESTIONS_DISPLAY = '88'

/** Daily decision focus cap */
export const DAILY_FOCUS_DISPLAY = '≤3'

/**
 * Scale chips for Editions / Caps (not Hero — Wave2 slim).
 * Dual-line paradigm entry: computable anchors first, angles second — not “100 engines”.
 */
export const PRODUCT_STATS = [
  { value: UNIVERSE_DISPLAY, label: 'A / H 标的库' },
  {
    value: ANCHOR_ARCHETYPE_DISPLAY,
    label: '可计算主锚',
    sublabel: `${PARADIGM_DISPLAY} 思维角度（非独立 IV）`,
  },
  { value: PROFILE_QUESTIONS_DISPLAY, label: '私人约束维度' },
  { value: DAILY_FOCUS_DISPLAY, label: '日决策焦点' },
]

export const COPY = {
  paradigmCount: PARADIGM_DISPLAY,
  anchorCount: ANCHOR_ARCHETYPE_DISPLAY,
  universeCount: UNIVERSE_DISPLAY,
  /** Required co-disclosure whenever 「100+」 appears in UI */
  paradigmHonest: `${ANCHOR_ARCHETYPE_DISPLAY} 类可计算主锚 · ${PARADIGM_DISPLAY} 思维角度（非 100 套独立 IV）`,
  /** Body helper — same honesty line; do not invent “100 engines” phrasing */
  paradigmPhrase: `${ANCHOR_ARCHETYPE_DISPLAY} 类可计算主锚 · ${PARADIGM_DISPLAY} 思维角度`,
  paradigmHelper: `${ANCHOR_ARCHETYPE_DISPLAY} 类可计算主锚 · ${PARADIGM_DISPLAY} 思维角度 · 多视角校准到可计算主锚`,
  universePhrase: `${UNIVERSE_DISPLAY} A/H 标的`,
}
