/**
 * Marks (Σ ↘ ›) are added in code (MARK / MORE), never stored here: the catalogue keeps to the glyphs every font carries (resolve.test.ts).
 *
 * E06-S08 strings: repayments not received yet, buyer owes the farm (D-87).
 * Thai is the source; English is partial. Spread into `messages.ts`.
 * Keep keys under the 'rp.' prefix so parallel workers never touch the same lines.
 */
export const th = {
  // ── debt list (M1 · PR-4, PR-12) ───────────────────────────────────────────
  'rp.list.sumTitle': 'รอเงินคืนหนี้เข้า',
  'rp.list.sumTotal': 'รอเงินเข้า',
  'rp.list.chip': 'หนี้ลดแล้ว · รอเงิน',
  // ── account card (M2–M4 · PR-1, PR-3) ──────────────────────────────────────
  'rp.card.title': 'เงินคืนหนี้ ยังไม่ได้รับ',
  'rp.card.sub': 'หนี้ลดแล้ว · รอเงินเข้าสวน',
  'rp.card.sale': 'ขาย {date}',
  'rp.card.repay': 'คืนหนี้ {amount}',
  'rp.card.total': 'รอเงินเข้ารวม',
  'rp.how.transfer': 'รอคนซื้อโอน',
  'rp.how.cash': 'รอเงินสดจากคนซื้อ',
  'rp.how.picked': 'ยังไม่ได้หยิบจากส่วนแบ่ง{name}',
  // ── received sheet (M5, M5b, M10 · PR-5, PR-7, PR-15) ─────────────────────
  'rp.sheet.title': 'รับเงินคืนหนี้แล้วหรือยัง',
  'rp.sheet.titlePicked': 'หยิบเงินคืนหนี้จากส่วนแบ่ง{name}แล้วหรือยัง',
  'rp.sheet.sub': '{name} · ขาย {date}',
  'rp.sheet.repay': 'คืนหนี้{name}',
  'rp.sheet.route': 'ทาง',
  'rp.route.transfer': 'โอนรวมเข้าบัญชีสวน',
  'rp.route.cash': 'คนซื้อแยกเงินสด',
  'rp.route.picked': 'หยิบจากส่วนแบ่ง{name}',
  'rp.sheet.bundle': 'เงินโอนก้อนนี้ (เทียบกับแอปธนาคาร)',
  'rp.sheet.ownerPart': 'ส่วนสวน',
  'rp.sheet.transferTotal': 'โอนรวม',
  'rp.sheet.full': 'ได้ครบ {amount}',
  'rp.sheet.less': 'ได้น้อยกว่านี้',
  'rp.sheet.openSale': 'เปิดการขาย',
  'rp.sheet.pickedFull': 'หยิบครบ {amount}',
  'rp.sheet.pickedFix': 'ไม่ได้หยิบ / ไม่ครบ · แก้ที่การขาย',
  'rp.sheet.undoTick': 'ยังไม่ได้รับ',
  'rp.sheet.close': 'ปิด',
  'rp.sheet.locked': 'มีเรื่องต้องแก้ที่หน้าจ่ายเงินก่อน',
  // ── received-amount sheet (M7, M9 · PR-15, PR-16, PR-19) ───────────────────
  'rp.amt.titleTransfer': 'ได้เงินโอนทั้งก้อนเท่าไหร่',
  'rp.amt.titleCash': 'ได้เงินสดคืนหนี้เท่าไหร่',
  'rp.amt.subTransfer': 'ขาย {date} · ควรได้ {amount}',
  'rp.amt.subTransferFull': 'ขาย {date} · {buyer} · รวมคืนหนี้{names} · ควรได้ {amount}',
  'rp.amt.subCash': '{name} · ขาย {date} · ควรได้ {amount}',
  'rp.amt.got': 'ได้จริง',
  'rp.amt.expected': 'ควรได้',
  'rp.amt.owes': 'คนซื้อค้างสวน',
  'rp.amt.debtSame': 'หนี้{name} ไม่เปลี่ยน',
  'rp.amt.withBuyer': 'อยู่กับคนซื้อ',
  'rp.amt.withWorker': 'คนซื้อให้{name}ไปแล้ว',
  'rp.amt.workerHolds': 'เงินอยู่กับ{name} หนี้ยังไม่ได้จ่าย',
  'rp.amt.save': 'บันทึก ได้ {amount}',
  'rp.amt.saveNone': 'บันทึก ไม่ได้รับ',
  'rp.amt.over': 'ใส่ได้ไม่เกิน {amount}',
  'rp.amt.fixAtSale': 'แก้ที่การขาย',
  // ── undo bar (P3 · PR-13) ─────────────────────────────────────────────────
  'rp.undo.full': 'บันทึกแล้ว · ได้ครบ {amount}',
  'rp.undo.less': 'บันทึกแล้ว · ได้ {amount}',
  'rp.undo.none': 'บันทึกแล้ว · ไม่ได้รับ',
  'rp.undo.reopened': 'บันทึกแล้ว · ยังไม่ได้รับ',
  'rp.undo.action': 'เลิกทำ',
  // ── history (M6 · PR-6) ───────────────────────────────────────────────────
  'rp.hist.received': 'รับเงินแล้ว',
  'rp.hist.short': 'คนซื้อค้างสวน {amount}',
  // ── home (H1, H2 · PR-14, PR-16) ──────────────────────────────────────────
  'rp.home.waiting': 'เงินคืนหนี้ ยังไม่เข้าสวน · รอคนซื้อ',
  'rp.home.sum': 'รวม',
  'rp.home.owes': 'คนซื้อค้างสวน · ขาย {date}',
  'rp.home.owesBuyer': 'คนซื้อค้างสวน · ขาย {date} · {buyer}',
  'rp.home.transferPart': 'ส่วนโอน',
  'rp.home.cashPart': 'ส่วนเงินสด ({name}จ่ายแล้ว)',
  // ── payment page (P1, P2 · PR-16, PR-17, PR-20) ───────────────────────────
  'rp.pay.owes': 'คนซื้อค้างสวน {amount}',
  'rp.pay.less': 'ได้น้อยกว่านี้',
  'rp.pay.pickFix': 'ไม่ได้หยิบ / หยิบไม่ครบ',
  'rp.pick.title': 'หยิบเงินคืนหนี้จากส่วนแบ่ง{name}ได้เท่าไหร่',
  'rp.pick.sub': '{name} · หักไว้ {amount}',
  'rp.pick.got': 'หยิบได้',
  'rp.pick.debtBack': 'หนี้{name} จะกลับเป็น',
  'rp.pick.payMore': 'จ่าย{name}เพิ่ม ({name}ถือไว้แล้ว)',
  'rp.pick.save': 'บันทึก หยิบได้ {amount}',
  'rp.pick.saveNone': 'บันทึก ไม่ได้หยิบ',
  // PR-19: the buyer handed the repayment to the worker (review 2026-11-01)
  'rp.fix.titleHanded': 'เงินคืนหนี้{name} ถึงสวนเท่าไหร่',
  'rp.fix.gotHanded': 'สวนได้',
  'rp.fix.save': 'บันทึก สวนได้ {amount}',
  'rp.fix.saveNone': 'บันทึก สวนไม่ได้เลย',
  'rp.fix.choose': 'คนซื้อให้ใครไปแล้ว',
  'rp.src.received': 'ได้จริง',
  'rp.src.owes': 'คนซื้อค้างสวน',
  'rp.src.owesTransfer': 'ขาดโอน {amount}',
  'rp.src.owesCash': 'เงินสดคืนหนี้{name} {amount}',
  'rp.src.equation': 'ได้จริง + คนซื้อค้างสวน = ยอดขาย',
} as const;
export const en: Record<string, string> = {};
