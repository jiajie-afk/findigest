# Mobile QA checklist (Wave3)

Target: phone width ≤390px can finish「看今日 → 懂主锚 → 懂持仓风险」without desktop desk chrome.

## Today (`/app`)

- [ ] One focus item visible without hunting
- [ ] One hard-constraint line + one holdings-risk line in the trio block
- [ ] Pro HUD scrolls horizontally with snap (not a stacked 3-row wall)
- [ ] Primary CTA / links ≥44px tall

## Stock (`/stock/:code`)

- [ ] First screen shows 主锚 / 结论 / 下一步
- [ ] Message scrape + management / sentiment deep blocks default collapsed on narrow
- [ ] Quote shows asOf + source when present (`jsonp-fallback` must be visible)

## Nav

- [ ] ≤900px: bottom tab bar (top `.nlinks` hidden); Basic: 今日 / 持仓 / 事件 / 我的; Pro: +工作区 / 报告
- [ ] Touch targets on bottom tabs ≥44px; safe-area inset respected
- [ ] Top account chip hidden on phone (「我的」in tabs)

## Reduced motion

- [ ] `prefers-reduced-motion: reduce` disables non-essential animation (prodesk / skeleton)
