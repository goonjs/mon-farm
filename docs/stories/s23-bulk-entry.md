# Story: Bulk entry, for a pile nobody counted live

Status: **Review** — implemented 2026-09-03. Cannot reach `Done` without a
push to CI and an independent review, neither authorized.

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

- [x] "Bulk count" is offered on the Pile tab only for a pile whose status is
      `not-started` (mirrors `canReady`'s status check, without the
      zero/tare requirement — `canBulkEnter(state, pileId)` in
      `src/core/project.ts`). Not offered for `counting` or `closed` piles.
- [x] Choosing it opens the bulk form in place of `ZeroTareGate`/`HoldStage`
      — the pile is never routed through the gate.

**The form**

- [x] Two fields: basket count (integer, standard baskets) and leftover
      weight (kg, the same weight-input pattern used elsewhere — need not
      reuse `WeightInput`'s drag/± affordances, a typed decimal field is
      enough since there is no live scale to track).
- [x] A typed reason field is required. Confirm is disabled/blocked while it
      is empty or whitespace-only (mirrors `pile_reopened` and `void`'s bar).
- [x] Cancel closes the form and appends **nothing** — pile stays
      `not-started`, no events written.

**On confirm, in this order:**

- [x] One `sys` event, new payload `{ t: 'bulk_gate_skipped', pileId,
      reason }`, recording that the zero/tare gate was skipped and why.
- [x] *N* `accept` events (N = basket count), each `{ kind: 'accept',
      pileId, source: 'bulk', netG: pile.stdNetG, tareG: pile.tareG }` —
      snapshotting the pile's current standard net/tare exactly as a live
      `accept` does.
- [x] One `short` event `{ kind: 'short', pileId, readingG: pile.tareG +
      leftoverG, tareG: pile.tareG }` for the leftover — **only when
      leftover > 0**. A zero leftover writes no `short` event: it observed
      nothing, so recording one would be a phantom zero-weight entry.
- [x] When basket count is 0, no `accept` events are written (N = 0 is valid
      — an all-leftover pile).
- [x] One `sys` `pile_closed { pileId, forced: false }` event, closing the
      pile. A bulk-entered pile is a finished record, not a `counting` pile
      waiting for more baskets.
- [x] Basket count 0 **and** leftover 0 together is blocked at the form
      (nothing to enter) — confirm stays disabled, same as the empty-reason
      case.

**Distinguishable, unchanged elsewhere**

- [x] Log tab: `accept` events with `source: 'bulk'` render with a distinct
      label (new message id, not the plain `log.accept` string) so a reader
      can tell a bulk basket from a counted one without decoding the raw
      event. The `bulk_gate_skipped` sys event renders in the log with its
      reason, using the same pattern as `log.pileReopened`.
- [x] Pile tab / `ZonePileSwitcher`: a pile that has a `bulk_gate_skipped`
      event carries a visible "bulk" marker next to its status, distinct
      from an ordinarily-closed pile.
- [x] `pileTotals` / `zoneTotals` / `saleTotals` (`src/core/totals.ts`) are
      **unchanged** — they already sum every live `accept` and `short`
      regardless of `source`, so a bulk pile's basket count and leftover
      weight settle identically to the same numbers entered live. No code
      change required in `totals.ts`; the test plan proves it stays that
      way.

**Edge cases**

- [x] Zero leftover — see above (no `short` event).
- [x] Zero baskets — see above (no `accept` events).
- [x] Both zero — blocked at the form.
- [x] Reason left blank — blocked at the form.
- [x] Cancel — nothing logged, pile stays `not-started`.
- [x] A bulk-entered pile (now `closed`) is reopened via the existing
      `pile_reopened` flow (typed reason, S13) and then counted live: status
      returns to `counting`, `HoldStage` mounts (its own gate check is
      unaffected — `canCount` only checks `status === 'counting'`, an open
      zone, and an open sale, not `zeroChecked`/`tareConfirmed`), and further
      `accept` events append with `source: 'hold'` alongside the earlier
      `source: 'bulk'` ones in the same pile's log and totals.

## Offline / sync behavior

- [x] Feature is fully usable with no network connection (verified, not
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
- [x] Visibility: the multi-event append (sys skip + N accepts + optional
      short + pile_closed) either commits as one atomic append or, if the
      store only supports one event per `append()` call, the form disables
      itself and shows a pending/submitting state for the duration of the
      sequence so a mid-sequence crash is visible as "incomplete" rather
      than silently half-written. **Resolved: the first branch.** `append()`
      was one-event-per-call with a fire-and-forget per-event persist, so it
      could tear; the store and provider grew an all-or-nothing batch write
      instead of a pending state. Reasoning in Dev notes.
- [x] No data loss scenario identified during testing: an interrupted bulk
      submit (app killed mid-append) leaves the log in a state where the
      pile is either still `not-started` (nothing durable was appended) or
      fully closed with a consistent event set — never a pile with baskets
      but no `pile_closed`, and never a `pile_closed` with no baskets and no
      leftover when N and leftover were both > 0 on the form.

## Test plan

- [x] **vitest**, `src/core/project.test.ts`:
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
- [x] **vitest**, `src/core/totals.test.ts`:
  - `pileTotals` on a pile whose baskets are all `source: 'bulk'` accepts
    equals `pileTotals` on an equivalent pile counted with `source: 'hold'`
    accepts — same basket count, same `netG`. Proves the AC that totals are
    unchanged.
  - A bulk pile's `short` (leftover) contributes to `shortBaskets` /
    `shortNetG` exactly as a live short basket does.
  - Zero-leftover bulk pile (no `short` event written) has `shortBaskets:
    0` — confirms the "don't write a phantom zero" choice doesn't cost a
    totals special case.
- [x] **jest** (component), new `src/components/BulkEntryForm.test.tsx`:
  - Confirm disabled with an empty/whitespace-only reason.
  - Confirm disabled with baskets = 0 and leftover = 0.
  - Confirm enabled and reports the right `(baskets, leftoverG, reason)`
    tuple otherwise, including baskets = 0 with leftover > 0 and vice
    versa.
  - Cancel reports cancellation with no fields read.
- [x] **playwright**, new `e2e/bulk-entry.spec.ts`:
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

## New event-model surface (as built)

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
    in the Pile tab, and `pile.bulkStatus` (`{status} · …`) for the
    switcher's one-line row.
  - Not built: `bulk.cancel` (`common.cancel` already says it) and
    `bulk.pile` (the pile name lives in `bulk.title`). Built beyond the
    list: `bulk.summary` and `bulk.gateNote`. See Dev notes.

- **Store/provider**: `EventStore.appendAll(events)` (all-or-nothing, one
  `setItem` on web, one SQLite transaction on device) and
  `SaleProvider.appendMany(events)`, with `append(e)` reduced to
  `appendMany([e])`. This is the story's answer to the atomicity question the
  Offline section asks — see Dev notes.

## Verification

- [x] Sandbox run performed: the exported web build, driven in a real
      Chromium at both phone-landscape sizes (`npm run build:web` +
      `npm run test:e2e`), entering a pile in bulk end to end — form, log,
      Pile tab, switcher, reopen-and-count-live.
- [x] Full gate green from this working tree: `tokens:check`, `contrast`,
      `typecheck`, `lint`, `test:core` (98 core, +14 new), `test:ui` (63
      component, +8 new), `build:web`, `test:e2e` (**152 passed, 6 skipped**,
      up from 130/6 — the 22 added are this story's 11 cases across the two
      landscape projects).
- [x] Screenshots (UI stories only) — golden path:
      `screenshots/s23/00-pile-tab-bulk-offered.png`,
      `01-bulk-form-empty.png`, `02-bulk-form-filled.png` (+ `-floor`),
      `03-pile-closed-after-bulk.png`,
      `04-log-skip-bulk-baskets-leftover.png`,
      `05-pile-tab-bulk-badge-and-totals.png`.
- [x] Screenshots (UI stories only) — edge cases:
      `06-blocked-reason-required.png` (+ `-floor`),
      `07-blocked-nothing-to-enter.png`, `08-switcher-bulk-marker.png`,
      `09-reopened-bulk-and-live-in-one-log.png`.

## Dev notes

### The two calls the PO left open

**1. A bulk-entered pile auto-closes (`pile_closed { forced: false }`), as
proposed.** Decided from the code, not from taste:

- `canOfferCloseSale(state)` in `counter.tsx` (S25) withholds close-sale
  while *any* pile anywhere is `counting`. A bulk pile left `counting` would
  therefore hold the whole sale open until somebody remembered to close a
  pile they had already finished entering — a pile nobody is standing at.
  That is the S25 shape working exactly as intended against a pile that is
  not actually in progress.
- The leftover is written as the pile's last basket. Adding live baskets
  *after* a recorded remainder would put the log in an order that does not
  describe anything that happened.
- Staying `counting` buys nothing that reopening does not already buy.
  `canReopenPile` + the S13 typed-reason prompt is one screen away, and it
  leaves the reason for the extra baskets on the record — which is strictly
  more honest than silently appending to a pile the app never closed. The
  e2e case `a reopened bulk pile counts live...` walks exactly that path.
- The form says so before the fact: `bulk.summary` ends "…แล้วปิดกองนี้", so
  the close is not sprung on the operator by two number fields.

**2. Yes, the multi-event append had to become atomic — and this story made
it so.** `SaleProvider.append()` as it stood took ONE `NewEvent`, stamped it
inside a `setEvents` updater, and persisted with a fire-and-forget
`void store.append(event)`. Calling it N times in a row is safe for
sequencing (functional updates chain), but not for durability: each event is
its own storage write, so a force quit part-way through a 200-basket bulk
entry persists a PREFIX — a gate-skip plus k baskets, no `pile_closed`. That
projects to a pile reading `not-started` while carrying baskets and weight in
`pileTotals`, i.e. money in the settlement with nothing in the log saying
where it came from, and an operator whose natural response is to enter the
pile again. That is not hypothetical enough to YAGNI away, and this story's
own offline AC ("never a pile with baskets but no `pile_closed`") cannot be
met without it.

The AC's fallback (disable the form and show a pending state) was rejected:
it makes a torn write *visible* without making it *impossible*, and the
storage tier is where atomicity actually lives.

What was added is deliberately the smallest thing that gives the guarantee:

- `EventStore.appendAll(events)` on the port — all-or-nothing, rejecting the
  whole batch on any duplicate `(saleId, seq)`. Web: one `setItem` of the
  whole log, so there is no window to be half-written. Native: one
  `withTransactionAsync`. Memory: validate every seq before writing any.
- `SaleProvider.appendMany(events)` stamps a batch under one `ts`/`mono` and
  one clock-anomaly check, and hands the batch to `appendAll`. `append(e)` is
  now `appendMany([e])` — one write path, not two stamping paths that can
  drift (the file's own header rule).

No other caller changed behaviour: a single append is a batch of one, and
`store.append` stays the port's primitive.

### Other notes and deviations

- **`bulk.cancel` was not added.** `common.cancel` already exists and is the
  same word on every other cancel in the app; a duplicate id would be a
  second string to keep in step for no gain.
- **`bulk.summary`, `bulk.gateNote`, `bulk.title`'s `{name}` were added**
  beyond the proposed list. The summary is what tells the operator the pile
  will close; the gate note says the zero/tare check is being *skipped*
  rather than passed, before the fact as well as in the log. Both are one
  entry with placeholders — no call-site concatenation.
- **`bulk.pile` was proposed-and-dropped**: `'กอง {name}'` rendered as
  "กอง กอง 1". The pile name is in `bulk.title` instead.
- **No `notStartedPileScenario` fixture.** `unreadyPileScenario` already is
  exactly that (a pile with no zero check, no tare, no ready) and is used
  here; adding a second identical fixture would be duplication. Two new
  fixtures that did not exist were added: `closedPileScenario` (the status
  bulk entry must not be offered on) and `bulkParityScenario` (กอง 2 counted
  live with the same 12 baskets + 8.4 kg the bulk entry writes into กอง 1,
  which is what makes the parity test a comparison rather than an
  assertion).
- **Settlement parity is proven at the Pile tab, not the settlement screen.**
  Settlement renders per-zone rows, and both piles in the parity fixture are
  in zone A, so a per-zone total could not tell them apart. The e2e case
  compares `pile-weight-breakdown` for the bulk pile and the live pile
  directly — a strictly tighter check of the same AC. `totals.ts` is
  untouched, with three vitest cases pinning that it stays that way.
- **`BulkEntryForm` is two columns.** Stacked, the three fields plus the
  summary and the buttons overflowed 390px of landscape height and put the
  confirm button below the fold (first screenshot pass caught it). Both
  landscape sizes are now shot as evidence, including the 740×360 floor.
- **`ZonePileSwitcher` gained a required `bulkPileIds` prop** rather than an
  optional one: a marker that silently does not appear because a caller
  forgot a prop is the failure this repo's typed `STATUS_LABEL` map already
  guards against elsewhere. Its existing test was updated to pass it.
- **The counter screen's `describe()` now branches on `AcceptEvent.source`.**
  That field existed and nothing read it before; `log.acceptBulk` is the
  first thing that does, which is the point of the field.

### TDD trail

Every criterion had its failing test first:

- `canBulkEnter` + the projection cases: 3 red under vitest
  (`canBulkEnter is not a function`), 12 red under `tsc` (`bulk_gate_skipped`
  not in `SysPayload`, `accept()` taking a fourth argument) before
  `project.ts`/`types.ts`/`fixtures.ts` were touched.
- `store.test.ts`: 3 red (`store.appendAll is not a function`) before the
  port grew the method.
- `BulkEntryForm.test.tsx`: red at module resolution before the component
  existed.
- `ZonePileSwitcher`'s marker case: red against the un-marked switcher
  (verified by reverting the marker line, running, restoring).
- `e2e/bulk-entry.spec.ts`: written against testIDs nothing rendered yet.

## Code review

- Reviewer (separate agent/session):
- Findings:
- Resolution:

## QA notes
