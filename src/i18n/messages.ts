/**
 * The string catalogue. Thai is the SOURCE, English is the second locale.
 *
 * That ordering is not a formality. The people this app is for work in Thai,
 * and the domain vocabulary in the code — เข่ง, กอง, โซน, ล้ง, ตะกร้า — is
 * already the real vocabulary rather than a translation of an English design.
 * So `th` is authored, complete, and the fallback for everything; `en` exists
 * for a non-Thai buyer at the scale, or a developer reading a screen.
 *
 * ── Rules for editing this file ──────────────────────────────────────────────
 *
 * ONE ENTRY PER MESSAGE, and `th` is where a new one starts. `MessageId` is
 * derived from `th`, so a string that does not exist in Thai cannot be
 * referenced at all — the type system enforces the source-locale rule rather
 * than a convention nobody remembers.
 *
 * NO CONCATENATION AT THE CALL SITE. A sentence assembled from fragments in
 * JSX cannot be reordered by a translator, and Thai and English do not order
 * the same. Use one entry with `{placeholders}` instead, even when the English
 * happens to come out in the same order.
 *
 * NO WEB FONTS, so no glyph the system stack may not carry: Thai, Latin, and
 * the handful of symbols the design system already uses. `resolve.test.ts`
 * enforces this — a box glyph on the counter screen is a label nobody can
 * read, in any language.
 *
 * The `·` that used to join the two languages on screen is gone from labels
 * by design. It survives only where it is genuinely a separator between two
 * data values, not two languages.
 */

export type Locale = 'th' | 'en';

/**
 * Thai — the source. Every id in the app exists here.
 */
