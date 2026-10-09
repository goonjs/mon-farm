# Story E01-S15: สถานะข้อมูลรายฟิลด์ 6 แบบ + ป้ายใช้ซ้ำ

Status: In Progress

## Context

- Epic: `docs/epics/e01-foundation-sync.md`
- PRD: SYNC-12, SYNC-11, NFR-3, NFR-4 · D-20
- Design: `docs/ux/design-system.md` §12.9 ข้อ 9 (การแสดงสถานะข้อมูล — อนุมัติเป็นจุดเริ่มต้น "เพิ่ม token เมื่อ story ต้องใช้")
- ขึ้นกับ: E01-S13 (font + ไอคอน)
- ใช้โดย: E03-S02, E06-S01, E06-S06, E07-S03, E07-S04, E09-S01, E10-S02, E11-S01, E11-S07, E11-S08, E12-S01, E13-S03, E13-S07, E14-S02, E14-S06

## คำอธิบาย

type กลางสำหรับสถานะความครบของข้อมูลรายฟิลด์ 6 แบบ (SYNC-12) + ป้ายภาษาไทย + component ป้าย (badge) ตัวเดียวใช้ซ้ำ
story นี้ทำแค่ model + ป้าย — การใช้ป้ายในหน้าจอจริงอยู่ใน story ที่ต้องใช้ (ดู "ใช้โดย")

สถานะ 6 แบบ: Unknown · Not recorded · Estimated · User provided · System calculated · AI suggested / Needs Review

## Acceptance criteria

- [ ] มี type กลางเดียว (เช่น `FieldDataState` ใน `src/core/`) ครบ 6 ค่าตาม SYNC-12; story อื่นใช้ type นี้ ไม่สร้างชุดของตัวเอง
- [ ] ค่าแต่ละฟิลด์เก็บคู่กับสถานะได้ (ค่า + สถานะ); "ไม่มีค่า" ต่างจาก 0 หรือค่าว่าง — Unknown / Not recorded ไม่ถูกนับเป็น 0 ในการคำนวณ (NFR-3)
- [ ] ป้ายภาษาไทยของทุกสถานะอยู่ที่เดียว (D-20) — ตามที่ design-system มีอยู่: Unknown = "ไม่ทราบ", Estimated = "ประมาณ" (นำหน้าค่าด้วย "≈"), AI suggested / Needs Review = "AI แนะนำ" (E14-S06 ใช้ "AI แนะนำ / รอตรวจ"), User provided = "ผู้ใช้ใส่", System calculated = "ระบบคำนวณ" (E13-S07); Not recorded = "ไม่ได้บันทึก"
- [ ] component ป้ายตัวเดียว (เช่น `DataStateBadge` ใน `src/components/`) แสดงทุกสถานะตาม design-system §12.9 ข้อ 9: Unknown = `inkSoft` + "ไม่ทราบ" + ไอคอน "?" + กรอบเส้นประ `ruleStrong` · Estimated = "≈" + ป้าย "ประมาณ" · AI = ไอคอนประกาย + chip "AI แนะนำ" บนพื้น `surfaceSunk` · User provided / System calculated = ป้ายคำอย่างเดียว
- [ ] ไม่ใช้สีอย่างเดียว — ทุกสถานะมีคำ (และไอคอนตามที่กำหนด); มี `accessibilityLabel` ภาษาไทย (NFR-4)
- [ ] token ที่ยังไม่มีสำหรับป้ายเหล่านี้เพิ่มใน `design/tokens.ts`; `npm run contrast` ผ่าน
- [ ] ไม่แตะหน้าจอของ story อื่นใน story นี้
- [ ] แตะสลับ พ.ศ./ค.ศ. → **สลับทุกวันที่ทั้งแอป และจำไว้ในเครื่อง** (F14) (D-74)

## Offline / sync behavior

- N/A สำหรับ network — เป็น type + component ล้วน
- สถานะข้อมูลเป็นส่วนหนึ่งของ event ที่บันทึกค่า (เปลี่ยนสถานะ เช่น Estimated → User provided = event ใหม่ ตาม SYNC-9) — รายละเอียด schema ตาม E01-S01

