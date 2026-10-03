# ADR 0003 — ทางสร้าง APK Android (EAS Build, GitHub Actions, เครื่องตัวเอง หรือ Capacitor)

- **Status:** Accepted (owner, 2026-10-03) — ทาง **B: GitHub Actions + Gradle**
- **Deciders:** owner; drafted by a research agent for the lead agent, 2026-10-03
- **Related:** `docs/stories/e01-s06-android-dev-client.md`, `docs/architecture.md`
  (Tech stack, "Rejected", "Open and undecided" ข้อ 1), PRD NFR-1, NFR-2, NFR-6,
  ADR 0001

## Context

E01-S06 ต้องการ APK ตัวแรกบนโทรศัพท์ Android ของเจ้าของ แอปเขียนด้วย Expo
(React Native) ยังไม่เคย build เป็นแอป Android เลย เจ้าของถามว่า ทำไมต้องมี
บัญชี Expo, EAS Build คืออะไร, มีทางฟรีไหม และใช้ Capacitor ได้ไหม (agent ของ
อีกโปรเจกต์ finance-app เสนอ Capacitor) ขอเทียบ **ราคา · ความสามารถ · ความยาก**

ปริมาณที่คาดไว้ช่วง MVP: **4–10 APK ต่อเดือน** repo นี้เป็น **private**
นาที GitHub Actions เป็นงบประมาณ (NFR-6)

### EAS Build คืออะไร / ทำไมต้องมีบัญชี Expo

การทำ APK คือการ "คอมไพล์" โค้ดของเราด้วยเครื่องมือของ Android (Android SDK,
Java, Gradle) ซึ่งหนักและติดตั้งยาก **EAS Build คือบริการของบริษัท Expo ที่รับ
โค้ดไป build บนเครื่องของเขาให้** แล้วส่งไฟล์ APK กลับมาเป็นลิงก์ดาวน์โหลด
บัญชี Expo จำเป็นเพราะเป็นบริการบนเซิร์ฟเวอร์ของเขา: ต้องรู้ว่าใครสั่ง build,
นับโควตาฟรีต่อเดือน, และเก็บ **กุญแจเซ็นแอป (keystore)** ไว้ให้ — กุญแจนี้ต้อง
เป็นตัวเดิมทุกครั้ง ไม่อย่างนั้นโทรศัพท์จะไม่ยอมอัปเดตทับแอปเดิม
**EAS ไม่ใช่ทางเดียว** — Expo ออกแบบให้ build เองได้ด้วยคำสั่งมาตรฐานของ
Android (ทาง B, C ด้านล่าง) โดยไม่ต้องมีบัญชีเลย

## Options considered

ราคาทั้งหมดเป็น USD ตามหน้าทางการ ดึงข้อมูล 2026-10-03 (ดู Sources)

### A. EAS Build (cloud ของ Expo)

- **ฟรี $0:** 15 Android + 15 iOS build/เดือน, คิวความสำคัญต่ำ (ช่วงคนใช้เยอะ
  อาจรอ **90+ นาที**), build ได้นานสุด 45 นาที, ทีละ 1 งาน. ใช้โควตาหมดแล้ว
  **ไม่มีการเก็บเงินเพิ่ม** แค่ build ไม่ได้จนต้นเดือนหน้า. build ที่ล้มภายใน 3
  นาทีไม่นับโควตา (สูงสุด 10 ครั้ง/เดือน)
- **Starter $19/เดือน:** เครดิต build $45, คิวเร็ว, timeout 2 ชม.;
  เกินเครดิต Android = $1/build (medium) หรือ $2 (large)
- ได้: เก็บ keystore ให้, `eas build --profile preview` ได้ APK พร้อมลิงก์/QR
  ติดตั้ง, ไม่ต้องมี Android SDK ที่ไหนเลย
- **EAS Update** (อัปเดตโค้ด JS ทางอากาศโดยไม่ต้องลง APK ใหม่) รวมอยู่ทุกแผน —
  ฟรีถึง 1,000 ผู้ใช้ที่ใช้งานต่อเดือน (MAU) (เกินไม่ได้บนแผนฟรี) เป็นบริการแยกที่เลือกใช้ทีหลังได้
