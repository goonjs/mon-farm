# Story: Piles are editable

Status: **Ready** — 2026-09-03

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

- [ ] `pile_edited { pileId, name, tareG, stdNetG }` is a new append-only sys
      event. `pile_added` is never rewritten; the projection folds the latest
      `pile_edited` (by `seq`) over the pile the same way `tare_confirmed`
      already does for `tareG`.
- [ ] Renaming a pile is allowed at any pile status — `not-started`,
      `counting`, or `closed` — and at any `locked` state. A rename mid-count
      does not touch `tareG` or `stdNetG` and does not affect any basket
      already counted.
- [ ] Editing `tareG` or `stdNetG` is allowed only while `pile.locked` is
      `false` (before the pile's first basket). The setup screen's pile edit
      form disables (or omits) the tare/std fields once `locked` is `true`,
      leaving only the name field editable — mirroring how the counter
      screen already shows a 🔒 next to a locked `stdNetG`
      (`src/app/sale/[id]/counter.tsx:780`).
- [ ] A `pile_edited` event that changes `tareG` or `stdNetG` on an already
      `locked` pile is rejected by a guard function (e.g. `canEditPileNet`)
      before it is appended — this is a second, code-level enforcement of
      FR-3.4, not just a UI affordance the user could bypass.
- [ ] Editing an unlocked pile's tare or std does not alter any `accept`
      event already in the log (there are none yet, by definition of
      unlocked) and does not require re-confirming zero/tare — that gate is
      unchanged and runs at first count regardless of when the pile's config
      was last edited.

**Removing a pile**

- [ ] `pile_removed { pileId, reason }` is a new append-only sys event.
      `reason` may be `''` when the pile is empty; it must be a non-empty,
      trimmed string when the pile has ever had an `accept` or `short`
      recorded against it (checked with `liveBaskets`/raw event scan, not
      just the pile's current status — a pile whose only basket was later
      voided still counts as "had baskets" for this rule, since the event
      happened).
- [ ] A guard (e.g. `canRemovePileFreely` / `pileNeedsVoidReason`) tells the
      UI which path to offer: an empty pile gets a lightweight one-tap
      remove-with-confirm; a pile with any basket history is routed to the
      same typed-reason modal pattern as void (S12), and the "remove" label
      in that flow reads as **void the pile**, not delete — the event
      appended is the same `pile_removed` either way.
- [ ] A removed pile is never deleted from `state.piles` — it remains in the
      projection (so its history stays inspectable) but carries a
      `removed: true` flag (new field on `Pile`), and is excluded from:
      `zoneTotals`, `saleTotals`, `subsetTotals` when its id is passed, and
      `settle()`'s per-zone and per-worker figures — as if every basket in
      it had been voided, without touching the basket events themselves.
- [ ] The setup screen and the counter's pile switcher no longer offer a
      removed pile as a counting target; the pile's row and its baskets
      remain visible in the event log view (`counter.tsx` log renderer) with
      a `pile_removed` line naming the reason.
- [ ] Removing a pile that is currently `counting` or `closed` is allowed
      (removal is a statement about "this pile should never have counted, or
      is being retired", independent of lifecycle status) — it still goes
      through the has-baskets/no-baskets fork above.
- [ ] A removed pile cannot be re-added under the same id; a genuinely new
      pile (new id) is the only way back in — this story does not add an
      "unremove" event, matching how `pile_reopened` is a distinct concept
      from removal and is out of scope here.

**Zones — the same two verbs**

- [ ] `zone_edited { zoneId, name }` — rename only; zones carry no
      tare/net, so there is no lock rule to enforce here.
- [ ] `zone_removed { zoneId, reason }` — same reason rule as piles: `''`
      allowed only when the zone is empty.
- [ ] **A zone with piles under it cannot be removed directly.** `canRemoveZone`
      returns `false` while `zone.pileIds.length > 0` (evaluated over
      non-removed piles — once every pile under a zone has been removed via
      the pile flow above, the now-empty zone becomes removable). The setup
      screen surfaces this as "remove its piles first," not a dead button
      with no explanation.
- [ ] A removed zone's own piles were already removed individually before it
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

- [ ] `pile_edited` renaming a `not-started` pile updates `name` only.
- [ ] `pile_edited` renaming a `counting` (locked) pile updates `name`,
      leaves `tareG`/`stdNetG` untouched.
- [ ] `pile_edited` changing `tareG`/`stdNetG` on an unlocked pile updates
      both fields in the projection.
- [ ] A second `pile_edited` replaces the first (latest-by-seq wins), same
      pattern as `zone_contract_set` replacement in S15's tests.
- [ ] `pile_removed` on an empty pile with `reason: ''` sets `removed: true`
      and the pile still appears in `state.piles`.
- [ ] `pile_removed` on a pile with a prior `accept` sets `removed: true`;
      the `accept` event is untouched and still present in the raw log.
- [ ] `zone_edited` renames a zone; `zone_removed` on an empty zone sets
      `removed: true` on the zone (new field, mirrors `Pile.removed`).

**Vitest — new guard tests (`project.test.ts` or a new `guards.test.ts`
alongside `canCount`/`canReady`/`canReopenPile`)**

- [ ] `canEditPileNet` is `true` before the first basket, `false` after
      (the FR-3.4 lock rule, mirrored from the existing
      `'the first basket locks the pile configuration (FR-3.4)'` test).
- [ ] `pileNeedsVoidReason` is `false` for a pile with zero baskets ever,
      `true` for a pile with at least one (including one whose only basket
      was later voided by a `correction`).
- [ ] `canRemoveZone` is `false` while the zone has any non-removed pile,
      `true` once all its piles are removed or it never had any.

**Vitest — `src/core/totals.test.ts` and `src/core/settle.test.ts`**

- [ ] `zoneTotals`/`saleTotals` exclude a removed pile's baskets entirely,
      while `liveBaskets` over the raw log (no `state` filtering) still
      returns them — proving removal is a projection-level exclusion, not a
      log mutation.
- [ ] `settle()` produces the same figures whether a pile's baskets were
      individually voided or the whole pile was removed after counting —
      the two paths must agree, since removal is documented as "as if every
      basket had been voided."

**Jest — component tests**

- [ ] Pile edit form: renders tare/std fields enabled when unlocked, disabled
      (or hidden) with an explanatory label when locked; rename field is
      always enabled. Mirrors the existing `ZoneEditor` test patterns.
- [ ] Remove-pile control: empty pile shows a one-tap confirm; a pile with
      baskets opens the typed-reason modal and submit is disabled until the
      reason is non-empty (same shape as the existing void-reason test for
      S12, if one exists — otherwise pattern off `useAutoSave`/`SaveStatusRow`
      tests already in the suite).
- [ ] Zone remove control is disabled (with an inline reason shown) while the
      zone has any pile; enabled once empty.

**Playwright — new spec `e2e/pile-editing.spec.ts`**

- [ ] Golden path: add a pile, rename it before counting, edit its tare and
      std, start counting, confirm the tare/std fields are now locked in the
      UI.
- [ ] Edge case — rename mid-count: rename a pile after its first basket;
      assert the name changes and the running total is unaffected.
- [ ] Edge case — edit tare before any basket: change tare on a
      `not-started` pile, confirm the zero/tare gate still runs correctly
      against the new tare at first count.
- [ ] Edge case — remove a pile with baskets: attempt remove, assert the
      reason field is required and empty submission is blocked; submit a
      reason, assert the pile disappears from the counting switcher but its
      baskets are still visible in the log, and the sale total drops by
      exactly that pile's net.
- [ ] Edge case — remove an empty pile: one-tap remove with no reason
      prompt, pile disappears from setup and counter immediately.
- [ ] Edge case — zone with piles: attempt to remove a zone that still has
      piles, assert it is blocked with an explanation; remove all its piles,
      then remove the now-empty zone successfully.

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
