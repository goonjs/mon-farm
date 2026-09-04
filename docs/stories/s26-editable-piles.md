# Story: Piles are editable

Status: **Review** — implemented 2026-09-03; independently reviewed by QA the
same day (see **Code review** / **QA notes**). Three defects were found;
findings 1–3 are fixed in the working tree with fail-first tests, finding 4 is
left for the dev and finding 5 needs a PO word. Cannot reach `Done` without
those two answers and a push to CI (`docs/process.md` steps 7–9), neither of
which is authorized here.

## Context

- Epic: `docs/epics/epic-2-second-field-round.md` (S26, Item 5)
- Related PRD section(s): FR-3.4 (tare/std-net lock), FR-5.4 / NFR-3
  (append-only correction, never mutate-or-remove)
- Related architecture section(s): `docs/architecture.md` local event log;
  `src/core/project.ts` (fold), `src/core/totals.ts` (`liveBaskets` /
  `zoneTotals` / `saleTotals` — all derive from `state.piles`, which is how a
  removed pile drops out of every rollup without touching a single basket
  event)
- Precedent: `docs/stories/s12-undo-and-void.md` (void-with-a-typed-reason,
  target event never mutated or removed)

## Description

A pile can currently be added and nothing else: no rename, no correction of a
mistyped tare, no removal of one created twice. Zones have the same gap. This
story adds two new append-only event kinds per entity — `pile_edited` /
`pile_removed` and `zone_edited` / `zone_removed` — so mistakes made at setup
time can be corrected without rewriting history.

The load-bearing constraint (unchanged from FR-3.4): **`stdNetG` locks the
moment a pile's first basket is counted.** Every `accept` already snapshots
`netG`/`tareG` at the moment it was counted (see the doc comment on
`AcceptEvent` in `src/core/types.ts`), so a pile's live config drifting later
never touches money already agreed out loud. This story must not weaken that
guarantee — editing is allowed, retroactively moving money is not. A rename
stays allowed at any time, locked or not, because a name carries no money.

Removing a pile is never a delete. An **empty** pile (no `accept`/`short`
ever recorded against it, voided or not) is removed with a lightweight
one-tap confirm. A pile that has counted **any** basket is removed only
through the same void-with-a-typed-reason pattern as S12: `pile_removed` is
always appended, never a row deleted, and its baskets and every event about
it stay in the log, readable, forever. What changes is what the pile
contributes going forward: a removed pile drops out of `zoneTotals`,
`saleTotals`, and `settle()` from that point on, exactly as if every one of
its baskets had been individually voided — without touching a single
basket event to do it.

## Acceptance criteria

**Editing a pile**

- [x] `pile_edited { pileId, name, tareG, stdNetG }` is a new append-only sys
      event. `pile_added` is never rewritten; the projection folds the latest
      `pile_edited` (by `seq`) over the pile the same way `tare_confirmed`
      already does for `tareG`.
- [x] Renaming a pile is allowed at any pile status — `not-started`,
      `counting`, or `closed` — and at any `locked` state. A rename mid-count
      does not touch `tareG` or `stdNetG` and does not affect any basket
      already counted.
