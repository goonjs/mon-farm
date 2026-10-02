# Story E05-S06: รายการการขายย้อนหลัง + รายละเอียด

Status: Draft

## Context

- Epic: `docs/epics/e05-reconciliation-settlement.md`
- PRD: SET-7, SALE-20, SYNC-3, SYNC-10
- ต่อยอด: S17 (รายการการขายหน้าแรก)
- ขึ้นกับ: E05-S04, E05-S05; E01 story สถานะ sync รายบันทึก

## คำอธิบาย

รายการการขายทั้งหมด ใหม่สุดก่อน แต่ละแถวบอกสถานะ แตะเข้าไปเห็นรายละเอียด
ครบตาม SET-7

## Acceptance criteria

- [ ] แต่ละแถว: วันที่, ผู้ซื้อ, กก. รวม, ยอดเงิน, สถานะการขาย, สถานะการตรวจ, สรุปสถานะการจ่าย, สถานะ sync (SYNC-3)
- [ ] รายละเอียดแสดงครบ SET-7: วันที่, ราคา/กก., จำนวนเข่ง, กก. รวม, ยอดเงิน, กฎส่วนแบ่ง, เงินสดรายคนกรีด, เงินโอนเจ้าของ, ส่วนปรับปัดเศษ, หักปุ๋ย + ยอดคงเหลือ, ผู้ซื้อ, สถานที่, เวลาเริ่ม, สื่อ, สถานะการตรวจ
- [ ] การขาย Cancelled แสดงแยก ไม่นับรวมในยอด (SALE-20)
- [ ] การขายที่ Soft Delete ซ่อนจากรายการปกติ กู้คืนได้ (SYNC-10)

## Offline / sync

- รายการอ่านจาก log ในเครื่อง ใช้ออฟไลน์ได้; การขายจากเครื่องอื่นปรากฏหลัง sync

## Test plan

- [ ] Component: แถวและรายละเอียดจาก fixture หลายสถานะ
- [ ] e2e: Cancelled / Soft Delete / กู้คืน

## Verification

- [ ] Sandbox run:
- [ ] Screenshots (UI) — golden path:
- [ ] Screenshots (UI) — edge cases:

## Dev notes

## Code review

- Reviewer (agent/session แยก):
- Findings:
- Resolution:

## QA notes

