# Story E01-S28: ย้าย log การเงินเข้า event log ที่ sync

Status: Ready (owner agreed AC 2026-11-25 08:47 เวลาไทย, แดชบอร์ด e01-s27-s28-ac: "ก · ก · ตกลง AC ทั้งสองสตอรี่ เริ่มทำ S27 (คุณทดสอบ) และ S28 รอบแรกได้ (แนะนำ)")
เงื่อนไขไปขั้นถัดไป: ทีมเขียนเทสต์ก่อนแล้วทำรอบแรก · ใคร: ทีม dev · รอ: ลีดเปิดทีม

## Context

- Epic: `docs/epics/e01-foundation-sync.md` (ข้อมูลเงินมาจาก E11 / E05 / E06 / E16)
- PRD: SYNC-1, SYNC-2, SYNC-4, SYNC-9, NFR-2, NFR-3 · D-3, D-24, D-28, D-30, D-84
- Architecture: §Local data layer (EventStore, outbox), §Sync engine, §ฟิลด์ใหม่ที่แอปรุ่นเก่าไม่รู้จัก ("เมื่อเปิด sync finance ต้องมีกติกาเวอร์ชันขั้นต่ำของแอปก่อน")
- ขึ้นกับ: E01-S09 (engine + adapter บน `dev`), E01-S27 (ผลทดสอบของเจ้าของบนฐานจริง — ควรผ่านก่อนเปิด sync เงิน)
- ที่มา: owner decision via lead chat (2026-11-21/22): "Finance sync: yes. Finance moves into the synced log." และ Blaze "ข · ยังไม่ เน้น data"
  (อยู่ใน free tier ไม่เพิ่มบริการที่เสียเงิน)
- **PR โค้ดของ story นี้เป็น critical** (เปลี่ยน schema ของ event log / sync ตามกฎ merge ใน `AGENTS.md`) — เจ้าของต้องพูด merge เองใน PR นั้น

## คำอธิบาย

วันนี้ข้อมูลเงินทั้งหมด (ค่าใช้จ่าย, ใบสั่งปุ๋ย, หนี้/ผ่อน, เงินเดือน, รายรับ/เช่า, การจ่ายเงินตอนปิดยอด, บัญชีรับเงิน, การปัดเศษ ฯลฯ — 32 ชนิด
`payload.t` ใน `src/core/finance/types.ts`) อยู่ใน log แยก `financeStore` (`src/store/finance.ts`): เว็บเก็บใน localStorage
`mon-farm:finance-events`, เครื่องเก็บใน expo-sqlite ไม่เข้า outbox ไม่ขึ้น Firestore เครื่องอื่นในกลุ่มไม่เห็นเลย

story นี้ย้ายข้อมูลเงินเข้า `EventStore` ตัวเดียวกับคน/การขาย (แบบเดียวกับที่ E03-S01 ย้ายข้อมูลคนเข้า `MASTER_SCOPE`) ทำให้เข้า outbox
และ sync ด้วย engine เดิม และย้ายข้อมูลเงินเดิมในเครื่องเข้า log ใหม่ครั้งเดียว **ในเครื่องเท่านั้น**

### แบ่งงานเป็น 2 รอบ (S28-Q2 = ก)

- **รอบแรก — ยังไม่ส่งเงิน:** `listSales`/`homeSales` และ projection การขายไม่นับ scope เงินเป็นการขาย (ส่วน schema) + ด่านเลขรุ่นต่ำสุด
  (S28-AC12 (ก)) · ยังไม่มี event เงินเข้า `EventStore` ยังไม่ย้ายข้อมูลเดิม ไม่มีอะไรเกี่ยวกับเงินขึ้น Firestore · AC ของรอบนี้: AC12 (ก), AC13 · deploy dev
