# Story: Sale setup screen

Status: **Review** — implemented 2026-08-10. Cannot reach `Done` without a
push to CI and an independent review, neither authorized.

## Context

- Epic: `docs/epics/epic-1-run-and-settle-one-sale.md`
- Related PRD section(s): FR-1 (partial), FR-2.1–2.4, FR-4, FR-8.5
- Depends on: S15 (per-zone contracts), S16 (people picker), S17 (the stub this replaces)
- Design reference: `docs/ux/mvp-screens.html` screen 1, adapted for per-zone
  contracts (the mockup predates S15)

## Description

Replaces the S17 stub at `/sale/[id]/setup` with the real screen: buyer and
people, agreed ฿/kg price, a sale-level default split, and zones — each
optionally naming its own worker (picked from S16's people list, or created
inline) and percentage — with piles (tare, standard net) added under each
zone.

Every save button writes exactly one event immediately, the same pattern the
counter screen already uses — nothing is held in a big unsaved form.
"Start counting" stays disabled until FR-8.5's requirement is genuinely met: a
price, a split resolvable for every zone (its own contract or the sale
default), and at least one pile.

## Acceptance criteria

- [x] Parties (farm, buyer, manager, worker lead, where) save as one
      `sale_started` event; the save button is disabled until farm and buyer
      are both non-empty.
- [x] Price saves as `price_set`, converting entered baht to integer satang.
- [x] Default split saves as `split_set` (50/50/gross by default).
- [x] Zones can be added, each showing a `PeoplePicker` for its own worker;
      picking a worker reveals a percentage selector and its own save button
      (`zone_contract_set`), carrying both `personId` and a `workerName`
      snapshot.
- [x] Piles can be added under each zone (`pile_added`), converting entered kg
      to integer grams.
- [x] "Start counting" is disabled with a specific reason shown (no price / no
      zone / a zone has no split / no pile) and enabled only once all three
      hold.
- [x] A "← list" control in the top bar returns to the sale list via
      `router.back()`, not a `Link` — see the dev note.
- [x] All saved data survives a reload.

## Offline / sync behavior

Same as every other screen: writes go through `useSale().append()`, which
persists via the platform `EventStore` and updates in-memory state
optimistically. No network involvement.

## Test plan

- [x] `e2e/setup.spec.ts`, 3 cases: the disabled/enabled progression through
      price → zone → split → pile with the correct blocker message at each
      step; parties/price survive a reload; a zone worker picked from the
      people list overrides the default and survives a reload.
- [x] `e2e/sale-list.spec.ts`'s "starting a new sale" case updated for the
      real screen (it previously asserted the S17 stub's `setup-stub-note`).

## Verification

- [x] `npm run verify` green: 46 core tests, 10 component tests, 48 e2e (6
      correctly skipped by device scoping).
- [x] Manually driven end-to-end in a real browser against the exported build:
      filled parties, price, added a zone with a pile, saved the default
      split, clicked "start counting", and landed on the real counter screen
      showing the entered farm/zone/pile names — confirmed via
      `localStorage` that each save produced exactly the expected event.
- [x] Screenshots not separately captured for this screen (no `test('screenshots...')`
      case) — the setup.spec.ts assertions cover its states; add one if S18's
      screenshot pass wants full-screen coverage of every screen.

## Dev notes

**A real bug found during manual verification, not just an e2e failure:**
every card's local input state was initialized with
`useState(state.x?.field ?? '')`. `useState`'s initializer runs exactly once,
on mount — and on first mount, `useSale()`'s async `store.load()` had not yet
resolved, so every field permanently captured the empty default and never
picked up data loaded moments later. This only surfaced on reload (fresh
mount, real async race) — the manual browser walkthrough that built the sale
in one session never hit it, because by the time each card mounted, the data
was already synchronous local state from the same session. Fixed by gating
the entire form behind `ready` (the same flag `CounterScreen` already checks),
so every card's `useState` initializer runs only after real data exists to
initialize from.

**No back-navigation existed at all when this screen was first built** — only
"start counting" (forward). Added a "← list" control using `router.back()`,
matching the pattern already established on the counter and settlement
screens: a `Link` (even with `replace`) leaves the screen it's replacing
sitting underneath on the stack, so repeated `list → setup → list` round trips
would accumulate hidden mounted screens forever. `router.back()` pops to the
instance that's already there.

**The blocker message needed a fourth branch.** With zero zones, the original
logic reported "a zone has no split" — technically produced by
`splitResolvable = zones.length > 0 && ...` evaluating false, but misleading
since no zone exists to have a missing split. Added a distinct "add a zone"
message ahead of it.

## Code review

- Reviewer (separate agent/session): **not yet run** — required before `Done`.

## QA notes

Zone percentage selector is presently fixed to three options (50/60/70). A
custom/typed percentage is not offered — worth revisiting if a real sale needs
a split outside those three.
