# Story E11-S08: กระแสเงินสดรายเดือนและเงินสำรอง

Status: In Progress — AC ตาม D-81 รอเจ้าของตรวจ

## Context

- Epic: `docs/epics/e11-finance.md`
- PRD: FIN-2, FIN-9, ANA-1
- ขึ้นกับ: E11-S01 ถึง E11-S07
- ใช้ป้ายจาก E01-S15 (สถานะข้อมูลรายฟิลด์ SYNC-12)

## คำอธิบาย

มุมมองพื้นฐานรายเดือน: เงินเข้า เงินออก สุทธิ ภาระที่จะมาถึง และตัวเลขเงินสำรอง
ที่เจ้าของกำหนดเอง พร้อมสมมติฐานและที่มา ไม่มีการพยากรณ์ขั้นสูง

## Acceptance criteria

- [ ] ตารางรายเดือน: เงินเข้า, เงินออก, สุทธิ — แยก เกิดจริง / ผูกพันแล้ว / วางแผน ด้วยรูปแบบ ทึบ / กรอบ / เส้นประ + ป้ายคำ (FIN-9, design-system §12.9 ข้อ 9)
- [ ] ภาระที่จะมาถึง: เงินเดือน, ผูกพันแล้ว, วางแผน, เงินที่ต้องคืนคงเหลือ (FIN-9)
- [ ] เงินสำรอง: เจ้าของใส่ตัวเลข + สมมติฐาน (ข้อความ) + ที่มา; ระบบไม่คำนวณเอง (FIN-9)
- [ ] ทุกตัวเลขเจาะลงถึงรายการต้นทางได้ (ANA-3)
- [ ] เดือนที่ข้อมูลไม่ครบ (เช่น สัญญาที่ "ไม่ทราบ") แสดงป้าย "ข้อมูลไม่ครบ" ไม่เติมตัวเลขเอง (SYNC-12)

## Offline / sync

- คำนวณจากข้อมูลในเครื่องทั้งหมด → ดูได้ออฟไลน์ (บนเว็บด้วย, D-19); แสดงจำนวนรายการ Pending Sync ที่อาจทำให้ตัวเลขเปลี่ยน

## Test plan

- [ ] Unit: รวมรายเดือนตามวงจร (Planned ไม่เข้ายอดเกิดจริง, ข้ามปี)
- [ ] Unit: เงินสำรองแสดงตามที่เจ้าของใส่ ไม่คำนวณเอง
- [ ] UI: ตาราง 12 เดือนบนเว็บ + มือถือ (screenshot)

## Verification

- Unit `plan.test.ts` (monthly in/out/net by stage, sources per month, incomplete months, reserve) · e2e `finance.spec.ts` (salary in out-actual, income in in-actual, incomplete month, reserve entry) · Screenshot 21

## Dev notes

- `/finance/cashflow`: two months back to three ahead; per month in (actual/planned) and out (actual/committed/planned) as solid/outlined/dashed cells with words, net actual and net-if-planned, "ข้อมูลไม่ครบ" when an amount is unknown (planned expense or lease), and a drill-down to every source record. Below: coming up (committed incl. salary, planned + unknown count, owed back) and the reserve — the owner's amount, assumption and source; the app never computes it.
- Not covered: a count of pending-sync records (sync not built, E01-S09) — a note says figures may change once devices sync.

## Code review

- Independent review (separate agent, 2026-10-09) on `feature/e11-e06-money..30322b3`: 9 findings. Fixed with tests: an invalid start month ("2025-13") made salary generation loop forever on every device — months are now validated and a bad rule is skipped (#1); rubber income dated by the local day, not UTC (#2); rent recorded against a lease replaces that month's expected rent (#3); cashflow generates salary to its own horizon (#4); moving an expense out of worker aid/travel clears worker/trip and aid totals check the category (#5); unknown lease start/share and unpriced closed sales flag their months (#6); overdue unpaid salary stays in "coming up" (#7); rule card shows the current amount; date/month inputs validated. Open: concurrent paid/undone, raises and reserve edits pick one silently (#8, D-30 Conflict not yet); "paid" records the scheduled amount (no paid-amount entry); trip split by % not offered (amounts only) and farms are typed names.

## QA notes
