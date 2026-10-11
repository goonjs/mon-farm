# Story: People store, adapters, and a picker

Status: **Review** — implemented 2026-08-10. Cannot reach `Done` without a
push to CI and an independent review, neither authorized.

## Context

- Epic: `docs/epics/e03-master-data.md`
- Related PRD section(s): FR-1 (partial — the smallest possible slice: id + name)
- Depends on: S15 (per-zone contracts reference `PersonId`)
- Owner feedback that prompted this story: worker identity should be a
  reusable people list, not free text typed on every zone.

## Description

A worker outlives a sale, so people cannot live inside one sale's event log
the way piles and zones do. This adds a second store (`src/store/people.ts`,
same port/adapter shape as `EventStore`), native (expo-sqlite, sharing the
event log's database file, its own table) and web (localStorage) adapters, and
a `PeoplePicker` component that lists active people, lets one be selected, or
creates and selects a new one inline.

Archive, never delete: a person referenced by a past settlement must stay
resolvable even after they stop appearing in future pickers.

## Acceptance criteria

- [x] `PeopleStore.list()` returns active people only, alphabetical (Thai
      collation).
- [x] `create()` assigns an id and a creation timestamp.
- [x] `rename()` changes the name, keeps the id.
- [x] `archive()` removes a person from `list()` but `get()` still resolves
      them, with their name intact.
- [x] `rename`/`archive` on an unknown id is a no-op, not an error.
- [x] `PeoplePicker` shows an empty state, lists people, selecting one calls
      `onChange`, typing a name and confirming creates-then-selects in one
      step, and "change" clears the selection (`onChange(null)`).
- [x] Native and web adapters both implement `PeopleStore` against the same
      interface; native shares `mon-farm.db` with the events table via its own
      `people` table.

## Offline / sync behavior

Local-only, same as the event store. No `synced_at` column on `people` yet —
sync for this table is undesigned, same as for events (see
`docs/architecture.md` §Sync engine).

## Test plan

- [x] 6 Vitest cases for `MemoryPeopleStore`: empty start, create, alphabetical
      listing, rename, archive-hides-but-resolves, no-op on unknown id.
- [x] 4 jest-expo cases for `PeoplePicker`, against a mocked `peopleStore`.

## Verification

- [x] `npm run verify` green: 46 core tests (40 + 6 new), 10 component tests
      (6 + 4 new), 24 e2e unchanged.
- [ ] **Never run on a device.** The native adapter (`people.native.ts`) is
      written and typed but unexercised, same caveat as `store.native.ts`
      from S5.
- [ ] `PeoplePicker` is not wired into any real screen yet — that's S6.

## Dev notes

**Two bugs found and fixed while building this, both about module resolution
for the `.native.ts`/`.web.ts` split**, worth recording since they'll bite
again the next time this pattern is copied:

1. **`SaleProvider.tsx` imported `from './store.web'` literally**, not the
   platform-resolvable bare `./store`. On a native build this would have
   silently pulled in the *web* (localStorage) adapter instead of the durable
   SQLite one — exactly the failure mode NFR-1 exists to prevent, and it would
   never have surfaced until someone actually ran the app on a device, which
   per S5's own notes has never happened. Fixed to `from './store'`.

2. **`tsc --noEmit` cannot resolve a bare platform-split import at all** — the
   base file (`store.ts` / `people.ts`) has no runtime implementation, only
   `store.native.ts`/`store.web.ts` do, and `moduleSuffixes` only supports one
   fixed suffix per compilation, not Metro's "try each platform and fall
   back". Fixed with an `export declare const store: EventStore;` /
   `peopleStore: PeopleStore` ambient declaration in each base file — type-only,
   erased, never emitted (the project builds with `noEmit`), but enough for
   project-wide `tsc` to resolve the name.

3. **jest-expo applies the same platform resolution *inside*
   `jest.requireActual`**, which is not obvious and cost real debugging time:
   a test's `jest.requireActual('../store/people')` under Jest returns
   `people.native.ts`'s exports, not the base file's — so `MemoryPeopleStore`
   (defined in the base file) is invisible that way. Fixed by moving
   `MemoryPeopleStore` into its own file, `people-memory.ts`, with no platform
   siblings to be shadowed by; `people.ts` re-exports it for Vitest and any
   plain script, and Jest-based tests import the class from
   `people-memory.ts` directly.

4. **A `jest.mock()` factory referencing an outer `const` is fragile**: `jest.mock`
   calls are hoisted above every import in the file, so an outer
   `const mockStore = new MemoryPeopleStore()` can still be unassigned at the
   moment the factory actually runs (triggered by an unrelated import earlier
   in the hoisted order). Fixed by constructing the mock instance *inside* the
   factory and re-importing it back out (`peopleStore as mockStore`) rather
   than capturing an outer variable by reference.

## Code review

- Reviewer (separate agent/session): **not yet run** — required before `Done`.

## QA notes

ID generation (`src/lib/id.ts`) is deliberately not a UUID library: this app
is single-device, so ids only need to be unique within one device's storage.
Reach for a real UUID library only once sync exists and two devices can create
records independently of each other.
