# Story E01-S17: สี 2 ชั้น (palette → semantic token) + เปลี่ยนชุดสีด้วยค่าเดียว

Status: In Progress — AC ตาม D-81 รอเจ้าของตรวจ

## Context

- Epic: `docs/epics/e01-foundation-sync.md` (งานฐานระบบ — ยังไม่มีบรรทัดใน "ขอบเขต" ของ epic; ถ้าเจ้าของรับ story นี้ lead เพิ่มบรรทัดใน epic เอง)
- PRD: NFR-4 (อ่านได้กลางแดด, สีไม่เป็นตัวบอกสถานะเพียงอย่างเดียว) · D-20 (UI ภาษาไทย)
- Design: `docs/ux/design-system.md` §3 สี (สีสัญญาณ 4 สีไม่ซ้อนหน้าที่), §7 (สถานะไม่พึ่งสี), §12.2 palette FarmMate, §12.9–12.10 คำตอบเจ้าของ (ข้อ 2 ปุ่มเขียว, 7 ไม่มีสี info, 8 card ครีม, 10 สี sync)
- Mockup ที่ใช้ดูว่าหน้าจอต้องการสีอะไร: `docs/ux/mockups/flow-farm-v1.1.0.html`, `docs/ux/mockups/flow-sale-v1.1.0.html`
- ไฟล์ที่เกี่ยว: `design/tokens.ts` (แหล่งเดียว), `scripts/emit-tokens.mjs` → `docs/ux/tokens.css`, `scripts/check-contrast.mjs`, `src/theme/index.tsx`
- ขึ้นกับ: ไม่มี · ใช้โดย: E01-S15 (ป้ายสถานะข้อมูล), E03-S02/S04 (สวน/โซน — สีประจำกลุ่ม), E05 (สรุปยอดส่วนแบ่ง — เงินเข้า/ออก), E11 (การเงิน), E13 (กราฟ — สีชุดข้อมูล), ทุก story หน้าจอ (app bar, focus, ปุ่มปิดใช้)

## คำอธิบาย

ตอนนี้ `design/tokens.ts` เก็บสีเป็น hex ตรง ๆ ในชื่อบทบาท (`ink: '#002858'`) และใน `src/` ยังมี 4 ไฟล์ที่เขียน hex เอง
(ของเหลือจาก template Expo) story นี้แยกสีเป็น 2 ชั้น:

1. **palette (ชั้นดิบ)** — ramp ของสีตามเฉด เช่น `primary.900`, `green.700` ไม่ส่งออกไปที่ `tokens.css` และหน้าจอห้ามใช้ตรง
2. **semantic token (ชั้นบทบาท)** — ชื่อตามหน้าที่ เช่น `ink`, `moneyIn`, `focusRing` แยก light/dark หน้าจออ่านแค่ชั้นนี้

แล้ว:

- **ชื่อสีเดิมทั้ง 30 ชื่อคงอยู่ครบ** (`src/` ใช้อยู่ — เปลี่ยนชื่อจะทำให้ทีมอื่นพัง) และ**ค่าเดิมไม่เปลี่ยน**ยกเว้น 1 ค่าใน dark (ดู Dev notes)
- เพิ่มบทบาทใหม่ 23 ชื่อเท่าที่ design system และ mockup ต้องใช้ (app bar, focus, ปุ่มปิดใช้, เงินเข้า/ออก, สีประจำกลุ่ม 6 สี, ม่านหลัง sheet, เขียวอ่อนในภาพประกอบ)
- มี palette 2 ชุด: **A `farmmate`** (ใช้อยู่ — แนะนำ) และ **B `instrument`** (ทางเลือก) เลือกด้วยค่าคงที่ `ACTIVE_PALETTE` ค่าเดียว
- ย้ายสีดิบออกจาก `src/` ทั้งหมด และมี test ที่ทำให้ CI แดงถ้ามี hex / `rgb()` / `hsl()` โผล่ใน `src/` อีก

ไม่เปลี่ยนหน้าตาแอปที่ใช้ token อยู่แล้ว (palette A = ค่าเดิม) สิ่งที่หน้าตาเปลี่ยนมีแค่หน้าจาก template Expo (แท็บ explore, ลิงก์, splash overlay) ที่จะใช้สีของระบบแทนสีฟ้า Expo

## รายชื่อ semantic token (ข้อเสนอ)

ชื่อในตารางนี้คือสัญญากับทีมอื่น — เมื่อเจ้าของตกลงแล้วถือว่า**ล็อก** เพิ่มได้ แต่ห้ามเปลี่ยนชื่อหรือลบโดยไม่มี story
ใช้ใน RN: `theme.color.<ชื่อ TS>` · ใช้ใน CSS/mockup: `var(<ชื่อ CSS>)` (ชื่อ CSS สร้างจากชื่อ TS โดย `emit-tokens.mjs` ตามเดิม — ตัวเลขต่อท้ายไม่มีขีด เช่น `--color-category1`)
ค่า hex = palette A (`farmmate`) · "เดิม" = มีอยู่แล้ว ค่าเดิม · "ใหม่" = เพิ่มใน story นี้

### พื้นและตัวอักษร

| ชื่อ TS | ชื่อ CSS | หน้าที่ | light | dark | |
|---|---|---|---|---|---|
| `stage` | `--color-stage` | พื้นจอสาธารณะ / หน้าจอขาว — แบน ไม่มีเงา | `#FFFFFF` | `#000000` | เดิม |
| `surface` | `--color-surface` | พื้นหน้าจอหลัง card | `#F7FAFC` | `#0B1520` | เดิม |
| `surfaceSunk` | `--color-surface-sunk` | พื้นจม: ช่องกรอก, ราง segmented, chip กลาง | `#F1F3F5` | `#060E17` | เดิม |
| `surfaceRaised` | `--color-surface-raised` | **card** (คู่กับขอบ `ruleFaint` + เงา `shadow.card`) | `#FFFFFF` | `#13202E` | เดิม |
| `numeral` | `--color-numeral` | ตัวเลขนับบนจอสาธารณะเท่านั้น | `#002858` | `#F4F5F6` | เดิม |
| `ink` | `--color-ink` | ตัวอักษรหลัก | `#002858` | `#F4F5F6` | เดิม |
| `inkSoft` | `--color-ink-soft` | ตัวอักษรรอง, หน่วยข้างตัวเลข | `#52657A` | `#A3B1C0` | เดิม |
| `inkFaint` | `--color-ink-faint` | placeholder, ลูกศร › — ตกแต่งเท่านั้น (ต่ำกว่า AA) | `#7A8998` | `#6E7D8C` | เดิม |
| `inkInverse` | `--color-ink-inverse` | ตัวอักษร/ไอคอนบนพื้นสีทึบ | `#FFFFFF` | `#0A0B0C` | เดิม |
| `appBar` | `--color-app-bar` | พื้นแถบบน (app bar) | `#F7FAFC` | `#0B1520` | ใหม่ |
| `appBarInk` | `--color-app-bar-ink` | ชื่อหน้าและไอคอนบนแถบบน | `#002858` | `#F4F5F6` | ใหม่ |

