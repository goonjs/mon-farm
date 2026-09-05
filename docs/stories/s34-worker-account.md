# Story: The worker account — borrowing, debt and payback

Status: **Ready** — written 2026-09-05, from the epic-2 "Amendment,
2026-09-04" section and the "Answered 2026-09-05" table, plus
`docs/consults/2026-09-04-farm-operations.md` (§2–§4, the advance/debt
distinction and "running balance, not just the single event") and
`docs/consults/2026-09-04-bookkeeping.md` (§3, the append-only reversal
pattern). Sits directly on top of `docs/stories/s29-worker-deductions.md`
(read in full — its `deduction_added` categories `advance`/`repayment`
and its "Explicitly out of scope" section define the gap this story
closes) and follows the storage precedent decided in
`docs/stories/s35-expense-log.md` ("Where the expense log lives", Option
A).

## Context

- Epic: `docs/epics/epic-2-second-field-round.md`, "Amendment, 2026-09-04"
  section (S34 is new there) and the "Answered 2026-09-05" table (the
  three-way `inputsBasis` and "no cap, no clamp" decisions apply here too,
  by the same reasoning).
- Related PRD section(s): FR-7.3 (adjustments — a deduction is a recorded
  adjustment, not a silent edit), FR-9 (cross-check by social
  transparency — the worker lead never logs in, so a number that concerns
  them has to be shown and voiced, not just typed), FR-12/NFR-3 (append-only
  audit trail, ordering by `seq` never by wall clock).
- Related architecture section(s): `docs/architecture.md` §"Local data
  layer" (the store/adapter split this story extends — see "Where the
  account lives" below) and §"Sync engine" ("not built" — this story adds
  no sync design, same posture S29 and S35 already take).
- Depends on `docs/stories/s29-worker-deductions.md` for one thing only:
  the `deduction_added` event's `category` field (specifically the
  `'repayment'` value) must exist before this story's sale-side link can be
  tested end-to-end. Everything else in this story — the account's own
  store, its own events, its own screen — has no dependency on S29 landing
  first, and can be built in parallel. Sequenced after S29 in the epic's
  order of work for exactly this reason (§"Order of work", item 9).
- Do **not** touch `docs/stories/s29-worker-deductions.md` or
  `docs/stories/s35-expense-log.md` — both were authored the same day, in
  parallel, by other agents.

## Description

Two shapes of borrowing happen on this farm, and the owner named both on
2026-09-04: a **short advance against a coming sale**, expected settled at
the very next one, and a **longer-running debt that carries for months**,
paid back a little at a time across many sales. Both are the same kind of
fact — money that left the farm's hand and is owed back — and both need
the same thing the operations consult already said the app has to have: *"a
running 'owed by worker' balance per person that accrues advances whenever
they happen... and only draws down against it at settlement"*
(farm-operations consult, §3).

This story builds that balance. It is deliberately small in mechanism, per
the owner's own instruction on the adjacent question of deduction size
(S29, "Answered 2026-09-05"): *"upon agreement between owner and worker,
but don't do thing exceed or too complex."* Read as a standing instruction
here too — there is no interest, no amortisation schedule, no per-loan
matching of which repayment pays off which advance. There is one number
per worker: how much they currently owe (or, if it goes the other way, how
much credit they are carrying), computed from every borrowing and every
repayment ever recorded against them, in the order they happened.

## Where the account lives

