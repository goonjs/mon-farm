# Story E02-S05: เข้าบัญชีเดิมบนเครื่องใหม่ → ดึงกลุ่มฟาร์มเดิมจากเซิร์ฟเวอร์

Status: Review (built; waiting for the independent code review and CI)

> Bug found by the owner on the dev site (2026-10-11): created a farm group in one
> browser, signed in with the same Google account in an incognito window, and the
> app asked to create a new group instead of showing the existing one. Creating a
> second group splits the farm's data, so this is fixed before anything else.

## Context

- Epic: `docs/epics/e02-access-farm-groups.md`
- PRD: ACC-3, ACC-6, D-23, D-24, D-3
- Flow: `docs/ux/flows/e02-access-and-sync-states.md` §1.1 (already decides the
  behaviour; this story builds it)
- Architecture: "การดำเนินการด้านสมาชิกภาพ" (refresh the group list: collection-group
  query on `members` with `uid == me`, then read `groups/{gid}`)
- Builds on: `e02-v2-login-groups.md` (the gate; its `signIn()` carried the note
  "needs the backend"), E01-S09 (sync engine, `FirestoreRemote`), E01-S08 (rules)
- Closes the gap noted in architecture §membership ("not yet built: first login on a
  new device → fetch the group list from the server")

## Root cause

`AccountGate.signIn()` only read the groups kept on this device
(`accounts.memberships()`). A new device has none, so a returning member was sent to
the create-group screen. The backend now exists, so the gate can ask it.

## Description

After sign-in, or on opening the app with a signed-in user who has no group on the
device, the gate asks the server for this user's groups before it decides where to go.
Found groups are kept on the device and the first one opens; sync's first pull then
brings the group's data. Only a *confirmed* "no groups" shows create-group. If the
server cannot be asked, the app says so and offers retry; it never presents
create-group as if the user had no farm.

## Decision on the offline case (PRD decides; nothing new invented)

D-23 says the first sign-in needs internet, so a device that is signing in has a
network at that moment. flow §1.1 already says the create button is **not shown until
the result is known**. We follow that: when the check fails (offline, timeout,
permission or other error) the screen shows `ดึงรายการกลุ่มไม่สำเร็จ — ต่อเน็ตแล้วลองอีกครั้ง`
with `[ลองอีกครั้ง]` and **no** way to create a group. This is the safest option: a
wrongly created second group is the one outcome that cannot be undone from the app
(no group delete, no merge in MVP).
Owner question (non-blocking): if a person truly cannot get online after signing in,
should there be an explicit "create a new group anyway" choice? Not built (YAGNI,
and it contradicts §1.1) until the owner asks.

A build with no sync at all (no Firebase config / platform without an adapter,
`connect` resolves `null`) has no server to ask; it behaves as before (local
memberships only), because there is nothing to split.

## Acceptance criteria

- [x] AC1 Signing in on a device with no local membership for this user shows
      `กำลังดึงรายการกลุ่มฟาร์มของคุณ…` and asks the server for the user's groups
      (not another account's) before showing anything else.
- [x] AC2 One group found → it is stored on the device (id, name, role) and the app
      enters it, with no create-group screen at any point.
- [x] AC3 Several groups found → all are stored; the first (oldest id) opens, as
      today, until the picker of E02-S04.
- [x] AC4 Nothing found (server answered) → create-group screen, as today.
- [x] AC5 The check is bounded to 10 s. Offline, timeout, unauthenticated,
      permission or any other error → the failed state with `[ลองอีกครั้ง]`; no
      create-group; retry runs the check again and can succeed.
- [x] AC6 Opening the app with a signed-in user who still has no group on the device
      (the check never finished) repeats the check, so a closed tab cannot lead to a
      second group either.
- [x] AC7 A device that already has a membership for the user goes straight in,
      offline, and never waits on the network for the decision (ACC-6). Another
      account's groups on the device do not count.
- [x] AC8 After the restored group opens, sync pulls its events (no local
      `create_group` op exists): the points wizard waits for the first pull, and the
      data appears (proved on the emulator, e2e).
- [x] AC9 Rules: a signed-in user can list only their own `members` documents
      across groups (already true; the existing rules tests are kept and one is added
      for reading the group doc after listing). No rules or index change.

## Offline / sync behavior

- Only the *first* decision on a new device needs the network; everything after it is
  local (ACC-6, D-23).
- The check reads from the server (`getDocsFromServer` / `getDocFromServer`), never
  the SDK cache.
- Membership rows written by the restore are idempotent (`groupId` is the key), so a
  repeat or a second tab cannot duplicate them. No `create_group` op is queued: the
  group already exists on the server.
- Failure leaves the device with the user saved and no membership: a consistent,
  retryable state (AC5, AC6). Sync does not start until a group is open.
- Offline-sync checklist: filled in under QA notes.

## Test plan (tests first)

- [x] Vitest: `FirestoreMemberships` against a fake layer (lists own groups with
      names, sorts, skips nothing silently, maps errors, group doc missing → error).
- [x] Vitest: `FakeRemote` member lookup returns only the user's groups.
- [x] Vitest: account store `saveMemberships` (memory + IndexedDB): idempotent, keeps
      other users' rows.
- [x] Jest (account gate, fake lookup): AC1–AC7, including cold start offline never
      calls the lookup, timeout at 10 s, retry, second user on the device.
- [x] Vitest: first-pull gate is `waiting` for a restored group (no pending op, cursor 0).
- [x] Rules test on the emulator: list own memberships, then read each `groups/{gid}`.
- [x] Playwright against the emulators (`E2E_SYNC_EMULATOR`): member created in
      one browser context, a second context with an empty profile signs in as the same
      uid → enters the group and the group's data appears; screenshots.

## Owner steps

None for this change: `firestore.rules` and `firestore.indexes.json` are unchanged
(the collection-group rule and the `members.uid` collection-group index are already
in the repo from E01-S08). **If** they were not deployed to `(default)` the check will
fail with the retry state; the PR body gives the command to confirm.

## Verification

See QA notes.

## Dev notes

- New port `RemoteMemberships` (`src/sync/remote.ts`) and
  `connectMemberships(userId)` (`client.*`), separate from the per-group
  `connectRemote`, because the lookup happens before any group is open.
- `AccountStore.saveMemberships` is an upsert by `groupId`.

## Code review

(pending: independent reviewer)

## QA notes

- Gates run: `tsc --noEmit`, `eslint` (one exhaustive-deps warning in the gate, same pattern as
  before), vitest 901 pass, jest 393 pass, `npm run test:rules` 80 pass (emulator, incl. real-SDK
  restore in `firestore/sync.test.ts`), Playwright on the emulators: `sync-restore`, `sync-emulator`,
  `sync-wizard` pass; `v2-account` (no backend build) passes.
- Screenshots (real run on the emulators): `docs/ux/screenshots/ui-v2/account/03-fetching-groups.png`,
  `04-fetching-groups-failed.png`, `05-restored-group-data.png`.
- Not covered: the Google popup path in the browser (the sign-in spec cannot run in the sandbox;
  proven in the gate's jest tests instead); native/Android (no sync adapter yet); the picker for
  2+ groups (E02-S04).
- `sync-emulator.spec.ts` changed: with no Firebase session the app now shows the failed-check
  state instead of create-group (that is the fix); it asserts that, then installs the session.
- First-pull path for a restored group: no code change needed. `firstPullGate` waits (cursor 0, no
  pending op) and the engine pulls (engine test + emulator test + e2e).
- Tests were written before the implementation but not run red separately.

### Offline / sync checklist

- [x] Usable with no network: a device with the membership goes in with no lookup (AC7, jest).
- [x] Offline writes: unchanged (outbox).
- [x] Sync on reconnect: unchanged; the check retry is a user action with explicit text.
- [x] Failed check shows a retry (AC5).
- [x] No conflict handling involved: membership rows are upserts by group id.
- [x] Failed check leaves the user saved and no membership: consistent and retryable.
- [x] Visibility: fetching and could-not-fetch screens.
- [x] No data loss: nothing is created or discarded when the check fails.
