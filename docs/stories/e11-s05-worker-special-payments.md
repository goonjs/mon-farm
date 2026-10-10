# Story E11-S05: เงินช่วยเหลือพิเศษคนงาน

Status: In Progress — AC ตาม D-81 รอเจ้าของตรวจ

## Context

- Epic: `docs/epics/e11-finance.md`
- PRD: FIN-1, FIN-3, FIN-6
- ขึ้นกับ: E11-S01, E11-S02, E03 (คน: คนกรีด), E05 (ส่วนแบ่งการขาย — เพื่อแยกให้ชัด)

## คำอธิบาย

บันทึกเงินที่ให้คนงานนอกเหนือส่วนแบ่งการขาย 50% เช่น ช่วยเหลืออุบัติเหตุ
ไม่ปนกับสรุปเงินของการขาย

## Acceptance criteria

- [ ] บันทึกการจ่ายพิเศษ: คนงาน, ประเภท (ช่วยเหลืออุบัติเหตุ, ช่วยเหลือทั่วไป, อาหาร/ของ, อื่น ๆ), จำนวน, วันที่, ผู้จ่าย, หมายเหตุ (FIN-6)
- [ ] ไม่หักหรือเพิ่มในสรุปเงินของการขาย (E05) และไม่เปลี่ยนส่วนแบ่ง 50% (FIN-6)
- [ ] ผู้จ่ายที่ไม่ใช่เงินของสวน → สร้างเงินที่ต้องคืนตาม E11-S02 (FIN-4)
- [ ] ดูรายการจ่ายพิเศษต่อคนงานและรวมตามช่วงเวลาได้

## Offline / sync

- บันทึกได้ออฟไลน์ → sync อัตโนมัติ; แก้จำนวนซ้อนกัน → Conflict

## Test plan

- [ ] Unit: จ่ายพิเศษไม่กระทบยอดสรุปเงินของการขาย
- [ ] Unit: ผู้จ่ายเป็นอาจารย์สมหวัง → มีเงินที่ต้องคืน

## คำถามเจ้าของ

- เงินช่วยเหลือพิเศษเป็นการให้เปล่าเสมอ หรือบางครั้งเป็นเงินยืมที่คนงานต้องคืน? (ถ้ายืม ต้องมี story เพิ่ม)

## Verification

- Unit `plan.test.ts` (`aidByWorker` per worker and period; non-farm payer owed back) · Component `plan.test.tsx` (form records worker + kind) · Screenshot: covered by the expense form

## Dev notes

- A special payment is an expense in category ช่วยเหลือคนงาน with `worker` + `aidKind` (accident · general · food · other); it lives only in the finance log, so it never reaches a sale's settlement or the share. `/finance/aid` lists totals per worker over a date range, each opening its payments.

## Code review

- Independent review (separate agent, 2026-10-09) on `feature/e11-e06-money..30322b3`: 9 findings. Fixed with tests: an invalid start month ("2025-13") made salary generation loop forever on every device — months are now validated and a bad rule is skipped (#1); rubber income dated by the local day, not UTC (#2); rent recorded against a lease replaces that month's expected rent (#3); cashflow generates salary to its own horizon (#4); moving an expense out of worker aid/travel clears worker/trip and aid totals check the category (#5); unknown lease start/share and unpriced closed sales flag their months (#6); overdue unpaid salary stays in "coming up" (#7); rule card shows the current amount; date/month inputs validated. Open: concurrent paid/undone, raises and reserve edits pick one silently (#8, D-30 Conflict not yet); "paid" records the scheduled amount (no paid-amount entry); trip split by % not offered (amounts only) and farms are typed names.

## QA notes
