# Story E06-S09: ผ่อนหนี้คนกรีดเป็นงวด ("ผ่อนกี่งวด")

Status: In Progress (เจ้าของตอบครบ 2026-11-06 ผ่านลีด · เริ่มโค้ดตามลีด 2026-11-06)

## Context

- Epic: `docs/epics/e06-fertilizer.md` (บัญชีหนี้คนงาน E06-S03, หักตอนปิดการขาย E06-S04)
- PRD: FERT-5, FERT-6 · D-59, D-60, **D-88** (การตัดสินทั้งหมดของสตอรี่นี้ พร้อมเหตุผลเจ้าของ)
- ต่อจาก: E05-S11 (หน้าสรุปจ่าย / แผ่นหักหนี้), E06-S04 (กติกาหัก), E06-S08
- Mockup: `docs/ux/mockups/debt-installments.html` (artifact ฉบับ 13) · ภาพ `docs/ux/screenshots/debt-installments/`
- ไม่ทำในสตอรี่นี้: E16 "1 ครั้งใส่ปุ๋ย = 1 ก้อน" (ทีมการดูแลสวน) — โค้ดผ่อนนับก้อนจากรายการหนี้ที่มี ไม่ผูกกับที่มาของก้อน

## ทำไม

เจ้าของ 2026-11-04: "อยากให้มีว่าจะผ่อนกี่งวดแทน ต้องคิดถึงตอนขายและจ่ายงวดหลังด้วยว่าจะแสดงยังไง". ทุกวันนี้แผนผ่อนตั้งได้แค่ "บาท / การขาย" ที่หน้าบัญชีหนี้ และแผ่นหักหนี้มีแค่ หักเต็ม / ครึ่งหนึ่ง / ไม่หัก.

## Description

แผนผ่อนของคนกรีดตั้งเป็น **จำนวนงวด** ได้ (ยังตั้งเป็นบาท/การขายแบบเดิมได้). ทุกการขายแอปเสนอยอดงวดที่คิดใหม่จากหนี้ที่เหลือ ÷ งวดที่เหลือ. ตั้งแผนได้ตอนปิดการขาย (แผ่นหักหนี้) และที่หน้าบัญชีหนี้. แผ่นหักหนี้ของงวดถัดไปเป็นแบบ A: แผนเดิมเป็นกล่องละงวด, คำตอบเดียวตัวใหญ่ "หักงวด N" ปุ่มเดียว, ทางอื่นเป็นแถวจาง "ทำอย่างอื่น".

## Acceptance criteria

แบ่งเป็น 3 PR (ลีด 2026-11-06): **PR-a core** (IP-1…IP-8) → **PR-b แผ่นหักหนี้** (IP-9…IP-16) → **PR-c บัญชีหนี้ + ตั้งค่า** (IP-17…IP-22).

### คำนวณ (core)

