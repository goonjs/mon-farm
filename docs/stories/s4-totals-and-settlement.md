# Story: Totals, rollups and settlement

Status: **Review** — implemented 2026-08-10. Cannot reach `Done` without a
push to CI and an independent review (`docs/process.md` steps 7–9), neither of
which is authorized.

## Context

- Epic: `docs/epics/epic-1-run-and-settle-one-sale.md`
- Architecture: `docs/architecture.md`

## Description

`src/core/totals.ts` and `src/core/settle.ts`. Pile / zone / sale / subset
rollups, and the settlement derivation FR-7.4 requires — each step one
arithmetic operation, so a disagreement localises to a step rather than to
"the app".

## Acceptance criteria

- [x] Voided baskets drop exactly their own contribution.
- [x] Short baskets contribute `reading − tare`, never the reading.
- [x] Rejected holds never reach the totals.
- [x] Sale total equals the sum of its zones.
- [x] Per-zone gross sums to the sale gross with no drift — each zone rounded
      once, then summed, never apportioned from a sale-wide figure.
- [x] Owner + worker is exactly gross, per zone and overall, including at a
      split percentage that cannot divide evenly (33%).
- [x] `settle()` refuses rather than guesses when price or split basis is
      missing (FR-8.5 — no safe default).
- [x] The worked example reproduces `docs/ux/mvp-screens.html` screen 7 to the
      satang.
- [ ] `thaiNumber()` — **not built**, belongs with S10 (speech).

## Offline / sync behavior

N/A — pure functions over the log.

## Test plan

- [x] Covered by `npm run verify` — 32 core tests, 6 component tests, 24 e2e
      across two viewports.

## Verification

- [x] Sandbox run: exported web build served statically and driven in a real
      browser.
- [x] Screenshots: `docs/ux/screenshots/phone-landscape/` and
      `docs/ux/screenshots/phone-landscape-floor/`
- [ ] **Never run on a device or emulator.** Web only.

## Code review

- Reviewer (separate agent/session): **not yet run** — required before `Done`.

## QA notes

Unchecked boxes above are real gaps, not oversights. They are the honest
boundary of what this story delivered.
