# ADR 0002 — ใช้ bun ใน CI แทน npm หรือไม่ (ผล POC)

- **Status:** Accepted (2026-10-03): คง npm
- **Deciders:** owner (ตัดสิน 2026-10-03, ส่งต่อผ่าน lead session); drafted by the POC agent (role: devops-ci-engineer)
- **Related:** `docs/stories/e01-s05-ci-minutes.md` (AC "ประเมิน bun"),
  `.github/workflows/ci.yml`, `docs/architecture.md` แถว *CI minutes*, PRD NFR-6

## Context

เจ้าของต้องการให้ CI minutes ถูกลง และถามว่า bun ทำ install / build / tsc / test
เร็วกว่า npm "อย่างมีนัยสำคัญ" ไหม โดยต้องไม่ทำให้การ build Android APK พัง

CI วันนี้ (dev @ `ce076b1`) เป็น **job `verify` เดียว** (ยังไม่ได้แยก
`changes → verify → e2e` ตาม E01-S05). เวลาจริงบน `ubuntu-latest` จาก 3 run ล่าสุดที่เขียว
(37087062230, 37087812588, 37088167075):

| step | วินาที |
|---|---|
| setup-node (รวม restore cache npm) | 3–6 |
| **Install (`npm ci`)** | **17–26** (~6% ของ job) |
| typecheck + lint + vitest + jest | 27–39 |
| Build web | 51–79 |
| Playwright install | 26–34 |
| End-to-end | 163–213 |
| **ทั้ง job** | **~5–7 นาที** (e2e + build web ≈ 72–75%) |

ปริมาณงาน (`ci.yml`, 30 วันล่าสุด 2026-09-03…10-03): 70 runs, ~363–376 billed minutes.
แต่ 35 runs ในนั้นมาจาก trigger `push` ทุก branch ที่ถูกแก้ไปแล้ว (run สุดท้าย 2026-10-02).
**อัตราหลังแก้ ≈ 35 runs/เดือน** (20 `pull_request` จาก 14 PR + 10 push dev + 5 push main)

## Options

- **A — อยู่กับ npm** แล้วเก็บนาทีจากข้ออื่นใน E01-S05 (ข้าม docs-only, e2e ใช้ `dist/` เดิม,
  cache Playwright)
- **B — bun เป็น installer, Node เป็น runtime** (`bun install` แทน `npm ci`; สคริปต์ยังเป็น `npm run`)
  - B1: ไม่ commit `bun.lock`; bun migrate จาก `package-lock.json` ทุก run
  - B2: commit `bun.lock` แทน `package-lock.json`
- **C — B + `bun run` เป็น script runner**; แบบ `bun --bun` ให้ bun เป็น runtime แทน Node ด้วย
- (ข้อมูลประกอบ) **`bun test`** แทน vitest/jest — คนละ test runner

## Measurements

**วิธีวัด:** sandbox 4 vCPU / 15 GB (สเปกเดียวกับ `ubuntu-latest`), commit `ce076b1`,
Node 22.22.0, npm 10.9.4, **bun 1.3.14 (+0d9b296af)**. รันในสำเนาของ repo ใน scratchpad,
cache dir แยกต่อเครื่องมือ, median ของ 3 รอบ; *cold* = ไม่มี `node_modules` และไม่มี cache,
*warm* = มี download cache แต่ไม่มี `node_modules` (แบบที่ `setup-node cache: npm` restore ให้);
สคริปต์ใช้ `TMPDIR` ใหม่ทุกรอบเพื่อให้ cache ของ Metro/jest เย็นแบบ runner ใหม่.
**ที่มาของ bun:** ติดมากับ image ของ sandbox ที่ `~/.bun/bin/bun` (ไฟล์ลงวันที่ 2026-05-12);
ตัวติดตั้งทางการ `https://bun.sh/install` ถูก network policy ปฏิเสธ (403) จึงไม่ได้ติดตั้งอะไร
และไม่มีอะไรลงใน repo. raw logs: scratchpad ของ session นี้ (`logs/SUMMARY.txt`)