- [ ] **IP-1** ยอดงวดของการขายนี้ = หนี้ที่เหลือ (ก่อนหักการขายนี้) ÷ งวดที่เหลือ **ปัดขึ้นเป็นบาทเต็ม**; งวดสุดท้าย = ที่เหลือจริงถึงสตางค์. รวมทุกงวด = หนี้ตอนตั้งแผนพอดี (ไม่มีสตางค์หายหรือเกิน) — ทดสอบสุ่ม
- [ ] **IP-2** ยอดที่เสนอยังอยู่ใต้กติกาเดิม: ไม่เกินส่วนแบ่ง (+ หักกลบ), ปิดก้อนเก่าสุดก่อน, เงินสดไม่ติดลบ (D-18, D-60)
- [ ] **IP-3** งวดที่จ่ายแล้วไม่เก็บ แต่นับจาก log: การขายที่ยังมีผลซึ่งมีการหักหนี้ของคนนั้น > 0 นับจากจุดเริ่มแผน = 1 งวดต่อการขาย. "ยังไม่หัก" (0) ไม่นับ (งวดเลื่อน). ยกเลิก/ลบการขาย → งวดนั้นหายไปเอง
- [ ] **IP-4** หักไม่ตรงงวด (ส่วนแบ่งไม่พอ หรือพิมพ์ยอดเอง มากหรือน้อยกว่า): ยังนับ 1 งวด ส่วนที่ขาด/เกินไปหารในงวดที่เหลือ (Q4)
- [ ] **IP-5** ครบงวดแล้วยังมีหนี้ หรือหนี้เป็น 0: แผนจบ ที่ค้างเป็นหนี้ธรรมดา (Q5) — การขายหน้าเสนอแบบไม่มีแผน
- [ ] **IP-6** แบ่งใหม่: จำนวนงวดใหม่นับจากวันนี้ (การขายนี้เป็นงวดแรกของแผนใหม่) ไม่นับงวดที่จ่ายแล้ว แบ่งใหม่ได้ไม่จำกัด
- [ ] **IP-7** ตัวเลือกจำนวนงวด = 2 … ค่าสูงสุด ไม่รวมจำนวนที่ใช้อยู่ ไม่มี 1 งวด แสดงไม่เกิน 3 ตัว (เรียงใกล้ค่าปัจจุบัน)
- [ ] **IP-8** หนี้ใหม่ระหว่างผ่อน (หนี้ที่เกิดหลังจุดเริ่มแผน): แอปรู้ว่ามี และให้ 2 ทาง — "รวมในงวดที่เหลือ" (ยอดงวดคิดจากหนี้ทั้งหมด) หรือ "หักเต็มวันนี้" (งวด + หนี้ใหม่ทั้งก้อน, งวดที่เหลือคิดจากหนี้เดิม) — **ไม่มีค่าเริ่มต้น** (Q3)

### แผ่นหักหนี้ตอนปิดการขาย (แบบ A)

- [x] **IP-9** คนที่ยังไม่มีแผน: แผ่นเดิม + แถว "ผ่อนกี่งวด" (ตัวเลือกตาม IP-7) แต่ละปุ่มบอก "งวดละ X" · ปุ่ม "หักเต็ม" และ "ยังไม่หัก · ขอติดไว้ก่อน" (แทน "ไม่หัก") · ไม่มี "ครึ่งหนึ่ง" (mockup A1)
- [x] **IP-10** เลือกจำนวนงวด → ช่องหักเป็นงวดแรกทันที + บรรทัด "งวด 1 จาก N · งวดต่อไปราว X" ใต้แถวปุ่มแรก · แผนบันทึกพร้อมยอดหักตอนกด "ยืนยันยอด" เท่านั้น (CO-3)
- [x] **IP-11** คนที่มีแผนอยู่: กล่องละงวด (จ่ายแล้ว = เขียว + วันที่, วันนี้ = กรอบ, ที่เหลือ = เทา, "สุดท้าย") → ยอดใหญ่ "หักตามงวด · งวด N จาก M" → ปุ่มเดียว "หักงวด N · X" → "ทำอย่างอื่น": ปิดหนี้ทั้งหมดวันนี้ / แบ่งงวดที่เหลือใหม่ / ใส่ยอดเอง / ยังไม่หัก · ขอติดไว้ก่อน (mockup B2 แบบ A)
- [x] **IP-12** ส่วนแบ่งไม่พองวด: แจ้งเตือนสีเหลือง "ส่วนแบ่งวันนี้มีแค่ X" + ยอดที่หักได้ ปุ่ม "หักงวด N · X" (mockup D1)
- [x] **IP-13** หนี้ใหม่: แถบอำพันบอกหนี้ใหม่ + 2 ทาง ปุ่มหักเทา "เลือกวิธีจัดการหนี้ใหม่ก่อน" จนกว่าจะเลือก (mockup D2/A2)
- [x] **IP-14** ปิดหนี้ทั้งหมด / แบ่งงวดที่เหลือใหม่ / ใส่ยอดเอง เปิดเป็นมุมมองของแผ่นเดิม มีลิงก์ "‹ กลับไปหักตามงวด" (mockup A3/A4/D3)
- [x] **IP-15** การ์ดหนี้บนหน้าสรุปจ่ายและแผ่น "จัดการหนี้" บอก "ผ่อนงวด N/M" แทน "หักตามงวดผ่อน" · งวดสุดท้าย "ผ่อนครบ" (mockup A2-เดิม, B1, B3)
- [ ] **IP-16** แผ่นทั้งหมดพอดีหนึ่งจอที่ 390×844 และไม่มีอะไรถูกตัดที่ 360/390 × S/M/L

