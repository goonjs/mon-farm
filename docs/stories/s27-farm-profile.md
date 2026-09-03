# Story: A farm is not re-typed every sale

Status: **Review** — 2026-09-03

## Context

- Epic: `docs/epics/epic-2-second-field-round.md` (§S27)
- Related PRD section(s): FR-1 (roster/setup), FR-2.1–2.4 (zones and piles at
  setup), FR-3.4 (`stdNetG` locking — unaffected, see below)
- Related architecture section(s): `docs/architecture.md` §Local data layer
  (device-scoped stores, no `synced_at` yet — same shape as `people.ts`)
- Depends on: S16 (`src/store/people.ts` — the port/adapter pattern this
  follows), S6 (the setup screen this prefills), S26 (pile editing — see
  "Interaction with S26" below; **build against whichever of S26/S27 lands
  first**, not against an assumption that S26 is already in)
- Owner feedback that prompted this story: item 6 of the epic's field list —
  the same zones and piles, with the same tares, get retyped every sale, and
  each retype is a chance to enter a different tare for the same basket.

## Description

Today, `docs/stories/s6-sale-setup.md`'s setup screen starts from nothing:
`ZonesCard` renders whatever `state.zones`/`state.piles` the current sale's
event log holds, which for a new sale is empty. The farm's actual zones and
piles do not change sale to sale — only the day's price and counts do — so
retyping them is pure friction, and worse, a second chance to fumble a tare
that was already agreed.

This story adds a **farm profile**: a second store, per device, following
`src/store/people.ts`'s exact port/adapter shape (`FarmProfileStore`
interface in a platform-agnostic base file, `farmProfile.web.ts`
(localStorage) and `farmProfile.native.ts` (expo-sqlite, sharing
`mon-farm.db` in its own table) implementations, a `MemoryFarmProfileStore`
in its own file for the same jest-expo platform-resolution reason
`people-memory.ts` exists). The profile holds **zones**, and **each zone's
usual piles** — name, tare, standard net.

The setup screen's `ZonesCard` (`src/app/sale/[id]/setup.tsx`) offers the
profile as a **starting point**, not a form to retype: on a new sale with no
zones yet, the profile's zones/piles are shown prefilled and can be accepted
as-is, edited before the sale starts, or rejected zone-by-zone (removed from
this sale without touching the profile). None of this changes how a zone or
pile actually gets into a sale — it is still `zone_added`/`pile_added` events,
written the same way a manually-typed zone is written today. The profile only
changes what the form starts holding.

**The profile is maintained explicitly**, through a new **Farm profile**
settings surface (`src/app/settings.tsx` gains a section, or a linked screen
— see Dev notes for the open call), seeded once from the last sale's zones
and piles on first use (first time the settings surface is opened with an
empty profile and at least one past sale exists) and edited there from then
on. It is never implicitly re-derived from "the last sale" on each new sale —
see "Why explicit, not implicit" below.

**The profile is device configuration and stays out of the event log.** No
new event kind is added for it. It lives in its own store, the same way
`people.ts` does, and nothing about a sale's settlement, report, or audit
trail ever reads it directly — only the `zone_added`/`pile_added` events a
sale actually writes carry weight in the log.

### Why explicit, not implicit (carried from the epic)

The epic considered and rejected "read the profile off the last sale's log
each time a new sale starts." The reasoning, verbatim from the epic, is the
acceptance-relevant part of this story, not just narrative color:

> Implicit inheritance means a one-off change in one sale silently becomes
> next month's default, and the owner cannot see what the app decided to
> remember.

Concretely: if sale setup silently derived "the profile" from whatever the
most recent sale happened to contain, then a one-off correction — a tare
adjusted for a single wet-weather sale, a zone added for a one-time borrowed
plot — would silently become the template every future sale prefills from,
with no screen where the owner can see that this happened or undo it. An
explicit profile, maintained on its own settings surface and only ever
touched by an owner action (seed once, then edit), is legible: what the app
will prefill next time is exactly what the profile screen shows right now,
and nothing else changes it.

## Acceptance criteria

