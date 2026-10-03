# Story E01-S06: รันบน Android จริงครั้งแรก (dev client)

Status: Ready

## Context

- Epic: `docs/epics/e01-foundation-sync.md`
- PRD: NFR-1 (Android ก่อน), NFR-2
- Architecture: "Open and undecided" ข้อ 1 (native ยังไม่เคยรัน); Direction — Risks carried
- ขึ้นกับ: E01-S02 (ทดสอบ store รูปแบบใหม่บนเครื่อง)

## คำอธิบาย

ความเสี่ยงอันดับหนึ่ง: แอปเคยรันแค่บนเบราว์เซอร์ สร้าง dev client (`expo-dev-client`, จำเป็นต่อ Google sign-in ใน E02)
แล้วรัน flow หลักบน Android จริง บันทึกสิ่งที่พบ

## Acceptance criteria

- [ ] build dev client Android ได้ และติดตั้งบนเครื่องจริง
- [ ] flow หลักทำงานบนเครื่อง: เริ่มการขาย → นับเข่ง (กดค้าง) → สรุปเงิน
- [ ] เข่งที่บันทึกรอดหลังล็อกจอ, force-close และเปิดใหม่ (expo-sqlite) (NFR-2)
- [ ] เสียงพูดไทยทำงานแบบออฟไลน์ (โหมดเครื่องบิน)
- [ ] ปัญหาที่พบ บันทึกใน `docs/architecture.md` และแก้ข้อ "Native has never been run"

## Offline / sync behavior

- ทดสอบทั้งหมดในโหมดเครื่องบิน; ไม่มี sync ใน story นี้

## Test plan

- [ ] jest-expo/Vitest เดิมผ่านครบ (ไม่มี regression)
- [ ] checklist รันบนเครื่องจริง + screenshot จากเครื่อง (golden path, force-close, เครื่องบิน)

## ต้องให้เจ้าของทำ/อนุมัติ

- อนุมัติติดตั้ง `expo-dev-client` (gate dependency พร้อมผลตรวจ)
- เลือกวิธี build: EAS (บัญชี Expo) หรือ build ในเครื่อง (Android SDK อยู่นอก repo → ขออนุญาตเข้าถึงนอก working directory)
- จัดหาเครื่อง Android สำหรับทดสอบ

## Verification

## Dev notes

## Code review

## QA notes
