# Story E08-S04: รับ push บนเครื่อง (FCM)

Status: Draft

## Context

- Epic: `docs/epics/e08-tasks-notifications.md`
- PRD: TASK-6 (push ในแอป), NFR-1, NFR-5, NFR-6 · D-1
- ใหม่
- ขึ้นกับ: E02 story ล็อกอิน Google (ผู้ใช้เชิงตรรกะ); E01 story รันบน Android จริง (dev client)

## คำอธิบาย

ขอสิทธิ์แจ้งเตือน ลงทะเบียน token FCM ของเครื่องกับผู้ใช้ในกลุ่มฟาร์ม และแตะ
การแจ้งเตือนแล้วเปิดไปที่งาน/เอกสารนั้น

## Acceptance criteria

- [ ] ขอสิทธิ์แจ้งเตือนเมื่อเปิดการแจ้งเตือนครั้งแรก (ไม่ขอตอนเปิดแอป); ปฏิเสธได้ แอปยังใช้ได้ปกติ
- [ ] token ผูกกับ user + device; ออกจากระบบ/ออกจากกลุ่ม → ลบ token นั้น
- [ ] แตะการแจ้งเตือน → เปิดหน้างาน/เอกสารต้นเรื่อง
- [ ] ข้อความแจ้งเตือนไม่มีข้อมูลอ่อนไหว (เช่น เลขเอกสาร) (NFR-5)
- [ ] dependency ใหม่ (`expo-notifications` / FCM) ผ่าน dependency gate ใน `CLAUDE.md` ก่อนติดตั้ง

## Offline / sync

- ลงทะเบียน token ต้องใช้เครือข่าย: ถ้าออฟไลน์ เข้าคิวไว้ ลงทะเบียนเมื่อ sync

## Test plan

- [ ] Unit: วงจร token (ลงทะเบียน / เปลี่ยน / ลบ)
- [ ] Device: รับ push บน Android จริง แตะแล้วเปิดถูกหน้า

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

1. push บนเว็บด้วยไหม (ต้องมี service worker): **Android อย่างเดียวใน V1** | Android + เว็บ
2. iOS: ทดสอบ push ใน V1 ไหม (ต้องมีบัญชี Apple Developer สำหรับ APNs)
