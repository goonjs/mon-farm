# Story E02-S01: Google Login + ใช้ออฟไลน์ต่อได้หลัง login

Status: In Progress

## Context

- Epic: `docs/epics/e02-access-farm-groups.md`
- PRD: ACC-1, ACC-6, NFR-5 · D-2
- Architecture: "2026-10-02 — Direction" แถว *Auth* (Firebase Auth; `linkWithCredential` สำหรับผู้ใช้คนเดียว)
- ขึ้นกับ: E01-S02 (`actor.userId`), E01-S06 (dev client), E01-S07 (โปรเจกต์ Firebase)
- ปรับตาม D-34 (2026-10-03)

## คำอธิบาย

login ด้วย Google บนเว็บและ Android ผ่าน Firebase Auth; ผู้ใช้เชิงตรรกะ (`users/{userId}`) หนึ่งคนผูกตัวตน login ได้หลายแบบ
เพื่อให้เพิ่ม LINE ภายหลังไม่สร้างผู้ใช้ซ้ำ (LINE ไม่อยู่ใน story นี้)
ต้อง login ก่อนใช้งานครั้งแรก — ยังไม่ login บันทึกข้อมูลไม่ได้; ไม่มีปุ่มออกจากระบบ (logout) ใน MVP

## Acceptance criteria

- [ ] login ด้วย Google ได้ทั้งเว็บและ Android (ACC-1)
- [ ] เปิดแอปครั้งแรกยังไม่ login → ขึ้นหน้า login เท่านั้น บันทึกข้อมูลใด ๆ ไม่ได้ (ACC-6)
- [ ] ครั้งแรกออฟไลน์ (ยังไม่เคย login) → ข้อความไทยบอกว่าต้องต่อเน็ตเพื่อ login ครั้งแรก
- [ ] บัญชี Google เดียวกันบน 2 เครื่อง → `userId` เดียวกัน; โมเดลเก็บรายการตัวตนที่ผูกไว้ แยกจาก `userId` (ACC-1)
- [ ] หลัง login ครั้งแรก ปิด-เปิดแอปในโหมดเครื่องบินยังเข้าใช้งานได้ ไม่ต้อง login ใหม่ (ACC-6)
- [ ] event ใหม่หลัง login มี `actor.userId` = ผู้ใช้นี้ (E01-S02, SYNC-9)
- [ ] token หมดอายุระหว่างออฟไลน์ไม่ขวางการบันทึก; sync กลับมาเองเมื่อ refresh ได้
- [ ] ไม่มีปุ่มออกจากระบบ (logout) ใน MVP (D-23)
- [ ] ข้อความทั้งหมดเป็นภาษาไทย (D-20)

## Offline / sync behavior

- ต้องมีเน็ตเฉพาะ login ครั้งแรก; หลังจากนั้นทำงานออฟไลน์ได้ทั้งหมด (ACC-6)
- ไม่มีข้อมูลก่อน login: event ทุกตัวมี `actor.userId` จริงตั้งแต่ตัวแรก
- session ต้องคงอยู่หลัง force-close (ไม่ใช่ memory-only)

## Test plan

- [ ] Vitest: โมเดลผู้ใช้ — ผูกตัวตนที่สองเข้าผู้ใช้เดิมไม่สร้างผู้ใช้ใหม่
- [ ] jest-expo: หน้าจอ login, สถานะ login แล้ว/ยัง, ยังไม่ login → บันทึกไม่ได้, ครั้งแรกออฟไลน์ → ข้อความต้องต่อเน็ต, เปิดแอปออฟไลน์หลัง login
- [ ] Auth emulator + Playwright: login (provider จำลอง) → offline → reload → ยังเข้าได้

## ต้องให้เจ้าของทำ/อนุมัติ

