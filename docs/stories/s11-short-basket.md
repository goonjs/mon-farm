# Story: Short basket — the real three-way weight input

Status: **Review** — implemented 2026-08-10. Cannot reach `Done` without a
push to CI and an independent review, neither authorized.

## Context

- Epic: `docs/epics/e04-sale-weighing.md`
- Related finding: F-22 (`docs/ux/counter-screen-findings.md`) — one value,
  three simultaneous ways to set it: drag, ± nudge, typed
- Related finding: F-13 — the panel opens below the stage, never over it
- Replaces: `counter.tsx`'s hard-coded `readingG: 43_000` placeholder

## Description

`WeightInput` gives one value three simultaneous input surfaces — a drag
track, ± 0.5 kg buttons, and a typed decimal field — all staying in sync with
each other. No slider package was installed for the drag track; `PanResponder`
is core React Native, and adding a dependency for this was outside what's
authorized without a specific ask.

`ShortBasketPanel` wraps it with the live net preview (`reading − tare`),
bounded to `[tareG, tareG + stdNetG]`, and opens below the action row rather
than over the stage. Only "confirm" appends the `short` event; "cancel" writes
nothing.

## Acceptance criteria

- [x] The panel opens below the stage; the count is never covered.
- [x] Typing a reading updates the live net preview immediately.
- [x] ±0.5 kg buttons and the drag track both stay in sync with the typed
      field, and with each other.
- [x] Typed values are not snapped to the 0.5 kg step (F-22: an operator who
      knows the scale reads 43.2 kg can type exactly that).
- [x] Confirm appends `short { readingG, tareG }` and closes the panel; cancel
      closes it having appended nothing.
- [x] The logged event's net weight (`reading − tare`) is visible in the log.

## Offline / sync behavior

Same as every other write on this screen — goes through `useSale().append()`.
No network involvement.

## Test plan

- [x] `WeightInput.test.tsx`, 6 cases: kg formatting, unsnapped typed values,
      ± stepping, clamping to bounds, thumb position, and a **regression
      test** for the bug below.
- [x] `ShortBasketPanel.test.tsx`, 4 cases: live preview math, confirm fires
      without cancel, cancel fires without confirm, confirm disabled on a
      negative net.
- [x] `e2e/short-basket.spec.ts`, 4 cases: the panel never overlaps the count;
      typed input drives the preview; confirm/cancel write exactly what's
      expected (and nothing, respectively); ± buttons move the reading.

## Verification

- [x] `npm run verify` green: 46 core tests, 27 component tests (17 + 10 new),
      64 e2e (56 + 8 new: 4 short-basket, unchanged elsewhere), 6 skipped by
      device scoping.

## Dev notes

**A real bug, caught by the e2e suite, not invented for the test:** `commit()`
updated the parent (`onChange`) and its own "don't re-derive from my own
change" bookkeeping, but never called `setText`. Only the typed field's own
`onChangeText` handler happened to keep `text` in sync (it calls `setText`
directly before committing) — so pressing `+`, `−`, or dragging the track
silently moved the underlying value while the visible number never changed.
`e2e/short-basket.spec.ts`'s "plus and minus buttons move the reading" test
failed against the real exported build and caught it directly; a matching
regression test now pins the fix in `WeightInput.test.tsx` so it can't return
silently. Fixed by giving `commit()` a `fromText` flag: every caller updates
`prevValueG` (so the render-time re-sync doesn't fight them), but only
non-text callers also reformat `text` — reformatting on every keystroke would
strip a trailing "." while someone is mid-typing "43.".

**A second, unrelated bug surfaced while fixing the first**, this one from
`npm run lint`, not from a test: the original `WeightInput` used a `useRef` to
track "the value I last committed," written to and read from during render.
React Compiler (`reactCompiler: true` in `app.json`) forbids exactly that —
reading or writing a ref's `.current` during render, as opposed to in an event
handler or effect. Replaced with React's own sanctioned pattern for this
("adjust state during render": a second `useState` holding the last-seen
external value, compared against the current prop and conditionally
re-synced) — same effect, no ref, no lint error. The `PanResponder` instance
was also moved out of a `useRef` and is now created fresh each render, since
`PanResponder.create()` is a plain factory call rather than a hook and there
was no rules-of-hooks reason to cache it in a ref in the first place.

## Code review

- Reviewer (separate agent/session): **not yet run** — required before `Done`.

## QA notes

The drag track's touch handling (`PanResponder`) is exercised by component
tests only insofar as pressing ± moves the value; the drag gesture itself has
no dedicated e2e coverage (Playwright's synthetic pointer events don't map
cleanly onto RN's `PanResponder` gesture recognition on web). Worth a
follow-up if the drag track turns out to be unreliable on a real device.
