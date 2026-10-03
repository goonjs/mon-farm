# Story E01-S10: แสดงสถานะ sync + ปุ่ม "ลองใหม่" เมื่อ error

Status: Ready

## Context

- Epic: `docs/epics/e01-foundation-sync.md`
- PRD: SYNC-2, SYNC-3, NFR-4 · D-3
- Architecture: "2026-10-02 — Direction" แถว *Pending Sync*
- ขึ้นกับ: E01-S09

## คำอธิบาย

แสดงสถานะ Synced / Pending Sync / Conflict ทั้งภาพรวมและรายการขาย (สถานะรายบันทึกแสดงต่อการขาย ไม่ใช่ต่อเข่ง)
ปุ่ม "ลองใหม่" ขึ้นเฉพาะเมื่อ sync ล้มเหลวหรือมี Conflict

## Acceptance criteria

- [ ] ภาพรวม (ส่วนหัวแอป): Synced / Pending Sync (+จำนวน) / Conflict / error — ไอคอน + ข้อความไทย ไม่ใช้สีอย่างเดียว (SYNC-3, NFR-4); คำ: `ซิงก์แล้ว` / `รอส่ง N` / `ขัดกัน N` / `ส่งไม่สำเร็จ · ลองใหม่` (design-system §7)
- [ ] รายบันทึก: แต่ละการขายในรายการแสดงสถานะของตัวเอง — แสดงต่อการขาย ไม่แสดงต่อเข่ง (SYNC-3, D-28); ลำดับความสำคัญ Conflict → error (+ลองใหม่) → Pending Sync → Synced (architecture §สถานะ sync)
- [ ] สถานะของการขาย = รวมจากเข่ง/event ในการขายนั้น: มี Conflict → Conflict; ไม่มี Conflict แต่มีค้างส่ง → Pending Sync; ที่เหลือ → Synced
- [ ] เข่งที่อยู่ใน Conflict ยังมีธง Conflict ของตัวเองที่เข่งนั้น (D-28)
- [ ] ใช้งานปกติไม่มีปุ่ม Sync; ปุ่ม "ลองใหม่" แสดงเฉพาะเมื่อ error หรือ Conflict และกดแล้ว sync ทันที (SYNC-2, D-3)
- [ ] Conflict แสดงจำนวนและพาไปหน้าจอตัดสิน (หน้าจออยู่ E01-S11)
- [ ] สถานะเปลี่ยนเองเมื่อ online/offline โดยไม่ต้อง reload

## Offline / sync behavior

- ออฟไลน์: แสดง Pending Sync ไม่แสดงเป็น error
- error จริง (เช่น rules ปฏิเสธ) แสดงปุ่ม "ลองใหม่"; ข้อมูลในเครื่องคงอยู่

## Test plan

- [ ] Vitest: รวมสถานะการขายจากเข่ง (Conflict > Pending Sync > Synced)
- [ ] jest-expo: ตัวบอกสถานะทุก state, ปุ่มลองใหม่แสดง/ไม่แสดงตามเงื่อนไข, ธง Conflict ที่เข่ง
- [ ] Playwright: offline → Pending → online → Synced; จำลอง error → ปุ่มลองใหม่ (screenshot ทุก state)

## คำถามเจ้าของ

- สถานะ sync รายบันทึกแสดงระดับไหน: ต่อการขาย หรือต่อเข่ง

**คำตอบเจ้าของ (2026-10-03):**
- แสดงต่อการขาย (ไม่ใช่ต่อเข่ง); เข่งที่อยู่ใน Conflict ยังมีธง Conflict ของตัวเอง

**คำตอบเจ้าของ (2026-10-03) — จาก mockup `docs/ux/mockups/flow-v1.html`:**
- ?15 ป้าย sync ภาพรวม → **`ซิงก์แล้ว` / `รอส่ง N` / `ขัดกัน N` / `ส่งไม่สำเร็จ · ลองใหม่`** (แทน `ค้าง N` ใน design-system §7)

คำถามเปิด (ยังไม่ได้ถาม):
- คำต่อการขายในรายการ (ไม่มีตัวเลข) ใช้คำชุดเดียวกันไหม — `ซิงก์แล้ว` / `รอส่ง` / `ขัดกัน` / `ส่งไม่สำเร็จ · ลองใหม่` — แทน `ส่งแล้ว` / `ค้างส่ง` ใน `docs/ux/flows/e02-access-and-sync-states.md` §7.2 และ `docs/ux/flows/e04-weighing-sale.md`?

## Verification

## Dev notes

## Code review

## QA notes