- **ระหว่างรอบ:** เจ้าของโหลดหน้าใหม่ทุกแท็บทุกเครื่องที่เปิดเว็บไว้ (ตอนเน็ตดี) — ขั้นแรกของ E01-S27 รอบสอง (S28-AC12 (ข))
- **รอบสอง — เริ่มส่งเงิน:** ตั้งเลขขั้นต่ำเป็นรุ่นของรอบแรก แล้วทำ AC1–AC11 และ AC13 (เขียนเงินลง `EventStore`, ย้ายข้อมูลเดิม, ส่ง/ดึง, ป้าย, Conflict, rules)
  · เริ่มได้เมื่อรอบแรกอยู่บน dev และขั้นโหลดหน้าใหม่ของเจ้าของผ่านแล้ว

### สิ่งที่มีอยู่แล้ว (ดูจากโค้ด `dev` `9334730`)

- event เงินมีรูป envelope ของ architecture อยู่แล้ว: `id, groupId, deviceSeq, ts, actor, source, targetId, baseEventId, payload` (`FinanceEvent`)
- projection เงิน (`projectFinance` ใน `ledger.ts` และ `debts.ts`, `accounts.ts`, `plan.ts`, `fertilizing.ts`) พับ record ด้วย
  `targetId`/`baseEventId` และเปิด Conflict ตาม D-30 แล้ว — หน้าเงินแสดง "สองเครื่องแก้ … ไม่ตรงกัน — เลือกค่าที่ถูก" อยู่แล้ว
  (`fin.form.conflict`, `pay.conflict`, `chk.conflict`, `acct.conflict`) แต่วันนี้เกิดจริงไม่ได้เพราะไม่มีเครื่องที่สอง
- Firestore rules (`validEvent`) รับ envelope ที่ `kind` เป็น string ไม่ว่าง, `saleId` เป็น string หรือ null, `targetId` เป็น string, `baseEventId` เป็น null หรือ string,
  `actor.userId` = ผู้ login และ `deviceSeq` เป็นจำนวนเต็ม ≥ 1 — event เงินมีครบ **จึงผ่าน rules เดิมได้โดยไม่ต้องแก้ rules**
  (และเพราะ `actor.userId` ต้องเป็นผู้ login event เงินของผู้ใช้อื่นที่ย้ายมา จึงส่งไม่ได้และต้องไม่ส่ง, AC8)
  (ต้องพิสูจน์ด้วย test บน emulator, AC10)
- ป้าย sync บนหน้าเงิน (`useSyncStatus`) นับเฉพาะ `store.pending()` จึงขึ้น `ซิงก์แล้ว` ทั้งที่เงินยังไม่ได้ส่ง (ทำให้เข้าใจผิดวันนี้)
- `useFinance` โหลดใหม่เมื่อกลับมาที่หน้าเท่านั้น ไม่ฟังเหตุการณ์ "ดึงข้อมูลเสร็จ"

## Acceptance criteria

- [ ] **S28-AC1** บันทึกเงินใหม่ทุกชนิดเขียนลง `EventStore` (ไม่ใช่ `financeStore` เดิม) เป็น event `kind: 'finance'` ภายใต้ scope ของเงิน
  (`saleId` = ค่าคงที่ของ scope เงิน แบบ `MASTER_SCOPE`) โดย `targetId`, `baseEventId`, `payload` เหมือนเดิมทุกตัว; ใช้ได้ทันทีตอนออฟไลน์ (SYNC-1)
- [ ] **S28-AC2** event เงินที่เป็นของผู้ใช้และกลุ่มที่ login อยู่เข้า outbox และส่งขึ้น `groups/{gid}/events` เองเมื่อมีเน็ต ไม่มีปุ่ม Sync (SYNC-2, D-3);
  ส่งซ้ำ/ack หาย ไม่เกิดซ้ำ (create-only + id เดิม)
