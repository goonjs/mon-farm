Story เก็บที่นี่ ไฟล์ละ 1 story แตกมาจาก epic ใน `docs/epics/` ใช้
`docs/templates/story-template.md` เป็นแม่แบบ ดูขั้นตอนทำงานใน `docs/process.md`

## Story ของ PRD v1.0 (2026-10-03) — E01 + E02 เป็น Ready (เจ้าของตกลง AC 2026-10-03); epic อื่นยังเป็น Draft

ห้ามเริ่ม implement จนกว่า Acceptance criteria จะตกลงกันแล้ว (Status → Ready)
story ที่มีหัวข้อ `คำถามเจ้าของ` ต้องได้คำตอบก่อน ❓ = มีคำถามค้าง

ลำดับที่แนะนำ: E01-S01…S08 → E02-S01/S02 → E01-S09 เป็นต้นไป (รวม E01-S15 — ทำก่อน E03) → E03 → E04 → E05 → E06 แล้วต่อ E07–E14

ลำดับแรกของเจ้าของ (D-55; ปรับ D-62/D-64/D-65): E03-S01/S02/S03/S05/S06 (E03-S04 เลื่อนออก) · E11-S01 → S02 → S03 · E06-S03/S04 (E06-S05 ยกเลิก) · คู่กับ flow การขาย E04/E05

### E01 ฐานระบบ — sync, backend, CI — [epic](../epics/e01-foundation-sync.md)

- [E01-S01: เขียนการออกแบบ sync ใน architecture.md (SDD)](e01-s01-sync-design-sdd.md)
- [E01-S02: id ของ event ไม่ซ้ำทั่วโลก + ผู้บันทึก = user + เครื่อง](e01-s02-global-event-ids.md)
- [E01-S03: ที่เก็บข้อมูลบนเว็บ localStorage → IndexedDB](e01-s03-indexeddb-web-store.md)
- [E01-S04: ลบแบบกู้คืนได้ (Soft Delete) + ที่มาของข้อมูล](e01-s04-soft-delete-provenance.md)
- [E01-S05: CI ประหยัดนาที — ข้ามเอกสารล้วน, cache, e2e ใช้ dist เดิม, ประเมิน bun](e01-s05-ci-minutes.md)
- [E01-S06: รันบน Android จริงครั้งแรก (dev client)](e01-s06-android-dev-client.md)
- [E01-S07: Firebase dev/prod (1 โปรเจกต์) + Hosting deploy + preview channel ต่อ PR](e01-s07-firebase-hosting-previews.md)
- [E01-S08: Firestore — event แก้ไม่ได้ + security rules แยกกลุ่มฟาร์ม](e01-s08-firestore-rules.md)
- [E01-S09: sync อัตโนมัติ — outbox ส่งขึ้น + ดึงลง](e01-s09-outbox-sync.md)
- [E01-S10: แสดงสถานะ sync + ปุ่ม "ลองใหม่" เมื่อ error](e01-s10-sync-status-retry.md)
- [E01-S11: ตรวจจับ Conflict + หน้าจอให้เจ้าของเลือก](e01-s11-conflict-resolve.md)
- [E01-S12: คิวรูป/วิดีโอในเครื่อง → Cloud Storage](e01-s12-media-queue.md)
- [E01-S13: ฝัง font Noto Sans Thai + ชุดไอคอนเส้น open-licence](e01-s13-thai-font-and-icons.md)
- ~~[E01-S14: preview A/B รูปแบบ card — เงา+เส้น vs แบน+เส้น](e01-s14-card-style-ab-preview.md)~~ ยกเลิก (D-52)
- [E01-S15: สถานะข้อมูลรายฟิลด์ 6 แบบ + ป้ายใช้ซ้ำ](e01-s15-field-data-states.md)
- [E01-S16: ลบเขตไม่ได้ถ้าคนกรีดของเขตยังมียอดหัก](e01-s16-zone-delete-guard.md) (Superseded โดย E06-S07)
- [E01-S19: ค่าตั้งของเครื่องจำได้บน Android](e01-s19-device-settings-native.md) (Ready — ทำก่อน E05-S11)

### E02 การเข้าใช้ & กลุ่มฟาร์ม — [epic](../epics/e02-access-farm-groups.md)

- [E02-S01: Google Login + ใช้ออฟไลน์ต่อได้หลัง login](e02-s01-google-login.md)
- [E02-S02: สร้างกลุ่มฟาร์ม + กลุ่มเดียวเข้าเลย](e02-s02-create-farm-group.md)
- [E02 v2: Google login + กลุ่มฟาร์มบน v2 shell (rework ของ S01+S02)](e02-v2-login-groups.md)
- [E02-S03: เชิญเจ้าของร่วม → ตอบรับ](e02-s03-invite-and-accept.md)
- [E02-S04: เลือก/สลับกลุ่มฟาร์ม + ออกจากกลุ่ม](e02-s04-pick-switch-leave-group.md)

