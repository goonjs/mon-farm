# Story E11-S06: การเดินทางหลายวัตถุประสงค์

Status: In Progress — AC ตาม D-81 รอเจ้าของตรวจ

## Context

- Epic: `docs/epics/e11-finance.md`
- PRD: FIN-7, OPS-13
- ขึ้นกับ: E11-S01, E11-S02, E01-S12 (คิวสื่อ)

## คำอธิบาย

บันทึกทริปเดินทางหนึ่งครั้งที่มีหลายวัตถุประสงค์และหลายสวน เป็นต้นทุนรวมก้อนเดียว
การแบ่งให้สวนทำได้แต่ไม่บังคับ

## Acceptance criteria

- [ ] ทริปมี: วันที่, ต้นทาง/ปลายทาง, วัตถุประสงค์ (เลือกได้หลายข้อ), สวนที่เกี่ยวข้อง (หลายสวน), ค่าใช้จ่ายย่อย (น้ำมัน, ทางด่วน, ที่พัก, อาหาร, อื่น ๆ), ใบเสร็จ/รูป, หมายเหตุ (FIN-7)
- [ ] บันทึกเป็นต้นทุนรวมก้อนเดียวได้โดยไม่ต้องแบ่ง (FIN-7)
- [ ] ถ้าต้องการ แบ่งต้นทุนให้สวนได้ (จำนวนหรือ %) ผลรวมต้องเท่ายอดทริป; ไม่แบ่ง = แสดง "ไม่ได้แบ่ง" ไม่แบ่งเองอัตโนมัติ (FIN-7)
- [ ] ผู้จ่ายและเงินที่ต้องคืนทำงานเหมือนค่าใช้จ่ายทั่วไป (FIN-3, FIN-4)

## Offline / sync

- บันทึกทริปและรูปใบเสร็จได้ออฟไลน์; รูปเข้าคิวอัปโหลด

## Test plan

- [ ] Unit: แบ่งต้นทุน — ผลรวมต้องเท่ายอด; ไม่แบ่งไม่สร้างตัวเลขต่อสวน
- [ ] Offline: บันทึกทริปพร้อมรูปตอนออฟไลน์ แล้ว sync

## Verification

- Unit `plan.test.ts` (`checkTrip`: lines sum, split must add up, unsplit allowed) · Component `plan.test.tsx` (trip total from lines, split error, saved split)

## Dev notes

- A trip is a travel expense with `trip` {from, to, purposes, farms, cost lines (fuel · toll · lodging · food · other), split | null}. With cost lines the amount is their sum; "ไม่ได้แบ่ง" by default, never split automatically; a split must equal the trip.
- Not covered: farms are typed names (no property store yet, E03-S02); receipt photos (E01-S12).

## Code review

- Independent review (separate agent, 2026-10-09) on `feature/e11-e06-money..30322b3`: 9 findings. Fixed with tests: an invalid start month ("2025-13") made salary generation loop forever on every device — months are now validated and a bad rule is skipped (#1); rubber income dated by the local day, not UTC (#2); rent recorded against a lease replaces that month's expected rent (#3); cashflow generates salary to its own horizon (#4); moving an expense out of worker aid/travel clears worker/trip and aid totals check the category (#5); unknown lease start/share and unpriced closed sales flag their months (#6); overdue unpaid salary stays in "coming up" (#7); rule card shows the current amount; date/month inputs validated. Open: concurrent paid/undone, raises and reserve edits pick one silently (#8, D-30 Conflict not yet); "paid" records the scheduled amount (no paid-amount entry); trip split by % not offered (amounts only) and farms are typed names.

## QA notes
