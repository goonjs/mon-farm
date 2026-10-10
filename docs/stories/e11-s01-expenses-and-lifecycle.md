# Story E11-S01: ค่าใช้จ่ายและวงจร Actual / Committed / Planned

Status: In Progress (เจ้าของตกลง AC 2026-10-03) — implemented on `feature/e11-e06-money`, awaiting independent review + CI

## Context

- Epic: `docs/epics/e11-finance.md`
- PRD: FIN-1, FIN-2, SYNC-9, SYNC-10, SYNC-12, NFR-3, NFR-5 · D-55, D-62, D-65
- ขึ้นกับ: E01 (event log + sync), E03-S02 (สวน)
- ใช้ป้ายจาก E01-S15 (สถานะข้อมูลรายฟิลด์ SYNC-12)
- ลำดับแรก (D-55) — ต่อด้วย E11-S02 แล้ว E11-S03 (D-62)

## คำอธิบาย

บันทึกค่าใช้จ่ายของสวนแบบแยกฟิลด์ (หมวด, สวน, วงจร) และเลื่อนวงจร
วางแผน → ผูกพันแล้ว → เกิดจริง ได้ เป็นฐานของทุก story ใน E11

## Acceptance criteria

- [ ] ค่าใช้จ่ายมีฟิลด์แยกกัน: รายการ, หมวด, สวน (ไม่บังคับ), จำนวนเงิน, วันที่, วงจร, หมายเหตุ, ใบเสร็จ/รูป — ไม่รวมเป็นฟิลด์เดียว (FIN-1)
- [ ] ฟอร์ม **บังคับแค่จำนวนเงิน + วันที่**; ฟิลด์อื่นว่างได้ (D-62)
- [ ] วงจร 3 แบบ: เกิดจริง · ผูกพันแล้ว · วางแผน; **ค่าเริ่มต้น = เกิดจริง**; เลื่อนวงจรได้โดยเก็บประวัติ (FIN-2, SYNC-9, D-62)
- [ ] รายการ **วางแผน** ใส่จำนวนเงินเป็น **"ไม่ทราบ"** ได้ (ไม่นับเป็น 0 เงียบ ๆ); เลื่อนเป็น ผูกพันแล้ว/เกิดจริง ต้องใส่จำนวนเงิน (D-62, SYNC-12)
- [ ] หมวดตั้งต้น: ปุ๋ย · ค่าแรง · น้ำมันตัดหญ้า · ยาฆ่าหญ้า · เดินทาง · เงินเดือนผู้จัดการ · ช่วยเหลือคนงาน · ซ่อมแซม/อุปกรณ์ · อื่น ๆ — แก้ชื่อ/เพิ่มได้ (D-62)
- [ ] ยอด "เกิดจริง" ไม่รวมรายการ วางแผน เด็ดขาด (FIN-2)
- [ ] ค่าใช้จ่าย "ผูกพันแล้ว" เป็นส่วนหนึ่งของการ์ด "รายการที่ต้องจ่าย" บนหน้าแรก (ร่วมกับเงินที่สวนต้องคืน — E11-S02; ตัวการ์ดอยู่ E13-S01) (D-65)
- [ ] แสดงผล: เกิดจริง = ทึบ, ผูกพันแล้ว = มีกรอบ, วางแผน = กรอบเส้นประ ทุกแบบมีป้ายคำ (design-system §12.9 ข้อ 9); วันที่แสดง พ.ศ. แตะสลับได้ (D-65)
- [ ] เงินเก็บเป็นสตางค์จำนวนเต็ม; ลบแบบกู้คืนได้ (NFR-3, SYNC-10)
- [ ] ข้อมูลการเงินเห็นเฉพาะสมาชิกกลุ่ม (NFR-5)
- [ ] ตัวกรองรายการค่าใช้จ่าย: วงจร · หมวด · สวน · เดือน; chip วางเรียงเต็มแถวก่อนขึ้นแถวใหม่ (ไม่ตกบรรทัดทั้งที่ด้านขวายังมีที่) (F4) (D-74)
- [ ] ทางเข้า "ค่าใช้จ่ายทั้งหมด" อยู่ทั้งในเมนู ☰ และหน้าหลัก (F5) (D-74)
- [ ] ตัวกรอง "ยังไม่บันทึกผู้จ่าย" + bulk ใส่ผู้จ่ายทีเดียวหลายรายการ (F7) (D-74)
- [ ] ตัวกรอง "ยังไม่ชำระคืนผู้จ่าย" → กรองผู้จ่ายเพิ่มอีกชั้น → bulk บันทึกชำระคืน ใส่ยอดได้ (คืนไม่เต็มจำนวน ตัดยอดเก่าสุดก่อน — D-67, E11-S03) (F7) (D-74)