### E03 ข้อมูลหลัก — [epic](../epics/e03-master-data.md)

- [E03-S01: บุคคลและผู้ซื้อ เป็นข้อมูลหลักที่ sync](e03-s01-people-and-buyers.md)
- [E03-S02: สวน (ที่ดิน) พร้อมประวัติพื้นที่](e03-s02-properties-and-area-history.md)
- [E03-S03: จุดชั่ง (= กอง) และโครงสร้างตั้งต้น](e03-s03-weighing-points-and-seed.md)
- [E03-S04: โซนไม่บังคับ พร้อมประวัติโครงสร้าง](e03-s04-zones-with-history.md) — เลื่อนออกจากลำดับแรก (D-64)
- [E03-S05: มอบหมายคนกรีด ↔ จุดชั่ง แบบมีช่วงเวลา](e03-s05-tapper-assignments.md)
- [E03-S06: ส่วนแบ่งรายคนกรีด + เลิกใช้สัญญาต่อโซนและ `basis`](e03-s06-tapper-share-retire-zone-contracts.md)
- [E03-S07: ค่าตั้งต้นเข่ง และตั้งค่าวันขาย](e03-s07-basket-presets-and-sale-settings.md) ❓
- [E03-S08: ขนาดตัวอักษร S / M / L](e03-s08-text-size-setting.md)

### E04 การชั่งขาย — [epic](../epics/e04-sale-weighing.md)

- [E04-S01: โมเดลการขายใหม่ — จุดชั่ง + เลขเข่งต่อเนื่อง (core)](e04-s01-sale-model-continuous-numbering.md) ❓
- [E04-S02: เริ่มการขาย (สวน → คนกรีด → จุดชั่ง) และหัวการขาย](e04-s02-start-sale-and-header.md)
- [E04-S03: ตรวจศูนย์/tare ตามโหมด และเลือกขนาดเข่ง](e04-s03-zero-tare-check-and-basket-size.md)
- [E04-S04: กดค้างสั้นบันทึกเข่ง + แก้บั๊กสองนิ้วแตะแล้วนับ (S32)](e04-s04-hold-to-record-and-multitouch-fix.md) ❓
- [E04-S05: หน้าชั่งโหมดผู้บันทึก (แนวตั้ง 6 ค่า)](e04-s05-recorder-mode-screen.md)
- [E04-S06: เข่งไม่เต็ม เข่งเชื่อม และ "จบเข่งแล้ว / เป็นเศษ"](e04-s06-partial-and-bridge-baskets.md) ❓
- [E04-S07: โหมดสาธารณะ (ตัวเลขใหญ่ หมุนได้)](e04-s07-public-mode.md)
- [E04-S08: เสียงไทยอ่านเลขเข่ง (และเศษ/ปิดเข่ง)](e04-s08-thai-voice-basket-number.md) ❓
- [E04-S09: ย้อนกลับ / แก้ / ยกเลิก เข่ง](e04-s09-undo-edit-void-baskets.md) ❓
- [E04-S10: บันทึกรวมย้อนหลังต่อจุดชั่ง และแนบรูป/เอกสาร](e04-s10-backfill-bulk-and-attachments.md) ❓
- [E04-S11: สถานะการขาย Draft / Completed / Cancelled + แก้หลัง Completed](e04-s11-sale-status-and-completed-edit.md) ❓
- [E04-S12: ส่งต่อ / รับช่วง การขายระหว่างเครื่อง (ออฟไลน์)](e04-s12-handoff-and-claim.md) ❓
- [E04-S13: รวมข้อมูลด้วย QR ตอนปิดการขาย](e04-s13-qr-merge-at-close.md)
- [E04-S14: จับการนับซ้ำ 7–10 วินาที + ไทม์ไลน์รายเครื่อง](e04-s14-duplicate-detection-timeline.md) ❓
- [E04-S15: ประวัติการบันทึกเข่ง + ย้อนกลับแบบกดค้าง](e04-s15-basket-history-and-hold-undo.md) ❓

### E05 กระทบยอด & สรุปเงิน — [epic](../epics/e05-reconciliation-settlement.md)

