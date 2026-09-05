# Mobile-web audit — counter tabs and settlement (2026-09-05)

Scope: a from-scratch, user's-eye audit of every screen in the app under
real mobile-browser conditions, triggered by two owner-reported defects on
the counting page (tabs unreachable) and the settlement screen (total cut
off). Per the updated product direction, **portrait is now a supported
orientation on mobile web**, not a degraded fallback — landscape-lock is a
native-app constraint (`docs/prd.md`, `docs/stories/s19-orientation-and-tablet.md`)
that a browser does not honour, so every finding below that reproduces in
portrait is in scope, not an edge case.

## How this was run

- Built the real export: `npm run build:web`, served with
  `node scripts/serve-dist.mjs` on port 8080.
- Drove real Chromium via `playwright-core`
  (`/opt/pw-browsers/chromium-1194/chrome-linux/chrome`), never
  `npx playwright install`.
- Every context used `isMobile: true`, `hasTouch: true`, a real
  `deviceScaleFactor`, and **`page.touchscreen.tap()`** — not mouse clicks —
  for every interaction, plus direct `document.elementFromPoint` /
  `elementsFromPoint` hit-tests and live `touchstart` event-listener capture
  (recording the actual `event.target` a dispatched touch resolved to,
  not just a static geometry comparison) to prove blocking rather than infer
  it.
- Viewports: iPhone-class portrait (390×844) and landscape (844×390), small
  Android portrait (360×640) and landscape (740×360), and a tablet
  (820×1180) — all with real device scale factors (2–3×). A follow-up sweep
  also checked 375×667, 412×915, and 360×640 at dsf 1/2/3 to bound the
  tab-blocking bug's actual trigger condition (see Finding 1).
- Sale data was seeded straight into `localStorage` with the same event-log
  schema `e2e/fixtures.ts` uses (`mon-farm:events:<id>` / `mon-farm:sales`),
  driven from a standalone Node script — no application or e2e code was
  read into the running app beyond what `seedSale` already does; nothing
  under `src/` or `e2e/` was modified.
- 65 screenshots were captured across screens × viewports; the ones cited
  below are the evidentiary set, in `docs/ux/screenshots/mobile-audit/`,
  named `<viewport>__<NN>-<screen>.png`.

---

## Findings, by severity

### BLOCKING

#### 1. The Pile/Log tabs are physically untappable on common small-Android widths — proven by real touch dispatch, not just geometry

- **Screen**: counter, Count tab active, a pile mid-count (`openPileScenario`
  with baskets counted — the ordinary "someone is using the app" state, no
  modal/overlay open).
- **Viewports it reproduces at**: 360×640 (Android small, all of dsf 1/2/3
  tried) and 375×667 (dsf 2) — i.e. the *most common* small-Android and
  older-iPhone CSS widths. It does **not** reproduce at 390×844, 412×915,
  740×360, 820×1180, or 844×390 in this test matrix.
- **Reproduction**: load the counter screen with a pile counting, wait for
  layout to settle (tried at both 400ms and 1500ms — no difference), then
  dispatch a real touch tap at the centre of `tab-pile`'s (or `tab-log`'s)
  own bounding box.
- **The proof**: a `touchstart` capture-phase listener on `document`
  recorded the actual `event.target` for a tap dispatched at the tab's own
  measured centre (76, 49) — well inside the tab bar's own rect
  (`{top:33, bottom:65}`). The event landed on
  `<div data-testid="count">` — the giant full-bleed numeral inside
  `HoldStage` — not on the tab, with `defaultPrevented: false` (so nothing
  in app JS is swallowing it; this is the browser's own hit-test choosing
  the wrong element). A screenshot with the resolved element outlined in
  red and the tapped tab outlined in green
  (see reasoning trail; not included in the shipped screenshot set since it
  was a debug aid) showed the red outline sitting on the numeral's stage,
  well below the tab row, while the actual dispatched tap coordinate was
  still inside the tab row's own box.
