# Story E01-S11: ตรวจจับ Conflict + หน้าจอให้เจ้าของเลือก

Status: Draft

## Context

- Epic: `docs/epics/e01-foundation-sync.md`
- PRD: SYNC-4, SYNC-9, NFR-3
- Architecture: "2026-10-02 — Direction" แถว *Sync unit* (`targetId` + `baseEventId`); E01-S01
- ขึ้นกับ: E01-S09, E01-S10

## คำอธิบาย

การแก้คือ event ใหม่ที่อ้าง `targetId` + `baseEventId`; สองการแก้บน base เดียวกันจากต่างเครื่อง = Conflict
ห้ามเลือกค่าเองแบบเงียบ ๆ ให้เจ้าของตัดสิน
(การนับซ้ำ/ส่งต่อการขาย SYNC-5…7 อยู่ E04)

## Acceptance criteria

- [ ] การแก้ทุกครั้งบันทึก `targetId` + `baseEventId` (SYNC-9)
- [ ] สองการแก้บน base เดียวกัน → Conflict ทุกเครื่อง; ไม่มี last-write-wins กับเงิน น้ำหนัก จำนวน (SYNC-4)
- [ ] ระหว่างยังไม่ตัดสิน ค่าที่ขัดกันไม่ถูกนำไปคิดเงินแบบเงียบ ๆ — รายการติดธง Conflict (NFR-3)
- [ ] หน้าจอตัดสิน: แสดงทั้งสองค่า + ใคร/เครื่องไหน/เมื่อไร; เลือกแล้วบันทึกเป็น event ใหม่
- [ ] ตัดสินได้ออฟไลน์; sync แล้ว Conflict หายทุกเครื่อง
- [ ] ลบบนเครื่องหนึ่ง + แก้บนอีกเครื่อง → Conflict เช่นกัน (E01-S04)

## Offline / sync behavior

- ตรวจจับตอนรวม event (หลัง pull) — ทำงานเหมือนกันทุกเครื่อง ไม่พึ่งเซิร์ฟเวอร์
- สองเครื่องตัดสินต่างกันขณะออฟไลน์ → เป็น Conflict ใหม่ ไม่ทับกัน

## Test plan

- [ ] Vitest: ฟังก์ชันตรวจ Conflict (base เดียวกัน / ต่อกัน / ลบ+แก้), projection ไม่ใช้ค่าที่ขัดกัน
- [ ] jest-expo: หน้าจอตัดสิน — แสดงสองค่า, เลือกแล้วเกิด event
- [ ] integration บน emulator: 2 client แก้ราคาเดียวกันออฟไลน์ → online → Conflict ทั้งคู่ → ตัดสิน → หาย

## Verification

## Dev notes

## Code review

## QA notes
