# Story: A farm is not re-typed every sale

Status: Ready — acceptance criteria agreed with the owner 2026-09-03,
alongside the design decisions recorded under "Decisions" below.

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

- [ ] Starts empty; a created zone round-trips
- [ ] Ids are stable across reads and across writes to other zones
- [ ] Zone listing is Thai-collated, not insertion-ordered
- [ ] Archiving hides a zone from the list but keeps it resolvable
- [ ] Piles add, edit and remove within a zone
- [ ] An unknown zone or pile id is a no-op, not a throw

Component (Jest, `.test.tsx`):

- [ ] The profile screen adds a zone and a pile, and converts kg to grams
- [ ] Setup's prefill card appears only when the sale has no zones
- [ ] Pressing prefill appends one `zone_added` per zone and one `pile_added`
      per pile, carrying the profile's ids

End-to-end (Playwright, `e2e/farm-profile.spec.ts`):

- [ ] Build a profile through the UI, reload, and find it intact
- [ ] Start a sale, prefill, and see the piles with the right tare
- [ ] **Two sales from the same profile carry the same zone id** — the
      identity guarantee, proved across sales

## Verification

- [ ] Sandbox run performed:
- [ ] Screenshots (UI stories only) — golden path:
- [ ] Screenshots (UI stories only) — edge cases: an empty profile; a sale
      that already has zones, where the prefill card must not appear

## Dev notes

New files: `src/store/farm.ts` (port, with the `export declare const
farmStore` ambient declaration that lets project-wide `tsc` resolve a name
Metro picks per platform), `src/store/farm.web.ts`, `src/store/farm.native.ts`,
`src/store/farm-memory.ts`, `src/app/farm-profile.tsx`,
`src/store/farm.test.ts`.

The profile editor is a **separate route**, not a section inside
`src/app/settings.tsx`. That screen's only primitive is `Choice`, an
enumerated string picker; a zone and pile editor is a list. A sibling route
keeps settings.tsx's shape intact and gives the editor room. It is named
`farm-profile.tsx` rather than `settings/farm.tsx` so nothing depends on
expo-router resolving a file and a directory of the same name.

Changed: `src/app/sale/[id]/setup.tsx` (the prefill card in `ZonesCard`; the
hard-coded `'2'` / `'50'` kg defaults stay as the fallback for a hand-typed
pile), `src/app/settings.tsx` (one link), `src/i18n/messages.ts`,
`e2e/fixtures.ts` (a profile-seeding helper; none exists today).

## Code review

- Reviewer (separate agent/session):
- Findings:
- Resolution:

## QA notes
