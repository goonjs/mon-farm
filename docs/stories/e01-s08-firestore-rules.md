# Story E01-S08: Firestore — event แก้ไม่ได้ + security rules แยกกลุ่มฟาร์ม

Status: In Progress

## Context

- Epic: `docs/epics/e01-foundation-sync.md`
- PRD: SYNC-4, ACC-4, ACC-5, NFR-5 · D-1
- Architecture: "2026-10-02 — Direction" แถว *Backend*, *Sync unit*; E01-S01
- ขึ้นกับ: E01-S01, E01-S02, E01-S07
- ปรับตาม D-34 (2026-10-03)

## คำอธิบาย

วาง `groups/{gid}/events/{eventId}` เป็นเอกสาร **สร้างอย่างเดียว** และ rules ที่ให้เฉพาะสมาชิกกลุ่ม
(`groups/{gid}/members/{uid}`, มี `role`) อ่าน/เขียนได้ — ฝั่งเซิร์ฟเวอร์ ไม่ใช่แค่ UI

## Acceptance criteria

- [x] สมาชิกที่ login แล้วสร้าง event ในกลุ่มตัวเองได้; update/delete event ถูกปฏิเสธเสมอ (SYNC-4)
- [x] ผู้ที่ไม่ใช่สมาชิก หรือไม่ login อ่าน/เขียนกลุ่มนั้นไม่ได้ (ACC-5, NFR-5)
- [x] rule ตรวจ `actor.userId == request.auth.uid` และ document id ตรงกับ `id` ใน event
- [ ] client ถือว่า "มีเอกสารนี้อยู่แล้ว **และ canonical JSON เท่ากัน**" = ส่งสำเร็จ (push ซ้ำ idempotent); มีอยู่แต่เนื้อหาต่าง = error ด้านความถูกต้อง ห้ามทับ (architecture §Sync engine)
- [x] batch 500 event ที่ทุกตัวเรียก `isMember` ไม่ชนเพดาน 20 access call ของ rules (test บน emulator)
- [ ] rules + index อยู่ใน repo, deploy เข้า database `dev` ผ่านสคริปต์; `(default)` (prod) ต้องเจ้าของอนุมัติ

## Offline / sync behavior

- ยังไม่มี sync engine (อยู่ E01-S09); story นี้วางฝั่งเซิร์ฟเวอร์ที่ทนการส่งซ้ำและส่งไม่เป็นลำดับ

## Test plan

- [x] rules unit test บน Firestore emulator: สมาชิก / ไม่ใช่สมาชิก / ไม่ login × create / read / update / delete
- [ ] test create ซ้ำ id เดิม → ปฏิเสธ และ client adapter แปลเป็นสำเร็จ

## ต้องให้เจ้าของทำ/อนุมัติ

- อนุมัติติดตั้ง `firebase` (JS SDK) และ `@firebase/rules-unit-testing` (gate dependency + ผลตรวจ, ทำ `npm audit` baseline ใหม่)
- emulator ต้องใช้ Java ที่อยู่นอก repo → ขออนุญาต
- อนุมัติ deploy rules เข้า prod (database `(default)`)
- D4 (ตัดสินแล้ว 2026-10-03): **คง `overrides` grpc-js ^1.14.5 / basic-ftp ^6.2.1 ไว้จนกว่า upstream จะแก้** — ณ 2026-10-03 ยังไม่พบ override นี้ใน `package.json` บน `dev`; เมื่อเพิ่มพร้อม dependency ของ story นี้ ให้คงไว้และตรวจทุกครั้งที่อัปเดต upstream ว่าเอาออกได้หรือยัง

## Verification

## Dev notes

### DoD ของ story นี้