- [ ] **S28-AC3** event เงินจากเครื่องอื่นในกลุ่มถูกดึงลงมา หน้าเงินที่เปิดอยู่แสดงข้อมูลใหม่หลังดึงเสร็จโดยไม่ต้องออกจากหน้า (`useFinance` ฟัง `onSyncChanged`/pull)
- [ ] **S28-AC4** ป้าย sync นับ event เงินที่ยังไม่ส่งด้วย (`รอส่ง N` รวมเงิน); ป้ายบนหน้าเงินไม่ขึ้น `ซิงก์แล้ว` ขณะมีเงินค้างส่ง
- [ ] **S28-AC5 (ย้ายข้อมูลเดิม, เครื่องเท่านั้น)** เปิดแอปรุ่นใหม่ครั้งแรก: ทุก event ใน log เงินเดิม (localStorage บนเว็บ, ตาราง SQLite บนเครื่อง) ถูกคัดลอกเข้า
  `EventStore` ครั้งเดียว — `id`, `groupId`, `actor`, `ts`, `source`, `targetId`, `baseEventId`, `payload` ไม่เปลี่ยน; `deviceSeq` ให้ store จัดใหม่ตามกฎ append
  (event ยังไม่เคยส่ง จึงเปลี่ยนได้); ยอดทุกหน้าเงินก่อนและหลังย้ายเท่ากันทุกบาท (projection เท่ากัน)
- [ ] **S28-AC6** การย้ายทนการปิดกลางทาง: id ที่มีใน `EventStore` แล้วข้ามไป (ไม่เทียบเนื้อหา เพราะ `deviceSeq` ถูกจัดใหม่) ทำซ้ำกี่ครั้งก็ได้ผลเดียวกัน
  และมีเครื่องหมาย "ย้ายเสร็จ" ใน meta ของ store ระหว่างย้ายแอปยังใช้ได้ หรือรอสั้น ๆ พร้อมข้อความไทย ไม่ขึ้นหน้าว่าง
- [ ] **S28-AC7** log เงินเดิม **ไม่ถูกลบ** ใน story นี้ (เก็บเป็นสำรองอ่านอย่างเดียว); หลังย้ายแล้วไม่มีโค้ดใดเขียนลงที่เดิมอีก; การลบที่เดิมเป็น story ภายหลังที่เจ้าของอนุมัติ
- [ ] **S28-AC8 (S28-Q1 = ก)** ข้อมูลเงินเดิมของ **ทุกเครื่อง** ที่เป็นของผู้ใช้และกลุ่มที่ login อยู่ ส่งขึ้นกลุ่มหลังย้าย (AC5) — ไม่มีการเลือกเครื่องหลัก
  และไม่ตัดรายการซ้ำเอง: ถ้าเคยบันทึกรายการเดียวกันในสองเครื่อง กลุ่มเห็นสองรายการ แล้วผู้ใช้ลบอันซ้ำเองด้วยการลบที่มีอยู่; event ของผู้ใช้อื่น/กลุ่มอื่น/ไม่มี `groupId` ย้ายเข้า store แต่ไม่ส่ง ไม่นับ ไม่ลบ (กฎ scope เดียวกับ E01-S09)
- [ ] **S28-AC9 (ข้อมูลขัดกัน)** สองเครื่องแก้ record เงินเดียวกันบน base เดียวกันขณะออฟไลน์: ฟิลด์เงิน/จำนวน/สถานะ → Conflict ทั้งสองเครื่องหลัง sync (D-30, ไม่มี last-write-wins);
  ระหว่างยังไม่ตัดสิน ยอดใช้ค่าก่อนแก้ (NFR-3) และหน้าเงินแสดงข้อความขัดกันที่มีอยู่; ตัดสินบนเครื่องหนึ่ง (บันทึกใหม่ที่อ้างทุก head) แล้ว sync → หายทุกเครื่อง
- [ ] **S28-AC10 (rules)** `firestore.rules` ไม่เปลี่ยน; test บน emulator: event เงินของสมาชิกสร้างได้, update/delete ถูกปฏิเสธ, ไม่ใช่สมาชิกอ่าน/เขียนไม่ได้, batch 500 event เงินไม่ชนเพดาน
- [ ] **S28-AC11 (event ข้ามกัน)** event เงินที่อ้างการขาย (`sale_rounding_set`, `sale_account_set`, `payment_mark_set`, `sale_prep_set`, `buyer_check_set`)
  มาถึงก่อนหรือหลัง event ของการขายนั้นก็ได้: projection ไม่ล่ม และยอดถูกเมื่อครบ
