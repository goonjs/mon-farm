# Story E01-S09: sync อัตโนมัติ — outbox ส่งขึ้น + ดึงลง

Status: Review (built; waiting for the independent review, CI, and the owner's check on the real database)

## Context

- Epic: `docs/epics/e01-foundation-sync.md`
- PRD: SYNC-1, SYNC-2, SYNC-4, NFR-2 · D-3
- Architecture: "2026-10-02 — Direction" แถว *Sync unit*, *Pending Sync*; E01-S01
- ขึ้นกับ: E01-S03, E01-S08, E02-S01 (login), E02-S02 (มี group id)

## คำอธิบาย

sync engine หลัง port (`RemoteEvents`): ส่ง `pending()` ขึ้น Firestore แล้ว `markSynced`, ฟัง snapshot ของกลุ่ม
แล้วเก็บ event ของเครื่องอื่นลง store แบบ idempotent — store ในเครื่องเป็นเจ้าของความคงทน ไม่ใช่ cache ของ Firestore

## Acceptance criteria

- [x] บันทึกตอนออฟไลน์ใช้ได้ทันที และอยู่ใน outbox (SYNC-1) — เห็นใน Playwright กับ emulator: ตัดเน็ต → บันทึกคน → เหตุการณ์ค้าง `pending=1` ใน IndexedDB
- [x] เน็ตกลับมา → ส่งขึ้นเองโดยไม่มีปุ่ม Sync (SYNC-2, D-3) — เห็นใน Playwright กับ emulator: เปิดเน็ต → outbox ว่าง, เอกสารบน emulator ตรงกับในเครื่อง (ไม่ได้ลองกับฐานข้อมูลจริง)
- [x] ส่งล้มเหลว → ลองใหม่อัตโนมัติแบบ backoff; ข้อมูลในเครื่องไม่ถูกลบหรือแก้ (SYNC-2) — Vitest (fake remote) + emulator (ack หาย, ตัดเน็ตแล้วเปิดใหม่, ไม่มี session Firebase ได้ `unauthenticated` ชั่วคราว)
- [x] event จากเครื่องอื่นในกลุ่มลงมาเก็บในเครื่อง; ดึงซ้ำไม่เกิด event ซ้ำ — emulator: สองเครื่อง ดึงสองรอบ เนื้อหาเหมือนที่ส่ง
- [ ] เข่ง/รายการต่างกันจาก 3 เครื่องรวมเป็นชุดเดียวโดยไม่ถาม (SYNC-4) — เห็นกับ **2** เครื่องบน emulator (รวมครบทั้งคู่); 3 เครื่องไม่ได้รัน
- [ ] force-close ระหว่างส่ง → เปิดใหม่ส่งต่อได้ ไม่หาย ไม่ซ้ำ (NFR-2) — จำลองด้วย ack หาย + engine ใหม่บน store เดิม (Vitest, emulator); ไม่ได้ kill process จริง

## Offline / sync behavior

- ออฟไลน์เป็นโหมดหลัก; sync เริ่มเองเมื่อมีเน็ต และเมื่อเปิดแอป
- ส่งไม่เป็นลำดับ/ส่งซ้ำได้ปลอดภัย (create-only + id ไม่ซ้ำ)
- การแก้ที่ขัดกันยังไม่ตรวจใน story นี้ → E01-S11

## Test plan

- [x] Vitest: sync engine กับ fake remote — ส่ง, ล้มเหลว + retry, ดึงซ้ำ, ลำดับสลับ (+ scope, create_group ก่อน event, adapter/error mapping กับ fake Firestore layer)
- [x] integration บน emulator: 2 client เขียนคนละเข่ง → ทั้งสองเห็นครบ (`firestore/sync.test.ts`, รันด้วย `npm run test:rules`)
- [x] Playwright: `setOffline(true)` → บันทึก → online → outbox ว่าง (`e2e/sync-emulator.spec.ts`, `npm run test:e2e:sync`) — เห็นผ่านในเครื่องนี้ **ไม่ได้รันใน CI** (ข้ามเมื่อไม่ตั้ง `E2E_SYNC_EMULATOR`; ต่อเข้า CI = follow-up) จึงไม่ใช่การรับประกันของ CI; session Firebase ใส่ผ่าน Auth emulator ไม่ได้ผ่านป๊อปอัป Google (sandbox บล็อก apis.google.com); ไม่ได้นับเข่ง แต่บันทึกคน

## Verification

Run 2026-10-11 in the sandbox, all against the **emulators** (nothing touched the real project):

- `tsc`, `eslint .` clean; Vitest 815 passed (70 files); jest 348 passed (37 suites, run twice); emulator tests 73 (60 rules + 13 sync).
- `npm run test:rules` (Firestore emulator): rules tests + `firestore/sync.test.ts` (13): two phones all baskets on both; same bytes back;
  `receivedAt` from the server clock; ack lost → retry finds it, nothing twice; a clone re-sending is a no-op; same id with different
  content → integrity error and not overwritten; non-member → `denied`, events kept; `create_group` before events (the other order is
  refused by the rules); create_group ack lost → resent safely; a taken group id → refused; other group's / other user's events never
  sent; network cut then back (the SDK's own queued write lands, the engine's retry recognises it).
- **Not run in CI:** `e2e/sync-emulator.spec.ts` and `e2e/sync-wizard.spec.ts` are skipped unless `E2E_SYNC_EMULATOR` is set (`npm run test:e2e:sync`), and CI does not set it. Only the emulator Vitest tests (`npm run test:rules`) run in CI. What follows was seen on this machine.
- `e2e/sync-emulator.spec.ts` (Chromium, Firestore + Auth emulators, rules loaded, build with `EXPO_PUBLIC_FIREBASE_*_EMULATOR_HOST`):
  a new group reaches the server by itself; offline a person is recorded and waits; back online it is sent and the outbox empties;
  the documents on the server are exactly the local events. Existing Playwright suite (phone-portrait, after a clean build): 19 passed, 3 skipped (the two emulator specs and the mockup compare).

**Not seen:** the real Firestore `(default)` database and the deployed rules were not exercised (no cloud access by design); real
Google sign-in; a real force-close; three devices; Android (the native client is not built).

## Not covered

Real Firestore `(default)` database and deployed rules not yet exercised; Android/native sync (E01-S06); a retry button and conflict UI
(E01-S10/S11); finance log, farm profile and media sync; 3-device merge; real force-close.

## Dev notes

### 2026-10-09 (overnight, team INFRA) — engine ส่วนแรก

- สร้างแล้ว: port `RemoteEvents` (`src/sync/remote.ts`), `SyncEngine` (`src/sync/engine.ts`), `FakeRemote`/`FakeServer`
  (rules แบบ create-only), `EventStore.insertPulled` ทั้ง memory / IndexedDB / SQLite (เก็บตามที่ได้รับ ไม่ renumber,
  เป็น synced ทันที, ของเราที่ ack หายถูกเอาออกจาก outbox)
- ทำตาม architecture §Sync engine: batch ≤ 500 ทีละ batch, รอ ack 30 วินาที, `permission-denied` → ส่งทีละตัว + `fetch`
  เทียบ canonical JSON, error ชั่วคราว → backoff 2 วิ → 60 วิ + jitter (แสดงเป็น Pending), error ถาวร → `error` + รอ
  `retry()`, pull ซ้อน 10 นาที, cursor เลื่อนหลังเขียนในเครื่องเสร็จ, doc เสียข้ามแล้วไปต่อ, `poke()` debounce 2 วิ
- Vitest ครอบ AC1–AC6 กับ fake remote (`src/sync/engine.test.ts`) และ contract `insertPulled` ทุก adapter ที่รันได้ใน node
- **ยังไม่ได้ทำ / ติด**: adapter Firestore จริง — rules (E01-S08) ต้องการ envelope (`schema`, `groupId`, `targetId`,
  `payload`, `actor.userId == uid`) ที่ event ในเครื่องยังไม่มี และต้องมี login (E02-S01) + group id (E02-S02) และ
  database `dev` (D-48); ยังไม่ต่อ trigger ในแอป (เปิดแอป / online / AppState) เพราะยังไม่มี remote ให้ต่อ;
  integration บน emulator และ Playwright offline→online รอ adapter
- `insertPulled` บน SQLite ยังไม่ได้รันบนเครื่องจริง (E01-S06)
- **ต้องทำเมื่อต่อ sync (2026-10-10)**: ตัวช่วยตั้งค่าจุดชั่ง (`/v2/points-wizard`) เปิดให้ใช้ซ้ำได้เสมอ และเดิมมี gate
  `showStarterButton` (รอ first pull) ที่เอาออกแล้วเพราะยังไม่มี sync — เมื่อมี sync ต้องให้ตัวช่วยรอ first pull ก่อนสร้างจุด
  ไม่งั้นสองเครื่องที่ออฟไลน์อาจสร้าง "จุด 1" ซ้ำกัน
- cursor ของ pull เก็บถาวรใน store (`syncCursor` ใน `meta` ทั้ง IndexedDB และ SQLite ไม่ต้องขึ้น version) ใช้ผ่าน
  `storeCursor(store)` — เปิดแอปใหม่ดึงต่อจากเดิม ไม่ดาวน์โหลดทั้งกลุ่มซ้ำ

### 2026-10-11 — adapter, scope and wiring (feature/e01-s09-firestore-sync)

Built: `src/sync/firestore-remote.ts` (envelope mapping both ways, error mapping, idempotent `createGroup`, `whenSignedInAs`),
`firestore-sdk.ts` (the only file on `firebase/firestore`; reads always from the server, SDK cache is memory-only),
`client.web.ts` / `client.native.ts` (native returns null: stays local, Android sync waits for E01-S06), `runtime.ts` + `use-sync.ts`
(started by the account gate once a user is in a group, stopped with it), `append-signal.ts` (web store tells the engine to poke).

Decisions:
- **Envelope.** Local events are not in the architecture's envelope shape yet (E04-S01), so `toEnvelope` moves every field that is not
  an envelope field whole into `payload` (a sys/master event's own `payload` nests inside it), `targetId` = the event's own
  `targetId` or its own id (a create targets itself; restored on the way back only when it differs from the id), `baseEventId` null,
  `receivedAt` = `serverTimestamp()`. Round trip is byte-equal in canonical JSON (tested for every kind the app records).
- **Scope.** An engine serves one user in one group. It sends only events whose `actor.userId` and `groupId` are the session's; the group
  must exist on the server first: the pending `create_group` op is sent and cleared (`AccountStore.completeOp`) before any event, and a
  group whose op cannot be sent sends nothing and pulls nothing. The badge (`useSyncStatus`) counts the same set plus an unsent group.
- **Legacy events with no `groupId`** (and `pre-login` users) are left on the device: never sent, never counted, never deleted. Nothing is
  migrated; the owner decides later whether to adopt or abandon them (E02 known gaps).
- **No Firebase session ≠ denied.** If the SDK has no session for the signed-in user (restore failed, token dropped), the remote answers
  `unauthenticated` (transient, backoff), not `permission-denied`, so the engine does not stop with a false "not allowed".
- **Errors.** Firestore codes map: unavailable / deadline-exceeded / unauthenticated / internal and anything unknown (resource-exhausted,
  aborted, cancelled …) are transient; permission-denied and already-exists are "refused" (engine then compares with the server copy);
  invalid-argument, failed-precondition, not-found (e.g. a missing database), out-of-range, unimplemented are permanent.
- **Permanent errors do not freeze sync.** Every trigger (app open, back online, after a write) runs a full attempt again whatever the last
  state, so once rules are deployed or a membership appears the next trigger recovers on its own; local data is never touched.
  The error state is in `engine.status()`; a visible retry button is E01-S10.
- **Database id** is one env value, `EXPO_PUBLIC_FIREBASE_DATABASE_ID`, default `(default)` (D-84). Sync starts only with a real project
  config or `EXPO_PUBLIC_FIREBASE_FIRESTORE_EMULATOR_HOST`; the e2e/preview builds without config stay local.
- **First pull.** `cursor` 0 = never pulled; a first pull that finds an empty group stores `FIRST_PULL_DONE` (1) so "never pulled" and
  "nothing there" differ. The points wizard's bounded wait on it is described under "fixes after the first independent reviews";
  the cursor is now stored per group.
- Not synced yet: the finance log (`financeStore`), farm profile config and media; they have their own stories. Their writes are not in `EventStore.pending()`.
- `initializeAuth` still gets the popup resolver, which loads `apis.google.com` at launch; whether that can drop a restored session
  offline is **unverified** (the sandbox blocks the host). Worth a look when E01-S10 / the real run happens.
- Expo caches inlined `EXPO_PUBLIC_*` values: a build made after an emulator build kept serving the emulator hosts until `expo export --clear` (the sync e2e script now clears).
- `npm run test:e2e:sync` uses `firebase.e2e.json` (a single Firestore database) because with the multi-database list in `firebase.json`
  the emulator ignores the rules file and allows everything.

### Owner steps for the real database (none done by this work)

1. Rules and indexes are already deployed to `(default)` (2026-10-11, D-84) and `firestore.rules` is **unchanged** by this work. Only if
   they are changed later: `firebase deploy --only 'firestore:(default)' --project mon-farmmate`.
2. Check by hand, once this is on `dev` and deployed to `mon-farm-dev.web.app`: sign in with Google; the group appears under `groups/{id}`
   (with `members/{your uid}`) in the Firebase console → Firestore; record a person or a sale, wait a few seconds, see documents under
   `groups/{id}/events` (envelope: `schema, id, groupId, actor, kind, targetId, payload, receivedAt`); turn the phone to airplane mode,
   record more, turn it off: the new events appear without any button.
3. If nothing appears: the app stays fully usable and the events stay in the outbox. Rules not deployed or a database that does not exist
   show up as an error state in `engine.status()` (no crash, no data loss); fixing it and opening the app again resends everything.
4. Record more than 20 events while offline (the emulator does not enforce the rules' 20 access-call limit, so only the real database
   can show it), go online and confirm they all arrive in `groups/{id}/events`.
5. The first real Google sign-in may be slow or blocked by apis.google.com. If the session does not restore after reopening the app, tell the lead.
6. Note: all builds (dev, preview with config, prod) write to the same `(default)` database until a separate database or project is
   configured via `EXPO_PUBLIC_FIREBASE_DATABASE_ID` (D-84).

### 2026-10-11 — fixes after the first independent reviews (PR #95)

- **Wizard is never a trap.** `first-pull.ts`: waits only while online, trying, and within 20 s; otherwise ready. Ready at once when sync is
  off, the first pull is done, or the group was made on this phone and is not on the server yet. Unavailable (create allowed, plain Thai
  warning, offline and error worded differently) when offline, when the engine is in an error state, or after the grace period. The
  "log for the group is empty" condition from the review was replaced by "the group's `create_group` is still pending": the wizard needs a
  farm and a tapper in the log first, so the log is never empty there, while a group that exists only on this phone has no other phone in it.
  Screenshots: `docs/ux/screenshots/ui-v2/sync/wizard-waiting.png`, `wizard-cannot-sync.png`, `wizard-offline.png` (from `e2e/sync-wizard.spec.ts`).
- **Emulator hosts only for `demo-` projects** (`src/auth/firebase-env.ts`, tested); `build:web` now uses `expo export --clear` because Expo
  kept inlined `EXPO_PUBLIC_*` values between builds.
- **One bad event never wedges the outbox.** Any non-transient batch failure is isolated per event; an event the server calls invalid is
  kept locally, shown as error `invalid`, not re-sent every run (`retry()` tries it again), and the rest are sent and pulling goes on.
- **Fail fast.** `RemoteEvents.check()` reads the group document from the server before any write each run: offline it fails at once
  (no write is queued inside the SDK; seen on the emulator with `disableNetwork`: nothing landed behind the engine's back after
  `enableNetwork`); a missing database (`not-found`) becomes error `invalid`; "not allowed to read the group" is not a failure there.
  **Unverified:** a non-existent database id against the emulator (the emulator ignores database ids), so the missing-database path is
  tested only with a fake remote.
- **The badge shows errors** (`error` state of the sync pill, existing word "ส่งไม่สำเร็จ", reject tone); no retry UI (E01-S10).
- **Cursor per group** (`syncCursor(groupId)`): stored with its group; another group reads 0; an old unscoped cursor reads as 0 (one safe,
  idempotent re-download). One slot: switching groups back and forth re-downloads.
- **Paged pull**: 500 per page with a position token (the documents of one batch share a stamp), cursor moves after each page, 60 s per
  page, overlap 2 minutes (stamps are commit times; only two commits finishing out of order need covering).
- `stop()` halts an in-flight run (no more runs, pulls, `onPulled` or status events); `emitSyncChanged` isolates listener failures.

### Known gaps (not fixed here, by decision)

- `initializeAuth` still gets the popup resolver, which loads apis.google.com at launch; whether that can drop a restored session
  offline cannot be checked without a real Google sign-in. The owner checks it on the first real run.
- A lost ack is recovered with one round trip per event (O(n)); no retry cap, quota back-off or re-sign-in prompt; round-trip edge cases
  (NaN, lone surrogates) are not handled; a rejected event is only visible as the error state until E01-S10 adds a list and retry.
- The Playwright sync specs are not wired into CI.
- Finance log, farm profile and media are not synced.

## Code review

- 2026-10-09 independent review (separate agent, read-only), fixed in e64fe1a: pull/fetch had no timeout (the engine
  could hang forever) → 30-second timeout; a corrupt doc's error vanished on the next run → its id is kept until `retry()`
  re-checks it (`integrityIds()`); unhandled rejections from timers; one refused event held back the whole outbox;
  `stop()` didn't stop retries; the cursor could move backwards; conflict options nested in two lines were lost.
  Not fixed (minor): `unauthenticated` retries forever with no token refresh (needs login E02-S01); the first full
  download is not paged; `foldRecord` recurses once per event in the chain

## QA notes
