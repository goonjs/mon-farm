# Epic: Second field round — Thai-first, pile-led, and reportable

Status: **Ready** — authored 2026-08-11 from the owner's second round of
hands-on testing, and **agreed the same day**. All three scope changes were
accepted; the PRD's out-of-scope list and epic 1's boundary table were
updated in the same session (`docs/process.md` §4). Nothing is implemented
yet — stories are written and worked one at a time from here.

## Decisions taken, 2026-08-11

| Question | Owner's answer |
| --- | --- |
| S28 reports — build it? | **Yes.** PRD out-of-scope entry reversed and narrowed to a completed-sale report, pile-deep, on-device. Export stays deferred. |
| S29 worker deductions — build it? | **Yes.** Epic 1's exclusion moved here. |
| S30 price reference — build it? | **Yes**, as a reference only, never blocking. |
| Deductions before or after the split? | **After.** Gross splits first; each worker's deductions come off their own share. The owner bears none of it and the buyer-facing total does not move. |
| Item 9 — a weight with no basket count? | **Bulk entry.** A pile that was not counted live opens a form — baskets, plus the weight of what is left over — instead of the counter. See S23. |
| Does bulk entry still need the zero/tare gate? | **No — skipped, and the skip is logged as an event. A typed reason is required.** |
| S30 — fetch the price programmatically? | **No — out of scope** (researched 2026-08-11; nothing publishes cup lump honestly). The app keeps a list of **sources** — name, note, URL — surfaced on the sale-setup screen to open by hand, and logs each observed price, plus the ล้ง's own, as a reference. Never in the money chain. |

## Decisions taken, 2026-09-03

Taken while planning S29 and S27, which are being built in parallel with the
counter-side corrections.

| Question | Owner's answer |
| --- | --- |
| S29 — is `basis` load-bearing once deductions exist? | **No. It stays inert**, and the claim above that it stops being inert was wrong. Deductions come off after the split, so the split is always on gross. Recorded in `types.ts` beside the field. |
| S29 — how is a deduction recorded and voided? | **Two `sys` payloads**, `deduction_added` and `deduction_voided`. Not a new top-level event kind, and not a widened `CorrectionEvent` — whose `pileId` is required and whose voids apply only to baskets. Same route `price_set` and `split_set` take. |
| S27 — do profile zones and piles get ids that survive across sales? | **Yes, and the profile's ids go into the log.** Prefill writes `zone_added` / `pile_added` carrying the profile's id, not a fresh random one. Today every sale mints throwaway ids, so nothing can be rolled up across sales except by matching names — which fails silently and undetectably. |
| S27 — where does long-run, cross-sale reporting live? | **A new story, S31**, after S28. S27 lays the identity groundwork only. |
| S27 — how is the profile stored? | **Full platform split**, following `src/store/people.ts`: port + web + native + memory. The phone is the real target; a web-only profile removes no retyping. |
| S27 — how does the profile reach a sale? | **An explicit button.** Nothing enters the event log because a screen was opened, and undoing an auto-prefill would need pile removal, which is S26 and not built. |

## Where this came from

Epic 1 is built and running. The owner ran the app against the real flow and
came back with ten items. Seven are corrections to how the app behaves in
the field; three ask for capabilities the PRD currently places outside v1.

Two of the ten were already anticipated as unwritten stories at the end of
epic 1 (S22, S23) and keep those numbers here rather than being renumbered.

## Goal

The app stops reading like a bilingual prototype and starts reading like an
instrument in Thai; the close flow follows the shape of the actual work
(piles finish, then the sale does); nothing about a short basket is hidden a
tab away; and a finished sale can be read back as a report broken down the
way the money was actually earned — by zone and by pile.

## The ten items, as stories

| # | Owner's item | Story | Kind |
| --- | --- | --- | --- |
| 1 | One language at a time, Thai focus; language switch secondary | **S24** | Correction |
| 2 | Close pile first; close sale secondary, after all piles | **S25** | Correction |
| 3 | Short-basket weight always visible while counting | **S22** | Correction |
| 4 | Short-basket weight visible in the Pile tab | **S22** | Correction |
| 5 | Piles editable and manageable | **S26** | Correction |
| 6 | Don't re-enter zones and piles every sale | **S27** | Correction |
| 7 | Sale reports, broken down by zone and pile | **S28** | Scope change — **agreed** |
| 8 | Per-worker deductions (ค่าปุ๋ย, ค่าใช้จ่ายอื่นๆ) | **S29** | Scope change — **agreed** |
| 9 | Bulk entry for a pile that was not counted live | **S23** | Correction |
| 10 | Rubber price from an API | **S30** | Scope change — **agreed, redesigned: record, don't fetch** |

