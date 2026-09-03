# Story: Bulk entry, for a pile nobody counted live

Status: **Ready** — 2026-09-03

## Context

- Epic: `docs/epics/epic-2-second-field-round.md`, section "S23 — Bulk entry,
  for a pile nobody counted live"
- Related PRD section(s): FR-5 (basket recording), FR-8 (settlement — no
  change required)
- Depends on: S9 (zero/tare gate — this story adds the one deliberate way to
  skip it), S11 (`short` event — this story is its second writer)

## Description

Today every pile reaches its baskets through `ZeroTareGate` → `HoldStage`: a
scale reading is checked, a tare is confirmed, and each basket is counted as
it happens. That assumes the app was running before the first basket. It was
not always: someone arrives mid-count, or a day is worked without the app and
the numbers are entered afterward, once, from a tally the person already has
in hand — a basket count and a leftover weight, nothing that was watched
being produced.

This story adds a second entry point onto a **`not-started`** pile: **bulk
count**, a two-field form (basket count, leftover weight) with a required
typed reason, offered instead of the zero/tare gate. Confirming it writes
the baskets, the leftover, and a record that the gate was skipped and why,
then closes the pile — a bulk-entered pile is a completed record, not one
left open for the counter to add to. It can be reopened afterward like any
closed pile (S13), at which point it behaves exactly like any reopened pile:
back in `counting`, gate already skipped, further baskets (via the ordinary
counter, `source: 'hold'`) landing in the same log next to the bulk ones.

Whole baskets stay whole baskets and price exactly as counted ones do,
distinguished only by `source`. The leftover is recorded as a weight via the
existing `short` event — inventing a basket count from `total ÷ standard net`
would produce a number nobody actually counted and still leave a remainder
to explain; this way nothing is rounded and nothing is invented.

## Acceptance criteria

**Entry point**

- [ ] "Bulk count" is offered on the Pile tab only for a pile whose status is
      `not-started` (mirrors `canReady`'s status check, without the
      zero/tare requirement — `canBulkEnter(state, pileId)` in
      `src/core/project.ts`). Not offered for `counting` or `closed` piles.
- [ ] Choosing it opens the bulk form in place of `ZeroTareGate`/`HoldStage`
      — the pile is never routed through the gate.

**The form**

- [ ] Two fields: basket count (integer, standard baskets) and leftover
      weight (kg, the same weight-input pattern used elsewhere — need not
      reuse `WeightInput`'s drag/± affordances, a typed decimal field is
      enough since there is no live scale to track).
