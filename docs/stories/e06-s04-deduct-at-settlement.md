# Story E06-S04: หักหนี้ตอนสรุปเงิน ไม่เกินส่วนแบ่ง ยกยอด

Status: Review (เจ้าของตกลง AC 2026-10-03 · ยืนยัน mockup หน้า 17/17a 2026-10-14) — v2 settlement screen on `dev`; fixes on `fix/e06-s04-deduct-v2`; open: F1 cancelled sales (E04-S11), F2 two-device duplicate

## Context

- Epic: `docs/epics/e06-fertilizer.md`
- PRD: FERT-5, FERT-6, SET-4, SET-5, SET-6, SET-7, FIN-4 · D-18, D-37, D-54, D-58, D-59, D-60, D-61, D-65, D-71, D-72, D-85
- แทน: S29 (`deduction_added` ต่อการขาย ยอดจ่ายติดลบได้) — ฟอร์มและการคำนวณใน `settle.ts`
- **รวมงานลบโค้ดเก่าจาก E06-S05** (ยกเลิกแล้ว — D-65): ข้อมูล S29 ไม่ย้าย (E03-S01: เริ่มใหม่ ทิ้งของเดิม)
- ขึ้นกับ: E06-S03 (บัญชีหนี้คนงาน), E05-S01, E05-S02 (ปัดเศษ), E05-S04 (หน้าสรุปเงิน), E11-S02/S03 (เงินที่สวนต้องคืน + บันทึกการคืน — สำหรับการหักกลบ)
- mockup: หน้า 17 "สรุปยอดส่วนแบ่ง" (D-60 แทนแนวหน้า 18 "หักค่าปุ๋ย" / หน้า 19 "หักเงินเป็นขั้นแยก")

## คำอธิบาย

ที่หน้าสรุปยอดส่วนแบ่ง เจ้าของกด "หักเงินคืนหนี้" แอปเสนอยอดหักจากบัญชีหนี้คนงาน แก้ได้ แต่ไม่เกินส่วนแบ่ง
ของคนงานในการขายนั้น ส่วนที่หักไม่ได้ยกไปงวดถัดไป แล้วค่อยปัดเศษ เงินสดไม่ติดลบเด็ดขาด

## Acceptance criteria

