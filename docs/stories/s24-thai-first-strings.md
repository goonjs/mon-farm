# Story: One language at a time, Thai first

Status: Review — implemented and verified 2026-08-12. Acceptance criteria
agreed by the owner 2026-08-11; awaiting independent code review.

## Context

- Epic: `docs/epics/epic-2-second-field-round.md` (item 1)
- Related PRD section(s): FR-9.7 (the count readable at ~10 m), NFR-1
  (usable with no network on first launch), NFR-4 (low-end Android floor)
- Related architecture section(s): `docs/ux/design-system.md` §4 (the
  numeral constraint), §9 (orientation)

## Description

Every label in the app is a hard-coded `ไทย · English` pair — 137 of them
across 12 files. It was a reasonable scaffold while the vocabulary was
being settled, and it is now costing the thing the product exists for:
each pair is roughly twice the width of the label it replaces, which
pushes type down a size and buttons wider on a screen whose premise is
being readable across a farm yard.

This story makes the app render **one** language. Thai is the source
locale, not a translation of English — the people using this app work in
Thai, and the vocabulary in the code (`เข่ง`, `กอง`, `โซน`, `ล้ง`) is
already the real vocabulary. English stays available for a non-Thai buyer
or a developer reading a screen, behind a switch that lives in settings
rather than in the chrome of a working screen.

Language is a per-device preference, like the theme. It is **not** sale
data and does not go in the event log: what language someone read a
number in is not a fact about the sale.

## Acceptance criteria

- [x] No screen or component renders a `ไทย · English` pair. Every visible
      string comes from the catalogue, in exactly one locale.
- [x] Thai is the default on first launch, with no prior preference stored
      and regardless of device locale. The app is for a Thai farm; English
      is the exception, not the negotiated outcome of a locale lookup.
- [x] The language preference persists across a reload and an app restart,
      offline, with no network involved at any point.
- [x] The switch is reachable from settings and is not present on the
      counter, setup or settlement screens.
- [x] Switching language changes every visible string on the current
      screen without a reload and without losing screen state (an
      in-progress short-basket entry, a half-filled setup form).
- [x] A message id with no `en` translation falls back to Thai rather than
      rendering the raw key. A missing string must never reach the screen
      as `counter.close_pile`.
- [x] Numerals, weights and money are unaffected — they already format
      through `formatKg` / `formatBaht` and stay Arabic digits in both
      locales. (Thai numerals are not used on the scale, the log, or in
      any document either party signs.)
- [x] **The announced register stays Thai in every locale** (FR-11.12,
      added by the owner 2026-08-11). Spoken phrases and the spoken count
      do not follow the UI language and have no English form. Enforced by
      the catalogue rather than by convention: everything under `say.` is
      resolved as Thai regardless of locale, and a test fails if any `say.`
      id ever acquires an English translation. S10 will consume these when
      speech is wired; nothing speaks yet.
- [x] No web font is introduced. Both locales render from the existing
      system stack — NFR-1, and the constraint stated at the top of
      `design/tokens.ts`.

## Offline / sync behavior

Fully offline. The catalogue is bundled — it is part of the JS bundle, not
fetched — so a first launch with no network renders Thai correctly. The
preference is stored per device, alongside the theme preference, and is
never synced: it describes the reader, not the sale. There is no conflict
case, because there is nothing to reconcile.

This is the reason a runtime translation service was not considered: an
app whose labels depend on a network call has an offline state where
nobody can read the buttons.

## Test plan

_Tests below are written to fail first (TDD), then implemented to green._

- [x] Unit — the catalogue resolves a known id in `th` and in `en`.
- [x] Unit — an id missing from `en` falls back to the Thai string, and
      never returns the key itself.
- [x] Unit — every id present in `th` is either present in `en` or
      explicitly marked as untranslated. This is what stops the catalogue
      rotting silently as stories are added.
- [x] Component — a screen renders Thai only by default; no `·` pair
      appears in any rendered output.
- [x] Component — switching locale re-renders labels without remounting
      (in-progress input state survives).
