# Story E01-S03: ที่เก็บข้อมูลบนเว็บ localStorage → IndexedDB

Status: Draft

## Context

- Epic: `docs/epics/e01-foundation-sync.md`
- PRD: NFR-1 (D-19), NFR-2, SYNC-1
- Architecture: "2026-10-02 — Direction" แถว *Web store*; "localStorage on web, deliberately" (ถูกแทนที่)
- ขึ้นกับ: E01-S02

## คำอธิบาย

เว็บเป็นช่องทางใช้งานจริงแล้ว (D-19) เปลี่ยน `src/store/store.web.ts` เป็น IndexedDB เขียนทีละ record
(หมายเหตุ: comment หัวไฟล์ `store.ts` เขียนว่า IndexedDB อยู่แล้ว แต่โค้ดจริงยังเป็น localStorage)

## Acceptance criteria

- [ ] append 1 event = เขียน 1 record ใน IndexedDB ไม่เขียนทั้ง log ใหม่
- [ ] `load` / `pending` / `markSynced` / `listSales` ให้ผลเหมือน adapter native
- [ ] ข้อมูลเดิมใน localStorage ย้ายเข้า IndexedDB ตอนเปิดครั้งแรก; ข้อมูลเดิมไม่ถูกลบจนนับตรงกันแล้ว (NFR-2)
- [ ] IndexedDB ใช้ไม่ได้ (เช่น private mode) → ยังนับเข่งได้ และขึ้นเตือนเป็นภาษาไทยว่าไม่ได้บันทึกถาวร
- [ ] farm/people web store ย้ายตามที่ S01 ตัดสิน
- [ ] ข้อมูลยังอยู่หลัง reload/ปิดแท็บ ที่การขาย 400 เข่ง

## Offline / sync behavior

- เว็บใช้งานออฟไลน์ได้เต็มที่ (SYNC-1); outbox (`pending()`) ทำงานบนเว็บพร้อมสำหรับ E01-S08

## Test plan

- [ ] jest-expo: contract test ชุดเดียวรันกับ `MemoryStore` และ web adapter
- [ ] Playwright: นับเข่ง → reload → ครบ; seed localStorage เก่า → ย้ายแล้วครบ; โหมด storage ปิด → เตือน

## ต้องให้เจ้าของทำ/อนุมัติ

- ถ้า test ต้องใช้ `fake-indexeddb` (dev dependency) — ขออนุมัติตาม gate พร้อมผลตรวจความปลอดภัย

## Verification

## Dev notes

## Code review

## QA notes
