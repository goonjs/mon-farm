# Story E03-S08: ขนาดตัวอักษร S / M / L

Status: In Progress — AC ตาม D-81 รอเจ้าของตรวจ (overnight 2026-10-09, branch `feature/e03-farm-data`)

## Context

- Epic: `docs/epics/e03-master-data.md`
- PRD: NFR-4 · `docs/ux/design-system.md` §12.10 ข้อ 5
- โค้ดเดิม: `src/app/settings.tsx` (ตั้งค่าเครื่อง), `src/theme/index.tsx`, `design/tokens.ts` — เพิ่ม token `textScale`
- ขึ้นกับ: ไม่มี (ทำคู่ขนานได้)

## คำอธิบาย

ผู้ใช้เลือกขนาดตัวอักษร S (14) / M (16) / L (18) ตัวอักษรอื่นย่อ/ขยายตามสัดส่วน
ยกเว้นตัวเลขนับบนจอสาธารณะ

## Acceptance criteria

- [ ] ตั้งค่ามี S / M / L; ค่าเริ่มต้น M (§12.10 ข้อ 5)
- [ ] token `textScale` = 0.875 / 1 / 1.125 ทุกขนาดตัวอักษรคูณตามนี้
- [ ] ตัวเลขนับของโหมดสาธารณะ (`numeral`) ไม่ขยายตาม (§12.10 ข้อ 5)
- [ ] ขนาด L ไม่ทำให้ปุ่มหลักหลุดจอหรือซ้อนกันบนจอโทรศัพท์แนวตั้ง; touch target ≥ 48 (§12.10 ข้อ 6)

## Offline / sync

- เป็นค่าของเครื่อง เก็บในเครื่อง ไม่อยู่ใน event log (เหมือนธีม/ภาษาเดิม) ใช้ได้ออฟไลน์

## Test plan

- [ ] Vitest: ฟังก์ชันคูณขนาดตาม `textScale`; `numeral` ไม่เปลี่ยน
- [ ] jest-expo: เลือก L → ข้อความขยาย, ตัวเลขนับไม่ขยาย; ค่าคงอยู่หลัง remount
- [ ] Playwright: screenshot หน้าหลัก + หน้าชั่ง ที่ S / M / L

## Verification

## Dev notes

**ทำแล้ว (2026-10-09 คืน, ทีม FARM)**

- `scaleSizes` (`src/core/text-scale.ts`) คูณทุก `font.size` ด้วย token `textScale` (0.875 / 1 / 1.125) ปัดเป็น px เต็ม
  — body 14 / 16 / 18; `ThemeProvider` ส่ง `font.size` ที่คูณแล้ว + `textSize`/`setTextSize` ใน `useThemeControls`
- ตัวเลขนับบนจอสาธารณะไม่ใช่ token ขนาดตัวอักษร (คำนวณจากขนาดจอใน `HoldStage`) จึงไม่ขยายตามโดยโครงสร้าง — e2e วัด
  `font-size` ที่ S กับ L เท่ากัน
- ค่าของเครื่อง: `src/theme/text-size-preference.ts` (localStorage `mon-farm:text-size`) ค่าเริ่มต้น M; ตัวเลือก S / M / L ในหน้าตั้งค่าเครื่อง
- ข้อจำกัดเดียวกับเสียงเปิด/ปิด: บน native ยังไม่มีที่เก็บค่าของเครื่อง (ไม่มี localStorage) → กลับเป็น M เมื่อเปิดแอปใหม่ จนกว่าจะมี key-value บน native
- ปุ่มของ `chrome.tsx` สูง 40 (ของเดิม) ต่ำกว่า 48 ตาม §12.10 ข้อ 6 — ไม่ได้แก้ใน story นี้ (กระทบหน้านับเข่ง)

## Code review

## QA notes

**2026-10-09 (FARM, sandbox)** — Vitest `text-scale.test.ts` · jest-expo `text-size.test.tsx` (L → 18, ตัวเลขนับไม่เปลี่ยน, คงอยู่หลัง remount) ·
Playwright `e2e/text-size.spec.ts` แนวตั้ง: หน้าแรก + หน้านับเข่ง ที่ S/M/L ปุ่มหลักอยู่ในจอเต็ม, ขนาดตัวเลขนับ S = L ·
ชุด e2e เต็ม 166 ผ่าน ภาพ `docs/ux/screenshots/overnight/farm/e03-s08-*.png`
