# Story: Google login and farm group on the v2 shell (E02-S01 + E02-S02, rework)

Status: Draft — owner answers of 2026-10-11 are recorded below (option A, skip
login, no second group). Acceptance criteria are still NOT agreed as a whole; do
not start implementation until the owner says so.

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

## Owner decisions (2026-10-11)

- **Login is not the priority now; prepare for it.** The app must keep working
  fully offline with no sign-in: there is a **skip login** path (offline-only
  mode). This relaxes the 2026-10-03 answer "must sign in before first use" in
  E02-S01; the PRD needs a new D-entry for it (ACC-1/ACC-6 wording) in the same
  session the owner confirms this story.
- `groupId` option **A** (one session-level group id stamped in each store's write
  function, no screen changes).
- No second group.
- PR previews stay on the existing `mon-farm-dev` site channels (no separate
  preview site or build); add a CI change only if a later story needs it.

## Description

Two phases. **Phase 1 (now): offline-only mode.** The app runs as it does today,
with no visible gate. Behind the scenes the device has a local user (`userId`
made on the device) and one local group created silently on first launch, so every
event carries `actor.userId` and `groupId` (D-24) without any sign-in.
**Phase 2 (later, not the priority): Google sign-in.** A sign-in screen with a
"skip" button that goes to offline-only mode; signing in links the Google identity
to the existing local user, so nothing recorded offline is lost or duplicated.
With sign-in, a person with no group sees "create group" (join-by-code disabled
until E02-S03); one group means straight in.

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

Offline-only mode (Phase 1 — this is what is built first):

- [ ] First launch on a device creates a local user and one local group (name
      default, e.g. "กลุ่มฟาร์มของฉัน"), both stored on the device. No screen
      appears; the app opens on the splash and home as today.
- [ ] Every new event from every v2 store (sale, farm, people, money) carries
      `actor.userId` and `groupId`; the screens do not change (option A).
- [ ] A write with no open group fails with `NoGroupError` and stores nothing.
- [ ] The local user and group survive reload, force-close and airplane mode.
- [ ] Nothing in this mode needs the network or Firebase config.

Sign-in (E02-S01) — Phase 2, written now so Phase 1 does not block it:

- [ ] First launch, not signed in: the sign-in screen shows, with "เข้าสู่ระบบด้วย
      Google" and a **skip** button that continues in offline-only mode. It
      follows flow-v1 screen 1 plus the skip button (needs a mockup update).
- [ ] Signing in later links the Google identity to the existing local user; the
      `userId` and all earlier events keep working under it (open question 2).
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

- [ ] The silent local group of Phase 1 is a normal group: the creator is its
      `owner` membership, and a `create_group` op is queued for the outbox
      (E01-S09) so it syncs once a user signs in.
- [ ] One group on the device: the app opens straight into it, with no picker
      (ACC-3). No second group can be created in this story; the picker and a
      second group are E02-S04.
- [ ] Every new event has `groupId` and `actor.userId` from the first one; an
      append without a group fails with `NoGroupError` and stores nothing (D-24).
- [ ] Memberships and queued ops live in IndexedDB on web (`memberships`,
      `pendingOps`, one transaction per create) and survive reload.
- [ ] Rules: the creator can write the group and their own membership only.

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

Android sign-in (E01-S06), join by code (E02-S03), group picker, second group and
leave (E02-S04), LINE, sync of the group to Firestore (E01-S09), fetching existing
groups on a new device (needs a backend), PR previews with real Firebase config
(previews stay on the dev site without it).

## Questions for the owner

1. Phase 1 shows no new screen at all (the app opens as today). Is that right, or
   do you want the sign-in screen with the skip button visible from the start?
2. When a person who has recorded data offline later signs in with an account that
   already has a group on another device, what should happen to the offline data?
   Proposal: it stays in its own local group, shown beside the other group once the
   picker exists (E02-S04); nothing is merged automatically.

## Verification

## Dev notes

## Code review

## QA notes
