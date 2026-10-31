# Story E01-S19: ค่าตั้งของเครื่องจำได้บน Android

Status: Review (2026-10-31; DS-3 ยังไม่ได้ทดสอบบน Android จริง — เจ้าของให้ merge ได้ แล้วทดสอบบนเครื่องจริงตอน E01-S06 จึงเป็น Done) — เจ้าของตกลง AC 2026-10-31 "ตกลง เริ่มทำเลย"; ทำก่อน E05-S11 (CO-23 ขึ้นกับสตอรี่นี้)

## Context

- Epic: `docs/epics/e01-foundation-sync.md`
- Related PRD section(s): ค่าตั้งของเครื่องที่ไม่ซิงก์ — E03-S07 (เวลากดค้าง), E03-S08 (ขนาดตัวอักษร), E04-S16 (โหมดบันทึกเข่งไม่เต็ม), E04-S17 (วิธีนับ กดค้าง/แตะ), ภาษา/ปีพุทธศักราช, เสียงอ่านเลข; E05-S11 CO-23 (ค่าครั้งก่อนของหน้าปิดการขาย — ขึ้นกับสตอรี่นี้)
- Related architecture section(s): `docs/architecture.md` §Local data layer (expo-sqlite บนเครื่อง, IndexedDB/localStorage บนเว็บ) — สตอรี่นี้เพิ่มหัวข้อ "ค่าตั้งของเครื่อง (ไม่ซิงก์)"

## ปัญหาที่พบ

ค่าตั้งของเครื่องทุกตัวอ่าน/เขียนผ่าน `globalThis.localStorage` ซึ่งมีบนเว็บเท่านั้น บน Android (React Native) ไม่มี `localStorage` และใน repo ไม่มี polyfill โค้ดจึงคืนค่าเริ่มต้นทุกครั้ง: เปลี่ยนค่าได้ระหว่างใช้ แต่ปิดแอปแล้วเปิดใหม่จะกลับเป็นค่าเดิม (ทีม UX/architect พบตอนรีวิว E05-S11, 2026-10-31; ลีดตรวจโค้ดแล้วว่าทุกไฟล์ด้านล่างเรียก `globalThis.localStorage?.` และไม่มีที่ไหนตั้งค่า polyfill — **ยังไม่ได้ลองบนเครื่อง Android จริง**)

ไฟล์ที่ใช้ `localStorage` เป็นค่าตั้งของเครื่อง:

| ไฟล์ | key |
|---|---|
| `src/theme/text-size-preference.ts` | `mon-farm:text-size` |
| `src/store/hold-preference.ts` | `mon-farm:hold-ms`, `mon-farm:count-mode` |
| `src/store/weigh-mode-preference.ts` | `mon-farm:weigh-mode`, `mon-farm:weigh-basis` |
| `src/speech/preference.ts` | `mon-farm:speech-on` |
| `src/i18n/preference.ts` | `mon-farm:locale`, `mon-farm:era` |

(`src/store/*.web.ts` ใช้ `localStorage` เป็นที่เก็บข้อมูลของเว็บ ไม่ใช่ค่าตั้งของเครื่อง จึงอยู่นอกขอบเขต)

## Description

ทำที่เก็บค่าตั้งของเครื่องตัวเดียว (`deviceSettings`) ที่ใช้ได้ทั้งเว็บและ Android แล้วให้ไฟล์ค่าตั้งทุกตัวข้างบนอ่าน/เขียนผ่านตัวนี้ บนเว็บยังใช้ `localStorage` และ key เดิม (ค่าที่เครื่องผู้ใช้เก็บไว้แล้วไม่หาย) บน Android ใช้ expo-sqlite ที่มีอยู่แล้ว ไม่เพิ่ม dependency ค่าตั้งยังเป็นของเครื่อง ไม่ซิงก์ ไม่ใช่ event

## Acceptance criteria