- [x] test บน emulator (`firestore/rules.test.ts`) เขียนก่อน เห็นแดงก่อนเขียว (rules ปิดทั้งหมด → 3 test ล้มเหลว: สร้าง, อ่าน, batch 500) แล้วเขียว 16/16
- [x] `firestore.rules` + `firestore.indexes.json` + `firebase.json` ใน repo; `npm run test:rules` ผ่าน
- [x] พิสูจน์ว่า test จับ rules ที่หย่อนได้: ถอด `receivedAt == request.time`, เปิด update event, ให้ผู้ login ทุกคนอ่าน event ได้ — แต่ละกรณีมี test ที่ล้มเหลวตรงจุด แล้วคืน rules
- [x] บันทึก `npm audit` ก่อน/หลัง (ด้านล่าง)
- [x] typecheck + test:core ผ่าน; CI มีขั้น `test:rules` (JDK 21 + cache emulator) — รอ CI จริงของ PR
- [ ] reviewer อิสระตรวจตาม `code-review-checklist.md`
- [ ] deploy rules เข้า database `dev` — ต้องมี database `dev` และ credential ก่อน (E01-S07; owner สร้าง database)
- [ ] client adapter แปลง "มีอยู่แล้วและ canonical JSON เท่ากัน" เป็นสำเร็จ (AC ข้อ 4) — อยู่ใน E01-S09 (outbox) ไม่ได้ทำใน PR นี้; rules ฝั่งนี้ปฏิเสธการสร้างซ้ำตามที่ test ยืนยันแล้ว

### สถานะ 2026-10-03

- โปรเจกต์เดียว (D-34): prod = database `(default)`, dev/preview = database `dev`; `firebase.json` deploy rules + indexes ชุดเดียวกันเข้าทั้งสอง database
  ⚠️ rules แยกไม่ได้ว่าคำขอมาจาก build prod หรือ preview — การแยก database กันความผิดพลาด ไม่ใช่ขอบเขตความปลอดภัย (ADR 0001 amendment 2)
- ติดตั้ง `firebase@12.19.0` (dependencies), `@firebase/rules-unit-testing@5.0.2` และ `firebase-tools@15.32.1` (dev) ด้วย `--ignore-scripts` ตามที่เจ้าของอนุมัติ; ผู้เผยแพร่เป็นบัญชี Google/Firebase (firebase-ops, google-wombot)
- `overrides` `@grpc/grpc-js ^1.14.5`, `basic-ftp ^6.2.1` คงไว้ตาม D4 — ⚠️ grpc-js ^1.14.5 อยู่นอกช่วงที่ `firebase` ประกาศ (ใช้เป็น Node transport ของ emulator test; test ผ่านแล้ว) ให้เจ้าของตรวจ และตรวจซ้ำทุกครั้งที่อัปเดต upstream
- เพิ่ม 593 package, ลบ 0, **ไม่มีเวอร์ชันของ package เดิมเปลี่ยน**; 3 ตัวมี install script (`@firebase/util`, `protobufjs`, `re2`) ไม่ได้รันเพราะ `--ignore-scripts`
- `npm audit`: ก่อน 67 (54 high) → หลัง 73 (56 high) = **ใหม่ 6 รายการ (high 2: `firebase-tools` ผ่าน `chokidar`, `re2`)** ทั้งหมดเป็นเครื่องมือ dev (CLI/emulator) ไม่อยู่ใน bundle ที่ ship; ตัวเลข 22→27 ที่ session ก่อนบันทึกไว้ทำซ้ำไม่ได้ ณ วันนี้ (advisory/lockfile ของ `dev` เปลี่ยน)
- ข้อผิดพลาดใน test ร่างเดิมที่แก้: test batch 500 สร้าง `writeBatch` กับ ref จาก Firestore instance คนละตัว → ใช้ instance เดียว
- emulator JAR เก็บที่ `~/.cache/firebase/emulators` (เจ้าของอนุญาตเฉพาะ path นี้)

## Code review

## QA notes

## คำถามเจ้าของ

**คำตอบเจ้าของ (2026-10-03):**
- D4 → **คง overrides grpc-js ^1.14.5 / basic-ftp ^6.2.1 จนกว่า upstream จะแก้**
