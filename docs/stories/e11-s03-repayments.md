# Story E11-S03: บันทึกการคืนเงินและยอดคงเหลือ

Status: In Progress (เจ้าของตกลง AC 2026-10-03) — implemented on `feature/e11-e06-money`, awaiting independent review + CI

## Context

- Epic: `docs/epics/e11-finance.md`
- PRD: FIN-1, FIN-4, NFR-3 · D-59, D-60, D-62
- ขึ้นกับ: E11-S02
- **อยู่ในลำดับแรก ทำต่อหลัง E11-S02** (D-62)
- ใช้ต่อโดย: E06-S04 (การหักกลบตอนสรุปเงินบันทึกเป็นการคืนแยกจากการหักหนี้ — D-60)

## คำอธิบาย

บันทึกการคืนเงินให้ผู้ที่สำรองจ่าย (หรือผู้ให้คนกรีดยืม) แบบทั้งหมด บางส่วน ผ่อน หรือภายหลัง
และเห็นยอดคงเหลือที่ถูกต้องเสมอ

## Acceptance criteria

- [ ] บันทึกการคืน: จำนวน, วันที่, หมายเหตุ ต่อรายการเงินที่ต้องคืน — คืนได้หลายครั้ง (FIN-4)
- [ ] การคืนระบุ **ใครคืนให้ใคร**: ผู้คืน (ค่าเริ่มต้น = เงินสวน) และผู้รับ (ค่าเริ่มต้น = คนที่ต้องได้คืน) เลือกเปลี่ยนได้ — ใช้กับเงินยืมของคนกรีดที่ผู้ให้ไม่ใช่เงินสวนด้วย (D-59)
- [ ] คืนครั้งเดียวครอบคลุมหลายรายการของคนเดียวกันได้ — ตัดรายการเก่าสุดก่อน เปลี่ยนการตัดเองได้; หนี้ที่คนกรีดยืมคนอื่น ไม่ใช่เงินที่สวนต้องคืน — บันทึกการคืนในบัญชีหนี้คนงาน (E06-S03) (D-69 แทน D-67 ข้อนี้)
- [ ] ยอดคงเหลือ = ยอดเดิม − ผลรวมที่คืนแล้ว; สถานะ ค้าง / คืนบางส่วน / คืนครบ (FIN-1, FIN-4)
- [ ] คืนเกินยอดคงเหลือไม่ได้ (แจ้งเตือนก่อนบันทึก)
- [ ] การหักกลบตอนสรุปเงิน (E06-S04, D-60) บันทึกเป็นการคืนรายการหนึ่ง อ้างถึงการขายนั้น — แยกจากรายการหักหนี้
- [ ] แก้/ลบ (กู้คืนได้) การคืนได้ ยอดคงเหลือคำนวณใหม่จาก log พร้อมประวัติ
- [ ] ทุกตัวเลขเจาะลงถึงค่าใช้จ่าย/รายการหนี้ และการคืนต้นทางได้ (NFR-3)

## Offline / sync

- การคืนเป็น event แบบเพิ่ม → บันทึกออฟไลน์ได้; สองเครื่องคืนพร้อมกันจนเกินยอด → ติดธงให้เจ้าของตรวจ ไม่ทับเงียบ

## Test plan

- [ ] Unit: ยอดคงเหลือ/สถานะ (บางส่วน, ผ่อนหลายงวด, คืนครบ); คืนเกิน → ถูกปฏิเสธ
- [ ] Unit: ใครคืนให้ใคร — ค่าเริ่มต้น และเปลี่ยนผู้คืน/ผู้รับ
- [ ] Unit: การหักกลบจากการขาย → การคืน 1 รายการ อ้างการขาย; ยกเลิกการขาย → การคืนยกเลิกตาม (D-67)
- [ ] Offline: สองเครื่องคืนพร้อมกันเกินยอด → ติดธง

## คำถามเจ้าของ

- ต้องคืนรวมครั้งเดียวให้หลายรายการของคนเดียวกันไหม? ถ้าใช่ แบ่งให้รายการเก่าสุดก่อนเป็นค่าเริ่มต้นได้ไหม (story นี้ยังไม่รวม)

**คำตอบเจ้าของ (2026-10-03) (D-59, D-60, D-62):**
- E11-S03 **ทำต่อหลัง S02 ในลำดับแรก**
- เงินยืมคนกรีดที่ผู้ให้ไม่ใช่เงินสวน → สวนต้องคืนผู้นั้น; **ตอนคืนเลือกได้ว่าใครคืนให้ใคร**
- เงินที่สวนต้องคืนคนกรีด หักกลบตอนรับส่วนแบ่งได้ (เจ้าของกดใช้เอง) — บันทึกการคืนกับการหักแยกกัน

**คำถามค้าง:**
- ✅ (เจ้าของตอบ 2026-10-03) คำถามเดิมข้างบน (คืนรวมครั้งเดียวหลายรายการ / แบ่งให้รายการเก่าสุดก่อน) ยังไม่ได้คำตอบ → **คืนครั้งเดียวหลายรายการได้ ตัดรายการเก่าสุดก่อน** (เปลี่ยนการตัดเองได้)
- ✅ (เจ้าของตอบ 2026-10-03) "ใครคืนให้ใคร": ถ้า **คนกรีดคืนผู้ให้ยืมโดยตรง** (ไม่ผ่านสวน) ให้บันทึกเป็น (a) การคืนของสวนต่อผู้ให้ + การจ่ายคืนหนี้ของคนกรีด พร้อมกันในครั้งเดียว · (b) แค่ปิดรายการเงินที่สวนต้องคืนผู้ให้ ส่วนหนี้คนกรีดแก้แยกเอง → **บันทึกครั้งเดียว ปิดทั้งสองฝั่ง** — หนี้คนกรีดลด + สวนไม่ต้องคืนผู้ให้ยืมส่วนนั้น

## Verification

- Unit (Vitest): `src/core/finance/*.test.ts`, `src/store/finance.test.ts` · Component (Jest): `src/__tests__/finance.test.tsx` · Sandbox: `e2e/finance.spec.ts` (phone-portrait, offline) passed 2026-10-09 · Screenshots: `docs/ux/screenshots/overnight/money/`

## Dev notes

- `repayment_recorded` with from/to (default farm funds → payee, both changeable), amount, date, note, allocations, `saleId` (for D-60 netting). `allocateOldestFirst()` + manual split; over-repay refused before save; two devices over-repaying → `overpaid` flag.
- Repayments can be deleted (restorable) from the owed page; balances recompute from the log.
- Not covered: editing a repayment in place from the UI (core supports `repayment_changed`; UI offers delete + re-record); netting at settlement written by E06-S04.

## Code review

- Independent review (separate agent, 2026-10-09) on `f7b1373..804696d`: 4 major + 5 minor findings. Fixed: conflict detection now compares each guarded field's branch tips (not only direct siblings) and shows edits made while a conflict is open (#1, #2, confirmed by tests); one money write at a time per form via a ref guard (#3, double-tap test); netting's repayment and debt payment linked by id, compensated if the second write fails, voided together (#4); owner-share expense amount/date read-only in the expense form, conflict resolution uses projected heads (#5); fertilizer→other deletes the owner-share expense (#6); netting default capped at the balance with a message (#7); payment form waits for the log and reports save errors (#8); 0% fertilizer allowed (#9); new card capped by what is left after old S29 deductions. Open: `useSaleCounts` treats sales as live until loaded (brief window); D-72 piles page, rounding UI, D-61 blocking — listed under Dev notes.

## QA notes
