# Story E03-S08: ขนาดตัวอักษร S / M / L

Status: Draft

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

## Code review

## QA notes
