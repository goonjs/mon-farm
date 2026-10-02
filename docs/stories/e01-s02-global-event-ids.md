# Story E01-S02: id ของ event ไม่ซ้ำทั่วโลก + ผู้บันทึก = user + เครื่อง

Status: Ready

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

## Dev notes

## Code review

## QA notes
