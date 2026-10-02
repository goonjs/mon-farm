# Epic E04: Sale weighing

Status: Draft
PRD: SALE, SYNC-5…7

## Goal
- Weigh a whole sale offline without ever losing the basket number.

## Scope
- Start: Farm → Zone/Tapper → point; multi-farm; any point order
- Sale header: buyer, date, manager auto, start time, notes, photos
- Price ฿/kg any time before settlement
- Zero/tare check per setting (every point / first per farm / skip, logged)
- Hold ~0.5–1 s = full basket; partial = scale reading − tare
- Continuous basket numbers across the sale
- Open partial basket; same tapper only; continue-or-start-new prompt
- "จบเข่งแล้ว / เป็นเศษ"; bridge display (20 + 30)
- Recorder mode (6 figures, portrait) ↔ public mode (big number, may rotate)
- Thai voice for basket numbers (toggle)
- Undo / edit / void baskets as events
- Bulk entry per point, marked บันทึกย้อนหลัง, photo of paper
- Handoff ส่งต่อ/รับช่วง offline; QR merge at close
- Duplicate detection (7–10 s) + overlap timeline
- Draft / Completed / Cancelled; edit Completed with reason if money changes
- Fix S32 multi-finger count bug

## Open
- 
