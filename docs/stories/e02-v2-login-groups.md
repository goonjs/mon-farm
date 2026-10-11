# Story: Google login and farm group on the v2 shell (E02-S01 + E02-S02, rework)

Status: Review — owner accepted the story and said to proceed (2026-10-11).
Built; waiting for the independent code review and CI.

## Context

- Epic: `docs/epics/e02-access-farm-groups.md`
- Replaces: draft PR #67 (`feature/e02-groups`), built on the v1 UI that D-83
  deleted. Stories `e02-s01-google-login.md` and `e02-s02-create-farm-group.md`
  keep their agreed behaviour (ACC-1/3/4/5/6, D-23, D-24, D-2); this story only
  changes how it is built on v2. When this story is agreed, those two files get
  a one-line pointer here.
- Mockups: `docs/ux/mockups/flow-v1.html` screen 1 (เข้าสู่ระบบ) and screen 2
  (เลือก/สร้างกลุ่มฟาร์ม); flow text in `docs/ux/flows/e02-access-and-sync-states.md`
  §1–3. Where they differ from `flow-farm-v1.1.0.html`, v1.1.0 wins.
- Firebase is configured (2026-10-11): Google provider on, web app registered,
  authorized domains set, public web config passed to the dev and prod deploy
  builds (`chore/firebase-web-config`). See `docs/runbooks/firebase-setup.md`.
- Import rule: new screens use only `src/ui` and tokens (`docs/ui-v2.md`).

## Owner decisions (2026-10-11, final)

- **Do Google login now. No skip button, no offline-only mode.** (An earlier draft
  of this story added a skip path; the owner withdrew it the same day.) The
  2026-10-03 answers in E02-S01 stand: sign in before first use, first sign-in
  needs internet.
- `groupId` option **A** (one session-level group id stamped in each store's write
  function, no screen changes).
- No second group in this story.
- Preview: ordinary PR previews stay on the `mon-farm-dev` channels (they have no
  real Firebase config, so login does not work there). A new CI job deploys one
  chosen PR to the single site `mon-farm-preview` with the real config, so login
  can be tried there. That CI job is its own story/PR, not part of this one.

## Description

Before anything else renders, the app asks the person to sign in with Google
(web; Android is a stub until E01-S06). A signed-in person with no farm group sees
only "create group" (join-by-code is shown but disabled until E02-S03). One group
means straight in. Every new event carries `actor.userId` and the open group's
`groupId`. Sign-in and the group list persist on the device, so after the first
sign-in the app opens offline.

## What is reused from PR #67 and what is dropped

Reuse (logic and docs, no old UI): `src/auth/*` (port, web popup adapter, native
stub, error mapping), `src/core/user.ts`, `group.ts`, `scope.ts` (and their
tests), the account store (`src/store/account*.ts`, `idb.ts`, `session.ts`), the
rules tests, the `firebase.json` auth emulator entry, and the story/architecture
notes. Port them onto current `dev` by cherry-picking, not by merging the branch.

Drop: `LoginScreen`, `GroupStartScreen`, `AccountGate` (all v1 components), the v1
test and e2e changes, the old `_layout.tsx` change, and the screenshots. New
screens are written fresh in `src/ui` + `src/app` (v2).

## Acceptance criteria

Sign-in (E02-S01):

- [x] First launch, not signed in: only the sign-in screen shows; nothing can be
      saved (ACC-6). It matches flow-v1 screen 1: mark, "เข้าสู่ระบบด้วย Google",
      and the note that the first sign-in needs internet.
- [x] First launch offline: a Thai message says the first sign-in needs internet.
- [ ] Google sign-in works on web against the real project on the dev site, and
      against the Auth emulator in tests (ACC-1). Android is out of scope (E01-S06).
- [ ] The same Google account on two devices gives the same `userId`; the user
      model keeps the linked sign-in identities apart from `userId`.
- [x] After the first sign-in, closing and reopening the app in airplane mode
      does not ask to sign in again; the session is stored on the device, not in
      memory.
- [x] No sign-out button (D-23). All text in Thai (D-20).
- [x] An expired token while offline never blocks saving.

Group (E02-S02):

- [x] Signed in with no group: only "create group" (name required) and a disabled
      "join with code" (E02-S03). Creating works offline: the id is made on the
      device, the creator gets an `owner` membership, and a `create_group` op is
      queued for the outbox (E01-S09).
- [x] One group on the device: the app opens straight into it, with no picker
      (ACC-3). No second group can be created in this story; the picker and a
      second group are E02-S04.
- [x] Every new event has `groupId` and `actor.userId` from the first one; an
      append without a group fails with `NoGroupError` and stores nothing (D-24).
- [x] Memberships and queued ops live in IndexedDB on web (`memberships`,
      `pendingOps`, one transaction per create) and survive reload.
- [x] Rules: the creator can write the group and their own membership only.

## Design question (decided: option A — owner, 2026-10-11)

PR #67 made `groupId` required on `EventBase` and stamped it in
`src/store/record.ts`. On `dev` the v2 farm, people and money screens write
through their own stores (`farm.ts`, `people.ts`, `finance*.ts`, `master-store.ts`)
as well as the sale event log. The first implementation task is to list every
write path and decide, per store, how it gets `groupId`:

