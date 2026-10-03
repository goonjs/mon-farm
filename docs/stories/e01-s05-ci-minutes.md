# Story E01-S05: CI ประหยัดนาที — ข้ามเอกสารล้วน, cache, e2e ใช้ dist เดิม, ประเมิน bun

Status: In Progress

## Context

- Epic: `docs/epics/e01-foundation-sync.md`
- PRD: NFR-6
- Architecture: "2026-10-02 — Direction" แถว *CI minutes*; `.github/workflows/ci.yml` (ตอนนี้เป็น job `verify` เดียว)
- ขึ้นกับ: —

## คำอธิบาย

แยก CI เป็น `changes → verify → e2e` ให้ fail-fast และไม่เปลืองนาที
พร้อมประเมินว่า bun เป็นตัวติดตั้งใน CI คุ้มไหม (ประเมินเท่านั้น ไม่เปลี่ยนจริง)

## Acceptance criteria

- [ ] job `changes` ราคาถูก: PR ที่แก้เฉพาะเอกสาร (`docs/**`, `*.md`) ข้าม verify/e2e แต่ check ที่บังคับยังผ่าน (ไม่ขวาง merge) (NFR-6)
- [ ] ลำดับ `changes → verify → e2e` ทีละขั้น, ขั้นแรกแดง → ขั้นต่อไปไม่รัน, ทุก job มี `timeout-minutes`
- [ ] e2e ใช้ `dist/` ที่ verify build ไว้ (artifact) ไม่ build ซ้ำ
- [ ] cache Playwright browsers ตามเวอร์ชันใน lockfile; รอบที่ cache hit ไม่ดาวน์โหลดใหม่
- [ ] trigger ยังเป็น `push: [dev, main]` + `pull_request` (PR รันครั้งเดียว; merge เข้า dev/main ตรวจซ้ำ)
- [x] ประเมิน bun: เทียบเวลา install กับ `npm ci` บน runner, ตรวจ dependency tree + `trustedDependencies`, เขียนข้อเสนอใน Dev notes — ปิดโดย ADR 0002 — เจ้าของเลือกคง npm (2026-10-03)
- [ ] บันทึกนาที CI ก่อน/หลัง (median 3 รอบ) ใน Dev notes

## Offline / sync behavior

- N/A — CI เท่านั้น ไม่แตะข้อมูล

## Test plan

- [ ] PR ทดสอบที่แก้เอกสารล้วน → verify/e2e ถูกข้าม, check เขียว
- [ ] PR ที่แก้โค้ด → ครบทุก job; ทำให้ typecheck แดงโดยตั้งใจ → e2e ไม่รัน
- [ ] รันครั้งที่ 2 → log แสดง Playwright cache hit

## ต้องให้เจ้าของทำ/อนุมัติ

- อนุมัติ push ของ PR ทดสอบแต่ละครั้ง
- ปรับ branch protection (required checks) ให้ตรงชื่อ job ใหม่ — เป็นการตั้งค่าบัญชี เจ้าของทำ
- ถ้าจะเปลี่ยนไปใช้ bun จริง: เป็นการเปลี่ยนตัวติดตั้ง → ผ่าน gate dependency แยก story

## Verification

## Dev notes

### DoD ของ story นี้ (เขียนก่อนเริ่ม)

- [ ] `scripts/ci-changes.mjs` (แยกไฟล์เอกสารล้วน/โค้ด) มี unit test เขียนก่อนและเห็นแดงก่อนเขียวใน vitest
- [ ] `ci.yml` เป็น `changes → verify → e2e`, ทุก job มี `timeout-minutes`, e2e ใช้ `dist` artifact, cache Playwright ตามเวอร์ชันใน lockfile — ตรวจ YAML และรันตรรกะ `changes` จริงใน sandbox กับ diff เอกสารล้วน/โค้ด/ช่วง commit ที่อ่านไม่ได้
- [ ] typecheck + lint + test:core ผ่านใน sandbox
- [ ] PR นี้ CI เขียวครบ 3 job; บันทึกนาทีก่อน/หลัง (median 3 รอบ) และผลประเมิน bun ด้านล่าง
- [ ] reviewer อิสระ (subagent แยก) ตรวจตาม `code-review-checklist.md` แล้ว findings แก้หรือเลื่อนพร้อมเหตุผลใน "Code review"

