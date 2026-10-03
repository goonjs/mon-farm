# Story E02-S01: Google Login + ใช้ออฟไลน์ต่อได้หลัง login

Status: Ready

## Context

- Epic: `docs/epics/e02-access-farm-groups.md`
- PRD: ACC-1, ACC-6, NFR-5 · D-2
- Architecture: "2026-10-02 — Direction" แถว *Auth* (Firebase Auth; `linkWithCredential` สำหรับผู้ใช้คนเดียว)
- ขึ้นกับ: E01-S02 (`actor.userId`), E01-S06 (dev client), E01-S07 (โปรเจกต์ Firebase)

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

- เปิด Google provider ในทั้ง 2 โปรเจกต์; สร้าง OAuth client (เว็บ + Android SHA-1); เพิ่ม authorized domains รวมโดเมน preview channel
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

## Dev notes

## Code review

## QA notes
