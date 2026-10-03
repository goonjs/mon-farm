# Story E01-S02: id ของ event ไม่ซ้ำทั่วโลก + ผู้บันทึก = user + เครื่อง

Status: Done

## Context

- Epic: `docs/epics/e01-foundation-sync.md`
- PRD: SYNC-4, SYNC-9, NFR-2, NFR-3
- Architecture: "2026-10-02 — Direction" แถว *IDs & ordering*; "Two clocks, kept apart"
- ขึ้นกับ: E01-S01

## คำอธิบาย

เปลี่ยน event log ให้พร้อมหลายเครื่อง: `id` ไม่ซ้ำทั่วโลก + เลขลำดับต่อเครื่อง,
เลิก PK `(sale_id, seq)`, `actor` (ตอนนี้ hard-code `'somchai'` ใน `SaleProvider`) เป็น user id + device id
ยังไม่มี network ใน story นี้

## Acceptance criteria

- [ ] event ใหม่ทุกตัวมี `id` ไม่ซ้ำทั่วโลกเป็น **UUIDv7** (RFC 9562) จาก CSPRNG สร้างได้ออฟไลน์ (`src/lib/id.ts`) — ห้าม fallback ไป `Math.random`; แหล่ง CSPRNG บน native ต้องผ่าน dependency gate (architecture §Local data layer)
- [ ] `EventStore` (memory / native / web) ปฏิเสธ `id` ซ้ำที่เนื้อหาต่างกัน; append `id` เดิมเนื้อหาเดิมซ้ำ = ไม่เกิดอะไร (idempotent สำหรับ sync)
- [ ] เลขลำดับต่อเครื่องเพิ่มขึ้นเสมอ ไม่ซ้ำแม้ force-close กลางการบันทึก (NFR-2)
- [ ] `actor` = `{ userId, deviceId }`; deviceId สร้างครั้งเดียวต่อการติดตั้ง; `userId` ไม่เป็น optional เพราะไม่มี event ก่อน login (D-23)
- [ ] ผล projection/settle ของ fixture เดิมไม่เปลี่ยน; การเรียงไม่ใช้ `ts` (NFR-3)
- [ ] ไม่ย้าย log เดิม (เจ้าของ 2026-10-03): store ใหม่ใช้ชื่อใหม่; store เก่าถูกล้าง/ข้ามแบบ best-effort ตอนเปิดครั้งแรก ไม่ crash

## Offline / sync behavior

- ทำงานในเครื่องล้วน; ล้าง store เก่าล้มเหลว → log แล้วทำงานต่อ (แอปไม่พึ่งของเก่า)
- เตรียม idempotent append ให้ E01-S08 (pull ซ้ำไม่สร้าง event ซ้ำ)

## Test plan

- [ ] Vitest (`src/core`): id ไม่ซ้ำ, projection ของ event จาก 2 เครื่องสลับลำดับ `ts` แล้วผลเท่าเดิม
- [ ] jest-expo: `MemoryStore` — id ซ้ำเนื้อหาต่าง reject, เนื้อหาเดิม no-op
- [ ] Playwright: seed log รูปแบบเก่า → reload → แอปเปิดได้ปกติ เริ่มว่าง ไม่ crash

## Verification

รันใน container ของ session (2026-10-03) หลังแก้ตาม review:

- เห็นแดงก่อน: เอาเทสต์ใหม่ไปรันกับโค้ด `origin/dev` → 17 เทสต์ล้ม (id, canonical, MemoryStore, projection 2 เครื่อง, void ด้วย id)
- `npm run typecheck`, `npm run lint` ผ่าน; Vitest 137 ผ่าน; jest 54 ผ่าน; `npm run build:web` ผ่าน; Playwright 132 ผ่าน / 6 skip (skip เดิมตาม project)
- Playwright 1.62 ใน lockfile ต้องการ browser build ที่ container ไม่มี จึงรันผ่าน config ชั่วคราวใน scratchpad ที่ชี้
  `/opt/pw-browsers/chromium` (ไม่แก้ config ใน repo) CI ใช้ config ปกติ
- native ยังไม่เคยรันบนเครื่องจริง (E01-S06): `store.native.ts` ตรวจแค่ typecheck กับ type ของ expo-sqlite 57.0.1

## Dev notes

### DoD ของ story นี้ (ตรวจก่อนเปลี่ยนเป็น Review)

