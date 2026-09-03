# Story: The close flow follows the piles

Status: **Review** — 2026-09-03, implemented (TDD, whole gate green:
tokens/contrast/typecheck/lint/core/ui/build + e2e 130 passed, 6 skipped).
Awaiting the QA browser pass and an independent code review.

## Context

- Epic: `docs/epics/epic-2-second-field-round.md` — S25 (item 2 of the
  field-round corrections)
- Related PRD section(s): FR-6, FR-12
- Related architecture section(s): none — UI-only, no local-storage or sync
  shape change
- Design reference: `docs/ux/pile-zone-sale-lifecycle.md` §4 (the
  pile-closed decision point), §8 (the transition table)
- Depends on: S13 (`docs/stories/s13-close-lifecycle.md`) — `pile_closed`,
  `zone_closed`, `sale_closed` events, `PileClosedTransition`,
  `pilesStillCounting` all already exist and are unchanged by this story.

## Description

Today, `src/app/sale/[id]/counter.tsx`'s live-counting action row renders
`counter.closeSale` (`to-settlement`) as a permanent, destructive-styled
button beside `pile.close` (`row-close-pile`) — both plain buttons on the
same row, from the first basket a pile counts. That inverts how a sale
actually runs: a pile closes many times per sale (once per pile), the sale
closes exactly once, at the very end. The Pile tab (`PilePanel`) already
puts its own `close-pile` action behind a same-weight `Card`, matching the
footer — there is currently no screen where "close pile" reads as the
normal, frequent action and "close sale" reads as the rare, final one.

This story does not add or change any event. `pile_closed`, `zone_closed`,
`sale_closed` and the guards that gate them (`canCount`,
`pilesStillCounting`) already exist from S3/S13 onward and are exercised
correctly; `PileClosedTransition` already names all four decision-point
options, including close-sale. What changes is *where "close sale" is
offered and how much visual weight it carries*, plus removing it from the
one place it is currently offered too early: the live-counting footer.

**What changes**

- The counter's live-counting footer keeps `pile.close`
  (`row-close-pile`) as its primary/only close-type action. `to-settlement`
  is removed from this row entirely — closing the sale is no longer
  reachable while a pile is still counting.
- `PileClosedTransition`'s `decision-close-sale` button remains the
  pile-closed decision point's real "close sale" entry, but is offered
  there *only once no pile in the sale is still counting* — i.e. once
  `pilesStillCounting(state)` across every zone is empty. While at least
  one other pile is still counting elsewhere in the sale, that button does
  not render on the decision point; the operator's real next step is
  another pile, not the sale.
- `PilePanel` gains a secondary "close sale" action, visually subordinate
  to `close-pile` (smaller/plain vs. the pile card's own controls, not
  destructive-primary weight), for the case an operator wants to close the
  sale directly from the Pile tab without transiting the decision point —
  still gated on no pile anywhere in the sale still counting, same rule as
  the decision point.
- No other surface changes. Settlement's reopen-sale flow (S13) is
  untouched.

## Acceptance criteria

- [x] The live-counting action row (`pile.status === 'counting'`) no longer
      renders a close-sale button (`to-settlement` / any `counter.closeSale`
      trigger) at all — only `undo`, `short`, and `row-close-pile` remain on
      that row.
- [x] `PileClosedTransition`'s `decision-close-sale` button is rendered
      only when no pile in the whole sale — across every zone, not just the
      closed pile's own zone — is still `counting` (i.e.
      `pilesStillCounting` returns empty for every zone). When at least one
      other pile is still counting, the decision point shows its other
      three options (next pile / switch zone / close zone) but not
      close-sale.
- [x] Once the *last* counting pile in the sale closes, `decision-close-sale`
      appears on that pile's own decision point without any further action
      (no reopen, no manual refresh needed).
- [x] `PilePanel` (Pile tab) offers a "close sale" action as a secondary
      control, visually lighter than the pile card's own `close-pile`
      button (not `variant="destructive"`, not primary weight) — reachable
      independent of which tab the operator is on when the last pile
      closes, gated on the same "no pile anywhere still counting" rule as
      the decision point.