### Install (วินาที, median และ 3 รอบ)

วัดสองชุด (batch) ห่างกัน ~30 นาที; เทียบได้ตรงที่สุดคือภายในชุดเดียวกัน

| batch | npm | bun |
|---|---|---|
| 1 cold | `npm ci --no-audit --no-fund` **18.91** (20.76 / 18.91 / 18.34) | migrate (B1) **8.94** (4.79 / 9.74 / 8.94) |
| 1 warm | `npm ci --no-audit --no-fund` **15.34** (14.05 / 15.34 / 16.54) | มี `bun.lock` (B2) **3.14** (1.19 / 3.16 / 3.14) |
| 2 warm | `npm ci` ธรรมดาแบบ CI **18.58** (21.92 / 18.09 / 18.58); `--prefer-offline --no-audit --no-fund` 16.81 (14.17 / 17.17 / 16.81) | migrate (B1) 1.68 (2.80 / 1.32 / 1.68) |

noise ระหว่าง batch ~1.5–3 s ใกล้กับผลของการปรับ flag ของ npm (−1.8 s) → **พิสูจน์ไม่ได้ว่าช่วย**

**cache ของ bun ไม่คุ้มใน CI:** 793 MB / 46,883 ไฟล์ เทียบกับ npm 296 MB / 2,828 ไฟล์;
`tar -xzf` (ตัวแทนคร่าว ๆ ของ `actions/cache` ซึ่งจริง ๆ ใช้ zstd) ใช้ **16.86 s** เทียบกับ
npm **2.30 s** → ทางที่คุ้มคือ **bun cold ไม่ใช้ cache (~9 s)**

### Scripts (วินาที, median 3 รอบ, exit 0 ทุกครั้งเว้นแต่ระบุ)

| script | `npm run` tree npm | `npm run` tree bun | `bun run` tree bun | `bun --bun run` tree bun |
|---|---|---|---|---|
| tokens:check | 0.25 | 0.24 | 0.10 | 0.04 |
| contrast | 0.23 | 0.24 | 0.09 | 0.02 |
| typecheck (tsc) | 4.55 | 4.45 | 4.27 | 4.47 |
| lint (eslint) | 7.85 | 7.64 | 7.49 | 7.47 |
| test:core (vitest) | 2.84 | 2.87 | 2.61 | 1.70 |
| test:ui (jest-expo) | 10.50 | 10.54 | 10.54 | **พัง**¹ |
| build:web (expo export) | 34.60 | 34.84 | 34.62 | **พัง**² |
| **รวม** | **60.82** | **60.82** | **59.72** | — |

¹ 16/16 suites fail (`Attempted to assign to readonly property` ใน `stack-utils`);
² Metro สร้าง transformer ไม่ได้ — ทั้งสองจาก 1 รอบ (warm-up) ไม่ได้รันซ้ำ 3 รอบ

- `bun run` ยังรัน tsc / eslint / jest / Metro **บน Node**; ต่างจาก `npm run` แค่เวลา start
  ของ npm (~0.15 s ต่อสคริปต์ ≈ 1.1 s ต่อ job). typecheck ไม่ได้เร็วขึ้นในทุกแบบ
- `bun --bun` ใช้กับ jest-expo และ `expo export` ไม่ได้ → C แบบ runtime ไม่ valid สำหรับ repo นี้
- `bun test` (ข้อมูลเท่านั้น): core 148 pass / 16 fail / 1 error; UI 0 pass / 15 fail → ไม่แนะนำ
- e2e: รันด้วย scratch config ที่ชี้ไป Chromium ที่ติดมากับ sandbox (Playwright 1.62 ต้องการ
  build 1234 แต่มี 1194 และห้ามรัน `playwright install`): `dist/` จาก tree npm / tree bun (B2) /
  tree bun (B1) → **144 passed, 6 skipped ทั้งสาม** (~95 s)

### ส่วนที่ต่างกันต่อ job (ไม่รวม e2e ที่เท่ากัน)

