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

- [ ] เปิด Google sign-in provider
- [ ] Authorized domains: โดเมน `*.web.app` / `*.firebaseapp.com` ของทั้ง 2 site
  (preview channel ใช้ subdomain ของ site dev)

## 6. OAuth client (E02-S01) — หลังมี keystore (คำถาม D1)

- [ ] Web client: Firebase สร้างให้อัตโนมัติเมื่อเปิด Google provider — จด client ID
- [ ] Android app: package name `TBD` (ทีม platform จะเสนอใน E01-S06) + SHA-1 ของ keystore ที่ใช้เซ็น
  ถ้ายังไม่มี keystore ข้ามข้อนี้ไปก่อน

## 7. Deploy credential (E01-S07)

- [ ] สร้าง service account **1 ตัว** สำหรับ CI deploy (สิทธิ์: Firebase Hosting Admin; เพิ่ม Rules/Functions ทีหลังเมื่อถึง story นั้น)
- [ ] สร้าง key แล้วเก็บเป็น GitHub secret ของ repo `goonjs/mon-farm` ชื่อ `FIREBASE_SERVICE_ACCOUNT`
- [ ] **ห้าม** วาง key ลงใน repo, issue, PR หรือแชตกับ agent — ลบไฟล์ key ในเครื่องหลังใส่ secret

## 8. ส่งค่าที่ไม่ใช่ความลับกลับมา

ส่งให้ lead session (หรือใส่ใน Asana MF-07) เพื่อให้ทีมใส่ config ในโค้ด:

| ค่า | ตัวอย่าง |
| --- | --- |
| project ID | `mon-farm-a7` |
| ชื่อ site dev / prod | |
| ชื่อ bucket dev / prod | |
| web app config (`apiKey`, `authDomain`, `appId`, `messagingSenderId`) | ค่าเหล่านี้ไม่ใช่ความลับ |
| ชื่อ GitHub secret | `FIREBASE_SERVICE_ACCOUNT` |
