# Story: The close flow follows the piles

Status: **Review** — 2026-09-03. Implemented (TDD), QA browser pass and
independent code review done, **and both open review findings now closed**
(2026-09-03, follow-up pass on a clean tree): F-1 the Pile tab's close-sale
control now sits inside the viewport at both landscape sizes, measured not
merely `toBeVisible()`; F-2 the close-sale commit path re-asserts
`canOfferCloseSale` so the keyboard-only reopen-beneath-the-overlay path can
no longer close a sale with a pile counting. Whole gate green after the fix:
tokens/contrast/typecheck/lint/core/ui/build + e2e **156 passed, 6 skipped**.
F-3 and F-4 stay open by design — both are informational and belong to the
PO / S13, not to this story. Still open before Done: push + CI green.

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
- [x] Independent QA re-ran the whole gate on the committed tree (19178c5):
      `tokens:check` ✓, `contrast` ✓, `typecheck` ✓, `lint` ✓, `test:core`
      **85 passed**, `test:ui` **55 passed**, `build:web` ✓, `test:e2e`
      **130 passed, 6 skipped** — the dev's numbers reproduce exactly.
- [x] Fail-first independently confirmed (see QA notes): the three new unit
      cases go red against the pre-change production files, and
      `close-lifecycle.spec.ts` goes **6 cases red per project (12 total)**
      against a pre-change build — matching the dev's claim.
- [x] Screenshots (UI stories only) — golden path: real Chromium at 844×390,
      sale built through the setup UI, baskets counted with real
      press-and-hold — `screenshots/s25/02-counting-footer-close-pile-only.png`,
      `05-decision-point-close-sale-offered.png`,
      `06-pile-tab-secondary-close-sale.png`,
      `09-close-sale-confirm-overlay.png`,
      `10-settlement-after-close-sale.png`.
- [x] Screenshots (UI stories only) — edge cases: other pile still counting
      (`03`, `04`), reopened pile (`07`, `08`), already-closed sale (`11`,
      `12`), single-pile sale (`13`, `14`, `15`), 740×360 floor (`16`, `17`,
      `18`), below-the-fold measurement (`19-*`, `20-*`), overlay reachability
      probes (`21`, `22`).

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

### Dev notes — follow-up pass, 2026-09-03 (closing F-1 and F-2)

A second, separate pass on a clean tree (HEAD `7434408`, S23 landed), after
the contended-working-tree situation that made the reviewer defer both.

**Files changed**

- `src/app/sale/[id]/counter.tsx` — (a) `PilePanel` now returns a `View
  flex: 1` wrapping its `ScrollView` plus a footer holding `pile-close-sale`,
  so the control is laid out in the tab's fixed foot instead of at the end of
  the scrolling card stack (F-1); (b) `doCloseSale` re-asserts
  `canOfferCloseSale(state)` and dismisses the overlay instead of appending
  when it fails (F-2); (c) the `CloseSaleConfirmOverlay` docblock's claim that
  "nothing can start counting while this overlay is up" is corrected — it is
  true of pointer input only, and the guard is what makes it true overall.
- `e2e/close-lifecycle.spec.ts` — two new cases (below).
- `src/test/counter-screen.test.tsx` — one new case (below).
- `docs/stories/screenshots/s25/23-fix-on-screen-phone.png`,
  `24-fix-on-screen-floor.png` — taken by the new e2e case itself, following
  the convention `bulk-entry.spec.ts` already uses, so the evidence
  regenerates with the suite rather than rotting as a hand capture.

**TDD, both red first.**

- F-1, `the Pile tab close-sale control sits inside the viewport, not below
  the fold` — measures `boundingBox()` against `viewportSize()`, because
  `toBeVisible()` is satisfied by an off-screen box and that is precisely how
  the defect survived the first pass. Red at both landscape projects: the
  control's bottom was **410 px** against a 390 px and a 360 px viewport.
  Green after: **382 px** and **352 px**.
- F-2, at two tiers. `refuses the confirm when a pile was reopened beneath
  the overlay` (`counter-screen.test.tsx`) drives reopen-under-the-overlay
  and reads the event log back out of the store — red, one `sale_closed`
  written; green, none. And `confirming close-sale is refused if a pile was
  reopened beneath the overlay` (e2e) reproduces QA's actual finding on the
  real build: `.press('Enter')` focuses and keys without hit-testing, so it
  reaches `reopen-pile` and the whole reopen prompt *underneath* the open
  confirm exactly as a keyboard operator does. Red at both projects (one
  `sale_closed`, and the app on settlement); green after, with the overlay
  dismissed and the log empty of `sale_closed`.

