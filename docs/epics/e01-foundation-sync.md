# Epic E01: ฐานระบบ — sync, backend, CI

สถานะ: Draft
PRD: SYNC, NFR-2/3/5/6 · architecture.md หัวข้อ "2026-10-02 Direction"

## เป้าหมาย
- event log เดียว sync ข้ามมือถือ 3 เครื่อง + เว็บ ใช้ offline ได้ก่อน ไม่ทับข้อมูลเงินแบบเงียบๆ

## ขอบเขต
- เปลี่ยน id ของ event log: id ไม่ซ้ำทั่วโลก (UUIDv7/ULID), เลขลำดับต่อเครื่อง, ผู้บันทึก = user + เครื่อง
- ที่เก็บข้อมูลบนเว็บ: localStorage → IndexedDB
- Firebase 1 โปรเจกต์ (Blaze, budget alert, asia-southeast3 (กรุงเทพฯ)) แยก dev/prod ด้วย Hosting site + Firestore database + Storage bucket คนละตัว (D-34)
- Firestore: event เป็นเอกสารแก้ไม่ได้, rules ให้สร้างอย่างเดียว, แยกข้อมูลตามกลุ่มฟาร์ม
- outbox ส่งขึ้น + snapshot ดึงลง; sync อัตโนมัติเมื่อมีเน็ต; retry อัตโนมัติ
- สถานะต่อการขาย + ภาพรวม: Synced / Pending Sync / Conflict; ปุ่มลองใหม่เมื่อ error
- ตรวจจับ conflict (แก้ซ้อนบนฐานเดียวกัน) + หน้าจอให้เลือก
- ลบแบบกู้คืนได้ (Soft Delete) / กู้คืน เป็น event ใช้กับทุกรายการ; เก็บที่มาของข้อมูล
- สถานะข้อมูลรายฟิลด์ 6 แบบ (SYNC-12): type กลาง + ป้ายไทย + component ป้ายตัวเดียว (E01-S15); การใช้ในหน้าจออยู่ใน story ที่ต้องใช้
- คิวรูป/วิดีโอ → Cloud Storage
- CI: รันเฉพาะ push main + PR, เอกสารล้วนข้าม, verify → e2e → preview, cache browser
- Firebase Hosting preview channel ต่อ PR (site dev, database `dev`); หมดอายุ 7 วัน + ลบเมื่อปิด PR (ADR 0001)
- รันบน Android จริงครั้งแรก (dev client)
- ฝัง font Noto Sans Thai (OFL) ผ่าน expo-font + วัดขนาดแอป
- ชุดไอคอนเส้น open-licence (แนะนำ @expo/vector-icons) — ตรวจ dependency ก่อน
- preview A/B: card มีเงา+เส้น vs แบน+เส้น กลางแดด
- ประเมินใช้ bun เป็นตัวติดตั้งใน CI (เร็วกว่า; ต้องตรวจ dependency tree ใหม่ + trustedDependencies)

## ไม่รวม
- ส่งต่อ/QR (อยู่ E04), Bluetooth (หลัง MVP)

## ประเด็นค้าง
- ชื่อแอป FarmMate (D-35): เปลี่ยน `app.json` `name` และชื่อที่แสดง — ยังไม่มี story
