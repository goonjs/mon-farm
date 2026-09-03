# Story: A farm is not re-typed every sale

Status: Review — implemented 2026-09-03, acceptance criteria agreed with the
owner the same day alongside the design decisions below. **Every stage of
`npm run verify` is green, e2e included** (122 Playwright tests across four
projects; screenshots captured). **Independent code review done 2026-09-03 —
no blocking findings.** Two should-fix and one nit; two fixed, one open (test
files shipping as routes in the web bundle) because the fix needs a file move
and the owner's word. See Code review.

## Context

- Epic: `docs/epics/epic-2-second-field-round.md` (item 6, S27)
- Related PRD section(s): FR-1.4 (zones and the contract that governs them),
  FR-3 (piles, tare and standard net), FR-10.3 (historical reporting — the
  part this story makes possible but does not deliver), NFR-1 (usable with no
  network)
- Related architecture section(s): the device-preference layer
  (`src/i18n/preference.ts`, `src/speech/preference.ts`) versus the event log
  (`src/store/store.ts`); the platform-split store pattern in
  `src/store/people.ts`

## Description

Every sale starts from an empty setup screen. The same zones and the same
piles, with the same tares, get typed in again each time. Each retype is a
chance to enter a different tare for the same basket — and a tare is not
cosmetic, it is subtracted from every basket in that pile for the rest of the
sale.

This story adds a **farm profile** stored per device: the zones of the farm,
and each zone's usual piles with their tare and standard net. The setup screen
offers it as a starting point instead of a blank form.

The profile is **device configuration, not sale data**. It stays out of the
event log, next to the language, theme and speech preferences — what the app
remembers about the farm is not a fact about any particular sale.

## Decisions

**1. Profile ids go into the log, and this is the point** (owner,
2026-09-03). Today every sale mints fresh `newId('zone-')` and
`newId('pile-')` values, so "โซนบน" in September and "โซนบน" in October are
different ids in two different logs. Nothing can roll them up across sales
except by matching names, which breaks silently the first time a name is typed
slightly differently — and breaks in a way nobody can detect afterwards.

So a profile zone and a profile pile each carry a **permanent id**, minted
once with the existing `newId` helpers and reused every time that zone is used
in a sale. When setup prefills, the `zone_added` and `pile_added` events carry
the profile's id rather than a new random one.

This costs nothing now — same field, same shape, no migration, no new payload
key — and it is what makes "which zone earned what over the last six months"
answerable at all. It is expensive to add later, because every sale recorded
in the meantime keeps its throwaway ids forever.

A sale set up by hand, without the profile, still works exactly as it does
today. It simply is not part of the long-run rollup, which is the honest
outcome: nobody said those piles were the same piles.

**2. The long-run report is a separate story** (owner, 2026-09-03). S27 lays
the identity groundwork and stops there. Cross-sale reporting — "which zone
performed how, over months" — is **S31**, written into the epic and built
after S28's single-sale report, so it is designed once against a money model
that already includes deductions.

**3. Full platform split, following `src/store/people.ts`** (owner,
2026-09-03): port + web + native + memory. The simpler single-file precedent
(`src/i18n/preference.ts`, whose own header names S27 as the case that might
need more) was rejected because the phone is the real target device. A profile
that only persists on web does not remove any retyping for the person standing
at the scale.

**4. The profile reaches a sale through an explicit button, not auto-prefill.**
Prefilling appends real events, and nothing should enter the log because a
screen was opened. Auto-prefill would also need pile removal to undo, which is
S26 and is not built. One button, pressed on purpose.

## Acceptance criteria

- [ ] The profile persists on the device across an app restart and a reload,
      with no network at any point, on web and on native.
- [ ] The profile holds zones; each zone holds piles; each pile holds a name,
      a tare and a standard net. Weights are stored as integer grams and
      entered in kg, converting at the boundary exactly as setup does today.
- [ ] The profile is editable from a settings surface: add and rename a zone,
      add, edit and remove a pile. A zone is **archived, never deleted** — a
      zone id referenced by a past sale's log must stay resolvable.