**Judgment call 3 — the footer, not "move it higher in the card".** Putting
the control above the close/reopen card's other controls would have fixed
today's 410 px and left the same class of defect one card-content change
away; the AC's "reachable independent of which tab the operator is on" is a
statement about the screen, so the fix belongs in the screen's layout. The
`ScrollView` keeps `flex: 1` and yields the ~30 px the foot needs, so no card
content is lost — the stack simply scrolls under a fixed foot, and the
hairline `rule` divider says so. The control's own styling is untouched, and
the existing `border-bottom-width: 0px` assertion still guards it against
being re-inflated into a `Button`.

**Judgment call 4 — dismiss, do not warn, when the re-assert fails.**
Recorded in full under F-2's resolution: no message id comes back, because
the overlay's remaining copy would be stale the moment the guard trips.

**Not changed:** no event, guard, projection or message id; `PilePanel`'s
cards, `PileClosedTransition`, `ZonePileSwitcher`, `ReopenPrompt` and
settlement are all untouched. **F-3 and F-4 were deliberately not acted on** —
a PO call and pre-existing S13 behaviour respectively; both stay open in the
Code review section with that note.

**Deferred:** nothing was committed or pushed (per `CLAUDE.md`); push + CI
green remains the last DoD item, and needs the owner's per-push confirmation.
Native was not re-verified — the fix is a react-native flexbox layout with no
web-only primitive in it, but the measurement evidence is the web export, as
QA's was.

## Code review

- **Reviewer (separate agent/session):** QA/review agent, 2026-09-03,
  independent of the implementing session. Reviewed `git show 19178c5`
  against `docs/checklists/code-review-checklist.md` and
  `docs/checklists/definition-of-done.md`, re-ran the whole gate, verified
  fail-first in an isolated clone, and drove the real exported build in
  Chromium (see QA notes).