- [x] **DS-1** มีโมดูลเดียว `src/store/device-settings` (`.web` / `.native`) ให้ `get(key)` / `set(key, value)` แบบ synchronous ไฟล์ค่าตั้ง 5 ไฟล์ในตารางเรียกผ่านตัวนี้ ไม่มีไฟล์ใน `src/` (นอกจาก `*.web.ts` ของที่เก็บข้อมูลเว็บและตัวโมดูลเอง) เรียก `localStorage` ตรง — มี test/lint ตรวจ
- [x] **DS-2** บนเว็บ: ใช้ `localStorage` key เดิมทุกตัว ค่าที่เคยเก็บไว้อ่านได้เหมือนเดิมหลังอัปเดต (test: ตั้งค่าใน localStorage ก่อนโหลดโมดูล แล้วอ่านได้ค่านั้น)
- [ ] **DS-3** บน Android: เปลี่ยนค่า (ขนาดตัวอักษร, เวลากดค้าง, วิธีนับ, โหมดเข่งไม่เต็ม, เสียงอ่าน, ภาษา/ปี) แล้วปิดแอปจริง (force stop) เปิดใหม่ ค่ายังอยู่ — ทดสอบบนเครื่องหรือ emulator จริง พร้อมภาพหน้าจอ
- [ ] **DS-4** อ่านค่าตอนเปิดแอปไม่ทำให้จอกะพริบเป็นค่าเริ่มต้นก่อน (ขนาดตัวอักษร/ภาษาถูกตั้งแต่ frame แรก)
- [x] **DS-5** ที่เก็บพังหรืออ่านไม่ได้ = ใช้ค่าเริ่มต้น แอปไม่ล้ม (เหมือนพฤติกรรมเดิมที่ `try/catch`); ค่าที่ไม่รู้จักถูกเมิน (กติกาเดิมของแต่ละไฟล์)
- [x] **DS-6** ไม่เพิ่ม dependency ใหม่ (ใช้ expo-sqlite 57 ที่มีอยู่) — ถ้าพบว่าต้องเพิ่ม ให้หยุดแล้วขออนุญาตตามกฎ AGENTS.md
- [x] **DS-7** `docs/architecture.md` มีหัวข้อ "ค่าตั้งของเครื่อง (ไม่ซิงก์)": อะไรเป็นค่าของเครื่อง (ไม่ใช่ event, ไม่ซิงก์, ไม่ตามผู้ใช้ไปเครื่องอื่น), เก็บที่ไหนในแต่ละแพลตฟอร์ม, วิธีเพิ่ม key ใหม่ — E05-S11 CO-23 (ค่าครั้งก่อนของทางรับเงินคืนหนี้และปัดเศษ) ใช้โมดูลนี้

## Offline / sync behavior

ค่าตั้งของเครื่องอยู่ในเครื่องเท่านั้น ใช้ได้เต็มที่แบบออฟไลน์ ไม่ซิงก์ ไม่มี conflict ไม่เข้า outbox ไม่เปลี่ยนรูปแบบ event หรือ schema ของ event log (ถ้าใช้ตารางใน SQLite ต้องแยกจากตาราง event และไม่ถูกอ่านโดย sync engine)

## Test plan

_Tests below are written to fail first (TDD), then implemented to green._

- [x] Unit (เว็บ): get/set, ค่าเดิมจาก localStorage, ที่เก็บ throw → ค่าเริ่มต้น
- [x] Unit (native, mock expo-sqlite): get/set, อ่านค่าหลังสร้างโมดูลใหม่ (จำลองเปิดแอปใหม่), ที่เก็บ throw → ค่าเริ่มต้น
- [x] Guard test: ไม่มี `localStorage` ตรงในไฟล์ค่าตั้ง (DS-1)
- [x] Test เดิมของ 5 ไฟล์ค่าตั้งยังผ่าน
- [x] Offline path: ทั้งหมดเป็นในเครื่อง — ไม่มีทาง online/reconnect

## Verification

- [x] Sandbox run performed: เว็บ build จริง เปลี่ยนค่า → reload → ค่ายังอยู่
- [ ] Android: force stop → เปิดใหม่ (DS-3) — ต้องมี dev client (E01-S06) ถ้าทำไม่ได้ในเซสชันนี้ ต้องบอกเจ้าของตรงๆ และสตอรี่ไม่ถึง Done
- [ ] Screenshots: ไม่มี UI ใหม่ — ภาพก่อน/หลังเปิดแอปใหม่บน Android เป็นหลักฐาน DS-3

## Dev notes

- ตรวจก่อนสร้าง: expo-sqlite 57 มี `expo-sqlite/kv-store` (API แบบ sync `getItemSync`/`setItemSync`) หรือไม่ ถ้ามีใช้ตัวนั้น ถ้าไม่มี ใช้ฐาน SQLite เดิมกับตารางเล็ก `device_settings(key TEXT PRIMARY KEY, value TEXT)` และอ่านทั้งตารางครั้งเดียวตอนเปิดแอป
- ห้ามเปลี่ยน key บนเว็บ

## Code review

