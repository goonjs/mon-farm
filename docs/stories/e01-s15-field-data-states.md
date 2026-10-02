# Story E01-S15: สถานะข้อมูลรายฟิลด์ 6 แบบ + ป้ายใช้ซ้ำ

Status: Draft

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

## Offline / sync behavior

- N/A สำหรับ network — เป็น type + component ล้วน
- สถานะข้อมูลเป็นส่วนหนึ่งของ event ที่บันทึกค่า (เปลี่ยนสถานะ เช่น Estimated → User provided = event ใหม่ ตาม SYNC-9) — รายละเอียด schema ตาม E01-S01

## Test plan

- [ ] Vitest: type ครบ 6 ค่า; ทุกค่ามีป้ายไทย (test ล้มถ้าเพิ่มสถานะแล้วไม่มีป้าย); Unknown / Not recorded ไม่ถูกแปลงเป็น 0
- [ ] jest-expo: ป้ายทุกสถานะแสดงคำ + ไอคอนที่ถูก + `accessibilityLabel` ภาษาไทย
- [ ] screenshot: ป้ายทั้ง 6 แบบเรียงกัน (ขนาดตัวอักษร S / M / L ถ้า E03-S08 เสร็จแล้ว)

## ต้องให้เจ้าของทำ/อนุมัติ

- ตรวจ screenshot ป้ายทั้ง 6 แบบ

## คำถามเจ้าของ

- ป้ายไทยของ Not recorded: design-system ยังไม่กำหนด — เสนอ "ไม่ได้บันทึก" (ต่างจาก "ไม่ทราบ" = รู้ว่าไม่มีใครรู้ค่า)
  - หมายเหตุ: E09-S01 ตอนนี้เขียนว่าฟิลด์ที่ไม่กรอกแสดง "ไม่ทราบ" — ถ้าแยกสองป้าย ต้องปรับ E09-S01 ให้ตรง

**คำตอบเจ้าของ (2026-10-03):**
- เลือกทำ SYNC-12 เป็น story เล็กใน E01: type กลาง 6 สถานะ + ป้ายไทย + component ป้ายตัวเดียว; การใช้ใน UI อยู่ใน story ที่ต้องใช้
- ป้าย Not recorded → **"ไม่ได้บันทึก"** (แยกจาก "ไม่ทราบ"; ปรับ E09-S01 ให้ตรง)

## Verification

## Dev notes

## Code review

## QA notes