- [ ] Setup, on a sale with no zones yet, offers the profile and appends
      nothing until the owner presses the button. Not pressing it leaves the
      screen exactly as it behaves today.
- [ ] **Zones and piles created from the profile carry the profile's ids.**
      The same profile used in two different sales produces the same zone id
      and the same pile ids in both logs. This is asserted end-to-end, across
      two sales, not just unit-tested.
- [ ] After prefilling, the sale is ordinary: zones and piles can be added by
      hand alongside them, and the existing start-counting gate is unchanged.
- [ ] **Nothing in this story writes to the event log except the prefill
      button**, and that writes only the `zone_added` and `pile_added` events
      setup already writes today. No new event kind, no new payload.
- [ ] On first use, when the profile is empty and at least one past sale
      exists, the profile screen offers to seed itself from the most recent
      sale. Explicitly, so the owner can see what the app decided to remember
      rather than having it inherited silently.
- [ ] A corrupt or unreadable stored profile degrades to an empty profile
      rather than taking the app down, matching `people.web.ts`.

## Offline / sync behavior

Fully offline, and deliberately outside the sync story altogether. The profile
is device configuration: it is not in the event log, has no `seq`, is never
marked synced, and will not be uploaded when a backend exists. Two devices
would each keep their own profile, which is correct — it is a description of
how that device is set up, not a fact about the farm that two devices must
agree on.

The one place the profile touches sale data is the prefill button, and there
it produces ordinary `zone_added` / `pile_added` events through the existing
`SaleProvider.append` path. Those sync exactly like every other event, with no
special case: the sale's log is complete on its own and never needs the
profile to be interpreted later. That is why the ids are copied *into* the
events rather than referenced from them.

Storage: `localStorage` on web (one JSON document under
`mon-farm:farm-profile`), a pair of tables in the existing `mon-farm.db` on
native. Adding tables to that database is safe — each module's
`CREATE TABLE IF NOT EXISTS` touches only its own table, as
`people.native.ts` already does. The `events` table is not touched.

`docs/checklists/offline-sync-checklist.md` is completed for this story.

## Test plan

_Tests below are written to fail first (TDD), then implemented to green._

- [ ] Online path — n/a; the app has no online path. Read as the normal
      in-app flow, driven for real in a browser.
- [ ] Offline path — the whole story. Build a profile, reload, use it in a
      sale, all with no network.
- [ ] Reconnect / manual sync path — n/a, no backend exists yet, and the
      profile is out of scope for sync by design.

Unit (Vitest, `src/store/farm.test.ts`, against the memory store):

- [x] Starts empty; a created zone round-trips
- [x] Ids are stable across reads and across writes to other zones
- [x] Zone listing is Thai-collated, not insertion-ordered
- [x] Archiving hides a zone from the list but keeps it resolvable
- [x] Renaming a zone keeps its id
- [x] Piles add, edit and remove within a zone
- [x] An unknown zone or pile id is a no-op, not a throw

Component (Jest, `.test.tsx`):

- [x] The profile screen adds a zone and a pile, and converts kg to grams
      (`src/app/farm-profile.test.tsx`)
- [x] Archiving a zone removes it from the list
- [x] The empty profile offers to seed from the most recent sale
- [x] Setup's prefill card appears only when the sale has no zones, and
      appends nothing until pressed (`src/app/sale/[id]/setup.test.tsx`)
- [x] Pressing prefill appends one `zone_added` per zone and one `pile_added`
      per pile, **carrying the profile's ids** — asserted on the appended
      payloads, not just on what renders

End-to-end (Playwright, `e2e/farm-profile.spec.ts`, 6 tests):

- [x] An empty profile shows the empty state, not a blank screen
- [x] Build a profile through the UI, reload, and find it intact
- [x] Archiving a zone removes it from the profile but the id stays resolvable
- [x] Start a sale, prefill, and see the piles with the right tare
- [x] **Two sales built from the same profile carry the same zone and pile
      ids** — the identity guarantee, proved across two separate sales' logs
- [x] The prefill card does not appear on a sale that already has zones

## Verification

