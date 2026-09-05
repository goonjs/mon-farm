# Story: Worker deductions

Status: **Ready** — written 2026-09-05, from the epic-2 S29 section and the
2026-09-04 amendment (which supersedes the original section where they
differ), plus `docs/consults/2026-09-04-farm-operations.md` and
`docs/consults/2026-09-04-bookkeeping.md` (advice, not scope — used for
reasoning, not treated as agreed on their own).

## Context

- Epic: `docs/epics/epic-2-second-field-round.md`, S29 section and the
  "Amendment, 2026-09-04" section (amendment wins where they differ).
- Related PRD section(s): FR-7.3 (adjustments — amount, reason, who agreed),
  FR-7.4 (full derivation, no opaque total), FR-8.4/8.5 (split basis, no
  safe default), FR-9 (cross-check by social transparency — the worker lead
  never logs in).
- Related architecture section(s): `docs/architecture.md` §"Sync engine"
  (events immutable and totally ordered per sale — deductions follow the
  same shape, no new sync design needed).
- Precedent: `docs/stories/s12-undo-and-void.md` (typed-reason voiding,
  append-only, never edited in place), `docs/stories/s15-per-zone-contracts.md`
  (how a `ZoneContract` is recorded and resolved today).

## Explicitly out of scope (see epic amendment)

- **Farm expenses** (fertiliser as a farm cost, fuel, land rent) — these
  never touch a worker's share and are **S35**, sale-independent.
- **A cross-sale running balance / worker account** (an advance given on a
  random Tuesday, carried for months, drawn down at a later sale) — that
  ledger is **S34**. This story's `deduction_added` only ever nets against
  the share earned **in the sale it's recorded against**. `advance` and
  `repayment` exist as categories now because the owner will use them
  starting today, but nothing in this story lets an advance be *originated*
  without an open sale, or *tracked* across sales — that gap is real and is
  S34's job to close, not this story's. Recorded here, plainly, so it is not
  mistaken for an oversight later.
- **A pre-split, shared-cost adjustment mechanism** (e.g., fertiliser split
  60/40 the same as produce, because the contract's percentage was set
  *assuming* that cost-sharing) — the ops consult (§2) flags this as
  possibly real on this farm but explicitly recommends not building it
  speculatively. **Asked and answered, 2026-09-05:** the owner's rate covers
  some inputs and not others, which `inputsBasis: 'mixed'` plus a note
  describes honestly — nothing they described needs a pre-split mechanism,
  so it stays out. If one is ever needed, it is a different mechanism — an
  adjustment to a zone's gross, shared at the split ratio, applied *before*
  the split — and it gets its own event kind in a future story, never
  forced through `deduction_added`.

## Description

