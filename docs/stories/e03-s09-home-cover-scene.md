# Story E03-S09: ภาพปกหน้าแรก สวนยางตามเวลาจริง

Status: Review (code merged #143, b322fd8, 2026-11-02; missing: วัด frame rate และแบตบน Android จริง · ปัดแนวตั้งบนจอสัมผัสจริง) — เดิม: (เจ้าของเลือกทิศทางผ่านลีด 2026-11-02, ลีดรับ AC แล้ว)
เงื่อนไขไปขั้นถัดไป: วัด frame rate และแบตบนโทรศัพท์ Android จริง และลองปัดแนวตั้งบนจอสัมผัสจริง (CS-3, CS-5) · CS-8 ตรวจที่ S/M/L บน build แล้วติ๊ก → Done · ใคร: เจ้าของหรือทีม dev ที่มีเครื่อง Android กับ APK (E01-S06) · รอ: คนที่มีเครื่อง Android · PR #143 ไม่มีรีวิวบน GitHub (รีวิวอิสระอยู่ในหัวข้อ Code review)

## Context

- Epic: `docs/epics/e03-master-data.md` (หน้าแรก v2, ต่อจาก `e03-v2-splash-home.md`)
- คำขอเจ้าของ 2026-11-02: "ภาพต้นไม้หน้าแรกดูแปลก" อยากได้ต้นยางสวย ลำธารน้ำไหล (ไม่เอาน้ำตก)
  เมฆบางลอยช้า ดวงอาทิตย์ตามเวลาจริง เช้า/สาย/เที่ยง/บ่าย/เย็น ดูต่างกัน
- Mockup: `docs/ux/mockups/home-cover-scene.html` (artifact https://claude.ai/artifact/Vxiv7KoTKZSPvF5Y3BWsKH)
- คำตอบเจ้าของ (ผ่านลีด): ภาพโดยรวมเอาแบบนี้ พุ่มฟูขึ้น · หลัง 19:00 พระจันทร์กับดาว · สูง 148 เท่าเดิม (เจ้าของตอบ 180 ก่อนแล้วเปลี่ยนเป็น 148) ·
  เปิดแอปแสดงเวลาตอนนี้ ปัดซ้าย/ขวาเลื่อนเวลาตามตำแหน่ง แตะ = เล่นทั้งวันใน 30 วินาที ·
  JS error ให้กลับไปแสดงภาพเก่า · review ไม่มี error แล้ว merge ได้
- โค้ดเดิม: `Cover` ใน `src/v2/home-screen.tsx` (วาดด้วย View, สูง 148)
- ขึ้นกับ: E03-S08 (merged b213b51)

## Description

เปลี่ยนภาพปกหน้าแรกเป็นฉากสวนยางริมลำธารที่วาดด้วย `react-native-svg` (มีในแอปแล้ว ไม่ลง package ใหม่)
น้ำไหลและเมฆลอยเบา ๆ สีฟ้า แสง ดวงอาทิตย์ พระจันทร์ เปลี่ยนตามนาฬิกาเครื่อง ผู้ใช้ปัดซ้ายขวาบนภาพ
เพื่อเลื่อนเวลาดูได้ และแตะเพื่อเล่นทั้งวันใน 30 วินาที ถ้าฉากพังภาพเดิมจะแสดงแทน

## Acceptance criteria

- [x] **CS-1** ฉากตาม mockup: ต้นยางพุ่มฟู ลำต้นเทาอ่อนมีรอยกรีดกับถ้วยรับน้ำยาง แถวต้นยางข้างหลัง
  ลำธารคดเคี้ยวไหลเข้าหาคนดู (ไม่มีน้ำตก) เมฆบาง 3 ก้อน ดวงอาทิตย์/พระจันทร์กับดาว สูง 148 เท่าเดิม เต็มความกว้าง
- [x] **CS-2** เปิดหน้าแรกแล้วภาพแสดงตามเวลาเครื่องตอนนี้ และเปลี่ยนตามนาฬิกาทุก 1 นาที: ดวงอาทิตย์ขึ้น 06:00
  ตก 18:30 เดินเป็นวงโค้งซ้ายไปขวา สีฟ้า น้ำ ใบไม้ เงา เปลี่ยนตามเวลา เช้า/สาย/เที่ยง/บ่าย/เย็น ต่างกันชัด
  ค่ำ (ราว 19:30–05:00) เป็นพระจันทร์กับดาว
- [ ] **CS-3** ปัดซ้าย/ขวาบนภาพ: เวลาเลื่อนตามนิ้ว ดวงอาทิตย์เลื่อนไปพร้อมนิ้ว (ปัดสุดภาพ ≈ หนึ่งวัน, ตัดที่ 00:00 และ 24:00) ระหว่างปัด หน้าไม่เลื่อนขึ้นลง
  ปัดขึ้นลงยังเลื่อนหน้าได้เหมือนเดิม ปล่อยนิ้วแล้วภาพค้างเวลาที่เลือกไว้ จนกว่าจะออกแล้วกลับเข้าหน้าแรก (กลับเป็นเวลาตอนนี้)
- [x] **CS-4** แตะภาพ = เริ่มเล่นทั้งวันใน 30 วินาที (วนซ้ำ) จากเวลาที่แสดงอยู่ แตะอีกครั้ง = หยุดและกลับเป็นเวลาตอนนี้
- [ ] **CS-5** ประหยัดแบต: ขยับแค่น้ำกับเมฆ ประมาณ 10 ครั้ง/วินาที หยุดเมื่อออกจากหน้าแรกหรือพับแอป
  ถ้าเครื่องเปิด "ลดการเคลื่อนไหว" น้ำและเมฆนิ่ง (สีตามเวลา การปัด และการแตะยังทำงาน)
- [x] **CS-6** ใช้ได้ออฟไลน์: ไม่มีรูปหรือฟอนต์จากเน็ต ทุกอย่างวาดในโค้ด
- [x] **CS-7** ถ้าฉากเกิด JS error ภาพเดิม (ภาพปกแบบ View เดิม) แสดงแทน ส่วนอื่นของหน้าแรกใช้ได้ปกติ
- [ ] **CS-8** ตัวอักษรเล็ก/กลาง/ใหญ่ ที่ 390×844: ไม่มีอะไรถูกตัดหรือล้นด้านข้าง ภาพไม่มีตัวอักษรทับ
- [x] **CS-9** ผู้ใช้โปรแกรมอ่านจอได้ยินชื่อภาพ "ภาพปก: สวนยางริมลำธาร" และคำแนะนำ "แตะเพื่อเล่นภาพทั้งวัน"
  การสั่งเปิดใช้ (activate) สลับเล่น/หยุดเหมือนการแตะ

## Offline / sync behavior

N/A — ไม่มีข้อมูลหรือเครือข่าย ภาพอ่านแค่นาฬิกาเครื่อง ไม่บันทึกอะไรลง log

## Test plan

- [x] Vitest `src/core/cover-sky.test.ts`: สีตามชั่วโมง (เช้า ≠ เที่ยง ≠ เย็น, กลางคืน = กลางคืน, วนรอบ 24),
  ดวงอาทิตย์ (ขึ้น/ตก/สูงสุดเที่ยงครึ่ง, ใต้ขอบฟ้าตอนกลางคืน), พระจันทร์, นิ้ว ↔ เวลา (ไปกลับได้, ตัดปลาย), เล่น 30 วิ
- [x] Vitest `src/core/cover-scene.test.ts`: ฉากเหมือนเดิมทุกครั้ง (deterministic), พิกัดเป็นตัวเลขจริง,
  จำนวนรูปไม่เกินงบ (ประหยัดแรง)
- [x] Jest `src/v2/home-cover/home-cover.test.tsx`: แสดงตามเวลาเครื่อง, เดินตามนาฬิกา, ปัดแนวนอนเปลี่ยนเวลา,
  ปัดแนวตั้งไม่เปลี่ยน, แตะเล่น/แตะหยุด, น้ำขยับ/ลดการเคลื่อนไหวนิ่ง, ฉาก throw → ภาพเดิม, a11y label/action
- [ ] Playwright (web build) ภาพหน้าจอ 6 ช่วงเวลา + ตัวอักษรใหญ่สุด, ตรวจไม่ล้น

## Verification

- [x] Sandbox run performed: web build (`expo export`) served with `scripts/serve-dist.mjs`, Playwright 390×844 dpr 2,
  clock fixed per run: 07:00 / 10:00 / 12:00 / 15:00 / 17:30 / 20:00 — cover 148 tall, inside the screen, no page error,
  classic cover not shown. Drag left 120 px at 12:00 → night colours; click → play, 7.5 s later evening; water dashoffset
  0 → −8.2 after 0.7 s; `touch-action: pan-y` on the cover. Text size S and L: no sideways overflow.
  Existing e2e `v2-home`, `v2-text-size`, `v2-pending-repay`: 7 passed.
- [x] Screenshots — golden path: `docs/ux/screenshots/ui-v2/home/cover-scene/cover-{1-morning..6-night}.png`, `home-morning.png`
- [x] Screenshots — edge cases: `home-text-l.png` (largest text), `drag-left.png`, `play-7s.png`
- [ ] Not measured: frame rate and battery on a real Android phone (no device here); vertical swipe on a real touch
  screen (web emulation only checks the `pan-y` style)

## Dev notes

- เรขาคณิตของฉากเป็นฟังก์ชันบริสุทธิ์ใน `src/core/cover-scene.ts` (ไม่มี React) สีและเวลาใน `src/core/cover-sky.ts`
- ส่วนที่นิ่ง (ต้นไม้ เนิน) memo ไว้ เปลี่ยนแค่ fill ของกลุ่ม ส่วนที่ขยับ (เส้นน้ำ เมฆ) แยกคอมโพเนนต์เล็ก
- ไม่ใช้ reanimated (ยังไม่มีใครใช้ในแอป) ใช้ตัวจับเวลา ~10 ครั้ง/วินาที ปรับ prop เพียงไม่กี่ตัว
- ภาพปกเดิมย้ายไป `src/v2/home-cover/classic-cover.tsx` ใช้เป็น fallback
- สีของฉากอยู่ที่ `design/cover-scene.ts` (ภาพประกอบ ไม่ใช่ role ของ UI; `src/` ห้ามมีสีดิบ)
- ฉากมี 681 รูปทรง (งบ 900) ปัดซ้ายขวา: ดวงอาทิตย์อยู่ใต้นิ้ว ขอบซ้าย 00:00 ขวา 24:00
- พระจันทร์ยกสูงขึ้นจาก mockup แรก (ตอน 20:00 ถูกต้นไม้บัง) ปรับ mockup ตามแล้ว

## Code review

- Reviewer (separate agent/session): independent review agent, 2026-11-02, on 3951e9a (diff vs dev)
- Findings: no blockers. Should-fix: (1) on Android one <Svg> repaints all ~680 shapes every frame;
  (2) a slightly diagonal sideways drag can be taken by the native ScrollView; (3) drag delta in view pixels drifts
  when `slice` crops; (4) focus/blur not under test; (5) act() warnings in the home suite.
  Nits: fixed gradient id, per-frame `setMode` outside play, clouds rebuilt per frame, minute timer not aligned,
  `hhmm` duplicated, web pan-y cast; no keyboard play on web.
- Resolution: (1) picture split into six stacked <Svg> layers, static ones memoised on the hour — a frame repaints
  only clouds and water; (2) `onDragChange` → home `ScrollView scrollEnabled={false}` while dragging (tested);
  (3) drag converted to scene units with the `slice` scale (tested at 716 wide); CS-3 stays relative: the sun moves
  with the finger, no jump on touch; (4) focus/blur test with a driven `useFocusEffect`; (5) home suite stubs the
  cover. Nits fixed except keyboard play on web (accepted: Android first, the picture is decoration).

## QA notes

- ตรวจเอกสาร 2026-11-27: ตรวจเอกสาร 2026-11-27 (worktree บน dev `a18db4e` หลัง `npm ci`): vitest 1559/1559 · jest 98 suites 1324/1324 · `build:web` + Playwright phone-portrait 157 ผ่าน 5 ข้าม (ชุด emulator) 0 ล้ม (รวม `src/core/cover-sky.test.ts`, `cover-scene.test.ts`, `src/v2/home-cover/home-cover.test.tsx`, `home-cover-fallback.test.tsx`, `src/__tests__/v2-home.test.tsx:109`)
- ติ๊กจากเทสต์/โค้ด/ภาพที่ดูเอง: CS-1 `cover-scene.test.ts:8`, `home-cover.test.tsx:58` + ภาพ `cover-6-night.png` (ต้นยางมีรอยกรีดและถ้วย ลำธารคดเคี้ยว พระจันทร์ ดาว เมฆ) · CS-2 `cover-sky.test.ts:20/42/67`, `home-cover.test.tsx:51` · CS-4 `cover-sky.test.ts:104`, `home-cover.test.tsx:88` · CS-6 ไม่มี `http`/`require(`/`uri` ใน `src/v2/home-cover/` และ `src/core/cover-*.ts` (วาดด้วย svg ในโค้ด) · CS-7 `home-cover-fallback.test.tsx:13` · CS-9 `home-cover.test.tsx:58`, `:99`
- ยังไม่ติ๊ก: CS-3 และ CS-5 (มีเทสต์ jest `home-cover.test.tsx:65/76/106/122/129/136/152` แต่ AC ขอการปัดแนวตั้งและการประหยัดแบตบนเครื่องจริง ซึ่งยังไม่ได้วัด) · CS-8 (มีภาพ `home-text-l.png` ที่ L แต่ไม่ได้ตรวจ S/M ในรอบนี้) · Playwright 6 ช่วงเวลาเป็นการรันมือของผู้ทำ ไม่อยู่ใน e2e
