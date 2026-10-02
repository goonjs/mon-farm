# Story E07-S04: จำนวนต้นยาง ประมาณ → ยืนยัน พร้อมประวัติ

Status: Draft

## Context

- Epic: `docs/epics/e07-field-operations.md`
- PRD: OPS-7, SYNC-12
- ใหม่
- ขึ้นกับ: E03 story ที่ดิน/โซน

## คำอธิบาย

จำนวนต้นต่อที่ดิน/โซน เริ่มเป็นค่าประมาณ ยืนยันภายหลังได้ การเปลี่ยน (ต้นเสีย
ปลูกใหม่) เป็นรายการในประวัติ ไม่เขียนทับ

## Acceptance criteria

- [ ] จำนวนต้นมีสถานะ Estimated / User provided (ยืนยันแล้ว) / Unknown (SYNC-12)
- [ ] บันทึกการเปลี่ยน: ต้นเสีย, ปลูกใหม่, ยืนยันนับใหม่ — วันที่ + เหตุผล (OPS-7)
- [ ] จำนวนปัจจุบันคำนวณจากประวัติ; ประวัติดูย้อนหลังได้
- [ ] ไม่แต่งตัวเลข: ยังไม่ใส่ = Unknown (ต้นรวม ~7,000 เป็นค่าประมาณเท่านั้น)

## Offline / sync

- ทำได้ออฟไลน์; การเปลี่ยนเป็นบรรทัดเพิ่ม รวมจากหลายเครื่องได้

## Test plan

- [ ] Unit: ประมาณ 500 → เสีย 3 → ปลูก 5 → ยืนยัน 498
- [ ] Component: ป้ายสถานะ Estimated / Unknown

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