---

## S24 — One language, Thai first

**Item 1.** Every label in the app is currently a hard-coded
`ไทย · English` pair — 137 of them across 12 files. That doubles the width of
every button and halves the size of the type that fits on a phone, on a
screen whose entire premise is being readable at ten metres.

**What changes**

- A string catalogue (`src/i18n/`) keyed by message id, with `th` as the
  default locale and `en` as the second. Thai is not "the translation" —
  it is the source locale, and `en` exists for a non-Thai buyer or a
  developer.
- Every screen and component renders one locale. The `·` pairs disappear
  from the JSX.
- The language switch lives in a settings surface, not in the chrome of a
  working screen. It is a per-device preference, not sale data — it belongs
  next to the theme toggle, not in the event log.

**Cost to be honest about**: 62 e2e assertions currently match on the visible
bilingual text, and the component tests do too. They migrate to the Thai
string or to `testID`. This is the single most invasive story in the epic in
line count, and almost none of it is logic.

**Do this first.** Every story after it adds labels. Sequenced any later and
each of them adds bilingual strings that S24 then has to migrate again.

---

## S25 — The close flow follows the piles

**Item 2.** The counter's footer offers `ปิดการขาย · close sale` as a
destructive-styled primary action, permanently, from the first basket
onward. Closing a pile is a tab away, in the Pile panel. That is backwards
from how the work runs: piles finish one at a time, and the sale finishes
once, at the end.

**What changes**

- The counter's footer action becomes **close pile** — the action that is
  actually reached many times in a sale.
- Close sale is offered when it is the real next step: on the pile-closed
  decision point once no pile is still counting, and from the Pile panel as
  a secondary action. It stops being a primary-weight button on the counting
  screen.
- No event-model change. `pile_closed`, `zone_closed` and `sale_closed`
  already exist and `PileClosedTransition` already names the options — this
  is which action is surfaced where, and with what visual weight.

---

## S22 — Short baskets are visible where the counting happens

**Items 3 and 4**, which are the same defect in two places. A short basket
is recorded correctly and priced correctly, but the only place its weight
can be read is the Log tab. On the counter, the caption shows the *expected
standard* reading (`2 + 50 = 52 กก.`) whether or not any short basket has
been logged; the Pile tab shows `เข่งไม่เต็ม · short: 1` — a count with no
weight beside it.

**What changes**

- The counting screen shows the short-basket weight for the current pile
  persistently, in the operator register (not on the public numeral — F-9.7
  owns that space and the numeral does not share it).
- The Pile panel's short row carries its weight, and the pile's weight is
  legible as standard + short rather than one merged figure.
- `Totals` already carries `shortBaskets` and `shortNetG` separately, so
  this is presentation. No model change, no new events.

### Open defect, found 2026-09-03 — the panel squeezes the numeral to nothing

Found by hand-driving the built app at 844×390, the phone-landscape viewport
this screen is designed for. **Reproduces on `main` alone** (`37b21f4`), so it
is S22/S25's to fix rather than a merge artifact of any other branch — it was
found from a branch that touches none of this, and confirmed by rebuilding
`main` on its own and repeating the steps.

**Repro**: start a sale, ready a pile, count one basket, tap `เข่งไม่เต็ม`.

**Seen**: `HoldStage` is `flex: 1`, and on a 390 px-tall screen the TopBar,
tabs, button row and the short-basket panel together exceed the height. The
stage collapses to **7 px** — measured, not estimated — so the count numeral
is an unreadable sliver, and the rotate hint, which is absolutely positioned
inside the stage, renders on top of the undo / short / close-pile row.

Screenshot: `docs/ux/screenshots/defect-short-panel-collapses-stage.png`.

**Why the e2e suite is green over it.** `e2e/short-basket.spec.ts:18`
("opening the panel never covers the count") asserts only that the panel's
top edge is below the numeral's bottom edge, with a comment explicitly
allowing the stage to shrink. A numeral squeezed to 7 px satisfies that
perfectly. The assertion is geometric where the requirement is about
legibility — F-9.7 is that the count is readable across a farm yard, and
nothing tests the property the screen exists for.

