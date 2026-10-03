# Story: Pile / zone / sale close lifecycle

Status: **Review** — implemented 2026-08-11. Cannot reach `Done` without a
push to CI and an independent review, neither authorized.

## Context

- Epic: `docs/epics/e04-sale-weighing.md`
- Related PRD section(s): FR-6, FR-12
- Design reference: `docs/ux/pile-zone-sale-lifecycle.md` — three independent
  state machines (pile / zone / sale), §4 the decision point, §7.2 reopen,
  §8 the transition table this story implements
- Depends on: S3 (`pile_closed`, `pile_reopened`, `zone_closed`,
  `zone_reopened`, `sale_closed`, `sale_reopened` events and their guards —
  `canReopenPile`, `pilesStillCounting` — already existed in
  `src/core/project.ts` before this story; nothing in the core model changed)

## Description

Before this story, closing the sale was a bare `<Link>` to the settlement
screen — it never wrote a `sale_closed` event, so a sale "closed" only in the
sense that the operator had navigated away from it. Nothing in the UI reached
`pile_closed`, `zone_closed`, or either reopen event at all: the core model
supported the full lifecycle, but no screen exposed it.

This story adds the three missing pieces:

- **`PileClosedTransition`** — the decision point after a pile closes
  (docs/ux/pile-zone-sale-lifecycle.md §4). Replaces what would otherwise be a
  single "continue" button with four named, one-tap options: next pile in
  this zone (only offered when one is actually waiting), switch zone, close
  this zone, close the sale. Naming every option, rather than picking one on
  the operator's behalf, is the point.
- **`ZonePileSwitcher`** — a full-screen picker listing every zone and its
  piles with status, reachable from a topbar control on every tab, not just
  after a close. Needed once a sale has more than one pile (the MVP's whole
  premise): the counter screen's implicit "whichever pile is counting"
  default has nowhere to go once more than one pile is involved.
- **`ReopenPrompt`** — a typed-reason, two-step confirm used for reopening a
  pile, a zone, or the sale. A canned reason chip would let a reopen happen
  without anyone having to say why; the second step restates the consequence
  before the commit, since reopening is an appended event, never an undo, and
  the mechanism that makes the original close trustworthy has to cover its
  own correction.

