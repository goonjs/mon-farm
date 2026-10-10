# Story E05-S06: รายการการขายย้อนหลัง + รายละเอียด

Status: In Progress — AC ตาม D-81 รอเจ้าของตรวจ (บางส่วน)

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

- Unit: `src/core/finance/history.test.ts` (row from the worked example to the satang; no price → no amount; deleted out of list and totals) · Sandbox: `e2e/finance.spec.ts` history test · Screenshot `docs/ux/screenshots/overnight/money/18-sale-history.png`

- [ ] Sandbox run:
- [ ] Screenshots (UI) — golden path:
- [ ] Screenshots (UI) — edge cases:

## Dev notes

- `/history` (front door → ประวัติการขาย): rows newest first with date (พ.ศ.), buyer, kg, baskets, price, amount, owner share, open/closed, "on this device, not synced"; totals exclude deleted sales; link to the deleted list; tap → settlement (SET-7 detail) or counter if still open. Amounts come from `settle()`, so history cannot disagree with settlement.
- Not covered (depends on stories not built): check status (E05-S03), payment summary (E05-S05), Cancelled shown apart (E04-S11), real sync status (E01-S09); SET-7 detail fields not yet on the settlement screen (rounding is, receiving account is; media is not).

## Code review

- Independent review (separate agent, 2026-10-09) on `feature/e11-e06-money..42a8e26` → `4ed90d8`: 3 major + 7 minor. Fixed with tests: PromptPay payload refuses a non-positive/fractional amount and the buyer screen refuses a bad one (#1); rounding default remembered for the whole group per D-67, not per device (#2); a sale's account is recorded when shown to the buyer, and "following today's default" is told apart from "recorded" (#3); deleting the default writes "no default" so a restore does not revive it (#4); the rounding ✓ is now computed against the sale total (#5); in-flight guards on account writes (#7); one debt projection for both cards (#8); unpriced sales counted apart in history (#9); stale docs (#10). Open: concurrent rounding/default choices keep one silently (#6, SYNC-4).

- Reviewer (agent/session แยก):
- Findings:
- Resolution:

## QA notes

## คำถามเจ้าของ

**คำตอบเจ้าของ (2026-10-03) — จาก mockup `docs/ux/mockups/flow-v1.html`:**
- ?4 รายการการขายทั้งหมด → **เป็นหน้าแยก; ตอนนี้เข้าจากหน้าแรก "ดูการขายทั้งหมด"** (หน้าแรกจะออกแบบใหม่ E13-S01)