- [E05-S01: คำนวณสรุปเงินรายคนกรีด (core)](e05-s01-per-tapper-settlement-core.md)
- [E05-S02: ถามการปัดเศษทุกครั้ง จำค่าล่าสุด](e05-s02-rounding-choice.md)
- [E05-S03: กระทบยอดกับผู้ซื้อ (ตรวจครั้งเดียว)](e05-s03-buyer-reconciliation.md)
- [E05-S04: หน้าสรุปเงิน คนกรีด + เจ้าของ](e05-s04-settlement-screen.md)
- [E05-S05: สถานะการจ่ายแยกกัน + ปิดการขาย](e05-s05-payment-statuses-and-close.md)
- [E05-S06: รายการการขายย้อนหลัง + รายละเอียด](e05-s06-sale-history.md)
- [E05-S08: หน้าเทียบยอดแสดงรายละเอียดยอดขาย](e05-s08-tally-sale-detail.md)

### E06 บัญชีปุ๋ย (+ หนี้คนงานทุกประเภท, D-54) — [epic](../epics/e06-fertilizer.md)

- [E06-S01: บันทึกการซื้อปุ๋ย](e06-s01-fertilizer-purchase.md) ❓
- [E06-S02: แบ่งกระสอบให้คนกรีด + ภาระ 50/50](e06-s02-allocation-and-burden.md) ❓
- [E06-S03: บัญชีหนี้คนงาน — ยอดค้าง แผนผ่อน ประวัติ](e06-s03-tapper-ledger.md)
- [E06-S04: หักหนี้ตอนสรุปเงิน ไม่เกินส่วนแบ่ง ยกยอด](e06-s04-deduct-at-settlement.md)
- ~~[E06-S05: ย้ายข้อมูลหัก S29 เดิม เข้าบัญชีคนกรีด](e06-s05-migrate-s29-deductions.md)~~ ยกเลิก (D-65 — ลบโค้ดเก่าใน E06-S04)
- [E06-S06: แผนปุ๋ย (ไม่บังคับ) → ค่าใช้จ่ายวางแผน](e06-s06-fertilizer-plan.md)
- [E06-S07: ลบโค้ดหักเงิน S29 เดิม](e06-s07-remove-s29-code.md) (Done) — การหักเงินใหม่อยู่ที่ [E06-S04](e06-s04-deduct-at-settlement.md)
- [E06-S08: ป้าย "เงินคืนหนี้ ยังไม่ได้รับ" บนบัญชีหนี้คนงาน](e06-s08-pending-repay-chip.md) (In Progress — เจ้าของตกลง AC 2026-11-01; แยกจาก E05-S11 CO-25)

### E07 งานในสวน — [epic](../epics/e07-field-operations.md)

- [E07-S01: บันทึกการตรวจสวน — โน้ต + ตำแหน่ง](e07-s01-inspection-note.md) ❓
- [E07-S02: แนบรูป/วิดีโอ/เสียง ออฟไลน์](e07-s02-media-and-voice.md) ❓
- [E07-S03: เช็กลิสต์สุขภาพต้นยาง](e07-s03-tree-health-checklist.md) ❓
- [E07-S04: จำนวนต้นยาง ประมาณ → ยืนยัน พร้อมประวัติ](e07-s04-tree-count-history.md)
- [E07-S05: บันทึกเหตุการณ์ (ไม่มีค่าใช้จ่ายก็ได้)](e07-s05-incidents.md) ❓
- [E07-S06: ไทม์ไลน์เหตุการณ์](e07-s06-incident-timeline.md)
- [E07-S07: บันทึกบริบท + สร้างเหตุการณ์/งานจากการตรวจสวน](e07-s07-context-log-and-create-from-inspection.md)

### E08 งาน & การแจ้งเตือน — [epic](../epics/e08-tasks-notifications.md)

- [E08-S01: งาน — สร้าง แก้ สถานะ ผูกต้นเรื่อง](e08-s01-tasks-basic.md) ❓
- [E08-S02: งานที่ระบบแนะนำ — สร้าง / ไม่จำเป็น / ดูข้อมูลเพิ่ม](e08-s02-suggested-tasks.md)
- [E08-S03: ตั้งค่าการแจ้งเตือน — เลือกเปิดรายงาน ผู้รับ ความถี่](e08-s03-notification-preferences.md) ❓
- [E08-S04: รับ push บนเครื่อง (FCM)](e08-s04-push-device-registration.md) ❓
- [E08-S05: ตัวส่งแจ้งเตือนตามเวลา ฝั่ง server + ไม่ส่งซ้ำ](e08-s05-scheduled-sender.md) ❓

### E09 เอกสารคนงาน — [epic](../epics/e09-worker-documents.md)

- [E09-S01: ครอบครัวและสมาชิก](e09-s01-families-and-members.md)
- [E09-S02: บันทึกเอกสารพร้อมรูป](e09-s02-document-records.md)
- [E09-S03: เตือนเอกสารใกล้หมดอายุ](e09-s03-expiry-reminders.md) ❓
- [E09-S04: ต่ออายุเอกสารและประวัติ](e09-s04-renewal-and-history.md)

