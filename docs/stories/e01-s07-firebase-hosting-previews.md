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

### Checklist เจ้าของ (ทำครั้งเดียว, ราว 30–45 นาที)

agent ทำข้อเหล่านี้แทนไม่ได้ (บัญชี, บัตร, credential) เสร็จแล้วตอบ lead ว่า "MF-07 พร้อม" พร้อม
project id ทั้งสอง **ห้ามส่งไฟล์ key ให้ใครในแชท** ใส่เป็น GitHub secret อย่างเดียว

**ก. สร้างโปรเจกต์ (ทำ 2 รอบ: `dev` แล้ว `prod`)**

1. เปิด <https://console.firebase.google.com> → login บัญชี Google ของเจ้าของ
2. กด **Create a project** (หรือ **Add project**) → ชื่อ `mon-farm-dev` (รอบสอง `mon-farm-prod`)
   → จด **Project ID** ที่ระบบให้ (อาจมีเลขต่อท้าย)
3. Google Analytics: **ปิด** (ไม่ได้ใช้) → **Create project**
4. เมนูซ้ายล่าง ⚙️ → **Usage and billing** → **Details & settings** → **Modify plan** → เลือก **Blaze**
   → ผูกบัญชีเรียกเก็บเงิน
5. ในขั้น Blaze ตั้ง **budget alert** (หรือภายหลังที่ <https://console.cloud.google.com/billing> → **Budgets & alerts**
   → **Create budget**) — แนะนำ 300 บาท/เดือนต่อโปรเจกต์ แจ้งเตือนที่ 50% / 90% / 100% (ตัวเลขเปลี่ยนได้)
6. เมนู **Build → Firestore Database** → **Create database** → Edition: **Standard** → Location:
   **asia-southeast1 (Singapore)** → เริ่มใน **production mode** (rules ปิดทุกอย่าง; E01-S08 จะ deploy rules จริง)
   ⚠️ location เปลี่ยนภายหลังไม่ได้
7. เมนู **Build → Hosting** → **Get started** → กดข้ามขั้นติดตั้ง CLI ไปจนจบ (site หลักถูกสร้างให้อัตโนมัติ)
8. เมนู **Build → Authentication** → **Get started** → **Google** → **Enable** → เลือกอีเมล support → **Save**

**ข. Credential สำหรับ deploy (1 ชุดต่อโปรเจกต์)**

1. เปิด <https://console.cloud.google.com/iam-admin/serviceaccounts> → เลือกโปรเจกต์ (มุมซ้ายบน)
2. **Create service account** → ชื่อ `github-deploy` → **Create and continue**
3. ใส่ role: **Firebase Hosting Admin**, **Firebase Rules Admin**, **Cloud Datastore Index Admin**,
   **API Keys Viewer**, **Service Account User** → **Done**
   (agent จะยืนยันรายการ role ที่น้อยที่สุดอีกครั้งตอนต่อ deploy จริง ถ้าขาดจะแจ้ง)
4. คลิก service account ที่สร้าง → แท็บ **Keys** → **Add key → Create new key → JSON** → ไฟล์ถูกดาวน์โหลด
5. เปิด <https://github.com/goonjs/mon-farm/settings/secrets/actions> → **New repository secret**
   - ชื่อ `FIREBASE_SERVICE_ACCOUNT_DEV` (รอบ prod: `FIREBASE_SERVICE_ACCOUNT_PROD`)
   - ค่า = เปิดไฟล์ JSON ด้วย Notepad/TextEdit แล้ววางทั้งไฟล์ → **Add secret**
6. **ลบไฟล์ JSON ออกจากเครื่อง** (และถังขยะ) — ห้ามใส่ใน repo, Drive หรือแชท
7. หน้าเดียวกัน แท็บ **Variables** → **New repository variable** (ไม่ลับ) 2 ตัว: `FIREBASE_PROJECT_DEV`,
   `FIREBASE_PROJECT_PROD` = Project ID จากข้อ ก.2

**ค. Domain (ทำเมื่อพร้อม ไม่ขวางงานอื่น)**

1. เลือก 2 ชื่อ เช่น `dev.<โดเมน>` และ `<โดเมน>` → Hosting → **Add custom domain** ในโปรเจกต์ที่ตรงกัน
   → ทำตามที่ระบบบอกให้เพิ่ม DNS record ที่ผู้ให้บริการโดเมน
2. ระหว่างยังไม่มีโดเมน ใช้ `<project-id>.web.app` ไปก่อนได้

**ง. แจ้ง lead:** Project ID ทั้งสอง, ชื่อ secret/variable ที่สร้างแล้ว, budget ที่ตั้ง — agent จะต่อ `deploy.sh`,
workflow preview และขออนุมัติ deploy dev ครั้งแรก


## Code review

## QA notes
