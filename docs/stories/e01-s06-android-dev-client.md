# Story E01-S06: รันบน Android จริงครั้งแรก (dev client)

Status: Ready

## Context

- Epic: `docs/epics/e01-foundation-sync.md`
- PRD: NFR-1 (Android ก่อน), NFR-2
- Architecture: "Open and undecided" ข้อ 1 (native ยังไม่เคยรัน); Direction — Risks carried
- ขึ้นกับ: E01-S02 (ทดสอบ store รูปแบบใหม่บนเครื่อง)

## คำอธิบาย

ความเสี่ยงอันดับหนึ่ง: แอปเคยรันแค่บนเบราว์เซอร์ สร้าง dev client (`expo-dev-client`, จำเป็นต่อ Google sign-in ใน E02)
แล้วรัน flow หลักบน Android จริง บันทึกสิ่งที่พบ

## Acceptance criteria

- [ ] build dev client Android ได้ และติดตั้งบนเครื่องจริง
- [ ] flow หลักทำงานบนเครื่อง: เริ่มการขาย → นับเข่ง (กดค้าง) → สรุปเงิน
- [ ] เข่งที่บันทึกรอดหลังล็อกจอ, force-close และเปิดใหม่ (expo-sqlite) (NFR-2)
- [ ] เสียงพูดไทยทำงานแบบออฟไลน์ (โหมดเครื่องบิน)
- [ ] ปัญหาที่พบ บันทึกใน `docs/architecture.md` และแก้ข้อ "Native has never been run"

## Offline / sync behavior

- ทดสอบทั้งหมดในโหมดเครื่องบิน; ไม่มี sync ใน story นี้

## Test plan

- [ ] jest-expo/Vitest เดิมผ่านครบ (ไม่มี regression)
- [ ] checklist รันบนเครื่องจริง + screenshot จากเครื่อง (golden path, force-close, เครื่องบิน)

## ต้องให้เจ้าของทำ/อนุมัติ

- อนุมัติติดตั้ง `expo-dev-client` (gate dependency พร้อมผลตรวจ)
- เลือกวิธี build: EAS (บัญชี Expo) หรือ build ในเครื่อง (Android SDK อยู่นอก repo → ขออนุญาตเข้าถึงนอก working directory)
- จัดหาเครื่อง Android สำหรับทดสอบ

## Verification

## Dev notes

### ขั้นตอน build (agent เตรียม, รอ gate)

1. ขออนุมัติ `expo-dev-client` (gate dependency + ผลตรวจ `npm audit` ก่อน/หลัง)
2. วิธี build ที่แนะนำ: **EAS Build (cloud)** — sandbox ไม่มี Android SDK และการ build ในเครื่องต้องเข้าถึงนอก repo
   ทางเลือก: build ในเครื่องของเจ้าของด้วย Android Studio (ช้ากว่าในการตั้งค่า)
3. เพิ่ม `eas.json` profile `development` (`developmentClient: true`, `distribution: internal`, Android `apk`)
4. เจ้าของรัน build ครั้งแรก (ต้อง login บัญชี Expo ของเจ้าของ) → ได้ลิงก์ติดตั้ง APK
5. รันเซิร์ฟเวอร์ dev (`npx expo start --dev-client`) ให้เครื่องต่อเข้ามา หรือ build แบบ preview (มี bundle ในตัว)
   สำหรับทดสอบออฟไลน์ล้วน — ทดสอบโหมดเครื่องบินต้องใช้ **build ที่มี bundle ในตัว** เพราะ dev client
   โหลดโค้ดจากเครื่องคอมพิวเตอร์

### Checklist เจ้าของ (บนโทรศัพท์ Android จริง)

**ก. เตรียม (ครั้งเดียว)**

1. สมัคร/login <https://expo.dev> → แจ้ง lead ว่าใช้บัญชีไหน (agent ไม่ต้องการรหัสผ่าน)
2. โทรศัพท์: **การตั้งค่า → ความปลอดภัย → ติดตั้งแอปที่ไม่รู้จัก** → อนุญาตให้ Chrome (ชื่อเมนูต่างกันตามยี่ห้อ)
3. เสียงพูดไทยแบบออฟไลน์: **การตั้งค่า → ระบบ → ภาษา → เอาต์พุตการอ่านออกเสียง (Text-to-speech)**
   → เครื่องมือของ Google → ⚙️ → **ติดตั้งข้อมูลเสียง** → **ไทย** → ดาวน์โหลด (ใช้ Wi-Fi)

**ข. ติดตั้ง**

1. เปิดลิงก์ build ที่ agent/lead ส่งให้ บนโทรศัพท์ → **Download** → เปิดไฟล์ → **ติดตั้ง**
2. เปิดแอป mon-farm → จับภาพหน้าจอ (กดปุ่มเปิด/ปิด + ลดเสียงพร้อมกัน)

**ค. ทดสอบ (จับภาพหน้าจอทุกข้อ)**

1. เปิด **โหมดเครื่องบิน** (ปัดแถบด้านบนลง → ✈️) ตลอดการทดสอบ
2. เริ่มการขาย → กดค้างเพื่อนับเข่ง 3–5 เข่ง → เปิดหน้าสรุปเงิน ✔ ตัวเลขถูกต้อง
3. ระหว่างนับ: **ล็อกจอ** 10 วินาที → ปลดล็อก ✔ เข่งยังอยู่ครบ
4. **ปิดแอปแบบบังคับ**: ปุ่มสี่เหลี่ยม/ปัดขึ้นค้าง → ปัดแอปทิ้ง → เปิดใหม่ ✔ เข่งยังอยู่ครบ
5. เสียงพูดภาษาไทยดังตอนนับ ✔ (ทั้งที่อยู่ในโหมดเครื่องบิน)
6. ส่งภาพหน้าจอทั้งหมด + รุ่นโทรศัพท์ + เวอร์ชัน Android (**การตั้งค่า → เกี่ยวกับโทรศัพท์**) ให้ lead
   ข้อไหนไม่ผ่าน เขียนสั้น ๆ ว่าเห็นอะไร


## Code review

## QA notes