Reopening the sale itself lives on the **settlement** screen, not the
counter — that is the screen the operator lands on once the sale closes
(`docs/ux/pile-zone-sale-lifecycle.md`'s hard boundary), so the reopen path
belongs where the boundary is actually crossed, not bolted onto a screen the
operator may never revisit.

Closing a zone from the Pile tab hands off to the switcher afterward — the
operator just lost their current zone, so being shown where to go next is the
natural follow-up, not an extra tap they have to find on their own.

## Acceptance criteria

- [x] Closing a pile (Pile tab, two-tap confirm) shows `PileClosedTransition`
      on the Count tab, with the pile's final basket count and net weight
      readable at title size.
- [x] "Next pile in this zone" is offered only when another `not-started`
      pile exists in the same zone, and switches straight to it.
- [x] "Switch zone" and the topbar's zone/pile control both open the same
      `ZonePileSwitcher`, listing every zone and pile with its status.
- [x] "Close this zone" force-closes any pile still counting in it — naming
      each one in a warning — after a second, explicit confirm.
- [x] "Close the sale" appends `sale_closed` (not just a navigation) and
      lands on settlement.
- [x] Reopening a pile or a zone requires a typed reason (empty reason
      cannot proceed) and a second, explicit confirm; the reason is echoed
      back before that confirm.
- [x] Reopening the sale is offered on the settlement screen once the sale is
      closed, using the same `ReopenPrompt` component and writing
      `sale_reopened`.
- [x] The undo / short-basket / close-sale action row only renders while the
      pile is actually `counting` — it has nothing to do once the pile is
      closed or not yet started, and showing it disabled there was dead
      chrome.
- [x] Every new event type (`zone_contract_set`, `pile_reopened`,
      `zone_closed`, `zone_reopened`, `sale_closed`, `sale_reopened`) has a
      Thai label in the Log tab.

## Offline / sync behavior

Same as every other screen: every close and reopen writes through
`useSale().append()`. No network involvement.

## Test plan

- [x] `src/components/PileClosedTransition.test.tsx`, 3 cases: shows the
      closed pile's total; "next pile" hidden when none is waiting; all four
      decision buttons fire their own callback.
- [x] `src/components/ReopenPrompt.test.tsx`, 5 cases: "next" disabled until
      a reason is typed; the typed reason is echoed back before the second
      confirm; `onConfirm` only fires after the second confirm, with the
      reason; "back" preserves the typed text; "cancel" fires `onCancel`.
- [x] `src/components/ZonePileSwitcher.test.tsx`, 3 cases: lists every zone
      and pile; picking a pile reports its id; close fires `onClose`.
- [x] `e2e/close-lifecycle.spec.ts`, 6 cases against a new
      `closeLifecycleScenario` fixture (two ready piles in different zones, a
      third `not-started` pile sharing a zone with one of them): the decision
      point names every option; "next pile" reaches the not-started pile's
      gate; the switcher jumps to any pile in any zone; reopening a pile
      requires a typed reason and a second confirm, and is logged; closing a
      zone names the still-counting pile before force-closing it; closing the
      sale writes a real event and settlement offers reopening it.

## Verification

- [x] `npm run verify`-equivalent run green: `tsc --noEmit`, `eslint .`,
      46 core (vitest) tests, 38 component (jest) tests (27 existing + 11
      new), `expo export --platform web`, and the full Playwright suite —
      76 passed, 6 skipped by device scoping, 0 failed, across
      `phone-landscape`, `phone-landscape-floor`, `phone-portrait`, and
      `tablet-portrait`.
- [x] Screenshots refreshed at `docs/ux/screenshots/{phone-landscape,
      phone-landscape-floor}/{counter-count,counter-pile,counter-log,
      settlement}.png`.

## Dev notes

**Two real bugs, both caught by rebuilding and running the exported build in
a browser — neither visible from reading the code:**

1. **The pile in view silently changed out from under the operator.** The
   Count tab's pile selection fell back to `state.piles.find(p => p.status
   === 'counting')` whenever nothing had been explicitly picked. Closing the
   pile currently in view changes its own status away from `'counting'` —
   so on the very next render that same fallback would silently re-target
   whatever *other* pile happened to be counting, and `PileClosedTransition`
   would never appear; the screen would already be looking at something
   else. Every `close-lifecycle` e2e case that closed a pile and then
   asserted on the decision point failed this way. Fixed by locking the
   first auto-selected pile to its id, using React's "adjust state during
   render" pattern (a conditional `setSelectedPileId` call in the render
   body, guarded so it only fires once) rather than a `useEffect` — this
   repo's ESLint config (`react-hooks/set-state-in-effect`) forbids
   synchronous `setState` inside an effect body, for the same reason the
   `WeightInput` fix in S11 used the same pattern instead of a ref.
2. **The new topbar zone/pile control silently shrank the public numeral
   below its own floor.** Rendering the switcher's trigger as a `<Button>`
   (`minHeight: 40`) inside the topbar's `right` row — alongside `<Pill>`s
   with no minimum height — grew the whole row's height to match the
   button, stealing roughly 15–20px from the stage below it on the
   `phone-landscape-floor` viewport (740×360, the NFR-4 low-end floor).
   `e2e/counter.spec.ts`'s F-9.7 numeral-fill assertion and
   `orientation.spec.ts`'s "no rotate hint at two digits" assertion both
   failed against the real exported build, at a value close enough to the
   threshold (0.6058 against a 0.62 floor) that it would never have been
   caught by inspection. Fixed by rendering the trigger as a `<Pill>` with
   an `onPress`-bearing `<Text>` inside it, matching the existing
   `theme-toggle` pattern, instead of a full `<Button>`.

No core model changes — every event type and guard this story wires up
(`pile_closed`, `pile_reopened`, `zone_closed`, `zone_reopened`,
`sale_closed`, `sale_reopened`, `canReopenPile`, `pilesStillCounting`) already
existed and was already tested at the core level from S3 onward. This story
is UI-only: giving those events somewhere to be written from.

## Code review

- Reviewer (separate agent/session): **not yet run** — required before `Done`.

## QA notes

`ZonePileSwitcher` and `ReopenPrompt` are covered as overlays reachable from
the counter screen; neither has a dedicated visual-regression screenshot yet
(the existing screenshot test only captures the three ordinary tabs). Worth
adding if the overlay layout turns out to need visual sign-off beyond what
the component and e2e assertions already cover.