### บัญชีหนี้ + ตั้งค่า

- [x] **IP-17** หน้ารายชื่อบัญชีหนี้: ป้าย "ผ่อนงวด N/M · งวดละ ฿ X" (ตัวเลขย่อตาม summary-lines) หรือ "ไม่ผ่อน · หักเต็มส่วนแบ่ง" (mockup C1)
- [x] **IP-18** หน้าบัญชีหนี้: การ์ดแผนผ่อน "ผ่อน M งวด · จ่ายแล้ว N งวด" + แถบงวด (เขียว/เทา) + งวดต่อไป/งวดสุดท้าย · **ทั้งการ์ดแตะได้ มี ›** (ไม่มีปุ่มกลม "แก้", กฎ phone-form-ux 11) · ประวัติบอก "หักงวด N/M" และ "ตั้งแผน M งวด" (mockup C2)
- [x] **IP-19** แผ่นแผนผ่อน: เลือกแบบ "จำนวนงวด" หรือ "บาท / การขาย" · จำนวนงวดตาม IP-7 · บาท/การขายใส่ด้วยแป้นตัวเลข · "ยกเลิกแผน" (mockup C3/C4)
- [x] **IP-20** ครบงวดแต่ยังค้าง: การ์ดแจ้งเตือนสีเหลือง "ผ่อนครบ M งวดแล้ว ยังค้าง ฿ X" + จำนวนก้อน — ไม่มีประโยคอธิบาย (mockup D4)
- [x] **IP-21** ตั้งค่าสวน "ผ่อนหนี้ได้สูงสุด" เลือก 2–12 ค่าเริ่มต้น 4 ซิงก์ทุกเครื่อง · ใช้กับทุกจุดที่เลือกจำนวนงวด (mockup ตั้งค่า)
- [x] **IP-22** แผนแบบบาท/การขายที่มีอยู่แล้วทำงานเหมือนเดิมทุกจอ

## Offline / sync behavior

- ทุกอย่างทำงานออฟไลน์จาก log ในเครื่อง; แผนและตั้งค่าเป็น event ต่อท้าย ซิงก์อัตโนมัติ ไม่แก้ event เดิม
- แผน: ต่อสายเดิม `plan-<workerId>` (หัวสายเดียวต่อคน) · รูป event และจุดเริ่มนับ: ดู Dev notes (รอ architect)
- สองเครื่องตั้งแผนพร้อมกัน: กติกาหัวสายเดิม — ต้องระบุผลใน Dev notes หลัง architect ดู
- เครื่องรุ่นเก่า: ต้องระบุว่าเห็นแผนแบบงวดเป็นอะไร (ห้ามพังหรือหักผิดเงียบ ๆ)
- ตั้งค่าผ่อนสูงสุด: ระดับสวน ซิงก์ — ที่เก็บตาม architect
- ตรวจกับ `docs/checklists/offline-sync-checklist.md` ทุก PR

## Test plan

_เขียนก่อนโค้ด (TDD) ให้ล้มก่อน แล้วจึงทำให้ผ่าน_

