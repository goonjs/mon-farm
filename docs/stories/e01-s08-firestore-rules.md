# Story E01-S08: Firestore — event แก้ไม่ได้ + security rules แยกกลุ่มฟาร์ม

Status: Ready

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

- [ ] สมาชิกที่ login แล้วสร้าง event ในกลุ่มตัวเองได้; update/delete event ถูกปฏิเสธเสมอ (SYNC-4)
- [ ] ผู้ที่ไม่ใช่สมาชิก หรือไม่ login อ่าน/เขียนกลุ่มนั้นไม่ได้ (ACC-5, NFR-5)
- [ ] rule ตรวจ `actor.userId == request.auth.uid` และ document id ตรงกับ `id` ใน event
- [ ] client ถือว่า "มีเอกสารนี้อยู่แล้ว **และ canonical JSON เท่ากัน**" = ส่งสำเร็จ (push ซ้ำ idempotent); มีอยู่แต่เนื้อหาต่าง = error ด้านความถูกต้อง ห้ามทับ (architecture §Sync engine)
- [ ] batch 500 event ที่ทุกตัวเรียก `isMember` ไม่ชนเพดาน 20 access call ของ rules (test บน emulator)
- [ ] rules + index อยู่ใน repo, deploy เข้า database `dev` ผ่านสคริปต์; `(default)` (prod) ต้องเจ้าของอนุมัติ

## Offline / sync behavior

- ยังไม่มี sync engine (อยู่ E01-S09); story นี้วางฝั่งเซิร์ฟเวอร์ที่ทนการส่งซ้ำและส่งไม่เป็นลำดับ

## Test plan

- [ ] rules unit test บน Firestore emulator: สมาชิก / ไม่ใช่สมาชิก / ไม่ login × create / read / update / delete
- [ ] test create ซ้ำ id เดิม → ปฏิเสธ และ client adapter แปลเป็นสำเร็จ

## ต้องให้เจ้าของทำ/อนุมัติ

- อนุมัติติดตั้ง `firebase` (JS SDK) และ `@firebase/rules-unit-testing` (gate dependency + ผลตรวจ, ทำ `npm audit` baseline ใหม่)
- emulator ต้องใช้ Java ที่อยู่นอก repo → ขออนุญาต
- อนุมัติ deploy rules เข้า prod (database `(default)`)
- D4 (ตัดสินแล้ว 2026-10-03): **คง `overrides` grpc-js ^1.14.5 / basic-ftp ^6.2.1 ไว้จนกว่า upstream จะแก้** — ณ 2026-10-03 ยังไม่พบ override นี้ใน `package.json` บน `dev`; เมื่อเพิ่มพร้อม dependency ของ story นี้ ให้คงไว้และตรวจทุกครั้งที่อัปเดต upstream ว่าเอาออกได้หรือยัง

## Verification

## Dev notes

## Code review

## QA notes

## คำถามเจ้าของ

**คำตอบเจ้าของ (2026-10-03):**
- D4 → **คง overrides grpc-js ^1.14.5 / basic-ftp ^6.2.1 จนกว่า upstream จะแก้**
