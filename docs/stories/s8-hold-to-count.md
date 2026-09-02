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

## Amendment, 2026-09-01 — a real multi-touch bug, found on a real phone

The QA note above flagged it exactly: "Never run on a device or emulator.
Web only." This is the gap that let it through.

**Field report**: on a real phone, attempting to pinch-zoom the counter
screen sometimes left the app "still counting" after release, needing
several undos to recover from.

**Root cause, confirmed with real touch input** (mouse-event simulation
cannot reproduce this, and neither can a script-dispatched `TouchEvent` — see
below): every cancellation path in `HoldStage` — the window-level
`pointerup` listener, and the `pointermove`/`pointerdown` listener that feeds
`pointerIsOnStage()` — reacted to **any** pointer, with no identity check.
An ordinary second finger touching down and lifting (exactly what an
aborted pinch attempt looks like) fires a genuine `pointerup`, which
cancelled whatever hold happened to be in progress from a completely
different, still-down finger that never moved and never lifted.

**Fix**: a hold now claims the `pointerId` of the finger that started it
(`activePointerId`, captured via a raw `onPointerDown` on the stage,
guarded so a second finger touching down mid-hold can never steal
ownership), and every window-level listener ignores events from any other
pointer. Cleared on `stop()` so the next hold picks up whichever pointer
starts it.

**How this was actually verified — worth recording, since it's the reusable
part.** `page.mouse.*` only ever fires mouse events, even under a "mobile"
device profile. A script-dispatched `new TouchEvent(...)` looked like the
right tool but produced *nothing* — no `onPressIn`, no hold at all — because
the browser's own touch-to-pointer-event derivation, and RNW's
native-event-bound Responder system, only run for genuine input, never for
`element.dispatchEvent()`. What actually reproduces this class of bug is
Chrome DevTools Protocol's `Input.dispatchTouchEvent`, driven directly via
`context.newCDPSession(page)` — real input injection at the browser-engine
level. `e2e/counter.spec.ts`'s new test (`a second finger touching down and
lifting mid-hold does not cancel it`) uses exactly this, and was confirmed
to fail against the pre-fix code (reverted locally, re-run, restored) before
being kept as a permanent regression test — the first test in this repo
that exercises a real multi-touch sequence rather than a single simulated
pointer.

**Not fully closed by this fix, and since confirmed as its own bug, and
since fixed**: a genuine *simultaneous* two-finger pinch (rather than a
sequential touch-and-lift) was untested at the time this fix landed. It was
reported the same day: a brief pinch can still register a count. The actual
mechanism turned out not to be this fix's "ignore the second finger" choice
at all (that hypothesis was tested and ruled out) — it was that a real
browser-recognized pinch-zoom gesture ends its touches with `pointercancel`,
which this fix's window listener never listened for, only `pointerup`.
Fixed in `docs/stories/s32-pinch-counts-a-basket.md`, which added exactly
that listener. Also worth noting: the real
packaged app blocks pinch-zoom outright via `+html.tsx`'s
`user-scalable=no`, which the Artifact-preview build used for phone testing
does not carry (a known limitation of using an Artifact as a preview
vehicle, not of the app) — so an intentional zoom gesture is less likely to
reach this code path in production than it was in the environment this bug
was actually found in. The underlying pointerId-blindness was real
regardless, and any incidental second touch (adjusting grip, a second hand
steadying the phone) could have triggered it.