## Offline / sync

- บันทึก/แก้/เลื่อนวงจรได้ออฟไลน์ → sync อัตโนมัติ
- แก้จำนวนเงินหรือวงจรของรายการเดียวกันซ้อนกัน → Conflict ไม่ทับเงียบ (SYNC-4, D-30)
- รูปใบเสร็จเก็บในเครื่องได้; อัปโหลดรออัปเกรด Blaze (D-48, E01-S12)

## Test plan

- [ ] Unit: ยอดรวมแยกตามวงจร — Planned ไม่เข้ายอดเกิดจริง; Planned "ไม่ทราบ" ไม่ถูกนับเป็น 0
- [ ] Unit: เลื่อนวงจรเก็บประวัติ; เลื่อน Planned ที่ไม่ทราบจำนวน → ต้องใส่จำนวนก่อน; จำนวนเงินเป็นสตางค์ ไม่มี float
- [ ] Component: ฟอร์มบันทึกได้ด้วยจำนวนเงิน + วันที่เท่านั้น, วงจรเริ่มต้นเกิดจริง, หมวดตั้งต้นครบ + เพิ่มหมวด
- [ ] Offline: สองเครื่องแก้จำนวนเงินรายการเดียวกัน → Conflict

## คำถามเจ้าของ

- หมวดค่าใช้จ่ายเริ่มต้นมีอะไรบ้าง? (หรือเริ่มว่าง แล้วเพิ่มเองตอนใช้)

**คำตอบเจ้าของ (2026-10-03) (D-62, D-65):**
- หมวดตั้งต้น → **จาก PRD** (ปุ๋ย ค่าแรง น้ำมันตัดหญ้า ยาฆ่าหญ้า เดินทาง เงินเดือนผู้จัดการ ช่วยเหลือคนงาน ซ่อมแซม/อุปกรณ์ อื่น ๆ) แก้/เพิ่มได้
- ฟอร์มบังคับแค่ **จำนวนเงิน + วันที่**; วงจรเริ่มต้น = **เกิดจริง**; รายการวางแผนใส่เงิน **"ไม่ทราบ"** ได้
- การ์ด "รายการที่ต้องจ่าย" = เงินที่สวนต้องคืน + ค่าใช้จ่ายที่ผูกพันแล้ว

## Verification

- Unit (Vitest): `src/core/finance/*.test.ts`, `src/store/finance.test.ts` · Component (Jest): `src/__tests__/finance.test.tsx` · Sandbox: `e2e/finance.spec.ts` (phone-portrait, offline) passed 2026-10-09 · Screenshots: `docs/ux/screenshots/overnight/money/`

## Dev notes

- Core: `src/core/finance/` (types, ledger, money) — pure, integer satang, string-parsed baht (no float). Records follow the architecture envelope (`targetId` + `baseEventId`); concurrent money/stage/payer edits from one base → conflict, totals keep the base value; an edit naming every head (`alsoBasedOn`) resolves it.
- Store: own append-only log `src/store/finance*.ts` (memory / web localStorage / native sqlite table `finance_events`), same idempotent-append rule as the sale log. Moves into the one `events` table when the envelope redesign lands (E04-S01); not in the outbox yet — sync is E01-S09.
- Screens: `/finance/expenses` (totals per stage, filters stage/category/month, F7 bulk payer, F7 unrepaid → payer → bulk repay), `/finance/expense/[id]` (form, stage moves with history, soft delete/restore, conflict pick). Entry from the front door and settings (F5; no ☰ menu exists yet).
- Not covered: receipt/photo (needs E01-S12 media queue); farm (สวน) picker — the field and filter exist, but no property store yet (E03-S02); home card itself (E13-S01, `payableSatang()` is ready).

## Code review

- Independent review (separate agent, 2026-10-09) on `f7b1373..804696d`: 4 major + 5 minor findings. Fixed: conflict detection now compares each guarded field's branch tips (not only direct siblings) and shows edits made while a conflict is open (#1, #2, confirmed by tests); one money write at a time per form via a ref guard (#3, double-tap test); netting's repayment and debt payment linked by id, compensated if the second write fails, voided together (#4); owner-share expense amount/date read-only in the expense form, conflict resolution uses projected heads (#5); fertilizer→other deletes the owner-share expense (#6); netting default capped at the balance with a message (#7); payment form waits for the log and reports save errors (#8); 0% fertilizer allowed (#9); new card capped by what is left after old S29 deductions. Open: `useSaleCounts` treats sales as live until loaded (brief window); D-72 piles page, rounding UI, D-61 blocking — listed under Dev notes.

## QA notes
