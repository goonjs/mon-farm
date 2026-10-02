# Story E01-S13: ฝัง font Noto Sans Thai + ชุดไอคอนเส้น open-licence

Status: In Progress

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

(MF-15, 2026-10-03)

- **Dependencies** (gate: owner pre-approval + lead OK 2026-10-03) — ติดตั้งด้วย `EXPO_OFFLINE=1 npx expo install`
  (proxy บล็อก API ของ Expo; โหมด offline ใช้ตาราง version ของ SDK 57 เอง):
  - `@expo-google-fonts/noto-sans-thai` ^0.4.2 — MIT (loader) + SIL OFL 1.1 (font) — ข้อความ licence: `assets/fonts/OFL.txt`
  - `@expo/vector-icons` ^15.0.2 (ได้ 15.1.1) — MIT — ใช้ชุด Feather (MIT) อย่างเดียว
  - `expo-font` เป็น direct dependency อยู่แล้ว (~57.0.1) — ไม่ได้เพิ่ม
  - `npm audit` ก่อน/หลัง: 0 critical · 8 high · 14 moderate ทั้งสองครั้ง รายการแพ็กเกจเหมือนกัน; ไม่มี transitive dependency ใหม่
- **Weight ที่ฝัง**: 400 / 500 / 600 / 700 / 800 ตาม `tokens.font.weight` — import ทีละ weight
  (index ของแพ็กเกจ `require` ครบ 9 weight จะติดไปใน bundle)
- **หนึ่ง family ต่อหนึ่ง weight** (`src/theme/fonts.ts`, `t.face(weight)`): บน Android `fontFamily` ชี้ไฟล์เดียว
  ถ้าใช้ `fontWeight` กับ regular จะได้ตัวหนาปลอม — call site ที่เคยเป็น `fontFamily: sans` + `fontWeight` (68 จุด)
  เปลี่ยนเป็น `...t.face(w)`; ข้อความ mono ยังเป็น system mono (Noto Sans Thai ไม่มี mono)
- **FontGate** (`src/theme/FontGate.tsx`) ครอบ root: ไม่แสดงจนกว่า font โหลด; โหลดไม่ได้ → แสดงด้วย system font ไม่ค้าง
- **ไอคอน**: `Icon` (มี `label` = ประกาศเป็นภาษาไทย, ไม่มี = ซ่อนจาก screen reader) + `Button` `icon` / `iconAfter`
  แทนลูกศรข้อความในปุ่มนำทาง: ตั้งค่า, รายการ (กลับ), ข้อมูลฟาร์ม, การขายใหม่, เริ่มนับ, กลับไปนับ, กองถัดไป
  ปุ่ม action ในหน้าชั่ง (↺ ⚖) ไม่ใช่จุดนำทาง — ไม่แตะใน story นี้
- **ขนาด bundle เว็บ** (`npm run build:web`, `dist/`): ก่อน 3,620,395 B → หลัง 3,935,716 B (+315,321 B);
  JS 2,314,115 → 2,324,381 B (+10,266 B); ไฟล์ font ใหม่ 5 weight + Feather. ขนาดแอป native: ยังวัดไม่ได้ใน sandbox
  (ไม่มี Android build) — ไฟล์ ttf 5 weight รวม 237,584 B คือส่วนที่เพิ่มใน APK โดยประมาณ
- **ข้อค้นพบ (ส่งต่อ design)**: ตัวเลขนับสาธารณะใช้ Noto Sans Thai ExtraBold แล้ว digit กว้าง 0.578em (−0.04 tracking = 0.538em)
  เทียบ system face เดิม ~0.656em ⇒ 3 หลักบนโทรศัพท์แนวตั้งได้อัตราส่วน ≈ 0.620 = **เท่าเกณฑ์ 0.62 พอดี**
  (เดิม ~0.54 → ขึ้นคำแนะนำให้หมุนเสมอ) — ตัวเลขใหญ่ขึ้น แต่คำแนะนำให้หมุนอาจขึ้น/ไม่ขึ้นตามเศษ pixel;
  `e2e/orientation.spec.ts` เปลี่ยนเป็นตรวจกติกา (hint ขึ้นเมื่ออัตราส่วนวัดได้ < เกณฑ์) แทนการสมมติว่าขึ้นเสมอ
  - lead ตัดสิน 2026-10-03: ใช้ Noto ต่อ (ตัวเลือก a) โดยคำแนะนำให้หมุน **ห้ามกะพริบ** — แก้ใน `HoldStage`:
    ตัดสิน hint หลัง layout ยืนยันขนาดแล้วเท่านั้น (ครั้งเดียวต่อจำนวนหลัก/ขนาด stage) ไม่ใช้ค่าประมาณจาก token
    ตอน paint แรก (เดิมกะพริบหนึ่งเฟรม — test จับได้ก่อนแก้); เพิ่ม test 4 หลักให้ hint ยังขึ้นได้
  - **ค้าง (open item)**: ปรับเกณฑ์ `minHeightRatio` / hysteresis ใหม่จากการทดสอบในสวนด้วย font ใหม่ — บันทึกใน design-system §11 ด้วย
- **e2e ในเครื่อง**: Playwright ใน repo ต้องการ chromium build ที่ไม่มีใน sandbox — รันด้วย config ชั่วคราวที่ชี้
  `/opt/pw-browsers/chromium` (ไม่ commit) ผล 132 ผ่าน
- ไฟล์ template ที่ยังใช้ `expo-symbols` (`src/app/explore.tsx`, `src/components/app-tabs*.tsx`, `ui/collapsible.tsx`)
  ไม่ถูก import จากหน้าจอจริง — ไม่ลบ (การลบไฟล์ต้องขอยืนยัน) เสนอให้ลบใน story แยก

## Code review

## QA notes

- Screenshot ออฟไลน์ (block ทุก host ภายนอก): `docs/ux/screenshots/phone-landscape/fonts-offline.png`,
  `phone-landscape-floor/fonts-offline.png`; screenshot หน้าจอเดิมทุกชุดใน `docs/ux/screenshots/` ถูกสร้างใหม่ด้วย font ใหม่
- ยังไม่ได้ทดสอบบน Android จริง (โหมดเครื่องบิน) — ต้องใช้ dev client (E01-S06)