| | install | scripts | รวม |
|---|---|---|---|
| A (npm, batch 1 warm) | 15.34 | 60.82 | 76.16 |
| B1 (bun cold ไม่ cache, batch 1) | 8.94 | 60.82 | 69.76 (**−6.4 s**) |
| C (B1 + `bun run`) | 8.94 | 59.72 | 68.66 (−7.5 s) |

ถ้าเทียบกับ `npm ci` ธรรมดาของ batch 2 (18.58) จะได้ −9.6 s → **ช่วงที่ประหยัดต่อ install
≈ 6–10 s** (ยังไม่หักเวลาโหลด `setup-bun` ซึ่งไม่ได้วัด และยังไม่บวก 3–6 s ของ
restore cache npm ที่ไม่ต้องใช้)

### ประมาณการนาที CI (อัตรา ~35 runs/เดือน)

- **ต่อเดือน:** 35 × 6–10 s ≈ **4–6 นาที/เดือน** (≈ 2–3% ของ ~180 billed นาทีที่อัตรานี้)
- หลังแยก job ตาม E01-S05 (verify และ e2e install เองทั้งคู่): ≈ **7–12 นาที/เดือน**
- **ต่อ PR** (`pull_request` + push dev): ≈ 12–20 s
- GitHub ปัดแต่ละ job ขึ้นเป็นนาทีเต็ม (ตาม GitHub billing docs; วันนี้เปิด docs.github.com จาก
  sandbox ไม่ได้ จึงไม่ได้ยืนยันซ้ำ) → ประหยัดไม่กี่วินาทีจะลดนาทีที่จ่ายได้เฉพาะเมื่อข้ามเส้นนาที
- **ทุกตัวเลขมาจาก sandbox ไม่ได้วัดบน GitHub runner จริง** (AC ของ E01-S05 ระบุ "บน runner";
  ต้องเปิด PR ทดสอบซึ่งต้องขออนุมัติ push — ดูคำถามข้อ 2)

## ความเข้ากันได้ของ Android / EAS

**หมายเหตุ:** repo ยังไม่มี `eas.json` และไม่มี workflow build APK — ยังไม่มีอะไรที่ build APK อยู่

### พิสูจน์โดยการรันจริง (sandbox; เทียบ tree npm, tree bun แบบมี `bun.lock` (B2) และแบบ migrate (B1))

| ตรวจ | ผล |
|---|---|
| bun อ่าน `package-lock.json` | ได้ — migrate แล้ว **เขียน `bun.lock` ทั้งที่ใช้ `--frozen-lockfile`** ("Saved lockfile") |
| ชุด package | **`name@version` เหมือน npm ทุกตัว (1,029) ทั้ง B1 และ B2** |
| การวาง (hoisting) | ต่างจาก npm: path ที่ติดตั้ง npm 1,126 / B2 1,154 / B1 1,181 (B1 vs B2 ต่าง 27 บรรทัด) เช่น `@expo/cli` อยู่ root ใน bun แต่อยู่ใต้ `expo/node_modules` ใน npm |
| postinstall | npm รัน `esbuild` + `unrs-resolver`; bun รัน `esbuild` (อยู่ใน default trusted list ของ bun³) แต่ **บล็อก `unrs-resolver`** (`napi-postinstall`) — binding linux-x64 มาทาง optional deps อยู่แล้ว lint จึงผ่าน; patch-package ไม่ได้ใช้ใน repo นี้ |
| สคริปต์ทั้ง 7 ตัวบน tree B1 | ผ่าน (1 รอบ, เวลาใกล้เคียงตารางข้างบน) |
| `expo prebuild --platform android --no-install` | ผ่านทั้ง tree npm และ B2 (scratch copy, ไม่ได้ commit `android/`) |
| สิ่งที่ Gradle จะหาเจอ | replay คำสั่ง `node --print require.resolve(...)` + `expo-modules-autolinking` ที่ไฟล์ Gradle ที่สร้างขึ้นเรียก: **Expo modules 22 ตัว + RN native libs 7 ตัว เหมือนกันทั้งสาม tree**; ต่างแค่ path ของ `@expo/cli` (เวอร์ชันเดียวกัน 57.0.13) และ `hermesc` เป็น `rwxrwxrwx` ใน bun (npm `rwxr-xr-x`) |
| `expo export --platform android` (Hermes) | ผ่านทั้งสาม; `.hbc` magic `c6 1f bc 03…`; ขนาด npm 4,066,283 / B2 4,066,284 / B1 4,066,283 B (B1 วัดด้วย `wc -c` ระหว่างรัน ไม่ได้เก็บไฟล์) — **ไม่ byte-identical** (ต่าง 1 B ใน B2) แม้ชื่อ entry hash เดียวกัน |
| `expo export --platform web` | ผ่านทั้งสาม; bundle 1,241 modules เท่ากัน แต่ 12 จาก 40 ไฟล์ต่าง (ลำดับ/ID ของ module, +396 B ใน B2) |
| bundledNativeModules check | `EXPO_OFFLINE=1 expo install --check` → "up to date" แต่ log บอกเองว่า "unreliable in offline-mode" (สัญญาณอ่อน); prebuild เตือน `react-native@0.86.2 instead of recommended 0.86.0` เหมือนกันทั้งสอง tree |
| `expo-doctor` | **ไม่ได้รัน** — ต้องดาวน์โหลด package นอก lockfile (ติด gate การติดตั้ง) |
| Gradle `assembleRelease` | **ไม่ได้รัน** — sandbox ไม่มี Android SDK |

