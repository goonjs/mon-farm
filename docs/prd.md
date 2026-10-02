# PRD — mon-farm (Rubber Farm Management App, MVP V1)

> Status: **Draft v1.0 — first complete PRD, in owner review.**
> Requirements authority: the owner's *Rubber Farm App MVP V1 — Single Source
> of Truth* (2026-10-02; Q1–Q109 + Q111–Q137), referred to below as **[SSOT]**.
> Technical specs carried over from PRD v0.4 / `docs/architecture.md` v0.1 are
> marked **[carried]**. Conflicts between the two were put to the owner module
> by module; each answer is recorded in [Decision log](#decision-log).
> Superseded: PRD v0.4 (sale-counter-only scope) — see git history.

## Reading guide

- Requirement IDs are per module: `ACC` access, `SYNC` offline/sync, `MD`
  master data, `SALE` weighing, `SET` reconciliation & settlement, `FERT`
  fertilizer, `OPS` field operations, `TASK` tasks & notifications, `DOC`
  worker documents, `INV` inventory, `FIN` finance, `WX` weather, `ANA`
  analytics, `AI` AI assistance, `INT` integrations, `NFR` non-functional.
- **MVP** = must work before real farm testing (see [Acceptance](#mvp-acceptance-checklist)).
  **Deferred** = designed for, not built in V1.
- ⏳ = waiting on an owner answer; nothing marked ⏳ is implemented on a guess.

---

## 1. Product overview

mon-farm is a **personal-first farm management app** for the owner's rubber
farms and related durian properties. It replaces the paper/notebook workflow
for rubber sales, and gives the owner one place for farm operations, finance
and analysis — **usable fully offline at the farm**, synced across up to three
phones when signal returns.

It is deliberately not a complete long-term platform: V1 is the smallest
robust system that replaces paper and collects reliable real-world data
[SSOT §0]. Public multi-tenant SaaS is deferred; the data model stays clean
enough to get there, and to integrate with the owner's JotWai finance product
later [SSOT §1, §29].

### Goals

1. A rubber sale runs end-to-end at the farm with no network — weighing every
   pile, continuous basket numbering, bridge baskets, reconciliation with the
   buyer, and per-tapper settlement.
2. Basket-count mistakes are hard to make: current basket, point, partial
   weight and totals are always visible [SSOT §5.3].
3. Every number is explainable and traceable to its source records.
4. Farm operations (inspections, incidents, tasks, inventory, documents,
   weather) and finance (expenses, payer, reimbursements, cash-flow) are
   captured once and stay useful even when incomplete.
5. AI helps analyse and recommend, but the owner decides — AI never silently
   creates or changes anything [SSOT §48].

### Non-goals (V1)

- Public SaaS / multi-tenant productization; complex role/permission UI.
- Moving money (the app records payments, it does not make them).
- JotWai integration, automated LINE ingestion, TradingView/Windy production
  integrations, advanced AI monitoring/learning, advanced reserve methodology,
  full legal/compliance engine, tree-level mapping, paper-history migration
  [SSOT Deferred list].

### Core principles [SSOT §2, §40]

1. Minimal input; remember defaults; calculate rather than ask twice.
2. **Never invent missing data** — use explicit states: Unknown · Not recorded
   · Estimated · User provided · System calculated · AI suggested / Needs
   Review.
3. Separate facts from estimates, forecasts, recommendations, AI interpretation.
4. Preserve source evidence and audit metadata; never overwrite history.
5. Drill-down everywhere: dashboard → property → zone → point → record.
6. Offline-first is mandatory.
7. Owner is the decision maker.
8. Don't make Ajarn Somwang (76) learn a new technology workflow.

## 2. Users & context

| Who | Role in V1 | Uses the app? |
| --- | --- | --- |
| Owner (Product Owner) | Owner | Yes — primary recorder |
| Owner's younger sibling | Owner (equal rights) | Yes |
| Owner's friend | Owner (equal rights) | Yes |
| อาจารย์สมหวัง วิเชียรฉันท์ — farm manager, 76, adviser, not a tapper | Person record; optional notification recipient; may advance money | No login. Communicates by phone/LINE/in person; future LINE ingestion → Needs Review |
| แดง (Daeng), นัด (Nat) — rubber tappers, foreign workers | Person records; settlement parties; document holders | No login |
| Worker families — Daeng 5 members, Nat 2 | Person records for document tracking | No |
| Buyer — one primary, changeable | Buyer record | No |
| Khun Nueng / Khun Panom Krongkaew — durian lessees | Counterparty records | No |

### Confirmed farm facts [SSOT §0.1, §3, §14, §49]

- **สวนจันทเขลม** (exact spelling) — ~125 rai, ~15 yrs. Daeng: 3 weighing
  points; Nat: 1 weighing point.
- **สวนฝั่งคลองพลู** (rubber) — ~30 rai, ~15 yrs. Nat sole tapper; 1 weighing point.
- ~7,000 rubber trees total (estimate; exact unknown).
- Durian, Khlong Phlu — 30 rai, first planted 5 Dec 2024, leased to Khun
  Nueng, rent expected from 2029 (B.E. 2572) + % of sales; terms from lease
  (not invented).
- Durian, Takhian Thong — 76 rai, leased to Khun Panom Krongkaew, rent
  1,000,000 THB/yr, rent only.
- Product: cup lump rubber (ยางก้อนถ้วย); buyer collects at the farm.
- Sales: May–Oct ~monthly (1.5–2 months in heavy rain); Nov–Feb ~twice a
  month; Mar–Apr tapping stops. Daeng and Nat normally sell together.

---

## 3. Module ACC — Identity, Farm Groups & access [SSOT §0.2, Q112, Q118–Q123]

**MVP.**
- ACC-1 **Google Login** in V1. **LINE Login is integration-dependent** and
  follows after V1's first field test (D-2). The account model links several
  sign-in identities to **one logical User**, so adding LINE later never
  creates a duplicate user.
- ACC-2 A User can belong to **many Farm Groups**. Any Owner can create one;
  the creator invites, the invitee accepts. A member can leave — the group and
  its data remain. Deleting a whole Farm Group is not an MVP operation.
- ACC-3 Farm selection: one group → enter directly; several → choose.
- ACC-4 MVP has **three equal Owners** (owner, younger sibling, friend) who can
  view/create/edit/delete/restore everything. No manager/worker login, no
  permission UI. Membership carries a `role` field (always `owner` in V1) so
  configurable roles (Q90) can be added later without a data migration.
- ACC-5 Farm Group data is isolated: a user sees only groups they belong to.
- ACC-6 After first sign-in on a device, the app works **offline with no
  re-login** for the farm visit.

## 4. Module SYNC — Offline-first, sync & data integrity [SSOT §0.3–0.4, §34–35, Q91, Q113–Q117, Q124–Q126]

**MVP.**

### Offline & sync
- SYNC-1 Every MVP workflow works with no network. A record saved offline is a
  **real record immediately**, usable at once, marked **Pending Sync**.
- SYNC-2 Sync runs **automatically** when connectivity returns and retries
  automatically on failure; local data is never discarded. There is **no Sync
  button in normal use**; a **"ลองใหม่" (retry) action appears only when sync
  has failed or a Conflict needs attention** (D-3).
- SYNC-3 Status shown per record and globally: **Synced · Pending Sync ·
  Conflict**.
- SYNC-4 Up to 3 phones (plus web) share **one logical dataset**. Different
  records merge automatically. Edits to the same logical record that the
  system cannot merge safely become a **Conflict the owner resolves** — never a
  blind last-write-wins on money, weights or counts.

### Handing a sale between devices (D-4)
Normally one person records at a time, but a sale may move to another phone
mid-weighing (battery, signal, person).
- SYNC-5 **Explicit handoff, offline-capable (MVP):** the current device taps
  **"ส่งต่อ"** — it records the hand-off and locks its own recording for that
  sale. The receiving device taps **"รับช่วง"** and continues from the next
  basket number, with no network needed. Both logs merge when either side has
  signal, or **at sale close via a QR code** shown on one device and scanned
  by the other. Must be fast (≤ 2 taps each side) and mistake-proof (shows the
  basket number it continues from).
- SYNC-6 **Free mode with detection:** recording without a handoff is allowed.
  On merge, baskets of the same sale recorded on different devices within a
  **7–10 s window** (configurable; tolerant of clock drift, cross-checked by
  basket number) raise a "นี่คือการนับซ้ำไหม?" question.
- SYNC-7 Overlaps are shown as a simple **timeline per device** so the owner
  can see at a glance which recordings interleave, and decide.
- SYNC-8 *Deferred:* Bluetooth device-to-device handoff.

### Edit, delete, provenance
- SYNC-9 Any Owner edits records directly. Underneath, every change is kept as
  an event (who, when, device, source), so history is never lost even though
  V1 has **no version-history UI** [Q126].
- SYNC-10 **Soft Delete** for important records: hidden from normal lists,
  restorable by any Owner [Q124–Q125]. Soft Delete ≠ Cancelled (a business
  state).
- SYNC-11 Provenance on important records: created by/at, edited by/at,
  source channel (app / LINE / manual import / AI), original text/photo/audio,
  verification state [§35].
- SYNC-12 Data-completeness states per field where relevant: Unknown · Not
  recorded · Estimated · User provided · System calculated · AI suggested /
  Needs Review.

## 5. Module MD — Farm structure & master data [SSOT §0.1, §3, §38, Q93–Q95, Q137]

**MVP.** Master data is **shared and synced** across the Farm Group
(supersedes the old device-local farm profile S27 and people store S16 — their
stable-id rule is kept).

- MD-1 **Properties**: rubber farms and durian farms; name, type, area in rai
  **with dated history** (analytics use the area valid at the time), age,
  GPS (optional, Unknown until supplied), lease link for durian.
- MD-2 **Zones**: optional. Add, retire, split, merge; structure history kept so
  past records keep the structure that applied then. Records can be assigned
  to a zone retrospectively. The owner is never forced to invent zones.
- MD-3 **Weighing points (= rubber pile)**: one entity for the physical place —
  never a separate "pile" entity [§0.1]. Belongs to a property; optional zone;
  reusable across sales; tracked from day one. Initial data: Chanthakhem —
  Daeng 3 points, Nat 1 point; Khlong Phlu — Nat 1 point (names to be entered
  by the owner).
- MD-4 **Assignments are time-bounded**: tapper ↔ weighing point / zone, with
  valid-from/to; analytics use the assignment valid at the time [Q94].
- MD-5 **People**: tappers (Daeng, Nat), families/members (DOC), farm manager
  (Ajarn Somwang), payers (owner, sibling), lessees. A person may have no login.
- MD-6 **Buyers**: one primary, changeable; default to the last used.
- MD-7 **Basket presets** (Farm Group settings, D-6): standard **net** basket
  weights (50 kg, 60 kg, extensible) and **container tare** values; one of each
  is the default for a new sale and can be changed per sale/point.
- MD-8 **Tapper share** per tapper, time-bounded, **default 50/50** (owner /
  tapper), on gross sale value. The old per-zone contract and its inert
  `basis` field are removed (D-12).
- MD-9 **Sale-day settings**: zero/tare check mode (D-6), hold duration (D-7),
  voice on/off (D-8), duplicate-detection window (SYNC-6).

## 6. Module SALE — Sale capture & weighing [SSOT §0.5, §4.3–4.4, §5, Q96–Q97, Q130–Q137]

**MVP.** The heart of the product: used standing, outdoors, one-handed, often
offline. Its job is to make losing track of the basket number hard [§5.3].

### Starting and shaping a sale
- SALE-1 Start: **Farm → Zone/Tapper context → weighing point**, then weigh
  (Q130). A sale may span **several farms** (one buyer collection = one sale)
  (D-9) and any number of weighing points, chosen **in any order**, different
  every sale [§0.1].
- SALE-2 Sale header: date, buyer (default last), farm(s), optional weighing
  start time, farm manager **auto-filled from master data**, notes,
  photos/documents. Sales happen **at the farm** only (the old sell-at-ล้ง-yard
  case is dropped; D-10). No worker-lead field — the tapper comes from the
  weighing point.
- SALE-3 **Price ฿/kg entered manually** for every sale — never pulled from
  the previous sale or a market feed. It may be entered **any time before
  settlement**; weighing does not wait for it (D-11). Single pricing mode
  (straight ฿/kg); %DRC is dropped.
- SALE-4 Daeng's and Nat's rubber are **never mixed** — every weight is
  attributable to one weighing point and therefore one tapper [Q96].
- SALE-5 A pile exists only on sale day; it is not long-lived inventory [Q97].

### Zero/tare check (D-6)
- SALE-6 Before weighing at a point, the app asks for the **zero/tare check**
  (scale reads zero; container tare confirmed). Setting: **every point**
  (default) · **first point of each farm only** · **skip all**. Skips are
  logged on the sale.

### Counting baskets
- SALE-7 Basket size picker: the sale's default **net** weight (50 / 60 kg …)
  with its container tare; the screen shows the expected scale reading
  (net + tare).
- SALE-8 Full basket: a **short press-and-hold (~0.5–1 s, configurable)**
  records one full basket at the selected net weight (D-7). Single taps,
  swipes and multi-finger touches never count (old field finding, 2026-08-03;
  S32).
- SALE-9 Partial basket: type the **scale reading**; net = reading − tare;
  both stored and shown [carried].
- SALE-10 **Basket numbers are assigned automatically and run continuously
  across the whole sale**, across points and farms — never reset per point
  [Q133–Q134].
- SALE-11 **Open partial (bridge) basket**: a partial basket stays open by
  default. When the user moves to **another point of the same tapper**, the app
  asks: **"เติมเข่ง N ต่อ"** (continue) or **"เริ่มเข่งใหม่"** (start new —
  the open basket closes as a remainder). Each component keeps its point;
  display **"เข่ง 11 — (20 + 30) กก. = 50 กก."**; point subtotals include only
  their own component [§5.2, D-13].
- SALE-12 A partial basket can **only** be continued at a point of the **same
  tapper**. Moving to another tapper's point closes it as a remainder first.
- SALE-13 Explicit **"จบเข่งแล้ว / เป็นเศษ"** closes a partial basket as a final
  remainder; it is no longer offered for continuation; the next number becomes
  available [Q135].

### Weighing screen (D-8, D-17)
- SALE-14 **Recorder mode (default, portrait)** shows prominently: current
  basket no. · current point (and tapper) · open partial weight · cumulative
  kg · completed baskets · next basket no. [§5.3].
- SALE-15 **Public mode** (one tap to switch; may rotate to landscape): the
  basket number as large as the screen allows, for the buyer to read [carried
  FR-9].
- SALE-16 **Thai voice** speaks each basket number (and remainder/close
  events) — always Thai, works offline, can be turned off; audio failure never
  blocks counting [carried FR-11].

### Corrections & late entry
- SALE-17 Undo last basket (with confirmation) and edit/void any basket or
  component; every correction is kept in the event history [carried].
- SALE-18 **Bulk entry per point** (D-14) for weighing not recorded live (e.g.
  Ajarn Somwang's paper notes when the owner arrives late): **N full baskets +
  remainder kg**; the app allocates continuous basket numbers; marked
  **"บันทึกย้อนหลัง"**; a photo of the paper can be attached.
- SALE-19 Photos of piles, weighing slips, cash/transfer evidence attach to the
  sale or a point.

### Sale states [Q127–Q129]
- SALE-20 **Draft → Completed**, or **Cancelled** (a business outcome, kept
  for history). A Cancelled sale keeps its baskets but is excluded from totals.
- SALE-21 **Completed sales stay directly editable** by any Owner. If an edit
  changes any money figure (tapper amount, owner share, totals), the app asks
  for a **short reason** (pick from a list or type) and flags the affected
  payment statuses for re-check (D-16).

## 7. Module SET — Reconciliation & settlement [SSOT §0.6, §4.5, §6, Q98–Q101]

**MVP.**
- SET-1 Totals are automatic: per basket → point → tapper → farm → sale; total
  kg, basket count, amount = price × kg [Q98].
- SET-2 **Verification once, after all points** are weighed (never per pile)
  [Q99]: owner's totals side-by-side with the **buyer's reported** kg / amount
  (and basket count if given). The buyer's sheet is not assumed correct.
- SET-3 **Money always derives from the recorded baskets** (D-15). On mismatch
  the owner drills down point → basket → component, and fixes the wrong
  basket(s). If a difference remains, the sale can be closed as **Difference
  found** with a reason; the difference is recorded, not silently spread.
- SET-4 Settlement view [Q100]:
  - **Per tapper** (Daeng, Nat separately): kg, sale amount, tapper share,
    fertilizer deduction, **cash payable**.
  - **Owner**: share from each tapper, combined share, **bank transfer**.
- SET-5 **Rounding** [§0.6, D-5]: when a split produces fractions, the app asks
  before settlement — *round to whole baht in the tapper's favour* · *in the
  owner's favour* · *no rounding (keep satang)* — defaulting to the last
  choice. The rounding adjustment is stored as its own line. Nothing is
  hard-coded (replaces the built rule where the owner rounds and the tapper
  takes the remainder).
- SET-6 **Independent statuses**, never one "Paid" flag [Q101]: verification
  (Pending · Weight verified · Sale total verified · Difference found);
  Daeng cash received/paid; Nat cash received/paid; Owner transfer received;
  Sale closed.
- SET-7 Sale record keeps: date, price/kg, basket count, total kg, amount,
  share rule, cash to each tapper, bank transfer to owner, rounding
  adjustment, fertilizer deductions & remaining balance, buyer, location,
  start time, media, verification status [§4.4].
- SET-8 Bargained price changes / lump-sum adjustments (old FR-7.3) are **not**
  in V1 (D-11).

## 8. Module FERT — Fertilizer [SSOT §0.7, §4.6, §8]

**MVP.**
- FERT-1 **Purchase**: type (chemical / chicken manure / other), quantity
  (sacks), cost, shop, date, who ordered, **who paid** (→ FIN payer &
  reimbursement), invoice/photo. Normally bought for immediate use (no stock).
- FERT-2 **Plan** (optional): type, quantity, timing, allocation by zone/
  worker — usually Ajarn Somwang's plan, recorded by the owner; a plan is a
  Planned expense in FIN.
- FERT-3 **Allocation** by sacks per worker (zone optional). Cost per worker
  follows the sacks allocated; rule is extensible later [§8.3].
- FERT-4 **Liability**: each worker bears **50%** of their allocated cost; the
  owner's 50% is a farm expense.
- FERT-5 **Ledger per worker, across sales**: liability, deductions, other
  payments, **outstanding balance**, optional **instalment plan**, full
  history.
- FERT-6 **Deduction at settlement**: the app proposes this sale's deduction
  (instalment or full balance), editable, **capped at the tapper's share** for
  that sale; any shortfall **carries forward** — cash paid is never negative
  (D-18). Replaces the old per-sale deduction S29 (which allowed negative
  payouts and had the owner bear none of the cost).

---

## 9. Module OPS — Field operations [SSOT §15–21, §18, §37, Q86]

**MVP.** All of OPS works offline [SSOT §34].

### Inspections & observations
- OPS-1 Free-form inspection capture: typed note and/or audio; original note/
  audio preserved [SSOT §17].
- OPS-2 Attach photos/videos; capture GPS if available; identify property /
  zone / point (zone optional).
- OPS-3 (AI, when online) classify the observation and propose structured
  fields; owner confirms/edits. Unconfirmed AI output stays **AI suggested**,
  never fact [SSOT §17, §21].
- OPS-4 From an observation, the owner may create an Incident or Task
  (explicit action).

### Rubber-tree health
- OPS-5 Health assessment with a **standard checklist** (overall health, leaf
  condition, leaf shedding, new leaves, disease/pests, damage, water/soil,
  tapping-related) plus **custom fields**; checklist configurable by farm /
  zone / season / inspection type [SSOT §20].
- OPS-6 Zone-level overview and point-level detail, drill-down to photo/GPS/
  history [SSOT §19].
- OPS-7 Tree counts: estimated first, verified later, with a **change history**
  (losses, new planting) — never overwritten [SSOT §19].

### Incidents
- OPS-8 Incident record: date/time, property, zone, point, GPS, type,
  severity, description, affected area/trees, photos/videos, reporter, action
  taken, related task(s), related expense(s), status [SSOT §15]. Types include
  heavy rain, erosion, riverbank collapse, flooding, standing water, drought,
  strong wind, fallen rubber/durian trees, disease after wet weather, soil/
  road damage, other.
- OPS-9 An incident can exist with **zero cost**, and is retained long-term.
- OPS-10 **Incident timeline**: dated follow-up events (detected → worsened →
  discussed → contractor hired → repaired), linking observations, media,
  tasks, expenses, weather, follow-up inspections [SSOT §16].

### GPS
- OPS-11 GPS optional at property, zone, inspection point, incident and
  observation level. Store **where the record was created** separately from
  **where the event happened**; remote entry (from Bangkok, from LINE) must
  not be forced to carry GPS [SSOT §18].

### Contextual notes / Farm Change Log
- OPS-12 Owner can add a free-text contextual note/event at any time (heavy
  rain, worker issue, buyer scheduling, repair …). Notes feed Timeline,
  Reports, Comparisons and AI [SSOT Q86–Q87, Q92].

### Media
- OPS-13 Photos, videos, receipts, weighing slips, fertilizer invoices, worker
  documents, incident evidence — each preserving date/time, source, related
  entity, GPS when available [SSOT §37]. Captured offline; uploaded on sync.

## 10. Module TASK — Tasks & notifications [SSOT §24–25, Q52–Q58]

**MVP:** manual tasks, owner-confirmed suggested tasks, document & opted-in
task reminders. **Deferred:** learned seasonal recommendations beyond simple
rules.

- TASK-1 Task fields (recommended defaults, **minimum required kept low**):
  name, property, zone/point, reason/context, linked source record
  (observation/incident/document/weather/analytics), responsible person, due
  date or window, priority, estimated cost, actual cost, status, notes,
  attachments. Only the name is mandatory; everything else is optional
  (sensible default per SSOT "don't ask for every detail").
- TASK-2 The system recommends a sensible status workflow (e.g. To do → In
  progress → Done / Not needed); the owner doesn't design it.
- TASK-3 **No task is ever created without explicit owner approval.**
  Suggestions (from observation, incident, weather, document, analytics,
  season) offer **Create Task · Not needed · View more data** and explain why
  [SSOT Q63].
- TASK-4 Notifications are **opt-in per task**; documents always notify
  (DOC). The system may *recommend* a reminder; the owner decides [Q53].
- TASK-5 Recipients: **owner is the default for every notification**; the
  owner may add Ajarn Somwang per task/issue; he is never added automatically
  [Q56].
- TASK-6 Channels: in-app push and LINE, LINE subject to API validation [Q57].
- TASK-7 Frequency: system-recommended per notification type, editable later;
  documents repeat until handled; general tasks don't repeat unless selected;
  de-duplicate [Q58].

## 11. Module DOC — Worker & family documents [SSOT §26, Q54–Q55]

**MVP — mandatory reminder functionality.**

- DOC-1 Model **family → members → documents**. Member: name, called name,
  relationship to principal worker, DOB/age when useful, worker vs family
  role, notes. Not a civil registry; members may be left incomplete.
- DOC-2 Document: type (pink card, passport, visa, health insurance,
  extensible), holder, issue date if known, expiry date, status, photo/file,
  renewal notes, responsible person, reminder schedule.
- DOC-3 Reminders before expiry; recommended default lead times **90 / 60 /
  30 / 7 days**, editable; repeated until handled.
- DOC-4 Lifecycle: current → approaching expiry → reminder → owner decides →
  optional proposed Task → owner confirms → renewed document becomes current;
  **previous versions kept in history**.
- DOC-5 The app does not infer legal status; legal rules are verified from
  authoritative sources before any compliance logic is built.

## 12. Module INV — Inventory [SSOT §9]

**MVP.**
- INV-1 Stock items: grass-cutting fuel and herbicide now; categories
  extensible. Worker-paid tapping supplies (acid/water) are not owner
  inventory.
- INV-2 Inventory transactions: purchase/in, use/out, stock count, with date,
  quantity, unit, cost (if known), who reported.
- INV-3 Low-stock flag with an owner-set threshold per item; surfaces on the
  dashboard. (Reality: workers tell Ajarn Somwang, who tells the owner —
  recording is by the owner.)

## 13. Module FIN — Farm finance [SSOT §10–13, §27–30, §42]

**MVP:** expenses, payer, reimbursements, lifecycle, salary, special
payments, travel, income streams, basic cash-flow/reserve view.
**Deferred:** advanced forecasting and reserve methodology.

- FIN-1 **Never collapse into one field** [§42]: what the expense is
  (category), which property it belongs to, who actually paid, lifecycle
  (Actual / Committed / Planned), who owes whom, repaid amount, balance.
- FIN-2 Lifecycle: **Actual** (occurred + paid) · **Committed** (ordered, not
  necessarily paid) · **Planned/Forecast** (expected). Planned appears in cash
  planning, never in actual totals [§11].
- FIN-3 Actual payer: Owner · Ajarn Somwang · Owner's younger sibling ·
  rubber worker · extensible.
- FIN-4 **Reimbursements / money owed**: when someone other than the farm's
  funds pays, a payable is created — who is owed, linked expense(s), original
  amount, repayments (full/partial/instalments/later), remaining balance,
  dates, status [§10.1–10.2]. Owner-paid farm expenses are farm expenses
  payable to the owner, not household spend.
- FIN-5 Farm manager salary: 15,000 THB/month recurring, paid by owner,
  separate from his advances [§12].
- FIN-6 Worker special payments (accident help, support, food/goods, other)
  recorded separately from the 50% sale share [§12].
- FIN-7 Travel trip: date(s), origin/destination, **multi-select purposes**,
  properties involved, expenses (fuel, tolls, hotel, meals, other), receipts/
  photos, notes. Recorded as one combined cost; allocation to properties is
  **optional** and never fabricated [§13].
- FIN-8 Income streams: rubber sales (from SET), Takhian Thong rent, future
  Khlong Phlu durian profit share/rent; intended-use tags (family expenses,
  insurance, farm reserve) [§30].
- FIN-9 Basic cash-flow view: monthly expected inflow/outflow, net, upcoming
  obligations (salary, committed, planned, reimbursements owed), and a
  reserve figure with its assumptions and sources labelled. Owner decides the
  reserve [§27–28].
- FIN-10 Durian lease records hold only what the lease says; unknown terms are
  Unknown [§14].

## 14. Module WX — Weather [SSOT §22–23, Q106]

**MVP:** forecast + stored actual weather per farm coordinates, rule-based
alerts → suggested tasks. **Deferred:** Windy production integration.

- WX-1 Weather tied to farm GPS coordinates (coordinates are owner-entered;
  currently unknown — not invented).
- WX-2 Provider abstraction: historical and forecast providers swappable
  independently. Do not assume Windy Premium grants API rights.
- WX-3 Actual/historical weather **stored in the app's own database** (where
  licensing permits); forecast never mixed with actual.
- WX-4 Variables: rainfall, accumulated rainfall, rainy-day count,
  temperature, humidity, wind, heavy-rain/storm, dry periods.
- WX-5 Weather → rule/AI recommendation → owner chooses whether to create a
  Task (e.g. heavy rain → inspect riverbank/drainage/roads). Never silent.

## 15. Module ANA — Dashboard, timeline & analytics [SSOT §31–33, Q59–Q61, Q70–Q109]

**MVP:** Today view, timeline, basic charts with comparison periods,
drill-down. **Deferred:** final dashboard visual design, market-price
integration.

- ANA-1 **Home = "ตอนนี้มีอะไรที่ฉันควรรู้หรือควรจัดการ?"** — prioritised
  items: urgent issues, tasks due, document expiries, open incidents, weather
  alerts, latest sale/production, finance items (reimbursements owed,
  upcoming expenses), low stock. Layout not locked; drill-down required.
- ANA-2 **Timeline**: chronological sales, weather events, fertilizer,
  inspections, incidents, tasks, expenses, notes, photos, documents; each
  links to its record [Q60, Q84].
- ANA-3 Reports/charts with selectable metric, period, zoom, drill-down,
  comparison and source-data access [Q76]. Sensible default views exist.
- ANA-4 Comparison periods: presets (previous sale, previous 3 sales, previous
  month, same period last year, seasonal) + custom range; system may
  recommend, owner chooses [Q61, Q78, Q102].
- ANA-5 Dimensions: farm, zone, worker, weighing point, sale, period, year
  [Q73]. Worker→zone assignments are time-bounded and analytics use the
  assignment valid at the time [Q94].
- ANA-6 KPIs: production kg, **kg/rai** (using historically correct area),
  price, revenue, cost per kg where data supports, fertilizer vs production,
  reimbursement balances, income vs expenses [§32, Q103].
- ANA-7 **Sale interval** (days between sales) is the context measure; it is
  never presented as tapping days. Long intervals take a quick reason (rain,
  farm condition, workforce, seasonal stop, buyer scheduling, intentional,
  unknown, other) + free text [Q104–Q105].
- ANA-8 Market price vs farm selling price chart with **actual-value** and
  **indexed (=100)** modes [Q107–Q108] — **Deferred** until a market source is
  confirmed; farm price history chart is MVP.
- ANA-9 Correlation is never presented as causation [Q88].

## 16. Module AI — AI assistance [SSOT §21, Q62–Q71, Q82–Q89, Q109]

**MVP: basic** — explain a chart/number, answer questions in chat, suggest
tasks; online-only (AI is never in an offline-critical path).
**Deferred:** proactive anomaly monitoring, learned preferences.

- AI-1 Output always separates **Fact · Pattern/Correlation · Interpretation
  · Recommendation · Unknown**, and cites source records (drill-through).
- AI-2 Insufficient data → says **"ไม่รู้ / ข้อมูลไม่เพียงพอ"**, lists what is
  missing and what would help [Q66, Q89].
- AI-3 Charts offer **Explain · Trace · Ask follow-up** [Q109].
- AI-4 Natural-language chat with in-conversation context; database is the
  source of truth, not chat memory; asks when ambiguous [Q67, Q69].
- AI-5 Chat may **prepare** actions (create/edit task, reminder, data change,
  notification recipient) — shown as a diff, executed only on explicit owner
  confirmation [Q68].
- AI-6 AI never silently changes preferences/rules; proposed learned rules
  need owner accept/reject/edit [Q64].

## 17. Module INT — Integrations

All **Deferred** for V1, designed for:
- INT-1 LINE ingestion of Ajarn Somwang's text/photos/video/voice → records
  in **Needs Review** [§36]. Requires LINE Official Account / Messaging API
  validation.
- INT-2 JotWai data contract: farm income, farm expenses, reimbursements,
  rent → JotWai [§29].
- INT-3 Market price source (TradingView symbol TBD) [§7].
- INT-4 Windy / weather provider licensing [§22].

---

## 18. Non-functional requirements

### NFR-1 Platform & form factor
- Android phone first (one-handed, standing, sun, gloves); iOS kept working via
  Expo. **Portrait is the primary orientation**; only the weighing screen's
  public mode may rotate to landscape (D-17). Supersedes the old landscape
  lock.
- **Web is a real surface** (D-19): dashboards, finance, reports and AI from a
  computer/tablet, and works offline too (IndexedDB, not localStorage).
- **Thai-only UI** (D-20). The English locale built in S24 is removed; spoken
  output is Thai. Numerals stay Arabic digits.

### NFR-2 Offline, durability & sync
- Nothing in an MVP workflow blocks on the network (AI and weather fetches are
  the only online-only features, and they degrade gracefully).
- A recorded basket survives app kill, screen lock, force quit and restart.
- Media is captured into a local queue and uploaded by the sync engine.

### NFR-3 Trust & auditability
- Every money figure traces to recorded baskets, prices, shares, deductions
  and rounding lines. Weights in integer grams, money in integer satang;
  rounding happens only at the explicit rounding step or for display
  [carried].
- Ordering never depends on the device clock alone; a wrong clock is flagged,
  never blocking [carried FR-12].

### NFR-4 Field usability
- Readable in direct sunlight (high-contrast light theme as field default);
  colour never the only carrier of state [carried design system].
- Minimal typing; remembered defaults; obvious sync state; big touch targets.

### NFR-5 Security & privacy
- Farm Group isolation enforced server-side (security rules), not only in UI.
- Separate **dev** (CI, PR previews, seed data only) and **prod** (real farm
  data) environments; public preview links never reach prod data.
- Worker documents and finance are sensitive: access only via authenticated
  group membership; media URLs not publicly guessable.

### NFR-6 Infrastructure & cost (owner rules, 2026-10-02)
- **Firebase on the Blaze plan with a budget alert** (≈ $5/month), region
  asia-southeast1; Firestore as the backend database, Cloud Storage for media
  (D-1). Expected cost at 3 users ≈ ฿0–30/month.
- **PR previews on Google Cloud Run**: every PR gets a preview link; deleted
  when the PR closes or **7 days after its latest deploy**; container images
  kept to **at most 2 versions or 30 days** (D-21).
- **GitHub Actions minutes are a budget**: CI is fast and fail-fast; no
  duplicate push+PR runs; docs-only changes skip build/e2e/preview.
- Detailed design: `docs/architecture.md`.

## MVP acceptance checklist

A V1 build is ready for real farm testing only when all of these pass
[SSOT checklist, adjusted by the Decision log].

**Access** — Google Login works · LINE Login marked integration-dependent ·
multiple Owners share a Farm Group · a User in multiple groups · selection
behaviour (one → direct, many → choose) · works offline after sign-in.

**Offline / sync** — sale created with no internet · offline record usable
immediately · Pending Sync visible · auto retry · reconnect triggers sync ·
no data loss on failure · retry action shown on error/conflict · 3 devices
share one dataset · conflicting money/count edits never silently overwritten
· handoff ส่งต่อ/รับช่วง works offline · QR merge at close works · near-
simultaneous baskets from two devices raise a duplicate question with an
overlap timeline.

**Sale** — start Farm → Zone/Tapper → point · any point first · multiple
points and farms · numbers continue across points · zero/tare check per
setting · 50 kg and 60 kg hold-to-record · partial kg entry (reading − tare) ·
partial stays open · continue-or-start-new prompt on same tapper · forced
remainder on tapper change · "จบเข่งแล้ว / เป็นเศษ" · bridge shows (20 + 30) ·
recorder mode shows the 6 figures · public mode + Thai voice · bulk entry
marked บันทึกย้อนหลัง · total kg correct · amount = price × kg · price
enterable any time before settlement · Draft/Completed/Cancelled · Completed
editable with reason when money changes · Soft Delete/Restore.

**Settlement** — buyer reconciliation side-by-side · drill-down to baskets ·
Difference found closable with reason · Daeng/Nat separate · owner share
combined · rounding asked, last choice remembered · separate payment
statuses · fertilizer deduction capped with carry-forward.

**Farm operations** — inspection offline · incident with zero cost · incident
timeline · manual task · AI suggestion needs confirmation · inventory ·
worker/family documents · expiry reminders · GPS where available.

**Finance** — expense has property/category · actual payer · reimbursement
balance · Actual/Committed/Planned · manager salary · special payments ·
multi-purpose trip without forced allocation · basic cash-flow/reserve view.

**Analytics** — Today view · timeline · basic charts · drill-down · history
available · comparison periods selectable · AI cites sources · AI says when
data is insufficient.

## Open items (not invented, owner to supply over time) [SSOT §39]

Farm coordinates · zone names/boundaries · tree counts per farm · Khlong Phlu
lease terms & profit-share % · fertilizer price history · market price symbol
· Windy API rights · historical weather provider · document legal rules ·
buyer details · notebook sales
history · task recurrence rules · final dashboard layout · JotWai contract ·
backup/retention · reserve methodology.

## Decision log

Append-only. Newest last. Each entry names the requirement it changes.

- **2026-10-02 — PRD rebased on [SSOT].** Scope widens from "run and settle
  one sale" (v0.4) to Farm Management MVP (sale + operations + finance).
  PRD v0.4 non-goals "not an agronomy/fertiliser tool", "sale-side only" are
  reversed by SSOT Q111.

Owner answers to the old→new conflict review, 2026-10-02/03. "Old" = PRD
v0.4 / architecture v0.1 / epics 1–2 / stories S1–S32.

| # | Topic | Old | Decision | Changes |
|---|---|---|---|---|
| D-1 | Billing / backend | No backend | **Firebase Blaze + budget alert; separate dev/prod projects; asia-southeast1** | NFR-5, NFR-6 |
| D-2 | Login | No auth | **Google first; LINE later** (integration-dependent) | ACC-1 |
| D-3 | Manual sync | Manual sync trigger required (CLAUDE.md, NFR-2 v0.4) | **Automatic; retry action only on error/conflict** | SYNC-2 |
| D-4 | Multi-device | One device, one operator | **Offline "ส่งต่อ/รับช่วง" handoff + QR merge at close; free mode with 7–10 s duplicate detection + overlap timeline; Bluetooth after MVP** | SYNC-5…8 |
| D-5 | Rounding | Hard-coded: owner rounds, tapper gets remainder | **Ask each time; remember last choice** | SET-5 |
| D-6 | Tare & zero check | Tare + gate before every pile (S9) | **Net basket and tare presets as Farm Group config with per-sale default; gate kept per point, setting to show only at each farm's first point or skip all** | MD-7, SALE-6/7 |
| D-7 | Count gesture | Hold 1.5 s (owner rejected tap 2026-08-03) | **Short hold ~0.5–1 s, configurable** | SALE-8 |
| D-8 | Voice & 10 m display | Thai speech + full-screen 10 m numeral | **Keep Thai voice; recorder mode (6 figures) by default, switchable public mode** | SALE-14…16 |
| D-9 | Sale scope | One sale across farms (2026-08-03) | **Kept — one sale may span farms** | SALE-1 |
| D-10 | Sale location & roles | Farm or ล้ง yard; manager + worker lead required | **Farm only; manager auto-filled; worker-lead field removed** | SALE-2 |
| D-11 | Price | Before first basket; %DRC mode; S30 price references; FR-7.3 adjustments | **Any time before settlement; %DRC, S30 and bargained adjustments dropped** | SALE-3, SET-8 |
| D-12 | Split | Per-zone contracts 50/60/70 + `basis` | **Per-tapper, time-bounded, default 50/50; `basis` removed** | MD-8 |
| D-13 | Bridge basket | Short basket closed within one pile | **Same tapper only; at next point choose continue vs start new** | SALE-11/12 |
| D-14 | Late entry | Bulk entry (2026-08-11, unbuilt) | **Kept, per weighing point** | SALE-18 |
| D-15 | Buyer mismatch | Social cross-check by eye | **Fix at the basket; money always from baskets; Difference found + reason if unresolved** | SET-3 |
| D-16 | Editing Completed | Reopen + typed reason + 2 confirms | **Direct edit; short reason only if money changes; statuses flagged** | SALE-21 |
| D-17 | Orientation | Landscape lock (later unlocked, S19) | **Portrait primary; public mode may rotate** | NFR-1 |
| D-18 | Fertilizer deduction | Per-sale deduction, owner bears none, payout may go negative (S29) | **Ledger across sales; worker 50%; deduction capped at share, remainder carries** | FERT-4…6 |
| D-19 | Web | Verification surface only (localStorage) | **Real surface, offline (IndexedDB)** | NFR-1 |
| D-20 | Language | Thai + English switch (S24) | **Thai only** | NFR-1 |
| D-21 | Preview TTL | — | **7 days from latest deploy; deleted on PR close** | NFR-6 |

Superseded without a question (SSOT is explicit): multi-tenant SaaS and
buyer-as-tenant (→ Farm Groups, public SaaS deferred); owner/manager/worker-
lead roles (→ three equal Owners); per-pile count (→ continuous numbering);
open/closed pile & zone lifecycle (→ Draft/Completed/Cancelled + statuses);
device-local farm profile & people store (→ synced master data).
