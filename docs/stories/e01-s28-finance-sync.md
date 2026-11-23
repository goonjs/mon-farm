# Story E01-S28: ย้าย log การเงินเข้า event log ที่ sync

Status: Draft (waiting for the owner's AC agreement and answers to S28-Q1, S28-Q2)
เงื่อนไขไปขั้นถัดไป: เจ้าของตกลง AC และตอบ S28-Q1/Q2 → Ready · ใคร: เจ้าของ · รอ: เจ้าของ

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

### สิ่งที่มีอยู่แล้ว (ดูจากโค้ด `dev` `9334730`)

- event เงินมีรูป envelope ของ architecture อยู่แล้ว: `id, groupId, deviceSeq, ts, actor, source, targetId, baseEventId, payload` (`FinanceEvent`)
- projection เงิน (`projectFinance` ใน `ledger.ts` และ `debts.ts`, `accounts.ts`, `plan.ts`, `fertilizing.ts`) พับ record ด้วย
  `targetId`/`baseEventId` และเปิด Conflict ตาม D-30 แล้ว — หน้าเงินแสดง "สองเครื่องแก้ … ไม่ตรงกัน — เลือกค่าที่ถูก" อยู่แล้ว
  (`fin.form.conflict`, `pay.conflict`, `chk.conflict`, `acct.conflict`) แต่วันนี้เกิดจริงไม่ได้เพราะไม่มีเครื่องที่สอง
- Firestore rules (`validEvent`) รับ envelope ใด ๆ ที่ `kind` เป็น string และ `saleId` เป็น string หรือ null — **event เงินผ่าน rules เดิมได้โดยไม่ต้องแก้ rules**
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
- [ ] **S28-AC8** ข้อมูลเงินเดิมที่ส่งขึ้นกลุ่มเป็นไปตามคำตอบ S28-Q1; event ของผู้ใช้อื่น/กลุ่มอื่น/ไม่มี `groupId` ย้ายเข้า store แต่ไม่ส่ง ไม่นับ ไม่ลบ (กฎ scope เดียวกับ E01-S09)
- [ ] **S28-AC9 (ข้อมูลขัดกัน)** สองเครื่องแก้ record เงินเดียวกันบน base เดียวกันขณะออฟไลน์: ฟิลด์เงิน/จำนวน/สถานะ → Conflict ทั้งสองเครื่องหลัง sync (D-30, ไม่มี last-write-wins);
  ระหว่างยังไม่ตัดสิน ยอดใช้ค่าก่อนแก้ (NFR-3) และหน้าเงินแสดงข้อความขัดกันที่มีอยู่; ตัดสินบนเครื่องหนึ่ง (บันทึกใหม่ที่อ้างทุก head) แล้ว sync → หายทุกเครื่อง
- [ ] **S28-AC10 (rules)** `firestore.rules` ไม่เปลี่ยน; test บน emulator: event เงินของสมาชิกสร้างได้, update/delete ถูกปฏิเสธ, ไม่ใช่สมาชิกอ่าน/เขียนไม่ได้, batch 500 event เงินไม่ชนเพดาน
- [ ] **S28-AC11 (event ข้ามกัน)** event เงินที่อ้างการขาย (`sale_rounding_set`, `sale_account_set`, `payment_mark_set`, `sale_prep_set`, `buyer_check_set`)
  มาถึงก่อนหรือหลัง event ของการขายนั้นก็ได้: projection ไม่ล่ม และยอดถูกเมื่อครบ
- [ ] **S28-AC12 (แอปรุ่นเก่า)** เป็นไปตามคำตอบ S28-Q2 — แอปรุ่นที่ไม่รู้จัก `kind: 'finance'` ต้องไม่นับมันเป็นการขาย ไม่ล่ม และไม่แสดงยอดเงินผิด
- [ ] **S28-AC13** อยู่ใน free tier: ไม่มีบริการใหม่ ไม่มี listener สดเพิ่ม (pull ตาม trigger เดิม); บันทึกปริมาณ read/write ต่อวันโดยประมาณใน Dev notes

## การเปลี่ยน schema / event (ข้อเสนอ ให้ reviewer ตรวจ)

- `kind: 'finance'` ใหม่ใน union ของ `SaleEvent` (หรือ type log รวม) ใช้ `EventBase` เดิม (`saleId` = scope เงิน, `seq`/`mono` แบบ event ใน `MASTER_SCOPE`)
  + `targetId`, `baseEventId`, `alsoBasedOn?`, `payload: FinancePayload`
- `toEnvelope`/`fromEnvelope` (`src/sync/firestore-remote.ts`) ส่ง `targetId`/`baseEventId` ของ event เงินตรง ๆ; round-trip ต้องเท่ากันแบบ canonical JSON (test ทุกชนิด `t`)
- `listSales()` และ projection การขายต้องไม่เห็น scope เงินเป็นการขาย (แบบเดียวกับ `MASTER_SCOPE`)
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

- [ ] Vitest: เขียนเงิน → อยู่ใน `pending()`; `toEnvelope`/`fromEnvelope` round-trip ทุกชนิด `t`; `listSales` ไม่มี scope เงิน
- [ ] Vitest: การย้าย — log เดิม N ตัว → store มี N ตัว, projection เท่ากัน (ใช้ fixture ของ `closeout.fuzz.test.ts`/`ledger.test.ts`); ปิดกลางทางแล้วรันซ้ำ → N ตัว ไม่ซ้ำ ไม่ error;
  event ที่ scope ไม่ตรงย้ายแต่ไม่ส่ง; log เดิมยังอยู่
- [ ] Vitest: sync engine กับ fake remote — สองเครื่องแก้ค่าใช้จ่ายเดียวกันบน base เดียว → Conflict ทั้งคู่ → ตัดสิน → หาย; event เงินอ้างการขายที่ยังไม่มา → ไม่ล่ม
- [ ] jest-expo: ป้าย sync บนหน้าเงินนับเงินค้างส่ง; `useFinance` โหลดใหม่หลัง pull
- [ ] emulator (`npm run test:rules`): rules กับ event เงิน (AC10); 2 client บันทึกเงินคนละรายการ → เห็นครบทั้งคู่
- [ ] Playwright + emulator (`npm run test:e2e:sync`): ออฟไลน์บันทึกค่าใช้จ่าย → online → outbox ว่าง; เครื่องที่สองเห็นรายการ (screenshot ป้ายสถานะ)
- [ ] เจ้าของ: เพิ่มขั้นเงินใน E01-S27 รอบสอง (บันทึกค่าใช้จ่ายบน A เห็นบน B) หลัง PR นี้ deploy dev

## คำถามถึงเจ้าของ

**S28-Q1 — ข้อมูลเงินที่บันทึกไว้แล้วในแต่ละเครื่อง จะส่งขึ้นกลุ่มอย่างไร**

- **ก (แนะนำ)** ส่งข้อมูลเงินเดิมของทุกเครื่องขึ้นกลุ่ม — เงินไม่หาย ถ้าเคยบันทึกรายการเดียวกันซ้ำในสองเครื่อง จะเห็นสองรายการ แล้วลบอันที่ซ้ำเอง
- **ข** ส่งเฉพาะเครื่องที่เจ้าของบอกว่าเป็นเครื่องหลัก เครื่องอื่นเก็บข้อมูลเงินเดิมไว้ในเครื่อง ไม่ส่ง (ไม่ซ้ำ แต่ข้อมูลในเครื่องอื่นจะไม่ไปถึงกลุ่ม)

**S28-Q2 — แอปรุ่นเก่าที่ยังเปิดค้างในบางเครื่อง**

- **ก (แนะนำ)** แอปมีเลขรุ่นต่ำสุด: เครื่องที่ยังเป็นรุ่นเก่าต้องโหลดรุ่นใหม่ก่อน (ขึ้นข้อความไทย "อัปเดตแอปก่อนใช้หน้าเงิน") จึงไม่มีเครื่องไหนเห็นหนี้/ยอดผิด
- **ข** ไม่กัน — เว็บอัปเดตเองเมื่อโหลดหน้าใหม่ แต่ระหว่างนั้นเครื่องรุ่นเก่าอาจเห็นยอดหนี้ผิด (architecture §ฟิลด์ใหม่ที่แอปรุ่นเก่าไม่รู้จัก)

## Verification

- [ ] Sandbox run performed:
- [ ] Screenshots (UI stories only) — golden path:
- [ ] Screenshots (UI stories only) — edge cases:

## Dev notes

- 2026-11-23 (Dev 14, planning): ดูจากโค้ด `dev` `9334730` — `src/store/finance*.ts`, `src/store/finance-write.ts`, `src/finance/use-finance.ts`,
  `src/sync/firestore-remote.ts`, `src/sync/use-sync-status.ts`, `firestore.rules`; ยังไม่ได้ลอง envelope เงินกับ emulator จริง

## Code review

- Reviewer (separate agent/session):
- Findings:
- Resolution:

## QA notes