## Test plan

- [ ] Vitest: type ครบ 6 ค่า; ทุกค่ามีป้ายไทย (test ล้มถ้าเพิ่มสถานะแล้วไม่มีป้าย); Unknown / Not recorded ไม่ถูกแปลงเป็น 0
- [ ] jest-expo: ป้ายทุกสถานะแสดงคำ + ไอคอนที่ถูก + `accessibilityLabel` ภาษาไทย
- [ ] screenshot: ป้ายทั้ง 6 แบบเรียงกัน (ขนาดตัวอักษร S / M / L ถ้า E03-S08 เสร็จแล้ว)

## ต้องให้เจ้าของทำ/อนุมัติ

- ตรวจ screenshot ป้ายทั้ง 6 แบบ

**คำตอบเจ้าของ (2026-10-03) — D7:** **อนุมัติ** screenshot `docs/stories/screenshots/e01-s15/data-state-badges.png`
— คำและความหมายของป้ายใช้ได้; หน้าตา (visual) ให้ตาม design ใหม่

## คำถามเจ้าของ

- ป้ายไทยของ Not recorded: design-system ยังไม่กำหนด — เสนอ "ไม่ได้บันทึก" (ต่างจาก "ไม่ทราบ" = รู้ว่าไม่มีใครรู้ค่า)
  - หมายเหตุ: E09-S01 ตอนนี้เขียนว่าฟิลด์ที่ไม่กรอกแสดง "ไม่ทราบ" — ถ้าแยกสองป้าย ต้องปรับ E09-S01 ให้ตรง

**คำตอบเจ้าของ (2026-10-03):**
- เลือกทำ SYNC-12 เป็น story เล็กใน E01: type กลาง 6 สถานะ + ป้ายไทย + component ป้ายตัวเดียว; การใช้ใน UI อยู่ใน story ที่ต้องใช้
- ป้าย Not recorded → **"ไม่ได้บันทึก"** (แยกจาก "ไม่ทราบ"; ปรับ E09-S01 ให้ตรง)

## Verification

รันใน container ของ session (2026-10-03):

- เห็นแดงก่อน: `field-state.test.ts` และ `DataStateBadge.test.tsx` ล้ม (ไม่มี module) ก่อนเขียนโค้ด
- typecheck, lint, contrast ผ่าน; Vitest 163; jest 64; `build:web` ผ่าน; Playwright 144 ผ่าน / 6 skip (config ชั่วคราวใน
  scratchpad เหมือน story ก่อน) รวม `e2e/data-states.spec.ts`

## Dev notes

### DoD ของ story นี้ (GO-PARTIAL จาก lead 2026-10-03: ทุกอย่างยกเว้นไอคอน)

- [x] เทสต์เขียนก่อนและเห็นแดง: Vitest (6 สถานะ, ป้ายครบ, ไม่มีค่า ≠ 0), jest (ป้ายทุกสถานะ + accessibilityLabel ไทย), Playwright screenshot
- [x] type กลาง `FieldDataState` + `FieldValue<T>` ใน `src/core/field-state.ts`; ป้ายไทย/อังกฤษที่เดียวใน `src/i18n/messages.ts` (`dataState.*`)
- [x] `DataStateBadge` ตาม design-system §12.9 ข้อ 9 พร้อมช่อง `ICONS` สำหรับไอคอน
- [ ] **ไอคอน "?" (Unknown) และประกาย (AI)** — รอ `Icon` ของ E01-S13 (team design ทำเสร็จในเครื่องแล้ว ยังไม่ขึ้น dev); เติมในช่อง `ICONS` ห้ามเพิ่ม library ไอคอนอีกตัว
- [x] `npm run verify` ทุกชั้นเขียว, review อิสระโดย subagent แยก
- [ ] CI เขียวบน PR

### การตัดสินใจ

- **ไม่ต้องเพิ่ม token**: คู่สีที่ป้ายใช้ (`inkSoft` บน `surface`, `ruleStrong` บน `surface`, `ink` บน `surfaceSunk`) มีใน
  `scripts/check-contrast.mjs` อยู่แล้วและผ่าน