- **Findings:**

  1. **Every acceptance criterion is met** — verified in the real browser,
     not only in tests. See the per-AC table in QA notes.

  2. **F-1 (medium, not fixed — usability).** The Pile tab's new
     `pile-close-sale` control renders **below the fold on both target
     viewports**. Measured on the simplest possible sale (one zone, one
     pile, one basket, pile closed): its box is at `y = 389` in a 390 px
     viewport and at `y = 389` in the 360 px floor viewport — entirely
     off-screen in both, with no affordance saying the card scrolls
     (`19-phone-…png`, `19-floor-…png`; scrolled into view in `20-*`). The
     AC's "reachable independent of which tab the operator is on" holds
     only after a scroll the operator has no reason to attempt. The e2e
     case does not catch this: Playwright's `toBeVisible()` is satisfied by
     a non-empty box in the DOM, not by being inside the viewport. Suggest
     either moving the control above the close/reopen card's fold, or
     adding an in-viewport assertion (e.g. compare `boundingBox()` against
     `viewportSize()`) so it cannot silently drift below it.

     **Resolution (2026-09-03, follow-up pass): fixed.** Both of QA's
     suggestions were taken, because they answer different halves of the
     finding. The control moved out of the scrolling card stack into
     `PilePanel`'s own footer — a `View` below the `ScrollView`, which keeps
     `flex: 1` and takes the slack, so the label is on screen at any viewport
     height rather than at whatever offset the cards happen to end at. It is
     unchanged as a control: the same pressable `Text`
     (`testID="pile-close-sale"`, `accessibilityRole="button"`, `inkSoft`,
     small sans, no border, no min-height), *not* promoted to a `Button` —
     that promotion is exactly what the AC rules out. The footer carries a
     hairline `rule` divider and the surface background so the card clipped at
     that edge reads as "this scrolls under a fixed foot" rather than as the
     screen ending. And the e2e case now *measures*: `boundingBox()` against
     `viewportSize()` at both landscape projects, since `toBeVisible()` is
     satisfied by an off-screen box. Measured on the same simplest-possible
     sale QA used (one zone, one pile, one basket, pile closed):

     | viewport | control's bottom, before | after |
     | --- | --- | --- |
     | 844×390 (`phone-landscape`) | 410 px — 20 px past the fold | **382 px** |
     | 740×360 (`phone-landscape-floor`) | 410 px — 50 px past the fold | **352 px** |

     Evidence: `23-fix-on-screen-phone.png`, `24-fix-on-screen-floor.png`
     (both regenerated by the e2e suite itself, not captured by hand).

  3. **F-2 (low, not fixed — the deleted warning's residual gap).** The
     dev-notes justification for deleting `counter.closeSaleStillCounting`
     states that "nothing can start counting between opening the overlay
     and confirming … the overlay is a full-screen absolute layer over the
     whole counter, so no hold, gate or reopen is reachable underneath it".
     That is true for **pointer** input — QA verified a click aimed at
     `tab-pile` while the overlay is up does nothing (`21-…png`) — but not
     for **focus**. Elements beneath the overlay stay in the tab order (RN
     Web sets no `aria-hidden`/inertness), and QA drove this to completion
     with the keyboard alone: with the confirm overlay open, focus
     `tab-pile` → Enter, focus `reopen-pile` → Enter, complete the reopen
     prompt (all beneath the overlay) — `pile_reopened` is appended, the
     pile is `counting` again, and `close-sale-confirm` is still there and
     still fires (`22-…png`). So a sale *can* still be closed with a pile
     counting, on web, by keyboard only.

     Practical risk is very low: the product is a landscape-locked, touch,
     phone-first app, the sequence is deliberate blind tabbing, and the
     resulting state is the same one S13 always allowed (`sale_closed` does
     not force-close anything; `canCount` simply stops the pile). But the
     claim "no path can reach it" is stronger than what holds, and the
     cheapest close is one line: have `doCloseSale` re-assert
     `canOfferCloseSale(state)` before appending (a guard, not copy), which
     keeps the warning deleted and makes the docblock's claim true by
     construction. Recorded rather than fixed — see "not fixed here" below.

     **Resolution (2026-09-03, follow-up pass): fixed, the cheap way QA
     suggested.** `doCloseSale` now re-asserts `canOfferCloseSale(state)`
     before appending `sale_closed` — the same single gate both entry points
     are offered under, so the commit cannot outlive the offer. The deleted
     `counter.closeSaleStillCounting` id was **not** resurrected: judgment
     call 2's conclusion still holds, and holds harder now. The warning is
     copy for a state the operator can no longer confirm their way out of,
     and no UI path renders it — the guard replaces it rather than needing it.

     **What the UI does when the re-assert fails: it dismisses the overlay and
     appends nothing.** Why, rather than keeping it up with a warning: by that
     point the screen behind the overlay has already changed under the
     operator (a pile is counting again), and the confirm's own scope line —
     "N zones, N piles, N baskets, N kg" — is stale copy describing a sale
     that no longer matches. Putting them back on a screen that shows what is
     actually true is the honest answer, it needs no new message id, and
     re-offering close-sale costs one press once the reopened pile closes
     again. The alternative (leave it up, explain) would have re-introduced
     exactly the dead-warning shape this story removed.

  4. **F-3 (informational, no action).** Piles that are `not-started` do not
     hold close-sale back — `canOfferCloseSale` tests `'counting'` only.
     This matches the AC's wording and is documented in the function's
     docblock, and QA confirmed it in the browser (a sale with an untouched
     second pile offers close-sale as soon as the counting pile closes,
     `17-floor-decision-point.png`). Flagged only because "the sale is over"
     and "no pile is mid-count" are not the same statement in the field —
     a PO call, not a defect.

  5. **F-4 (informational, pre-existing, out of scope).** On an
     already-closed sale the decision point still renders
     `decision-next-pile` as an enabled button (`11-…png`). That is S13
     behaviour untouched by this story; close-sale itself is correctly
     absent.

  6. **Quality.** YAGNI/KISS/SOLID hold: one shared `canOfferCloseSale`
     feeds both surfaces (so they cannot drift), `PileClosedTransition`
     stays presentational with a computed-at-the-call-site
     `noPileStillCounting` prop matching the existing `hasNextPileInZone`,
     and the choice *not* to widen the zone-scoped `pilesStillCounting`
     is right — a one-line `some()` beats changing a core S13 helper. No
     dead code left: `to-settlement` and `counter.closeSaleStillCounting`
     are gone from both catalogues and no reference survives anywhere in
     `src/` or `e2e/`. No unrelated refactor is bundled; the only
     collateral edits are the two regenerated `docs/ux/screenshots`
     captures (produced by the e2e run, showing the footer change) and the
     `renderCounter` harness switch from `count` to `tab-count`, which is
     required by the new already-closed scenarios. Commit subject is 43
     characters, imperative, with the *why* in the body.

  7. **Docs.** The story records the two judgment calls and the deliberate
     `CloseSaleConfirmOverlay` deviation from its own Out-of-scope list.
     Reviewed and accepted: the story's offline/sync section had itself
     flagged that string for a dead-or-alive re-check, and the deviation is
     declared rather than slipped in. No PRD/architecture change is needed.

- **Resolution:** **Approved with findings — F-1 and F-2 now closed** in a
  follow-up pass on a clean tree (2026-09-03); see the resolution under each.
  **F-3 and F-4 are deliberately left open and were not acted on:** F-3 is a
  PO call on what "the sale is over" should mean for `not-started` piles, and
  F-4 is pre-existing S13 decision-point behaviour on an already-closed sale.
  Neither is a defect in S25's own change, and folding either into this story
  would be scope this story never agreed. The original reviewer's note follows,
  unedited.

  F-1 and F-2 were *not fixed in the review pass itself* for a concrete
  reason: while QA
  was running, another session began implementing S23 (bulk entry) in this
  same working tree — `src/app/sale/[id]/counter.tsx`, `src/core/project.ts`,
  `src/i18n/messages.ts` and others are all dirty with in-flight work that
  does not compile yet (`canBulkEnter` is referenced by tests but does not
  exist). Editing `counter.tsx` now would collide with that work, and no
  clean gate could be run to prove the fix. Both findings are small and
  self-contained; they belong in a follow-up commit on a clean tree (or in
  S26, which already reopens `PilePanel`). Nothing else blocks Done except
  the standing gates: push + CI green.

## QA notes

**Who/when.** Independent QA pass, 2026-09-03, against commit `19178c5`.
Nothing was committed, pushed, installed or deleted.

**Gate, re-run from scratch on the committed tree**

| step | result |
| --- | --- |
| `npm run tokens:check` | ✓ tokens.css up to date |
| `npm run contrast` | ✓ strict, all pairs pass |
| `npm run typecheck` | ✓ |
| `npm run lint` | ✓ |
| `npm run test:core` | ✓ 85 passed |
| `npm run test:ui` | ✓ 55 passed (10 suites) |
| `npm run build:web` | ✓ exported |
| `npm run test:e2e` | ✓ **130 passed, 6 skipped** |

**Fail-first, verified independently.** Not taken on trust. With only the
three production files (`counter.tsx`, `PileClosedTransition.tsx`,
`messages.ts`) reverted to their pre-S25 state and the new tests left in
place, `test:ui` goes red on exactly three cases —
`PileClosedTransition › withholds "close sale" while any pile in the sale is
still counting`, `close pile first, close sale last (S25) › offers no
close-sale control on the live-counting row`, and `… › offers it on the Pile
tab once nothing is counting, opening the shared confirm`. The other two new
unit cases (reopened pile, already-closed sale) pass trivially pre-change,
exactly as the dev notes say. Against a pre-change **build** (built in an
isolated clone so the working tree was never disturbed),
`e2e/close-lifecycle.spec.ts` fails **6 distinct cases × 2 landscape projects
= 12** — the two reworked cases plus the four new ones, matching the claimed
"6 failed".

**Real browser walk-through (not a test-runner run).** `npm run build:web`,
served by `node scripts/serve-dist.mjs` on :8080, driven with `playwright-core`
against `/opt/pw-browsers/chromium-1194/chrome-linux/chrome` at **844×390**
(and re-checked at **740×360**). The sale was built through the real setup UI
(two zones, three piles: กอง 1 / กอง 2 in โซน A, กอง 3 in โซน B), the gate was
walked, and every basket was counted with a real pointer press-and-hold on the
stage. Event counts were read back out of `localStorage`, not inferred from the
UI.

Per acceptance criterion:

| AC | verdict | evidence |
| --- | --- | --- |
| live-counting row has no close-sale, only undo/short/close-pile | **PASS** | `02-counting-footer-close-pile-only.png` — footer is ยกเลิกเข่งล่าสุด / เข่งไม่เต็ม / ปิดกอง; `to-settlement` absent from the DOM |
| `decision-close-sale` withheld while any pile anywhere still counts | **PASS** | closed กอง 3 (โซน B) while กอง 1 (โซน A) counted — `03-decision-point-no-close-sale-other-pile-counting.png`, cross-zone; Pile tab likewise `04-…png` |
| appears on the last closing pile's own decision point, no reopen/refresh | **PASS** | `05-decision-point-close-sale-offered.png` — appeared on the same render, no navigation |
| Pile tab secondary control, lighter than close-pile, same gate | **PASS** (with F-1) | `06-pile-tab-secondary-close-sale.png`, `20-*`; computed style `border-bottom-width: 0px`, `font-size: 13px`, `color: rgb(85,89,94)`, no min-height, vs close-pile's `1px` border, `13.33px`, `rgb(0,0,0)`, `min-height: 40px` — but it sits below the fold, see F-1 |
| confirming appends exactly one `sale_closed`, lands on settlement, reuses the S13 overlay | **PASS** | `09`/`10`; log read back: one `s:sale_closed`, and still one after returning to the counter. Same via the Pile-tab control on the single-pile sale (`15`) |
| edge — reopened pile withdraws the offer on both surfaces | **PASS** | `07-pile-tab-close-sale-withdrawn-after-reopen.png`, `08-count-tab-after-reopen-no-close-sale.png`; closing it again brought the offer back |
| edge — single-pile sale | **PASS** | `13-single-pile-counting-no-close-sale.png`, `14-single-pile-decision-point-close-sale.png` — close-sale present, `decision-next-pile` absent |
| edge — already-closed sale offers nothing | **PASS** | `11-closed-sale-count-tab-no-offer.png`, `12-closed-sale-pile-tab-no-offer.png` |

**Guard audit (the two decisions QA was asked to press on).**

- `canOfferCloseSale(state)` is the single gate for both surfaces, so the
  decision point and the Pile tab cannot disagree — confirmed by reading the
  call sites and by the browser: every state change flipped both together.
  Reopened pile, second zone, and navigating back to a closed sale's counter
  all behave correctly (`07`, `03`, `11`).
- The deleted `counter.closeSaleStillCounting` branch: unreachable by pointer
  — the overlay really is opaque and swallows clicks aimed at the UI beneath
  it (`21-overlay-blocks-the-screen-beneath.png`) — but **reachable by
  keyboard**, which is finding F-2 above and its screenshot `22-…png`. The
  confirm overlay's own text was checked in-browser and no longer mentions
  ยังนับอยู่.

**Layout / Thai rendering.** Thai renders cleanly at both 844×390 and
740×360 — topbar crumb, tabs, decision-point buttons, the Pile card and the
new ปิดการขาย label all set correctly with no clipping or tofu, and
`document.body.scrollWidth === window.innerWidth` at the floor viewport (no
horizontal overflow). `16-floor-counting-footer.png`, `17-floor-decision-point.png`,
`18-floor-pile-tab.png`.

**Could not verify / not covered here.**

- **CI.** Not run — QA has no push rights and the repo's gate forbids pushing
  without the owner's explicit per-push confirmation. "Pushed, CI green"
  remains open on the DoD.
- **Native.** Web export only. The Pile-tab control's below-the-fold position
  (F-1) may differ on a real device with a different font scale; unverified.
- **Contended working tree.** From ~16:40 onward another session's S23
  bulk-entry work has been landing in this same tree (`counter.tsx`,
  `project.ts`, `messages.ts`, `store/*`, new `BulkEntryForm.*`). Every
  number above was produced from the clean `19178c5` tree: the gate ran before
  those edits appeared, `dist/` was exported at 16:38:23 (before the first
  foreign edit at 16:40:03) and was deliberately **not** rebuilt afterwards, and
  the fail-first check was done in a throwaway clone rather than in-place. QA
  made no source edits; the only files QA wrote in the repo are this story and
  `docs/stories/screenshots/s25/`. A re-run of the gate *right now* will be
  red for S23 reasons that have nothing to do with S25.