That is the same shape of gap that let a bug through in S29: a test that
checked the figures but not the name. Worth treating as a pattern rather
than two coincidences — a geometry assertion that permits the failure mode
it was written to catch is not a test, it is a comment.

**Suggested fix, not applied** (this is another session's file and its story
is still in flight): while the short panel is open the stage cannot be used —
you cannot hold to count and type a reading at once — so it can be hidden
rather than squeezed, or given a minimum height with the panel scrolling.
Whichever way, the guard should assert the numeral stays above a legible
size, not merely that nothing overlaps it.

---

## S23 — Bulk entry, for a pile nobody counted live

**Item 9,** and the owner's answer to how it should work. The app assumes it
was running before the first basket. In the field it will not always be:
someone arrives mid-count, or the day is worked without the app and the
numbers are entered afterwards.

**The shape, as decided**: a **bulk count action** on a pile that opens a
form instead of the counter — *how many baskets*, and *the weight of what is
left over*. Not a variant of the counting screen, and not a spreadsheet:
two fields, answering the two things a person actually knows about a pile
they did not watch being counted.

**Why this is the right split of the problem.** Whole baskets stay whole
baskets and price exactly as counted ones do. The leftover is recorded as a
weight, because that is what it is. The alternative — dividing the total
weight by the standard net — would invent a basket count nobody counted and
still leave a remainder to explain. This way nothing is rounded and nothing
is invented.

**What changes**

- A **bulk count** entry point on a pile that is not yet counting, taking
  the pile to the bulk form rather than to the zero/tare gate and the stage.
- The basket count appends that many `accept` events with a **distinct
  `source`** — the field is `'hold' | 'hold-kbd'` today, and this adds a
  third value. That distinction is the whole point: these baskets are not
  evidence of anything anyone watched, and the log must not pretend
  otherwise.
- The leftover weight appends **one `short` event** carrying it. `short` is
  already defined as an observed weight rather than a whole basket, which is
  exactly what a remainder is — no new event kind is needed, and the
  settlement's short-weight line already accounts for it separately from the
  standard-basket line.
- Totals and settlement need no change: both already sum `accept` and
  `short`.

**The zero/tare gate is skipped, and the skip is recorded** (owner,
2026-08-11). A pile entered in bulk has no scale reading to check, so the
gate has nothing to verify and asking someone to confirm a check they did
not perform would put a false record in the log. Instead:

- Bulk entry bypasses the gate.
- **A `sys` event records the skip**, so the log says the check was skipped
  rather than staying silent about it. Silence would be indistinguishable
  from a pile that was checked — the same reasoning as the `reject` event
  in F-7: a thing that did not happen has to be visible as *not having
  happened*, not merely absent.
- **A reason is required** to enter a pile in bulk, typed by the person
  doing it, and carried on the event. This is the same bar `pile_reopened`
  and `void` already meet: an action that puts numbers into the record
  without anyone watching them being produced has to say why.

That combination is what keeps a bulk-entered pile honestly distinguishable
from a counted one at every level — the baskets carry a distinct `source`,
the gate skip is on the record, and the reason says why.

---

## S26 — Piles are editable

**Item 5.** A pile can be added, and after that it is permanent and
immutable: no rename, no correction of a mistyped tare, no removal of one
added twice. Zones have the same gap.

**What changes**

- New events — `pile_edited`, `pile_removed`, and the zone equivalents.
  Append-only, like everything else: a rename is a new event, never a
  rewrite of `pile_added`.
- **The `locked` rule stays.** `stdNetG` locks once counting starts
  (FR-3.4), and every `accept` already snapshots the net it was counted at,
  so editing a pile's standard net can never retroactively move money that
  has been agreed out loud. Editing is allowed; rewriting history is not.
  A pile with baskets in it can be renamed; its standard net cannot be
  edited, and removal is a void with a reason rather than a delete.

---

## S27 — A farm is not re-typed every sale

**Item 6.** Every sale starts from an empty setup screen. The same zones and
the same piles, with the same tares, get typed in again each time — and each
retype is a chance to enter a different tare for the same basket.

**What changes**

- A farm profile stored per device, alongside the people store
  (`src/store/people.ts` is the pattern to follow): zones, and each zone's
  usual piles with their tare and standard net.
- Setup offers the profile as the starting point — prefilled, editable,
  and rejectable — rather than a blank form.
- Where the profile comes from: I'd propose it is **maintained explicitly**
  (a settings surface, seeded from the last sale on first use) rather than
  implicitly re-read from the last log each time. Implicit inheritance means
  a one-off change in one sale silently becomes next month's default, and
  the owner cannot see what the app decided to remember.
