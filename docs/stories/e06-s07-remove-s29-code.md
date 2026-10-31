# Story E06-S07: ลบโค้ดหักเงิน S29 เดิม (`deduction_added` / `deduction_voided`)

Status: Done (PR #93 merged cfd245d; independent review, CI green; owner ack in Push Ledger; follow-ups: two stale doc lines, dead deduction i18n keys)

## Context

- Epic: `docs/epics/e06-fertilizer.md`
- PRD: FERT-5, FERT-6 · D-58, D-65
- ที่มา: E06-S04 ข้อสุดท้าย ("ลบโค้ดเก่า (เดิม E06-S05)") ซึ่งถูกแยกออกจาก PR หักหนี้/หักกลบ (E06-S04, PR #87) ตามที่ตกลงกับ EM 2026-10-11 — การหักหนี้ใหม่ใช้ finance log (`debt_payment_recorded`) ครบแล้ว ไม่มีหน้าจอ v2 ใดเขียน `deduction_added` อีก
- ขึ้นกับ: E06-S04 (merged), E03-S06 (ถ้า `delete-guard.ts` ยังถูกอ้างถึง — ดูคำถามข้อ 2)
- เกี่ยวข้อง: E01-S16 (กฎห้ามลบโซนที่มีหักค้าง, D-44 — D-58 สั่งให้เอาออก), E05 epic ("เลิกใช้การปัดเศษแบบ hard-code (settle.ts)")

## Description

เก็บกวาดโค้ดและเอกสารของการหักเงินต่อการขายแบบ S29 (ยอดจ่ายติดลบได้ เก็บใน sale log) ที่ถูกแทนด้วยบัญชีหนี้คนงาน
(E06-S03) และการหักตอนสรุปเงิน (E06-S04) แล้ว ไม่เปลี่ยนพฤติกรรมที่ผู้ใช้เห็น

ขอบเขตโค้ดที่เกี่ยวข้อง (จาก grep ณ `dev` 0c97406 — ต้องตรวจซ้ำตอนเริ่มทำ):

- types: `deduction_added`, `deduction_voided` ใน `src/core/types.ts`; `Deduction`, `SaleState.deductions`; `WorkerSettlement.deductions/deductionSatang/payoutSatang` ใน `src/core/settle.ts`
- fold/คำนวณ: `src/core/project.ts` (case ของสอง event + `deductions` map), `src/core/settle.ts`, `src/core/point-settle.ts` (ดึง `state.deductions` เข้า payout), `src/core/sale-status.ts` (`MONEY_SYS`)
- store/guard: `src/core/delete-guard.ts` (กฎ D-44 อ่านการหักค้างของโซน), `src/store/record.ts`, `src/store/SaleProvider.tsx` (เรียก `assertAllowed`)
- ผู้ใช้ payout: `src/v2/money/sale/use-sale-money.ts` (`s29Satang`), `src/finance/use-sale-rounding.ts`
- test/fixture: `src/core/fixtures.ts` (`LogBuilder.deduct/voidDeduction`), `settle.test.ts`, `project.test.ts`, `soft-delete.test.ts`, `deduct.test.ts`
- เอกสาร: `docs/stories/s29-worker-deductions.md`, อ้างอิงใน `docs/stories/README.md`, e01-s04/e01-s16/e03-s02/e03-s04/e03-s06, `docs/prd.md`, `docs/architecture.md`

## Acceptance criteria

- [x] ไม่มีโค้ดใน `src/` ที่สร้าง อ่านเพื่อคำนวณเงิน หรืออ้างถึง `deduction_added` / `deduction_voided` / `SaleState.deductions` / `WorkerSettlement.deductions` (ยกเว้นตัวอ่านแบบทนข้อมูลเก่าตามข้อ 2 ถ้าเจ้าของเลือก)
- [x] log เก่าที่มี event สองชนิดนี้อยู่ในเครื่อง **ยังโหลดและ fold ได้ไม่ล้ม** และไม่ทำให้ตัวเลขเงินเพี้ยน (event ที่ไม่รู้จักถูกข้ามอย่างปลอดภัย) — มี test ด้วย log ที่มี event เก่าจริง (เจ้าของ: ข้อมูล S29 ไม่ย้าย ทิ้งได้ — D-65)
- [x] ยอดเงินของการขายทั้งชุด (ส่วนแบ่งคนกรีด/เจ้าของ/เงินสดต่อคน/เทียบยอด) **เท่าเดิมทุกสตางค์** ก่อน-หลังลบ สำหรับการขายที่ไม่มีการหัก S29
- [x] `delete-guard.ts` ไม่เหลือกติกา D-44 (ห้ามลบโซนที่มีหักค้าง): ลบทั้งไฟล์ หรือเหลือเฉพาะส่วนที่ E03-S06 ยังต้องใช้ (ตามข้อ 2); `SaleProvider.append` ไม่เรียก guard เดิม
- [x] `LogBuilder` และ test ที่ใช้ S29 ถูกลบหรือเขียนใหม่ให้ไม่พึ่งของเก่า; ไม่มี test ที่ถูกข้าม/ปิดเพื่อให้ผ่าน
- [x] เอกสาร: `s29-worker-deductions.md` ย้ายสถานะเป็น Superseded/Removed (หรือลบไฟล์ตามข้อ 1), ลิงก์ใน README/stories อื่นชี้ E06-S04 แทน, PRD/architecture ไม่บอกว่าหักเงินเก็บใน sale log
- [ ] `npm run verify` — typecheck, lint, vitest, jest, build:web ผ่าน; **e2e ยังไม่ได้รัน** (ไม่มี Chromium ที่ Playwright ต้องการใน sandbox) ต้องดู CI

## Offline / sync behavior

ไม่เพิ่ม event ใหม่ แต่ **แตะการอ่าน log**: เครื่องที่ยังไม่ sync อาจมี `deduction_added`/`deduction_voided` อยู่ใน outbox และ
เครื่องอื่นที่รันโค้ดเก่าอาจยังเขียนได้ชั่วคราว — ตัวอ่านต้องข้าม event ที่ไม่รู้จักโดยไม่ล้มและไม่ drop มันออกจาก log
(append-only: ห้ามลบ event ที่บันทึกแล้ว) ตรวจ sync ขาขึ้น/ลงว่ายังส่ง-รับ event ชนิดนี้ได้โดยไม่ตีความ

## Test plan

- [x] Unit: fold log ที่มี `deduction_added` + `deduction_voided` → ไม่ throw, `settle`/`settlePoints` ได้ตัวเลขเท่ากับ log เดียวกันที่ไม่มีสอง event นั้น
- [x] Unit: การขายตัวอย่างหลัก (แดง 3 จุด + นัด 2 จุด) ได้ตัวเลขเดิมทุกสตางค์ ก่อน-หลัง
- [x] Unit: types ไม่มีสอง event/ฟิลด์นั้น (typecheck คือหลักฐาน; grep ใน CI ได้ถ้าเจ้าของต้องการ)
- [ ] Sync: outbox ที่มีสอง event นี้ส่งขึ้นได้ครบ และ pull กลับมา fold ได้ (ถ้ามี test ฝั่ง sync อยู่แล้วให้ขยาย)
- [ ] e2e เดิมของ v2 ทั้งชุดผ่านโดยไม่แก้ expectation ของเงิน

## Verification

- [ ] Sandbox run: vitest 742 + jest 335 ผ่าน, build:web ผ่าน; e2e ไม่ได้รัน
- [ ] Screenshots: N/A — ไม่มี UI เปลี่ยน (ยืนยันด้วย e2e screenshot เดิมไม่เปลี่ยน)

## Dev notes

- ลำดับ commit จริงต่างจากที่แนะนำเล็กน้อย: เอา guard (D-44) ออกก่อนลบ types เพราะ guard อ่าน `state.deductions`. ตัวอ่านทนข้อมูลเก่า = `projectSale` ไม่มี `default` ใน switch จึงข้าม event ที่ไม่รู้จัก; test อยู่ใน `src/core/legacy-s29-events.test.ts`
- ลบ i18n key ที่ไม่มีใครอ่านแล้ว 3 ตัว (`settle.deductionAdd`, `log.deductionAdded`, `log.deductionVoided`)
- ไม่ได้ตรวจ sync ขาขึ้น/ลงด้วย test เพิ่ม: event ถูกส่งเป็นข้อมูลทึบ ไม่มีโค้ด sync ที่ตีความชนิด `deduction_*` (grep แล้วไม่พบ)

- ลำดับที่แนะนำ (ทีละ commit เล็ก): (1) test ล็อกตัวเลขเดิม + log เก่าที่ fold ได้ (2) เอาการอ่าน `state.deductions` ออกจาก `settle`/`point-settle`/`use-sale-money` (3) ลบ event/types + `project.ts` (4) `delete-guard.ts` + `SaleProvider`/`record.ts` (5) fixtures/test (6) เอกสาร
- `settle.ts` ทั้งไฟล์ยังถูก `use-sale-money` เรียกสำหรับการขายแบบกองเดิม (ไม่ใช่จุดชั่ง) — ถ้าจะเลิกใช้ทั้งไฟล์ (E05 epic) เป็นงานแยก ไม่รวมใน story นี้

## Code review

- Reviewer (separate agent/session):
- Findings:
- Resolution:

## QA notes

## คำถามเจ้าของ

ตอบแล้ว (เจ้าของ 2026-10-11):

1. **ลบไฟล์**: ลบ `docs/stories/s29-worker-deductions.md` และ `src/core/delete-guard.ts` ได้ (ทำแล้ว ไม่มีไฟล์อื่นถูกลบ)
2. **ตัวอ่านทนข้อมูลเก่า**: ข้าม event เก่าเฉยๆ — การขายเก่าที่ปิดไปแล้วอาจไม่มีรายการหัก S29 อีก (D-65: ข้อมูลเก่าทิ้ง ไม่ย้าย) แต่ log ต้องโหลดและ fold ได้ ตัวเลขอื่นไม่เปลี่ยน และ event ไม่ถูกลบออกจาก log
3. **D-44**: เลิกทั้งกติกา (D-58) ไม่มีกติกาทดแทน