- **Confirmed end-to-end**: `docs/ux/screenshots/mobile-audit/android-small-portrait__06b-after-tab-tap-attempt.png`
  shows the app still on "นับ" (Count) after a real touch tap on the Pile
  tab — the numeral is still centre stage, the Pile panel never opened. The
  identical tap sequence on iPhone-class portrait (390×844) and tablet
  portrait (820×1180) **does** switch tabs correctly
  (`iphone-portrait__06b-after-tab-tap-attempt.png`,
  `tablet-portrait__06b-after-tab-tap-attempt.png` both show the Pile panel
  open).
- **This refutes the initial hypothesis, with evidence.** The task's lead
  was that one of the four full-screen confirm overlays in
  `src/app/sale/[id]/counter.tsx` (around lines 562, 652, 713, 773) silently
  covers the tab bar. Checked directly: those overlays are conditionally
  rendered (`{confirmClosePile && pile ? <...> : null}` etc.) and are not
  mounted in the base counting state this bug reproduces in — the hit-test
  and touch-dispatch proof above was taken with **no overlay open**. (Those
  overlays *do* sit in the same unpositioned outer `<View style={{flex:1}}>`
  as `TopBar`/`Tabs`, and RN's default `position: 'relative'` on that View
  makes it the containing block for their `position:'absolute', inset:0` —
  so when one of them **is** open, it does cover the tab bar too. That is
  very likely deliberate modal-blocking behaviour, not the reported bug,
  since it also blocks a mouse click, and the owner's report was specific to
  touch.)
- **Actual likely cause**: `Tabs` in `src/components/chrome.tsx` renders
  each tab as a `Pressable` only `t.space.xs` vertical padding tall — the
  measured box is 54×32 CSS px, well under the ~44×44 platform minimum
  touch target (see Finding 4) — sitting directly, with zero gap, on top of
  `HoldStage`'s stage `Pressable` (`src/components/HoldStage.tsx:374-426`),
  which is `flex: 1` and therefore claims essentially the entire rest of the
  screen as one giant tappable surface immediately below the tab row. A
  32px-tall interactive strip flush against a full-bleed interactive
  sibling is exactly the geometry that trips touch-target disambiguation on
  narrow/high-density viewports — the browser's touch hit-test is choosing
  the larger, adjacent target over the correct small one at the boundary.
  Root cause is the touch-target *size and adjacency*, not a specific
  overlay; the fix should not assume it is a single component.
- **Suggested fix direction**: give the tab bar itself real height (≥44px
  tap targets — increase `Tabs`' `paddingVertical` and/or set a
  `minHeight`), and put a real gap (a few px of non-interactive, or at
  least visually-separated, chrome) between the tab row and `HoldStage`'s
  stage, so no interactive element starts flush against a much larger one.
  Re-verify with a real touch tap (not a click) at 360×640 and 375×667
  specifically, since this is exactly where it reproduces and exactly the
  size class most owners' phones will be.

---

### MAJOR

#### 2. Settlement's owner-total figure clips — on every tested viewport, including the tablet

- **Screen**: settlement, closed sale with a seven-figure gross
  (a realistic worked-season total, not an edge case — ฿1,350,718.25).
- **Viewports**: all five — 390×844, 844×390, 360×640, 740×360, 820×1180.
- **Reproduction**: close a sale whose owner total exceeds roughly six
  digits, land on `/sale/[id]/settlement`.
- **The measurement**: `document.querySelector('[data-testid="owner-share"]')`
  — the headline `Figure` component — has `scrollWidth: 347` (what the text
  actually needs) against a `clientWidth` that is **always smaller**, on
  every viewport tested:

  | viewport | clientWidth (px) | scrollWidth (px) | rendered text |
  |---|---|---|---|
  | iphone-portrait (390) | 130 | 347 | `฿ 1...` |
  | android-small-portrait (360) | 116 | 347 | `฿ 1...` |
  | android-small-landscape (740) | 297 | 347 | `฿ 1,350,718...` |
  | iphone-landscape (844) | 346 | 347 | `฿ 1,350,718...` (1px short) |
  | tablet-portrait (820) | 335 | 347 | `฿ 1,350,718....` |

  `getComputedStyle` on the element confirms `textOverflow: 'ellipsis'`,
  `whiteSpace: 'nowrap'` — i.e. it is genuinely being truncated with an
  ellipsis, not just visually tight.
