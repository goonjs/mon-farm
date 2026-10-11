# Story: Zero and tare gate

Status: **Review** — implemented 2026-08-10. Cannot reach `Done` without a
push to CI and an independent review, neither authorized.

## Context

- Epic: `docs/epics/e04-sale-weighing.md`
- Related PRD section(s): FR-3, F-21 (`docs/ux/counter-screen-findings.md`)
- Design reference: `docs/ux/mvp-screens.html` screen 2
- Depends on: S3 (the `zero_check`/`tare_confirmed`/`ready` events and the
  `canReady` guard already existed in `src/core/project.ts` before this
  story; nothing in the core model changed here)

## Description

Before this story, e2e fixtures used `readyPile()` to skip straight past the
pre-count wizard, and the real counter screen had no way to reach `ready` at
all — a pile stayed `not-started` forever with no UI path forward. This adds
`ZeroTareGate`, a three-step wizard (zero check → tare weigh-in → read-back)
that occupies the stage in place of `HoldStage` until the pile is genuinely
ready, then hands off.

A failed zero check flags and continues rather than blocking — the judgement
of whether it's safe to proceed belongs to the person at the scale, not the
app (F-21). Thai voice read-back (FR-11) is not wired here; S10 is still not
built, so the read-back is shown as text only.

## Acceptance criteria

- [x] A `not-started` pile shows the gate on the Count tab; `HoldStage` does
      not mount until the pile is ready.
- [x] "Yes, zero" writes `zero_check { ok: true, readingG: 0 }` and advances.
- [x] "Not zero" reveals a reading input; confirming writes
      `zero_check { ok: false, readingG }` and still advances — never blocks.
- [x] Confirming the tare input writes `tare_confirmed` with kg converted to
      integer grams.
- [x] The read-back step shows tare + standard = expected reading, matching
      what `HoldStage`'s caption shows once counting starts.
- [x] "พร้อมค่ะ" writes `ready`, after which the gate unmounts and `HoldStage`
      takes over with the count starting at whatever the log already has.
- [x] Gate progress (zero check done, tare confirmed) survives a reload —
      each step is a persisted event, not client-only state.

## Offline / sync behavior

Same as every other screen: each step writes through `useSale().append()`.
No network involvement.

## Test plan

- [x] `src/components/ZeroTareGate.test.tsx`, 7 cases: starts at step 1;
      "yes, zero" reports `(true, 0)`; "not zero" reveals the input and
      reports the entered grams; `zeroChecked=true` jumps straight to step 2;
      tare kg→grams conversion; the read-back text at step 3; ready fires
      once.
- [x] `e2e/zero-tare-gate.spec.ts`, 4 cases, against `unreadyPileScenario` (a
      pile with none of the three events — `openPileScenario`, used by every
      other counter test, would defeat the point by skipping the gate):
      gate shown instead of the stage; non-blocking flag path; the full
      zero→tare→ready path reaching a countable pile; reload persistence.

## Verification

- [x] `npm run verify` green: 46 core tests (unchanged), 17 component tests
      (10 + 7 new), 56 e2e (50 + 4 new zero-tare-gate + upstream counts,
      6 skipped by device scoping).

## Dev notes

No core model changes — `zero_check`, `tare_confirmed`, `ready`, and
`canReady()` were all already correct from S3. This story is UI-only: giving
those events somewhere to be written from.

`unreadyPileScenario` was added to `e2e/fixtures.ts` alongside the existing
`openPileScenario`, specifically because the latter's whole purpose (letting
every other counter test skip setup) is the wrong fixture for a story that
tests the setup itself.

## Code review

- Reviewer (separate agent/session): **not yet run** — required before `Done`.

## QA notes

The zone/pile switcher (moving between piles, e.g. after closing one) is
S13's scope, not this story's — this story only gates the single
currently-selected pile (`state.piles.find(p => p.status === 'counting') ??
state.piles[0]`, unchanged from before).
