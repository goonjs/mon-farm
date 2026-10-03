# Story E01-S13: ฝัง font Noto Sans Thai + ชุดไอคอนเส้น open-licence

Status: Ready

## Context

- Epic: `docs/epics/e01-foundation-sync.md`
- PRD: NFR-1 (D-20 ภาษาไทยเท่านั้น), NFR-4
- Design: `docs/ux/design-system.md` คำตอบข้อ 1 Font (b) และข้อ 11 ไอคอน (b)
- ขึ้นกับ: —

## คำอธิบาย

ฝัง Noto Sans Thai (SIL OFL 1.1) เป็น asset ผ่าน `expo-font` ที่มีอยู่ ใช้ได้ออฟไลน์ และวัดขนาดแอป
เลือกชุดไอคอนเส้น open-licence (แนะนำ `@expo/vector-icons` ชุด Feather) หลังตรวจ dependency

## Acceptance criteria

- [ ] Noto Sans Thai ใช้ทั้งแอป (native + เว็บ) โหลดจาก asset ในแอป ไม่ดึงจากเน็ต — ใช้ได้ในโหมดเครื่องบิน
- [ ] ฝังเฉพาะ weight ที่ token ใช้จริง; บันทึกขนาด bundle เว็บ + แอปก่อน/หลังใน Dev notes
- [ ] มีไฟล์ licence OFL ใน repo คู่กับ font
- [ ] ไอคอนเส้นชุดเดียวใช้แทนไอคอนเดิมในจุดนำทาง/แถวฟอร์ม; ทุกไอคอนที่สื่อความหมายมี `accessibilityLabel` ภาษาไทย
- [ ] `npm run contrast` และ e2e เดิมผ่าน
- [ ] ตัวเลขนับ (count numeral) ใช้ Noto Sans Thai ด้วย (D5, เจ้าของ 2026-10-03) — ปรับเกณฑ์ rotate hint (`tokens.publicNumeral.minHeightRatio`) ใหม่ตอนทดสอบในสวน ไม่ใช่ใน story นี้ (E04-S07)

## Offline / sync behavior

- N/A — asset ฝังในแอป (ข้อกำหนดเดียว: ไม่โหลด font/ไอคอนจากเน็ต)

## Test plan

- [ ] jest-expo: font โหลดก่อนแสดงหน้าแรก; ไอคอนมี label
- [ ] Playwright: block network ของ fonts.googleapis.com → ข้อความไทยยังแสดงด้วย Noto Sans Thai (screenshot)

## ต้องให้เจ้าของทำ/อนุมัติ

- อนุมัติ `@expo/vector-icons` (หรือชุดอื่น) ตาม gate dependency พร้อมผลตรวจ licence + ช่องโหว่
- เลือกชุดไอคอนสุดท้าย (Feather หรืออื่น)

## Verification

## Dev notes

## Code review

## QA notes

## คำถามเจ้าของ

**คำตอบเจ้าของ (2026-10-03):**
- D5 → **คง Noto Sans Thai สำหรับตัวเลขนับ**; ปรับเกณฑ์ (rotate hint) ใหม่ตอนทดสอบในสวน
