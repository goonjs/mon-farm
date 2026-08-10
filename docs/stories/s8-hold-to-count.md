# Story: Hold to count

Status: **Review** — implemented 2026-08-10. Cannot reach `Done` without a
push to CI and an independent review (`docs/process.md` steps 7–9), neither of
which is authorized.

## Context

- Epic: `docs/epics/epic-1-run-and-settle-one-sale.md`
- Architecture: `docs/architecture.md`

## Description

Press and hold 3s, with the bezel sweep travelling the stage perimeter.
Completion is driven by a timer, the animation by requestAnimationFrame —
separately, because rAF is throttled in background tabs and stops on screen
lock, and a hold whose completion rode on the frame loop would behave
unpredictably when the screen slept.

## Acceptance criteria

- [x] A completed hold logs exactly one `accept`.
- [x] An early release logs a `reject` with its duration and counts nothing.
- [x] Rejection is as loud as acceptance and distinguishable from it (F-7).
- [x] A pointer dragged off the stage does not become a phantom count.
- [x] 2999ms does not count; 3001ms counts once (fake timers).
- [x] No timer survives unmount.
- [ ] Haptic feedback — **blocked**, `expo-haptics` is outside the authorized
      dependency list.

## Offline / sync behavior

N/A directly, but every outcome — accepted, rejected, or cancelled — is an
appended event, so the record of what the operator did survives offline.

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
