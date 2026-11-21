# Story E04-S22: เก็บงานหน้าเติมเข่ง — ข้อความเก่าที่ไม่ใช้ และ role ของกลุ่มตัวเลือก

Status: Done (merged #203, f110123, 2026-11-17) · owner agreed AC 2026-11-17 14:13 เวลาไทย ที่แดชบอร์ด คำถาม `e04-s22-ac` คำต่อคำ: "ก · โอเค ทำและ merge ได้ (แนะนำ)" — เดิม: (waiting for the owner's yes · ข้อเสนอแนะไม่บล็อกจากรีวิว PR 202 (E04-S21) ข้อ 2 และ 4 · ลีด 2026-11-17 ให้เขียนเป็นสตอรี่เล็ก ไม่ critical · ไม่เปลี่ยนสิ่งที่เห็นบนจอ)

## Context

- Epic: `docs/epics/e04-sale-weighing.md` · ต่อจาก `docs/stories/e04-s21-fill-sheet-redesign.md` (merge PR 202, `059b2b6`)
- ที่มา: รีวิว 5932938612 (session_01LA7pkALdtPo7LEivNt3ink) ข้อไม่บล็อก 2 และ 4

## Description

หลัง E04-S21 แผ่นเติมเข่งแบบเก่าหายไปแล้ว แต่ข้อความของแบบเก่ายังค้างอยู่ในแคตตาล็อก และกลุ่มตัวเลือกแบบ radio ของแผ่นใหม่ยังไม่บอกโปรแกรมอ่านหน้าจอว่าเป็นกลุ่มเดียวกัน

## Acceptance criteria

- [x] **FC-1** ลบ key ที่ไม่มีที่ใช้แล้วออกจาก `src/i18n/messages.ts` ทั้ง th และ en: `v2s.fillTitle`, `fillHave`, `fillFrom`, `fillFull`, `fillPart`, `fillNext`, `fillMore`, `asBasket`, `wholeBasket`, `fullSumSkew`, `weighAdded`, `countAs`, `partSum`, `partSumSkew`, `nextFull`, `basketN`, `fillNote`, `fillStagePart`, `fullLine`, `fillSum` (ตรวจ 2026-11-17: ไม่มีที่อ้างนอก `messages.ts` และไม่มีการต่อชื่อ key แบบ `v2s.${…}` สำหรับกลุ่มนี้) · ตรวจซ้ำก่อนลบ
- [x] **FC-2** สามแถวตัวเลือกในแผ่นเติมเข่ง (`fill-full`, `fill-part`, `fill-next`) อยู่ใน View ที่มี `accessibilityRole="radiogroup"` และชื่อกลุ่ม (เช่น "เลือกวิธีเติมเข่ง N") · แถวยังเป็น `radio` + `accessibilityState.selected` เหมือนเดิม
- [x] **FC-3** หน้าตาและพฤติกรรมไม่เปลี่ยน: screenshot 12/13 เดิมไม่เปลี่ยน · เทสต์เดิมผ่านทั้งหมด

## Offline / sync behavior

ไม่มี · ไม่แตะ event หรือ logic

## Test plan

- jest: แผ่นเติมเข่งมี `radiogroup` ที่ห่อทั้งสามแถว และมีชื่อกลุ่ม (เขียนก่อน)
- `resolve.test.ts` (แคตตาล็อก) ผ่านหลังลบ key · typecheck จับการอ้าง key ที่ลบไปแล้ว

## ไม่อยู่ในสตอรี่นี้

- `check:mockup` หา `.phone` แต่ mockup E04-S21 ใช้ `.ph` (รีวิวข้อ 1) — แตะ `scripts/` = PR critical แยก · ลีดให้ข้ามไว้ก่อน
- น้ำหนักเข่งระหว่างแผ่นกับหน้านับไม่ตรงกันในบางกรณี (รีวิวข้อ 3, มีอยู่บน dev ก่อนแล้ว) → `docs/stories/e04-s20-backfill-rare-cases.md`
- 320 L บรรทัดผลต้องเลื่อน (รีวิวข้อ 5) — ไม่ถูกตัด ไม่ทำในสตอรี่นี้

## Verification

- [x] Sandbox run performed: web build + Playwright `v2-sale` + `v2-text-size` (20 ผ่าน) · jest แผ่นเติมเข่งมี radiogroup ชื่อ "เลือกวิธีเติมเข่ง N" · key เก่า 20 ตัวไม่อยู่ในแคตตาล็อก
- [x] Screenshots: ไม่เปลี่ยน (หน้าตาเหมือนเดิม)

## Code review

- Reviewer:
- Findings:
- Resolution:

## QA notes
