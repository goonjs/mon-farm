# Story E01-S01: เขียนการออกแบบ sync ใน architecture.md (SDD)

Status: Review

## Context

- Epic: `docs/epics/e01-foundation-sync.md`
- PRD: SYNC-1…4, SYNC-9…11, NFR-2, NFR-3, NFR-5 · D-1, D-3, D-19, D-22
- Architecture: "2026-10-02 — Direction" (ระบุว่าต้องเขียน System overview, Local data layer, Sync engine, Backend, Security ใหม่ **ก่อน story sync แรก**)
- ขึ้นกับ: —

## คำอธิบาย

story เอกสารล้วน: เขียนหัวข้อที่ถูกแทนที่ใน `docs/architecture.md` ใหม่ร่วมกับเจ้าของ
ให้ story ที่เหลือของ E01/E02 มีแบบให้เขียน test ได้ ไม่ต้องเดาเอง

## Acceptance criteria

- [ ] หัวข้อ System overview, Local data layer, Sync engine, Backend API, Security เขียนใหม่ ตรงกับ Direction 2026-10-02 และไม่ขัด D-1…D-33
- [ ] schema ของ event ใหม่: `id` = **UUIDv7** (พร้อมเหตุผล), เลขลำดับต่อเครื่อง, `actor` = user id + device id, group id, `targetId` + `baseEventId` สำหรับการแก้ (SYNC-9)
- [ ] ตารางว่า event ชนิดใด **รวมอัตโนมัติ** และชนิดใดเป็น **Conflict** — ครอบคลุมเงิน น้ำหนัก จำนวน ห้าม last-write-wins (SYNC-4)
- [ ] กฎลำดับ event ข้ามเครื่อง: ไม่มีลำดับรวมทั้งระบบ ไม่พึ่งนาฬิกาเครื่อง — ใช้ `seq` ต่อเครื่อง + `baseEventId`; เวลาใช้แสดงผลเท่านั้น (NFR-3)
- [ ] ไม่ย้ายข้อมูลแอปเดิมที่เก็บในเครื่อง (log `(sale_id, seq)`, farm/people store) — MVP เริ่มใหม่; ระบุว่า store เก่าถูกล้าง/ข้ามอย่างปลอดภัยตอนอัปเกรด ไม่ crash
- [ ] โครง Firestore/Storage (`groups/{gid}/events/{eventId}`, members, invites, media) + หลัก security rules (ACC-5, NFR-5) — รวมว่ารหัสเชิญ 6 หลักตรวจด้วย rules อย่างเดียวได้ไหม หรือต้องใช้ Cloud Function
- [ ] สอดคล้องคำตอบเจ้าของ 2026-10-03: บังคับ login + มีกลุ่มก่อนบันทึก, Soft Delete ทุกบันทึก, Conflict แสดงค่าก่อนแก้ + บล็อกปิดยอด, สถานะ sync รายการขาย, ออกกลุ่มลบสำเนาในเครื่อง, SYNC-12 อยู่ที่ E01-S15
- [ ] เขียนเป็นภาษาไทย (คำเทคนิค/code เป็นอังกฤษ)
- [ ] ระบุว่า event ทุกตัวมี `actor.userId` และ group id เสมอ — ต้อง login และมีกลุ่มฟาร์มก่อนบันทึก ไม่มีข้อมูลก่อน login/ก่อนมีกลุ่ม (D-23, D-24)
- [x] เจ้าของอ่านและตกลง — บันทึกวันที่ตกลงในเอกสาร (ตกลง 2026-10-03)

## Offline / sync behavior

- N/A สำหรับโค้ด — แต่เอกสารต้องตอบทุกข้อใน `docs/checklists/offline-sync-checklist.md` ในระดับออกแบบ

## Test plan

- [ ] ไม่มีโค้ด: ตรวจ ID (SYNC-x, D-x), ลิงก์ และ `code` ในเอกสารด้วยสคริปต์
- [ ] story E01-S02, E01-S08, E01-S09 แปลง AC ของเอกสารนี้เป็น test ที่ fail ก่อน

## ต้องให้เจ้าของทำ/อนุมัติ

- ตกลงการออกแบบทั้งหมดก่อนเริ่ม E01-S02

## คำถามเจ้าของ