- [x] Sandbox run performed: **yes, in full.** Every stage of `npm run verify`
      ran for real and is green — `tokens:check`, `contrast`, `typecheck`,
      `lint`, `test:core`, `test:ui`, `build:web`, and the e2e suite
      (**122 passed, 6 skipped** across all four Playwright projects; the 6
      are viewport-specific orientation tests that only run in their own
      projects by design).
- [x] Screenshots (UI stories only) — golden path:
      `docs/ux/screenshots/{phone-landscape,phone-landscape-floor}/farm-profile-golden.png`
      — the zone `โซนบน` with its rename and archive controls, the pile
      `กองที่ 1 · ตะกร้า 2.5 + มาตรฐาน 50 กก.` with edit and remove, and the
      add-pile row beneath.
- [x] Screenshots (UI stories only) — edge cases: `farm-profile-empty.png`
      (an empty profile showing its empty state rather than a blank screen)
      and `farm-profile-no-prefill.png` (a sale that already has zones, where
      the prefill card must not appear).

**On running Playwright here**: the image ships Chromium at `/opt/pw-browsers`
but the repo pins a newer build than it carries, so the default executable
path misses and `npx playwright install` is blocked by the egress proxy. The
suite runs when passed the installed binary via `launchOptions.executablePath`
from a scratchpad config outside the repo. `playwright.config.ts` is
deliberately NOT changed — this is a property of one sandbox, not of the
project. Same note as S29.

## Dev notes

New files:

- `src/store/farm.ts` — the port: `ProfileZone` / `ProfilePile`, the
  `FarmStore` interface, the `export declare const farmStore` ambient
  declaration (Metro resolves per platform; project-wide `tsc` cannot — the
  reasoning is in `people.ts:42-47`), and the `MemoryFarmStore` re-export with
  the same Jest-vs-Vitest warning.
- `src/store/farm.web.ts` — one JSON document under `mon-farm:farm-profile`,
  every read and write in `try/catch` behind `globalThis.localStorage?.`,
  degrading to empty/no-op exactly as `people.web.ts` does.
- `src/store/farm.native.ts` — `farm_zones` / `farm_piles` in the existing
  `mon-farm.db`, lazy memoised `open()` with `CREATE TABLE IF NOT EXISTS`.
  The `events` table and `src/store/store*.ts` are untouched.
- `src/store/farm-memory.ts`, `src/store/farm.test.ts`.
- `src/app/farm-profile.tsx` — the editor, a sibling route rather than a
  section inside `settings.tsx` (whose only primitive is `Choice`, an
  enumerated picker; this is a list). Nothing on it writes to the event log.
- `src/app/farm-profile.test.tsx`, `src/app/sale/[id]/setup.test.tsx`,
  `e2e/farm-profile.spec.ts`.

Changed: `src/app/sale/[id]/setup.tsx` (the prefill card and `usePrefill`),
`src/app/settings.tsx` (one link), `src/i18n/messages.ts` (`farm.*` ids, `th`
first then `en`), `e2e/fixtures.ts` (a `seedFarmProfile` helper, mirroring
`seedPeople`).

**Ids are the load-bearing part.** `usePrefill` appends the existing
`zone_added` / `pile_added` payloads carrying `zone.id` and `pile.id`
straight from the profile — no new event kind, no new field, no change to
`types.ts`. That is Decision 1, and it is what makes S31's cross-sale rollup
possible. It is asserted twice, at two tiers that fail for different reasons:
the component test checks the appended payloads directly, and the e2e test
prefills two separate sales from one profile and finds the same ids resolving
in both.

**Not directly tested, by deliberate convention**: `farm.web.ts` and
`farm.native.ts`. `vitest.config.ts` includes `src/store/*.test.ts` with a
single star specifically so the platform adapters — which touch
`localStorage` and `expo-sqlite` — stay out of the node-environment tier.
The web adapter is exercised for real by the Playwright tests, which run
against the exported web build; the native adapter is not exercised by any
tier in this repo, exactly as `people.native.ts` is not. The corrupt-profile
acceptance criterion is therefore satisfied by construction (the same
`try/catch` shape as `people.web.ts`) rather than by a test of its own, which
is worth stating plainly rather than checking off.

