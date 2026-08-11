# Story: Polish from live testing feedback

Status: **Review** — implemented 2026-08-11. Cannot reach `Done` without a
push to CI and an independent review, neither authorized.

## Context

- Epic: `docs/epics/epic-1-run-and-settle-one-sale.md`
- Related PRD section(s): F-7 (feedback loudness), FR-6, FR-12
- Depends on: S13 (close lifecycle — this modifies its confirm flows), S18
  (settlement screen — this modifies its navigation)

## Description

A round of hands-on testing against the running app (not just the exported
build) surfaced several gaps no automated check had caught, because they were
about what the app *doesn't* say rather than what it says wrong. This story
is that batch of fixes, plus the setup-screen auto-save covered separately in
the amendment to `docs/stories/s6-sale-setup.md`.

1. **Undo and close had no confirmation, or a bare one.** Undo fired on a
   single tap with zero confirmation. Close-sale (from both the action row
   and `PileClosedTransition`'s decision point) had none either. Close-pile
   and close-zone had a generic "are you sure?" naming nothing specific.
   All four now name the actual consequence before anything happens: which
   basket and its weight for undo; basket/weight counts for pile and zone;
   zones, piles, baskets, and total weight for the sale, plus an explicit
   note that closing the sale does not force-close piles still counting —
   it only stops them from being countable (`canCount` gates on sale
   status), which is easy to assume incorrectly otherwise.
2. **Settlement had no way back to the sale list.** After closing a sale,
   the only options were "reopen" or a browser back button — no path to
   "start a new sale" or (eventually) other menus. Added a "รายการ · list"
   link to both the counter and settlement topbars.
3. **Reopening duplicated "back to counting."** A closed sale showed both
   "reopen sale" and a separate "back to counting" button, but the second
   did nothing useful on a closed sale (you can't count into it until it's
   reopened). Merged into one action: reopening now also navigates to the
   counter, via `router.back()` to reuse the counter screen already on the
   navigation stack rather than pushing a new instance on top of it.
4. **ถัง renamed to ตะกร้า** throughout the UI and the PRD glossary, per the
   owner: ตะกร้า is the word actually used in the field.
5. **`WeightInput` was hard to use.** Typing a correction required manually
   selecting the old value first (`selectTextOnFocus` fixes this); the drag
   slider was a thin, easy-to-miss line (now a filled track, a larger thumb
   with a visible border, a bigger hit area, and a "drag to adjust" label).

## Acceptance criteria

- [x] Undo shows the target basket's seq, kind (standard/short), and weight
      before voiding it; cancel leaves the count and the log untouched.
- [x] Closing the sale (either entry point) shows zone/pile/basket/weight
      counts and an explicit "not auto-closed" note for piles still
      counting, before appending `sale_closed`.
- [x] Close-pile and close-zone confirmations name basket/weight counts, not
      just "are you sure?"
- [x] Settlement and the counter screen both have a working link back to the
      sale list.
- [x] A closed sale's settlement screen shows one reopen action, not two
      separate "reopen" and "back to counting" controls; confirming it lands
      on the counter screen.
- [x] No occurrence of ถัง remains in `src/` or the PRD.
- [x] `WeightInput`'s typed field replaces its full value on focus; the drag
      track is visibly a slider (filled portion, larger thumb, hint label).

## Offline / sync behavior

No change — these are read-through-the-UI and confirmation-flow changes over
the same event log every other screen uses. No network involvement.

## Test plan

- [x] `e2e/counter.spec.ts` — undo test rewritten: confirm-then-cancel
      leaves the count unchanged; confirm-then-confirm removes it; the
      confirmation names the basket's kind and weight (not a hardcoded seq
      number, since setup events consume seqs too).
- [x] `e2e/close-lifecycle.spec.ts` — close-sale test updated to confirm
      through the new verbose dialog before settlement is reached; the
      reopen test updated to expect landing directly on the counter screen
      (no separate "back to counting" click).
- [x] `e2e/sale-list.spec.ts` — new case: settlement's list link reaches the
      sale list, and "start a new sale" works from there.
- [x] `src/components/WeightInput.test.tsx` — existing 5 cases unaffected
      (behavioral changes here are focus/visual, not covered by RNTL
      pixel assertions; see QA notes).

## Verification

- [x] Full verification run green: `tsc --noEmit`, `eslint .`, 46 core
      tests, 38 component tests, `expo export --platform web`, and the full
      Playwright suite — 84 passed, 6 skipped by device scoping, 0 failed.

## Dev notes

**A real navigation bug, caught only by running the actual reopen flow
through Playwright, not by reading the code:** the first version of the
reopen-then-navigate change used `router.push()` to land back on the counter
screen. Since settlement itself was reached by *pushing* from the counter
(`doCloseSale`), pushing again on reopen stacked a second, new instance of
the counter screen on top of the first rather than returning to it —
`getByTestId('to-settlement')` resolved to two elements after a
close → reopen round trip. This is the exact duplicate-screen trap already
documented for `backToCounting` and the setup screen's "← list" control;
fixed the same way, with `router.back()` to reuse the existing stack entry.

## Code review

- Reviewer (separate agent/session): **not yet run** — required before `Done`.

## QA notes

`WeightInput`'s `selectTextOnFocus` and slider-affordance changes are visual/
interaction changes without dedicated new assertions — the existing
component tests check value propagation, not focus behavior or pixel
rendering. Worth a manual pass on a real device if the drag gesture still
reads as unclear.

Still open from the same testing round, tracked separately because they
change the event model rather than just a screen: a more explicit,
inline-visible breakdown of short baskets (on the stage and in the close
report), and a way to log a basket count already counted before opening the
app (for arriving mid-count, or using the app without a live show). Both are
real, scoped asks — deferred here to keep this batch to confirmation/
navigation/terminology/input fixes that don't touch `src/core`.
