# Story: A brief pinch still counts a basket

Status: **Review** — implemented 2026-09-02. Cannot reach `Done` without a
push to CI and an independent review (`docs/process.md` steps 7–9), neither
of which is authorized. **Owner retest on 2026-09-02 reported the symptom
recurring — treat this story as still open, not device-confirmed. See QA
notes.**

## Context

- Epic: `docs/epics/e04-sale-weighing.md`
- Related PRD section(s): FR-5.5, FR-5.7, F-9.7 (physical single-finger
  design), Open question 1 (counter screen error-prevention)
- Depends on / follows: S8 (hold to count), and directly on the
  2026-09-01 amendment to `docs/stories/s8-hold-to-count.md`, which fixed a
  related but distinct bug and named this exact gap in its own "not fully
  closed" note before it was reported.

## Description

**Field report, 2026-09-01, from the owner testing on their own phone**:
pinching the counter screen briefly — a normal, fast zoom gesture, not a
deliberate 1.5s+ hold — still registers a counted basket.

**This is not the bug S8's amendment fixed.** That fix stopped an unrelated
finger's *release* from wrongly *cancelling* a different finger's genuine,
still-in-progress hold. It deliberately did not decide what should happen
when a **second finger touches down while a hold is already running** — it
just made sure that second finger's own events (`pointermove`, `pointerup`)
are ignored rather than corrupting `activePointerId`/`lastPointer` tracking
for the first. The practical effect: the *first* finger's hold keeps
running to completion exactly as if the second finger didn't exist. A pinch
starts with two fingers touching down close together — if the first of the
two happens to stay roughly still (a real pinch's anchor finger often
does) for the full hold duration, this fix's own "ignore the second finger
entirely" choice means that first finger's hold is free to complete and
count — even though nobody intended to hold anything; they intended to
zoom.

**Root cause, confirmed with real touch input, and it is not what the
original hypothesis below (kept for the record) guessed.**

The hypothesis when this story was drafted was that `HoldStage` needed to
become *active* on a second finger touching down mid-hold — cancel
immediately, the moment a second pointer arrives, rather than ignoring it.
That was tested first, before writing any fix: a plain sequential
CDP-dispatched two-finger touch (down, brief move, both released via
`touchEnd`) was reproduced and it **did not** exhibit the bug — the anchor
finger's own release already fires a normal `pointerup` matching its
`activePointerId`, and the existing S8-era window listener already cancels
the hold correctly. Reacting to a second finger's mere touchdown would have
been the wrong fix on two counts: it wasn't the actual gap, and it would
have broken the S8 regression test outright (that test's own second finger
touches down mid-hold by design, and must NOT cancel the first finger's
genuine hold).

The actual gap: a **real** pinch-to-zoom gesture is not always released
with a clean `touchend`. When the browser itself recognizes a multi-touch
gesture as its own native pinch-zoom action — which it does here, because
the Artifact-preview build used for phone testing does not carry
`+html.tsx`'s `user-scalable=no` the way the real packaged app does — it
terminates the touches with `touchcancel`, not `touchend`. Chrome derives a
`pointercancel` PointerEvent from that, never `pointerup`. `HoldStage`'s
window-level listener (added for S8) only ever listened for `pointerup`, so
a hold whose owning finger was cancelled this way just kept running on its
own timer, checked `pointerIsOnStage()` (still `true` — nothing had ever
told it the pointer left), and completed: a basket counted that nobody
performed, exactly matching the field report. Confirmed by dispatching a
real CDP `touchCancel` event mid-hold and watching the count wrongly
increment against the pre-fix code (see Test plan).

**Fix**: `HoldStage` now also listens for `pointercancel` at the window
level, identity-checked against `activePointerId` the same way `pointerup`
already is, and reacts identically — the existing reject path, nothing new.
One listener, same guard, same cleanup. See `src/components/HoldStage.tsx`.

## Acceptance criteria

- [x] A genuine simultaneous two-finger pinch (both fingers down within a
      short window of each other, moving apart/together, both lifting
      within the gesture) on the stage during an active hold cancels that
      hold — no basket is counted, regardless of how long the anchor finger
      stayed down.
- [x] The cancellation is loud, not silent, per F-7's existing standard —
      reuses the existing reject path (`onReject`, the "released early"
      feedback) rather than introducing a new, undiscussed correction
      reason on `RejectEvent`.
- [x] A single finger's hold, undisturbed by any second touch, is
      unaffected — this must not regress the S8 fix or any existing
      single-finger hold behavior.
- [x] The existing S8 regression test (a second finger touching down **and
      lifting** mid-hold does not cancel a genuine, unrelated hold) keeps
      passing — this story is about a second finger **remaining down**
      while the gesture plays out, a different case, not a reversal of that
      one.

## Offline / sync behavior