- ต้องติดตั้ง `eas-cli` (ผ่าน dependency gate) และสร้างบัญชี Expo

### B. GitHub Actions + `expo prebuild` + Gradle `assembleRelease` (ไม่ต้องมีบัญชี Expo)

- runner `ubuntu-24.04` ของ GitHub **มี Android SDK, NDK และ Java ติดตั้งมาแล้ว**
  (`ANDROID_HOME` ตั้งไว้) ไม่ต้องติดตั้งอะไรเพิ่ม
- ขั้นตอน: `npx expo prebuild --platform android` → `./gradlew assembleRelease`
  → อัปโหลด APK เป็น artifact (ไฟล์แนบของรอบ build) ให้ดาวน์โหลด (หรือแนบ GitHub Release)
- **เวลา:** ประมาณ **20–40 นาที/build** (ตัวเลขจาก README ของ `rn-build-cache`
  ซึ่งเป็นแหล่งรอง ไม่ได้ระบุสเปกเครื่อง — สมมติว่าใกล้เคียงกับ runner 2-core
  มาตรฐาน; ยังไม่เคยวัดใน repo นี้; cache Gradle ช่วยลดได้)
- **ราคา:** repo private ใช้นาทีฟรีของบัญชี (GitHub Free = 2,000 นาที/เดือน
  แชร์ทุก repo private ของเจ้าของ). 4–10 build × 20–40 นาที = 80–400 นาที/เดือน.
  ถ้าโควตาถูก CI อื่นใช้หมดแล้ว Linux 2-core = **$0.006/นาที** → 400 นาที ≈ $2.40
- รันแบบ **กดปุ่มสั่งเองใน GitHub (`workflow_dispatch`) เท่านั้น** ไม่ผูกกับทุก PR — ไม่งั้น
  นาทีหมดเร็ว
- **keystore:** สร้างครั้งเดียวด้วย `keytool` เก็บเป็น GitHub secret (base64 +
  รหัสผ่าน) — เจ้าของต้องสร้าง/เก็บสำรองเอง (agent ไม่ควรถือกุญแจ).
  **ต้องเซ็นด้วย keystore จริงตั้งแต่ APK แรก:** ค่าเริ่มต้นของ `prebuild` เซ็น
  release ด้วย debug key ของ template ซึ่งเป็นกุญแจสาธารณะ (ใครก็รู้รหัส) และถ้า
  เปลี่ยนไปใช้กุญแจจริงทีหลัง โทรศัพท์จะไม่ยอมอัปเดตทับ ต้องถอนแอปก่อน =
  **ข้อมูลในเครื่อง (SQLite) ที่ยังไม่ซิงก์หายหมด** ซึ่งขัดกับ NFR-2
- เพราะ `android/` ถูกสร้างใหม่ทุกรอบ (ไม่ commit) workflow ต้อง **ใส่ค่าการเซ็น
  ทุกครั้ง** — ส่งผ่าน Gradle property `-Pandroid.injected.signing.*` ตอนรัน
  `assembleRelease` หรือเขียน config plugin เล็ก ๆ (นับรวมในความยาก "ปานกลาง")
- **ที่เก็บไฟล์:** GitHub Free ให้พื้นที่ artifact 500 MB (เก็บ 90 วันโดยค่าเริ่มต้น)
  APK ละหลายสิบ MB → ตั้ง `retention-days` สั้น ๆ (7–14 วัน) ไม่งั้นเกินแล้วเสียเงิน
- lock-in: ไม่มี เป็นคำสั่งมาตรฐานของ Android

### C. Build บนคอมพิวเตอร์ของเจ้าของ

- ติดตั้ง Android Studio (มี SDK) + JDK แล้วรัน `npx expo run:android` หรือ
  `prebuild` + `assembleRelease` เอง
- ฟรี แต่ต้องดาวน์โหลดหลาย GB ครั้งแรก, ต้องตั้งค่า environment, คอมต้องแรงพอ
- agent ทำแทนไม่ได้ (เครื่องอยู่นอก repo/นอก sandbox) — เจ้าของต้องลงมือเองทุกครั้ง
  หรือมีคนช่วย