- **Screenshots**: `iphone-portrait__11-settlement.png` and
  `android-small-portrait__11-settlement.png` show the headline literally
  rendering as **`฿ 1...`** — the single most important number on the
  screen, unreadable. `tablet-portrait__11-settlement.png` shows the same
  figure as `฿ 1,350,718....` — still missing the decimal amount, on a
  1180×820 tablet with generous width.
- **Root cause**: `src/app/sale/[id]/settlement.tsx`'s `ScrollView`
  `contentContainerStyle={{ ..., flexDirection: 'row', gap: t.space.md }}`
  hard-splits the screen into two side-by-side columns with no wrap and no
  viewport-based sizing (`flex: 1.1` / `flex: 1`), so the owner-total card
  never gets more than roughly half the screen regardless of how wide the
  device actually is. On top of that, `Figure` (same file, the component
  rendering `owner-share`) sets `numberOfLines={1} adjustsFontSizeToFit` —
  `adjustsFontSizeToFit` is an iOS-native `Text` prop with **no effect on
  react-native-web**, so on the actual web build this line does nothing:
  the number never shrinks to fit, it just clips. The two-column layout
  itself is also a horizontal-fit problem regardless of the font-shrink bug
  — even fixing `adjustsFontSizeToFit` only buys back the 1px shortfall at
  844px wide, not the 217px shortfall at 360px wide.
- **Suggested fix direction**: (a) stack the derivation and owner-total
  columns vertically below some viewport-width threshold — a
  `useWindowDimensions()` check or a responsive flex-wrap, matching the
  project's existing orientation-driven layout pattern
  (`docs/ux/design-system.md §4`, `HoldStage`'s own `shortDeviceDim` logic);
  (b) stop relying on `adjustsFontSizeToFit` for web — either measure and
  scale the font size manually the way `HoldStage.onCountLayout` already
  does for the public numeral, or size the figure by character-count
  against its actual box; (c) treat "a seven-figure gross settles this
  farm's typical season" as the baseline test case, not an edge case — the
  worked example in `src/core/fixtures.ts` tops out at ~฿300k, which is why
  this was never caught: nothing in the existing test data is wide enough
  to clip.

#### 3. Settlement's per-zone/per-worker breakdown wraps into an unreadable ladder on phone widths

- **Screen**: settlement, right-hand column (`settle.perZone` /
  `settle.perWorker` cards).
- **Viewports**: 360×640, 390×844 (worst), less severe at 740×360/844×390.
- **Evidence**: `android-small-portrait__11-settlement.png` /
  `iphone-portrait__11-settlement.png` — labels like `โซน A — 1521 เข่ง ·
  76,041 กก.` and values like `฿ 2,015,086.50` both wrap across 2–4 lines
  inside a ~150px-wide column, and the *value* column itself gets clipped
  at the right edge of the screen (`฿2,015,086.5` with the trailing `0` cut
  off, no scroll affordance). This is the `Row` component in the same file
  — `flexShrink: 1` on the label but no width floor, and the amount has no
  reflow strategy at all.
- **Suggested fix direction**: same responsive stacking as Finding 2 would
  also fix this — a full-width column has enough room for label and amount
  on one line at every tested viewport.

#### 4. Every interactive control measured is under the ~44×44 CSS px touch-target floor

- **Screen**: counter (Count tab, counting state) — measured directly via
  `getBoundingClientRect()`, consistent across all five viewports (padding
  is not viewport-dependent, so the numbers don't change by device):

  | testID | width×height (px) |
  |---|---|
  | `tab-count` / `tab-pile` / `tab-log` | 49×32 / 54×32 / 66×32 |
  | `undo` | 128×40 |
  | `short` | 98×40 |
  | `row-close-pile` | 65×40 |
  | `open-switcher` | 76×24 |
  | `speech-toggle` | 47×24 |
  | `theme-toggle` | 54×24 |

  Every single one is short on height (32/40/24 vs. the 44px floor), and
  `open-switcher`/`speech-toggle`/`theme-toggle` are additionally the
  status-pill row in `TopBar` — meant to be read, not tapped, but they are
  interactive (`onPress`) and are the *only* way to reach the zone/pile
  switcher, so a 24px-tall touch target for a load-bearing navigation
  affordance is a real problem, independent of Finding 1.
- **Field-condition note**: this app is explicitly designed for outdoor,
  one-handed, buyer's-hand operation — wet hands, gloves, thumb-only reach —
  where the standard 44px guidance is already a *floor*, not a target. A
  24px pill is not a marginal miss here.
- **Suggested fix direction**: raise `Button` and `Pill`'s (when
  interactive) minimum height to 44px; where visual density really needs to
  stay tight (the status pills), keep the visual chip small but pad the
  actual hit target with `hitSlop`, the same technique `WeightInput`'s track
  already uses for its drag handle (`WeightInput.tsx` — `hitSlop={{ top: 16,
  bottom: 16 }}`).

#### 5. Short-basket panel overflows the viewport horizontally, with no way to scroll to it

- **Screen**: `ShortBasketPanel` (opened via the "short" button on a
  counting pile).
- **Viewport**: 360×640 (android-small-portrait).
- **Measurement**: `document.documentElement.scrollWidth` (387px) >
  `clientWidth` (360px) — a genuine 27px horizontal overflow of the whole
  document, not just one element.
- **Screenshot**: `android-small-portrait__08-short-basket.png` — the
  `WeightInput`'s `+` button is not fully visible on screen; the row (`−`
  button / typed value / `+` button, `WeightInput.tsx` lines ~143-183) does
  not fit 360px wide, and because the overflow is on `document`, not inside
  a horizontal `ScrollView`, there is **no way to reach the `+` button by
  scrolling** — it is simply off the right edge of the page.
