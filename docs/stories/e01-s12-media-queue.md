# Story E01-S12: คิวรูป/วิดีโอในเครื่อง → Cloud Storage

Status: In Progress

> **ติด D-48:** ส่วนอัปโหลดขึ้น Cloud Storage ทำจริงไม่ได้จนกว่าเจ้าของอัปเกรดแผน (bucket ยังไม่ถูกสร้าง) ทำได้เฉพาะคิวในเครื่อง/อินเทอร์เฟซ และ test ด้วย fake

## Context

- Epic: `docs/epics/e01-foundation-sync.md`
- PRD: OPS-13, NFR-2, NFR-5 · D-1
- Architecture: "2026-10-02 — Direction" แถว *Media*
- ขึ้นกับ: E01-S09, E01-S10
- ปรับตาม D-34 (2026-10-03)

## คำอธิบาย

โครงพื้นฐานของสื่อ: เก็บไฟล์เข้าคิวในเครื่อง + event metadata แล้ว sync engine อัปโหลดขึ้น Cloud Storage
ยังไม่มีหน้าจอถ่ายรูป (อยู่ใน epic ที่ใช้สื่อ เช่น E07, E09)

## Acceptance criteria

- [ ] เพิ่มสื่อออฟไลน์ได้: เก็บไฟล์ในเครื่อง + event (วันที่/เวลา, แหล่งที่มา, entity ที่เกี่ยวข้อง, GPS เมื่อมี) ใช้ได้ทันที (OPS-13)
- [ ] มีเน็ต → อัปโหลดไป `groups/{gid}/media/{mediaId}`; ล้มเหลว → ลองใหม่อัตโนมัติ (NFR-2)
- [ ] ไฟล์ในเครื่องไม่ถูกลบจนอัปโหลดสำเร็จ
- [ ] Storage rules: เฉพาะสมาชิกกลุ่มที่ login; ไม่มี URL สาธารณะ; path เดาไม่ได้ (NFR-5)
- [ ] สถานะอัปโหลดแสดงในระบบสถานะของ E01-S10 (Pending Sync)

## Offline / sync behavior

- สื่อเข้าคิวในเครื่องก่อนเสมอ; อัปโหลดโดย sync engine เท่านั้น (NFR-2)
- เครื่องอื่นเห็น metadata ทันทีหลัง sync, ไฟล์ตามมาเมื่ออัปโหลดเสร็จ

## Test plan

- [ ] Vitest: คิวอัปโหลดกับ fake storage — สำเร็จ / ล้มเหลว + retry / force-close กลางทาง
- [ ] rules test บน Storage emulator: สมาชิก / ไม่ใช่สมาชิก / ไม่ login
- [ ] Playwright (เว็บ): เพิ่มไฟล์ผ่าน test hook ตอน offline → online → อัปโหลดแล้ว

## ต้องให้เจ้าของทำ/อนุมัติ

- ถ้าต้องใช้ `expo-file-system` หรือ lib อื่น → gate dependency
- (เลื่อนตาม D-48) ยืนยัน bucket ของ dev และ bucket หลัก (prod) อยู่ใน asia-southeast3 (กรุงเทพฯ) และ budget alert ครอบคลุม Storage; build dev/preview อัปโหลดเข้า bucket ของ dev เท่านั้น

## Verification

## Dev notes

### 2026-10-09 (overnight, team INFRA) — core เท่านั้น (D-48)

- `src/sync/media.ts`: port `MediaQueue` (ไฟล์ในเครื่อง) + `RemoteMedia` (Cloud Storage), `uploadMedia` (ปล่อยไฟล์ในเครื่อง
  หลังอัปโหลดยืนยันแล้วเท่านั้น; object มีอยู่และ hash ตรง = สำเร็จ; hash ต่าง = error ห้ามทับ), path จาก id ที่ตรวจแล้ว
  เท่านั้น, `MemoryMediaQueue` / `FakeStorage`
- `SyncEngine` รับ `media` ได้: อัปโหลดหลังส่ง event, ใช้ backoff เดียวกัน, ไฟล์ค้างนับเป็น Pending (AC5)
- ยังไม่ทำ: คิวถาวร (web: Blob ใน IndexedDB `mediaQueue` ต้องขึ้น version DB; native: ต้องเลือก lib ไฟล์ — gate
  dependency), adapter Cloud Storage + Storage rules (ไม่มี bucket, D-48), Playwright; ไฟล์ที่ hash ต่างตัวเดียวทำให้
  ไฟล์ถัดไปรอจนกด "ลองใหม่" และรอบนั้นข้าม pull — ควรเปลี่ยนเป็นข้ามทีละไฟล์เมื่อทำ adapter จริง

## Code review

- 2026-10-09 independent review (separate agent, read-only), fixed in e64fe1a: pull/fetch had no timeout (the engine
  could hang forever) → 30-second timeout; a corrupt doc's error vanished on the next run → its id is kept until `retry()`
  re-checks it (`integrityIds()`); unhandled rejections from timers; one refused event held back the whole outbox;
  `stop()` didn't stop retries; the cursor could move backwards; conflict options nested in two lines were lost.
  Not fixed (minor): `unauthenticated` retries forever with no token refresh (needs login E02-S01); the first full
  download is not paged; `foldRecord` recurses once per event in the chain

## QA notes
