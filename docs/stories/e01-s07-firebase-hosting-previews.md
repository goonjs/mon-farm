# Story E01-S07: Firebase dev/prod (1 โปรเจกต์) + Hosting deploy + preview channel ต่อ PR

Status: In Progress

## Context

- Epic: `docs/epics/e01-foundation-sync.md`
- PRD: NFR-5, NFR-6 · D-1, D-21, D-22, D-34
- Architecture: "Deployment / environments"; `docs/adr/0001-firebase-hosting.md` (amendment 2: 1 โปรเจกต์บน Blaze)
- ปรับตาม D-34 (2026-10-03)
- ขึ้นกับ: E01-S05

## คำอธิบาย

ต่อ `scripts/deploy.sh` เข้ากับ Firebase Hosting ในโปรเจกต์ Firebase เดียว (D-34): **dev** (site dev + preview ต่อ PR,
Firestore database `dev` + bucket ของ dev, ข้อมูลทดสอบ) และ **prod** (site prod, database `(default)` + bucket หลัก,
ข้อมูลจริง) ตาม ADR 0001

## Acceptance criteria

- [ ] `scripts/deploy.sh dev|prod` deploy `dist/` ไป site ที่ถูกต้อง (`dev` หรือ `prod`) ในโปรเจกต์เดียว; ไม่มี credential → fail closed เหมือนเดิม
- [ ] merge เข้า `dev` → deploy dev อัตโนมัติ; Deploy Prod เรียก `prod` และ merge `main` เฉพาะเมื่อ deploy สำเร็จ
- [ ] ทุก PR ได้ preview channel `pr-<N>` บน site dev, `--expires 7d`, deploy ใหม่ต่ออายุ, ลบเมื่อปิด PR, ลิงก์ comment ใน PR (D-21)
- [ ] build dev/preview ใช้ Firestore database `dev` และ bucket ของ dev เท่านั้น (เลื่อนตาม D-48 — ยังไม่อัปเกรดแผน ยังไม่มี `dev`) — มี test ยืนยันว่า bundle dev/preview อ้างถึงเฉพาะ database `dev` (NFR-5); preview build โดย CI ของ repo เท่านั้น (ความเสี่ยงที่เจ้าของรับแล้ว (2026-10-03): rules แยก build ไม่ได้ ดู D-34)
- [ ] preview รันหลัง e2e เขียวเท่านั้น และข้ามเมื่อแก้เอกสารล้วน (E01-S05)
- [ ] โปรเจกต์เดียวอยู่ asia-southeast3 (กรุงเทพฯ) (database `dev`, `(default)` และ bucket ทั้งสองด้วย) และมี budget alert ตัวเดียวครอบทั้ง dev/prod (D-1, D-34) — บันทึกยืนยันใน Dev notes **— เลื่อนตาม D-48: database `dev`/bucket/budget alert ทำไม่ได้จนกว่าจะอัปเกรดแผน; story ปิดไม่ได้จนกว่าจะสร้าง**

## Offline / sync behavior

- N/A — hosting เท่านั้น (เว็บที่ deploy แล้วยังต้องใช้ออฟไลน์ได้ตาม E01-S03)

## Test plan

- [ ] test สคริปต์: env ไม่ถูกต้อง/ไม่มี secret → exit ≠ 0 โดยไม่ deploy
- [ ] test build config: build dev/preview ใช้ Firestore database `dev` และ bucket ของ dev (ไม่ใช่ `(default)` / bucket หลัก) — เลื่อนตาม D-48 — ยังไม่อัปเกรดแผน; **ระหว่างนี้ build dev/preview ต้องไม่ชี้ Firestore จริงเลย** (ไม่มี `dev` database ให้ชี้ และห้ามชี้ `(default)` ตาม NFR-5) ตอนนี้ยังไม่มีโค้ดแอปที่คุย Firestore จึงไม่มีอะไรต้องชี้
- [ ] รันจริง: เปิด PR → ได้ลิงก์ preview → ปิด PR → channel ถูกลบ

## ต้องให้เจ้าของทำ/อนุมัติ

- ~~สร้างโปรเจกต์ Firebase~~ เจ้าของสร้างแล้ว (1 โปรเจกต์, D-34); ยืนยัน Blaze + budget alert (เลื่อนตาม D-48), region asia-southeast3 (กรุงเทพฯ)
- สร้าง 2 site (`dev`, `prod`) — **ทำแล้ว**; Firestore database `dev` และ bucket ของ dev — **เลื่อนตาม D-48 จนกว่าจะอัปเกรดแผน**; เลือก 2 domain
- สร้าง deploy credential **1 ชุด** (โปรเจกต์เดียว) เก็บเป็น GitHub secret (agent สร้างให้ไม่ได้)
- อนุมัติใช้ `firebase-tools` ใน CI (gate dependency)
- อนุมัติ deploy จริงครั้งแรก (dev) และทุกครั้งที่ Deploy Prod รัน

## Verification

## Dev notes

### 2026-10-09 (overnight, team INFRA)

- มีอยู่แล้วก่อนรอบนี้: job `preview` ใน `ci.yml` (หลัง e2e เขียว, ข้ามเมื่อแก้เอกสารล้วน, `--expires 7d`
  ซึ่ง deploy ซ้ำจะต่ออายุเอง) และ auth แบบ keyless ชุดเดียวกับ `deploy-dev.yml`
- เพิ่ม: comment ลิงก์ preview ใน PR (comment เดียว push ใหม่แก้ comment เดิม — `scripts/preview-comment.mjs`)
  และ `preview-cleanup.yml` ลบ channel `pr-<N>` เมื่อปิด/merge PR ผ่าน `deploy.sh preview-delete`
  (channel ไม่มีอยู่ = สำเร็จ, ไม่ยอมแตะ channel `live`)
- รูปแบบ URL: `https://mon-farm-dev--pr-<N>-<hash>.web.app`
- ยังเปิด: AC database `dev`/bucket/budget alert (D-48); test "bundle อ้างเฉพาะ database `dev`" — ตอนนี้ไม่มีโค้ดแอปที่คุย
  Firestore จึงยังไม่มีอะไรให้ test; การลบ channel ตอนปิด PR ยังไม่ได้รันจริง (ต้องมีการปิด PR)

### Checklist เจ้าของ

ขั้นตอนตั้งค่า Firebase (โปรเจกต์เดียว, D-34) อยู่ที่ `docs/runbooks/firebase-setup.md`

## Code review

- 2026-10-09 independent review (separate agent, read-only): nothing blocking. Fixed: the PR could close while
  CI was deploying, bringing a deleted channel back → the job checks the PR is still open before deploying
  (3726d60); `head -1` after `gh --paginate` → `sed -n 1p`. Not fixed: the comment still shows the old link after
  the PR closes (the channel is gone anyway); a docs-only push does not update the SHA in the comment

## QA notes
