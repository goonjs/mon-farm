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

- ~~อนุมัติติดตั้ง `expo-dev-client`~~ อนุมัติแล้ว 2026-10-03 (D2) ภายใต้เกณฑ์ dependency ที่ตั้งไว้ (`CLAUDE.md` 2026-10-03: maintainer น่าเชื่อถือ และ audit ไม่เพิ่ม finding ระดับ high/critical ใหม่) — ยังต้องแสดงผลตรวจก่อนติดตั้ง; ถ้าผลตรวจไม่ผ่านเกณฑ์ กลับไปถามเจ้าของ
- ~~เลือกวิธี build~~ ตัดสินแล้ว 2026-10-03: GitHub Actions + Gradle (ADR 0003); ทางเลือกฟรีอื่นเก็บไว้ใน ADR เผื่อต้องลดค่าใช้จ่าย
- สร้าง keystore สำหรับเซ็น APK และเก็บเป็น GitHub secret — ตัดสินแล้ว 2026-10-03 (D1): **เจ้าของสร้างในเครื่องตัวเอง** แล้วเก็บเป็น GitHub secret (agent ไม่เห็นไฟล์ keystore/รหัส)
- ~~จัดหาเครื่อง Android สำหรับทดสอบ~~ ตัดสินแล้ว 2026-10-03 (D2): **ใช้เครื่อง Android ของเจ้าของ**

## Verification

## Dev notes

- ทางเลือกการ build APK (EAS / GitHub Actions / เครื่องตัวเอง / Capacitor) เปรียบเทียบไว้ที่ `docs/adr/0003-android-build-path.md` (Proposed — รอเจ้าของตัดสิน)

## Code review

## QA notes

## คำถามเจ้าของ

**คำตอบเจ้าของ (2026-10-03):**
- D1 keystore → **เจ้าของสร้างในเครื่องตัวเอง และเก็บเป็น GitHub secret**
- D2 เครื่องทดสอบ → **เครื่อง Android ของเจ้าของ**; `expo-dev-client` **อนุมัติ** ภายใต้เกณฑ์ dependency ที่ตั้งไว้