### เส้นและ focus

| ชื่อ TS | ชื่อ CSS | หน้าที่ | light | dark | |
|---|---|---|---|---|---|
| `rule` | `--color-rule` | เส้นแบ่งตกแต่ง (ไม่มีความหมาย) | `#CBD4DC` | `#2E3B49` | เดิม |
| `ruleFaint` | `--color-rule-faint` | ขอบบางของ card, เส้นคั่นแถว | `#E4E9EE` | `#1B2632` | เดิม |
| `ruleStrong` | `--color-rule-strong` | ขอบที่บอกว่า control อยู่ตรงไหน (≥3:1) | `#7A8998` | `#7A8998` ⚠ | เดิม (dark เปลี่ยน — Dev notes) |
| `focusRing` | `--color-focus-ring` | วง focus ของคีย์บอร์ด/สวิตช์ (เว็บ + accessibility) | `#002858` | `#8FB4EC` | ใหม่ |

### กดได้

| ชื่อ TS | ชื่อ CSS | หน้าที่ | light | dark | |
|---|---|---|---|---|---|
| `action` | `--color-action` | ปุ่มหลัก, ลิงก์, แท็บที่เลือก, ขอบปุ่มรอง | `#002858` | `#8FB4EC` | เดิม |
| `actionHover` | `--color-action-hover` | ปุ่มหลักตอนกด/hover | `#002850` | `#A9C6F1` | เดิม |
| `actionSunk` | `--color-action-sunk` | แถว/ตัวเลือกที่ถูกเลือก | `#EAF5FC` | `#0F2340` | เดิม |
| `disabledFill` | `--color-disabled-fill` | พื้นปุ่มที่กดไม่ได้ (คู่ขอบเส้นประ `ruleStrong`) | `#F1F3F5` | `#060E17` | ใหม่ |
| `disabledInk` | `--color-disabled-ink` | ข้อความบนปุ่มที่กดไม่ได้ — ยังอ่านออก (AA) | `#52657A` | `#A3B1C0` | ใหม่ |

### สัญญาณ (สถานะ) — มีรูปทรง + คำเสมอ

| ชื่อ TS | ชื่อ CSS | หน้าที่ | light | dark | |
|---|---|---|---|---|---|
| `accept` | `--color-accept` | นับแล้ว / เสร็จ (เขียว) | `#006F52` | `#48C090` | เดิม |
| `acceptSunk` | `--color-accept-sunk` | พื้น chip/ช่องไอคอนสีเขียว | `#E8F8F2` | `#0B2A21` | เดิม |
| `reject` | `--color-reject` | ไม่นับ / ยกเลิก / ลบ / ขัดกัน (แดง) | `#BB1C1C` | `#F0796A` | เดิม |
| `rejectSunk` | `--color-reject-sunk` | พื้น chip/ช่องไอคอนสีแดง | `#FDECEC` | `#331310` | เดิม |
| `warn` | `--color-warn` | ติดธง / รอ — บันทึกแล้ว ไม่ขวาง (อำพัน) | `#815908` | `#FECB56` | เดิม |
| `warnSunk` | `--color-warn-sunk` | พื้น chip/card ติดธง | `#FFF5D8` | `#2E2409` | เดิม |
| `statusSynced` | `--color-status-synced` | sync: ซิงก์แล้ว (= accept) | `#006F52` | `#48C090` | เดิม |
| `statusPending` | `--color-status-pending` | sync: รอส่ง (= warn) | `#815908` | `#FECB56` | เดิม |
| `statusConflict` | `--color-status-conflict` | sync: ขัดกัน (= reject) | `#BB1C1C` | `#F0796A` | เดิม |
| `flashAccept` | `--color-flash-accept` | แสงวาบเต็มจอเมื่อรับเข่ง | `#006F52` | `#48C090` | เดิม |
| `flashReject` | `--color-flash-reject` | แสงวาบเต็มจอเมื่อไม่รับ | `#BB1C1C` | `#F0796A` | เดิม |

### เงิน — มีเครื่องหมาย + / − และคำเสมอ

| ชื่อ TS | ชื่อ CSS | หน้าที่ | light | dark | |
|---|---|---|---|---|---|
| `moneyIn` | `--color-money-in` | ตัวเลขเงินเข้า (รายรับ, ยอดขาย) + กราฟแท่งเงินเข้า | `#006F52` | `#48C090` | ใหม่ |
| `moneyInSunk` | `--color-money-in-sunk` | พื้น card/แถวสรุปเงินเข้า | `#E8F8F2` | `#0B2A21` | ใหม่ |
| `moneyOut` | `--color-money-out` | ตัวเลขเงินออก (ค่าใช้จ่าย, หักหนี้) + กราฟแท่งเงินออก | `#002858` | `#F4F5F6` | ใหม่ (ค่ารอเจ้าของ — คำถาม 2) |
| `moneyOutSunk` | `--color-money-out-sunk` | พื้น card/แถวสรุปเงินออก | `#F1F3F5` | `#060E17` | ใหม่ |

### สีประจำกลุ่ม (สวน / โซน / คนกรีดยาง / ชุดกราฟ) — ตกแต่ง ห้ามเป็นตัวบอกความหมายอย่างเดียว ต้องมีชื่อกำกับเสมอ

