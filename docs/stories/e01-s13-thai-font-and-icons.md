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

**2026-10-23 — FarmMate icon pilot (branch `feat/icon-set-farmmate-pilot`).**
Owner directed a FarmMate (not Feather) icon set here on 2026-10-03; this
session produced the first slice against that direction, scoped as a pilot
rather than the full AC:

- 24 of ~70 icons from `references/farmmate-icon-pack.png` (the sheet's first
  three top-row categories: นำทาง, สวนและแปลง, ผลผลิตและการขาย), hand-authored
  as `react-native-svg` vectors — `src/ui/farmmate-icons/registry.tsx`. Not
  pixel-traced from the sheet (it's a composite mockup at ~64px/icon, below
  reliable trace fidelity); drawn from it as a visual/colour reference.
- New dependency: `react-native-svg` (owner-approved this session; MIT,
  Software Mansion, official Expo-supported, no known CVE at install time).
  This is the icon-package approval this story's AC already asks for, just a
  renderer rather than a prebuilt icon font.
- Colour: every fill reads `theme.color.<role>` — no raw hex (enforced by
  `scripts/no-raw-colour.test.ts`, which passed). The mockup's own 7-swatch
  legend does not map 1:1 onto this app's signal roles (`accept`/`reject`/
  `warn` are reserved states); the substitutions used are documented in the
  registry file's header comment and in the Artifact proposal (PR
  description).
- Dev-only catalog page at `/v2/dev/icons` (not linked from any menu /
  `v2/routes.ts`) so the team can see the real rendered icons —
  `src/v2/dev/icon-catalog-screen.tsx`.
- Tests: registry + catalog screen (29 + 3 new tests), full `src/ui` and
  `src/v2/dev` suites green, `npm run contrast` and `npm run lint` clean,
  `tsc --noEmit` clean.
- Verified visually: real render tree dumped from `@testing-library/
  react-native`'s `toJSON()` (not hand-retyped) into a static SVG gallery and
  screenshotted — not the running app, because `/v2/dev/icons` sits behind
  `AccountGate` (real Google sign-in), which this session can't complete, and
  the Auth-emulator Playwright route is the same one `e2e/auth-emulator.spec.ts`
  already flags as blocked in this kind of sandbox (apis.google.com
  unreachable). Two real bugs this verification pass caught and fixed before
  commit: `nav.settings` only drew 4 of 8 gear teeth (asymmetric), and
  `farm.treeCondition` read as a paint-brush, not a leaf.

**Open / not done in this slice:**
- Not Done against this story's own AC — AC item "ไอคอนเส้นชุดเดียวใช้แทน
  ไอคอนเดิมในจุดนำทาง/แถวฟอร์ม" (replace existing nav/form icons) is NOT done:
  the pilot batch sits alongside the existing `ui/icons.tsx` line icons,
  unused by any real screen yet — see the Artifact proposal for where each
  icon is suggested to go.
- Remaining ~46 icons (6 more categories on the sheet) not produced.
- No independent code review yet (process.md gate before Done).
- CI not yet run on this branch/PR.
- `accessibilityLabel` per icon (AC item) not added — these are decorative
  in the catalog page only; real usage sites will need it per the existing
  convention (hidden `aria-hidden`, label on the surrounding control).

## Code review

## QA notes

## คำถามเจ้าของ

**คำตอบเจ้าของ (2026-10-03):**
- D5 → **คง Noto Sans Thai สำหรับตัวเลขนับ**; ปรับเกณฑ์ (rotate hint) ใหม่ตอนทดสอบในสวน

**คำตอบเจ้าของ (2026-10-03, PR #44 รอบ lead ใหม่):**
- ไอคอน: ใช้แบบ **FarmMate** แทน Feather (#45 ต้องปรับ)
- ลบไฟล์ template expo-symbols ที่ไม่ใช้ 4 ไฟล์ได้: `src/app/explore.tsx`, `src/components/app-tabs.tsx`, `src/components/app-tabs.web.tsx`, `src/components/ui/collapsible.tsx`
