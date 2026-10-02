# Story E01-S01: เขียนการออกแบบ sync ใน architecture.md (SDD)

Status: Draft

## Context

- Epic: `docs/epics/e01-foundation-sync.md`
- PRD: SYNC-1…4, SYNC-9…11, NFR-2, NFR-3, NFR-5 · D-1, D-3, D-19, D-22
- Architecture: "2026-10-02 — Direction" (ระบุว่าต้องเขียน System overview, Local data layer, Sync engine, Backend, Security ใหม่ **ก่อน story sync แรก**)
- ขึ้นกับ: —

## คำอธิบาย

story เอกสารล้วน: เขียนหัวข้อที่ถูกแทนที่ใน `docs/architecture.md` ใหม่ร่วมกับเจ้าของ
ให้ story ที่เหลือของ E01/E02 มีแบบให้เขียน test ได้ ไม่ต้องเดาเอง

## Acceptance criteria

- [ ] หัวข้อ System overview, Local data layer, Sync engine, Backend API, Security เขียนใหม่ ตรงกับ Direction 2026-10-02 และไม่ขัด D-1…D-22
- [ ] schema ของ event ใหม่: `id` (เลือก UUIDv7 หรือ ULID พร้อมเหตุผล), เลขลำดับต่อเครื่อง, `actor` = user id + device id, group id, `targetId` + `baseEventId` สำหรับการแก้ (SYNC-9)
- [ ] ตารางว่า event ชนิดใด **รวมอัตโนมัติ** และชนิดใดเป็น **Conflict** — ครอบคลุมเงิน น้ำหนัก จำนวน ห้าม last-write-wins (SYNC-4)
- [ ] กฎลำดับ event ข้ามเครื่องที่ไม่พึ่งนาฬิกาเครื่องอย่างเดียว (NFR-3)
- [ ] แผนย้ายข้อมูลในเครื่องเดิม (log `(sale_id, seq)`, farm/people store ที่อยู่นอก log) โดยไม่ทำข้อมูลหาย (NFR-2)
- [ ] โครง Firestore/Storage (`groups/{gid}/events/{eventId}`, members, media) + หลัก security rules (ACC-5, NFR-5)
- [ ] เจ้าของอ่านและตกลง — บันทึกวันที่ตกลงในเอกสาร

## Offline / sync behavior

- N/A สำหรับโค้ด — แต่เอกสารต้องตอบทุกข้อใน `docs/checklists/offline-sync-checklist.md` ในระดับออกแบบ

## Test plan

- [ ] ไม่มีโค้ด: ตรวจ ID (SYNC-x, D-x), ลิงก์ และ `code` ในเอกสารด้วยสคริปต์
- [ ] story E01-S02, E01-S08, E01-S09 แปลง AC ของเอกสารนี้เป็น test ที่ fail ก่อน

## ต้องให้เจ้าของทำ/อนุมัติ

- ตกลงการออกแบบทั้งหมดก่อนเริ่ม E01-S02
- ตอบประเด็นค้าง: ต้อง login ก่อนใช้งานครั้งแรกไหม; ข้อมูลที่บันทึกก่อนมีกลุ่มฟาร์มไปอยู่กลุ่มไหน

## Verification

## Dev notes

## Code review

## QA notes