### นาที CI ก่อนเปลี่ยน (job `verify` เดียว)

วัดจาก run บน GitHub (wall-clock ของ job; นาทีที่คิดเงินปัดขึ้นต่อ job):

| run | ประเภท | เวลา |
|---|---|---|
| #87 | PR เอกสารล้วน | 5.3 นาที (job) |
| #85 | PR เอกสารล้วน | 5.4 นาที |
| #82 | PR เอกสารล้วน | 3.6 นาที |

median PR เอกสารล้วน = **5.3 นาที → คิดเงิน 6 นาที/รอบ** ทั้งที่ไม่มีโค้ดเปลี่ยน
แยกขั้นใน #87: `npm ci` 22 วิ, build web 75 วิ, ติดตั้ง Playwright 26 วิ, e2e 150 วิ

### สิ่งที่ทำ

- `scripts/ci-changes.mjs` + test (เห็นแดงก่อน: module ยังไม่มี → เขียว 6/6)
  - เอกสารล้วน = ทุกไฟล์อยู่ใต้ `docs/` หรือลงท้าย `.md` **ยกเว้น** `docs/ux/tokens.css`
    (ไฟล์ generate ที่ `tokens:check` ตรวจ จึงนับเป็นโค้ด)
  - อ่าน diff ไม่ได้ / base เป็นศูนย์ (push ครั้งแรก) / diff ว่าง → `code=true` (ปลอดภัยไว้ก่อน)
- `ci.yml`: `changes` (ไม่ติดตั้งอะไร, ตรวจ Conventional Commits + แยกไฟล์, 5 นาที)
  → `verify` (เฉพาะ `code == 'true'`, ถึง build + อัปโหลด `dist` เก็บ 1 วัน, 15 นาที)
  → `e2e` (ดาวน์โหลด `dist`, cache `~/.cache/ms-playwright` ตามเวอร์ชัน `@playwright/test` ที่ติดตั้งจาก lockfile;
  cache hit → ติดแค่ system deps, 15 นาที)
- รันจริงใน sandbox: ช่วง `92df3d1...99f90d0` (เอกสารล้วน) → `code=false`; `adf4b9d~1...adf4b9d` → `code=true`;
  base ศูนย์ → `code=true`; ไม่มี argument → `code=true`. typecheck, lint ทั้ง repo, test:core 120/120 ผ่าน
- ข้อแลกเปลี่ยน: PR ที่แก้โค้ดจ่าย `npm ci` เพิ่มอีกครั้งใน e2e (~22 วิ) และการปัดนาทีขึ้นต่อ job (3 job)
  เพื่อแลกกับ fail-fast และ PR เอกสารล้วนที่ลดจาก ~6 เหลือ ~1 นาทีที่คิดเงิน

### ต้องให้เจ้าของทำ (branch protection)

ถ้าตั้ง required checks: ต้องใส่ **`changes`** ด้วย ไม่ใช่แค่ `verify`/`e2e` —
ถ้า `changes` แดง (commit lint ผิด) `verify`/`e2e` จะเป็น "skipped" ซึ่ง GitHub นับว่าผ่าน

### ประเมิน bun (ประเมินเท่านั้น)

- dependency ที่มี install script ใน lockfile มีแค่ `esbuild` 0.28.2, `unrs-resolver` 1.12.2
  (และ `fsevents` แบบ optional เฉพาะ macOS) — bun ไม่รัน lifecycle script ของ dependency
  นอกจากอยู่ใน `trustedDependencies` (หรือรายการ default ของ bun); `esbuild` น่าจะอยู่ในรายการ default
  (ต้องยืนยันตอนวัดจริง) จึงน่าจะต้องเพิ่มแค่ `unrs-resolver`