A `deduction_added` event records money moving between the owner and one
named worker, against what that worker already earned. It carries the
amount (satang), a fixed **category**, a required reason, and who agreed it.
It is applied **after** the split, against that worker's own combined
share — the sale's gross, the owner's total, and every zone row are
untouched (2026-08-11 decision, restated in the epic's S29 section). A wrong
deduction is never edited: it is reversed by a new `deduction_voided` event
referencing the original, with its own required reason, following the same
append-only discipline `CorrectionEvent` already established for baskets
(S12).

Because the agreed split percentage sometimes already prices in routine
farm inputs and sometimes does not (2026-09-04 decision), `ZoneContract`
gains a field recording which is true for that zone, so the deduction form
can warn rather than silently let an input be double-charged.

Because the worker lead never logs in, the settlement screen — the one
place the worker lead is physically present for the money (S25's flow puts
settlement right after close) — must show each worker their own deductions,
itemised, at the moment they are paid. A deduction typed in privately and
never shown reproduces the exact "verbal, exists only in someone's head"
problem this product exists to end (FR-9's reasoning, applied to money
instead of the count).

### Why category is a fixed enum, not free text

A free-text "reason" field already exists and stays required — this is a
**second, separate, structured field**. The owner's own words for the
categories were: advance, repayment, an input charged to a worker, tool or
loss, other. Proposed exact values:

| Value | Thai label | Meaning |
| --- | --- | --- |
| `advance` | เบิกล่วงหน้า | Cash given to the worker ahead of pay, being recorded now |
| `repayment` | ชำระคืน | Recovering money previously advanced or owed |
| `input_charged` | ค่าปัจจัยการผลิตที่เรียกเก็บ | An input bought at the worker's request or for their zone, agreed separately from the rate (fertiliser, chemicals) |
| `tool_or_loss` | ค่าเครื่องมือ/ของหาย | A tool or item the worker broke or lost |
| `other` | อื่นๆ | Anything not covered above — the reason field carries the specifics |

Free text was considered and rejected. Both consults converge on the same
failure mode: a flat list of "deduction ฿500, reason: ปุ๋ย" / "deduction
฿500, reason: เบิก" cannot later answer "how much fertiliser cost have I
passed through to workers this season" or "how much do workers currently
owe me in advances" without re-reading every reason string by hand
(bookkeeping consult §6.1; ops consult §6.1). That is exactly the reporting
gap S28's per-worker deduction log and S34's running balance exist to close,
and both depend on category being queryable, not prose. A fixed category
plus a required free-text reason gets both structure (aggregable) and
specificity (the actual story), which is the same shape `bulk_gate_skipped`
and `pile_removed` already use — a typed reason a computer can also filter
on.

### The money chain, restated concretely

Per worker, across every zone naming them:

```
share      = Σ (that worker's zones' workerSatang)     — unchanged from today
deductions = Σ (that worker's non-voided deduction_added events, this sale)
payout     = share − deductions
```

`share`, the sale's `grossSatang`, `ownerSatang`, and every `ZoneSettlement`
row are computed exactly as `settle()` computes them today — this story adds
a step **after** that computation, never inside it. `deductions` is
itemised on the settlement screen, never netted into a single number before
`payout` is shown; both `share` and `payout` are shown, not just the latter,
so a discrepancy can be localised to a specific deduction line rather than
read as a miscounted basket (the failure mode epic 1's original exclusion
was protecting against, and the reason this money model exists at all).

### The contract basis — decided by the owner, 2026-09-05

Three states, not two, plus a note that is required for the third:

- A new field on `ZoneContract` (and the `zone_contract_set` payload):
  `inputsBasis: 'rate-inclusive' | 'rate-exclusive' | 'mixed'`, plus
  `inputsNote: string`.
  - `rate-inclusive` — this zone's agreed percentage already prices in
    routine inputs for it; a separate `input_charged` deduction on this
    zone is probably double-charging the worker unless the note says
    otherwise.
  - `rate-exclusive` — the split is produce-only; inputs are handled
    entirely through separate deductions.
  - `mixed` — **the owner's own arrangement**: the rate covers some inputs
    and not others. `inputsNote` is **required** in this state and says
    which is which, in the owner's own words.
- The deduction form reads the target worker's zone contract(s) and, when
  the category is `input_charged` **and** any of those zones is
  `rate-inclusive` **or** `mixed`, shows a warning naming the zone and its
  `inputsNote` before the deduction can be confirmed. It does not block the
  deduction — the owner may still be right that this specific input is
  genuinely outside what the rate covers — it makes the person creating the
  deduction see the fact rather than guess it.

**Why the third state matters more than it looks.** With only two values,
this farm's real arrangement is unrepresentable, so the first contract ever
created would be recorded under a value that is not true — and every
double-charge warning built on it would then be firing, or staying silent,
on a false premise. `mixed` costs one enum value and makes the note
load-bearing exactly when it is the only honest description available.

**Why flag + note, not a structured input list.** The category enum above
needed structure because three different reports (S28's deduction log,
S34's running balance, and "how much fertiliser have I passed through this
season") all need to filter and sum by category across every sale, forever.
No report anywhere in the epic or the consults asks to sum "how much of the
rate-inclusive coverage went to fertiliser vs. chemicals" — the only
consumer of `inputsBasis` is one human, at the moment of entering one
deduction, deciding whether this specific input is already covered. A free-
text note answers that read perfectly (it is read once, by the person who
wrote it or the owner who knows the farm) and costs nothing to change when
next season's agreement differs, where an enumerated input taxonomy would
need a story of its own to design (what counts as an "input"? does a broken
tool count? does labour-adjacent transport?) for a question nobody has
actually asked. This is the same YAGNI call the ops consult makes explicitly
about the heavier pre-split cost-sharing mechanism: build the flag now,
build a structured list only if a specific report ever needs to query it,
which nothing today does.

**This needs the owner's explicit yes before the dev builds it** — it is a
recommendation, not a decision the epic already recorded. If the owner
instead wants the rate's covered inputs named explicitly (e.g., a checklist
of "fertiliser / chemicals / tools" per contract), that is a larger, still-
reasonable design and should be said before implementation starts, not
discovered mid-story.

**No migration concern.** The product has no backend and no sale has ever
been recorded with the current `zone_contract_set` shape outside test
fixtures — `inputsBasis`/`inputsNote` can be required fields on the event
from day one with no legacy-event handling needed.

### What `basis` (`'gross' | 'final'`) means now — it stays inert

FR-8.4/8.5's `split.basis` is a different concept from the new
`ZoneContract.inputsBasis` above and this story does not conflate them.
`split.basis` distinguishes whether the split percentage applies to the
zone's gross value, or to a post-adjustment "final" amount — meaningful
only once something adjusts a zone's **gross** before the split happens
(FR-7.3's bargained price change, or the pre-split shared-cost mechanism
described as out-of-scope above).

This story's `deduction_added` is explicitly, per the 2026-08-11 decision,
applied **after** the split, against the worker's own share — it never
touches a zone's gross or the split computation itself. There is still no
code path in this story that produces a "final" value different from
"gross" for `basis` to distinguish between. **`basis` remains inert after
this story** — the same honest statement `settle.ts`'s header already makes
today. It stops being inert only when a future story adds a pre-split
adjustment to a zone's gross (the shared-cost mechanism above, or a bargained
price change) — not before.

