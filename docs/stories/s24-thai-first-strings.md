# Story: One language at a time, Thai first

Status: Draft

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

- [ ] No screen or component renders a `ไทย · English` pair. Every visible
      string comes from the catalogue, in exactly one locale.
- [ ] Thai is the default on first launch, with no prior preference stored
      and regardless of device locale. The app is for a Thai farm; English
      is the exception, not the negotiated outcome of a locale lookup.
- [ ] The language preference persists across a reload and an app restart,
      offline, with no network involved at any point.
- [ ] The switch is reachable from settings and is not present on the
      counter, setup or settlement screens.
- [ ] Switching language changes every visible string on the current
      screen without a reload and without losing screen state (an
      in-progress short-basket entry, a half-filled setup form).
- [ ] A message id with no `en` translation falls back to Thai rather than
      rendering the raw key. A missing string must never reach the screen
      as `counter.close_pile`.
- [ ] Numerals, weights and money are unaffected — they already format
      through `formatKg` / `formatBaht` and stay Arabic digits in both
      locales. (Thai numerals are not used on the scale, the log, or in
      any document either party signs.)
- [ ] No web font is introduced. Both locales render from the existing
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

- [ ] Unit — the catalogue resolves a known id in `th` and in `en`.
- [ ] Unit — an id missing from `en` falls back to the Thai string, and
      never returns the key itself.
- [ ] Unit — every id present in `th` is either present in `en` or
      explicitly marked as untranslated. This is what stops the catalogue
      rotting silently as stories are added.
- [ ] Component — a screen renders Thai only by default; no `·` pair
      appears in any rendered output.
- [ ] Component — switching locale re-renders labels without remounting
      (in-progress input state survives).
- [ ] E2E — Thai on first load with a clean localStorage.
- [ ] E2E — the preference survives a reload.
- [ ] E2E — the switch is absent from the counter screen.
- [ ] Offline path — covered by construction: the suite runs against the
      exported build with no network, so every test above is an offline
      test. No separate online path exists.
- [ ] Migration — the 62 existing e2e assertions and the component tests
      that match on bilingual text move to the Thai string or to `testID`.
      Prefer `testID` where the assertion is about *which control*, and
      the Thai string where the assertion is about *what it says*.

## Verification

- [ ] Sandbox run performed:
- [ ] Screenshots (UI stories only) — golden path: counter, pile, log,
      setup and settlement in Thai, at phone landscape.
- [ ] Screenshots (UI stories only) — edge cases: the same counter screen
      in English; the settings surface showing the switch; a three-digit
      count in Thai confirming the numeral still clears its floor now that
      captions are half the width.

## Dev notes

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