- **Not recorded** ใช้หน้าตาเดียวกับ Unknown (กรอบเส้นประ ตัวหนังสือจาง = "ไม่มีค่า") แต่คำต่างกันและไม่มีไอคอน "?"
  — design-system ยังไม่กำหนด Not recorded
- `sumKnown()` คืน `total: null` เมื่อไม่รู้ค่าใดเลย และ `missing` = จำนวนฟิลด์ที่ไม่มีค่า เพื่อให้หน้าจอบอก "ข้อมูลไม่ครบ"
  แทนที่จะแสดงยอดที่น้อยกว่าจริงเหมือนครบ
- ป้ายผูกกับ type: key `dataState.${FieldDataState}` — เพิ่มสถานะแล้วไม่มีป้าย typecheck และเทสต์ล้ม
- หน้า `/preview/data-states` (ไม่มีลิงก์จากแอป) มีไว้ให้เจ้าของตรวจป้ายทั้ง 6 และใช้ถ่าย screenshot — เป็น URL สาธารณะบน
  build จริง (ไม่มีข้อมูล) ลบหรือเก็บเป็น gallery เมื่อมี story แรกที่ใช้ป้ายจริง (เช่น E09-S01)
- "≈": อยู่ใน catalogue (`dataState.estimatedMark`) และเพิ่มในชุดตัวอักษรที่อนุญาตของ `resolve.test.ts` ตาม design-system
  §12.9 ข้อ 9 ป้ายแสดง "≈ ประมาณ" และมี `dataState.estimatedValue` ("≈ {value}") ให้หน้าจอที่ใช้ค่าประมาณนำหน้าค่า
  ตำแหน่ง ≈ ให้เจ้าของดูใน screenshot
- ขนาดตัวอักษร S/M/L ใน screenshot: ยังไม่มี E03-S08 จึงถ่ายขนาดเดียว
- ไม่แตะหน้าจอของ story อื่น; E09-S01 ต้องปรับให้ใช้ "ไม่ได้บันทึก" ตามคำตอบเจ้าของ (ทำใน story นั้น)

## Code review

review อิสระโดย subagent แยก (2026-10-03) — ไม่มี blocker:

| # | ระดับ | เรื่อง | ผล |
|---|---|---|---|
| 1 | should-fix | `sumKnown`/`valueOf` ตัดสิน "ไม่มีค่า" จาก `value === null` — JSON ที่ผิดรูป (`{state:'unknown', value:0}`) จะถูกนับเป็น 0 | แก้: `isNoValue(state)` ใช้ที่เดียวทั้ง core และป้าย; ค่าที่ไม่ใช่ตัวเลขจริงนับเป็น missing + เทสต์ JSON ผิดรูป |
| 2 | should-fix | architecture ยังเขียน `FieldValue` แบบเก่า | แก้: เป็น union + กฎ `sumKnown` |
| 3 | should-fix | "≈" ต่อสตริงใน component เลี่ยงกฎตัวอักษรของ catalogue | แก้: ย้ายเข้า catalogue + เพิ่มในชุดที่อนุญาต (อ้าง design-system) + `estimatedValue` สำหรับค่า |
| nit | | `T` เป็น nullable ได้; เทสต์ token หลวม; ตรวจคำไทยแค่ 4/6; key อยู่ในหมวดตั้งค่า; screenshot ขนาด desktop | แก้ทั้งหมด (screenshot ที่ 412×915 แนวตั้ง) |
| nit | | เว็บ: `accessibilityLabel` บน View ไม่มี role อาจไม่ถูกอ่าน; พื้น chip AI ต่างจากพื้นหลังน้อย | คงไว้: native อ่านถูก, คำบนป้ายสื่อความหมายเองแล้ว (NFR-4) — ทบทวนเมื่อป้ายอยู่ในหน้าจอจริง |

## QA notes

- ป้ายทั้ง 6 แบบเรียงกัน: `screenshots/e01-s15/data-state-badges.png` — เจ้าของอนุมัติแล้ว 2026-10-03 (D7: คำ/ความหมายใช้ได้ หน้าตาตาม design ใหม่)
  ไอคอนยังไม่อยู่ในภาพนี้ (รอ E01-S13)
