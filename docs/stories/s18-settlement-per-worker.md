# Story: Settlement — per-worker payout view

Status: **Review** — implemented 2026-08-11. Cannot reach `Done` without a
push to CI and an independent review, neither authorized.

## Context

- Epic: `docs/epics/e05-reconciliation-settlement.md`
- Related PRD section(s): FR-7.4, FR-8.6
- Design reference: `docs/ux/mvp-screens.html` screen 7 (predates per-zone
  contracts; this story is the refresh referenced in its own fixture
  comment, `src/core/fixtures.ts`)
- Depends on: S15 (`Settlement.perWorker`, grouped by `personId` and already
  computed and tested in `src/core/settle.ts` / `settle.test.ts` — nothing in
  the core model changed here)

## Description

Since S15, `settle()` has returned `perWorker`: each named worker's total
across every zone that pays them, grouped by `personId`. The settlement
screen never showed it — the per-zone card shows each zone's own worker row,
but a worker paid out of two zones had no single place to see what they
actually get in total. "What did zone A make" and "what do I get" are
different questions once a worker isn't confined to one zone, and only the
per-zone card answered the first one.

This adds a "แยกตามคนงาน · per worker" card next to the per-zone card: one
row per named worker, their combined total across every zone naming them,
and which zones those are. Zones that fell back to the sale-level default (no
worker named) contribute nothing here — `perWorker` already excludes them,
since there's no one to attribute that money to — so the card shows an
explicit "no worker named yet" note rather than silently being empty.

## Acceptance criteria

- [x] A card labelled "แยกตามคนงาน · per worker" appears beside the per-zone
      card on the settlement screen.
- [x] Each row shows the worker's name, their combined satang total across
      every zone that names them, and the names of those zones.
- [x] A worker named in two zones gets exactly one row, with both zone names
      and a total equal to the sum across both zones — not two separate
      rows.
- [x] When no zone has named a worker (every zone used the sale-level
      default), the card shows an explicit note instead of an empty list.

## Offline / sync behavior

No change — this is a read-only view over the same `events`/`state` every
other screen derives from. No writes, no network involvement.

## Test plan

- [x] `e2e/settlement.spec.ts`, 2 new cases (5 total in the file):
      `workedExample()`'s two single-zone workers each get a row matching
      their zone's own worker share; a new inline fixture (two
      `zone_contract_set` events naming the same `personId` in different
      zones, matching `settle.test.ts`'s "two zones paid to the same person
      are grouped" case) gets exactly one row naming both zones, with a
      total hand-checked against gross × split.

## Verification

- [x] Full verification run green: `tsc --noEmit`, `eslint .`, 46 core
      (vitest) tests, 38 component (jest) tests (unchanged — this story adds
      no new component), `expo export --platform web`, and the full
      Playwright suite — 80 passed, 6 skipped by device scoping, 0 failed.

## Dev notes

No core model or new-component changes. `Settlement.perWorker` was already
correct and already tested to the satang from S15 — this story is UI-only:
giving that already-computed array somewhere to render. Zone names for each
worker's row are looked up from `s.perZone` (already resolved zone names by
id) rather than `state.zones` directly, since `perZone` is the value already
in scope and already carries the name.

## Code review

- Reviewer (separate agent/session): **not yet run** — required before `Done`.

## QA notes

No dedicated screenshot for this card yet — the existing `settlement.png`
screenshot (from `workedExample()`, one worker per zone) does exercise it
visually, but the "same worker, two zones" combined-row case has no visual
artifact, only the e2e assertions above.
