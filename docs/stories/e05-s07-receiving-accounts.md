# Story E05-S07: บัญชีรับเงิน + แสดงบัญชีให้คนรับซื้อยางดูตอนสรุปเงิน

Status: In Progress — AC ตาม D-81 รอเจ้าของตรวจ

## Context

- Epic: `docs/epics/e05-reconciliation-settlement.md` (story candidate จาก D-38)
- PRD: SET-4 · D-38, D-71, D-80
- ขึ้นกับ: E05-S04 (หน้าสรุปเงิน), E01 (ตั้งค่ากลุ่ม + sync)

## คำอธิบาย

เจ้าของสวนตั้งรายการบัญชีรับเงินไว้ล่วงหน้า (ธนาคาร และ/หรือ พร้อมเพย์) มีบัญชีค่าเริ่มต้น
ตอนสรุปเงิน เลือกได้ว่าจะรับยอดโอนเข้าบัญชีไหน (บันทึกไว้กับการขาย) และกดเปิดให้คนรับซื้อยางดูบัญชีที่จะโอนได้

## Acceptance criteria

- [ ] หน้าตั้งค่า **"บัญชีรับเงิน"**: เพิ่ม/แก้/ลบ (กู้คืนได้) หลายบัญชี; เลือก 1 บัญชีเป็นค่าเริ่มต้น (D-38)
- [ ] แต่ละบัญชีมี: ธนาคาร · เลขบัญชี · ชื่อบัญชี (ไม่บังคับครบถ้าใช้พร้อมเพย์อย่างเดียว) และ **พร้อมเพย์ (ไม่บังคับ)**: ประเภท (เบอร์มือถือ / เลขบัตรประชาชน) + หมายเลข (D-80)
- [ ] บัญชีต้องมี **ข้อมูลธนาคาร หรือ พร้อมเพย์ อย่างน้อยหนึ่งอย่าง** (หรือทั้งสอง) (คำตอบเจ้าของ 2026-10-09)
- [ ] **ลบบัญชีค่าเริ่มต้นได้ แต่ต้องยืนยันก่อน**; เมื่อไม่มีบัญชีค่าเริ่มต้น หน้าสรุปเงินให้เลือก: รับเงินสด · หมายเหตุว่าเข้าบัญชีไหน · หรือไม่กรอก (ไม่บังคับ) (คำตอบเจ้าของ 2026-10-09)
- [ ] **เปลี่ยนบัญชีค่าเริ่มต้นไม่ต้องยืนยัน** แต่ต้องเห็นผลชัดทันที (ป้าย/ลำดับเปลี่ยนให้เห็น) (คำตอบเจ้าของ 2026-10-09)
- [ ] ตรวจรูปแบบเลข: เบอร์มือถือ 10 หลัก, เลขบัตรประชาชน 13 หลัก (checksum); เลขบัญชีเป็นตัวเลขตามความยาวของธนาคาร
- [ ] หน้าสรุปเงิน: แสดงบัญชีที่จะรับยอดโอน (ค่าเริ่มต้น) เปลี่ยนได้; บัญชีที่เลือกบันทึกกับการขาย; ไม่บังคับ (D-38)
- [ ] ปุ่ม **"ให้คนรับซื้อยางดูบัญชี"** → หน้าจอแสดงเต็มจอ ตัวใหญ่ อ่านง่าย พร้อมยอดโอน (D-80):
  - บัญชีมีพร้อมเพย์ → แสดง **พร้อมเพย์ก่อน**; ถ้าเปิดใช้ QR ให้แสดง **QR พร้อมเพย์** ที่ฝังยอดเงิน
  - ไม่มีพร้อมเพย์ → แสดง ธนาคาร · เลขบัญชี · ชื่อบัญชี ชัด ๆ
  - สลับดูอีกแบบได้ (พร้อมเพย์ ↔ บัญชีธนาคาร) และเลือกได้ว่าจะแสดง QR หรือไม่
