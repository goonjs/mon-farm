# Bookkeeping consult — expenses, deductions, reports (mon-farm)

Prepared for the mon-farm product owner, grounded against `docs/prd.md`,
`docs/epics/epic-2-second-field-round.md` (S28, S29), and the current
`src/core/types.ts` / `src/core/settle.ts`.

---

## 1. Expense vs. deduction — and why conflating them bites you

**An expense is the farm's cost.** It reduces the farm's own profit and has
nothing to do with any one worker's pay. Fertiliser for the whole zone,
diesel for the truck that hauled the rubber to the ล้ง, a repair to the
weighing scale — these are money the farm spent to run the business, full
stop.

**A deduction is a transfer between the owner and a specific worker,
against money that worker already earned in a specific sale.** ค่าปุ๋ย
charged to one tapper because the owner fronted the fertiliser and is
recovering it from that person's share; an advance the worker took last
month, now recovered from this settlement — these move money from one
pocket (the worker's share) to another (the owner's), and the total the
buyer paid does not change by one satang.

The app already gets the second half of this right: S29 is explicit that a
deduction event carries `personId`, amount, reason, and who agreed it, and
that it comes off *after* the split, from that worker's own share, leaving
the sale's gross and the owner's total untouched. That is the correct
bookkeeping shape — a deduction is not a cost to the farm's P&L, it is a
netting entry against a payable.

**Why conflating them causes real trouble — a concrete example.** Say the
owner buys ฿3,000 of fertiliser and wants to recover it from three tappers
who share one zone, ฿1,000 each. If that is logged as one lump "expense of
฿3,000" with no worker attached, three things go wrong the first time
anyone needs the record:

1. **The farm's own profit looks wrong.** If it is coded as a deduction
   (money returned to the owner) but the owner also books it as a farm
   expense somewhere else, the ฿3,000 is subtracted twice — once from the
   worker's pay, once from the farm's own margin — and the farm looks
   ฿3,000 poorer than it is. If it is coded as a pure expense and never
   linked to the workers who actually repaid it, the farm's books show the
   cost but not the recovery, and profit looks ฿3,000 poorer permanently.
2. **A worker cannot be shown *why* their pay was short.** If the owner
   ever needs to answer "why did I only get ฿4,000 this time, I counted
   50 baskets" — and per the PRD this exact dispute-resolution use case is
   Success Criterion 6 — a lump farm expense with no per-worker linkage
   gives no answer. A deduction record naming that worker, that amount,
   that reason answers it in one line.
3. **It cannot be split three ways correctly if the tappers' shares of the
   zone differ**, or if one of them already paid off part of the fertiliser
   in cash. A single blob can't be un-blended after the fact; three
   separate ฿1,000 deduction events, one per worker, can always be summed,
   audited, or individually reversed.

The rule to hold onto: **if money still belongs to the farm and never
touches a worker's share, it's an expense. If it moves between the owner
and a named worker against what that worker earned, it's a deduction.**
Every record needs to declare which one it is at creation time — never
inferred later from context, because by the time someone is trying to
reconstruct it, the context is gone.

---

## 2. What each record must carry to be worth anything later

