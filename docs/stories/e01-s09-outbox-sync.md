# Story E01-S09: sync อัตโนมัติ — outbox ส่งขึ้น + ดึงลง

Status: Ready

## Context

- Epic: `docs/epics/e01-foundation-sync.md`
- PRD: SYNC-1, SYNC-2, SYNC-4, NFR-2 · D-3
- Architecture: "2026-10-02 — Direction" แถว *Sync unit*, *Pending Sync*; E01-S01
- ขึ้นกับ: E01-S03, E01-S08, E02-S01 (login), E02-S02 (มี group id)

## คำอธิบาย

sync engine หลัง port (`RemoteEvents`): ส่ง `pending()` ขึ้น Firestore แล้ว `markSynced`, ฟัง snapshot ของกลุ่ม
แล้วเก็บ event ของเครื่องอื่นลง store แบบ idempotent — store ในเครื่องเป็นเจ้าของความคงทน ไม่ใช่ cache ของ Firestore

## Acceptance criteria

- [ ] บันทึกตอนออฟไลน์ใช้ได้ทันที และอยู่ใน outbox (SYNC-1)
- [ ] เน็ตกลับมา → ส่งขึ้นเองโดยไม่มีปุ่ม Sync (SYNC-2, D-3)
- [ ] ส่งล้มเหลว → ลองใหม่อัตโนมัติแบบ backoff; ข้อมูลในเครื่องไม่ถูกลบหรือแก้ (SYNC-2)
- [ ] event จากเครื่องอื่นในกลุ่มลงมาเก็บในเครื่อง; ดึงซ้ำไม่เกิด event ซ้ำ
- [ ] เข่ง/รายการต่างกันจาก 3 เครื่องรวมเป็นชุดเดียวโดยไม่ถาม (SYNC-4)
- [ ] force-close ระหว่างส่ง → เปิดใหม่ส่งต่อได้ ไม่หาย ไม่ซ้ำ (NFR-2)

## Offline / sync behavior

- ออฟไลน์เป็นโหมดหลัก; sync เริ่มเองเมื่อมีเน็ต และเมื่อเปิดแอป
- ส่งไม่เป็นลำดับ/ส่งซ้ำได้ปลอดภัย (create-only + id ไม่ซ้ำ)
- การแก้ที่ขัดกันยังไม่ตรวจใน story นี้ → E01-S11

## Test plan

- [ ] Vitest: sync engine กับ fake remote — ส่ง, ล้มเหลว + retry, ดึงซ้ำ, ลำดับสลับ
- [ ] integration บน emulator: 2 client เขียนคนละเข่ง → ทั้งสองเห็นครบ
- [ ] Playwright: `setOffline(true)` → นับเข่ง → online → outbox ว่าง

## Verification

## Dev notes

## Code review

## QA notes