- [ ] **S28-AC12 (แอปรุ่นเก่า)** มีสองส่วน:
  - **(ก) รุ่นที่มีด่านเลขรุ่นต่ำสุด (รอบแรก, S28-Q2 = ก):** เครื่องที่มีด่านแต่รุ่นต่ำกว่าเลขขั้นต่ำของกลุ่ม ไม่นับ scope เงินเป็นการขาย ไม่ล่ม
    ไม่แสดงยอดเงิน และขึ้นข้อความไทย "อัปเดตแอปก่อนใช้หน้าเงิน" (test: store มี event เงิน + เลขขั้นต่ำสูงกว่ารุ่นของแอป → `listSales` ไม่มี scope เงิน
    และหน้าเงินแสดงข้อความอัปเดต)
  - **(ข) รุ่นที่ deploy อยู่วันนี้ไม่มีด่าน และกันย้อนหลังไม่ได้** (ไม่มีโค้ดเลขรุ่นใน `src`; `fromEnvelope` รับทุก `kind`
    `src/sync/firestore-remote.ts:126-156`; `insertPulled` เก็บทุกเอกสารที่ดึงมา `src/sync/engine.ts:478-482`; `listSales` ข้ามแค่ `MASTER_SCOPE`
    `src/store/store.web.ts:231`) ผลจริงบนแท็บเว็บที่เปิดรุ่นนี้ค้างไว้แล้วดึง event เงินลงมา (ตรวจในโค้ด `dev` `9334730`):
    1. scope เงินที่มีแต่ event `kind: 'finance'` กลายเป็นการขายที่ **ยังไม่ปิด**: `emptySale` เริ่มที่ `status: 'open'`, `saleStatus: 'draft'`
       (`src/core/project.ts:30-35`) ไม่มี event เงินตัวไหนปิดมัน และ `statusCountsAsClosed` เป็น false (`src/core/sale-status.ts:24-27`)
    2. ถ้าตอนนั้นไม่มีการขายจริงที่ค้างอยู่ใหม่กว่า `homeSales` เลือกมันเป็นการขายที่ค้าง (`src/core/home.ts:38-69`) → หน้าแรกขึ้นแถว
       "การขายที่ยังไม่ปิด" ว่าง ๆ พร้อมลิงก์เข้าไป (`src/v2/home-screen.tsx:148-166`)
    3. กด "เริ่มการขาย" (`StartSaleGate`) จะพาเข้ารายการนั้นแทนการเปิดการขายใหม่ (`src/v2/sale/start-screen.tsx:63-75`)
    4. ถ้าชั่งเข่งต่อในแท็บนั้น เข่งได้ `saleId` = scope เงิน ส่งขึ้นกลุ่ม แล้วทุกรุ่นที่ซ่อน scope เงิน (AC1, ส่วน schema) จะซ่อนเข่งนั้นด้วยทุกเครื่อง —
       ข้อมูลยังอยู่ในฐาน แต่ไม่มีหน้าไหนแสดง ต้องมี story กู้แยก
    5. หน้า "การขายทั้งหมด" ขึ้นแถวการขายว่างอีก 1 แถว เพราะแสดงทุก id จาก `listSales()` (`src/v2/sale/sales-screen.tsx:33-36`) ส่วน
       `use-rubber-income.ts:17`, `use-live-sales.ts:17`, `master-store.ts:170,293` ได้ยอดศูนย์หรือข้าม — ไม่เสียหาย
    **ก่อนส่ง event เงินตัวแรกขึ้นกลุ่ม (รอบสอง) ต้องครบทั้งสองข้อ:** (1) เว็บ dev deploy รอบแรกแล้ว (`listSales`/`homeSales` ไม่นับ scope เงิน
    + ด่านเลขรุ่น) และ (2) เจ้าของโหลดหน้าใหม่ทุกแท็บทุกเครื่องที่เปิดเว็บไว้ (ทีมเขียนเป็นขั้นแรกของ E01-S27 รอบสอง)
    · ตรวจได้: PR รอบสอง (ที่เริ่มส่งเงิน) แนบผลขั้น "โหลดหน้าใหม่ทุกเครื่อง" ของเจ้าของ และ test `listSales`/`homeSales`
    ไม่มี scope เงิน · Android ยังไม่ sync (E01-S06) จึงไม่โดน
    ข้อจำกัดของการโหลดหน้าใหม่: ต้องโหลดตอนเน็ตดี (Wi-Fi) — ถ้าเน็ตช้าเกิน 30 วินาที `public/sw.js` เปิดสำเนาเก่าที่เก็บไว้แทน (:6-7);
    และยังไม่มีหน้าไหนบอกเลขรุ่น เจ้าของจึงยืนยันรุ่นจากหน้าจอไม่ได้ — รอบแรกควรมีสิ่งที่ดูได้ เช่นบรรทัดเลขรุ่นในหน้า "เครื่องนี้" (ทีมเสนอใน PR รอบแรก)
