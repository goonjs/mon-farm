# Story E01-S14: preview A/B รูปแบบ card — เงา+เส้น vs แบน+เส้น

Status: Ready

## Context

- Epic: `docs/epics/e01-foundation-sync.md`
- PRD: NFR-4 (อ่านได้กลางแดด)
- Design: `docs/ux/design-system.md` คำตอบข้อ 4 เงา — ใช้ (b) แต่ทำ preview A/B ให้เทียบก่อน
- ขึ้นกับ: E01-S06 (เครื่อง Android), E01-S07 (preview)

## คำอธิบาย

ให้เจ้าของเทียบ card 2 แบบบนเครื่องจริงกลางแดด: (A) เงา FarmMate + เส้น `ruleFaint`, (B) แบน + เส้น `ruleFaint`
แล้วเลือกแบบเดียว จอสาธารณะไม่มีเงาทั้งสองแบบ

## Acceptance criteria

- [ ] สลับแบบ A/B ได้ใน build dev/preview เท่านั้น (ไม่มีใน prod)
- [ ] หน้าจอที่มี card แสดงได้ทั้งสองแบบ; จอสาธารณะของหน้าจอชั่งไม่มีเงาในทั้งสองแบบ
- [ ] เงาแสดงผลใกล้เคียงกันบน Android และเว็บ (screenshot เทียบ)
- [ ] `npm run contrast` ผ่านทั้งสองแบบ
- [ ] บันทึกผลที่เจ้าของเลือกใน `docs/ux/design-system.md`; ตัวเลือกที่ไม่ใช้ถูกเอาออกใน story ต่อไป

## Offline / sync behavior

- N/A — การแสดงผลเท่านั้น

## Test plan

- [ ] jest-expo: style ของ card ตามแบบที่เลือก; จอสาธารณะไม่มีเงา
- [ ] Playwright: screenshot ทั้ง A และ B บน viewport มือถือ

## ต้องให้เจ้าของทำ/อนุมัติ

- ทดลองทั้งสองแบบบนเครื่องจริงกลางแดด และเลือก

## Verification

## Dev notes

## Code review

## QA notes