- [x] `FarmProfileStore` exists (`src/store/farmProfile.ts`, mirroring
      `people.ts`'s shape) with `get()` (returns the current profile —
      `null`/empty when none exists yet), `setZones()` or equivalent
      mutators to add/rename/remove a zone in the profile, and
      add/edit/remove a pile within a zone. Native and web adapters both
      implement it against the same interface; native shares `mon-farm.db`
      via its own table(s).
- [x] The profile is **not seeded automatically on install** — it starts
      empty. It is seeded **once**, from the most recently *started* sale's
      zones and piles, the first time the farm-profile settings surface is
      opened while the profile is still empty and at least one sale exists.
      Opening it again after that never re-seeds, even if the profile was
      since edited down to nothing — an intentionally emptied profile stays
      empty, it does not un-empty itself.
- [x] A settings surface lets the owner view, add, rename, and remove a
      profile zone, and add, edit (tare, standard net, name), and remove a
      pile within a profile zone — independent of any sale being open.
- [x] On sale setup (`ZonesCard`), when the current sale has **zero zones**
      and the profile is non-empty, the screen offers the profile's zones
      and piles as a prefilled starting point rather than the current blank
      "type a zone name" form alone. Accepting a zone writes the same
      `zone_added`/`pile_added` events a manually-typed zone would write —
      no event distinguishes a profile-sourced zone from a hand-typed one.
- [x] Each offered zone (and each of its piles) can be **edited before
      acceptance** (e.g. a different tare for this sale) and can be
      **rejected** — left out of this sale entirely — without changing the
      farm profile. Rejecting-then-accepting-differently must not silently
      rewrite the profile; only the settings surface does that.
- [x] Once the sale has at least one zone (whether from the profile or typed
      by hand), the profile prefill no longer applies to that sale — adding
      a further zone goes through the existing manual "add zone" form, not a
      second offer of the same profile. (Prevents re-offering already-used
      or already-rejected profile zones as the sale progresses.)
- [x] The profile is never read by `settle()`, the report (S28), or any
      other consumer of the event log — confirmed by there being no new
      event kind and no store other than `farmProfile.ts` importing from it
      outside `setup.tsx` and the settings surface.

## Edge cases

- **Empty profile, first-ever run.** No past sale exists yet, so there is
  nothing to seed from. The farm-profile settings surface shows an empty
  state ("no zones saved yet") with the ability to add one by hand, matching
  `PeoplePicker`'s empty-state pattern. Setup falls back to today's
  blank-form behavior unchanged.
- **Profile offered, rejected for one sale.** Rejecting a profile zone (or
  editing its tare) for the current sale must not write anything to
  `farmProfile`'s store — only to the sale's own event log, or to nothing at
  all if the zone is simply not accepted. Verified by asserting the
  profile's stored contents are byte-identical before and after a sale that
  rejects/edits an offered zone.
- **A pile is edited during a sale (S26).** S26 adds `pile_edited` to a
  sale's own event log — a correction to *this sale's* pile, snapshotting
  forward like every other event. That edit **never writes back to the farm
  profile.** The profile is the next sale's starting point, not a mirror of
  the current one; if every in-sale correction propagated back, the same
  "silent template" problem the epic rejected for implicit inheritance would
  reappear one level down. If the owner wants next sale to start from the
  corrected tare, they update the profile explicitly, in its own settings
  surface — same discipline as everywhere else in this story.
- **A profile pile/zone is removed** (from the settings surface, not from a
  sale). It simply stops being offered on the next sale's setup. It has no
  effect on any sale already in progress or already closed — those sales'
  events are already written and are the only record of what that sale
  actually contained.
