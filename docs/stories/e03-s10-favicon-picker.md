# Story E03-S10: เลือกไอคอนบนแท็บเบราว์เซอร์ (favicon)

Status: In Progress (เจ้าของสั่งงานผ่านลีด 2026-11-02 ทิศทางอนุมัติแล้ว; AC ส่งลีด 2026-11-02)

## Context

- Epic: `docs/epics/e03-master-data.md` (ค่าของเครื่อง หน้า "เครื่องนี้")
- โค้ดเดิม: หน้า "เครื่องนี้" `src/v2/device-screen.tsx`, ชุดไอคอน FarmMate `src/ui/farmmate-icons/registry.tsx`
  (40 ไอคอน วาดด้วย react-native-svg สีจาก theme), `deviceSettings` (`src/store/device-settings`),
  favicon ปัจจุบัน `assets/images/favicon.png` (ตั้งใน `app.json` → build เว็บใส่ `<link rel="icon" href="/favicon.ico">`)
- ไม่มี PWA manifest และไม่มี service worker ในแอปตอนนี้
- ขึ้นกับ: ไม่มี

## Description

บนเว็บ ผู้ใช้เลือกไอคอนที่แสดงบนแท็บเบราว์เซอร์ได้ที่หน้า "เครื่องนี้" จากไอคอน FarmMate ที่แอปใช้อยู่แล้ว ~20 แบบ
จำไว้ในเครื่อง ใช้กับ bookmark / ไอคอนหน้าจอโฮมเท่าที่เบราว์เซอร์ยอม บนแอป Android/iOS ไม่มีแท็บเบราว์เซอร์ จึงไม่แสดงตัวเลือก

## Acceptance criteria

- [ ] **FV-1** หน้า "เครื่องนี้" บนเว็บมีการ์ด "ไอคอนบนแท็บเบราว์เซอร์" เป็นตาราง ช่อง "เดิม" + ไอคอน FarmMate 20 แบบ
  แตะเลือกได้ ช่องที่เลือกมีกรอบเด่นและบอก screen reader ว่าเลือกอยู่ (ชื่อไทยของไอคอนเป็นชื่อปุ่ม); ที่แตะ ≥ 48
- [ ] **FV-2** แตะแล้วไอคอนบนแท็บเปลี่ยนทันที ไม่ต้อง reload; ตั้ง `<link rel="icon">` (PNG 64 px) และ
  `<link rel="apple-touch-icon">` (PNG 180 px พื้นทึบ) ที่วาดจากไอคอนในเครื่อง — ไม่โหลดอะไรจากเน็ต
- [ ] **FV-3** จำในเครื่องผ่าน `deviceSettings` key `mon-farm:favicon` (ไม่ใช้ localStorage ตรง); reload / เปิดหน้าอื่นก่อน
  ก็ยังเป็นไอคอนที่เลือก; ค่าที่ไม่รู้จัก → เดิม
- [ ] **FV-4** ค่าเริ่มต้น = เดิม: ถ้าไม่เคยเลือก แอปไม่แตะ `<head>` เลย; เลือก "เดิม" กลับ → คืนลิงก์ favicon เดิมและเอา
  apple-touch-icon ที่แอปใส่ออก
- [ ] **FV-5** บน Android/iOS (native) ไม่แสดงการ์ดนี้ และไม่มีโค้ดแตะ DOM
- [ ] **FV-6** ไม่มีอะไรถูกตัด / "…" / ล้นข้างจอ ที่จอ 360 และ 390 ทุกขนาดตัวอักษร เล็ก/กลาง/ใหญ่ (build จริง)
- [ ] **FV-7** ข้อจำกัด bookmark ของแต่ละเบราว์เซอร์เขียนไว้ใน Dev notes ตรง ๆ
- [ ] **FV-8** ภาพประกอบ/รูปอื่นในระบบ: ตรวจว่าใช้เป็น favicon ได้กี่รูป ถ้าที่อ่านออกที่ 16/32 px ไม่ถึง 10 รูป ไม่เอามา (บันทึกผลใน Dev notes)

## Offline / sync behavior

