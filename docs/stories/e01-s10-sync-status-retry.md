# Story E01-S10: แสดงสถานะ sync + ปุ่ม "ลองใหม่" เมื่อ error

Status: Draft

## Context

- Epic: `docs/epics/e01-foundation-sync.md`
- PRD: SYNC-2, SYNC-3, NFR-4 · D-3
- Architecture: "2026-10-02 — Direction" แถว *Pending Sync*
- ขึ้นกับ: E01-S09

## คำอธิบาย

แสดงสถานะ Synced / Pending Sync / Conflict ทั้งภาพรวมและรายบันทึก
ปุ่ม "ลองใหม่" ขึ้นเฉพาะเมื่อ sync ล้มเหลวหรือมี Conflict

## Acceptance criteria

- [ ] ภาพรวม (ส่วนหัวแอป): Synced / Pending Sync (+จำนวน) / Conflict / error — ไอคอน + ข้อความไทย ไม่ใช้สีอย่างเดียว (SYNC-3, NFR-4)
- [ ] รายบันทึก: แต่ละการขายในรายการแสดงสถานะของตัวเอง (SYNC-3)
- [ ] ใช้งานปกติไม่มีปุ่ม Sync; ปุ่ม "ลองใหม่" แสดงเฉพาะเมื่อ error หรือ Conflict และกดแล้ว sync ทันที (SYNC-2, D-3)
- [ ] Conflict แสดงจำนวนและพาไปหน้าจอตัดสิน (หน้าจออยู่ E01-S11)
- [ ] สถานะเปลี่ยนเองเมื่อ online/offline โดยไม่ต้อง reload

## Offline / sync behavior

- ออฟไลน์: แสดง Pending Sync ไม่แสดงเป็น error
- error จริง (เช่น rules ปฏิเสธ) แสดงปุ่ม "ลองใหม่"; ข้อมูลในเครื่องคงอยู่

## Test plan

- [ ] jest-expo: ตัวบอกสถานะทุก state, ปุ่มลองใหม่แสดง/ไม่แสดงตามเงื่อนไข
- [ ] Playwright: offline → Pending → online → Synced; จำลอง error → ปุ่มลองใหม่ (screenshot ทุก state)

## Verification

## Dev notes

## Code review

## QA notes
