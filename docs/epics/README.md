Epic เก็บที่นี่ ไฟล์ละ 1 epic แตกมาจาก `docs/prd.md` ใช้
`docs/templates/epic-template.md` เป็นแม่แบบ

## Epic ของ PRD v1.0 (2026-10-03) — แบบสั้น เจ้าของแก้ได้ตรงๆ

ลำดับที่แนะนำ: E01 → E02 → E03 → E04 → E05 → E06 แล้วต่อ E07–E14

| Epic | โมดูล |
|---|---|
| [E01 ฐานระบบ — sync, backend, CI](e01-foundation-sync.md) | SYNC, NFR |
| [E02 การเข้าใช้ & กลุ่มฟาร์ม](e02-access-farm-groups.md) | ACC |
| [E03 ข้อมูลหลัก](e03-master-data.md) | MD |
| [E04 การชั่งขาย](e04-sale-weighing.md) | SALE |
| [E05 กระทบยอด & สรุปเงิน](e05-reconciliation-settlement.md) | SET |
| [E06 บัญชีปุ๋ย](e06-fertilizer.md) | FERT |
| [E07 งานในสวน](e07-field-operations.md) | OPS |
| [E08 งาน & การแจ้งเตือน](e08-tasks-notifications.md) | TASK |
| [E09 เอกสารคนงาน](e09-worker-documents.md) | DOC |
| [E10 สต็อก](e10-inventory.md) | INV |
| [E11 การเงินสวน](e11-finance.md) | FIN |
| [E12 สภาพอากาศ](e12-weather.md) | WX |
| [E13 หน้าแรก & การวิเคราะห์](e13-dashboard-analytics.md) | ANA |
| [E14 AI ช่วยวิเคราะห์](e14-ai-assistance.md) | AI |

## ประวัติ (PRD v0.4, ถูกแทนแล้ว)

- `epic-1-run-and-settle-one-sale.md`, `epic-2-second-field-round.md` — ลบออก
  แล้ว (เจ้าของยืนยัน 2026-10-03) ขอบเขตย้ายไปอยู่ E01, E03–E06 ดูฉบับเก่าได้ด้วย
  `git show b729e57:docs/epics/<ชื่อไฟล์>`