- เหมาะถ้ามีนักพัฒนาที่ใช้คอมเครื่องนั้นประจำอยู่แล้ว

### D. `eas build --local`

- **ยังต้องมีบัญชี Expo และ login** (เอกสาร Expo ระบุเป็นข้อกำหนด) — ตรวจว่ามี
  โปรเจกต์ และดึง keystore ที่ Expo เก็บไว้
- ฟรี (ไม่กินโควตา cloud) แต่ต้องมี Android SDK + NDK ในเครื่องเหมือนทาง C;
  Windows ไม่รองรับอย่างเป็นทางการ (macOS/Linux เท่านั้น)
- ได้ข้อเสียของทั้ง A (บัญชี) และ C (ติดตั้ง SDK) — ใช้สำหรับ debug build ที่ล้มบน
  EAS เป็นหลัก ไม่เหมาะกับเรา

### E. Capacitor

**Capacitor คืออะไร:** เอา **เว็บแอป** (HTML/JS) ไปใส่ในกล่องแอป Android ที่มี
หน้าต่างเบราว์เซอร์ (WebView) อยู่ข้างใน แล้วให้ plugin เป็นสะพานไปเรียกความสามารถ
ของเครื่อง เป็นเครื่องมือที่ดีและแพร่หลาย — **แต่เป็น "วิธีสร้างแอป" ไม่ใช่
"วิธี build APK"** การ build APK ของ Capacitor ก็ใช้ Gradle + Android SDK เหมือน
ทาง B/C ทุกอย่าง ไม่ได้ฟรีหรือง่ายกว่าในส่วนนี้

**ทำไมเหมาะกับ finance-app (ถ้าเป็นเว็บแอป) แต่ไม่ใช่ที่นี่:** เราไม่ได้เห็น repo
finance-app — **ถ้า** finance-app เป็นเว็บแอป (เช่น React + Vite) Capacitor คือ
ทางที่ถูก: เอาของที่มีอยู่ใส่กล่อง ไม่ต้องเขียนใหม่ และไม่ต้องย้ายไป React Native.
mon-farm กลับด้าน: **เป็น React Native อยู่แล้ว** ปัญหาของเราคือแค่ "ใครเป็นคน
build" (A–D) ไม่ใช่ "ใช้เทคโนโลยีอะไร"

**ถ้าจะใช้ Capacitor กับ mon-farm ต้องทำอะไร:** เรามี build เว็บ (`dist/` ผ่าน
react-native-web) จึงห่อด้วย Capacitor ได้ในทางเทคนิค แต่จะกลายเป็น **platform
ที่สามที่ต้องดูแล** และเลิกใช้ UI native ที่เรากำลังจะทดสอบใน E01-S06:

| ความสามารถที่เราต้องใช้ | Expo (first-party; บางตัวยังไม่ได้ติดตั้ง) | Capacitor |
|---|---|---|
| ที่เก็บข้อมูล (event log) | `expo-sqlite` (เขียน adapter แล้ว) | WebView IndexedDB หรือ `@capacitor-community/sqlite` (community, ต้องเขียน adapter ใหม่) |
| พูดไทย (TTS) | `expo-speech` (first-party) | `@capacitor-community/text-to-speech` (community) |
| การสั่น (haptics) | `expo-haptics` | Haptics (official) |
| จอไม่ดับ (keep-awake) | `expo-keep-awake` | `@capacitor-community/keep-awake` (community) |
| ล็อกแนวจอ | `expo-screen-orientation` | Screen Orientation (official) |
| กล้อง / QR | `expo-camera` | Camera, Barcode Scanner (official) |
| push notification | `expo-notifications` | Push Notifications (official) |

