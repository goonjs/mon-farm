# Story E03-S06: ส่วนแบ่งรายคนกรีด + เลิกใช้สัญญาต่อโซนและ `basis`

Status: Draft

## Context

- Epic: `docs/epics/e03-master-data.md`
- PRD: MD-8, D-12
- เลิกใช้: S15 — `zone_contract_set`, `zone_contract_cleared`, `Zone.contract` และ `split_set.basis` ใน `src/core/types.ts`, `project.ts`, `settle.ts`; การ์ดสัญญาต่อโซน/split ใน `src/app/sale/[id]/setup.tsx` (S6)
- ขึ้นกับ: E03-S01, E03-S05

## คำอธิบาย

ส่วนแบ่ง เจ้าของ/คนกรีด ตั้งรายคนกรีดแบบมีช่วงเวลา ค่าเริ่มต้น 50/50 คิดจากมูลค่าขายรวม (gross)
และเอาสัญญาต่อโซนกับช่อง `basis` ที่ไม่ได้ใช้ออกจากโค้ด

## Acceptance criteria

- [ ] ตั้งส่วนแบ่งต่อคนกรีด มีวันที่มีผล; ไม่ได้ตั้ง = 50/50 (MD-8)
- [ ] "ส่วนแบ่งของคนกรีด X ณ วันขาย" คืนค่าที่มีผลวันนั้น; เปลี่ยนส่วนแบ่งไม่กระทบการขายเก่า
- [ ] คิดจาก gross เสมอ; ไม่มีตัวเลือก `basis` ทั้งใน event, state และ UI (D-12)
- [ ] ลบ `zone_contract_set` / `zone_contract_cleared` / `Zone.contract` และ test ที่เกี่ยวข้อง; `settle()` อ่านส่วนแบ่งจากข้อมูลหลักแทน
- [ ] หน้า setup ไม่มีการ์ด split และสัญญาต่อโซนอีก

## Offline / sync

- ตั้งส่วนแบ่งออฟไลน์ได้ Pending Sync
- ส่วนแบ่งเป็นตัวเลขเงิน: แก้ซ้อนจากสองเครื่อง → Conflict เสมอ ห้าม last-write-wins (SYNC-4)

## Test plan

- [ ] Vitest: ส่วนแบ่ง ณ วันที่ (ค่าเริ่มต้น 50/50, หลังเปลี่ยน, ก่อนเปลี่ยน); `settle()` ใช้ค่าจากข้อมูลหลัก — owner + worker = gross
- [ ] Vitest: types ไม่มี `basis` / `zone_contract_*` (compile ผ่าน, test เก่าถูกแทน)
- [ ] jest-expo: ฟอร์มส่วนแบ่งต่อคนกรีด

## Verification

## Dev notes

## Code review

## QA notes

## คำถามเจ้าของ

- ค่าส่วนแบ่งที่เลือกได้: (a) % จำนวนเต็มใดก็ได้ · (b) รายการ 50/50, 60/40, 70/30 (แบบเดิม)
- การขายเก่าในเครื่องที่ใช้ `zone_contract_set` (ถ้าเก็บไว้ ดู E03-S01): อ่านย้อนหลังได้ หรือทิ้ง
