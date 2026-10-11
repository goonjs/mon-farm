# Story: Google login and farm group on the v2 shell (E02-S01 + E02-S02, rework)

Status: Draft — acceptance criteria NOT yet agreed by the owner. Do not start
implementation until they are.

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

## Description

Before anything else renders, the app asks the person to sign in with Google
(web; Android is a stub until E01-S06). A signed-in person with no farm group
sees only "create group" (join-by-code is shown but disabled until E02-S03).
One group means straight in. Every new event carries `actor.userId` and the open
group's `groupId`. Sign-in and the group list persist on the device, so after the
first sign-in the app opens offline.

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

- [ ] First launch, not signed in: only the sign-in screen shows; nothing can be
      saved (ACC-6). It matches flow-v1 screen 1: mark, "เข้าสู่ระบบด้วย Google",
      and the note that the first sign-in needs internet.
- [ ] First launch offline: a Thai message says the first sign-in needs internet.
- [ ] Google sign-in works on web against the real project on the dev site, and
      against the Auth emulator in tests (ACC-1). Android is out of scope (E01-S06).
- [ ] The same Google account on two devices gives the same `userId`; the user
      model keeps the linked sign-in identities apart from `userId`.
- [ ] After the first sign-in, closing and reopening the app in airplane mode
      does not ask to sign in again; the session is stored on the device, not in
      memory.
- [ ] No sign-out button (D-23). All text in Thai (D-20).
- [ ] An expired token while offline never blocks saving.

Group (E02-S02):

- [ ] Signed in with no group: only "create group" (name required) and a disabled
      "join with code" (E02-S03). Creating works offline: the id is made on the
      device, the creator gets an `owner` membership, and a `create_group` op is
      queued for the outbox (E01-S09).
- [ ] One group on the device (for this user): the app opens straight into it,
      with no picker (ACC-3). Two or more groups: picker is E02-S04.
- [ ] Every new event has `groupId` and `actor.userId` from the first one; an
      append without a group fails with `NoGroupError` and stores nothing (D-24).
- [ ] Memberships and queued ops live in IndexedDB on web (`memberships`,
      `pendingOps`, one transaction per create) and survive reload.
- [ ] Rules: the creator can write the group and their own membership only.

## Open design question (needs the owner or the lead before coding)

PR #67 made `groupId` required on `EventBase` and stamped it in
`src/store/record.ts`. On `dev` the v2 farm, people and money screens write
through their own stores (`farm.ts`, `people.ts`, `finance*.ts`, `master-store.ts`)
as well as the sale event log. The first implementation task is to list every
write path and decide, per store, how it gets `groupId`:

- **A (recommended):** one session-level `sessionGroupId()`, stamped in each
  store's single write function, so no screen changes. The root gate guarantees a
  group exists before any screen renders.
- **B:** pass `groupId` explicitly through every v2 write. More explicit, touches
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

- [ ] Vitest: user identity linking; group entry decision (0 → create, 1 → in,
      2+ → pick); an append with no group fails and stores nothing; `groupId` and
      `actor.userId` present on events from every store from the design question.
- [ ] jest-expo: sign-in screen states (signed out, offline first launch, error);
      group start (empty name, create, offline create); the gate shows nothing
      else before sign-in.
- [ ] Rules tests on the emulator: creator writes group + own membership only.
- [ ] Playwright with the Auth emulator: sign in, create group, reload offline,
      still inside; screenshots of both screens, light and dark.
- [ ] `npm run verify` green; independent review by a separate agent.

## Not covered

Android sign-in (E01-S06), join by code (E02-S03), group picker and leave
(E02-S04), LINE, sync of the group to Firestore (E01-S09), fetching existing
groups on a new device (needs a backend), PR previews (no real Firebase config
in the shared bundle).

## Questions for the owner

1. Option A or B for `groupId` (above)?
2. Single preview site: you plan to use `mon-farm-preview` for all agents'
   previews. For login to work there, that site's build needs the real config;
   that is a CI change (a separate preview build) — in this story or its own?
3. Accept the rule that the first sign-in on a new device with an existing group
   can create a second group until fetch-from-server exists (E02-S03/S04)?

## Verification

## Dev notes

## Code review

## QA notes
