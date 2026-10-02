# Story E01-S07: Firebase dev/prod + Hosting deploy + preview channel ต่อ PR

Status: Draft

## Context

- Epic: `docs/epics/e01-foundation-sync.md`
- PRD: NFR-5, NFR-6 · D-1, D-21, D-22
- Architecture: "Deployment / environments"; `docs/adr/0001-firebase-hosting.md` (amended: 2 โปรเจกต์บน Blaze)
- ขึ้นกับ: E01-S05

## คำอธิบาย

ต่อ `scripts/deploy.sh` เข้ากับ Firebase Hosting: โปรเจกต์ **dev** (site dev + preview ต่อ PR, ข้อมูลทดสอบ)
และ **prod** (site prod, ข้อมูลจริง) ตาม ADR 0001

## Acceptance criteria

- [ ] `scripts/deploy.sh dev|prod` deploy `dist/` ไป site ของโปรเจกต์ที่ถูกต้อง; ไม่มี credential → fail closed เหมือนเดิม
- [ ] merge เข้า `dev` → deploy dev อัตโนมัติ; Deploy Prod เรียก `prod` และ merge `main` เฉพาะเมื่อ deploy สำเร็จ
- [ ] ทุก PR ได้ preview channel `pr-<N>` ในโปรเจกต์ dev, `--expires 7d`, deploy ใหม่ต่ออายุ, ลบเมื่อปิด PR, ลิงก์ comment ใน PR (D-21)
- [ ] build dev/preview ใช้ config Firebase ของ dev เท่านั้น — มี test ยืนยันว่าไม่มี prod project id ใน build ที่ไม่ใช่ prod (NFR-5)
- [ ] preview รันหลัง e2e เขียวเท่านั้น และข้ามเมื่อแก้เอกสารล้วน (E01-S05)
- [ ] ทั้ง 2 โปรเจกต์อยู่ asia-southeast1 และมี budget alert (D-1) — บันทึกยืนยันใน Dev notes

## Offline / sync behavior

- N/A — hosting เท่านั้น (เว็บที่ deploy แล้วยังต้องใช้ออฟไลน์ได้ตาม E01-S03)

## Test plan

- [ ] test สคริปต์: env ไม่ถูกต้อง/ไม่มี secret → exit ≠ 0 โดยไม่ deploy
- [ ] test build config: preview/dev bundle ไม่มี prod project id
- [ ] รันจริง: เปิด PR → ได้ลิงก์ preview → ปิด PR → channel ถูกลบ

## ต้องให้เจ้าของทำ/อนุมัติ

- สร้างโปรเจกต์ Firebase `dev` + `prod` บน Blaze, ตั้ง budget alert, region asia-southeast1, site ละ 1, เลือก 2 domain
- สร้าง deploy credential **1 ชุดต่อโปรเจกต์** เก็บเป็น GitHub secret (agent สร้างให้ไม่ได้)
- อนุมัติใช้ `firebase-tools` ใน CI (gate dependency)
- อนุมัติ deploy จริงครั้งแรก (dev) และทุกครั้งที่ Deploy Prod รัน

## Verification

## Dev notes

## Code review

## QA notes
