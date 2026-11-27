# Story E01-S28: ย้าย log การเงินเข้า event log ที่ sync

Status: Review — รอบสอง (owner agreed AC 2026-11-25 08:47 เวลาไทย, แดชบอร์ด e01-s27-s28-ac: "ก · ก · ตกลง AC ทั้งสองสตอรี่ เริ่มทำ S27 (คุณทดสอบ) และ S28 รอบแรกได้ (แนะนำ)") · รอบแรกอยู่บน `dev` (PR #248)
เงื่อนไขไปขั้นถัดไป: รอบสองรีวิวอิสระผ่าน + CI เขียว + เจ้าของพูด merge เองใน PR (**critical**: เปลี่ยน schema ของ event log / sync) · ใคร: ผู้รีวิวอิสระ แล้วเจ้าของ · รอ: ผู้รีวิว

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

- [x] **S28-AC1** บันทึกเงินใหม่ทุกชนิดเขียนลง `EventStore` (ไม่ใช่ `financeStore` เดิม) เป็น event `kind: 'finance'` ภายใต้ scope ของเงิน
  (`saleId` = ค่าคงที่ของ scope เงิน แบบ `MASTER_SCOPE`) โดย `targetId`, `baseEventId`, `payload` เหมือนเดิมทุกตัว; ใช้ได้ทันทีตอนออฟไลน์ (SYNC-1)
- [x] **S28-AC2** event เงินที่เป็นของผู้ใช้และกลุ่มที่ login อยู่เข้า outbox และส่งขึ้น `groups/{gid}/events` เองเมื่อมีเน็ต ไม่มีปุ่ม Sync (SYNC-2, D-3);
  ส่งซ้ำ/ack หาย ไม่เกิดซ้ำ (create-only + id เดิม)
- [x] **S28-AC3** event เงินจากเครื่องอื่นในกลุ่มถูกดึงลงมา หน้าเงินที่เปิดอยู่แสดงข้อมูลใหม่หลังดึงเสร็จโดยไม่ต้องออกจากหน้า (`useFinance` ฟัง `onSyncChanged`/pull)
- [x] **S28-AC4** ป้าย sync นับ event เงินที่ยังไม่ส่งด้วย (`รอส่ง N` รวมเงิน); ป้ายบนหน้าเงินไม่ขึ้น `ซิงก์แล้ว` ขณะมีเงินค้างส่ง
- [x] **S28-AC5 (ย้ายข้อมูลเดิม, เครื่องเท่านั้น)** เปิดแอปรุ่นใหม่ครั้งแรก: ทุก event ใน log เงินเดิม (localStorage บนเว็บ, ตาราง SQLite บนเครื่อง) ถูกคัดลอกเข้า
  `EventStore` ครั้งเดียว — `id`, `groupId`, `actor`, `ts`, `source`, `targetId`, `baseEventId`, `payload` ไม่เปลี่ยน; `deviceSeq` ให้ store จัดใหม่ตามกฎ append
  (event ยังไม่เคยส่ง จึงเปลี่ยนได้); ยอดทุกหน้าเงินก่อนและหลังย้ายเท่ากันทุกบาท (projection เท่ากัน)
- [x] **S28-AC6** การย้ายทนการปิดกลางทาง: id ที่มีใน `EventStore` แล้วข้ามไป (ไม่เทียบเนื้อหา เพราะ `deviceSeq` ถูกจัดใหม่) ทำซ้ำกี่ครั้งก็ได้ผลเดียวกัน
  และมีเครื่องหมาย "ย้ายเสร็จ" ใน meta ของ store ระหว่างย้ายแอปยังใช้ได้ หรือรอสั้น ๆ พร้อมข้อความไทย ไม่ขึ้นหน้าว่าง
- [x] **S28-AC7** log เงินเดิม **ไม่ถูกลบ** ใน story นี้ (เก็บเป็นสำรองอ่านอย่างเดียว); หลังย้ายแล้วไม่มีโค้ดใดเขียนลงที่เดิมอีก; การลบที่เดิมเป็น story ภายหลังที่เจ้าของอนุมัติ
- [ ] **S28-AC8 (S28-Q1 = ก)** ข้อมูลเงินเดิมของ **ทุกเครื่อง** ที่เป็นของผู้ใช้และกลุ่มที่ login อยู่ ส่งขึ้นกลุ่มหลังย้าย (AC5) — ไม่มีการเลือกเครื่องหลัก
  และไม่ตัดรายการซ้ำเอง: ถ้าเคยบันทึกรายการเดียวกันในสองเครื่อง กลุ่มเห็นสองรายการ แล้วผู้ใช้ลบอันซ้ำเองด้วยการลบที่มีอยู่; event ของผู้ใช้อื่น/กลุ่มอื่น/ไม่มี `groupId` ย้ายเข้า store แต่ไม่ส่ง ไม่นับ ไม่ลบ (กฎ scope เดียวกับ E01-S09)
- [x] **S28-AC9 (ข้อมูลขัดกัน)** สองเครื่องแก้ record เงินเดียวกันบน base เดียวกันขณะออฟไลน์: ฟิลด์เงิน/จำนวน/สถานะ → Conflict ทั้งสองเครื่องหลัง sync (D-30, ไม่มี last-write-wins);
  ระหว่างยังไม่ตัดสิน ยอดใช้ค่าก่อนแก้ (NFR-3) และหน้าเงินแสดงข้อความขัดกันที่มีอยู่; ตัดสินบนเครื่องหนึ่ง (บันทึกใหม่ที่อ้างทุก head) แล้ว sync → หายทุกเครื่อง
- [x] **S28-AC10 (rules)** `firestore.rules` ไม่เปลี่ยน; test บน emulator: event เงินของสมาชิกสร้างได้, update/delete ถูกปฏิเสธ, ไม่ใช่สมาชิกอ่าน/เขียนไม่ได้, batch 500 event เงินไม่ชนเพดาน
- [x] **S28-AC11 (event ข้ามกัน)** event เงินที่อ้างการขาย (`sale_rounding_set`, `sale_account_set`, `payment_mark_set`, `sale_prep_set`, `buyer_check_set`)
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
- [x] **S28-AC13** อยู่ใน free tier: ไม่มีบริการใหม่ ไม่มี listener สดเพิ่ม (pull ตาม trigger เดิม); บันทึกปริมาณ read/write ต่อวันโดยประมาณใน Dev notes

**หลักฐานรอบสอง (branch `feature/e01-s28-r2-finance-sync`):**

- แดงก่อน (รีวิว UI N6 แก้ถ้อยคำ): ที่ `537960c` ชุด jest ทั้งสองล้มเพราะ **หา module `finance-log` ไม่พบ** (ไม่มี test ไหนได้รัน) — ไม่ใช่ล้มเพราะพฤติกรรม ·
  เหตุผลที่ถูกของด่านรอบสองดูที่ `69ddea2` (logic อยู่แล้ว ยังไม่มีด่าน): `v2-money-gate.test.tsx` ล้ม **12** ข้อ ทุกข้อ `Unable to find an element with testID: money-update-app` / `home-money-update` ·
  ชุดแก้หลังรีวิว (`14c2b95`) ล้มด้วยพฤติกรรมจริงทุกข้อ (ไม่มี module หาย) เช่น B1: เครื่อง B `state: error`, ค่าใช้จ่าย 0 รายการ ขณะ A มี 1

- AC1: `src/store/finance-log.test.ts` "writes go to the EventStore" (kind `finance`, `FINANCE_SCOPE`, `targetId`/`baseEventId`/`payload` เท่าเดิม, อยู่ใน `pending()`, ไม่ใช่การขาย); e2e `E01-S28 r2: a money write goes to the outbox…` ออฟไลน์ 390×844
- AC2: `src/sync/finance-sync.test.ts` "money is sent on its own…" (ออฟไลน์ → online → outbox ว่าง; ack หาย → server มีชุดเดียว) ผ่าน fake server ที่ส่งทุกเอกสารผ่าน envelope จริง; emulator `firestore/sync.test.ts` "E01-S28 r2: money recorded on each phone…"
- AC3: `useFinance` อ่านใหม่เมื่อ `onSyncChanged`; jest `v2-finance-sync.test.tsx` "an open money screen shows what a pull brought"
- AC4: jest `v2-finance-sync.test.tsx` ป้ายบนหน้าเงินขึ้น "รอส่ง 1" (ค่าใช้จ่าย 1 รายการ; เลขขั้นต่ำส่งไปด้วยแต่ไม่นับ และถ้าเหลือแค่มันยังขึ้น "รอส่ง 1" ไม่ใช่ "ซิงก์แล้ว" — รีวิว N8/UI N1, `core/scope.test.ts`); screenshot `after-r2-expenses-pending.png`
- AC5/AC6/AC7: `finance-log.test.ts` "the one-time copy…" (N → N, projection เท่ากันแบบ canonical JSON, ตัดกลางทางแล้วรันซ้ำ → ข้าม id ที่มี, เครื่องหมาย `financeLogMigratedV1` ใน meta, log เดิมไม่ถูกเขียน/ลบ); `store.test.ts` meta flag ทั้ง Memory และ IndexedDB (อยู่รอดการเปิดใหม่); e2e `E01-S28 r2: the old finance log is copied once…` (เว็บจริง: 3 รายการเดิม ยอด 6,000 เท่าเดิม, reload ไม่ซ้ำ, localStorage เดิมยังอยู่) · `after-r2-migrated.png`
- AC8 (**ยังไม่ติ๊ก — รอเจ้าของตัดสินถ้อยคำ**, รีวิว N1): `finance-log.test.ts` "scope of copied events" — ของผู้ใช้อื่น/กลุ่มอื่นย้ายเข้า store ไม่ส่ง ไม่นับในป้าย และ (รีวิว N6) หน้าเงินรวมเฉพาะเงินของกลุ่มที่เปิดอยู่; rules emulator ปฏิเสธ event เงินของผู้ใช้อื่น ·
  ข้อที่ต่างจาก AC: event ที่ไม่มี `groupId` **ไม่ย้าย** (กฎ D-24 ของ store ปฏิเสธ) ทิ้งไว้ใน log เดิม ไม่ส่ง ไม่นับ ไม่ลบ — และหลังย้ายแล้วไม่แสดงบนหน้าจอ · ทีมแนะนำให้แก้ถ้อยคำ AC เพราะหลัง #92 (2026-10-11) log เดิมไม่รับ event แบบนี้แล้ว จึงไม่น่ามีจริง
- AC9: `finance-sync.test.ts` "two phones edit the same expense…" — Conflict ทั้งสองเครื่อง ยอดใช้ค่าก่อนแก้ ตัดสินบนเครื่อง A (อ้างทุก head) → หายทั้งสองเครื่อง; และสถานะการจ่าย (`payment_mark_set` ติ๊กออกบนเครื่องหนึ่ง / รับขาดบนอีกเครื่อง) Conflict แล้วหายหลังตัดสิน (รีวิว N9)
- AC10: `firestore.rules` ไม่แก้; `firestore/rules.test.ts` "finance events (E01-S28 round 2, rules unchanged)" — สร้างได้ (รวม `app_min`), update/delete ไม่ได้, คนนอกอ่าน/เขียนไม่ได้, batch 500 ผ่าน
- AC11: `finance-sync.test.ts` "finance events that name a sale…" — ครบ 5 ชนิดที่ AC ระบุ (`sale_rounding_set`, `sale_account_set`, `payment_mark_set`, `sale_prep_set`, `buyer_check_set`) + `debt_payment_recorded`: เงินมาก่อนการขาย / การขายมาก่อนเงิน, การขายถูกลบทีหลัง → ยอดหนี้ตามถูก, scope เงินไม่เป็นการขาย
- AC12 (ก) ส่วนรอบสอง: jest `v2-money-gate.test.tsx` (route เพิ่ม 11 หน้า + แถวเงินหน้าแรก ไม่มียอดเงินในการ์ดควรรู้), `v2-farm-people.test.tsx` (บรรทัดหนี้ในหน้าคน), `v2-sale-start-prep.test.tsx` E (เริ่มการขายไม่ใช้ข้อมูลเตรียมขาย); e2e `E01-S28 r2: above the group minimum home hides its money rows…` · `after-r2-home-gate.png`, `after-r2-money-gate.png`
- AC12 (ข) เงื่อนไขก่อนส่ง: (1) รอบแรกอยู่บน `dev` (PR #248) (2) เจ้าของโหลดหน้าใหม่แล้ว — ดู Dev notes 2026-11-27
- AC13: ไม่มีบริการใหม่ ไม่มี listener สดเพิ่ม (อ่านใหม่ตาม `onSyncChanged` ของ engine เดิม) · ประมาณ read/write ใน Dev notes

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
- [x] รอบสอง (ข้อด้านล่างทั้งหมด) — Vitest: เขียนเงิน → อยู่ใน `pending()`; `toEnvelope`/`fromEnvelope` round-trip ทุกชนิด `t`; `listSales` ไม่มี scope เงิน
- [x] Vitest: การย้าย — log เดิม N ตัว → store มี N ตัว, projection เท่ากัน (ใช้ fixture ของ `closeout.fuzz.test.ts`/`ledger.test.ts`); ปิดกลางทางแล้วรันซ้ำ → N ตัว ไม่ซ้ำ ไม่ error;
  event ที่ scope ไม่ตรงย้ายแต่ไม่ส่ง; log เดิมยังอยู่
- [x] Vitest: sync engine กับ fake remote — สองเครื่องแก้ค่าใช้จ่ายเดียวกันบน base เดียว → Conflict ทั้งคู่ → ตัดสิน → หาย; event เงินอ้างการขายที่ยังไม่มา → ไม่ล่ม
- [x] jest-expo: ป้าย sync บนหน้าเงินนับเงินค้างส่ง; `useFinance` โหลดใหม่หลัง pull
- [x] emulator (`npm run test:rules`): rules กับ event เงิน (AC10); 2 client บันทึกเงินคนละรายการ → เห็นครบทั้งคู่
- [ ] Playwright + emulator (`npm run test:e2e:sync`): ออฟไลน์บันทึกค่าใช้จ่าย → online → outbox ว่าง; เครื่องที่สองเห็นรายการ (screenshot ป้ายสถานะ)
  — **ยังไม่ได้เขียน spec เบราว์เซอร์นี้** ในรอบสอง: ครอบด้วย emulator ระดับ engine (`firestore/sync.test.ts`, SDK จริง + rules จริง) และ e2e ออฟไลน์บนเว็บจริง; `npm run test:e2e:sync` ชุดเดิม 3/3 ผ่านบน branch
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

- [x] Sandbox run performed (รอบแรก): build เว็บจริง (`expo export`) + Playwright 390×844 ออฟไลน์, `e2e/v2-money.spec.ts` ทั้งไฟล์ 11/11 ผ่าน;
  สอง test ใหม่ (`E01-S28 r1: …`) แดงบน build ของ `dev` `daeb3d1` (หน้าแรกขึ้นแถว "การขายที่ยังไม่ปิด" ของ scope เงิน, "เริ่มการขาย" พาเข้า scope เงิน) แล้วเขียวบน branch
- [x] Sandbox run (รอบสอง): build เว็บจริง + Playwright phone-portrait ทั้งชุด 159 ผ่าน / 5 ข้าม (รันด้วย `CI=1`); `npm run test:rules` 86/86 และ `npm run test:e2e:sync` 3/3 บน emulator
- [x] Screenshots รอบสอง (390×844): `after-r2-expenses-pending.png` (รอส่ง 1), `after-r2-migrated.png` (ย้ายแล้วยอดเท่าเดิม), `after-r2-home-gate.png` (แถวเงินหน้าแรกกลายเป็นข้อความอัปเดต),
  `after-r2-home-no-sale-row.png`, `after-r2-money-gate.png` · ภาพรอบแรกไม่แก้
- [x] Screenshots — ไม่มี mockup ใน story นี้ (ข้อความเดียวตาม AC12 (ก)) · `docs/ux/screenshots/e01-s28/`:
  ก่อน (dev): `before-home.png` (แถวการขายว่างที่ยังไม่ปิด), `before-start-redirect.png` (เริ่มการขาย → เลือกจุดชั่งของ scope เงิน), `before-money.png`;
  หลัง: `after-home.png` (ไม่มีแถว), `after-money-gate.png` ("อัปเดตแอปก่อนใช้หน้าเงิน" เมื่อขั้นต่ำสูงกว่ารุ่นของแอป)

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
- 2026-11-25 (Dev 20, รอบแรก): `src/core/finance-scope.ts` — `FINANCE_SCOPE = 'farm-finance'`, `APP_RELEASE = 1` (เลขรุ่นจำนวนเต็มในโค้ด),
  `isSaleScope`, `minAppOf`/`appBelowMin` (อ่าน `kind: 'app_min'` แบบป้องกันตัว ค่า `minApp` ต้องเป็นจำนวนเต็ม ≥ 1; ไม่มี = ไม่กั้น) ·
  `listSales` ทั้งสาม adapter (memory, IndexedDB, SQLite `NOT IN (?, ?)`) และ `homeSales` ข้าม scope สงวน · ด่าน `moneyGated` ครอบ 11 route ของหน้าเงิน
  (`expenses`, `expense/[id]`, `debts`, `debt/[workerId]`, `debt-add`, `debt-pay`, `owed`, `repay`, `order`, `order/[orderId]`, `fertilizer-settings`):
  ยังไม่ mount หน้าจนอ่านขั้นต่ำเสร็จ (เฟรมแรกว่างสั้น ๆ ระหว่างอ่าน IndexedDB), อ่านไม่ได้ = ไม่กั้น ·
  **ไม่แก้ union `SaleEvent`, ไม่แก้ `toEnvelope`/`fromEnvelope`, ไม่แก้ rules, ไม่มี event เงินเข้า `EventStore`, `writeFinance` ยังเขียน `financeStore` เดิม** (test ตรึง outbox ว่าง) ·
  ข้อสังเกต: บน `dev` หน้า "การขายทั้งหมด" **ไม่**ขึ้นแถวของ scope เงิน (ตรวจบน build จริง — `saleListRows` ไม่ทำแถวให้ log ที่ไม่มี `sale_started`) ข้อ 5 ของ AC12 (ข) จึงไม่เกิดจริง แต่ test ตรึงไว้ ·
  เปิดไว้ให้ผู้รีวิว: ด่านครอบเฉพาะหน้าในหมวดเงิน — แถวเงินบนหน้าแรก (ค้างใคร/คืนเงิน), หน้าเงินของการขาย (ปัดเศษ/จ่ายเงิน) และหน้าดูแลสวน ยังอ่าน `useFinance` ตรง ๆ;
  รอบแรกไม่มี `app_min` จึงไม่มีผล แต่ถ้า "ไม่แสดงยอดเงิน" ต้องรวมหน้าเหล่านั้น ต้องตกลงก่อนรอบสอง · บรรทัดเลขรุ่นในหน้า "เครื่องนี้" (AC12 ข) **ยังไม่ทำ** — เสนอใน PR ให้เจ้าของเลือก
- 2026-11-27 ~23:40 เวลาไทย — **AC12 (ข) ขั้นโหลดหน้าใหม่ของเจ้าของ:** เจ้าของบอกในแชทว่าโหลดหน้าใหม่ทุกแท็บทุกเครื่องที่เปิดเว็บ dev ไว้แล้ว
  คำของเจ้าของ: "Done / doing it now" (ส่งต่อโดย lead; บันทึกตามที่ได้รับ ทีมไม่ได้เห็นข้อความต้นฉบับเอง)
- 2026-11-28 (Dev, รอบสอง — PR critical):
  - **Schema:** `kind: 'finance'` (`FinanceLogEvent`) และ `kind: 'app_min'` (`AppMinEvent`) เข้า union `SaleEvent` (`src/core/types.ts`) บน `EventBase` เดิม
    (`saleId` = `FINANCE_SCOPE`, `seq`/`mono` แบบ master) · `alsoBasedOn` ของเงินอยู่ใน `payload` ไม่ยกขึ้น envelope · `fromEnvelope` คืน `targetId` และ `baseEventId` (รวม `null`)
    ของ event เงินตรง ๆ — เดิมทิ้ง `targetId` ที่เท่ากับ id และ `baseEventId: null` ซึ่งจะทำให้สำเนาที่ดึงกลับมาไม่ตรงกับที่ส่ง (IntegrityError) · test round-trip ทุก `t` (32 ชนิด)
  - **ตัวห่อ:** `src/store/finance-log.ts` `EventFinanceStore` (แบบ `MasterStore`) · `finance.web.ts`/`finance.native.ts` ผูกกับ `store` + log เดิมแบบอ่านอย่างเดียว ·
    `writeFinance` ใช้ `deviceClock.take()` ไม่นับเอง; store เป็นผู้จัด `deviceSeq` ของเครื่องนี้
  - **ไม่ขึ้น version DB:** เครื่องหมาย "ย้ายเสร็จ" เป็น key `flag:financeLogMigratedV1` ใน `meta` เดิม (IndexedDB / SQLite) — เพิ่ม `metaFlag`/`setMetaFlag` ใน port `EventStore`
  - **`app_min`:** เขียน `minApp = APP_RELEASE` ครั้งเดียวต่อกลุ่ม ก่อน event เงินตัวแรก (append ก่อน → `deviceSeq` ต่ำกว่า → outbox ส่งก่อน); ข้ามถ้ากลุ่มมีค่าเท่าหรือสูงกว่าแล้ว (รวมที่ดึงมา);
    ตอนเริ่ม sync เขียนให้ถ้ามีเงินของผู้ใช้/กลุ่มนี้ที่ย้ายมาตอนยังไม่ login · **`APP_RELEASE` = 2** (สั่งโดย lead): ต่างจากข้อความเดิมในคำอธิบาย ("ตั้งเลขขั้นต่ำเป็นรุ่นของรอบแรก")
    เพราะแท็บรุ่นรอบแรก (1) อ่านเงินจาก log เดิมในเครื่องเท่านั้น จะเห็นยอดที่ไม่รวมเงินที่ sync มา จึงให้ขึ้น "อัปเดตแอปก่อนใช้หน้าเงิน" แทน — ให้ผู้รีวิวตรวจ ·
    ผลข้างเคียง: ป้าย "รอส่ง" นับ event `app_min` ด้วย 1 ครั้ง (เช่นค่าใช้จ่ายรายการแรก → "รอส่ง 2")
  - **ด่านทุกหน้าที่แสดงยอดเงิน (การอ่านของทีมต่อ AC12 "ไม่แสดงยอดเงิน" — ให้ผู้รีวิวตรวจ):** นอกจาก 11 route ของรอบแรก ครอบทั้ง route: `sale/[id]/settlement`, `payment`, `cash`,
    `buyer-view`, `check`, `show-account`, `care`, `fertilizing`, `stock`, `prepare`, `prepare/buyer`; แทนที่ในหน้า: แถวเงินหน้าแรก (ค้างใคร, ที่ต้องจ่าย, รอคืน, คนรับซื้อค้าง)
    เป็นบรรทัด "อัปเดตแอปก่อนใช้หน้าเงิน" เดียว, บรรทัดหนี้ในหน้าคน, หน้าเริ่มการขายไม่ใช้ข้อมูลเตรียมขาย (มีราคา) · ด่านอ่านใหม่หลัง pull ·
    ไม่ครอบ: จำนวนบัญชีรับเงินในหน้าฟาร์ม (เป็นจำนวน ไม่ใช่ยอดเงิน), `backfill` (ใช้เงินแค่ตัดสินว่าบันทึกย้อนหลังได้ไหม ไม่แสดงยอด), หน้านับเข่ง/ประวัติ (ยอดของการขายจาก log การขาย ไม่ใช่ log เงิน)
  - **การย้าย:** ทำครั้งแรกที่ใช้ port (หน้าแรกก็ใช้ `useFinance`) ในเครื่อง ไม่ต้องใช้เน็ต; ระหว่างย้ายหน้าเงินแสดงสถานะกำลังโหลดเดิม (สั้น, IndexedDB ทีละ event) ·
    สำเนาได้ `seq` 1 และ `mono` 0 คงที่ เพื่อให้สองแท็บย้ายพร้อมกันได้ event เหมือนกัน (ตัวหลังเป็น no-op) · ถ้าการย้ายล้ม หน้าเงินแสดง event ใน store รวมกับ log เดิม (เงินไม่ดูหาย) แล้วลองใหม่ครั้งหน้า
  - **AC8 ข้อต่าง:** event เดิมที่ **ไม่มี `groupId`** ย้ายเข้า store ไม่ได้ (กฎ D-24 ของ append ปฏิเสธ — แก้กฎนั้นไม่อยู่ในขอบเขต) จึง**ไม่ย้าย** ทิ้งไว้ใน log เดิม ไม่ส่ง ไม่นับ ไม่ลบ
    (นับเป็น `refused` ในผลการย้าย) · log เดิมของเว็บก็ปฏิเสธ event แบบนี้อยู่แล้ว จึงน่าจะไม่มีจริง
  - **ข้อจำกัด:** บนเบราว์เซอร์ที่เปิด IndexedDB ไม่ได้ (store ตกไปใช้หน่วยความจำ) เงินใหม่ไม่รอดการโหลดหน้าใหม่ (เดิมเงินอยู่ localStorage จึงรอด) — แอปเตือน "ไม่ถาวร" อยู่แล้ว ·
    event ของเครื่องนี้แต่ `deviceId` อื่น (เช่นล้าง IndexedDB แต่ localStorage ยังอยู่) คง `deviceSeq` เดิม จึงอาจเรียงก่อน `app_min` ใน outbox — ถ้า outbox ไม่เกิน 500 ก็ไปใน batch เดียวกัน (atomic)
  - **AC13 ประมาณ read/write ต่อวัน (Firestore free tier: 50,000 reads, 20,000 writes ต่อวัน):** 1 event เงิน = 1 write; ฟาร์มนี้ประมาณ 10–40 บันทึกเงินต่อวัน (วันปิดยอดการขายอาจ ~60)
    → ≤ 100 writes/วัน; read = เอกสารใหม่ × จำนวนเครื่องที่ดึง (2–4) + ส่วนอ่านซ้ำย้อน 2 นาทีต่อการดึง → ≤ ~1,000 reads/วัน · ครั้งเดียวตอนย้าย: N event เดิมต่อเครื่อง (คาด < 2,000)
    = N writes ครั้งเดียว + N × เครื่องอื่น reads · ไม่มี listener สด ไม่มี Cloud Function ไม่มีบริการใหม่ — ห่างจากเพดานมาก
  - **Emulator:** `firebase-tools` ใน devDependencies ดาวน์โหลด `cloud-firestore-emulator-v1.22.0.jar` ลง `~/.cache/firebase` เองตอนรันครั้งแรก (ไม่ได้ติดตั้ง package ใหม่)
  - 2026-11-28 (หลังรีวิว): port `EventStore` เปลี่ยนจาก `metaFlag` เป็น `metaValue`/`setMetaValue` (key `value:<key>` ใน `meta`, ไม่ขึ้น version DB) เพื่อเก็บจำนวน event เดิมที่ย้ายแล้ว ·
    การย้ายตรวจทุกครั้งที่ใช้ port (อ่าน log เดิม + เครื่องหมาย; ย้ายซ้ำเมื่อ log เดิมยาวขึ้น) · `SyncDeps.store` ต้องมี `load` (อ่าน scope เงินตอนจัดลำดับส่ง) ·
    ในโหมดหน่วยความจำ (ไม่มี IndexedDB) ทุกครั้งที่โหลดหน้าใหม่ยังเขียน `app_min` ใหม่ 1 ตัว (ไม่เสียหาย เสีย 1 write) ·
    ตัวนับยอดในหน้านับเข่ง ("ยอดของ… รวม (฿)") ไม่ถูกด่านโดยตั้งใจ: มาจาก log การขาย ซึ่งรุ่นเก่านับเหมือนกัน (รีวิว UI N4)
  - e2e: log เงินเดิมถูกอ่านครั้งเดียว จึงย้ายการ seed เงินใน e2e จาก localStorage ไปเขียน IndexedDB (`seedFinance` ใน `e2e/fixtures.ts`, `pending: 0`)

## Code review

- Reviewer (separate agent/session): รีวิวอิสระสองชุดบน head `857c195` —
  ข้อมูล/sync/การย้าย https://github.com/goonjs/mon-farm/pull/253#pullrequestreview-6091567824 (1 B, 12 N) ·
  UI/ด่าน/e2e (rev253b) https://github.com/goonjs/mon-farm/pull/253#pullrequestreview-6091564206 (0 B, 7 N) · ทั้งคู่: PR นี้ critical
- Findings และการแก้ (test แดงก่อนใน `14c2b95`, แก้ใน `e78c0c9` และ `109a32e`):
  - **B1** แท็บรุ่นรอบแรกเก็บเงินที่ดึงมาโดยไม่มี `baseEventId`/`targetId` → หลังโหลดเป็นรอบสอง ยอดหาย + IntegrityError ถาวร → แก้: `toFinanceEvent` อ่าน base ที่ไม่มีเป็น `null` และ target ที่ไม่มีเป็น id ของตัวเอง; `sameEvent` (`append-rule.ts`) เทียบเงินแบบเดียวกันตอนดึง/ตอนเทียบกับ server
  - **N1** AC8 กับ event ไม่มี `groupId` → ไม่แก้โค้ด; untick AC8 รอเจ้าของตัดสินถ้อยคำ (ทีมแนะนำแก้ AC)
  - **N2** log เดิมที่โตหลังย้าย → เครื่องหมายเก็บจำนวน event เดิม (`{"count":N}` ใน meta) ย้ายซ้ำเมื่อ log เดิมยาวกว่า (ข้าม id ที่มี)
  - **N3** `app_min` มาก่อนเงินทุกทาง → `push()` ส่ง `app_min` ก่อน และกันเงินของกลุ่มที่ยังไม่มีขั้นต่ำไว้ แล้วลองใหม่; `beforePush` เขียนขั้นต่ำทุกรอบ ไม่ทิ้งความล้มเหลว
  - **N4** ย้ายซ้ำเข้า store ใหม่ชน server → `sameEvent` ไม่นับ `deviceSeq` สำหรับเงิน: สำเนาที่ server มีแล้วนับว่าส่งแล้ว ไม่เป็น integrity ถาวร
  - **N5** เว็บไม่มี IndexedDB เงินใหม่หายเมื่อโหลดหน้า → ไม่แก้โค้ด; ให้เจ้าของเลือก (ดู PR "Owner decisions needed")
  - **N6** หน้าเงินรวมทุกกลุ่ม → port และด่านกรองเฉพาะกลุ่มที่เปิดอยู่
  - **N7** แถวเดิมเสียทำให้บันทึกเงินไม่ได้ → ข้ามแถวที่รูปไม่ถูก นับเป็น `refused` และ log
  - **N8 / UI N1** "รอส่ง 2" → ป้ายไม่นับ `app_min` แต่ไม่ขึ้น "ซิงก์แล้ว" ขณะยังรอส่ง
  - **N9 / N10** test เพิ่ม: AC11 ครบ 5 ชนิด, AC9 สถานะการจ่าย, SQLite (`finance.native.test.ts`: meta value + log เดิมอ่านอย่างเดียว)
  - **N11** อ่าน scope เงินครั้งเดียวต่อการบันทึก; เปิดฐาน SQLite เดิมครั้งเดียว
  - **N12** ขั้นโหลดหน้าใหม่เป็นคำที่ lead ส่งต่อ → ไม่แก้โค้ด; ให้เจ้าของยืนยันเองและโหลดใหม่อีกครั้งหลังรอบสอง deploy
  - **UI N2** test บรรทัดหนี้หน้าคน และหน้าเริ่มการขาย · **UI N3** e2e การ์ดควรรู้ต้องมีแค่ข้อความอัปเดต · **UI N4** แถวเงินหน้าแรกสร้างผ่าน `money(...)` + jest ไม่มียอดเงินในการ์ด ·
    **UI N5** ปุ่มโหลดหน้าใหม่ → งานถัดไป ให้เจ้าของเลือก · **UI N6** แก้หลักฐานแดงก่อน (ข้างบน) · **UI N7** ตัดคำ "and no money" ที่ไม่ได้พิสูจน์ออก
- Resolution: แก้ครบทุกข้อที่ต้องแก้; ข้อ N1, N5, N12, UI N5 รอเจ้าของ (ไม่แก้โค้ด)

## QA notes

รอบสอง (2026-11-28) — offline/sync checklist:
- [x] ใช้ได้ไม่มีเน็ต: บันทึกเงินลง `EventStore` ทันที (e2e ออฟไลน์ 390×844)
- [x] ส่งเองเมื่อมีเน็ต ไม่มีปุ่ม Sync; ส่งซ้ำ/ack หายไม่เกิดซ้ำ (fake server + emulator)
- [x] ดึงจากเครื่องอื่นแล้วหน้าเงินที่เปิดอยู่แสดงทันที
- [x] ป้ายสถานะนับเงินค้างส่ง
- [x] Conflict ผ่าน `foldRecord` เดิม ทั้งสองเครื่อง และหายหลังตัดสิน
- [x] ย้ายข้อมูลเดิมครั้งเดียว ยอดเท่าเดิม log เดิมยังอยู่
- [x] ข้อความด่านพอดีจอ 390×844 ไม่มีอะไรถูกตัด (`textFit` ใน e2e), หน้าแรกไม่มีแถวยอดเงินเมื่อรุ่นต่ำกว่าขั้นต่ำ
- [ ] เจ้าของ: ขั้นเงินของ E01-S27 รอบสอง (บันทึกบน A เห็นบน B) หลัง deploy dev

รอบแรก (Dev 20, 2026-11-25) — offline/sync checklist:
- [x] ใช้ได้ไม่มีเน็ต: e2e ทั้งสองตัวรันแบบ `setOffline(true)` ที่ 390×844
- [x] บันทึกตอนออฟไลน์: ค่าใช้จ่ายลง log เงินในเครื่อง (localStorage) — ไม่มีแถวใน `events` เลย (outbox ว่าง)
- [–] sync ตอนเน็ตกลับ / ปุ่มลองใหม่ / Conflict: ไม่อยู่ในรอบแรก (ยังไม่ส่งเงิน)
- [x] ข้อมูลที่ดึงมาใน scope เงินไม่ถูกแก้/ลบ แค่ไม่นับเป็นการขาย; ไม่มีข้อมูลหาย
- [x] ป้ายสถานะ: ไม่เปลี่ยน (ยังนับเฉพาะ `store.pending()` — AC4 เป็นของรอบสอง)
- ข้อความด่านพอดีจอ 390×844 ไม่มีอะไรถูกตัด (`textFit` ใน e2e)
