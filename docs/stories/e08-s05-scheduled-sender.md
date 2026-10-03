# Story E08-S05: ตัวส่งแจ้งเตือนตามเวลา ฝั่ง server + ไม่ส่งซ้ำ

Status: Draft

## Context

- Epic: `docs/epics/e08-tasks-notifications.md`
- PRD: TASK-4, TASK-5, TASK-7, NFR-6 · D-1
- ใหม่ — **ต้องขออนุมัติเจ้าของก่อนเริ่ม**: deploy Cloud Functions (scheduled) บนโปรเจกต์ Blaze (โปรเจกต์เดียว D-34) — ชี้ database `dev` ก่อน แล้วค่อย prod, ค่าใช้จ่าย และ dependency ฝั่ง server
- ขึ้นกับ: E08-S03, E08-S04; E01 story Firestore + security rules; E09-S03 (การเตือนเอกสาร)

## คำอธิบาย

ฟังก์ชันตั้งเวลาบน server อ่านงาน/เอกสารที่ถึงรอบเตือนจาก Firestore แล้วส่ง push
ถึงผู้รับ ไม่ส่งซ้ำซ้อน และเตือนเอกสารซ้ำจนกว่าจะจัดการ ไม่รวม LINE

## Acceptance criteria

- [ ] รันตามเวลา (region asia-southeast1) ส่งเฉพาะรายการที่เปิดเตือนและถึงรอบ (TASK-4, TASK-7)
- [ ] ไม่ส่งซ้ำ: หนึ่งรายการ ต่อหนึ่งรอบ ต่อหนึ่งผู้รับ ส่งครั้งเดียว แม้ฟังก์ชันรันซ้ำ (TASK-7)
- [ ] เอกสารเตือนซ้ำจนกว่าจะจัดการ; งานทั่วไปไม่ซ้ำเว้นแต่เลือก (TASK-7)
- [ ] ส่งถึงผู้รับตาม E08-S03 เท่านั้น (TASK-5); บันทึกผลการส่งไว้ตรวจได้
- [ ] แยกข้อมูลตามกลุ่มฟาร์ม; dev ส่งเฉพาะข้อมูลทดสอบ (NFR-5)
- [ ] ค่าใช้จ่ายอยู่ในงบที่ตั้งไว้ มี budget alert (NFR-6)

## Offline / sync

- ตัวส่งเห็นเฉพาะข้อมูลที่ sync แล้ว: งานที่ยัง Pending Sync จะไม่ถูกเตือน — แอปแสดงรายการถึงกำหนดในเครื่องเองด้วย (E13 หน้าวันนี้)

## Test plan

- [ ] Unit: เลือกรายการถึงรอบ + key กันส่งซ้ำ (นาฬิกาจำลอง)
- [ ] Integration: Firebase emulator รันฟังก์ชันสองครั้ง → ส่งครั้งเดียว
- [ ] Sandbox: ส่ง push จริงบน dev ถึง Android หนึ่งเครื่อง

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

1. อนุมัติ Cloud Functions แบบตั้งเวลาบน Blaze (dev ก่อน แล้ว prod) ไหม
2. ตัวส่งรันถี่แค่ไหน: วันละครั้ง (เวลา __) | ทุกชั่วโมง
3. เสริมการเตือนในเครื่อง (local notification) ตอนออฟไลน์ด้วยไหม — ไม่อยู่ใน PRD: ไม่ต้อง | ต้องการ (อาจซ้ำกับ push ต้องตัดซ้ำ)