- [ ] vitest core: IP-1 (สุ่ม 2,000 ชุด รวม = หนี้), IP-2, IP-3 (ยกเลิกการขาย, 0 ไม่นับ), IP-4, IP-5, IP-6, IP-7, IP-8 ทั้งสองทาง, แผนบาท/การขายเดิมไม่เปลี่ยน (IP-22)
- [ ] jest: แผ่นหักหนี้ IP-9…IP-15, บัญชีหนี้ IP-17…IP-21
- [ ] Playwright บน build จริง ออฟไลน์: ตั้งแผน 3 งวดตอนปิดการขาย → การขายถัดไปเสนองวด 2 → reload ยังอยู่ · วัดความสูงจอ (≤ 1.0) และ 360/390 × S/M/L
- [ ] สองเครื่อง (log สองชุดรวมกัน): ตั้งแผนพร้อมกัน, การหักจากอีกเครื่องนับเป็นงวด

## Verification

- [ ] Sandbox run performed:
- [ ] Screenshots — golden path:
- [ ] Screenshots — edge cases:

## Dev notes

Solution-architect review 2026-11-06 (separate agent), adopted:

- **Event**: extend `debt_plan_set` (same target `plan-<workerId>`), no new event type. Older apps fold an unknown `t` on that chain as "no plan" and ignore extra fields; Firestore rules only check `payload` is a map. Shape:
  `{ t: 'debt_plan_set', worker, perSaleSatang: number | null, installments?: { count, fromSaleId: string | null, seen: Record<deviceId, deviceSeq>, owedSatang } }`.
  With `installments`, `perSaleSatang` holds the instalment at write time — a fallback **for old apps only** (they propose it; new code ignores it). Cancel = `perSaleSatang: null` with no `installments`.
