# Story E01-S19: ค่าตั้งของเครื่องจำได้บน Android

Status: Ready (เจ้าของตกลง AC 2026-10-31 "ตกลง เริ่มทำเลย") — ทำก่อน E05-S11 (CO-23 ขึ้นกับสตอรี่นี้)

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

- [ ] **DS-1** มีโมดูลเดียว `src/store/device-settings` (`.web` / `.native`) ให้ `get(key)` / `set(key, value)` แบบ synchronous ไฟล์ค่าตั้ง 5 ไฟล์ในตารางเรียกผ่านตัวนี้ ไม่มีไฟล์ใน `src/` (นอกจาก `*.web.ts` ของที่เก็บข้อมูลเว็บและตัวโมดูลเอง) เรียก `localStorage` ตรง — มี test/lint ตรวจ
- [ ] **DS-2** บนเว็บ: ใช้ `localStorage` key เดิมทุกตัว ค่าที่เคยเก็บไว้อ่านได้เหมือนเดิมหลังอัปเดต (test: ตั้งค่าใน localStorage ก่อนโหลดโมดูล แล้วอ่านได้ค่านั้น)
- [ ] **DS-3** บน Android: เปลี่ยนค่า (ขนาดตัวอักษร, เวลากดค้าง, วิธีนับ, โหมดเข่งไม่เต็ม, เสียงอ่าน, ภาษา/ปี) แล้วปิดแอปจริง (force stop) เปิดใหม่ ค่ายังอยู่ — ทดสอบบนเครื่องหรือ emulator จริง พร้อมภาพหน้าจอ
- [ ] **DS-4** อ่านค่าตอนเปิดแอปไม่ทำให้จอกะพริบเป็นค่าเริ่มต้นก่อน (ขนาดตัวอักษร/ภาษาถูกตั้งแต่ frame แรก)
- [ ] **DS-5** ที่เก็บพังหรืออ่านไม่ได้ = ใช้ค่าเริ่มต้น แอปไม่ล้ม (เหมือนพฤติกรรมเดิมที่ `try/catch`); ค่าที่ไม่รู้จักถูกเมิน (กติกาเดิมของแต่ละไฟล์)
- [ ] **DS-6** ไม่เพิ่ม dependency ใหม่ (ใช้ expo-sqlite 57 ที่มีอยู่) — ถ้าพบว่าต้องเพิ่ม ให้หยุดแล้วขออนุญาตตามกฎ AGENTS.md
- [ ] **DS-7** `docs/architecture.md` มีหัวข้อ "ค่าตั้งของเครื่อง (ไม่ซิงก์)": อะไรเป็นค่าของเครื่อง (ไม่ใช่ event, ไม่ซิงก์, ไม่ตามผู้ใช้ไปเครื่องอื่น), เก็บที่ไหนในแต่ละแพลตฟอร์ม, วิธีเพิ่ม key ใหม่ — E05-S11 CO-23 (ค่าครั้งก่อนของทางรับเงินคืนหนี้และปัดเศษ) ใช้โมดูลนี้

## Offline / sync behavior

ค่าตั้งของเครื่องอยู่ในเครื่องเท่านั้น ใช้ได้เต็มที่แบบออฟไลน์ ไม่ซิงก์ ไม่มี conflict ไม่เข้า outbox ไม่เปลี่ยนรูปแบบ event หรือ schema ของ event log (ถ้าใช้ตารางใน SQLite ต้องแยกจากตาราง event และไม่ถูกอ่านโดย sync engine)

## Test plan

_Tests below are written to fail first (TDD), then implemented to green._

- [ ] Unit (เว็บ): get/set, ค่าเดิมจาก localStorage, ที่เก็บ throw → ค่าเริ่มต้น
- [ ] Unit (native, mock expo-sqlite): get/set, อ่านค่าหลังสร้างโมดูลใหม่ (จำลองเปิดแอปใหม่), ที่เก็บ throw → ค่าเริ่มต้น
- [ ] Guard test: ไม่มี `localStorage` ตรงในไฟล์ค่าตั้ง (DS-1)
- [ ] Test เดิมของ 5 ไฟล์ค่าตั้งยังผ่าน
- [ ] Offline path: ทั้งหมดเป็นในเครื่อง — ไม่มีทาง online/reconnect

## Verification

- [ ] Sandbox run performed: เว็บ build จริง เปลี่ยนค่า → reload → ค่ายังอยู่
- [ ] Android: force stop → เปิดใหม่ (DS-3) — ต้องมี dev client (E01-S06) ถ้าทำไม่ได้ในเซสชันนี้ ต้องบอกเจ้าของตรงๆ และสตอรี่ไม่ถึง Done
- [ ] Screenshots: ไม่มี UI ใหม่ — ภาพก่อน/หลังเปิดแอปใหม่บน Android เป็นหลักฐาน DS-3

## Dev notes

- ตรวจก่อนสร้าง: expo-sqlite 57 มี `expo-sqlite/kv-store` (API แบบ sync `getItemSync`/`setItemSync`) หรือไม่ ถ้ามีใช้ตัวนั้น ถ้าไม่มี ใช้ฐาน SQLite เดิมกับตารางเล็ก `device_settings(key TEXT PRIMARY KEY, value TEXT)` และอ่านทั้งตารางครั้งเดียวตอนเปิดแอป
- ห้ามเปลี่ยน key บนเว็บ

## Code review

- Reviewer (separate agent/session):
- Findings:
- Resolution:

## QA notes
