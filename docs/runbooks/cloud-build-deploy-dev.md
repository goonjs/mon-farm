# Runbook: deploy dev ด้วย Google Cloud Build (E01-S17)

เป้าหมาย: ทุก push เข้า `dev` ให้ Google Cloud Build build + deploy ไปที่ site `mon-farm-dev`
แทน GitHub Actions เพื่อไม่กินโควตานาทีของ GitHub (repo เป็น private)

ไฟล์ใน repo ที่เกี่ยวข้อง: `cloudbuild.yaml` (ขั้นตอน build/deploy), `scripts/deploy.sh` (คำสั่ง deploy เดียวกับที่ CI ใช้),
`.github/workflows/deploy-dev.yml` (เหลือเป็น **สำรอง กดรันเอง** จากแท็บ Actions)

ขั้นตอนด้านล่าง **เจ้าของต้องทำเอง** (เป็นการตั้งค่าบัญชี Google Cloud/GitHub ที่ agent ไม่ควรทำ และการเชื่อม GitHub ต้องล็อกอินผ่านเบราว์เซอร์)

## ค่าใช้จ่าย

- Cloud Build ฟรี 2,500 build-minutes/เดือน ต่อ billing account (เครื่อง e2-standard-2, ค่าเริ่มต้น) เกินแล้ว $0.006/นาที
  (ตามหน้าราคา Google ณ 2026-10-11 — เป็นโปรโมชัน อาจเปลี่ยน)
- 1 deploy ≈ 2–3 นาที → ราว 800+ deploy/เดือนก่อนเกินโควตา
- โปรเจกต์ `mon-farmmate` อยู่บน Blaze อยู่แล้ว ให้ตั้ง budget alert ไว้ (ตาม D-1)
- ต้องเปิด API: Cloud Build (`cloudbuild.googleapis.com`)

## 1. สร้าง service account เฉพาะ deploy dev

ใช้ตัวแยก ไม่ใช้ default ของ Cloud Build และไม่ใช้ `gh-deploy` ร่วมกัน เพื่อให้สิทธิ์น้อยที่สุด

```bash
gcloud config set project mon-farmmate
gcloud services enable cloudbuild.googleapis.com
gcloud iam service-accounts create cb-deploy-dev --display-name="Cloud Build deploy dev"

SA=cb-deploy-dev@mon-farmmate.iam.gserviceaccount.com
for role in roles/firebasehosting.admin roles/serviceusage.serviceUsageConsumer \
            roles/logging.logWriter; do
  gcloud projects add-iam-policy-binding mon-farmmate --member="serviceAccount:$SA" --role="$role"
done
```

หมายเหตุ: `firebasehosting.admin` ระดับโปรเจกต์ deploy ได้ทั้ง site dev และ prod (เท่ากับ `gh-deploy` ที่ใช้อยู่ตอนนี้;
MVP ใช้โปรเจกต์เดียว ตาม D-34) — `cloudbuild.yaml` deploy แค่ `dev` เท่านั้น

## 2. เชื่อม GitHub กับ Cloud Build

Console → Cloud Build → **Triggers** → **Connect repository** → GitHub → ล็อกอินและอนุญาต Cloud Build GitHub App
ให้เข้าถึงเฉพาะ repo `goonjs/mon-farm` (เลือก repository เดียว ไม่ใช่ทุก repo)

## 3. สร้าง trigger

Console: Triggers → Create trigger
- Event: Push to a branch · Branch: `^dev$`
- Configuration: Cloud Build configuration file · Location: `cloudbuild.yaml`
- Included/ignored files: Ignored files = `docs/**`, `**/*.md` (ไม่ deploy เมื่อแก้เอกสารล้วน)
- Service account: `cb-deploy-dev@mon-farmmate.iam.gserviceaccount.com`

หรือ CLI (ตรวจ flag ด้วย `gcloud builds triggers create github --help` ก่อน เพราะอาจต่างตามเวอร์ชัน):

```bash
gcloud builds triggers create github --name=deploy-dev \
  --repo-owner=goonjs --repo-name=mon-farm --branch-pattern='^dev$' \
  --build-config=cloudbuild.yaml \
  --ignored-files='docs/**,**/*.md' \
  --service-account=projects/mon-farmmate/serviceAccounts/cb-deploy-dev@mon-farmmate.iam.gserviceaccount.com
```

## 4. ทดสอบ

1. Triggers → `deploy-dev` → **Run** (เลือก branch `dev`) หรือ push เข้า `dev` จริง
2. ดู Cloud Build → History: 3 ขั้น (install, build, deploy) เขียว และเว็บ `mon-farm-dev` อัปเดต
3. ถ้าขั้น deploy ล้ม ด้วย error เรื่อง credentials/permission: ตรวจ role ในข้อ 1
   (ผู้เขียนยังไม่ได้ทดสอบบนบัญชีจริง — **การรันครั้งแรกคือการยืนยัน**)

## 5. เมื่อใช้ได้แล้ว

- ไม่ต้องทำอะไรกับ `deploy-dev.yml` (ไม่รันอัตโนมัติแล้ว) — ใช้เป็นสำรองกดเอง
- ถ้า trigger ยังไม่ได้ตั้ง **dev จะไม่ deploy อัตโนมัติ** หลังรวม story นี้เข้า dev จนกว่าจะทำข้อ 1–3 (ระหว่างนั้นกด Deploy Dev เองจากแท็บ Actions)

## ข้อควรรู้

- Cloud Build ไม่ยกเลิก build เก่าเมื่อมี push ใหม่ (GitHub workflow เดิมเคยยกเลิก) ถ้า push ติดกันสองครั้ง
  build เก่าอาจเสร็จทีหลังและ dev ค้างที่ commit เก่า — ถ้าเจอ ให้กด Run trigger อีกรอบ (ยอมรับได้สำหรับ dev)
- `gcloud config set project` เปลี่ยนค่าเริ่มต้นในเครื่องคุณ ถ้าไม่ต้องการ ให้ใส่ `--project mon-farmmate` ทุกคำสั่งแทน

## ย้อนกลับ

ลบ trigger `deploy-dev` และคืน `push: branches: [dev]` ใน `.github/workflows/deploy-dev.yml`