- The profile is device configuration, not sale data. It stays out of the
  event log.

---

## S28 — Reports (scope change — agreed)

**Item 7.** Per-zone and per-worker reporting is currently listed in the PRD
under **"Out of scope (v1)"**, with the reasoning that it is a second
product surface that can only be designed well once real sales exist. FR-7.5
(the derivation shown per zone and per pile) *is* in scope, and settlement
already renders per-zone rows and a per-worker card.

So the gap between what exists and what item 7 asks for is: a **report for a
completed sale**, broken down to **pile** level, that can be read back after
the fact and shared.

**What changes, if agreed**

- Pile-level rollups in the settlement derivation — `pileTotals` exists and
  is already used by the Pile panel; the money chain per pile is the same
  arithmetic applied one level down.
- A report view for a closed sale, reachable from the sale list, with the
  breakdown collapsible by zone → pile.
- Export/share (FR-10.2) is a separate question and I would keep it out of
  this story: the format is an open question in the PRD (slip, PDF, LINE?)
  and it is not needed to read a report on the device.

**Agreed 2026-08-11.** `docs/prd.md`'s out-of-scope entry has been struck
and narrowed to this scope in the same session.

---

## S29 — Worker deductions (scope change — agreed)

**Item 8.** ค่าปุ๋ย and other expenses deducted per worker. This is FR-7.3
(adjustments), which the PRD supports but epic 1 **explicitly excluded**,
with a specific reason recorded in its boundary table:

> The settlement is a pure function of counts and one price. Adjustments
> make it a function of counts, price, and an editable list, which changes
> the audit story.

That reason is still true, and it is the thing to design against rather than
around. A deduction is money leaving a worker's share, so it needs the same
treatment the rest of the money chain gets: recorded as an event with an
amount, a reason, and who agreed it (FR-7.3 says exactly this), shown as its
own step in the derivation, and never silently folded into a total.

**What changes, if agreed**

- A `deduction_added` event carrying `personId`, amount in satang, reason,
  and who agreed it; voidable with a reason like any other correction, never
  edited in place.
- `settle()` gains a per-worker deduction step: each worker's payout becomes
  `share − deductions`, with the deductions itemised, not netted.
- The sale-level totals do **not** change. A deduction moves money between
  the owner and the worker; it does not change what the buyer pays. Keeping
  that separation explicit is what stops a deduction from looking like a
  weight error.
- `basis` (`'gross' | 'final'`) already exists on the split and is inert.
  **It stays inert** (owner, 2026-09-03) — this line previously claimed the
  opposite and was wrong. Because deductions come off *after* the split,
  `settle()` always splits on gross and there is no arithmetic for `'final'`
  to select. FR-8.5 still forces the choice at setup, which under this
  design is a question with no consequence; removing it is an event-shape
  change against logs that already exist and belongs in its own story.

**Agreed 2026-08-11: deductions come off AFTER the split.** Each zone's
gross is split first, then each worker's own deductions come off their own
share. The owner bears none of the deducted cost. Concretely, per worker:

```
share            = Σ (that worker's zones' workerSatang)
deductions       = Σ (that worker's deduction events)
payout           = share − deductions
```

The sale's gross, the owner's total and every zone row are **untouched** by
a deduction — it moves money between the two parties to the contract and
nowhere else. Keeping that visibly true is what stops a deduction from
reading like a weighing error, which is the failure mode epic 1's exclusion
was actually protecting against.

Epic 1's boundary table has been struck and pointed here in the same
session.

---

## S30 — Named price sources, checked by hand and logged

**Item 10, redesigned 2026-08-11** after the research below. The app records
where a price came from; it does not go and get it.

### What the research found

The question put to it was narrow: does anything publish **ยางก้อนถ้วย** —
cup lump, what this app prices — machine-readably, under terms permitting
automated access?

| Source | Verdict |
| --- | --- |
| **TFEX** | **Ruled out on relevance, not availability.** RSS3/RSS3D futures are ribbed smoked sheet, and TFEX's rubber futures settle off the **Osaka** benchmark — a Japanese export price twice removed from a Thai farmgate one. Showing it beside a cup-lump entry would mislead even labelled as a reference. |
| **Thai Rubber Association** | **No evidence it publishes cup lump at all.** Its orientation is export/RSS grades. |
| **RAOT** | **The only source that demonstrably prices cup lump** — its own column is `ยางก้อนถ้วย (DRC100%)`. But it publishes periodic bulk spreadsheets rather than a daily feed, on a **DRC 100%** basis, which is not the price paid at the gate. Its site is also a legacy CMS showing signs of compromise, so anything parsed from it would be untrusted input. |

