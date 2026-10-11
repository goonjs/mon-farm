# Story: Settlement screen

Status: **Review** — implemented 2026-08-10. Cannot reach `Done` without a
push to CI and an independent review (`docs/process.md` steps 7–9), neither of
which is authorized.

## Context

- Epic: `docs/epics/e05-reconciliation-settlement.md`
- Architecture: `docs/architecture.md`

## Description

Renders `settle()`'s derivation with each side's share leading, and a per-zone
breakdown. Settlement stores nothing — it is a pure function of the log, so it
can be recomputed from the record and cannot drift from it.

## Acceptance criteria

- [x] Every step of the money chain is shown, not a single total (FR-7.4).
- [x] Owner and worker shares are the most prominent figures on the screen.
- [x] Per-zone rows present for every zone.
- [x] Figures match a hand calculation to the satang.
- [x] Screenshots at both viewports.
- [ ] Closing the sale from this screen — **not built**; the route is reachable
      but writes no `sale_closed` event.

## Offline / sync behavior

N/A — derived from the log.

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