- [ ] **S28-AC13** อยู่ใน free tier: ไม่มีบริการใหม่ ไม่มี listener สดเพิ่ม (pull ตาม trigger เดิม); บันทึกปริมาณ read/write ต่อวันโดยประมาณใน Dev notes

## การเปลี่ยน schema / event (ข้อเสนอ ให้ reviewer ตรวจ)

- `kind: 'finance'` ใหม่ใน union ของ `SaleEvent` (หรือ type log รวม) ใช้ `EventBase` เดิม (`saleId` = scope เงิน, `seq`/`mono` แบบ event ใน `MASTER_SCOPE`)
  + `targetId`, `baseEventId`, `payload: FinancePayload` — `alsoBasedOn` ของเงินอยู่ **ใน `payload`** อยู่แล้ว (`types.ts`) จึงไม่ยกขึ้น envelope
  (ตรงกับ AC1 ที่ว่า payload ไม่เปลี่ยน); `alsoBasedOn` ระดับ envelope ไม่ใช้กับ event เงิน; round-trip test ตรึงข้อนี้
- `toEnvelope`/`fromEnvelope` (`src/sync/firestore-remote.ts`) ส่ง `targetId`/`baseEventId` ของ event เงินตรง ๆ; round-trip ต้องเท่ากันแบบ canonical JSON (test ทุกชนิด `t`)
- `listSales()` และ projection การขายต้องไม่เห็น scope เงินเป็นการขาย (แบบเดียวกับ `MASTER_SCOPE`)
- ~~ทางเลือกเขียน event เงินภายใต้ `saleId = MASTER_SCOPE`~~ (ข้อเสนอของผู้รีวิว 17) **ไม่ใช้: เจ้าของตอบ S28-Q2 ก (scope เงินแยก + 2 รอบ) และตกลง AC 25 พ.ย.** — ใช้ scope เงินแยกตามข้างบนเท่านั้น
- **เลขขั้นต่ำของกลุ่มอยู่ที่ไหน (ผู้รีวิว 20 N1):** เป็น event ใน log ของกลุ่มเอง ไม่ใช่เอกสารใหม่ — `kind: 'app_min'`, `saleId` = scope เงิน, `payload: { minApp: <เลขรุ่น> }`
  (ไม่เพิ่มฟิลด์ envelope เพราะ `validEvent` ใช้ `keys().hasOnly(...)` · `firestore.rules:20-22` → AC10 ยังเป็นจริง, payload ของ event เงินไม่เปลี่ยนตาม AC1) ·
  เลขรุ่นของแอปเป็นค่าคงที่ในโค้ด · ด่านใช้ค่า `minApp` สูงสุดที่มีใน store; ไม่มี event นี้ = ไม่กั้น (รอบแรกจึงไม่ต้องอ่านอะไรเพิ่ม) ·
  รอบสองเขียน event นี้ครั้งเดียว ก่อน event เงินตัวแรก · projection เงินข้าม `kind: 'app_min'`
- `FinanceStore` port คงอยู่เป็นตัวห่อบาง ๆ บน `EventStore` (แบบ `MasterStore`) เพื่อให้หน้าเงินไม่ต้องเปลี่ยน; `writeFinance` ไม่นับ `deviceSeq` เองอีก (store จัดให้)
- IndexedDB / SQLite: ใช้ตาราง `events` เดิม — ถ้าต้องขึ้น version DB ให้เขียนใน Dev notes ก่อนทำ

