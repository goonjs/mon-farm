# Story: Worker deductions, off each worker's own share

Status: Ready — acceptance criteria agreed with the owner 2026-09-03,
alongside the three design decisions recorded under "Decisions" below.

## Context

- Epic: `docs/epics/epic-2-second-field-round.md` (item 8, S29)
- Related PRD section(s): FR-7.3 (adjustments record amount, reason and who
  agreed them), FR-7.4 (the full derivation, step by step), FR-8.1–8.5 (the
  owner/worker split and its basis), FR-12 (the log is the record)
- Related architecture section(s): the event log and projection; the units
  contract at the head of `src/core/types.ts` — weights are integer grams,
  money is integer satang, rounding only at the presentation boundary

## Description

ค่าปุ๋ย and other expenses are deducted from what a worker is paid. Today the
app cannot record that at all: the settlement is a pure function of counts and
one price, which is exactly why epic 1 excluded adjustments —

> The settlement is a pure function of counts and one price. Adjustments make
> it a function of counts, price, and an editable list, which changes the
> audit story.

That reason is still true, and this story is designed against it rather than
around it. A deduction is money leaving a worker's share, so it gets the same
treatment the rest of the money chain gets: recorded as an event carrying an
amount, a reason and who agreed it; shown as its own line in the derivation;
voided with a reason rather than edited; and never silently folded into a
total.

**Deductions come off after the split** (owner's decision, 2026-08-11). Each
zone's gross is split first, then each worker's own deductions come off their
own share:

```
share      = Σ (that worker's zones' workerSatang)
deductions = Σ (that worker's live deduction events)
payout     = share − deductions
```

The sale's gross, the owner's total and every zone row are untouched by a
deduction. It moves money between the two parties to the contract and nowhere
else. Keeping that visibly true is what stops a deduction from reading like a
weighing error — which is the failure mode epic 1's exclusion was actually
protecting against.

## Decisions

**1. `basis` stays inert, and the epic's claim about it was wrong** (owner,
2026-09-03). `split_set` carries `basis: 'gross' | 'final'` (FR-8.4), and the
epic said it "stops being inert once deductions exist". It does not. Because
deductions come off *after* the split, `settle()` always splits on gross —
there is no arithmetic for `'final'` to select. The field keeps its current
behaviour, which is none, and the reason is recorded in `types.ts` next to it
so the next person does not re-derive this.

A consequence worth stating rather than burying: FR-8.5 requires every
contract to record a basis explicitly, and the setup screen still forces the
choice. Under this design that is a question with no consequence. It is left
standing — removing it is an event-shape change affecting logs that already
exist, and it belongs in its own story, not smuggled into this one.

**2. Deductions are `sys` payloads, not a new event kind** (owner,
2026-09-03). `deduction_added` and `deduction_voided` are two new `SysPayload`
variants. This is the route `price_set` and `split_set` already take, and it
means no change to the `SaleEvent` union, to `NewEvent`, to the projection's
pre-switch bail-outs, or to `totals.ts`.

The alternative considered and rejected was widening `CorrectionEvent`, whose
`pileId` is required and whose voids are applied only to basket events in
`totals.ts`. Neither fits a deduction, and relaxing them would put a
counter-critical type at risk for no gain here.

**3. `agreedBy` is a recorded free-text name.** FR-7.3 requires "who agreed
it", and the app's only `actor` is the hardcoded `'somchai'` in
`SaleProvider`. The event carries the name typed at the time; snapshotting it
rather than referencing a person id follows `zone_contract_set`, which
snapshots `workerName` for the same reason — renaming someone next month must
not rewrite what a past sale recorded.

## Acceptance criteria

- [ ] A deduction is recorded against one person, carrying a positive amount
      in satang, a reason, and who agreed it. All three are required — a
      deduction with no reason or no one who agreed it cannot be created.
- [ ] **The sale's gross, the owner's total, and every per-zone row are
      identical before and after a deduction is added.** This is the property
      the whole design exists to preserve, and it is asserted directly.
- [ ] Each worker's card shows their share, then each live deduction as its
      own line with its reason and who agreed it, then the payout. Deductions
      are itemised, never netted into one figure and never folded into the
      share.