## Acceptance criteria

**Event and projection**

- [ ] A new `deduction_added` `SysPayload` variant carries: `personId`,
      `amountSatang` (integer, satang), `category` (the five-value enum
      above), `reason` (required, non-empty string), `agreedBy` (required,
      non-empty string — who agreed it, typed by the person entering it,
      per FR-7.3).
- [ ] A new `deduction_voided` `SysPayload` variant carries: `targetSeq`
      (the `seq` of the `deduction_added` it reverses) and `reason`
      (required, non-empty). It is its own payload shape, not a reuse of
      `CorrectionEvent` — `CorrectionEvent` requires a `pileId`, which a
      deduction has no use for.
- [ ] A pure projection reads the log and returns, per `personId`, every
      deduction with its `seq`, fields, and a derived `voided: boolean` /
      `voidReason: string | null` — the same "derive at read time from the
      log" pattern `removedPileIds`/`bulkEnteredPileIds` already use in
      `project.ts`, not a stored/mutated flag.
- [ ] `ZoneContract` (and the `zone_contract_set` payload) gains
      `inputsBasis: 'rate-inclusive' | 'rate-exclusive' | 'mixed'` and
      `inputsNote: string`, both required on the event (no safe default,
      matching FR-8.5's own pattern for exactly this kind of per-contract
      choice).
- [ ] `inputsNote` must be non-empty when `inputsBasis` is `'mixed'`,
      enforced by a guard and not only by the form: `mixed` without a note
      says a rate covers some inputs and refuses to say which, which is
      less use than no field at all.

**The money chain — the property that stops a deduction reading like a weighing error**

- [ ] `settle()` computes, per worker: `deductionsSatang` (sum of
      non-voided deductions for that `personId`), an itemised
      `deductions: readonly WorkerDeduction[]` list (never netted into one
      number before display), and `payoutSatang = workerSatang -
      deductionsSatang`.