- Reviewer (separate agent/session): agent รีวิวอิสระ (general-purpose) ในเซสชันทีม dev 2026-10-31 อ่าน diff เทียบ AC และ checklist ไม่ได้รับข้อสรุปของผู้ทำ; ร่าง DS-7 รีวิวโดย agent solution-architect
- Findings: ไม่มี blocker · (1) `readTextSize`/`writeTextSize` ไม่มีผู้เรียกเลย (E03-S08 ยัง Draft) จึงตรวจขนาดตัวอักษรตาม DS-3/DS-4 ไม่ได้ · (2) 4 จอ (`device-screen`, `sale-settings-screen`, `counter-screen`, `hold.tsx`) อ่านค่าใน render ตรง ๆ บนเว็บ — มีมาก่อนสตอรี่นี้ · (3) mock ใน Jest บังคับ `readDuringRender: true` ทำให้ไม่มี test ทางเว็บ (อ่านหลัง mount) · (4) fake kv-store หลวมกว่าของจริง · (5) การตัดคอมเมนต์ของ guard อาจซ่อนโค้ดได้ · (6) อ่าน SQLite ทุกครั้งที่กด (เล็กมาก) · (7) `mon-farm:locale` อยู่ในรายการล้างข้อมูลเก่าบนเว็บ (สถาปนิกพบด้วย)
- Resolution: (3) เพิ่ม `src/__tests__/device-settings-web-after-mount.test.tsx` (ตรวจแล้วว่าแดงถ้าเอา effect ออก) · (4) fake ล้มตั้งแต่เปิดไฟล์ + test · (5) ตัดเฉพาะบรรทัดคอมเมนต์ทั้งบรรทัด (ตรวจแล้วว่ายังจับ localStorage ตรงได้) · (1)(2)(7) บันทึกใน `docs/architecture.md` และ QA notes เป็นข้อเปิด ส่งลีด/เจ้าของ · (6) ไม่แก้ (YAGNI)

## QA notes

- ตรวจแล้ว: vitest 1121+ ผ่าน, jest ผ่าน, `tsc`, `eslint` สะอาด; e2e phone-portrait ทั้งชุดบน build เว็บจริง ผ่าน 25 ข้าม 5 (ชุด emulator) ไม่มีล้ม
- Sandbox เว็บ (`e2e/v2-device-settings.spec.ts`): เปลี่ยนวิธีนับ/โหมดเข่งไม่เต็ม/เสียง/ปี/ภาษา → reload → ค่ายังอยู่ใต้ key เดิม; ค่าเวลากดค้างที่ใส่ไว้ก่อนโหลดแอป (จำลองค่าก่อนอัปเดต) อ่านได้ — ภาพ `docs/ux/screenshots/e01-s19/web-after-reload.png`
- expo-sqlite 57 มี `expo-sqlite/kv-store` (`SQLiteStorage.getItemSync`/`setItemSync`) ตรวจใน node_modules หลัง `npm ci` — ไม่เพิ่ม dependency (DS-6)
- **ยังไม่ได้ตรวจ — DS-3**: เซสชันนี้ไม่มีเครื่อง Android/emulator และไม่มี dev client ทดสอบ native ได้แค่ใน Vitest กับ kv-store ปลอม (จำลองปิดเปิดแอปด้วย `vi.resetModules`) ไม่ใช่ force stop จริง ต้องมีคนทดสอบบนเครื่องจริงพร้อมภาพก่อน Done
- **DS-4 บางส่วน**: ภาษา/ปี/เสียง อ่านใน render แรกบน native (test `device-settings-first-frame`) แต่ขนาดตัวอักษรยังไม่ต่อเข้า UI (E03-S08 Draft) จึงตรวจไม่ได้
- **คำตัดสินเจ้าของ 2026-10-31** (ผ่านลีด):
  1. `mon-farm:locale` เอาออกจาก `LEGACY_EXACT` (`src/store/store.web.ts`) ไม่ล้างภาษา — test ก่อนใน `store.web.test.ts` (เห็นแดงก่อนแก้) แล้วแก้; `docs/architecture.md` §ข้อมูลเก่า ปรับตาม
  2. DS-3: merge ได้ทั้งที่ยังไม่ทดสอบ Android จริง สตอรี่ค้างที่ Review — ทดสอบบนเครื่องจริงตอนทำ E01-S06 แล้วจึงเป็น Done
  3. ขนาดตัวอักษรยังไม่มีจอใช้ และ 4 จอที่อ่านใน render บนเว็บ: รับทราบ บันทึกไว้พอ ไม่แก้ใน PR นี้
