# Story E02-S02: สร้างกลุ่มฟาร์ม + กลุ่มเดียวเข้าเลย

Status: In Progress

## Context

- Epic: `docs/epics/e02-access-farm-groups.md`
- PRD: ACC-2, ACC-3, ACC-4, ACC-5, ACC-6
- Architecture: "2026-10-02 — Direction"; E01-S01 (โครง `groups/{gid}/members/{uid}`)
- ขึ้นกับ: E02-S01, E01-S08

## คำอธิบาย

ผู้ใช้ที่ login แล้วสร้างกลุ่มฟาร์มได้ และเป็นสมาชิก `role: owner`
มีกลุ่มเดียว → เข้าเลย ข้อมูลทั้งหมดผูกกับ group id
ต้องสร้างหรือเข้าร่วมกลุ่มก่อนบันทึกอะไรก็ตาม — ไม่มีข้อมูลในเครื่องก่อนมีกลุ่ม

## Acceptance criteria

- [ ] ผู้ใช้ที่ยังไม่มีกลุ่ม สร้างกลุ่ม (ตั้งชื่อ) แล้วเป็นสมาชิก `role: 'owner'` (ACC-2, ACC-4)
- [ ] มีกลุ่มเดียว → เปิดแอปแล้วเข้ากลุ่มนั้นเลย ไม่มีหน้าเลือก (ACC-3)
- [ ] login แล้วแต่ยังไม่มีกลุ่ม → มีแค่ทางเลือก สร้างกลุ่ม / เข้าร่วมด้วยรหัสเชิญ (E02-S03); บันทึกข้อมูลไม่ได้ (D-24)
- [ ] event ทุกตัวผูก group id ของกลุ่มที่เปิดอยู่ตั้งแต่ตัวแรก; ไม่มี event ที่ไม่มี group id (D-24)
- [ ] รายการสมาชิกเก็บในเครื่อง → เปิดแอปออฟไลน์เข้ากลุ่มได้ (ACC-6)
- [ ] ไม่มี UI จัดการสิทธิ์; `role` เป็น `owner` เสมอใน V1 (ACC-4)

## Offline / sync behavior

- สร้างกลุ่มได้ออฟไลน์ (id สร้างในเครื่อง) แล้ว sync เมื่อมีเน็ต ผ่าน outbox (E01-S09)
- rules ยอมให้ผู้สร้างเขียนกลุ่ม + สมาชิกภาพของตัวเองเท่านั้น (ACC-5)

## Test plan

- [ ] Vitest: ตัดสินการเข้ากลุ่ม (0 กลุ่ม → สร้าง/เข้าร่วม, 1 กลุ่ม → เข้าเลย); สร้าง event โดยไม่มี group id ไม่ได้
- [ ] rules test บน emulator: สร้างกลุ่ม + สมาชิกภาพตัวเองได้, เพิ่มคนอื่นเองไม่ได้
- [ ] Playwright: login → สร้างกลุ่ม → reload ออฟไลน์ → เข้ากลุ่มเลย (screenshot)

## คำถามเจ้าของ

- ข้อมูลที่บันทึกก่อนมีกลุ่มฟาร์มไปอยู่กลุ่มไหน (บันทึกก่อนมีกลุ่มได้ไหม)

**คำตอบเจ้าของ (2026-10-03):**
- ต้องสร้างหรือเข้าร่วมกลุ่มฟาร์มก่อนบันทึกอะไรก็ตาม; ไม่มีข้อมูลในเครื่องก่อนมีกลุ่ม event ทุกตัวจึงมี group id ตั้งแต่แรก

## Verification

2026-10-09 (branch `feature/e02-groups`, sandbox):

- `npm run typecheck`, `lint`, `test:core`, `test:ui`, `tokens:check`, `contrast` — ผ่าน; `npm run test:rules` —
  60/60 ผ่าน (emulator Firestore จาก firebase-tools ใน node_modules + `/usr/bin/java`)
- Vitest: `src/core/group.test.ts` (0 กลุ่ม → สร้าง/เข้าร่วม, 1 → เข้าเลย, ≥2 → pick; ผู้สร้างเป็น `owner`; ชื่อว่าง
  ไม่ได้; batch = group + member ของตัวเองเท่านั้น), `src/core/scope.test.ts` + `src/store/store.test.ts` (event ที่ไม่มี
  group id → `NoGroupError` และไม่ถูกเก็บ ทั้ง MemoryStore และ IndexedDbStore), `src/store/account.test.ts`
  (membership + pending op อยู่รอดหลัง reload; เขียนไม่ได้ → reject ไม่มี membership ค้าง), `src/store/session.test.ts`