- ต้อง login ก่อนใช้งานครั้งแรกไหม
- ข้อมูลที่บันทึกก่อนมีกลุ่มฟาร์มไปอยู่กลุ่มไหน
- รูปแบบ event id: UUIDv7 หรือ ULID
- ย้ายข้อมูลแอปเดิมในเครื่องไหม
- กฎลำดับ event ข้ามเครื่อง
- ภาษาของ architecture.md ส่วนที่เขียนใหม่

**คำตอบเจ้าของ (2026-10-03):**
- ต้อง login ก่อนใช้งานครั้งแรก (ครั้งแรกต้องมีเน็ต); ยังไม่ login บันทึกไม่ได้ (E02-S01)
- ต้องสร้างหรือเข้าร่วมกลุ่มก่อนบันทึก จึงไม่มีข้อมูลก่อนมีกลุ่ม; event ทุกตัวมี group id ตั้งแต่แรก (E02-S02)
- event id = **UUIDv7**
- ไม่ย้าย — แอปเดิมที่เก็บแค่ในเครื่อง พอทำ MVP นี้ไม่ต้องย้ายเลย
- อ้าง `baseEventId` + `seq` ต่อเครื่อง (ไม่ใช้ Hybrid Logical Clock)
- ภาษาไทย

**คำตอบเจ้าของระหว่างทบทวนร่าง (2026-10-03):**
- แก้พร้อมกันคนละฟิลด์ที่ไม่ใช่เงิน/น้ำหนัก/จำนวน/สถานะ → รวมอัตโนมัติ (D-30)
- รหัสเชิญ → Cloud Functions 2 ตัว (D-31)
- ไม่เข้ารหัสข้อมูลในเครื่องใน MVP → รับได้ (D-32)
- ออกกลุ่มขณะเครื่องอื่นของตัวเองยังมีรายการค้าง → ลบเลย แต่ต้องเตือนชัดเจนก่อนกดออก (D-33)
- Conflict ใดก็ได้ (รวมหมายเหตุ) บล็อกการปิดยอด/จ่ายเงิน (D-29)
- เพิ่มฟิลด์ `alsoBasedOn` ใน event → ตกลง

## Verification

- เจ้าของตกลง SDD ทั้งฉบับ + AC ทั้ง E01/E02 เมื่อ 2026-10-03 (question mode); ตรวจ ID ด้วยสคริปต์ผ่าน; review อิสระแก้ครบ

## Dev notes

- solution-architect ร่าง 5 หัวข้อเป็นภาษาไทย แล้วนำลง `docs/architecture.md` (2026-10-03)
- ตรวจ ID ด้วยสคริปต์: ทุก D-/ACC-/SYNC-/NFR-/SET-/MD- และ E0x-Sxx ใน architecture.md มีอยู่จริงใน `docs/prd.md` / `docs/stories/`
- หัวข้อ v0.1 "Client architecture" ยังพูดถึง `seq` ต่อการขาย — ติดหมายเหตุว่าถูกแทนแล้ว ลบเมื่อ E01-S02 เขียนโค้ดใหม่
- ข้อมูล quota มาจาก search excerpt (firebase.google.com ถูก proxy บล็อก) ต้องตรวจซ้ำใน E01-S07

## Code review

รอบที่ 1 (agent แยก, 2026-10-03): blocking 2 ข้อ (ลำดับ `pending_ops` ตอนออกกลุ่ม; การลองออกกลุ่มซ้ำไม่ idempotent)
+ should-fix 12 ข้อ + nit — แก้ครบในเอกสาร: ออกกลุ่มขับด้วย `memberships.state` และอ่าน doc สมาชิกของตัวเองจาก
เซิร์ฟเวอร์เมื่อถูกปฏิเสธ (+ rule `allow get` ของตัวเอง), `increment(-1)`, ความไม่ซ้ำ `deviceSeq` เฉพาะแถวของเครื่องนี้
+ `allowBackup: false`, นิยาม canonical JSON + pull ไม่ค้างเพราะ doc เสีย, กฎ forward-compat, นิยาม head/base,
รีเฟรชรายการกลุ่ม + push ทุกกลุ่ม, ล้างของเก่าไม่ชน store farm/people ชั่วคราว, `rules_version = '2'` + wrapper,
ตาราง Direction ตรงกฎรวมใหม่, บันทึก D-30…D-33, ปรับ E01-S08/S10/S11, E02-S03/S04 ให้ตรง

## QA notes