| ชื่อ TS | ชื่อ CSS | หน้าที่ | light | dark | |
|---|---|---|---|---|---|
| `category1` | `--color-category1` | สีประจำกลุ่มที่ 1 (teal): แถบ/จุด/เส้นกราฟ/ไอคอนในช่อง | `#0F7985` | `#14A5B5` | ใหม่ |
| `category1Sunk` | `--color-category1-sunk` | พื้นช่องไอคอน/ป้ายของกลุ่มที่ 1 | `#E7FBFE` | `#143134` | ใหม่ |
| `category2` | `--color-category2` | กลุ่มที่ 2 (indigo) | `#535DCD` | `#7981D8` | ใหม่ |
| `category2Sunk` | `--color-category2-sunk` | พื้นกลุ่มที่ 2 | `#E9EAFC` | `#141634` | ใหม่ |
| `category3` | `--color-category3` | กลุ่มที่ 3 (purple) | `#9940BF` | `#B06CCE` | ใหม่ |
| `category3Sunk` | `--color-category3-sunk` | พื้นกลุ่มที่ 3 | `#F6E9FB` | `#2A1434` | ใหม่ |
| `category4` | `--color-category4` | กลุ่มที่ 4 (magenta) | `#BE2F7B` | `#D65C9D` | ใหม่ |
| `category4Sunk` | `--color-category4-sunk` | พื้นกลุ่มที่ 4 | `#FCE8F3` | `#341425` | ใหม่ |
| `category5` | `--color-category5` | กลุ่มที่ 5 (orange) | `#AA5718` | `#DD7220` | ใหม่ |
| `category5Sunk` | `--color-category5-sunk` | พื้นกลุ่มที่ 5 | `#FEF1E7` | `#342214` | ใหม่ |
| `category6` | `--color-category6` | กลุ่มที่ 6 (olive) | `#667314` | `#93A51D` | ใหม่ |
| `category6Sunk` | `--color-category6-sunk` | พื้นกลุ่มที่ 6 | `#FBFEE7` | `#2F3414` | ใหม่ |

### แบรนด์และภาพประกอบ — ตกแต่งเท่านั้น ไม่เป็นตัวอักษร ไม่บอกสถานะ

| ชื่อ TS | ชื่อ CSS | หน้าที่ | light | dark | |
|---|---|---|---|---|---|
| `brand` | `--color-brand` | เขียว FarmMate: ภาพประกอบ, กราฟ | `#00AA7D` | `#48C090` | เดิม |
| `brandStrong` | `--color-brand-strong` | พื้นปุ่มเขียวที่มี**ไอคอนอย่างเดียว** (FAB) | `#008F6C` | `#48C090` | เดิม |
| `brandLight` | `--color-brand-light` | เขียวอ่อนในภาพประกอบ (เนินหลัง ฯลฯ) — mockup ใช้อยู่แล้ว | `#48C090` | `#008F6C` | ใหม่ |
| `brandYellow` | `--color-brand-yellow` | เหลือง FarmMate: ภาพประกอบ, ขอบ chip ตัวเลข | `#FECB56` | `#FECB56` | เดิม |
| `brandCream` | `--color-brand-cream` | พื้น card เด่น (เช่น "ส่วนเจ้าของสวน") — ไม่ใช่การเตือน | `#FFF8E8` | `#221D10` | เดิม |
| `scrim` | `--color-scrim` | สีม่านหลัง sheet/dialog — ใช้คู่ `opacity.scrim` เสมอ | `#002858` | `#000000` | ใหม่ |

รวม **53 ชื่อ** (เดิม 30 + ใหม่ 23)

### ที่ตั้งใจ**ไม่**เพิ่ม

- **`card`** — ซ้ำกับ `surfaceRaised` (ชื่อสองชื่อต่อสีเดียว = ทีมเลือกต่างกัน) card = `surfaceRaised` + ขอบ `ruleFaint` + `shadow.card`
- **`chip*`** — chip ทุกแบบใน mockup เป็นคู่สีที่มีอยู่แล้ว (ตารางสูตรด้านล่าง) ไม่ต้องมีชื่อใหม่
- **`info`** — เจ้าของตอบ §12.10 ข้อ 7 (a): ไม่มีสี info (ฟ้าที่กดไม่ได้ทำให้เข้าใจผิด)
- **`highlight`** — card เด่นใช้ `brandCream` ตาม §12.10 ข้อ 8

### สูตรการใช้ (ไม่ใช่ token ใหม่ — คู่สีที่ CI ตรวจแล้ว)

| ส่วนของหน้าจอ | พื้น | ตัวอักษร/ไอคอน | ขอบ |
|---|---|---|---|
| แถบบน (app bar) | `appBar` | `appBarInk`; คำรอง `inkSoft` | — |
| card ปกติ / card เด่น | `surfaceRaised` / `brandCream` | `ink`, รอง `inkSoft` | `ruleFaint` |
| chip นับแล้ว / ติดธง / ไม่รับ / กลาง | `acceptSunk` / `warnSunk` / `rejectSunk` / `surfaceSunk` | `accept` / `warn` / `reject` / `inkSoft` | — |
| ป้าย sync ซิงก์แล้ว / รอส่ง / ขัดกัน | `acceptSunk` / `warnSunk` / `rejectSunk` | `statusSynced` / `statusPending` / `statusConflict` | — |
| ปุ่มหลัก / ปุ่มรอง / ปุ่มลบ | `action` / `surfaceRaised` / ใส | `inkInverse` / `action` / `reject` | — / `action` / `reject` |
| ปุ่มกดไม่ได้ | `disabledFill` | `disabledInk` | เส้นประ `ruleStrong` |
| ช่องกรอก / ช่องกรอกที่ focus | `surfaceRaised` | `ink` | `ruleStrong` / `focusRing` 2px |
| แถวเงินเข้า / เงินออก | `surfaceRaised` (หรือ `moneyInSunk` / `moneyOutSunk` บน card สรุป) | `moneyIn` "+…" / `moneyOut` "−…" | — |
| ป้ายกลุ่ม (สวน/โซน) | `categoryNSunk` | ชื่อกลุ่ม `ink`; ไอคอน `categoryN` | — |

## palette (ชั้นดิบ) — ชื่อ ramp

ramp มี 2 แบบ:

- **ramp ช่อง** — `neutral`, `ink`, `primary`: เปลี่ยนเฉดได้เมื่อสลับ palette (นี่คือ "หน้าตาแบรนด์")
- **ramp เฉด** — `green`, `red`, `amber`, `teal`, `indigo`, `purple`, `magenta`, `orange`, `olive`: เฉดเดิมทุก palette ปรับได้แค่ความสว่าง (สีสัญญาณต้องคงความหมาย)

ทุก palette ต้องมี ramp และ step ชุดเดียวกัน (บังคับด้วย type) เพื่อให้ตารางบทบาทเดียวใช้ได้กับทุก palette