const th = {
  // ── Shared vocabulary ────────────────────────────────────────────────────
  'common.cancel': 'ยกเลิก',
  'common.confirm': 'ยืนยัน',
  'common.back': 'กลับ',
  'common.next': 'ต่อไป',
  'common.save': 'บันทึก',
  'common.kg': 'กก.',
  'common.baskets': 'เข่ง',
  'common.themeLight': 'สว่าง',
  'common.themeDark': 'มืด',
  'common.language': 'ภาษา',

  // ── The counter screen's tabs and stage ──────────────────────────────────
  'tabs.count': 'นับ',
  'tabs.pile': 'กอง',
  'tabs.log': 'บันทึก',

  'hold.label': 'ตัวนับ กดค้างเพื่อนับหนึ่งเข่ง',
  'hold.counted': '✓ นับแล้ว',
  'hold.movedOff': '✗ ไม่นับ นิ้วเลื่อนออกจากปุ่ม',
  'hold.releasedEarly': '✗ ไม่นับ ปล่อยเร็วไป {seconds} วิ',
  'hold.rotate': 'หมุนจอเพื่อดูตัวเลขชัดขึ้น',

  // ── Short basket (F-22) ──────────────────────────────────────────────────
  'short.title': 'เข่งไม่เต็ม ชั่งได้เท่าไหร่ (กก.) น้ำหนักรวม',
  'short.readingLabel': 'ตาชั่งอ่านได้ (รวมตะกร้า) กก.',
  'short.derivation': 'ยางสุทธิ = ชั่งได้ {reading} − ตะกร้า {tare} = {net} กก.',
  'short.log': 'บันทึกเข่งนี้',
  'short.open': 'เข่งไม่เต็ม',

  // ── The zero / tare gate (S9) ────────────────────────────────────────────
  'gate.step': 'ขั้นที่ {step} จาก 3',
  'gate.zeroQuestion': 'ไม่มีอะไรบนตาชั่ง — ขึ้นศูนย์ไหม?',
  'gate.zeroYes': 'ใช่ ขึ้นศูนย์',
  'gate.zeroNo': 'ไม่ใช่',
  'gate.zeroReading': 'ขึ้นเลขอะไร (กก.)',
  'gate.flagAndContinue': 'บันทึกไว้แล้วนับต่อ',
  'gate.tareQuestion': 'ชั่งตะกร้าเปล่า ตาชั่งขึ้นเท่าไหร่?',
  'gate.tareConfirm': 'ยืนยันน้ำหนักตะกร้า',
  'gate.expected': '{tare} + {std} = {expected} กก.',
  'gate.ready': 'เริ่มนับได้',
  'gate.readAloud': 'อ่านออกเสียงก่อนเข่งแรก',

  // ── The announced register (FR-11) — ALWAYS THAI ─────────────────────────
  //
  // Everything under `say.` is spoken aloud, or is a quotation on screen of
  // something spoken aloud. It does NOT follow the UI locale, and there is no
  // English column for any of it — see the note at the foot of this file.
  'say.ready': 'พร้อมค่ะ',
  'say.count': '{n}',
  'say.next': 'ต่อไปค่ะ',

  // ── Reopen (lifecycle §7.2) ──────────────────────────────────────────────
  'reopen.title': 'เปิด {target} อีกครั้ง',
  'reopen.reasonPlaceholder': 'เหตุผลที่เปิดอีกครั้ง',
  'reopen.areYouSure': 'แน่ใจนะ? การเปิดอีกครั้งจะถูกบันทึกไว้',
  'reopen.confirm': 'ยืนยันเปิดอีกครั้ง',
  'reopen.pileConsequence': 'กองนี้จะกลับมานับต่อได้ บันทึกเดิมยังอยู่ครบ',
  'reopen.zoneConsequence': 'โซนนี้จะเปิดอีกครั้ง แต่กองที่ปิดไว้จะยังปิดอยู่',
  'reopen.saleConsequence': 'การขายจะกลับมาแก้ไขได้ ผลสรุปจะคำนวณใหม่',

  // ── The counter screen ───────────────────────────────────────────────────
  'counter.loading': 'กำลังโหลด…',
  'counter.miniCount': 'นับ {n}',
  'counter.counting': 'กำลังนับ',
  'counter.stopped': 'หยุด',
  'counter.clockSuspect': 'เวลาผิด',
  'counter.speechDegraded': 'เสียงพูดไม่ทำงาน',
  'counter.switcher': 'โซน/กอง',
  'counter.pileNotReady': 'กองยังไม่พร้อม',
  'counter.undo': 'ยกเลิกเข่งล่าสุด',
  'counter.mistapReason': 'กดพลาด',
  'counter.undoDetail':
    'ยกเลิกเข่ง #{seq} — {kind} {weight} กก. จะกลายเป็นรายการที่ถูกยกเลิกในบันทึก ไม่ใช่การลบ',
  'counter.undoConfirm': 'ยืนยันยกเลิก',
  'counter.undoCancel': 'พัก',
  'counter.closeSale': 'ปิดการขาย',
  'counter.closeSaleTitle': 'ปิดการขาย?',
  'counter.closeSaleDetail': '{zones} โซน {piles} กอง — นับได้ {baskets} เข่ง {weight} กก.',
  'counter.closeSaleStillCounting':
    'ยังนับอยู่ {n} กอง จะหยุดนับทันที (ไม่ได้ถูกปิดให้อัตโนมัติ)',
  'counter.closeSaleAfter': 'จะคำนวณผลสรุปทันที และเปิดการขายใหม่ได้ภายหลัง',
  'counter.closeSaleConfirm': 'ยืนยันปิดการขาย',

  // ── The pile panel ───────────────────────────────────────────────────────
  'pile.thisPile': '{name}',
  'pile.standard': 'เข่งมาตรฐาน',
  'pile.short': 'เข่งไม่เต็ม',
  'pile.weight': 'น้ำหนักรวม',
  'pile.scale': 'ตาชั่ง',
  'pile.tare': 'นน. ตะกร้าเปล่า',
  'pile.stdNet': 'นน. ยางต่อเข่ง',
  'pile.expected': 'ต้องอ่านได้',
  'pile.rollups': 'รวม',
  'pile.wholeSale': 'ทั้งการขาย',
  'pile.allBaskets': 'เข่งทั้งหมด',
  'pile.closeReopen': 'ปิด / เปิดอีกครั้ง',
  'pile.close': 'ปิดกอง',
  'pile.closeDetail': 'ปิด {name} — {baskets} เข่ง {weight} กก. จะหยุดนับทันที',
  'pile.closeConfirm': 'ยืนยันปิดกอง',
  'pile.reopen': 'เปิดกองอีกครั้ง',
  'pile.notStarted': 'กองยังไม่เริ่ม',
  'zone.close': 'ปิดโซน',
  'zone.closeDetail': 'ปิด {name} — {baskets} เข่ง {weight} กก.',
  'zone.closeWarning': 'ยังนับอยู่ {n} กอง จะถูกปิดไปด้วย: {names}',
  'zone.closeConfirm': 'ยืนยันปิดโซน',
  'zone.reopen': 'เปิดโซนอีกครั้ง',

  // ── The zone / pile switcher ─────────────────────────────────────────────
  'switcher.title': 'เลือกโซนและกอง',
  'switcher.close': '✕',
  'switcher.zoneRow': '{name} · {status}',
  'switcher.pileRow': '{name} · {status}',
  'status.notStarted': 'ยังไม่เริ่ม',
  'status.counting': 'กำลังนับ',
  'status.closed': 'ปิดแล้ว',
  'status.open': 'เปิดอยู่',

  // ── The people picker (S16) ──────────────────────────────────────────────
  'people.loading': 'กำลังโหลดรายชื่อ…',
  'people.change': 'เปลี่ยน',
  'people.empty': 'ยังไม่มีรายชื่อ',
  'people.namePlaceholder': 'ชื่อคนงาน',
  'people.add': 'เพิ่ม',
  'people.addNew': '+ เพิ่มคนงานใหม่',

  // ── The weight input (F-22) ──────────────────────────────────────────────
  'weight.dragHint': 'ลากเพื่อปรับ',

  // ── The pile-closed decision point (S13) ─────────────────────────────────
  'closed.title': 'ปิดกองแล้ว',
  'closed.total': '{name} — {baskets} เข่ง · {weight} กก.',
  'closed.nextPile': 'กองถัดไปในโซนนี้ →',
  'closed.switchZone': 'เปลี่ยนโซน',
  'closed.closeZone': 'ปิดโซนนี้',

  // ── Device settings ──────────────────────────────────────────────────────
  'storage.notDurable': 'ไม่ได้บันทึกถาวร — เบราว์เซอร์นี้เก็บข้อมูลไม่ได้ ถ้าโหลดหน้าใหม่หรือปิดแท็บ ข้อมูลจะหาย',
  // ── Data state (SYNC-12, E01-S15) ────────────────────────────────────────
  'dataState.unknown': 'ไม่ทราบ',
  'dataState.not-recorded': 'ไม่ได้บันทึก',
  'dataState.estimated': 'ประมาณ',
  'dataState.user-provided': 'ผู้ใช้ใส่',
  'dataState.system-calculated': 'ระบบคำนวณ',
  'dataState.ai-suggested': 'AI แนะนำ',
  'dataState.a11y': 'สถานะข้อมูล: {label}',
  /** design-system §12.9 item 9: "≈" marks an estimate — on the badge, and before an estimated value. */
  'dataState.estimatedMark': '≈',
  'dataState.estimatedBadge': '{mark} {label}',
  'dataState.estimatedValue': '{mark} {value}',
  // ─────────────────────────────────────────────────────────────────────────
  'settings.title': 'ตั้งค่าเครื่อง',
  'settings.back': '← รายการ',
  'settings.open': 'ตั้งค่า',
  'settings.language': 'ภาษา',
  'settings.languageNote': 'เปลี่ยนเฉพาะตัวหนังสือบนหน้าจอ เสียงพูดยังเป็นภาษาไทยเสมอ',
  'settings.theme': 'สีจอ',
  'settings.themeNote': 'สว่างสำหรับกลางแดด มืดสำหรับตอนเย็นหรือในร่ม',
  'settings.speech': 'เสียงนับ',
  'settings.speechNote': 'พูดออกเสียงทุกครั้งที่นับเข่งได้ — ปิดได้โดยไม่กระทบการนับ',
  'common.speechOn': 'เปิด',
  'common.speechOff': 'ปิด',
  'settings.farmProfile': 'ข้อมูลฟาร์ม (โซนและกอง)',

  // ── Sale setup (S6) ──────────────────────────────────────────────────────
  'setup.title': 'ตั้งค่าการขาย',
  'setup.backToList': '← รายการ',
  'setup.ready': 'ทุกอย่างพร้อม',
  'setup.needPrice': 'ยังไม่ได้ตั้งราคา',
  'setup.needZone': 'ยังไม่มีโซน',
  'setup.needSplit': 'บางโซนยังไม่มีส่วนแบ่ง',
  'setup.needPile': 'ยังไม่มีกอง',
  'setup.startCounting': 'เริ่มนับ →',
  'setup.parties': 'ผู้ซื้อและคน',
  'setup.farm': 'ไร่',
  'setup.buyer': 'ล้ง',
  'setup.manager': 'ผู้จัดการ',
  'setup.workerLead': 'หัวหน้าคนงาน',
  'setup.where': 'สถานที่',
  'setup.atFarm': 'ที่ไร่',
  'setup.atBuyer': 'ที่ล้ง',
  'setup.partiesHint': 'ต้องมีชื่อไร่และล้ง',
  'setup.price': 'ราคา',
  'setup.bahtPerKg': '฿ ต่อ กก.',
  'setup.indexRef': 'อ้างอิงราคากลาง',
  'setup.priceHint': 'ต้องใส่ราคามากกว่า 0',
  'setup.split': 'ส่วนแบ่งเริ่มต้น',
  'setup.splitNote': 'ใช้กับโซนที่ไม่ได้ตั้งคนงานของตัวเอง',
  'setup.ownerWorker': 'เจ้าของ / คนงาน',
  'setup.appliesTo': 'คิดจาก',
  'setup.gross': 'ยอดรวม',
  'setup.final': 'ยอดสุทธิ',
  'setup.saved': '✓ บันทึกแล้ว',
  'setup.saving': 'กำลังบันทึก…',
  'setup.zonesPiles': 'โซนและกอง',
  'setup.zoneNamePlaceholder': 'ชื่อโซน',
  'setup.addZone': '+ เพิ่มโซน',
  'setup.zoneWorker': 'คนงาน (เว้นว่างไว้เพื่อใช้ส่วนแบ่งเริ่มต้น)',
  'setup.ownerPct': 'เจ้าของ %',
  'setup.pileRow': '{name} · ตะกร้า {tare} + มาตรฐาน {std} กก.',
  'setup.pileNamePlaceholder': 'ชื่อกอง',
  'setup.tarePlaceholder': 'ตะกร้า กก.',
  'setup.stdPlaceholder': 'มาตรฐาน กก.',
  'setup.addPile': '+ เพิ่มกอง',

  // ── Settlement (S14, S18) ────────────────────────────────────────────────
  'settle.title': 'สรุป',
  'settle.list': 'รายการ',
  'settle.cannotSettle': 'ยังสรุปไม่ได้',
  'settle.backToCounting': '← กลับไปนับ',
  'settle.saleConsequence': 'การขายนี้จะเปิดอีกครั้ง สามารถนับและปิดกองต่อได้',
  'settle.derivation': 'ที่มาของยอด',
  'settle.ownerTotal': 'รวมส่วนเจ้าของ',
  'settle.ownerNote': 'รวมทุกโซน แต่ละโซนคิดตาม % ของตัวเอง',
  'settle.perZone': 'แยกตามโซน',
  'settle.zoneRow': '{name} — {baskets} เข่ง · {weight} กก.',
  'settle.total': 'รวม',
  'settle.perWorker': 'แยกตามคนงาน',
  'settle.noWorker': 'ยังไม่มีการระบุคนงานประจำโซน',
  'settle.reopen': '↺ เปิดการขายอีกครั้ง — กลับไปนับ',
  'settle.zoneOwnerRow': '  เจ้าของ {pct}%',
  'settle.zoneWorkerRow': '  {name} {pct}%',
  'settle.zoneWorkerDefaultName': 'คนงาน (ค่าเริ่มต้น)',
  'settle.payout': 'ยอดจ่ายจริง',
  'settle.deductionRow': '{reason} — {agreedBy}',
  'settle.deductionAdd': '+ เพิ่มรายการหัก',
  'settle.deductionAmount': 'จำนวนเงิน (บาท)',
  'settle.deductionReason': 'เหตุผล',
  'settle.deductionAgreedBy': 'ผู้ตกลง',
  'settle.deductionVoid': 'ยกเลิก',
  'settle.deductionVoidReason': 'เหตุผลที่ยกเลิก',
  'settle.deductionVoidConfirm': 'ยืนยันยกเลิก',

  // ── The sale list (S17) ──────────────────────────────────────────────────
  'sales.title': 'การขาย',
  'sales.empty': 'ยังไม่มีการขาย — เริ่มการขายใหม่ด้านล่าง',
  'sales.new': '+ เริ่มการขายใหม่',
  'sales.unnamed': 'ยังไม่ได้ตั้งค่า',
  'sales.row': '{name} · {status} · {zones} โซน',
  'sales.delete': 'ลบ',
  'sales.deleteLabel': 'ลบ {name}',
  'sales.deleteConfirm': 'ยืนยันลบ',
  'sales.deleteCancel': 'ไม่ลบ',
  'sales.deleteHint': 'ลบแล้วยังกู้คืนได้',
  'sales.deletedLink': 'ที่ลบแล้ว ({n})',

  // ── Sync status pill (SYNC-3, D-28) — v1.1.0 mockup wording ─────────────
  'sync.synced': 'ซิงก์แล้ว',
  'sync.pending': 'รอส่ง {n}',
  'sync.conflict': 'ขัดกัน {n}',
  'sync.label': 'สถานะซิงก์: {status}',

  // ── App menu (☰) ────────────────────────────────────────────────────────
  'menu.open': 'เมนู',
  'menu.close': 'ปิดเมนู',
  'menu.sales': 'การขายทั้งหมด',
  'menu.shared': 'ของกลุ่ม · ทุกเครื่องเห็นเหมือนกัน',
  'menu.device': 'เฉพาะเครื่องนี้ · ไม่ส่งไปเครื่องอื่น',

  // ── Form primitives ─────────────────────────────────────────────────────
  'form.required': 'จำเป็น',

  // ── v2 shell (D-82) — titles from the v1.1.0 mockups ────────────────────
  'v2.building': 'กำลังสร้าง',
  'v2.buildingHint': 'หน้านี้กำลังสร้างใหม่ตาม mockup v1.1.0',
  'v2.home': 'หน้าแรก',
  'v2.back': 'กลับ',
  'v2.prepare': 'เตรียมขาย',
  'v2.toKnow': 'ควรรู้ / ควรจัดการ',
  'v2.farmData': 'ข้อมูลฟาร์ม',
  'v2.people': 'คน',
  'v2.buyers': 'คนรับซื้อยาง',
  'v2.accounts': 'บัญชีรับเงิน',
  'v2.farms': 'สวนและโซน',
  'v2.points': 'จุดชั่ง',
  'v2.shares': 'ส่วนแบ่ง',
  'v2.expenses': 'ค่าใช้จ่ายทั้งหมด',
  'v2.recordExpense': 'บันทึกค่าใช้จ่าย',
  'v2.debts': 'บัญชีหนี้',
  'v2.owed': 'เงินที่สวนต้องคืน',
  'v2.workers': 'ข้อมูลคนงาน',
  'v2.device': 'เครื่องนี้',
  'v2.sales': 'การขายทั้งหมด',
  'v2.saleStart': 'เริ่มการขาย',
  'v2.salePoint': 'เลือกจุดชั่ง',
  'v2.saleZeroTare': 'ขึ้นศูนย์และตะกร้าเปล่า',
  'v2.saleCounter': 'นับเข่ง',
  'v2.salePublic': 'จอให้คนรับซื้อดู',
  'v2.salePartial': 'เข่งไม่เต็ม',
  'v2.saleBackfill': 'บันทึกย้อนหลัง',
  'v2.saleReconcile': 'ตรวจยอด',
  'v2.saleSettlement': 'สรุปยอดส่วนแบ่ง',
  'v2.saleRounding': 'ปัดเศษ',
  'v2.salePayment': 'จ่ายเงิน',
  'v2.sync': 'ซิงก์และข้อมูลขัดกัน',
  'v2.moneyIn': 'รับ',
  'v2.moneyOut': 'จ่าย',
  'v2.baht': 'บาท',
  'deleted.title': 'ที่ลบแล้ว',
  'deleted.back': '← รายการ',
  'deleted.empty': 'ไม่มีรายการที่ลบ',
  'deleted.restore': 'กู้คืน',
  'deleted.saleNotice': 'การขายนี้ถูกลบแล้ว — กู้คืนก่อนจึงจะบันทึกต่อได้',
  'log.deleted': 'ลบรายการ (กู้คืนได้)',
  'log.restored': 'กู้คืนรายการ',

  // ── The log tab ──────────────────────────────────────────────────────────
  'log.accept': 'เข่งมาตรฐาน {weight} กก.',
  'log.short': 'เข่งไม่เต็ม ชั่งได้ {reading} − ตะกร้า {tare} = {net} กก.',
  'log.reject': 'ไม่นับ — ปล่อยเร็วไป {seconds} วิ',
  'log.correction': 'แก้ไข — ยกเลิก #{seq} · {reason}',
  'log.saleStarted': 'เริ่มขาย — {buyer}',
  'log.priceSet': 'ราคา {price} ต่อ กก.',
  'log.splitSet': 'ส่วนแบ่ง {owner}/{worker}',
  'log.zoneAdded': 'เพิ่มโซน {name}',
  'log.zoneContractSet': 'สัญญาโซน — {worker} {pct}%',
  'log.zoneContractCleared': 'ยกเลิกสัญญาโซน — กลับไปใช้ส่วนแบ่งเริ่มต้น',
  'log.pileAdded': 'เพิ่มกอง {name}',
  'log.zeroOk': 'ตาชั่งขึ้นศูนย์ ✓',
  'log.zeroNotOk': 'ตาชั่งไม่ศูนย์ {reading} กก.',
  'log.tareConfirmed': 'ตะกร้าเปล่า {tare} กก.',
  'log.ready': 'พร้อมนับ',
  'log.pileClosed': 'ปิดกอง',
  'log.pileReopened': 'เปิดกองอีกครั้ง — {reason}',
  'log.zoneClosed': 'ปิดโซน',
  'log.zoneReopened': 'เปิดโซนอีกครั้ง — {reason}',
  'log.saleClosed': 'ปิดการขาย',
  'log.saleReopened': 'เปิดการขายอีกครั้ง — {reason}',
  'log.clockAnomaly': 'เวลาเครื่องผิด ({anomaly})',
  'log.deductionAdded': 'หักเงิน {amount} — {reason}',
  'log.deductionVoided': 'ยกเลิกรายการหัก — {reason}',
  // `note` and `state` are precomputed by the caller (sysLabel in counter.tsx)
  // rather than expressed as conditional logic here — the resolver's
  // `interpolate()` is deliberately a plain `{name}` substitution (see
  // resolve.ts), not an ICU MessageFormat engine.
  'log.announced': 'พูด "{thai}"{note}',
  'log.announceFailed': ' — ไม่ได้ยิน',
  'log.speechSet': 'เสียงนับ {state}',

  // ── Farm profile (S27) ───────────────────────────────────────────────────
  'farmProfile.title': 'ข้อมูลฟาร์ม',
  'farmProfile.back': '← ตั้งค่า',
  'farmProfile.empty': 'ยังไม่มีโซนที่บันทึกไว้',
  'farmProfile.seedPrompt': 'พบการขายก่อนหน้า — ใช้โซนและกองจากการขายล่าสุดเป็นจุดเริ่มต้นไหม',
  'farmProfile.seedButton': 'ใช้จากการขายล่าสุด',
  'farmProfile.addZone': '+ เพิ่มโซน',
  'farmProfile.zoneNamePlaceholder': 'ชื่อโซน',
  'farmProfile.renameZone': 'บันทึกชื่อ',
  'farmProfile.archiveZone': 'เก็บโซนนี้',
  'farmProfile.noPiles': 'ยังไม่มีกองในโซนนี้',
  'farmProfile.pileRow': '{name} · ตะกร้า {tare} + มาตรฐาน {std} กก.',
  'farmProfile.addPile': '+ เพิ่มกอง',
  'farmProfile.pileNamePlaceholder': 'ชื่อกอง',
  'farmProfile.tarePlaceholder': 'ตะกร้า กก.',
  'farmProfile.stdPlaceholder': 'มาตรฐาน กก.',
  'farmProfile.editPile': 'แก้ไข',
  'farmProfile.savePile': 'บันทึก',
  'farmProfile.cancelEdit': 'ยกเลิก',
  'farmProfile.removePile': 'ลบ',

  // ── Setup: prefill from the farm profile (S27) ──────────────────────────
  'setup.useFarmProfileTitle': 'ใช้ข้อมูลฟาร์มที่บันทึกไว้',
  'setup.useFarmProfileButton': 'ใช้โซนและกองจากฟาร์ม',

  // ── Dates (D-74 F14) ────────────────────────────────────────────────────
  'date.short': '{day} {month} {year}',
  'date.eraBe': 'พ.ศ.',
  'date.eraCe': 'ค.ศ.',
  'date.a11y': '{date} ({era}) แตะเพื่อแสดงเป็น {other}',
  'date.month1': 'ม.ค.',
  'date.month2': 'ก.พ.',
  'date.month3': 'มี.ค.',
  'date.month4': 'เม.ย.',
  'date.month5': 'พ.ค.',
  'date.month6': 'มิ.ย.',
  'date.month7': 'ก.ค.',
  'date.month8': 'ส.ค.',
  'date.month9': 'ก.ย.',
  'date.month10': 'ต.ค.',
  'date.month11': 'พ.ย.',
  'date.month12': 'ธ.ค.',
} as const;

