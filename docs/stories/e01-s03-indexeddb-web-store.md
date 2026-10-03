# Story E01-S03: ที่เก็บข้อมูลบนเว็บ localStorage → IndexedDB

Status: Review

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
- [ ] ไม่ย้ายข้อมูลเดิมใน localStorage (เจ้าของ 2026-10-03): คีย์ v0.4 ถูกล้างแบบ best-effort ตอนเปิดครั้งแรก ไม่ crash
- [ ] IndexedDB ใช้ไม่ได้ (เช่น private mode) → ยังนับเข่งได้ และขึ้นเตือนเป็นภาษาไทยว่าไม่ได้บันทึกถาวร
- [ ] farm/people web store เดิมไม่ย้าย — ถูกแทนด้วยข้อมูลหลักที่ sync ใน E03
- [ ] ข้อมูลยังอยู่หลัง reload/ปิดแท็บ ที่การขาย 400 เข่ง

## Offline / sync behavior

- เว็บใช้งานออฟไลน์ได้เต็มที่ (SYNC-1); outbox (`pending()`) ทำงานบนเว็บพร้อมสำหรับ E01-S08

## Test plan

- [ ] jest-expo: contract test ชุดเดียวรันกับ `MemoryStore` และ web adapter
- [ ] Playwright: นับเข่ง → reload → ครบ; seed localStorage เก่า → เปิดได้ เริ่มว่าง; โหมด storage ปิด → เตือน

## ต้องให้เจ้าของทำ/อนุมัติ

- ถ้า test ต้องใช้ `fake-indexeddb` (dev dependency) — ขออนุมัติตาม gate พร้อมผลตรวจความปลอดภัย

## Verification

รันใน container ของ session (2026-10-03):

- เห็นแดงก่อน: `e2e/web-store.spec.ts` ล้มทั้ง 2 เทสต์กับโค้ดก่อนเปลี่ยน (ไม่มี IDB `mon-farm-v1`, ไม่มีแถบเตือน)
- typecheck, lint, tokens, contrast ผ่าน; Vitest 141; jest 54; `build:web` ผ่าน; Playwright 140 ผ่าน / 6 skip (รวมสองแท็บ)
  (ผ่าน config ชั่วคราวใน scratchpad ที่ชี้ `/opt/pw-browsers/chromium` เหมือน E01-S02)
- e2e seed (`e2e/fixtures.ts`) เขียนลง IndexedDB หลังแอปสร้างฐานข้อมูลแล้วเท่านั้น

## Dev notes

### DoD ของ story นี้

- [x] เทสต์เขียนก่อนและเห็นแดง: Playwright (1 event = 1 record ใน IDB, 400 เข่ง + reload, ปิด IndexedDB → เตือน, log เก่า) — contract suite **เลื่อน** (ดูด้านล่าง)
- [x] `store.web.ts` ใช้ IndexedDB `mon-farm-v1`: append = transaction `readwrite` เดียวครอบ `events` + `meta`; ไม่เขียนคีย์ event ลง localStorage อีก
- [x] IndexedDB ใช้ไม่ได้ → `MemoryStore` + แถบเตือนภาษาไทยบนทุกหน้าจอ; นับต่อได้
- [x] `npm run verify` ทุกชั้นเขียว (Playwright ผ่าน config ชั่วคราวใน container) + screenshot ของแถบเตือนใน QA notes
- [x] review อิสระโดย subagent แยก ผลอยู่ใน §Code review
- [ ] CI เขียวบน PR


### การตัดสินใจ / ส่วนที่ต่างจากแผน

- **AC2 "ผลเหมือน native" ยังไม่มีเทสต์ระดับ adapter บน IndexedDB — เลื่อน** จนกว่า `fake-indexeddb` (dev dependency)
  จะได้รับอนุมัติจากเจ้าของ (ส่งคำขอพร้อมผลตรวจแล้ว: 0 runtime deps, Apache-2.0, audit 0) ตอนนี้ครอบด้วย Playwright
  (record ต่อ event, reload 400 เข่ง) + การอ่านโค้ดโดย reviewer เมื่ออนุมัติแล้วจะรัน contract suite ของ `MemoryStore`
  กับ `IndexedDbStore`
- `EventStore.isDurable()` ใหม่ + สัญญาณสด `src/store/durability.ts`: storage ล้มหลังเปิดได้ (quota, Safari ตัดการเชื่อมต่อ)
  → แถบเตือนขึ้นทันที ไม่ใช่แค่ตอนเปิดแอป
