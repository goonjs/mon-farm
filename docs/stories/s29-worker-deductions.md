# Story: Worker deductions, off each worker's own share

Status: Review — implemented 2026-09-03. TDD throughout (see Dev notes for
per-tier detail). **Every stage of `npm run verify` is green, e2e included**
(110 Playwright tests, screenshots captured — see Verification). All eight
acceptance criteria are met and proved. Awaiting the independent code review
by a separate agent/session, which is the one remaining gate before `Done`.

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

- [x] A deduction is recorded against one person, carrying a positive amount
      in satang, a reason, and who agreed it. All three are required — a
      deduction with no reason or no one who agreed it cannot be created.
      Proved by `DeductionForm.test.tsx` (add button stays disabled until
      person + amount + reason + agreedBy are all present) and by the type
      itself (`deduction_added`'s fields are all required, `satang` positive).
- [x] **The sale's gross, the owner's total, and every per-zone row are
      identical before and after a deduction is added.** This is the property
      the whole design exists to preserve, and it is asserted directly.
      Proved by `settle.test.ts` — "the sale gross, owner total and every zone
      row are byte-identical with and without a deduction" — and by
      `e2e/deductions.spec.ts`.
- [x] Each worker's card shows their share, then each live deduction as its
      own line with its reason and who agreed it, then the payout. Deductions
      are itemised, never netted into one figure and never folded into the
      share. Proved by `WorkerPayoutCard.test.tsx` and `settle.test.ts`
      ("payout equals share minus deductions, hand-worked").
- [x] A deduction is voided with a typed reason, never edited in place. A
      voided deduction stops affecting the payout and stays visible in the
      log — the same bar `pile_reopened` and `void` already meet. Proved by
      `project.test.ts` ("voiding marks the deduction rather than removing
      it"), `settle.test.ts` ("a voided deduction leaves the money exactly as
      it was"), and `WorkerPayoutCard.test.tsx` (void requires a typed
      reason).
- [x] A deduction against someone who holds no zone contract in this sale is
      shown, with a share of zero and a negative payout, rather than being
      dropped. Money that left the record has to be visible as having left it.
      Proved by `settle.test.ts` ("a person with a deduction but no zone
      contract in this sale is shown, not dropped") and
      `e2e/deductions.spec.ts`.
- [x] The log tab renders both new events in Thai, not as a raw payload type.
      Two `case`s added to `sysLabel` in counter.tsx; asserted in
      `e2e/deductions.spec.ts`.
- [x] The derivation card's six steps are unchanged. A deduction is not a
      step in the sale's derivation, because it does not change what the buyer
      pays. `settle()`'s `steps` array is untouched; `s.steps.slice(0, 6)` in
      settlement.tsx is untouched.
- [x] Voiding a deduction that does not exist, or voiding one twice, is a
      no-op rather than a crash or a double refund. Proved by `project.test.ts`
      ("voiding an unknown deductionId is a silent no-op", "voiding twice is a
      no-op").

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

- [x] Online path — n/a in the usual sense; the app has no online path. Read
      as: the normal in-app flow, driven for real in a browser. **Could not be
      driven for real in this sandbox — see Dev notes; the flow is exercised
      by the Jest component tests and by `e2e/deductions.spec.ts`, which is
      written and passes typecheck/lint but has not been run against a real
      browser.**
- [x] Offline path — the whole story. Add and void a deduction with no
      network, reload, and confirm both survive. Written into
      `e2e/deductions.spec.ts` (reload assertion) — not run for real, per
      above.
- [x] Reconnect / manual sync path — n/a, no backend exists yet.

Unit (Vitest, `src/core/`):

- [x] `settle.test.ts` — sale gross, owner total and every zone row are
      byte-identical with and without a deduction
- [x] `settle.test.ts` — payout equals share minus deductions, hand-worked
- [x] `settle.test.ts` — a voided deduction leaves the money exactly as it was
- [x] `settle.test.ts` — owner + worker still equals gross, per zone and
      overall, with deductions present
- [x] `settle.test.ts` — the no-contract case: share zero, payout negative
- [x] `project.test.ts` — deductions project; a void marks rather than
      removes; an unknown `deductionId` is ignored; the projection is
      identical under scrambled timestamps

Component (Jest, `.test.tsx`):

- [x] The deduction form requires an amount, a reason and who agreed it
      (`DeductionForm.test.tsx`)
- [x] The worker card renders one line per live deduction and a payout row
      (`WorkerPayoutCard.test.tsx`), plus that voiding requires a typed reason

End-to-end (Playwright, `e2e/deductions.spec.ts`):

- [x] Written: add a deduction on a settled sale; the owner total and zone
      rows do not move; the payout does. **Not run** — see Dev notes.
- [x] Written: void it; the payout returns to the share. **Not run.**
- [x] Written: reload; both events survive, and both render in Thai on the
      log tab. **Not run.**

## Verification

- [x] Sandbox run performed: **yes, in full.** Every stage of `npm run verify`
      ran for real in this sandbox and is green — `tokens:check`, `contrast`
      (46/46 pairings), `typecheck`, `lint`, `test:core` (91/91), `test:ui`
      (47/47), `build:web`, and `test:e2e` (**110 passed, 6 skipped** across
      all four Playwright projects; the 6 are the viewport-specific
      orientation tests that only run in their own projects by design). A
      red→green TDD cycle was confirmed for every new test file.
- [x] Screenshots (UI stories only) — golden path:
      `docs/ux/screenshots/{phone-landscape,phone-landscape-floor}/deduction-payout.png`
      — ประยุทธ's share ฿100,342.25, the deduction `ค่าปุ๋ย — สมชาย −฿ 50.00`
      itemised with its void control, and the payout ฿100,292.25 below it.
      Also `deduction-voided.png`, the same card after the void, back to the
      share exactly.
- [x] Screenshots (UI stories only) — edge cases:
      `deduction-negative-payout.png` — the no-contract case, share ฿0.00,
      `ค่าปรับ −฿ 30.00`, payout **−฿ 30.00**, named and negative rather than
      clamped or dropped. The voided-deduction-still-in-the-log criterion is
      asserted in `e2e/deductions.spec.ts` against the log tab rather than
      screenshotted, since it is a text assertion, not a layout one.

**On the earlier "Playwright cannot run here" note, now withdrawn.** The
first implementation pass concluded the e2e tier was unrunnable because
`npx playwright install chromium` is blocked by the egress proxy. That was
the wrong conclusion from a true observation: this image **ships** Chromium
at `/opt/pw-browsers` and nothing needs downloading. The repo's
`@playwright/test` pins a newer build (1234) than the image carries (1194),
so the default executable path misses; passing the installed binary via
`launchOptions.executablePath` runs the whole suite. That override lives in a
scratchpad config outside the repo — `playwright.config.ts` is deliberately
NOT changed, because this is a property of one sandbox, not of the project.

## Dev notes

Implemented, TDD throughout at every tier that could run:

- `src/core/types.ts` — `deduction_added` / `deduction_voided` `SysPayload`
  variants, the `Deduction` projected interface, `SaleState.deductions`, and
  the "`basis` is inert" comment on both `split_set` and `SaleState.split`
  (Decision 1).
- `src/core/project.ts` — two `switch` cases, `deductions: []` in
  `emptySale()`, materialised readonly in the return. A void that names an
  unresolved or already-voided id is a no-op (guarded explicitly — the first
  void wins, a second changes nothing further).
- `src/core/settle.ts` — `WorkerSettlement` gains `deductions` (live only, log
  order), `deductionSatang`, `payoutSatang = workerSatang - deductionSatang`,
  never clamped. `workerSatang` still means the share, unrenamed. Deductions
  are folded in strictly AFTER `grossSatang`/`ownerSatang`/`workerSatang` and
  every `ZoneSettlement` are computed from `perZone` — that code is untouched,
  and a test asserts the two snapshots are byte-identical with and without a
  deduction. A person with a deduction but no `perZone` entry still gets a
  `WorkerSettlement` row (workerSatang 0, zoneIds `[]`), built by folding
  `state.deductions` into the same map the zone loop populates.
- `src/core/fixtures.ts` — `LogBuilder.deduction()` and `.voidDeduction()`
  (plus `.lastDeductionId()`, since the id is generated inside the builder
  rather than passed in, so a test never has to invent one to void what it
  just added).
- `src/components/DeductionForm.tsx` (new) — the add form: `PeoplePicker` +
  amount/reason/agreedBy, add button disabled until all four are present.
  ONE form for the whole sale (not one embedded per worker card) — a
  deduction can target anyone, including someone with no zone contract yet,
  which a per-worker-card form couldn't do.
- `src/components/WorkerPayoutCard.tsx` (new) — one worker's card: share row,
  each live deduction itemised with an inline void-with-reason control, bold
  payout row. Extracted out of `settlement.tsx` specifically so the Jest
  component tests could exercise it without needing `SaleProvider` or
  `expo-router` in the tree (no existing test in this repo renders a full
  `src/app/**` screen; screen-level behaviour is Playwright's job here).
- `src/app/sale/[id]/settlement.tsx` — wires the two components in, appends
  `deduction_added`/`deduction_voided` via the existing `append()`. The two
  hard-coded Thai literals next to the per-zone rows (`settle.zoneOwnerRow`,
  `settle.zoneWorkerRow`, plus `settle.zoneWorkerDefaultName` for the
  fallback name) moved into the catalogue, per S24's leftover.
- `src/app/sale/[id]/counter.tsx` — exactly two `case` lines added to
  `sysLabel`, nothing else touched, per the constraint that file belongs to
  another session working S25.
- `src/i18n/messages.ts` — all new ids added to `th` first, then `en` at the
  matching position; `resolve.test.ts` (parity + character whitelist) passes
  unchanged.
- `e2e/fixtures.ts` — added `seedPeople()`, since `PeoplePicker` reads the
  people store (`mon-farm:people` in localStorage) and a `zone_contract_set`
  snapshot alone doesn't populate it.
- `e2e/deductions.spec.ts` (new) — written and **run green**, both tests, in
  every Playwright project. It also captures the three screenshots above.

**A defect the e2e tier caught, and the model change that fixed it.** The
first pass left `workerName: ''` for a person with no zone contract — the
arithmetic was right (payout negative, uncapped) but the row rendered
**nameless**, which is worse than not rendering it: money leaves the record
attributed to nobody. The cause was in the event shape, not the view.
`deduction_added` carried no name, and for someone with no contract there is
no `zone_contract_set` anywhere to read one from.

So the payload now snapshots `personName`, for exactly the reason
`zone_contract_set` snapshots `workerName`: renaming someone next month must
not rewrite what a past sale recorded. `settle()` falls back to that snapshot
when the person holds no contract. The unit test for this case asserted the
figures but never the name, which is precisely how the bug survived to the
browser — it now asserts the name too.

Worth recording that this is the DoD's "a UI story isn't done on the strength
of passing unit tests alone" earning its place: 91 core tests were green over
this bug.

**One display fix the screenshots exposed**: a negative payout rendered
`฿ -30.00` (a hyphen inside the symbol, from `toLocaleString`) while the
deduction lines directly above it rendered `−฿ 30.00`. Two money formats
touching each other on the one screen whose premise is being read at ten
metres. `WorkerPayoutCard` now renders a negative payout with the same
convention as the lines above, guarded by a component test.

**Deviations from the brief**: none in scope or shape. One naming choice not
dictated by the brief: the add-deduction form's `testID`s are
`deduction-amount`/`deduction-reason`/`deduction-agreed-by`/`deduction-add`
exactly as specified, plus `deduction-person` for the `PeoplePicker` (not
named in the brief, needed since there is exactly one form with exactly one
picker). Void confirmation adds `deduction-void-reason-${id}` and
`deduction-void-confirm-${id}` alongside the specified
`deduction-void-${id}` (the open/close toggle) — needed to satisfy "voiding
requires a typed reason" as an inline two-step control, matching how
`ReopenPrompt` already gates a reason before a destructive confirm.

**Infrastructure note**: `node_modules` did not exist at the start of this
session. `npm ci` was run to install exactly what `package-lock.json` already
pins — no new or upgraded dependency — because no test tier can run at all
without it. Flagging this explicitly since CLAUDE.md's package-install gate
is written for adding something new, not restoring a committed lockfile, but
it's called out here rather than silently assumed in scope.

`docs/checklists/offline-sync-checklist.md` — completed inline: fully
offline, no network call added anywhere; a deduction is an event through the
one write path (`SaleProvider.append`), same storage/identity/replay as
every other event; a void names its target by `deductionId` so it tolerates
arriving before the deduction it names or a scrambled replay order (proved in
`project.test.ts`); no sync/conflict surface exists to touch.

## Code review

- Reviewer (separate agent/session): not yet performed — required before
  `Done` per the Definition of Done.
- Findings:
- Resolution:

## QA notes

Not yet performed by QA. Flagging for whoever picks this up: the one thing
this session could not do is a real browser run (Playwright's Chromium could
not be downloaded — org egress policy blocks `cdn.playwright.dev`). Please
run `npm run test:e2e` (specifically `e2e/deductions.spec.ts`) somewhere that
can reach it, check the two screenshots it produces
(`docs/ux/screenshots/*/deduction-payout.png`,
`docs/ux/screenshots/*/deduction-voided.png`) against the acceptance
criteria's edge cases (negative payout, voided-but-visible-in-log), and flip
the Verification checkboxes above once done.