**A debt spans sales, so it cannot live in a single sale's event log** —
the same reasoning `docs/stories/s35-expense-log.md` used to rule out its
Option B (widening the per-sale log with a sentinel sale id) applies here
with less ambiguity than it did there, because a worker's debt is not even
associated with *one* sale the way an expense sometimes is with a zone —
it is associated with a person, full stop, and a person outlives every
sale by design (`src/store/people.ts`'s own header: "a worker outlives a
sale").

Nor can it live in device configuration the way `farmProfile.ts` does.
`farmProfile.ts`'s own header is explicit that "nothing here is evidence"
and that it is mutable by design (a rename, an edit-in-place). A worker's
balance is the opposite of that on both counts: it is money, it has to
survive a dispute a month later exactly the way a basket count does
(farm-operations consult §4: *"a worker or owner disputing a deduction a
month later is disputing a balance, not usually a single line"*), and it
must never be edited in place — only ever corrected by reversal, the same
`CorrectionEvent` discipline every other evidence-grade record in this
codebase already follows.

**Recommendation: the same shape S35 already decided for exactly this
problem** — Option A, a fourth device-level append-only store of its own,
following the identical port/adapter pattern as `store.ts`
(`src/store/workerAccount.ts` / `.web.ts` / `.native.ts`), keyed at the
device rather than per sale. Concretely:

- Web: one `mon-farm:worker-account` `localStorage` key, an array of
  events, same shape as `store.web.ts`'s `KEY(saleId)` pattern with the
  sale id dropped.
- Native: one new `expo-sqlite` table, `worker_account_events(seq, ts,
  mono, actor, person_id, kind, payload, synced_at)`, `PRIMARY KEY(seq)`
  instead of `(sale_id, seq)` — device-global sequence, not per-sale.
- Same `append`/`appendAll`/`pending`/`markSynced` shape carried over
  verbatim from `EventStore`, minus `listSales()` (there is nothing to
  list) and minus the `saleId` parameter on `load` (there is one log, not
  one per sale).

This is a second instance of the exact pattern S35 is building for the
same reason at the same time — device-level, evidence-grade, append-only,
port/adapter-split. Rather than pay the adapter-writing cost twice with no
shared code, whichever of S34/S35 lands first should factor the four
methods common to both stores (`append`/`appendAll`/`pending`/
`markSynced` over a flat device-keyed log) into one small generic helper
(e.g. `createDeviceEventLog<E>(storageKey)` for web, one shared
transaction-wrapped insert helper for native) that both `workerAccount.ts`
and `expenses.ts` call into, rather than two copies of the same forty
lines. This is a refactor to raise in whichever story's Dev notes lands
second, not a blocker for either — the two stores' *event types* are
unrelated domains and stay in their own files regardless.

**This is also the cross-sale read layer the epic calls load-bearing.**
The epic's own words: *"the running balance and the date-filtered expense
log both span sales... that read layer is load-bearing for two must-have
reports; it is built once, deliberately, in the first story that needs
it, rather than half-built three times."* Concretely, for this story, the
genuinely new capability is not the device-level store above (S35 needs
no sale-log reads at all — an expense never touches a sale). It is a
function that reads **every sale on the device** to find one worker's
repayment history:

```
async function loadPersonSaleDeductions(
  personId: PersonId,
): Promise<PersonSaleDeduction[]> {
  const saleIds = await store.listSales();
  const out: PersonSaleDeduction[] = [];
  for (const saleId of saleIds) {
    const events = await store.load(saleId);
    for (const d of projectDeductions(events).filter((d) => d.personId === personId)) {
      out.push({ saleId, ...d });
    }
  }
  return out;
}
```

(`projectDeductions` is S29's own projection helper, reused rather than
reimplemented — see "The sale-repayment link" below.) This is built as a
general per-person, all-sale deduction reader, **not** narrowed to
`category: 'repayment'` — S34 only *consumes* the `repayment` rows today,
but S28's planned "deduction log per worker, exportable/showable to that
worker" (bookkeeping consult §5, must-have) needs every category, across
every sale, for the same person. Building the narrow version now and
widening it in S28 would be exactly the "half-built three times" the epic
warns against; building the general reader once, here, and having S34
filter it down to `repayment` for the balance while S28 later consumes it
unfiltered for the full log, is the "built once" version.

**Cost of scanning every sale.** At this farm's cadence (a handful of
sales a week in season) this is cheap — a few dozen to a few hundred
`store.load()` calls a year, done once when a worker's balance or ledger
screen opens, not on every keystroke. Flagged honestly as a scaling limit
that would need an index (e.g. a per-person secondary read model) if the
device ever accumulates thousands of sales; not built now — YAGNI against
a scale this app has no evidence of reaching.

## The events

Two new event kinds live in the new store, plus one correction kind. All
three carry the base fields every event in this codebase already carries
(`seq`, `ts`, `mono`, `actor`) at the store layer; the payload fields below
are the domain content.

```ts
export type BorrowingShape = 'advance' | 'debt';

export interface BorrowingAdded {
  readonly t: 'borrowing_added';
  readonly personId: PersonId;
  readonly amountSatang: number;      // > 0, enforced (see Edge cases)
  readonly shape: BorrowingShape;     // required, no safe default — see "Telling the two shapes apart"
  readonly reason: string;            // required, non-empty
  readonly agreedBy: string;          // required — who agreed it, typed by whoever enters it
  readonly occurredTs: number;        // when the money actually changed hands — NOT `ts` (when logged)
}

export interface RepaymentRecorded {
  readonly t: 'repayment_recorded';
  readonly personId: PersonId;
  readonly amountSatang: number;      // > 0
  readonly reason: string;
  readonly agreedBy: string;
  readonly occurredTs: number;
}

export interface AccountEntryVoided {
  readonly t: 'account_entry_voided';
  readonly targetSeq: number;         // the seq of the borrowing_added/repayment_recorded it reverses
  readonly reason: string;            // required — same S12 register as CorrectionEvent/deduction_voided
}
```

`occurredTs` mirrors S35's `expenses` field of the same name and the same
name for the same reason: an advance handed over last Tuesday is dated
last Tuesday, not to whenever the owner got around to opening the app.
Kept apart from `ts` (when the event was appended) exactly as S35 argues.

**`RepaymentRecorded` is the off-sale channel only** — logging a repayment
the worker hands over in cash on a day with no sale open, symmetric with
`BorrowingAdded` being loggable with no sale open. It is deliberately
**not** used for a repayment happening at a settlement — that channel
already exists (next section) and routing it through two different event
shapes for the same fact would be the exact "two shapes for one problem"
mistake `docs/stories/s35-expense-log.md` rejected for its own Option B.

**No `borrowing_voided` / `repayment_voided` split.** One
`account_entry_voided` kind, `targetSeq` + `reason`, covers both —
identical reasoning to why `pile_removed` covers both an empty-pile typo
and a void in one event kind (S26): the fact recorded (this entry no
longer counts) is the same regardless of which kind of entry it targets.

## The sale-repayment link — the property this story most has to protect

S29 already defines `deduction_added` with a `category: 'repayment'`
value, applied *inside* a sale, reducing that worker's `payoutSatang` for
that sale. The task this story exists to close: **that same repayment has
to draw down the account's balance too, and it must be structurally
impossible for those two effects to disagree.**

**The design that makes this true by construction, not just by test:**
the sale's own `deduction_added` event is the single source of truth for a
sale-time repayment. There is **no second event written to the
worker-account store when a repayment happens at settlement.** Instead,
the balance derivation (below) reads `deduction_added{category:
'repayment'}` events directly out of every sale's own log (via
`loadPersonSaleDeductions` above), the same events `settle()` already
folds into `payoutSatang`. Both numbers — the payout shown at this
sale, and the balance shown on the worker's account — are computed from
the *same underlying event*, not from two events that a crash, a bug, or
a race could let drift apart.