- เปิด Google provider ในโปรเจกต์ (Auth ใช้ร่วม dev/prod, D-34); สร้าง OAuth client (เว็บ + Android SHA-1); เพิ่ม authorized domains รวมโดเมน preview channel
- อนุมัติ dependency สำหรับ Google sign-in บน Android และ auth persistence บน RN (gate + ผลตรวจ)

## คำถามเจ้าของ

- ต้อง login ก่อนใช้งานครั้งแรกไหม หรือบันทึกก่อน login ได้
- ผูก LINE ผ่าน Firebase custom token (ACC-1) ตัดสินตอนนี้ไหม
- มีปุ่มออกจากระบบ (logout) ใน MVP ไหม

**คำตอบเจ้าของ (2026-10-03):**
- ต้อง login ก่อนใช้งานครั้งแรก (ครั้งแรกต้องมีเน็ต); ยังไม่ login บันทึกข้อมูลไม่ได้
- ผูก LINE ผ่าน custom token → เลื่อนไป ตัดสินตอนทำ LINE; ตอนนี้แค่เก็บ `userId` แยกจากตัวตน login (มีใน AC แล้ว)
- ไม่มีปุ่มออกจากระบบใน MVP

## Verification

2026-10-09 (branch `feature/e02-groups`, sandbox):

- `npm run typecheck`, `lint`, `test:core`, `test:ui`, `tokens:check`, `contrast` — ผ่าน
- Vitest: `src/core/user.test.ts` (ผูกตัวตนที่สองไม่สร้างผู้ใช้ใหม่; บัญชีเดียวกันสองเครื่อง = `userId` เดียวกัน),
  `src/store/account.test.ts` (session อยู่รอดหลัง reload; อ่านไม่ได้ → ถือว่ายังไม่ login; เขียนไม่ได้ → เตือน
  not-durable), `src/store/session.test.ts`, `src/auth/errors.test.ts`
- jest-expo: `src/__tests__/account-gate.test.tsx` — ยังไม่ login มีแค่หน้า login; login แล้วเก็บผู้ใช้ + เข้าแอป +
  `actor.userId` = ผู้ใช้; กำลังทำกดซ้ำไม่ได้; ออฟไลน์ / popup ถูกบล็อก / error + ลองอีกครั้ง / ปิดหน้าต่างไม่ใช่ error;
  เปิดใหม่มีผู้ใช้ในเครื่องแล้วเข้าเลยไม่เรียก sign-in; ไม่มีข้อความ "ออกจากระบบ"; write path ก่อน login →
  `NotSignedInError` และ log ไม่เปลี่ยน
- Playwright (`e2e/login.spec.ts`, build จริง `expo export`, Chromium 390×844): หน้า login อย่างเดียว (deep link
  `/settings` ก็ยังเป็นหน้า login), กดตอนออฟไลน์ → ข้อความต้องต่อเน็ต, เครื่องที่เคย login → เปิดเข้าแอปเลยขณะที่ทุก
  request นอก origin ถูกตัดและเครือข่ายออฟไลน์ ภาพ: `docs/ux/screenshots/overnight/e02/s01-login.png`,
  `s01-login-offline.png`, `s01-reopen-offline.png`
- e2e เดิมทั้งชุด 144 ผ่านหลังเพิ่ม gate (preload session ผ่าน `storageState`, `e2e/session.ts`)

2026-10-09 หลัง code review (commit `9338135`…`947777e`):

- `typecheck`, `lint`, `test:core` 255/255, `test:ui` 84/84, `tokens:check`, `contrast` — ผ่านก่อนทุก commit
- Vitest `src/store/account.test.ts` บน fake-indexeddb: session อยู่ใน IndexedDB `meta` คีย์ `session`, อยู่รอด reload;
  ค่าที่เก็บผิดรูป → ถือว่ายังไม่ login; **สองแท็บ**: แท็บที่อ่านไว้ก่อนแล้ว login ทีหลังไม่ลบกลุ่ม/op ที่อีกแท็บสร้าง (F1 —
  เขียนก่อนและล้มก่อนเปลี่ยน adapter); ไม่มี IndexedDB → ใช้หน่วยความจำ + เตือน not-durable