- เวลาที่ได้คืนสูงสุดคือ `npm ci` ~22 วิ/job (cache npm ทำงานแล้ว) ≈ ไม่ถึง 1 นาทีต่อ PR
  ขณะที่ต้องเพิ่ม action ภายนอก (`oven-sh/setup-bun`) + lockfile ใหม่ (`bun.lock`) ซึ่งเป็นการเปลี่ยนตัวติดตั้งที่ต้องผ่าน gate dependency
  และ Expo CLI/Metro ยังอ้าง npm เป็นหลัก
- ยังไม่ได้วัดบน runner จริง (ต้องติดตั้ง bun = ต้องขออนุมัติ) — **ข้อเสนอ: ยังไม่เปลี่ยน**;
  ถ้าต้องการตัวเลขจริง เปิด story แยกพร้อมขอ dependency gate
- **ส่วนต่างจาก AC:** ไม่ได้วัดเวลา install ของ bun บน runner ใน story นี้ — เจ้าของตัดสิน 2026-10-03
  ให้คง npm และปิดเรื่อง bun ด้วย ADR 0002 (POC bun ทำใน session อื่น)

### หลัง review รอบ 1

- เพิ่ม `--no-renames` และ `core.quotePath=false` ใน `git diff` (test แดงก่อน → เขียว 9/9);
  รันจริง `c0cf2ab~1...c0cf2ab` (ย้าย `src/app/settlement.tsx`) แสดงทั้ง path เก่าและใหม่
- `cancel-in-progress` เฉพาะ `pull_request` — run บน dev/main ต้องรันจนจบ
- build web จริงใน sandbox: `dist/` มีไฟล์ซ่อน `_expo/.routes.json` → ตั้ง `include-hidden-files: true`
- e2e ใน sandbox รันไม่ได้: Chromium ใน sandbox เป็น build 1194 แต่ `@playwright/test` 1.62.1 ต้องการ 1234
  (ดาวน์โหลด browser = ติดตั้ง ต้องขออนุมัติ) → e2e จริงพิสูจน์บน CI
- ข้อจำกัด cache Playwright: hit ยังรัน `install-deps` (apt) จึงประหยัดแค่ส่วนดาวน์โหลด browser (~10–15 วิ);
  cache บันทึกเฉพาะ job ที่ผ่าน และ cache ของ PR ใช้ได้เฉพาะ PR นั้น/branch ฐาน — จะยืนยันด้วยตัวเลขรอบหลัง


## Code review

รอบ 1 — subagent `devops-ci-engineer` แยก (ไม่ได้เขียนโค้ดนี้), 2026-10-02: approve with 2 should-fix

| # | ระดับ | ประเด็น | ผล |
|---|---|---|---|
| 1 | should-fix | `cancel-in-progress` บน push: run โค้ดที่ถูกยกเลิก + merge เอกสารตามมา → โค้ดไม่ถูกตรวจ | แก้: ยกเลิกเฉพาะ PR |
| 2 | should-fix | `git diff` ตรวจ rename → `git mv src/x.ts docs/x.md` ดูเหมือนเอกสารล้วน | แก้: `--no-renames` + test |
| 3 | nit | path ภาษาไทยถูก quote → ไม่ถูกนับเป็นเอกสาร (ทางปลอดภัย) | แก้: `core.quotePath=false` |
| 4 | nit | cache Playwright ประหยัดน้อยกว่าที่คิด (apt ยังรัน) | บันทึกใน Dev notes; วัดจริงรอบหลัง |
| 5 | nit | artifact ตัดไฟล์ซ่อน | แก้: พบ `_expo/.routes.json` จริง → `include-hidden-files: true` |
| 6 | nit | median ก่อนเปลี่ยนผิด (5.3 ไม่ใช่ 5.4); ควรมี baseline PR โค้ด | แก้ median; baseline PR โค้ด: #78/#77/#74 = 5.4/5.4/5.4 นาที |
| 7 | nit | bun: `esbuild` น่าจะอยู่ใน default trusted | แก้ข้อความ (รอยืนยันตอนวัดจริง) |
| 8 | nit | CLI/git path ทดสอบด้วยมือ | `diffArgs` แยกออกมาและมี test; การเรียก git จริงคงเป็น sandbox run (KISS) |

## QA notes