- **Suggested fix direction**: give the `−`/typed-field/`+` row explicit
  `flexShrink` on the two buttons (they currently have no flex, only
  content-driven width) so the row genuinely fits 360px, or drop the
  fixed-width buttons to icon-only glyphs at narrow widths.

---

### MINOR

#### 6. Bulk-entry reason placeholder text is clipped

- **Screen**: bulk entry form (`bulk-reason` field).
- **Viewport**: 360×640.
- **Evidence**: `android-small-portrait__07-bulk-entry.png` — the Thai
  placeholder ("เช่น นับไว้ในกระดาษ มาร์...") is cut off mid-word inside its
  single-line input box. Low severity because it's placeholder text (not
  data), but it's exactly the kind of Thai-text clipping the audit was
  asked to check for, and it's the field this whole form exists to force
  someone to fill in honestly.
- **Suggested fix direction**: either wrap the placeholder across two
  lines, or shorten it to fit 360px in the mono/sans stack actually used.

#### 7. `TopBar` crumb truncates aggressively on narrow phones

- **Screen**: every screen using `TopBar` (counter, settlement, farm
  profile, setup) at 360×640.
- **Evidence**: `numberOfLines={1}` on the crumb text
  (`chrome.tsx` — `TopBar`) plus five to six sibling pills competing for the
  same row means the crumb regularly renders as `ไร่คุณพ่อ ▸ โ...` or
  `ไร่คุณพ่อ ...` (see `android-small-portrait__06b-after-tab-tap-attempt.png`,
  `android-small-portrait__07-bulk-entry.png`). This is a deliberate
  trade-off (the crumb is breadcrumb context, not the primary content), so
  it's flagged as minor rather than major, but on the smallest supported
  phone it regularly loses the zone/pile name entirely, which matters when
  switching between zones is a core workflow.
- **Suggested fix direction**: consider truncating the farm name (which
  rarely changes and is least useful mid-count) before the zone ▸ pile
  segment, since the zone/pile is the part someone actually needs to
  confirm they're in the right place.

---

## What could not be tested here (say so honestly)