| ramp | step | A `farmmate` | B `instrument` |
|---|---|---|---|
| `neutral` | 0 · 50 · 100 · 150 · 200 · 300 · 400 · 500 · 600 · 700 · 800 · 850 · 900 · 950 · 975 · 1000 | เทาอมน้ำเงิน FarmMate: `#FFFFFF` `#F7FAFC` `#F1F3F5` `#E4E9EE` `#CBD4DC` `#A3B1C0` `#7A8998` `#6E7D8C` `#52657A` `#2E3B49` `#1B2632` `#13202E` `#0B1520` `#060E17` `#0A0B0C` `#000000` | เทากลาง: `#FFFFFF` `#F2F3F4` `#E4E6E8` `#DDE0E3` `#C4C8CC` `#A0A6AC` `#788087` `#6B7278` `#55595E` `#3A4046` `#24282D` `#1D2024` `#15171A` `#0D0F11` `#0A0B0C` `#000000` |
| `ink` | 50 · 900 | `#F4F5F6` · `#002858` (navy) | `#F4F5F6` · `#0A0B0C` (เกือบดำ) |
| `primary` | 50 · 200 · 300 · 900 · 925 · 950 | navy: `#EAF5FC` `#A9C6F1` `#8FB4EC` `#002858` `#002850` `#0F2340` | น้ำเงินผ้าใบ: `#E7EDF7` `#9BBDF0` `#7FA8E8` `#17458C` `#0F3068` `#152239` |
| `green` | 50 · 400 · 500 · 600 · 700 · 950 | `#E8F8F2` `#48C090` `#00AA7D` `#008F6C` `#006F52` `#0B2A21` | `#E0EFE6` `#4FBF85` `#2E9E6B` `#1F7A50` `#06542C` `#0E2A1B` |
| `red` | 50 · 300 · 700 · 950 | `#FDECEC` `#F0796A` `#BB1C1C` `#331310` | `#FAE4E1` `#F0796A` `#9E2015` `#331310` |
| `amber` | 25 · 50 · 300 · 800 · 900 · 950 | `#FFF8E8` `#FFF5D8` `#FECB56` `#815908` `#2E2409` `#221D10` | `#FBF4E6` `#F7EBD6` `#E0A03C` `#6F4000` `#2E2109` `#221A0C` |
| `teal` `indigo` `purple` `magenta` `orange` `olive` | 50 · 400 · 700 · 900 | ใช้ค่าเดียวกันทั้ง A และ B — ตามตาราง category ด้านบน (700 = light, 400 = dark, 50 = พื้น light, 900 = พื้น dark) | = A |

step ไม่ได้เรียงห่างเท่ากันทุก ramp เพราะ palette A ต้องได้ค่าเดิมทุกตัว (ไม่เปลี่ยนหน้าตา) — ramp ไม่ใช่สิ่งที่ทีมอื่นเขียนโค้ดอ้างถึง

**palette B `instrument` — เรื่องของสี:** ค่าสีของแอปก่อนรับ FarmMate (`design/tokens.ts` ที่ commit `7bdc160`) ซึ่งเป็นชุดที่ทดสอบในสวนจริงมาแล้ว —
ตัวอักษรเกือบดำบนพื้นเทากลาง, ปุ่มสีน้ำเงินผ้าใบในลานชั่ง (สีเดียวในลานที่ไม่สื่อว่าดีหรือเสีย), เขียว/แดง/อำพันเข้มกว่า A
คือทางกลับไปหา "เครื่องมือวัด" ถ้าทดสอบกลางแดดแล้ว navy อ่านยาก (§12.10 ข้อ 3) บทบาทหลัก (light):
`ink` `#0A0B0C` · `surface` `#F2F3F4` · `action` `#17458C` · `actionSunk` `#E7EDF7` · `accept` `#06542C` · `reject` `#9E2015` · `warn` `#6F4000` · `brand` `#2E9E6B` · `brandStrong` `#1F7A50` · `brandCream` `#FBF4E6` · ตัวเลขนับ 19.70:1

## Acceptance criteria

**palette และ token**

- [x] `design/tokens.ts` มี `PALETTES = { farmmate, instrument }` (ramp ตามตารางด้านบน), `ACTIVE_PALETTE = 'farmmate'` และตารางบทบาทเดียว (`colorFor(palette)` → `{ light, dark }`); `tokens.color` = `colorFor(PALETTES[ACTIVE_PALETTE])`
- [x] type บังคับให้ทุก palette มี ramp/step ครบชุดเดียวกัน — ลบ step หนึ่งจาก B แล้ว `npm run typecheck` ต้องแดง
- [x] ชื่อสีเดิมทั้ง 30 ชื่อใน `tokens.color.light/dark` คงอยู่ และด้วย palette A ค่าเท่าเดิมทุกตัว ยกเว้น `dark.ruleStrong` `#7D8B99` → `#7A8998` (ดู Dev notes)
- [x] เพิ่ม 23 ชื่อใหม่ตามตาราง "รายชื่อ semantic token" — ชื่อ ค่า light/dark ตรงตามตาราง ไม่มีชื่ออื่นเพิ่ม
- [ ] `export type ColorName` ครอบคลุมทั้ง 53 ชื่อ; `src/theme/index.tsx` ไม่ต้องแก้ (ยังใช้ `Record<ColorName, string>`) — **partial:** `Palette` type unchanged; `Theme` gained `shadow`/`layout` in Phase B (Dev notes)
- [x] ramp **ไม่**ถูกส่งออกไปที่ `docs/ux/tokens.css` (ไม่มี `--palette-*`) — หน้าจอและ mockup เข้าถึงได้แค่บทบาท
- [x] หัวไฟล์ `design/tokens.ts` อัปเดต: กฎ "NO IMPORTS, NO FUNCTIONS" ยอมให้มีฟังก์ชันบริสุทธิ์ตัวเดียว `colorFor` ที่เรียกตอนโหลดไฟล์ — `tokens` ที่ export ยังเป็น object ธรรมดา serialize ได้

**tokens.css**

- [x] `npm run tokens` สร้าง `docs/ux/tokens.css` ใหม่ (`emit-tokens.mjs` ไม่ต้องแก้ตรรกะ); diff กับไฟล์เดิม = เพิ่ม 23 ตัวแปร × 4 block + `--color-rule-strong` ใน dark เท่านั้น
- [x] `npm run tokens:check` ผ่าน