- **Paid instalments** (not stored): distinct sales S ≠ the sale being closed, where S's live farm deduction lines (`counts`, not deleted, method ≠ `outside`, netting included) **sum** > 0, and S = `fromSaleId` **or** the first `debt_payment_recorded` ever written for (worker, S) — voided ones included — has a `deviceSeq` above `seen[deviceId]`. `seen` = the highest deviceSeq per device known when the plan was written: no clock, no date. "First ever, voided included" keeps a re-confirmed pre-plan sale (confirm voids and rewrites lines) from counting. A cancelled/deleted anchor sale drops out (`counts` false) and returns if restored; the plan stays.
- **New debt since the plan** (IP-8): `extra = farm debt owed now (loan + fertilizer + other) − installments.owedSatang`. `extra > 0` → the sheet asks; either answer writes a new plan event at confirm with the new `owedSatang`, `seen` taken then, `fromSaleId` = this sale and **count = instalments left** (the new `seen` drops the instalments already paid, so `plan.count` would restart the plan — review 7). "fold in": the instalment of everything owed; "in full": the instalment of the old debt + the extra today. `extra < 0` (a debt deleted) just recomputes. No dates (debts can be backdated; share debts follow edited expenses).
- **Farm setting**: `maxInstallments?: number` on master `settings_set` (validated 2–12 in `updateSettings`, default 4 in the fold). Not `closeout-preference.ts` (device-local). Lowering it does not touch a running plan.
- **Where it plugs in**: pure `installmentAmount(balanceAsIf, left)` (null when nothing is left or balance 0; exact balance when 1 left; else rounded up to whole baht); the per-sale figure is computed in `closeoutInputs` from the as-if balance, counting paid instalments **excluding this sale**, so re-confirming is stable. `proposeDeduction` / `deductSheet` stay as they are; reason `'plan'` still applies.
- **Known risks**: (1) `plan-<workerId>` heads are last-write-wins (`headOf` picks the highest id): two devices re-baselining at confirm lose one fold/new-debt choice (the sale still counts via `seen`) — surface as a conflict (D-30) in a follow-up; (2) old apps propose the stale fallback and do not count instalments — safe, not exact; (3) re-confirm double counting if `confirmWrites` ever stops void-and-rewrite — pinned by a test; (4) rounding up ends a plan early at balance 0 — fuzz the exact remainder; (5) count per sale with sum > 0, never per line (netting-only, a line cut to 0); (6) a device the plan never saw (no `seen` entry), or a sale closed offline on another device before the plan and synced later, counts as after the plan — inherent to "no clocks", only shifts the instalment number (amounts follow the real balance); (7) a debt edited down and a new debt added in the same period cancel out in `extra`, so the new debt is folded in without the Q3 question — accepted for now (rare; would need the debt ids in the plan), raised with the owner via the lead; the same edit effect can end a paid-off plan's check early (an old debt edited up after payoff reads as new debt).
- Review round 1 (separate agent, 2026-11-06): "over" uses the balance as if the sale being closed had not deducted (re-confirming the last instalment); a plan is over once the debt it covered is paid, so new debt after that is ordinary debt (Q5) — `balance as-if − max(0, extra) ≤ 0`; the fallback `perSaleSatang` stays on `planPerSaleSatang` until the close-out reads the plan (PR-b), so no build proposes worse than an older app; added per-device / two-device-one-sale / other-lender / netting-only / cancelled-anchor tests; `installmentChoices(currentLeft, max)`.
- Review round 2 (same agent): nothing blocking. For **PR-b**: feed one as-if balance (clamped ≥ 0, as `closeoutInputs` does) to both `planStatus` and `installmentProposal`; until PR-b the close-out proposes the stored fallback (4,267) every sale, capped by balance and share, like an older app. For **PR-c**: the current "แก้" plan editor pre-fills the fallback and saving it turns an instalment plan into a per-sale plan — PR-c replaces that editor. Noted (not ours): `closeoutInputs` adds back every live line of the sale, other lenders included.
- **PR-b design change (2026-11-06): a re-split or re-base keeps the instalments already paid.** Writing the new plan with `count` = instalments left (review 7) made the number restart after confirm: the sheet showed "งวด 2 จาก 5" (mockup A5) and the same sale, re-opened, "งวด 1 จาก 4". The plan event now carries `installments.earlier` (the instalments paid before, `{saleId, date, satang}`, as `planStatus` listed them) and `count` = the plan's total, earlier included. `planStatus` puts `earlier` first and does not count those sales again; the fallback `perSaleSatang` is for `count − earlier.length`. Optional field: old apps ignore `installments` anyway; a plan without it reads as before. Architect review PR-b: an `earlier` entry counts only while its sale still deducts (> 0, live) — a cancelled or re-confirmed-at-0 sale would otherwise shrink `left` and raise every instalment. `planWrite` drops a pick made on lines that have since moved (as `workerDraft` does), and its re-press check compares sale and count only, not owed (a debt synced in between raises Q3 next instead of being folded silently). **Risk (8), closed in PR-c (lead)**: the pick lives in the in-memory draft, so the plan event is written *before* the lines: an app killed in between leaves a plan whose sale has no line (not counted; the sale stays unconfirmed and pressing confirm again proposes the same instalment from the plan), never lines without their plan. Display only: a re-split while re-confirming an older sale lists later sales first in `earlier`; a re-split at a sale that deducts 0 does not count that sale. Code review PR-b: new debt answered by a typed amount (ใส่ยอดเอง, ปิดหนี้ทั้งหมด, ยังไม่หัก) re-bases the plan like fold / in full, so re-opening the sale is not gated again (the new debt is then folded for the instalments left); answered that way, the proposal under it is the folded instalment, not 0; the first instalment shown on the pad respects netting; "แก้แล้ว" wins over "ผ่อนงวด N/M" in จัดการหนี้; a short share with more than one instalment left names them all (the shortfall is spread). Open, display only: re-opening an older sale whose instalment sits in a later plan's `earlier` shows the later sale as paid before it (number off by one; amounts follow the balance). `planWrite` skips a plan already landed (same sale, count and owed), so a confirm pressed again writes no second plan. To be checked by the solution-architect review.
- **PR-b build (2026-11-06)**: real web build, 9 screens × 360/390 × S/M/L (`docs/ux/screenshots/debt-installments/build/`, 390-M and 360-L kept; all 54 checked): nothing sideways, nothing clipped. One screen at 390×844 (IP-16) holds for every view at S and M. **Open: text size L** — the pad views (A1 with a count picked, ใส่ยอดเอง) put ✓ 14 px (390) and up to 100 px (360) below the fold; the sheet scrolls. With a count picked the "ก้อนเก่าสุด" line steps aside (mockup A1 has none) and "งวด 1 จาก N" sits beside the amount box. Not in mockup: the "‹" before "กลับไปหักตามงวด" (the catalogue forbids the character; an underlined link). The new-debt band says "หนี้ใหม่ +X" without the piece name (the plan keeps only the owed total). "ยังไม่หัก" from the plan view sets 0 and closes in one tap (with netting it opens the pad, netting needs its own fix).
- **PR-c (2026-11-06)**: `accountPlan` / `accountPlanPayload` (core) feed the debt list badge, the account plan card (whole card with ›, the old "แก้" button and inline per-sale editor gone — the editor saved a per-sale amount over an instalment plan), the plan sheet (จำนวนงวด / บาท / การขาย, "ยกเลิกแผน" as an underlined link) and the D4 alert. A count set from the account counts from the next sale (`fromSaleId: null`) and keeps the instalments paid (`earlier`). A worker with nothing recorded can still be given a plan (an empty account, as the old editor allowed). **Differs from the mockup**: the setting row sits in "ตั้งค่าวันขาย" (`/v2/sale-settings`, synced master settings) — there is no "ตั้งค่า · สวนนี้" screen with rounding and the transfer account; the history has no "ตั้งแผน M งวด" row (a plan event has no day of its own; `ts` never orders anything) — the deductions say "หักงวด N/M". Real build: 7 screens × 360/390 × S/M/L, nothing sideways or clipped (`docs/ux/screenshots/debt-installments/build-account/`, 390-M and 360-L kept).
- **PR-c code review**: fixed with failing-first tests — a count plan needs debt (nothing owed → only "บาท / การขาย"; a count of nothing would be over at once and the next debt would read as "ผ่อนครบ"); a plan whose own debt was paid before its instalments ran out shows nothing (Q5, ordinary debt), so "ผ่อนครบ M งวด" only means the instalments ran out; "หักงวด N/M" on one live farm line per sale only; the per-sale badge in compact money. Noted, by design (`seen`, no clocks): a sale closed offline on another device that the device setting a plan from the account had not seen yet counts as that plan's next instalment — with no plan before, that sale took the old proposal yet uses up instalment 1 (amounts still follow the balance). Lead (PR-c): the close-out writes the plan event before the lines (risk 8 closed).
- **Offline checklist**: the plan written at confirm is written with that sale's lines in the same confirm, so a stop part-way is retried by pressing confirm again (confirmWrites is idempotent).
- Open for the owner (via lead): an old "ยังไม่หัก" sale re-confirmed after the plan with a deduction would count as an instalment.
- **Dependency on E11-S17 / E16 (farm-care team, 2026-11-06, PR #156 AC RM-7)**: E11-S17 stops reading the old split on purchase orders, so a worker's `summary.owed` will **drop**. A drop makes `extra` negative — no false "new debt" question, the instalment just recomputes — but it would hide real new debt added later (extra = new − drop). That team must tell this story before merging E11-S17 so running plans are re-baselined (`owedSatang`), with a test that an existing plan sees no false new debt and nothing is counted twice during the switch. E16 fertilizing pieces are real new debt and should raise the Q3 choice. Instalment code reads only `projectDebts` totals and never a piece id or `expense.share`.

## Code review

- Reviewer (separate agent/session):
- Findings:
- Resolution:

## QA notes