## Offline / sync behavior

- ออฟไลน์เป็นโหมดหลัก: บันทึกเงินลง `EventStore` ทันที ไม่รอเน็ต; ส่งเมื่อมี trigger เดิม (เปิดแอป, เน็ตกลับ, หลังเขียน)
- การย้ายข้อมูลเดิมทำในเครื่อง ไม่ต้องใช้เน็ต; ส่งขึ้นตามปกติเมื่อมีเน็ต
- Conflict: ใช้การพับ record ที่มีอยู่ (`foldRecord`, D-30) — ไม่มีการเลือกค่าเองแบบเงียบ
- ไม่มีการเปลี่ยนข้อมูลบน environment อื่นนอกจาก local / dev / sandbox; ฐาน `(default)` ได้แค่ event ใหม่ที่แอปส่งตามปกติ
- Android: client native ยังคืน `null` (E01-S06) — การย้ายบน SQLite ทำในโค้ดเดียวกัน แต่ sync บนเครื่องจริงรอ Android (ลำดับสุดท้าย)

## Test plan

_เขียน test ก่อน (TDD) แล้วทำให้เขียว_

- [ ] รอบแรก — Vitest: `listSales`/`homeSales` ไม่มี scope เงิน; ด่านเลขรุ่น (AC12 (ก)); jest-expo: หน้าเงินแสดง "อัปเดตแอปก่อนใช้หน้าเงิน" เมื่อรุ่นต่ำกว่าขั้นต่ำ
- [ ] รอบสอง (ข้อด้านล่างทั้งหมด) — Vitest: เขียนเงิน → อยู่ใน `pending()`; `toEnvelope`/`fromEnvelope` round-trip ทุกชนิด `t`; `listSales` ไม่มี scope เงิน
- [ ] Vitest: การย้าย — log เดิม N ตัว → store มี N ตัว, projection เท่ากัน (ใช้ fixture ของ `closeout.fuzz.test.ts`/`ledger.test.ts`); ปิดกลางทางแล้วรันซ้ำ → N ตัว ไม่ซ้ำ ไม่ error;
  event ที่ scope ไม่ตรงย้ายแต่ไม่ส่ง; log เดิมยังอยู่
- [ ] Vitest: sync engine กับ fake remote — สองเครื่องแก้ค่าใช้จ่ายเดียวกันบน base เดียว → Conflict ทั้งคู่ → ตัดสิน → หาย; event เงินอ้างการขายที่ยังไม่มา → ไม่ล่ม
- [ ] jest-expo: ป้าย sync บนหน้าเงินนับเงินค้างส่ง; `useFinance` โหลดใหม่หลัง pull
- [ ] emulator (`npm run test:rules`): rules กับ event เงิน (AC10); 2 client บันทึกเงินคนละรายการ → เห็นครบทั้งคู่
- [ ] Playwright + emulator (`npm run test:e2e:sync`): ออฟไลน์บันทึกค่าใช้จ่าย → online → outbox ว่าง; เครื่องที่สองเห็นรายการ (screenshot ป้ายสถานะ)
- [ ] เจ้าของ: E01-S27 รอบสอง — ขั้นแรก "โหลดหน้าใหม่ทุกแท็บทุกเครื่อง" หลังรอบแรก deploy dev และก่อนรอบสอง (AC12 (ข)) แล้วขั้นเงิน
  (บันทึกค่าใช้จ่ายบน A เห็นบน B) หลังรอบสอง deploy dev

## คำถามถึงเจ้าของ

**S28-Q1 — ข้อมูลเงินที่บันทึกไว้แล้วในแต่ละเครื่อง จะส่งขึ้นกลุ่มอย่างไร** · ตอบแล้ว: **ก** (AC8)