This is deliberately the opposite of the tempting alternative — writing
*both* a `deduction_added` (for payout) *and* a `repayment_recorded` (for
balance) in one user action — which would need cross-store atomicity this
codebase has no mechanism for (`appendAll` is atomic within one store;
nothing makes two stores commit together), and which is exactly how "a
repayment that reduces payout but not balance, or vice versa" would
happen: a crash between the two writes.

**Voiding inherits this property for free.** `deduction_voided` (S29) is
also read directly by the balance derivation; voiding a sale-time
repayment un-draws-down the balance with no separate action on the
account side, for the same reason — there is only ever one event to
reverse.

**What this makes testable, explicitly:**

```
given: a sale with a deduction_added{personId: P, category: 'repayment', amountSatang: N}
when:  settle() computes P's payoutSatang for that sale
  AND: the account balance for P is derived (this sale's log included in the scan)
then:  payoutSatang reflects -N (per S29, already tested there)
  AND: the account balance reflects -N
  AND: these two numbers are computed by two different functions reading
       the SAME single event — deleting/mutating one manually and
       recomputing both proves they move together, because there is only
       one row to change
```

## The running balance

Derived at read time from the log, **never a stored mutable number** — the
same discipline `removedPileIds`/`bulkEnteredPileIds` already use in
`project.ts` (derive on every read, from the immutable log, rather than
maintain a counter anywhere that could drift from what the events actually
say).

