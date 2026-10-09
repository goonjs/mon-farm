# Story E11-S04: เงินเดือนผู้จัดการสวน

Status: In Progress — AC ตาม D-81 รอเจ้าของตรวจ

## Context

- Epic: `docs/epics/e11-finance.md`
- PRD: FIN-2, FIN-5, FIN-9
- ขึ้นกับ: E11-S01, E11-S02

## คำอธิบาย

เงินเดือนอาจารย์สมหวัง 15,000 บาท/เดือน เจ้าของจ่าย สร้างเป็นรายการประจำเดือน
แยกจากเงินที่ท่านสำรองจ่ายแทนสวน

## Acceptance criteria

- [ ] ตั้งเงินเดือนประจำ: ผู้รับ, จำนวน 15,000 บาท, ผู้จ่าย = เจ้าของ, วันเริ่ม (FIN-5)
- [ ] ระบบสร้างรายการเดือนที่จะถึงเป็น ผูกพันแล้ว และเจ้าของกด "จ่ายแล้ว" → เกิดจริง (FIN-2)
- [ ] เงินเดือนไม่ปนกับเงินที่ต้องคืนอาจารย์สมหวัง — แสดงแยกกัน (FIN-5)
- [ ] เงินเดือนที่จะถึงแสดงในกระแสเงินสด (FIN-9, E11-S08)
- [ ] เปลี่ยนจำนวนเงินมีผลตั้งแต่เดือนที่เลือก ไม่แก้เดือนที่จ่ายแล้ว

## Offline / sync

- รายการรายเดือนสร้างจากกฎในเครื่อง (ไม่ใช่ event ซ้ำทุกเครื่อง) → ไม่เกิดรายการซ้ำเมื่อหลายเครื่อง sync
- "จ่ายแล้ว" เป็น event; กดซ้ำจากสองเครื่อง → นับครั้งเดียว

## Test plan

- [ ] Unit: สร้างรายการรายเดือนจากกฎ (เริ่มกลางเดือน, เปลี่ยนจำนวน, ข้ามปี)
- [ ] Offline: สองเครื่องกด "จ่ายแล้ว" เดือนเดียวกัน → รายการเดียว

## คำถามเจ้าของ

- จ่ายเงินเดือนวันที่เท่าไรของเดือน และเริ่มเดือนไหน (บันทึกย้อนหลังไหม)?
- เจ้าของจ่ายเงินเดือนเป็น "เงินที่ต้องคืนเจ้าของ" (FIN-4) ด้วยไหม?

## Verification

- Unit `plan.test.ts` (months committed→actual, owner-paid salary owed back apart from the manager's own reimbursements, two-device paid counts once, raise from a month never rewrites a paid month, part of "to pay") · Component `plan.test.tsx` · e2e `finance.spec.ts` salary test · Screenshot 19

## Dev notes

- Rule `salary_set` (recipient, payer default chosen by owner, amount, first month, due day) and `salary_amount_set` from a month. Each month up to next month is synthesised as an expense `salary-<id>:<YYYY-MM>` (committed; `salary_paid` → actual at the amount paid) — made from the rule on every device, never stored, so sync cannot duplicate months. `/finance/salary` (from the expense list).
- Months are listed up to next month only; later months appear as time passes. Amount/date of a salary month are read-only in the expense form (edited via the rule).

## Code review

- Independent review (separate agent, 2026-10-09) on `feature/e11-e06-money..30322b3`: 9 findings. Fixed with tests: an invalid start month ("2025-13") made salary generation loop forever on every device — months are now validated and a bad rule is skipped (#1); rubber income dated by the local day, not UTC (#2); rent recorded against a lease replaces that month's expected rent (#3); cashflow generates salary to its own horizon (#4); moving an expense out of worker aid/travel clears worker/trip and aid totals check the category (#5); unknown lease start/share and unpriced closed sales flag their months (#6); overdue unpaid salary stays in "coming up" (#7); rule card shows the current amount; date/month inputs validated. Open: concurrent paid/undone, raises and reserve edits pick one silently (#8, D-30 Conflict not yet); "paid" records the scheduled amount (no paid-amount entry); trip split by % not offered (amounts only) and farms are typed names.

## QA notes
