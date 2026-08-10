# Story: Design tokens shared with the app

Status: **Review** — implemented 2026-08-10. Cannot reach `Done` without a
push to CI and an independent review (`docs/process.md` steps 7–9), neither of
which is authorized.

## Context

- Epic: `docs/epics/epic-1-run-and-settle-one-sale.md`
- Architecture: `docs/architecture.md`

## Description

The app imports `design/tokens.ts` directly via `src/theme/`; the same file
generates `docs/ux/tokens.css` for the prototypes. CI runs the emitter with
`--check` and `check-contrast.mjs --strict`, so a token changed without
regenerating, or a colour that drops below its required ratio, turns the
pipeline red.

## Acceptance criteria

- [x] `useTheme()` returns the active palette; light is the default.
- [x] Dark is switchable in-app (topbar toggle).
- [x] `npm run tokens:check` fails on an un-regenerated token change.
- [x] `npm run contrast` verifies all 46 pairings.
- [ ] Dev token-gallery screen — **not built**. The `docs/ux/design-system.html`
      gallery covers the same ground for review purposes, so this was dropped
      rather than duplicated in-app.

## Offline / sync behavior

N/A — no data or network involvement.

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
