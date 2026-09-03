# Story: Short baskets are visible where the counting happens

Status: Review — implemented 2026-09-03. Acceptance criteria drafted the same
day by the PO agent from the owner's agreed epic-2 scope
(`docs/epics/epic-2-second-field-round.md`, S22). Every check below is green
locally (tokens, contrast, typecheck, lint, vitest, jest, web export,
playwright); awaiting the independent code review and the tester agent's
browser pass.

## Context

- Epic: `docs/epics/epic-2-second-field-round.md` (items 3 and 4)
- Related PRD section(s): FR-9.7 (the public numeral — owns its own space,
  does not share it), FR-6 (rollups derive from one place: `pileTotals`)
- Related architecture section(s): `docs/ux/design-system.md` §4 (the
  numeral constraint)
- Depends on: S24 (Thai-first strings) — landed, `Review`. New strings in
  this story go straight into `src/i18n/messages.ts` in Thai-first shape,
  no bilingual pairs.
- Touches: `src/app/sale/[id]/counter.tsx` (`HoldStage`'s `caption` prop,
  and `PilePanel`'s `Card title={pile.name}` stat block), `src/core/totals.ts`
  (read-only — no changes expected, see Out of scope). As implemented it also
  touched `src/components/HoldStage.tsx` (one optional `register` slot under
  the caption), `src/i18n/messages.ts`, `scripts/check-contrast.mjs` (the new
  `warn`-on-`stage` pairing) and `e2e/fixtures.ts` — see Dev notes.

## Description

A short basket is recorded correctly and priced correctly today — `short`
events already carry `readingG`/`tareG`, and `Totals` already separates
`shortBaskets`/`shortNetG` from the standard figures (`src/core/totals.ts`,
`tally()`). The defect is entirely in what the two screens that matter show:

- **The counter's operator register** (`HoldStage`'s `caption`, currently
  `msg('gate.expected', …)` — `"{tare} + {std} = {expected} กก."`) is a
  static expected-standard reading. It does not change when a short basket
  has been logged for the pile in view, so a person mid-count has no way to
  see, without leaving the Count tab, that the pile they are counting
  already carries a short weight.