หมายเหตุความเป็นธรรม: ทั้งสองฝั่งพูดไทยออฟไลน์ได้เท่ากับที่ **เครื่องมีเสียงไทย
ของระบบ** (ทั้งคู่เรียก TTS engine ของ Android) — Capacitor ไม่ได้ "ทำไม่ได้"
แต่ทุกข้อคือ plugin อีกชุด, บางข้อเป็น community ที่ดูแลโดยอาสาสมัคร, และโค้ดที่
ใช้ `expo-*` ทั้งหมดต้องมีทางเรียกใหม่. ด้านความเร็ว Ionic (ผู้สร้าง Capacitor)
เองยอมรับว่า WebView มี overhead การวาด UI มากกว่า native ในบางกรณี — สำหรับปุ่ม
กดค้างนับเข่งที่ต้องตอบสนองไวในสวน นี่คือความเสี่ยงที่ต้องวัด ไม่ใช่ได้ฟรี.
ประโยค "Rejected" ใน `docs/architecture.md` ที่ว่าความสามารถเหล่านี้ "ไม่มีใน PWA"
ถูกสำหรับ PWA แต่ **ไม่แม่นสำหรับ Capacitor** (มี plugin) — เหตุผลจริงคือ
"ต้องเขียน platform layer ใหม่ทั้งชุด ทั้งที่เป็น React Native อยู่แล้ว"

## ตารางเปรียบเทียบ (ใช้งาน 4–10 APK/เดือน)

| | ราคา/เดือน | ความสามารถ | ความยาก (ตั้งค่า · ระยะยาว) | lock-in / ความเสี่ยง |
|---|---|---|---|---|
| **A. EAS Build** | **$0** (ฟรี 15 Android) · $19 ถ้าอยากได้คิวเร็ว | ไม่ต้องมี SDK, เก็บ keystore ให้, ลิงก์/QR ติดตั้ง, ต่อยอด EAS Update ได้ | ง่ายสุด · ง่าย | บัญชีภายนอก + `eas-cli`; คิวฟรีอาจรอ 90+ นาที; keystore อยู่ที่ Expo (ดาวน์โหลดออกได้) |
| **B. GitHub Actions** | **$0** ในโควตา 2,000 นาที (ใช้ ≈80–400 นาที) · ถ้าโควตาหมดแล้ว ≤ ≈$2.40 | ไม่ต้องมีบัญชีใหม่, กดสั่งจาก GitHub, APK เป็น artifact | ปานกลาง (workflow + keystore secret + ขั้นใส่ค่าเซ็น ครั้งเดียว) · ต่ำ | ไม่มี lock-in; กินโควตานาทีร่วมกับ CI/repo อื่น; เวลา build ยังไม่เคยวัด |
| **C. คอมเจ้าของ** | **$0** | ครบเหมือน B, debug บนเครื่องได้ | สูง (ติดตั้งหลาย GB) · ต้องมีคนทำทุกครั้ง | ไม่มี lock-in; agent ทำแทนไม่ได้ |
| **D. `eas build --local`** | **$0** | เหมือน C + keystore จาก Expo | สูง + ต้องมีบัญชี · สูง | ข้อเสียของ A + C รวมกัน |
| **E. Capacitor** | $0 (ค่าเครื่องมือ) แต่ build ยังต้องใช้ B หรือ C | plugin ครบ แต่หลายตัวเป็น community; UI อยู่ใน WebView | **สูงมาก (เป็น platform ที่สามที่ต้องเขียน/ดูแล)** · สูง | ทิ้งงาน native ที่ทำไว้; ไม่ได้แก้คำถาม "ใคร build" |

## Decision

เจ้าของตอบ (2026-10-03): *"go with Github action, keep the document somewhere
that if the bill come or we have to reduce cost (because I have many projects, we
may go to another free choice)"*

ใช้ **ทาง B — GitHub Actions + `expo prebuild` + Gradle `assembleRelease`**,
สั่งรันเองเท่านั้น (`workflow_dispatch`). ทางลดค่าใช้จ่ายถ้าวันหนึ่งมีบิล อยู่ใน
หัวข้อ "เมื่อต้องลดค่าใช้จ่าย" ด้านล่าง. ส่วน Recommendation เก็บไว้เป็นเหตุผล
ประกอบการตัดสิน

## Recommendation