- [ ] ปุ่ม "ให้คนรับซื้อยางดูบัญชี" ใช้ได้หลัง **ถามปัดเศษ (หน้า 18) เสร็จ** เท่านั้น ยอดที่แสดง/ฝังใน QR คือยอดสุดท้ายหลังปัดเศษ (คำตอบเจ้าของ ?B1 2026-10-09)
- [ ] ระหว่างเปิดหน้าแสดงบัญชี **จอไม่ดับเอง**; ไม่ปรับความสว่างจอ (คำตอบเจ้าของ ?B2 2026-10-09)
- [ ] QR สร้างในเครื่อง (ออฟไลน์ได้) ตามมาตรฐาน PromptPay (EMVCo) ยอดเงินตรงกับยอดโอนเข้าเจ้าของสวนถึงสตางค์
- [ ] ข้อความไทย แนวตั้ง ใช้คำตาม `docs/ux/glossary.md` และกฎ D-70

## Offline / sync

- รายการบัญชีเป็นข้อมูลของกลุ่ม sync ทุกเครื่อง; แก้ซ้อนจากสองเครื่อง → ขัดกัน (D-30)
- หน้าแสดงบัญชีและ QR ใช้ได้ออฟไลน์ทั้งหมด

## Test plan

- [ ] Unit (TDD): ตรวจเลขพร้อมเพย์/เลขบัตร (checksum)/เลขบัญชี
- [ ] Unit (TDD): payload QR พร้อมเพย์ (มี/ไม่มียอด, เบอร์มือถือ/เลขบัตร) ตรงกับตัวอย่างมาตรฐาน + CRC ถูก
- [ ] Unit: เลือกบัญชีตอนสรุปเงินบันทึกกับการขาย; ไม่เลือก → ใช้ค่าเริ่มต้น/ว่างได้
- [ ] e2e: เปิด "ให้คนรับซื้อยางดูบัญชี" ออฟไลน์ → เห็น QR + ยอด

## คำถามเจ้าของ

- ?A1–?A3 (จาก mockup ฟาร์ม) ตอบแล้ว 2026-10-09 — ดู AC
- ?B1 ?B2 (จาก mockup การขาย) ตอบแล้ว 2026-10-09 ตามข้อเสนอ — ดู AC · "ไม่ระบุบัญชี" แทนด้วย รับเงินสด / หมายเหตุ / ไม่เลือก

## Verification

- Unit: `src/core/finance/promptpay.test.ts` (CRC check value; payload equals the two published go-promptpay vectors exactly; national-id tag; Thai id checksum; mobile; account length per bank), `accounts.test.ts` · Component: `src/__tests__/accounts.test.tsx` · Sandbox: `e2e/finance.spec.ts` accounts test (offline, portrait) · Screenshots 13–16 in `docs/ux/screenshots/overnight/money/`

## Dev notes

- Accounts, the default and each sale's choice are events in the finance log (`account_added/changed`, `account_default_set`, `sale_account_set`) — no sale-type change. Concurrent edits to bank/number/PromptPay conflict (D-30).
- `/finance/accounts` (settings → บัญชีรับเงิน): add/edit/delete (restorable); default sorts first with a ✓ badge; deleting the default asks first and leaves none. Settlement gets a "รับยอดโอนเข้า" card (accounts · cash · note · none) whose amount = owner share + route-3 debt repayments, and "ให้คนรับซื้อยางดูบัญชี" → `/finance/show-account`, large text, PromptPay first, switchable to bank.
- **Needs owner / lead decision:** drawing the QR image needs a QR renderer and ?B2 keep-awake needs `expo-keep-awake` — both new dependencies, not installed (dependency gate). The payload itself is built and tested; the screen shows a placeholder where the QR goes.
- Not covered: gating "show the buyer" on the rounding question (?B1) — E05-S02 not built, amount shown unrounded; bank list is the 8 common banks.
