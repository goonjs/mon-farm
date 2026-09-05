# Story: The expense log

Status: **Ready** — 2026-09-05

## Context

- Epic: `docs/epics/epic-2-second-field-round.md` (§S35, "Amendment,
  2026-09-04 — the money around the sale")
- Related PRD section(s): FR-12 / NFR-3 (append-only audit trail — extended
  here to a record that is not a sale event); the PRD's out-of-scope list
  does not mention expenses at all, which is itself the gap this story fills
- Related architecture section(s): `docs/architecture.md` §Local data layer
  (one table, no migration surface, `synced_at` outbox pattern) — this story
  proposes extending that shape rather than the per-sale event log; see
  **Architecture question** below, which is **not decided by this story**
- Related consults: `docs/consults/2026-09-04-farm-operations.md` (§1–§2,
  §5, §6.2/6.7 — the three-clock argument and "never force an expense
  through an open sale"), `docs/consults/2026-09-04-bookkeeping.md`
  (§1–§3 — the expense/deduction boundary and the append-only reversal
  pattern)
- Depends on: nothing in-flight. Deliberately independent of S29/S34
  (worker deductions and the worker account) — the whole point of this
  story is that an expense never touches either.
- Do **not** touch `docs/stories/s29-worker-deductions.md` or
  `docs/ux/mobile-audit.md` — both are being written by other agents in
  parallel.

## Description

The owner's own money — fertiliser, fuel, food, tools, land rent — is
currently unrecorded by the app. `docs/consults/2026-09-04-farm-operations.md`
and `docs/consults/2026-09-04-bookkeeping.md` independently converged on the
same boundary, and the owner adopted it on 2026-09-04 (epic decisions
table): an **expense** is the farm's own cost and never touches a worker's
settlement line; a **deduction** (S29) moves money between the owner and a
named worker against what that worker earned. The test both consults use:
*whose money was this before today?* An expense answers "it was already the
owner's, and it left the farm." This story builds the expense side only.

The defining constraint is **not** the fields on the record — it is that the
record must not need a sale. Expenses run on three clocks the consults name
explicitly: **per-sale** (fuel for today's trip to the ล้ง, food for the
crew), **per-month** (nothing tidy — a bag of fertiliser bought on a
Tuesday), and **per-season** (land rent, a fertiliser cycle, weeks where the
farm sells nothing at all because of rain). A design that only offers "log
an expense" from inside an open sale forces the owner to either delay entry
until the details are half-remembered, or backdate the entry into whichever
sale happens to be open — and a backdated timestamp is a falsified one, in
an app whose one product claim is that its timestamps can be trusted
(NFR-3). So "log an expense with no sale open, dated to when it actually
happened" is not an edge case here — it is the first-class path the whole
story exists to build, and every acceptance criterion below is written to
protect it.

This story is the **record and its own screen only**. It does not touch
`settle()`, does not appear on any settlement or payout, and does not build
the expense report (that is S28, which reads this log by date range once it
exists — per the epic, S28 is sequenced after S35 for exactly this reason).

## Architecture question — needs the owner's decision before a dev builds this

`CLAUDE.md` is explicit: no architecture content is invented ahead of the
owner, and a story does not start implementation without an agreed shape.
This is that open question, not a decision.

**The problem.** An expense is a *record*: append-only, corrected only by
reversal, kept as evidence the same way a basket is. But it is not a *sale
event* — it has no `saleId`, because its entire reason for existing is that
it must be loggable with no sale open. Today the codebase has exactly two
shapes for local data, and an expense fits neither cleanly:

1. The per-sale append-only log (`mon-farm:events:<saleId>` on web,
   `events` table keyed `(sale_id, seq)` on native) — append-only and
   evidence-grade, but scoped to one sale by its primary key.
2. Device configuration (`people.ts`, `farmProfile.ts`) — device-scoped and
   sale-independent, but mutable-by-design (a rename, an edit-in-place) and
   explicitly *not* evidence: `farmProfile.ts`'s own header says "nothing
   here is evidence," and `people.ts` archives rather than versions.

**Option A — a new device-level event log of its own.**
A fourth store, `expenses.ts` / `expenses.web.ts` / `expenses.native.ts`,
following exactly the `store.ts` port shape but keyed at the device level
instead of per sale — e.g. one `mon-farm:expenses` key on web, one SQLite
table `expenses(seq, ts, mono, actor, kind, payload)` with no `sale_id` on
native (or `sale_id NULL`-able, see below). `append`/`appendAll`/`load`
carry over verbatim; `seq` becomes a device-global counter instead of a
per-sale one.

- *For:* keeps the existing append-only/evidence contract exactly as-is —
  same ordering discipline (`seq` before `ts`, per `types.ts`'s header),
  same reversal-not-edit shape, same `pending()`/`markSynced()` outbox hook
  the architecture doc already promises for a sync layer that doesn't exist
  yet. A reviewer who understands `store.ts` understands this immediately.
  Clean boundary: nothing about a sale ever needs to know expenses exist,
  and nothing about an expense ever needs a `saleId`.
- *Against:* a fourth persistence adapter pair to write and test (following
  `store.web.test.ts`/`store.native.test.ts`'s pattern exactly, per the Test
  plan below) — real but bounded cost, matching what S27 already paid to
  add `farmProfile.ts` alongside `people.ts`.

**Option B — widen the existing per-sale event log's key space.**
Let a "sale id" of a reserved sentinel (e.g. a constant `DEVICE_LOG_ID`) hold
expenses inside the *same* `store.ts`/`store.web.ts`/`store.native.ts`
adapters and the same `SaleEvent` union, adding an `'expense'` /
`'expense_reversed'` event kind.

- *For:* no new adapter files; reuses `appendAll`'s existing atomicity and
  the outbox mechanism verbatim, zero new test scaffolding for persistence
  itself.
- *Against:* conflates two different domains behind one sentinel key that
  exists only to fake a `saleId` an expense doesn't have. `SaleEvent`'s
  variants (`AcceptEvent`, `ShortEvent`, ...) are all genuinely about one
  sale in progress; `projectSale`, `settle()`, and every screen that calls
  `store.load(saleId)` would need to either special-case or filter out the
  sentinel, and a future reader of `types.ts` has to learn "this event kind
  actually has no sale" as an exception to the file's own stated model
  (`SaleId` is documented as the primary partition key throughout). It also
  makes `listSales()` — "sale ids present in the store" — either lie (return
  the sentinel as a sale) or need its own carve-out. This reads as reusing a
  shape that fits a different problem, for the sake of not writing ~60 lines
  — which is exactly the trade `docs/architecture.md` already refused once,
  in the same section, for the web/native store split ("Do not 'simplify'
  this to one adapter").

**Recommendation: Option A.** It costs one more small adapter pair, paid
once, in exchange for `SaleEvent` and `store.ts` staying honestly scoped to
what their names say they are. It also matches the precedent this repo
already set twice — `people.ts` and `farmProfile.ts` are both "a fourth
store, device-scoped, following the same port/adapter shape" rather than
overloads of the sale log — and an expense is closer to those two in scope
(device-level, outlives any one sale) even though closer to the sale log in
*write discipline* (append-only, evidence-grade). Option A is the only one
of the two that keeps both properties true without a special case.

**This is not decided.** Before implementation starts on this story:

1. The owner says yes to Option A (or picks Option B, or another shape).
2. `docs/architecture.md` §Local data layer is updated in the same session
   the decision is made (per `CLAUDE.md`'s "docs are live documents" rule)
   to describe the new store, exactly as it currently documents the
   sale-event table and the (implicit, undocumented today) device-config
   stores. That gap — `people.ts`/`farmProfile.ts` are not yet named in
   `docs/architecture.md` at all — should probably be closed at the same
   time, as a small addition, not as scope creep into this story's code.

Everything below is written against Option A, since it is the
recommendation, but the acceptance criteria that describe *behavior* (what
an expense record contains, where the screen lives, what is out of scope)
hold regardless of which option is chosen — only the Test plan's adapter
tests would change shape under Option B.

## Fields on an expense record

Per the bookkeeping consult (§2) and the operations consult's crux finding
(§1–§2), the fields split into **non-negotiable** and **optional**:

**Non-negotiable — a record without these is not worth keeping:**

- **Amount**, integer satang, matching the existing money convention
  (`types.ts`'s header: ฿26.50 is `2650`). Without an amount there is
  nothing to sum into a report.
- **Date it happened** (`occurredTs`) — **not** `ts`/`mono` (the log's own
  "when this was written" clocks, per `EventBase`). This is the field the
  whole story exists to protect: fertiliser bought last Tuesday is dated to
  last Tuesday, not to whenever the owner got around to typing it in. Kept
  separate from `ts` (when the event was appended) for the same reason a
  disputed record needs both — the bookkeeping consult's §3/§4 point about
  "when originated vs. when settled" applies here too, one level simpler
  (there is no settlement to separate it from, only "when it happened" vs.
  "when it was logged").
- **Category**, a closed enum, not free text — per both consults'
  strongest shared recommendation (ops §6.1, bookkeeping §2's row and §6.3):
  `'fertiliser' | 'fuel-transport' | 'food' | 'tools-equipment' |
  'land-rent' | 'other'`. A free-text field standing in for category is what
  the ops consult calls out by name as the single most common way this goes
  wrong six months later — "misc ฿500" entries that can never be summed by
  kind.
- **Reason/note**, free text, required even for `'other'` — same bar
  `pile_reopened`, `void`, and the S23 bulk-entry reason already meet in
  this codebase: a typed reason, not optional, because a skippable field is
  skipped exactly when it would matter most (bookkeeping §6.1).

**Optional:**

- **Zone** (`zoneId` from the sale it's associated with, if any, or simply
  a free zone name string — see Open question below) — an expense can
  belong to a zone (fertiliser for the north zone specifically) or to
  nothing in particular (land rent for the whole farm). Making this
  required would force a false attribution on every farm-wide cost.
- **Evidence/receipt** — explicitly deferred, see Out of scope below.

**Not fields at all:** no `personId`, no "who agreed it," no counterparty.
The bookkeeping consult's table (§2) makes counterparty and "who agreed"
non-negotiable *for a deduction* specifically, because that is the whole
point of a deduction record — money moving against a named person. An
expense has no second party to agree with; it is the owner recording their
own cost. Adding those fields here would blur exactly the line S29 exists
on the other side of.

**Open question for the owner** (does not block Ready, but blocks the
zone field's exact shape): does an expense's optional zone need to
reference a *specific sale's* `ZoneId` (meaning it can only be tagged once
that sale's zone exists), or a farm-profile zone name (stable across
sales, available even with no sale ever run)? Given S35 must work with zero
sales ever having existed, this story defaults to **a free-text zone label,
matched against `farmProfile.ts` zone names for autocomplete only, never a
hard `ZoneId` reference** — an expense must never become unloggable because
the sale it would reference doesn't exist yet or was never created. Flag
this choice in Dev notes when implemented; revisit if the owner wants
stricter linkage once S28's reports are built against it.

## Append-only and reversal

Matches `CorrectionEvent`'s existing shape (`types.ts`) and the bookkeeping
consult's §3 exactly:

- An expense is **never edited and never deleted**, including for a typo —
  "mistyped ฿300 as ฿3,000" gets a reversal plus a new correct entry, never
  an in-place fix (bookkeeping §3, final paragraph).
- A mistaken expense is reversed by a **new event referencing the
  original's `seq`**, carrying its own required reason — `ExpenseReversed`
  with a `targetSeq` field, the same shape `CorrectionEvent.targetSeq`
  already uses for baskets.
- If the expense was simply wrong (wrong amount, wrong category, logged
  twice), the corrected version is its **own new expense event**, not a
  patch to the reversed one — "two small, clean, individually-auditable
  events beat one event that secretly changed meaning twice" (bookkeeping
  §3).
- A reversed expense **nets to zero in any total or list that sums
  amounts**, while both the original and the reversal remain visible in the
  raw log for anyone who reads it back — the same relationship `settle()`
  already has with a voided `accept` (the void never deletes the original,
  it stops it contributing).
- Reversing an already-reversed expense is rejected outright (see Edge
  cases).

## Where it lives in the app

**Reachable without a sale open, from Settings — its own screen**,
following the exact pattern `farm-profile.tsx` already established (see
`src/app/settings.tsx`'s farm-profile row and that screen's own header
comment for the reasoning this borrows wholesale):

- Settings gains a second door, next to "แก้โปรไฟล์ไร่" — `settings.expenses`
  / "บันทึกรายจ่าย" (label TBD at implementation, see Message ids) — leading
  to `src/app/expenses.tsx`, a list of logged expenses (newest first) with
  a "+ log an expense" action opening a form: amount, date (defaulting to
  today, editable to any past date), category (a closed picker, not a text
  field), zone (optional, autocomplete against the farm profile), note.
- **Why Settings, not the sale list or a sale screen**: the settings screen
  is already, by its own header, "the one screen nobody is standing at a
  scale to use" — reached from the sale list, used roughly-once-per-visit
  rather than mid-count. An expense entry point competing for space on the
  counter or setup screen would be exactly the register violation
  `settings.tsx`'s header warns against for the language switch. Farm
  profile already proved this door pattern works for a device-level,
  sale-independent concern; an expense is the same shape.
- **Also reachable from the sale list** as a secondary link (not required
  by this story to duplicate the full screen — a single link from the sale
  list's chrome to the same `expenses.tsx` screen satisfies "reachable
  without a sale open" without needing two implementations). This is a
  should-have, not a blocker: if the dev's time is short, Settings alone
  meets every acceptance criterion below; the sale-list link is a
  discoverability nicety.

## Out of scope (explicit deferrals, not omissions)

- **Never enters `settle()`.** No expense, in any category, changes a
  worker's payout. `settle()`'s inputs are unchanged by this story — no new
  parameter, no new derivation step.
- **Never changes a buyer-facing total.** The sale's gross, `price_set`,
  and every zone row are untouched. An expense is entirely outside the
  money chain `settle()` computes, the same separation S29 already commits
  to for deductions, one level further out (a deduction moves money between
  owner and worker; an expense never enters the sale's numbers at all).
- **Never appears on a worker's payout slip.** The worker-facing side of
  the app has no reason to ever read the expense log; a future report
  (S28) reading it is a farm-facing document, not a worker-facing one.
- **Receipts / photo evidence — deferred, deliberately.** The bookkeeping
  consult (§2's table, §4 item 4) calls this "valuable, not blocking at
  MVP" — it upgrades a record from "the owner says so" to "here's the
  receipt," which matters once an accountant looks at the books, but
  nothing in this story or in S28's planned expense report depends on it
  existing. Recorded here so it reads as a deliberate choice, not a gap
  nobody noticed — the natural next increment once the log itself is
  proven in the field.
- **The expense report itself (filterable by date/category) is S28's,
  not this story's.** This story is the record and the log screen; S28
  reads this log by date range once both exist, per the epic's ordering
  (S35 before S28, "built once against the final money model").
- **No cross-device sync of any kind is designed here** — see
  Offline/sync below; this is the same "shape prepared, engine not built"
  posture the architecture doc already states for the sale log.

## Edge cases

- **An expense dated before the app existed** (or before this device's
  farm profile/any sale existed). Must be loggable — `occurredTs` accepts
  any past date, including one before the earliest sale on the device or
  before today. There is no lower bound: a farmer catching up on a season
  of paper receipts on day one of using the app is exactly the situation
  this field exists to serve honestly, rather than forcing every historical
  cost to be dated "today" (which would corrupt any later date-range
  report before the app has even shipped its second feature).
- **A zero amount.** Rejected at the form level with a validation message —
  a zero-amount expense records nothing and its presence in a list would
  read as a data-entry mistake every time someone scans the log. (Contrast
  with `short` events, which legitimately can be near-zero; an expense has
  no such case — if nothing was spent, nothing is logged.)
- **A negative amount.** Also rejected at the form level. A negative
  expense is not a thing in this domain — a refund or a price correction is
  a **reversal** of the original event (see above), never a raw negative
  number in the amount field. Allowing negative amounts would let a
  reversal masquerade as an ordinary expense with no `targetSeq`, defeating
  the whole point of the reversal shape.
- **An expense with no zone.** Valid and expected — the optional field
  (see Fields above) must not force a false attribution. Land rent, a truck
  repair, or food for the whole crew are legitimately farm-wide.
- **A reversal of an already-reversed expense.** Rejected. Each expense
  event may be the target of at most one `ExpenseReversed` event; the
  reversal form/action is not offered for an expense that the log already
  shows as reversed, and the underlying write path (whichever store method
  appends it) refuses a second reversal referencing the same `targetSeq`
  rather than silently accepting it. A double reversal would double-count
  money that was only ever spent once.

## Offline / sync behavior

- **Fully usable with no network connection.** Nothing about logging,
  listing, or reversing an expense makes a network call; the screen reads
  and writes only the local store (Option A's device-level log, or its
  chosen alternative). This is the default posture of every store in this
  codebase today (`people.ts`, `farmProfile.ts`, `store.ts`) and this story
  changes nothing about that — there is no sync engine to be offline *from*
  yet, per `docs/architecture.md`'s own "Sync engine: **Not built**"
  section.
- **Local writes made while offline persist correctly** — this is the
  entire premise of Option A reusing `store.ts`'s adapter shape: web
  (`localStorage`, one `setItem` per write/batch) and native (`expo-sqlite`,
  WAL + one `INSERT` per event) both already prove this durability
  contract for the sale log; the new store inherits the same code shape
  and therefore the same guarantee, to be proven again by its own adapter
  tests (see Test plan) rather than assumed by analogy alone.
- **Sync trigger on reconnect**: N/A for this story specifically — no sync
  engine exists for *any* local store yet (sale events, people, or farm
  profile), so an expense log gains no sync behavior other of them don't
  already lack. If/when a sync engine is built, this store's `pending()`/
  `markSynced()` (carried over from `store.ts`'s shape under Option A)
  gives it the same outbox query the sale log already promises.
- **Manual sync trigger**: same as above — N/A, no sync engine exists to
  trigger.
- **Conflict resolution**: N/A — a device-level, append-only, single-writer
  log with a device-local monotonic `seq` has no concurrent-writer conflict
  to resolve at this stage (the same reasoning `farmProfile.ts` and
  `people.ts` currently rely on implicitly, since neither documents a
  conflict strategy either — worth flagging as a shared gap, not something
  to solve uniquely for this story).
- **Partial/failed write state**: `appendAll`, if used for any part of this
  feature (e.g. an expense-plus-immediate-reversal in one user action),
  inherits the existing atomicity contract — all-or-nothing per adapter,
  proven the same way `store.web.test.ts`/`store.native.test.ts` prove it
  for the sale log (see Test plan).
- **Visibility into sync status**: none needed yet, matching `people.ts`
  and `farmProfile.ts` today — neither surfaces a synced/pending indicator,
  and this story does not introduce the first one. If a future sync story
  adds that UI for one device-level store, it should add it for all three
  in the same pass rather than let this log stay the odd one out.
- **No data loss scenario identified**: an expense written to a device that
  is never connected to a backend (this app currently has none —
  `CLAUDE.md`: "No backend yet") is exactly as durable as every other
  record in the app today — durability is a property of the local adapter,
  proven per Test plan, independent of whether a network ever exists.

## Test plan

_Failing-first, per `docs/process.md`'s TDD loop — one test per acceptance
criterion below, written before the implementation that makes it pass._

**Domain / types** (`src/core/*.test.ts` or a new `src/store/expenses.test.ts`
port-contract file, mirroring `src/store/store.test.ts`'s role of proving the
contract against `MemoryStore`-equivalent, whichever store shape is agreed):

- [ ] An expense event requires `amount` (satang), `occurredTs`, `category`
      (one of the six enum values), and a non-empty `reason` — a builder/
      fixture omitting any of these does not type-check or is rejected at
      the append boundary (whichever the chosen shape enforces — TS types if
      Option A's own `ExpensePayload` union, runtime validation if free text
      is allowed and needs rejecting, as amount sign/zero must be).
- [ ] `amount <= 0` is rejected before being appended (unit test on the
      form/domain validation, not just a UI-level check) — one test for
      zero, one for negative.
- [ ] `occurredTs` accepts a date before any event currently in the log,
      including one before the store existed — no lower bound enforced.
- [ ] An expense with no zone is a valid, appendable record (`zone` is
      optional and `undefined`/`null` is accepted, not coerced to an error).
- [ ] `ExpenseReversed` requires `targetSeq` and a non-empty `reason`;
      appending one whose `targetSeq` already has a reversal is rejected
      (either by a domain-level check before append, or the store rejecting
      a second reversal for the same target — pick one layer and test it
      there; document the choice in Dev notes).
- [ ] A projection/summary helper (whatever `s28` will eventually reuse, or
      a minimal one built here just for the list screen) folds a reversed
      expense to zero net contribution while both events remain individually
      visible when the raw log is read back — mirrors the existing
      `settle()`/void relationship test pattern already used for `accept`
      events.

**Store adapters** (new files, following `store.web.test.ts` /
`store.native.test.ts`'s exact pattern — see those files' own headers for
why each exists):

- [ ] `expenses.web.test.ts` — against a fake `localStorage` (same
      `FakeStorage` shape `store.web.test.ts` already uses): appending one
      expense persists it; appending a batch (expense + immediate reversal,
      if the UI ever does this in one action) is a single `setItem` call —
      asserted by counting `setItem` invocations, not inferred from a
      comment; a duplicate `seq` is rejected via `DuplicateSeqError` (or
      whichever error the chosen shape reuses) without partially writing
      the batch.
- [ ] `expenses.native.test.ts` — against a fake `expo-sqlite` (same
      pattern `store.native.test.ts` uses): a batch runs inside exactly one
      `withTransactionAsync`; every event in the batch is inserted inside
      it; a constraint violation surfaces as the domain error and
      propagates out of the transaction callback (proving rollback wiring,
      with the same caveat `store.native.test.ts` states — this proves the
      adapter's wiring, not SQLite's own atomicity guarantee, which needs a
      device and stays open in QA notes); an empty batch opens no
      transaction.
- [ ] `expenses.web.test.ts` / `.native.test.ts` — `list()`/`load()` returns
      events ordered by `seq`, matching `store.ts`'s existing ordering
      contract (`seq` is the ordering authority, never `ts` — same header
      comment as `types.ts`'s `EventBase`).

**UI** (Playwright/e2e, following whatever pattern the existing `e2e/`
suite uses for `farm-profile.tsx` and `settings.tsx` — file names TBD at
implementation, not invented here since `e2e/` was not read as part of this
story's brief):

- [ ] Opening Settings with **zero sales ever created on the device** shows
      the expense log door and it opens successfully — this is the test
      that actually proves the "sale-independent" acceptance criterion,
      not just the domain-level one above.
- [ ] Logging an expense with a past `occurredTs` (e.g. one month back)
      shows that date, not today's date, in the resulting list row.
- [ ] The category picker offers exactly the six values, no free-text
      category field is rendered.
- [ ] Submitting the form with amount `0` or a negative amount blocks
      submission with a visible validation message.
- [ ] Reversing a logged expense requires a typed reason before it can be
      confirmed (mirrors the existing `void`/`pile_reopened` reason-required
      UI pattern — find and reuse that component/flow rather than building
      a second one).
- [ ] A reversed expense is visually distinguished in the list (e.g.
      struck through / marked "ยกเลิกแล้ว") and offers no further reversal
      action on it.
- [ ] Golden path: log an expense with all fields filled, including a zone;
      confirm it appears in the list with every field legible.

**Reconnect / manual sync path**: N/A for this story, per Offline/sync
above — no sync engine exists for any store yet; no test needed beyond
the adapter durability tests already listed.

## Message ids (Thai-first)

Following `src/i18n/messages.ts`'s existing convention (Thai value first in
the file, English mirrored under the same key later in the file — see
`settings.*` / `farmProfile.*` for the pattern this borrows). Exact Thai
wording to be finalized with the owner at implementation time (not invented
ahead of them per `CLAUDE.md`); the ids below fix the *shape*, matching
`farmProfile.*`'s naming:

- `settings.expenses` — the settings-screen row label (parallel to
  `settings.farmProfile`)
- `settings.expensesNote` — parallel to `settings.farmProfileNote`
- `settings.openExpenses` — the button label (parallel to
  `settings.openFarmProfile`)
- `expenses.title` — screen header (parallel to `farmProfile.title`)
- `expenses.back` — parallel to `farmProfile.back`
- `expenses.intro` — parallel to `farmProfile.intro`
- `expenses.empty` — parallel to `farmProfile.empty`
- `expenses.loading` — parallel to `farmProfile.loading`
- `expenses.add` — the "+ log an expense" action
- `expenses.amount`, `expenses.date`, `expenses.category`, `expenses.zone`,
  `expenses.zoneNone`, `expenses.reason` — form field labels
- `expenses.category.fertiliser`, `expenses.category.fuelTransport`,
  `expenses.category.food`, `expenses.category.toolsEquipment`,
  `expenses.category.landRent`, `expenses.category.other` — the six enum
  values as display labels
- `expenses.reverse` — the reversal action label
- `expenses.reverseReason` — the required-reason prompt for a reversal
  (parallel to however `void`'s reason prompt is currently keyed — reuse
  that pattern's id shape rather than inventing a new one)
- `expenses.reversedBadge` — the "ยกเลิกแล้ว"-equivalent marker on a
  reversed row
- `expenses.validation.amountPositive` — shown when amount is zero or
  negative

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
