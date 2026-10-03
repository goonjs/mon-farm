# Story E05-S03: กระทบยอดกับผู้ซื้อ (ตรวจครั้งเดียว)

Status: Draft

## Context

- Epic: `docs/epics/e05-reconciliation-settlement.md`
- PRD: SET-2, SET-3, SET-6 (สถานะการตรวจ) · D-15
- ใหม่ (เดิมตรวจด้วยสายตาร่วมกัน ไม่มี story)
- ขึ้นกับ: E05-S01; E04 story สถานะการขาย + แก้/void เข่ง (SALE-17, SALE-20)

## คำอธิบาย

หลังชั่งครบทุกจุด ใส่ กก. / ยอดเงิน (และจำนวนเข่งถ้ามี) ที่ผู้ซื้อแจ้ง แล้ววางเทียบกับ
ยอดของเรา ถ้าต่าง เจาะลงถึงเข่งเพื่อแก้ ถ้ายังต่าง ปิดเป็น Difference found + เหตุผล

## Acceptance criteria

- [ ] ใส่ยอดผู้ซื้อ: กก., ยอดเงิน, จำนวนเข่ง (ไม่บังคับ) แสดงเทียบข้างยอดเรา พร้อมส่วนต่าง (SET-2)
- [ ] เจาะลึกได้: การขาย → จุดชั่ง → เข่ง → ส่วนของเข่งเชื่อม แล้วแก้เข่งจากตรงนั้น (SET-3)
- [ ] เงินคำนวณจากเข่งที่บันทึกเสมอ ไม่ใช้ยอดผู้ซื้อแทน (D-15)
- [ ] สถานะการตรวจ: Pending · Weight verified · Sale total verified · Difference found (SET-6)
- [ ] Difference found ต้องมีเหตุผล; ส่วนต่างถูกบันทึกไว้ ไม่เกลี่ยเงียบ ๆ
- [ ] แก้เข่งหลังตรวจแล้ว → สถานะการตรวจกลับเป็น Pending (ติดธงให้ตรวจใหม่)

## Offline / sync

- ยอดผู้ซื้อ สถานะ และเหตุผล เป็น event ออฟไลน์ได้
- เข่งที่ sync เข้ามาหลังตรวจแล้วเปลี่ยนยอด → สถานะกลับเป็น Pending

## Test plan

- [ ] Unit: ส่วนต่าง กก./เงิน/เข่ง และการเปลี่ยนสถานะทุกเส้น
- [ ] e2e: ยอดต่าง → เจาะถึงเข่ง → แก้ → ตรงกัน → Sale total verified
- [ ] e2e: ยังต่าง → Difference found + เหตุผล

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