ค่าของเครื่อง เก็บผ่าน `deviceSettings` ไม่อยู่ใน event log ไม่ sync (เหมือนธีม/ขนาดตัวอักษร) ไอคอนวาดจากโค้ดใน bundle
(SVG → canvas → PNG data URL) ไม่ขอเน็ต ใช้ได้ออฟไลน์เต็มที่

## Test plan

_เขียน test ก่อน (TDD)_

- [ ] Vitest: แปลง element ไอคอนเป็น SVG ข้อความ (`src/core/svg-markup.test.ts`), รายการ 20 ไอคอนมีอยู่จริงใน registry ไม่ซ้ำ,
  อ่าน/เขียนค่า `mon-farm:favicon` ค่าแปลก → เดิม
- [ ] jest: การ์ดในหน้าเครื่องนี้ แตะแล้วเขียนค่า + เรียกเปลี่ยน favicon; native ไม่มีการ์ด; ตั้ง `<link>` ใน DOM (jsdom)
- [ ] Playwright 390×844 บน build จริง: เลือก → `link[rel=icon]` เป็น data:image/png, reload ยังอยู่, เลือกเดิม → `/favicon.ico`;
  ไม่ถูกตัดที่ 360/390 × S/M/L

## Verification

- [x] Sandbox run performed: `npm run build:web` (expo export) + Playwright บน Chromium ของเครื่อง (`/opt/pw-browsers/chromium`)
  — `e2e/v2-favicon.spec.ts` 8 ผ่าน; e2e portrait ทั้งชุด 40 ผ่าน 5 ข้าม (emulator) · jest ทั้งหมดผ่าน · vitest ผ่าน · tsc / eslint สะอาด
  - FV-2: เลือก "ชั่งน้ำหนัก" → `link[rel=icon]` เป็น PNG data URL 64×64, `apple-touch-icon` PNG 180×180 (ถอดรหัสในเบราว์เซอร์จริง)
  - FV-3: เปิด `/v2` ใหม่ → ไอคอนเดียวกันกลับมา; หน้าเครื่องนี้ยังเลือกช่องเดิม
  - FV-4: ไม่เคยเลือก → `<head>` มีแค่ `/favicon.ico` ไม่มี apple-touch-icon; เลือก "เดิม" → กลับเป็นแบบนั้นทุกตัว
  - FV-6: 360 และ 390 × เล็ก/กลาง/ใหญ่ (ยืนยันขนาดตัวอักษรใช้จริงจาก font-size ของบรรทัดหมายเหตุ) ไม่มีตัด/…/ล้นข้าง ที่แตะ < 48 = 0
- [x] Screenshots — golden path: `docs/ux/screenshots/e03-s10/device-picker-chosen.png`, `tab-strip.png`
  (แถบแท็บสว่าง/มืด **วาดจำลอง** ด้วยไอคอนที่แอปตั้งจริง — Chromium แบบ headless ไม่มีแถบแท็บให้ถ่าย)
- [x] Screenshots — edge cases: `docs/ux/screenshots/e03-s10/card-{360,390}-{s,m,l}.png`

## Dev notes

- ทำอย่างไร: ไอคอนใน registry เป็น element ของ react-native-svg → `toSvgMarkup` (`src/ui/favicon/svg-markup.ts`) เขียนเป็น
  SVG ข้อความเอง (ไม่ลง package) → บนเว็บวาดลง `<canvas>` เป็น PNG data URL (64 px แท็บ, 180 px หน้าจอโฮม). ถ้าวาด PNG ไม่ได้
  ใช้ SVG data URL แทน (Chrome/Firefox/Edge แสดงได้). ใช้สีชุดสว่างเสมอ (อยู่บนแถบแท็บ ไม่ใช่ในแอป)