- [x] หน้า 17 (สรุปยอดส่วนแบ่ง) การ์ดคนงานที่มียอดค้าง มีปุ่ม **"หักเงินคืนหนี้"**; กดแล้วเพิ่มบรรทัด **"หักหนี้"** (D-60)
- [x] หักได้ **เฉพาะหนี้ที่ติดสวน** (ผู้ให้ = เงินสวน รวมค่าปุ๋ยและอื่น ๆ ที่ติดสวน); หนี้ที่ยืมคนอื่นหักตอนสรุปเงินไม่ได้ (D-69)
- [x] ยอดเสนอ = งวดผ่อน (ถ้ามีแผน — งวดละการขาย) หรือยอดค้างทั้งหมด แล้วตัดที่ส่วนแบ่งคนงาน (FERT-6, D-59)
- [x] แก้ยอดหักได้ 0 ถึงเพดาน (= min(ยอดค้าง, ส่วนแบ่ง)); เกินเพดานกดบันทึกไม่ได้ ส่วนที่เหลือยกไป (D-18)
- [ ] เมื่อเจ้าของใช้การหักกลบ: ใช้ **บางส่วน** ของเงินที่สวนต้องคืนได้ (แก้ยอด) และเพดานหักหนี้ขยายเป็น **ส่วนแบ่ง + เงินที่สวนคืนครั้งนี้**; การขายถูกยกเลิก/ลบ → การคืนจากการหักกลบยกเลิกตาม (D-67)
- [x] หลังเลือกหักหนี้ เลือก **วิธีรับเงินคืนหนี้แยกต่อคนกรีด** 3 ทาง (D-71): (1) ดึงเงินสดจากส่วนแบ่ง · (2) ให้คนซื้อแบ่งเงินสดเป็นกองคนกรีด + กองคืนเจ้าของ · (3) ให้คนซื้อโอนรวมมากับส่วนเจ้าของ
- [x] ทาง (1): แอปคำนวณว่าต้องแตกแบงค์/เหรียญไหม โดยถือว่ากองเงินสดจากคนซื้อใช้แบงค์ใหญ่สุดให้เต็มก่อน (1000/500/100/50/20 · 10/5/2/1); ถ้าดึงยอดหักออกจากกองนั้นพอดีไม่ได้ → ขึ้นเตือน "ต้องแตกเงิน" (D-71)
- [x] ทาง (3): ยอดโอนเข้าบัญชีเจ้าของ = ส่วนเจ้าของ + เงินคืนหนี้ของคนกรีดที่เลือกทางนี้; กองเงินสดคนกรีดลดลงเท่ายอดหัก (D-71)
- [x] ทุกทางบันทึกรายรับและการคืนหนี้ถูกต้อง: การคืนเข้าบัญชีหนี้คนงาน (E06-S03) ยอดเท่ากันทุกทาง; ต่างกันแค่เงินเข้ามาทางไหน (เงินสด/โอน) (D-71)
- [ ] **หน้าเทียบยอดกับยอดขายทั้งหมด** (D-72): แสดงทุกกอง — เงินสดคนกรีดแต่ละคน, กองคืนหนี้ (ทาง 2), เงินสดที่ดึงคืนหนี้ (ทาง 1), ยอดโอนเจ้าของรวมเงินคืนหนี้ (ทาง 3), เงินสดเข้าสวน, ส่วนปรับปัดเศษ — รวมกัน **= ยอดขายทั้งหมด ตรงถึงสตางค์**; ไม่ตรง → แสดงส่วนต่างเป็นสีเตือน ปิดการขายไม่ได้
- [x] **ปัดเศษหลังหัก**: ลำดับ = ส่วนแบ่ง → หักหนี้ → ปัดเศษ (E05-S02) → เงินสดที่ต้องจ่าย (D-60)
- [x] เงินสดที่ต้องจ่าย = ส่วนแบ่ง − หักหนี้ (± ปัดเศษ) ไม่ต่ำกว่า 0 (D-18)
- [x] คนงานที่สวนต้องคืนเงิน (E11-S02) → แอป **เสนอ** "นำเงินที่สวนต้องคืนมาหักกลบ" — **เจ้าของกดใช้เอง** ไม่ใช้อัตโนมัติ; เมื่อใช้ บันทึกเป็นการคืน (E11-S03) **แยกจาก** การหักหนี้ แต่คิดรวมในยอดที่คนงานรับครั้งนี้ (D-60)
- [x] การหักเข้าบัญชีหนี้ (E06-S03); ยอดคงเหลือแสดงบนหน้าสรุปเงินและบันทึกการขาย (SET-7)
- [ ] การขายที่ **Cancelled หรือถูกลบ** → การหักของการขายนั้นไม่ลดยอดค้าง (กู้คืน → กลับมานับ)
- [x] แก้การขายแล้วส่วนแบ่งลดจนยอดหักเกินส่วนแบ่ง → ติดธง **"หักเกินส่วนแบ่ง"** — **ปิดการขาย/ติ๊กจ่ายไม่ได้** จนเจ้าของแก้ยอดหัก; ไม่ปรับเงินเงียบ ๆ (D-61)
- [x] ยอดขายรวม และส่วนแบ่งเจ้าของ ไม่เปลี่ยนเพราะการหัก
- [x] ลบโค้ดเก่า (เดิม E06-S05): `deduction_added`/`deduction_voided`, `WorkerSettlement.deductions`, ฟอร์มหักเงิน S29 และ test ที่เกี่ยวข้อง; ถ้า `src/core/delete-guard.ts` ยังอยู่ (E03-S06 ยังไม่ทำ) เอาส่วนที่อ่าน deduction ออกด้วย ไม่เหลือกติกา D-44 (D-58) (ขอยืนยันก่อนลบไฟล์)

## Offline / sync

- เพดานคำนวณจากข้อมูลในเครื่อง; ออฟไลน์ได้
- สองการขายหักจากยอดค้างเดียวกันบนสองเครื่องออฟไลน์ → หลัง sync ยอดค้างอาจติดลบ: แสดงเตือนให้เจ้าของแก้ ไม่ปรับเงียบ ๆ
- แก้ยอดหักของการขายเดียวกันซ้อนจากสองเครื่อง → Conflict (D-30); ระหว่าง Conflict ปิดการขาย/จ่ายไม่ได้ (D-29)
- การแก้การขายที่ sync เข้ามาจนเกิด "หักเกินส่วนแบ่ง" → ธงตาม D-61 บนทุกเครื่อง

## Test plan

