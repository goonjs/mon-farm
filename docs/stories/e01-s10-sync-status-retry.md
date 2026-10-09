# Story E01-S10: แสดงสถานะ sync + ปุ่ม "ลองใหม่" เมื่อ error

Status: In Progress

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
- [ ] รายบันทึก: แต่ละการขายในรายการแสดงสถานะของตัวเอง — แสดงต่อการขาย ไม่แสดงต่อเข่ง (SYNC-3, D-28); ลำดับความสำคัญ Conflict → error (+ลองใหม่) → Pending Sync → Synced (architecture §สถานะ sync); คำต่อการขาย (ไม่มีตัวเลข): `ซิงก์แล้ว` / `รอส่ง` / `ข้อมูลขัดกัน` / `ส่งไม่สำเร็จ` (คำตอบเจ้าของ 2026-10-03)
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

**คำตอบเจ้าของ (2026-10-03) — คำ sync ต่อการขาย (ไม่มีตัวเลข):**
- **`ซิงก์แล้ว` / `รอส่ง` / `ข้อมูลขัดกัน` / `ส่งไม่สำเร็จ`** — แทน `ส่งแล้ว` / `ค้างส่ง` / `ขัดกัน` ใน `docs/ux/flows/e02-access-and-sync-states.md` §7.2 และ `docs/ux/flows/e04-weighing-sale.md` (แก้แล้ว)
- ปุ่ม `[ลองใหม่]` ยังแสดงตาม AC5 (เฉพาะ error / Conflict)

## Verification

## Dev notes

### 2026-10-09 (overnight, team INFRA) — core เท่านั้น

- `src/sync/status.ts`: `saleSyncState` (Conflict → error → Pending → Synced ต่อการขาย), `overallBadge` (ออฟไลน์ =
  รอส่ง ไม่ใช่ error; ปุ่มลองใหม่เฉพาะ error/Conflict; outbox ว่างแสดง ซิงก์แล้ว), คำไทยตามคำตอบเจ้าของใน `src/i18n/messages.ts`
- ยังไม่ทำ: component ส่วนหัว/รายการขาย + screenshot (ยังไม่มี remote จริงให้ต่อ — ดู E01-S09 Dev notes) และธง Conflict ที่เข่ง

## Code review

- 2026-10-09 independent review (separate agent, read-only), fixed in e64fe1a: pull/fetch had no timeout (the engine
  could hang forever) → 30-second timeout; a corrupt doc's error vanished on the next run → its id is kept until `retry()`
  re-checks it (`integrityIds()`); unhandled rejections from timers; one refused event held back the whole outbox;
  `stop()` didn't stop retries; the cursor could move backwards; conflict options nested in two lines were lost.
  Not fixed (minor): `unauthenticated` retries forever with no token refresh (needs login E02-S01); the first full
  download is not paged; `foldRecord` recurses once per event in the chain

## QA notes