**เลือก B (GitHub Actions, กดสั่งเอง) เป็นทางหลัก** เหตุผล:

1. **ไม่ต้องมีบัญชีใหม่และไม่ต้องติดตั้ง package ใหม่** — runner มี Android SDK
   อยู่แล้ว ผ่าน security gate ได้ง่ายกว่าทุกทาง
2. **ค่าใช้จ่ายจริงคือ $0** ในปริมาณ MVP; กรณีแย่สุด ≈ $2.40/เดือน และเฉพาะเมื่อ
   โควตา 2,000 นาทีที่แชร์กับ repo อื่นถูกใช้หมดแล้ว
3. **agent ทำซ้ำได้เอง** โดยไม่ต้องรอใครเปิดคอม (ต่างจาก C, D)
4. **ไม่มี lock-in** — วันหนึ่งย้ายไป EAS ได้โดยแค่ย้าย keystore ตัวเดิมขึ้นไป

**A (EAS ฟรี) เป็นทางสำรองที่สมเหตุสมผลมาก** ถ้าเจ้าของสะดวกสมัครบัญชี:
ง่ายที่สุด, ฟรี 15 build/เดือนพอสำหรับ 4–10, และเป็นทางที่ต้องใช้อยู่ดีถ้าวันหนึ่ง
อยากได้ EAS Update หรือ build iOS (ต้องใช้ Mac — GitHub macOS แพงกว่า Linux
~10 เท่า). ข้อเสียหลักคือคิวฟรีอาจรอนาน และต้องผ่าน gate ของ `eas-cli`

**ไม่แนะนำ D และ E** (ด้วยเหตุผลข้างบน). C ไม่จำเป็นตราบใดที่ B ใช้ได้

**ข้อสังเกตสำหรับ E01-S06 (ไม่ได้แก้ AC):** "dev client" (`expo-dev-client`)
ต้องต่อกับคอมพิวเตอร์ที่รัน Metro (โปรแกรมส่งโค้ด JS ให้แอประหว่างพัฒนา) ตอนใช้งาน — ถือไปสวนคนเดียวไม่ได้. APK ที่
เจ้าของถือไปทดสอบในโหมดเครื่องบินควรเป็น **release/preview APK** (มีโค้ด JS ฝังใน
ตัว) ทั้ง A และ B ทำได้. lead/เจ้าของอาจต้องแยก AC "dev client" กับ "APK สำหรับ
ทดสอบภาคสนาม" ออกจากกัน

## Consequences

(เลือก B แล้ว)

- เพิ่ม workflow `android-apk.yml` (`workflow_dispatch` เท่านั้น, `timeout-minutes`,
  cache Gradle, ใส่ค่าเซ็นจาก secret, artifact `retention-days` 7–14) — งาน CI แยก ต้องผ่าน review ตามปกติ
- เจ้าของสร้าง keystore หนึ่งครั้ง เก็บสำรองไว้นอก GitHub (ถ้าหาย = ต้องถอนแอป
  ทุกเครื่องและข้อมูลที่ยังไม่ซิงก์หาย) แล้วใส่เป็น GitHub secret
- วัดนาทีจริงของ build แรกแล้วบันทึกใน Dev notes ของ E01-S06 แทนตัวเลขประมาณ
- `android/` ที่ prebuild สร้าง **ไม่ commit** (คง managed workflow — Expo สร้างโฟลเดอร์
  native ใหม่จาก `app.json` ทุกครั้ง; `.gitignore` มี `/android` และ `*.jks` อยู่แล้ว)
- ไม่ปิดทาง A: ย้ายไป EAS ได้ทีหลังโดยอัปโหลด keystore เดิม
- ไม่ว่าเลือกทางไหน: แก้บรรทัด "Rejected: PWA / Capacitor" ใน `docs/architecture.md`
  ให้เหตุผลตรงกับ ADR นี้ (Capacitor มี plugin; ที่ไม่เลือกเพราะต้องเขียน platform
  layer ใหม่) และบันทึกทางที่เลือกในส่วน Tech stack

## เมื่อต้องลดค่าใช้จ่าย (cost fallback)