- [ ] Unit: ยอดค้าง > ส่วนแบ่ง → หักเท่าส่วนแบ่ง, เงินสด 0, ที่เหลือยกไป
- [ ] Unit: มีแผนผ่อน → เสนองวด; ไม่มี → เสนอยอดค้างทั้งหมด
- [ ] Unit: ปัดเศษคิดจากยอดหลังหัก — ทั้ง 3 ตัวเลือก ยอดรวมตรง (NFR-3)
- [ ] Unit: หักกลบ — ไม่กด = ไม่มีรายการคืน; กดใช้ = รายการคืน 1 รายการ + รายการหักแยก
- [ ] Unit: การขาย Cancelled/ลบ → การหักไม่ลดยอดค้าง; กู้คืน → นับอีกครั้ง
- [ ] Unit: แก้เข่งจนส่วนแบ่ง < ยอดหัก → ธงหักเกินส่วนแบ่ง; ปิด/ติ๊กจ่ายถูกขวาง; แก้ยอดหัก → ธงหาย
- [ ] Unit: หักซ้อนจากสองเครื่อง → เตือนยอดค้างติดลบ
- [ ] Unit: types ไม่มี `deduction_added`/`deduction_voided`/`WorkerSettlement.deductions`
- [ ] Unit: ทาง (1) ส่วนแบ่ง 2,860 หัก 500 → ไม่ต้องแตก; หัก 300 จากกอง 1000+1000+500+100+100+100+50+10 → ไม่ต้องแตก; หัก 30 จากกอง 1000+50 → เตือนแตกเงิน
- [ ] Unit: ทาง (3) ยอดโอนเจ้าของ = ส่วนเจ้าของ + เงินคืน; ยอดรวมเงินเข้า (เงินสด+โอน) = ยอดขาย (NFR-3)
- [ ] Unit: 3 ทางให้ยอดคงเหลือในบัญชีหนี้เท่ากัน
- [ ] **TDD ทุกกรณี (D-72):** test เขียนก่อนโค้ด ครบทุกชุด วิธีรับเงิน (1/2/3 ต่อคนกรีด รวมผสมกันในการขายเดียว) × ปัดเศษ 3 แบบ × มี/ไม่มีหักกลบ × การขายยกเลิก/ลบ/กู้คืน — ทุกชุด assert ว่า Σ กอง = ยอดขาย (NFR-3) และยอดค้างในบัญชีหนี้ถูกต้อง
- [ ] e2e: หน้า 17 กด "หักเงินคืนหนี้" → แก้ยอดเกินเพดาน → บันทึกไม่ได้

## Verification

Partly met, left open (owner 2026-10-14):
- AC "เมื่อเจ้าของใช้การหักกลบ … การขายถูกยกเลิก/ลบ → ยกเลิกตาม" and AC "การขายที่ Cancelled หรือถูกลบ": **deleted** sales stop counting and come back on restore; **cancelled** does not yet (review F1) — `useSaleCounts` reads only `deleted`, and nothing can cancel a sale until E04-S11.
- AC "หน้าเทียบยอด" (D-72): the tally adds every pile and blocks on a difference, but its piles come from the same deductions it checks (review F5), so it catches only a few kinds of mismatch.
- Offline: the same deduction re-entered on two offline phones adds up after sync with no Conflict (review F2); close is blocked only if the total passes the share.

- [x] Unit (vitest, 2026-10-14): `src/core/finance/deduct.test.ts` (cap, proposal, rounding, needs-change incl. 2,860/500, 300 and 1,050/30; `deductSheet` −1,500 / +640 / route 860, ceiling = share + netting, หักหนี้ ≥ netting, empty box = 0; `pickNotes`), `src/core/finance/debts.test.ts` (`balanceAfterSale`). 174 finance tests, 925 core in all, pass.
- [x] Component (jest): `src/__tests__/v2-sale-deduct.test.tsx` (mockup 17/17a: owed-back hint, breakdown + reason, −/+ steppers, + netting line, route lines, ต้องแตกเงิน + notes, edit replaces, edit keeping the netting, an unchanged edit writes nothing, edit to 0 removes netting + repayment, an older sale dated by its day, owner tick locked under D-61), `v2-sale-netting.test.tsx`, `v2-sale-money.test.tsx`. 419 pass (`--runInBand`).
- [x] Sandbox run (2026-10-14): exported web build, Playwright phone-portrait, offline — `e2e/v2-sale.spec.ts` netting test and the full v2 suite: 21 passed, 5 skipped (landscape-only).
- [x] Screenshots (UI) — golden path: `docs/ux/screenshots/ui-v2/sale/e06-s04/17-before.png`, `17a-red-sheet.png`, `17a-nat-open.png`, `17-after.png`, `17-after-nat.png`, `18a-tally.png`; side by side with the mockup: `after-fix-vs-mockup-17.png`, `after-fix-vs-mockup-17a.png` (before the fix: `before-fix-vs-mockup-17*.png`).
- [x] Screenshots (UI) — edge cases: `17a-nat-why.png` (ต้องแตกเงิน + the notes in the pile), `17a-nat-overcap.png` (above the ceiling, save disabled).