- **The Pile tab's short row** (`PilePanel`, `Stat label={msg('pile.short')}
  value={String(pt.shortBaskets)}`) shows a bare count — `เข่งไม่เต็ม: 1` —
  with no weight beside it. The pile's total weight (`pile.weight`) is the
  merged `pt.netG` (standard + short summed silently), so there is nowhere
  on the Pile tab a person can read the short weight at all; it only exists
  in the Log tab, one event at a time.

This story makes both screens show the number that `Totals` already
computes. It is presentation over existing state — the same posture as
S24 (a rendering change, not a model change) — scoped to two components.

## Acceptance criteria

**Counter screen, Count tab (operator register, not the public numeral —
`HoldStage`'s numeral itself is untouched)**

- [x] When the pile in view has zero short baskets, the operator register
      shows only the existing expected-standard caption
      (`gate.expected`) — no empty/zero short line. A person who has never
      touched a short basket sees nothing new.
- [x] The moment the pile in view has one or more short baskets
      (`pileTotals(events, pile.id).shortBaskets > 0`), the operator
      register additionally shows the short-basket count **and** its
      summed weight for that pile — new message id `counter.shortSoFar`
      (see String work below), e.g. `1 เข่งไม่เต็ม · สั้น 12.4 กก.` for one
      short basket, updating to the summed `shortNetG` (not just the last
      one logged) once a second short basket is confirmed in the same
      pile.
- [x] This line is per-pile, not per-sale: switching pile via the switcher
      (`ZonePileSwitcher`) shows the short figure for the newly selected
      pile, not the previous one.
- [x] The line carries a stable `testID` (`short-so-far`) so both the
      component test and the e2e spec can assert on it without matching
      display text.
- [x] The line sits in the operator register beside/under the existing
      caption — it must never overlap, resize, or otherwise share space
      with the public numeral (`HoldStage`'s `count` display). This is the
      same F-9.7 boundary S11's `ShortBasketPanel` was built to respect.

**Pile tab (`PilePanel`)**

- [x] The short row (`pile.short`) shows both the count and the summed
      short weight for the pile, not the count alone — e.g.
      `1 · 12.4 กก.` — via a new message id (`pile.shortWithWeight`) rather
      than string-concatenating in the component.
- [x] With zero short baskets, the row shows the count (`0`) with no
      weight suffix — consistent with how the row reads today; a `0 กก.`
      suffix on a pile nobody has shorted would read as if something
      happened.
- [x] The pile's total-weight row is legible as **standard + short**, not
      one merged figure — same visual shape as `gate.expected`'s
      `tare + std = expected`. New message id `pile.netBreakdown`, e.g.
      `40.0 + 12.4 = 52.4 กก.` When `shortNetG` is zero the breakdown still
      renders (`40.0 + 0.0 = 40.0 กก.`) rather than silently collapsing to
      the old merged form — a pile with no short baskets should read the
      same way as one that has some, just with a zero term, so the shape
      of the number never depends on whether anyone happens to be looking
      for a short weight.
- [x] Both new values carry `testID`s (`pile-short-weight`,
      `pile-weight-breakdown`).

**Edge cases**

- [x] **No short basket logged yet for the pile in view**: covered above —
      operator register shows nothing extra; Pile tab's short row shows
      `0`, breakdown row shows the zero-term form.
- [x] **Several short baskets in the same pile**: the shown weight is the
      *sum* (`shortNetG`), not the most recently logged basket's net. Two
      short baskets of 12.4 kg and 8.0 kg read as `2 เข่งไม่เต็ม · สั้น 20.4
      กก.`, not `12.4` or `8.0`.
- [x] **Short weight after undo/void**: undoing the most recent basket
      (`counter.undo` → a `correction` event with `mode: 'undo-last'`)
      when that basket was a `short` immediately removes its weight from
      both the operator-register line and the Pile-tab row — because
      `liveBaskets()` already excludes any basket a `correction` targets,
      this falls out of `pileTotals` being recomputed on every render, but
      it is asserted explicitly (see Test plan) rather than trusted to
      "just work" from the model alone. If the undo drops the pile back to
      zero short baskets, the operator-register line disappears entirely
      (per the zero-case rule above), not just its number.

## Offline / sync behavior

N/A for new writes — this story adds no event kind and no `append()` call.
It reads `pileTotals`, which already runs entirely off the in-memory/local
event log (`useSale().events`), the same call already used by
`PileClosedTransition`, `ClosePileConfirmOverlay`, and `PilePanel`'s
existing stats. There is nothing to sync, queue, or reconcile that isn't
already covered by whatever wrote the underlying `short` event.

Checked against `docs/checklists/offline-sync-checklist.md`:

- [x] Feature is fully usable with no network connection — it is pure
      client-side derivation from local state; verified in the same
      offline sandbox run as the rest of the counter screen.
- [x] Local writes made while offline are queued/persisted correctly —
      N/A, no new writes.
- [x] Sync triggers on reconnect — N/A, nothing to sync.
- [x] Sync can be triggered manually — N/A.
- [x] Conflicting local/remote changes — N/A, no backend yet (per
      `CLAUDE.md`: "No backend yet").
- [x] Partial/failed sync leaves local data consistent — N/A.
- [x] Visibility into sync status — N/A, no sync surface touched.
- [x] No data loss scenario identified — nothing is written; only display
      logic changes.

## Test plan

_Tests below are written to fail first (TDD), then implemented to green._

- [x] **Unit (vitest, `src/core/totals.test.ts` — new file)**: this file
      does not exist yet despite `shortNetG`/`shortBaskets` being load-
      bearing for this story, so it is written here rather than assumed
      covered elsewhere.
  - `pileTotals` sums `shortNetG` across multiple `short` events in one
    pile (not just the last one).
  - `pileTotals` excludes a `short` basket voided by a `correction`
    (`mode: 'undo-last'`) from both `shortBaskets` and `shortNetG` —
    the regression pin for the undo edge case above.
  - `pileTotals` on a pile with zero `short` events returns
    `shortBaskets: 0, shortNetG: 0` (guards the zero-case rendering).
- [x] **Component (jest, `src/test/counter-screen.test.tsx` — the counter
      screen itself, mounted; NOT `src/app/.../counter.test.tsx`, which
      expo-router would export as a route, see Dev notes)**:
  - the operator-register short line is absent when `shortBaskets === 0`.
  - the line renders count + summed weight when `shortBaskets >= 1`, and
    updates when a second short basket is appended to the same pile.
  - switching the selected pile (via the same mechanism
    `ZonePileSwitcher.test.tsx` already exercises) swaps the figure to the
    newly selected pile's own totals.
- [x] **Component (jest, `src/test/counter-screen.test.tsx`, `PilePanel`
      case)**:
  - short row shows `0` with no weight suffix at zero.
  - short row shows `count · weight` once `shortBaskets >= 1`.
  - weight-breakdown row renders `standard + short = total` including the
    zero-term form.
- [x] **E2E (playwright)** — extend the two named files rather than add a
      third:
  - `e2e/short-basket.spec.ts`: after confirming a short basket
    (`short-confirm`), assert `short-so-far` is visible on the Count tab
    with the correct weight, confirm a second short basket and assert the
    figure is the sum, then trigger `counter.undo` on the just-confirmed
    basket and assert the figure returns to the pre-basket value (or
    disappears, if that was the only short basket in the pile).
  - `e2e/counter.spec.ts`: on the Pile tab (`tab-pile`), assert
    `pile-short-weight` and `pile-weight-breakdown` render the expected
    values for a scenario fixture that mixes standard and short baskets
    (`openPileScenario` or a new fixture variant in `e2e/fixtures.ts` if
    the existing ones don't already produce a short basket — check before
    adding one).
- [x] **Offline path**: covered by construction, same as S24 — the whole
      suite runs against the exported build with no network involved, so
      every test above already exercises the offline path. No separate
      online-only assertion exists to write.

## String work (Thai-first, per S24 — `src/i18n/messages.ts`)

New message ids, Thai-first with an `en` counterpart added in the same
edit (S24's catalogue convention — no id ships Thai-only):

- `counter.shortSoFar` — e.g. Thai `'{n} เข่งไม่เต็ม · สั้น {net} กก.'`,
  English `'{n} short · {net} kg short'`.
- `pile.shortWithWeight` — e.g. Thai `'{n} · {net} กก.'`, English
  `'{n} · {net} kg'`.
- `pile.netBreakdown` — e.g. Thai `'{standard} + {short} = {total} กก.'`,
  English `'{standard} + {short} = {total} kg'` (mirrors `gate.expected`'s
  existing shape, so a person who already reads that line reads this one
  the same way).

No change to `gate.expected`, `pile.standard`, `pile.short`, or
`pile.weight` themselves — `pile.short`/`pile.weight` stay as labels; only
the *value* rendered beside them changes.

## Out of scope

- **No event-model change.** No new event kind, no new field on `short` or
  `accept`. `readingG`/`tareG` on `short` already carry everything this
  story needs.
- **No change to `src/core/totals.ts` logic.** `Totals.shortBaskets` and
  `Totals.shortNetG` already exist and are already correctly derived by
  `tally()`/`liveBaskets()`. This story is presentation only; the new
  `totals.test.ts` file (Test plan, above) is regression coverage for
  existing behavior this story now depends on being correct, not new
  production logic.
- **No change to the public numeral** (`HoldStage`'s `count` display) —
  F-9.7 owns that space exclusively; the short figure goes in the operator
  register only, per the epic's own framing ("not on the public numeral").
- **S23's bulk-entry `short` events** (the leftover-weight remainder) are
  out of scope here — they render through the exact same `pileTotals` path
  once S23 exists, and need no special handling in this story. Not
  addressed or tested here beyond that observation.
- **No change to the Log tab** (`LogPanel`/`describe()`'s `log.short`
  rendering) — it already shows each short basket's weight individually;
  this story is about the two screens that currently show nothing or show
  only a count.
- **S25's close-pile/close-sale button placement** — unrelated, tracked
  separately; this story does not touch the action row beyond reading
  `pileTotals`, which it already did.

## Verification

- [x] Sandbox run performed: the full gate, in order, all green —
      `tokens:check`, `contrast` (48 pairings, up from 46), `typecheck`,
      `lint`, `test:core` (7 files / 85 tests), `test:ui` (10 suites / 48
      tests), `build:web`, `test:e2e` (120 passed, 6 skipped — the same six
      orientation cases that are project-skipped on this tree). Playwright
      ran against the exported `dist/` build with no network, which is the
      offline path (see Test plan's last item).
- [x] Screenshots (UI stories only) — golden path:
      `docs/ux/screenshots/phone-landscape/counter-short-so-far.png` (two
      short baskets in the pile: `2 เข่งไม่เต็ม · สั้น 20.4 กก.` under the
      expected-reading caption, numeral untouched) and
      `docs/ux/screenshots/phone-landscape/counter-pile-short.png`
      (`เข่งไม่เต็ม 2 · 20.4 กก.`, `น้ำหนักรวม 150 + 20.4 = 170.4 กก.`).
      Both also captured for `phone-landscape-floor`.
- [x] Screenshots (UI stories only) — edge cases: the zero case is the
      existing `counter-pile.png` / `counter-count.png` pair, re-captured in
      this run — the Count tab shows no short line at all, and the Pile tab
      shows `เข่งไม่เต็ม 0` with the zero-term breakdown.

## Dev notes

**Shape of the change.** Presentation only, as scoped: `src/core/totals.ts`
is untouched, no event kind changed, nothing new is appended.

- `HoldStage` gained one optional prop, `register?: ReactNode` — a slot in
  the caption's absolutely-positioned strip at the bottom of the stage,
  rendered under the caption. A slot rather than a second string prop
  because what goes in it is the caller's business; the stage keeps knowing
  only about a numeral, a bezel and a caption. Because the strip is
  absolutely positioned, nothing rendered into it can push or resize the
  public numeral — asserted in e2e by measuring the numeral's box before and
  after the first short basket and requiring it to be identical, which is a
  truer reading of the F-9.7 rule than the "line below the numeral's box"
  check first written (that one fails against the numeral's *line box*,
  which is taller than the glyph and which the existing caption has always
  sat inside).
- `counter.tsx` renders `<ShortSoFar totals={totals} />` into that slot and
  returns `null` at zero short baskets, and `PilePanel`'s two rows now
  resolve `pile.shortWithWeight` / `pile.netBreakdown`. `Stat` gained an
  optional `testID`, applied to the value text.
- New pairing added to `scripts/check-contrast.mjs`: `warn` on `stage`, the
  colour the new line is set in. 8.72:1 light, 9.26:1 dark.

**Deviations from the story as written, and why.**

1. *The component test lives in `src/test/counter-screen.test.tsx`, not
   `src/app/sale/[id]/counter.test.tsx`.* Everything under `src/app/` is a
   ROUTE to expo-router: a test file beside the screen was exported by
   `build:web` as a real, reachable `/sale/[id]/counter.test` page (observed
   in the export manifest, with its jest mocks bundled into the app). The
   test imports the screen by path instead. Worth remembering for every
   future screen-level test.
2. *`counter.tsx` is testable at the jest tier now, which it was not
   before.* Two collaborators are replaced: `expo-router` (untranspiled ESM
   under jest-expo) and the platform event store (a four-method in-memory
   adapter — `MemoryStore` itself is unreachable from a test, because jest
   resolves the bare `./store` specifier to `store.web.ts` exactly as Metro
   does). Everything else is production code, including the real `append`
   path, so a basket confirmed through the panel in a test is a real event
   in a real log. jest-expo also defines a `window` with no `location`, and
   the screen reads `?holdMs=` off it, so the test defines one.
3. *`formatKg` drops trailing zeros*, so the breakdown renders `150 + 0 =
   150 กก.` rather than the story's illustrative `40.0 + 0.0 = 40.0`. The
   rule the story cares about — the zero term is still shown, the shape does
   not change with the data — holds; the decimals in the examples were
   illustrative, and matching them would have meant a second kg formatter
   disagreeing with `gate.expected` one line above it.
4. *`openPileScenario` gained a third, optional parameter*
   (`shortReadingsG`) rather than a new fixture, since the story invited
   either and no existing fixture produced a short basket in a pile that is
   still counting. Default is empty, so every existing caller sees the log
   it saw before.

**Not done, deliberately.** No change to the Log tab, the public numeral,
`gate.expected`, or the close/reopen row; S23's bulk-entry `short` events
will render through this same path with no further work here.

## Code review

- Reviewer (separate agent/session):
- Findings:
- Resolution:

## QA notes