/**
 * English — the second locale. Incomplete by design and by expectation: see
 * `untranslated` below for what is knowingly missing, and `resolve()` for what
 * happens when something is missing that shouldn't be.
 */
const en: Partial<Record<keyof typeof th, string>> = {
  'common.cancel': 'cancel',
  'common.confirm': 'confirm',
  'common.back': 'back',
  'common.next': 'next',
  'common.save': 'save',
  'common.kg': 'kg',
  'common.baskets': 'baskets',
  'common.themeLight': 'light',
  'common.themeDark': 'dark',

  'tabs.count': 'Count',
  'tabs.pile': 'Pile',
  'tabs.log': 'Log',

  'hold.label': 'Counter, press and hold to count one basket',
  'hold.counted': '✓ counted',
  'hold.movedOff': '✗ not counted — moved off the stage',
  'hold.releasedEarly': '✗ not counted — released early, {seconds}s',
  'hold.rotate': 'turn the phone for a clearer count',

  'short.title': 'short basket — what does the scale read (kg), gross',
  'short.readingLabel': 'scale reading (gross), kg',
  'short.derivation': 'net rubber = reading {reading} − tare {tare} = {net} kg',
  'short.log': 'log this basket',
  'short.open': 'short basket',

  'gate.step': 'step {step} of 3',
  'gate.zeroQuestion': 'nothing on the scale — does it read zero?',
  'gate.zeroYes': 'yes, zero',
  'gate.zeroNo': 'no',
  'gate.zeroReading': 'what does it read instead? (kg)',
  'gate.flagAndContinue': 'flag it and continue anyway',
  'gate.tareQuestion': 'weigh the empty basket — what does the scale read?',
  'gate.tareConfirm': 'confirm basket weight',
  'gate.expected': '{tare} + {std} = {expected} kg',
  'gate.ready': 'start counting',
  'gate.readAloud': 'read aloud before the first basket',

  'reopen.title': 'reopening {target}',
  'reopen.reasonPlaceholder': 'reason for reopening',
  'reopen.areYouSure': 'are you sure? reopening will be recorded.',
  'reopen.confirm': 'confirm reopen',
  'reopen.pileConsequence': 'this pile becomes countable again. Nothing already recorded is erased.',
  'reopen.zoneConsequence': 'the zone reopens, but piles already closed inside it stay closed.',
  'reopen.saleConsequence': 'the sale becomes editable again and settlement is recalculated.',

  'counter.loading': 'loading…',
  'counter.miniCount': 'count {n}',
  'counter.counting': 'counting',
  'counter.stopped': 'stopped',
  'counter.clockSuspect': 'clock looks wrong',
  'counter.speechDegraded': 'speech is not working',
  'counter.switcher': 'zone/pile',
  'counter.pileNotReady': 'pile not ready',
  'counter.undo': 'undo last',
  'counter.mistapReason': 'mistap',
  'counter.undoDetail':
    'undo basket #{seq} — {kind} {weight} kg. Shown as voided in the log, not deleted.',
  'counter.undoConfirm': 'confirm undo',
  'counter.undoCancel': 'cancel',
  'counter.closeSale': 'close sale',
  'counter.closeSaleTitle': 'close the sale?',
  'counter.closeSaleDetail': '{zones} zones, {piles} piles — {baskets} baskets, {weight} kg counted so far.',
  'counter.closeSaleStillCounting':
    '{n} pile(s) still counting stop being countable immediately — they are not auto-closed.',
  'counter.closeSaleAfter': 'settlement is calculated immediately; the sale can be reopened later.',
  'counter.closeSaleConfirm': 'confirm close sale',

  'pile.thisPile': '{name}',
  'pile.standard': 'standard',
  'pile.short': 'short',
  'pile.weight': 'weight',
  'pile.scale': 'scale',
  'pile.tare': 'tare',
  'pile.stdNet': 'standard net',
  'pile.expected': 'expected',
  'pile.rollups': 'rollups',
  'pile.wholeSale': 'whole sale',
  'pile.allBaskets': 'all baskets',
  'pile.closeReopen': 'close / reopen',
  'pile.close': 'close pile',
  'pile.closeDetail': 'close {name} — {baskets} baskets, {weight} kg. Counting stops immediately.',
  'pile.closeConfirm': 'confirm close pile',
  'pile.reopen': 'reopen pile',
  'pile.notStarted': 'not started yet',
  'zone.close': 'close zone',
  'zone.closeDetail': 'close {name} — {baskets} baskets, {weight} kg.',
  'zone.closeWarning': '{n} pile(s) still counting will be force-closed too: {names}',
  'zone.closeConfirm': 'confirm close zone',
  'zone.reopen': 'reopen zone',

  'switcher.title': 'pick a zone and pile',
  'switcher.close': '✕',
  'switcher.zoneRow': '{name} · {status}',
  'switcher.pileRow': '{name} · {status}',
  'status.notStarted': 'not started',
  'status.counting': 'counting',
  'status.closed': 'closed',
  'status.open': 'open',

  'people.loading': 'loading the list…',
  'people.change': 'change',
  'people.empty': 'no one on the list yet',
  'people.namePlaceholder': "worker's name",
  'people.add': 'add',
  'people.addNew': '+ add a new worker',

  'weight.dragHint': 'drag to adjust',

  'closed.title': 'pile closed',
  'closed.total': '{name} — {baskets} baskets · {weight} kg',
  'closed.nextPile': 'next pile in this zone →',
  'closed.switchZone': 'switch zone',
  'closed.closeZone': 'close this zone',

  'storage.notDurable': 'Not saved permanently — this browser cannot store data; reloading or closing the tab loses it',
  // ── Data state ──
  'dataState.unknown': 'unknown',
  'dataState.not-recorded': 'not recorded',
  'dataState.estimated': 'estimated',
  'dataState.user-provided': 'entered by user',
  'dataState.system-calculated': 'calculated',
  'dataState.ai-suggested': 'AI suggested',
  'dataState.a11y': 'data state: {label}',
  'dataState.estimatedMark': '≈',
  'dataState.estimatedBadge': '{mark} {label}',
  'dataState.estimatedValue': '{mark} {value}',
  // ──
  'settings.title': 'device settings',
  'settings.back': '← list',
  'settings.open': 'settings',
  'settings.language': 'language',
  'settings.languageNote': 'changes the text on screen only — the spoken count is always Thai',
  'settings.theme': 'screen',
  'settings.themeNote': 'light for direct sun, dark for evening or indoors',
  'settings.speech': 'spoken count',
  'settings.speechNote': 'speaks each basket count aloud — turning it off does not change the counting itself',
  'common.speechOn': 'on',
  'common.speechOff': 'off',
  'settings.farmProfile': 'farm profile (zones and piles)',

  'setup.title': 'sale setup',
  'setup.backToList': '← list',
  'setup.ready': 'price, split and at least one pile are set',
  'setup.needPrice': 'price not set yet',
  'setup.needZone': 'add a zone',
  'setup.needSplit': 'a zone has no split, and there is no default',
  'setup.needPile': 'add at least one pile',
  'setup.startCounting': 'start counting →',
  'setup.parties': 'buyer & people',
  'setup.farm': 'farm',
  'setup.buyer': 'buyer',
  'setup.manager': 'manager',
  'setup.workerLead': 'worker lead',
  'setup.where': 'where',
  'setup.atFarm': 'at farm',
  'setup.atBuyer': 'at buyer',
  'setup.partiesHint': 'farm and buyer are required',
  'setup.price': 'agreed price',
  'setup.bahtPerKg': 'baht per kg',
  'setup.indexRef': 'market index reference',
  'setup.priceHint': 'price must be greater than 0',
  'setup.split': 'default split',
  'setup.splitNote': 'applies to any zone with no worker of its own',
  'setup.ownerWorker': 'owner / worker',
  'setup.appliesTo': 'applies to',
  'setup.gross': 'gross',
  'setup.final': 'final',
  'setup.saved': '✓ saved',
  'setup.saving': 'saving…',
  'setup.zonesPiles': 'zones & piles',
  'setup.zoneNamePlaceholder': 'zone name',
  'setup.addZone': '+ add zone',
  'setup.zoneWorker': 'worker (leave unset to use the default split)',
  'setup.ownerPct': 'owner %',
  'setup.pileRow': '{name} · tare {tare} + standard {std} kg',
  'setup.pileNamePlaceholder': 'pile name',
  'setup.tarePlaceholder': 'tare kg',
  'setup.stdPlaceholder': 'standard kg',
  'setup.addPile': '+ add pile',

  'settle.title': 'settlement',
  'settle.list': 'list',
  'settle.cannotSettle': 'cannot settle yet',
  'settle.backToCounting': '← back to counting',
  'settle.saleConsequence': 'the sale reopens; counting and closing can continue.',
  'settle.derivation': 'how the total was reached',
  'settle.ownerTotal': 'owner total',
  'settle.ownerNote': 'summed across every zone below, each at its own %',
  'settle.perZone': 'per zone',
  'settle.zoneRow': '{name} — {baskets} baskets · {weight} kg',
  'settle.total': 'total',
  'settle.perWorker': 'per worker',
  'settle.noWorker': 'no zone has a worker named yet',
  'settle.reopen': '↺ reopen — back to counting',
  'settle.zoneOwnerRow': '  owner {pct}%',
  'settle.zoneWorkerRow': '  {name} {pct}%',
  'settle.zoneWorkerDefaultName': 'worker (default)',
  'settle.payout': 'payout',
  'settle.deductionRow': '{reason} — {agreedBy}',
  'settle.deductionAdd': '+ add a deduction',
  'settle.deductionAmount': 'amount (baht)',
  'settle.deductionReason': 'reason',
  'settle.deductionAgreedBy': 'agreed by',
  'settle.deductionVoid': 'void',
  'settle.deductionVoidReason': 'reason for voiding',
  'settle.deductionVoidConfirm': 'confirm void',

  'sales.title': 'sales',
  'sales.empty': 'no sales yet — start one below.',
  'sales.new': '+ start a new sale',
  'sales.unnamed': 'not set up yet',
  'sales.row': '{name} · {status} · {zones} zones',
  'sales.delete': 'delete',
  'sales.deleteLabel': 'delete {name}',
  'sales.deleteConfirm': 'confirm delete',
  'sales.deleteCancel': 'keep',
  'sales.deleteHint': 'a deleted sale can be restored',
  'sales.deletedLink': 'deleted ({n})',

  'sync.synced': 'synced',
  'sync.pending': '{n} pending',
  'sync.conflict': '{n} conflicts',
  'sync.label': 'sync status: {status}',

  'menu.open': 'menu',
  'menu.close': 'close menu',
  'menu.sales': 'all sales',
  'menu.shared': 'shared · same on every device',
  'menu.device': 'this device only · not sent elsewhere',

  'form.required': 'required',

  'v2.building': 'under construction',
  'v2.buildingHint': 'this screen is being rebuilt from the v1.1.0 mockups',
  'v2.home': 'home',
  'v2.back': 'back',
  'v2.prepare': 'get ready to sell',
  'v2.toKnow': 'to know / to handle',
  'v2.farmData': 'farm data',
  'v2.people': 'people',
  'v2.buyers': 'buyers',
  'v2.accounts': 'receiving accounts',
  'v2.farms': 'farms and zones',
  'v2.points': 'weighing points',
  'v2.shares': 'shares',
  'v2.expenses': 'all expenses',
  'v2.recordExpense': 'record an expense',
  'v2.debts': 'debts',
  'v2.owed': 'money the farm owes back',
  'v2.workers': 'workers',
  'v2.device': 'this device',
  'v2.sales': 'all sales',
  'v2.saleStart': 'start a sale',
  'v2.salePoint': 'pick a weighing point',
  'v2.saleZeroTare': 'zero and empty basket',
  'v2.saleCounter': 'count baskets',
  'v2.salePublic': 'buyer screen',
  'v2.salePartial': 'short baskets',
  'v2.saleBackfill': 'record afterwards',
  'v2.saleReconcile': 'reconcile',
  'v2.saleSettlement': 'settlement',
  'v2.saleRounding': 'rounding',
  'v2.salePayment': 'payment',
  'v2.sync': 'sync and conflicts',
  'v2.moneyIn': 'in',
  'v2.moneyOut': 'out',
  'v2.baht': 'baht',
  'deleted.title': 'deleted',
  'deleted.back': '← list',
  'deleted.empty': 'nothing deleted',
  'deleted.restore': 'restore',
  'deleted.saleNotice': 'this sale was deleted — restore it to keep recording',
  'log.deleted': 'deleted (can be restored)',
  'log.restored': 'restored',

  'log.accept': 'standard basket {weight} kg',
  'log.short': 'short basket — reading {reading} − tare {tare} = {net} kg',
  'log.reject': 'not counted — released early, {seconds}s',
  'log.correction': 'correction — undo #{seq} · {reason}',
  'log.saleStarted': 'sale started — {buyer}',
  'log.priceSet': 'price {price} per kg',
  'log.splitSet': 'split {owner}/{worker}',
  'log.zoneAdded': 'zone added — {name}',
  'log.zoneContractSet': 'zone contract — {worker} {pct}%',
  'log.zoneContractCleared': 'zone contract cleared — back to the default split',
  'log.pileAdded': 'pile added — {name}',
  'log.zeroOk': 'scale read zero ✓',
  'log.zeroNotOk': 'scale did not read zero — {reading} kg',
  'log.tareConfirmed': 'empty basket {tare} kg',
  'log.ready': 'ready to count',
  'log.pileClosed': 'pile closed',
  'log.pileReopened': 'pile reopened — {reason}',
  'log.zoneClosed': 'zone closed',
  'log.zoneReopened': 'zone reopened — {reason}',
  'log.saleClosed': 'sale closed',
  'log.saleReopened': 'sale reopened — {reason}',
  'log.clockAnomaly': "device clock looks wrong ({anomaly})",
  'log.deductionAdded': 'deduction {amount} — {reason}',
  'log.deductionVoided': 'deduction voided — {reason}',
  'log.announced': 'said "{thai}"{note}',
  'log.announceFailed': ' — not heard',
  'log.speechSet': 'spoken count {state}',

  'farmProfile.title': 'farm profile',
  'farmProfile.back': '← settings',
  'farmProfile.empty': 'no zones saved yet',
  'farmProfile.seedPrompt': 'found a past sale — use its zones and piles as a starting point?',
  'farmProfile.seedButton': 'use the last sale',
  'farmProfile.addZone': '+ add zone',
  'farmProfile.zoneNamePlaceholder': 'zone name',
  'farmProfile.renameZone': 'save name',
  'farmProfile.archiveZone': 'archive this zone',
  'farmProfile.noPiles': 'no piles in this zone yet',
  'farmProfile.pileRow': '{name} · tare {tare} + standard {std} kg',
  'farmProfile.addPile': '+ add pile',
  'farmProfile.pileNamePlaceholder': 'pile name',
  'farmProfile.tarePlaceholder': 'tare kg',
  'farmProfile.stdPlaceholder': 'standard kg',
  'farmProfile.editPile': 'edit',
  'farmProfile.savePile': 'save',
  'farmProfile.cancelEdit': 'cancel',
  'farmProfile.removePile': 'remove',

  'setup.useFarmProfileTitle': 'use the saved farm profile',
  'setup.useFarmProfileButton': 'use zones and piles from the farm',
  'date.short': '{day} {month} {year}',
  'date.eraBe': 'BE',
  'date.eraCe': 'CE',
  'date.a11y': '{date} ({era}) tap to show in {other}',
  'date.month1': 'Jan',
  'date.month2': 'Feb',
  'date.month3': 'Mar',
  'date.month4': 'Apr',
  'date.month5': 'May',
  'date.month6': 'Jun',
  'date.month7': 'Jul',
  'date.month8': 'Aug',
  'date.month9': 'Sep',
  'date.month10': 'Oct',
  'date.month11': 'Nov',
  'date.month12': 'Dec',
};

