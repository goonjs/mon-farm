# Story E01-S07: Firebase dev/prod + Hosting deploy + preview channel ต่อ PR

Status: Ready

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

### Checklist เจ้าของ — โปรเจกต์เดียว (เจ้าของตัดสิน 2026-10-03, D-34; ราว 20–30 นาที)

MVP ใช้ **Firebase โปรเจกต์เดียว** (เจ้าของสร้างไว้แล้ว) แยก dev/prod ภายในโปรเจกต์ แยกเป็น 2 โปรเจกต์ก่อนขายจริง
agent ทำข้อเหล่านี้แทนไม่ได้ (บัญชี, บัตร, credential) เสร็จแล้วตอบ lead ว่า "MF-07 พร้อม" พร้อมค่าที่จดไว้
**ห้ามส่งไฟล์ key ให้ใครในแชท** ใส่เป็น GitHub secret อย่างเดียว

| ส่วน | prod | dev + preview ต่อ PR |
|---|---|---|
| Hosting site | site หลัก `<project-id>` | site ที่ 2 `<project-id>-dev` + preview channel |
| Firestore database | `(default)` | `dev` |
| Storage bucket | bucket หลัก | bucket แยกสำหรับ dev |
| Auth, budget alert | ใช้ร่วมกัน | ใช้ร่วมกัน |

⚠️ **ความเสี่ยงที่ต้องรับทราบ:** ในโปรเจกต์เดียว rules แยกไม่ออกว่าคำขอมาจากแอป prod หรือ build preview
(Auth ชุดเดียวกัน) การแยก database/bucket กัน **ความผิดพลาด** ได้ แต่ไม่ใช่ขอบเขตความปลอดภัย —
build preview ของ PR ใด ๆ ที่ถูกแก้ให้ชี้ `(default)` จะอ่าน/เขียนข้อมูลจริงได้ด้วยสิทธิ์ของผู้ที่ login
(NFR-5 คือเหตุผลเดิมของ 2 โปรเจกต์) agent จะใส่ test ใน build ว่า dev/preview ชี้ database `dev` เท่านั้น

**ก. ตรวจ/ตั้งค่าโปรเจกต์ (ที่ <https://console.firebase.google.com> → เลือกโปรเจกต์)**

1. จด **Project ID** (⚙️ → **Project settings** → General)
2. ⚙️ → **Usage and billing** → ยืนยันว่าเป็น **Blaze**; ตั้ง **budget alert** ที่
   <https://console.cloud.google.com/billing> → **Budgets & alerts** → **Create budget**
   (แนะนำ 300 บาท/เดือน แจ้งเตือน 50% / 90% / 100%)
3. **Build → Firestore Database**:
   - ถ้ายังไม่มี `(default)` → **Create database** → Standard → **asia-southeast1 (Singapore)** → production mode
   - ปุ่ม/เมนู **Add database** (หรือเลือก database ด้านบน → **Create database**) → Database ID: **`dev`**
     → **asia-southeast1** → production mode
   - ⚠️ location เปลี่ยนภายหลังไม่ได้
4. **Build → Storage** → bucket หลัก (ถ้ายังไม่มี: **Get started** → asia-southeast1)
   → เพิ่ม bucket ที่ 2 สำหรับ dev (**Add bucket**) ชื่อเช่น `<project-id>-dev` → asia-southeast1 → จดชื่อ
5. **Build → Hosting** → **Get started** (ถ้ายังไม่เคย) → เลื่อนลง **Advanced** → **Add another site**
   → `<project-id>-dev` (ถ้าชื่อถูกใช้แล้ว ระบบจะให้เลือกชื่ออื่น — จดไว้)
6. **Build → Authentication** → **Get started** → **Google** → **Enable** → เลือกอีเมล support → **Save**

**ข. Credential สำหรับ deploy (ชุดเดียว)**

1. เปิด <https://console.cloud.google.com/iam-admin/serviceaccounts> → เลือกโปรเจกต์ (มุมซ้ายบน)
2. **Create service account** → ชื่อ `github-deploy` → **Create and continue**
3. ใส่ role: **Firebase Hosting Admin**, **Firebase Rules Admin**, **Cloud Datastore Index Admin**,
   **API Keys Viewer**, **Service Account User** → **Done**
   (agent จะยืนยันรายการ role ที่น้อยที่สุดอีกครั้งตอนต่อ deploy จริง ถ้าขาดจะแจ้ง)
4. คลิก service account → แท็บ **Keys** → **Add key → Create new key → JSON** → ไฟล์ถูกดาวน์โหลด
5. เปิด <https://github.com/goonjs/mon-farm/settings/secrets/actions> → **New repository secret**
   → ชื่อ `FIREBASE_SERVICE_ACCOUNT` → ค่า = วางเนื้อหาไฟล์ JSON ทั้งไฟล์ → **Add secret**
6. **ลบไฟล์ JSON ออกจากเครื่อง** (และถังขยะ) — ห้ามใส่ใน repo, Drive หรือแชท
7. หน้าเดียวกัน แท็บ **Variables** → **New repository variable** (ไม่ลับ):
   `FIREBASE_PROJECT_ID` = Project ID, `FIRESTORE_DEV_DATABASE` = `dev`,
   `STORAGE_DEV_BUCKET` = ชื่อ bucket dev, `HOSTING_DEV_SITE` = ชื่อ site dev

**ค. Domain (ทำเมื่อพร้อม ไม่ขวางงานอื่น)**

1. เลือก 2 ชื่อ เช่น `dev.<โดเมน>` และ `<โดเมน>` → Hosting → เลือก site → **Add custom domain**
   → เพิ่ม DNS record ตามที่ระบบบอกที่ผู้ให้บริการโดเมน
2. ระหว่างยังไม่มีโดเมน ใช้ `<site>.web.app` ไปก่อนได้

**ง. แจ้ง lead:** Project ID, ชื่อ database/bucket/site ของ dev, ชื่อ secret/variable ที่สร้างแล้ว, budget ที่ตั้ง —
agent จะต่อ `deploy.sh`, workflow preview และขออนุมัติ deploy dev ครั้งแรก


## Code review

## QA notes