- **Interaction with S26, whichever lands first.**
  - If **S26 lands first**: `ZoneEditor`/pile UI on the setup screen already
    has rename/remove affordances for a sale's own zones/piles by the time
    this story is implemented. This story's prefill only needs to populate
    the initial `zone_added`/`pile_added` events the same way a manual add
    does today — S26's editing then applies uniformly, with no special case
    for a profile-sourced pile vs. a hand-typed one (per FR-3.4/S26's
    `locked` rule, `stdNetG` still locks the moment counting starts,
    regardless of where the pile came from).
  - If **S27 (this story) lands first**: the setup screen has no in-sale
    pile-editing yet, so "edit before acceptance" (AC above) is implemented
    as editing the *prefilled draft fields* before the accept action fires
    the `pile_added` event — not as a post-hoc correction. Once S26 lands,
    the ordinary S26 editing flow takes over for any further correction,
    and this story's pre-acceptance edit path is unaffected (it edits an
    unwritten draft, not a logged event).
  - Either order: neither story's acceptance criteria depend on the other
    having landed. This section exists so whichever lands second does not
    have to re-derive this reasoning.

## Offline / sync behavior

`docs/checklists/offline-sync-checklist.md`, completed honestly:

- [x] **Feature is fully usable with no network connection.** The farm
      profile is local-only device configuration, same tier as
      `people.ts` and the language/theme settings in `settings.tsx` — there
      is no network path in this story at all, not "offline works because
      sync degrades gracefully."
- [x] **Local writes made while offline are queued/persisted correctly.**
      N/A in the queued sense — there is no queue. Writes go straight to the
      local store (localStorage on web, SQLite on native) exactly like
      `people.ts`, and persist immediately; there is nothing to queue
      because there is nothing to send anywhere yet.
- [ ] **Sync triggers correctly on reconnect.** N/A — no backend exists for
      this table yet, same as `people.ts`'s `synced_at`-less state today
      (`docs/architecture.md` §Sync engine). Not in scope for this story.
- [ ] **Sync can also be triggered manually.** N/A, same reason.
- [ ] **Conflicting local/remote changes are resolved per the strategy in
      `docs/architecture.md`.** N/A — with no remote copy, there is no
      conflict to resolve. **What happens when a backend eventually
      exists**, stated honestly rather than deferred silently: a farm
      profile is single-owner, edited from exactly one device's settings
      screen at a time in the app's current single-device model, so the
      simplest correct strategy once sync exists is last-write-wins on the
      whole profile document (or per-zone/per-pile document), the same
      tier `people.ts` is expected to get rather than event-sourced
      conflict resolution — it is configuration, not a negotiated fact
      between two parties the way a sale's events are. This story does not
      build that; it is called out so the future sync story does not have
      to re-derive why LWW is adequate here.
- [x] **User has some visibility into sync status appropriate to this
      story's scope.** N/A by the same reasoning as `people.ts` and the
      settings screen's language/theme toggles — none of them show a sync
      indicator today, and this story does not introduce the first one.
- [x] **No data loss scenario identified during testing.** Rejecting or
      editing a profile-offered zone for one sale must provably not mutate
      the stored profile (see the "rejected for one sale" edge case above,
      and its dedicated test in the Test plan) — that is the specific
      data-loss shape this story could introduce if it got the write path
      wrong (accept-path code accidentally also writing to `farmProfile`).

## Test plan

Written to fail first (TDD), per criterion above.