เจ้าของมีหลายโปรเจกต์ที่ใช้นาที GitHub Actions **ก้อนเดียวกัน** (2,000 นาที/เดือน
บน GitHub Free, แชร์ทุก repo private) หัวข้อนี้มีไว้ให้หยิบใช้เมื่อบิลมาหรือต้องลดต้นทุน

### (a) สัญญาณที่ควรทบทวน

- หน้า Billing ของบัญชี GitHub แสดงนาที Actions ที่ใช้ **เกิน ~80% ของ 2,000**
  ก่อนสิ้นเดือน (ทุก repo รวมกัน)
- มี **บิลค่า Actions** (นาทีเกิน: Linux $0.006/นาที) หรือค่า **artifact storage**
  (เกิน 500 MB)
- build APK หนึ่งครั้งใช้นาน **เกิน 40 นาที** หรือต้อง build **เกิน ~10 ครั้ง/เดือน**
  อย่างสม่ำเสมอ

### (b) ลดนาทีก่อนย้าย (ทำได้ใน workflow เดิม)

1. รันเฉพาะเมื่อสั่ง (`workflow_dispatch`) หรือเมื่อติด tag release — **ไม่ผูกกับ
   PR/push** (เป็นค่าตั้งต้นของ ADR นี้อยู่แล้ว)
2. cache Gradle และ npm ระหว่างรอบ
3. build เฉพาะสถาปัตยกรรมของมือถือจริง: `-PreactNativeArchitectures=arm64-v8a`
   (ค่าเริ่มต้นคอมไพล์ native ทั้ง 4 แบบ)
4. `concurrency` + `cancel-in-progress` (กดซ้ำแล้วรอบเก่าหยุด), `timeout-minutes`
   (เช่น 45) กัน build ค้างกินนาที
5. artifact `retention-days` 7–14 หรือแนบ GitHub Release แทน

### (c) ทางฟรีที่เหลือ เรียงตามความง่ายในการย้าย

| ลำดับ | ทาง | ราคา / โควตา | ขั้นตอนย้ายโดยย่อ | ข้อแลก |
|---|---|---|---|---|
| 1 | **EAS Build แผนฟรี** (ทาง A) | $0 · 15 Android build/เดือน, เกินแล้วรอเดือนหน้า (ไม่เก็บเงิน) | สมัครบัญชี Expo → ขอติดตั้ง `eas-cli` (dependency gate) → `eas.json` profile `preview` (`buildType: apk`) → `eas credentials` อัปโหลด **keystore ตัวเดิม** | คิวฟรีอาจรอ 90+ นาที; มีบัญชีภายนอกเพิ่ม |
| 2 | **Self-hosted runner** บนคอมของเจ้าของ | $0 — GitHub ไม่คิดนาทีของ self-hosted runner | ติดตั้ง runner ของ GitHub + Android SDK/JDK บนคอม → เปลี่ยน `runs-on` เป็น `self-hosted`; workflow และ secret เดิมใช้ต่อได้ | คอมต้องเปิดอยู่ตอนสั่ง build; ติดตั้งครั้งแรกหลาย GB |
| 3 | **Build ในคอมเอง** (ทาง C) | $0 | ติดตั้ง Android Studio + JDK → `npx expo prebuild --platform android` → `./gradlew assembleRelease` พร้อมไฟล์ keystore ในเครื่อง | ต้องมีคนลงมือทุกครั้ง; agent ทำแทนไม่ได้ |
| — | `eas build --local` (ทาง D) | $0 | — | **ไม่แนะนำ**: ต้องมีทั้งบัญชี Expo และ SDK ในเครื่อง ได้ข้อเสียของ 1 และ 3 รวมกัน |

ทุกทางใช้ **keystore ตัวเดิม** ได้ — ย้ายแล้วโทรศัพท์อัปเดตทับแอปเดิมได้ ข้อมูลไม่หาย
**ห้ามสร้าง keystore ใหม่ตอนย้าย**

## คำถามที่ยังเปิด