**contrast (AA: ตัวอักษร 4.5, UI/ขอบ/ไอคอน 3; ตัวอักษรหลัก 7 ตามเดิม)**

- [x] `scripts/check-contrast.mjs` ตรวจ**ทุก palette ใน `PALETTES`** (ไม่ใช่แค่ตัวที่ active) — palette B ต้องสลับมาใช้ได้ทันทีเสมอ
- [x] เพิ่มคู่สีใหม่ 60 คู่ตามตาราง "ผลคำนวณ contrast" ใน Dev notes (เดิม 36 → 96 คู่ × 2 scheme × 2 palette = 384 การตรวจ) ทั้งหมดผ่าน
- [x] `docs/ux/design-system.md` §3 อัปเดตจำนวนคู่ที่ตรวจ (ตอนนี้ข้อความยังเขียน 46 / 72 ซึ่งเก่าแล้ว)

**ย้ายสีดิบออกจาก `src/`**

- [x] `src/constants/theme.ts` — `Colors` อ่านค่าจาก `tokens.color` (ไม่มี hex): `text`→`ink`, `background`→`surface`, `backgroundElement`→`surfaceSunk`, `backgroundSelected`→`actionSunk`, `textSecondary`→`inkSoft`, เพิ่ม `link`→`action`; ชื่อ key และ type `ThemeColor` เดิมคงอยู่ (ไฟล์ที่ใช้ `Colors`/`ThemeColor` ไม่ต้องแก้)
- [x] `src/components/themed-text.tsx` — `linkPrimary` ใช้ `theme.link` แทน `#3c87f7`
- [x] `src/components/animated-icon.tsx` — gradient ใช้ `brand` → `brandStrong`; พื้น splash overlay ใช้ `stage` (ตรงกับ `backgroundColor: #FFFFFF` ของ splash ใน `app.json` — เลิกกระพริบสีฟ้า Expo)
- [x] `src/components/animated-icon.module.css` — ไม่มีสีใน CSS แล้ว; gradient ย้ายไปเป็น style จาก token ใน `animated-icon.web.tsx` (ไฟล์ CSS เหลือแค่ขนาด/มุม — ไม่ลบไฟล์)
- [x] `src/components/chrome.tsx` แถบบน (`TopBar`) ใช้ `appBar` / `appBarInk` — ให้ token ใหม่มีผู้ใช้จริงอย่างน้อยหนึ่งที่; หน้าตาไม่เปลี่ยน (ค่าเท่ากับ `surface` / `ink`)

**กันสีดิบกลับมา**

- [x] test ใหม่ `scripts/no-raw-colour.test.ts` (vitest — `scripts/*.test.ts` อยู่ใน include แล้ว) อ่านทุกไฟล์ใต้ `src/` (`.ts .tsx .js .jsx .css .json`) แล้วแดงถ้าเจอ hex (`#` + 3/4/6/8 หลัก hex), `rgb(`/`rgba(`, `hsl(`/`hsla(` — รวมใน comment ด้วย ไม่มี allowlist; ข้อความ error บอกไฟล์:บรรทัด และบอกให้ใช้ `theme.color.<ชื่อ>`
- [x] `'transparent'` ใช้ได้ (ไม่ใช่ค่าสี — ใช้อยู่ใน `chrome.tsx`)
- [x] `design/` ไม่ถูกตรวจ (เป็นที่เดียวที่มี hex ได้)

**เอกสาร**

- [x] `docs/ux/design-system.md` เพิ่มหัวข้อ "วิธีเปลี่ยนสี" ภาษาไทย ≤10 บรรทัด (ร่างใน Dev notes) และตาราง §12.2 ชี้มาที่ตารางบทบาทของ story นี้ ระบุ "สีประจำกลุ่มและเงินเข้า/ออกไม่เป็นตัวบอกความหมายอย่างเดียว"
- [ ] หน้าตาหน้าจอที่ใช้ token อยู่แล้วไม่เปลี่ยน (screenshot ก่อน/หลังเหมือนกัน); หน้าจาก template (explore, แท็บ, ลิงก์) เปลี่ยนเป็นสีระบบ — **met for Phase A** (light pixel-identical, dark = ruleStrong only); Phase B then restyles on purpose (Verification)


## Offline / sync behavior

- N/A — การแสดงผลเท่านั้น ไม่แตะข้อมูล ที่เก็บในเครื่อง หรือเครือข่าย

## Test plan

_เขียน test ก่อน (TDD) เห็นแดงก่อนแล้วค่อยทำให้เขียว_

- [x] vitest `scripts/no-raw-colour.test.ts`: (1) ตัวตรวจจับเจอ `'#FFF'`, `'#ffffff80'`, `rgba(0,0,0,.1)`, `hsl(210 20% 50%)`, `linear-gradient(180deg, #3c9ffe, #0274df)` และไม่เจอ `'transparent'`, `'#'` เดี่ยว ๆ; (2) สแกน `src/` จริง — **ต้องแดงก่อนย้าย** (เจอ 4 ไฟล์ 14 บรรทัด) แล้วเขียวหลังย้าย
- [x] vitest `scripts/tokens.test.ts` (ใหม่): `colorFor(PALETTES.farmmate)` เท่ากับค่าเดิมทุกชื่อ (snapshot ของ 30 ค่าเดิม ยกเว้น `dark.ruleStrong`); ทั้งสอง palette ได้ชุดชื่อ 53 ชื่อเท่ากันทั้ง light/dark; ทุกค่าเป็น `#RRGGBB`
- [x] `npm run contrast` — เพิ่มคู่ใหม่ก่อน เห็นแดง (ชื่อ token ยังไม่มี) แล้วเขียวหลังเพิ่ม token; สลับ `ACTIVE_PALETTE = 'instrument'` ชั่วคราว → `tokens:check` แดง (ไฟล์ CSS ต่าง) แต่ `contrast` ยังเขียว → สลับกลับ
- [x] `npm run tokens:check`, `npm run typecheck`, `npm run lint`
- [x] jest-expo: `ThemedText type="linkPrimary"` ได้สี `action`; `TopBar` ได้ `appBar` / `appBarInk`
- [ ] Playwright: screenshot หน้าหลัก / การขาย ก่อน-หลัง ที่ viewport `portrait` ต้องไม่ต่าง (palette A) — done as a manual pixel diff of Phase A shots (light identical); not added to e2e, which deliberately avoids pixel diffs (playwright.config.ts)


## ต้องให้เจ้าของทำ/อนุมัติ