**Implementation was interrupted.** The agent implementing this story was
killed partway by a rate limit, after the code and tests were written but
before it updated this file. The gate was re-run from scratch and the story
record written from what the tests and screenshots actually show, not from
the agent's account of them.

`docs/checklists/offline-sync-checklist.md` — completed: fully offline, no
network call added anywhere. The profile is device configuration and is
deliberately outside the sync story — no `seq`, never marked synced, never
uploaded; two devices each keep their own, which is correct for a description
of how a device is set up. The one place it touches sale data is the prefill
button, which produces ordinary events through `SaleProvider.append`; those
sync like any other event, and the sale's log stays complete on its own —
which is exactly why the ids are copied INTO the events rather than
referenced from the profile.

## Code review

- **Reviewer (separate agent/session)**: independent review agent, 2026-09-03,
  against commit `d49c014`. Worked `docs/checklists/code-review-checklist.md`,
  traced the identity guarantee through all three adapters and the projection
  by hand, and re-ran `typecheck`, `lint`, `test:core`, `test:ui`,
  `build:web` and the e2e suite itself rather than reading assertions.

- **The identity guarantee was checked hardest, and holds.** `newId` is minted
  exactly once, at creation time, in all three adapters, and is never
  re-minted by `renameZone`, `editPile` or `archiveZone`. `usePrefill` never
  calls it. `FarmStore` has no `deleteZone` at all, so no code path can drop a
  zone id a past sale's log references. The reviewer confirmed both identity
  tests would actually fail if prefill minted fresh ids — which is the
  question worth asking of any test, and the one this story could not afford
  to get wrong.

- **Findings**: no blocking. Two should-fix, one nit.

  1. *(should-fix — **NOT yet fixed**, needs the owner)* `src/app` is the
     expo-router routes directory, so `farm-profile.test.tsx` and
     `sale/[id]/setup.test.tsx` **ship as real, servable pages** in the
     production web bundle: `dist/farm-profile.test.html` and
     `dist/sale/[id]/setup.test.html` both exist after `npm run build:web`
     (verified independently). Every other `.test.tsx` in this repo lives
     outside `src/app`; these two are the first inside it, and nothing
     excludes them from route generation. It ships test scaffolding and mock
     wiring as public pages — dead weight at best, a description of internal
     test seams at worst.

     The fix is to move both files out of `src/app`. Moving deletes their
     current paths, and `CLAUDE.md`'s file-deletion gate has no carve-out for
     files the agent created itself, so this is **left undone pending the
     owner's explicit confirmation** rather than interpreted around. It should
     be fixed before `Done`.

  2. *(should-fix — fixed)* `farm.native.ts` ordered zones with SQL
     `ORDER BY name COLLATE NOCASE`, which only case-folds ASCII and has no
     Thai dictionary collation — so a zone named ไก่ sorted after ขา instead
     of before it, the vowel-reordering rule the web and memory stores get
     from `localeCompare(..., 'th')`. A real divergence on the five prefixed
     vowels, which are common in Thai place names, and one that would only
     ever surface on the device, since no tier tests the native adapter.
     Zones are now ordered in JS after the read, so all three adapters agree.

  3. *(nit — fixed)* `addPile` with an unknown `zoneId` was a silent no-op in
     the web and memory stores but an unconditional `INSERT` in
     `farm.native.ts`, leaving an orphan row nothing joins to. No current UI
     path reaches it, but it contradicted the port's stated contract. Guarded.

- **Resolution**: findings 2 and 3 fixed in the same session as the review.
  Finding 1 is recorded as open and blocking `Done`, not deferred — it needs
  a file move, which needs the owner's word.

  Worth recording alongside the fixes: finding 2 landed in exactly the place
  this story's own Dev notes had already flagged as untested. The gap was
  identified honestly and then a real bug appeared in it. That is an argument
  for the repo growing a native-adapter test tier, not just for this one
  patch — raised here rather than filed away.

## QA notes