- [x] เทสต์เขียนก่อน (เห็นแดงก่อนเขียวทุก AC): Vitest สำหรับ `uuidv7` / projection 2 เครื่อง, Vitest สำหรับ `MemoryStore` (idempotent / `IntegrityError` / `deviceSeq`)
- [x] `src/lib/id.ts` ไม่มี `Math.random` เหลือ; ไม่มี CSPRNG → throw; native ใช้แหล่งที่ผ่าน dependency gate เท่านั้น
- [x] `npm run verify` เขียวในเครื่อง (typecheck, lint, Vitest, jest, web build, Playwright) และ fixture เดิมได้ผล projection/settle เท่าเดิม
- [x] Playwright: seed คีย์ localStorage รูปแบบเก่า → reload → แอปเปิดได้ เริ่มว่าง ไม่ crash (หลักฐานใน QA notes)
- [x] ตรวจตนเองตาม definition-of-done + offline-sync checklist และมี review อิสระโดย subagent แยก ผลอยู่ใน §Code review
- [x] CI เขียวบน PR (#15, run 37077709188)


### การตัดสินใจ / ส่วนที่ต่างจากแผน

- **CSPRNG บน native = `expo-crypto@57.0.3`** เจ้าของอนุมัติผ่าน lead 2026-10-03 หลักฐานที่ส่งก่อนติดตั้ง: first-party Expo
  (monorepo expo/expo), ไม่มี dependency ย่อย, `npm audit` ของแพ็กเกจนี้เดี่ยว ๆ = 0; audit ทั้ง lockfile ก่อน/หลัง =
  22 (14 moderate, 8 high) เท่าเดิม ติดตั้งด้วย `EXPO_OFFLINE=1 npx expo install expo-crypto` เพราะ proxy ปิด API ของ Expo
  ใน jest ใช้ mock ที่ส่งต่อไป `crypto.getRandomValues` ของ Node (`jest.setup.js`)
- **`userId = 'pre-login'`** (`src/store/session.ts`) จนกว่า E02-S01 จะมี login — ฟิลด์ไม่ optional ตาม AC4 แต่ยังไม่มี uid
  จริงให้ใส่ event ก่อนหน้านั้นไม่ sync และไม่ย้าย
- **`seq` ต่อการขายยังอยู่แต่ไม่ unique**; ลำดับ fold = `(seq, deviceId, deviceSeq, id)` (`src/core/order.ts`) ไม่อ่าน `ts`
- **`correction` ชี้เข่งด้วย `targetId`** (id ของ event) แทน `targetSeq` — ไม่งั้น undo บนเครื่องหนึ่งจะลบเข่งของอีกเครื่องที่ได้
  `seq` เดียวกัน (มีเทสต์) หน้า log ยังแสดง `#seq` ของเข่งเป้าหมาย
- **ตัวนับ `deviceSeq` ตัวเดียวทั้งแอป** (`src/store/device-clock.ts`) store บังคับ high-water mark ใน transaction เดียวกับ insert
- native เก็บ `meta` คีย์ `device` เป็น JSON เดียว; เว็บเก็บ `mon-farm-v1:meta` พร้อมธง `legacyCleanupV1`
- ยังไม่มี `groupId` (E02-S02); เว็บยังเป็น localStorage ใต้ `mon-farm-v1:*` และการแย่ง seq ระหว่างหลายแท็บ → E01-S03
- การล้างของเก่าลบ `mon-farm:locale` ตาม architecture §ข้อมูลเก่า ที่เจ้าของตกลงแล้ว ผลคือผู้ใช้เว็บที่เคยเลือกภาษาอังกฤษจะกลับเป็น
  ไทยหนึ่งครั้ง (แจ้งไว้ใน PR)
- test plan เขียน "jest-expo: MemoryStore" — ใช้ Vitest แทนเพราะ `store.ts` เป็น port ล้วน และเพิ่มเทสต์ `WebStore` ด้วย
  localStorage จำลอง

## Code review

review อิสระโดย subagent แยก (2026-10-03) ตาม `docs/checklists/code-review-checklist.md`:

| # | ระดับ | เรื่อง | ผล |
|---|---|---|---|
| 1 | blocker | ตัวนับ `deviceSeq` ต่อ `SaleProvider` — สอง provider ที่ mount พร้อมกัน (กลับจาก settlement) ใช้เลขซ้ำ store ปฏิเสธ event หาย | แก้: `device-clock.ts` ตัวเดียวทั้งแอป + เทสต์สลับสองการขาย |
| 2 | should-fix | เทสต์ครอบแค่ `MemoryStore` | แก้: `store.web.test.ts` (idempotent ข้ามลำดับ key, `IntegrityError`, seq ต่อหลัง restart, คีย์ที่ล้าง/เก็บ) |
| 3 | should-fix | native `load()` ไม่รอคิวเขียน อาจอ่าน log ไม่ครบ | แก้: `load` ผ่าน `serial` |
| 4 | should-fix | ล้าง `mon-farm:locale` ที่ยังใช้อยู่ | คงไว้ตาม architecture ที่ตกลง; บันทึกผลกระทบ + e2e ตรวจคีย์ที่ต้องอยู่ |
| 5 | should-fix | การตัดสินใจ/หลักฐาน gate ไม่ถูกบันทึก | แก้: §การตัดสินใจ ด้านบน + architecture |
| 6 | nit | ลำดับ fold เสมอกันได้เมื่อ deviceId ถูกโคลน | แก้: เพิ่ม `id` เป็นตัวตัดสินสุดท้าย (โค้ดและ SQL) |
| 7 | nit | เขียน localStorage ล้มเหลวเงียบ; ธง `legacyCleanupV1` ไม่ถูกอ่าน | แก้: `console.warn` + อ่านธงจริง |
| 8 | nit | settlement ไม่เช็ก `ready` | เลื่อน: ปุ่มที่ append ปรากฏหลังโหลดและปิดการขายแล้ว เสี่ยงต่ำ — ทบทวนใน E04 |

## QA notes

- ไม่มีการเปลี่ยน UI; หลักฐาน AC6: `screenshots/e01-s02/legacy-log-ignored.png` — เบราว์เซอร์ที่มี log v0.4 เปิดมาเป็นหน้าว่าง
  หลัง reload ก็ยังว่าง คีย์การขายเก่าถูกลบ คีย์ farm/people/speech อยู่ครบ (`e2e/legacy-log.spec.ts`)
