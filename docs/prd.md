# PRD — mon-farm

> Status: **Draft v0.1** — authored from the owner's product brief
> (2026-08-02). Everything here traces back to that brief. Items marked
> **❓** are assumptions or gaps that need the owner's confirmation before
> this PRD is "agreed" and epics are sharded from it. See
> [Open questions](#open-questions).

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
   people whose hands are busy.
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
- FR-1.4 A zone carries the **contract terms** that apply to rubber from
  it — notably the owner/worker split (FR-8). ❓ (is the split held on the
  zone, on the worker contract, or per-sale?)

### FR-2 — Price agreement

- FR-2.1 Before the first weighing, both parties agree a **price per kg of
  net rubber**, with reference to the market price index.
- FR-2.2 The sale records the agreed price, the index reference it was
  based on, and who agreed it on each side.
- FR-2.3 The price index reference is **entered by the user** for v1 — the
  app does not fetch a live index. ❓ (should a later version pull an index
  feed, and from where?)
- FR-2.4 A sale cannot begin counting without an agreed price recorded.

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
  and stray taps unlikely (e.g. tap target placement, minimum interval
  between counts, confirmation for large jumps). ❓ (which mechanism the
  owner prefers is a design decision to settle with a prototype — see Open
  question 4.)
- FR-5.6 **Off-standard baskets**: a basket that does not hit the standard
  net weight (short-filled last basket of a pile, overweight basket) is
  recorded with its **actual scale reading**, and the app derives its net
  weight from the tare. These are counted and totalled alongside standard
  baskets without distorting the net-weight maths.
- FR-5.7 **Confirmation feedback** on each count (visual, and audible or
  haptic) so the operator knows the tap registered without looking away
  from the scale. ❓
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
- FR-7.2 **Gross value = total net rubber weight × agreed price per kg**.
- FR-7.3 **Adjustments** — a bargained price change or a lump-sum
  deduction/addition agreed after counting — are supported, and each
  adjustment records its amount/new price, reason, and who agreed it.
- FR-7.4 The settlement screen shows the **full derivation, step by step**,
  in terms a non-technical user can follow and check by hand: basket count
  → gross weight → tare deducted → net weight → × price → gross value →
  adjustments → final amount. No single opaque total.
- FR-7.5 The derivation is presented per level as well (FR-6), so the
  contribution of each zone and pile to the final amount is visible.

### FR-8 — Owner / worker split

- FR-8.1 Proceeds are split between owner and worker per the contract that
  applies — commonly **60/40 or 50/50**.
- FR-8.2 The applicable split is configured (FR-1.4), shown on the
  settlement, and applied to produce each side's amount.
- FR-8.3 The split calculation is shown as transparently as the rest of the
  settlement (FR-7.4).
- FR-8.4 ❓ The split applies to **gross value or to the post-adjustment
  final amount** — needs confirmation; the two give different worker
  payouts whenever there is a bargain.
- FR-8.5 ❓ Where a sale spans multiple zones with **different splits**, the
  split is applied per zone against that zone's contribution — assumed, to
  be confirmed.

### FR-9 — Two-party cross-check

- FR-9.1 The same sale can be recorded by the **owner side and the ล้ง
  side**, each from their own perspective.
- FR-9.2 The two records can be **compared**, surfacing differences in
  basket counts (per pile), tare, agreed price, adjustments, and final
  amount.
- FR-9.3 Differences are surfaced **at the sale**, in time to be resolved
  by recounting or re-weighing, not discovered afterwards.
- FR-9.4 ❓ The mechanism of pairing the two records — separate ล้ง tenant
  account, a guest/join-by-code session, live shared session, or an offline
  exchange (QR/export) after the fact — is a major architecture decision
  and is Open question 2. Offline-first (NFR-1) means it cannot depend on
  both devices being online at the same time.

### FR-10 — Records and history

- FR-10.1 Completed sales are retained and browsable per farm and zone,
  with their full derivation and audit trail intact.
- FR-10.2 A sale's record can be **exported/shared** as a human-readable
  summary both parties can keep. ❓ (format — printed slip, PDF, share
  sheet, LINE?)
- FR-10.3 Historical sales support answering "what did zone X earn this
  month", "what has the worker lead been paid". ❓ (is reporting v1 or
  later?)

## Non-functional requirements

### NFR-1 — Offline behavior (primary mode)

- The **entire sale flow must work with zero connectivity**: starting a
  sale, tare check, counting, totals, adjustments, settlement figures, and
  viewing prior sales stored on the device.
- Counting is the highest-stakes offline path: a lost count is money lost
  and trust lost. Counts must survive app backgrounding, screen lock, force
  quit, and device restart.
- No feature in the sale flow may block on a network call.

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
- ❓ Rubber grades / DRC-based pricing — see Open question 3.

## Success criteria

1. A real sale on the owner's own farm is run end-to-end in the app,
   offline, with no fallback to paper.
2. The counter screen keeps up with the physical weighing pace, and the
   final basket count matches the ล้ง's independent count.
3. The settlement figure is agreed by both parties without recomputing it
   by hand — and when they do check it by hand, it matches.
4. A dispute over count or money is resolved by looking at the app's
   record, at least once.
5. A second tenant (another farm) can be onboarded without code changes.

## Open questions

These block "PRD agreed"; each materially changes the design or the build.

1. **Sale scope vs. zone scope.** The brief says selling is *per zone*, and
   also that one sale can cover *multiple farms, zones and piles*. The PRD
   currently assumes: a sale is a document that can span zones, while every
   count is attributed to exactly one pile in one zone (needed for the
   split in FR-8). Is that right, or is a "sale" strictly per zone with a
   higher-level grouping above it?
2. **How the ล้ง uses the app.** Own tenant account, guest access to the
   owner's sale via a code, a live shared session, or an after-the-fact
   record exchange (QR/file)? This drives the sync design, the security
   model, and the SaaS shape (does the buyer become a paying tenant too?).
   It must work when neither device has signal.
3. **Rubber product and pricing basis.** Which product is being sold —
   ยางก้อนถ้วย (cup lump), ยางแผ่น (sheet), เศษยาง? And is the agreed price
   a straight ฿/kg on net weight, or does it involve a %DRC / grade
   deduction? The counter and settlement maths are simple in the first
   case and materially different in the second.
4. **Counter screen error-prevention.** Which safeguard do you want:
   confirm-every-count (slow but safest), free tapping with prominent undo
   (fastest), or a middle option like a minimum interval plus a "did you
   mean 2 taps?" prompt? Best settled against a prototype.
5. **Split basis.** Does the 60/40 or 50/50 apply to gross value or to the
   final amount after bargained adjustments (FR-8.4)? And is the split
   configured per zone, per worker contract, or per sale (FR-1.4)?
6. **Worker lead as a user.** Does the worker lead log into the app (see
   their share, confirm counts), or is their name simply recorded on the
   sale?
7. **Reporting scope for v1.** Is per-zone / per-worker history and
   reporting (FR-10.3) in the first release, or is v1 strictly "run and
   settle one sale correctly"?

---

_Next step per `docs/process.md`: once the open questions above are
answered and this PRD is agreed, write `docs/architecture.md` against it,
then shard into epics and stories._
