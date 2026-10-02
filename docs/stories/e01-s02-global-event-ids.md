# Story E01-S02: id ของ event ไม่ซ้ำทั่วโลก + ผู้บันทึก = user + เครื่อง

Status: Draft

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

- [ ] event ใหม่ทุกตัวมี `id` ไม่ซ้ำทั่วโลกตามรูปแบบที่ S01 เลือก สร้างได้ออฟไลน์ (`src/lib/id.ts`)
- [ ] `EventStore` (memory / native / web) ปฏิเสธ `id` ซ้ำที่เนื้อหาต่างกัน; append `id` เดิมเนื้อหาเดิมซ้ำ = ไม่เกิดอะไร (idempotent สำหรับ sync)
- [ ] เลขลำดับต่อเครื่องเพิ่มขึ้นเสมอ ไม่ซ้ำแม้ force-close กลางการบันทึก (NFR-2)
- [ ] `actor` = `{ userId, deviceId }`; deviceId สร้างครั้งเดียวต่อการติดตั้ง; userId ก่อน login เป็นไปตาม S01
- [ ] ผล projection/settle ของ fixture เดิมไม่เปลี่ยน; การเรียงไม่ใช้ `ts` (NFR-3)
- [ ] log เดิมในเครื่องถูกย้ายเป็นรูปแบบใหม่ครั้งเดียว ครบทุก event; รันซ้ำได้ปลอดภัย

## Offline / sync behavior

- ทำงานในเครื่องล้วน; การย้ายข้อมูลล้มกลางทาง → ข้อมูลเดิมยังอยู่และลองใหม่ได้
- เตรียม idempotent append ให้ E01-S08 (pull ซ้ำไม่สร้าง event ซ้ำ)

## Test plan

- [ ] Vitest (`src/core`): id ไม่ซ้ำ, projection ของ event จาก 2 เครื่องสลับลำดับ `ts` แล้วผลเท่าเดิม
- [ ] jest-expo: `MemoryStore` — id ซ้ำเนื้อหาต่าง reject, เนื้อหาเดิม no-op; ย้าย log เดิม
- [ ] Playwright: seed log รูปแบบเก่า → reload → ยอดรวมเท่าเดิม

## Verification

## Dev notes

## Code review

## QA notes