### จากเอกสาร (ดึงเมื่อ 2026-10-03)

- Expo, *Using Bun* — https://docs.expo.dev/guides/using-bun/ : EAS เลือก package manager
  **จาก lockfile** (`bun.lock`/`bun.lockb` → bun; "delete any lockfiles generated by other package
  managers"); pin เวอร์ชันด้วย `"bun"` ใน `eas.json`; postinstall ต้องอยู่ใน `trustedDependencies`
- Expo, *Build server infrastructure* — https://docs.expo.dev/build-reference/infrastructure/ :
  Android image `ubuntu-2604-resolute-amd64-v20260911` มี Bun 1.4.2, Node 22.23.2; image ก่อนหน้า
  (`…-v20260624`) มี Bun 1.3.14 (ตัวเดียวกับที่ทดสอบ). ผู้รีวิวเห็น excerpt จาก search ที่ไม่มี
  1.4.2 — ควรเปิดหน้าจริงดูอีกครั้งถ้าจะ pin เวอร์ชัน
- Bun, *bun install* — https://bun.com/docs/pm/cli/install : `bun ci` = `--frozen-lockfile` และ
  "you must commit `bun.lock`"; ใน GitHub Actions ใช้ `oven-sh/setup-bun@v2`
- ³ Bun, *trusted dependencies* — https://bun.com/docs/guides/install/trusted : bun ไม่รัน lifecycle
  script ของ dependency ยกเว้น default allowlist หรือที่อยู่ใน `trustedDependencies`
- React Native docs: ไม่พบหัวข้อเรื่อง bun

**สรุป Android (จากเอกสาร ไม่ใช่การรัน):** B1 ไม่ commit `bun.lock` → ตามเอกสาร EAS จะยังใช้
npm. B2 ทำให้ EAS ใช้ bun — prebuild/autolinking/Hermes ที่ทดสอบผ่าน แต่ **ยังไม่เคย build APK จริง**

## Risks

1. **ได้น้อย:** 6–10 s ต่อ install ขณะที่ e2e + build web ≈ 72–75% ของ job
2. **CI ตรวจคนละ artifact กับที่ ship (B1):** CI จะทดสอบ tree ที่ bun วาง ขณะที่ `deploy-prod.yml`
   ยัง `npm ci` + `build:web`; web bundle ที่วัดต่างกัน 12/40 ไฟล์
3. **lockfile / reproducibility:** B1 พึ่งการ migrate ทุก run และ `--frozen-lockfile` ยังเขียน
   lockfile — การันตีแบบ frozen ไม่ได้; `bun ci` ตามเอกสารต้อง commit `bun.lock` (B2)
4. **hoisting ต่างจาก npm** — วันนี้ทุกอย่างผ่าน แต่ dependency ใหม่อาจพึ่ง layout ของ npm
5. **postinstall ถูกบล็อกเงียบ ๆ** — ต้องดูแล `trustedDependencies` (วันนี้: `unrs-resolver`)
6. **toolchain เพิ่ม** (`setup-bun`, pin เวอร์ชัน) และ `hermesc` เป็น world-writable ใน bun
7. Playwright browsers ไม่เกี่ยวกับ installer — ยังต้องติดตั้ง/cache แยกเหมือนเดิม

## Recommendation

**ไม่แนะนำให้เปลี่ยนเป็น bun ตอนนี้ (No) — เลือก A**

- เร็วกว่าอย่างมีนัยสำคัญ **เฉพาะขั้น install** (~15–19 s → ~9 s); tsc / lint / test / build
  **ไม่เร็วขึ้น** และ `bun --bun` ทำให้ jest-expo กับ Metro พัง
- ประหยัดได้ราว **4–6 นาที/เดือน** (7–12 หลังแยก job) — ไม่คุ้มกับ toolchain เพิ่ม,
  ความเสี่ยงเรื่อง lockfile และการที่ CI ตรวจคนละ tree กับที่ deploy
- นาทีก้อนใหญ่อยู่ที่ข้ออื่นของ E01-S05: ข้าม run ที่แก้เอกสารล้วน (~5–7 นาทีต่อ run),
  e2e ใช้ `dist/` เดิม (ไม่ build ซ้ำ 51–79 s), cache Playwright (26–34 s)
- **ทบทวนใหม่** เมื่อ PR ต่อเดือนเพิ่มหลายเท่า หรือหลัง E01-S05 แล้ว install กลายเป็นสัดส่วนใหญ่ของ job

## Decision (2026-10-03)

เจ้าของตัดสิน: **"ไม่ใช้ bun คง npm"** — เลือก **A**. เจ้าของรับผล POC จาก sandbox เป็นหลักฐานพอ
สำหรับปิด AC "ประเมิน bun" ของ E01-S05 (ไม่ต้องเปิด PR ทดสอบบน runner). ไม่มีการเปลี่ยน
`package.json`, lockfile หรือ `ci.yml`; ถ้าจะทบทวนใหม่ให้เป็น story แยก

## Consequences

- เลือก A: repo ไม่เปลี่ยนนอกจาก ADR นี้; AC "ประเมิน bun" ของ E01-S05 ปิดได้ด้วย ADR นี้
  (ถ้าเจ้าของรับตัวเลขจาก sandbox แทนการวัดบน runner)
- เลือก B1 ภายหลัง: story แยก ผ่าน gate dependency (`oven-sh/setup-bun`, pin เวอร์ชัน,
  `trustedDependencies`) + PR ทดสอบวัดบน runner จริง; ควรให้ deploy ใช้ installer เดียวกับ CI
- เลือก B2: เหมือน B1 + ลบ `package-lock.json` (ต้องอนุมัติการลบ), สร้าง `eas.json` และ pin
  `"bun"`, และต้อง build APK จริงบน EAS ให้ผ่านก่อน Done

## สิ่งที่เจ้าของต้องตัดสิน

1. **จะใช้ bun ใน CI ไหม?**
   - (ก) **ไม่ — อยู่กับ npm แล้วทำข้ออื่นใน E01-S05 ก่อน** *(แนะนำ)*
   - (ข) bun เป็น installer ใน CI อย่างเดียว ไม่ commit `bun.lock` (B1; ~4–6 นาที/เดือน)
   - (ค) เปลี่ยนทั้ง repo เป็น `bun.lock` (B2; กระทบ EAS/APK)
2. **ตัวเลขจาก sandbox พอสำหรับปิด AC "ประเมิน bun" ไหม?**
   - พอ — ปิด AC ด้วย ADR นี้ *(แนะนำถ้าเลือก ก)*
   - ไม่พอ — อนุญาตเปิด PR ทดสอบ 1 ครั้งเพื่อวัดบน runner จริง *(แนะนำถ้าเลือก ข/ค)*