```ts
export interface WorkerAccountLedgerEntry {
  readonly seq: number;                 // the account-store seq, or the sale's own seq for a sale-repayment row
  readonly occurredTs: number;
  readonly kind: 'borrowing' | 'repayment-direct' | 'repayment-at-sale';
  readonly amountSatang: number;        // always positive; sign is implied by `kind`
  readonly shape: BorrowingShape | null; // only set for 'borrowing'
  readonly reason: string;
  readonly agreedBy: string;
  readonly saleId: SaleId | null;        // only set for 'repayment-at-sale'
  readonly voided: boolean;
  readonly voidReason: string | null;
}

export interface WorkerAccountView {
  readonly personId: PersonId;
  readonly balanceSatang: number;  // positive: worker owes the farm. negative: farm owes the worker (overpaid repayment). 0: even.
  readonly ledger: readonly WorkerAccountLedgerEntry[]; // sorted by occurredTs, for a human reading it back
}
```

```
balanceSatang(person) =
    Σ (non-voided borrowing_added.amountSatang, this account store)
  − Σ (non-voided repayment_recorded.amountSatang, this account store)
  − Σ (non-voided deduction_added{category:'repayment'}.amountSatang, across every sale, this person)
```

Pure function, `src/core/workerAccount.ts` (no react/expo import, same
rule `types.ts`'s header states), taking the account store's events and
the pre-loaded `PersonSaleDeduction[]` as plain arguments — the I/O (the
store reads and the cross-sale scan) stays in `src/store/`, matching the
existing pure-core/impure-store split (`project.ts`/`settle.ts` vs.
`store.ts`).

## Telling the two shapes apart

Per the owner's 2026-09-04 answer — both happen and must be
distinguishable on the record. `shape: 'advance' | 'debt'` is a **required
field with no default** on `BorrowingAdded`, the same "no safe default"
bar `ownerPct`/`basis`/S29's `inputsBasis` already meet for a per-record
choice that changes how the record should be read.

Per the owner's "don't do thing exceed or too complex" instruction, this
is a **label, not a mechanism**. It does not change how draw-down works —
both shapes draw down the same single per-person balance, in the order
repayments happen, with no per-loan matching (no FIFO allocation deciding
"this repayment paid off which advance"). It exists so:

- the ledger UI can show, in plain language, which entries are which
  (short-term vs. long-running) rather than a flat list of unlabelled
  numbers;
- a future report (S28) can filter or group by shape if the owner ever
  asks "how much is currently out as short advances vs. carried debt" —
  a question this story does not need to answer today, but does not
  block by choosing a single unlabelled bucket now.

No interest, no due date, no amortisation schedule, no automatic
"advances must clear within one sale" enforcement — an advance that
doesn't get repaid at the very next sale simply keeps sitting in the
balance exactly like a debt would, and nothing in the app treats that as
an error. The distinction is descriptive, and only descriptive.

## Shown to the worker

S29 established the reason a deduction is shown to the worker at
settlement: the worker lead never logs in, so a number that concerns them
has to be shown and voiced at the one moment they are physically present
for the money (FR-9). A balance they are being paid *against* deserves at
least as much, and arguably more — the farm-operations consult (§4) is
explicit that a balance dispute a month later is usually about the
running total, not one line.

**What the worker sees, and when:**

- **At settlement, on the same per-worker card S29 already builds**, a
  worker whose account has a **non-zero balance** sees it — the balance
  *before* today's sale and the balance *after* (if this sale drew it
  down via a repayment deduction) — as two more figures alongside `share`
  and `payout`, never collapsed into either.
- **This is shown whenever the balance is non-zero, independent of
  whether this sale contains a repayment.** S29's deduction block only
  renders for a worker with at least one deduction *this sale*; a worker
  who is quietly carrying a ฿3,000 debt but had no repayment taken today
  would show nothing under S29's own rule. That is exactly the "the debt
  only exists in someone's head" failure this app exists to prevent, one
  level up — so this story adds its own, independent condition: the
  balance line renders for anyone with `balanceSatang !== 0`, regardless
  of whether today's deductions include a `repayment`.
- **Off-sale (an advance handed over on a random Tuesday, or a direct
  repayment)**: there is no settlement screen at that moment. The record
  itself — amount, reason, `agreedBy`, `occurredTs` — is the receipt; per
  the operations consult (§4), the honest claim the app can make is that
  "the owner's side recorded it, and the number is legible the next time
  either party looks," not a worker-side digital signature (the worker
  lead has no device, per the 2026-08-03 PRD decision). The next time
  that worker is at a settlement, per the point above, they see the
  running effect of it.