- [x] Confirming close-sale from either surface (decision point or Pile
      tab) appends exactly one `sale_closed` event (not a duplicate, not a
      bare navigation) and lands on settlement, per S13's existing
      `CloseSaleConfirmOverlay` two-step confirm — reused, not
      reimplemented.
- [x] **Edge — reopened pile.** If a pile is reopened (`pile_reopened`)
      after the sale's last pile had closed but *before* the sale itself is
      closed, close-sale stops being offered on both surfaces again (the
      reopened pile is now `counting`), until it closes a second time.
- [x] **Edge — single-pile sale.** A sale with exactly one pile: close-sale
      is not offered anywhere while that pile counts; the moment it closes,
      its own decision point shows close-sale (next-pile and close-zone are
      absent/disabled per existing S13 rules — a single pile has no
      sibling and its zone has nothing else to force-close).
- [x] **Edge — already-closed sale.** Once `sale_closed` has been appended,
      neither surface offers close-sale again (settlement's reopen path,
      unchanged from S13, is the only way back).

## Out of scope

- No event-model change: `pile_closed`, `zone_closed`, `sale_closed`,
  `pile_reopened`, `zone_reopened`, `sale_reopened` and their guards are
  reused exactly as S13 left them.
- No change to `ZonePileSwitcher`, `ReopenPrompt`, or the settlement
  screen's reopen-sale flow.
- No change to `CloseSaleConfirmOverlay`'s content or the two-step confirm
  mechanics — only which controls can open it.
- No new i18n locale or catalogue mechanism (S24 already did that); this
  story only edits existing message usage/placement, see below.

## Offline / sync behavior

Same as every prior close/reopen action in this app: `sale_closed` (and
every other event this story touches) is written through
`useSale().append()` into the local append-only event log — no network
call, no server round-trip, identical online and offline. This story adds
no new local-storage shape, no new sync trigger, and no new conflict
surface; it only relocates *which button on screen fires an append the app
was already able to make*.

- [x] Feature is fully usable with no network connection — unchanged from
      S13; nothing in this story is network-gated.
- [x] Local writes made while offline are queued/persisted correctly —
      unchanged; still the same `append()` path.
- N/A Sync triggers on reconnect — no backend yet (per `CLAUDE.md`); out of
      scope for this story as it was for S13.
- N/A Manual sync — same reason.
- N/A Conflict resolution — single-device, single-writer event log; no
      concurrent-writer conflict is introduced by moving a button.
- [x] Partial/failed sync N/A — no sync exists yet; local state after a
      partial append sequence stays exactly as consistent as it was under
      S13 (an event either lands in the log or it doesn't; no multi-step
      write this story adds is not already atomic at one `append()` call).
- N/A Sync status visibility — no sync exists yet.
- [x] No data loss scenario identified: moving where `sale_closed` can be
      triggered from does not change what `sale_closed` does once
      appended; the guard added (no pile anywhere still counting) can only
      make it *harder* to reach an already-existing dead end
      (`CloseSaleConfirmOverlay` already warns and force-closes still-
      counting piles today — after this story, close-sale is not offered
      at all while piles are still counting, so that warning copy
      (`counter.closeSaleStillCounting`) becomes unreachable from the UI
      and should be re-checked as dead or intentionally kept as a defensive
      message for a future entry point).

Conclusion: this is a UI-relocation story with no new offline/sync surface.
The `offline-sync-checklist.md` gate is satisfied by inheritance from S13,
not by new work in this story.

## Test plan

_Tests below are written to fail first (TDD), then implemented to green._

- [x] `src/components/PileClosedTransition.test.tsx` — extend: add a case
      asserting `decision-close-sale` does NOT render when a
      `hasOtherPileCounting`-style prop (name TBD by dev, e.g.
      `saleFullyStopped: boolean`) is false, and DOES render when true;
      keep the existing "all four decision buttons fire their own
      callback" case scoped to the `saleFullyStopped: true` case.