- jest-expo `src/__tests__/account-gate.test.tsx`: 0 กลุ่ม → มีแค่สร้าง/เข้าร่วม และ write path ปฏิเสธ (`NoGroupError`,
  log ไม่เปลี่ยน); สร้างกลุ่ม → id UUIDv7 ในเครื่อง, `role: 'owner'`, op `create_group` เข้าคิว, เข้ากลุ่มเลย; ชื่อว่าง
  → `ใส่ชื่อกลุ่มฟาร์ม`; กลับ; เก็บไม่ได้ → `สร้างกลุ่มไม่สำเร็จ — ลองอีกครั้ง` ไม่เข้ากลุ่ม; มี 1 กลุ่มในเครื่อง → เข้าเลย
  ไม่เรียก sign-in; ไม่มีข้อความสิทธิ์/บทบาท
- rules test: batch ที่แอปสร้าง (`createGroupWrites`) ผ่าน; เพิ่มคนอื่นใน batch เดียวกันไม่ได้; ผู้สร้างเพิ่มคนอื่นทีหลังไม่ได้
  — ผ่านตั้งแต่รันครั้งแรกโดยไม่ต้องแก้ `firestore.rules` (กติกามีอยู่แล้วจาก E01-S08) จึงไม่ใช่ test ที่ล้มก่อน
- Playwright `e2e/groups.spec.ts` (build จริง, 390×844): login แล้ว 0 กลุ่ม → หน้าเริ่มใช้งาน; ชื่อว่าง → ข้อความ;
  สร้างขณะออฟไลน์ → เข้ากลุ่ม (รายการขาย) และ localStorage มี membership + op; reload โดยตัดทุก request นอก origin แล้ว
  ออฟไลน์ → เข้ากลุ่มเลย; เริ่มการขายในกลุ่ม → event ใน IndexedDB มี `groupId` ของกลุ่มนั้นทุกตัว e2e ทั้งชุด 152 ผ่าน
- ภาพ: `docs/ux/screenshots/overnight/e02/s02-group-start.png`, `s02-create-name-required.png`, `s02-create-group.png`,
  `s02-in-group.png`, `s02-reopen-offline.png`

## Dev notes

- **โครง**: `src/core/group.ts`, `src/core/scope.ts`; `EventBase.groupId` (types) ใส่โดย `record.stamp` จาก
  `session.sessionGroupId()`; `checkAppend` ตรวจซ้ำ; `AccountStore` เพิ่ม `memberships` / `createGroup` /
  `pendingOps`; `GroupStartScreen.tsx`; `AccountGate` ตัดสินด้วย `decideEntry` จาก memberships ในเครื่อง
- **ไม่ใช่ event**: กลุ่มและสมาชิกภาพเก็บเป็นแถว `memberships` + `pending_ops.create_group` ตาม architecture
  §การดำเนินการด้านสมาชิกภาพ ไม่ได้ลง event log (log การขายเป็นต่อ `saleId` และ server เก็บกลุ่มเป็น doc ไม่ใช่ event)
- **ปุ่ม "เข้าร่วมด้วยรหัสเชิญ"** แสดงตาม flow §3.1 แต่ปิดไว้จนกว่า E02-S03
- **≥ 2 กลุ่ม**: `decideEntry` คืน `pick`; หน้าเลือกเป็นของ E02-S04 — ระหว่างนี้ gate เปิดกลุ่มแรก (build นี้สร้างกลุ่มที่สอง
  ไม่ได้อยู่แล้ว เพราะสร้างได้เฉพาะตอนมี 0 กลุ่มและยังไม่มีการเข้าร่วม)
- **event เก่าบนเครื่อง dev** (ก่อน branch นี้) ไม่มี `groupId`: ยังอ่าน/แสดงได้ (load ไม่ตรวจ) แต่จะไม่ถูกส่ง —
  การขายยังไม่กรองตามกลุ่ม (E02-S04)
- **ไม่ครอบคลุม / ค้าง**:
  - sync กลุ่มใหม่ขึ้น Firestore ผ่าน outbox (E01-S09 ยังไม่มี) — op อยู่ในคิวในเครื่องเท่านั้น
  - login ครั้งแรกบนเครื่องใหม่ควรดึงรายการกลุ่มจากเซิร์ฟเวอร์ก่อนให้สร้าง (flow §1.1) — ยังไม่มี backend
  - Playwright เริ่มจาก session ที่ preload (ไม่ได้ login ผ่าน Google จริง/emulator — ดู E02-S01 Dev notes)
  - native (`account.native.ts` ตาราง `memberships`/`pending_ops`) ยังไม่เคยรันบนเครื่อง

## Code review

## QA notes
