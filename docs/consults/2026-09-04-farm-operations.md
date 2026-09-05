# Operations advisory: expenses, worker deductions, and reports on a cup-lump farm

Written against `docs/prd.md`, `docs/epics/epic-2-second-field-round.md` (S28,
S29), `src/core/settle.ts`, `src/core/types.ts`. Read-only consult — no files
changed.

## Headline answer

**Expenses and worker deductions are two different concepts that happen to
look similar on a spreadsheet.** They differ on every axis that matters for
trust: who bears the cost, when it's agreed, who has to sign off, and what a
dispute over it even looks like. S29 as written ("ค่าปุ๋ย and other expenses
deducted per worker," one `deduction_added` event, always comes off the
worker's own share) quietly collapses them into one. That will be right for
some of what the owner is asking for and wrong for the rest, and the wrong
part will surface as either the worker being shorted for the farm's own
cost, or the owner losing visibility into a real farm expense because it got
buried inside somebody's payout line.

The one-sentence test that separates them: **"whose money was this before
today?"** If it was already earmarked as the worker's share and something is
being taken back out of it (an advance, a broken tool the worker is
responsible for, a personal loan), it's a deduction. If it's a farm operating
cost that the owner would incur regardless of who worked the zone today
(fertiliser, fuel for the truck, everyone's lunch), it's an expense, and it
should never touch a worker's settlement line at all — it belongs in the
owner's own books.

## 1. What money actually moves on a selling day, beyond the buyer's payment

This list is what I've seen recur on farms of this shape (small-to-medium
holding, cup-lump, hired/family tapping crew, informal but real bookkeeping).
I flag confidence level on each — see §6 for where you should verify with the
owner directly.

| Thai | Gloss | Recurs how often | My confidence |
|---|---|---|---|
| **เงินเบิกล่วงหน้า** | Advance against future pay — worker asks for cash before payday, farmer notes it, deducts later | Common, irregular timing | High — this is the single most common "deduction" and the one most likely to be disputed |
| **ค่าปุ๋ย** | Fertiliser cost, when the farm fronts it and recoups from the worker's share (common in some sharecrop arrangements) or when it's simply a farm input cost (common in wage arrangements) | Per fertiliser cycle (a few times a year), NOT per sale | High that it recurs; **medium-low** on which bucket it falls into by default — this is genuinely contract-dependent, see below |
| **ค่าอาหาร / ค่ากับข้าว** | Food/meals provided on a work day or sale day | Per work day or per sale day, if the owner provides food | High it exists somewhere; whether it's ever actually deducted from a worker (vs. just an owner cost of doing business) is lower confidence |
| **ค่าน้ำมัน / ค่าขนส่ง** | Fuel/transport — moving rubber to the ล้ง, or the buyer's truck coming to the farm | Per sale (if the farm transports) | High it exists; who bears it is very deal-specific — sometimes it's netted into the agreed price instead of itemised at all |
| **ค่าเครื่องมือ / อุปกรณ์** | Tools/equipment — a mia, a knife, a basket that breaks or is lost | Occasional, lumpy | Medium — I've seen this treated as a genuine worker deduction (worker damaged/lost farm property) far more often than as a shared cost |
| **ค่าเช่าที่ดิน / ค่าเช่าสวน** | Land rent, when the farm itself is rented | Per season/year, not per sale | High it can exist, but this is an owner-level cost that should never appear near a worker's settlement |
| **ดอกเบี้ย / หนี้เก่า** | Interest or old-debt repayment — a running advance balance from a previous season being worked off | Per sale, incrementally | Medium confidence it exists on this farm specifically — ask |
| **ค่าปุ๋ย/ยาฆ่าหญ้า สำหรับกรีดยาง (agronomic inputs for tapping)** | Chemicals, tapping knives, acid/formic for coagulation | Per tapping cycle | High it exists as a farm cost; whether workers ever bear a share is contract-dependent |
| **เงินมัดจำ / ค่าคอมมิชชั่น to a broker** | If a middleman brokered the sale | Per sale, if a broker is used | Low confidence this applies to your specific setup — ask |

The thing to notice: **most of these are not "per sale" events at all.** They
happen on their own clock (§5) and only *get settled* at a sale because a
sale is the moment cash actually changes hands. The sale is a payment
occasion, not the origin of the expense.

## 2. Who bears it — the crux question

This is exactly where "family labour vs hired labour" and "sharecropping vs
wage" split the answer, and I want to be honest that **I do not know which
arrangement this farm runs**, so this section gives you the shape of the
decision rather than a single default.

**The general pattern I've seen:**

- **Wage/day-labour crews** (paid a fixed rate or a fixed % regardless of
  input costs): inputs like fertiliser, tools, and transport are the
  **owner's cost**, full stop. They never touch the worker's pay. What *does*
  come off a wage worker's pay is things that are genuinely theirs to answer
  for: an advance they personally took, a tool they broke through negligence,
  a personal debt. This maps cleanly to "deduction."
- **Sharecropping arrangements** (คนกรีดแบ่งผลผลิต — worker's income *is* a
  share of what the rubber sells for, no separate wage): it is much more
  common for input costs to be split according to the same ratio as the
  produce split, or for the worker to bear a portion of recurring inputs
  (fertiliser especially) because they benefit from the yield those inputs
  produce. In this arrangement, "ค่าปุ๋ย deducted from the worker's share" is
  not a punitive deduction at all — it's a cost-sharing term that both sides
  understand as baked into why the split is 60/40 rather than 50/50 in the
  first place.
- Where it gets genuinely messy: a farm can run **both** at once — a
  fertiliser cost split 60/40 same as produce (a true "adjustment to the
  split basis"), *and* a personal advance deducted 100% from one individual
  worker's pay only. These are mathematically different operations even
  though both end up as a negative number on a worker's line.

**Does "deductions come off AFTER the split" (2026-08-11 decision) match
practice?**

For the advance/personal-tool/personal-debt category: **yes, cleanly.** That
money was never the owner's concern — it left the worker's own pocket-to-be,
and the owner correctly bears none of it. Post-split, per-worker deduction is
exactly right for this category, and I'd defend it strongly against any
push to net it in earlier.

For a genuinely **shared/split cost** like fertiliser under a sharecropping
term: **it does not match practice, if the split percentage itself was set
assuming that cost-sharing already happens.** Concretely: if the contract
says 60/40 *because* the worker also carries 40% of fertiliser cost, then
running fertiliser as a post-split, 100%-off-the-worker's-share deduction
double-charges the worker relative to what "60/40" was understood to mean
when it was agreed. The money model would show a technically-correct
derivation that nonetheless does not match what either party thinks they
agreed to.

**What this means for the data model**: I don't think S29's shape is wrong
for what it explicitly scoped (ค่าปุ๋ย and "other expenses," treated as
100%-worker deductions) — it may simply be *incomplete* for this farm's
actual contract terms, and the gap is invisible until a fertiliser bill
lands on a sharecropped zone. Two things I'd ask the owner directly, because
this is a fact about their contracts, not a design choice:

1. On this farm, when fertiliser (or another recurring input) cost is
   shared with a worker, is the split rate on produce already priced
   assuming that sharing? (i.e., is 60/40 *because of* an implicit
   cost-share, or is it 60/40 on top of separately deducted costs?)
2. Is there more than one worker-arrangement type on this farm at once
   (some zones wage, some sharecrop), or is it uniform?

If the answer to (1) is "the split already prices it in," then a 100%
worker-borne deduction event, applied post-split, is the correct model and
S29 is fine as scoped — the owner should simply never itemise a *shared*
cost through the same event kind as a personal advance, because they are not
the same fact even though the arithmetic (subtract from worker share) looks
identical. I'd want the UI/reason field to force a distinction (see §4)
rather than trust everyone to remember it.

**Recommendation for the data model**: keep `deduction_added` as
100%-off-one-worker (that's correct for advances, personal tools, personal
debt), but do **not** try to make it also carry shared/split costs. If
shared-cost-sharing turns out to be real on this farm, that is a different
mechanism — closer to an adjustment to the zone's split basis or gross,
applied *before* the split, shared across owner and worker at the split
ratio — and it should get its own event kind rather than being forced
through `deduction_added`. Building that mechanism speculatively now would
violate YAGNI; the thing to do now is **ask the owner whether it exists**,
and only build it if the answer is yes.

**Farm-level expenses that never touch a worker at all** (fuel for the
truck, food the owner buys for everyone, land rent, tools the *owner* owns)
are a third, simpler bucket: they are a **farm expense log**, not a
settlement input at all. They don't net against anything in `settle()`.
They exist so the owner can answer "what did this sale/month/season cost
me," not so a worker's payout changes. This is what "a log of expenses" in
the owner's original ask is actually asking for, separate from "deductions
for staff" — and I'd treat them as two distinct features from day one, not
two views onto the same event kind.

## 3. When each is recorded

- **At the gate, during/around the sale**: anything that is *settled in cash
  at the moment of payout* — an advance being paid back, a personal tool
  replacement cost, food bought that day if it's actually charged to someone.
  This has to be on (or reachable from) the settlement screen, because that
  is the one moment both parties are standing there with money changing
  hands and can agree the number on the spot.
- **At settlement, but originated earlier**: an advance is *taken* on some
  random Tuesday, not at a sale. What happens at the sale is the
  **repayment/reconciliation** of a running balance, not the origination.
  This argues for the app carrying a running "owed by worker" balance per
  person that accrues advances whenever they happen (which may be nowhere
  near a sale — the owner needs a way to log an advance the day it's given,
  offline, without a sale open) and only *draws down* against it at
  settlement. If the app only supports recording a deduction inside an open
  sale, the owner will be forced to either hold the advance in their head
  until the next sale (error-prone, exactly what this app exists to fix) or
  invent a fake sale-time event for something that happened weeks earlier
  (falsifying the timestamp, which corrodes the very audit trail the rest of
  the product is built around).
- **Later in the evening / not sale-tied at all**: recurring farm costs like
  fertiliser purchase, land rent, tapping-season chemical costs. These are
  bought/incurred on their own schedule (§5) and just need to be logged
  *when they happen*, independent of any sale being open. This is a strong
  argument that "expense log" is its own screen/flow, not a tab inside the
  sale flow.

**Concretely for the app**: I'd expect two entry points, not one —
(a) an always-available "log an advance / expense" action that doesn't
require an open sale, timestamped honestly to when it actually happened, and
(b) a settlement-time view that shows the running balance per worker and
lets it be drawn down (fully or partially) against today's payout, with that
draw-down being the event that actually changes what cash the worker walks
away with.

## 4. What has to be on the record to be trusted by both sides

This is the part the codebase already gets right for the count and price —
apply the identical discipline here, because a deduction dispute a month
later is *more* likely than a count dispute, not less, precisely because
the worker isn't standing at the scale watching it happen the way they
watch baskets being counted.

Minimum fields, per deduction/expense event:

- **Amount**, in satang, matching the existing money convention.
- **Category** — advance / tool-or-loss / other, at minimum — not a free-text
  blob standing in for structure. The category is what lets you later answer
  "how much has this worker been advanced this season" without parsing prose.
- **Reason**, free text, required (S29 already specifies this — good; keep
  it required, not optional, exactly the same bar `pile_reopened` and `void`
  already meet).
- **Who agreed it, on each side** — FR-7.3 already says "who agreed it," but
  for a deduction I'd push harder than for a price adjustment: the worker
  lead does not log in (PRD decision, 2026-08-03), so "who agreed it" cannot
  mean a worker-side digital signature. It has to mean the same social
  mechanism FR-9 already relies on for the count: **the number is shown to
  the worker at settlement, spoken/read aloud the same way a count is, and
  the actor who entered it is recorded** (almost certainly the owner or
  manager, since the worker lead has no device). That is honest about what
  is actually being attested — the owner's side recorded it and the worker
  was present when it was shown — rather than pretending a signature exists
  that doesn't.
- **When originated vs. when settled** — if advances are logged on their own
  timeline (§3), the record needs both: when the advance was given, and
  which sale's settlement drew it down. Collapsing these into one timestamp
  loses exactly the fact a disputed-a-month-later worker will ask about
  ("I never got that much in June").
- **Running balance, not just the single event** — a worker or owner
  disputing a deduction a month later is disputing a *balance*, not usually
  a single line. The app needs to be able to show "here is every advance
  and every repayment for this person, in order" — which the append-only
  event log already supports structurally (good), but the settlement/report
  UI needs a per-person ledger view, not just a per-sale line, or the audit
  trail exists in the log but is practically unreachable.
- **Voidable with a reason, never edited in place** — S29 already says this;
  it's the right call and consistent with the rest of the model.

**What happens when a worker disputes a deduction a month later**: on a real
farm, this is resolved by memory and reputation more than by paper — but
when it goes badly, it's because the amount, the reason, or the running
balance was never legible to the worker at the time, only to the owner. The
single highest-value thing the app can do here is make sure the number was
*shown and voiced to the worker present at settlement*, the same principle
FR-9 already applies to the count — not just typed into a form the owner
filled in alone that evening. If deductions are only ever entered by the
owner, out of the worker's sight, after the fact, you have reproduced the
exact "verbal, fast-moving process that may exist only in someone's head"
problem the whole product exists to solve, just for money instead of
baskets.

## 5. Cadence — three different clocks

- **Per-sale**: repayment/draw-down of an advance, food/fuel actually
  charged that day, a broken tool discovered/settled that day. These belong
  at settlement time.
- **Per-month (or per pay period, if there is one)**: reconciling a running
  advance balance even without a sale — some farms settle wages/advances on
  a calendar schedule independent of when rubber gets sold, especially if
  there's a lean selling period. If this farm has any fixed pay cadence
  separate from sale days, the "expense/deduction" log needs to be
  queryable by calendar month regardless of which sales fell in it — this is
  a reporting requirement (S28-adjacent), not a settlement one.
- **Per-season / per-tapping-cycle**: fertiliser, chemical inputs, land
  rent, major tool purchases. These follow the agronomic calendar, not the
  selling calendar — a farm can have zero sales for weeks (rain, low
  latex flow) while still incurring fertiliser cost. If the owner wants "a
  log of expenses" to answer "what did this season cost me," it must not be
  modeled as something that only exists inside a sale — it needs to be
  logged the day it happens and rolled up by date range, independent of
  sales entirely.

This is the same distinction as §3, restated as a design constraint: **the
expense log's timeline is the calendar; the settlement/deduction ledger's
timeline is per-worker running balance drawn down at sales.** Trying to make
one screen serve both will make the sale-time screen cluttered with things
that have nothing to do with today's sale (a fertiliser purchase from three
weeks ago), and will make the season-level expense report incomplete if it
only reads from inside sale events.

## 6. What the owner will get wrong or find annoying if this is modeled naively

1. **Treating "ค่าปุ๋ย deducted from worker" and "personal advance deducted
   from worker" as the same event kind with no category.** They'll both look
   like "deduction: ฿500, reason: ปุ๋ย / reason: เบิก" in a flat list, and six
   months later nobody can answer "how much fertiliser cost have I actually
   passed through to workers this season" vs. "how much do workers currently
   owe me in advances" without re-reading every reason string by hand. This
   is a reporting failure waiting to happen, not a settlement bug — fix it
   with a required category field now, cheaply, rather than a data migration
   later.
2. **Forcing every expense through an open sale.** If fertiliser cost can
   only be logged while a sale is open, the owner will either delay logging
   it (memory risk, exactly what this app exists to prevent) or invent
   sale-time entries for things that happened on a different day
   (falsified timestamps, corroding NFR-3's audit story). Give the owner a
   standalone "log an expense/advance" action independent of a sale.
3. **A deduction that silently changes the buyer-facing total.** S29's
   decision (deductions never move the sale gross) is correct and should be
   protected in the UI as forcefully as in the math — if a future story ever
   makes it *look* like the sale total changed because of a deduction (e.g.
   showing "net paid to farm" as gross-minus-deductions on the same summary
   screen as the buyer's figure), the owner will get a phone call from a
   confused ล้ง. Keep the visual separation as strict as the arithmetic
   separation already is.
4. **No running balance view.** If deductions are only visible per-sale,
   the owner has to mentally sum "how much does this worker currently owe
   me" across every past sale by scrolling — exactly the kind of tally the
   product's whole premise is to eliminate. This will get annoying fast for
   any worker with a live advance balance across multiple sales.
5. **Assuming one worker-arrangement type for the whole farm.** If this farm
   mixes wage and sharecrop zones (common when a farm has both family-worked
   and hired-worked plots), a single "how deductions work" rule applied
   uniformly will be wrong for at least one zone. Confirm with the owner
   whether arrangements vary by zone before hard-coding one deduction
   semantics for all zones.
6. **Losing the "shown to the worker" moment.** If deductions are typed in
   by the owner alone, after the fact, with no equivalent of FR-9's public
   display/announcement, the app has built a private ledger the owner
   trusts and the worker has never seen — which is worse than the paper
   tally it replaces, because paper at least gets shown around at settlement
   time by habit. This is worth explicit UX attention in S29, not an
   afterthought.
7. **Assuming reports (S28) can be built from sale events alone.** If
   "a log of expenses" includes season-level costs that never touch a sale
   (land rent, off-season fertiliser), S28's pile/zone/sale rollup has
   nothing to roll up — reports for that category need their own
   date-range query over the expense log, not an extension of
   `saleTotals`/`zoneTotals`.

## What I'm genuinely unsure about — please confirm with the owner directly

- Whether this farm's worker arrangement is wage, sharecrop, or a mix, and
  whether it varies by zone. This single fact determines whether §2's
  "shared cost" concern is real or moot.
- Whether the 60/40-or-50/50 split already prices in any cost-sharing
  (i.e., is the split rate a function of who bears which inputs), or is a
  pure produce-only ratio with all costs settled separately.
- Whether advances are currently tracked at all today (paper, memory,
  nothing), and over what typical period a balance runs before being
  cleared — this tells you whether "running balance across multiple sales"
  is a rare edge case or the normal case.
- Whether there is a broker/middleman in any sales (commission would be
  another distinct expense category I have low confidence is present here).
- Whether meals/fuel are ever actually charged back to a worker on this
  farm, or are uniformly an owner cost in practice (I listed them as
  possible worker-borne items above, but my confidence there is genuinely
  medium at best — this varies a lot farm to farm).

I have not invented any numbers, regulations, or citations above — the
categories and who-bears-it patterns are drawn from general familiarity with
how Thai smallholder rubber operations of this kind are typically run, not
from a specific study of this farm, and the confidence flags above are meant
to be taken literally as "verify this."