| Field | Expense | Deduction | Non-negotiable? |
| --- | --- | --- | --- |
| **Amount** | required | required | **Non-negotiable.** Without it there's nothing to record. |
| **Date/timestamp** | required | required (already free — it's an event) | **Non-negotiable.** "When" is what lets you reconstruct a month, a season, a dispute window. |
| **Category** (what kind of cost/deduction — ค่าปุ๋ย, ค่าซ่อม, เงินยืม, ...) | required | required | **Non-negotiable.** A pile of "misc ฿500" entries is unauditable and untrend-able; you cannot answer "how much did fertiliser cost me this year" without it. |
| **Counterparty** — who was paid, or which worker it's against | required for expense (who was paid / what it was for) | **required** for deduction — this *is* the record, per FR-7.3 / S29 | **Non-negotiable for deductions** (no counterparty = it isn't a deduction, it's just an unexplained shortfall). For a farm expense with no named vendor (e.g. cash-bought diesel), a free-text note stands in. |
| **Reason / description** | required | required (S29 already mandates this) | **Non-negotiable.** "ค่าปุ๋ย" alone is thinner than "ค่าปุ๋ยสูตร 15-15-15 สำหรับโซนเหนือ" but even the short version beats nothing — what's non-negotiable is that *some* human-readable reason exists, not its length. |
| **Who agreed it** (actor) | nice to have for a farm-only expense the owner made alone | **non-negotiable** for a deduction — it's money coming out of someone else's pocket, and S29 already requires it | See left. A deduction with no record of the worker's side agreeing to it is the single likeliest source of a dispute the app exists to prevent. |
| **Evidence** (receipt photo, note referencing a physical slip) | nice to have, valuable at tax time | nice to have, valuable if disputed later | **Nice to have, not non-negotiable at MVP.** It upgrades a record from "the owner says so" to "here's the receipt," which matters a lot once a real accountant or the tax office ever looks at the books — but the app can ship a workable log without a camera/attachment feature on day one. Flag it as the natural next increment once basic logging exists. |

**Bottom line for the data model:** amount, date, category, reason are
non-negotiable for *every* record. Counterparty and "who agreed" become
non-negotiable specifically for anything that is a deduction (money moving
against a person), because that's the whole point of the record. Evidence
is valuable but can be deferred without breaking the core promise.

---

## 3. Append-only and corrections — does it match sound practice?

**Yes — this is exactly how a paper journal or ledger is supposed to work,
and better than what most small operations actually do.** In traditional
bookkeeping you never erase a wrong entry in a journal; you strike it through
(or, in double-entry practice, post a reversing entry) and write the
correct one, so the record shows both the mistake and the fix in the order
they happened. That is precisely what `CorrectionEvent` in this codebase
already does for baskets ("counted 41, corrected to 40" — FR-5.4, NFR-3),
and it is precisely the model to extend to expenses and deductions: a
correction is a **new event that references the old one**, never an edit
or a delete.

**What this implies concretely for a mistaken expense or wrongly-applied
deduction:**

- **Never delete or edit the original record.** A ฿3,000 fertiliser
  deduction entered against the wrong worker must not be changed to say
  ฿0 or to point at the right worker — that destroys the evidence that a
  mistake happened, which is itself sometimes the important fact (e.g. if
  the worker disputes it later and the timeline matters).
- **Reverse it with a new event of equal and opposite effect, referencing
  the original by its id/seq**, exactly the way `CorrectionEvent` carries
  a `targetSeq` and a `reason`. For a deduction that's a "deduction
  reversed" event pointing at the deduction it cancels, with its own
  reason and its own "who agreed" actor (reversing a deduction is itself
  something the worker should be told about and ideally consent to, same
  as applying one).
- **Then, if it was simply misattributed, log the correct one as its own
  new event** rather than trying to "fix" the reversed one in place — two
  small, clean, individually-auditable events beat one event that
  secretly changed meaning twice.
- **The settlement/report layer must fold these consistently**: a
  reversed deduction should net to zero in the total shown to the worker,
  while both the original and the reversal remain visible in the log for
  anyone who scrolls back — the same relationship `settle()` already has
  with voided baskets (a void never deletes the `accept` event, it just
  stops it contributing to totals).

This is good bookkeeping practice, not a compromise forced by the
architecture — an accountant reviewing a journal that has been edited in
place (no reversal trail) would rightly distrust it. Keep this shape for
expenses and deductions with no exceptions, including for typos: even a
"I mistyped ฿300 as ฿3,000" gets a reversal + a correct new entry, never
an in-place fix.

---

## 4. What records a small Thai farm realistically needs, and what for

Four purposes, in the order the owner will actually need them:

1. **Paying workers correctly, and being able to show it.** This needs:
   every sale's settlement (already built), every deduction applied to
   every worker with reason and who agreed it (S29), and ideally a running
   per-worker balance across sales so "how much have I paid/owe this
   person this month" is answerable without adding up slips by hand. This
   is the record a worker will ask to see if they think they were
   underpaid — Success Criterion 6 in the PRD depends on this existing and
   being legible.
2. **Knowing whether the farm made money.** This needs farm-level
   *expenses* (fertiliser, fuel, scale maintenance, hired labour that
   isn't tapping-share labour, transport) logged against a category and a
   date, set against total sale revenue (already computed) minus the
   owner's split of the money paid to workers. Without an expense log this
   question literally cannot be answered — the app currently only knows
   about revenue and worker payouts, not farm costs, which is why "a log
   of expenses" is a real gap, not a nice-to-have.
3. **Settling a dispute.** This needs the append-only audit trail already
   designed (FR-12, NFR-3) extended to expenses and deductions with the
   same non-negotiables from §2 — amount, date, category, reason,
   counterparty, and who agreed. A dispute is resolved by pointing at one
   line in the log, not by reconstructing memory.
4. **Tax time.** *A real accountant must confirm this — I am not stating
   Thai tax law or filing requirements as fact.* What I can say generically
   and safely: tax authorities anywhere typically want to see, at minimum,
   total revenue, categorised costs, and some form of dated, described
   record for each — which is exactly the shape of the expense log in §2.
   Whether a farm of this size and structure has any filing obligation at
   all, what threshold might apply, what records are legally required to
   be retained and for how long, and whether cup-lump sales or worker
   settlements carry any withholding or reporting obligation, are all
   questions **a real accountant or Thai Revenue Department guidance must
   answer** — do not build compliance features against my guess. What the
   app can safely do without knowing any of that: keep clean, dated,
   categorised, exportable records, because whatever the actual rule turns
   out to be, an inspectable log is a precondition for meeting it, never a
   liability.

---

## 5. Reports to insist on — ranked, with the question each answers

An owner with a phone in a field will not read a P&L statement. Keep the
list short.

**Must-have**

- **Sale settlement report (already built, S28 extends it).** *"For this
  sale, who got what, and why?"* Per-zone, per-pile derivation down to the
  final owner/worker split. This is the trust mechanism the whole product
  is built around — it already exists, keep it as-is.
- **Per-worker running total, across sales, in a date range.** *"How much
  have I paid this person this season, and what deductions did I take from
  them?"* This is the report that prevents the single biggest dispute risk
  (§6) and the one the owner will reach for most often once more than one
  sale exists.
- **Expense log, filterable by category and date.** *"What have I spent,
  on what, this month/season?"* The minimum viable answer to "is the farm
  making money." One flat list with amount/date/category/reason is enough
  at this size — no charts needed yet.

**Should-have**

- **Farm-level profit-ish summary: total sale revenue − owner's share of
  worker pay − total expenses, for a date range.** *"Am I ahead this
  season?"* This is the natural join of the must-haves above — cheap to
  build once they exist, and the question every owner eventually asks.
  Call it a summary, not a "P&L," to avoid implying accounting rigor it
  doesn't have.
- **Deduction log per worker, exportable/showable to that worker.** *"Can
  I show this specific person exactly what was taken from their pay and
  why, across every sale?"* Distinct from the running total above because
  it's the artifact you hand to or read out to the worker, not just a
  number.

**Later**

- **Zone/pile productivity over a season** (which zone earns most per
  basket, trending). Interesting, not urgent — it's an agronomy-adjacent
  question and the PRD explicitly keeps agronomy out of v1.
- **Anything tax-shaped** (a categorised annual expense summary formatted
  for handing to an accountant). Valuable eventually, but build it once an
  actual accountant specifies the shape needed — see §4's caveat.
- **Exported/printable formats** (PDF, share sheet) — already an open PRD
  question (FR-10.2) and rightly deferred; on-device readability comes
  first.

---

## 6. The single biggest mistake I expect, and what the app can do about it

**The mistake:** the owner will, at some point under field pressure, log a
worker deduction as a bare number with no reason and no record that the
worker agreed to it — "took ฿500 off กมล's share" and nothing else — because
in the moment it's obvious to the owner why, and typing a reason feels like
friction while someone is standing there waiting to be paid. Three sales
later, neither the owner nor the worker remembers why, and the one number
in the whole system that is *supposed* to prevent a dispute is the one that
can't survive being questioned.

This is the expense/deduction distinction from §1 failing in its most
common real shape: not confusing the two categories, but under-recording
the deduction category specifically, because it's the one taken under
social pressure at the moment of paying someone standing in front of you.

**What the app can do to prevent it**, in order of how much it costs to
build:

1. **Make reason and "who agreed" required fields on the deduction form,
   not optional ones** — the UI should not let a deduction event be
   created without them, mirroring how `settle()` already refuses to run
   without a split basis (FR-8.5's "no safe default" pattern applied to
   deductions). If the field is skippable, it will be skipped exactly when
   it matters most.
2. **Show the worker's own running deduction total on the settlement
   screen at the moment the deduction is entered** — so the owner sees the
   cumulative effect on that person's pay before confirming, not just this
   one line. This turns the pressure the other way: it becomes harder to
   wave through an unexplained deduction when the running total is right
   there.
3. **A short list of preset categories (ค่าปุ๋ย, เงินยืม, ค่าซ่อม, อื่นๆ)
   with a free-text detail field**, rather than a blank text box — presets
   lower the friction of doing it right, which is the actual lever, since
   the owner isn't being careless, they're being fast.

None of this needs new architecture — it fits the event log and the
"no safe default" pattern the codebase already uses for the split basis;
it's a UI/validation discipline applied to the deduction form specifically,
at the moment the field author writes S29.