★ = ข้อแนะนำ

1. **ตกลง AC และรายชื่อ token 53 ชื่อ** — หลังตกลง ชื่อจะล็อกให้ทีมอื่นเขียนโค้ดอ้างได้
2. **สีเงินออก (`moneyOut`)** — (a) น้ำเงินเข้ม `ink` + เครื่องหมาย "−" ★ · (b) แดง `reject` · (c) สีใหม่แยก (เช่น ส้มอิฐ)
   เหตุผล: แดงในแอปนี้แปลว่า "ไม่นับ/ยกเลิก/ผิด" (§3) ถ้าค่าใช้จ่ายทุกแถวเป็นแดงจะดูเหมือนผิดทั้งหน้า; แอปธนาคารไทยหลายแอปก็แสดงเงินออกเป็นสีเข้มปกติ + "−" และเงินเข้าเป็นเขียว + "+"
3. **สีประจำกลุ่ม 6 สี** (teal, indigo, purple, magenta, orange, olive) — ★ 6 สี; ถ้ามีกลุ่มเกิน 6 วนสีซ้ำ แต่มีชื่อกำกับเสมอ (สีเป็นของตกแต่ง)
   เลือกเฉดที่ห่างจากสีสัญญาณ (navy/เขียว/แดง/อำพัน) และทุกสีผ่าน ≥4.5 บนพื้นสว่างทุกแบบ (เกินเกณฑ์ 3 เผื่อแดด)
4. **ปุ่มสีเขียวที่มีตัวอักษร** — คำตอบ §12.10 ข้อ 2 (c) อนุญาตปุ่มเขียว แต่ตัวอักษรขาวบน `brandStrong` `#008F6C` = **4.08:1 ไม่ผ่าน AA 4.5** (ไอคอนอย่างเดียวผ่านเกณฑ์ 3)
   (a) `brandStrong` ใช้กับปุ่มไอคอนอย่างเดียว ปุ่มที่มีคำใช้ navy `action` ★ (ตอนนี้ไม่มีหน้าจอไหนใช้ปุ่มเขียวมีคำ) · (b) ทำ `brandStrong` เข้มขึ้นเป็น `#007A5F` (5.32:1) — FAB จะเข้มขึ้นเล็กน้อย
5. **palette B = ชุดสีก่อน FarmMate** เป็นทางเลือกสำรองที่เหมาะไหม — ★ ใช่ เพราะเป็นชุดเดียวที่ทดสอบกลางแดดแล้ว และตอบโจทย์ "ถ้า navy อ่านยากค่อยคุยกันใหม่" (§12.10 ข้อ 3)
6. **component ของ template Expo** (`AnimatedIcon`, `AnimatedSplashOverlay`) — ไม่มีหน้าไหน import `AnimatedIcon` แล้ว (a) ย้ายสีไป token ตาม AC ★ (ไม่ต้องลบไฟล์) · (b) ลบไฟล์ทิ้ง (YAGNI — ต้องให้เจ้าของยืนยันการลบทีละไฟล์)

## Verification

_Filled 2026-10-10 by the implementing agent session (branch `feature/e01-s17-app-design`). Status stays In Progress — AC per D-81 awaiting the owner's review._

- [x] Sandbox run performed: `npm run build:web` (expo export) served by `scripts/serve-dist.mjs`, driven by Playwright on the sandbox Chromium 1194 at 390×844 (light + dark, palette A and B). Full e2e suite green at the end of each phase (last run: 145 passed, 6 skipped). Every commit preceded by `tokens:check`, `contrast` (384 checks), `typecheck`, `lint`, `test:core`, `test:ui`; commit subjects linted with `scripts/release.mjs lint`.
- [x] Screenshots — before: `docs/ux/screenshots/e01-s17/before/` (home, counter top bar + tabs, settlement cards; light/dark) taken from the build before any change.
  Phase A alone (tokens + raw-colour moves, before any restyle) was pixel-diffed against these: **light identical on all three screens**; dark differs only where `ruleStrong` borders are drawn (`#7D8B99` → `#7A8998`, the one intended change). Those Phase A shots were not committed (scratchpad).
- [x] Screenshots — after (Phase B restyle to the v1.1.0 mockups — the look changes **on purpose**, per the plan the owner said "continue" to): `docs/ux/screenshots/e01-s17/after/` — `home-`, `menu-`, `tabbar-counter-`, `cards-settlement-` × `{a,b}-{light,dark}` and the side-by-side `a-vs-b.png`. Palette B shots come from a local build with `ACTIVE_PALETTE = 'instrument'` that was then reverted (never committed).
- [x] Palette switch check (test plan): with `ACTIVE_PALETTE = 'instrument'`, `tokens:check` goes red (CSS differs) and `contrast` stays green (384/384); switched back.
- [x] Type enforcement check: removing `red.950` from palette B makes `npm run typecheck` fail (TS2741); restored.
- [ ] `npm run verify` as one command — not run as a single script; every step in it was run separately (above) with the sandbox Chromium config. `test:rules` (Firestore emulator) was not run — untouched by this story.

## Dev notes

**โครงไฟล์ที่เสนอ (`design/tokens.ts`)** — ร่าง ไม่ใช่โค้ดสุดท้าย:

```ts
const farmmate = { neutral: { 0: '#FFFFFF', 50: '#F7FAFC', /* … */ }, ink: { 50: '#F4F5F6', 900: '#002858' }, primary: { /* … */ }, green: { /* … */ }, /* … */ } as const;
const instrument = { /* ramp และ step ชุดเดียวกัน */ } satisfies PaletteShape;
export const PALETTES = { farmmate, instrument } as const;
export const ACTIVE_PALETTE: keyof typeof PALETTES = 'farmmate';

export function colorFor(p: PaletteShape) {
  return {
    light: { stage: p.neutral[0], surface: p.neutral[50], ink: p.ink[900], action: p.primary[900], /* … 53 ชื่อ */ },
    dark:  { stage: p.neutral[1000], surface: p.neutral[900], ink: p.ink[50], action: p.primary[300], /* … */ },
  };
}
export const tokens = { color: colorFor(PALETTES[ACTIVE_PALETTE]), space: { /* เดิม */ }, /* … */ } as const;
```

