# Epic E01: ฐานระบบ — sync, backend, CI

สถานะ: Draft
PRD: SYNC, NFR-2/3/5/6 · architecture.md หัวข้อ "2026-10-02 Direction"

## เป้าหมาย
- event log เดียว sync ข้ามมือถือ 3 เครื่อง + เว็บ ใช้ offline ได้ก่อน ไม่ทับข้อมูลเงินแบบเงียบๆ

## ขอบเขต
- เปลี่ยน id ของ event log: id ไม่ซ้ำทั่วโลก (UUIDv7/ULID), เลขลำดับต่อเครื่อง, ผู้บันทึก = user + เครื่อง
- ที่เก็บข้อมูลบนเว็บ: localStorage → IndexedDB
- Firebase โปรเจกต์ dev + prod (Blaze, budget alert, asia-southeast1)
- Firestore: event เป็นเอกสารแก้ไม่ได้, rules ให้สร้างอย่างเดียว, แยกข้อมูลตามกลุ่มฟาร์ม
- outbox ส่งขึ้น + snapshot ดึงลง; sync อัตโนมัติเมื่อมีเน็ต; retry อัตโนมัติ
- สถานะต่อรายการ + ภาพรวม: Synced / Pending Sync / Conflict; ปุ่มลองใหม่เมื่อ error
- ตรวจจับ conflict (แก้ซ้อนบนฐานเดียวกัน) + หน้าจอให้เลือก
- ลบแบบกู้คืนได้ (Soft Delete) / กู้คืน เป็น event; เก็บที่มาของข้อมูล
- คิวรูป/วิดีโอ → Cloud Storage
- CI: รันเฉพาะ push main + PR, เอกสารล้วนข้าม, verify → e2e → preview, cache browser
- Cloud Run preview ต่อ PR; ลบเมื่อปิด PR + ลบเองหลัง 7 วัน; เก็บ image ไม่เกิน 2 / 30 วัน
- รันบน Android จริงครั้งแรก (dev client)
- ประเมินใช้ bun เป็นตัวติดตั้งใน CI (เร็วกว่า; ต้องตรวจ dependency tree ใหม่ + trustedDependencies)

## ไม่รวม
- ส่งต่อ/QR (อยู่ E04), Bluetooth (หลัง MVP)

## ประเด็นค้าง
- 