export const messages = { th, en } as const;

export type MessageId = keyof typeof th;

/**
 * True for the announced register (FR-11): everything the app SAYS, and every
 * on-screen quotation of it.
 *
 * ── The announced register is always Thai ───────────────────────────────────
 *
 * The UI locale is about the person holding the phone. The voice is not — it
 * is aimed at the people standing around the scale, and they are Thai
 * speakers. FR-9's whole cross-check rests on the other party hearing a count
 * they can follow without holding anything; a count announced in English
 * because the operator switched their own labels would break exactly that,
 * silently, for everyone except the one person who changed the setting.
 *
 * So `say.*` never takes a locale and never gets an English column. It is not
 * an untranslated backlog item — translating it is the bug.
 *
 * The spoken numerals are Thai for the same reason and stay Arabic digits on
 * screen for a different one: the log and the settlement are documents two
 * parties check by hand.
 */
export function isAnnounced(id: MessageId): boolean {
  return id.startsWith('say.');
}

/**
 * Ids knowingly shown in Thai even to an English reader.
 *
 * Not a to-do list — an explicit decision, per id, that translating it would
 * be wrong. The parity test in `resolve.test.ts` fails on anything missing
 * from `en` that is not listed here, which is what stops the catalogue rotting
 * quietly as stories add strings.
 */
export const untranslated: readonly MessageId[] = [
  ...(Object.keys(th) as MessageId[]).filter(isAnnounced),
  'common.language',
];