- [ ] A deduction is voided with a typed reason, never edited in place. A
      voided deduction stops affecting the payout and stays visible in the
      log — the same bar `pile_reopened` and `void` already meet.
- [ ] A deduction against someone who holds no zone contract in this sale is
      shown, with a share of zero and a negative payout, rather than being
      dropped. Money that left the record has to be visible as having left it.
- [ ] The log tab renders both new events in Thai, not as a raw payload type.
- [ ] The derivation card's six steps are unchanged. A deduction is not a
      step in the sale's derivation, because it does not change what the buyer
      pays.
- [ ] Voiding a deduction that does not exist, or voiding one twice, is a
      no-op rather than a crash or a double refund.

## Offline / sync behavior

Fully offline, and no new surface for sync to reach. A deduction is an event
in the existing append-only log and goes through the one write path in
`SaleProvider.append` — same storage, same `(saleId, seq)` identity, same
fire-and-forget persistence, same replay. No network call is added anywhere in
this story.

Conflict resolution is unchanged because the log's model is unchanged: events
are ordered by `seq` within a sale, and a deduction is ordered like any other
event. A void names its target by `deductionId` rather than by `seq`, so it
survives being replayed in any order — the projection tolerates a void
arriving before the deduction it names, and simply ignores an id it has not
seen. `docs/checklists/offline-sync-checklist.md` is completed for this story.

## Test plan

_Tests below are written to fail first (TDD), then implemented to green._

- [ ] Online path — n/a in the usual sense; the app has no online path. Read
      as: the normal in-app flow, driven for real in a browser.
- [ ] Offline path — the whole story. Add and void a deduction with no
      network, reload, and confirm both survive.
- [ ] Reconnect / manual sync path — n/a, no backend exists yet.

Unit (Vitest, `src/core/`):

- [ ] `settle.test.ts` — sale gross, owner total and every zone row are
      byte-identical with and without a deduction
- [ ] `settle.test.ts` — payout equals share minus deductions, hand-worked
- [ ] `settle.test.ts` — a voided deduction leaves the money exactly as it was
- [ ] `settle.test.ts` — owner + worker still equals gross, per zone and
      overall, with deductions present
- [ ] `settle.test.ts` — the no-contract case: share zero, payout negative
- [ ] `project.test.ts` — deductions project; a void marks rather than
      removes; an unknown `deductionId` is ignored; the projection is
      identical under scrambled timestamps

Component (Jest, `.test.tsx`):

- [ ] The deduction form requires an amount, a reason and who agreed it
- [ ] The worker card renders one line per live deduction and a payout row

End-to-end (Playwright, `e2e/deductions.spec.ts`):

- [ ] Add a deduction on a settled sale; the owner total and zone rows do not
      move; the payout does
- [ ] Void it; the payout returns to the share
- [ ] Reload; both events survive

## Verification

- [ ] Sandbox run performed:
- [ ] Screenshots (UI stories only) — golden path:
- [ ] Screenshots (UI stories only) — edge cases: a negative payout; a voided
      deduction still visible in the log

## Dev notes

Files expected to change: `src/core/types.ts` (two `SysPayload` variants, a
`Deduction` projected type, `SaleState.deductions`), `src/core/project.ts`
(two cases, `emptySale`, materialisation), `src/core/settle.ts`
(`WorkerSettlement` gains `deductions`, `deductionSatang`, `payoutSatang`;
`workerSatang` keeps meaning the share so nothing downstream is renamed),
`src/core/fixtures.ts` (a `deduction()` builder so unit and e2e tests keep
sharing one source of numbers), `src/app/sale/[id]/settlement.tsx`,
`src/i18n/messages.ts`.

Two `case` lines are added to `sysLabel` in `src/app/sale/[id]/counter.tsx`.
That file belongs to another session working S25 — the change is two lines and
nothing else.

While editing the per-zone rows' immediate neighbours, the two hard-coded Thai
literals at `settlement.tsx` (`เจ้าของ {pct}%` and the worker row) move into
the catalogue. They are the last strings on this screen that S24 missed.

## Code review

- Reviewer (separate agent/session):
- Findings:
- Resolution:

## QA notes
