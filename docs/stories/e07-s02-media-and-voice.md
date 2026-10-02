# Story E07-S02: แนบรูป/วิดีโอ/เสียง ออฟไลน์

Status: Draft

## Context

- Epic: `docs/epics/e07-field-operations.md`
- PRD: OPS-1 (เสียง), OPS-2, OPS-13, NFR-2, NFR-5
- ใหม่
- ขึ้นกับ: E07-S01; E01 story คิวสื่อ → Cloud Storage

## คำอธิบาย

แนบรูป วิดีโอ และอัดเสียงกับการตรวจสวน (และใช้ซ้ำกับเหตุการณ์ใน E07-S05)
เก็บในเครื่องก่อน อัปโหลดตอน sync

## Acceptance criteria

- [ ] ถ่าย/เลือกรูปและวิดีโอ, อัดเสียงได้; เสียงต้นฉบับเก็บไว้ (OPS-1, OPS-2)
- [ ] สื่อแต่ละชิ้นเก็บ วันที่/เวลา, แหล่งที่มา, entity ที่เกี่ยวข้อง, GPS ถ้ามี (OPS-13)
- [ ] สื่อยังอยู่หลังปิดแอป/บังคับปิด และอัปโหลดผ่าน sync engine (NFR-2)
- [ ] URL สื่อเดาไม่ได้จากภายนอก เข้าได้เฉพาะสมาชิกกลุ่ม (NFR-5)
- [ ] dependency ใหม่ (กล้อง/image picker/เสียง/location) ผ่าน dependency gate ใน `CLAUDE.md` ก่อนติดตั้ง

## Offline / sync

- บันทึกครบออฟไลน์; สื่อแต่ละชิ้นมีสถานะ Pending Sync ของตัวเอง
- อัปโหลดล้มเหลว → ลองใหม่อัตโนมัติ ไม่ลบไฟล์ในเครื่องจนอัปโหลดสำเร็จ

## Test plan

- [ ] Unit: metadata สื่อ + สถานะคิว
- [ ] Integration: อัปโหลดล้มเหลว → retry → สำเร็จ (Firebase emulator)
- [ ] Device: อัดเสียง/ถ่ายรูปบน Android จริง ออฟไลน์

## Verification

- [ ] Sandbox run:
- [ ] Screenshots (UI) — golden path:
- [ ] Screenshots (UI) — edge cases:

## Dev notes

## Code review

- Reviewer (agent/session แยก):
- Findings:
- Resolution:

## QA notes

## คำถามเจ้าของ

1. วิดีโอจำกัดความยาว/ขนาดไหม (กระทบพื้นที่เครื่องและค่า Storage): จำกัด __ วินาที | ไม่จำกัด