- [x] `src/app/sale/[id]/counter.test.tsx` (or equivalent) / component-level
      test for the live-counting row — assert no close-sale-triggering
      element renders while `pile.status === 'counting'`, regardless of
      how many piles are still counting elsewhere.
- [x] `PilePanel`-level test (new or extended alongside the counter
      screen's existing tests) — assert the new secondary close-sale
      control is absent while any pile in the sale is `counting`, present
      once none are, and that pressing it opens the same
      `CloseSaleConfirmOverlay` used by the decision point (shared
      component/handler, not a second implementation).
- [x] `e2e/close-lifecycle.spec.ts` — extend:
  - Rename/rework the existing "closing the current pile is reachable from
    the count tab itself" case (line ~113) to also assert `to-settlement`
    is now **absent** from the live-counting row throughout.
  - New case: with two piles in different zones both `counting`, close one
    — assert its decision point does NOT show `decision-close-sale` (the
    other pile is still counting); close the second pile — assert its
    decision point NOW shows `decision-close-sale`.
  - New case: single-pile sale — close the only pile, assert
    `decision-close-sale` is present and `decision-next-pile` /
    `decision-close-zone` are absent or disabled per existing rules.
  - New case: after both piles are closed (close-sale offered), reopen one
    pile via `ReopenPrompt` — assert close-sale is no longer offered on
    either surface until it closes again.
  - New case: from the Pile tab, once no pile is counting, assert the new
    secondary close-sale control is visible and lighter-weight than
    `close-pile` (e.g. assert it does not carry the destructive variant's
    testable style/testID convention used elsewhere in this file), and
    that pressing it reaches the same close-sale confirm overlay and
    writes exactly one `sale_closed`.
- [x] `e2e/counter.spec.ts` — update any assertion that currently expects
      `to-settlement` to be visible during ordinary counting, so the suite
      doesn't silently pass against a since-removed control. **Checked: it
      never referenced `to-settlement`** — every assertion on that control
      lived in `close-lifecycle.spec.ts`, and all of them are reworked
      above. No edit needed, and none made.

## Verification

- [x] Sandbox run performed: the whole gate, against the exported web build —
      `tokens:check`, `contrast`, `typecheck`, `lint`, `test:core` (85),
      `test:ui` (55), `build:web`, `test:e2e` (**130 passed, 6 skipped**, up
      from 122/6 at HEAD: four new close-lifecycle cases across the two
      landscape projects). Every new test was seen red first — see Dev notes.
- [ ] Screenshots (UI stories only) — golden path: pending the QA agent's
      real-browser pass (counting row without close-sale; decision point with
      and without it; the Pile tab's secondary control).
- [ ] Screenshots (UI stories only) — edge cases: pending the same pass
      (single-pile sale, reopened pile).

## Dev notes

**Files changed**

- `src/components/PileClosedTransition.tsx` — new `noPileStillCounting` prop;
  `decision-close-sale` renders only when it is true.
- `src/app/sale/[id]/counter.tsx` — new module-level `canOfferCloseSale(state)`;
  `to-settlement` (and the flex spacer that pushed it right) removed from the
  live-counting row; the prop passed to the decision point; `PilePanel` takes
  an `onCloseSale` callback and renders the new secondary `pile-close-sale`
  control; `CloseSaleConfirmOverlay`'s still-counting warning removed.
- `src/i18n/messages.ts` — `counter.closeSaleStillCounting` deleted from both
  catalogues (see judgment call 2). **No new message ids were needed**, as the
  story predicted: the two surfaces both reuse `counter.closeSale`, and the
  confirm overlay is unchanged apart from the dead branch.
- Tests: `src/components/PileClosedTransition.test.tsx`,
  `src/test/counter-screen.test.tsx`, `e2e/close-lifecycle.spec.ts`,
  `e2e/fixtures.ts`.

**TDD order.** Unit tests first: three of them went red exactly as intended
(`PileClosedTransition` still rendered close-sale with the gate false; the
counting row still had `to-settlement`; `pile-close-sale` did not exist), the
other two new ones are regression guards that could only pass trivially before
the control existed. Then e2e, run against the pre-change build: **6 failed**
(the reworked "naming every option" and "reachable from the count tab" cases
plus the four new ones). Implementation followed; everything green after.

One test-harness change was needed: `renderCounter` in
`counter-screen.test.tsx` waited on the `count` numeral, which does not exist
in a scenario whose pile is already closed (that lands on the decision point).
It now waits on `tab-count`, present in every ready state.

**Judgment call 1 — the gating prop is `noPileStillCounting: boolean`.**
The PO's suggested `saleFullyStopped` was rejected for one concrete reason:
"stopped" already means something else on this screen — `counter.stopped` is
the topbar pill for `canCount === false`, i.e. *this* pile is not countable
right now — and a prop reading "the sale is stopped" beside it would invite
exactly the wrong reading (it is also not true: piles that never started are
not counting, and do not hold close-sale back). `noPileStillCounting` says
precisely what is asserted and borrows the vocabulary of
`pilesStillCounting`, the core helper this is the sale-wide analogue of. It
keeps `PileClosedTransition` presentational, matching the existing
`hasNextPileInZone` prop: a fact computed at the call site, no projection
knowledge in the component.

Computed by `canOfferCloseSale(state)` in `counter.tsx`, one function used by
both surfaces, so the decision point and the Pile tab cannot drift apart. It
is `state.status === 'open' && !state.piles.some(p => p.status === 'counting')`
— sale-status is folded in because the already-closed-sale edge needs it on
both surfaces. `pilesStillCounting(state, zoneId)` was deliberately not
reused: it is zone-scoped by design (it answers "what will `zone_closed`
force-close?"), and widening it would have changed a core function S13 owns
for no gain over a one-line `some()`.

**Judgment call 2 — `counter.closeSaleStillCounting` is genuinely dead;
removed.** After this story the *only* two ways to open
`CloseSaleConfirmOverlay` are the decision point's `decision-close-sale` and
the Pile tab's `pile-close-sale`, and both are gated on `canOfferCloseSale`,
whose pile clause is the exact negation of the warning's own condition
(`state.piles.filter(p => p.status === 'counting').length > 0`). Nothing can
start counting between opening the overlay and confirming, either: the
overlay is a full-screen absolute layer over the whole counter, so no hold,
gate or reopen is reachable underneath it. The branch could therefore never
render, and dead copy inside a destructive confirm is worse than no copy —
it is exactly the sort of line that gets read as still true. Branch and both
locale strings deleted; the overlay's docblock now records why.

*Deviation, recorded deliberately:* "no change to `CloseSaleConfirmOverlay`'s
content" is listed under Out of scope. Removing this branch changes its
content. It is done because the PO explicitly asked for the dead/alive call
to be made and acted on, and the story's own offline-sync section flagged the
string for exactly this re-check. Nothing else in the overlay moved — the
same title, the same scope line, the same two-step confirm, the same testIDs.

**Weight of the new Pile-tab control.** It is a pressable `Text`
(`testID="pile-close-sale"`, `accessibilityRole="button"`), not a `Button`:
every `Button` variant, ghost included, carries a hairline border and 40px
minimum height, so any of them would have read at or above `close-pile`'s
weight — the opposite of what the AC asks. Small sans, `inkSoft`, no border,
at the foot of the close/reopen card. The e2e case asserts that lightness
observably (`border-bottom-width: 0px`), so a later change back to a `Button`
would fail rather than quietly re-inflate it.

**Not changed:** no event, guard or projection was touched; `ZonePileSwitcher`,
`ReopenPrompt` and settlement's reopen flow are untouched; `e2e/counter.spec.ts`
needed no edit (it never referenced `to-settlement`).

**Deferred:** screenshots and the real-browser walk-through are the QA agent's
pass; the independent code review is still outstanding. Nothing was committed
or pushed — everything is in the working tree.

## Code review

- Reviewer (separate agent/session):
- Findings:
- Resolution:

## QA notes