## Dev notes

- 2026-10-11 v2 settlement screen (`src/v2/sale/money-screens.tsx`): หักกลบ built — netting card in the deduct sheet (only when the farm owes the worker, never automatic, partial ok), ceiling = share + netting, two events kept apart (repayment + debt payment with `repaymentId`), undo per line voids both, `overDeducted` now counts netting in the total. Tests: `src/__tests__/v2-sale-netting.test.tsx`, `deduct.test.ts`.
- Removal of old S29 code: done in E06-S07. Still open: ธง/Conflict across devices.
- 2026-10-14 owner confirmed mockup 17/17a against the v2 screen and agreed: (A) หักหนี้ is the whole debt taken at this sale and the netting is a **+** line (−1,500 / +640), only the difference (860) goes by the chosen route — the stored events are unchanged (a `netting` debt payment with its repayment, and a route payment of the difference), and the tally page (18a) reads the same way as page 17 (owner 2026-10-14, item 2): "ส่วนแบ่ง 2,425 − หักหนี้ 1,500 + สวนคืน (หักกลบ) 640", with "หักกลบไม่มีเงินสดเคลื่อน: หนี้ลด 640 = สวนคืนนัด 640" under it; (B) the sheet shows the debt by kind and why the amount is proposed, −/+ steppers (฿100), what each route moves, the ต้องแตกเงิน chip with "ทำไม? ดูแบงค์ในกอง"; the card shows "สวนต้องคืน{name}" before a deduction, the notes to lift out after it, and "แก้ยอดหัก / วิธีรับเงิน" — one deduction per worker per sale, edited as a whole (old lines voided first, then the new ones written), replacing the per-line undo; "หักหนี้ (งวดผ่อน)" when there is a plan.
- Core: `deductSheet` (deduct.ts) holds the sheet's arithmetic; `pickNotes` names the notes for route 1 (`needsChange` now uses it); `balanceAfterSale` (debts.ts) gives the debt left after an older sale — records carry a day, not a time, so the rest of the sale day counts as before it.
- 2026-10-14 (night) **D-85, debt apart from the sale** (mockup `docs/ux/mockups/flow-sale-v1.2.0-debt.html`, reviewed twice by an accountant agent and a farm-owner persona; owner's own correction after the first build): page 17 opens with "ขายวันนี้ กก. × ราคา = ยอด", then ก the sale split (no debt), ข เรื่องหนี้ (ไม่ใช่ยอดขาย) in **two chunks** — ↘ "คนกรีดยางจ่ายหนี้สวน" (blue `debtIn`, one colour for every line: แดง 2,000, นัด 1,500 = what the debt went down by, "เป็นเงิน 860 + หักกลบ 640" as its detail) and ↗ "สวนคืนเงินคนกรีดยาง" (vermillion `debtOut`: นัด 640, netted, no cash) — and ค each one's money (ส่วนแบ่ง − จ่ายหนี้ + สวนคืน). The tally (18a) lists each one's money with where it came from (จากยอดขาย · ↘ · ↗ · ปัดเศษ) and three checks (sale parts = sale, debt moves = 0, rounding = 0), netting in its own no-cash box. The deduct sheet: the same ↘ / ↗ lines, a "ใช้หักกลบ … แล้ว" chip, and a warning before saving without netting while the farm still owes the worker (D-60 stays: never automatic). New tokens `debtIn`/`debtOut`/`debtNet` (design-system.md). Evidence: `docs/ux/screenshots/ui-v2/sale/debt-apart/`. This supersedes the "−1,500 / +640 in the card" and tally wording of earlier the same day.
- `src/ui/text-field.tsx`: the input gets `minWidth: 0`, so an aside (the steppers) never pushes past the card on web.

## Code review

- Reviewer 1 (separate agent, 2026-10-14, read-only on `602c37f`): 2 major, 9 minor. Fixed on this branch: F4 (`counts` filtered in the tally sum and `transferInSatang`), F6 (owner's tick locked under D-61), F7 (editing shows what was saved, no second instalment), F8 (an empty box is 0), F9 (`balanceAfterSale`), F10 (the ceiling now does grow with the netting), F11 (a netting that cannot be placed is said, nothing written), plus the mockup differences above. Open by the owner's choice: F1 cancelled sales (waits on E04-S11), F2 two-device duplicates (needs one guarded record per sale × tapper), F5 tally piles derived from the same numbers.
- Reviewer 2 (separate agent, 2026-10-14) on the fix diff: money math checked by hand on every path (new, edit, edit to 0, partial netting, plan, balance > share, debt > share + netting) — holds to the satang; write order and part-way stops safe; 7 minor/nit findings. All fixed: (1) lines are dated by the sale day and "debt left" uses it, not today; (2) an edit that changes nothing writes nothing; (3) a warning before several old routes become one; (4) tests for editing a netted deduction while keeping the netting (owed money placed again, one live repayment, nothing owed left), the error texts, and the steppers' floors; (5) − stops at the netting; (6) the save error clears on any change; (7) "ทำไม? ดูแบงค์ในกอง" sits under the radio card, not inside it.
- Reviewer 3 (separate agent, 2026-10-14) on the D-85 change: money math right on every route; 1 major, 5 minor, 2 nits. Fixed: (major) the tally's three checks were built from the same lines they check and could never fail — the debt check now comes from the piles as they stand and a tapper line that does not add up shows ✗ (`tally-mismatch-*`, test with an over-deducted sale); the owner's transfer shows unrounded before rounding is answered; direction labels are nested Text (native keeps the font and colour); the arrow marks are hidden from screen readers (the words carry the direction); 44 unused message keys removed (th + en); the netting warning only on a first save; no "เป็นเงิน 0.00" when a line is netting only. Not changed: per-tapper farm part leaves out zones with no named tapper (old pile sales only).
- Owner, same night, on 18a: one row per amount with its own sign, colour and arrow, indented with a thin rule ("ง่ายแต่ไม่รก") — done.
- Resolution: ready for the owner. Gate on the final code (2026-10-14): typecheck, lint (one warning already on `dev`), vitest 925, jest 419 (`--runInBand`), web build, Playwright phone-portrait 21 passed. Open items as listed above (F1, F2, F5).

## QA notes

## คำถามเจ้าของ

**คำตอบเจ้าของ (2026-10-03) (D-54, D-58, D-59, D-60, D-61, D-65):**
- หักได้ **หนี้ทุกประเภท** (ชื่อบนจอ "หักหนี้"); กฎหักไม่เกินส่วนแบ่ง + ยกยอด (D-18) คงเดิม
- หักที่ **หน้า 17** ด้วยปุ่ม **"หักเงินคืนหนี้"** แล้วค่อย **ปัดเศษ (ปัดหลังหัก)**
- เงินที่สวนต้องคืนคนงาน → แอป **เสนอ** หักกลบ เจ้าของกดใช้เอง; บันทึกการคืนกับการหักแยกกัน
- หักเกินส่วนแบ่งหลังแก้การขาย → **ติดธง ปิด/ติ๊กจ่ายไม่ได้** จนแก้ยอดหัก
- E06-S05 ยกเลิก → ลบโค้ดเก่าใน story นี้; `delete-guard.ts` เขียนใหม่หรือเอาออก (D-58)

**คำถามค้าง:**
- ✅ (เจ้าของตอบ 2026-10-03) หักกลบ: เจ้าของใช้ **บางส่วน** ของเงินที่สวนต้องคืนได้ไหม หรือทั้งก้อนเท่านั้น → **ใช้บางส่วนได้ แก้ยอดได้** ส่วนที่เหลือยังค้างคืน
- ✅ (เจ้าของตอบ 2026-10-03) เมื่อหักกลบ เพดานการหักหนี้ยังเป็น "ไม่เกินส่วนแบ่ง" (D-18) หรือขยายเป็น "ไม่เกินส่วนแบ่ง + ยอดที่สวนคืนครั้งนี้" → **เพดาน = ส่วนแบ่ง + เงินที่สวนคืนครั้งนี้** เงินสดที่จ่ายจริงไม่ติดลบ
- ✅ (เจ้าของตอบ 2026-10-03) การขายที่หักกลบไว้ ถูก Cancelled/ลบ → รายการคืน (E11-S03) ถูกยกเลิกตามด้วยไหม (ร่าง: ยกเลิกตาม เหมือนรายการหัก) → **ยกเลิกตาม** เหมือนการหักหนี้