- [ ] **Test, explicit:** adding one or more `deduction_added` events for a
      worker changes that worker's `payoutSatang` and nothing else —
      `grossSatang`, `ownerSatang`, every `ZoneSettlement.grossSatang` /
      `ownerSatang` / `workerSatang`, and every other worker's figures are
      byte-identical to a settlement computed with no deductions at all.
- [ ] A voided deduction contributes ฿0 to `deductionsSatang` and
      `payoutSatang`, but remains present (marked voided) in the itemised
      list — both the original and the void are visible, neither is
      removed, matching `CorrectionEvent`'s existing relationship to the
      basket it voids.
- [ ] A worker paid across two zones (S15's existing grouping) has their
      deductions summed once against the combined `share`, not applied
      separately per zone.

**Shown to the worker at settlement**

- [ ] The settlement screen's per-worker card shows, for each worker with
      at least one deduction: every itemised deduction line (category
      label in Thai, amount, reason, who agreed it), a deductions subtotal,
      and both the pre-deduction `share` and the post-deduction `payout` as
      two distinct, visible figures — never collapsed into one number.
- [ ] A worker with zero deductions shows no deductions block (nothing new
      to check against, no clutter) and their card's existing figure is
      unambiguously the payout (share and payout are the same value when
      deductions are zero).
- [ ] The deduction lines are on-screen at the point the settlement is
      first viewed — not behind a secondary tap, an expand/collapse, or a
      separate screen — because this is the moment the worker lead is
      physically present per S25's flow (close piles → close sale →
      settlement) and FR-9's whole premise is that money, like the count,
      is seen by the party it concerns rather than typed in out of sight.
- [ ] A voided deduction is visually distinguished (e.g., struck through)
      on this same card, not hidden — the worker can see that a mistake was
      made and corrected, not just the corrected total.

**Category and contract-basis UI**

- [ ] The deduction-entry form requires `category` (one of the five values,
      no free-text substitute), `reason`, `amountSatang`, and `agreedBy`
      before it can be confirmed — mirroring how the bulk-entry form (S23)
      already refuses to save without its required reason.
- [ ] Choosing `input_charged` against a worker whose zone contract(s)
      include one with `inputsBasis` of `'rate-inclusive'` or `'mixed'`
      shows that zone's `inputsNote` as a warning before the deduction can
      be confirmed. It does not block confirmation.
- [ ] The zone-contract setup screen requires `inputsBasis` to be chosen
      (no default) before a `zone_contract_set` can be recorded, the same
      "no safe default" bar `ownerPct` and `basis` already meet.

**Voiding**

- [ ] Voiding a deduction requires a typed reason; there is no one-tap
      "undo-last" tier for deductions (unlike baskets, where a same-second
      mistap is common) — every void is the S12 "void from log" register,
      never the lighter tier.
- [ ] There is no way to edit a `deduction_added` event's amount, category,
      reason, or `agreedBy` in place, including for a typo. The only path
      to a corrected figure is void-with-reason plus a new, separate
      `deduction_added`.

## Edge cases

- [ ] **Deduction larger than the worker's share.** `payoutSatang` is
      allowed to go **negative** — `settle()` does not clamp it to zero and
      does not throw. Clamping would silently absorb a real shortfall the
      same way rounding a basket's weight would; the number has to say what
      it says. The settlement screen renders a negative payout plainly
      (not hidden, ideally visually flagged as needing attention). **What
      happens to that shortfall in the real world — carried to the next
      sale, paid in cash the other direction, forgiven — is explicitly not
      designed here; it is S34's running-balance territory.** Flagging this
      for the owner: confirm that "show a negative number and stop" is an
      acceptable landing point for this story, given S34 does not exist
      yet.
- [ ] **A worker paid across two zones.** Covered above under "the money
      chain" — one combined share, one combined deduction total, one
      payout.