1. ~~ใครสร้าง keystore?~~ **ตัดสินแล้ว (owner, 2026-10-03, D1): เจ้าของสร้างเอง**
   บนคอมของตัวเองด้วย `keytool` และใส่ GitHub Secrets เองแล้ว (`ANDROID_KEYSTORE_BASE64`,
   `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`) — กุญแจและ
   รหัสผ่านไม่ผ่าน agent; ต้องสำรองไว้นอก GitHub อย่างน้อย 2 ที่ (GitHub ดาวน์โหลดคืนไม่ได้)
   - Package name: `com.goonjs.monfarm` (ลงทะเบียนใน Firebase `mon-farm-a7` แล้ว; เปลี่ยนไม่ได้)
   - Fingerprint ของ release key (alias `mon-farm`, ไม่ใช่ความลับ; ลงทะเบียนใน Firebase แล้ว
     สำหรับ Google sign-in บน Android, E02-S01):
     - SHA-1: `D1:DC:39:63:38:B2:E3:35:DB:2A:99:2A:61:08:DC:BC:85:58:88:9B`
     - SHA-256: `4C:87:F2:78:77:3F:22:47:30:08:B3:57:3E:4B:A2:1F:6A:16:E7:32:29:A9:E4:D0:6C:C5:70:81:85:FF:79:64`
     - ถ้าวันหนึ่งขึ้น Google Play และเปิด Play App Signing จะมี fingerprint ของ Google
       เพิ่มอีกชุดที่ต้องลงทะเบียนด้วย

## Sources (ดึงข้อมูล 2026-10-03)

- Expo pricing (แผน, โควตา, คิว, timeout, ราคา/build, EAS Update MAU): <https://expo.dev/pricing>
- Expo plans: <https://docs.expo.dev/billing/plans/>
- Expo billing FAQ (โควตาฟรีหมดแล้วเป็นอย่างไร): <https://docs.expo.dev/billing/faq/>
- Expo fast-failed builds ไม่นับโควตา: <https://expo.dev/changelog/2024-05-02-fast-failed-builds-exclusion>
- EAS local builds (ต้อง login, ต้องมี SDK/NDK, ไม่รองรับ Windows): <https://docs.expo.dev/build-reference/local-builds/>
- EAS build server (Android medium/large): <https://docs.expo.dev/build-reference/infrastructure/>
- Expo release build ในเครื่อง (prebuild, keystore, Gradle): <https://docs.expo.dev/guides/local-app-production/>
- GitHub Actions billing (นาทีฟรีตามแผน, public ฟรี): <https://docs.github.com/en/billing/concepts/product-billing/github-actions>
- GitHub runner pricing (Linux 2-core $0.006/นาที, macOS $0.062): <https://docs.github.com/en/billing/reference/actions-runner-pricing>
- Ubuntu 24.04 runner image (Android SDK/NDK ติดมา): <https://github.com/actions/runner-images/blob/main/images/ubuntu/Ubuntu2404-Readme.md>
- เวลา build RN/Expo Android 20–40 นาที (แหล่งรอง): <https://github.com/polygon-mv/rn-build-cache>
- Capacitor: <https://capacitorjs.com/docs>, official plugins <https://capacitorjs.com/docs/apis>, Android <https://capacitorjs.com/docs/android>
- Self-hosted runner ไม่คิดนาที: <https://docs.github.com/en/billing/concepts/product-billing/github-actions>
- Capacitor community plugins: <https://github.com/capacitor-community/text-to-speech>,
  <https://github.com/capacitor-community/sqlite>, <https://github.com/capacitor-community/keep-awake>
- Ionic เทียบ Capacitor กับ React Native (overhead การวาดใน WebView): <https://ionic.io/blog/capacitor-everything-youve-ever-wanted-to-know>

หมายเหตุ: `expo.dev`, `docs.expo.dev`, `docs.github.com` ถูก proxy ของ sandbox
บล็อก — อ่านผ่านบริการค้นหา/ดึงหน้าเว็บภายนอกในวันเดียวกัน. ตรวจราคาที่หน้า
ต้นทางอีกครั้งก่อนจ่ายเงินจริง