ตารางบทบาท → step (light / dark): `stage` n0 / n1000 · `surface` n50 / n900 · `surfaceSunk` n100 / n950 · `surfaceRaised` n0 / n850 · `numeral` `ink` ink900 / ink50 · `inkSoft` n600 / n300 · `inkFaint` n400 / n500 · `inkInverse` n0 / n975 · `rule` n200 / n700 · `ruleFaint` n150 / n800 · `ruleStrong` n400 / n400 · `action` p900 / p300 · `actionHover` p925 / p200 · `actionSunk` p50 / p950 · `accept` g700 / g400 · `acceptSunk` g50 / g950 · `reject` r700 / r300 · `rejectSunk` r50 / r950 · `warn` a800 / a300 · `warnSunk` a50 / a900 · `status*` = accept/warn/reject · `flash*` = accept/reject · `brand` g500 / g400 · `brandStrong` g600 / g400 · `brandLight` g400 / g600 · `brandYellow` a300 / a300 · `brandCream` a25 / a950 · `appBar` n50 / n900 · `appBarInk` ink900 / ink50 · `focusRing` p900 / p300 · `disabledFill` n100 / n950 · `disabledInk` n600 / n300 · `moneyIn` g700 / g400 · `moneyInSunk` g50 / g950 · `moneyOut` ink900 / ink50 · `moneyOutSunk` n100 / n950 · `scrim` ink900 / n1000 · `categoryN` {hue}700 / {hue}400 · `categoryNSunk` {hue}50 / {hue}900

- **ค่าเดียวที่เปลี่ยน:** `dark.ruleStrong` `#7D8B99` → `#7A8998` (ต่างความสว่าง ~1% มองไม่ออก) เพื่อให้ ramp ไม่มีสองค่าที่เกือบซ้ำ; ยังผ่าน 3:1 ทุกพื้น dark (แย่สุด 4.60 บน `surfaceRaised`) — dark เป็นแบบเลือกเปิดเอง ไม่กระทบโหมดกลางแดด
- **palette B ปรับ 1 ค่าจากของเดิม:** `neutral.400` `#7E858C` → `#788087` เพราะของเดิมได้ 2.99:1 บนพื้นจม `#E4E6E8` (คู่ใหม่ `ruleStrong/surfaceSunk`) ตอนนี้ 3.21 และ `inkFaint` ของ B ใช้ step เดียวกับ `ruleStrong` (เดิม `#8A9096`)
- `scrim` เก็บแค่สี ความเข้มอยู่ที่ `opacity.scrim` (0.72) — mockup v1.1.0 ใช้ 0.55 เขียนเองใน `--c-scrim`; ให้ mockup ถัดไปใช้ค่า token (ม่านเข้มกว่าช่วยให้ sheet เด่นกลางแดด)
- `shadow.*.color` (rgba navy) ไม่ย้ายเข้า palette ใน story นี้ — alpha 6–10% เฉดต่างระหว่าง A/B มองไม่เห็น (YAGNI); ถ้า palette ในอนาคตเปลี่ยนเฉดมาก ค่อยย้าย
- mockup ใช้ชื่อย่อ `--c-*` ที่คัดลอกค่ามาเอง — ไม่อยู่ในขอบเขต; mockup ใหม่ควร `@import` `tokens.css` และใช้ `--color-*`
- named colour อื่น (`'white'`, `'black'`) ไม่มีใน `src/` ตอนนี้; ถ้าอยากกันไว้ด้วย เพิ่มใน test เดียวกันได้ (ไม่อยู่ใน AC)
- worktree นี้ไม่มี `node_modules` — typecheck/lint/jest/vitest ต้อง `npm ci` ก่อน (lockfile ไม่เปลี่ยน ไม่ต้องขออนุญาต); `npm run contrast` / `tokens:check` รันด้วย Node 22 ได้เลย

**ผลคำนวณ contrast ของคู่ใหม่** (คำนวณจริงด้วยสูตรเดียวกับ `check-contrast.mjs`; แถว `categoryN` = ค่าแย่สุดของ 6 สี) — ทั้ง 384 การตรวจผ่าน

| คู่ (ตัวหน้า / พื้น) | เกณฑ์ | A light | A dark | B light | B dark |
|---|---|---|---|---|---|
| `ink / brandCream` | 7 | 13.74 | 15.38 | 18.00 | 15.76 |
| `inkSoft / brandCream` | 4.5 | 5.67 | 7.68 | 6.44 | 7.00 |
| `warn / brandCream` | 4.5 | 5.90 | 11.10 | 7.96 | 7.59 |
| `inkSoft / actionSunk` | 4.5 | 5.42 | 7.20 | 6.00 | 6.47 |
| `action / actionSunk` | 4.5 | 13.13 | 7.42 | 7.88 | 6.57 |
| `ruleStrong / surfaceSunk` | 3 | 3.22 | 5.41 | 3.21 | 4.79 |
| `appBarInk / appBar` | 7 | 13.87 | 16.84 | 17.73 | 16.45 |
| `inkSoft / appBar` | 4.5 | 5.72 | 8.41 | 6.35 | 7.31 |
| `action / appBar` | 3 | 13.87 | 8.67 | 8.34 | 7.41 |
| `focusRing / stage` | 3 | 14.54 | 9.91 | 9.27 | 8.67 |
| `focusRing / surface` | 3 | 13.87 | 8.67 | 8.34 | 7.41 |
| `focusRing / surfaceRaised` | 3 | 14.54 | 7.78 | 9.27 | 6.75 |
| `focusRing / surfaceSunk` | 3 | 13.07 | 9.15 | 7.41 | 7.93 |
| `focusRing / actionSunk` | 3 | 13.13 | 7.42 | 7.88 | 6.57 |
| `disabledInk / disabledFill` | 4.5 | 5.39 | 8.87 | 5.64 | 7.81 |
| `ruleStrong / disabledFill` | 3 | 3.22 | 5.41 | 3.21 | 4.79 |
| `moneyIn / surface` | 4.5 | 5.90 | 8.07 | 8.17 | 7.80 |
| `moneyIn / surfaceRaised` | 4.5 | 6.18 | 7.24 | 9.08 | 7.10 |
| `moneyIn / moneyInSunk` | 4.5 | 5.64 | 6.74 | 7.64 | 6.68 |
| `ink / moneyInSunk` | 7 | 13.25 | 14.07 | 16.56 | 14.09 |
| `moneyOut / surface` | 4.5 | 13.87 | 16.84 | 17.73 | 16.45 |
| `moneyOut / surfaceRaised` | 4.5 | 14.54 | 15.10 | 19.70 | 14.98 |
| `moneyOut / moneyOutSunk` | 4.5 | 13.07 | 17.77 | 15.74 | 17.59 |
| `ink / moneyOutSunk` | 7 | 13.07 | 17.77 | 15.74 | 17.59 |
| `categoryN / surface` | 3 | 4.89 | 5.14 | 4.62 | 5.03 |
| `categoryN / surfaceRaised` | 3 | 5.13 | 4.61 | 5.13 | 4.58 |
| `categoryN / surfaceSunk` | 3 | 4.61 | 5.43 | 4.10 | 5.37 |
| `categoryN / categoryNSunk` | 3 | 4.62 | 4.62 | 4.62 | 4.62 |
| `ink / categoryNSunk` | 7 | 12.21 | 11.86 | 16.55 | 11.86 |
| `inkSoft / categoryNSunk` | 4.5 | 5.04 | 5.92 | 5.93 | 5.27 |