- jest-expo: login แล้วเขียน event จริง → `actor.userId` = ผู้ใช้ และ `groupId` = กลุ่ม (F2 — ล้มเมื่อแก้ `stamp` ให้ใส่
  userId อื่น); กด login สองครั้งในเฟรมเดียว → เรียก sign-in ครั้งเดียว (F6); บัญชีอื่นมีกลุ่มในเครื่อง → ผู้ที่ login
  ใหม่ไม่ถูกพาเข้ากลุ่มนั้น (F5)
- Playwright ทั้งชุด (build จริง, Chromium ที่ติดตั้งไว้ผ่าน config ใน scratchpad): 152 ผ่าน, 8 ข้าม (รวม
  `auth-emulator.spec.ts`) — session preload เป็น IndexedDB ผ่าน `storageState`; `e2e/groups.spec.ts` ตรวจ
  `actor.userId` ของ event ใน IndexedDB ด้วย ภาพหน้าจอที่ e2e เขียนทับคืนเป็นเวอร์ชันที่ commit ไว้ ยกเว้นที่ตั้งใจถ่ายใหม่

## Dev notes

- **โครง**: `src/core/user.ts` (ผู้ใช้เชิงตรรกะ + ตัวตน) · `src/auth/google.ts` port, `google.web.ts` (Firebase Auth
  popup), `google.native.ts` (ยังไม่ทำ — throw), `errors.ts` · `src/store/account.ts` port + web (IndexedDB
  `mon-farm-v1`: `meta.session`, schema ร่วมใน `src/store/idb.ts`) / native (`meta.session` ใน `mon-farm-v1.db`) / memory · `src/store/session.ts` ผู้เขียนปัจจุบัน
  (แทนค่า `'pre-login'`) · `src/components/AccountGate.tsx` + `LoginScreen.tsx` ครอบ `Stack` ใน `_layout.tsx`
- **การตัดสินใจ**: gate อ่านผู้ใช้จาก store ในเครื่อง ไม่อ่านจาก Firebase Auth ตอนเปิดแอป → เปิดออฟไลน์ / token
  หมดอายุไม่ขวางการบันทึก (AC5, AC7) เว็บเก็บใน IndexedDB `meta` ตามแผน architecture §Schema — เว็บ (ร่าง
  แรกใช้ localStorage และค้างคำถามเจ้าของไว้ — แก้กลับตามแบบที่ตกลงแล้วหลัง code review F4 จึงไม่มีคำถามค้าง)
- **Firebase config**: ยังไม่มีโปรเจกต์ (E01-S07) → `google.web.ts` ใช้ `demo-mon-farm` และทำงานเฉพาะเมื่อ build
  ตั้ง `EXPO_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST`; ไม่มีทั้ง config จริงและ emulator → ไม่ยอมเรียก (ข้อความ
  "เข้าสู่ระบบไม่สำเร็จ") ⇒ **ถ้า merge ตอนนี้ เว็บ dev จะติดหน้า login จนกว่าจะมี config จริง + Google provider**
- **Auth emulator + Playwright popup** (`e2e/auth-emulator.spec.ts`, `npm run test:e2e:auth`, emulator `auth` เพิ่มใน
  `firebase.json` พอร์ต 9099): เขียนแล้ว **รันใน sandbox ไม่ผ่าน** — SDK โหลด `https://apis.google.com/js/api.js`
  แม้ใช้ emulator และ proxy ของ sandbox ตอบ 403 ยังไม่เคยเห็น popup login สำเร็จจริง ยังไม่ได้ใส่ใน CI หลัง review
  (F3) spec คาดหน้าเริ่มใช้งาน (ผู้ใช้ใหม่ยังไม่มีกลุ่ม) → สร้างกลุ่ม → reload เข้ากลุ่มเลย; comment ใน `e2e/session.ts`
  / `e2e/login.spec.ts` ไม่อ้าง spec นี้เป็นหลักฐานแล้ว
