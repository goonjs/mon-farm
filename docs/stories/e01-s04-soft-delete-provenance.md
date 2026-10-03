# Story E01-S04: ลบแบบกู้คืนได้ (Soft Delete) + ที่มาของข้อมูล

Status: Review

## Context

- Epic: `docs/epics/e01-foundation-sync.md`
- PRD: SYNC-9, SYNC-10, SYNC-11, NFR-3
- Architecture: "2026-10-02 — Direction" (แก้ = event ใหม่); E01-S01
- ขึ้นกับ: E01-S02

## คำอธิบาย

ลบ/กู้คืนเป็น event; projection ซ่อนรายการที่ลบและให้ข้อมูลที่มา (สร้างโดย/เมื่อ, แก้โดย/เมื่อ, ช่องทาง)
Soft Delete ใช้กับ **ทุกรายการ** กฎเดียว (ไม่แยกว่ารายการไหน "สำคัญ")
ยังไม่มี network

## Acceptance criteria

- [ ] ลบรายการใดก็ได้ → ซ่อนจากรายการปกติ; มีมุมมอง "ที่ลบแล้ว" ให้เจ้าของคนใดก็กู้คืนได้ (SYNC-10, D-27)
- [ ] กฎลบ/กู้คืนเป็นกลไกเดียวใช้ร่วมกันทุกชนิดรายการ — ไม่มีรายการชนิดไหนลบถาวรได้ (D-27)
- [ ] Soft Delete ≠ Cancelled: การขายที่ Cancelled ยังแสดงในรายการ (SYNC-10)
- [ ] ยอดรวม/สรุปเงินไม่นับรายการที่ลบ; กู้คืนแล้วกลับมาเท่าเดิม (NFR-3)
- [ ] projection ให้ provenance: สร้างโดย/เมื่อ, แก้โดย/เมื่อ (จาก `actor`), ช่องทางต้นทาง, สถานะการยืนยัน (SYNC-11)
- [ ] ทุกการลบ/กู้คืน/แก้ เก็บเป็น event — ไม่มีการลบแถวจริงใน store (SYNC-9)

## Offline / sync behavior

- ลบ/กู้คืนทำออฟไลน์ได้ เป็น event ปกติใน outbox
- ลบบนเครื่องหนึ่งพร้อมแก้บนอีกเครื่อง → จัดการใน E01-S11 (Conflict)

## Test plan

- [ ] Vitest: delete → restore → delete ให้ผลถูก, ยอดเงินไม่นับรายการที่ลบ, Cancelled ไม่ถูกซ่อน
- [ ] jest-expo: มุมมอง "ที่ลบแล้ว" + ปุ่มกู้คืน
- [ ] Playwright: ลบการขาย → reload → ยังซ่อน → กู้คืน (screenshot)

## คำถามเจ้าของ

- Soft Delete ใช้กับทุกรายการ หรือเฉพาะรายการสำคัญ (PRD เดิมเขียน "บันทึกสำคัญ")

**คำตอบเจ้าของ (2026-10-03):**
- ใช้กับทุกรายการ กฎเดียว (event log ไม่มีการลบจริงอยู่แล้ว)

## Verification

รันใน container ของ session (2026-10-03):

- เห็นแดงก่อน: `soft-delete.test.ts` (ไม่มี module), `deleted.test.tsx` (ไม่มีหน้าจอ), `DeletedSaleGate.test.tsx`
  (ไม่มี component) ล้มก่อนเขียนโค้ด
- typecheck, lint ผ่าน; Vitest 152; jest 56; `build:web` ผ่าน; Playwright 140 ผ่าน / 6 skip (config ชั่วคราวใน
  scratchpad เหมือน story ก่อน) — รวม `e2e/soft-delete.spec.ts`
- screenshot ของรายการขาย (`docs/ux/screenshots/*/sale-list.png`) อัปเดตเพราะมีปุ่มลบจริง

## Dev notes

### DoD ของ story นี้

- [x] เทสต์เขียนก่อนและเห็นแดง: Vitest (delete → restore → delete กับการขาย/โซน/กอง/เข่ง/รายการหัก, ยอดเงินไม่นับที่ลบและกลับมาเท่าเดิม, provenance), jest (หน้าที่ลบแล้ว + กู้คืน), Playwright (ลบการขาย → reload → ซ่อน → กู้คืน)
- [x] กลไกเดียว: event `delete` / `restore` ที่ชี้ `targetId` ใช้กับทุกชนิดรายการ ไม่มีทางลบแถวจริง
- [x] หน้า "ที่ลบแล้ว" + กู้คืน, ปุ่มลบการขายต้องยืนยันสองขั้น; screenshot ใน QA notes
- [x] `npm run verify` ทุกชั้นเขียว, ตรวจตาม checklist, review อิสระโดย subagent แยก
- [ ] CI เขียวบน PR