- [x] E2E — Thai on first load with a clean localStorage.
- [x] E2E — the preference survives a reload.
- [x] E2E — the switch is absent from the counter screen.
- [x] Offline path — covered by construction: the suite runs against the
      exported build with no network, so every test above is an offline
      test. No separate online path exists.
- [x] Migration — **nothing needed migrating.** The estimate of 62
      assertions counted every one that *mentions* text; the number that
      would actually break was zero, because the suite already matched on
      `testID`s, numbers and Thai substrings that survive. Left here rather
      than deleted: the gap between the two numbers is the useful record.

## Verification

- [x] Sandbox run performed: the exported web build, driven by Playwright
      across four viewport projects. `npm run verify` green end to end —
      tokens, contrast, typecheck, lint, 62 core, 38 component, **94 e2e**
      (up from 84: five new language tests × two landscape projects), and 41
      component tests (up from 38 — the three locale-switch tests below).
- [x] Screenshots — golden path: `docs/ux/screenshots/*/counter-count.png`,
      `counter-pile.png`, `counter-log.png`, `sale-list.png`,
      `settlement.png`, regenerated in Thai.
- [x] Screenshots — the settings surface: `docs/ux/screenshots/*/settings.png`.
- [x] The spoken phrase with the UI in English, asserted rather than
      screenshotted (`e2e/language.spec.ts`): the gate's ready button reads
      `พร้อมค่ะ` next to a translated `start counting`.

The counter screenshot is the story's own evidence: with the pairs gone,
`ยกเลิกเข่งล่าสุด` and `เข่งไม่เต็ม` are roughly half their previous width,
which is the whole point — every pixel a duplicate label was taking is a
pixel the count was not.

## Dev notes

### What actually happened

- **The e2e migration was far smaller than estimated.** The story predicted
  62 assertions to move; the real number was zero. The suite already
  matched on `testID`s, numbers and Thai substrings that survived, so
  removing the English halves changed nothing it read. The estimate was
  pessimistic because it counted assertions that *mention* text rather than
  assertions that would *break*.
- **A settings screen had to exist.** The acceptance criteria put the
  switch out of the working screens, and there was nowhere else for it. It
  is deliberately minimal — language and theme, nothing else — and lives off
  the sale list, the one screen nobody uses standing at a scale. S27's farm
  profile has a home now too.
- **The component tests' duplicated `wrap()` became `src/test/render.tsx`.**
  Eight files declared the same provider tree; adding a second provider
  meant touching all eight.
- **`ZonePileSwitcher`'s status map got stricter on the way past**: it held
  Thai strings under `Record<string, string>` and now holds message ids
  under `Record<PileStatus, MessageId>`, so a new pile status fails to
  compile rather than rendering an empty cell.

### Known leftovers, deliberately not touched

`src/app/explore.tsx` and `src/components/app-tabs.*` still carry English
scaffold text ("Explore", "Learn more"). They are Expo template remnants,
not product screens, and none of the epic's flows reaches them. Migrating
them would dress up dead code as maintained; deleting them is a separate
decision for the owner, under `CLAUDE.md`'s deletion gate.

Sequencing: this is first in epic 2 deliberately. It touches 137 strings
and 62 assertions, and every story after it adds labels — done later,
each of those stories would add bilingual strings that this one then has
to migrate a second time.

Two things worth deciding while implementing rather than up front:

- **Catalogue shape.** A flat `Record<string, string>` per locale is
  probably enough at this size; nested namespaces are the kind of
  structure that earns its keep at ten times the count, not at 137
  (YAGNI). No i18n library unless one turns out to be genuinely needed —
  that would be a dependency ask under `CLAUDE.md`, with a rationale and a
  security check, not a default reach.
- **Where the switch lives.** There is no settings screen yet. The theme
  toggle currently sits in the chrome; the smallest honest home for the
  language switch is beside it, and a real settings surface is S27's
  problem (the farm profile needs one too). Worth not inventing a screen
  this story does not need.

## Code review

- Reviewer (separate agent/session):
- Findings:
- Resolution:

## QA notes