- **เบราว์เซอร์ที่ไม่มี IndexedDB**: session อยู่ใน IndexedDB แล้ว จึงเริ่มที่หน้า login ทุกครั้ง (login แล้วใช้หน่วยความจำ
  + เตือน) e2e ของ E01-S03 "ไม่มี IndexedDB" จึงตรวจแถบเตือนบนหน้า login แทนการนับ — การนับในหน่วยความจำพิสูจน์ใน
  `store.web.test.ts` / `account.test.ts`; ภาพ `docs/stories/screenshots/e01-s03/storage-warning.png` ไม่ถ่ายใหม่แล้ว
- **ไม่ครอบคลุม / ค้าง**:
  - AC1 Android: ไม่ทำ (ต้องมี E01-S06 dev client + dependency ผ่าน gate + OAuth client SHA-1)
  - AC1 เว็บกับ Google จริง: ต้องให้เจ้าของเปิด provider + OAuth client + authorized domains (E01-S07)
  - AC7 "sync กลับมาเองเมื่อ refresh ได้": ไม่มี sync (E01-S09) — ส่วน "ไม่ขวางการบันทึก" ครอบแล้ว
  - ยังไม่เขียน `users/{uid}` (`displayName`, `identities`) ขึ้น Firestore — ต้องมีโปรเจกต์/sync
  - เว็บไม่มี service worker: "เปิดออฟไลน์" บนเว็บทดสอบได้แค่ตัด request ออกนอก origin ไม่ใช่โหลดหน้าโดยไม่มีเน็ต
  - native adapter (`account.native.ts`) เขียนแล้วแต่ยังไม่เคยรันบนเครื่อง

## Code review

2026-10-09 — review อิสระของ `2b4549b` + `bed3acc` (agent แยก): **Changes requested** ผลและการแก้ (ร่วมกับ E02-S02):

- **F1** (should-fix) web account store cache เอกสาร localStorage แล้วเขียนทับทั้งก้อน → แท็บที่ค้างลบกลุ่มของอีกแท็บได้
  → **แก้** `9338135`: IndexedDB ไม่มี cache, เขียน 1 ครั้ง = 1 transaction; test สองแท็บ
- **F2** (should-fix) AC6 ไม่มี test บน event จริง → **แก้** `4585933` (jest + e2e)
- **F3** (should-fix) emulator spec ค้างและ comment อ้างเกินจริง → **แก้** `d429cf8` (spec ยังไม่เคยรันผ่าน — ดู Dev notes)
- **F4** (should-fix, process) commit คำถามเจ้าของที่ยังไม่ได้ตอบ (localStorage) → **แก้** `9338135`: กลับไปใช้แบบที่ตกลง
  แล้ว (IndexedDB `meta`) ลบหมายเหตุ "รอเจ้าของยืนยัน" ใน architecture จึงไม่มีคำถามค้าง
- **F5** (should-fix) memberships ไม่ผูกผู้ใช้ → **แก้** `a82a174`
- **F6** (nit) กดซ้ำในเฟรมเดียว → **แก้** `e271a0b` (`useRef` ทั้ง login และสร้างกลุ่ม)
- **F11** (nit) อ่าน account ไม่ได้ชั่วคราวตอนเปิดแอป → ไปหน้า login (ต้องใช้เน็ต) — **ยังไม่แก้** follow-up: ควรแยก
  ข้อมูลเสียกับ I/O error แล้วให้ลองใหม่
- **F13** (nit) test "บัญชีเดียวกันสองเครื่อง" ใน `user.test.ts` ตรวจแค่ input ของตัวเอง — **ยังไม่แก้** follow-up; AC4
  "uid เดียวกัน" ต้องพิสูจน์ด้วย emulator spec จึงยังไม่นับว่าผ่าน
- F7–F10, F12: ดู E02-S02

## QA notes
