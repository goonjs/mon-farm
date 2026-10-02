# Story E01-S04: ลบแบบกู้คืนได้ (Soft Delete) + ที่มาของข้อมูล

Status: Draft

## Context

- Epic: `docs/epics/e01-foundation-sync.md`
- PRD: SYNC-9, SYNC-10, SYNC-11, NFR-3
- Architecture: "2026-10-02 — Direction" (แก้ = event ใหม่); E01-S01
- ขึ้นกับ: E01-S02

## คำอธิบาย

ลบ/กู้คืนเป็น event; projection ซ่อนรายการที่ลบและให้ข้อมูลที่มา (สร้างโดย/เมื่อ, แก้โดย/เมื่อ, ช่องทาง)
ยังไม่มี network

## Acceptance criteria

- [ ] ลบรายการสำคัญ → ซ่อนจากรายการปกติ; มีมุมมอง "ที่ลบแล้ว" ให้เจ้าของคนใดก็กู้คืนได้ (SYNC-10)
- [ ] Soft Delete ≠ Cancelled: การขายที่ Cancelled ยังแสดงในรายการ (SYNC-10)
- [ ] ยอดรวม/สรุปเงินไม่นับรายการที่ลบ; กู้คืนแล้วกลับมาเท่าเดิม (NFR-3)
- [ ] projection ให้ provenance: สร้างโดย/เมื่อ, แก้โดย/เมื่อ (จาก `actor`), ช่องทางต้นทาง, สถานะการยืนยัน (SYNC-11)
- [ ] ทุกการลบ/กู้คืน/แก้ เก็บเป็น event — ไม่มีการลบแถวจริงใน store (SYNC-9)

## Offline / sync behavior

- ลบ/กู้คืนทำออฟไลน์ได้ เป็น event ปกติใน outbox
- ลบบนเครื่องหนึ่งพร้อมแก้บนอีกเครื่อง → จัดการใน E01-S11 (Conflict)

## Test plan

- [ ] Vitest: delete → restore → delete ให้ผลถูก, ยอดเงินไม่นับรายการที่ลบ, Cancelled ไม่ถูกซ่อน
- [ ] jest-expo: มุมมอง "ที่ลบแล้ว" + ปุ่มกู้คืน
- [ ] Playwright: ลบการขาย → reload → ยังซ่อน → กู้คืน (screenshot)

## Verification

## Dev notes

## Code review

## QA notes
