# Story E04-S11: สถานะการขาย Draft / Completed / Cancelled + แก้หลัง Completed

Status: Draft

## Context

- Epic: `docs/epics/e04-sale-weighing.md`
- PRD: SALE-20, SALE-21, SYNC-10, D-16
- แทนที่: S13 วงจรปิด/เปิดกอง-โซน-การขาย (`pile_closed`, `zone_closed`, `sale_closed`, `*_reopened`, `ReopenPrompt` พิมพ์เหตุผล + ยืนยัน 2 ครั้ง) — Decision log "ถูกแทนที่โดยไม่ต้องถาม"
- ขึ้นกับ: E04-S09, E01-S04 (Soft Delete); ธงสถานะการจ่ายเงินแสดงผลใน E05-S05

## คำอธิบาย

การขายมีสามสถานะทางธุรกิจ Completed แล้วยังแก้ได้ตรง ๆ ขอเหตุผลสั้น ๆ เฉพาะเมื่อตัวเลขเงินเปลี่ยน

## Acceptance criteria

- [ ] Draft → Completed หรือ Draft → Cancelled; Cancelled เก็บเข่งไว้แต่ไม่นับในยอดใด ๆ (SALE-20)
- [ ] Completed แก้ได้โดยเจ้าของคนใดก็ได้ ไม่ต้อง "เปิดใหม่" (SALE-21, D-16)
- [ ] การแก้ที่เปลี่ยนเงิน (ยอดคนกรีด ส่วนแบ่งเจ้าของ ยอดรวม) → ขอเหตุผลสั้น ๆ (เลือกหรือพิมพ์) และติดธงสถานะการจ่ายเงินที่กระทบให้ตรวจใหม่ (SALE-21)
- [ ] การแก้ที่ไม่เปลี่ยนเงิน (เช่น หมายเหตุ) ไม่ถามเหตุผล
- [ ] ลบแบบกู้คืนได้ / กู้คืน การขายได้ ต่างจาก Cancelled (SYNC-10)
- [ ] เอาการปิด/เปิดกองและโซน และ `ReopenPrompt` ออก

## Offline / sync

- เปลี่ยนสถานะ/แก้ออฟไลน์ได้ Pending Sync
- เครื่องหนึ่ง Completed อีกเครื่อง Cancelled พร้อมกัน → Conflict ให้เจ้าของเลือก (SYNC-4)

## Test plan

- [ ] Vitest: Cancelled ไม่เข้ายอด; ตรวจว่า "เงินเปลี่ยน" ถูก (แก้น้ำหนัก/ราคา = ใช่, หมายเหตุ = ไม่); Soft Delete ≠ Cancelled
- [ ] jest-expo: ขอเหตุผลเฉพาะเมื่อเงินเปลี่ยน
- [ ] Playwright: Completed → แก้น้ำหนักเข่ง → ใส่เหตุผล → ธงขึ้น

## Verification

## Dev notes

## Code review

## QA notes

## คำถามเจ้าของ

- รายการเหตุผลสำเร็จรูปสำหรับแก้เงิน (เช่น "ชั่งผิด", "ผู้ซื้อแจ้งยอดต่าง", "ราคาผิด") — ขอรายการที่ต้องการ
- Completed ทำได้เมื่อไหร่: (a) ทุกเมื่อ · (b) ต้องมีราคาก่อน
