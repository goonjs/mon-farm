# Story E01-S12: คิวรูป/วิดีโอในเครื่อง → Cloud Storage

Status: Ready

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
- ยืนยัน bucket ของ dev และ bucket หลัก (prod) อยู่ใน asia-southeast3 (กรุงเทพฯ) และ budget alert ครอบคลุม Storage; build dev/preview อัปโหลดเข้า bucket ของ dev เท่านั้น

## Verification

## Dev notes

## Code review

## QA notes