- [ ] A typed reason field is required. Confirm is disabled/blocked while it
      is empty or whitespace-only (mirrors `pile_reopened` and `void`'s bar).
- [ ] Cancel closes the form and appends **nothing** — pile stays
      `not-started`, no events written.

**On confirm, in this order:**

- [ ] One `sys` event, new payload `{ t: 'bulk_gate_skipped', pileId,
      reason }`, recording that the zero/tare gate was skipped and why.
- [ ] *N* `accept` events (N = basket count), each `{ kind: 'accept',
      pileId, source: 'bulk', netG: pile.stdNetG, tareG: pile.tareG }` —
      snapshotting the pile's current standard net/tare exactly as a live
      `accept` does.
- [ ] One `short` event `{ kind: 'short', pileId, readingG: pile.tareG +
      leftoverG, tareG: pile.tareG }` for the leftover — **only when
      leftover > 0**. A zero leftover writes no `short` event: it observed
      nothing, so recording one would be a phantom zero-weight entry.
- [ ] When basket count is 0, no `accept` events are written (N = 0 is valid
      — an all-leftover pile).
- [ ] One `sys` `pile_closed { pileId, forced: false }` event, closing the
      pile. A bulk-entered pile is a finished record, not a `counting` pile
      waiting for more baskets.
- [ ] Basket count 0 **and** leftover 0 together is blocked at the form
      (nothing to enter) — confirm stays disabled, same as the empty-reason
      case.

**Distinguishable, unchanged elsewhere**

- [ ] Log tab: `accept` events with `source: 'bulk'` render with a distinct
      label (new message id, not the plain `log.accept` string) so a reader
      can tell a bulk basket from a counted one without decoding the raw
      event. The `bulk_gate_skipped` sys event renders in the log with its
      reason, using the same pattern as `log.pileReopened`.
- [ ] Pile tab / `ZonePileSwitcher`: a pile that has a `bulk_gate_skipped`
      event carries a visible "bulk" marker next to its status, distinct
      from an ordinarily-closed pile.
- [ ] `pileTotals` / `zoneTotals` / `saleTotals` (`src/core/totals.ts`) are
      **unchanged** — they already sum every live `accept` and `short`
      regardless of `source`, so a bulk pile's basket count and leftover
      weight settle identically to the same numbers entered live. No code
      change required in `totals.ts`; the test plan proves it stays that
      way.

**Edge cases**

- [ ] Zero leftover — see above (no `short` event).
- [ ] Zero baskets — see above (no `accept` events).
- [ ] Both zero — blocked at the form.
- [ ] Reason left blank — blocked at the form.
- [ ] Cancel — nothing logged, pile stays `not-started`.
- [ ] A bulk-entered pile (now `closed`) is reopened via the existing
      `pile_reopened` flow (typed reason, S13) and then counted live: status
      returns to `counting`, `HoldStage` mounts (its own gate check is
      unaffected — `canCount` only checks `status === 'counting'`, an open
      zone, and an open sale, not `zeroChecked`/`tareConfirmed`), and further
      `accept` events append with `source: 'hold'` alongside the earlier
      `source: 'bulk'` ones in the same pile's log and totals.

## Offline / sync behavior

- [ ] Feature is fully usable with no network connection (verified, not
      assumed) — the bulk form's confirm action is a set of appends through
      the existing `useSale().append()` path (`src/store/SaleProvider.tsx`),
      identical in kind to every other write on this screen: local event
      log first (expo-sqlite on device, localStorage on web), nothing
      network-shaped in the write path itself.
- [x] N/A — Local writes made while offline are queued/persisted correctly:
      no new persistence mechanism. Same append path as every existing
      event kind; covered by the existing store tests, not re-tested here.
- [x] N/A — Sync triggers on reconnect / manual sync: no backend yet
      (per `CLAUDE.md`); this story adds event *kinds*, not a sync path.
- [x] N/A — Conflict resolution: single-device local log, no concurrent
      writers to reconcile.
- [x] N/A — Partial/failed sync: no sync exists yet to fail partially.
- [ ] Visibility: the multi-event append (sys skip + N accepts + optional
      short + pile_closed) either commits as one atomic append or, if the
      store only supports one event per `append()` call, the form disables
      itself and shows a pending/submitting state for the duration of the
      sequence so a mid-sequence crash is visible as "incomplete" rather
      than silently half-written. Confirm which `append()` shape
      `SaleProvider` actually offers before implementing (see Dev notes
      below) — this determines whether extra defensive code is needed here
      or is already handled upstream.
- [ ] No data loss scenario identified during testing: an interrupted bulk
      submit (app killed mid-append) leaves the log in a state where the
      pile is either still `not-started` (nothing durable was appended) or
      fully closed with a consistent event set — never a pile with baskets
      but no `pile_closed`, and never a `pile_closed` with no baskets and no
      leftover when N and leftover were both > 0 on the form.

## Test plan

- [ ] **vitest**, `src/core/project.test.ts`:
  - `canBulkEnter` true only for a `not-started` pile in an open zone/sale;
    false for `counting`/`closed`, and false once the sale or zone is
    closed (mirrors the existing `canReady`/`canCount` guard tests).
  - Projecting a `bulk_gate_skipped` event changes no `Pile`/`Zone` field
    other than being present in the event list read back for the Log tab
    (it carries no projected-state flag of its own — the marker in the UI
    is "does this pile have one of these events", derived at render time).
  - Projecting `N` bulk `accept`s + one `short` + `pile_closed` leaves the
    pile `closed`, `locked: true`, same as any other pile closed after
    baskets.
- [ ] **vitest**, `src/core/totals.test.ts`:
  - `pileTotals` on a pile whose baskets are all `source: 'bulk'` accepts
    equals `pileTotals` on an equivalent pile counted with `source: 'hold'`
    accepts — same basket count, same `netG`. Proves the AC that totals are
    unchanged.
  - A bulk pile's `short` (leftover) contributes to `shortBaskets` /
    `shortNetG` exactly as a live short basket does.
  - Zero-leftover bulk pile (no `short` event written) has `shortBaskets:
    0` — confirms the "don't write a phantom zero" choice doesn't cost a
    totals special case.
- [ ] **jest** (component), new `src/components/BulkEntryForm.test.tsx`:
  - Confirm disabled with an empty/whitespace-only reason.
  - Confirm disabled with baskets = 0 and leftover = 0.
  - Confirm enabled and reports the right `(baskets, leftoverG, reason)`
    tuple otherwise, including baskets = 0 with leftover > 0 and vice
    versa.
  - Cancel reports cancellation with no fields read.
- [ ] **playwright**, new `e2e/bulk-entry.spec.ts`:
  - "Bulk count" is offered on a `not-started` pile and not on a `counting`
    or `closed` one (use a dedicated `notStartedPileScenario`-style fixture
    in `e2e/fixtures.ts`, alongside the existing `unreadyPileScenario` /
    `openPileScenario`).
  - Submitting typical values (e.g. 12 baskets, 8.4 kg leftover, a typed
    reason) closes the pile and the Log tab shows: the gate-skip line with
    the typed reason, 12 bulk-labelled accept lines, one short line for
    8.4 kg.
  - Submitting with the reason left blank is blocked — no navigation, no
    events, confirm stays disabled/inert.
  - Cancel returns to the Pile tab with the pile still `not-started` and no
    new lines in the Log tab.
  - Zero-leftover submit writes no short line; zero-basket submit writes no
    accept lines; both-zero is blocked before confirm.
  - Settlement totals for a sale with one bulk pile and one live-counted
    pile carrying the same numbers match between the two piles.
  - Reopen the bulk-closed pile, count one basket live via the ordinary
    stage, and see both a `source: 'bulk'`-labelled line and a
    plain-labelled live line in the same pile's log.

## New event-model surface (proposed)

- `AcceptEvent.source` widens from `'hold' | 'hold-kbd'` to `'hold' |
  'hold-kbd' | 'bulk'` in `src/core/types.ts` (and the matching literal in
  `src/store/SaleProvider.tsx`'s append-payload union).
- New `SysPayload` variant: `{ t: 'bulk_gate_skipped'; pileId: PileId;
  reason: string }`.
- New message ids (`src/i18n/messages.ts`, both `th` and `en`):
  - `pile.bulkCount` — the entry-point button label.
  - `bulk.title`, `bulk.basketsLabel`, `bulk.leftoverLabel`,
    `bulk.reasonLabel`, `bulk.reasonPlaceholder`, `bulk.confirm`,
    `bulk.cancel` — the form.
  - `bulk.reasonRequired`, `bulk.emptyError` — validation copy for the two
    blocked states, if the form surfaces inline text rather than relying on
    a disabled button alone.
  - `log.acceptBulk` — the distinct Log-tab label for a `source: 'bulk'`
    accept (parallel to `log.accept`, taking the same `{ weight }`).
  - `log.bulkGateSkipped` — the Log-tab line for the `bulk_gate_skipped`
    sys event (parallel to `log.pileReopened`, taking `{ reason }`).
  - `pile.bulkBadge` — the marker shown next to a bulk-entered pile's status
    in the Pile tab / `ZonePileSwitcher`.

## Verification

- [ ] Sandbox run performed:
- [ ] Screenshots (UI stories only) — golden path:
- [ ] Screenshots (UI stories only) — edge cases:

## Dev notes

## Code review

- Reviewer (separate agent/session):
- Findings:
- Resolution:

## QA notes