- `MemoryStore` ย้ายไป `memory-store.ts` (ไฟล์ไม่มี suffix) เพราะ `./store` จาก `store.web.ts` resolve กลับมาที่ตัวเอง
- ล้างคีย์ `mon-farm-v1:*` ใน localStorage ที่ E01-S02 เขียนบน dev build ด้วย ธง `legacyCleanupV1` ย้ายไปอยู่ใน IDB meta
  ผล: เบราว์เซอร์ที่เคยล้างใน E01-S02 จะล้างอีกครั้งหนึ่ง (รวม `mon-farm:locale` — ยอมรับตาม D-20)
- **สองแท็บนับพร้อมกัน — แก้แล้ว (หลัง PR #16 ขึ้น ตามที่ lead ขอ)**: สาเหตุคือตัวนับ `deviceSeq` ในหน่วยความจำมีต่อแท็บ
  สองแท็บจึงเสนอเลขเดียวกันและ store ปฏิเสธอีกตัว (เทสต์สองแท็บ × 3 เข่ง เก็บได้ 3 จาก 6) แก้โดยให้ store กำหนดเลขของเครื่อง
  ตัวเองใน transaction (`checkAppend` ให้เลขว่างถัดไปแทนการปฏิเสธ) — Playwright สองหน้าเก็บครบ 6 ไม่มี error; ใช้กับ
  memory/native ด้วยกฎเดียวกัน ที่ยังเหลือ: แต่ละแท็บเห็นเฉพาะ event ของตัวเองจนกว่าจะ reload (ไม่มีข้อมูลหาย)
  การ renumber บน IndexedDB ครอบด้วย e2e เท่านั้น และบน native ยังไม่มีเทสต์ (รอ `fake-indexeddb` / E01-S06)
- ยังไม่มี e2e ที่นับเข่งจริงในโหมด memory (ต้องผ่าน setup ทั้งหมด) — unit test ครอบการบันทึกใน memory แล้ว

## Code review

review อิสระโดย subagent แยก (2026-10-03) ตาม `docs/checklists/code-review-checklist.md` — ไม่มี blocker:

| # | ระดับ | เรื่อง | ผล |
|---|---|---|---|
| 1 | should-fix | storage ล้มหลังเปิดได้ → append ล้มเงียบ ไม่มีเตือน | แก้: `durability.ts` + `WebStore.append` ส่งสัญญาณ (ยกเว้น `IntegrityError`), `StorageWarning` subscribe, reset connection เมื่อ `onclose`/`onversionchange` + unit test |
| 2 | should-fix | อ่าน getter `indexedDB`/`localStorage` แล้ว throw นอก try; `StorageWarning` ไม่มี catch | แก้: อ่านใน try ทั้งสองที่ + `.catch` → เตือน + unit test ทั้งสองกรณี |
| 3 | should-fix | AC2 ไม่มีเทสต์บน IndexedDB | เลื่อน (รอ `fake-indexeddb`) — ไม่ติ๊กว่าครบ ดู §การตัดสินใจ |
| 4 | should-fix | e2e seed แข่งกับแอปตอนสร้าง DB อาจค้าง | แก้: รอรายการขายแสดงก่อน, เปิดด้วย version 1 และ reject ถ้าต้อง upgrade, ปิด connection |
| 5 | should-fix | เอกสารประเมินข้อจำกัดหลายแท็บต่ำไป | แก้ที่ต้นเหตุ: store กำหนด `deviceSeq` ใน transaction + Playwright สองแท็บ (ดู §การตัดสินใจ) |
| 6 | should-fix | assertion 1 event = 1 record หลวม | แก้: นับ `accept` ใหม่ = 1 และ record ที่ seed ไว้ไม่เปลี่ยน |
| 7 | should-fix | โหมด fallback ไม่ได้ทดสอบ `open()` ที่ error | แก้บางส่วน: เพิ่ม e2e `open()` error → เตือน; การนับเข่งในโหมด memory ครอบด้วย unit test |
| nit | | `markSynced` unhandled rejection; connection รั่วเมื่อ `ensureMeta` ล้ม; ตัวอักษรแถบเตือนเล็ก | แก้ทั้งหมด (แถบเตือนใช้ขนาด body) |
| nit | | `listSales` อ่านทุก event; `onblocked` ตอน bump version | เลื่อน: ขนาดข้อมูลตอนนี้ไม่เป็นปัญหา, จัดการตอนมี v2 |

## QA notes

- แถบเตือน "ไม่ได้บันทึกถาวร" บนหน้าตั้งค่าการขายเมื่อไม่มี IndexedDB: `screenshots/e01-s03/storage-warning.png`
- นับเข่งที่ 400 → reload → 401 ครบ (`e2e/web-store.spec.ts`), log เก่าเปิดมาว่าง (`e2e/legacy-log.spec.ts`;
  screenshot ของ E01-S02 ถูกสร้างใหม่จากรันเดิม ไม่ได้ commit ซ้ำ)
