# Story: Undo and void

Status: **Review** — implemented 2026-08-10. Cannot reach `Done` without a
push to CI and an independent review (`docs/process.md` steps 7–9), neither of
which is authorized.

## Context

- Epic: `docs/epics/epic-1-run-and-settle-one-sale.md`
- Architecture: `docs/architecture.md`

## Description

One-tap undo of the last live basket, appending a `correction` that points at
a `seq`. The target event is never mutated or removed.

## Acceptance criteria

- [x] Undo appends a correction and the total drops by exactly that basket.
- [x] Both the original and the correction remain visible in the log.
- [x] Undo is unavailable when there is no live basket.
- [ ] Void-from-log with a typed reason — **not built**; only the one-tap tier
      exists.

## Offline / sync behavior

Append-only; no destructive writes.

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