- [ ] **A deduction on a closed sale.** This is the *normal* case, not a
      special one — S25 already means settlement is reached only after
      `sale_closed`, so `deduction_added` must be appendable and honoured
      by `settle()` regardless of `state.status`. No new guard restricts
      this.
- [ ] **Zero or negative amount rejected.** A new guard,
      `isValidDeductionAmount(satang: number): boolean` returning
      `satang > 0`, sits in `project.ts` next to the other UI-facing guards
      (`canBulkEnter`, `pileNeedsVoidReason`, ...). The deduction form
      refuses to submit when it returns false, mirroring `bulk.emptyError`.

## Offline / sync behavior

Checked against `docs/checklists/offline-sync-checklist.md`.

- [x] **Fully usable with no network connection.** `deduction_added` and
      `deduction_voided` are ordinary append-only events through the same
      `EventStore`/`append()` path every other event in this app already
      uses (`src/store/SaleProvider`). Nothing in this story reads or
      requires a network call — same as the rest of the MVP, since there is
      no backend yet.
- [x] **Local writes made while offline are queued/persisted correctly.**
      No new persistence path: `store.native.ts` (expo-sqlite) and
      `store.web.ts` (localStorage) already durably persist every appended
      event before it is considered written; a deduction event is not
      special.
- [ ] **Sync triggers on reconnect / manual sync.** N/A — there is no
      backend to sync to yet (`docs/architecture.md` §"Sync engine": "Sync,
      conflict resolution... undesigned"). When that engine is built, a
      deduction event needs no special handling: it is immutable, has a
      `seq`, and its correction is a new event, exactly the shape the sync
      design already assumes for every other event kind.
- [x] **Conflicting local/remote changes.** N/A for the same reason — no
      remote yet. Worth flagging for whoever designs sync later: because
      `deduction_voided` references a `targetSeq` rather than mutating
      anything, two devices could each append a `deduction_added` and its
      void concurrently without any field-level merge — the append-only
      shape that already avoids conflicts for baskets avoids them here for
      the same reason. This is not new work; it is confirmation the shape
      chosen for this story doesn't add a new conflict class for later.
- [x] **Partial/failed sync leaves local data consistent.** N/A, no sync
      exists to fail partially.
- [ ] **Visibility into sync status.** N/A, no sync exists yet.
- [x] **No data loss scenario identified.** A deduction, once appended, is
      never overwritten — voiding appends rather than replaces, same as
      every other correction in this codebase.

## Test plan

Written to fail first, then implemented to green, per `docs/process.md`.

**`src/core/project.test.ts`**

- [ ] `deduction_added` folds into a per-person deduction list with all
      fields intact (personId, amountSatang, category, reason, agreedBy).
- [ ] Two `deduction_added` events for different people stay isolated per
      `personId`.
- [ ] `deduction_voided` referencing a `deduction_added`'s `seq` marks that
      deduction `voided: true` with the void's `reason` carried as
      `voidReason`; the original event's own fields are unchanged.
- [ ] `deduction_voided` referencing a non-existent `seq` is a no-op on
      projection (matches `CorrectionEvent`'s existing `targetSeq` handling
      — nothing throws, nothing is silently invented).
- [ ] `isValidDeductionAmount(0)` and `isValidDeductionAmount(-100)` are
      `false`; `isValidDeductionAmount(1)` is `true`.
- [ ] `zone_contract_set` with `inputsBasis: 'mixed'` and an empty
      `inputsNote` is rejected by the guard.
- [ ] `zone_contract_set` without `inputsBasis`/`inputsNote` fails to
      type-check (compile-time — no runtime test needed, matches how
      `ownerPct` already has no runtime "missing" test).

**`src/core/settle.test.ts`**

- [ ] A single deduction reduces exactly that worker's `payoutSatang` by
      the deducted amount; `share` (i.e. today's `workerSatang`),
      `grossSatang`, `ownerSatang`, and every `ZoneSettlement` row are
      byte-identical to the same fixture settled with no deductions.
- [ ] Multiple deductions for one worker sum correctly and are each present,
      individually, in `deductions`.
- [ ] A voided deduction contributes ฿0 to `deductionsSatang` but still
      appears (marked voided) in `deductions`.
- [ ] A worker named on two zone contracts has one combined `deductions`
      total drawn against the combined `share` — not two independent
      payouts.
- [ ] A deduction larger than the worker's `share` produces a negative
      `payoutSatang`; `settle()` does not throw and does not clamp to zero.
- [ ] `settle()` succeeds identically whether `state.status` is `'open'` or
      `'closed'` when a deduction is present — no gate on sale status.
- [ ] The worked-example fixture (already used by S15's tests) gets one
      added deduction and the story's own hand-calculated expectation:
      `payoutSatang = workerSatang − deductionSatang`, checked against a
      number computed by hand, not derived from the code under test.

**Component tests (settlement screen, RTL/jest-expo)**

- [ ] A worker with a deduction renders an itemised line per deduction
      (category label, amount, reason, agreedBy) plus visible `share` and
      `payout` figures.
- [ ] A worker with zero deductions renders no deductions block.
- [ ] A voided deduction renders struck-through / visually marked, and does
      not change the rendered payout figure a second time (i.e., it reads
      as "this happened and was undone", not as an active line).
- [ ] The deduction-entry form's confirm action is disabled/blocked when
      `category`, `reason`, `amountSatang`, or `agreedBy` is empty/zero.
- [ ] Selecting `category: input_charged` against a worker whose zone
      contract is `inputsBasis: 'rate-inclusive'` renders the warning
      copy including that zone's `inputsNote`, and the same for `'mixed'`.

**e2e (Playwright, both viewports per existing convention)**

- [ ] Close a sale, open settlement, add a deduction to a worker, confirm
      the itemised line and reduced payout appear, and confirm the sale's
      gross/owner figures on screen are unchanged before and after.
- [ ] Void that deduction from the settlement screen with a typed reason;
      confirm the payout returns to the pre-deduction figure and both the
      original and the void are visible somewhere reachable from the
      screen (log/history, matching how voided baskets remain visible
      today).
- [ ] Attempt to confirm a deduction with a zero amount or empty reason;
      confirm it is refused, matching the bulk-entry zero-amount refusal
      pattern already tested for S23.

## Thai-first message ids

New entries in `src/i18n/messages.ts`, `th` first (the source), per the
file's own rules — no `·` bilingual pairs, one entry per id.

| id | Thai | English |
| --- | --- | --- |
| `settle.share` | ส่วนแบ่งก่อนหัก | share, before deductions |
| `settle.payout` | ยอดจ่ายจริง | payout |
| `settle.deductions` | รายการหักเงิน | deductions |
| `settle.deductionCategory.advance` | เบิกล่วงหน้า | advance |
| `settle.deductionCategory.repayment` | ชำระคืน | repayment |
| `settle.deductionCategory.inputCharged` | ค่าปัจจัยการผลิตที่เรียกเก็บ | input charged to worker |
| `settle.deductionCategory.toolOrLoss` | ค่าเครื่องมือ/ของหาย | tool or loss |
| `settle.deductionCategory.other` | อื่นๆ | other |
| `deduction.addTitle` | เพิ่มรายการหักเงิน | add a deduction |
| `deduction.amountLabel` | จำนวนเงิน (บาท) | amount (baht) |
| `deduction.categoryLabel` | ประเภท | category |
| `deduction.reasonLabel` | เหตุผล | reason |
| `deduction.reasonPlaceholder` | เช่น ค่าปุ๋ยที่ตกลงแยกจากค่าส่วนแบ่ง | e.g. fertiliser agreed separately from the split |
| `deduction.agreedByLabel` | ใครเป็นคนตกลง | who agreed it |
| `deduction.amountRequired` | ต้องระบุจำนวนเงินมากกว่า 0 | amount must be greater than 0 |
| `deduction.reasonRequired` | ต้องระบุเหตุผลก่อนบันทึก | a reason is required before saving |
| `deduction.confirm` | บันทึกรายการหัก | save deduction |
| `deduction.voidTitle` | ยกเลิกรายการหักนี้ | void this deduction |
| `deduction.voidReasonPlaceholder` | เหตุผลที่ยกเลิก | reason for voiding |
| `deduction.voidConfirm` | ยืนยันยกเลิก | confirm void |
| `deduction.voided` | ยกเลิกแล้ว | voided |
| `deduction.rateCoversWarning` | อัตราแบ่งของโซนนี้อาจรวมค่าใช้จ่ายนี้ไว้แล้ว — ตรวจสอบก่อนหัก: {note} | this zone's rate may already cover this cost — check before deducting: {note} |
| `contract.inputsBasisLabel` | อัตราแบ่งนี้รวมค่าปัจจัยการผลิตหรือไม่ | does this rate already include input costs? |
| `contract.inputsBasisInclusive` | รวมแล้ว | rate-inclusive |
| `contract.inputsBasisExclusive` | ไม่รวม แยกหักต่างหาก | rate-exclusive |
| `contract.inputsBasisMixed` | รวมบางอย่าง | some inputs included, some not |
| `contract.inputsNoteLabel` | หมายเหตุ (รวมอะไร ไม่รวมอะไร) | note (what's covered, what isn't) |

## Answered by the owner, 2026-09-05 — build to these

1. **The contract basis is three-valued, with a note required when mixed.**
   `inputsBasis: 'rate-inclusive' | 'rate-exclusive' | 'mixed'`, plus
   `inputsNote`. Not the two-valued flag this story first proposed.

   The reason is that the owner's own arrangement *is* the third state: the
   agreed rate covers some inputs implicitly and not others — fertiliser
   bought at a worker's request, or chemicals for one zone, are agreed and
   deducted separately. A two-valued flag would have been filled in wrongly
   on the first contract ever created, because neither value is true, and
   the note would have quietly become the only honest field on the record.

   `inputsNote` is **required when the basis is `mixed`** and optional
   otherwise, and it is shown to whoever is entering a deduction, at the
   moment they enter it. That is the whole job of the field: no report
   filters on it, no guard reads it. One person, once, needs to see what the
   rate already covers before they charge a worker for it again.

   The structured alternative — the contract carrying a list of which inputs
   the rate covers, so the app could warn on a double-charge itself — was
   put to the owner and not taken. Recorded here because it is the only
   option under which the app catches the double-charge rather than relying
   on the person to read the note, and it is where to start if the note
   turns out not to be enough in the field.

2. **A deduction is whatever the owner and the worker agree**, and the app's
   job is to record it, not to arbitrate it. The owner's words: *"upon
   agreement between owner and worker, but don't do thing exceed or too
   complex."*

   So: no cap, no clamp, no automatic carry-forward, and no refusal to
   record a deduction larger than the share. If a payout comes out negative,
   it is shown plainly as a negative number, and nothing further happens to
   it in this story — carrying a shortfall between sales is S34's job and is
   not to be half-built here. A gentle inline note beside a negative payout
   is in scope; any mechanism that moves the money is not.

3. **Uniformity across the farm** is no longer an open question for this
   story: `inputsBasis` is per-zone-contract, so a farm with different
   arrangements per zone is already representable, and the copy is written
   per contract rather than as a farm-wide statement.

## Still open

Nothing blocking. One thing is deliberately deferred rather than unanswered:
a genuine **pre-split** cost-sharing mechanism, where a zone's gross is
reduced before it is split. Nothing the owner described needs it — their
arrangement is a rate that prices some inputs in, which `mixed` plus a note
describes honestly — and it stays out of scope until something real asks
for it (YAGNI). `basis: 'gross' | 'final'` on the split remains inert for
the same reason, and this story does not activate it.

## Verification

## Dev notes

## Code review

- Reviewer (separate agent/session):
- Findings:
- Resolution:

## QA notes
