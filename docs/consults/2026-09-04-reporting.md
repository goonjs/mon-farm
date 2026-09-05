# Reporting for mon-farm — advice to the product owner

Grounded in: `docs/prd.md` (FR-7, FR-10), `docs/epics/epic-2-second-field-round.md` (S28),
`src/core/types.ts`, `src/core/project.ts`, `src/core/totals.ts`, `src/core/settle.ts`,
`src/app/sale/[id]/settlement.tsx`.

---

## 0. What actually exists today, in one sentence

One sale is one event log, on one device, with no cross-sale index yet. Every "report"
that isn't scoped to a single sale currently has no data source to read from — that fact
drives almost everything below.

---

## 1. The report set — ranked

### Must-have

**1. Sale settlement report (S28's scope) — per sale, by zone → pile.**
- *Question it answers*: "What did this sale earn, and how does that break down by zone
  and pile, so I can check it and so each worker can see their own number?"
- *Who / when*: owner and worker lead, immediately after close, often re-opened days
  later when a worker asks "what did I get for that day."
- *Grain*: per sale, drilling to zone, drilling to pile.
- *Fields*: everything `settle()` already derives — basket count, standard/short split,
  net weight, price, gross value, per-zone owner/worker split and percentage, per-worker
  total across zones. Pile-level needs one more fold: `pileTotals()` × the zone's
  resolved price/split, which is arithmetic that already exists, just not applied one
  level down.
- *Why must-have*: this is FR-7.4/7.5 (full derivation, per level) plus a durable,
  re-readable view of it. It is not a new capability so much as making an existing
  screen (`settlement.tsx`) revisitable without having to reopen the sale. Nothing else
  on this list is worth building before this one is right, because every other report is
  a rollup *of* this data.

**2. Worker payout slip — per worker, per sale.**
- *Question it answers*: "What do I owe this specific worker for this specific sale,
  in a form I can show or hand them?"
- *Who / when*: owner, at settlement time, handing a number to the worker lead who
  cannot log in.
- *Grain*: per worker, per sale (already computed as `perWorker` in `Settlement`).
- *Fields*: worker name, zones contributed, gross share, and — once S29 lands —
  itemised deductions and net payout.
- *Why must-have, but only after S29*: the number this answers ("what do I actually
  hand over") is wrong today if a worker has ค่าปุ๋ย or other deductions outstanding.
  Shipping this ahead of S29 means shipping a report that under-deducts a worker's debt
  or omits it — worse than not having the report. This is really the same report as #1,
  filtered to one worker; it does not need its own story, just a per-worker focused view
  of #1's data.

Everything else is should-have or later — deliberately. An owner standing at the gate,
one thumb free, opens at most two things after a sale: "did this sale work out" and
"what do I owe this person." Anything past that is a management-pack instinct this
product should resist.

### Should-have

**3. Sale list with headline figures — across all sales, on-device.**
- *Question*: "Which sales have I run, and roughly what did each come to?" — the
  index you tap into #1 from, not a report in its own right.
- *Grain*: per sale, one row each: date, buyer, farm/zone(s) touched, total kg, total
  ฿, status (open/closed).
- *Data readiness*: **needs new infrastructure, not new events.** Today each sale is
  its own event log; there is no store enumerating "all sales this tenant has run" with
  a cached headline figure. This is a device-level index (like `farmProfile.ts` /
  `people.ts`), not a domain report — but it is the precondition for every report below,
  because they all need to range over more than one sale's log.
- *Sequencing note*: worth pulling forward, because #4–#6 below cannot exist at all
  until this index exists. It is infrastructure wearing a report's clothes.

**4. Zone earnings by month — per zone, monthly.**
- *Question*: "What did zone X earn this month?" (FR-10.3's own example.)
- *Grain*: per zone, per calendar month, summed across every sale that touched it.
- *Data readiness*: **fully answerable by existing per-sale data, once #3's index
  exists.** `zoneTotals` + `settle()`'s per-zone gross already produce the per-sale
  figure; a month report is just `Σ` over sales whose `startedTs` falls in that month,
  grouped by `zoneId`. No new event kind needed.

**5. Worker earnings over time — per worker, across sales.**
- *Question*: "What has this worker been paid, this month / this season?"
  (FR-10.3's other example.)
- *Grain*: per worker (`personId`), across sales.
- *Data readiness*: **answerable today for gross share; needs S29 for net.** `personId`
  is stable across sales (it comes from the shared `people` store), so grouping is sound.
  Before S29 this can only show the pre-deduction share, which will not match what the
  worker was actually handed — label it clearly as "gross share" if shipped before S29,
  or hold it until after, same reasoning as report #2.

### Later (do not build without a new decision first)

**6. Price-per-kg trend — across sales.**
- *Question*: "Is the price I'm getting going up or down?"
- *Data readiness*: **answerable from `price_set` events already in each sale's log**
  (satang/kg, per sale, with a timestamp) — once #3's cross-sale index exists. No new
  event needed. Genuinely cheap once the index exists; ranked "later" only because it
  answers a market question, not an operational one, and the owner did not ask for it.

**7. Yield per zone (kg produced per zone per period).**
- *Question*: "Which zone is producing more rubber?"
- *Data readiness*: **partially answerable, with a caveat that must be stated on the
  report, not hidden.** `zoneTotals` gives kg sold per zone per sale. But "yield" implies
  a rate — kg per tree, per rai, per tapping day — and the app has no record of zone
  area, tree count, or tapping frequency (PRD explicitly excludes production/agronomy
  tracking: "Not a tapping/production management or agronomy tool"). What can honestly
  be shown is **kg sold per zone per period**, not yield. Calling it "yield" would imply
  a denominator the app does not have.

**8. DRC / grade trend.**
- *Question*: "Is the grade I'm getting from this buyer drifting?"
- *Data readiness*: **not answerable at all today.** FR-2.5/2.6's DRC/grade pricing
  mode is not yet in `SysPayload` — there is no `price_set` variant carrying %DRC or
  grade, only `satangPerKg` + `indexRef`. This needs a new event field before any report
  can exist, and it is explicitly out of MVP scope in `settle.ts`'s own header comment.

**9. Price-source reference report (ties to S30).**
- *Question*: "What did the sources say, versus what we agreed?"
- *Data readiness*: needs S30's new `sys` event for logged price references to exist
  first (not yet built, per the epic). Purely presentational once S30 lands — no
  further model work.

---

## 2. What the current event model can answer, vs. what's missing — the specific list

| Report | Event kinds / derived types it reads | Gap, precisely |
| --- | --- | --- |
| #1 Sale settlement, by pile | `AcceptEvent`, `ShortEvent`, `CorrectionEvent`, `sys:price_set`, `sys:split_set`, `sys:zone_contract_set`; `pileTotals()`, `zoneTotals()`, `settle()` | None for zone level. Pile level needs `settle()` extended to fold `pileTotals` × the zone's resolved price/split — same arithmetic, one level down, no new event. |
| #2 Worker payout slip | Same as #1, plus (after S29) a new `deduction_added` event | Blocked on S29 only. |
| #3 Sale list / index | `sys:sale_started`, `sys:sale_closed`, `saleTotals()`, `settle().grossSatang` | Needs a new device-level store enumerating sale ids + cached headline figures (like `farmProfile.ts`). Not a domain-model gap — an infra gap. |
| #4 Zone earnings by month | Same as #1, ranged over sales via #3's index | No new event. Needs #3. |
| #5 Worker earnings over time (gross) | `sys:zone_contract_set` (`personId`, `workerName`), `settle().perWorker`, ranged via #3 | No new event for the gross figure. Needs #3. Net figure needs S29. |
| #6 Price trend | `sys:price_set.satangPerKg`, ranged via #3 | No new event. Needs #3. |
| #7 "Yield" per zone | `zoneTotals().netG` | Not really yield — no tree count / area / tapping-day event exists, and none is proposed. Can only honestly report kg sold per zone per period. |
| #8 DRC/grade trend | — | `SysPayload`'s `price_set` variant has no %DRC/grade field yet (FR-2.5/2.6 not implemented in the event model). Needs a new event or field before any report. |
| #9 Price-source reference | — | Needs S30's new `sys` event (logged price reference), not yet built. |

The single most important structural gap: **there is no cross-sale store today.**
Every report except #1/#2 is blocked on the same missing piece — a per-tenant sale
index — not on separate, unrelated gaps. That argues for building #3 as shared
infrastructure rather than baking a bespoke "load every sale's log and refold it" path
into each report separately.

---

## 3. The sequencing question: should S29 (deductions) come before S28 (reports)?

**Agree, and for a sharper reason than "build the report once."**

The stated reasoning ("deductions before reports, so the report is built once against
the final money model") is correct but understates the risk. The real danger is not
rework — it's a **published number that is wrong in a way nobody notices**. A worker
payout slip built before S29 exists will show a worker's *gross* share as if it were
final. The worker lead cannot log in and cannot cross-check it against anything else
(FR-9's whole cross-check model is visual, at the scale, during counting — it does not
extend to settlement read-back later). If the owner hands that gross figure over as
"what you're owed," and ค่าปุ๋ย is supposed to come off it, the report has actively
misled the one party who has no other way to check it. That is worse than shipping the
report a sprint later.

Two things this argues for narrowing on top of "S29 before S28":

- `settle()`'s `Settlement` type should carry an explicit flag or field distinguishing
  gross share from net payout, so a report can never silently render one where the
  other belongs, even by an integration mistake later.
- If reports must ship before S29 for any reason, report #2 (worker payout) should be
  held back or clearly labelled "before deductions" — never presented as a final number.

---

## 4. Trend and comparison reports

Price/kg, yield per zone, and worker earnings over time are the second-wave reports
owners actually reach for — agreed, they are worth planning for. But be precise about
what changes shape:

- **All of them require ranging over more than one sale.** Today's architecture is one
  event log per sale (`SaleEvent[]` scoped by `saleId`), with no aggregate store. This
  is not a small addition on top of S28 — it's a different feature shape: a query layer
  over N sales, not a derivation over one log. Recommend treating it as its own small
  epic/story (what this doc calls #3 above) once S28/S29 are stable, not as a stretch
  goal bolted onto S28.
- **Price/kg trend** is the cheapest of the three once the index exists — it's one
  field (`price_set.satangPerKg`) times N sales, no new event, and answers a question
  the owner will actually ask ("is my price holding up against last month").
- **Worker earnings over time** is next cheapest (personId already groups cleanly
  across sales) but should wait for S29 so it reports net, not gross, for the same
  reason as report #2.
- **"Yield per zone"** is the one to push back on by name. The app has no agronomy data
  (PRD explicitly excludes tapping/tree/area records as out of scope). What can be
  reported honestly is "kg sold per zone per period" — useful, but must not be labelled
  yield, and should be presented next to that caveat rather than assumed self-evident.

---

## 5. Reading on a phone — presentation

Given: small screen, Thai-first, one-handed, offline, no export target agreed, no
server-side rendering.

- **Never a chart, on principle, for money.** FR-7.4's whole premise is that every
  figure must be checkable by hand, in the order it was derived — a bar or line chart
  compresses exactly the step-by-step legibility the settlement screen exists to give.
  A chart is fine for a *trend* report (#6, price/kg over months) where the point is
  shape-over-time, not an exact figure someone will reconcile against cash in hand.
  Never for a single sale's settlement or a worker's payout.
- **A single leading number, then a table, is the shape that already works.**
  `settlement.tsx` already does this correctly: one big `Figure` (owner total), a
  step-by-step derivation table, then per-zone/per-worker rows. Reports #1 and #2
  should reuse this pattern rather than invent a "report" visual language — the owner
  should not have to learn a second layout for the same numbers.
  - Reason: FR-9.7 (screen-size math for the counter) generalises here too — a phone
    in portrait for reading has plenty of room *vertically*, so a scrolling list of
    rows, each with one bold trailing number, is the right primitive. Landscape (the
    locked orientation per CLAUDE.md) makes this a wide-short viewport, so keep each
    row to label-left, value-right, and let the page scroll rather than trying to fit
    a wide table.
- **What should be a plain summary line, not a table**: anything the owner reads once
  and moves on from — "16 baskets, 780 กก., ฿ 20,400" as a single line at the top of a
  drill-down, before the zone/pile rows. This is what `steps.slice(0, 6)` already
  produces; keep doing it.
- **What should be a collapsible table**: zone → pile breakdown (S28's own scope) —
  collapsed by default to zone rows, expandable to piles, because a multi-zone sale can
  have a dozen+ pile rows and a thumb-scrollable phone screen should not open with all
  of them exposed.
- **Thai-first**: numerals stay Arabic digits per FR-11.12's reasoning (documents two
  parties check by hand) — this should carry over to reports without re-litigating it.
  Labels follow S24's string-catalogue pattern; a report is not a place to reintroduce
  bilingual pairs.
- **No export target yet (FR-10.2 open)**: that's fine for the must-have list — "read
  on the device" is sufic for #1/#2. Do not let "we should support PDF/share" become a
  reason to delay #1; export is explicitly deferred in S28's own scope and should stay
  deferred until the open question (slip? PDF? LINE?) is actually answered.

---

## 6. The trap

**The one I most expect here: building the cross-sale index (#3) implicitly, one field
at a time, hidden inside whichever trend report gets asked for next — instead of once,
deliberately, as its own piece of device state.**

The epic's own S27 story warns about exactly this pattern in a different corner of the
app ("implicit inheritance means a one-off change silently becomes next month's
default, and the owner cannot see what the app decided to remember") — and reporting
is the place that temptation is strongest, because every "just one more report" (price
trend, then zone-by-month, then worker-by-season) can each be hacked in by re-reading
every sale's raw log on demand, with no single place that says "here is the list of
sales this tenant has run." That works until it doesn't: it is slow once there are a
season's worth of sales, it has no natural place to cache a headline figure, and every
report ends up with its own slightly-different definition of "which sales count for
this period" (by `startedTs`? by `sale_closed`'s timestamp? does a reopened-then-closed
sale count once or twice?).

The second-order version of the same trap, specific to this domain: **a report that
looks authoritative next to a number that was actually negotiated, not measured** — the
exact failure the owner already rejected once, for price sources (S30's "a national
figure would read as authoritative while differing from what was agreed"). The "yield
per zone" report (§4 above) is where this bites next if nobody names it: a kg-per-zone
chart looks exactly like a yield chart, and once it exists someone will use it to judge
a zone's productivity — a comparison this app has no agronomic data to support. The
guard is the same one S30 used: label what the number actually is, not what it resembles.