Reachability was never verified — the research sandbox's proxy blocked all
three sites, so no robots.txt or terms were read. That half stays honestly
unanswered, and it stopped mattering: the blocking problem is not access but
**relevance**. Cup lump is a *local* price varying by district, buyer and
DRC. A national DRC-100% figure would sit next to the agreed price looking
authoritative while being materially different from it — in an app whose
premise is that the agreed number is the one that counts, that is a harm,
not a convenience.

### What is built instead

The insight the research forces: the number actually negotiated against is
**the ล้ง's own board**, and no API will ever carry it. So the app stops
trying to be the thing that knows the price and becomes the thing that
records where a price came from.

- **Sources are configuration**: a list the owner maintains, each with a
  **name**, a **note**, and a **URL**. Device settings, not sale data —
  same home as S27's farm profile.
- **The sale-setup screen surfaces them**, so a source can be opened and
  checked by hand at the moment the price is being agreed. The app's job
  here is to put the link where it is needed, not to follow it.
- **Observed prices are logged as references against the sale** — what the
  source said, when it was looked at, and a note. The ล้ง's own quoted
  price is logged the same way, as a first-class reference rather than a
  special case, because it is the one that matters most.
- **References never enter the money chain.** The agreed price
  (`price_set`) remains the only number settlement uses. A reference is
  context printed beside it — the same discipline FR-7.4 applies to every
  other figure on that screen.

### What this costs, which is the point

Nothing. No dependency, no outbound connection, no fetch to fail at the
scale, no parsing of an untrusted CMS, no terms-of-use question. The two
`CLAUDE.md` gates this story used to trip — dependency install and network
egress — do not apply to it any more, and neither does the offline-first
tension: there was never anything to be offline from.

**Model impact**: a new `sys` event for a logged reference, carrying a
snapshot of the source name (the same reason `zone_contract_set` snapshots
`workerName` — renaming a source next month must not rewrite what a past
sale recorded), the observed price, a note and when it was observed. The
source list itself stays out of the log, being device configuration.

**Still open**: nothing blocking. This can be built whenever it comes up in
the order below.


## S31 — Cross-sale reporting (added 2026-09-03)

**Not one of the owner's original ten.** It came out of planning S27: asked
how the farm profile should prefill a sale, the owner said the thing that
actually matters is being able to see *which zone performs how in the long
run*. That is a different question from S28, which reports one completed
sale.

S27 makes it possible by giving each profile zone and pile an id that
persists across sales (see the decisions table above). S31 is the report
itself: a zone's and a pile's earnings across a date range, over every sale
whose log carries that id.

**Deliberately after S28**, so it is designed once against a money model that
already includes deductions, and against a single-sale report that already
exists to be aggregated. Nothing about it is designed yet — this section
records that it exists and why, not how it works.

**A boundary to keep honest**: a sale set up by hand, without the profile,
carries throwaway ids and cannot join the rollup. That is the correct
outcome — nobody said those piles were the same piles — but the report has
to say so rather than quietly reporting a smaller number.

---

## Order of work

Corrections before capabilities; deductions before reports, so the report is
built once against the final money model.

1. **S24** — Thai-first strings. First for cost, not preference: it touches
   137 strings and 62 test assertions, and every story after it adds labels
   that would otherwise need migrating twice.
2. **S22** — short baskets visible on the counter and in the Pile tab
3. **S25** — close pile in the footer, close sale at the end
4. **S23** — bulk entry for a pile nobody counted live
5. **S26** — editable piles and zones
6. **S27** — farm profile prefills setup
7. **S29** — worker deductions
8. **S28** — reports, by zone and pile
9. **S30** — named price sources, logged by hand — no longer blocked
10. **S31** — cross-sale reporting, added 2026-09-03. Depends on S27 for
    stable ids and on S28 for the single-sale report it aggregates.

## Still open

Nothing blocking. Every question raised when this epic was drafted has been
answered — see the decisions table at the top.

## Definition of done for the epic

Unchanged from epic 1: every story at `Review` with its acceptance criteria
met, screenshots attached, an independent review resolved, and
`npm run verify` green from a clean checkout.
