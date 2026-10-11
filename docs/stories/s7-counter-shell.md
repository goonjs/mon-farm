# Story: Counter screen shell

Status: **Review** — implemented 2026-08-10. Cannot reach `Done` without a
push to CI and an independent review (`docs/process.md` steps 7–9), neither of
which is authorized.

## Context

- Epic: `docs/epics/e04-sale-weighing.md`
- Architecture: `docs/architecture.md`

## Description

Landscape tabbed layout per F-19: Count / Pile / Log, with the public numeral
filling the stage and a persistent mini-count in the topbar whenever a
non-Count tab is active.

## Acceptance criteria

- [x] Numeral clears 0.62 of viewport height at two and three digits, on both
      the 844×390 reference and the 740×360 floor.
- [x] It does not wrap or overflow the viewport at three digits.
- [x] Mini-count visible on every non-Count tab.
- [x] Screenshots captured at both viewports.
- [ ] Zone/pile switcher overlay — **not built**.

## Offline / sync behavior

N/A — reads projected state.

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
