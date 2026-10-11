# Story E01-S17: CI ประหยัดนาทีรอบ 2 — deploy dev ผ่าน Cloud Build, e2e/preview ตามที่ขอ, ข้ามงานที่ไม่จำเป็น

Status: Review

## Context

- Epic: `docs/epics/e01-foundation-sync.md`
- PRD: NFR-6
- ต่อจาก: E01-S05 (รอบ 1: ข้ามเอกสารล้วน, e2e ใช้ `dist` เดิม, cache Playwright), ADR 0001 (Firebase Hosting)
- ที่มา: โควตา GitHub Actions ของ repo private เต็ม (เจ้าของ 2026-10-11) สั่ง 4 ข้อ:
  (1) ย้าย deploy ไป Google Cloud Build (2) ไม่รัน e2e และ preview ทุก PR (3) reuse artifact / cache เท่าที่ทำได้
  (4) หาวิธีลดนาทีเพิ่ม

## คำอธิบาย

ลดนาที GitHub Actions ที่ใช้ต่อการเปลี่ยนแปลง โดยไม่ลดการตรวจของเดิมที่ต้องมีก่อนขึ้น production

## การตัดสินใจ (ออกแบบ)

| เรื่อง | ตัดสิน | เหตุผล |
|---|---|---|
| deploy dev | Cloud Build trigger ที่ push เข้า `dev` (`cloudbuild.yaml`); `deploy-dev.yml` เหลือ `workflow_dispatch` สำรอง | ใช้โควตา Cloud Build ฟรี 2,500 นาที/เดือน ไม่แตะโควตา GitHub; ตัดงาน build ซ้ำที่เคยเกิดทุก merge |
| e2e บน PR | ไม่รันอัตโนมัติ; รันเมื่อติด label `e2e` (workflow `pr-extras.yml`) และ **รันเสมอหลัง merge เข้า dev/main** | e2e ~150 วิจาก ~5 นาที (ตัวใหญ่สุด) แต่ยังเป็นด่านสุดท้ายก่อนถึงผู้ใช้ dev; PR ที่เสี่ยงติด label ได้ |
| preview บน PR | รันเมื่อติด label `preview` เท่านั้น | preview ต้องผ่าน build + deploy; ส่วนใหญ่ไม่มีใครเปิดดู |
| label อยู่ workflow แยก | `pr-extras.yml` ไม่ใช่ `ci.yml` | การติด label ไม่ไปรัน `changes`/`verify` ซ้ำ |
| Firestore rules tests | บน PR รันเมื่อไฟล์ rules/indexes/firebase.json/ทดสอบ/dependency/ci.yml เปลี่ยน; บน push รันเสมอ | ตัด setup-java + emulator ออกจาก PR ส่วนใหญ่ (`scripts/ci-changes.mjs` ออก `rules=`) |
| PR แบบ draft | ไม่รันอะไรจนกว่าจะ ready for review | ไม่จ่ายนาทีกับงานที่ยังไม่เสร็จ |
| อัปโหลด `dist` | เฉพาะ run ที่มี job e2e (push) | PR ไม่มี e2e ใน ci.yml แล้ว |

## Acceptance criteria

- [x] `scripts/ci-changes.mjs` ออก `rules=true|false` เพิ่ม; อ่าน diff ไม่ได้/ว่าง → `true`; มี unit test เขียนก่อน (แดง 5 → เขียว 14/14)
- [x] `ci.yml`: PR ไม่มี job `e2e`/`preview`; push dev/main ยังรัน `changes → verify → e2e` ครบ
- [x] `ci.yml`: draft PR ถูกข้าม; ประเภท PR = opened, synchronize, reopened, ready_for_review
- [x] `ci.yml`: ขั้น rules tests (JDK, cache emulator, test) รันบน PR เฉพาะ `rules=true`
- [x] `pr-extras.yml`: label `e2e` รัน e2e, label `preview` deploy preview; ทั้งคู่ใช้ install+build ครั้งเดียว; ไม่รันกับ fork/draft; label อื่นไม่ทำอะไร
- [x] `cloudbuild.yaml` + `deploy-dev.yml` เป็น manual + runbook `docs/runbooks/cloud-build-deploy-dev.md`
- [ ] **เจ้าของ:** ตั้ง Cloud Build trigger ตาม runbook และยืนยันการ deploy ครั้งแรก
- [ ] **เจ้าของ:** สร้าง label `e2e` และ `preview` ใน GitHub (ไม่งั้นติดไม่ได้)
- [ ] บันทึกนาที CI ก่อน/หลังจาก run จริง (median 3 รอบ) ใน Dev notes — ทำได้หลัง merge

## Offline / sync behavior

- N/A — CI เท่านั้น ไม่แตะข้อมูล

## Test plan

