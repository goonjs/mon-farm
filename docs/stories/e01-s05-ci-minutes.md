# Story E01-S05: CI ประหยัดนาที — ข้ามเอกสารล้วน, cache, e2e ใช้ dist เดิม, ประเมิน bun

Status: Ready

## Context

- Epic: `docs/epics/e01-foundation-sync.md`
- PRD: NFR-6
- Architecture: "2026-10-02 — Direction" แถว *CI minutes*; `.github/workflows/ci.yml` (ตอนนี้เป็น job `verify` เดียว)
- ขึ้นกับ: —

## คำอธิบาย

แยก CI เป็น `changes → verify → e2e` ให้ fail-fast และไม่เปลืองนาที
พร้อมประเมินว่า bun เป็นตัวติดตั้งใน CI คุ้มไหม (ประเมินเท่านั้น ไม่เปลี่ยนจริง)

## Acceptance criteria

- [ ] job `changes` ราคาถูก: PR ที่แก้เฉพาะเอกสาร (`docs/**`, `*.md`) ข้าม verify/e2e แต่ check ที่บังคับยังผ่าน (ไม่ขวาง merge) (NFR-6)
- [ ] ลำดับ `changes → verify → e2e` ทีละขั้น, ขั้นแรกแดง → ขั้นต่อไปไม่รัน, ทุก job มี `timeout-minutes`
- [ ] e2e ใช้ `dist/` ที่ verify build ไว้ (artifact) ไม่ build ซ้ำ
- [ ] cache Playwright browsers ตามเวอร์ชันใน lockfile; รอบที่ cache hit ไม่ดาวน์โหลดใหม่
- [ ] trigger ยังเป็น `push: [dev, main]` + `pull_request` (PR รันครั้งเดียว; merge เข้า dev/main ตรวจซ้ำ)
- [x] ประเมิน bun: เทียบเวลา install กับ `npm ci` บน runner, ตรวจ dependency tree + `trustedDependencies`, เขียนข้อเสนอใน Dev notes — ปิดด้วย ADR 0002 (เจ้าของรับผล POC จาก sandbox แทนการวัดบน runner, 2026-10-03)
- [ ] บันทึกนาที CI ก่อน/หลัง (median 3 รอบ) ใน Dev notes

## Offline / sync behavior

- N/A — CI เท่านั้น ไม่แตะข้อมูล

## Test plan

- [ ] PR ทดสอบที่แก้เอกสารล้วน → verify/e2e ถูกข้าม, check เขียว
- [ ] PR ที่แก้โค้ด → ครบทุก job; ทำให้ typecheck แดงโดยตั้งใจ → e2e ไม่รัน
- [ ] รันครั้งที่ 2 → log แสดง Playwright cache hit

## ต้องให้เจ้าของทำ/อนุมัติ

- อนุมัติ push ของ PR ทดสอบแต่ละครั้ง
- ปรับ branch protection (required checks) ให้ตรงชื่อ job ใหม่ — เป็นการตั้งค่าบัญชี เจ้าของทำ
- D8 (ตัดสินแล้ว 2026-10-03): **เพิ่ม `changes` เป็น required check ใน branch protection หลัง PR CI-minutes ของ platform merge แล้ว** — เจ้าของเป็นคนตั้งค่า
- ถ้าจะเปลี่ยนไปใช้ bun จริง: เป็นการเปลี่ยนตัวติดตั้ง → ผ่าน gate dependency แยก story

## Verification

## Dev notes

- ประเมิน bun: ผล POC และข้อเสนออยู่ที่ `docs/adr/0002-bun-package-manager-ci.md` (Accepted 2026-10-03: คง npm — เจ้าของรับผล POC จาก sandbox, AC ปิดแล้ว)

## Code review

## QA notes

## คำถามเจ้าของ

**คำตอบเจ้าของ (2026-10-03):**
- D8 → **เพิ่ม `changes` เป็น required check หลัง PR CI-minutes (story นี้) merge** — เจ้าของตั้งค่าเอง