- [x] Editing `tareG` or `stdNetG` is allowed only while `pile.locked` is
      `false` (before the pile's first basket). The setup screen's pile edit
      form disables (or omits) the tare/std fields once `locked` is `true`,
      leaving only the name field editable — mirroring how the counter
      screen already shows a 🔒 next to a locked `stdNetG`
      (`src/app/sale/[id]/counter.tsx:780`).
- [x] A `pile_edited` event that changes `tareG` or `stdNetG` on an already
      `locked` pile is rejected by a guard function (e.g. `canEditPileNet`)
      before it is appended — this is a second, code-level enforcement of
      FR-3.4, not just a UI affordance the user could bypass.
- [x] Editing an unlocked pile's tare or std does not alter any `accept`
      event already in the log (there are none yet, by definition of
      unlocked) and does not require re-confirming zero/tare — that gate is
      unchanged and runs at first count regardless of when the pile's config
      was last edited.

**Removing a pile**

- [x] `pile_removed { pileId, reason }` is a new append-only sys event.
      `reason` may be `''` when the pile is empty; it must be a non-empty,
      trimmed string when the pile has ever had an `accept` or `short`
      recorded against it (checked with `liveBaskets`/raw event scan, not
      just the pile's current status — a pile whose only basket was later
      voided still counts as "had baskets" for this rule, since the event
      happened).
- [x] A guard (e.g. `canRemovePileFreely` / `pileNeedsVoidReason`) tells the
      UI which path to offer: an empty pile gets a lightweight one-tap
      remove-with-confirm; a pile with any basket history is routed to the
      same typed-reason modal pattern as void (S12), and the "remove" label
      in that flow reads as **void the pile**, not delete — the event
      appended is the same `pile_removed` either way.
- [x] A removed pile is never deleted from `state.piles` — it remains in the
      projection (so its history stays inspectable) but carries a
      `removed: true` flag (new field on `Pile`), and is excluded from:
      `zoneTotals`, `saleTotals`, `subsetTotals` when its id is passed, and
      `settle()`'s per-zone and per-worker figures — as if every basket in
      it had been voided, without touching the basket events themselves.
- [x] The setup screen and the counter's pile switcher no longer offer a
      removed pile as a counting target; the pile's row and its baskets
      remain visible in the event log view (`counter.tsx` log renderer) with
      a `pile_removed` line naming the reason.
      *(QA: failed as shipped for the post-close decision point's "next pile
      in this zone" affordance, which is a counting target by another name —
      fixed, see Code review finding 2.)*
- [x] Removing a pile that is currently `counting` or `closed` is allowed
      (removal is a statement about "this pile should never have counted, or
      is being retired", independent of lifecycle status) — it still goes
      through the has-baskets/no-baskets fork above.
- [x] A removed pile cannot be re-added under the same id; a genuinely new
      pile (new id) is the only way back in — this story does not add an
      "unremove" event, matching how `pile_reopened` is a distinct concept
      from removal and is out of scope here.

**Zones — the same two verbs**

- [x] `zone_edited { zoneId, name }` — rename only; zones carry no
      tare/net, so there is no lock rule to enforce here.
- [x] `zone_removed { zoneId, reason }` — same reason rule as piles: `''`
      allowed only when the zone is empty.
- [x] **A zone with piles under it cannot be removed directly.** `canRemoveZone`
      returns `false` while `zone.pileIds.length > 0` (evaluated over
      non-removed piles — once every pile under a zone has been removed via
      the pile flow above, the now-empty zone becomes removable). The setup
      screen surfaces this as "remove its piles first," not a dead button
      with no explanation.
- [x] A removed zone's own piles were already removed individually before it
      could be removed (previous AC), so no cascading removal logic is
      needed for zones — this story does not add one, on YAGNI grounds: nothing
      in S26 or the epic asks for cascade-delete, and inventing it multiplies
      the void-reason surface for no requirement behind it.

## Offline / sync behavior

`pile_edited`, `pile_removed`, `zone_edited`, `zone_removed` are ordinary
append-only sys events on the same local event log every other event in this
app already uses (expo-sqlite on device, localStorage on web) — no new
storage path, no new sync path. They queue and flush exactly like
`pile_added` and `zone_contract_set` already do. There is no backend yet, so
"sync" here means the existing local-log persistence only.

- [x] Feature is fully usable with no network connection — there is no
      network dependency in this story at all; every event is a local log
      append, same as the rest of the app.
- [x] Local writes made while offline are queued/persisted correctly —
      unchanged append path, no new persistence code.
- N/A Sync triggers on reconnect — no backend exists yet (repo-wide N/A,
      not specific to this story).
- N/A Manual sync trigger — same reason.
- N/A Conflicting local/remote changes — no remote yet.
- [x] Partial/failed sync leaves local data in a consistent, retryable
      state — an event either appends or it doesn't; there is no
      intermediate state a `pile_edited`/`pile_removed` could leave the log
      in, same guarantee every other event kind already has.
- [x] User has some visibility into sync status appropriate to scope — the
      existing `SaveStatusRow` / autosave-status pattern used elsewhere in
      setup.tsx is reused for the pile edit form; no new indicator invented.
- [x] No data loss scenario identified — by construction: nothing is ever
      deleted, `pile_removed` only changes what counts going forward, and the
      full history (including removed piles and their baskets) stays
      readable in the log.

## Test plan

**Vitest — `src/core/project.test.ts`**

- [x] `pile_edited` renaming a `not-started` pile updates `name` only.
- [x] `pile_edited` renaming a `counting` (locked) pile updates `name`,
      leaves `tareG`/`stdNetG` untouched.
- [x] `pile_edited` changing `tareG`/`stdNetG` on an unlocked pile updates
      both fields in the projection.
- [x] A second `pile_edited` replaces the first (latest-by-seq wins), same
      pattern as `zone_contract_set` replacement in S15's tests.
- [x] `pile_removed` on an empty pile with `reason: ''` sets `removed: true`
      and the pile still appears in `state.piles`.
- [x] `pile_removed` on a pile with a prior `accept` sets `removed: true`;
      the `accept` event is untouched and still present in the raw log.
- [x] `zone_edited` renames a zone; `zone_removed` on an empty zone sets
      `removed: true` on the zone (new field, mirrors `Pile.removed`).

**Vitest — new guard tests (`project.test.ts` or a new `guards.test.ts`
alongside `canCount`/`canReady`/`canReopenPile`)**

- [x] `canEditPileNet` is `true` before the first basket, `false` after
      (the FR-3.4 lock rule, mirrored from the existing
      `'the first basket locks the pile configuration (FR-3.4)'` test).
- [x] `pileNeedsVoidReason` is `false` for a pile with zero baskets ever,
      `true` for a pile with at least one (including one whose only basket
      was later voided by a `correction`).
- [x] `canRemoveZone` is `false` while the zone has any non-removed pile,
      `true` once all its piles are removed or it never had any.

**Vitest — `src/core/totals.test.ts` and `src/core/settle.test.ts`**

- [x] `zoneTotals`/`saleTotals` exclude a removed pile's baskets entirely,
      while `liveBaskets` over the raw log (no `state` filtering) still
      returns them — proving removal is a projection-level exclusion, not a
      log mutation.
- [x] `settle()` produces the same figures whether a pile's baskets were
      individually voided or the whole pile was removed after counting —
      the two paths must agree, since removal is documented as "as if every
      basket had been voided."

**Jest — component tests**

- [x] Pile edit form: renders tare/std fields enabled when unlocked, disabled
      (or hidden) with an explanatory label when locked; rename field is
      always enabled. Mirrors the existing `ZoneEditor` test patterns.
- [x] Remove-pile control: empty pile shows a one-tap confirm; a pile with
      baskets opens the typed-reason modal and submit is disabled until the
      reason is non-empty (same shape as the existing void-reason test for
      S12, if one exists — otherwise pattern off `useAutoSave`/`SaveStatusRow`
      tests already in the suite).
- [x] Zone remove control is disabled (with an inline reason shown) while the
      zone has any pile; enabled once empty.

**Playwright — new spec `e2e/pile-editing.spec.ts`**

- [x] Golden path: add a pile, rename it before counting, edit its tare and
      std, start counting, confirm the tare/std fields are now locked in the
      UI.
- [x] Edge case — rename mid-count: rename a pile after its first basket;
      assert the name changes and the running total is unaffected.
- [x] Edge case — edit tare before any basket: change tare on a
      `not-started` pile, confirm the zero/tare gate still runs correctly
      against the new tare at first count.
- [x] Edge case — remove a pile with baskets: attempt remove, assert the
      reason field is required and empty submission is blocked; submit a
      reason, assert the pile disappears from the counting switcher but its
      baskets are still visible in the log, and the sale total drops by
      exactly that pile's net.
- [x] Edge case — remove an empty pile: one-tap remove with no reason
      prompt, pile disappears from setup and counter immediately.
- [x] Edge case — zone with piles: attempt to remove a zone that still has
      piles, assert it is blocked with an explanation; remove all its piles,
      then remove the now-empty zone successfully.

## Verification

- [x] Sandbox run performed: the exported web build (`npm run build:web`)
      served statically and driven in a real browser by the full Playwright
      suite — 174 passed / 6 skipped across four viewport projects, including
      the 16 new `e2e/pile-editing.spec.ts` cases.
- [x] Screenshots (UI stories only) — golden path:
      `docs/stories/screenshots/s26/00-setup-piles.png`,
      `01-edit-unlocked.png` (+ `-floor`), `02-edited.png`.
- [x] Screenshots (UI stories only) — edge cases:
      `03-edit-locked.png` (+ `-floor`) — the FR-3.4 lock on screen;
      `04-remove-needs-reason.png` (+ `-floor`), `05-removed.png`,
      `06-log-after-removal.png` — the void path and what survives it;
      `07-removed-empty.png` — the one-tap path;
      `08-zone-blocked.png`, `09-zone-removed.png` — the zone rule.
- [x] **Independently re-verified by QA (2026-09-03).** The whole gate re-run
      from a clean tree at `6dc1e6d` — 174 passed / 6 skipped, exactly as
      claimed — plus a second real-browser walk driven by QA with its own seed
      log and its own assertions (101 checks, 0 failures, at 844×390 and at
      the 740×360 floor), and the fail-first claim confirmed in a throwaway
      clone. Three defects were found and two of the story's ACs did not hold
      as written; see **Code review** and **QA notes**. The gate was re-run
      green after the fixes (140 vitest / 84 jest / 174 e2e).
- [ ] Pushed, CI green — **still open.** Not authorised in this session, and
      the QA fixes are uncommitted in the working tree.

## Dev notes

### The three PO judgment calls — all three confirmed from the code

**1. One `pile_removed` for both paths — confirmed.** The alternative was two
event kinds (`pile_removed` / `pile_voided`). The existing precedent settles
it: `CorrectionEvent` already carries `mode: 'undo-last' | 'void'` in ONE
shape, because the fact recorded is identical — this basket no longer counts —
and only the ceremony the operator owed differs. Removal is the same shape one
level up: the fact is "this pile no longer counts", and `reason` carries the
difference (`''` for a pile nobody ever counted into, a typed sentence for one
somebody did). Two kinds would mean two fold cases, two log renderers and two
guards for one fact, and every reader of the log would have to know that both
mean the same thing. Note one place the analogy stops and the code is
stricter: `correction` keeps `mode` as a separate field, and S26 does not —
`reason` alone distinguishes the two, so there is no way for a `mode` to
disagree with an empty reason.

`pileNeedsVoidReason` decides which path the UI offers, and it asks the LOG,
not the pile's status or its totals: a basket that was counted and later
voided still happened. So a pile whose only basket was voided is still on the
typed-reason path — tested — and so is a pile filled in bulk (S23), because
bulk baskets are baskets.

**2. No un-remove event — confirmed, and it earns more than it looks.**
Removal being one-way is what makes `removedPileIds(events)` (a plain scan of
the log) provably agree with the projected `Pile.removed` no matter where in
the log the event sits: with an un-remove, both would need ordering by `seq`
and the rollups would have a second place to be wrong about money. The way
back in is a new pile with a new id, and the fold now enforces the other half
of that: `pile_added` (and `zone_added`) no longer overwrite an id the log
already knows, so a removed pile cannot be resurrected by re-adding its id —
which was the one hole the "no un-remove" rule had.

**3. No cascading zone delete — confirmed.** `canRemoveZone` is false while
any non-removed pile sits under the zone, and the setup screen says "เอากอง
ในโซนออกให้หมดก่อน" ("remove its piles first") next to the disabled control
rather than leaving a dead button. A cascade would decide on the operator's
behalf that every pile under the zone was a mistake, when each pile is its own
statement with its own reason — and it would have to invent a reason to attach
to piles that had counted. Nothing in S26 or the epic asks for one (YAGNI).

Where the story left an inference to make: it says a zone's `reason` may be
`''` "only when the zone is empty", but `canRemoveZone` means a zone is
*always* empty of live piles at removal time, which would make `reason` dead
weight. Resolved by mirroring the pile rule one level up —
`zoneNeedsVoidReason` is true when the zone has ever had a pile at all. A zone
typed by mistake goes in one tap; a zone that had to be emptied is a real part
of the sale being retired, and says why.

### Where the lock is actually enforced

Three places, deliberately, and only the first two are enforcement:

1. `canEditPileNet(state, pileId)` — asked at the write path in
   `PileRow.save` before `pile_edited` is appended. A locked pile's event is
   written carrying the weights it already has, never the edited ones.
2. `projectSale`'s `pile_edited` case applies `name` always and
   `tareG`/`stdNetG` only while `!p.locked`. This is the one a direct append
   cannot bypass: an event that reaches the log by any other route still
   cannot move the pile's live configuration.
3. The form (`PileEditor`) renders the tare/std fields read-only with an
   explanatory line. That is an affordance, not a guarantee, which is exactly
   why 1 and 2 exist.

Note what none of them touch: money already agreed. Every `accept` snapshots
`netG`/`tareG` at the moment it was counted, so the past was already safe. What
the lock protects is the configuration the NEXT basket would be counted
against.

### Removal is an exclusion at the rollup, not a mutation of the log

`liveBaskets` still returns a removed pile's baskets — it answers "was this
basket voided", which is a question about the basket, and the log tab has to
keep showing them as the real, unvoided events they are. The exclusion is
applied one level up, in `totals.ts`'s new private `countingBaskets`, which
every rollup (`zoneTotals`, `saleTotals`, `subsetTotals`, and therefore
`settle()`) goes through. It is applied there once rather than by each caller
because `saleTotals`/`subsetTotals` take a log and no state, and a caller that
had to remember to filter would eventually forget — and forgetting means
paying for rubber somebody already said was not being sold. `settle.test.ts`
pins the equivalence the story states in words: removing a counted pile and
voiding each of its baskets individually produce identical figures.

`pileTotals` is deliberately NOT filtered: it is the pile's own record, and a
removed pile's history has to stay readable.

### S23 interaction

Removal and editing were checked against a bulk-entered pile specifically: the
totals test removes a 13-basket bulk pile and asserts the rollups drop to zero
while `liveBaskets` still returns all 13; `pileNeedsVoidReason` puts a bulk
pile on the typed-reason path (bulk baskets are baskets); and an e2e case
removes a closed bulk pile and checks the sale total drops by exactly its
weight. Nothing here needed `appendMany` — every S26 write is a single event,
so `append` (a batch of one) is the right primitive and no new batch was
invented.

### Deviations from the story text, and why

- **The pile edit form uses an explicit Save, not the screen's debounced
  autosave** (the story's offline section suggested reusing
  `SaveStatusRow`/`useAutoSave`). The debounce exists for a card being typed
  into for the first time, where "did that save?" is the confusion being
  removed. An edit form is opened on purpose and closed on purpose, and a
  correction that lands 300 ms after the last keystroke — with the form still
  open — would be indistinguishable from one that did not land. Zone rename
  works the same way, for the same reason. The autosave cards on that screen
  are untouched.
- **Removed piles and zones are hidden from the setup screen entirely**
  rather than shown struck through. The story requires them to stay
  inspectable, and the log tab is where the record is read; leaving retired
  rows on the screen whose job is "what is being sold today" would make the
  list say something false.
- **`RemoveControl` is one shared component** for both piles and zones (the
  story implies two controls). Both need the identical one-tap/typed-reason
  fork; the only difference is a blocked state, which the zone passes in as
  `blockedReason` so the explanation is on screen instead of a bare disabled
  button.
- **A new `pile-whole-sale` testID** was added to the counter's existing
  whole-sale stat. No behaviour change — the e2e "the sale total drops by
  exactly that pile's net" case needed something to read.
- **`canCount`/`canReady`/`canBulkEnter`/`canReopenPile`/`pilesStillCounting`
  and `canOfferCloseSale` all now skip removed piles.** Not spelled out in
  the ACs, but a removed pile that could still hold the sale open, or be
  reopened into, would make the removal a lie.
- **The golden-path e2e seeds its pile rather than adding one through the
  form.** "Add a pile" already has its own coverage in `e2e/setup.spec.ts`;
  re-driving it here would test S6 again and make the S26 case slower and
  less specific about what it is actually asserting.
- **Not gated on sale status.** `canEditPileNet` and the removal guards do not
  require the sale to be open. Nothing in the story asks for it and the ACs
  explicitly allow removal at any lifecycle status; left as a question for
  review rather than invented here.

### Test evidence

Every test below was written first and seen to fail before the code existed:
23 failures in `project.test.ts` (guards and fold), then 29 across
`project`/`totals`/`settle` (rollup exclusion and the settle parity), then two
jest suites failing to resolve `./PileEditor` and `./RemoveControl` at all,
then the switcher case failing on a removed pile still being offered, then the
16 e2e cases against a setup screen that had no edit or remove controls.

## Code review

- **Reviewer (separate agent/session):** QA session, 2026-09-03, reviewing
  `6dc1e6d` against `docs/checklists/code-review-checklist.md` and
  `docs/checklists/definition-of-done.md`. Nothing the dev notes claimed was
  taken on trust: every load-bearing claim was re-derived from a harness
  written here, and every gate was re-run from a clean tree.

- **Findings**

  1. **`settle()` ignored `Zone.removed` — a retired zone stayed on the
     settlement sheet, and a mistyped one could block the sale from settling
     at all.** (Medium. Fixed here, `src/core/settle.ts`.) S26 added
     `Zone.removed` and every other consumer honours it — the setup screen,
     `ZonePileSwitcher`, `canRemoveZone` — but `settle()` still mapped over
     `state.zones` unfiltered. Two consequences, both reproduced in a real
     browser:
     - a retired zone printed a `฿ 0.00` per-zone row, and its named worker
       appeared in **แยกตามคนงาน** owed `฿ 0.00`, on the sheet the buyer and
       the owner read together (`qa-16-removed-zone-on-settlement.png`);
     - worse, a zone added by mistake and then removed with one tap — S26's
       own "typo" path — went on refusing to settle the whole sale under
       FR-8.5 ("โซนพิมพ์ผิด has no split…"), while the setup screen, which
       *does* filter removed zones out of the same check
       (`setup.tsx`'s `splitResolvable`), said the sale was ready to count.
       The app said ready and then would not pay out
       (`qa-17-settlement-blocked-by-removed-zone.png`).
     Fixed by filtering removed zones in `settle()`, with three tests in
     `src/core/settle.test.ts` (seen to fail against `6dc1e6d` first: 2 of 3
     red). After: `qa-18-removed-zone-after-fix.png`,
     `qa-19-settles-after-fix.png`.

  2. **The counter offered "next pile in this zone" on the strength of a
     removed pile.** (Medium. Fixed here, `counter.tsx:257`.) `nextPileInZone`
     was the one pile lookup on that screen the S26 sweep missed. With zone
     A's only other pile removed, closing กอง 1 still showed
     `กองถัดไปในโซนนี้ →`, and tapping it was a dead end: `pickPile` selects an
     id that the live-pile resolution immediately falls back away from, so the
     operator is told there is more to count here and then left on the same
     closed pile (`qa-20-next-pile-offers-removed-pile.png`,
     `qa-21-next-pile-dead-end.png`). This is the AC "the counter's pile
     switcher no longer offer[s] a removed pile as a counting target" —
     the switcher was fixed, its sibling path was not. After:
     `qa-22-next-pile-after-fix.png`.

  3. **The close-sale confirm counted removed zones and piles in its scope
     line.** (Low. Fixed here, `counter.tsx`.) `{zones} โซน {piles} กอง` read
     off `state.zones.length` / `state.piles.length`, so a sale with one live
     zone and one live pile announced "2 โซน 3 กอง" at the moment of closing.
     S25 added that line specifically to make the scope of the confirm honest;
     S26 made it capable of lying. Both counts now filter `removed`.

     Findings 2 and 3 are covered by three tests in
     `src/test/counter-screen.test.tsx`, seen to fail against `6dc1e6d` first
     (2 red — the third is the "still offers it when the zone has a live pile"
     control, which must pass both before and after).

  4. **`canRemovePile` is dead code.** (Low. **Removed**, in the S27 session —
     see the resolution note below.)
     `src/core/project.ts:452` exports it; nothing in `src/`, `e2e/` or any
     test calls it. The two guards the UI actually asks are
     `pileNeedsVoidReason` and `canEditPileNet`. YAGNI, and the DoD's "no
     dead code left behind". Either wire it into `PileRow` (it is the honest
     answer to "may this row offer a remove control at all") or drop it.

     **Dev's answer (2026-09-03, while in `project.ts` for S27): dropped, not
     wired.** Wiring it into `PileRow` was the other option the reviewer
     offered, and it was considered first — but `PileRow` only ever renders a
     pile that `ZoneEditor` has already filtered to `!p.removed`, so
     `canRemovePile(state, pile.id)` is `true` at every call site it could
     have. A guard whose false branch is unreachable is not a guard; it is a
     second, weaker copy of the filter above it, and the next reader would
     have to prove that to themselves before touching either. The two guards
     the removal path actually needs — `pileNeedsVoidReason` (which register)
     and `canEditPileNet` (what may still change) — are both asked and both
     tested. So: deleted from `src/core/project.ts`, no behaviour change, no
     test lost (it had none), YAGNI and the DoD's "no dead code left behind"
     both satisfied. Kept as its own change, separate from S27's work.

  5. **Not gated on sale status — the dev's deferred question.** Answered in
     QA notes below: **the reviewer agrees with the dev, with one caveat.**

- **Resolution:** findings 1, 2 and 3 fixed in the working tree by the QA
  session, each with a test written to fail first and the full gate re-run
  green afterwards. Finding 4 is left for the dev to decide (wire or drop) —
  it changes no behaviour. Finding 5 needs a PO word, not a code change.
  **The fixes are uncommitted and unpushed** — this session is not authorised
  to commit, and the repo's push gate is untouched.

## QA notes

Verified independently by a separate QA session on 2026-09-03 against
`6dc1e6d`, working tree otherwise clean.

### Per acceptance criterion

Every AC in this story was re-checked. **All pass** except the two noted:

- *Editing a pile* — all five ACs pass. `pile_edited` is append-only and
  `pile_added` is never rewritten; the fold applies the latest edit by `seq`;
  rename works at `not-started`, `counting` and `closed`; tare/std apply only
  while unlocked; and `canEditPileNet` refuses the write before the append.
- *Removing a pile* — all six ACs pass, including "a removed pile cannot be
  re-added under the same id" (the fold's `if (piles.has(...)) break;`).
- *Zones* — the rename, the reason rule and the `canRemoveZone` block all
  pass. The AC "a removed pile is excluded from `settle()`'s per-zone and
  per-worker figures" passes **for piles**; the zone-level analogue was not
  in the ACs and was **broken in the code** — see Code review finding 1.
- *Counter* — "no longer offer a removed pile as a counting target" **failed**
  for the decision point's next-pile affordance — Code review finding 2.
- *Offline* — no network path is touched; the append path is unchanged. The
  browser walk reloads mid-flow and every removal and edit survives it.

### The two claims that guard money — attacked directly, both hold

**1. The lock cannot be bypassed.** A `pile_edited` was appended *directly to
the log*, bypassing the form and `canEditPileNet` entirely, for:

- a pile counting right now (`stdNetG: 90 kg`, `tareG: 0.1 kg`),
- a pile filled by S23 bulk entry,
- and, in a real browser, by forcing a value into the read-only field with a
  native `value` setter and pressing Save.

In every case the projection took the **name only**; `tareG`/`stdNetG` did
not move, and the settlement — sale gross, owner, worker, every per-zone row
and every per-worker payout — was byte-identical before and after. The fold's
`if (!p.locked)` is the enforcement that a direct append cannot get past, and
it does hold. An unlocked pile's edit does apply, and a second edit replaces
the first (latest-by-seq).

**2. Removal equals voiding every basket.** Built a sale with two zones on
different contracts (70/30 and 55/45), counted 3 standard + 1 short into a
pile, and compared removing that pile against voiding each of its four
baskets individually. The comparison was made on the **whole settlement
object**, not the headline: `totals`, sale gross/owner/worker, every per-zone
row (net, gross, owner, worker, pct) and every per-worker payout. Identical.
`liveBaskets` still returns all four of the removed pile's baskets,
`pileTotals` still shows its 72 kg, the raw `accept` events are all still in
the log, and the Log tab renders them **not struck through** — because they
were not voided. `zoneTotals`, `saleTotals` and `subsetTotals` all drop it.

### Gate — re-run from a clean tree, then again after the QA fixes

| | at `6dc1e6d` | after the QA fixes |
|---|---|---|
| `tokens:check` · `contrast` · `typecheck` · `lint` | pass | pass |
| `test:core` (vitest) | 137 passed | 140 passed |
| `test:ui` (jest) | 81 passed | 84 passed |
| `build:web` | pass | pass |
| `test:e2e` (playwright) | **174 passed / 6 skipped** | **174 passed / 6 skipped** |

The dev's "174 passed / 6 skipped" is exact.

**Fail-first, verified in a throwaway clone** (never in the working tree):
reverting `project.ts`/`totals.ts`/`types.ts` to `6dc1e6d^` and keeping the
new tests gives **29 failures across `project`/`totals`/`settle`**, matching
the dev's claim exactly; removing `PileEditor.tsx`/`RemoveControl.tsx` makes
both jest suites fail to resolve, and the `ZonePileSwitcher` removed-pile case
fails on a removed pile still being offered. The claim is honest.

### A real browser, driven by QA

`npm run build:web`, served by `scripts/serve-dist.mjs`, driven through real
Chromium (playwright-core, `/opt/pw-browsers/chromium-1194`) at **844×390**
and at the **740×360 floor**. Not the dev's spec — a separate walk with its
own seed log, its own assertions, and the event log read back out of
`localStorage` after every step to check each event's *shape*, not just the
screen. **101 checks, 0 failures.**

Every control was measured against the viewport box (`boundingBox()` inside
`0,0 → w,h`, plus a document-level horizontal-overflow check), not merely
asserted `toBeVisible()` — that miss is what the S25 pass caught.

Walked: rename a pile mid-count · edit a tare before any basket · try to edit
the standard net after counting starts (fields read-only, explanation on
screen, forced value ignored on save) · remove an empty pile in one tap ·
remove a pile with baskets (confirm disabled on empty **and on
whitespace-only** reason; reason trimmed into the event) · rename a zone · try
to remove a zone that still has piles (blocked, `เอากองในโซนออกให้หมดก่อน`
shown) · empty it and remove it (which then demands its own reason) · re-add
a pile under a removed pile's name (new id, name reused freely) · reload ·
and read the Log tab back.

Event shapes confirmed from `localStorage`:
`pile_edited {pileId,name,tareG,stdNetG}` · `pile_removed {pileId,reason:''}`
and `{pileId,reason:'ชั่งผิดกอง'}` · `zone_edited {zoneId,name}` ·
`zone_removed {zoneId,reason}`. No `accept` event was mutated or dropped by
any of it.

**Screenshots** (all `qa-` prefixed; the dev's are untouched, and were
regenerated byte-identically by the e2e re-run):

- Golden path — `screenshots/s26/qa-00-setup.png`,
  `qa-01-edit-unlocked.png`, `qa-02-tare-edited.png`
- The FR-3.4 lock on screen — `qa-03-locked.png`,
  `qa-04-renamed-midcount.png`
- Removal, both registers — `qa-05-remove-empty.png`,
  `qa-06-remove-needs-reason.png`, `qa-07-removed.png`
- Zones — `qa-08-zone-renamed.png`, `qa-09-zone-blocked.png`,
  `qa-10-zone-removed.png`, `qa-11-readded.png`
- What survives — `qa-12-log.png`
- The 740×360 floor — `qa-13-editor-floor.png`, `qa-14-remove-floor.png`,
  `qa-15-zone-floor.png`
- Defects found, before and after the QA fix —
  `qa-16-removed-zone-on-settlement.png`,
  `qa-17-settlement-blocked-by-removed-zone.png`,
  `qa-18-removed-zone-after-fix.png`, `qa-19-settles-after-fix.png`,
  `qa-20-next-pile-offers-removed-pile.png`,
  `qa-21-next-pile-dead-end.png`, `qa-22-next-pile-after-fix.png`

### On the dev's deferred question — edit/removal are not gated on sale status

The dev left this open rather than inventing an answer, which was right. The
reviewer's view, for the PO to confirm:

**Leave it ungated. Editing and removing a pile should not require the sale
to be open.** Three reasons, in order of weight:

1. **It cannot move settled money anyway.** Every `accept` snapshots its own
   `netG`/`tareG`, and the lock stops a counted pile's config being edited at
   all. On a closed sale every pile has either counted (locked) or has no
   baskets to be wrong about. So the only edit available on a closed sale is
   a rename — and a name carries no money, which is the story's own rule.
2. **Removal on a closed sale is a real need, not a hypothetical.** The case
   that will actually happen is the one that is only discovered at
   settlement, with the buyer standing there: "that pile is not in this
   sale." Forcing a reopen for that turns a one-line correction into a
   lifecycle event, and `pile_reopened` means something else entirely.
3. **The record stays honest either way.** `pile_removed` is appended with
   its `seq` after `sale_closed`, so the log shows the removal happened after
   the sale closed, and the settlement screen recomputes rather than storing
   a frozen number (the app already says so on screen). Nothing is quietly
   rewritten.

**The caveat, and it is the PO's actual decision:** a removal after
`sale_closed` silently changes a settlement figure that two people may have
already read out loud and agreed. That is the one thing this app exists to
prevent — not because the arithmetic is wrong, but because the number moved
after the handshake. So: keep it ungated, but if the PO wants a guard, the
right one is **not** a status gate on the verb; it is a *warning on the
removal* — the confirm on a closed sale should say the settlement will change
and by how much. That is a small, separate story, and it is worth writing.

### Not verified here

- **CI.** Nothing was pushed (repo push gate), so "CI green" in the DoD is
  still open. Every gate CI runs was run locally instead, twice.
- **On-device.** Web build only. `expo-sqlite` was not exercised; S26 adds no
  new storage path, so the risk is the same as every prior story's.
- **Long-log behaviour.** The Log tab caps at 60 events, newest first. On a
  long sale a `pile_removed` will scroll out of the visible log like any
  other event. Pre-existing, not S26's doing, but it is the one place "the
  history stays readable" is readable *only if it is recent*.

### Follow-up, 2026-09-04 — the remove control shrunk to an icon

Owner feedback on the built app: `RemoveControl`'s collapsed trigger — a
full-width `destructive` `Button` reading "เอากองออก" — read as the loudest
thing on a pile row, sitting beside a plain "แก้ไข" for the row's least
common action. This is the same shape QA's S27 finding 6 named as an
observation ("the full-width red remove-pile button dwarfs the edit
control") and left open as cosmetic.

Changed to a small icon-only trigger (36×36, "✕" in `t.color.reject`,
`accessibilityLabel` carrying the real Thai label for anyone not reading the
glyph) with `alignSelf: 'flex-start'` so it no longer stretches to fill a
flex-grow parent. **The confirmation step is unchanged** — tapping the icon
still opens the same detail line, typed-reason field (when required), and
confirm/cancel pair; only the collapsed state changed. Failing-first test:
`RemoveControl.test.tsx` — "collapses to a small icon, not a full-width
labelled button", red against the pre-change component (asserted no text
content, an `accessibilityLabel`, and width ≤ 40), green after. Verified in
a real browser at 844×390 — screenshot evidence is the regenerated
`docs/stories/screenshots/s26/*.png` files, which is why several are dated
today rather than 2026-09-03.

Full gate re-run: tokens/contrast/typecheck/lint clean, 152 vitest, 97 jest,
190 e2e (unchanged pass count — no test asserted on the old label text).
