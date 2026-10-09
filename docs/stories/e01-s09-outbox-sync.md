# Story E01-S09: sync อัตโนมัติ — outbox ส่งขึ้น + ดึงลง

Status: In Progress

## Context

- Epic: `docs/epics/e01-foundation-sync.md`
- PRD: SYNC-1, SYNC-2, SYNC-4, NFR-2 · D-3
- Architecture: "2026-10-02 — Direction" แถว *Sync unit*, *Pending Sync*; E01-S01
- ขึ้นกับ: E01-S03, E01-S08, E02-S01 (login), E02-S02 (มี group id)

## คำอธิบาย

sync engine หลัง port (`RemoteEvents`): ส่ง `pending()` ขึ้น Firestore แล้ว `markSynced`, ฟัง snapshot ของกลุ่ม
แล้วเก็บ event ของเครื่องอื่นลง store แบบ idempotent — store ในเครื่องเป็นเจ้าของความคงทน ไม่ใช่ cache ของ Firestore

## Acceptance criteria

- [ ] บันทึกตอนออฟไลน์ใช้ได้ทันที และอยู่ใน outbox (SYNC-1)
- [ ] เน็ตกลับมา → ส่งขึ้นเองโดยไม่มีปุ่ม Sync (SYNC-2, D-3)
- [ ] ส่งล้มเหลว → ลองใหม่อัตโนมัติแบบ backoff; ข้อมูลในเครื่องไม่ถูกลบหรือแก้ (SYNC-2)
- [ ] event จากเครื่องอื่นในกลุ่มลงมาเก็บในเครื่อง; ดึงซ้ำไม่เกิด event ซ้ำ
- [ ] เข่ง/รายการต่างกันจาก 3 เครื่องรวมเป็นชุดเดียวโดยไม่ถาม (SYNC-4)
- [ ] force-close ระหว่างส่ง → เปิดใหม่ส่งต่อได้ ไม่หาย ไม่ซ้ำ (NFR-2)

## Offline / sync behavior

- ออฟไลน์เป็นโหมดหลัก; sync เริ่มเองเมื่อมีเน็ต และเมื่อเปิดแอป
- ส่งไม่เป็นลำดับ/ส่งซ้ำได้ปลอดภัย (create-only + id ไม่ซ้ำ)
- การแก้ที่ขัดกันยังไม่ตรวจใน story นี้ → E01-S11

## Test plan

- [ ] Vitest: sync engine กับ fake remote — ส่ง, ล้มเหลว + retry, ดึงซ้ำ, ลำดับสลับ
- [ ] integration บน emulator: 2 client เขียนคนละเข่ง → ทั้งสองเห็นครบ
- [ ] Playwright: `setOffline(true)` → นับเข่ง → online → outbox ว่าง

## Verification

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
- cursor ของ pull เก็บถาวรใน store (`syncCursor` ใน `meta` ทั้ง IndexedDB และ SQLite ไม่ต้องขึ้น version) ใช้ผ่าน
  `storeCursor(store)` — เปิดแอปใหม่ดึงต่อจากเดิม ไม่ดาวน์โหลดทั้งกลุ่มซ้ำ

## Code review

- 2026-10-09 independent review (separate agent, read-only), fixed in e64fe1a: pull/fetch had no timeout (the engine
  could hang forever) → 30-second timeout; a corrupt doc's error vanished on the next run → its id is kept until `retry()`
  re-checks it (`integrityIds()`); unhandled rejections from timers; one refused event held back the whole outbox;
  `stop()` didn't stop retries; the cursor could move backwards; conflict options nested in two lines were lost.
  Not fixed (minor): `unauthenticated` retries forever with no token refresh (needs login E02-S01); the first full
  download is not paged; `foldRecord` recurses once per event in the chain

## QA notes
