# Story: Orientation and tablet support

Status: **Review** — implemented 2026-08-10. Cannot reach `Done` without a
push to CI and an independent review, neither authorized.

## Context

- Epic: Legacy (PRD v0.4) — ไม่มี epic v1.0 รองรับโดยตรง รอเจ้าของตัดสิน; ดู `docs/prd.md` NFR
- Owner instruction: "make sure this app allow vertical mode in mobile or
  tablet too."
- Placed before S6/S9/S11/S13 deliberately — authoring the remaining screens
  responsive from the start is far cheaper than retrofitting four more screens
  after the fact, which was the actual reasoning offered when this was
  proposed and accepted.

## Description

`app.json`'s orientation lock changes from `"landscape"` to `"default"` —
phone and tablet, both orientations. Portrait is genuinely better for most of
this app (setup, log, settlement are row-heavy and were being crammed into
~390px of height); the one screen with a real physical constraint against it
is the counter's public numeral.

That constraint was re-derived per orientation rather than assumed to carry
over (see the updated table in `docs/ux/counter-screen-findings.md`): a phone
in portrait cannot reach the 40mm legibility threshold once a pile passes two
digits — the count becomes width-limited, and a phone in portrait is not wide
enough. Tablets clear it in both orientations across this MVP's digit range.

Rather than encode that as an orientation/digit-count rule, `HoldStage.tsx`
**measures it live**: it compares the achieved numeral size against the
device's short physical edge and shows a small, non-blocking hint — "turn the
phone for a clearer count" — exactly when the measurement fails. The
alternative (silently shrinking the numeral, or a hard block) was rejected in
the original plan for hiding a money-accuracy problem or stopping someone
mid-sale over a layout opinion.

## Acceptance criteria

- [x] `app.json` orientation unlocked (`"default"`).
- [x] The rotate hint appears only when the measured numeral size falls below
      the legibility floor — not on any hardcoded orientation or digit check.
- [x] It never blocks counting; holds work identically with or without it
      showing.
- [x] A phone in portrait: no hint at two digits, hint appears at three.
- [x] A tablet in portrait: no hint at three digits.
- [x] Sale list and settlement hold their layout in portrait (no horizontal
      overflow).
- [x] Design tokens gain portrait and tablet reference viewports
      (`design/tokens.ts` → `docs/ux/tokens.css`, checked in CI).

## Offline / sync behavior

N/A — layout and measurement only, no data or network involvement.

## Test plan

- [x] `e2e/orientation.spec.ts` (new), run only on the two new Playwright
      projects (`phone-portrait`, `tablet-portrait`) — see the file header and
      `playwright.config.ts` for why the rest of the suite doesn't also run
      here: the interaction tests exercise JS event handling that doesn't
      depend on viewport size, so re-running all of them at every screen size
      would be bulk, not signal.

## Verification

- [x] `npm run verify` green: 46 core, 10 component, **42 e2e** (6 skipped by
      design — project-scoped phone/tablet variants of the same test).
- [x] Screenshot: `docs/ux/screenshots/phone-portrait/sale-list.png` — one row,
      no overflow, "start a new sale" pinned to the bottom.

## Dev notes — a real calibration gap found and fixed, not assumed away

The first version of the rotate-hint condition compared the numeral's
rendered size against `minHeightRatio` (0.62) uniformly across devices. That
is wrong for a tablet, and the wrongness was caught by the tablet-portrait
test rather than asserted around: at three digits, a portrait tablet computes
to ratio ≈ 0.54 — below the floor — while working the same geometry in real
millimetres puts the glyph at ~85mm, past even the 83mm "comfortable" target
from F-9.7's own arithmetic.

The reason: a ratio of logical points is only a valid stand-in for physical
millimetres when points-per-mm is roughly constant between the devices being
compared. That holds for phone vs. phone (~160 points/inch on both,
historically) and fails for phone vs. tablet — an iPad's logical points map to
roughly 20% more physical millimetres each than an iPhone's do, since tablets
show more content rather than scaling content up. `minHeightRatio` was
correctly calibrated for phones; it does not transfer.

Fixed with a size-based tablet threshold (`tokens.publicNumeral.
tabletBreakpointPx = 600`, Material Design's own phone/tablet breakpoint — a
defensible, externally-documented line, not a number invented for this app)
rather than by lowering the phone floor to make the tablet case pass, which
would have weakened what the floor verifies for phones to paper over a gap
that was never really about phones.

## Known, deliberately unresolved

`docs/ux/counter-screen-findings.html` (the interactive millimetre-calibration
companion to the `.md` findings) was **not** updated to add a portrait column
— the prose findings doc was, since that's what an implementer reads before
building, but syncing the HTML calibration tool is cosmetic and was left out
to keep this story's scope to the behaviour that's actually tested.

Tablet landscape has no dedicated test project — asserted, not verified, on
the basis that nothing in this layout is viewport-driven in a way orientation
could break for a device that size. If a future story adds tablet-specific
landscape chrome, this assumption should be revisited.

## Code review

- Reviewer (separate agent/session): **not yet run** — required before `Done`.
