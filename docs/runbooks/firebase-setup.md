# Runbook: ตั้งค่า Firebase โปรเจกต์ `mon-farm-a7`

> สถานะ: รอเจ้าของทำในเครื่องตัวเอง (เขียน 2026-10-03)
> ที่มา: PRD D-34 (1 โปรเจกต์สำหรับ MVP), ADR 0001 amendment 2, story E01-S07, E01-S08, E01-S12, E02-S01
> ใครทำ: เจ้าของ (หรือ session ในเครื่องเจ้าของ เช่น mon-farm-a7) เพราะต้องใช้สิทธิ์ console และสร้าง secret

โปรเจกต์เดียวเก็บทั้ง dev และ prod แยกกันด้วย database, bucket และ Hosting site — Auth ใช้ร่วมกัน
(ความเสี่ยงที่เจ้าของรับแล้ว 2026-10-03) ทำตามลำดับ ข้อที่ขึ้นกับข้ออื่นเขียนไว้ในวงเล็บ

## 1. โปรเจกต์และงบ

- [ ] ยืนยันแผน Blaze
- [ ] ตั้ง budget alert ที่ครอบ Firestore, Cloud Storage, Cloud Functions, Hosting (NFR-6)
- [ ] ตั้ง default region เป็น `asia-southeast1`

## 2. Firestore (E01-S08)

- [ ] database `(default)` = **prod** (`asia-southeast1`, native mode)
- [ ] สร้าง database ชื่อ `dev` (`asia-southeast1`) — build dev/preview ใช้ตัวนี้เท่านั้น (NFR-5)
- [ ] ยังไม่ต้อง deploy rules — ทีม platform ทำผ่าน CI หลังเจ้าของอนุมัติ deploy

## 3. Cloud Storage (E01-S12)

- [ ] bucket หลัก (default) = **prod**, `asia-southeast1`
- [ ] สร้าง bucket แยกสำหรับ **dev**, `asia-southeast1`

## 4. Hosting (E01-S07)

- [ ] สร้าง 2 site: site ของ `dev` (ใช้ preview channel ของ PR ด้วย) และ site ของ `prod`
- [ ] จดชื่อ site ทั้งสอง (เช่น `mon-farm-a7-dev`, `mon-farm-a7`) ส่งกลับมา

## 5. Auth (E02-S01)

- [x] เปิด Google sign-in provider (2026-10-03)
- [ ] Authorized domains: โดเมน `*.web.app` / `*.firebaseapp.com` ของทั้ง 2 site
  (preview channel ใช้ subdomain ของ site dev)

## 6. OAuth client (E02-S01) — หลังมี keystore (D1: เจ้าของสร้างในเครื่องตัวเอง เก็บเป็น GitHub secret — E01-S06)

- [ ] Web client: Firebase สร้างให้อัตโนมัติเมื่อเปิด Google provider — จด client ID
- [x] Android app ลงทะเบียนแล้ว (2026-10-03): package name `com.goonjs.monfarm`, nickname "Mon FarmMate"
- [x] เพิ่ม fingerprint SHA-1 และ SHA-256 ของ release key แล้ว (2026-10-03; ค่าอยู่ใน ADR 0003) —
  ไม่ต้องใช้ `google-services.json` (แอปใช้ Firebase JS SDK)

## 7. Deploy credential (E01-S07) — keyless (Workload Identity Federation)

> แก้ 2026-10-03: workflow ทั้งหมด (`ci.yml` preview, `deploy-dev.yml`, `deploy-prod.yml`) ใช้
> `google-github-actions/auth` แบบ **ไม่มี key** ผ่าน repo **variables** `GCP_WORKLOAD_IDENTITY_PROVIDER`
> และ `GCP_SERVICE_ACCOUNT` — **ไม่ต้องสร้าง service-account key และไม่มี secret `FIREBASE_SERVICE_ACCOUNT`**

- [ ] สร้าง service account **1 ตัว** สำหรับ CI deploy เช่น `github-deploy@mon-farm-a7.iam.gserviceaccount.com`
  ให้สิทธิ์ Firebase Hosting Admin (เพิ่ม Firebase Rules Admin / Functions ทีหลังเมื่อถึง story นั้น)
- [ ] IAM → Workload Identity Federation: สร้าง pool (เช่น `github`) และ provider แบบ OIDC
  - issuer: `https://token.actions.githubusercontent.com`
  - attribute mapping: `google.subject=assertion.sub`, `attribute.repository=assertion.repository`
  - attribute condition: `assertion.repository == "goonjs/mon-farm"`
- [ ] ให้ service account ข้างบนมี role `Workload Identity User` สำหรับ principal
  `principalSet://iam.googleapis.com/projects/<PROJECT_NUMBER>/locations/global/workloadIdentityPools/github/attribute.repository/goonjs/mon-farm`
- [ ] GitHub repo `goonjs/mon-farm` → Settings → Secrets and variables → Actions → แท็บ **Variables** (ไม่ใช่ Secrets):
  - `GCP_WORKLOAD_IDENTITY_PROVIDER` = `projects/<PROJECT_NUMBER>/locations/global/workloadIdentityPools/github/providers/<PROVIDER_ID>`
  - `GCP_SERVICE_ACCOUNT` = อีเมล service account ข้างบน
- [ ] **ห้าม** สร้างหรือดาวน์โหลด service-account key — วิธีนี้ไม่ต้องใช้ key เลย

## 8. ส่งค่าที่ไม่ใช่ความลับกลับมา

ส่งให้ lead session (หรือใส่ใน Asana MF-07) เพื่อให้ทีมใส่ config ในโค้ด:

| ค่า | ตัวอย่าง |
| --- | --- |
| project ID | `mon-farm-a7` |
| ชื่อ site dev / prod | |
| ชื่อ bucket dev / prod | |
| web app config (`apiKey`, `authDomain`, `appId`, `messagingSenderId`) | ค่าเหล่านี้ไม่ใช่ความลับ |
| GitHub variables ที่ตั้งแล้ว | `GCP_WORKLOAD_IDENTITY_PROVIDER`, `GCP_SERVICE_ACCOUNT` (ค่าไม่ใช่ความลับ) |