### การตัดสินใจ / ส่วนที่ต่างจากแผน

- **AC3 (Cancelled ไม่ถูกซ่อน) — เลื่อนไป E04-S11** ตอนนี้โมเดลการขายมีแค่ open/closed ยังไม่มีสถานะ Cancelled
  (SALE-20 อยู่ใน E04-S11) Soft Delete เป็น event แยก (`delete`/`restore`) จึงไม่มีทางไปปนกับสถานะการขาย — เทสต์ของ
  AC3 เขียนพร้อมสถานะ Cancelled ใน E04-S11
- **"สถานะการยืนยัน" ใน provenance (AC5) — ไป E01-S15** มาจากสถานะข้อมูลรายฟิลด์ที่ยังไม่มี; ส่วนสร้างโดย/เมื่อ,
  แก้โดย/เมื่อ, ช่องทาง (`source`) ทำแล้วใน `provenance()`
- UI: ลบ/กู้คืนทำได้กับ **การขาย** (ปุ่มลบสองขั้นในรายการ + หน้า "ที่ลบแล้ว"); กลไกในแกนใช้กับโซน/กอง/เข่ง/รายการหักได้แล้ว
  แต่ปุ่มลบรายการย่อยจะมากับหน้าจอของแต่ละรายการ (E03/E04)
- ใครลบก่อนหลังตัดสินด้วยลำดับ fold ไม่ใช่นาฬิกา; สองเครื่องลบ/กู้คืนพร้อมกัน → E01-S11
- ฟิลด์ `source` ของเข่งเปลี่ยนชื่อเป็น `input`; envelope ได้ `source: 'app'`
- เขียน event จากนอกหน้าการขายผ่าน `src/store/record.ts` (ตัวนับเครื่องตัวเดียวกับ `SaleProvider`)

## Code review

review อิสระโดย subagent แยก (2026-10-03) ตาม checklist — ไม่มี blocker; ทางเงินทุกเส้น (totals, settle, undo)
ผ่าน `liveBaskets`/projection ชุดเดียวกัน และกู้คืนแล้วผลเท่าเดิม:

| # | ระดับ | เรื่อง | ผล |
|---|---|---|---|
| 1 | should-fix | การขายที่ลบแล้วยังแก้ได้ และ `SaleProvider` ที่ค้างใน stack ไม่รู้ว่าถูกลบ | แก้: `refresh()` (merge ตาม id) ทุกครั้งที่หน้าการขายได้ focus + `DeletedSaleGate` แทนหน้าการขายด้วยข้อความ "ถูกลบแล้ว — กู้คืน" + jest |
| 2 | should-fix | event ก่อน E01-S04 ไม่มี `source` ของ envelope / เข่งใช้ `source` เป็นวิธีป้อน | แก้: `provenance` อ่านเป็น `'app'` + เทสต์ (log บน dev เท่านั้น ไม่ upgrade) |
| 3 | should-fix | ปุ่มลบไม่บอกว่าลบรายการไหนกับ screen reader | แก้: `Button.accessibilityLabel` = "ลบ {ชื่อ}"; ปุ่มสูง 40 < 48 ของ design system เป็นของเดิม — ไม่แก้ใน story นี้ |
| 4 | should-fix | ลบ/กู้คืนล้มเงียบ | แก้: catch + log |
| 5 | should-fix | ลบโซนแล้วรายการหักของคนกรีดโซนนั้นยังอยู่ → payout ติดลบ | ตรึงพฤติกรรมด้วยเทสต์ (รายการหักเป็น record ของมันเอง หน้าสรุปเงินแสดงยอดติดลบอยู่แล้ว) — แจ้งเจ้าของใน DONE |
| nit | | `touches()` ขาด `forcedPiles`; delete id ที่ไม่เคยสร้าง; `deletedIds` sort ทั้ง log; ข้อความอังกฤษ Title Case; แถวที่ลบแล้วไม่มีสถานะ | แก้ทั้งหมด + เทสต์ provenance ทุกชนิดรายการ |
| nit | | ข้อความ log ไม่บอกว่าลบอะไร; ชื่อ `stamp`/`Stamp` ซ้ำความหมาย; ไม่มี jest ของลบสองขั้นในรายการ | เลื่อน: Playwright ครอบลบสองขั้นแล้ว; ข้อความ log ทำพร้อม UI ลบรายการย่อย (E03/E04) |

## QA notes

- ยืนยันลบสองขั้น: `screenshots/e01-s04/delete-confirm.png`; หน้า "ที่ลบแล้ว" + ปุ่มกู้คืน:
  `screenshots/e01-s04/deleted-list.png` — ลบ → reload → ยังซ่อน → กู้คืน → เปิดการขายได้ นับเดิม 3 เข่ง
