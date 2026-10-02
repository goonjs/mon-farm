# Story E06-S06: แผนปุ๋ย (ไม่บังคับ) → ค่าใช้จ่ายวางแผน

Status: Draft

## Context

- Epic: `docs/epics/e06-fertilizer.md`
- PRD: FERT-2, FIN-2, FIN-9
- ใหม่
- ขึ้นกับ: E06-S01; E11 story วงจรค่าใช้จ่าย Planned + กระแสเงินสด

## คำอธิบาย

เจ้าของบันทึกแผนปุ๋ย (ปกติเป็นแผนของอาจารย์สมหวัง) เป็นค่าใช้จ่าย Planned
เมื่อซื้อจริง ผูกการซื้อกับแผนได้

## Acceptance criteria

- [ ] ฟิลด์แผน: ชนิด, จำนวนกระสอบ, ช่วงเวลา, การแบ่งตามโซน/คนงาน — กรอกไม่ครบก็บันทึกได้ (FERT-2)
- [ ] แผนแสดงเป็น Planned ในกระแสเงินสด ไม่อยู่ในยอดเกิดจริงเด็ดขาด (FIN-2)
- [ ] ผูกการซื้อ (E06-S01) กับแผนได้ → แผนนั้นไม่ถูกนับเป็น Planned ซ้ำ
- [ ] ราคาประมาณไม่ทราบ → แสดง Unknown ไม่แต่งตัวเลข

## Offline / sync

- บันทึกและผูกแผนได้ออฟไลน์; sync เป็น event ปกติ

## Test plan

- [ ] Unit: แผน → Planned; ผูกการซื้อ → Planned หายจากยอด, Actual ขึ้น
- [ ] Component: ฟอร์มแผนกรอกบางช่องก็บันทึกได้ ช่องว่างแสดง Not recorded

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