### E10 สต็อก — [epic](../epics/e10-inventory.md)

- [E10-S01: รายการสต็อกและเกณฑ์ใกล้หมด](e10-s01-stock-items.md) ❓
- [E10-S02: รับเข้า ใช้ออก และตรวจนับ](e10-s02-stock-transactions.md) ❓
- [E10-S03: ธงสต็อกใกล้หมดบนหน้าแรก](e10-s03-low-stock-flag.md)

### E11 การเงินสวน — [epic](../epics/e11-finance.md)

- [E11-S01: ค่าใช้จ่ายและวงจร Actual / Committed / Planned](e11-s01-expenses-and-lifecycle.md)
- [E11-S02: ผู้จ่ายจริงและเงินที่ต้องคืน](e11-s02-payer-and-reimbursement.md)
- [E11-S03: บันทึกการคืนเงินและยอดคงเหลือ](e11-s03-repayments.md) — ลำดับแรก ต่อจาก S02 (D-62)
- [E11-S04: เงินเดือนผู้จัดการสวน](e11-s04-manager-salary.md) ❓
- [E11-S05: เงินช่วยเหลือพิเศษคนงาน](e11-s05-worker-special-payments.md) ❓
- [E11-S06: การเดินทางหลายวัตถุประสงค์](e11-s06-travel-multi-purpose.md)
- [E11-S07: รายได้และสัญญาเช่าทุเรียน](e11-s07-income-and-leases.md) ❓
- [E11-S08: กระแสเงินสดรายเดือนและเงินสำรอง](e11-s08-cashflow-and-reserve.md)
- [E11-S11: ใบซื้อ — จดใบสั่งของร้านก่อน บอกรายละเอียดปุ๋ยทีหลัง](e11-s11-fertilizer-order.md) — Done (PR #121, #122)
- [E11-S12: พูดเพื่อบันทึกใบซื้อ](e11-s12-voice-entry-idea.md) — ไอเดีย ยังไม่เริ่ม

### E12 สภาพอากาศ — [epic](../epics/e12-weather.md)

- [E12-S01: พิกัดสวนและชั้นผู้ให้บริการอากาศ](e12-s01-weather-provider-layer.md) ❓
- [E12-S02: เก็บอากาศจริงรายวันต่อสวน](e12-s02-daily-actual-weather.md) ❓
- [E12-S03: หน้าพยากรณ์อากาศ](e12-s03-forecast-view.md) ❓
- [E12-S04: แจ้งเตือนอากาศตามกฎ → แนะนำงาน](e12-s04-weather-rule-alerts.md) ❓

### E13 หน้าแรก & การวิเคราะห์ — [epic](../epics/e13-dashboard-analytics.md)

- [E13-S01: หน้าวันนี้](e13-s01-today-view.md) ❓
- [E13-S02: Timeline ทุกเหตุการณ์](e13-s02-timeline.md)
- [E13-S03: กราฟ กก., กก./ไร่, ราคา, รายได้](e13-s03-yield-price-charts.md) ❓
- [E13-S04: ช่วงเปรียบเทียบ](e13-s04-comparison-periods.md) ❓
- [E13-S05: ระยะห่างการขายและเหตุผล](e13-s05-sale-interval-reasons.md) ❓
- [E13-S06: KPI การเงินและปุ๋ยเทียบผลผลิต](e13-s06-finance-kpis.md)
- [E13-S07: เจาะลงถึงข้อมูลต้นทาง](e13-s07-drill-through.md)

### E14 AI ช่วยวิเคราะห์ — [epic](../epics/e14-ai-assistance.md)

- [E14-S01: AI endpoint ฝั่ง server](e14-s01-ai-server-endpoint.md) ❓
- [E14-S02: คำตอบมีป้ายและอ้างหลักฐาน](e14-s02-labelled-answers.md)
- [E14-S03: ปุ่ม อธิบาย / ดูที่มา / ถามต่อ บนกราฟ](e14-s03-chart-explain-trace.md)
- [E14-S04: แชตถามเรื่องสวนเป็นภาษาไทย](e14-s04-chat-with-context.md) ❓
- [E14-S05: AI เตรียมคำสั่ง แสดงสิ่งที่จะเปลี่ยน รอยืนยัน](e14-s05-prepared-actions.md)
- [E14-S06: AI จัดประเภทการตรวจสวน](e14-s06-inspection-classification.md) ❓

## ประวัติ (PRD v0.4, ถูกแทนแล้ว)

- `s1-…` ถึง `s32-…` — story ของ v0.4 เก็บไว้เป็นประวัติ; story ใหม่อ้างถึงว่าแทน/ต่อยอดตัวไหน