- **Real device touch** — everything above uses Chromium's touch-emulation
  and CDP-level synthetic touch dispatch, which is the best available in
  this sandbox and is real event-level proof (not just a mouse click
  standing in for a tap), but it is still not a finger on a physical
  screen. Finding 1 in particular deserves a real-device confirmation pass
  before or alongside a fix — the exact browser-internal reason a 360px/
  375px-wide layout resolves a tap to the wrong element was not fully
  root-caused (see Finding 1's "actual likely cause" — it's an inference
  from the touch-target geometry, not a traced browser algorithm), and a
  real device (or Chrome's on-device remote debugging) would give more
  confidence in the true trigger condition and in any proposed fix.
- **iOS Safari specifically** — this suite is Chromium-only (per the task's
  environment). Safari's own touch-target disambiguation, `100vh` handling,
  and font-loading timing are all known sources of mobile-web bugs
  independent of Chromium's, and were not covered.
- **Actual on-device network conditions / offline behaviour** — this audit
  is purely layout- and input-focused; it did not exercise the offline
  sync engine or throttled-connection behaviour, which is out of scope for
  a UX audit but is a first-class product constraint per `CLAUDE.md`.
- **Screen readers / real assistive tech** — touch-target and clipping
  findings above have accessibility implications, but no screen-reader
  pass (TalkBack/VoiceOver) was run.
- **The full screen list** — sale list, settings, farm profile, sale setup,
  zero/tare gate, pile/zone editing (setup screen), and close-pile/close-
  sale confirms were screenshotted and spot-checked for overflow at every
  viewport (see the pass/fail matrix below) but not exhaustively
  interaction-tested tab-by-tab the way the counter screen was — the task's
  two seed bugs pointed specifically at the counter and settlement screens,
  and the budget here went deepest there.

---

## Pass/fail matrix

Legend: ✅ no `document.documentElement.scrollWidth > clientWidth`
overflow and no confirmed blocking-tap issue at that viewport · ⚠️ minor
issue observed (clipping/wrap/small target, not blocking) · ❌ confirmed
blocking or major issue (see finding number).

| Screen | iPhone-portrait 390×844 | iPhone-landscape 844×390 | Android-small-portrait 360×640 | Android-small-landscape 740×360 | Tablet-portrait 820×1180 |
|---|---|---|---|---|---|
| Sale list | ✅ | ✅ | ✅ | ✅ | ✅ |
| Settings | ✅ | ✅ | ✅ | ✅ | ✅ |
| Farm profile | ✅ | ✅ | ✅ | ✅ | ✅ |
| Sale setup | ✅ | ✅ | ✅ | ✅ | ✅ |
| Zero/tare gate | ✅ | ✅ | ✅ | ✅ | ✅ |
| Counter — Count tab / HoldStage | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Counter — Pile/Log tabs reachable by touch** | ✅ | ✅ | **❌ Finding 1** | ✅ | ✅ |
| Bulk entry | ✅ | ✅ | ⚠️ Finding 6 | ✅ | ✅ |
| Short-basket panel | ✅ | ✅ | **❌ Finding 5** (doc overflow) | ✅ | ✅ |
| Pile/zone editing (setup) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Close-pile confirm | ✅ | ✅ | ✅ | ✅ | ✅ |
| Close-sale confirm | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Settlement — owner total** | **❌ Finding 2** | ⚠️ Finding 2 (1px short) | **❌ Finding 2** | ⚠️ Finding 2 | ⚠️ Finding 2 |
| Settlement — per-zone/worker | ⚠️ Finding 3 | ✅ | ⚠️ Finding 3 | ✅ | ✅ |
| Touch-target sizes (tabs, chrome buttons, pills) | ⚠️ Finding 4 | ⚠️ Finding 4 | ⚠️ Finding 4 | ⚠️ Finding 4 | ⚠️ Finding 4 |

(Touch-target sizes are viewport-independent — the CSS padding driving them
doesn't change by device — so Finding 4 is marked ⚠️ on every column
deliberately; it's a design-token issue, not a per-screen-size one.)

---

## What a mobile-friendly rule set for this repo should say

These are meant to become a checklist / agent skill, so they're written as
things a reviewer (human or agent) can actually check, specific to this
app's real constraints — not generic "make it responsive" advice.

1. **Every number that can grow must be tested at the size it will actually
   reach, not the size in today's fixtures.** `src/core/fixtures.ts`'s
   `workedExample()` tops out around ฿300k; nothing in the existing test
   suite exercises a seven-figure total, which is exactly why Finding 2 was
   never caught. Rule: any money or weight figure rendered with
   `numberOfLines={1}` must have at least one test/story fixture at 1.5–2×
   the widest realistic value for this farm's biggest sale of a season, and
   that fixture must be checked at the narrowest supported viewport.
2. **`adjustsFontSizeToFit` does nothing on web — never rely on it alone
   for a number that must not clip.** If a figure needs to shrink to fit,
   measure and set its font size explicitly (the pattern already exists in
   this codebase: `HoldStage.onCountLayout`/`advanceEm`) or lay it out so it
   never needs to shrink (full width, wrap, or a secondary compact format
   once past N digits).
3. **No two-column (or fixed side-by-side) layout without a portrait
   fallback.** A `flexDirection: 'row'` layout that assumes landscape width
   is exactly the class of bug in Finding 2/3. Any screen with a row layout
   must specify, in its story, what it does under 400px of width — stack,
   scroll, or shrink — and that behaviour must be screenshotted at 360×640
   portrait specifically, the narrowest supported phone.
4. **A `ScrollView` only scrolls the axis it's declared for.** Content that
   can overflow horizontally inside a vertical `ScrollView` (or inside
   plain document flow) is invisible and unreachable, not just ugly —
   `document.documentElement.scrollWidth > clientWidth` at any tested
   viewport is a **blocking** bug, not a cosmetic one, and should fail CI
   the same way a broken build does. This is a machine-checkable rule
   (`scrollWidth <= clientWidth` per screen per viewport) and should become
   an automated Playwright assertion project-wide, not just a manual audit
   step.
5. **No interactive element under 44×44 CSS px, ever, and especially not
   adjacent to a much larger interactive element.** This app is used
   one-handed, outdoors, sometimes with wet hands or gloves — 44px is a
   floor here, not an ideal. Where a compact visual (a status pill, a tab)
   is a hard design requirement, pad the *hit target* with `hitSlop`
   (already used in `WeightInput`) rather than shrinking the tappable area
   to match the visual. Any small (<44px) interactive element that sits
   flush (zero gap) against a large interactive sibling — the exact
   geometry behind Finding 1 — needs either a real gap or an explicit
   `hitSlop`/z-index review before it ships, verified with a real
   `page.touchscreen.tap()`, not a click.
6. **A tap and a click are not the same test.** `fireEvent.click` /
   Playwright's default `.click()` exercises mouse-event handling only.
   Anything reachable-by-mouse-but-not-by-touch is invisible to the
   existing test suite (this is exactly how Finding 1 shipped unnoticed).
   Any e2e test asserting a control is reachable on a project marked
   `isMobile`/`hasTouch` must use `page.touchscreen.tap()` or
   locator `.tap()`, and ideally also assert on the real post-tap state
   (the tab actually switched, the panel actually opened) rather than only
   that the element `toBeVisible()` — visibility proves nothing about
   whether a *touch* can reach it.
7. **Thai text needs real content in every test fixture, not lorem-ipsum
   English.** Stacked vowels and tone marks (สระ บน/ล่าง, วรรณยุกต์) clip
   and wrap differently from Latin text; a placeholder or label authored
   and reviewed only in English would never have caught Finding 6. Every
   text-bearing fixture in this repo already uses real Thai (`ไร่คุณพ่อ`,
   `ประยุทธ ใจดีมากเป็นพิเศษ`, etc.) — keep it that way, and specifically
   include at least one long worker/zone/reason string per fixture so wrap
   and clip behaviour is exercised, not just short placeholder names.
8. **Portrait is a first-class orientation on mobile web now — test it as
   default, not as a special "orientation" project.** The existing
   `playwright.config.ts` treats phone-portrait as a narrow, orientation-
   hint-only project (`testMatch: /orientation\.spec\.ts/`). Per the
   updated product direction, every interaction test that runs in
   phone-landscape should also have a portrait counterpart — not
   necessarily a duplicated screenshot, but the same reachability and
   overflow assertions.
9. **Offline-first does not mean layout-agnostic.** This wasn't directly
   findable in the current audit, but it follows from the architecture:
   any responsive fix (stacking, font-scaling) must not depend on a network
   round-trip (e.g. a remotely-fetched font metric) to compute correctly,
   or a phone that's offline mid-sale — the app's core supported condition
   — will render the pre-fix layout. Any measurement-based sizing fix
   (Finding 2's suggested direction) should measure against locally-available
   fonts/metrics, consistent with how `HoldStage` already does it.
