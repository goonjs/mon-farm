# PRD — mon-farm

> Status: **Draft v0.2** — authored from the owner's product brief
> (2026-08-02), updated with the owner's decisions of 2026-08-03.
> Everything here traces back to those. Items marked **❓** are assumptions
> or gaps still needing the owner's confirmation before this PRD is
> "agreed" and epics are sharded from it. See [Decided](#decided) for
> settled calls and [Open questions](#open-questions) for what remains.

## Overview

mon-farm is an offline-first SaaS for **ยางพารา (para rubber) selling
operations** on medium-to-large Thai farms. It is built tenant-first: the
first tenant is the owner's own family farm, and the product generalises
from there.

The core job it does is **run a sale (การขาย) of rubber from a farm zone to
a buyer (ล้ง) so that both sides can trust the numbers**. Selling rubber
today is a verbal, fast-moving, outdoor process: baskets go on a scale one
after another, people call out counts aloud, and the money is worked out
afterwards from a tally that may exist only on paper or in someone's head.
mon-farm replaces that tally with a shared, auditable record that **both
the owner's side and the ล้ง side can operate from their own perspective**,
so the count and the settlement can be cross-checked instead of argued
over.

Rubber selling happens where there is no reliable signal — in the field, at
the pile, at the farm gate. Offline operation is therefore not a nice-to-
have but the primary mode; see
[Non-functional requirements](#non-functional-requirements).

## Goals / Non-goals

### Goals

1. **A sale can be run end-to-end in the field with no network**, from
   price agreement through counting to final settlement figures.
2. **Both parties (owner side and ล้ง side) can record the same sale** and
   compare, so counting errors and disputes surface at the time of the sale
   rather than after the money moves.
3. **The counting step is fast, simple, and hard to get wrong** — the
   counter screen is the heart of the product, used outdoors, at speed, by
   people whose hands are busy. It **counts out loud in Thai** and runs the
   weighing as a call-and-response with the scale team, so the count is
   shared by everyone present rather than trapped on one person's screen.
4. **Money is fully explainable**: from counted baskets → net rubber weight
   → gross value → adjustments → owner/worker split, every number is
   traceable to the step that produced it.
5. **Multi-level structure is supported**: a tenant has multiple farms,
   farms have zones, a sale covers piles within zones, and totals roll up
   at each level (and for a user-selected subset).

### Non-goals (v1)

- Not an accounting/bookkeeping system, not a tax filing tool.
- Not a payments product — mon-farm computes what is owed; it does not move
  money. ❓
- Not a tapping/production management or agronomy tool (yield tracking,
  fertiliser, tree records). Sale-side only for v1.
- Not a marketplace — it does not match owners to buyers, and does not
  itself publish or broker prices.

## Users & use cases

| Role | Side | What they do in the app |
| --- | --- | --- |
| **Farm owner** | Owner | Tenant admin. Sets up farms, zones, contracts and splits. Starts sales, oversees counting, approves settlement. |
| **Farm manager (ผู้จัดการ)** | Owner | Named as a prerequisite on every sale. May run the sale on the owner's behalf. |
| **Worker lead (หัวหน้าคนงาน / คนกรีด)** | Owner | Named as a prerequisite on every sale; the rubber's proceeds are split with the worker side per contract. ❓ (does the worker lead *use* the app, or is the name recorded only?) |
| **ล้ง (buyer / dealer)** | Buyer | Weighs the baskets, provides and tares the scale and empty containers, agrees the price, counts along. Uses the app from the buyer's perspective for cross-checking. |

### Primary use cases

- **UC-1 — Sell at the ล้ง**: farm transports rubber to the buyer's yard;
  weighing happens on the buyer's scale.
- **UC-2 — Buyer comes to the farm**: the ล้ง brings a truck and scale to
  the farm; weighing happens at the zone or farm gate.
- **UC-3 — Cross-check**: both sides run the same sale in their own app and
  compare totals before settling.
- **UC-4 — Multi-zone sale**: one sale covers several piles, several zones,
  possibly several farms; the parties want per-pile, per-zone, per-farm and
  grand totals, plus totals for an ad-hoc selection.
- **UC-5 — Settle**: agreed price is applied to net rubber weight,
  small bargained adjustments are applied and shown transparently, and the
  owner/worker split is calculated.

## Domain model & vocabulary

The product's language is Thai-first; these are the entities and the terms
they map to.

- **Tenant** — one farm business. First tenant: the owner's family farm.
- **Farm** — a titled property/holding belonging to a tenant.
- **Zone** — a subdivision of a farm. Selling is organised per zone: a
  zone is the unit that ties rubber to the worker/contract that produced
  it.
- **Pile (กอง)** — a physical heap of rubber staged for weighing within a
  zone. A zone can have several piles in one sale.
- **Basket / bucket (เข่ง / ถัง)** — the container the rubber is weighed
  in. Has a **tare weight** (e.g. 2 kg).
- **Standard basket weight** — the agreed *net* rubber weight per basket
  (e.g. 50 kg). Together with tare this gives the **expected scale
  reading** all parties call out (e.g. 52 kg).
- **Count** — the running tally of baskets in a pile: 1, 2, 3, …
- **Tare check / scale calibration** — the ล้ง weighs the empty containers
  in front of the owner at the start; both sides record the result.
- **Agreed price** — price per kg of net rubber, agreed by both parties
  with reference to the market price index, **before the first basket is
  weighed**.
- **Adjustment** — a later, mutually agreed change to the money: a
  bargained price change or a lump-sum deduction/addition.
- **Split** — the owner/worker share of the proceeds per contract, e.g.
  60/40 or 50/50.

## Functional requirements

### FR-1 — Tenancy and farm structure

- FR-1.1 The app is multi-tenant SaaS; all data belongs to exactly one
  tenant.
- FR-1.2 A tenant has one or more **farms**; a farm has one or more
  **zones**.
- FR-1.3 A tenant maintains a roster of people (owner, managers, worker
  leads) that can be named on a sale, and a list of buyers (ล้ง).
- FR-1.4 A tenant maintains **worker contracts**, each carrying the
  owner/worker split percentage *and* the basis that split applies to
  (FR-8.4). A zone is associated with the contract that governs rubber
  from it, so a sale can resolve the right terms per zone.

### FR-2 — Price agreement

- FR-2.1 Before the first weighing, both parties agree a **price per kg of
  net rubber**, with reference to the market price index.
- FR-2.2 The sale records the agreed price, the index reference it was
  based on, and who agreed it on each side.
- FR-2.3 The price index reference is **entered by the user** for v1 — the
  app does not fetch a live index. ❓ (should a later version pull an index
  feed, and from where?)
- FR-2.4 A sale cannot begin counting without an agreed price recorded.
- FR-2.5 **Two pricing modes are supported for ยางก้อนถ้วย** (decided
  2026-08-03), chosen per sale:
  - **Straight ฿/kg** — the agreed price applies directly to net rubber
    weight.
  - **With %DRC / grade deduction** — a dry-rubber-content percentage or
    grade is agreed at the sale and reduces the payable quantity or the
    effective price.
- FR-2.6 In DRC/grade mode the app records **the agreed %DRC or grade, who
  assessed it, and who on each side agreed it** — with the same weight as
  the price itself. Grade assessment is a judgement call made by the buyer
  and is a well-known source of dispute, so it is exactly the kind of
  figure this app exists to pin down.
- FR-2.7 The pricing mode is **fixed before counting begins** and changing
  it afterwards is a recorded adjustment (FR-7.3), not a silent edit.
- FR-2.8 ❓ In DRC mode, does the percentage apply to the **weight** (net
  weight × %DRC × price) or as a **price reduction** (net weight × reduced
  price)? These produce the same number if applied consistently, but the
  settlement must show whichever way you actually negotiate it, so the
  derivation reads the way the conversation went.

### FR-3 — Scale calibration and tare check

- FR-3.1 At the start of a sale the ล้ง weighs the **empty containers** and
  shows the reading; this both verifies the scale and establishes the tare.
- FR-3.2 The app records the tare check: container type, empty weight,
  timestamp, and that the owner side observed it.
- FR-3.3 The owner side records the same tare check independently, for
  cross-check (FR-9).
- FR-3.4 The recorded tare is what the counter screen uses to compute the
  expected scale reading (FR-5.2). Changing the tare mid-sale is an
  explicit, recorded event — never a silent edit. ❓ (is mid-sale re-tare a
  real scenario, e.g. different basket types in one sale?)

### FR-4 — Starting a sale

- FR-4.1 A sale is started against a **zone**, and requires, as
  prerequisites: manager name, worker lead name, buyer (ล้ง), agreed price
  (FR-2), tare check (FR-3), and a start timestamp.
- FR-4.2 The sale records **where** the weighing happens — at the ล้ง or at
  the farm (UC-1 / UC-2).
- FR-4.3 A sale may span **multiple piles, multiple zones, and multiple
  farms**; each count is always attributed to exactly one pile in one zone,
  so it can be rolled up (FR-6) and split correctly (FR-8). ❓ (see Open
  question 1 — "a sale is per zone" and "a sale can cover many zones" need
  reconciling; the model above assumes a sale is a *document* that can span
  zones while every count is *attributed* to one zone.)
- FR-4.4 The timestamp of every significant sale event (start, tare check,
  first/last count per pile, adjustment, settlement) is recorded.

### FR-5 — The counter screen

This is the product's core screen. It is used outdoors, standing, at the
pace baskets come off the scale, by someone who may be holding something
else. It must balance **simplicity and speed** against **not being error-
prone**.

- FR-5.1 The screen counts **up** — 1, 2, 3 — one tap per basket, with the
  current count shown large enough to read at arm's length in sunlight.
- FR-5.2 The screen shows the **expected scale reading** prominently (tare
  + standard net, e.g. `52 กก.`), because the process is that all parties
  see that number on the scale and announce the count together.
- FR-5.3 Counting is **per pile**; the operator selects/creates the pile
  before counting, and the pile's running count and running net weight are
  visible at all times.
- FR-5.4 **Correction without rewriting history**: an operator can undo the
  last count or void a specific count, but corrections are recorded as
  events with a reason, never as a silent decrement. The audit trail must
  make "counted 41, corrected to 40" visible.
- FR-5.5 **Accidental-tap resistance**: the design must make double-counts
  and stray taps unlikely. Since the next-basket cue is optional (FR-11.5),
  counting is **one tap per basket** and the safeguard has to live on the
  count tap itself — candidates are tap target placement, a minimum
  interval between accepted counts, and confirmation for implausibly fast
  repeats. The spoken count (FR-11.3) helps catch an error *after* it
  happens, since a wrong number is heard by everyone at the scale, but it
  does not prevent one. ❓ Open question 4 — to be settled by testing
  variants, not by picking on paper.
- FR-5.6 **Off-standard baskets**: a basket that does not hit the standard
  net weight (short-filled last basket of a pile, overweight basket) is
  recorded with its **actual scale reading**, and the app derives its net
  weight from the tare. These are counted and totalled alongside standard
  baskets without distorting the net-weight maths.
- FR-5.7 **Confirmation feedback** on each count so the operator knows the
  tap registered without looking away from the scale. The spoken count
  (FR-11) is the primary confirmation; visual and haptic feedback back it
  up for when audio is unavailable or inaudible.
- FR-5.8 The counter works fully offline (see NFR-1) and never loses a
  count to app backgrounding, screen lock, or battery/app restart.

### FR-6 — Hierarchy and totals

- FR-6.1 Totals are available at every level: **pile → zone → farm →
  sale**, each showing basket count and net rubber weight.
- FR-6.2 Every level shows the **sum of the levels beneath it**.
- FR-6.3 **Selective totals**: the user can select an arbitrary subset
  (e.g. two piles in one zone, or all zones of one farm) and see the
  total for just that selection.
- FR-6.4 Totals are live during counting, not only at the end.

### FR-7 — Settlement and money

- FR-7.1 **Net rubber weight excludes basket/tare weight** — this is the
  quantity money is calculated on. Standard baskets contribute the agreed
  standard net; off-standard baskets contribute their measured net
  (FR-5.6).
- FR-7.2 **Gross value = total net rubber weight × agreed price per kg**,
  with the %DRC / grade step applied in between when the sale uses that
  pricing mode (FR-2.5).
- FR-7.3 **Adjustments** — a bargained price change or a lump-sum
  deduction/addition agreed after counting — are supported, and each
  adjustment records its amount/new price, reason, and who agreed it.
- FR-7.4 The settlement screen shows the **full derivation, step by step**,
  in terms a non-technical user can follow and check by hand: basket count
  → gross weight → tare deducted → net weight → (%DRC / grade applied, if
  used) → × price → gross value → adjustments → final amount → split. No
  single opaque total.
- FR-7.5 The derivation is presented per level as well (FR-6), so the
  contribution of each zone and pile to the final amount is visible.

### FR-8 — Owner / worker split

- FR-8.1 Proceeds are split between owner and worker per the contract that
  applies — commonly **60/40 or 50/50**.
- FR-8.2 The applicable split is configured (FR-1.4), shown on the
  settlement, and applied to produce each side's amount.
- FR-8.3 The split calculation is shown as transparently as the rest of the
  settlement (FR-7.4).
- FR-8.4 **The basis the split applies to is configurable per contract**
  (decided 2026-08-03) — either gross value or the post-adjustment final
  amount, because contracts differ. The basis is recorded on the contract
  alongside the percentage, and is shown on the settlement so both sides
  can see which rule was applied.
- FR-8.5 Because the basis is a per-contract choice, **every contract must
  have it set explicitly** — there is no safe default, since guessing
  wrong changes what the worker is paid whenever a bargain happens. The
  app must not let a contract exist without a basis recorded.
- FR-8.6 ❓ Where a sale spans multiple zones with **different splits**,
  the split is applied per zone against that zone's contribution —
  assumed, to be confirmed.

### FR-9 — Two-party cross-check

- FR-9.1 The same sale can be recorded by the **owner side and the ล้ง
  side**, each from their own perspective.
- FR-9.2 The two records can be **compared**, surfacing differences in
  basket counts (per pile), tare, agreed price, adjustments, and final
  amount.
- FR-9.3 Differences are surfaced **at the sale**, in time to be resolved
  by recounting or re-weighing, not discovered afterwards.
- FR-9.4 **The ล้ง is a tenant in their own right** (decided 2026-08-03).
  The buyer has their own account and their own records across every farm
  they buy from — they are not a guest on the owner's sale. Both sides own
  their copy of the sale independently, which is what makes the
  cross-check meaningful.
- FR-9.5 The two independent records are **paired** to a common sale so
  they can be compared. ❓ How the pairing is established — scanning a code
  at the start of the sale, buyer/farm identifiers agreed up front, or
  matching after the fact — is an architecture decision.
- FR-9.6 **The at-the-sale comparison still needs a transport.** Two
  separate tenants, both offline, cannot compare through the backend at
  the moment it matters (FR-9.3). Either the devices exchange directly
  (QR/local), or the comparison degrades to post-sync — which weakens
  FR-9.3 from "resolve at the scale" to "discover later". ❓ This tension
  is Open question 2b and needs resolving before the sync design is
  settled; it is the one place where the tenant-account model and the
  offline-first requirement pull against each other.

### FR-10 — Records and history

- FR-10.1 Completed sales are retained and browsable per farm and zone,
  with their full derivation and audit trail intact.
- FR-10.2 A sale's record can be **exported/shared** as a human-readable
  summary both parties can keep. ❓ (format — printed slip, PDF, share
  sheet, LINE?)
- FR-10.3 Historical sales support answering "what did zone X earn this
  month", "what has the worker lead been paid". ❓ (is reporting v1 or
  later?)

### FR-11 — Voice announcement and call-and-response

The app **speaks out loud, in Thai, in a clear voice**, and drives the
weighing as a call-and-response rhythm between the app and the people at
the scale. This is not an accessibility extra — it is how the count stays
synchronised between the owner side, the ล้ง side, and whoever is lifting
baskets. The app becomes the neutral announcer that everyone hears, which
is exactly the role the brief describes when it says all parties announce
the count together.

Because the operator's eyes are on the scale and their hands are busy, the
voice — not the screen — carries the moment-to-moment state.

**On entering a new level (pile / zone) and tapping Ready:**

- FR-11.1 The app **reads the level's information aloud in Thai** — the
  farm, zone and pile being counted, the empty basket (tare) weight, the
  standard rubber weight per basket, and the expected scale reading. This
  is a deliberate read-back so both sides hear the terms before a single
  basket is weighed. ❓ (exact wording and which fields are read — to be
  settled with the owner against a prototype.)
- FR-11.2 A separate **"พร้อมค่ะ" button** announces readiness aloud — the
  explicit go-signal to the scale team that counting is starting. It is a
  distinct action from the read-back, so the operator can let the read-back
  finish, let the parties confirm, and only then signal.

**During counting:**

- FR-11.3 On each recorded basket the app **speaks the count in Thai** —
  "หนึ่ง", "สอง", "สาม" — so the number is heard by everyone present, not
  just seen by the person holding the phone.
- FR-11.4 After speaking the count the app is **immediately ready for the
  next basket**. It does not gate the next count behind any further action.
- FR-11.5 **"ต่อไปค่ะ" is an optional action.** A button announces aloud
  that the next basket should be weighed, for when the operator wants to
  cue the scale team explicitly. Counting never depends on it: the
  operator may ignore it entirely and simply keep counting.
- FR-11.6 The cadence per basket is therefore: *basket on scale → all
  parties see the expected reading → tap count → app speaks the number*,
  with an optional "ต่อไปค่ะ" cue whenever the operator wants one. Because
  the flow is a single tap per basket, the **count tap needs its own
  accidental-tap protection** — the rhythm does not provide it (FR-5.5).

**Quality and reliability:**

- FR-11.7 **Speech must work fully offline** (NFR-1). No sale-critical
  announcement may depend on a network call to a cloud speech service.
  Where the audio comes from — bundled recordings or the device's own Thai
  text-to-speech — is **deliberately undecided**: the prototype carries
  both and the choice is made from how they actually sound at a scale
  (decided 2026-08-03). Both satisfy the offline constraint; they differ
  in consistency, download size, and whether a given phone can speak Thai
  at all.
- FR-11.8 The voice must be **clear and natural in Thai, including correct
  number pronunciation** — Thai numerals are irregular in compounds
  (ยี่สิบเอ็ด, not สองสิบหนึ่ง), and a wrong-sounding count destroys the
  trust the feature exists to create. Counts run well past 100 in a large
  sale, so this must hold across the whole range actually used.
- FR-11.9 The voice must be **audible in the field** — outdoors, near a
  truck, over the noise of a working yard. Volume control and a repeat/
  replay of the last announcement are required.
- FR-11.10 **Audio failure must never block or corrupt the count.** If the
  device is muted, the speech engine fails, or a voice is unavailable, the
  app keeps counting correctly with visual and haptic feedback, and makes
  the degraded state visible rather than silently dropping to a mute
  counter.
- FR-11.11 Speech can be **turned off** by the user without changing the
  counting logic — the two-step count/next rhythm (FR-11.4) stays.

### FR-12 — Recording the announcements ❓

- FR-12.1 ❓ Should each spoken announcement be part of the audit trail
  (i.e. the record shows "the app announced 41 at 14:32"), so a later
  dispute can establish what was said aloud at the time? This is cheap to
  add while the events are already being recorded, and is a meaningful
  trust artefact — but it is an addition to the brief, not something you
  asked for, so it needs your call.

## Non-functional requirements

### NFR-1 — Offline behavior (primary mode)

- The **entire sale flow must work with zero connectivity**: starting a
  sale, tare check, counting, totals, adjustments, settlement figures, and
  viewing prior sales stored on the device.
- Counting is the highest-stakes offline path: a lost count is money lost
  and trust lost. Counts must survive app backgrounding, screen lock, force
  quit, and device restart.
- No feature in the sale flow may block on a network call.
- **Thai speech (FR-11) is part of the offline surface.** The voice is
  central to how counting is conducted, so it cannot rely on a cloud
  speech service. This constrains the implementation to on-device speech
  or audio bundled with the app — an architecture decision, but the
  product constraint is fixed here.

### NFR-2 — Sync behavior

- Local data syncs to the backend **automatically when connectivity
  returns**, and **on manual user trigger**.
- The user can see sync status — pending / synced / error — at least at the
  sale level.
- Conflict resolution strategy is an architecture decision
  (`docs/architecture.md`), but the product constraint is: **a recorded
  count or agreed figure is never silently overwritten**. Conflicts on a
  sale's numbers must surface to a human.
- ❓ Two-party cross-check (FR-9) sync semantics depend on Open question 2.

### NFR-3 — Trust and auditability

- Every number in the settlement must be traceable to the recorded events
  that produced it.
- Corrections and adjustments are **append-only events with reason and
  actor**, not destructive edits.
- This is a product requirement, not just a technical one: the app's value
  is that two parties who don't fully trust each other can both rely on it.

### NFR-4 — Field usability

- Readable in direct sunlight; usable one-handed, standing, possibly with
  dirty or gloved hands.
- **Audible in a working yard**: the spoken count (FR-11) must carry over
  ambient noise — engines, wind, people — to everyone standing at the
  scale, not just the phone holder. Device speaker volume may be the
  limiting factor. ❓ (is an external/bluetooth speaker realistic in your
  setup, or must it work off the phone alone?)
- Thai-first UI. ❓ (is any English/other-language support needed for
  buyers or staff?)
- Must tolerate low-end Android devices and poor battery. ❓ (target device
  floor to be confirmed.)

### NFR-5 — Platform

- Web app that also runs as a mobile app (per `CLAUDE.md`). Exact packaging
  approach is an architecture decision.
- ❓ Target platforms in priority order (Android first, given the field
  users?).

### NFR-6 — Multi-tenancy and security

- Tenant data isolation is mandatory: one farm business must never see
  another's sales.
- Role-based access within a tenant (owner vs. manager vs. worker lead).
  ❓ (what exactly each role may see and do — especially whether a worker
  lead can see money.)

## Out of scope (v1)

- Payments/disbursement of money.
- Live market price index feeds (price index is entered manually, FR-2.3).
- Production/agronomy tracking (tapping records, yield, inputs).
- Buyer marketplace or price discovery across buyers.
- Multi-currency; THB only.
- Products other than ยางก้อนถ้วย (ยางแผ่น, น้ำยางสด, เศษยาง) — v1 covers
  cup lump only, in both pricing modes (FR-2.5).

## Success criteria

1. A real sale on the owner's own farm is run end-to-end in the app,
   offline, with no fallback to paper.
2. The counter screen keeps up with the physical weighing pace, and the
   final basket count matches the ล้ง's independent count.
3. The spoken count is clear enough that the people at the scale work to
   the app's voice — and nobody asks "what number are we on?"
4. The settlement figure is agreed by both parties without recomputing it
   by hand — and when they do check it by hand, it matches.
5. A dispute over count or money is resolved by looking at the app's
   record, at least once.
6. A second tenant (another farm) can be onboarded without code changes.

## UX decisions are settled by testing, not by this document

The owner's stated preference: **try several UX variants before committing
to one.** That applies most to the counter screen (FR-5) and the voice
loop (FR-11) — the surfaces used at speed, outdoors, by people who cannot
afford to think about the app.

So this PRD deliberately **specifies what the counter must achieve and
leaves how it looks and feels open**. Requirements like "one tap per
basket", "net weight excludes tare", and "corrections never rewrite
history" are fixed. Layout, tap-target design, the exact anti-mistap
safeguard, and the read-back wording are not — those are answered by
building variants and using them against a real scale.

Practically, this means the counter prototype comes **before** the
architecture is finalised and before the counter's stories are written:
what we learn from handling it in the field may change the requirements
above, which is the point. Prototype variants are throwaway code for
learning, exempt from the full story/TDD ceremony — but nothing learned
from them reaches production without going back through the normal loop
in `docs/process.md`.

## Decided

Recorded here so the reasoning is not lost once the questions disappear.

- **2026-08-03 — The ล้ง is a full tenant, not a guest** (FR-9.4). The
  buyer keeps their own records across every farm they buy from. Trade-off
  accepted: two independent tenants both offline cannot compare through
  the backend at the moment it matters — see open question 2 below, which
  this decision creates rather than closes.
- **2026-08-03 — ยางก้อนถ้วย, in both pricing modes** (FR-2.5). Straight
  ฿/kg *and* %DRC / grade deduction are both supported and chosen per
  sale. Other products are out of scope for v1.
- **2026-08-03 — Split basis is per-contract** (FR-8.4). Gross or
  post-adjustment is a recorded property of each worker contract; there is
  no default, because guessing wrong changes the worker's pay.
- **2026-08-03 — Voice sourcing is deferred to the prototype** (FR-11.7).
  Bundled recordings and device Thai TTS both get built and tried at a
  real scale before one is chosen.
- **2026-08-03 — "ต่อไปค่ะ" is optional** (FR-11.5), which removed the
  two-tap gate and reopened the anti-mistap question below.

## Open questions

These block "PRD agreed"; each materially changes the design or the build.
Questions tagged **[UX]** are expected to be answered by prototype testing
rather than by decision up front.

1. **Sale scope vs. zone scope.** The brief says selling is *per zone*, and
   also that one sale can cover *multiple farms, zones and piles*. The PRD
   currently assumes: a sale is a document that can span zones, while every
   count is attributed to exactly one pile in one zone (needed for the
   split in FR-8). Is that right, or is a "sale" strictly per zone with a
   higher-level grouping above it?
2. **How the two tenants compare their records at the sale** (FR-9.6).
   Now that the ล้ง is a separate tenant, comparison through the backend
   needs both sides online — which is exactly what a field sale does not
   have. Either the devices exchange directly (QR scan, local transport),
   or the cross-check slips from "resolve at the scale" to "discover after
   sync". This is the biggest remaining architecture question.
3. **How the two records are paired** (FR-9.5) — scan a code at the start,
   agreed identifiers up front, or matched after the fact?
4. **Counter screen error-prevention.** [UX] The sharpest UX question in
   the product. With "ต่อไปค่ะ" optional (FR-11.5) there is one tap per
   basket and nothing structurally preventing a stray tap from booking a
   basket that was never weighed. Candidates: minimum interval between
   accepted counts, confirmation on implausibly fast repeats, a tap target
   designed against accidental brushes, or accepting the risk and relying
   on prominent undo plus the spoken count as after-the-fact detection.
   **To be resolved by testing variants, not chosen on paper.**
5. **%DRC applied to weight or to price** (FR-2.8) — same arithmetic,
   different derivation on screen; it should read the way you actually
   negotiate.
6. **Worker lead as a user.** Does the worker lead log into the app (see
   their share, confirm counts), or is their name simply recorded on the
   sale?
7. **Reporting scope for v1.** Is per-zone / per-worker history and
   reporting (FR-10.3) in the first release, or is v1 strictly "run and
   settle one sale correctly"?
8. **Voice persona.** The "ค่ะ" in "พร้อมค่ะ" / "ต่อไปค่ะ" implies a
   female voice — confirmed?
9. **What the read-back says (FR-11.1).** [UX] Which fields should be read
   aloud on Ready — is farm/zone/pile plus tare, standard weight and
   expected reading the right set, too much to listen to every pile, or
   missing something the parties need to hear?
10. **Who else hears it.** Does the ล้ง side's own device also announce
    (two voices in the yard, possibly out of step), or does exactly one
    device speak while the other stays silent and cross-checks?
11. **Announcements in the audit trail** — FR-12.1 above.
12. **Different splits across zones in one sale** (FR-8.6) — assumed to
    apply per zone against that zone's contribution; confirm.

---

_Next step per `docs/process.md`: once the open questions above are
answered and this PRD is agreed, write `docs/architecture.md` against it,
then shard into epics and stories._
