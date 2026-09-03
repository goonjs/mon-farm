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

### Independent QA re-run (separate agent, 2026-09-03, at HEAD `03cb18d`)

Every gate below was re-run from a clean working tree, not taken on trust.

- [x] `tokens:check`, `contrast`, `typecheck`, `lint` — all green.
- [x] `test:core` — **98 passed** (8 files).
- [x] `test:ui` — **64 passed** (11 suites). The story's "63" was true at
      `7434408`; `03cb18d` added one.
- [x] `build:web` — exported clean.
- [x] `test:e2e` — **156 passed, 6 skipped**. The story's "152 passed" was
      true at `7434408`; `03cb18d` (S25) added four.
- [x] **Screenshots proven genuine.** The e2e re-run rewrote all twelve
      committed S23 screenshots and `git status` came back clean — they
      reproduce byte-for-byte from a real browser run.
- [x] **TDD (fail-first) verified in a throwaway clone** at `7434408^` with
      only this story's *test* files checked out forward:
      - vitest: **6 failed / 92 passed** — `canBulkEnter is not a function`
        (3 in `project.test.ts`), `store.appendAll is not a function` (3 in
        `store.test.ts`).
      - `tsc`: **23 errors** — `bulk_gate_skipped` absent from `SysPayload`,
        `accept()` taking a 4th argument, `bulkPileIds` not on
        `ZonePileSwitcherProps`, `appendAll` not on `MemoryStore`.
      - jest: **2 suites failed** — `BulkEntryForm.test.tsx` (module does not
        resolve) and `ZonePileSwitcher`'s marker case (`Received: กอง 2 ·
        ยังไม่เริ่ม`).
      - Caveat: the four `totals.test.ts` parity cases are red under `tsc`
        only. At runtime the 4th `source` argument is ignored at the parent
        commit, so they pass — inherent to a test whose point is that totals
        *ignore* `source`, but worth stating plainly.

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

- **Reviewer**: separate QA/reviewer agent/session, 2026-09-03, reviewing
  `7434408` at HEAD `03cb18d` against
  `docs/checklists/code-review-checklist.md` and
  `docs/checklists/definition-of-done.md`.
- **Outcome: approved.** Every acceptance criterion above was verified
  independently — by reading the diff, by re-running the whole gate, and by
  driving the exported web build in a real Chromium and reading the persisted
  event log back out of `localStorage`. No defect was found that warranted a
  fix in this pass. Six findings are recorded below, all minor or
  pre-existing; none is a blocker and none was fixed here.

### The two risky claims, checked directly

**1. The append really is atomic on web.** Not taken from the comment:
`Storage.prototype.setItem` was wrapped from the page's first script and the
calls counted across one confirm of **40 baskets + leftover** (43 events).
Result: **exactly one** `setItem` on `mon-farm:events:<saleId>`, 8,620 bytes,
and all 43 events present afterwards. There is no window in which half the
batch is stored, so no torn write. Reading the code confirms why: `appendAll`
on `WebStore` reads the log, validates every `seq` in the batch *before*
writing, and writes the whole array in one call; `SaleProvider.appendMany`
computes the batch inside the `setEvents` updater and calls `appendAll`
synchronously (the method has no `await` before its write), so concurrent
appends cannot interleave.

**`append(e)` via `appendAll([e])` is unchanged.** Verified three ways: seq
assignment in the diff is arithmetically identical (old: flag gets `seq`, the
event gets `last.seq + 1`; new: `seq++` twice), `ts`/`mono`/`actor` stamping
is the same expression, and in the browser three live-counted baskets
produced six events (`accept` + `announced` each) in **six separate writes** —
one per `append`, exactly as before. The whole 156-test e2e suite, which is
almost entirely single-append flows, is green.

The one real behaviour change on the single-event path is an improvement: a
clock anomaly and the event it flags used to be two `store.append` calls and
are now one `appendAll`.

**2. A bulk pile is honestly distinguishable.** All three markers are in the
*persisted* log, read back out of `localStorage` rather than off the screen:
`sys:bulk_gate_skipped` carrying `{pileId, reason}` as the batch's first
event, twelve `accept` events each with `source: 'bulk'` and the pile's
snapshotted `netG: 50000 / tareG: 2000`, and `sys:pile_closed {forced:
false}` last. The reason cannot be bypassed: confirm is `aria-disabled` with
a blank reason *and* with a whitespace-only one, and a **forced** click on it
wrote zero events both times. The Log tab renders `เข่งมาตรฐาน 50 กก.
(กรอกย้อนหลัง)` for a bulk basket versus the plain string for a live one, and
the skip as `ข้ามเช็คศูนย์/ตะกร้า — กรอกทั้งกอง — <reason>`; the Pile tab
shows `pile-bulk-badge`; the switcher row reads `กอง 1 · ปิดแล้ว ·
กรอกย้อนหลัง` while an ordinarily-closed pile does not.

### Findings (all minor; none fixed in this pass)

1. **`WebStore.appendAll` and `SqliteStore.appendAll` have no unit test.**
   `store.test.ts` covers `MemoryStore` only, so the two implementations that
   actually ship — the single `setItem` and the SQLite transaction — are
   proven by comment and, on web, by this QA pass's instrumented browser run.
   The native transaction is not exercised anywhere. Recommend a `WebStore`
   test against a fake `localStorage`; the native one is a standing gap in
   this repo, not this story's.
2. **`WebStore.appendAll` assumes a single-sale batch.** It keys off
   `events[0].saleId` for both the log key and the duplicate scan, so a
   mixed-sale batch would be written to the wrong key and mis-validated. No
   caller can produce one today (`appendMany` stamps one `saleId`), so this is
   an undefended invariant rather than a live bug — but the port's contract
   does not say batches are single-sale.
3. **A store write failure is still invisible.** `void store.appendAll(batch)`
   has no `.catch`, and React state is updated regardless. If the write
   rejects (`DuplicateSeqError`) or `write()` swallows a quota error, the UI
   shows a completed bulk entry that a reload has lost, silently. Pre-existing
   and deliberate ("a storage failure must never block counting"), unchanged
   in kind by this story — but S23 raises the stakes, since one lost write is
   now a whole pile.
4. **The side effect still lives inside a `setEvents` updater.** Pre-existing.
   Nothing enables StrictMode today, so the double-invoke hazard is dormant;
   if it is ever turned on, every batch would be persisted twice and the
   second `appendAll` would reject unhandled.
5. **No cap on the basket count.** `parseBaskets` accepts any integer, so a
   fat-fingered `99999` writes ~100k events in one batch. YAGNI-acceptable,
   and the summary line states the number before confirm; noting it because
   the Dev notes reason about a "200-basket bulk entry" as the large case.
6. **`bulkPileId` is not cleared when the operator switches pile.** Switching
   away correctly shows the other pile its own gate, but switching *back*
   re-opens the bulk form (with the fields cleared) instead of the gate. No
   events are involved and nothing is lost; cosmetic.

### Checklist verdict

- Correctness — diff implements the ACs (read against the story, not just the
  diff); TDD proven fail-first; edge cases covered, not just the golden path;
  offline behaviour exercised for real, not asserted.
- Verification — sandbox run confirms the feature; screenshots are genuine
  (they regenerate byte-identically).
- Quality — no speculative code; `appendAll` is the smallest thing that buys
  the guarantee the story's own offline AC demands; no unrelated refactor
  bundled in; commit subject is 45 chars, imperative, with the *why* in the
  body.
- Docs — story updated live, with deviations explained. Two stale numbers
  corrected above (`test:ui` 63→64, `test:e2e` 152→156), both caused by the
  later commit `03cb18d`, not by an inaccurate claim at the time.

## QA notes

**Independent QA, 2026-09-03** — separate agent/session from the implementer.
Nothing below is taken from the dev's claims; each line was observed.

### The real-browser walk

Driven with `playwright-core` against the exported build
(`npm run build:web` + `node scripts/serve-dist.mjs`) in the sandbox's real
Chromium at **844×390**, with the form and a full confirm re-checked at the
**740×360** floor. The sale was **built through the UI** (new sale → price →
zone → four piles → start counting), not seeded, and every event assertion
reads `localStorage` directly rather than trusting the screen.

**46 checks, 44 passed; the two "failures" were wrong expectations in the QA
script, not app defects** (the pile count badge legitimately reads 14 for
12 bulk + 1 short + 1 live, and the log tab is sale-wide so it legitimately
showed 15 bulk-labelled lines across two bulk piles, not 12).

Per acceptance criterion:

| AC | Result |
| --- | --- |
| Bulk count offered only on `not-started` | **Pass** — offered on the fresh pile; absent (`count() === 0`) on a `counting` pile and on a `closed` one |
| Opens in place of the gate | **Pass** — `bulk-entry-form` replaces `zero-tare-gate`; the pile is never routed through it |
| Two fields + required typed reason | **Pass** — blank reason and whitespace-only reason both leave confirm `aria-disabled`, both show `bulk-reason-error`, and a **forced** click on the disabled confirm wrote **0 events** in each case |
| Both zero blocked | **Pass** — `bulk-empty-error` shown, confirm disabled |
| Cancel appends nothing | **Pass** — event count unchanged (7 → 7), pile still `not-started`, gate back on screen, bulk still offered |
| Confirm writes the exact sequence, in order | **Pass** — 12 baskets + 8.4 kg wrote exactly **15** events: `sys:bulk_gate_skipped`, 12 × `accept{source:'bulk', netG:50000, tareG:2000}`, `short{readingG:10400, tareG:2000}`, `sys:pile_closed{forced:false}`. Seqs contiguous; all 15 share one `ts` |
| Leftover → one `short`; zero leftover → none | **Pass** — the 3-basket / 0-leftover pile wrote `skip, accept×3, pile_closed` and no `short` |
| Zero baskets → no `accept` | **Pass** — the 0-basket / 20 kg pile wrote `skip, short, pile_closed` |
| Pile ends closed | **Pass** — `pile-closed-transition` in every confirm |
| Log tab distinguishes bulk | **Pass** — 12 lines reading `เข่งมาตรฐาน 50 กก. (กรอกย้อนหลัง)`, plus the skip line carrying the typed reason verbatim |
| Pile tab / switcher marker | **Pass** — `pile-bulk-badge` visible; switcher row `กอง 1 · ปิดแล้ว · กรอกย้อนหลัง` vs `กอง 2 · ยังไม่เริ่ม` |
| Totals unchanged | **Pass** — a bulk pile and a **live-counted** pile with the same 12 baskets and the same 8.4 kg leftover (counted live through the gate, twelve real press-and-holds and a short-basket entry) both read `600 + 8.4 = 608.4 กก.`, and their summed net grams are equal (608,400 = 608,400) |
| Reopen and count live | **Pass** — the reopened bulk pile mounts the stage with no gate, one live hold lands, and the pile's log then holds **12 `source:'bulk'` and 1 `source:'hold'`** accepts side by side; totals move to `650 + 8.4 = 658.4 กก.`; the bulk badge stays |
| Landscape floor | **Pass** — at 740×360 the confirm button is fully above the fold (y+h = 348 ≤ 360) and a full bulk entry completes |

### Beyond the ACs

- **Atomicity, measured:** one 43-event confirm = **one** `localStorage.setItem`
  (instrumented). Single appends still write once each.
- **Offline, exercised not assumed:** with the browser context set offline, a
  full bulk entry (5 baskets + 3.2 kg) wrote all 8 events locally and, back
  online, survived a reload with its badge intact. (Reloading *while* offline
  fails to fetch the app shell — there is no service worker. Out of S23's
  scope, but it means "offline-first" today covers the write path, not a cold
  start with no network.)
- **Double-press:** two mouse-downs on confirm in the same gesture wrote one
  bulk entry, not two.

### QA screenshots

Added alongside the dev's twelve, under `screenshots/s23/`, all `qa-`
prefixed so nothing of theirs is overwritten:

- `qa-01-pile-tab-bulk-offered.png` — bulk count offered on a `not-started` pile
- `qa-02-blank-reason-blocks.png` — confirm blocked, reason-required message
- `qa-03-both-zero-blocks.png` — nothing-to-enter blocked
- `qa-04-form-filled-844x390.png` — the filled form, summary and gate note
- `qa-05-pile-closed-after-bulk.png` — the pile closed by the confirm
- `qa-06-log-bulk-and-skip.png` — bulk-labelled baskets and the leftover line
- `qa-07-pile-tab-bulk-badge.png` — the Pile tab badge and totals
- `qa-08-switcher-bulk-marker.png` — the switcher's bulk marker
- `qa-09-live-pile-parity.png` — the live-counted pile with identical figures
- `qa-10-reopened-bulk-plus-live-log.png` — both sources in one pile's log
- `qa-11-mixed-pile-tab.png` — the mixed pile's totals, badge retained
- `qa-12-form-740x360-floor.png` — the form at the landscape floor
- `qa-13-closed-740x360-floor.png` — a completed bulk entry at the floor
- `qa-14-offline-bulk-entry.png` — a bulk entry made with the network off
- `qa-15-offline-reload-persisted.png` — that entry after a reload

### What QA could NOT verify

- **The native (expo-sqlite) atomicity path.** `SqliteStore.appendAll`'s
  `withTransactionAsync` was read, not run — there is no device or emulator in
  this sandbox and no test covers it. The all-or-nothing guarantee is proven
  on web and in `MemoryStore` only.
- **A genuine crash mid-write.** The "force quit part-way through" scenario
  was reasoned about and the single-`setItem` shape measured; the process was
  never actually killed mid-append.
- **CI.** Nothing has been pushed, so the DoD's "pushed, CI green" line is
  still open — as the story's own status says.
