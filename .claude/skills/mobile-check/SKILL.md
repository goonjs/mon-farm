---
name: mobile-check
description: Check a mon-farm screen, control or figure the way a person on a phone actually meets it — real touch taps rather than clicks, real viewport widths, and figures at the size they will really reach. Use when writing, reviewing or testing any UI in this repo, when a story touches a screen or a rendered number, and whenever driving the built app in a browser. Also use when a control "works" in tests but a person reports it does not.
---

# Checking mon-farm on a phone

This app is used one-handed, outdoors, on a phone, by someone standing next
to the person whose money is on screen. A control that is *present* is not
necessarily usable; a number that is *rendered* is not necessarily read.

`docs/checklists/mobile-checklist.md` is the checklist to complete.
`docs/ux/mobile-audit.md` is the evidence behind it — every rule there was
paid for by a defect that shipped past a green test suite.

## The three that catch the most

1. **Tap, don't click.** `.click()` and `fireEvent.click` exercise mouse
   handling only. The counter's tabs were untappable on the commonest small
   Android for weeks while every test passed, because no test ever used a
   finger. On any `isMobile`/`hasTouch` project use `page.touchscreen.tap()`
   or locator `.tap()` — and assert the *consequence* (the tab switched, the
   panel opened, the event was written), never just `toBeVisible()`.

2. **Measure the box against the viewport.** `toBeVisible()` passes on an
   element sitting entirely off-screen. Compare `boundingBox()` to
   `viewportSize()`, and check
   `document.documentElement.scrollWidth <= clientWidth` on every screen.

3. **Test numbers at the size they will really reach.** A seven-figure owner
   total needs ~347px and clipped to `฿ 1...` at 360px — on every viewport
   measured, tablet included, one of them by a single pixel. No fixture had
   ever exceeded six figures. A truncated money figure is blocking, not
   cosmetic: it looks like an answer.

## Viewports

360×640 (commonest small Android — where things break), 390×844, 844×390
(the designed-for landscape), 740×360 (the NFR-4 floor), 820×1180 (tablet —
not a safe harbour). Portrait is supported everywhere, including the
counter, per the owner's 2026-09-04 decision.

## Touch targets

Nothing interactive under 44×44 CSS px, and nothing small flush against
something large: a 32px tab strip touching a `flex: 1` pressable is exactly
how the browser's hit-test came to resolve a tap on a tab to the numeral
underneath it. Use `hitSlop` to pad a hit target rather than shrinking it to
match a compact visual.

## Driving the real app in this sandbox

`npm run build:web`, serve with `node scripts/serve-dist.mjs` (port 8080),
and drive Chromium through playwright-core with
`executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'`,
`isMobile: true`, `hasTouch: true`. Never run `npx playwright install` — the
pinned build cannot be downloaded here. The Playwright config honours
`PLAYWRIGHT_CHROMIUM_EXECUTABLE` for the same reason.
