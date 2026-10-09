# Story E11-S07: รายได้และสัญญาเช่าทุเรียน

Status: In Progress — AC ตาม D-81 รอเจ้าของตรวจ

## Context

- Epic: `docs/epics/e11-finance.md`
- PRD: FIN-8, FIN-10, SYNC-12
- ขึ้นกับ: E11-S01, E05 (ยอดเงินจากการขายที่สรุปแล้ว), E03 (สวน, ผู้เช่า)
- ใช้ป้ายจาก E01-S15 (สถานะข้อมูลรายฟิลด์ SYNC-12)

## คำอธิบาย

รวมรายได้ของสวน: ยางจากการขาย, ค่าเช่าทุเรียน และส่วนแบ่งในอนาคต
พร้อมบันทึกสัญญาเช่าเท่าที่สัญญาระบุ เงื่อนไขที่ไม่รู้เป็น "ไม่ทราบ"

## Acceptance criteria

- [ ] รายได้ยางดึงจากการขายที่สรุปเงินแล้ว (E05) อัตโนมัติ ไม่ต้องพิมพ์ซ้ำ และเจาะลงถึงการขายได้ (FIN-8)
- [ ] บันทึกสัญญาเช่า: สวน, ผู้เช่า, ค่าเช่า, งวดจ่าย, วันเริ่ม/สิ้นสุด, % ส่วนแบ่ง, ไฟล์สัญญา — ช่องที่ไม่รู้ = "ไม่ทราบ" (FIN-10, SYNC-12)
- [ ] ข้อมูลที่ยืนยันแล้วใส่ได้: ตะเคียนทอง 1,000,000 บาท/ปี ค่าเช่าอย่างเดียว; คลองพลู คาดว่าเริ่มปี 2029 + % ที่ "ไม่ทราบ" (FIN-8, PRD ข้อเท็จจริงของสวน)
- [ ] บันทึกรายได้ที่รับจริงแยกจากรายได้ที่คาดไว้ (เกิดจริง vs วางแผน) (FIN-2)
- [ ] แท็กการใช้เงินที่ตั้งใจได้: ค่าใช้จ่ายครอบครัว, ประกัน, เงินสำรองฟาร์ม (FIN-8)

## Offline / sync

- บันทึกสัญญา/รายได้ได้ออฟไลน์; รายได้ยางคำนวณจาก event การขายในเครื่อง → อัปเดตเมื่อการขายจากเครื่องอื่น sync เข้ามา

## Test plan

- [ ] Unit: รายได้ยางจากการขายที่สรุปแล้วเท่านั้น (Draft/Cancelled ไม่นับ)
- [ ] Unit: สัญญาที่มีช่อง "ไม่ทราบ" ไม่สร้างรายได้คาดการณ์จากการเดา

## คำถามเจ้าของ

- "รายได้ยาง" ของสวน = ยอดขายรวม หรือ เฉพาะส่วนแบ่งเจ้าของ (หลังแบ่งคนกรีด)?
- ค่าเช่าตะเคียนทองจ่ายงวดไหน (ปีละครั้ง / รายงวด) และวันที่ครบกำหนด?

## Verification

- Unit `plan.test.ts` (rubber income from closed, not-deleted sales; yearly lease expected each year; unknown rent flags months, never zero; received vs expected, tags) · e2e `finance.spec.ts` (lease with unknown rent, income tagged reserve) · Screenshot 20

## Dev notes

- Rubber income = owner share of each closed sale (`rubberIncome` over sale history), linked to the sale. Leases (`lease_added`) keep unknown rent/period/start/share as null = "ไม่ทราบ". Income (`income_recorded`) is actual or planned, optionally linked to a lease and tagged family · insurance · reserve. `/finance/income`.
- The confirmed facts (ตะเคียนทอง 1,000,000/ปี; คลองพลู from 2029, % unknown) are entered by the owner as leases — no farm names are built into code (D-73).
- Not covered: contract file attachment (E01-S12); editing a lease/income in the UI (core supports `lease_changed`/`income_changed`).

## Code review

## QA notes