(30 แถว = 24 คู่เดี่ยว + 6 แบบ × 6 สี = 60 คู่ใหม่) คู่เดิม 36 คู่ผ่านทั้ง A และ B
คู่ที่ไม่ได้ใส่เพราะไม่ผ่านและเป็นคำถามเจ้าของ: `inkInverse / brandStrong` ที่เกณฑ์ 4.5 = 4.08 (A light) — คำถามข้อ 4
ขอบน้อยสุดที่ควรรู้: `ruleStrong` บนพื้นจม 3.22 (A) — ผ่านแต่ไม่เหลือเผื่อแดดมาก เป็นค่าเดิมจาก FarmMate adoption

**ร่าง "วิธีเปลี่ยนสี" สำหรับ `design-system.md` (≤10 บรรทัด):**

```md
### วิธีเปลี่ยนสี
1. เปลี่ยนทั้งชุด: แก้ `ACTIVE_PALETTE` ใน `design/tokens.ts` เป็น `'farmmate'` หรือ `'instrument'` — บรรทัดเดียว
2. ปรับเฉดสี: แก้ hex ใน ramp ของ palette นั้น (`PALETTES.<ชื่อ>`) — หน้าจอไม่ต้องแก้
3. ให้บทบาทหนึ่งใช้สีอื่น (เช่น เงินออกเป็นแดง): แก้บรรทัดของบทบาทนั้นใน `colorFor` ที่เดียว
4. รัน `npm run tokens` แล้ว `npm run contrast` — ต้องผ่านทุกคู่ ทุก palette
5. commit `design/tokens.ts` กับ `docs/ux/tokens.css` ด้วยกัน
6. ห้ามเขียน hex / rgb() / hsl() ใน `src/` (CI แดง) — หน้าจอใช้ `theme.color.<ชื่อบทบาท>` เท่านั้น
7. สีไม่เป็นตัวบอกความหมายอย่างเดียว: สถานะมีไอคอน + คำ, เงินมี + / −, กลุ่มมีชื่อกำกับ
```

**Implementation notes (2026-10-10)**

- Phase A followed the role → step table above exactly. `scripts/tokens.test.ts` pins the 30 legacy values and the 23 new ones for palette A, and checks that every palette yields the same 53 names as `#RRGGBB`. The `flash*` roles stay after `brandCream`, so the regenerated `tokens.css` diff is pure additions (23 × 4) plus the two dark `--color-rule-strong` lines.
- `scripts/no-raw-colour.test.ts` was seen red first on exactly 4 files / 14 lines, as predicted above. It runs in CI through `test:core` (`scripts/*.test.ts` is already in `vitest.config.ts`).
- `jest.config.js`: the `.css` stub mapper now comes before the `@/` alias, because `@/global.css` used to be parsed as JS. Without that, nothing importing `src/constants/theme.ts` could be component-tested.
- **Deviation from AC "src/theme/index.tsx ไม่ต้องแก้":** `Palette = Record<ColorName, string>` is unchanged, but Phase B adds `shadow` and `layout` to `Theme` so that shared components can read `tokens.shadow.card` / `layout.*` through `useTheme()`.
- **Phase B (owner-approved plan + coordinator priority change):** shell restyled to the v1.1.0 mockups, with shared components under `src/components/ui/`:
  - `screen-header` (ScreenHeader), `sync-pill` (SyncPill), `drawer` (Drawer, MenuSection, MenuItem), `icons` (line icons drawn with Views), `icon-tile` (IconTile, FactRow), `form` (SegmentedControl, RadioCard, FieldLabel, FieldError), `bottom-sheet` (BottomSheet), `type` (AppText, typeStyle, Num).
  - Also new: `src/sync/status.ts` and `src/sync/use-sync-status.ts`.
  - In `components/chrome.tsx`: pill `Button` (`variant` row, `size` large, `icon`), `PinnedActions`, `cardStyle`/`CardLabel`, and a TopBar crumb path.
  - Nothing depends on `react-native-svg`, which is not installed. No dependency was added.
- **Counter keeps the thin `TopBar`, not ScreenHeader.** At 360px landscape the F-9.7 numeral floor (e2e `minHeightRatio` 0.62) has only a few px of slack. Larger chrome failed it at 0.608–0.616 until the top bar was kept at xs padding, snug leading and xxs pill padding. Any future growth of counter chrome must re-run that test.
- **Navigation change:** settings moved from the home bar into the ☰ menu (as in the farm mockup, screen 1). `e2e/language.spec.ts` opens the menu first. The back controls are now chevrons, so the spec checks the accessible name ("รายการ"), not the "← รายการ" text.
- **Sync pill honesty:** there is no backend yet. The pill shows `store.pending()`, so any recorded sale reads "รอส่ง N" and never "ขัดกัน".
- Not done yet (polish pass):
  - the ~20 remaining mono labels on working screens (not swept to `AppText`);
  - the log-row marks ✓ ✗ ⚖ and the ◐/◑ theme-toggle glyph, which the system font renders as a broken half-glyph;
  - IconTile, FactRow, RadioCard, FieldError and BottomSheet are not yet adopted on any screen;
  - the template `app-tabs*.tsx` / `explore.tsx` are unused by the router and were not restyled beyond their colours now coming from roles.
- Committed e2e evidence screenshots under `docs/ux/screenshots/<project>/` and `docs/stories/screenshots/` were restored after each local run, not regenerated. The suite rewrites them on every run, so they still show the pre-restyle look until CI regenerates them.

## Code review

- Reviewer (separate agent/session):
- Findings:
- Resolution:

## QA notes