**Vitest — the store (`src/store/farmProfile.test.ts`, mirroring
`people.test.ts`'s structure against `MemoryFarmProfileStore`):**
- [x] Empty start: `get()` returns null/empty on a fresh store.
- [x] Add a zone, add a pile to it; `get()` reflects both.
- [x] Rename a zone; edit a pile's tare/standard net/name; both keep their
      identity (id) across the edit.
- [x] Remove a zone (removes its piles with it) and remove a single pile,
      independently.
- [x] Seeding: given a set of "last sale" zones/piles handed to a seed
      function/method, an empty profile is populated once; calling seed
      again on an already-non-empty (even if since-emptied-by-the-user)
      profile is a no-op. Cover both "never seeded" and
      "seeded-then-emptied-by-user" as distinct cases, since the acceptance
      criterion explicitly requires the second not to re-seed.
- [x] Edit/remove on an unknown zone/pile id is a no-op, not an error
      (matching `people.ts`'s `rename`/`archive` convention).

**Jest (jest-expo) — the settings surface and the prefilled setup form:**
- [x] Farm-profile settings surface: empty state renders; add/rename/remove
      a zone; add/edit/remove a pile within a zone — each against a mocked
      `farmProfileStore` (constructed inside the mock factory, per the
      lesson recorded in `docs/stories/s16-people-store.md` Dev notes #4,
      not captured as an outer `const`).
- [x] `ZonesCard`/setup form, against a mocked `farmProfileStore` returning
      a non-empty profile and a sale with zero zones: profile zones/piles
      render as a prefilled, editable, per-zone acceptable/rejectable
      offer, not as already-committed sale state.
- [x] Accepting an offered zone calls `appendMany` with `zone_added` /
      `pile_added` payloads matching the profile's (possibly edited)
      values — same event shape a manually-typed zone produces, asserted by
      comparing payload shape, not by a special-cased "from profile" field
      (there isn't one).
- [x] Rejecting an offered zone, or editing its tare before accepting, does
      **not** call any `farmProfileStore` mutator — only `append` (or
      nothing, for a pure rejection).
- [x] Once the sale already has one zone (real state, not the profile),
      the prefill offer no longer renders; only the existing manual
      add-zone form does.

**Playwright e2e (`e2e/farm-profile.spec.ts`, new file):**
- [x] Seed a profile (via the settings surface, driven through the UI, not
      injected directly) with one zone and one pile; start a **new** sale;
      assert the setup screen shows the profile's zone/pile as an
      offer/prefill rather than an empty zones list.
- [x] Accept the offer as-is; assert the resulting sale state (after
      reload, matching the existing `e2e/setup.spec.ts` reload-survival
      pattern) has the same zone/pile the profile held, written as real
      `zone_added`/`pile_added` events.
- [x] Edit the tare on the offered pile before accepting; accept; assert
      the sale's pile carries the *edited* tare, and — reading the farm
      profile settings screen afterward — the stored profile still shows
      the *original* tare (the specific no-mutation guarantee from the
      Edge cases section).
- [x] Reject the offered zone entirely for one sale, add a different zone by
      hand instead; assert the profile (checked via the settings screen)
      is unchanged.
- [x] A second, brand-new sale after the above still offers the *original*
      unedited profile (not the previous sale's edited or rejected
      version) — proves the profile only changes via its own settings
      surface.

**Existing e2e assertions likely needing an update, now that setup is no
longer blank when a profile exists:**
- `e2e/setup.spec.ts`'s progression tests currently assume a brand-new sale
  starts with zero zones and drive the "add a zone by hand" path from
  scratch. Once a farm profile exists (which it will, in any e2e run order
  where `e2e/farm-profile.spec.ts` or a settings-driven seed ran first, or
  once seeding-from-last-sale means *any* prior e2e sale seeds a profile),
  those tests may see a prefilled offer instead of a blank zones card. Either
  isolate `setup.spec.ts`'s test sales behind a guaranteed-empty-profile
  fixture (fresh storage per test, as it likely already resets via
  `localStorage.clear()` — verify this holds), or update the assertions to
  explicitly reject/ignore any offered profile zone before asserting the
  blank-form blocker messages. Flag this to whoever implements S27 as the
  first thing to check once `farm-profile.spec.ts` exists, since it is the
  one existing suite most likely to interact with this story's new prefill
  behavior.
- `e2e/sale-list.spec.ts`'s "starting a new sale" case (already updated once
  for S6) should be re-checked for the same reason — it may currently assert
  on the setup screen's initial empty state.

## Verification

- [x] Sandbox run performed: full gate on 2026-09-03 —
      `tokens:check`, `contrast`, `typecheck`, `lint`, `test:core`
      (151 passed, 11 files), `test:ui` (94 passed, 15 suites),
      `build:web` (exports `/farm-profile`), `test:e2e`
      (**188 passed / 6 skipped**, up from 174/6: 14 new farm-profile cases
      across the two phone-landscape projects, every pre-existing case
      unchanged and still green). Screens driven by hand through the exported
      web build for the screenshots below.
- [x] Screenshots (UI stories only) — golden path:
      `screenshots/s27/00-settings-row.png` (the new row on settings),
      `01-profile-empty.png` (empty state, first ever run),
      `02-profile-filled.png` (a zone and pile added by hand),
      `03-setup-offer.png` (the offer on a new sale),
      `05-accepted-into-sale.png` (accepted — a real `zone_added`/`pile_added`
      zone editor, indistinguishable from a hand-typed one).
- [x] Screenshots (UI stories only) — edge cases:
      `04-offer-edit-before-accept.png` (an offered tare being corrected for
      this sale only), `06-profile-unchanged.png` (the profile afterwards,
      still holding the original 2 kg tare — the no-mutation guarantee, on
      screen), `07-offer-rejected-blank-form.png` (offer rejected; setup falls
      back to the blank form).

## Dev notes

**Implemented 2026-09-03, on top of S26 (`4258434`).** What shipped, then the
three calls the PO left open, then the deviations.

### What shipped

- `src/store/farmProfile.ts` — types and the `FarmProfileStore` port, plus the
  ambient `farmProfileStore` declaration and the `MemoryFarmProfileStore`
  re-export, exactly the shape `people.ts` has.
- `src/store/farmProfile-doc.ts` — **one deviation from the proposed shape,
  and the only structural one**: every mutator is implemented once, on an
  abstract `DocFarmProfileStore` over a single profile document, and the three
  adapters (`farmProfile-memory.ts`, `farmProfile.web.ts`,
  `farmProfile.native.ts`) implement only `read()`/`write()`. Three copies of
  eight read-modify-write mutators would have been three chances to get the
  seeding rule wrong; SQLite stores the document in a one-row `farm_profile`
  table (`CHECK (id = 1)`), which also keeps `seededTs` and the zone list
  atomically consistent. It lives in its own file for the same
  platform-shadowing reason `people-memory.ts` does — a runtime value exported
  from `farmProfile.ts` is unreachable under Metro and jest-expo, though types
  are fine because they are erased.
- `src/app/farm-profile.tsx` — the profile's own screen, linked from a new row
  on `settings.tsx`. `src/app/sale/[id]/setup.tsx` gains `ProfileOffer` /
  `OfferedZone` inside `ZonesCard`.
- `seedFromSale(zones, piles)` became `seed(zones)` on the port, with the
  sale→profile mapping as a pure `profileZonesFromSale()` beside it. The store
  then knows nothing about `SaleState`, and the mapping is unit-testable on its
  own (it is where "no contract" and "no removed zones/piles" are enforced).
- `PileEditor`'s prop type widened from `Pile` to a structural
  `PileEditorTarget` (`id`, `name`, `tareG`, `stdNetG`). A sale's `Pile` still
  satisfies it, and the profile screen and the pre-acceptance offer now reuse
  the same edit form rather than growing a second one. Smallest change that
  removed a duplicate; no behaviour change for S26's callers.

### The three open calls

1. **"Seeded from the last sale" = most recently STARTED.** Taken as written
   in the story, and it is also the better rule on the merits: a sale's zones
   and piles are fully typed at *setup*, before a single basket, so an open
   sale carries just as complete a farm shape as a closed one — waiting for a
   close would leave an owner who sets up their first sale and opens the
   profile screen the same evening with an empty offer, which is the exact
   retyping this story removes. Implemented as "project every sale, take the
   greatest `startedTs`" rather than "take the first id `listSales()` hands
   back": newest-first is an adapter's documented behaviour, and this is a
   rule the story states, so it is decided from the sale's own data. The
   component test seeds two sales and has the mock list the OLDER one first,
   so a `listSales()`-order implementation fails it.
2. **The profile carries zone name + each pile's tare and standard net, and
   NOT the zone contract.** Confirmed as the epic's own scope ("zones, and
   each zone's usual piles with their tare and standard net"), and it is the
   reading that matches how a contract is agreed: a worker and a split are
   agreed with a person, per sale, and `PeoplePicker` already exists to pick
   one fresh. A remembered worker would also be the story's own failure mode
   one field over — last month's split quietly becoming this month's default
   with no screen saying so. Enforced, not just intended:
   `profileZonesFromSale` builds `{id, name, piles}` and a test asserts both
   the exact key set and that a `zone_contract_set` worker's name appears
   nowhere in the seeded profile.
3. **The profile editor is its own routed screen** (`/farm-profile`), linked
   from a new row on `settings.tsx` — the PO's recommendation, taken.
   `settings.tsx` says of itself "language and theme — nothing about a sale",
   and every control on it is a two-option `Choice`; zones, piles and tares
   are nearer `ZonesCard` in size. Settings keeps one row (a door, not a
   control) and its own framing.

### Interaction with S26, checked against what actually shipped

S26 landed first (`6dc1e6d`, `4258434`), so the story's "if S26 lands first"
branch is the live one, and it holds: the offer writes ordinary
`zone_added`/`pile_added` events, and S26's `ZoneEditor`/`PileRow` editing
then applies to them with no special case — nothing anywhere asks where a pile
came from. Two things the story could not have known, now that S26 is real:

- **Removed zones/piles are filtered in three places, and all three matter.**
  The offer renders only when the sale has zero *live* zones
  (`state.zones.filter(z => !z.removed)`), so a sale whose only zone was
  removed mid-setup does not suddenly get re-offered the profile — that would
  be the app arguing with a decision just made. `profileZonesFromSale` drops
  removed zones and piles when seeding, for the same reason one level up.
- **`pile_edited` never writes back.** S26's in-sale edit path
  (`PileRow` → `append('pile_edited')`) is untouched by this story and imports
  no profile mutator; the e2e case "the next sale is offered the profile, not
  the previous sale's edited version" proves it from the outside.

The pre-acceptance edit is what the story's second branch describes anyway: it
edits an unwritten draft in React state, and the accept writes one `appendMany`
batch (zone + its piles together — a half-written zone is not a state the log
should be able to hold).

### Where the profile is read from

Exactly two modules import `farmProfileStore`: `src/app/farm-profile.tsx` and
`src/app/sale/[id]/setup.tsx`. `settle()`, `totals.ts`, the projection and the
settlement screen import nothing from it, and no event kind was added — the
last acceptance criterion, verifiable with a grep.

### e2e isolation — checked, and it already holds

The story flagged `e2e/setup.spec.ts` and `e2e/sale-list.spec.ts` as likely to
break once a profile exists. Investigated before writing anything: Playwright
gives every test its own browser context, so `localStorage` — and with it both
`mon-farm:sales` and `mon-farm:farm-profile` — starts empty in each one, and
the profile is only ever seeded by *opening the farm-profile screen*, which
neither suite does. So there was nothing to weaken and nothing to fix: both
suites pass unchanged, and the reasoning is recorded in
`e2e/farm-profile.spec.ts`'s header so the next reader does not re-derive it.
Deliberately NOT done: adding a `localStorage.clear()` fixture, which would
have implied a leak that does not exist.

### Ambiguity 1 (per-device or per-farm) — still open, unchanged

Followed literally: one profile per device, no farm-selection concept, and the
SQLite schema says so out loud (`CHECK (id = 1)`). Still worth the owner
confirming single-farm-per-device before this ships.


**Proposed store shape**, to keep in step with `people.ts`'s pattern rather
than inventing a new one:

```ts
// src/store/farmProfile.ts
export interface ProfilePile {
  readonly id: string;      // reuse PileId's shape, not a sale-scoped PileId
  readonly name: string;
  readonly tareG: number;
  readonly stdNetG: number;
}

export interface ProfileZone {
  readonly id: string;      // reuse ZoneId's shape
  readonly name: string;
  readonly piles: readonly ProfilePile[];
}

export interface FarmProfile {
  readonly zones: readonly ProfileZone[];
}

export interface FarmProfileStore {
  get(): Promise<FarmProfile>;               // {zones: []} when empty, never null — simpler call sites
  addZone(name: string): Promise<ProfileZone>;
  renameZone(id: string, name: string): Promise<void>;
  removeZone(id: string): Promise<void>;
  addPile(zoneId: string, pile: { name: string; tareG: number; stdNetG: number }): Promise<ProfilePile>;
  editPile(pileId: string, patch: Partial<{ name: string; tareG: number; stdNetG: number }>): Promise<void>;
  removePile(pileId: string): Promise<void>;
  /** No-op if the profile is already non-empty OR was seeded before (even if since emptied). */
  seedFromSale(zones: readonly Zone[], piles: readonly Pile[]): Promise<void>;
}
```

The `seedFromSale`/"seeded before" distinction needs one bit of state beyond
"is the profile currently empty" — a profile emptied by the user must not
look identical to a never-seeded one, or the no-re-seed acceptance criterion
breaks. Simplest option: a `seededTs: number | null` field alongside `zones`
in the stored document (native: a column on a single-row table or a
`meta` table; web: part of the same localStorage JSON blob), set once and
never cleared by zone/pile mutations.

**Proposed new message ids** (`src/i18n/messages.ts`, `th` first per that
file's rules):

- `settings.farmProfile` — nav entry / section title ("โปรไฟล์ไร่")
- `farmProfile.title`, `farmProfile.back`
- `farmProfile.empty` — empty-state copy
- `farmProfile.addZone`, `farmProfile.zoneNamePlaceholder` (can likely reuse
  `setup.zoneNamePlaceholder` instead of duplicating — decide at
  implementation time)
- `farmProfile.addPile`, plus reuse of `pile.tare` / `pile.stdNet` (already
  exist, used by `setup.tsx` per the 2026-09-01 amendment)
- `farmProfile.removeZone`, `farmProfile.removePile`, `farmProfile.rename`
- `setup.profileOffer` — heading over the prefilled offer ("ใช้โปรไฟล์ไร่
  เดิม?" / "use the saved farm profile?")
- `setup.profileAccept`, `setup.profileReject` — per-zone accept/reject
  actions on the offer
- `setup.profileEditHint` — small note that editing before accepting does
  not change the saved profile (surfaces the no-mutation guarantee to the
  owner, not just to the test suite)

**Open call for whoever implements this**: whether the farm-profile editor
is a section on the existing `src/app/settings.tsx` or its own routed screen
linked from there. `settings.tsx`'s own header frames it as "language and
theme — nothing about a sale," and a farm profile (zones/piles/tares) is a
materially bigger surface than a two-option `Choice` row — closer to
`ZonesCard`'s own complexity than to a theme toggle. Recommend a separate
screen (`src/app/farm-profile.tsx`) linked from a new row on `settings.tsx`,
matching how `PeoplePicker`/people management would presumably also want its
own space rather than growing settings.tsx into a catch-all. Not an
acceptance criterion either way — pick one and note the choice in Dev notes
when this moves to `In Progress`.

**Ambiguity flagged for the owner/dev, not resolved here:**
1. *Per-device or per-farm?* The epic says "stored per device," which this
   story follows literally — profile lives in this device's local store,
   with no farm-selection concept. If one device is ever used to run sales
   for more than one farm, there is no way to hold two profiles or switch
   between them. Out of scope per the epic's own wording, but worth the
   owner confirming that single-farm-per-device is actually the real
   constraint before this ships, since it is not stated as explicitly as
   the "device configuration, not event log" rule is.
2. *Seeding source when multiple past sales exist.* "Seeded from the last
   sale on first use" — this story reads "last" as "most recently *started*"
   sale (by `startedTs`), which could be an in-progress sale, not
   necessarily the most recently *closed* one. Flagging in case the owner
   meant the last *completed* sale specifically; either is a one-line change
   to the seed query once decided.
3. *Partial zones (a zone with a contract but this profile only stores
   piles/tares, not worker/split defaults).* This story deliberately does
   **not** carry `ZoneContract` (worker, split %) into the profile — only
   zone name and its piles' tare/standard net, per the epic's own listed
   scope ("zones, and each zone's usual piles with their tare and standard
   net"). A worker assignment is picked fresh each sale via `PeoplePicker`
   regardless. Confirm this reading is right before implementation — it is
   the one place the epic's prose could be read either way.

## Code review

- Reviewer (separate agent/session):
- Findings:
- Resolution:

## QA notes