- **A minimal ledger screen**, reachable from Settings alongside the
  farm-profile and (once built) expense-log doors — same "device-level,
  sale-independent concern, own door" pattern S27 and S35 both use: a
  worker picker (reusing `people.ts`'s list), then a per-person screen
  showing the current balance and every ledger entry in order, with
  "+ ให้ยืมเงิน" (log a borrowing) and "+ รับชำระคืน" (log a direct
  repayment) actions. **This is the minimum needed to log and verify a
  balance, not the polished farm-wide report** (filterable, exportable,
  read out to a worker as a formal statement) the epic assigns to S28's
  "per-worker running balance" report, sequenced after this story for
  exactly that reason.

## Corrections

Append-only, matching `CorrectionEvent`/`deduction_voided`/S35's
`ExpenseReversed` exactly:

- A `borrowing_added` or `repayment_recorded` is **never edited or
  deleted**, including for a typo. A wrong amount, wrong shape, or wrong
  person is reversed with `account_entry_voided{targetSeq, reason}` and,
  if a corrected version is needed, logged as a **new, separate** event —
  never a patch to the reversed one (bookkeeping consult §3's "two small,
  clean, individually-auditable events beat one event that secretly
  changed meaning twice").
- A voided entry contributes ฿0 to `balanceSatang` but stays visible in
  the ledger, marked voided — both the entry and its reversal are shown,
  neither is removed.
- **A sale-time repayment is corrected through S29's own `deduction_voided`
  mechanism, not through `account_entry_voided`** — there is nothing on
  the account-store side to reverse, because nothing was written there
  (see "The sale-repayment link"). `account_entry_voided`'s `targetSeq`
  only ever refers to a `seq` in the worker-account store itself.
- Reversing an already-reversed entry is rejected — same rule S35 states
  for `ExpenseReversed`, for the same reason (a double reversal would
  double-count money that only ever moved once).

## Edge cases

- **Repaying more than is owed.** `balanceSatang` goes **negative** — no
  cap, no clamp, matching the owner's own words on the adjacent question
  (S29, "upon agreement... don't do thing exceed or too complex"). A
  negative balance means the farm currently owes the worker (an
  overpayment, or a repayment recorded larger than the running debt) and
  is shown plainly, not hidden or coerced to zero.
- **A balance for a worker who no longer appears in any sale.** The
  balance derivation is keyed by `personId` alone — it does not depend on
  the currently open sale's zone contracts, or on the worker being named
  in *any* sale currently open. `people.ts` archives rather than deletes
  (a person referenced by a past settlement stays resolvable), so a
  worker's account remains readable from the Settings ledger screen even
  after they stop appearing in new sales. There is no dedicated
  farm-wide balance report in this story (that is S28's) — but nothing
  about this story's model makes such a worker's balance unreachable or
  incorrect; it is simply not surfaced anywhere but that per-person
  screen until S28 builds the list.
- **A repayment recorded with no prior borrowing.** Not rejected — the
  sum is a plain arithmetic total with no per-loan matching (see "Telling
  the two shapes apart"), so this simply produces a negative balance, the
  same as "repaying more than is owed" above. A real reason this can
  happen honestly: the borrowing that explains it hasn't been entered
  yet (see the next edge case) or was entered on paper and never brought
  into the app before this repayment was.
- **Two sales on the same day.** No special handling needed — the balance
  is a sum over every sale's log plus the account store's own log; nothing
  about the derivation depends on same-day sales being distinguishable
  from each other, only on each sale's own `seq`-ordered events (unrelated
  concern, already solved per-sale by FR-12.5).
- **A borrowing recorded after the repayment that settles it
  (out-of-order entry).** Because `balanceSatang` is a **sum**, not a
  matched pairing of specific borrowings to specific repayments, the order
  in which the two events are *typed into the app* does not affect the
  arithmetic result once both exist — commutativity does the work.
  `occurredTs` is used to order the **ledger's displayed rows** (so a
  human reading it back sees "borrowed, then repaid" in the true order
  things happened, not the order they were typed), but never to gate
  whether an event can be appended — a repayment recorded before its
  borrowing is entered is accepted exactly like the previous edge case,
  and simply reads with an odd-looking negative balance until the
  borrowing catches up. No validation blocks this; per-loan sequencing is
  exactly the "amortisation schedule" complexity the owner asked this
  story to avoid.

## Offline / sync behavior

Checked against `docs/checklists/offline-sync-checklist.md`.

- [x] **Fully usable with no network connection.** `borrowing_added`,
      `repayment_recorded`, and `account_entry_voided` are ordinary
      append-only events through the same store shape every other local
      write in this app already uses. The balance derivation reads only
      local stores (the new worker-account log, plus `store.load()` over
      local sale logs) — nothing here makes or requires a network call.
- [x] **Local writes made while offline are queued/persisted correctly.**
      The new store inherits `store.web.ts`'s `localStorage`
      `read`/`write` pattern and `store.native.ts`'s WAL + per-row
      `INSERT` pattern verbatim (see "Where the account lives"), proven
      again by its own adapter tests (Test plan), not assumed by analogy.
- [ ] **Sync triggers on reconnect / manual sync.** N/A — no backend
      exists yet (`docs/architecture.md` §"Sync engine": "not built"). The
      new store carries `pending()`/`markSynced()` for the same reason
      `store.ts` does, so a future sync engine finds an outbox waiting for
      it with no rework here.
- [x] **Conflicting local/remote changes.** N/A for the same reason as
      S29/S35 — single-writer, device-local, monotonic `seq`, no
      concurrent-writer conflict class exists yet. Worth flagging for
      whoever designs sync later, same as S29 already flags: because
      correction is always a new event referencing a `targetSeq`, two
      devices could each append a borrowing and its void concurrently with
      no field-level merge needed — the shape doesn't add a new conflict
      class.
- [x] **Partial/failed sync leaves local data consistent.** N/A, no sync
      exists to fail partially. Worth restating the one real hazard this
      story removes rather than merely avoids: because a sale-time
      repayment writes to only **one** store (the sale's own log; see "The
      sale-repayment link"), there is no two-store write in this story
      that a crash could leave half-done. The off-sale `borrowing_added`/
      `repayment_recorded` writes are each a single event to a single
      store, same durability profile as every other write in the app.
- [ ] **Visibility into sync status.** N/A, no sync exists yet — matching
      `people.ts`/`farmProfile.ts`/S35's expense log, none of which
      surface one either.
- [x] **No data loss scenario identified.** Every event, once appended, is
      never overwritten; a correction always appends rather than replaces.

## Test plan

Written to fail first, then implemented to green, per `docs/process.md`.

**`src/core/workerAccount.test.ts`** (pure derivation, no store):

- [ ] A single `borrowing_added` produces `balanceSatang` equal to its
      `amountSatang`, `shape` carried through to the ledger row.
- [ ] A `borrowing_added` followed by a `repayment_recorded` for a smaller
      amount produces `balanceSatang = borrowed − repaid`.
- [ ] A `repayment_recorded` larger than the total borrowed produces a
      **negative** `balanceSatang` — no throw, no clamp.
- [ ] A `repayment_recorded` with no prior `borrowing_added` at all
      produces a negative `balanceSatang` — not rejected.
- [ ] A `PersonSaleDeduction` with `category: 'repayment'` is folded into
      `balanceSatang` exactly like a `repayment_recorded` from the account
      store — same sign, same arithmetic weight; the test constructs one
      of each summing to the same total and asserts identical
      `balanceSatang`.
- [ ] A `PersonSaleDeduction` with `category` other than `'repayment'`
      (e.g. `'input_charged'`) contributes **nothing** to `balanceSatang` —
      only `repayment` draws the account down.
- [ ] `account_entry_voided` referencing a `borrowing_added`'s `seq` marks
      it `voided: true` in the ledger and removes its contribution to
      `balanceSatang`, while the entry itself remains present (per the
      correction rule).
- [ ] A voided `PersonSaleDeduction` (i.e. `deduction_voided` in the
      source sale) contributes ฿0 to `balanceSatang` — proving the balance
      reads the same voided/non-voided fold S29's projection already
      computes, rather than reimplementing it.
- [ ] The ledger is sorted by `occurredTs` regardless of the order events
      were appended (`seq`) — a borrowing appended after a repayment that
      logically precedes it (by `occurredTs`) still displays in
      chronological order.
- [ ] `isValidAccountAmount(0)` / `(-100)` are `false`;
      `isValidAccountAmount(1)` is `true` — mirrors S29's
      `isValidDeductionAmount`.

**`src/store/workerAccount.web.test.ts` / `workerAccount.native.test.ts`**
(following `store.web.test.ts` / `store.native.test.ts`'s exact pattern):

- [ ] Appending a `borrowing_added` persists it; `load()` returns it after
      a fresh instance is constructed against the same fake storage
      (proves durability, not just in-memory state).
- [ ] `appendAll` with a duplicate `seq` anywhere in the batch rejects the
      whole batch and writes nothing (web: assert zero/one `setItem` calls
      as appropriate; native: assert the transaction rolls back).
- [ ] `load()` returns events ordered by `seq`.
- [ ] (native only) a batch runs inside exactly one
      `withTransactionAsync`, matching `store.native.test.ts`'s existing
      assertion style.

**Cross-sale link test — `src/store/workerBalance.test.ts`** (this is the
test that proves the "one canonical event" property, not just the pure
math above):

- [ ] Build two `MemoryStore` sales, each with a `deduction_added{personId:
      P, category: 'repayment', amountSatang: N}`. Load the person's
      balance via the real `loadPersonSaleDeductions` + `deriveWorkerAccount`
      path (not a hand-built fixture) and assert `balanceSatang = -2N`.
- [ ] For one of those two sales, also call `settle()` and assert
      `payoutSatang` for P reflects the same `-N`. Assert both numbers came
      from reading the identical event (same `seq`, same `saleId`) —
      mutate/remove that one event from the `MemoryStore` and recompute
      both; both change together, proving there is no second, independent
      write either one could have drifted from.
- [ ] Void the `deduction_added` in one sale via `deduction_voided`;
      recompute the balance and assert it returns to `-N` (only the
      un-voided sale's repayment still counts) with no action taken on the
      worker-account store.

**Component tests (Settings ledger screen, RTL/jest-expo)**:

- [ ] A worker with `balanceSatang > 0` renders the balance, labelled as
      owed by the worker; `balanceSatang < 0` renders labelled as owed to
      the worker (or credited); `balanceSatang === 0` renders the "no
      balance" state.
- [ ] The ledger lists every entry (borrowing and repayment, direct and
      at-sale) in `occurredTs` order, with shape shown for borrowings and
      voided entries visually marked.
- [ ] The borrowing-entry form's confirm action is disabled until
      `shape`, `amountSatang`, `reason`, and `agreedBy` are all filled.
- [ ] Opening the ledger screen with **zero sales ever created on the
      device** still opens successfully and shows an empty ledger — proves
      the "sale-independent" property, matching S35's own equivalent test.

**Component tests (settlement screen — extends S29's existing suite)**:

- [ ] A worker with a non-zero balance and **no deduction this sale**
      still renders the balance line on their card — the case S29's own
      deduction block does not cover.
- [ ] A worker whose deductions this sale include a `repayment` renders
      both the before- and after-balance figures, and the after figure
      equals before minus that repayment's amount.
- [ ] A worker with `balanceSatang === 0` and no deduction renders no
      balance line at all (no clutter, matching S29's equivalent rule for
      zero deductions).

**e2e (Playwright, both viewports per existing convention)**:

- [ ] With no sale ever created, open Settings → the worker-account door →
      pick a worker → log a borrowing (`advance`) → confirm it appears in
      the ledger with the correct balance.
- [ ] Start and close a sale, add a `repayment`-category deduction for
      that same worker at settlement, confirm the settlement screen shows
      the before/after balance, then reopen the Settings ledger for that
      worker and confirm the same balance is shown there too (proving the
      two screens agree, reading the same underlying event).
- [ ] Void that sale-time repayment deduction; confirm both the
      settlement screen and the Settings ledger return to the
      pre-repayment balance.
- [ ] Attempt to log a borrowing with a zero amount, or with no `shape`
      selected; confirm both are refused.

## Thai-first message ids

New entries in `src/i18n/messages.ts`, `th` first (the source), following
the file's existing rules — no `·` bilingual pairs, one entry per id.

| id | Thai | English |
| --- | --- | --- |
| `settings.workerAccounts` | บัญชีคนงาน | worker accounts |
| `settings.workerAccountsNote` | เงินยืมและหนี้ค้างของคนงานแต่ละคน | borrowing and debt per worker |
| `settings.openWorkerAccounts` | เปิดบัญชีคนงาน | open worker accounts |
| `account.title` | บัญชีคนงาน | worker account |
| `account.back` | ← กลับ | ← back |
| `account.pickWorker` | เลือกคนงาน | choose a worker |
| `account.empty` | ยังไม่มีรายการ | no entries yet |
| `account.balanceOwed` | ค้างชำระ {amount} | owes {amount} |
| `account.balanceCredit` | มีเครดิตเกิน {amount} | overpaid by {amount} |
| `account.balanceZero` | ไม่มียอดค้าง | no balance owed |
| `account.addBorrowing` | + ให้ยืมเงิน | + log a borrowing |
| `account.addRepayment` | + รับชำระคืน | + log a repayment |
| `account.shapeLabel` | ประเภทการยืม | borrowing type |
| `account.shapeAdvance` | เบิกล่วงหน้า (คืนในรอบขายถัดไป) | advance (settled at the next sale) |
| `account.shapeDebt` | หนี้สะสม (ทยอยคืนหลายรอบ) | carried debt (repaid over many sales) |
| `account.amountLabel` | จำนวนเงิน (บาท) | amount (baht) |
| `account.dateLabel` | วันที่เกิดรายการ | date it happened |
| `account.reasonLabel` | เหตุผล | reason |
| `account.agreedByLabel` | ใครเป็นคนตกลง | who agreed it |
| `account.amountRequired` | ต้องระบุจำนวนเงินมากกว่า 0 | amount must be greater than 0 |
| `account.reasonRequired` | ต้องระบุเหตุผลก่อนบันทึก | a reason is required before saving |
| `account.confirmBorrowing` | บันทึกการให้ยืม | save borrowing |
| `account.confirmRepayment` | บันทึกการชำระคืน | save repayment |
| `account.ledgerBorrowing` | ให้ยืม {amount} | lent {amount} |
| `account.ledgerRepaymentDirect` | ชำระคืน {amount} | repaid {amount} |
| `account.ledgerRepaymentAtSale` | ชำระคืนที่การขาย {amount} | repaid at a sale {amount} |
| `account.voidTitle` | ยกเลิกรายการนี้ | void this entry |
| `account.voidReasonPlaceholder` | เหตุผลที่ยกเลิก | reason for voiding |
| `account.voidConfirm` | ยืนยันยกเลิก | confirm void |
| `account.voided` | ยกเลิกแล้ว | voided |
| `settle.balanceBefore` | ยอดค้างก่อนหน้า | balance before |
| `settle.balanceAfter` | ยอดค้างคงเหลือ | balance remaining |
| `settle.balanceCreditNote` | เจ้าของติดค้างคนงาน | the farm owes the worker |

## Still open

Nothing blocking this story's `Ready` status, but three things the owner
should confirm before or during implementation rather than have guessed:

1. **Does a sale-time `advance`-category deduction (S29) also originate a
   balance increase here, symmetric to how a `repayment`-category
   deduction draws it down?** This story deliberately wires only
   `repayment` (task-scoped, and the only direction whose real-world
   meaning is unambiguous: cash is being clawed back from a share already
   earned). S29's own text names `advance` as a category the owner "will
   use starting today" but leaves open exactly what recording one *does*
   beyond labelling a deduction — and a `deduction_added` can only ever
   *reduce* that sale's payout, which sits oddly against "cash given to
   the worker ahead of pay" unless what is actually being recorded is a
   worker being paid *less* today because an advance already happened
   off-book. Wiring this wrongly risks inverting or double-counting a
   balance, so it is left unresolved here rather than guessed. If the
   owner confirms the symmetric reading, the fix is small: treat
   `deduction_added{category:'advance'}` the mirror image of `repayment`
   in `loadPersonSaleDeductions`'s consumer (add instead of subtract).
2. **The Settings ledger screen this story builds is the minimum needed
   to log and verify a balance — a worker picker plus one person's ledger
   and balance.** It is explicitly not the polished, farm-wide, "show
   every worker's balance at a glance" report the bookkeeping consult
   ranks as a must-have (§5) — that is S28's per-worker running-balance
   report, sequenced after this story on purpose ("built once against the
   final money model"). Flagging so nobody mistakes this story's minimal
   screen for S28 already being done.
3. **The generic device-log helper** proposed under "Where the account
   lives" (factoring `workerAccount.ts` and S35's `expenses.ts` onto one
   shared implementation) is a nice-to-have raised for whichever story
   lands second to pick up — not a blocker for either, and not decided
   here as a requirement.

## Verification

## Dev notes

## Code review

- Reviewer (separate agent/session):
- Findings:
- Resolution:

## QA notes