- **A (chosen):** one session-level `sessionGroupId()`, stamped in each
  store's single write function, so no screen changes. The root gate guarantees a
  group exists before any screen renders.
- **B (rejected):** pass `groupId` explicitly through every v2 write. More explicit, touches
  all screens.

Events already on a dev device without `groupId` stay readable but are never
synced (as in #67); dev data only.

## Offline / sync behaviour

- Internet is needed only for the first sign-in. After that everything works
  offline (ACC-6).
- The new group and membership sync through the outbox once E01-S09 lands; until
  then the op stays in the local queue.
- IndexedDB moves to v2 (adds stores only). A browser that opened v2 cannot go
  back to a v1 build.

## Test plan (tests first)

- [x] Vitest: user identity linking; group entry decision (0 → create, 1 → in,
      2+ → pick); an append with no group fails and stores nothing; `groupId` and
      `actor.userId` present on events from every store from the design question.
- [x] jest-expo: sign-in screen states (signed out, offline first launch, error);
      group start (empty name, create, offline create); the gate shows nothing
      else before sign-in.
- [x] Rules tests on the emulator: creator writes group + own membership only.
- [ ] Playwright with the Auth emulator: sign in, create group, reload offline,
      still inside; screenshots of both screens, light and dark.
- [x] `npm run verify` green; independent review by a separate agent.

## Not covered

Android sign-in (E01-S06), join by code (E02-S03), group picker, second group and
leave (E02-S04), LINE, sync of the group to Firestore (E01-S09), fetching existing
groups on a new device (needs a backend), PR previews with real Firebase config
(previews stay on the dev site without it).

## Questions for the owner

Both answered by the owner's go-ahead on 2026-10-11: criteria agreed; e2e uses a
preloaded session, and the real Google login is tried by hand on
`mon-farm-dev.web.app` and `mon-farm-preview.web.app`.

## Verification

Local run, 2026-10-11: `tokens:check`, `contrast`, `typecheck`, `lint` clean;
Vitest 745, jest-expo 316, rules tests on the Firestore emulator 60 (incl. the
`create_group` batch), `build:web`, Playwright (phone-portrait) 17 passed incl.
`e2e/v2-account.spec.ts`. Screenshots: `docs/ux/screenshots/ui-v2/account/`.

Not seen to pass: `e2e/auth-emulator.spec.ts` (popup against the Auth emulator).
The SDK loads `apis.google.com`, which this sandbox blocks (proxy 403). Real
Google login is still to be tried by hand on the dev and preview sites.
Dark screenshots are not taken: the app cannot switch to dark yet.

## Dev notes

- Option A as decided: `groupId` and `actor.userId` come from `store/session.ts`
  in `record.ts` (`stamp`/`writerNow`), `MasterStore.append` and `writeFinance`.
  The farm profile (`farm.*.ts`) is device config, not events: not stamped.
  `EventBase` and `FinanceEvent` require `groupId`; `checkAppend` and the
  finance append rule refuse a groupless event.
- Events already on a dev device without `groupId` stay readable; the sync
  engine's push skips them (never sent).
- Group start is one screen (name field + create, disabled join), not the
  flow doc's separate "create" page: simpler, same behaviour.
- `jest.setup.js` signs a test user into group `group-1` before each test; gate
  tests clear it. e2e specs start from a preloaded session (`e2e/session.ts`).
- `v2-store.spec` "without IndexedDB" now expects the sign-in screen with the
  storage warning: with no IndexedDB there is no stored session.
- IndexedDB is v2 (`idb.ts`, shared by the event and account stores).

## Code review

Two independent reviewers (separate agents, 2026-10-11): data layer and auth/UI.
Verdicts: data layer ready to merge for this scope; auth/UI fix first, small. The
three boxes above are unticked because nothing observed them: the real popup
login was never run (sandbox blocks `apis.google.com`), `e2e/auth-emulator.spec.ts`
never passed, and the two-devices `userId` claim has no test through the auth
path. Try the popup by hand on `mon-farm-preview.web.app` (workflow
`preview-site.yml`, PR number) and `mon-farm-dev.web.app`, then tick them.

Known gaps, not fixed in this PR:

- Sync pushes by "has a `groupId`", not "belongs to the signed-in user and a
  group they belong to"; pending ops (`create_group`) are not ordered before
  events, and the pending badge counts all groups and users. Safe today (no real
  remote, rules reject mismatches); must be solved with the outbox (E01-S09).
- Local events from before this change (no `groupId`, `actor.userId` `pre-login`)
  are neither migrated nor isolated: never pushed, never lost, but still visible,
  and a later edit of an old sale is stamped with the current group. Dev devices
  only; decide "abandon old local data" or an adopt step before real users.
- Builds without Google sign-in (Android, Expo Go, previews without Firebase
  config) show the generic "sign-in failed, try again"; a distinct "not available
  on this build" message is still to do.
- The opening state has no timeout (a blocked IndexedDB upgrade would leave the
  mark showing); the group that opens with several memberships is the first in
  store order, not sorted; a failed `saveUser` after a good popup shows
  "sign-in failed"; no screenshots for the busy, popup-blocked, failed and
  create-failed states.
- `MasterStore.append` takes a `deviceSeq` before it checks the user (a gap, harmless).
  `SaleProvider` captures the writer at mount (revisit when E02-S04 adds switching).

## QA notes