N/A — this is client-side touch-input handling with no data or network
involvement. Whatever gets recorded (a `reject` event, same as any other
cancelled hold) already goes through the existing offline-first event log.

## Test plan

- [x] Confirm the exact symptom first, with real touch input — mouse
      simulation cannot reproduce this (established while fixing S8).
      Chrome DevTools Protocol's `Input.dispatchTouchEvent`, via
      `context.newCDPSession(page)`, is the proven technique
      (`e2e/counter.spec.ts`'s existing "second finger" test is the
      pattern to extend).
      - First attempt (plain two-finger down/move/`touchEnd`) did **not**
        reproduce the bug — recorded above, since it disproved the
        original hypothesis.
      - `touchCancel` (CDP's dedicated type for a browser-cancelled touch)
        does reproduce it exactly.
- [x] A dispatched two-finger sequence — both down within ~100ms of each
      other, held/moved briefly, both cancelled via `touchCancel` — must
      show zero increment to the count, before any fix is written (red
      first). Confirmed red: count wrongly went from 5 to 6 against
      unmodified code.
- [x] After the fix: same sequence shows no increment (green); a
      single-finger hold run the full duration still counts normally; the
      existing "second finger lifts, first keeps holding" S8 test still
      passes unmodified.

## Verification

- [x] Sandbox run performed: `npm run build:web`, then the full
      `npm run test:e2e` suite (all projects) against a local Playwright
      config pointed at this sandbox's pre-installed Chromium — 106
      passed, 6 correctly skipped by device scoping. `npm run typecheck`,
      `npm run lint`, `npm run test:core` (80 tests) and `npm run test:ui`
      (41 tests) also green.
- [x] Screenshots — not applicable. This is a touch-event-timing fix with
      no new or changed visible state (no new UI element, no new feedback
      text — the reject path and its rendering already existed and are
      unchanged). The real verification is the CDP-driven e2e test, which
      exercises the actual browser-level event this bug depends on; a
      screenshot of a numeral not incrementing would prove nothing a
      static image could show that the test doesn't already assert.
- [ ] **Never run on a real device.** Web/CDP only, same limitation as S8.
      The root cause here is specifically about how a *real* browser's
      native gesture recognizer decides to cancel a touch sequence —
      CDP's `touchCancel` type reproduces the resulting event faithfully,
      but a real phone's actual pinch-to-zoom recognizer was not exercised
      end-to-end. Worth a real-device pass if one becomes available.

## Dev notes

The story's original "candidate implementation" (react to a second
finger's mere touchdown by cancelling immediately) was tested first and
found wrong — see "Root cause" above. Kept here as a record of what was
tried and ruled out, not as guidance for a future reader: it is not what
was built.

What actually shipped: `src/components/HoldStage.tsx`'s window-level
listener effect gained one more `addEventListener('pointercancel', ...)`,
reusing the exact same `onEnd` handler already bound to `pointerup`
(same identity check against `activePointerId`, same cleanup on unmount).
No new state, no new event payload, no new UI. The existing `RejectEvent`
path (`onReject`, "released early" feedback) already covers this — F-7's
loud/distinguishable requirement was already met, nothing new to add there.

## Code review

- Reviewer (separate agent/session): not yet run — required before `Done`.
- Findings:
- Resolution:

## QA notes

Not verified on a real device (see Verification). The Artifact-preview
build used for phone testing lacks `+html.tsx`'s `user-scalable=no`, which
is what let the browser claim the pinch as native zoom in the first place —
the real packaged app already suppresses that path, so this fix is mainly
defense-in-depth there (and the actual fix for any other reason a touch
gets cancelled — palm rejection, an OS gesture, etc. — which `user-scalable`
does nothing about). Worth a real-device confirmation once one is
available, per the story's original test plan.

**Owner retest, 2026-09-02 — still open.** After this fix landed, the owner
retested by pinching an Artifact-preview build (the same delivery mechanism
as the original field report) and reported the same symptom recurring.
During that same retest session, two unrelated packaging bugs were found
and fixed in the Artifact-preview delivery pipeline itself — an
`expo-router` path-matching failure showing "Unmatched Route" on first
load, and a stripped `<head>` stylesheet collapsing the setup screen's
flex layout to zero visible height — both confirmed by direct DOM
inspection to be bugs in the ad-hoc HTML-inlining script used only to
publish the preview, not in any committed source file (`HoldStage.tsx` is
untouched by either). Whether what the owner saw on this retest was one of
those two packaging bugs, a third one not yet found, or the pinch-counting
bug itself recurring, is **not isolated**. The automated CDP-driven
regression test added for this story (`e2e/counter.spec.ts`) still passes
unmodified. **Do not treat this story as device-confirmed** — the unchecked
"never run on a real device" box below stays unchecked until a clean retest
happens, ideally against a real build (dev client or packaged app) rather
than the Artifact-preview shortcut, which has now demonstrated it can fail
in ways that look identical to the app itself misbehaving.