- [x] unit: `needsRulesTests` (ข้ามโค้ดแอป, รันเมื่อแตะ rules/dependency/workflow, รายการว่างปลอดภัย, ไม่จับ substring)
- [x] parse YAML ทุกไฟล์ที่แก้ได้ (`yaml` ใน node_modules)
- [ ] PR ทดสอบ: ไม่ติด label → เห็นแค่ `changes`+`verify` และไม่มี e2e/preview
- [ ] PR ทดสอบ: ติด `e2e` → `PR extras` รัน e2e; ติด `preview` → ได้ URL; ติดทั้งสอง → build ครั้งเดียว
- [ ] PR draft → ไม่มี run; กด Ready for review → เริ่ม
- [ ] push เข้า dev → `Cloud Build` deploy สำเร็จ; GitHub ไม่มี `Deploy Dev` run

## ต้องให้เจ้าของทำ/อนุมัติ

- อนุมัติ push / เปิด PR ของ story นี้ (ต่อครั้ง)
- ข้อ Cloud Build ใน runbook (สร้าง service account, เชื่อม GitHub, สร้าง trigger) และสร้าง label
- `docs/process.md` บอกว่า PR ทุกอันต้องรัน build, unit test, lint — ยังเป็นจริง (verify รันทุก PR);
  สิ่งที่เปลี่ยนคือ e2e ย้ายไปหลัง merge หรือ label — **เจ้าของต้องยอมรับข้อแลกเปลี่ยนนี้**:
  โค้ดที่ทำ e2e พังอาจเข้า dev ก่อนถูกจับ (ถ้าไม่ได้ติด label) แล้ว CI บน dev จะแดง
- required checks ใน branch protection: ไม่ต้องเพิ่ม `e2e`/`preview` (ถูกข้ามแล้วนับว่าผ่าน) ตามที่ตัดสินไว้ใน E01-S05 D8

## Verification

- [x] Sandbox run: `npx vitest run scripts/` เขียว, YAML parse ผ่าน (ci, pr-extras, deploy-dev, cloudbuild)
- [ ] ยังไม่ได้รันบน GitHub / Cloud Build จริง (ต้อง push + ตั้ง trigger = ขั้นตอนเจ้าของ)
- [ ] Screenshots: N/A (ไม่มี UI)

## Dev notes

ข้อเสนอเพิ่มเติมที่ **ยังไม่ทำ** (ต้องตัดสินใจหรือวัดก่อน):

- เปลี่ยน repo เป็น public → Actions ฟรีไม่จำกัด (ตรวจความลับแล้ว ไม่พบใน tree/ประวัติ; ดูอีเมลสรุป 2026-10-11)
- รวม job `verify` และ `e2e` เป็นหนึ่ง job → ประหยัด `npm ci`+checkout อีกรอบและการปัดนาทีขึ้น แต่ขัดกับ fail-fast ที่ S05 ออกแบบ
- cache Metro/expo สำหรับ `build:web` — ยังไม่วัดว่าได้ผล จึงไม่ใส่
- `Deploy Prod` build ใหม่ทั้งหมด (ไม่แชร์ artifact ข้าม workflow) — รันน้อย ไม่คุ้ม
- ลดเวลา e2e เอง (150 วิ, ตัวใหญ่สุด): shard ไม่ลดนาทีรวม; ลดจำนวนเทสต์/ทำให้เทสต์เร็ว เป็นงานของ story แยก

## Code review

- Reviewer (separate agent/session): subagent `devops-ci-engineer` (ไม่ได้เขียนโค้ดนี้), 2026-10-11 — ไม่มี must-fix, 3 should-fix
- Findings / Resolution:

| # | ระดับ | ประเด็น | ผล |
|---|---|---|---|
| 1 | should-fix | label อื่นที่ไม่เกี่ยว (เช่น `bug`) ยกเลิก run e2e/preview ที่กำลังรัน เพราะ concurrency group เดียวกัน | แก้: label ที่ไม่ใช่ e2e/preview ได้ group แยก (ต่อ run_id) |
| 2 | should-fix | โค้ด PR (npm install scripts, build) รันใน job ที่มี `id-token: write` | แก้: แยก 3 job — `build` และ `e2e` สิทธิ์ `contents: read`; เฉพาะ `preview` มี `id-token` และไม่ติดตั้ง dependency |
| 3 | should-fix | Cloud Build ไม่ยกเลิก build เก่า → dev อาจค้าง commit เก่า | บันทึกใน runbook ("ข้อควรรู้") ยอมรับสำหรับ dev |
| nit | | build รันโดยไม่มีตัวแปร deploy ทั้งที่ขอแค่ preview | แก้: ขั้น `What was asked for` ตัดสินก่อน build |
| nit | | preview ไม่ควรถูกซ่อนเมื่อ e2e แดง | แก้: `preview` เป็น job อิสระ |
| nit | | re-run ใช้ label เก่า | ยอมรับ: ติด/ถอด label แล้วรันใหม่แทนการ re-run |
| nit | | `gcloud config set project` เปลี่ยนค่าเครื่อง | บันทึกใน runbook |

## QA notes