owner answer, dashboard 24 พ.ย. 2569 17:44 เวลาไทย (`answers/e01-s28-q1`, saved_at 2026-11-24T10:44:30Z):
"ก · ส่งข้อมูลเงินเดิมของทุกเครื่อง เงินไม่หาย ถ้าเคยบันทึกซ้ำสองเครื่องจะเห็นสองรายการ ลบอันซ้ำเอง (แนะนำ)"

ตัวเลือก ข (ส่งเฉพาะเครื่องหลัก) ไม่ได้เลือก — ไม่มีขั้นเลือกเครื่องหลัก

**S28-Q2 — แอปรุ่นเก่าที่ยังเปิดค้างในบางเครื่อง** · ตอบแล้ว: **ก** (แบ่ง 2 รอบ, AC12)

owner answer, dashboard 24 พ.ย. 2569 17:44 เวลาไทย (`answers/e01-s28-q2`, saved_at 2026-11-24T10:44:31Z):
"ก · แยก 2 รอบ: รอบแรกออกรุ่นที่ไม่นับเงินเป็นการขาย + ด่านเลขรุ่น deploy dev ยังไม่ส่งเงิน → เจ้าของโหลดหน้าใหม่ทุกแท็บทุกเครื่อง → รอบสองค่อยส่งเงิน ช้ากว่า 1 รอบ แต่ปิดช่องแท็บค้างได้ก่อนเงินเริ่มส่ง และครั้งหน้าที่เปลี่ยนวิธีนับเงิน เครื่องรุ่นเก่าจะขึ้นข้อความให้อัปเดตแทนการเห็นยอดผิด (แนะนำ)"

ตัวเลือก ข (ไม่ทำด่าน ออกรอบเดียว) ไม่ได้เลือก — ขั้นของรอบเดียวเอาออกจาก AC12 แล้ว

## Verification

- [ ] Sandbox run performed:
- [ ] Screenshots (UI stories only) — golden path:
- [ ] Screenshots (UI stories only) — edge cases:

## Dev notes

- 2026-11-23 (Dev 14, planning): ดูจากโค้ด `dev` `9334730` — `src/store/finance*.ts`, `src/store/finance-write.ts`, `src/finance/use-finance.ts`,
  `src/sync/firestore-remote.ts`, `src/sync/use-sync-status.ts`, `firestore.rules`; ยังไม่ได้ลอง envelope เงินกับ emulator จริง
- 2026-11-23 (Dev 16, รีวิว 6021044170 B3): เขียน AC12 (ข) และ S28-Q2 ใหม่ตามผลจริงในโค้ด `dev` `9334730` — `src/core/project.ts` (`emptySale`),
  `src/core/home.ts` (`saleLineOf`/`homeSales`), `src/core/sale-status.ts`, `src/v2/home-screen.tsx`, `src/v2/sale/start-screen.tsx`, `src/v2/sale/open-sale.ts`;
  เพิ่มทางเลือก `MASTER_SCOPE` ในส่วน schema (ดู `src/core/master.ts:155`, `src/store/master-store.ts:373-379`)
- 2026-11-24 (Dev 18): ใส่คำตอบ S28-Q1 ก / S28-Q2 ก จากแดชบอร์ด · การแบ่ง AC ลงรอบแรก/รอบสองเป็นการอ่านของทีมจากคำตอบ Q2
  ("รอบแรก … ยังไม่ส่งเงิน") จึงเลื่อนการเขียนเงินลง `EventStore` และการย้ายข้อมูลเดิมไปรอบสองด้วย ให้ผู้รีวิวตรวจ
- 2026-11-25 (Dev 19): เจ้าของตกลง AC (แดชบอร์ด `answers/e01-s27-s28-ac`, 25 พ.ย. 08:47) → Ready · ทางเลือก `MASTER_SCOPE` ไม่ใช้ (เจ้าของตอบ S28-Q2 ก)
  · ผู้รีวิว 20 N1: ระบุที่เก็บเลขขั้นต่ำเป็น event `kind: 'app_min'` ใน scope เงิน (การอ่านของทีม ให้ผู้รีวิวตรวจ) ไม่แก้ rules ไม่แก้ payload เงิน

## Code review

- Reviewer (separate agent/session):
- Findings:
- Resolution:

## QA notes