- เลือก 20 จาก 40 โดยดูทั้ง 40 ที่ 16/32 px บนแถบสว่างและมืด: ตัดเส้นบาง/ชิ้นเล็ก (`sale.yieldStats`, `farm.treeCondition`,
  `nav.more`, `nav.profile` ฯลฯ) และตัวที่ซ้ำรูปทรง. ไอคอนเดิมมีขอบว่างใน grid 48 มาก → crop ตามขอบภาพจริง (วัดด้วย getBBox
  เก็บใน `BOUNDS`) และวางบนแผ่นสีอ่อนมุมมน เพราะไอคอนสีกรมท่าหายไปบนแถบแท็บสีเข้ม
- native: การ์ดคืน `null` และ `apply.ts` (native) ไม่ทำอะไร — เลือก "ซ่อน" ไม่ใช่ "แสดงแต่ปิด" เพราะบนแอปไม่มีแท็บให้เห็นผล
- start-up: `FaviconOnStart` ใน `src/app/_layout.tsx` อ่านค่าหลัง mount แล้วตั้งให้ ถ้าเป็น "เดิม" ไม่แตะ `<head>`;
  ก่อน JS โหลด (เสี้ยววินาทีแรก) แท็บยังเป็นไอคอนเดิม เพราะ HTML เป็นไฟล์ static เดียวกันทุกเครื่อง
- **ข้อจำกัด bookmark / หน้าจอโฮม (FV-7)** — จากเอกสารและพฤติกรรมที่รู้ของเบราว์เซอร์ **ยังไม่ได้ลองบนเครื่องจริง**:
  - Chrome / Edge / Firefox (คอม): แท็บเปลี่ยนทันที (ยืนยันแล้วว่า `<link>` เปลี่ยนบน build จริง); บุ๊กมาร์กเก็บไอคอนที่เห็นตอนกดบุ๊กมาร์ก
    และอัปเดตเมื่อเปิดหน้านั้นอีก — ถ้าเลือกไอคอนก่อนกดบุ๊กมาร์กจะได้ไอคอนที่เลือก
  - Safari (Mac): แสดงไอคอนแท็บจาก `<link rel="icon">` PNG แต่ Safari แคชไอคอนแรงกว่า — บุ๊กมาร์ก/Favorites อาจยังเป็นไอคอนเก่า
  - iOS Safari "เพิ่มไปยังหน้าจอโฮม": ใช้ `apple-touch-icon` ที่อยู่ในหน้า ณ ตอนกดเพิ่ม → ได้ไอคอนที่เลือก (180 px พื้นขาว)
  - Android Chrome "เพิ่มไปยังหน้าจอหลัก": แอปไม่มี web app manifest, Chrome จึงทำเป็นทางลัดจากไอคอนในหน้า
    (`apple-touch-icon`/`icon`) — บางรุ่นอาจใช้ตัวอักษรแทน ยังไม่ได้ยืนยัน
  - ไอคอนบนหน้าจอโฮม/บุ๊กมาร์กที่เพิ่ม **ไปแล้ว** ไม่เปลี่ยนตามเมื่อเลือกใหม่ (ต้องลบแล้วเพิ่มใหม่)
  - ถ้าวันหน้าเพิ่ม PWA manifest: ไอคอนใน manifest เป็นไฟล์คงที่ เลือกต่อเครื่องไม่ได้ และจะใช้แทน `apple-touch-icon` บน Android —
    ไอคอนแอปที่ติดตั้งจะไม่ตามตัวเลือกนี้
- **รูปอื่นในระบบ (FV-8)**: `assets/images` มีไอคอนแอป Expo (favicon/icon/splash/android-icon = รูปเดียวกัน = ตัวเลือก "เดิม"),
  โลโก้ React/Expo, `tutorial-web.png`, ไอคอนแท็บเก่า 2 รูป (home/explore เส้นบาง); ภาพประกอบอื่นของแอปคือฉากหน้าแรก
  (`design/cover-scene.ts`) เป็นฉากวาดทั้งจอ ไม่ใช่รูปไอคอน; `design/icons/farmmate/*.svg` เป็นต้นแบบของชุดไอคอนเดียวกัน
  → ที่อ่านออกที่ 16/32 px และเหมาะกับแอปนี้ไม่ถึง 10 รูป จึงไม่เอามา

## Code review

- Reviewer (separate agent/session):
- Findings / Resolution:

## QA notes
