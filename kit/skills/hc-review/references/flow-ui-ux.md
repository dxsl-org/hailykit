# UI/UX Review Checklist — hc:review --ui

## Audit Process

1. **Fetch** latest Web Interface Guidelines (WebFetch): `https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md`
2. **Read** specified files (or ask user for files/pattern via `AskUserQuestion`)
3. **Check** each file against §1–§10 rules below + fetched guidelines
4. **Output** per finding in `file:line` format — Accept (must fix) / Reject (false positive) / Defer (later)

CRITICAL violations (§1 Accessibility, §2 Touch & Interaction) block delivery. HIGH/MEDIUM are important-before-ship. LOW are defer-ok.

## Pre-Delivery Gate

- [ ] §1–§2 CRITICAL: color-contrast 4.5:1, touch targets ≥44pt, keyboard nav, aria-labels
- [ ] §3 HIGH: WebP/AVIF, lazy load, no CLS, no reflows
- [ ] §5 HIGH: mobile-first, no horizontal scroll, viewport meta, min 16px
- [ ] §9 HIGH: predictable back, bottom nav ≤5, deep linking
- [ ] Test on 375px + landscape; verify reduced-motion; check dark mode contrast
- [ ] All touch targets ≥44pt, no content behind safe areas

## §1 Accessibility (CRITICAL)
`color-contrast` 4.5:1 normal / 3:1 large · `focus-states` visible rings 2–4px · `alt-text` for meaningful images · `aria-labels` for icon-only buttons · `keyboard-nav` tab order = visual order · `form-labels` label+for · `skip-links` · `heading-hierarchy` sequential h1→h6 · `color-not-only` add icon/text · `dynamic-type` support system scaling · `reduced-motion` respect prefers-reduced-motion · `voiceover-sr` meaningful accessibilityLabel · `escape-routes` cancel/back in modals · `keyboard-shortcuts` preserve system shortcuts

## §2 Touch & Interaction (CRITICAL)
`touch-target-size` min 44×44pt / 48×48dp · `touch-spacing` 8px+ gap · `hover-vs-tap` tap for primary · `loading-buttons` disable + spinner · `error-feedback` clear messages near problem · `cursor-pointer` on clickable · `gesture-conflicts` avoid horizontal swipe on main · `tap-delay` touch-action:manipulation · `standard-gestures` consistent platform gestures · `system-gestures` don't block Control Center / back swipe · `press-feedback` visual on press · `haptic-feedback` for confirmations · `gesture-alternative` visible controls for critical actions · `safe-area-awareness` away from notch/gesture bar · `no-precision-required` no pixel-perfect taps · `swipe-clarity` show affordance/hint · `drag-threshold` movement threshold before drag

## §3 Performance (HIGH)
`image-optimization` WebP/AVIF + srcset + lazy · `image-dimension` width/height prevents CLS · `font-loading` font-display:swap · `font-preload` critical fonts only · `critical-css` inline above-fold · `lazy-loading` non-hero dynamic import · `bundle-splitting` route/feature splits · `third-party-scripts` async/defer · `reduce-reflows` batch DOM reads/writes · `content-jumping` reserve space · `virtualize-lists` 50+ items · `main-thread-budget` <16ms/frame · `progressive-loading` skeleton >1s · `input-latency` <100ms · `debounce-throttle` scroll/resize/input

## §4 Style Selection (HIGH)
`consistency` same style all pages · `no-emoji-icons` SVG only · `effects-match-style` shadows/blur/radius aligned · `platform-adaptive` iOS HIG vs Material · `state-clarity` distinct hover/pressed/disabled · `elevation-consistent` consistent shadow scale · `dark-mode-pairing` light+dark together · `icon-style-consistent` one icon set · `blur-purpose` blur = dismissal not decoration · `primary-action` one primary CTA per screen

## §5 Layout & Responsive (HIGH)
`viewport-meta` width=device-width (never disable zoom) · `mobile-first` base → responsive up · `breakpoint-consistency` 375/768/1024/1440 · `readable-font-size` min 16px mobile · `line-length-control` 35–60 mobile / 60–75 desktop · `horizontal-scroll` none on mobile · `spacing-scale` 4pt/8dp increments · `z-index-management` layered scale · `fixed-element-offset` reserve padding under fixed bars · `viewport-units` min-h-dvh not 100vh · `orientation-support` readable in landscape · `visual-hierarchy` size/spacing/contrast, not color alone

## §6 Typography & Color (MEDIUM)
`line-height` 1.5–1.75 body · `font-scale` 12/14/16/18/24/32 · `weight-hierarchy` bold 600–700, body 400 · `color-semantic` tokens not raw hex · `color-dark-mode` desaturated not inverted · `color-accessible-pairs` 4.5:1 (AA) · `number-tabular` monospaced for data/prices · `truncation-strategy` prefer wrap; ellipsis + tooltip

## §7 Animation (MEDIUM)
`duration-timing` 150–300ms micro / ≤400ms complex · `transform-performance` transform/opacity only · `easing` ease-out enter / ease-in exit · `motion-meaning` cause-effect not decorative · `spring-physics` prefer physics curves · `exit-faster-than-enter` 60–70% of enter · `interruptible` user can cancel · `no-blocking-animation` UI stays interactive · `reduced-motion` always respected

## §8 Forms & Feedback (MEDIUM)
`input-labels` visible per input · `error-placement` below field · `inline-validation` validate on blur · `input-type-keyboard` semantic types · `password-toggle` show/hide · `autofill-support` autocomplete attrs · `error-clarity` cause + how to fix · `focus-management` auto-focus first invalid · `error-summary` top summary + anchors · `touch-friendly-input` ≥44px height · `toast-accessibility` aria-live=polite · `aria-live-errors` role=alert

## §9 Navigation Patterns (HIGH)
`bottom-nav-limit` max 5 items with labels · `back-behavior` predictable, preserves scroll/state · `deep-linking` all key screens · `nav-state-active` current location highlighted · `modal-escape` clear close affordance · `state-preservation` restore scroll/filter on back · `gesture-nav-support` iOS swipe-back, Android predictive · `adaptive-navigation` sidebar ≥1024px / bottom-top mobile · `navigation-consistency` same placement all pages · `modal-vs-navigation` modals aren't primary nav

## §10 Charts & Data (LOW)
`chart-type` match to data · `color-guidance` accessible palettes · `legend-visible` near chart · `tooltip-on-interact` exact values on hover/tap · `axis-labels` with units · `responsive-chart` reflow on small screens · `touch-target-chart` ≥44pt · `no-pie-overuse` >5 categories → bar · `tooltip-keyboard` keyboard-reachable · `screen-reader-summary` aria-label of key insight

## Common Sticking Points

| Problem | Rule |
|---------|------|
| Dark mode contrast | §6 `color-dark-mode` + `color-accessible-pairs` |
| Animations unnatural | §7 `spring-physics` + `easing` + `exit-faster-than-enter` |
| Form UX poor | §8 `inline-validation` + `error-clarity` + `focus-management` |
| Navigation confusing | §9 `nav-hierarchy` + `bottom-nav-limit` + `back-behavior` |
| Layout breaks mobile | §5 `mobile-first` + `breakpoint-consistency` |
| Performance/jank | §3 `virtualize-lists` + `main-thread-budget` |
